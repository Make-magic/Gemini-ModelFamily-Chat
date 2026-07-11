import { describe, expect, it } from 'vitest';
import { getModelCapabilities, mergeProviderModels } from '../constants/modelRegistry';

describe('model registry', () => {
  it('returns known capabilities and conservative name-based fallbacks', () => {
    expect(getModelCapabilities('gemini-3-pro-image-preview')).toMatchObject({ imageGeneration: true, imageEditing: true, mediaResolution: 'per-part' });
    expect(getModelCapabilities('vendor-unknown-tts')).toMatchObject({ text: false, tts: true, imageGeneration: false });
    expect(getModelCapabilities('vendor-unknown-model')).toMatchObject({ text: true, imageGeneration: false, tts: false });
  });

  it('keeps local names and pin settings when provider metadata is merged', () => {
    const merged = mergeProviderModels(
      [{ id: 'gemini-x', name: 'My Gemini', isPinned: true }],
      [{ id: 'models/gemini-x', name: 'Provider Gemini', supportedActions: ['generateContent'] }],
    );
    expect(merged[0]).toMatchObject({ name: 'My Gemini', isPinned: true, source: 'provider' });
  });
});
