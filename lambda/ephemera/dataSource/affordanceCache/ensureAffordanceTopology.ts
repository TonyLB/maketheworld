import { componentTopologyPerspectiveCacheKey } from '@tonylb/mtw-gateways/ts/assets/components/componentTopology'
import { computePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../../internalCache'
import { isCatalogRowStale } from './catalogGuards'
import {
    createAffordanceRowForHydrate,
    getAffordanceRow,
    markAffordanceCatalogHydratedAtVersion,
} from './catalogRow'
import { hydrateAffordanceTopologyRow } from './hydrateAffordanceTopology'
import {
    affordanceTopologyHydrateSingleFlightKey,
    defaultRunWithSingleFlightAffordanceTopologyHydrate,
    EPHEMERA_AFFORDANCE_TOPOLOGY_HYDRATE_CATEGORY,
    type RunWithSingleFlightAffordanceTopologyHydrate,
} from './singleFlightAffordanceTopologyHydrate'

export type EnsureAffordanceTopologyParams = {
    roomId: EphemeraRoomId;
    perspective: Perspective;
};

export type EnsureAffordanceTopologyDependencies = {
    runWithSingleFlight?: RunWithSingleFlightAffordanceTopologyHydrate;
};

async function loadOrCreateAffordanceRow(
    roomId: EphemeraRoomId,
    perspectiveKey: string,
    perspective: Perspective
) {
    const existing = await getAffordanceRow(roomId, perspectiveKey)
    if (existing !== undefined) {
        return existing
    }

    try {
        return await createAffordanceRowForHydrate({
            roomId,
            perspectiveKey,
            assetStack: perspective.assetStack,
        })
    }
    catch {
        const afterRace = await getAffordanceRow(roomId, perspectiveKey)
        if (afterRace === undefined) {
            throw new Error(
                `Failed to create affordance row for ${roomId} at ${perspectiveKey}`
            )
        }
        return afterRace
    }
}

async function runStaleHydratePath(
    roomId: EphemeraRoomId,
    perspective: Perspective,
    perspectiveKey: string,
    incomingCatalogVersion: number
): Promise<void> {
    const mergeParticipationOrder = perspective.assetStack

    internalCache.ComponentTopology.invalidate(
        componentTopologyPerspectiveCacheKey({
            roomUniversalKey: roomId,
            mergeParticipationOrder,
        })
    )

    const projected = await internalCache.ComponentTopology.get({
        roomUniversalKey: roomId,
        mergeParticipationOrder,
    })

    await hydrateAffordanceTopologyRow({
        roomId,
        perspective,
        perspectiveKey,
        incomingCatalogVersion,
        projected,
    })

    await markAffordanceCatalogHydratedAtVersion(roomId, perspectiveKey, incomingCatalogVersion)
}

/**
 * Orchestration / nav preflight (D32): create row on first resolve, hydrate when stale.
 */
export async function ensureAffordanceTopology(
    params: EnsureAffordanceTopologyParams,
    deps: EnsureAffordanceTopologyDependencies = {}
): Promise<void> {
    const { roomId, perspective } = params
    const perspectiveKey = computePerspectiveKey(perspective.assetStack)
    const catalogRow = await loadOrCreateAffordanceRow(roomId, perspectiveKey, perspective)

    if (!isCatalogRowStale(catalogRow)) {
        return
    }

    const incomingCatalogVersion = catalogRow.catalogVersion
    const runWithSingleFlight = deps.runWithSingleFlight ?? defaultRunWithSingleFlightAffordanceTopologyHydrate

    await runWithSingleFlight({
        category: EPHEMERA_AFFORDANCE_TOPOLOGY_HYDRATE_CATEGORY,
        argumentHash: affordanceTopologyHydrateSingleFlightKey(roomId, perspectiveKey),
        computation: async () => {
            const current = await getAffordanceRow(roomId, perspectiveKey)
            if (current === undefined || !isCatalogRowStale(current)) {
                return
            }
            await runStaleHydratePath(
                roomId,
                perspective,
                perspectiveKey,
                current.catalogVersion
            )
        },
        retrieval: async () => {
            const current = await getAffordanceRow(roomId, perspectiveKey)
            if (current === undefined || isCatalogRowStale(current)) {
                throw new Error('AFFORDANCE_TOPOLOGY_HYDRATE_FOLLOWER_NOT_READY')
            }
        },
    })
}
