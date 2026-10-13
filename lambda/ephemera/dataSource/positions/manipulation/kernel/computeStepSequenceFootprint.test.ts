import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { computeStepSequenceFootprint } from './computeStepSequenceFootprint'
import type { MutationKernelStep } from './kernelStep'

const trayId = 'OBJECT#Tray' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const roomId = 'ROOM#Cafe' as EphemeraRoomId
const otherRoomId = 'ROOM#Kitchen' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('computeStepSequenceFootprint', () => {
    it('a relational step derives both endpoints host via getCurrentHost', () => {
        const step: MutationKernelStep = { kind: 'establishRelation', subjectId: trayId, targetId: glassId, hostId: roomId, relationKind: 'On' }
        const getCurrentHost = (id: EphemeraLudicTerminalPrimitive) => (id === trayId ? roomId : otherRoomId)
        expect(computeStepSequenceFootprint([step], getCurrentHost)).toEqual(new Set([roomId, otherRoomId]))
    })

    it('unions hosts across a multi-step sequence with no duplicates', () => {
        const steps: MutationKernelStep[] = [
            { kind: 'dissolveRelation', subjectId: trayId, targetId: glassId, hostId: roomId, relationKind: 'On' },
            { kind: 'movePresenceBinding', hostId: trayId, presence: 'PRESENCE#t' as any, from: { host: roomId }, to: { host: characterId, presence: 'PRESENCE#c' as any } },
        ]
        const getCurrentHost = () => roomId
        expect(computeStepSequenceFootprint(steps, getCurrentHost)).toEqual(new Set([roomId, characterId, trayId]))
    })

    it('a relational step with a non-Object (Character) subject derives its host via getCurrentHost, no narrow needed', () => {
        const step: MutationKernelStep = { kind: 'establishRelation', subjectId: characterId, targetId: trayId, hostId: roomId, relationKind: 'On' }
        const getCurrentHost = (id: EphemeraLudicTerminalPrimitive) => (id === characterId ? roomId : otherRoomId)
        expect(computeStepSequenceFootprint([step], getCurrentHost)).toEqual(new Set([roomId, otherRoomId]))
    })

    it('throws when getCurrentHost cannot resolve a relational step endpoint', () => {
        const step: MutationKernelStep = { kind: 'establishRelation', subjectId: trayId, targetId: glassId, hostId: roomId, relationKind: 'On' }
        expect(() => computeStepSequenceFootprint([step], () => undefined)).toThrow()
    })

    it('addCrossingPort/removeCrossingPort steps contribute their hostId directly', () => {
        const steps: MutationKernelStep[] = [
            { kind: 'addCrossingPort', hostId: roomId, port: { portId: 'p1', fromHostId: otherRoomId, kind: 'Custom', exteriorRelationLabel: 'to' } },
            { kind: 'removeCrossingPort', hostId: otherRoomId, portId: 'p2' },
        ]
        expect(computeStepSequenceFootprint(steps, () => undefined)).toEqual(new Set([roomId, otherRoomId]))
    })

    it('a destroyComponent step contributes its hostId even with no move naming it (the orphan case)', () => {
        const footprint = computeStepSequenceFootprint([{ kind: 'destroyComponent', hostId: 'OBJECT#Tray' as EphemeraObjectId }], () => undefined)
        expect([...footprint]).toEqual(['OBJECT#Tray'])
    })

    it('presence binding add/repair steps contribute their hostId and the host their pointer names', () => {
        const steps: MutationKernelStep[] = [
            { kind: 'addPresenceBinding', hostId: trayId, fromHostPresence: { host: roomId }, presenceUuid: 'p1' },
            { kind: 'repairPresenceBinding', hostId: otherRoomId, presenceId: 'PRESENCE#p2', cover: { members: [] } },
        ]
        expect(computeStepSequenceFootprint(steps, () => undefined)).toEqual(new Set([trayId, roomId, otherRoomId]))
    })

    it('a pointer-less add contributes only its hostId', () => {
        const steps: MutationKernelStep[] = [{ kind: 'addPresenceBinding', hostId: roomId, presenceUuid: 'root' }]
        expect(computeStepSequenceFootprint(steps, () => undefined)).toEqual(new Set([roomId]))
    })

    it('a move step contributes its hostId, its destination (read to confirm the binding) and the host it leaves', () => {
        const move: MutationKernelStep = { kind: 'movePresenceBinding', hostId: glassId, presence: 'PRESENCE#p3' as any, from: { host: otherRoomId }, to: { host: roomId, presence: 'PRESENCE#r' as any } }
        expect(computeStepSequenceFootprint([move], () => undefined)).toEqual(new Set([glassId, roomId, otherRoomId]))
    })

    it('a first-placement move (from null) contributes its hostId and destination', () => {
        const move: MutationKernelStep = { kind: 'movePresenceBinding', hostId: glassId, presence: 'PRESENCE#p3' as any, from: null, to: { host: roomId, presence: 'PRESENCE#r' as any } }
        expect(computeStepSequenceFootprint([move], () => undefined)).toEqual(new Set([glassId, roomId]))
    })

    it('a release contributes its hostId and the host it leaves; a join contributes its hostId alone', () => {
        const steps: MutationKernelStep[] = [
            { kind: 'releasePresenceBinding', hostId: trayId, presence: 'PRESENCE#t' as any, from: { host: otherRoomId } },
            { kind: 'joinPresenceBindings', hostId: roomId, survivor: 'PRESENCE#a' as any, absorbed: 'PRESENCE#b' as any },
        ]
        expect(computeStepSequenceFootprint(steps, () => undefined)).toEqual(new Set([trayId, otherRoomId, roomId]))
    })

    it('a split contributes its hostId and the child of every entry that moves to a new binding, not the original binding\'s children', () => {
        const split: MutationKernelStep = {
            kind: 'splitPresenceBinding',
            hostId: tableId,
            presence: 'PRESENCE#a' as any,
            splitInto: [
                { presence: 'PRESENCE#a' as any, cover: { members: [{ host: glassId, presence: 'PRESENCE#g' as any }, { tag: 'Remainder' }] } },
                { presence: 'PRESENCE#b' as any, cover: { members: [{ host: trayId, presence: 'PRESENCE#t' as any }] } },
            ],
        }
        expect(computeStepSequenceFootprint([split], () => undefined)).toEqual(new Set([tableId, trayId]))
    })

    it('a leg with a port-address endpoint resolves its host from the primitive endpoint alone, not both', () => {
        const step: MutationKernelStep = {
            kind: 'establishRelation',
            subjectId: trayId,
            targetId: { owner: glassId, port: 'crossing-1' },
            hostId: roomId,
            relationKind: 'Custom',
            relationLabel: 'to',
        }
        const getCurrentHost = (id: EphemeraLudicTerminalPrimitive) => (id === trayId ? roomId : undefined)
        expect(computeStepSequenceFootprint([step], getCurrentHost)).toEqual(new Set([roomId]))
    })

    // A two-sided crossing's middle leg: both ends are ports, so no endpoint names a host to
    // resolve, but the leg itself is stored on (and written to) its own host.
    it('a leg with two port-address endpoints (no primitive anchor) locks its own host', () => {
        const step: MutationKernelStep = {
            kind: 'dissolveRelation',
            subjectId: { owner: trayId, port: 'crossing-1' },
            targetId: { owner: glassId, port: 'crossing-2' },
            hostId: roomId,
            relationKind: 'Custom',
            relationLabel: 'to',
        }
        expect(computeStepSequenceFootprint([step], () => undefined)).toEqual(new Set([roomId]))
    })

    it('a capture step contributes its hostId even when no mutation step in the sequence touches that host', () => {
        const steps: MutationKernelStep[] = [
            { kind: 'releasePresenceBinding', hostId: trayId, presence: 'PRESENCE#t' as any, from: { host: roomId } },
            { kind: 'capture', hostId: otherRoomId, captureId: 'onlooker' },
        ]
        expect(computeStepSequenceFootprint(steps, () => undefined)).toEqual(new Set([trayId, roomId, otherRoomId]))
    })
})
