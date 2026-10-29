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
        const step: MutationKernelStep = { kind: 'establishRelation', subjectId: trayId, targetId: glassId, hostId: roomId, relationKind: 'ConnectedTo' }
        const getCurrentHost = (id: EphemeraLudicTerminalPrimitive) => (id === trayId ? roomId : otherRoomId)
        expect(computeStepSequenceFootprint([step], getCurrentHost)).toEqual(new Set([roomId, otherRoomId]))
    })

    it('unions hosts across a multi-step sequence with no duplicates', () => {
        const steps: MutationKernelStep[] = [
            { kind: 'dissolveRelation', subjectId: trayId, targetId: glassId, hostId: roomId, relationKind: 'ConnectedTo' },
            { kind: 'reparentPresenceBinding', hostId: trayId, presence: 'PRESENCE#t' as any, lose: [{ host: roomId, presence: parentRemainderKey(roomId) }], gain: [{ host: characterId, presence: 'PRESENCE#c' as any }] },
        ]
        const getCurrentHost = () => roomId
        expect(computeStepSequenceFootprint(steps, getCurrentHost)).toEqual(new Set([roomId, characterId, trayId]))
    })

    it('a relational step with a non-Object (Character) subject derives its host via getCurrentHost, no narrow needed', () => {
        const step: MutationKernelStep = { kind: 'establishRelation', subjectId: characterId, targetId: trayId, hostId: roomId, relationKind: 'ConnectedTo' }
        const getCurrentHost = (id: EphemeraLudicTerminalPrimitive) => (id === characterId ? roomId : otherRoomId)
        expect(computeStepSequenceFootprint([step], getCurrentHost)).toEqual(new Set([roomId, otherRoomId]))
    })

    it('throws when getCurrentHost cannot resolve a relational step endpoint', () => {
        const step: MutationKernelStep = { kind: 'establishRelation', subjectId: trayId, targetId: glassId, hostId: roomId, relationKind: 'ConnectedTo' }
        expect(() => computeStepSequenceFootprint([step], () => undefined)).toThrow()
    })

    it('a setHostingKind step contributes its hostId and resolves no endpoint host', () => {
        const step: MutationKernelStep = { kind: 'setHostingKind', hostId: roomId, memberId: trayId, hostingKind: 'On' }
        expect(computeStepSequenceFootprint([step], () => undefined)).toEqual(new Set([roomId]))
    })

    it('an assignEdgeId step contributes its hostId and resolves no endpoint host', () => {
        const step: MutationKernelStep = { kind: 'assignEdgeId', hostId: roomId, edge: { from: trayId, to: glassId, kind: 'ConnectedTo' }, edgeId: 'edge-1' }
        expect(computeStepSequenceFootprint([step], () => undefined)).toEqual(new Set([roomId]))
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
            { kind: 'addPresenceBinding', hostId: trayId, fromHostPresences: [{ host: roomId, presence: parentRemainderKey(roomId) }], presenceUuid: 'p1' },
            { kind: 'repairPresenceBinding', hostId: otherRoomId, presenceId: 'PRESENCE#p2', fromHostPresences: [], cover: { members: [] } },
        ]
        expect(computeStepSequenceFootprint(steps, () => undefined)).toEqual(new Set([trayId, roomId, otherRoomId]))
    })

    it('a pointer-less add contributes only its hostId', () => {
        const steps: MutationKernelStep[] = [{ kind: 'addPresenceBinding', hostId: roomId, fromHostPresences: [], presenceUuid: 'root' }]
        expect(computeStepSequenceFootprint(steps, () => undefined)).toEqual(new Set([roomId]))
    })

    it('a move step contributes its hostId, its destination (read to confirm the binding) and the host it leaves', () => {
        const move: MutationKernelStep = { kind: 'reparentPresenceBinding', hostId: glassId, presence: 'PRESENCE#p3' as any, lose: [{ host: otherRoomId, presence: parentRemainderKey(otherRoomId) }], gain: [{ host: roomId, presence: 'PRESENCE#r' as any }] }
        expect(computeStepSequenceFootprint([move], () => undefined)).toEqual(new Set([glassId, roomId, otherRoomId]))
    })

    it('a first-placement move (from null) contributes its hostId and destination', () => {
        const move: MutationKernelStep = { kind: 'reparentPresenceBinding', hostId: glassId, presence: 'PRESENCE#p3' as any, gain: [{ host: roomId, presence: 'PRESENCE#r' as any }] }
        expect(computeStepSequenceFootprint([move], () => undefined)).toEqual(new Set([glassId, roomId]))
    })

    it('a departure (a reparent that only loses) contributes its hostId, the host it leaves and its cascade hosts', () => {
        const steps: MutationKernelStep[] = [
            { kind: 'reparentPresenceBinding', hostId: trayId, presence: 'PRESENCE#t' as any, lose: [{ host: otherRoomId, presence: parentRemainderKey(otherRoomId) }], cascadeHosts: [glassId] },
        ]
        expect(computeStepSequenceFootprint(steps, () => undefined)).toEqual(new Set([trayId, otherRoomId, glassId]))
    })

    it('a split contributes the children of each piece, and a reparent its cascade hosts', () => {
        const parents = [{ host: roomId, presence: parentRemainderKey(roomId) }]
        const split: MutationKernelStep = {
            kind: 'splitPresenceBinding',
            hostId: tableId,
            presence: 'PRESENCE#a' as any,
            pieces: [
                { presence: 'PRESENCE#a' as any, parents, cover: { members: [] } },
                { presenceUuid: 'b', parents, cover: { members: [{ host: trayId, presence: 'PRESENCE#t' as any }] } },
            ],
        }
        const reparent: MutationKernelStep = {
            kind: 'reparentPresenceBinding',
            hostId: tableId,
            presence: 'PRESENCE#b' as any,
            lose: parents,
            gain: [{ host: otherRoomId, presence: parentRemainderKey(otherRoomId) }],
            cascadeHosts: [glassId],
        }
        expect(computeStepSequenceFootprint([split, reparent], () => undefined)).toEqual(new Set([tableId, roomId, otherRoomId, trayId, glassId]))
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
            { kind: 'reparentPresenceBinding', hostId: trayId, presence: 'PRESENCE#t' as any, lose: [{ host: roomId, presence: parentRemainderKey(roomId) }] },
            { kind: 'capture', hostId: otherRoomId, captureId: 'onlooker' },
        ]
        expect(computeStepSequenceFootprint(steps, () => undefined)).toEqual(new Set([trayId, roomId]))
    })

    it('a bystander move contributes only the character: the rooms it leaves and arrives at are indexed by the characters row', () => {
        const characterId = 'CHARACTER#Alpha' as any
        const steps: MutationKernelStep[] = [
            { kind: 'reparentPresenceBinding', hostId: characterId, presence: 'PRESENCE#p' as any, lose: [{ host: roomId, presence: parentRemainderKey(roomId) }], gain: [{ host: otherRoomId, presence: parentRemainderKey(otherRoomId) }] } as any,
            { kind: 'reparentPresenceBinding', hostId: characterId, presence: 'PRESENCE#q' as any, lose: [{ host: roomId, presence: parentRemainderKey(roomId) }] },
            { kind: 'addPresenceBinding', hostId: characterId, presenceUuid: 'u', fromHostPresences: [{ host: otherRoomId, presence: parentRemainderKey(otherRoomId) }] } as any,
        ]
        expect(computeStepSequenceFootprint(steps, () => undefined)).toEqual(new Set([characterId]))
    })
    it('the reparent, join and split steps lock the mover, the parents they name and the children they rewrite', () => {
        const parent = (host: EphemeraRoomId | EphemeraObjectId) => ({ host, presence: parentRemainderKey(host) })
        const steps: MutationKernelStep[] = [
            { kind: 'reparentPresenceBinding', hostId: trayId, presence: 'PRESENCE#t' as any, lose: [parent(roomId)], gain: [parent(otherRoomId)], cascadeHosts: [glassId] },
            { kind: 'joinPresenceBindings', hostId: tableId, into: 'PRESENCE#a' as any, toJoin: ['PRESENCE#b' as any], cascadeHosts: [characterId] },
        ]
        expect(computeStepSequenceFootprint(steps, () => undefined)).toEqual(new Set([trayId, roomId, otherRoomId, glassId, tableId, characterId]))
    })

    it('a split locks the pieces\' parents and the hosts of their covers', () => {
        const piece = (parent: typeof roomId, cover: { host: any; presence: any }[]) => ({ presenceUuid: 'u', parents: [{ host: parent, presence: parentRemainderKey(parent) }], cover: { members: cover } })
        const step: MutationKernelStep = {
            kind: 'splitPresenceBinding',
            hostId: tableId,
            presence: 'PRESENCE#t' as any,
            pieces: [piece(roomId, [{ host: trayId, presence: 'PRESENCE#x' }]), piece(otherRoomId, [{ host: glassId, presence: 'PRESENCE#y' }])],
        }
        expect(computeStepSequenceFootprint([step], () => undefined)).toEqual(new Set([tableId, roomId, otherRoomId, trayId, glassId]))
    })
})
