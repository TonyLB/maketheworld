import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphStructureNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import type { EphemeraLudicGraph } from './index'
import { roomsForHost, roomsForPresenceNode, roomsForReferent } from './presenceRooms'
import { testLudicGraph } from './testFixtures'

const roomA = 'ROOM#A' as EphemeraRoomId
const roomB = 'ROOM#B' as EphemeraRoomId
const box = 'OBJECT#Box' as EphemeraObjectId
const cup = 'OBJECT#Cup' as EphemeraObjectId
const ball = 'OBJECT#Ball' as EphemeraObjectId
const shelf = 'OBJECT#Shelf' as EphemeraObjectId

/** A presence binding on the member's own graph, naming the parent it is present at. */
const presenceAt = (fromHostId: EphemeraMembershipHostId, key?: string): EphemeraLudicGraphStructureNode => ({
    tag: 'Presence',
    universalKey: PresenceKey(key ?? `${fromHostId.replace('#', '-')}-binding`),
    fromHostId,
    cover: { tag: 'Full' },
})

/** `parents` maps each host to the hosts it is present at; every graph also lists itself. */
const graphsFrom = (parents: Partial<Record<EphemeraMembershipHostId, EphemeraLudicGraphStructureNode[]>>) => (
    jest.fn(async (hostId: EphemeraMembershipHostId): Promise<EphemeraLudicGraph> => (
        testLudicGraph(hostId, { nodes: parents[hostId] ?? [] })
    ))
)

describe('roomsForHost', () => {
    it('returns the host itself, with no fetch, when it is already a room', async () => {
        const getGraph = graphsFrom({})
        await expect(roomsForHost(roomA, getGraph)).resolves.toEqual(new Set([roomA]))
        expect(getGraph).not.toHaveBeenCalled()
    })

    it('walks a single binding up to its room', async () => {
        const getGraph = graphsFrom({ [cup]: [presenceAt(box)], [box]: [presenceAt(roomA)] })
        await expect(roomsForHost(cup, getGraph)).resolves.toEqual(new Set([roomA]))
    })

    it('fans out over every parent, reaching several rooms', async () => {
        const getGraph = graphsFrom({
            [ball]: [presenceAt(box, 'ball-box'), presenceAt(shelf, 'ball-shelf')],
            [box]: [presenceAt(roomA)],
            [shelf]: [presenceAt(roomB)],
        })
        await expect(roomsForHost(ball, getGraph)).resolves.toEqual(new Set([roomA, roomB]))
    })

    it('is a dead end, not a room, for a host with no presence binding of its own', async () => {
        const getGraph = graphsFrom({})
        await expect(roomsForHost(box, getGraph)).resolves.toEqual(new Set())
    })

    it('fetches a shared ancestor once, however many paths reach it', async () => {
        const getGraph = graphsFrom({
            [ball]: [presenceAt(box, 'ball-box'), presenceAt(shelf, 'ball-shelf')],
            [box]: [presenceAt(roomA, 'box-room')],
            [shelf]: [presenceAt(roomA, 'shelf-room')],
        })
        await roomsForHost(ball, getGraph)
        expect(getGraph.mock.calls.map(([hostId]) => hostId).sort()).toEqual([ball, box, shelf].sort())
    })
})

describe('roomsForPresenceNode', () => {
    it('locates the binding on its owner\'s own graph and continues the walk', async () => {
        const presenceId = PresenceKey('cup-binding') as EphemeraPresenceNodeId
        const getGraph = graphsFrom({
            [cup]: [{ tag: 'Presence', universalKey: presenceId, fromHostId: box, cover: { tag: 'Full' } }],
            [box]: [presenceAt(roomA)],
        })
        await expect(roomsForPresenceNode(cup, presenceId, getGraph)).resolves.toEqual(new Set([roomA]))
    })

    it('throws when the binding is not found on the named owner\'s graph', async () => {
        const getGraph = graphsFrom({})
        await expect(roomsForPresenceNode(cup, PresenceKey('missing') as EphemeraPresenceNodeId, getGraph)).rejects.toThrow(/not found/)
    })
})

describe('roomsForReferent', () => {
    it('resolves a room-valued groundedPresence entry with no fetch', async () => {
        const getGraph = graphsFrom({})
        await expect(roomsForReferent(cup, [roomA], getGraph)).resolves.toEqual(new Set([roomA]))
        expect(getGraph).not.toHaveBeenCalled()
    })

    it('defaults to every room groundedId currently reaches when groundedPresence is absent', async () => {
        const getGraph = graphsFrom({ [cup]: [presenceAt(roomA)] })
        await expect(roomsForReferent(cup, undefined, getGraph)).resolves.toEqual(new Set([roomA]))
    })

    it('defaults the same way for an empty groundedPresence array', async () => {
        const getGraph = graphsFrom({ [cup]: [presenceAt(roomA)] })
        await expect(roomsForReferent(cup, [], getGraph)).resolves.toEqual(new Set([roomA]))
    })

    it('unions a multi-room presence (several groundedPresence entries) into one deduplicated set', async () => {
        const presenceId = PresenceKey('cup-box-binding') as EphemeraPresenceNodeId
        const getGraph = graphsFrom({
            [cup]: [{ tag: 'Presence', universalKey: presenceId, fromHostId: box, cover: { tag: 'Full' } }],
            [box]: [presenceAt(roomA)],
        })
        await expect(roomsForReferent(cup, [{ host: cup, presence: presenceId }, roomB], getGraph)).resolves.toEqual(new Set([roomA, roomB]))
    })

    it('reads a bucket from the graph of the host that owns it, not the referent\'s own', async () => {
        // The cup is seen through the box's binding (it sits in the box's graph): that binding
        // lives on the box's graph, and the cup's own graph has none.
        const boxBinding = PresenceKey('box-room-binding') as EphemeraPresenceNodeId
        const getGraph = graphsFrom({
            [box]: [{ tag: 'Presence', universalKey: boxBinding, fromHostId: roomA, cover: { tag: 'Full' } }],
        })
        await expect(roomsForReferent(cup, [{ host: box, presence: boxBinding }], getGraph)).resolves.toEqual(new Set([roomA]))
    })
})
