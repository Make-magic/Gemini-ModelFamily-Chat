/**
 * Gathers all style and link tags from the current document's head to be inlined.
 * @returns A promise that resolves to a string of HTML style and link tags.
 */
export const gatherPageStyles = async (): Promise<string> => {
    const stylePromises = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(el => {
            if (el.tagName === 'STYLE') {
                return Promise.resolve(`<style>${el.innerHTML}</style>`);
            }
            if (el.tagName === 'LINK' && (el as HTMLLinkElement).rel === 'stylesheet') {
                // Fetch external stylesheets to inline them
                return fetch((el as HTMLLinkElement).href)
                    .then(res => {
                        if (!res.ok) throw new Error(`Failed to fetch stylesheet: ${res.statusText}`);
                        return res.text();
                    })
                    .then(css => `<style>${css}</style>`)
                    .catch(err => {
                        console.warn('Could not fetch stylesheet for export:', (el as HTMLLinkElement).href, err);
                        return el.outerHTML; // Fallback to linking the stylesheet
                    });
            }
            return Promise.resolve('');
        });

    return (await Promise.all(stylePromises)).join('\n');
};

/**
 * Embeds images in a cloned DOM element by converting their sources to Base64 data URIs.
 * This allows the HTML to be self-contained (offline-capable).
 * Images that fail to embed are removed to prevent canvas tainting during export.
 * @param clone The cloned HTMLElement to process.
 */
export const embedImagesInClone = async (clone: HTMLElement): Promise<void> => {
    const images = Array.from(clone.querySelectorAll('img'));
    await Promise.all(images.map(async (img) => {
        try {
            const src = img.getAttribute('src');
            // Skip if no src or already a data URI
            if (!src || src.startsWith('data:')) return;

            // Fetch the image content
            const response = await fetch(img.src);
            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.status}`);
            }
            const blob = await response.blob();
            const reader = new FileReader();
            await new Promise<void>((resolve, reject) => {
                reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                        img.src = reader.result;
                        // Remove attributes that might interfere with the data URI source
                        img.removeAttribute('srcset');
                        img.removeAttribute('loading');
                        img.removeAttribute('crossorigin');
                        resolve();
                    } else {
                        reject(new Error('FileReader result is not a string'));
                    }
                };
                reader.onerror = () => reject(new Error('FileReader error'));
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.warn('Failed to embed image for export, removing to prevent canvas taint:', img.src, e);
            // Remove images that can't be embedded to prevent canvas tainting
            img.remove();
        }
    }));
};

/**
 * Creates an isolated DOM container for exporting, injecting current styles and theme.
 */
export const createSnapshotContainer = async (
    themeId: string,
    width: string = '800px'
): Promise<{ container: HTMLElement, innerContent: HTMLElement, remove: () => void, rootBgColor: string }> => {
    const tempContainer = document.createElement('div');
    tempContainer.id = `export-container-${Date.now()}`;
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0px';
    tempContainer.style.width = width.includes('%') ? '1200px' : width; // Avoid 100% in detached container
    tempContainer.style.height = 'auto';
    tempContainer.style.padding = '0';
    tempContainer.style.margin = '0';
    tempContainer.style.zIndex = '-1';
    tempContainer.style.boxSizing = 'border-box';
    tempContainer.style.overflow = 'visible';

    const allStyles = await gatherPageStyles();
    const bodyClasses = document.body.className;

    let rootBgColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-bg-primary').trim();
    if (!rootBgColor || rootBgColor === 'transparent' || rootBgColor === 'rgba(0, 0, 0, 0)') {
        rootBgColor = themeId === 'onyx' ? '#09090b' : '#FFFFFF';
    }

    tempContainer.innerHTML = `
        ${allStyles}
        <div class="export-root theme-${themeId} ${bodyClasses} is-exporting-png" 
             style="background-color: ${rootBgColor}; color: var(--theme-text-primary); min-height: 500px; width: 100%; display: block !important;">
            <div class="export-inner" style="background-color: ${rootBgColor}; padding: 0; display: block !important;">
                <div class="exported-chat-container" style="width: 100%; max-width: 100%; margin: 0 auto; display: block !important;">
                    <!-- Content will be injected here -->
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(tempContainer);

    const innerContent = tempContainer.querySelector('.exported-chat-container') as HTMLElement;
    const captureTarget = tempContainer.querySelector('.export-root') as HTMLElement;

    if (!innerContent || !captureTarget) {
        document.body.removeChild(tempContainer);
        throw new Error("Failed to create snapshot container structure");
    }

    return {
        container: captureTarget,
        innerContent,
        remove: () => {
            if (document.body.contains(tempContainer)) {
                document.body.removeChild(tempContainer);
            }
        },
        rootBgColor
    };
};