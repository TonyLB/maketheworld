/**
 * DataSource-owned Dynamo CRUD for colocated affordance-topology rows (`Affordance::${perspectiveKey}`).
 */
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { emptyProjectedRoomTopology } from '@tonylb/mtw-gateways/ts/assets/components/componentTopology/result'
import {
    buildAffordanceDataCategory,
    createAffordanceCacheRow,
    getAffordanceRowFromDynamo,
    queryAffordanceRowsForRoom as queryAffordanceRowsFromGateway,
    type AffordanceCacheRow,
} from '@tonylb/mtw-gateways/ts/ephemera/affordanceCache'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../internalCache'
import { shouldIncrementCatalogVersionOnInvalidation } from './catalogGuards'

export {
    buildAffordanceDataCategory,
    perspectiveKeyFromAffordanceDataCategory,
} from '@tonylb/mtw-gateways/ts/ephemera/affordanceCache'

export async function queryAffordanceRowsForRoom(
    roomId: EphemeraRoomId
): Promise<AffordanceCacheRow[]> {
    return internalCache.AffordanceCache.queryAffordanceRows(roomId)
}

export async function getAffordanceRow(
    roomId: EphemeraRoomId,
    perspectiveKey: string
): Promise<AffordanceCacheRow | undefined> {
    return internalCache.AffordanceCache.getAffordanceRowIncludingStale(roomId, perspectiveKey)
}

/** Uncached fetch for tests and tooling only. */
export async function getAffordanceRowFromDynamoUncached(
    roomId: EphemeraRoomId,
    perspectiveKey: string
): Promise<AffordanceCacheRow | undefined> {
    return getAffordanceRowFromDynamo(ephemeraDB, roomId, perspectiveKey)
}

/** Uncached query for tests and tooling only. */
export async function queryAffordanceRowsFromDynamo(
    roomId: EphemeraRoomId
): Promise<AffordanceCacheRow[]> {
    return queryAffordanceRowsFromGateway(ephemeraDB, roomId)
}

export async function putAffordanceRow(row: AffordanceCacheRow): Promise<void> {
    await ephemeraDB.putItem(row)
}

export type CreateAffordanceRowForHydrateParams = {
    roomId: EphemeraRoomId;
    perspectiveKey: string;
    assetStack: AssetUUID[];
};

/**
 * Create-on-first-hydrate colocated row. Initial epoch >= 1, not yet hydrated.
 */
export async function createAffordanceRowForHydrate(
    params: CreateAffordanceRowForHydrateParams
): Promise<AffordanceCacheRow> {
    const row = createAffordanceCacheRow({
        roomId: params.roomId,
        perspectiveKey: params.perspectiveKey,
        assetStack: [...params.assetStack],
        catalogVersion: 1,
        hydratedCatalogVersion: 0,
        topology: emptyProjectedRoomTopology(params.roomId),
    })
    await putAffordanceRow(row)
    return row
}

/**
 * M4 invalidation bump: increment catalogVersion only when ready.
 */
export async function conditionalInvalidateAffordanceRow(row: AffordanceCacheRow): Promise<void> {
    const shouldBump = shouldIncrementCatalogVersionOnInvalidation(row)

    await ephemeraDB.optimisticUpdate({
        Key: { EphemeraId: row.EphemeraId, DataCategory: row.DataCategory },
        updateKeys: ['catalogVersion', 'hydratedCatalogVersion'],
        updateReducer: (draft: AffordanceCacheRow) => {
            if (shouldBump) {
                draft.catalogVersion = row.catalogVersion + 1
            }
        },
    })

    internalCache.AffordanceCache.invalidate(row.EphemeraId)
}

/**
 * H6: mark catalog ready at incomingCatalogVersion only if catalogVersion unchanged since hydrate start.
 */
export async function markAffordanceCatalogHydratedAtVersion(
    roomId: EphemeraRoomId,
    perspectiveKey: string,
    incomingCatalogVersion: number
): Promise<boolean> {
    let wrote = false

    await ephemeraDB.optimisticUpdate({
        Key: {
            EphemeraId: roomId,
            DataCategory: buildAffordanceDataCategory(perspectiveKey),
        },
        updateKeys: ['hydratedCatalogVersion', 'catalogVersion'],
        checkKeys: ['catalogVersion'],
        updateReducer: (draft: AffordanceCacheRow) => {
            if (draft.catalogVersion === incomingCatalogVersion) {
                draft.hydratedCatalogVersion = incomingCatalogVersion
            }
        },
        successCallback: () => {
            wrote = true
            internalCache.AffordanceCache.invalidate(roomId)
        },
    })

    return wrote
}
