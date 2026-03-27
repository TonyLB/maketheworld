import { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { perspectiveMatches, computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type {
    EphemeraCacheComponentId,
    EphemeraCacheMarkState,
} from '../renderCache/baseClasses'
import type { ConversationId } from '../conversations'
import type { GenerateRoomPreviewResult } from '../conversations/conversationTypes/generateRoomPreview'
import type { PutCacheRecordInput } from '../dataSource/renderCache/putCacheRecord'
import type { QueryCacheRecordsForComponentFn } from '../dataSource/renderCache/queryCacheRecordsForComponent'
import { EPHEMERA_CACHE_PROVENANCE_GENERATED } from '../renderCache/baseClasses'
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
     * Optional callback for streaming the non-terminal `step: 'generating'`.
     * Must only be invoked on the slow path (no exact cache match and valid/parseable generation context).
     */
    onGenerating?: () => Promise<void>;
}

/**
 * Slow path only: assumes exact-match was already tried by orchestration.
 * Callers must not invoke this when a cache row already satisfies the request.
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
        onGenerating,
    }: GenerateRoomPreviewOptions = {}
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

    if (!parsedContext) {
        return {
            success: false,
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required'
        }
    }

    // slow path only: we have no exact cache match and we have valid generation context
    await onGenerating?.()

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
    await publishPutCacheRecord(roomId, record, undefined, conversationId)

    return {
        success: true,
        renderedContent: descriptionResult.renderedContent
    }
}
