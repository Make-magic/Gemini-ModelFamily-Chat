
import { File as GeminiFile } from "@google/genai";
import { getConfiguredApiClient } from './baseApi';
import { logService } from "../logService";
import { classifyApiError, waitForRetry } from './errorClassifier';

const FILE_UPLOAD_START_URL = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
const FILE_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;

const throwAbortError = (): never => {
    const abortError = new Error('Upload cancelled by user.');
    abortError.name = 'AbortError';
    throw abortError;
};

const readErrorResponse = async (response: Response): Promise<Error> => {
    const body = await response.text().catch(() => '');
    const error = new Error(body || `File upload failed (${response.status})`) as Error & { status?: number };
    error.status = response.status;
    return error;
};

const fetchUploadRequest = async (url: string, init: RequestInit, signal: AbortSignal): Promise<Response> => {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await fetch(url, { ...init, signal });
            if (response.ok) return response;
            const error = await readErrorResponse(response);
            const classified = classifyApiError(error);
            if (!classified.retryable || attempt === 2) throw classified;
            await waitForRetry(500 * (2 ** attempt) + Math.floor(Math.random() * 250), signal);
        } catch (error) {
            if (signal.aborted) throwAbortError();
            const classified = classifyApiError(error);
            if (!classified.retryable || attempt === 2) throw classified;
            await waitForRetry(500 * (2 ** attempt) + Math.floor(Math.random() * 250), signal);
        }
    }
    throw new Error('File upload retry loop exhausted.');
};

/**
 * Uploads a file using the Files API resumable protocol documented by Google.
 * Progress represents bytes acknowledged by the service, and AbortSignal is
 * attached to every network request.
 */
export const uploadFileApi = async (
    apiKey: string, 
    file: File, 
    mimeType: string, 
    displayName: string, 
    signal: AbortSignal,
    onProgress?: (loaded: number, total: number) => void
): Promise<GeminiFile> => {
    logService.info(`Uploading file (SDK): ${displayName}`, { mimeType, size: file.size });
    
    if (signal.aborted) throwAbortError();

    try {
        const startResponse = await fetchUploadRequest(FILE_UPLOAD_START_URL, {
            method: 'POST',
            headers: {
                'x-goog-api-key': apiKey,
                'Content-Type': 'application/json',
                'X-Goog-Upload-Protocol': 'resumable',
                'X-Goog-Upload-Command': 'start',
                'X-Goog-Upload-Header-Content-Length': String(file.size),
                'X-Goog-Upload-Header-Content-Type': mimeType,
                'X-Goog-Upload-File-Name': encodeURIComponent(displayName),
            },
            body: JSON.stringify({ file: { display_name: displayName, mime_type: mimeType } }),
        }, signal);

        const uploadUrl = startResponse.headers.get('x-goog-upload-url');
        if (!uploadUrl) throw new Error('Files API did not return a resumable upload URL.');

        let offset = 0;
        let finalFile: GeminiFile | undefined;
        while (offset < file.size) {
            if (signal.aborted) throwAbortError();
            const end = Math.min(offset + FILE_UPLOAD_CHUNK_BYTES, file.size);
            const isFinal = end === file.size;
            const chunk = file.slice(offset, end, mimeType);
            const response = await fetchUploadRequest(uploadUrl, {
                method: 'POST',
                headers: {
                    'X-Goog-Upload-Offset': String(offset),
                    'X-Goog-Upload-Command': isFinal ? 'upload, finalize' : 'upload',
                    'Content-Type': mimeType,
                },
                body: chunk,
            }, signal);

            offset = end;
            onProgress?.(offset, file.size);
            if (isFinal) {
                const body = await response.json() as { file?: GeminiFile };
                finalFile = body.file;
            }
        }

        if (!finalFile) throw new Error('Files API upload completed without file metadata.');
        return finalFile;

    } catch (error) {
        logService.error(`Failed to upload file "${displayName}" to Gemini API:`, error);
        
        // If it's an abort, ensure we throw a specific error for UI handling
        if (signal.aborted) throwAbortError();
        
        throw error;
    }
};

export const getFileMetadataApi = async (apiKey: string, fileApiName: string): Promise<GeminiFile | null> => {
    if (!fileApiName || !fileApiName.startsWith('files/')) {
        logService.error(`Invalid fileApiName format: ${fileApiName}. Must start with "files/".`);
        throw new Error('Invalid file ID format. Expected "files/your_file_id".');
    }
    try {
        logService.info(`Fetching metadata for file: ${fileApiName}`);
        const ai = await getConfiguredApiClient(apiKey);
        const file = await ai.files.get({ name: fileApiName });
        return file;
    } catch (error) {
        logService.error(`Failed to get metadata for file "${fileApiName}" from Gemini API:`, error);
        if (error instanceof Error && (error.message.includes('NOT_FOUND') || error.message.includes('404'))) {
            return null; // File not found is a valid outcome we want to handle
        }
        throw error; // Re-throw other errors
    }
};
