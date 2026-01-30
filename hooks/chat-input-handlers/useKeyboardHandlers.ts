
import { useCallback } from 'react';
import { Command } from '../../components/chat/input/SlashCommandMenu';
import { AppSettings } from '../../types';
import { DEFAULT_SHORTCUTS } from '../../constants/appConstants';
import { isShortcutPressed } from '../../utils/shortcutUtils';

interface UseKeyboardHandlersProps {
    appSettings: AppSettings;
    isComposingRef: React.MutableRefObject<boolean>;
    slashCommandState: { isOpen: boolean; filteredCommands: Command[]; selectedIndex: number; };
    setSlashCommandState: React.Dispatch<React.SetStateAction<any>>;
    handleCommandSelect: (command: Command) => void;
    inputText: string;
    isMobile: boolean;
    isDesktop: boolean;
    handleSlashCommandExecution: (text: string) => void;
    canSend: boolean;
    handleSubmit: (e: React.FormEvent) => void;
    isFullscreen: boolean;
    handleToggleFullscreen: () => void;
    isLoading: boolean;
    onStopGenerating: () => void;
    isEditing: boolean;
    onCancelEdit: () => void;
    onEditLastUserMessage: () => void;
}

export const useKeyboardHandlers = ({
    appSettings,
    isComposingRef,
    slashCommandState,
    setSlashCommandState,
    handleCommandSelect,
    inputText,
    isMobile,
    isDesktop,
    handleSlashCommandExecution,
    canSend,
    handleSubmit,
    isFullscreen,
    handleToggleFullscreen,
    isLoading,
    onStopGenerating,
    isEditing,
    onCancelEdit,
    onEditLastUserMessage,
}: UseKeyboardHandlersProps) => {

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // 1. Slash Menu Navigation (Highest Priority for Arrows/Enter when Open)
        // We handle this BEFORE composition check to ensure the menu is navigable even if
        // the browser thinks a composition is briefly active (common with some IMEs or fast typing).
        if (slashCommandState.isOpen) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSlashCommandState((prev: any) => {
                    const len = prev.filteredCommands?.length || 0;
                    if (len === 0) return prev;
                    return {
                        ...prev,
                        selectedIndex: (prev.selectedIndex + 1) % len,
                    };
                });
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSlashCommandState((prev: any) => {
                    const len = prev.filteredCommands?.length || 0;
                    if (len === 0) return prev;
                    return {
                        ...prev,
                        selectedIndex: (prev.selectedIndex - 1 + len) % len,
                    };
                });
                return;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                const command = slashCommandState.filteredCommands[slashCommandState.selectedIndex];
                if (command) {
                    handleCommandSelect(command);
                }
                return;
            }
            // If other keys are pressed while menu is open, we let them fall through
            // (e.g. typing more letters to filter), unless it's Escape.
        }

        // 2. Composition Guard
        // If we are composing text (IME), ignore other shortcuts to avoid interrupting input.
        if (isComposingRef.current) return;

        const shortcuts = appSettings.shortcuts || DEFAULT_SHORTCUTS;

        // 3. Esc Hierarchical Logic (Stop / Cancel)
        if (e.key === 'Escape') {
            // Stop Generation
            if (isLoading) {
                e.preventDefault();
                onStopGenerating();
                return;
            }
            // Cancel Edit
            if (isEditing) {
                e.preventDefault();
                onCancelEdit();
                return;
            }
            // Close Slash Menu
            if (slashCommandState.isOpen) {
                e.preventDefault();
                setSlashCommandState((prev: any) => ({ ...prev, isOpen: false }));
                return;
            }
            // Exit Fullscreen
            if (isFullscreen) {
                e.preventDefault();
                handleToggleFullscreen();
                return;
            }
            // If it was just Escape, we generally consume it or let it bubble?
            // Existing logic consumed it.
            return;
        }

        // 4. Edit Last User Message (ArrowUp when empty)
        if (isShortcutPressed(e, shortcuts.editLastMessage) && !isLoading && inputText.length === 0) {
            e.preventDefault();
            onEditLastUserMessage();
            return;
        }

        // 5. Standard Message Submission
        // We need to differentiate "Send Message" (Enter) vs "New Line" (Shift+Enter).
        // If user binds Send to Shift+Enter, checking order matters?
        // Usually checks are specific.
        // Existing logic: Enter && !Shift -> Send.
        // New logic: Check isShortcutPressed(sendMessage).
        // But if sendMessage is same as newLine? (Conflict).
        // "New Line" is usually handled natively by textarea unless prevented.
        // If we configure "New Line" to something else, we might need to manually insert newline?
        // ShortcutsSection has "New Line", but implementing custom Insert Newline logic is complex (cursor position etc).
        // For now, let's assume "New Line" is informative or allows preventing default send.

        // Check for Slash Command Trigger first
        // If Input starts with / and user hits Enter?
        // Actually, if they type '/' it triggers menu.
        // 'slashCommands' shortcut is likely just to Type '/'? Or focus input and type '/'?
        // ShortcutsSection just says "/" for slash commands.
        // If I press '/', it types /.

        // Handling Send Message
        if (isShortcutPressed(e, shortcuts.sendMessage) && (!isMobile || isDesktop)) {
            const trimmedInput = inputText.trim();
            // Double check: If it looks like a command but menu wasn't open (edge case), try executing
            if (trimmedInput.startsWith('/')) {
                e.preventDefault();
                handleSlashCommandExecution(trimmedInput);
                return;
            }

            if (canSend) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
            }
        }
    }, [isComposingRef, slashCommandState, setSlashCommandState, handleCommandSelect, isMobile, isDesktop, inputText, handleSlashCommandExecution, canSend, handleSubmit, isFullscreen, handleToggleFullscreen, isLoading, onStopGenerating, isEditing, onCancelEdit, onEditLastUserMessage]);

    return { handleKeyDown };
};
