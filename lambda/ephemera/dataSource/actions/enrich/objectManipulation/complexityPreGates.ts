import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { complexErrorMessage } from './complexityClasses'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

/**
 * Narrowed (Slice 5, 2026-07-14): only checks what the sandbox-mediated
 * membership selector (Slice 4b) doesn't --- `containers.length` is a
 * KR-state property orthogonal to any single candidate's locus, so it can't
 * be decided during selection at all. The locus/exit-edge legality this
 * function used to re-derive post-selection is now decided correctly,
 * earlier, by `selectIdentityPlanTuple`'s own sandbox-mediated dry run
 * (real graph access, no longer an empty context) --- re-checking it here
 * was the same `objectTouchesExitEdgeOnGraph` check running twice.
 */
export type ComplexityPreGateOutcome =
    | { type: 'error'; reason: 'noMembershipHost' }
    | { type: 'complex'; complexityClass: 'multiPresent' }
    | { type: 'atomic' }

export function evaluateComplexityPreGates(input: {
    objectId: EphemeraObjectId
    containers: readonly EphemeraMembershipHostId[]
}): ComplexityPreGateOutcome {
    if (input.containers.length === 0) {
        return { type: 'error', reason: 'noMembershipHost' }
    }
    if (input.containers.length > 1) {
        return { type: 'complex', complexityClass: 'multiPresent' }
    }
    return { type: 'atomic' }
}

export function preGateOutcomeToTerminalError(outcome: ComplexityPreGateOutcome): string | null {
    if (outcome.type === 'error') {
        return objectManipulationErrorMessages.noMembershipHost
    }
    if (outcome.type === 'complex') {
        return complexErrorMessage(outcome.complexityClass)
    }
    return null
}
