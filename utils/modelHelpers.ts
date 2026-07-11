
import { ModelOption } from '../types';
import { STATIC_TTS_MODELS, STATIC_IMAGEN_MODELS, TAB_CYCLE_MODELS, INITIAL_PINNED_MODELS } from '../constants/appConstants';
import { MediaResolution, ThinkingLevel } from '../types/settings';
import { getModelCapabilities } from '../constants/modelRegistry';

// --- Model Sorting & Defaults ---

export const sortModels = (models: ModelOption[]): ModelOption[] => {
    const getCategoryWeight = (model: ModelOption) => {
        const capabilities = getModelCapabilities(model.id, model.capabilities);
        if (capabilities.tts) return 5;
        if (capabilities.imageModelKind === 'imagen') return 4;
        if (capabilities.imageGeneration) return 3;
        if (capabilities.live) return 2;
        return 1;
    };

    return [...models].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        
        if (a.isPinned && b.isPinned) {
            const capabilitiesA = getModelCapabilities(a.id, a.capabilities);
            const capabilitiesB = getModelCapabilities(b.id, b.capabilities);
            const weightA = getCategoryWeight(a);
            const weightB = getCategoryWeight(b);
            if (weightA !== weightB) return weightA - weightB;
            if (capabilitiesA.catalogPriority !== capabilitiesB.catalogPriority) {
                return capabilitiesB.catalogPriority - capabilitiesA.catalogPriority;
            }
        }

        return a.name.localeCompare(b.name);
    });
};

export const getDefaultModelOptions = (): ModelOption[] => {
    const pinnedInternalModels: ModelOption[] = INITIAL_PINNED_MODELS.map(id => {
        let name;
        if (id === 'gemini-2.5-flash-native-audio-preview-12-2025') {
            name = 'Gemini 2.5 Flash Native Audio';
        } else if (id.toLowerCase().includes('gemma')) {
             name = id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        } else {
             name = id.includes('/') 
                ? `Gemini ${id.split('/')[1]}`.replace('gemini-','').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                : `Gemini ${id.replace('gemini-','').replace(/-/g, ' ')}`.replace(/\b\w/g, l => l.toUpperCase());
        }
        return { id, name, isPinned: true };
    });
    return sortModels([...pinnedInternalModels, ...STATIC_TTS_MODELS, ...STATIC_IMAGEN_MODELS]);
};

// --- Model Settings Cache ---
const MODEL_SETTINGS_CACHE_KEY = 'model_settings_cache';

export interface CachedModelSettings {
    mediaResolution?: MediaResolution;
    thinkingBudget?: number;
    thinkingLevel?: ThinkingLevel;
}

export const getCachedModelSettings = (modelId: string): CachedModelSettings | undefined => {
    try {
        const cache = JSON.parse(localStorage.getItem(MODEL_SETTINGS_CACHE_KEY) || '{}');
        return cache[modelId];
    } catch {
        return undefined;
    }
};

export const cacheModelSettings = (modelId: string, settings: CachedModelSettings) => {
    if (!modelId) return;
    try {
        const cache = JSON.parse(localStorage.getItem(MODEL_SETTINGS_CACHE_KEY) || '{}');
        cache[modelId] = { ...cache[modelId], ...settings };
        localStorage.setItem(MODEL_SETTINGS_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        console.error("Failed to cache model settings", e);
    }
};
