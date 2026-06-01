import type { ProjectedRoomTopology } from '@tonylb/mtw-gateways/ts/assets/components/componentTopology/result'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'

import { logCatalogHydrate } from '../catalogHydrateInstrumentation'
import { shouldPersistAffordanceTopologyAtHydrate } from './catalogGuards'
import { getAffordanceRow, putAffordanceRow } from './catalogRow'
import type { AffordanceCacheRow } from './baseClasses'
import { createAffordanceCacheRow } from './baseClasses'

const AFFORDANCE_SCOPE = 'affordanceCache' as const
const PIPELINE = 'hydrateAffordanceTopologyRow' as const

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

    if (!shouldPersistAffordanceTopologyAtHydrate(existing, incomingCatalogVersion)) {
        logCatalogHydrate(AFFORDANCE_SCOPE, 'hydrate_row_skip_version_guard', {
            pipeline: PIPELINE,
            roomId,
            perspectiveKey,
            incomingCatalogVersion,
            existingCatalogVersion: existing?.catalogVersion,
            existingHydratedCatalogVersion: existing?.hydratedCatalogVersion,
            exitCount: projected.exits.length,
        })
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

    logCatalogHydrate(AFFORDANCE_SCOPE, 'hydrate_row_wrote', {
        pipeline: PIPELINE,
        roomId,
        perspectiveKey,
        incomingCatalogVersion,
        hydratedCatalogVersion: row.hydratedCatalogVersion,
        exitCount: projected.exits.length,
    })
}
