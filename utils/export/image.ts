import { triggerDownload } from './core';

/**
 * Exports a given HTML element as a PNG image.
 * @param element The HTML element to capture.
 * @param filename The desired filename for the downloaded PNG.
 * @param options Configuration options for html2canvas.
 */
import { triggerDownload } from './core';

/**
 * Exports a given HTML element as a PNG image.
 * @param element The HTML element to capture.
 * @param filename The desired filename for the downloaded PNG.
 * @param options Configuration options for html2canvas.
 */
export const exportElementAsPng = async (
    element: HTMLElement,
    filename: string,
    options?: { backgroundColor?: string | null, scale?: number }
) => {
    const html2canvas = (await import('html2canvas')).default;

    // Pre-load images to ensure they render
    const images = Array.from(element.querySelectorAll('img'));
    await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve; // Don't block export on broken image
        });
    }));

    // Force a layout recalc/paint wait to ensure styles are applied in the detached container
    await new Promise(resolve => setTimeout(resolve, 800));

    // Calculate dimensions with multiple fallbacks
    let width = Math.ceil(element.scrollWidth);
    let height = Math.ceil(element.scrollHeight);

    // If scrollWidth/Height are zero, try BoundingClientRect
    if (width === 0 || height === 0) {
        const rect = element.getBoundingClientRect();
        width = Math.ceil(rect.width);
        height = Math.ceil(rect.height);
    }

    // If still zero, check children
    if (height === 0 && element.firstElementChild) {
        height = Math.ceil((element.firstElementChild as HTMLElement).scrollHeight || 0);
    }

    console.log(`[Export] Dimension check: scroll=${element.scrollWidth}x${element.scrollHeight}, offset=${element.offsetWidth}x${element.offsetHeight}, rect=${width}x${height}`);

    if (width === 0 || height === 0) {
        // Last ditch effort: if it's the container we created, it might just need a fixed width
        if (width === 0) width = 800;
        if (height === 0) {
            console.error("[Export] Element has zero height, cannot proceed.", element);
            throw new Error(`Export target has no height (${height}px). Content might be empty or hidden.`);
        }
    }

    // Browser limits (Chrome/Firefox/Safari typically around 65535 or 16384 depending on area)
    const MAX_DIMENSION = 32767;
    const MAX_AREA = 256 * 1024 * 1024; // 256M pixels

    let scale = options?.scale ?? 2;
    
    // Adjust scale if it would exceed limits
    if (width * scale > MAX_DIMENSION) scale = MAX_DIMENSION / width;
    if (height * scale > MAX_DIMENSION) scale = MAX_DIMENSION / height;
    if (width * height * scale * scale > MAX_AREA) {
        scale = Math.sqrt(MAX_AREA / (width * height));
    }

    // Final safety check: ensure scale is reasonable
    scale = Math.max(0.5, Math.min(scale, options?.scale ?? 2));

    console.log(`[Export] Capturing: ${width}x${height} at scale ${scale.toFixed(2)}`);

    try {
        const canvas = await html2canvas(element, {
            height: height,
            width: width,
            useCORS: true,
            allowTaint: false,
            logging: false,
            backgroundColor: options?.backgroundColor ?? null,
            scale: scale,
            ignoreElements: (el) => {
                if (el.classList.contains('no-export')) return true;
                if (el.tagName === 'IMG') {
                    const src = (el as HTMLImageElement).src;
                    if (src && !src.startsWith('data:') && (src.startsWith('http') || src.startsWith('blob:'))) {
                        return true;
                    }
                }
                return false;
            },
            onclone: (_doc, clonedElement) => {
                clonedElement.querySelectorAll('img').forEach(img => {
                    if (img.src && !img.src.startsWith('data:')) {
                        img.remove();
                    }
                });
            }
        });

        // Convert to Blob or DataURL with fallback
        try {
            const blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((b) => resolve(b), 'image/png');
            });

            if (blob) {
                const url = URL.createObjectURL(blob);
                triggerDownload(url, filename);
                // URL.revokeObjectURL(url); // Should be revoked after download started, but core.ts handles it or it's fine for simple apps
                return;
            }
        } catch (blobError) {
            console.warn("[Export] toBlob failed, falling back to toDataURL", blobError);
        }

        // Fallback to DataURL
        const dataUrl = canvas.toDataURL('image/png');
        if (dataUrl && dataUrl !== 'data:,') {
            triggerDownload(dataUrl, filename);
        } else {
            throw new Error("Canvas to Image conversion failed (both Blob and DataURL).");
        }

    } catch (error) {
        console.error("[Export] PNG export error:", error);
        throw error;
    }
};

/**
 * Converts an SVG string to a PNG data URL and triggers a download.
 * @param svgString The string content of the SVG.
 * @param filename The desired filename for the downloaded PNG.
 * @param scale The resolution scale factor for the output PNG.
 */
export const exportSvgAsPng = async (svgString: string, filename: string, scale: number = 3): Promise<void> => {
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
    const img = new Image();

    return new Promise((resolve, reject) => {
        img.onload = () => {
            const imgWidth = img.width;
            const imgHeight = img.height;

            if (imgWidth === 0 || imgHeight === 0) {
                return reject(new Error("Diagram has zero dimensions, cannot export."));
            }
            const canvas = document.createElement('canvas');
            canvas.width = imgWidth * scale;
            canvas.height = imgHeight * scale;
            const ctx = canvas.getContext('2d');

            if (ctx) {
                ctx.drawImage(img, 0, 0, imgWidth * scale, imgHeight * scale);
                const pngUrl = canvas.toDataURL('image/png');
                triggerDownload(pngUrl, filename);
                resolve();
            } else {
                reject(new Error("Could not get canvas context."));
            }
        };

        img.onerror = () => {
            reject(new Error("Failed to load SVG into an image element for conversion."));
        };

        img.src = svgDataUrl;
    });
};