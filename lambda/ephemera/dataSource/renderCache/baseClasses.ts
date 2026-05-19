/**
 * mtw.ephemera.renderCache shared types:
 * - Domain / DynamoDB cache record shapes (Ephemera table rows, guards, provenance constants).
 * - Outbound bus-only payloads for this DataSource (Cache Updated, Render Pertains, etc.).
 */
import {
    EphemeraFeatureId,
    EphemeraKnowledgeId,
    EphemeraRoomId,
    EphemeraSituationId
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCacheId, EphemeraCacheMarkState, EphemeraCacheMarkValue } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { PerspectiveMatcher } from '@tonylb/mtw-interfaces/ts/perspective'
import { RenderTree } from '@tonylb/mtw-base/ts/renderTree'

//
// Ephemera render cache record types and constants
//
// Design sources:
// - lambda/ephemera/AGENT.caching.planning.md
// - lambda/ephemera/AGENT.caching.firstMVP.planning.md
//

export type EphemeraCacheComponentId =
    | EphemeraRoomId
    | EphemeraFeatureId
    | EphemeraKnowledgeId

//
// markState: Mark UUID to Match string pairs (shared via mtw-interfaces)
//
export type { EphemeraCacheMarkValue, EphemeraCacheMarkState }

//
// renderedContent: Cached description (displayName / summary / description triplet)
//

export type EphemeraCacheRenderedContent = {
    displayName?: RenderTree;
    summary?: RenderTree;
    description: RenderTree;
}

//
// provenance: Source of the cached example
//

export type EphemeraCacheProvenance = {
    type: 'authored' | 'generated';
}

export const EPHEMERA_CACHE_PROVENANCE_AUTHORED = 'authored' as const
export const EPHEMERA_CACHE_PROVENANCE_GENERATED = 'generated' as const

//
// perspectiveId: Known inactive (not used for matching). Kept on the record
// pending possible later use for search optimization.
//

export type EphemeraPerspectiveId = string

//
// situationId: Link to the Situation UUID; used to target delete on ExampleRemoved wire events.
//

//
// Domain-level cache record used within Ephemera code
//

export type EphemeraCacheRecord = {
    componentId: EphemeraCacheComponentId;
    markState: EphemeraCacheMarkState;
    renderedContent: EphemeraCacheRenderedContent;
    provenance: EphemeraCacheProvenance;
    perspectiveId: EphemeraPerspectiveId;
    perspectiveMatcher: PerspectiveMatcher;
    situationId?: EphemeraSituationId;
}

//
// Raw DynamoDB item shape for render cache records
//

export const EPHEMERA_CACHE_DATA_CATEGORY_PREFIX = 'CACHE#' as const

export type EphemeraCacheDynamoItem = {
    EphemeraId: EphemeraCacheComponentId;
    DataCategory: string;
    markState: EphemeraCacheMarkState;
    renderedContent: EphemeraCacheRenderedContent;
    provenance: EphemeraCacheProvenance;
    perspectiveId: EphemeraPerspectiveId;
    perspectiveMatcher: PerspectiveMatcher;
    situationId?: EphemeraSituationId;
}

export const isEphemeraCacheDynamoItem = (item: any): item is EphemeraCacheDynamoItem => {
    if (!item || typeof item !== 'object') {
        return false
    }
    const { EphemeraId, DataCategory, markState, renderedContent, provenance, perspectiveId, perspectiveMatcher } = item
    if (typeof EphemeraId !== 'string' || typeof DataCategory !== 'string') {
        return false
    }
    if (!DataCategory.startsWith(EPHEMERA_CACHE_DATA_CATEGORY_PREFIX)) {
        return false
    }
    if (typeof perspectiveId !== 'string') {
        return false
    }
    if (!perspectiveMatcher || typeof perspectiveMatcher !== 'object' || !Array.isArray(perspectiveMatcher.requiredAssetIds)) {
        return false
    }
    if (!markState || typeof markState !== 'object' || !Array.isArray(markState.markValue)) {
        return false
    }
    if (!markState.markValue.every(
        (entry: any) => entry && typeof entry === 'object'
            && typeof entry.mark === 'string'
            && typeof entry.value === 'string'
    )) {
        return false
    }
    if (!renderedContent || typeof renderedContent !== 'object') {
        return false
    }
    if (!('description' in renderedContent) || typeof renderedContent.description !== 'object') {
        return false
    }
    if (!provenance || typeof provenance !== 'object' || typeof provenance.type !== 'string') {
        return false
    }
    if (
        provenance.type !== EPHEMERA_CACHE_PROVENANCE_AUTHORED
        && provenance.type !== EPHEMERA_CACHE_PROVENANCE_GENERATED
    ) {
        return false
    }
    return true
}

// --- Outbound bus events (bus-only DataSource) ---

export const RENDER_CACHE_DATA_SOURCE_KEY = 'mtw.ephemera.renderCache' as const

export type RenderCacheCacheUpdatedPayload = {
    type: 'Cache Updated';
    componentId: EphemeraCacheComponentId;
    dataCategory: string;
    perspectiveId: string;
    /** Prototype: echoed from Put Cache Record command; remove when external orchestration correlates without DS plumbing (see conversations/AGENT.md). */
    conversationId?: string;
}

export type RenderCacheCacheErrorPayload = {
    type: 'Cache Error';
    componentId: EphemeraCacheComponentId;
    errorCode: string;
    errorMessage: string;
    perspectiveId?: string;
}

export type RenderCacheCacheDeletedPayload = {
    type: 'Cache Deleted';
    componentId: EphemeraCacheComponentId;
    dataCategories: string[];
}

/** Correlated readiness after refetch (hit path) or durable write (generate path). Lean routing; no synthetic correlation id on the wire. */
export type RenderCacheRenderPertainsPayload = {
    type: 'Render Pertains';
    componentId: EphemeraCacheComponentId;
    perspectiveKey: string;
    cacheId: EphemeraCacheId;
    /** Durable cache row after refetch (hit) or write (generate). */
    cacheRecord: EphemeraCacheDynamoItem;
}

export const isRenderCacheCacheDeletedPayload = (value: unknown): value is RenderCacheCacheDeletedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return (
        v.type === 'Cache Deleted' &&
        typeof v.componentId === 'string' &&
        Array.isArray(v.dataCategories) &&
        v.dataCategories.every((x) => typeof x === 'string')
    )
}

export type RenderCacheUpdatePayload =
    | RenderCacheCacheUpdatedPayload
    | RenderCacheCacheDeletedPayload
    | RenderCacheCacheErrorPayload
    | RenderCacheRenderPertainsPayload

const isEphemeraCacheIdString = (value: unknown): value is EphemeraCacheId => (
    typeof value === 'string' && value.startsWith('CACHE#')
)

export const isRenderCacheRenderPertainsPayload = (value: unknown): value is RenderCacheRenderPertainsPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (
        v.type !== 'Render Pertains'
        || typeof v.componentId !== 'string'
        || typeof v.perspectiveKey !== 'string'
        || !isEphemeraCacheIdString(v.cacheId)
    ) {
        return false
    }
    if (!isEphemeraCacheDynamoItem(v.cacheRecord)) {
        return false
    }
    if (v.cacheRecord.DataCategory !== v.cacheId || v.cacheRecord.EphemeraId !== v.componentId) {
        return false
    }
    return true
}

export const isRenderCacheCacheUpdatedPayload = (value: unknown): value is RenderCacheCacheUpdatedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (
        v.type !== 'Cache Updated' ||
        typeof v.componentId !== 'string' ||
        typeof v.dataCategory !== 'string' ||
        typeof v.perspectiveId !== 'string'
    ) {
        return false
    }
    if (v.conversationId !== undefined && typeof v.conversationId !== 'string') {
        return false
    }
    return true
}

export const isRenderCacheCacheErrorPayload = (value: unknown): value is RenderCacheCacheErrorPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Cache Error' || typeof v.componentId !== 'string') {
        return false
    }
    if (typeof v.errorCode !== 'string' || typeof v.errorMessage !== 'string') {
        return false
    }
    if (v.perspectiveId !== undefined && typeof v.perspectiveId !== 'string') {
        return false
    }
    return true
}
