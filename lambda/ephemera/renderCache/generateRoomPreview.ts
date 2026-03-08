import { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type {
    EphemeraCacheMarkState,
    EphemeraCacheRenderedContent,
    EphemeraCacheDynamoItem
} from './baseClasses'
import { findExactMatchForComponent } from './exampleComparison'

export type GenerateRoomPreviewInput = {
    roomId: EphemeraRoomId;
    markState: EphemeraCacheMarkState;
    assetStack: string[];
    generationContextWml?: string;
}

export type GenerateRoomPreviewSuccess = {
    success: true;
    renderedContent: EphemeraCacheRenderedContent;
}

export type GenerateRoomPreviewFailure = {
    success: false;
    errorCode: 'NO_EXACT_MATCH';
    errorMessage: string;
}

export type GenerateRoomPreviewResult =
    | GenerateRoomPreviewSuccess
    | GenerateRoomPreviewFailure

type FindExactMatchForComponent = typeof findExactMatchForComponent

export const generateRoomPreview = async (
    {
        roomId,
        markState,
        assetStack,
        generationContextWml
    }: GenerateRoomPreviewInput,
    {
        findExactMatchForComponentImpl = findExactMatchForComponent
    }: {
        findExactMatchForComponentImpl?: FindExactMatchForComponent;
    } = {}
): Promise<GenerateRoomPreviewResult> => {
    let parsedContext: StandardForm | null = null
    if (generationContextWml) {
        try {
            parsedContext = new StandardForm(generationContextWml)
        } catch {
            // invalid WML; parsedContext stays null
        }
    }

    const perspective = { assetStack: assetStack as AssetUUID[] }

    const match: EphemeraCacheDynamoItem | null = await findExactMatchForComponentImpl({
        componentId: roomId,
        proposedMarkState: markState,
        perspective
    })

    if (match) {
        return {
            success: true,
            renderedContent: match.renderedContent
        }
    }

    return {
        success: false,
        errorCode: 'NO_EXACT_MATCH',
        errorMessage: 'No exact match for proposed state'
    }
}

