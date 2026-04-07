import { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { v4 as uuidv4 } from 'uuid'
import { perspectiveMatches, computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import {
    EPHEMERA_CACHE_DATA_CATEGORY_PREFIX,
    EPHEMERA_CACHE_PROVENANCE_GENERATED,
    type EphemeraCacheDynamoItem,
    type EphemeraCacheMarkState,
} from '../../renderCache/baseClasses'
import type { RenderProgress, RenderResolveOutput } from './baseClasses'
import type { QueryCacheRecordsForComponentFn } from '../renderCache/queryCacheRecordsForComponent'
import internalCache from '../../internalCache'
import { generateRoomDescription } from '../../generateExample'
import { buildOrchestrationRouting } from './orchestrationRouting'
import type { RenderOrchestrationPublishedPayload } from './publishedEvents'

export type GenerateRoomPreviewInput = {
    roomId: EphemeraRoomId;
    markState: EphemeraCacheMarkState;
    assetStack: string[];
    generationContextWml?: string;
}

type GenerateRoomDescription = typeof generateRoomDescription

export type GenerateRoomPreviewOptions = {
    generateRoomDescriptionImpl?: GenerateRoomDescription;
    queryCacheRecordsForComponentImpl?: QueryCacheRecordsForComponentFn;
    /**
     * Optional progressive + terminal delivery: `RenderProgress` (e.g. `generating`) and `RenderResolveOutput` terminals.
     * When set, invoked with `generating` after valid parseable context and before room description generation (slow path only).
     */
    sendMessage?: (arg: RenderProgress | RenderResolveOutput) => Promise<void>;
    /** mtw.ephemera.renderOrchestration stream outbounds (from `streamEvent` via orchestration; required for this entry point). */
    publishOrchestration: (content: RenderOrchestrationPublishedPayload) => void | Promise<void>;
}

/** Control return from `generateRoomPreview`; terminals are delivered only via `sendMessage`. */
export type GenerateRoomPreviewGenerationReturn = 'success' | 'fail'

/**
 * Slow path only: assumes exact-match was already tried by orchestration.
 * Callers must not invoke this when a cache row already satisfies the request.
 *
 * Emits terminal `RenderResolveOutput` through `sendMessage` (and `generating` progress on the slow path).
 * Durable cache write is owned by `mtw.ephemera.renderCache` on `Render Generated` (pass-through); do not enqueue `Put Cache Record` here.
 */
export const generateRoomPreview = async (
    {
        roomId,
        markState,
        assetStack,
        generationContextWml
    }: GenerateRoomPreviewInput,
    {
        generateRoomDescriptionImpl = generateRoomDescription,
        queryCacheRecordsForComponentImpl = (componentId) => internalCache.RenderCache.get(componentId),
        sendMessage,
        publishOrchestration,
    }: GenerateRoomPreviewOptions
): Promise<GenerateRoomPreviewGenerationReturn> => {
    const perspective = { assetStack: assetStack as AssetUUID[] }
    const routing = buildOrchestrationRouting(roomId, perspective, computePerspectiveKey)

    let parsedContext: StandardForm | null = null
    if (generationContextWml) {
        try {
            parsedContext = new StandardForm(generationContextWml)
        } catch {
            // invalid WML; parsedContext stays null
        }
    }

    if (!parsedContext) {
        await publishOrchestration({
            type: 'Orchestration Error',
            ...routing,
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required',
        })
        await sendMessage?.({
            type: 'failed',
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required',
        })
        return 'fail'
    }

    // slow path only: we have no exact cache match and we have valid generation context
    await publishOrchestration({
        type: 'Generation Started',
        ...routing,
        phase: 'generating',
    })
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
        await publishOrchestration({
            type: 'Orchestration Error',
            ...routing,
            errorCode: descriptionResult.errorCode,
            errorMessage: descriptionResult.errorMessage,
        })
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
    // Pre-mint `DataCategory` so `Render Generated` carries the id `renderCache` uses in `putCacheRecord(..., existingDataCategory)`.
    const cacheId = `${EPHEMERA_CACHE_DATA_CATEGORY_PREFIX}${uuidv4()}` as EphemeraCacheId
    const cacheRecord: EphemeraCacheDynamoItem = {
        EphemeraId: roomId,
        DataCategory: cacheId,
        ...record,
    }

    await publishOrchestration({
        type: 'Render Generated',
        ...routing,
        cacheId,
        cacheRecord,
    })
    await sendMessage?.({
        type: 'resolved',
        renderedContent: descriptionResult.renderedContent,
        cacheId,
        cacheRecord,
    })
    return 'success'
}
