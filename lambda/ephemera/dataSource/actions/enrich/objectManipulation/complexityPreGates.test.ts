import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardExitEdgeData } from '@tonylb/mtw-wml/ts/standardize/keys/edges/dataTypes/exitEdge'

import {
    evaluateComplexityPreGates,
    preGateOutcomeToTerminalError,
} from './complexityPreGates'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const otherRoomId = 'ROOM#Hall' as EphemeraRoomId
const tableId = 'OBJECT#Table' as EphemeraObjectId

describe('evaluateComplexityPreGates', () => {
    it('returns error when object has no membership hosts', () => {
        expect(evaluateComplexityPreGates({
            objectId: broomId,
            containers: [],
        })).toEqual({ type: 'error', reason: 'noMembershipHost' })
    })

    it('returns multiPresent complex when object has multiple hosts', () => {
        expect(evaluateComplexityPreGates({
            objectId: broomId,
            containers: [roomId, otherRoomId],
        })).toEqual({ type: 'complex', complexityClass: 'multiPresent' })
    })

    it('returns atomic takeHold for sole host with no touching edges', () => {
        expect(evaluateComplexityPreGates({
            objectId: broomId,
            containers: [roomId],
            positionGraph: { nodes: [{ tag: 'Object', universalKey: broomId }], edges: [] },
        })).toEqual({ type: 'atomic', operationKind: 'takeHold' })
    })

    it('defers to complexity LLM when exit edges touch the object', () => {
        const edge: StandardExitEdgeData = {
            tag: 'Exit',
            uuid: 'edge-1',
            from: broomId,
            to: tableId,
            payload: {},
        }

        expect(evaluateComplexityPreGates({
            objectId: broomId,
            containers: [roomId],
            positionGraph: { edges: [edge] },
        })).toEqual({ type: 'deferToComplexityLlm' })
    })
})

describe('preGateOutcomeToTerminalError', () => {
    it('maps noMembershipHost to terminal error copy', () => {
        expect(preGateOutcomeToTerminalError({ type: 'error', reason: 'noMembershipHost' }))
            .toBe(objectManipulationErrorMessages.noMembershipHost)
    })

    it('maps multiPresent to terminal error copy', () => {
        expect(preGateOutcomeToTerminalError({ type: 'complex', complexityClass: 'multiPresent' }))
            .toBe(objectManipulationErrorMessages.complexMultiPresent)
    })

    it('returns null for atomic and defer outcomes', () => {
        expect(preGateOutcomeToTerminalError({ type: 'atomic', operationKind: 'takeHold' })).toBeNull()
        expect(preGateOutcomeToTerminalError({ type: 'deferToComplexityLlm' })).toBeNull()
    })
})
