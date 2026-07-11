import type { ModelCapabilities, ModelDescriptor, ModelOption } from '../types';

const TEXT_DEFAULTS: ModelCapabilities = {
  family: 'unknown',
  generation: 'unknown',
  variant: 'unknown',
  catalogPriority: 0,
  text: true,
  imageGeneration: false,
  imageEditing: false,
  imageModelKind: 'none',
  tts: false,
  live: false,
  thinking: 'none',
  thinkingRequired: false,
  tools: { googleSearch: false, codeExecution: false, urlContext: false },
  mediaResolution: 'none',
  quadImageGeneration: false,
  transcriptionThinking: { mode: 'disabled' },
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

const inferIdentity = (id: string): Pick<ModelCapabilities, 'family' | 'generation' | 'variant'> => {
  const family = id.startsWith('gemini-')
    ? 'gemini'
    : id.includes('imagen')
      ? 'imagen'
      : id.includes('gemma')
        ? 'gemma'
        : 'unknown';
  const generation = id.includes('gemini-3')
    ? '3'
    : id.includes('gemini-2.5')
      ? '2.5'
      : 'unknown';
  const variant = id.includes('native-audio') || id.includes('live')
    ? 'live'
    : id.includes('tts')
      ? 'tts'
      : id.includes('image') || id.includes('imagen')
        ? 'image'
        : id.includes('flash')
          ? 'flash'
          : id.includes('pro')
            ? 'pro'
            : 'unknown';

  return { family, generation, variant };
};

const inferCatalogPriority = (id: string): number => {
  if (id.includes('gemini-3.5')) return 350;
  if (id.includes('gemini-3.1')) return 310;
  if (id.includes('gemini-3')) return 300;
  if (id.includes('gemini-2.5')) return 250;
  return 0;
};

const inferTranscriptionThinking = (
  id: string,
  identity: Pick<ModelCapabilities, 'family' | 'generation' | 'variant'>,
): ModelCapabilities['transcriptionThinking'] => {
  if (identity.family === 'gemini' && identity.generation === '3') {
    return { mode: 'level', level: 'LOW', includeThoughts: false };
  }
  if (id === 'gemini-2.5-pro') return { mode: 'budget', budget: 128 };
  if (identity.variant === 'flash') return { mode: 'budget', budget: 512 };
  return { mode: 'disabled' };
};

const mergeCapabilities = (base: ModelCapabilities, override?: Partial<ModelCapabilities>): ModelCapabilities => ({
  ...base,
  ...override,
  tools: { ...base.tools, ...(override?.tools ?? {}) },
});

export const getModelCapabilities = (modelId: string, override?: Partial<ModelCapabilities>): ModelCapabilities => {
  const id = normalizeModelId(modelId);
  const identity = inferIdentity(id);
  let inferred = mergeCapabilities(TEXT_DEFAULTS, {
    ...identity,
    catalogPriority: inferCatalogPriority(id),
    transcriptionThinking: inferTranscriptionThinking(id, identity),
  });

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

  const merged = mergeCapabilities(inferred, override);
  if (!override?.imageModelKind && merged.imageGeneration) {
    merged.imageModelKind = merged.family === 'imagen'
      ? 'imagen'
      : merged.family === 'gemini'
        ? 'gemini-native'
        : 'unknown';
  }
  return merged;
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
