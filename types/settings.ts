import type { ThemePreference } from './theme';

export interface ModelOption {
  id: string;
  name: string;
  isPinned?: boolean;
  source?: 'static' | 'user' | 'provider';
  supportedActions?: string[];
  capabilities?: Partial<ModelCapabilities>;
}

export type ModelFamily = 'gemini' | 'imagen' | 'gemma' | 'unknown';
export type ModelGeneration = '3' | '2.5' | 'unknown';
export type ModelVariant = 'flash' | 'pro' | 'image' | 'tts' | 'live' | 'unknown';
export type ImageModelKind = 'none' | 'gemini-native' | 'imagen' | 'unknown';
export type TranscriptionThinking =
  | { mode: 'level'; level: ThinkingLevel; includeThoughts: boolean }
  | { mode: 'budget'; budget: number }
  | { mode: 'disabled' };

export interface ModelCapabilities {
  family: ModelFamily;
  generation: ModelGeneration;
  variant: ModelVariant;
  catalogPriority: number;
  text: boolean;
  imageGeneration: boolean;
  imageEditing: boolean;
  imageModelKind: ImageModelKind;
  tts: boolean;
  live: boolean;
  thinking: 'none' | 'budget' | 'level' | 'budget-and-level';
  thinkingRequired: boolean;
  thinkingBudgetRange?: { min: number; max: number };
  tools: {
    googleSearch: boolean;
    codeExecution: boolean;
    urlContext: boolean;
  };
  mediaResolution: 'none' | 'global' | 'per-part';
  imageSizes?: string[];
  aspectRatios?: string[];
  quadImageGeneration: boolean;
  transcriptionThinking: TranscriptionThinking;
}

export interface ModelDescriptor extends ModelOption {
  capabilities: ModelCapabilities;
}

export type ThinkingLevel = 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';

export enum HarmCategory {
  HARM_CATEGORY_HARASSMENT = 'HARM_CATEGORY_HARASSMENT',
  HARM_CATEGORY_HATE_SPEECH = 'HARM_CATEGORY_HATE_SPEECH',
  HARM_CATEGORY_SEXUALLY_EXPLICIT = 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  HARM_CATEGORY_DANGEROUS_CONTENT = 'HARM_CATEGORY_DANGEROUS_CONTENT',
  HARM_CATEGORY_CIVIC_INTEGRITY = 'HARM_CATEGORY_CIVIC_INTEGRITY',
}

export enum HarmBlockThreshold {
  OFF = 'OFF',
  BLOCK_NONE = 'BLOCK_NONE',
  BLOCK_ONLY_HIGH = 'BLOCK_ONLY_HIGH',
  BLOCK_MEDIUM_AND_ABOVE = 'BLOCK_MEDIUM_AND_ABOVE',
  BLOCK_LOW_AND_ABOVE = 'BLOCK_LOW_AND_ABOVE',
}

export enum MediaResolution {
  MEDIA_RESOLUTION_UNSPECIFIED = 'MEDIA_RESOLUTION_UNSPECIFIED',
  MEDIA_RESOLUTION_LOW = 'MEDIA_RESOLUTION_LOW',
  MEDIA_RESOLUTION_MEDIUM = 'MEDIA_RESOLUTION_MEDIUM',
  MEDIA_RESOLUTION_HIGH = 'MEDIA_RESOLUTION_HIGH',
  MEDIA_RESOLUTION_ULTRA_HIGH = 'MEDIA_RESOLUTION_ULTRA_HIGH',
}

export interface SafetySetting {
  category: HarmCategory;
  threshold: HarmBlockThreshold;
}

export interface FilesApiConfig {
  images: boolean;
  pdfs: boolean;
  audio: boolean;
  video: boolean;
  text: boolean;
}

export interface ChatSettings {
  modelId: string;
  temperature: number;
  topP: number;
  showThoughts: boolean;
  systemInstruction: string;
  ttsVoice: string;
  thinkingBudget: number;
  thinkingLevel?: ThinkingLevel;
  lockedApiKey?: string | null;
  isGoogleSearchEnabled?: boolean;
  isCodeExecutionEnabled?: boolean;
  isUrlContextEnabled?: boolean;
  isDeepSearchEnabled?: boolean;
  safetySettings?: SafetySetting[];
  mediaResolution?: MediaResolution;
  shortcuts?: ShortcutsConfig;
}

export interface ShortcutsConfig {
  [key: string]: string[]; // key is actionId, value is array of keys (e.g. ['Meta', 'Shift', 'n'])
}

export interface AppSettings extends ChatSettings {
  themeId: ThemePreference;
  baseFontSize: number;
  useCustomApiConfig: boolean;
  apiKey: string | null;
  apiProxyUrl: string | null;
  useApiProxy?: boolean;
  language: 'en' | 'zh' | 'system';
  isStreamingEnabled: boolean;
  transcriptionModelId: string;
  filesApiConfig: FilesApiConfig;
  expandCodeBlocksByDefault: boolean;
  isAutoTitleEnabled: boolean;
  isMermaidRenderingEnabled: boolean;
  isGraphvizRenderingEnabled?: boolean;
  isCompletionNotificationEnabled: boolean;
  isSuggestionsEnabled: boolean;
  isAutoScrollOnSendEnabled?: boolean;
  isAutoSendOnSuggestionClick?: boolean;
  generateQuadImages?: boolean;
  autoFullscreenHtml?: boolean;
  showWelcomeSuggestions?: boolean;
  isAudioCompressionEnabled: boolean;
  autoCanvasVisualization?: boolean;
  autoCanvasModelId: string;
  isPasteRichTextAsMarkdownEnabled?: boolean;
  isPasteAsTextFileEnabled?: boolean;
  updatedAt?: number;
}
