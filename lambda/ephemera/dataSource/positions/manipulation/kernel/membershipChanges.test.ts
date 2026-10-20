import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import type { MutationKernelStep } from './kernelStep'
import { membershipChangesOf } from './membershipChanges'

const tray = 'OBJECT#Tray' as EphemeraObjectId
const roomA = 'ROOM#Cafe' as EphemeraRoomId
const roomB = 'ROOM#Kitchen' as EphemeraRoomId

const graphs = (...entries: [EphemeraMembershipHostId, EphemeraLudicGraph][]) => new Map(entries)
const holding = (host: EphemeraRoomId, ...held: EphemeraObjectId[]) => testLudicGraph(host, {
    nodes: [...held.map((universalKey) => ({ tag: 'Object' as const, universalKey })), presenceBindingNode(parentRemainderKey(host))],
})
const own = (...parents: EphemeraRoomId[]) => testLudicGraph(tray, {
    nodes: [{ tag: 'Object', universalKey: tray }, ...parents.map((parent, index) => presenceBindingNode(`p${index}`, parent))],
})
const release: MutationKernelStep = { kind: 'reparentPresenceBinding', hostId: tray, presence: 'PRESENCE#p0' as any, lose: [{ host: roomA, presence: parentRemainderKey(roomA) }] }
const move: MutationKernelStep = { kind: 'reparentPresenceBinding', hostId: tray, presence: 'PRESENCE#p0' as any, lose: [{ host: roomA, presence: parentRemainderKey(roomA) }], gain: [{ host: roomB, presence: parentRemainderKey(roomB) }] }

describe('membershipChangesOf', () => {
    it('reports the hosts a mover left and arrived at, from the graphs alone', () => {
        const prior = graphs([roomA, holding(roomA, tray)], [roomB, holding(roomB)], [tray, own(roomA)])
        const after = graphs([roomA, holding(roomA)], [roomB, holding(roomB, tray)], [tray, own(roomB)])

        expect(membershipChangesOf([move], prior, after)).toEqual([{ entityId: tray, left: [roomA], arrived: [roomB], anchor: 0 }])
    })

    it('omits a mover whose membership did not change', () => {
        const same = graphs([roomA, holding(roomA, tray)], [tray, own(roomA)])

        expect(membershipChangesOf([move], same, same)).toEqual([])
    })

    it('anchors a mover at its last presence step, ignoring steps that are not presence writes', () => {
        const dissolve: MutationKernelStep = { kind: 'dissolveRelation', subjectId: tray, targetId: 'OBJECT#Table' as EphemeraObjectId, hostId: roomA, relationKind: 'On' }
        const prior = graphs([roomA, holding(roomA, tray)], [tray, own(roomA)])
        const after = graphs([roomA, holding(roomA)], [tray, own()])

        expect(membershipChangesOf([dissolve, release, dissolve], prior, after)).toEqual([{ entityId: tray, left: [roomA], arrived: [], anchor: 1 }])
    })

    it('never counts a mover\'s own graph, which holds its own root, as a host it belongs to', () => {
        const prior = graphs([tray, own()])
        const after = graphs([tray, own()])

        expect(membershipChangesOf([release], prior, after)).toEqual([])
    })

    it('treats a destroyed mover\'s departure like any other: its own graph is simply absent afterwards', () => {
        const prior = graphs([roomA, holding(roomA, tray)], [tray, own(roomA)])
        const after = graphs([roomA, holding(roomA)])

        expect(membershipChangesOf([release, { kind: 'destroyComponent', hostId: tray }], prior, after)).toEqual([
            { entityId: tray, left: [roomA], arrived: [], anchor: 0 },
        ])
    })

    describe('a bystander (a character at a Room)', () => {
        const alpha = 'CHARACTER#Alpha' as EphemeraCharacterId
        const ownAlpha = (...parents: EphemeraRoomId[]) => testLudicGraph(alpha as any, { nodes: parents.map((parent, index) => presenceBindingNode(`a${index}`, parent)) })
        const alphaMove: MutationKernelStep = { kind: 'reparentPresenceBinding', hostId: alpha, presence: 'PRESENCE#a0' as any, lose: [{ host: roomA, presence: parentRemainderKey(roomA) }], gain: [{ host: roomB, presence: parentRemainderKey(roomB) }] }

        it('reads the rooms from its own bindings: the room graphs hold no node for it', () => {
            const prior = graphs([alpha as any, ownAlpha(roomA)])
            const after = graphs([alpha as any, ownAlpha(roomB)])

            expect(membershipChangesOf([alphaMove], prior, after)).toEqual([{ entityId: alpha, left: [roomA], arrived: [roomB], anchor: 0 }])
        })

        it('reports a connect (a hostless binding placed in a room) as an arrival only', () => {
            const hostless = testLudicGraph(alpha as any, { nodes: [presenceBindingNode('a0')] })
            const connect: MutationKernelStep = { ...alphaMove, from: null } as MutationKernelStep

            expect(membershipChangesOf([connect], graphs([alpha as any, hostless]), graphs([alpha as any, ownAlpha(roomB)]))).toEqual([
                { entityId: alpha, left: [], arrived: [roomB], anchor: 0 },
            ])
        })

        it('omits a bystander whose binding did not change room', () => {
            const same = graphs([alpha as any, ownAlpha(roomA)])

            expect(membershipChangesOf([alphaMove], same, same)).toEqual([])
        })
    })
})
