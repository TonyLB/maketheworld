import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { computeStepSequenceFootprint } from './computeStepSequenceFootprint'
import type { MutationKernelStep } from './kernelStep'
import { parentRemainderKey } from '../../ludicGraph/testFixtures'

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
            { kind: 'movePresenceBinding', hostId: trayId, presence: 'PRESENCE#t' as any, from: { host: roomId, presence: parentRemainderKey(roomId) }, to: { host: characterId, presence: 'PRESENCE#c' as any } },
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
            { kind: 'addPresenceBinding', hostId: trayId, fromHostPresence: { host: roomId, presence: parentRemainderKey(roomId) }, presenceUuid: 'p1' },
            { kind: 'repairPresenceBinding', hostId: otherRoomId, presenceId: 'PRESENCE#p2', cover: { members: [] } },
        ]
        expect(computeStepSequenceFootprint(steps, () => undefined)).toEqual(new Set([trayId, roomId, otherRoomId]))
    })

    it('a pointer-less add contributes only its hostId', () => {
        const steps: MutationKernelStep[] = [{ kind: 'addPresenceBinding', hostId: roomId, presenceUuid: 'root' }]
        expect(computeStepSequenceFootprint(steps, () => undefined)).toEqual(new Set([roomId]))
    })

    it('a move step contributes its hostId, its destination (read to confirm the binding) and the host it leaves', () => {
        const move: MutationKernelStep = { kind: 'movePresenceBinding', hostId: glassId, presence: 'PRESENCE#p3' as any, from: { host: otherRoomId, presence: parentRemainderKey(otherRoomId) }, to: { host: roomId, presence: 'PRESENCE#r' as any } }
        expect(computeStepSequenceFootprint([move], () => undefined)).toEqual(new Set([glassId, roomId, otherRoomId]))
    })

    it('a first-placement move (from null) contributes its hostId and destination', () => {
        const move: MutationKernelStep = { kind: 'movePresenceBinding', hostId: glassId, presence: 'PRESENCE#p3' as any, from: null, to: { host: roomId, presence: 'PRESENCE#r' as any } }
        expect(computeStepSequenceFootprint([move], () => undefined)).toEqual(new Set([glassId, roomId]))
    })

    it('a departure (to no parent) contributes its hostId, the host it leaves and the children of its cover', () => {
        const steps: MutationKernelStep[] = [
            { kind: 'movePresenceBinding', to: null, hostId: trayId, presence: 'PRESENCE#t' as any, from: { host: otherRoomId, presence: parentRemainderKey(otherRoomId) }, cover: { members: [{ host: glassId, presence: 'PRESENCE#g' as any }, { tag: 'Remainder' }] } },
        ]
        expect(computeStepSequenceFootprint(steps, () => undefined)).toEqual(new Set([trayId, otherRoomId, glassId]))
    })

    it('a subCover move contributes the children of the part that moves, not the rest of the cover, and any cascade hosts', () => {
        const part: MutationKernelStep = {
            kind: 'movePresenceBinding',
            hostId: tableId,
            presence: 'PRESENCE#a' as any,
            from: { host: roomId, presence: parentRemainderKey(roomId) },
            to: { host: otherRoomId, presence: parentRemainderKey(otherRoomId) },
            subCover: [{ host: trayId, presence: 'PRESENCE#t' as any }],
            mintedPresence: 'PRESENCE#b' as any,
            cascadeHosts: [glassId],
        }
        expect(computeStepSequenceFootprint([part], () => undefined)).toEqual(new Set([tableId, roomId, otherRoomId, trayId, glassId]))
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

    it('a capture step contributes nothing: a room\'s occupants are resolved before the transact', () => {
        const steps: MutationKernelStep[] = [
            { kind: 'movePresenceBinding', to: null, hostId: trayId, presence: 'PRESENCE#t' as any, from: { host: roomId, presence: parentRemainderKey(roomId) } },
            { kind: 'capture', hostId: otherRoomId, captureId: 'onlooker' },
        ]
        expect(computeStepSequenceFootprint(steps, () => undefined)).toEqual(new Set([trayId, roomId]))
    })

    it('a bystander move contributes only the character: the rooms it leaves and arrives at are indexed by the characters row', () => {
        const characterId = 'CHARACTER#Alpha' as any
        const steps: MutationKernelStep[] = [
            { kind: 'movePresenceBinding', hostId: characterId, presence: 'PRESENCE#p' as any, from: { host: roomId, presence: parentRemainderKey(roomId) }, to: { host: otherRoomId, presence: parentRemainderKey(otherRoomId) } } as any,
            { kind: 'movePresenceBinding', to: null, hostId: characterId, presence: 'PRESENCE#q' as any, from: { host: roomId, presence: parentRemainderKey(roomId) } },
            { kind: 'addPresenceBinding', hostId: characterId, presenceUuid: 'u', fromHostPresence: { host: otherRoomId, presence: parentRemainderKey(otherRoomId) } } as any,
        ]
        expect(computeStepSequenceFootprint(steps, () => undefined)).toEqual(new Set([characterId]))
    })
})
