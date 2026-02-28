
import { Gauge, Feather, Zap, Sparkles, Cpu } from 'lucide-react';
import { LevelButton } from './LevelButton';

interface ThinkingLevelSelectorProps {
    thinkingLevel: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | undefined;
    setThinkingLevel: (level: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH') => void;
    isFlash3: boolean;
    t: (key: string) => string;
}

export const ThinkingLevelSelector: React.FC<ThinkingLevelSelectorProps> = ({
    thinkingLevel,
    setThinkingLevel,
    isFlash3,
    t
}) => {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)] flex items-center gap-1.5">
                    <Gauge size={12} /> {t('settingsThinkingIntensityLevel')}
                </span>
            </div>
            <div className={`grid ${isFlash3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-2`}>
                {isFlash3 && (
                    <LevelButton 
                        active={thinkingLevel === 'MINIMAL'} 
                        onClick={() => setThinkingLevel('MINIMAL')} 
                        label={t('thinking_level_minimal') || 'Minimal'} 
                        icon={<Feather size={14} />}
                    />
                )}
                <LevelButton 
                    active={thinkingLevel === 'LOW'} 
                    onClick={() => setThinkingLevel('LOW')} 
                    label={t('thinking_level_low') || 'Low'} 
                    icon={<Zap size={14} />}
                />
                <LevelButton 
                    active={thinkingLevel === 'MEDIUM'} 
                    onClick={() => setThinkingLevel('MEDIUM')} 
                    label={t('thinking_level_medium') || 'Medium'} 
                    icon={<Sparkles size={14} />}
                />
                <LevelButton 
                    active={thinkingLevel === 'HIGH'} 
                    onClick={() => setThinkingLevel('HIGH')} 
                    label={t('thinking_level_high') || 'High'} 
                    icon={<Cpu size={14} />}
                />
            </div>
        </div>
    );
};
