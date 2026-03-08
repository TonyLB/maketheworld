import { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { perspectiveMatches } from '@tonylb/mtw-interfaces/ts/perspective'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type {
    EphemeraCacheMarkState,
    EphemeraCacheRenderedContent,
    EphemeraCacheDynamoItem
} from './baseClasses'
import { EPHEMERA_CACHE_PROVENANCE_GENERATED } from './baseClasses'
import { queryCacheRecordsForComponent, putCacheRecord } from './cacheAccess'
import { findExactMatchForComponent } from './exampleComparison'
import { generateRoomDescription } from './generateRoomDescription'
import { computePerspectiveId } from '../internalUtils/perspectiveId'

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

export type GenerateRoomPreviewFailure =
    | { success: false; errorCode: 'NO_EXACT_MATCH'; errorMessage: string }
    | { success: false; errorCode: 'CONTEXT_REQUIRED'; errorMessage: string }
    | { success: false; errorCode: 'GENERATION_FAILED'; errorMessage: string }

export type GenerateRoomPreviewResult =
    | GenerateRoomPreviewSuccess
    | GenerateRoomPreviewFailure

type FindExactMatchForComponent = typeof findExactMatchForComponent
type GenerateRoomDescription = typeof generateRoomDescription
type QueryCacheRecordsForComponent = typeof queryCacheRecordsForComponent
type PutCacheRecord = typeof putCacheRecord

export const generateRoomPreview = async (
    {
        roomId,
        markState,
        assetStack,
        generationContextWml
    }: GenerateRoomPreviewInput,
    {
        findExactMatchForComponentImpl = findExactMatchForComponent,
        generateRoomDescriptionImpl = generateRoomDescription,
        queryCacheRecordsForComponentImpl = queryCacheRecordsForComponent,
        putCacheRecordImpl = putCacheRecord
    }: {
        findExactMatchForComponentImpl?: FindExactMatchForComponent;
        generateRoomDescriptionImpl?: GenerateRoomDescription;
        queryCacheRecordsForComponentImpl?: QueryCacheRecordsForComponent;
        putCacheRecordImpl?: PutCacheRecord;
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

    if (!parsedContext) {
        return {
            success: false,
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required'
        }
    }

    const allRecords = await queryCacheRecordsForComponentImpl(roomId)
    const cachedExamples = allRecords.filter(
        (record) => record.perspectiveMatcher && perspectiveMatches(record.perspectiveMatcher, perspective)
    )

    const descriptionResult = await generateRoomDescriptionImpl({
        roomId,
        markState,
        perspective,
        generationContext: parsedContext,
        cachedExamples
    })

    if (!descriptionResult.success) {
        return descriptionResult
    }

    const perspectiveId = computePerspectiveId(perspective.assetStack)
    const perspectiveMatcher = {
        requiredAssetIds: perspective.assetStack,
        forbiddenAssetIds: [] as AssetUUID[]
    }
    await putCacheRecordImpl(roomId, {
        markState,
        renderedContent: descriptionResult.renderedContent,
        provenance: { type: EPHEMERA_CACHE_PROVENANCE_GENERATED },
        perspectiveId,
        perspectiveMatcher
    })

    return {
        success: true,
        renderedContent: descriptionResult.renderedContent
    }
}

