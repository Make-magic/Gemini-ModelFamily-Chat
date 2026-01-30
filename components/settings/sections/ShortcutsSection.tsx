import React, { useMemo } from 'react';
import { ShortcutRecorder } from '../ShortcutRecorder';
import { useAppSettings } from '../../../hooks/core/useAppSettings';
import { DEFAULT_SHORTCUTS } from '../../../constants/appConstants';
import { ShortcutsConfig } from '../../../types/settings';

interface ShortcutsSectionProps {
    t: (key: string) => string;
}

export const ShortcutsSection: React.FC<ShortcutsSectionProps> = ({ t }) => {
    const { appSettings, setAppSettings } = useAppSettings();

    // Ensure we have a shortcuts object (fallback to default if undefined in types/settings load)
    const currentShortcuts: ShortcutsConfig = appSettings.shortcuts || DEFAULT_SHORTCUTS;

    const handleShortcutChange = (actionId: string, keys: string[]) => {
        setAppSettings(prev => ({
            ...prev,
            shortcuts: {
                ...(prev.shortcuts || DEFAULT_SHORTCUTS),
                [actionId]: keys
            }
        }));
    };

    const handleReset = (actionId: string) => {
        setAppSettings(prev => ({
            ...prev,
            shortcuts: {
                ...(prev.shortcuts || DEFAULT_SHORTCUTS),
                [actionId]: DEFAULT_SHORTCUTS[actionId]
            }
        }));
    };

    const ShortcutRow = ({ label, actionId }: { label: string, actionId: string }) => {
        const keys = currentShortcuts[actionId] || DEFAULT_SHORTCUTS[actionId] || [];
        return (
            <div className="flex items-center justify-between py-3 border-b border-[var(--theme-border-secondary)]/50 last:border-0">
                <span className="text-sm text-[var(--theme-text-secondary)] font-medium">{label}</span>
                <ShortcutRecorder
                    value={keys}
                    onChange={(newKeys) => handleShortcutChange(actionId, newKeys)}
                    onReset={() => handleReset(actionId)}
                />
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)] mb-3">
                    {t('shortcuts_general_title')}
                </h4>
                <ShortcutRow label={t('shortcuts_open_logs')} actionId="openLogs" />
                <ShortcutRow label={t('shortcuts_toggle_pip')} actionId="togglePip" />
            </div>

            <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)] mb-3">
                    {t('shortcuts_chat_input_title')}
                </h4>
                <ShortcutRow label={t('shortcuts_send_message')} actionId="sendMessage" />
                <ShortcutRow label={t('shortcuts_new_line')} actionId="newLine" />
                <ShortcutRow label={t('shortcuts_edit_last')} actionId="editLastMessage" />
                <ShortcutRow label={t('shortcuts_cycle_models')} actionId="cycleModels" />
                <ShortcutRow label={t('shortcuts_slash_commands')} actionId="slashCommands" />
                <div className="flex items-center justify-between py-3 border-b border-[var(--theme-border-secondary)]/50 last:border-0">
                    <span className="text-sm text-[var(--theme-text-secondary)] font-medium">{t('shortcuts_focus_input')}</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-[var(--theme-text-tertiary)] bg-[var(--theme-bg-tertiary)]/50 px-2 py-1 rounded">{t('shortcuts_any_key')}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};