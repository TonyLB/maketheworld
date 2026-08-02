import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'
import { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
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
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCacheId, EphemeraCacheMarkState } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { PerspectiveMatcher } from '@tonylb/mtw-interfaces/ts/perspective'

import {
    EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX,
    EPHEMERA_CACHE_DATA_CATEGORY_PREFIX,
    type EphemeraCacheCatalogDataCategory,
} from './keys'

export type EphemeraCacheComponentId =
    | EphemeraRoomId
    | EphemeraFeatureId
    | EphemeraKnowledgeId
    | EphemeraObjectId
    | EphemeraCharacterId

export type { EphemeraCacheMarkState }

export type EphemeraCacheRenderedContent = {
    displayName?: RenderTree;
    summary?: RenderTree;
    description: RenderTree;
}

export type EphemeraCacheProvenance = {
    type: 'authored' | 'generated';
}

export const EPHEMERA_CACHE_PROVENANCE_AUTHORED = 'authored' as const
export const EPHEMERA_CACHE_PROVENANCE_GENERATED = 'generated' as const

export type EphemeraPerspectiveId = string

export type EphemeraCacheCatalogRow = {
    EphemeraId: EphemeraCacheComponentId;
    DataCategory: EphemeraCacheCatalogDataCategory;
    assetStack: AssetUUID[];
    catalogVersion: number;
    hydratedCatalogVersion: number;
    currentCacheId?: EphemeraCacheId;
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

export const isEphemeraCacheDynamoItem = (item: unknown): item is EphemeraCacheDynamoItem => {
    if (!item || typeof item !== 'object') {
        return false
    }
    const record = item as Record<string, unknown>
    const { EphemeraId, DataCategory, markState, renderedContent, provenance, perspectiveId, perspectiveMatcher } = record
    if (typeof EphemeraId !== 'string' || typeof DataCategory !== 'string') {
        return false
    }
    if (!DataCategory.startsWith(EPHEMERA_CACHE_DATA_CATEGORY_PREFIX)) {
        return false
    }
    if (typeof perspectiveId !== 'string') {
        return false
    }
    if (!perspectiveMatcher || typeof perspectiveMatcher !== 'object' || !Array.isArray((perspectiveMatcher as PerspectiveMatcher).requiredAssetIds)) {
        return false
    }
    if (!markState || typeof markState !== 'object' || !Array.isArray((markState as EphemeraCacheMarkState).markValue)) {
        return false
    }
    if (!(markState as EphemeraCacheMarkState).markValue.every(
        (entry: unknown) => entry && typeof entry === 'object'
            && typeof (entry as { mark: unknown }).mark === 'string'
            && typeof (entry as { value: unknown }).value === 'string'
    )) {
        return false
    }
    if (!renderedContent || typeof renderedContent !== 'object') {
        return false
    }
    if (!('description' in (renderedContent as object)) || typeof (renderedContent as EphemeraCacheRenderedContent).description !== 'object') {
        return false
    }
    if (!provenance || typeof provenance !== 'object' || typeof (provenance as EphemeraCacheProvenance).type !== 'string') {
        return false
    }
    if (
        (provenance as EphemeraCacheProvenance).type !== EPHEMERA_CACHE_PROVENANCE_AUTHORED
        && (provenance as EphemeraCacheProvenance).type !== EPHEMERA_CACHE_PROVENANCE_GENERATED
    ) {
        return false
    }
    if (record.catalogVersion !== undefined && (typeof record.catalogVersion !== 'number' || record.catalogVersion < 0)) {
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
