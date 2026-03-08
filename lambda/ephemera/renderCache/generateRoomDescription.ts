import { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type {
    EphemeraCacheMarkState,
    EphemeraCacheRenderedContent,
    EphemeraCacheDynamoItem
} from './baseClasses'

export type GenerateRoomDescriptionInput = {
    roomId: EphemeraRoomId;
    markState: EphemeraCacheMarkState;
    perspective: { assetStack: AssetUUID[] };
    generationContext: StandardForm | null;
    cachedExamples?: EphemeraCacheDynamoItem[];
}

export type GenerateRoomDescriptionSuccess = {
    success: true;
    renderedContent: EphemeraCacheRenderedContent;
}

export type GenerateRoomDescriptionFailure = {
    success: false;
    errorCode: 'NO_EXACT_MATCH' | 'GENERATION_FAILED';
    errorMessage: string;
}

export type GenerateRoomDescriptionResult =
    | GenerateRoomDescriptionSuccess
    | GenerateRoomDescriptionFailure

/**
 * Stub: returns NO_EXACT_MATCH. Item 3 will replace this with real Bedrock LLM integration.
 */
export const generateRoomDescription = async (
    _input: GenerateRoomDescriptionInput
): Promise<GenerateRoomDescriptionResult> => {
    return Promise.resolve({
        success: false,
        errorCode: 'NO_EXACT_MATCH',
        errorMessage: 'No exact match for proposed state'
    })
}
