import type { ProjectedRoomTopology } from '@tonylb/mtw-gateways/ts/assets/components/componentTopology/result'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'

import internalCache from '../../internalCache'
import { canUpsertAffordanceRowAtHydrate } from './catalogGuards'
import { getAffordanceRow, putAffordanceRow } from './catalogRow'
import type { AffordanceCacheRow } from './baseClasses'
import { createAffordanceCacheRow } from './baseClasses'

export type HydrateAffordanceTopologyParams = {
    roomId: EphemeraRoomId;
    perspective: Perspective;
    perspectiveKey: string;
    incomingCatalogVersion: number;
    projected: ProjectedRoomTopology;
};

/**
 * Version-guarded persist of projected topology on the colocated Affordance:: row.
 */
export async function hydrateAffordanceTopologyRow(
    params: HydrateAffordanceTopologyParams
): Promise<void> {
    const { roomId, perspective, perspectiveKey, incomingCatalogVersion, projected } = params
    const existing = await getAffordanceRow(roomId, perspectiveKey)

    if (
        existing !== undefined
        && !canUpsertAffordanceRowAtHydrate(existing.catalogVersion, incomingCatalogVersion)
    ) {
        return
    }

    const assetStack = (existing?.assetStack ?? perspective.assetStack) as AssetUUID[]
    const row: AffordanceCacheRow = createAffordanceCacheRow({
        roomId,
        perspectiveKey,
        assetStack: [...assetStack],
        catalogVersion: incomingCatalogVersion,
        hydratedCatalogVersion: existing?.hydratedCatalogVersion ?? 0,
        topology: projected,
    })

    await putAffordanceRow(row)
    internalCache.AffordanceCache.set({ row })
}
