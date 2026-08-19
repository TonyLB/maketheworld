import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { computeStepSequenceFootprint } from './computeStepSequenceFootprint'
import type { MutationKernelStep } from './kernelStep'

const trayId = 'OBJECT#Tray' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const roomId = 'ROOM#Cafe' as EphemeraRoomId
const otherRoomId = 'ROOM#Kitchen' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('computeStepSequenceFootprint', () => {
    it('a transferMembership step contributes every fromHostIds member and toHostId directly', () => {
        const step: MutationKernelStep = { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: characterId }
        expect(computeStepSequenceFootprint([step], () => undefined)).toEqual(new Set([roomId, characterId]))
    })

    it('a pure-remove transferMembership step (toHostId null) contributes only its fromHostIds', () => {
        const step: MutationKernelStep = {
            kind: 'transferMembership',
            entityIds: new Set([trayId]),
            fromHostIds: new Set([roomId, otherRoomId]),
            toHostId: null,
        }
        expect(computeStepSequenceFootprint([step], () => undefined)).toEqual(new Set([roomId, otherRoomId]))
    })

    it('a pure-add transferMembership step (fromHostIds empty) contributes only toHostId', () => {
        const step: MutationKernelStep = { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set(), toHostId: roomId }
        expect(computeStepSequenceFootprint([step], () => undefined)).toEqual(new Set([roomId]))
    })

    it('a relational step derives both endpoints host via getCurrentHost', () => {
        const step: MutationKernelStep = { kind: 'establishRelation', subjectId: trayId, targetId: glassId, relationKind: 'On' }
        const getCurrentHost = (id: EphemeraLudicTerminalPrimitive) => (id === trayId ? roomId : otherRoomId)
        expect(computeStepSequenceFootprint([step], getCurrentHost)).toEqual(new Set([roomId, otherRoomId]))
    })

    it('unions hosts across a multi-step sequence with no duplicates', () => {
        const steps: MutationKernelStep[] = [
            { kind: 'dissolveRelation', subjectId: trayId, targetId: glassId, relationKind: 'On' },
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: characterId },
        ]
        const getCurrentHost = () => roomId
        expect(computeStepSequenceFootprint(steps, getCurrentHost)).toEqual(new Set([roomId, characterId]))
    })

    it('LP4g: a relational step with a non-Object (Character) subject derives its host via getCurrentHost, no narrow needed', () => {
        const step: MutationKernelStep = { kind: 'establishRelation', subjectId: characterId, targetId: trayId, relationKind: 'On' }
        const getCurrentHost = (id: EphemeraLudicTerminalPrimitive) => (id === characterId ? roomId : otherRoomId)
        expect(computeStepSequenceFootprint([step], getCurrentHost)).toEqual(new Set([roomId, otherRoomId]))
    })

    it('throws when getCurrentHost cannot resolve a relational step endpoint', () => {
        const step: MutationKernelStep = { kind: 'establishRelation', subjectId: trayId, targetId: glassId, relationKind: 'On' }
        expect(() => computeStepSequenceFootprint([step], () => undefined)).toThrow()
    })

    it('a capture step contributes its hostId even when no mutation step in the sequence touches that host (PB-J)', () => {
        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: characterId },
            { kind: 'capture', hostId: otherRoomId, captureId: 'onlooker' },
        ]
        expect(computeStepSequenceFootprint(steps, () => undefined)).toEqual(new Set([roomId, characterId, otherRoomId]))
    })
})
