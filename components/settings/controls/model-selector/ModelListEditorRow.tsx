import React from 'react';
import { Trash2 } from 'lucide-react';
import { ModelOption } from '../../../../types';
import { getModelIcon } from '../../../shared/ModelPicker';

interface ModelListEditorRowProps {
    model: ModelOption;
    index: number;
    onUpdate: (index: number, field: keyof ModelOption, value: any) => void;
    onDelete: (index: number) => void;
    t: (key: string) => string;
}

export const ModelListEditorRow: React.FC<ModelListEditorRowProps> = ({ model, index, onUpdate, onDelete, t }) => (
    <div className="flex items-center gap-2 group">
        <div className="w-8 flex justify-center text-[var(--theme-text-tertiary)]">
            {getModelIcon(model)}
        </div>
        <input 
            id={`model-id-${index}`}
            type="text" 
            value={model.id} 
            onChange={(e) => onUpdate(index, 'id', e.target.value)}
            placeholder={t('settingsModelSelection_modelId')}
            aria-label={t('settingsModelSelection_modelId')}
            required
            className="flex-1 min-w-0 bg-[var(--theme-bg-primary)] border border-[var(--theme-border-secondary)] rounded px-2 py-1.5 text-xs text-[var(--theme-text-primary)] focus:border-[var(--theme-border-focus)] outline-none font-mono"
        />
        <input 
            id={`model-name-${index}`}
            type="text" 
            value={model.name} 
            onChange={(e) => onUpdate(index, 'name', e.target.value)}
            placeholder={t('settingsModelSelection_displayName')}
            aria-label={t('settingsModelSelection_displayName')}
            className="flex-1 min-w-0 bg-[var(--theme-bg-primary)] border border-[var(--theme-border-secondary)] rounded px-2 py-1.5 text-xs text-[var(--theme-text-primary)] focus:border-[var(--theme-border-focus)] outline-none"
        />
        <button 
            type="button"
            onClick={() => onDelete(index)}
            className="p-1.5 text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-danger)] hover:bg-[var(--theme-bg-danger)]/10 rounded transition-colors"
            title={t('settingsModelSelection_remove')}
            aria-label={t('settingsModelSelection_remove')}
        >
            <Trash2 size={14} />
        </button>
    </div>
);
