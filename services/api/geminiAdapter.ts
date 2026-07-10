import {
  PartMediaResolutionLevel,
  ThinkingLevel as GeminiThinkingLevel,
  type Candidate,
  type GenerateContentResponse,
} from '@google/genai';
import type { GeminiUsageMetadata } from '../../types/gemini';
import type { MediaResolution, ThinkingLevel } from '../../types/settings';

type CompatibleCandidate = Candidate & {
  toolCalls?: CompatibleToolCall[];
  url_context_metadata?: unknown;
};

type CompatibleToolCall = {
  functionCall?: {
    args?: Record<string, unknown>;
  };
};

export const toGeminiThinkingLevel = (
  level: ThinkingLevel = 'HIGH'
): GeminiThinkingLevel => GeminiThinkingLevel[level];

export const toPartMediaResolutionLevel = (
  level: MediaResolution
): PartMediaResolutionLevel => PartMediaResolutionLevel[level];

export const normalizeUsageMetadata = (
  metadata?: GeminiUsageMetadata
): GeminiUsageMetadata | undefined => {
  if (!metadata) return undefined;

  return {
    ...metadata,
    candidatesTokenCount: metadata.candidatesTokenCount ?? metadata.responseTokenCount,
    responseTokenCount: metadata.responseTokenCount ?? metadata.candidatesTokenCount,
  };
};

export const getCompletionTokenCount = (
  metadata?: GeminiUsageMetadata
): number | undefined => metadata?.candidatesTokenCount ?? metadata?.responseTokenCount;

export const getUrlContextMetadata = (candidate?: Candidate): unknown => {
  const compatibleCandidate = candidate as CompatibleCandidate | undefined;
  return compatibleCandidate?.urlContextMetadata ?? compatibleCandidate?.url_context_metadata;
};

const getCompatibleToolCalls = (
  response: GenerateContentResponse,
  candidate?: Candidate
): CompatibleToolCall[] => {
  const compatibleCandidate = candidate as CompatibleCandidate | undefined;
  if (compatibleCandidate?.toolCalls?.length) {
    return compatibleCandidate.toolCalls;
  }

  const responseFunctionCalls = response.functionCalls ?? [];
  if (responseFunctionCalls.length) {
    return responseFunctionCalls.map(functionCall => ({ functionCall }));
  }

  return (candidate?.content?.parts ?? [])
    .filter(part => !!part.functionCall)
    .map(part => ({ functionCall: part.functionCall }));
};

export const mergeToolCitations = (
  currentMetadata: any,
  response: GenerateContentResponse,
  candidate?: Candidate
): any => {
  const merged = currentMetadata ? { ...currentMetadata } : {};

  for (const toolCall of getCompatibleToolCalls(response, candidate)) {
    const args = toolCall.functionCall?.args;
    const urlContextMetadata = args?.urlContextMetadata as { citations?: Array<{ uri?: string }> } | undefined;
    const citations = urlContextMetadata?.citations ?? [];
    if (!citations.length) continue;

    if (!Array.isArray(merged.citations)) merged.citations = [];
    for (const citation of citations) {
      if (!merged.citations.some((existing: { uri?: string }) => existing.uri === citation.uri)) {
        merged.citations.push(citation);
      }
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
};
