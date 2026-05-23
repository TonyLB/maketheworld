import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import {
    singleFlightFactory,
    type SingleFlightParams,
} from '@tonylb/mtw-lambda-patterns/ts/singleFlight'

/** Dynamo `SINGLEFLIGHT#${category}` row; keep stable for coordination records. */
export const EPHEMERA_AUTHORED_CATALOG_HYDRATE_CATEGORY = 'ephemera-authored-catalog-hydrate' as const

/** Assets read + Dynamo diff; shorter than generation singleFlight. */
export const AUTHORED_CATALOG_HYDRATE_SINGLE_FLIGHT_TIMEOUT_MS = 60000

export type RunWithSingleFlightAuthoredCatalogHydrate = <T>(params: SingleFlightParams<T>) => Promise<T>

/**
 * Test / pass-through: run leader `computation` only (no Dynamo coordination).
 */
export const passThroughSingleFlightAuthoredCatalogHydrate: RunWithSingleFlightAuthoredCatalogHydrate = async <T>(
    params: SingleFlightParams<T>
) => params.computation()

const bindEphemeraAuthoredCatalogHydrateSingleFlight = (): RunWithSingleFlightAuthoredCatalogHydrate => {
    const run = singleFlightFactory<unknown>({
        optimisticUpdateFunction: ephemeraDB.optimisticUpdate.bind(ephemeraDB),
        getItemFunction: ephemeraDB.getItem.bind(ephemeraDB),
        primaryKey: 'EphemeraId',
        timeoutMs: AUTHORED_CATALOG_HYDRATE_SINGLE_FLIGHT_TIMEOUT_MS,
        mode: 'coalesce',
    })
    return run as RunWithSingleFlightAuthoredCatalogHydrate
}

/** Production default: coalesce concurrent hydrate for the same component + perspective. */
export const defaultRunWithSingleFlightAuthoredCatalogHydrate: RunWithSingleFlightAuthoredCatalogHydrate =
    bindEphemeraAuthoredCatalogHydrateSingleFlight()

export function authoredCatalogHydrateSingleFlightKey(
    componentId: string,
    perspectiveKey: string
): string {
    return `${componentId}::${perspectiveKey}`
}
