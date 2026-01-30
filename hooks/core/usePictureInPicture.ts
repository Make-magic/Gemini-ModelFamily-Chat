
import { useState, useEffect, useCallback } from 'react';
import { logService } from '../../utils/appUtils';

declare global {
    interface Window {
        documentPictureInPicture?: {
            requestWindow(options?: { width: number, height: number }): Promise<Window>;
            readonly window?: Window;
        };
    }
}

export const usePictureInPicture = (setIsHistorySidebarOpen: (value: boolean | ((prev: boolean) => boolean)) => void) => {
    // Always true as we have a fallback using window.open
    const [isPipSupported, setIsPipSupported] = useState(true);
    const [pipWindow, setPipWindow] = useState<Window | null>(null);
    const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);

    // No longer need to check for documentPictureInPicture availability for "support"
    // since we fallback to window.open
    useEffect(() => {
        setIsPipSupported(true);
    }, []);

    const closePip = useCallback(() => {
        if (pipWindow) {
            // The 'pagehide' event listener handles the state cleanup and sidebar expansion
            pipWindow.close();
        }
    }, [pipWindow]);

    const setupPipWindow = useCallback((win: Window) => {
        // Copy all head elements from the main document to the PiP window.
        Array.from(document.head.childNodes).forEach(node => {
            if (node.nodeName === 'SCRIPT' && (node as HTMLScriptElement).src && (node as HTMLScriptElement).src.includes('index.tsx')) {
                return;
            }
            win.document.head.appendChild(node.cloneNode(true));
        });

        win.document.title = "All Model Chat - PiP";
        win.document.body.className = document.body.className;
        win.document.body.style.margin = '0';
        win.document.body.style.overflow = 'hidden';

        // Ensure full height/width for layout
        win.document.documentElement.style.height = '100%';
        win.document.body.style.height = '100%';
        win.document.body.style.width = '100%';

        // Create a root container for the React portal
        const container = win.document.createElement('div');
        container.id = 'pip-root';
        container.style.height = '100%';
        container.style.width = '100%';
        win.document.body.appendChild(container);

        // Listen for when the user closes the PiP window
        const cleanup = () => {
            setPipWindow(null);
            setPipContainer(null);
            // Expand sidebar when exiting PiP mode
            setIsHistorySidebarOpen(true);
            logService.info('PiP window closed.');
        };

        // 'pagehide' generally works for PiP, 'beforeunload' is safer for popups
        win.addEventListener('pagehide', cleanup, { once: true });
        win.addEventListener('beforeunload', cleanup, { once: true });

        setPipWindow(win);
        setPipContainer(container);
    }, [setIsHistorySidebarOpen]);

    const openPip = useCallback(async () => {
        if (!isPipSupported || pipWindow) return;

        // Collapse sidebar when entering PiP mode
        setIsHistorySidebarOpen(false);

        try {
            let pipWin: Window | null = null;

            if ('documentPictureInPicture' in window && window.documentPictureInPicture) {
                // Native PiP API
                pipWin = await window.documentPictureInPicture.requestWindow({
                    width: 500,
                    height: 700,
                });
            } else {
                // Fallback: Popup Window
                // Calculate position to be somewhat centered or slightly offset
                const width = 500;
                const height = 700;
                const left = window.screen.width / 2 - width / 2;
                const top = window.screen.height / 2 - height / 2;

                pipWin = window.open(
                    '',
                    'AMC_PiP',
                    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
                );
            }

            if (pipWin) {
                setupPipWindow(pipWin);
                logService.info('PiP window opened.');
            } else {
                throw new Error("Failed to create PiP window");
            }

        } catch (error) {
            logService.error('Error opening Picture-in-Picture window:', error);
            setPipWindow(null);
            setPipContainer(null);
            // If opening fails, revert the sidebar state
            setIsHistorySidebarOpen(true);
        }
    }, [isPipSupported, pipWindow, setIsHistorySidebarOpen, setupPipWindow]);

    const togglePip = useCallback(() => {
        if (pipWindow) {
            closePip();
        } else {
            openPip();
        }
    }, [pipWindow, openPip, closePip]);

    return {
        isPipSupported,
        isPipActive: !!pipWindow,
        togglePip,
        pipContainer,
        pipWindow,
    };
};
