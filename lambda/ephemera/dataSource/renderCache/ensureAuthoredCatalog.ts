import {
    componentExamplesPerspectiveCacheKey,
    defaultResolveRoomLensMarkDefaults,
} from '@tonylb/mtw-gateways/ts/assets/components/componentExamples'
import { computePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'

import internalCache from '../../internalCache'
import {
    catalogHydrateErrorMessage,
    catalogVersionSnapshot,
    logCatalogHydrate,
    logCatalogHydrateError,
} from '../catalogHydrateInstrumentation'
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

const RENDER_SCOPE = 'renderCache' as const
const PIPELINE = 'ensureAuthoredCatalog' as const

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
): Promise<{ row: EphemeraCacheCatalogRow; created: boolean }> {
    const existing = await getCatalogRow(componentId, perspectiveKey)
    if (existing !== undefined) {
        return { row: existing, created: false }
    }

    try {
        const row = await createCatalogRowForHydrate({
            componentId,
            perspectiveKey,
            assetStack: perspective.assetStack,
        })
        return { row, created: true }
    }
    catch {
        const afterRace = await getCatalogRow(componentId, perspectiveKey)
        if (afterRace === undefined) {
            throw new Error(
                `Failed to create catalog row for ${componentId} at ${perspectiveKey}`
            )
        }
        return { row: afterRace, created: false }
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

    logCatalogHydrate(RENDER_SCOPE, 'stale_path_start', {
        pipeline: PIPELINE,
        componentId,
        perspectiveKey,
        incomingCatalogVersion,
    })

    internalCache.ComponentExamples.invalidate(
        componentExamplesPerspectiveCacheKey(assembleInput)
    )

    const desiredSet = await internalCache.ComponentExamples.get(assembleInput)

    logCatalogHydrate(RENDER_SCOPE, 'stale_path_desired_set_loaded', {
        pipeline: PIPELINE,
        componentId,
        perspectiveKey,
        incomingCatalogVersion,
        desiredSituationCount: desiredSet.size,
    })

    await hydrateAuthoredCatalogDiff({
        componentId,
        perspective,
        perspectiveKey,
        assetStack: perspective.assetStack,
        incomingCatalogVersion,
        desiredSet,
    })

    const markWrote = await markCatalogHydratedAtVersion(
        componentId,
        perspectiveKey,
        incomingCatalogVersion
    )

    const afterMark = await getCatalogRow(componentId, perspectiveKey)
    if (!markWrote) {
        logCatalogHydrateError(RENDER_SCOPE, 'mark_hydrated_catalog_no_write', {
            pipeline: PIPELINE,
            componentId,
            perspectiveKey,
            incomingCatalogVersion,
            ...catalogVersionSnapshot(afterMark),
        })
    }
    else {
        logCatalogHydrate(RENDER_SCOPE, 'mark_hydrated_catalog_ok', {
            pipeline: PIPELINE,
            componentId,
            perspectiveKey,
            incomingCatalogVersion,
            ...catalogVersionSnapshot(afterMark),
        })
    }
}

/**
 * Orchestration preflight (O1/O2): create catalog on first resolve, hydrate when stale.
 */
export async function ensureAuthoredCatalog(
    params: EnsureAuthoredCatalogParams,
    deps: EnsureAuthoredCatalogDependencies = {}
): Promise<void> {
    const { componentId, perspective } = params
    const perspectiveKey = computePerspectiveKey(perspective.assetStack)

    logCatalogHydrate(RENDER_SCOPE, 'start', {
        pipeline: PIPELINE,
        componentId,
        perspectiveKey,
    })

    const { row: catalogRow, created } = await loadOrCreateCatalogRow(componentId, perspectiveKey, perspective)

    logCatalogHydrate(RENDER_SCOPE, 'catalog_row_loaded', {
        pipeline: PIPELINE,
        componentId,
        perspectiveKey,
        created,
        ...catalogVersionSnapshot(catalogRow),
    })

    if (!isCatalogRowStale(catalogRow)) {
        logCatalogHydrate(RENDER_SCOPE, 'skip_ready', {
            pipeline: PIPELINE,
            componentId,
            perspectiveKey,
            ...catalogVersionSnapshot(catalogRow),
        })
        return
    }

    const incomingCatalogVersion = catalogRow.catalogVersion
    const runWithSingleFlight = deps.runWithSingleFlight ?? defaultRunWithSingleFlightAuthoredCatalogHydrate

    logCatalogHydrate(RENDER_SCOPE, 'single_flight_hydrate_start', {
        pipeline: PIPELINE,
        componentId,
        perspectiveKey,
        incomingCatalogVersion,
        singleFlightCategory: EPHEMERA_AUTHORED_CATALOG_HYDRATE_CATEGORY,
        singleFlightKey: authoredCatalogHydrateSingleFlightKey(componentId, perspectiveKey),
    })

    try {
        await runWithSingleFlight({
            category: EPHEMERA_AUTHORED_CATALOG_HYDRATE_CATEGORY,
            argumentHash: authoredCatalogHydrateSingleFlightKey(componentId, perspectiveKey),
            computation: async () => {
                const current = await getCatalogRow(componentId, perspectiveKey)
                if (current === undefined) {
                    logCatalogHydrateError(RENDER_SCOPE, 'computation_skip_row_missing', {
                        pipeline: PIPELINE,
                        componentId,
                        perspectiveKey,
                        ...catalogVersionSnapshot(current),
                    })
                    return
                }
                if (!isCatalogRowStale(current)) {
                    logCatalogHydrate(RENDER_SCOPE, 'computation_skip_already_fresh', {
                        pipeline: PIPELINE,
                        componentId,
                        perspectiveKey,
                        ...catalogVersionSnapshot(current),
                    })
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
                    logCatalogHydrateError(RENDER_SCOPE, 'retrieval_not_ready', {
                        pipeline: PIPELINE,
                        componentId,
                        perspectiveKey,
                        ...catalogVersionSnapshot(current),
                    })
                    throw new Error('AUTHORED_CATALOG_HYDRATE_FOLLOWER_NOT_READY')
                }
                logCatalogHydrate(RENDER_SCOPE, 'retrieval_ok', {
                    pipeline: PIPELINE,
                    componentId,
                    perspectiveKey,
                    ...catalogVersionSnapshot(current),
                })
            },
        })

        const finalRow = await getCatalogRow(componentId, perspectiveKey)
        if (finalRow === undefined || isCatalogRowStale(finalRow)) {
            logCatalogHydrateError(RENDER_SCOPE, 'complete_catalog_not_ready', {
                pipeline: PIPELINE,
                componentId,
                perspectiveKey,
                ...catalogVersionSnapshot(finalRow),
            })
            throw new Error('AUTHORED_CATALOG_ENSURE_INCOMPLETE')
        }
        logCatalogHydrate(RENDER_SCOPE, 'complete', {
            pipeline: PIPELINE,
            componentId,
            perspectiveKey,
            ...catalogVersionSnapshot(finalRow),
        })
    }
    catch (error) {
        const finalRow = await getCatalogRow(componentId, perspectiveKey)
        logCatalogHydrateError(RENDER_SCOPE, 'failed', {
            pipeline: PIPELINE,
            componentId,
            perspectiveKey,
            errorMessage: catalogHydrateErrorMessage(error),
            ...catalogVersionSnapshot(finalRow),
        })
        throw error
    }
}
