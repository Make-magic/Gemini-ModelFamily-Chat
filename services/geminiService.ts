
import { ChatHistoryItem, ChatTerminalResult, GeminiService } from '../types';
import { Part, File as GeminiFile, Modality } from "@google/genai";
import { uploadFileApi, getFileMetadataApi } from './api/fileApi';
import { generateImagesApi, generateSpeechApi, transcribeAudioApi, translateTextApi, generateTitleApi, generateSuggestionsApi, countTokensApi } from './api/generationApi';
import { sendStatelessMessageStreamApi, sendStatelessMessageNonStreamApi } from './api/chatApi';
import { logService } from "./logService";

class GeminiServiceImpl implements GeminiService {
    constructor() {
        logService.info("GeminiService created.");
    }

    async uploadFile(
        apiKey: string, 
        file: File, 
        mimeType: string, 
        displayName: string, 
        signal: AbortSignal,
        onProgress?: (loaded: number, total: number) => void
    ): Promise<GeminiFile> {
        return uploadFileApi(apiKey, file, mimeType, displayName, signal, onProgress);
    }
    
    async getFileMetadata(apiKey: string, fileApiName: string): Promise<GeminiFile | null> {
        return getFileMetadataApi(apiKey, fileApiName);
    }

    async generateImages(apiKey: string, modelId: string, prompt: string, aspectRatio: string, imageSize: string | undefined, abortSignal: AbortSignal): Promise<string[]> {
        return generateImagesApi(apiKey, modelId, prompt, aspectRatio, imageSize, abortSignal);
    }

    async generateSpeech(apiKey: string, modelId: string, text: string, voice: string, abortSignal: AbortSignal): Promise<string> {
        return generateSpeechApi(apiKey, modelId, text, voice, abortSignal);
    }

    async transcribeAudio(apiKey: string, audioFile: File, modelId: string): Promise<string> {
        return transcribeAudioApi(apiKey, audioFile, modelId);
    }

    async translateText(apiKey: string, text: string, targetLanguage?: string): Promise<string> {
        return translateTextApi(apiKey, text, targetLanguage);
    }

    async generateTitle(apiKey: string, userContent: string, modelContent: string, language: 'en' | 'zh'): Promise<string> {
        return generateTitleApi(apiKey, userContent, modelContent, language);
    }

    async generateSuggestions(apiKey: string, userContent: string, modelContent: string, language: 'en' | 'zh'): Promise<string[]> {
        return generateSuggestionsApi(apiKey, userContent, modelContent, language);
    }

    async countTokens(apiKey: string, modelId: string, parts: Part[]): Promise<number> {
        return countTokensApi(apiKey, modelId, parts);
    }

    async editImage(apiKey: string, modelId: string, history: ChatHistoryItem[], parts: Part[], abortSignal: AbortSignal, aspectRatio?: string, imageSize?: string): Promise<Part[]> {
        return new Promise((resolve, reject) => {
            if (abortSignal.aborted) {
                const abortError = new Error("aborted");
                abortError.name = "AbortError";
                return reject(abortError);
            }
            
            const config: any = {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            };
            
            if (aspectRatio && aspectRatio !== 'Auto') {
                if (!config.imageConfig) config.imageConfig = {};
                config.imageConfig.aspectRatio = aspectRatio;
            }

            if (modelId === 'gemini-3-pro-image-preview' && imageSize) {
                if (!config.imageConfig) config.imageConfig = {};
                config.imageConfig.imageSize = imageSize;
            }

            sendStatelessMessageNonStreamApi(
                apiKey,
                modelId,
                history,
                parts,
                config,
                abortSignal,
                result => {
                    if (result.status === 'success') resolve(result.parts ?? []);
                    else reject(result.error ?? Object.assign(new Error('aborted'), { name: 'AbortError' }));
                }
            );
        });
    }

    async sendMessageStream(
        apiKey: string,
        modelId: string,
        history: ChatHistoryItem[],
        parts: Part[],
        config: any,
        abortSignal: AbortSignal,
        onPart: (part: Part) => void,
        onThoughtChunk: (chunk: string) => void,
        onTerminal: (result: ChatTerminalResult) => void
    ): Promise<void> {
        return sendStatelessMessageStreamApi(
            apiKey, modelId, history, parts, config, abortSignal, onPart, onThoughtChunk, onTerminal
        );
    }

    async sendMessageNonStream(
        apiKey: string,
        modelId: string,
        history: ChatHistoryItem[],
        parts: Part[],
        config: any,
        abortSignal: AbortSignal,
        onTerminal: (result: ChatTerminalResult) => void
    ): Promise<void> {
        return sendStatelessMessageNonStreamApi(
            apiKey, modelId, history, parts, config, abortSignal, onTerminal
        );
    }
}

export const geminiServiceInstance: GeminiService = new GeminiServiceImpl();
