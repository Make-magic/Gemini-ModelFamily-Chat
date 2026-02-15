import html2pdf from 'html2pdf.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import { ChatMessage } from '../../types';
import { sanitizeFilename } from './core';
import { gatherPageStyles } from './dom';

/**
 * Converts chat records into a document-style PDF based on Markdown data.
 */
export const exportChatAsPdfDocument = async (
    title: string,
    messages: ChatMessage[],
    modelId: string
) => {
    // 1. Build document-style HTML content
    const contentHtmlPromises = messages.map(async (msg) => {
        if (!msg.content && !msg.files?.length) return '';

        const roleName = msg.role === 'user' ? 'User' : 'Assistant';
        const roleColor = msg.role === 'user' ? '#2563eb' : '#059669'; 
        const timeStr = new Date(msg.timestamp).toLocaleString();
        
        // Parse Markdown (Sync parse is standard for marked 13.x unless specified)
        const rawHtml = marked.parse(msg.content || '');
        const cleanHtml = DOMPurify.sanitize(rawHtml as string);

        let filesHtml = '';
        if (msg.files && msg.files.length > 0) {
            filesHtml = `
                <div style="margin-bottom: 8px; font-size: 0.85em; color: #666; border: 1px solid #eee; padding: 5px; border-radius: 4px; background: #f9f9f9;">
                    <strong>Attachments:</strong> ${msg.files.map(f => f.name).join(', ')}
                </div>
            `;
        }

        return `
            <div class="message-section" style="margin-bottom: 25px; page-break-inside: avoid; color: black !important; display: block !important;">
                <div style="border-bottom: 1px solid #eee; margin-bottom: 8px; padding-bottom: 4px; display: block !important;">
                    <span style="color: ${roleColor} !important; font-weight: bold; font-size: 1.1em;">${roleName}</span>
                    <span style="color: #666 !important; font-size: 0.8em; margin-left: 10px;">${timeStr}</span>
                </div>
                ${filesHtml}
                <div class="markdown-body" style="font-size: 14px; line-height: 1.6; color: black !important; background: white !important; display: block !important;">
                    ${cleanHtml}
                </div>
            </div>
        `;
    });

    const messagesHtml = (await Promise.all(contentHtmlPromises)).join('');

    // 2. Create temporary container and apply styles
    // Use absolute positioning and a far-left offset to avoid scroll interference
    const tempContainer = document.createElement('div');
    const containerId = `pdf-export-${Date.now()}`;
    tempContainer.id = containerId;
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = '800px';
    tempContainer.style.zIndex = '-1';
    tempContainer.style.background = 'white';
    
    // Fetch all current page styles to ensure markdown-body and other styles are available
    const allStyles = await gatherPageStyles();

    tempContainer.innerHTML = `
        ${allStyles}
        <style>
            .pdf-export-wrapper {
                padding: 40px;
                background: white !important;
                color: black !important;
                width: 800px;
                box-sizing: border-box;
                display: block !important;
            }
            /* Force white background and black text for the export container */
            .pdf-export-wrapper .markdown-body {
                background: white !important;
                color: black !important;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif !important;
            }
            .pdf-export-wrapper pre {
                background-color: #f6f8fa !important;
                border: 1px solid #dfe2e5 !important;
                border-radius: 6px !important;
                padding: 16px !important;
                overflow: auto !important;
                white-space: pre-wrap !important;
                word-wrap: break-word !important;
                color: #24292e !important;
            }
            .pdf-export-wrapper code {
                color: #24292e !important;
                background-color: rgba(27,31,35,0.05) !important;
            }
            .pdf-export-wrapper blockquote {
                border-left: 0.25em solid #dfe2e5 !important;
                color: #6a737d !important;
                padding: 0 1em !important;
                margin: 0 0 16px 0 !important;
            }
            .pdf-export-wrapper table {
                border-collapse: collapse !important;
                width: 100% !important;
                margin-bottom: 16px !important;
            }
            .pdf-export-wrapper table th, .pdf-export-wrapper table td {
                border: 1px solid #dfe2e5 !important;
                padding: 6px 13px !important;
                color: black !important;
            }
            .pdf-export-wrapper table tr {
                background-color: #fff !important;
                border-top: 1px solid #c6cbd1 !important;
            }
        </style>
        <div class="pdf-export-wrapper">
            <div style="margin-bottom: 40px; text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px;">
                <h1 style="margin: 0; font-size: 24px; color: black !important;">${title}</h1>
                <p style="margin: 5px 0 0; color: #666 !important; font-size: 12px;">Generated by All Model Chat • Model: ${modelId} • Date: ${new Date().toLocaleDateString()}</p>
            </div>
            <div class="pdf-content">
                ${messagesHtml}
            </div>
        </div>
    `;

    document.body.appendChild(tempContainer);

    // 3. Handle syntax highlighting
    tempContainer.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block as HTMLElement);
    });

    // 4. Wait for styles, layout, and any images to be fully ready
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 5. Configure html2pdf
    const opt = {
        margin:       [10, 10, 10, 10], 
        filename:     `${sanitizeFilename(title)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
            scale: 2, 
            useCORS: true, 
            logging: false,
            letterRendering: true,
            windowWidth: 800,
            scrollY: 0,
            scrollX: 0,
            backgroundColor: '#ffffff'
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] } 
    };

    try {
        const element = tempContainer.querySelector('.pdf-export-wrapper');
        if (!element) throw new Error("Export element not found");
        
        // Use the worker API for more reliable generation
        // sequence: from -> set -> save
        await html2pdf().from(element).set(opt).save();
    } catch (err) {
        console.error("PDF generation failed", err);
        throw err;
    } finally {
        // Cleanup with a small delay to ensure the browser has finished using the element
        setTimeout(() => {
            if (document.body.contains(tempContainer)) {
                document.body.removeChild(tempContainer);
            }
        }, 500);
    }
};
