
import React, { useCallback } from 'react';
import { AppSettings, SavedChatSession, Theme } from '../../types';
import { logService } from '../../utils/appUtils';
import { downloadBlob } from '../../utils/objectUrlManager';
import {
    sanitizeFilename,
    exportElementAsPng,
    exportHtmlStringAsFile,
    exportTextStringAsFile,
    gatherPageStyles,
    generateExportHtmlTemplate,
    generateExportTxtTemplate,
    embedImagesInClone,
    createSnapshotContainer,
    exportChatAsPdfDocument
} from '../../utils/exportUtils';
import DOMPurify from 'dompurify';
import { createChatExportDom } from '../../utils/export/chatDom';

interface UseChatSessionExportProps {
    activeChat: SavedChatSession | undefined;
    appSettings: AppSettings;
    currentTheme: Theme;
    language: 'en' | 'zh';
    t: (key: string) => string;
}

export const useChatSessionExport = ({
    activeChat,
    appSettings,
    currentTheme,
    language,
    t
}: UseChatSessionExportProps) => {

    const exportChatLogic = useCallback(async (format: 'png' | 'html' | 'txt' | 'md' | 'json' | 'pdf') => {
        if (!activeChat) return;

        const safeTitle = sanitizeFilename(activeChat.title);
        const dateObj = new Date();
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
        const isoDate = dateObj.toISOString().slice(0, 10);
        
        // Use .md extension for both 'txt' and 'md' formats
        const extension = (format === 'txt' || format === 'md') ? 'md' : format;
        const filename = `chat-${safeTitle}-${isoDate}.${extension}`;
        if (format === 'pdf') {
            await exportChatAsPdfDocument(
                activeChat.title,
                activeChat.messages,
                activeChat.settings.modelId
            );
            return;
        }

        if (format === 'png') {
            let cleanup = () => { };
            let removeExportDom = () => { };
            try {
                const exportDom = await createChatExportDom({
                    session: activeChat,
                    appSettings,
                    theme: currentTheme,
                    t,
                });
                removeExportDom = exportDom.remove;
                const { container, innerContent, remove, rootBgColor } = await createSnapshotContainer(
                    currentTheme.id,
                    '800px'
                );
                cleanup = remove;

                const chatClone = exportDom.content.cloneNode(true) as HTMLElement;
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

                await exportElementAsPng(container, filename, {
                    backgroundColor: rootBgColor,
                    scale: 2,
                });

            } finally {
                cleanup();
                removeExportDom();
            }
            return;
        }

        if (format === 'html') {
            const exportDom = await createChatExportDom({
                session: activeChat,
                appSettings,
                theme: currentTheme,
                t,
            });
            try {
                const chatClone = exportDom.content.cloneNode(true) as HTMLElement;

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

                chatClone.querySelectorAll('details').forEach(el => el.setAttribute('open', 'true'));

                await embedImagesInClone(chatClone);

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
            } finally {
                exportDom.remove();
            }
        } else if (format === 'txt' || format === 'md') {
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
                downloadBlob(blob, filename);
            } catch (error) {
                logService.error('Failed to export chat as JSON', { error });
                alert(t('export_failed_title'));
            }
        }
    }, [activeChat, appSettings, currentTheme, language, t]);

    return { exportChatLogic };
};
