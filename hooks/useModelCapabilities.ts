
import { useMemo } from 'react';
import { getModelCapabilities } from '../constants/modelRegistry';

export const useModelCapabilities = (modelId: string) => {
    return useMemo(() => {
        const capabilities = getModelCapabilities(modelId);
        const isGemini3ImageModel = capabilities.family === 'gemini'
            && capabilities.generation === '3'
            && capabilities.imageGeneration;
        const isRealImagen = capabilities.imageModelKind === 'imagen';

        return {
            ...capabilities,
            isImagenModel: capabilities.imageGeneration,
            isGemini3ImageModel,
            isGemini3: capabilities.family === 'gemini' && capabilities.generation === '3',
            isTtsModel: capabilities.tts,
            isNativeAudioModel: capabilities.live,
            supportedAspectRatios: capabilities.aspectRatios,
            supportedImageSizes: capabilities.imageSizes,
            isRealImagen,
        };
    }, [modelId]);
};
