import { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { perspectiveMatches, computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type {
    EphemeraCacheComponentId,
    EphemeraCacheMarkState,
    EphemeraCacheRenderedContent,
    EphemeraCacheDynamoItem
} from './baseClasses'
import type { PutCacheRecordInput } from './cacheAccess'
import type { QueryCacheRecordsForComponentFn } from '../dataSource/renderCache/queryCacheRecordsForComponent'
import { EPHEMERA_CACHE_PROVENANCE_GENERATED } from './baseClasses'
import { putCacheRecord } from './cacheAccess'
import internalCache from '../internalCache'
import { generateRoomDescription } from './generateRoomDescription'
import type { RenderCacheGetExactMatchParams } from '../internalCache/renderCache'

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

type GetExactMatchImpl = (
    input: RenderCacheGetExactMatchParams
) => Promise<EphemeraCacheDynamoItem | null>
type GenerateRoomDescription = typeof generateRoomDescription
type PutCacheRecord = typeof putCacheRecord

export type PublishPutCacheRecord = (
    componentId: EphemeraCacheComponentId,
    record: PutCacheRecordInput,
    existingDataCategory?: string
) => Promise<void>

export const generateRoomPreview = async (
    {
        roomId,
        markState,
        assetStack,
        generationContextWml
    }: GenerateRoomPreviewInput,
    {
        getExactMatchImpl = (input) => internalCache.RenderCache.getExactMatch(input),
        generateRoomDescriptionImpl = generateRoomDescription,
        queryCacheRecordsForComponentImpl = (componentId) => internalCache.RenderCache.get(componentId),
        putCacheRecordImpl = putCacheRecord,
        publishPutCacheRecord,
    }: {
        getExactMatchImpl?: GetExactMatchImpl;
        generateRoomDescriptionImpl?: GenerateRoomDescription;
        queryCacheRecordsForComponentImpl?: QueryCacheRecordsForComponentFn;
        putCacheRecordImpl?: PutCacheRecord;
        /** When set (e.g. app handler), writes go through api.ephemera + mtw.ephemera.renderCache instead of putCacheRecordImpl. */
        publishPutCacheRecord?: PublishPutCacheRecord;
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

    const match: EphemeraCacheDynamoItem | null = await getExactMatchImpl({
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

    const perspectiveId = computePerspectiveKey(perspective.assetStack)
    const perspectiveMatcher = {
        requiredAssetIds: perspective.assetStack,
        forbiddenAssetIds: [] as AssetUUID[]
    }
    const record = {
        markState,
        renderedContent: descriptionResult.renderedContent,
        provenance: { type: EPHEMERA_CACHE_PROVENANCE_GENERATED },
        perspectiveId,
        perspectiveMatcher,
    }
    if (publishPutCacheRecord) {
        await publishPutCacheRecord(roomId, record)
    } else {
        await putCacheRecordImpl(roomId, record)
    }

    return {
        success: true,
        renderedContent: descriptionResult.renderedContent
    }
}

