
import { GenerateContentResponse, Part } from "@google/genai";
import { ChatHistoryItem, ChatTerminalResult, GeminiUsageMetadata, ThoughtSupportingPart } from '../../types';
import { logService } from "../logService";
import { getConfiguredApiClient } from "./baseApi";
import {
    getUrlContextMetadata,
    mergeToolCitations,
    normalizeUsageMetadata,
} from './geminiAdapter';
import { classifyApiError, waitForRetry } from './errorClassifier';

/**
 * Shared helper to parse GenAI responses.
 * Extracts parts, separates thoughts, and merges metadata/citations from tool calls.
 */
const processResponse = (response: GenerateContentResponse) => {
    let thoughtsText = "";
    const responseParts: Part[] = [];

    if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            const pAsThoughtSupporting = part as ThoughtSupportingPart;
            if (pAsThoughtSupporting.thought) {
                thoughtsText += part.text;
            } else {
                responseParts.push(part);
            }
        }
    }

    if (responseParts.length === 0 && response.text) {
        responseParts.push({ text: response.text });
    }
    
    const candidate = response.candidates?.[0];
    const finalMetadata = mergeToolCitations(candidate?.groundingMetadata, response, candidate);
    const urlContextMetadata = getUrlContextMetadata(candidate);

    return {
        parts: responseParts,
        thoughts: thoughtsText || undefined,
        usage: normalizeUsageMetadata(response.usageMetadata),
        grounding: finalMetadata,
        urlContext: urlContextMetadata
    };
};

const createTerminalEmitter = (onTerminal: (result: ChatTerminalResult) => void) => {
    let terminalSent = false;
    return (result: ChatTerminalResult) => {
        if (terminalSent) return;
        terminalSent = true;
        onTerminal(result);
    };
};

export const sendStatelessMessageStreamApi = async (
    apiKey: string,
    modelId: string,
    history: ChatHistoryItem[],
    parts: Part[],
    config: any,
    abortSignal: AbortSignal,
    onPart: (part: Part) => void,
    onThoughtChunk: (chunk: string) => void,
    onTerminal: (result: ChatTerminalResult) => void
): Promise<void> => {
    logService.info(`Sending message via stateless generateContentStream for ${modelId}`);
    let finalUsageMetadata: GeminiUsageMetadata | undefined = undefined;
    let finalGroundingMetadata: any = null;
    let finalUrlContextMetadata: any = null;

    let emittedContent = false;
    const finish = createTerminalEmitter(onTerminal);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (abortSignal.aborted) {
            finish({ status: 'abort', usageMetadata: finalUsageMetadata, groundingMetadata: finalGroundingMetadata, urlContextMetadata: finalUrlContextMetadata });
            return;
        }
        const ai = await getConfiguredApiClient(apiKey);
        const result = await ai.models.generateContentStream({
            model: modelId,
            contents: [...history, { role: 'user', parts }],
            config: { ...config, abortSignal }
        });

        for await (const chunkResponse of result) {
            if (abortSignal.aborted) break;
            if (chunkResponse.usageMetadata) {
                finalUsageMetadata = normalizeUsageMetadata(chunkResponse.usageMetadata);
            }
            const candidate = chunkResponse.candidates?.[0];
            
            if (candidate) {
                const metadataFromChunk = candidate.groundingMetadata;
                if (metadataFromChunk) {
                    finalGroundingMetadata = metadataFromChunk;
                }
                
                const urlMetadata = getUrlContextMetadata(candidate);
                if (urlMetadata) {
                    finalUrlContextMetadata = urlMetadata;
                }

                finalGroundingMetadata = mergeToolCitations(finalGroundingMetadata, chunkResponse, candidate);
                
                if (candidate.content?.parts?.length) {
                    for (const part of candidate.content.parts) {
                        const pAsThoughtSupporting = part as ThoughtSupportingPart;

                        if (pAsThoughtSupporting.thought) {
                            emittedContent = emittedContent || !!part.text;
                            onThoughtChunk(part.text || '');
                        } else {
                            emittedContent = true;
                            onPart(part);
                        }
                    }
                }
            }
        }

        if (abortSignal.aborted) {
            finish({ status: 'abort', usageMetadata: finalUsageMetadata, groundingMetadata: finalGroundingMetadata, urlContextMetadata: finalUrlContextMetadata });
        } else {
            finish({ status: 'success', usageMetadata: finalUsageMetadata, groundingMetadata: finalGroundingMetadata, urlContextMetadata: finalUrlContextMetadata });
        }
        logService.info("Streaming complete.", { usage: finalUsageMetadata, hasGrounding: !!finalGroundingMetadata });
        return;
      } catch (error) {
        const classified = classifyApiError(error);
        if (classified.kind === 'aborted' || abortSignal.aborted) {
            finish({ status: 'abort', error: classified, usageMetadata: finalUsageMetadata, groundingMetadata: finalGroundingMetadata, urlContextMetadata: finalUrlContextMetadata });
            return;
        }
        if (!emittedContent && classified.retryable && attempt < 2) {
            const delayMs = classified.retryAfterMs ?? (500 * (2 ** attempt) + Math.floor(Math.random() * 250));
            logService.warn(`Retrying stream setup after retryable error (${attempt + 1}/2).`, { error: classified });
            await waitForRetry(delayMs, abortSignal);
            continue;
        }
        logService.error("Error sending message (stream):", classified);
        finish({ status: 'error', error: classified, usageMetadata: finalUsageMetadata, groundingMetadata: finalGroundingMetadata, urlContextMetadata: finalUrlContextMetadata });
        return;
      }
    }
};

export const sendStatelessMessageNonStreamApi = async (
    apiKey: string,
    modelId: string,
    history: ChatHistoryItem[],
    parts: Part[],
    config: any,
    abortSignal: AbortSignal,
    onTerminal: (result: ChatTerminalResult) => void
): Promise<void> => {
    logService.info(`Sending message via stateless generateContent (non-stream) for model ${modelId}`);
    const finish = createTerminalEmitter(onTerminal);
    
    try {
        const ai = await getConfiguredApiClient(apiKey);

        if (abortSignal.aborted) { finish({ status: 'abort', parts: [] }); return; }

        const response = await ai.models.generateContent({
            model: modelId,
            contents: [...history, { role: 'user', parts }],
            config: { ...config, abortSignal }
        });

        if (abortSignal.aborted) { finish({ status: 'abort', parts: [] }); return; }

        const { parts: responseParts, thoughts, usage, grounding, urlContext } = processResponse(response);

        logService.info(`Stateless non-stream complete for ${modelId}.`, { usage, hasGrounding: !!grounding, hasUrlContext: !!urlContext });
        if (responseParts.length === 0 && !thoughts) throw new Error('The model returned an empty response.');
        finish({ status: 'success', parts: responseParts, thoughtsText: thoughts, usageMetadata: usage, groundingMetadata: grounding, urlContextMetadata: urlContext });
    } catch (error) {
        const classified = classifyApiError(error);
        if (classified.kind === 'aborted' || abortSignal.aborted) {
            finish({ status: 'abort', error: classified, parts: [] });
            return;
        }
        logService.error(`Error in stateless non-stream for ${modelId}:`, classified);
        finish({ status: 'error', error: classified, parts: [] });
    }
};
