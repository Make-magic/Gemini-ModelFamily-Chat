import React, { useState, useEffect, useRef } from 'react';
import { X, RotateCcw } from 'lucide-react';

interface ShortcutRecorderProps {
    value: string[];
    onChange: (keys: string[]) => void;
    onReset?: () => void;
    placeholder?: string;
}

export const ShortcutRecorder: React.FC<ShortcutRecorderProps> = ({
    value,
    onChange,
    onReset,
    placeholder = 'Click to record...'
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [currentKeys, setCurrentKeys] = useState<string[]>(value);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        setCurrentKeys(value);
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isRecording) return;
        e.preventDefault();
        e.stopPropagation();

        const key = e.key;

        const keys = new Set<string>();
        if (e.ctrlKey) keys.add('Ctrl');
        if (e.metaKey) keys.add('Meta');
        if (e.altKey) keys.add('Alt');
        if (e.shiftKey) keys.add('Shift');

        // If it's a non-modifier key, add it and finish
        if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
            let finalKey = key;
            if (key === ' ') finalKey = 'Space';
            keys.add(finalKey);

            const sortedKeys = Array.from(keys);
            onChange(sortedKeys);
            setIsRecording(false);
            buttonRef.current?.blur();
        } else {
            // It IS a modifier. currently held.
            // visual update only? We rely on state or just wait for keyup/other key
        }
    };

    const handleKeyUp = (e: React.KeyboardEvent) => {
        if (!isRecording) return;
        e.preventDefault();
        e.stopPropagation();

        const key = e.key;
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
            // Modifier released. If it was the only thing pressed/held, assume user wants that modifier as shortcut.
            // We can check if any other keys are currently "held" but React event doesn't give us full keyboard state easily.
            // But valid assumption: if you press Ctrl, then release Ctrl, and haven't pressed another key, you mean "Ctrl".

            let finalKey = key;
            if (key === 'Control') finalKey = 'Ctrl';
            // Meta/Shift/Alt are standard names or we map them?
            // Our set uses 'Ctrl', 'Meta', 'Alt', 'Shift'.

            // Map event.key to our standard
            if (key === 'Control') finalKey = 'Ctrl';

            // If we just release a modifier, we commit it as the shortcut.
            onChange([finalKey]);
            setIsRecording(false);
            buttonRef.current?.blur();
        }
    };

    const handleClick = () => {
        setIsRecording(true);
        setCurrentKeys([]);
    };

    const handleBlur = () => {
        // If we blur while recording, cancel? or commit?
        // Usually cancel.
        setIsRecording(false);
        setCurrentKeys(value); // Revert if cancelled
    };

    // Helper to render keys
    const renderKey = (k: string) => {
        let display = k;
        if (k === 'Meta') display = 'Cmd/Ctrl';
        if (k === 'Control') display = 'Ctrl';

        return (
            <kbd key={k} className="px-1.5 py-0.5 text-xs font-semibold text-[var(--theme-text-primary)] bg-[var(--theme-bg-tertiary)] border border-[var(--theme-border-secondary)] rounded shadow-sm min-w-[20px] inline-flex justify-center items-center">
                {display}
            </kbd>
        );
    };

    return (
        <div className="flex items-center gap-2">
            <button
                ref={buttonRef}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                onBlur={handleBlur}
                className={`
                    relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-all duration-200
                    border ${isRecording
                        ? 'border-[var(--theme-border-focus)] ring-2 ring-[var(--theme-border-focus)]/20 bg-[var(--theme-bg-input)]'
                        : 'border-[var(--theme-border-secondary)] bg-[var(--theme-bg-secondary)] hover:border-[var(--theme-text-tertiary)]'}
                    min-w-[120px] justify-center
                `}
            >
                {isRecording ? (
                    <span className="text-[var(--theme-text-secondary)] animate-pulse">Recording...</span>
                ) : currentKeys.length > 0 ? (
                    currentKeys.map((k, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && <span className="text-[var(--theme-text-tertiary)] text-xs">+</span>}
                            {renderKey(k)}
                        </React.Fragment>
                    ))
                ) : (
                    <span className="text-[var(--theme-text-tertiary)] italic">{placeholder}</span>
                )}
            </button>

            {onReset && (
                <button
                    onClick={onReset}
                    className="p-1.5 text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] rounded-md hover:bg-[var(--theme-bg-tertiary)] transition-colors"
                    title="Reset to default"
                >
                    <RotateCcw size={14} />
                </button>
            )}
        </div>
    );
};
