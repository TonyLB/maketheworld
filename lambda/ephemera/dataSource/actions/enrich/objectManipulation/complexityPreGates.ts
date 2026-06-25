import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { complexErrorMessage } from './complexityClasses'
import { objectTouchesExitEdgeOnGraph } from './membershipObservation'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

export type ComplexityPreGateOutcome =
    | { type: 'error'; reason: 'noMembershipHost' }
    | { type: 'complex'; complexityClass: 'multiPresent' }
    | { type: 'atomic'; operationKind: 'takeHold' }
    | { type: 'deferToComplexityLlm' }

export function evaluateComplexityPreGates(input: {
    objectId: EphemeraObjectId
    containers: readonly EphemeraMembershipHostId[]
    positionGraph?: PlayPositionGraph
}): ComplexityPreGateOutcome {
    if (input.containers.length === 0) {
        return { type: 'error', reason: 'noMembershipHost' }
    }
    if (input.containers.length > 1) {
        return { type: 'complex', complexityClass: 'multiPresent' }
    }
    if (
        input.positionGraph !== undefined
        && objectTouchesExitEdgeOnGraph(input.positionGraph, input.objectId)
    ) {
        return { type: 'deferToComplexityLlm' }
    }
    return { type: 'atomic', operationKind: 'takeHold' }
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
