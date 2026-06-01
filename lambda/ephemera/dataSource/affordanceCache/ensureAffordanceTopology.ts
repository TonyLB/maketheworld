import { componentTopologyPerspectiveCacheKey } from '@tonylb/mtw-gateways/ts/assets/components/componentTopology'
import { computePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../../internalCache'
import {
    catalogHydrateErrorMessage,
    catalogVersionSnapshot,
    logCatalogHydrate,
    logCatalogHydrateError,
} from '../catalogHydrateInstrumentation'
import { isCatalogRowStale } from './catalogGuards'
import type { AffordanceCacheRow } from './baseClasses'
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

const AFFORDANCE_SCOPE = 'affordanceCache' as const
const PIPELINE = 'ensureAffordanceTopology' as const

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
): Promise<{ row: AffordanceCacheRow; created: boolean }> {
    const existing = await getAffordanceRow(roomId, perspectiveKey)
    if (existing !== undefined) {
        return { row: existing, created: false }
    }

    try {
        const row = await createAffordanceRowForHydrate({
            roomId,
            perspectiveKey,
            assetStack: perspective.assetStack,
        })
        return { row, created: true }
    }
    catch {
        const afterRace = await getAffordanceRow(roomId, perspectiveKey)
        if (afterRace === undefined) {
            throw new Error(
                `Failed to create affordance row for ${roomId} at ${perspectiveKey}`
            )
        }
        return { row: afterRace, created: false }
    }
}

async function runStaleHydratePath(
    roomId: EphemeraRoomId,
    perspective: Perspective,
    perspectiveKey: string,
    incomingCatalogVersion: number
): Promise<void> {
    const mergeParticipationOrder = perspective.assetStack

    logCatalogHydrate(AFFORDANCE_SCOPE, 'stale_path_start', {
        pipeline: PIPELINE,
        roomId,
        perspectiveKey,
        incomingCatalogVersion,
    })

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

    logCatalogHydrate(AFFORDANCE_SCOPE, 'stale_path_topology_loaded', {
        pipeline: PIPELINE,
        roomId,
        perspectiveKey,
        incomingCatalogVersion,
        exitCount: projected.exits.length,
    })

    await hydrateAffordanceTopologyRow({
        roomId,
        perspective,
        perspectiveKey,
        incomingCatalogVersion,
        projected,
    })

    const markWrote = await markAffordanceCatalogHydratedAtVersion(
        roomId,
        perspectiveKey,
        incomingCatalogVersion
    )

    const afterMark = await getAffordanceRow(roomId, perspectiveKey)
    if (!markWrote) {
        logCatalogHydrateError(AFFORDANCE_SCOPE, 'mark_hydrated_catalog_no_write', {
            pipeline: PIPELINE,
            roomId,
            perspectiveKey,
            incomingCatalogVersion,
            ...catalogVersionSnapshot(afterMark),
        })
    }
    else {
        logCatalogHydrate(AFFORDANCE_SCOPE, 'mark_hydrated_catalog_ok', {
            pipeline: PIPELINE,
            roomId,
            perspectiveKey,
            incomingCatalogVersion,
            ...catalogVersionSnapshot(afterMark),
        })
    }
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

    logCatalogHydrate(AFFORDANCE_SCOPE, 'start', {
        pipeline: PIPELINE,
        roomId,
        perspectiveKey,
    })

    const { row: catalogRow, created } = await loadOrCreateAffordanceRow(roomId, perspectiveKey, perspective)

    logCatalogHydrate(AFFORDANCE_SCOPE, 'catalog_row_loaded', {
        pipeline: PIPELINE,
        roomId,
        perspectiveKey,
        created,
        ...catalogVersionSnapshot(catalogRow),
    })

    if (!isCatalogRowStale(catalogRow)) {
        logCatalogHydrate(AFFORDANCE_SCOPE, 'skip_ready', {
            pipeline: PIPELINE,
            roomId,
            perspectiveKey,
            ...catalogVersionSnapshot(catalogRow),
        })
        return
    }

    const incomingCatalogVersion = catalogRow.catalogVersion
    const runWithSingleFlight = deps.runWithSingleFlight ?? defaultRunWithSingleFlightAffordanceTopologyHydrate

    logCatalogHydrate(AFFORDANCE_SCOPE, 'single_flight_hydrate_start', {
        pipeline: PIPELINE,
        roomId,
        perspectiveKey,
        incomingCatalogVersion,
        singleFlightCategory: EPHEMERA_AFFORDANCE_TOPOLOGY_HYDRATE_CATEGORY,
        singleFlightKey: affordanceTopologyHydrateSingleFlightKey(roomId, perspectiveKey),
    })

    try {
        await runWithSingleFlight({
            category: EPHEMERA_AFFORDANCE_TOPOLOGY_HYDRATE_CATEGORY,
            argumentHash: affordanceTopologyHydrateSingleFlightKey(roomId, perspectiveKey),
            computation: async () => {
                const current = await getAffordanceRow(roomId, perspectiveKey)
                if (current === undefined) {
                    logCatalogHydrateError(AFFORDANCE_SCOPE, 'computation_skip_row_missing', {
                        pipeline: PIPELINE,
                        roomId,
                        perspectiveKey,
                        ...catalogVersionSnapshot(current),
                    })
                    return
                }
                if (!isCatalogRowStale(current)) {
                    logCatalogHydrate(AFFORDANCE_SCOPE, 'computation_skip_already_fresh', {
                        pipeline: PIPELINE,
                        roomId,
                        perspectiveKey,
                        ...catalogVersionSnapshot(current),
                    })
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
                    logCatalogHydrateError(AFFORDANCE_SCOPE, 'retrieval_not_ready', {
                        pipeline: PIPELINE,
                        roomId,
                        perspectiveKey,
                        ...catalogVersionSnapshot(current),
                    })
                    throw new Error('AFFORDANCE_TOPOLOGY_HYDRATE_FOLLOWER_NOT_READY')
                }
                logCatalogHydrate(AFFORDANCE_SCOPE, 'retrieval_ok', {
                    pipeline: PIPELINE,
                    roomId,
                    perspectiveKey,
                    ...catalogVersionSnapshot(current),
                })
            },
        })

        const finalRow = await getAffordanceRow(roomId, perspectiveKey)
        if (finalRow === undefined || isCatalogRowStale(finalRow)) {
            logCatalogHydrateError(AFFORDANCE_SCOPE, 'complete_catalog_not_ready', {
                pipeline: PIPELINE,
                roomId,
                perspectiveKey,
                ...catalogVersionSnapshot(finalRow),
            })
            throw new Error('AFFORDANCE_TOPOLOGY_ENSURE_INCOMPLETE')
        }
        logCatalogHydrate(AFFORDANCE_SCOPE, 'complete', {
            pipeline: PIPELINE,
            roomId,
            perspectiveKey,
            ...catalogVersionSnapshot(finalRow),
        })
    }
    catch (error) {
        const finalRow = await getAffordanceRow(roomId, perspectiveKey)
        logCatalogHydrateError(AFFORDANCE_SCOPE, 'failed', {
            pipeline: PIPELINE,
            roomId,
            perspectiveKey,
            errorMessage: catalogHydrateErrorMessage(error),
            ...catalogVersionSnapshot(finalRow),
        })
        throw error
    }
}
