# PNG Export Fix Documentation

This document outlines the systematic fixes implemented to resolve PNG export failures in the Gemini CLI (AMC Project).

## Issues Addressed
1. **Canvas to Blob conversion failed**: Occurred when chat history was too long, exceeding browser Canvas dimension limits (usually 65,535px or 16,384px depending on hardware/browser).
2. **Element has zero dimensions**: Occurred because the detached off-screen container used for rendering the snapshot collapsed due to flexbox layout or viewport-relative units (`vh`) not resolving correctly in a detached state.
3. **Download Interruption**: Object URLs were being revoked too quickly, causing "File not found" errors in some browsers.

## Implementation Details

### 1. Intelligent Canvas Management (`utils/export/image.ts`)
- **Smart Scaling**: Implemented logic to calculate the total area and dimensions. If they exceed safe limits (e.g., 256M pixels or 32,767px dimension), the `scale` is automatically reduced to fit within browser capabilities.
- **Multi-layer Fallback**: Added a fallback mechanism that attempts `toBlob` first (better for memory), and if it returns null or fails, falls back to `toDataURL`.
- **Robust Dimension Measurement**: Updated to measure dimensions using multiple methods:
    - `scrollWidth` / `scrollHeight`
    - `getBoundingClientRect()`
    - First child's scroll dimensions
    - Final fallback to safe defaults (800px width).

### 2. Layout Normalization (`utils/export/dom.ts`)
- **Structural Integrity**: Changed the root export container from `flex` to `display: block !important`.
- **Dimension Locking**: Forced a minimum height and a fixed width (1200px for previews, 800px for messages) to prevent layout collapse in the detached DOM.
- **CSS Variable Support**: Ensured background colors are explicitly computed and applied to the root, preventing transparent backgrounds in dark mode exports.

### 3. Rendering Synchronization (`hooks/`)
- **Rendering Delay**: Increased the post-injection delay to **1000ms**. This ensures that complex components like Mermaid diagrams, KaTeX formulas, and syntax-highlighted code blocks have finished their internal lifecycle before the screenshot is taken.
- **DOM Cleaning**: Synchronized the cleaning logic between single message exports (`useMessageExport.ts`) and full session exports (`useChatSessionExport.ts`). This removes interactive elements (buttons, inputs, sticky headers) and resets animations/transitions to ensure a static, clean image.

### 4. Lifecycle Management (`utils/export/core.ts`)
- **Delayed Revocation**: Modified `triggerDownload` to use a `setTimeout` of 1000ms before calling `URL.revokeObjectURL(href)`. This provides a safety margin for the browser's download manager to successfully hand off the data.

## Verification Checklist
- [x] Long chat sessions (50+ messages) scale correctly and don't crash.
- [x] Single message exports preserve formatting and handle "thoughts" (details) correctly.
- [x] Dark mode themes (Onyx) export with correct background colors.
- [x] Interactive UI elements are hidden in the final PNG.
- [x] Download triggers reliably across different browsers.
