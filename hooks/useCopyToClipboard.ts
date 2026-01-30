
import { useState, useCallback, useEffect, useRef } from 'react';

export const useCopyToClipboard = (resetDuration = 2000) => {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const copyToClipboard = useCallback(async (text: string) => {
    if (!text) return;

    const handleSuccess = () => {
      setIsCopied(true);

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setIsCopied(false);
        timeoutRef.current = null;
      }, resetDuration);
    };

    const fallbackCopy = (textToCopy: string) => {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;

        // Ensure textarea is not visible but functional
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        textArea.setAttribute('readonly', ''); // Prevent keyboard popup on mobile

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
          handleSuccess();
        } else {
          console.error('Fallback: Copy command failed');
          setIsCopied(false);
        }
      } catch (err) {
        console.error('Fallback: Unable to copy', err);
        setIsCopied(false);
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        handleSuccess();
      } catch (err) {
        // If Clipboard API fails (e.g., permission denied), try fallback
        console.warn('Clipboard API failed, attempting fallback...', err);
        fallbackCopy(text);
      }
    } else {
      // Clipboard API unavailable (e.g., non-secure context), use fallback
      fallbackCopy(text);
    }
  }, [resetDuration]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { isCopied, copyToClipboard };
};
