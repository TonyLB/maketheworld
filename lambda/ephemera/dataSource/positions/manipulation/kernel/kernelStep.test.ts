import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ExecutorParsePlanStep } from '../../../actions/enrich/objectManipulation/synthesize/executorTypes'
import { fromExecutorStep, isKernelMutationStep } from './kernelStep'
import type { KernelStep } from './kernelStep'

const trayId = 'OBJECT#Tray' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const roomId = 'ROOM#Cafe' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('fromExecutorStep', () => {
    it('converts a TransferMembershipStep to a MutationKernelTransferStep with the same object ids as entityIds', () => {
        const step: ExecutorParsePlanStep = {
            kind: 'transferMembership',
            objectIds: new Set([trayId, glassId]),
            fromHostId: roomId,
            toHostId: characterId,
        }
        expect(fromExecutorStep(step)).toEqual({
            kind: 'transferMembership',
            entityIds: new Set([trayId, glassId]),
            fromHostIds: new Set([roomId]),
            toHostId: characterId,
        })
    })

    it('passes an establishRelation step through unchanged', () => {
        const step: ExecutorParsePlanStep = {
            kind: 'establishRelation',
            subjectId: trayId,
            targetId: glassId,
            relationKind: 'On',
        }
        expect(fromExecutorStep(step)).toEqual(step)
    })

    it('passes a dissolveRelation step through unchanged', () => {
        const step: ExecutorParsePlanStep = {
            kind: 'dissolveRelation',
            subjectId: trayId,
            targetId: glassId,
            relationKind: 'On',
        }
        expect(fromExecutorStep(step)).toEqual(step)
    })
})

describe('isKernelMutationStep', () => {
    it('accepts a capture step (PB-J)', () => {
        const step: KernelStep = { kind: 'capture', hostId: roomId, captureId: 'before' }
        expect(isKernelMutationStep(step)).toBe(true)
    })

    it('rejects a describe step', () => {
        const step: KernelStep = { kind: 'describe', referentId: roomId, referentKind: 'room' }
        expect(isKernelMutationStep(step)).toBe(false)
    })

    it('accepts addCrossingPort and removeCrossingPort steps (PV1-3)', () => {
        const addStep: KernelStep = {
            kind: 'addCrossingPort',
            hostId: roomId,
            port: { portId: 'p1', fromHostId: roomId, kind: 'Custom', exteriorRelationLabel: 'to' },
        }
        const removeStep: KernelStep = { kind: 'removeCrossingPort', hostId: roomId, portId: 'p1' }
        expect(isKernelMutationStep(addStep)).toBe(true)
        expect(isKernelMutationStep(removeStep)).toBe(true)
    })
})
