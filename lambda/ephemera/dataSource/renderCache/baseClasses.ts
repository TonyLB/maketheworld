/**
 * mtw.ephemera.renderCache shared types:
 * - Domain / DynamoDB cache record shapes (Ephemera table rows, guards, provenance constants).
 * - Outbound bus-only payloads for this DataSource (Cache Updated, Render Pertains, etc.).
 */
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'
import {
    EphemeraCharacterId,
    EphemeraFeatureId,
    EphemeraKnowledgeId,
    EphemeraObjectId,
    EphemeraRoomId,
    EphemeraSituationId,
    isEphemeraCharacterId,
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraObjectId,
    isEphemeraRoomId,
    isEphemeraSituationId,
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
    | EphemeraObjectId
    | EphemeraCharacterId

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

export const EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX = 'Cache::' as const
export const EPHEMERA_SITUATION_ADJACENCY_LINK_PREFIX = 'Link::' as const

export type EphemeraCacheCatalogDataCategory = `${typeof EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX}${string}`
export type SituationCacheAdjacencyDataCategory = `${typeof EPHEMERA_SITUATION_ADJACENCY_LINK_PREFIX}${string}::${typeof EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX}${string}`

export const buildCacheCatalogDataCategory = (perspectiveKey: string): EphemeraCacheCatalogDataCategory =>
    `${EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX}${perspectiveKey}`

export const buildSituationAdjacencyDataCategory = (
    hostEphemeraId: EphemeraCacheComponentId,
    perspectiveKey: string
): SituationCacheAdjacencyDataCategory =>
    `${EPHEMERA_SITUATION_ADJACENCY_LINK_PREFIX}${hostEphemeraId}::${EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX}${perspectiveKey}`

export type ParsedSituationAdjacencyDataCategory = {
    hostEphemeraId: EphemeraCacheComponentId;
    perspectiveKey: string;
}

export const parseSituationAdjacencyDataCategory = (
    dataCategory: string
): ParsedSituationAdjacencyDataCategory | undefined => {
    if (!dataCategory.startsWith(EPHEMERA_SITUATION_ADJACENCY_LINK_PREFIX)) {
        return undefined
    }
    const withoutLink = dataCategory.slice(EPHEMERA_SITUATION_ADJACENCY_LINK_PREFIX.length)
    const cacheMarker = `::${EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX}`
    const cacheIndex = withoutLink.indexOf(cacheMarker)
    if (cacheIndex < 0) {
        return undefined
    }
    const hostEphemeraId = withoutLink.slice(0, cacheIndex)
    if (
        !isEphemeraRoomId(hostEphemeraId)
        && !isEphemeraFeatureId(hostEphemeraId)
        && !isEphemeraKnowledgeId(hostEphemeraId)
        && !isEphemeraObjectId(hostEphemeraId)
        && !isEphemeraCharacterId(hostEphemeraId)
    ) {
        return undefined
    }
    const perspectiveKey = withoutLink.slice(cacheIndex + cacheMarker.length)
    if (!perspectiveKey) {
        return undefined
    }
    return { hostEphemeraId, perspectiveKey }
}

//
// Per-perspective catalog row (Cache::${perspectiveKey} under cache-host EphemeraId)
//

export type EphemeraCacheCatalogRow = {
    EphemeraId: EphemeraCacheComponentId;
    DataCategory: EphemeraCacheCatalogDataCategory;
    assetStack: AssetUUID[];
    catalogVersion: number;
    hydratedCatalogVersion: number;
    currentCacheId?: EphemeraCacheId;
}

//
// Situation adjacency membership (inverse index for Situation-scoped invalidation)
//

export type SituationCacheAdjacencyRow = {
    EphemeraId: EphemeraSituationId;
    DataCategory: SituationCacheAdjacencyDataCategory;
    assetStack: AssetUUID[];
}

export type EphemeraCacheDynamoItem = {
    EphemeraId: EphemeraCacheComponentId;
    DataCategory: string;
    markState: EphemeraCacheMarkState;
    renderedContent: EphemeraCacheRenderedContent;
    provenance: EphemeraCacheProvenance;
    perspectiveId: EphemeraPerspectiveId;
    perspectiveMatcher: PerspectiveMatcher;
    situationId?: EphemeraSituationId;
    /** Blueprint epoch at write time; missing treated as 0 (V2). */
    catalogVersion?: number;
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
    if (item.catalogVersion !== undefined && (typeof item.catalogVersion !== 'number' || item.catalogVersion < 0)) {
        return false
    }
    return true
}

const isValidAssetStack = (value: unknown): value is AssetUUID[] => (
    Array.isArray(value)
    && value.length > 0
    && value.every((entry) => typeof entry === 'string' && isSchemaAssetUUID(entry))
)

export const isEphemeraCacheCatalogRow = (item: unknown): item is EphemeraCacheCatalogRow => {
    if (!item || typeof item !== 'object') {
        return false
    }
    const record = item as Record<string, unknown>
    const { EphemeraId, DataCategory, assetStack, catalogVersion, hydratedCatalogVersion, currentCacheId } = record
    if (
        typeof EphemeraId !== 'string'
        || (
            !isEphemeraRoomId(EphemeraId)
            && !isEphemeraFeatureId(EphemeraId)
            && !isEphemeraKnowledgeId(EphemeraId)
            && !isEphemeraObjectId(EphemeraId)
            && !isEphemeraCharacterId(EphemeraId)
        )
    ) {
        return false
    }
    if (typeof DataCategory !== 'string' || !DataCategory.startsWith(EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX)) {
        return false
    }
    if (!isValidAssetStack(assetStack)) {
        return false
    }
    if (typeof catalogVersion !== 'number' || catalogVersion < 1) {
        return false
    }
    if (typeof hydratedCatalogVersion !== 'number' || hydratedCatalogVersion < 0) {
        return false
    }
    if (currentCacheId !== undefined && (typeof currentCacheId !== 'string' || !currentCacheId.startsWith('CACHE#'))) {
        return false
    }
    return true
}

export const isSituationCacheAdjacencyRow = (item: unknown): item is SituationCacheAdjacencyRow => {
    if (!item || typeof item !== 'object') {
        return false
    }
    const record = item as Record<string, unknown>
    const { EphemeraId, DataCategory, assetStack } = record
    if (typeof EphemeraId !== 'string' || !isEphemeraSituationId(EphemeraId)) {
        return false
    }
    if (typeof DataCategory !== 'string') {
        return false
    }
    const parsed = parseSituationAdjacencyDataCategory(DataCategory)
    if (!parsed) {
        return false
    }
    if (!isValidAssetStack(assetStack)) {
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
