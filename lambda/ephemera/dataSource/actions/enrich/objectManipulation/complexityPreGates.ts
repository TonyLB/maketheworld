import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { complexErrorMessage } from './complexityClasses'
import { objectTouchesExitEdgeOnGraph } from './membershipObservation'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

export type ComplexityPreGateOutcome =
    | { type: 'error'; reason: 'noMembershipHost' }
    | { type: 'complex'; complexityClass: 'multiPresent' }
    | { type: 'atomic'; operationKind: 'takeHold' | 'drop' }
    | { type: 'deferToComplexityLlm' }

export function evaluateComplexityPreGates(input: {
    objectId: EphemeraObjectId
    containers: readonly EphemeraMembershipHostId[]
    positionGraph?: PlayPositionGraph
    actorCharacterId?: EphemeraCharacterId
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
    const soleHost = input.containers[0]
    if (isEphemeraRoomId(soleHost)) {
        return { type: 'atomic', operationKind: 'takeHold' }
    }
    if (
        input.actorCharacterId !== undefined
        && isEphemeraCharacterId(soleHost)
        && soleHost === input.actorCharacterId
    ) {
        return { type: 'atomic', operationKind: 'drop' }
    }
    return { type: 'deferToComplexityLlm' }
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
