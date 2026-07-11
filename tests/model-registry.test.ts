import { describe, expect, it } from 'vitest';
import { getModelCapabilities, mergeProviderModels } from '../constants/modelRegistry';

describe('model registry', () => {
  it('returns known capabilities and conservative name-based fallbacks', () => {
    expect(getModelCapabilities('gemini-3-pro-image-preview')).toMatchObject({
      family: 'gemini',
      generation: '3',
      variant: 'image',
      catalogPriority: 300,
      imageGeneration: true,
      imageEditing: true,
      imageModelKind: 'gemini-native',
      mediaResolution: 'per-part',
    });
    expect(getModelCapabilities('vendor-unknown-tts')).toMatchObject({ text: false, tts: true, imageGeneration: false });
    expect(getModelCapabilities('vendor-unknown-model')).toMatchObject({
      family: 'unknown',
      generation: 'unknown',
      variant: 'unknown',
      text: true,
      imageGeneration: false,
      tts: false,
      transcriptionThinking: { mode: 'disabled' },
    });
  });

  it('centralizes transcription thinking defaults', () => {
    expect(getModelCapabilities('gemini-3-flash-preview').transcriptionThinking)
      .toEqual({ mode: 'level', level: 'LOW', includeThoughts: false });
    expect(getModelCapabilities('models/gemini-3.1-pro-preview').transcriptionThinking)
      .toEqual({ mode: 'level', level: 'LOW', includeThoughts: false });
    expect(getModelCapabilities('gemini-2.5-pro').transcriptionThinking)
      .toEqual({ mode: 'budget', budget: 128 });
    expect(getModelCapabilities('gemini-2.5-flash-lite').transcriptionThinking)
      .toEqual({ mode: 'budget', budget: 512 });
    expect(getModelCapabilities('vendor-unknown-model').transcriptionThinking)
      .toEqual({ mode: 'disabled' });
  });

  it('keeps local names and pin settings when provider metadata is merged', () => {
    const merged = mergeProviderModels(
      [{ id: 'gemini-x', name: 'My Gemini', isPinned: true }],
      [{ id: 'models/gemini-x', name: 'Provider Gemini', supportedActions: ['generateContent'] }],
    );
    expect(merged[0]).toMatchObject({ name: 'My Gemini', isPinned: true, source: 'provider' });
  });
});
