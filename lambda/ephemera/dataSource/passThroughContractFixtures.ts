/**
 * Test-only shared fixtures for pass-through contract tests (Jest).
 * Do not import from production runtime code.
 */
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheDynamoItem, EphemeraCacheRenderedContent } from './renderCache/baseClasses'
import { EPHEMERA_CACHE_PROVENANCE_GENERATED } from './renderCache/baseClasses'
import type { AffordanceOrchestrationPublishedRouting } from './affordanceOrchestration/publishedEvents'
import type {
    RenderOrchestrationCurrentCacheValidPayload,
    RenderOrchestrationExactMatchFoundPayload,
    RenderOrchestrationGenerationDeferredPayload,
    RenderOrchestrationGenerationStartedPayload,
    RenderOrchestrationOrchestrationErrorPayload,
    RenderOrchestrationRenderGeneratedPayload,
    RenderOrchestrationPublishedRouting,
} from './renderOrchestration/publishedEvents'

export const passThroughFixtureRoomId = 'ROOM#test-room' as const

export const passThroughFixturePerspective: Perspective = { assetStack: ['ASSET#one'] }

export const passThroughFixturePerspectiveKey = 'PERSPECTIVE#v1#abc123'

/** Lean routing shared by all six orchestration outbounds (contract). */
export const passThroughFixtureRouting: RenderOrchestrationPublishedRouting = {
    componentId: passThroughFixtureRoomId,
    perspective: passThroughFixturePerspective,
    perspectiveKey: passThroughFixturePerspectiveKey,
}

/** Lean routing shared by affordance orchestration outbounds (contract). */
export const affordancePassThroughFixtureRouting: AffordanceOrchestrationPublishedRouting = {
    roomId: passThroughFixtureRoomId,
    perspective: passThroughFixturePerspective,
    perspectiveKey: passThroughFixturePerspectiveKey,
}

export const passThroughFixtureMinimalCacheId = 'CACHE#fixture-cache-1' as const

export const passThroughFixtureMinimalRenderedContent: EphemeraCacheRenderedContent = {
    description: ['Test description.'],
}

export const passThroughFixtureMinimalDynamoItem: EphemeraCacheDynamoItem = {
    EphemeraId: passThroughFixtureRoomId,
    DataCategory: passThroughFixtureMinimalCacheId,
    markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
    renderedContent: passThroughFixtureMinimalRenderedContent,
    provenance: { type: EPHEMERA_CACHE_PROVENANCE_GENERATED },
    perspectiveId: 'perspective-id',
    perspectiveMatcher: { requiredAssetIds: ['ASSET#one'] },
}

export function makePassThroughCurrentCacheValidPayload(): RenderOrchestrationCurrentCacheValidPayload {
    return {
        type: 'Current Cache Valid',
        ...passThroughFixtureRouting,
        cacheId: passThroughFixtureMinimalCacheId,
    }
}

export function makePassThroughExactMatchFoundPayload(): RenderOrchestrationExactMatchFoundPayload {
    return {
        type: 'Exact Match Found',
        ...passThroughFixtureRouting,
        cacheId: passThroughFixtureMinimalCacheId,
    }
}

export function makePassThroughGenerationStartedPayload(): RenderOrchestrationGenerationStartedPayload {
    return {
        type: 'Generation Started',
        ...passThroughFixtureRouting,
        phase: 'generating',
    }
}

export function makePassThroughRenderGeneratedPayload(): RenderOrchestrationRenderGeneratedPayload {
    return {
        type: 'Render Generated',
        ...passThroughFixtureRouting,
        cacheId: passThroughFixtureMinimalCacheId,
        cacheRecord: passThroughFixtureMinimalDynamoItem,
    }
}

export function makePassThroughOrchestrationErrorPayload(): RenderOrchestrationOrchestrationErrorPayload {
    return {
        type: 'Orchestration Error',
        ...passThroughFixtureRouting,
        errorCode: 'CONTEXT_REQUIRED',
        errorMessage: 'Generation context required',
    }
}

export function makePassThroughGenerationDeferredPayload(): RenderOrchestrationGenerationDeferredPayload {
    return {
        type: 'Generation Deferred',
        ...passThroughFixtureRouting,
        reason: 'NO_CACHE_MATCH_AND_GENERATION_NOT_RUN',
        policy: 'costCap',
    }
}
