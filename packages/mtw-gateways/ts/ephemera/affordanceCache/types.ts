import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'
import { isEphemeraRoomId, type EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ProjectedRoomTopology } from '../../assets/components/componentTopology/result'
import { isEphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'

const isProjectedRoomTopology = (value: unknown): value is ProjectedRoomTopology => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const record = value as Record<string, unknown>
    return typeof record.roomUniversalKey === 'string'
        && isEphemeraId(record.roomUniversalKey)
        && Array.isArray(record.exits)
}

import {
    buildAffordanceDataCategory,
    EPHEMERA_AFFORDANCE_DATA_CATEGORY_PREFIX,
    type EphemeraAffordanceDataCategory,
} from './keys'

export type { EphemeraAffordanceDataCategory }

/**
 * Colocated affordance-topology row per (ROOM#, perspectiveKey) (D33).
 * Catalog version metadata and embedded projected exits live on one Dynamo item.
 */
export type AffordanceCacheRow = {
    EphemeraId: EphemeraRoomId;
    DataCategory: EphemeraAffordanceDataCategory;
    assetStack: AssetUUID[];
    catalogVersion: number;
    hydratedCatalogVersion: number;
    topology: ProjectedRoomTopology;
}

export const isAffordanceCacheRow = (record: unknown): record is AffordanceCacheRow => {
    if (!record || typeof record !== 'object') {
        return false
    }
    const row = record as Record<string, unknown>
    if (typeof row.EphemeraId !== 'string' || !isEphemeraRoomId(row.EphemeraId)) {
        return false
    }
    if (
        typeof row.DataCategory !== 'string'
        || !row.DataCategory.startsWith(EPHEMERA_AFFORDANCE_DATA_CATEGORY_PREFIX)
    ) {
        return false
    }
    if (!Array.isArray(row.assetStack) || !row.assetStack.every((a) => typeof a === 'string' && isSchemaAssetUUID(a))) {
        return false
    }
    if (typeof row.catalogVersion !== 'number' || row.catalogVersion < 0) {
        return false
    }
    if (typeof row.hydratedCatalogVersion !== 'number' || row.hydratedCatalogVersion < 0) {
        return false
    }
    if (!isProjectedRoomTopology(row.topology)) {
        return false
    }
    if (row.topology.roomUniversalKey !== row.EphemeraId) {
        return false
    }
    return true
}

export const createAffordanceCacheRow = (params: {
    roomId: EphemeraRoomId;
    perspectiveKey: string;
    assetStack: AssetUUID[];
    catalogVersion: number;
    hydratedCatalogVersion: number;
    topology: ProjectedRoomTopology;
}): AffordanceCacheRow => ({
    EphemeraId: params.roomId,
    DataCategory: buildAffordanceDataCategory(params.perspectiveKey),
    assetStack: [...params.assetStack],
    catalogVersion: params.catalogVersion,
    hydratedCatalogVersion: params.hydratedCatalogVersion,
    topology: params.topology,
})
