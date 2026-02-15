
import { useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import { ChatMessage } from '../types';
import {
    exportElementAsPng,
    exportHtmlStringAsFile,
    exportTextStringAsFile,
    triggerDownload,
    sanitizeFilename,
    generateExportHtmlTemplate,
    generateExportTxtTemplate,
    gatherPageStyles,
    createSnapshotContainer,
    embedImagesInClone,
    exportChatAsPdfDocument
} from '../utils/exportUtils';

interface UseMessageExportProps {
    message: ChatMessage;
    sessionTitle?: string;
    messageIndex?: number;
    themeId: string;
}

export type ExportType = 'png' | 'html' | 'txt' | 'json' | 'pdf';

export const useMessageExport = ({ message, sessionTitle, messageIndex, themeId }: UseMessageExportProps) => {
    const [exportingType, setExportingType] = useState<ExportType | null>(null);

    const handleExport = async (type: ExportType, onSuccess?: () => void) => {
        if (exportingType) return;
        setExportingType(type);

        try {
            const markdownContent = message.content || '';
            const messageId = message.id;
            const shortId = messageId.slice(-6);

            let filenameBase = `message-${shortId}`;

            if (sessionTitle) {
                const safeTitle = sanitizeFilename(sessionTitle);
                const indexStr = messageIndex !== undefined ? `_msg_${messageIndex + 1}` : '';
                filenameBase = `${safeTitle}${indexStr}`;
            } else {
                const contentSnippet = markdownContent.replace(/[^\w\s]/gi, '').split(' ').slice(0, 5).join('_');
                const safeSnippet = sanitizeFilename(contentSnippet) || 'message';
                filenameBase = `${safeSnippet}-${shortId}`;
            }

            const dateObj = new Date(message.timestamp);
            const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();

            // Small delay to allow UI to update to "Exporting..." state
            if (type !== 'png') {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (type === 'pdf') {
                await exportChatAsPdfDocument(
                    sessionTitle || `Message ${shortId}`,
                    [message],
                    'Single Message'
                );
            } else if (type === 'png') {
                // Attempt to find the rendered DOM bubble to preserve Math/Syntax/Diagrams
                const messageBubble = document.querySelector(`[data-message-id="${message.id}"] > div > .shadow-sm`);

                let contentNode: HTMLElement;

                if (messageBubble) {
                    // Clone the full bubble (includes files, thoughts, and formatted content)
                    contentNode = messageBubble.cloneNode(true) as HTMLElement;

                    // Clean UI elements that shouldn't be in the export
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
                    contentNode.querySelectorAll(selectorsToRemove.join(',')).forEach(el => el.remove());

                    // Embed images to ensure they render in the screenshot (handles CORS/Blob URLs)
                    await embedImagesInClone(contentNode);

                    // Expand any collapsed details (like thoughts) so they are visible in export.
                    contentNode.querySelectorAll('details').forEach(details => details.setAttribute('open', 'true'));
                    
                    // Reset animations and ensure full opacity
                    contentNode.style.animation = 'none';
                    contentNode.style.opacity = '1';
                    contentNode.style.transform = 'none';
                    contentNode.style.transition = 'none';
                    contentNode.style.margin = '0';
                    contentNode.style.width = '100%';
                    contentNode.querySelectorAll('*').forEach(el => {
                        (el as HTMLElement).style.animation = 'none';
                        (el as HTMLElement).style.transition = 'none';
                    });
                } else {
                    // Fallback to raw markdown parsing if DOM finding fails
                    const rawHtml = marked.parse(markdownContent);
                    const sanitizedHtml = DOMPurify.sanitize(rawHtml as string);
                    const wrapper = document.createElement('div');
                    wrapper.className = 'markdown-body';
                    wrapper.style.padding = '1rem';
                    wrapper.style.backgroundColor = 'transparent';
                    wrapper.innerHTML = sanitizedHtml;

                    wrapper.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightElement(block as HTMLElement);
                    });

                    contentNode = wrapper;
                }

                let cleanup = () => { };
                try {
                    const { container, innerContent, remove, rootBgColor } = await createSnapshotContainer(
                        themeId,
                        '800px'
                    );
                    cleanup = remove;

                    const headerHtml = `
                        <div style="padding: 2rem 2rem 1.5rem 2rem; border-bottom: 1px solid var(--theme-border-secondary); margin-bottom: 1.5rem;">
                            <h1 style="font-size: 1.5rem; font-weight: bold; color: var(--theme-text-primary); margin: 0 0 0.5rem 0;">Exported Message</h1>
                            <div style="font-size: 0.875rem; color: var(--theme-text-tertiary); display: flex; gap: 1rem;">
                                <span>${dateStr}</span>
                                <span>•</span>
                                <span>ID: ${shortId}</span>
                            </div>
                        </div>
                    `;

                    const exportWrapper = document.createElement('div');
                    exportWrapper.style.display = 'block';
                    exportWrapper.style.width = '100%';
                    exportWrapper.innerHTML = headerHtml;

                    const bodyDiv = document.createElement('div');
                    bodyDiv.style.padding = '0 2rem 2rem 2rem';
                    bodyDiv.style.display = 'block';
                    bodyDiv.appendChild(contentNode);
                    exportWrapper.appendChild(bodyDiv);
                    
                    innerContent.appendChild(exportWrapper);

                    // Wait for layout/images
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    await exportElementAsPng(container, `${filenameBase}.png`, { backgroundColor: rootBgColor, scale: 2.5 });
                } finally {
                    cleanup();
                }

            } else if (type === 'html') {
                const rawHtml = marked.parse(markdownContent);
                const sanitizedHtml = DOMPurify.sanitize(rawHtml as string);
                const styles = await gatherPageStyles();
                const bodyClasses = document.body.className;
                const rootBgColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-bg-primary');

                const fullHtml = generateExportHtmlTemplate({
                    title: `Message ${shortId}`,
                    date: dateStr,
                    model: `ID: ${shortId}`,
                    contentHtml: `<div class="markdown-body">${sanitizedHtml}</div>`,
                    styles,
                    themeId,
                    language: 'en',
                    rootBgColor,
                    bodyClasses
                });

                exportHtmlStringAsFile(fullHtml, `${filenameBase}.html`);

            } else if (type === 'txt') {
                const txtContent = generateExportTxtTemplate({
                    title: `Message Export ${shortId}`,
                    date: dateStr,
                    model: 'N/A',
                    messages: [{
                        role: message.role === 'user' ? 'USER' : 'ASSISTANT',
                        timestamp: new Date(message.timestamp),
                        content: markdownContent,
                        files: message.files?.map(f => ({ name: f.name }))
                    }]
                });
                exportTextStringAsFile(txtContent, `${filenameBase}.md`);
            } else if (type === 'json') {
                const blob = new Blob([JSON.stringify(message, null, 2)], { type: 'application/json' });
                triggerDownload(URL.createObjectURL(blob), `${filenameBase}.json`);
            }
            
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error(`Failed to export message as ${type.toUpperCase()}:`, err);
            alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setExportingType(null);
        }
    };

    return {
        exportingType,
        handleExport
    };
};
