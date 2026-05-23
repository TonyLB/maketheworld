import {
    componentExamplesPerspectiveCacheKey,
    defaultResolveRoomLensMarkDefaults,
} from '@tonylb/mtw-gateways/ts/assets/components/componentExamples'
import { computePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'

import internalCache from '../../internalCache'
import type { EphemeraCacheCatalogRow, EphemeraCacheComponentId } from './baseClasses'
import { isCatalogRowStale } from './catalogGuards'
import {
    createCatalogRowForHydrate,
    getCatalogRow,
    markCatalogHydratedAtVersion,
} from './catalogRow'
import { hydrateAuthoredCatalogDiff } from './hydrateAuthoredCatalogDiff'
import {
    authoredCatalogHydrateSingleFlightKey,
    defaultRunWithSingleFlightAuthoredCatalogHydrate,
    EPHEMERA_AUTHORED_CATALOG_HYDRATE_CATEGORY,
    type RunWithSingleFlightAuthoredCatalogHydrate,
} from './singleFlightAuthoredCatalogHydrate'

export type EnsureAuthoredCatalogParams = {
    componentId: EphemeraCacheComponentId;
    perspective: Perspective;
};

export type EnsureAuthoredCatalogDependencies = {
    runWithSingleFlight?: RunWithSingleFlightAuthoredCatalogHydrate;
};

async function loadOrCreateCatalogRow(
    componentId: EphemeraCacheComponentId,
    perspectiveKey: string,
    perspective: Perspective
): Promise<EphemeraCacheCatalogRow> {
    const existing = await getCatalogRow(componentId, perspectiveKey)
    if (existing !== undefined) {
        return existing
    }

    try {
        return await createCatalogRowForHydrate({
            componentId,
            perspectiveKey,
            assetStack: perspective.assetStack,
        })
    }
    catch {
        const afterRace = await getCatalogRow(componentId, perspectiveKey)
        if (afterRace === undefined) {
            throw new Error(
                `Failed to create catalog row for ${componentId} at ${perspectiveKey}`
            )
        }
        return afterRace
    }
}

async function runStaleHydratePath(
    componentId: EphemeraCacheComponentId,
    perspective: Perspective,
    perspectiveKey: string,
    incomingCatalogVersion: number
): Promise<void> {
    const assembleInput = {
        hostUniversalKey: componentId,
        mergeParticipationOrder: perspective.assetStack,
        options: {
            resolveRoomLensMarkDefaults: defaultResolveRoomLensMarkDefaults(componentId),
        },
    }

    internalCache.ComponentExamples.invalidate(
        componentExamplesPerspectiveCacheKey(assembleInput)
    )

    const desiredSet = await internalCache.ComponentExamples.get(assembleInput)

    await hydrateAuthoredCatalogDiff({
        componentId,
        perspective,
        perspectiveKey,
        assetStack: perspective.assetStack,
        incomingCatalogVersion,
        desiredSet,
    })

    await markCatalogHydratedAtVersion(componentId, perspectiveKey, incomingCatalogVersion)
}

/**
 * Orchestration preflight (O1/O2): create catalog on first resolve, hydrate when stale, silent side effect.
 */
export async function ensureAuthoredCatalog(
    params: EnsureAuthoredCatalogParams,
    deps: EnsureAuthoredCatalogDependencies = {}
): Promise<void> {
    const { componentId, perspective } = params
    const perspectiveKey = computePerspectiveKey(perspective.assetStack)
    const catalogRow = await loadOrCreateCatalogRow(componentId, perspectiveKey, perspective)

    if (!isCatalogRowStale(catalogRow)) {
        return
    }

    const incomingCatalogVersion = catalogRow.catalogVersion
    const runWithSingleFlight = deps.runWithSingleFlight ?? defaultRunWithSingleFlightAuthoredCatalogHydrate

    await runWithSingleFlight({
        category: EPHEMERA_AUTHORED_CATALOG_HYDRATE_CATEGORY,
        argumentHash: authoredCatalogHydrateSingleFlightKey(componentId, perspectiveKey),
        computation: async () => {
            const current = await getCatalogRow(componentId, perspectiveKey)
            if (current === undefined || !isCatalogRowStale(current)) {
                return
            }
            await runStaleHydratePath(
                componentId,
                perspective,
                perspectiveKey,
                current.catalogVersion
            )
        },
        retrieval: async () => {
            const current = await getCatalogRow(componentId, perspectiveKey)
            if (current === undefined || isCatalogRowStale(current)) {
                throw new Error('AUTHORED_CATALOG_HYDRATE_FOLLOWER_NOT_READY')
            }
        },
    })
}
