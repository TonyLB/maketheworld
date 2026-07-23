import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { computeStepSequenceFootprint } from './computeStepSequenceFootprint'
import type { KernelStep } from './kernelStep'

const trayId = 'OBJECT#Tray' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const roomId = 'ROOM#Cafe' as EphemeraRoomId
const otherRoomId = 'ROOM#Kitchen' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('computeStepSequenceFootprint', () => {
    it('a transferMembership step contributes fromHostId and toHostId directly', () => {
        const step: KernelStep = { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostId: roomId, toHostId: characterId }
        expect(computeStepSequenceFootprint([step], () => undefined)).toEqual(new Set([roomId, characterId]))
    })

    it('a relational step derives both endpoints host via getCurrentHost', () => {
        const step: KernelStep = { kind: 'establishRelation', subjectId: trayId, targetId: glassId, relationKind: 'On' }
        const getCurrentHost = (id: EphemeraObjectId) => (id === trayId ? roomId : otherRoomId)
        expect(computeStepSequenceFootprint([step], getCurrentHost)).toEqual(new Set([roomId, otherRoomId]))
    })

    it('unions hosts across a multi-step sequence with no duplicates', () => {
        const steps: KernelStep[] = [
            { kind: 'dissolveRelation', subjectId: trayId, targetId: glassId, relationKind: 'On' },
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostId: roomId, toHostId: characterId },
        ]
        const getCurrentHost = () => roomId
        expect(computeStepSequenceFootprint(steps, getCurrentHost)).toEqual(new Set([roomId, characterId]))
    })

    it('throws when getCurrentHost cannot resolve a relational step endpoint', () => {
        const step: KernelStep = { kind: 'establishRelation', subjectId: trayId, targetId: glassId, relationKind: 'On' }
        expect(() => computeStepSequenceFootprint([step], () => undefined)).toThrow()
    })
})
