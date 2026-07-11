import type { ModelCapabilities, ModelDescriptor, ModelOption } from '../types';

const TEXT_DEFAULTS: ModelCapabilities = {
  text: true,
  imageGeneration: false,
  imageEditing: false,
  tts: false,
  live: false,
  thinking: 'none',
  thinkingRequired: false,
  tools: { googleSearch: false, codeExecution: false, urlContext: false },
  mediaResolution: 'none',
  quadImageGeneration: false,
};

const IMAGE_RATIOS = ['Auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '4:5', '5:4', '21:9'];
const IMAGEN_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'];

const exactCapabilities: Record<string, Partial<ModelCapabilities>> = {
  'gemini-3.5-flash': { thinking: 'budget-and-level', thinkingRequired: true, thinkingBudgetRange: { min: 32768, max: 32768 }, mediaResolution: 'per-part' },
  'gemini-3.1-pro-preview': { thinking: 'budget-and-level', thinkingRequired: true, thinkingBudgetRange: { min: 32768, max: 32768 }, mediaResolution: 'per-part' },
  'gemini-3.1-flash-lite': { thinking: 'budget-and-level', thinkingRequired: true, thinkingBudgetRange: { min: 32768, max: 32768 }, mediaResolution: 'per-part' },
  'gemini-3-flash-preview': { thinking: 'budget-and-level', thinkingRequired: true, thinkingBudgetRange: { min: 32768, max: 32768 }, mediaResolution: 'per-part' },
  'gemini-2.5-pro': { thinking: 'budget', thinkingRequired: true, thinkingBudgetRange: { min: 128, max: 32768 } },
  'gemini-2.5-flash-image': { text: true, imageGeneration: true, imageEditing: true, thinking: 'none', mediaResolution: 'none', imageSizes: undefined, aspectRatios: IMAGE_RATIOS, quadImageGeneration: true },
  'gemini-3-pro-image-preview': { text: true, imageGeneration: true, imageEditing: true, thinking: 'level', mediaResolution: 'per-part', imageSizes: ['1K', '2K', '4K'], aspectRatios: IMAGE_RATIOS, quadImageGeneration: true },
};

const normalizeModelId = (modelId: string): string => modelId.replace(/^models\//, '').toLowerCase();

const mergeCapabilities = (base: ModelCapabilities, override?: Partial<ModelCapabilities>): ModelCapabilities => ({
  ...base,
  ...override,
  tools: { ...base.tools, ...(override?.tools ?? {}) },
});

export const getModelCapabilities = (modelId: string, override?: Partial<ModelCapabilities>): ModelCapabilities => {
  const id = normalizeModelId(modelId);
  let inferred = mergeCapabilities(TEXT_DEFAULTS);

  if (id.startsWith('gemini-')) {
    inferred = mergeCapabilities(inferred, {
      tools: { googleSearch: true, codeExecution: true, urlContext: true },
      mediaResolution: 'global',
    });
  }
  inferred = mergeCapabilities(inferred, exactCapabilities[id]);

  if (id.includes('native-audio') || id.includes('live')) {
    inferred = mergeCapabilities(inferred, { live: true, tools: { googleSearch: false, codeExecution: false, urlContext: false } });
  }
  if (id.includes('tts')) {
    inferred = mergeCapabilities(inferred, { text: false, tts: true, mediaResolution: 'none', tools: { googleSearch: false, codeExecution: false, urlContext: false } });
  }
  if (id.includes('imagen')) {
    inferred = mergeCapabilities(inferred, {
      text: false,
      imageGeneration: true,
      mediaResolution: 'none',
      aspectRatios: IMAGEN_RATIOS,
      imageSizes: id.includes('fast') ? undefined : ['1K', '2K'],
      quadImageGeneration: true,
      tools: { googleSearch: false, codeExecution: false, urlContext: false },
    });
  }
  if (id.includes('gemini-3') && !id.includes('image')) {
    inferred = mergeCapabilities(inferred, { thinking: 'budget-and-level', thinkingRequired: true, mediaResolution: 'per-part' });
  } else if (id.includes('gemini-2.5') && !id.includes('image')) {
    inferred = mergeCapabilities(inferred, { thinking: 'budget' });
  }

  return mergeCapabilities(inferred, override);
};

export const getModelDescriptor = (model: ModelOption | string): ModelDescriptor => {
  const option = typeof model === 'string' ? { id: model, name: model } : model;
  return { ...option, capabilities: getModelCapabilities(option.id, option.capabilities) };
};

export const mergeProviderModels = (current: ModelOption[], provider: ModelOption[]): ModelOption[] => {
  const existing = new Map(current.map(model => [normalizeModelId(model.id), model]));
  const merged = provider.map(model => {
    const local = existing.get(normalizeModelId(model.id));
    existing.delete(normalizeModelId(model.id));
    return {
      ...model,
      source: 'provider' as const,
      name: local?.name || model.name,
      isPinned: local?.isPinned ?? model.isPinned,
      capabilities: { ...(model.capabilities ?? {}), ...(local?.capabilities ?? {}) },
    };
  });
  return [...merged, ...existing.values()];
};
