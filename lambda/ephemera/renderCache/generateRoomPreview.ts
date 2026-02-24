import { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    EphemeraCacheMarkState,
    EphemeraCacheRenderedContent,
    EphemeraCacheDynamoItem
} from './baseClasses'
import { findExactMatchForComponent } from './exampleComparison'
import { computePerspectiveId } from '../internalUtils/perspectiveId'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'

export type GenerateRoomPreviewInput = {
    roomId: EphemeraRoomId;
    markState: EphemeraCacheMarkState;
    assetStack: string[];
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
type ComputePerspectiveId = typeof computePerspectiveId

export const generateRoomPreview = async ({
    roomId,
    markState,
    assetStack
}: GenerateRoomPreviewInput, {
    findExactMatchForComponentImpl = findExactMatchForComponent,
    computePerspectiveIdImpl = computePerspectiveId
}: {
    findExactMatchForComponentImpl?: FindExactMatchForComponent;
    computePerspectiveIdImpl?: ComputePerspectiveId;
} = {}): Promise<GenerateRoomPreviewResult> => {
    const perspectiveId = computePerspectiveIdImpl(assetStack as AssetUUID[])

    const match: EphemeraCacheDynamoItem | null = await findExactMatchForComponentImpl({
        componentId: roomId,
        proposedMarkState: markState,
        perspectiveId
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

