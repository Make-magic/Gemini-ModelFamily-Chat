import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { FOCUS_VISIBLE_RING_CLASS } from '../../../constants/appConstants';

interface ScrollNavigationProps {
    showUp: boolean;
    showDown: boolean;
    onScrollToPrev: () => void;
    onScrollToNext: () => void;
    bottomOffset?: number;
}

export const ScrollNavigation: React.FC<ScrollNavigationProps> = ({ showUp, showDown, onScrollToPrev, onScrollToNext, bottomOffset = 16 }) => {
    if (!showUp && !showDown) return null;

    return (
        <div
            className="absolute z-20 right-2 flex flex-col items-end gap-3 pointer-events-none"
            style={{ bottom: `${bottomOffset}px`, animation: 'fadeIn 0.3s ease-out both' }}
        >
            {showUp && (
                <button
                    onClick={onScrollToPrev}
                    className={`
                        h-11 w-11 rounded-full flex items-center justify-center
                        bg-[var(--theme-bg-secondary)] 
                        border border-[var(--theme-border-secondary)] 
                        text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] 
                        hover:bg-[var(--theme-bg-primary)] hover:border-[var(--theme-border-focus)]
                        transition-colors duration-200
                        pointer-events-auto
                        ${FOCUS_VISIBLE_RING_CLASS}
                    `}
                    aria-label="Scroll to previous turn"
                    title="Scroll to previous turn"
                >
                    <ArrowUp size={18} strokeWidth={2.5} />
                </button>
            )}
            {showDown && (
                <button
                    onClick={onScrollToNext}
                    className={`
                        h-11 w-11 rounded-full flex items-center justify-center
                        bg-[var(--theme-bg-secondary)] 
                        border border-[var(--theme-border-secondary)] 
                        text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] 
                        hover:bg-[var(--theme-bg-primary)] hover:border-[var(--theme-border-focus)]
                        transition-colors duration-200
                        pointer-events-auto
                        ${FOCUS_VISIBLE_RING_CLASS}
                    `}
                    aria-label="Scroll to next turn or bottom"
                    title="Scroll to next turn or bottom"
                >
                    <ArrowDown size={18} strokeWidth={2.5} />
                </button>
            )}
        </div>
    );
};
