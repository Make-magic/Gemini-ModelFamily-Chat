import React from 'react';
import { Coins } from 'lucide-react';
import { TokenUsageStats } from '../../services/logService';
import { translations } from '../../utils/appUtils';

interface TokenUsageTabProps {
    tokenUsage: Map<string, TokenUsageStats>;
    t: (key: keyof typeof translations) => string;
}

export const TokenUsageTab: React.FC<TokenUsageTabProps> = ({ tokenUsage, t }) => {
    const tokenUsageArray = Array.from(tokenUsage.entries()).map(([modelId, stats]) => ({
        modelId,
        prompt: stats.prompt,
        completion: stats.completion,
        total: stats.prompt + stats.completion
    })).sort((a, b) => b.total - a.total);

    return (
        <div className="p-4 overflow-y-auto custom-scrollbar h-full">
            <h4 className="font-semibold text-lg text-[var(--theme-text-primary)] mb-4 flex items-center gap-2">
                <Coins size={20} /> {t('logs_token_statistics')}
            </h4>
            
            {tokenUsageArray.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-[var(--theme-text-tertiary)] border-2 border-dashed border-[var(--theme-border-secondary)] rounded-xl bg-[var(--theme-bg-primary)]/50">
                    <Coins size={48} className="mb-4 opacity-20" />
                    <p className="text-sm">{t('logs_no_token_usage')}</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-[var(--theme-border-secondary)] shadow-sm">
                    <table className="min-w-full divide-y divide-[var(--theme-border-secondary)] bg-[var(--theme-bg-primary)]">
                        <thead className="bg-[var(--theme-bg-tertiary)]">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--theme-text-tertiary)] uppercase tracking-wider">{t('logs_model')}</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-[var(--theme-text-tertiary)] uppercase tracking-wider">{t('logs_input_tokens')}</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-[var(--theme-text-tertiary)] uppercase tracking-wider">{t('logs_output_tokens')}</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-[var(--theme-text-primary)] uppercase tracking-wider">{t('logs_total_tokens')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--theme-border-secondary)]">
                            {tokenUsageArray.map((item) => (
                                <tr key={item.modelId} className="hover:bg-[var(--theme-bg-input)] transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--theme-text-primary)]">
                                        {item.modelId}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[var(--theme-text-secondary)] font-mono">
                                        {item.prompt.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[var(--theme-text-secondary)] font-mono">
                                        {item.completion.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[var(--theme-text-link)] font-mono font-bold">
                                        {item.total.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-[var(--theme-bg-tertiary)]/20 font-semibold">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--theme-text-primary)]">{t('logs_total')}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[var(--theme-text-primary)] font-mono">
                                    {tokenUsageArray.reduce((sum, item) => sum + item.prompt, 0).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[var(--theme-text-primary)] font-mono">
                                    {tokenUsageArray.reduce((sum, item) => sum + item.completion, 0).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[var(--theme-text-primary)] font-mono">
                                    {tokenUsageArray.reduce((sum, item) => sum + item.total, 0).toLocaleString()}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
