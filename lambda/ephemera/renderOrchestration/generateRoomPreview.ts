import { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { v4 as uuidv4 } from 'uuid'
import { perspectiveMatches, computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import {
    EPHEMERA_CACHE_DATA_CATEGORY_PREFIX,
    EPHEMERA_CACHE_PROVENANCE_GENERATED,
    type EphemeraCacheComponentId,
    type EphemeraCacheDynamoItem,
    type EphemeraCacheMarkState,
} from '../renderCache/baseClasses'
import type { ConversationId } from '../conversations'
import type { RenderProgress, RenderResolveOutput } from '../dataSource/renderOrchestration/baseClasses'
import type { PutCacheRecordInput } from '../dataSource/renderCache/putCacheRecord'
import type { QueryCacheRecordsForComponentFn } from '../dataSource/renderCache/queryCacheRecordsForComponent'
import internalCache from '../internalCache'
import { generateRoomDescription } from '../generateExample'
import { sendPutCacheRecord } from '../dataSource/apiEphemera'
import messageBus from '../messageBus'

export type GenerateRoomPreviewInput = {
    roomId: EphemeraRoomId;
    markState: EphemeraCacheMarkState;
    assetStack: string[];
    generationContextWml?: string;
}

type GenerateRoomDescription = typeof generateRoomDescription

export type PublishPutCacheRecord = (
    componentId: EphemeraCacheComponentId,
    record: PutCacheRecordInput,
    existingDataCategory?: string,
    conversationId?: ConversationId
) => Promise<void>

/**
 * Default write path: enqueue `Put Cache Record` on `api.ephemera`.
 * Do not flush here: production callers (e.g. `app.ts`) already `await messageBus.flush()` after
 * queueing `ReturnValue`, and nested `send()` during an active flush is drained recursively.
 */
export const defaultPublishPutCacheRecord: PublishPutCacheRecord = async (
    componentId,
    record,
    existingDataCategory,
    conversationId
) => {
    sendPutCacheRecord(messageBus, componentId, {
        componentId,
        record,
        ...(existingDataCategory !== undefined ? { existingDataCategory } : {}),
        ...(conversationId !== undefined ? { conversationId } : {}),
    })
}

export type GenerateRoomPreviewOptions = {
    /** Override for tests; default is `defaultPublishPutCacheRecord` (`sendPutCacheRecord` on process `messageBus`). */
    publishPutCacheRecord?: PublishPutCacheRecord;
    generateRoomDescriptionImpl?: GenerateRoomDescription;
    queryCacheRecordsForComponentImpl?: QueryCacheRecordsForComponentFn;
    /** When set, forwarded on Put Cache Record / Cache Updated for prototype correlation (see conversations/AGENT.md). */
    conversationId?: ConversationId;
    /**
     * Same contract as `ConversationHandleGenerateRoomPreview.sendMessage` (see `conversations/conversationTypes/generateRoomPreview`).
     * When set, invoked with `generating` after valid parseable context and before room description generation (slow path only).
     */
    sendMessage?: (arg: RenderProgress | RenderResolveOutput) => Promise<void>;
}

/** Control return from `generateRoomPreview`; terminals are delivered only via `sendMessage`. */
export type GenerateRoomPreviewGenerationReturn = 'success' | 'fail'

/**
 * Slow path only: assumes exact-match was already tried by orchestration.
 * Callers must not invoke this when a cache row already satisfies the request.
 *
 * Emits terminal `RenderResolveOutput` through `sendMessage` (and `generating` progress on the slow path).
 */
export const generateRoomPreview = async (
    {
        roomId,
        markState,
        assetStack,
        generationContextWml
    }: GenerateRoomPreviewInput,
    {
        publishPutCacheRecord = defaultPublishPutCacheRecord,
        generateRoomDescriptionImpl = generateRoomDescription,
        queryCacheRecordsForComponentImpl = (componentId) => internalCache.RenderCache.get(componentId),
        conversationId,
        sendMessage,
    }: GenerateRoomPreviewOptions = {}
): Promise<GenerateRoomPreviewGenerationReturn> => {
    let parsedContext: StandardForm | null = null
    if (generationContextWml) {
        try {
            parsedContext = new StandardForm(generationContextWml)
        } catch {
            // invalid WML; parsedContext stays null
        }
    }

    const perspective = { assetStack: assetStack as AssetUUID[] }

    if (!parsedContext) {
        await sendMessage?.({
            type: 'failed',
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required',
        })
        return 'fail'
    }

    // slow path only: we have no exact cache match and we have valid generation context
    await sendMessage?.('generating')

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
        await sendMessage?.({
            type: 'failed',
            errorCode: descriptionResult.errorCode,
            errorMessage: descriptionResult.errorMessage,
        })
        return 'fail'
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
    // Pre-mint `DataCategory` and pass as `existingDataCategory` so `putCacheRecord` uses this key (same as a new row) and callers get the id without waiting on the bus.
    const cacheId = `${EPHEMERA_CACHE_DATA_CATEGORY_PREFIX}${uuidv4()}` as EphemeraCacheId
    const cacheRecord: EphemeraCacheDynamoItem = {
        EphemeraId: roomId,
        DataCategory: cacheId,
        ...record,
    }
    await publishPutCacheRecord(roomId, record, cacheId, conversationId)

    await sendMessage?.({
        type: 'resolved',
        renderedContent: descriptionResult.renderedContent,
        cacheId,
        cacheRecord,
    })
    return 'success'
}
