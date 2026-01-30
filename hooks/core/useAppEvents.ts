import { useState, useEffect, useCallback } from 'react';
import { AppSettings, ChatSettings } from '../../types';
import { TAB_CYCLE_MODELS, DEFAULT_SHORTCUTS } from '../../constants/appConstants';
import { logService } from '../../utils/appUtils';
import { isShortcutPressed } from '../../utils/shortcutUtils';

interface AppEventsProps {
    appSettings: AppSettings;
    startNewChat: () => void;
    handleClearCurrentChat: () => void;
    currentChatSettings: ChatSettings;
    handleSelectModelInHeader: (modelId: string) => void;
    isSettingsModalOpen: boolean;
    isPreloadedMessagesModalOpen: boolean;
    setIsLogViewerOpen: (isOpen: boolean | ((prev: boolean) => boolean)) => void;
    onTogglePip: () => void;
    isPipSupported: boolean;
    pipWindow?: Window | null;
    isLoading: boolean;
    onStopGenerating: () => void;
}

export const useAppEvents = ({
    appSettings,
    startNewChat,
    handleClearCurrentChat,
    currentChatSettings,
    handleSelectModelInHeader,
    isSettingsModalOpen,
    isPreloadedMessagesModalOpen,
    setIsLogViewerOpen,
    onTogglePip,
    isPipSupported,
    pipWindow,
    isLoading,
    onStopGenerating,
}: AppEventsProps) => {
    const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
    const [isStandalone, setIsStandalone] = useState(window.matchMedia('(display-mode: standalone)').matches);

    // PWA Installation Handlers
    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            logService.info('PWA install prompt available.');
            setInstallPromptEvent(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    useEffect(() => {
        const handleAppInstalled = () => {
            logService.info('PWA installed successfully.');
            setInstallPromptEvent(null);
            setIsStandalone(true);
        };
        window.addEventListener('appinstalled', handleAppInstalled);
        return () => window.removeEventListener('appinstalled', handleAppInstalled);
    }, []);

    const handleInstallPwa = async () => {
        if (!installPromptEvent) return;
        installPromptEvent.prompt();
        const { outcome } = await installPromptEvent.userChoice;
        logService.info(`PWA install prompt outcome: ${outcome}`);
        setInstallPromptEvent(null);
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented) return; // Ignore if already handled (e.g. by textarea)

            // Check active element in the document where the event occurred
            const targetDoc = event.view?.document || document;
            const activeElement = targetDoc.activeElement as HTMLElement;

            const isGenerallyInputFocused = activeElement && (
                activeElement.tagName.toLowerCase() === 'input' ||
                activeElement.tagName.toLowerCase() === 'textarea' ||
                activeElement.tagName.toLowerCase() === 'select' ||
                activeElement.isContentEditable
            );

            const shortcuts = appSettings.shortcuts || DEFAULT_SHORTCUTS;

            // Stop Generation (Hardcoded Escape)
            if (event.key === 'Escape' && isLoading) {
                event.preventDefault();
                onStopGenerating();
                return;
            }

            // Open Logs
            if (isShortcutPressed(event, shortcuts.openLogs)) {
                event.preventDefault();
                setIsLogViewerOpen(prev => !prev);
            }
            // PiP Mode
            else if (isShortcutPressed(event, shortcuts.togglePip)) {
                if (isPipSupported) {
                    event.preventDefault();
                    onTogglePip();
                }
            }
            // Cycle Models
            else if (isShortcutPressed(event, shortcuts.cycleModels) && TAB_CYCLE_MODELS.length > 0) {
                const isChatTextareaFocused = activeElement?.getAttribute('aria-label') === 'Chat message input';
                if (isChatTextareaFocused || !isGenerallyInputFocused) {
                    event.preventDefault();
                    const currentModelId = currentChatSettings.modelId;
                    const currentIndex = TAB_CYCLE_MODELS.indexOf(currentModelId);
                    let nextIndex: number;
                    if (currentIndex === -1) nextIndex = 0;
                    else nextIndex = (currentIndex + 1) % TAB_CYCLE_MODELS.length;
                    const newModelId = TAB_CYCLE_MODELS[nextIndex];
                    if (newModelId) handleSelectModelInHeader(newModelId);
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        if (pipWindow && pipWindow.document) {
            pipWindow.document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (pipWindow && pipWindow.document) {
                pipWindow.document.removeEventListener('keydown', handleKeyDown);
            }
        };
    }, [startNewChat, isSettingsModalOpen, isPreloadedMessagesModalOpen, currentChatSettings.modelId, handleSelectModelInHeader, setIsLogViewerOpen, isPipSupported, onTogglePip, pipWindow, isLoading, onStopGenerating, appSettings.shortcuts]);

    return {
        installPromptEvent,
        isStandalone,
        handleInstallPwa,
    };
};