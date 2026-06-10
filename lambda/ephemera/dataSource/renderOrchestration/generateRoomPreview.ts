import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { v4 as uuidv4 } from 'uuid'
import { perspectiveMatches, computePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { delayPromise } from '@tonylb/mtw-utilities/ts/dynamoDB/delayPromise'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import {
    EPHEMERA_CACHE_DATA_CATEGORY_PREFIX,
    EPHEMERA_CACHE_PROVENANCE_GENERATED,
    type EphemeraCacheDynamoItem,
    type EphemeraCacheMarkState,
} from '../renderCache/baseClasses'
import type { QueryCacheRecordsForComponentFn } from '../renderCache/queryCacheRecordsForComponent'
import internalCache from '../../internalCache'
import { generateRoomDescription } from '../../generateExample'
import { buildOrchestrationRouting } from './orchestrationRouting'
import type { RenderOrchestrationPublishedPayload } from './publishedEvents'
import { computeRenderGenerationArgumentHash } from './renderGenerationArgumentHash'
import {
    EPHEMERA_ROOM_RENDER_GENERATION_CATEGORY,
    defaultRunWithSingleFlight,
    type RunWithSingleFlight,
} from './singleFlightRenderGeneration'

export type GenerateRoomPreviewInput = {
    roomId: EphemeraRoomId;
    markState: EphemeraCacheMarkState;
    assetStack: string[];
    generationContextWml?: string;
}

type GenerateRoomDescription = typeof generateRoomDescription

const generationContextFormFromCache = async (
    roomId: EphemeraRoomId,
    assetStack: AssetUUID[],
): Promise<StandardForm | undefined> => {
    const generationContext = await internalCache.GenerationContext.get(
        roomId as ComponentUUID,
        assetStack
    )
    if (!generationContext) {
        return undefined
    }
    const provisionalForm = new StandardForm([
        { tag: 'Asset', universalKey: 'ASSET#generationContext', key: 'generationContext' },
        {
            tag: 'Room',
            universalKey: roomId,
            shortName: generationContext.shortName.toJSON(),
        },
    ])
    return provisionalForm
}

export type GetExactMatchForGeneration = (input: {
    componentId: EphemeraRoomId;
    proposedMarkState: EphemeraCacheMarkState;
    perspective: Perspective;
}) => Promise<EphemeraCacheDynamoItem | null>

export type GenerateRoomPreviewOptions = {
    generateRoomDescriptionImpl?: GenerateRoomDescription;
    queryCacheRecordsForComponentImpl?: QueryCacheRecordsForComponentFn;
    /**
     * For singleFlight follower path: read durable row after leader {@link Render Generated} / `renderCache` write.
     * Defaults to {@link internalCache.RenderCache.getExactMatch}.
     */
    getExactMatch?: GetExactMatchForGeneration;
    /**
     * Coalesce concurrent generation (production default). Tests should pass {@link passThroughSingleFlight} from `./singleFlightRenderGeneration`.
     */
    runWithSingleFlight?: RunWithSingleFlight;
    /** mtw.ephemera.renderOrchestration stream outbounds (from `streamEvent` via orchestration; required for this entry point). */
    publishOrchestration: (content: RenderOrchestrationPublishedPayload) => void | Promise<void>;
}

/** Control return from `generateRoomPreview`. */
export type GenerateRoomPreviewGenerationReturn = 'success' | 'fail'

const getExactMatchAfterLeaderWrite = async (
    getExactMatch: GetExactMatchForGeneration,
    input: Parameters<GetExactMatchForGeneration>[0],
    {
        maxAttempts = 40,
        delayMs = 100,
    }: { maxAttempts?: number; delayMs?: number } = {}
): Promise<EphemeraCacheDynamoItem | null> => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const row = await getExactMatch(input)
        if (row) {
            return row
        }
        await delayPromise(delayMs)
    }
    return null
}

/**
 * Slow path only: assumes exact-match was already tried by orchestration.
 * Callers must not invoke this when a cache row already satisfies the request.
 *
 * Emits outcomes via `publishOrchestration` only.
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
        getExactMatch = (input) => internalCache.RenderCache.getExactMatch(input),
        runWithSingleFlight: runWithSingleFlightOpt,
        publishOrchestration,
    }: GenerateRoomPreviewOptions
): Promise<GenerateRoomPreviewGenerationReturn> => {
    const perspective = { assetStack: assetStack as AssetUUID[] }
    const routing = buildOrchestrationRouting(roomId, perspective, computePerspectiveKey)
    const runWithSingleFlight = runWithSingleFlightOpt ?? defaultRunWithSingleFlight

    let parsedContext: StandardForm | null = null
    if (generationContextWml) {
        try {
            parsedContext = new StandardForm(generationContextWml)
        } catch {
            // invalid WML; parsedContext stays null
        }
    }
    if (!parsedContext) {
        try {
            parsedContext = await generationContextFormFromCache(roomId, perspective.assetStack) ?? null
        } catch {
            // missing/invalid derived context; parsedContext stays null
        }
    }

    if (!parsedContext) {
        await publishOrchestration({
            type: 'Orchestration Error',
            ...routing,
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required',
        })
        return 'fail'
    }

    const perspectiveKey = computePerspectiveKey(perspective.assetStack)
    const argumentHash = computeRenderGenerationArgumentHash(roomId, perspectiveKey, markState)

    return runWithSingleFlight({
        category: EPHEMERA_ROOM_RENDER_GENERATION_CATEGORY,
        argumentHash,
        computation: async (): Promise<GenerateRoomPreviewGenerationReturn> => {
            await publishOrchestration({
                type: 'Generation Started',
                ...routing,
                phase: 'generating',
            })

            const runAfterGenerationStarted = async (): Promise<GenerateRoomPreviewGenerationReturn> => {
                const allRecords = await queryCacheRecordsForComponentImpl(roomId)
                const cachedExamples = allRecords.filter(
                    (record) => record.perspectiveMatcher && perspectiveMatches(record.perspectiveMatcher, perspective)
                )

                const descriptionResult = await generateRoomDescriptionImpl({
                    roomId,
                    markState,
                    perspective,
                    generationContext: parsedContext!,
                    cachedExamples
                })

                if (!descriptionResult.success) {
                    await publishOrchestration({
                        type: 'Orchestration Error',
                        ...routing,
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
                return 'success'
            }

            return await runAfterGenerationStarted()
        },
        retrieval: async (): Promise<GenerateRoomPreviewGenerationReturn> => {
            const exact = await getExactMatchAfterLeaderWrite(getExactMatch, {
                componentId: roomId,
                proposedMarkState: markState,
                perspective,
            })
            if (!exact) {
                throw new Error('RENDER_GENERATION_FOLLOWER_CACHE_MISS')
            }
            return 'success'
        },
    })
}

// Re-export for tests / orchestration wiring
export { passThroughSingleFlight } from './singleFlightRenderGeneration'
