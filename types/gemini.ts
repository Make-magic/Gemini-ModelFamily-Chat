import type { Part } from '@google/genai';

/** Stable project-owned representation of one Gemini conversation turn. */
export interface ChatHistoryItem {
  role: 'user' | 'model';
  parts: Part[];
}

/**
 * Compatibility shape shared by generateContent and Live API usage metadata.
 * The SDK has used both candidatesTokenCount and responseTokenCount for output.
 */
export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  responseTokenCount?: number;
  totalTokenCount?: number;
  thoughtsTokenCount?: number;
  cachedContentTokenCount?: number;
  toolUsePromptTokenCount?: number;
}
