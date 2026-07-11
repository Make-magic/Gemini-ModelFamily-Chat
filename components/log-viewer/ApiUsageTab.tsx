
import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, CheckCircle } from 'lucide-react';
import { AppSettings, ChatSettings } from '../../types';
import { ObfuscatedApiKey } from './ObfuscatedApiKey';
import { parseApiKeys } from '../../utils/apiUtils';
import { createApiKeyFingerprint } from '../../utils/security';
import { translations } from '../../utils/appUtils';

interface ApiUsageTabProps {
    apiKeyUsage: Map<string, number>;
    appSettings: AppSettings;
    currentChatSettings: ChatSettings;
    t: (key: keyof typeof translations) => string;
}

export const ApiUsageTab: React.FC<ApiUsageTabProps> = ({ apiKeyUsage, appSettings, currentChatSettings, t }) => {
    const [configuredFingerprints, setConfiguredFingerprints] = useState<string[]>([]);
    const [activeFingerprint, setActiveFingerprint] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        Promise.all(parseApiKeys(appSettings.apiKey).map(createApiKeyFingerprint)).then(values => {
            if (!cancelled) setConfiguredFingerprints(values);
        });
        if (currentChatSettings.lockedApiKey) {
            createApiKeyFingerprint(currentChatSettings.lockedApiKey).then(value => {
                if (!cancelled) setActiveFingerprint(value);
            });
        } else {
            setActiveFingerprint(null);
        }
        return () => { cancelled = true; };
    }, [appSettings.apiKey, currentChatSettings.lockedApiKey]);

    const displayApiKeyUsage = useMemo(() => {
        const display = new Map<string, number>();
        configuredFingerprints.forEach(key => display.set(key, apiKeyUsage.get(key) || 0));
        apiKeyUsage.forEach((count, key) => display.set(key, count));
        return display;
    }, [configuredFingerprints, apiKeyUsage]);

    const totalApiUsage = Array.from(displayApiKeyUsage.values()).reduce((sum, count) => sum + count, 0);

    return (
        <div className="p-4 overflow-y-auto custom-scrollbar h-full">
            <h4 className="font-semibold text-lg text-[var(--theme-text-primary)] mb-4 flex items-center gap-2"><KeyRound size={20} /> {t('logs_api_statistics')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from(displayApiKeyUsage.entries())
                .sort(([, a], [, b]) => b - a)
                .map(([key, count], index) => {
                const percentage = totalApiUsage > 0 ? (count / totalApiUsage) * 100 : 0;
                const isActive = activeFingerprint === key;
                return (
                    <div key={key} className={`p-4 rounded-xl border transition-all relative overflow-hidden ${isActive ? 'bg-[var(--theme-bg-accent)]/10 border-[var(--theme-border-focus)]' : 'bg-[var(--theme-bg-input)] border-[var(--theme-border-secondary)]'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <span className="font-mono text-xs text-[var(--theme-text-tertiary)]">#{index + 1}</span>
                        {isActive && <span className="text-[10px] font-bold uppercase bg-green-900 text-green-300 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle size={10} /> {t('logs_active')}</span>}
                    </div>
                    <div className="mb-4">
                        <ObfuscatedApiKey apiKey={key} />
                    </div>
                    <div className="flex items-end justify-between">
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold text-[var(--theme-text-primary)]">{count}</span>
                            <span className="text-xs text-[var(--theme-text-tertiary)]">{t('logs_requests')}</span>
                        </div>
                        <div className="text-xl font-bold text-[var(--theme-text-tertiary)] opacity-30">
                            {percentage.toFixed(0)}%
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 h-1 bg-[var(--theme-bg-accent)] transition-all duration-500" style={{ width: `${percentage}%` }} />
                    </div>
                );
                })}
            </div>
        </div>
    );
};
