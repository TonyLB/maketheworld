import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { isKernelMutationStep } from './kernelStep'
import type { KernelStep } from './kernelStep'
import { parentRemainderKey } from '../../ludicGraph/testFixtures'

const roomId = 'ROOM#Cafe' as EphemeraRoomId

describe('isKernelMutationStep', () => {
    it('accepts a capture step', () => {
        const step: KernelStep = { kind: 'capture', hostId: roomId, captureId: 'before' }
        expect(isKernelMutationStep(step)).toBe(true)
    })

    it('accepts the presence steps, including a per-binding release', () => {
        const release: KernelStep = { kind: 'movePresenceBinding', to: null, hostId: 'OBJECT#Tray' as any, presence: 'PRESENCE#a' as any, from: { host: roomId, presence: parentRemainderKey(roomId) } }
        expect(isKernelMutationStep(release)).toBe(true)
    })

    it('rejects a describe step', () => {
        const step: KernelStep = { kind: 'describe', referentId: roomId, referentKind: 'room' }
        expect(isKernelMutationStep(step)).toBe(false)
    })

    it('accepts addCrossingPort and removeCrossingPort steps', () => {
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
