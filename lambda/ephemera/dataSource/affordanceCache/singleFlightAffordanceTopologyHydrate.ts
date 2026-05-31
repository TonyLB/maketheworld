import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import {
    singleFlightFactory,
    type SingleFlightParams,
} from '@tonylb/mtw-lambda-patterns/ts/singleFlight'

/** Dynamo `SINGLEFLIGHT#${category}` row; keep stable for coordination records. */
export const EPHEMERA_AFFORDANCE_TOPOLOGY_HYDRATE_CATEGORY = 'ephemera-affordance-topology-hydrate' as const

export const AFFORDANCE_TOPOLOGY_HYDRATE_SINGLE_FLIGHT_TIMEOUT_MS = 60000

export type RunWithSingleFlightAffordanceTopologyHydrate = <T>(params: SingleFlightParams<T>) => Promise<T>

export const passThroughSingleFlightAffordanceTopologyHydrate: RunWithSingleFlightAffordanceTopologyHydrate = async <T>(
    params: SingleFlightParams<T>
) => params.computation()

const bindEphemeraAffordanceTopologyHydrateSingleFlight = (): RunWithSingleFlightAffordanceTopologyHydrate => {
    const run = singleFlightFactory<unknown>({
        optimisticUpdateFunction: ephemeraDB.optimisticUpdate.bind(ephemeraDB),
        getItemFunction: ephemeraDB.getItem.bind(ephemeraDB),
        primaryKey: 'EphemeraId',
        timeoutMs: AFFORDANCE_TOPOLOGY_HYDRATE_SINGLE_FLIGHT_TIMEOUT_MS,
        mode: 'coalesce',
    })
    return run as RunWithSingleFlightAffordanceTopologyHydrate
}

export const defaultRunWithSingleFlightAffordanceTopologyHydrate: RunWithSingleFlightAffordanceTopologyHydrate =
    bindEphemeraAffordanceTopologyHydrateSingleFlight()

export function affordanceTopologyHydrateSingleFlightKey(
    roomId: string,
    perspectiveKey: string
): string {
    return `${roomId}::${perspectiveKey}`
}
