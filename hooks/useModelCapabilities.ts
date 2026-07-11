
import { useMemo } from 'react';
import { getModelCapabilities } from '../constants/modelRegistry';

export const useModelCapabilities = (modelId: string) => {
    return useMemo(() => {
        const capabilities = getModelCapabilities(modelId);
        const lowerId = modelId.toLowerCase();
        const isGemini3ImageModel = lowerId.includes('gemini-3') && capabilities.imageGeneration;
        const isRealImagen = lowerId.includes('imagen');

        return {
            ...capabilities,
            isImagenModel: capabilities.imageGeneration,
            isGemini3ImageModel,
            isGemini3: capabilities.thinking === 'level' || capabilities.thinking === 'budget-and-level',
            isTtsModel: capabilities.tts,
            isNativeAudioModel: capabilities.live,
            supportedAspectRatios: capabilities.aspectRatios,
            supportedImageSizes: capabilities.imageSizes,
            isRealImagen,
        };
    }, [modelId]);
};
