import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    evaluateComplexityPreGates,
    preGateOutcomeToTerminalError,
} from './complexityPreGates'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const otherRoomId = 'ROOM#Hall' as EphemeraRoomId

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

    it('returns atomic for a sole host --- locus/exit-edge legality is decided during selection now (Slice 4b), not here', () => {
        expect(evaluateComplexityPreGates({
            objectId: broomId,
            containers: [roomId],
        })).toEqual({ type: 'atomic' })
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

    it('returns null for atomic', () => {
        expect(preGateOutcomeToTerminalError({ type: 'atomic' })).toBeNull()
    })
})
