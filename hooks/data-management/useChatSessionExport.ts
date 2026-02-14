
import React, { useCallback } from 'react';
import { SavedChatSession, Theme } from '../../types';
import { logService } from '../../utils/appUtils';
import {
    sanitizeFilename,
    exportElementAsPng,
    exportHtmlStringAsFile,
    exportTextStringAsFile,
    gatherPageStyles,
    triggerDownload,
    generateExportHtmlTemplate,
    generateExportTxtTemplate,
    embedImagesInClone,
    createSnapshotContainer
} from '../../utils/exportUtils';
import DOMPurify from 'dompurify';

interface UseChatSessionExportProps {
    activeChat: SavedChatSession | undefined;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    currentTheme: Theme;
    language: 'en' | 'zh';
    t: (key: string) => string;
}

export const useChatSessionExport = ({
    activeChat,
    scrollContainerRef,
    currentTheme,
    language,
    t
}: UseChatSessionExportProps) => {

    const exportChatLogic = useCallback(async (format: 'png' | 'html' | 'txt' | 'json') => {
        if (!activeChat) return;

        const safeTitle = sanitizeFilename(activeChat.title);
        const dateObj = new Date();
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
        const isoDate = dateObj.toISOString().slice(0, 10);
        const filename = `chat-${safeTitle}-${isoDate}.${format}`;
        const scrollContainer = scrollContainerRef.current;

        // Small delay to allow MessageList to render all messages (bypassing virtualization)
        // when exportStatus is set to 'exporting' in the parent.
        if (format === 'png' || format === 'html') {
            await new Promise(resolve => setTimeout(resolve, 800));
        }

        if (format === 'png') {
            if (!scrollContainer) return;

            let cleanup = () => { };
            try {
                const { container, innerContent, remove, rootBgColor } = await createSnapshotContainer(
                    currentTheme.id,
                    '800px'
                );
                cleanup = remove;

                // Clone the chat container
                const chatClone = scrollContainer.cloneNode(true) as HTMLElement;
                chatClone.style.height = 'auto';
                chatClone.style.maxHeight = 'none';
                chatClone.style.overflow = 'visible';
                chatClone.style.paddingBottom = '2rem'; // Add some breathing room at the bottom

                // Clean UI elements that shouldn't be in the export
                const selectorsToRemove = [
                    'button',
                    '.message-actions',
                    '.sticky',
                    'input',
                    'textarea',
                    '.code-block-utility-button',
                    '[role="tooltip"]',
                    '.loading-dots-container',
                    '.scroll-navigation',
                    '[aria-label*="Scroll to"]'
                ];
                chatClone.querySelectorAll(selectorsToRemove.join(',')).forEach(el => el.remove());

                // Pre-process the clone
                chatClone.querySelectorAll('details').forEach(details => {
                    details.setAttribute('open', 'true');
                });
                
                chatClone.querySelectorAll('[data-message-id]').forEach(el => {
                    (el as HTMLElement).style.animation = 'none';
                    (el as HTMLElement).style.opacity = '1';
                    (el as HTMLElement).style.transform = 'none';
                    (el as HTMLElement).style.transition = 'none';
                });

                // Embed images in the clone before injecting (handles avatars, generated images)
                await embedImagesInClone(chatClone);

                // Create header
                const headerHtml = `
                    <div style="padding: 2.5rem 2rem 1.5rem 2rem; border-bottom: 1px solid var(--theme-border-secondary); margin-bottom: 1.5rem;">
                        <h1 style="font-size: 1.75rem; font-weight: bold; color: var(--theme-text-primary); margin: 0 0 0.75rem 0; line-height: 1.2;">${activeChat.title}</h1>
                        <div style="font-size: 0.875rem; color: var(--theme-text-tertiary); display: flex; gap: 1.25rem; align-items: center;">
                            <span style="display: flex; align-items: center; gap: 0.5rem;">${dateStr}</span>
                            <span style="opacity: 0.5;">•</span>
                            <span style="font-family: monospace; background: var(--theme-bg-tertiary); padding: 0.125rem 0.375rem; border-radius: 0.25rem;">${activeChat.settings.modelId}</span>
                        </div>
                    </div>
                `;

                const exportWrapper = document.createElement('div');
                exportWrapper.className = 'png-export-wrapper';
                exportWrapper.style.width = '100%';
                exportWrapper.style.display = 'block';
                exportWrapper.innerHTML = headerHtml;
                
                const bodyDiv = document.createElement('div');
                bodyDiv.style.padding = '0 2rem 2rem 2rem';
                bodyDiv.appendChild(chatClone);
                exportWrapper.appendChild(bodyDiv);

                innerContent.appendChild(exportWrapper);

                // Wait for rendering
                await new Promise(resolve => setTimeout(resolve, 1000));

                await exportElementAsPng(container, filename, {
                    backgroundColor: rootBgColor,
                    scale: 2,
                });

            } finally {
                cleanup();
            }
            return;
        }

        if (format === 'html') {
            if (!scrollContainer) return;

            // 1. Clone the container to avoid modifying the live UI
            const chatClone = scrollContainer.cloneNode(true) as HTMLElement;

            // 2. Clean UI elements that shouldn't be in the export
            const selectorsToRemove = [
                'button',
                '.message-actions',
                '.sticky',
                'input',
                'textarea',
                '.code-block-utility-button',
                '[role="tooltip"]',
                '.loading-dots-container'
            ];
            chatClone.querySelectorAll(selectorsToRemove.join(',')).forEach(el => el.remove());

            // 3. Expand all details elements (thoughts) so they are visible in export
            chatClone.querySelectorAll('details').forEach(el => el.setAttribute('open', 'true'));

            // 4. Embed Images: Convert blob/url images to Base64 for self-contained HTML
            await embedImagesInClone(chatClone);

            // 5. Gather Styles & Generate Template
            const styles = await gatherPageStyles();
            const bodyClasses = document.body.className;
            const rootBgColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-bg-primary');
            const chatHtml = chatClone.innerHTML;

            const fullHtml = generateExportHtmlTemplate({
                title: DOMPurify.sanitize(activeChat.title),
                date: dateStr,
                model: activeChat.settings.modelId,
                contentHtml: chatHtml,
                styles,
                themeId: currentTheme.id,
                language,
                rootBgColor,
                bodyClasses
            });

            exportHtmlStringAsFile(fullHtml, filename);
        } else if (format === 'txt') {
            const txtContent = generateExportTxtTemplate({
                title: activeChat.title,
                date: dateStr,
                model: activeChat.settings.modelId,
                messages: activeChat.messages.map(m => ({
                    role: m.role === 'user' ? 'USER' : 'ASSISTANT',
                    timestamp: m.timestamp,
                    content: m.content,
                    files: m.files?.map(f => ({ name: f.name }))
                }))
            });

            exportTextStringAsFile(txtContent, filename);
        } else if (format === 'json') {
            logService.info(`Exporting chat ${activeChat.id} as JSON.`);
            try {
                // We create a structure compatible with the history import feature
                const dataToExport = {
                    type: 'AllModelChat-History',
                    version: 1,
                    history: [activeChat], // Exporting only the active chat session
                    groups: [], // No groups are exported with a single chat
                };
                const jsonString = JSON.stringify(dataToExport, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                triggerDownload(URL.createObjectURL(blob), filename);
            } catch (error) {
                logService.error('Failed to export chat as JSON', { error });
                alert(t('export_failed_title'));
            }
        }
    }, [activeChat, currentTheme, language, scrollContainerRef, t]);

    return { exportChatLogic };
};
