
import { useState, useCallback } from 'react';
import { AppSettings, ModelOption } from '../../types';
import { sortModels, getDefaultModelOptions, getActiveApiConfig, parseApiKeys } from '../../utils/appUtils';
import { getConfiguredApiClient } from '../../services/api/baseApi';
import { mergeProviderModels } from '../../constants/modelRegistry';
import { logService } from '../../services/logService';

const CUSTOM_MODELS_KEY = 'custom_model_list_v2';

export const useModels = (appSettings: AppSettings) => {
    // Initialize with persisted models or defaults
    const [apiModels, setApiModelsState] = useState<ModelOption[]>(() => {
        try {
            const stored = localStorage.getItem(CUSTOM_MODELS_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to load custom models', e);
        }
        return getDefaultModelOptions();
    });
    
    const setApiModels = useCallback((models: ModelOption[]) => {
        const sorted = sortModels(models);
        setApiModelsState(sorted);
        localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(sorted));
    }, []);

    const [isRefreshingModels, setIsRefreshingModels] = useState(false);
    const [modelRefreshError, setModelRefreshError] = useState<string | null>(null);

    const refreshModelsFromProvider = useCallback(async () => {
        const [apiKey] = parseApiKeys(getActiveApiConfig(appSettings).apiKeysString);
        if (!apiKey) throw new Error('API key is required to refresh provider models.');
        setIsRefreshingModels(true);
        setModelRefreshError(null);
        try {
            const client = await getConfiguredApiClient(apiKey);
            const pager = await (client.models.list as any)({ config: { pageSize: 100 } });
            const providerModels: ModelOption[] = [];
            if (pager?.[Symbol.asyncIterator]) {
                for await (const model of pager) {
                    if (!model?.name) continue;
                    const id = String(model.name).replace(/^models\//, '');
                    providerModels.push({
                        id,
                        name: model.displayName || id,
                        source: 'provider',
                        supportedActions: model.supportedActions,
                    });
                }
            } else {
                for (const model of pager?.page || pager?.models || []) {
                    if (!model?.name) continue;
                    const id = String(model.name).replace(/^models\//, '');
                    providerModels.push({ id, name: model.displayName || id, source: 'provider', supportedActions: model.supportedActions });
                }
            }
            if (!providerModels.length) throw new Error('Provider returned an empty model catalog.');
            const merged = sortModels(mergeProviderModels(apiModels, providerModels));
            setApiModelsState(merged);
            localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(merged));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setModelRefreshError(message);
            logService.warn('Provider model refresh failed; keeping the local catalog.', { error });
            throw error;
        } finally {
            setIsRefreshingModels(false);
        }
    }, [apiModels, appSettings]);

    // Currently loading is instantaneous for local storage, but structure prepared for API fetch
    const isModelsLoading = false;
    const modelsLoadingError = null;

    return { apiModels, setApiModels, isModelsLoading, modelsLoadingError, refreshModelsFromProvider, isRefreshingModels, modelRefreshError };
};
