import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import {
    singleFlightFactory,
    type SingleFlightParams,
} from '@tonylb/mtw-lambda-patterns/ts/singleFlight'

/** Dynamo `SINGLEFLIGHT#${category}` row; keep stable for coordination records. */
export const EPHEMERA_ROOM_RENDER_GENERATION_CATEGORY = 'ephemera-room-render-generation' as const

/** LLM + renderCache follower latency; coalesce leader expiry (default singleFlight 30s is too short). */
export const RENDER_GENERATION_SINGLE_FLIGHT_TIMEOUT_MS = 120000

export type RunWithSingleFlight = <T>(params: SingleFlightParams<T>) => Promise<T>

/**
 * Test / pass-through: run leader `computation` only (no Dynamo, no follower retrieval).
 * Use in unit tests so generation + orchestration hand-off stay testable without coordination.
 */
export const passThroughSingleFlight: RunWithSingleFlight = async <T>(params: SingleFlightParams<T>) => (
    params.computation()
)

const bindEphemeraSingleFlight = (): RunWithSingleFlight => {
    const run = singleFlightFactory<unknown>({
        optimisticUpdateFunction: ephemeraDB.optimisticUpdate.bind(ephemeraDB),
        getItemFunction: ephemeraDB.getItem.bind(ephemeraDB),
        primaryKey: 'EphemeraId',
        timeoutMs: RENDER_GENERATION_SINGLE_FLIGHT_TIMEOUT_MS,
        mode: 'coalesce',
    })
    return run as RunWithSingleFlight
}

/** Production default: coalesce concurrent generation for the same argument hash via ephemeraDB. */
export const defaultRunWithSingleFlight: RunWithSingleFlight = bindEphemeraSingleFlight()
