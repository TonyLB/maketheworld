import type { EphemeraAreaId, EphemeraFeatureId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphStructureNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from './index'
import { bindingHasParent, bindingHasParentOn, childParentBindingIdOf, connectedToPairsOf, parentBindingsOf, parentHostsOf, parentsOfBinding, parentOf, parentsOf, unpointedBindingOf } from './presenceParent'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from './testFixtures'

const area = 'AREA#Town' as EphemeraAreaId
const roomA = 'ROOM#A' as EphemeraRoomId
const roomB = 'ROOM#B' as EphemeraRoomId
const shelf = 'OBJECT#Shelf' as EphemeraObjectId
const cup = 'OBJECT#Cup' as EphemeraObjectId
const lamp = 'FEATURE#Lamp' as EphemeraFeatureId

const graphsFrom = (nodes: Partial<Record<EphemeraMembershipHostId, EphemeraLudicGraphStructureNode[]>>) => (
    jest.fn(async (hostId: EphemeraMembershipHostId): Promise<EphemeraLudicGraph> => (
        testLudicGraph(hostId, { nodes: nodes[hostId] ?? [] })
    ))
)

describe('parentBindingsOf', () => {
    it('names the stored parent binding of every binding, reading only the owner graph', async () => {
        const getGraph = graphsFrom({ [cup]: [presenceBindingNode('cup-shelf', shelf), presenceBindingNode('cup-roomA', roomA)] })
        const result = await parentBindingsOf(cup, getGraph)
        expect(result.map(({ parent }) => parent)).toEqual([
            { host: shelf, presence: parentRemainderKey(shelf) },
            { host: roomA, presence: parentRemainderKey(roomA) },
        ])
        expect(getGraph).toHaveBeenCalledTimes(1)
    })

    it('distinguishes two bindings of one parent by the stored presence id: never derives', async () => {
        const getGraph = graphsFrom({
            [cup]: [
                presenceBindingNode('cup-lamp-1', { host: lamp, presence: 'PRESENCE#lamp-roomA' as any }),
                presenceBindingNode('cup-lamp-2', { host: lamp, presence: 'PRESENCE#lamp-roomB' as any }),
            ],
            [lamp]: [presenceBindingNode('lamp-roomA', roomA), presenceBindingNode('lamp-roomB', roomB)],
        })
        const result = await parentBindingsOf(cup, getGraph)
        expect(result.map(({ parent }) => parent.presence)).toEqual(['PRESENCE#lamp-roomA', 'PRESENCE#lamp-roomB'])
    })

    it('omits a hostless remainder: it has no upward edge', async () => {
        const getGraph = graphsFrom({ [roomA]: [presenceBindingNode('roomA-remainder'), presenceBindingNode('roomA-area', area)] })
        const result = await parentBindingsOf(roomA, getGraph)
        expect(result.map(({ parent }) => parent.host)).toEqual([area])
    })

    it('reads a Room\'s pointer into an Area, naming the Area\'s remainder binding', async () => {
        const result = await parentBindingsOf(roomA, graphsFrom({ [roomA]: [presenceBindingNode('roomA-area', area, { members: [] })] }))
        expect(result.map(({ parent }) => parent)).toEqual([{ host: area, presence: parentRemainderKey(area) }])
    })

    it('returns nothing for a host with no bindings', async () => {
        await expect(parentBindingsOf(cup, graphsFrom({}))).resolves.toEqual([])
    })
})

describe('parentsOfBinding', () => {
    it('returns the named binding\'s parents', async () => {
        const getGraph = graphsFrom({ [cup]: [presenceBindingNode('cup-shelf', shelf), presenceBindingNode('cup-roomA', roomA)] })
        await expect(parentsOfBinding(cup, presenceBindingNode('cup-roomA').universalKey, getGraph)).resolves.toEqual([{ host: roomA, presence: parentRemainderKey(roomA) }])
    })

    it('returns every parent of a shared binding', async () => {
        const getGraph = graphsFrom({ [cup]: [presenceBindingNode('cup-shared', [roomA, shelf])] })
        await expect(parentsOfBinding(cup, presenceBindingNode('cup-shared').universalKey, getGraph)).resolves.toHaveLength(2)
    })

    it('returns no parents for a hostless remainder', async () => {
        const getGraph = graphsFrom({ [roomA]: [presenceBindingNode('roomA-remainder')] })
        await expect(parentsOfBinding(roomA, presenceBindingNode('roomA-remainder').universalKey, getGraph)).resolves.toEqual([])
    })

    it('throws when the binding is not on the owner\'s graph', async () => {
        await expect(parentsOfBinding(cup, presenceBindingNode('missing').universalKey, graphsFrom({}))).rejects.toThrow(/not found/)
    })
})

describe('childParentBindingIdOf (Base)', () => {
    it('names PRESENCE#Base by id, even when the whole holds several bindings', () => {
        const graph = testLudicGraph(shelf, { nodes: [presenceBindingNode('Base', roomA), presenceBindingNode('other', roomB)] })
        expect(childParentBindingIdOf(graph)).toBe('PRESENCE#Base')
    })

    it('names nothing for a whole with no Base: no guess from a hostless or only binding (the Base migration owns it)', () => {
        expect(childParentBindingIdOf(testLudicGraph(roomA, { nodes: [presenceBindingNode('legacy-uuid')] }))).toBeUndefined()
        expect(childParentBindingIdOf(testLudicGraph(shelf, { nodes: [presenceBindingNode('legacy', roomA)] }))).toBeUndefined()
        expect(childParentBindingIdOf(testLudicGraph(shelf, { nodes: [] }))).toBeUndefined()
    })
})

describe('parent sets', () => {
    const shared = presenceBindingNode('die-shared', [roomA, shelf])
    const underRoomA = { host: roomA, presence: parentRemainderKey(roomA) }
    const underShelf = { host: shelf, presence: parentRemainderKey(shelf) }

    it('parentsOf lists every parent, and nothing for a hostless binding', () => {
        expect(parentsOf(shared)).toEqual([underRoomA, underShelf])
        expect(parentsOf(presenceBindingNode('die-hostless'))).toEqual([])
    })

    it('parentOf reads one parent, and throws rather than reading the first of several', () => {
        expect(parentOf(presenceBindingNode('die-roomA', roomA))).toEqual(underRoomA)
        expect(parentOf(presenceBindingNode('die-hostless'))).toBeUndefined()
        expect(() => parentOf(shared)).toThrow(/die-shared.*2 parents/)
    })

    it('parentBindingsOf yields one entry per parent of a binding', async () => {
        const getGraph = graphsFrom({ [cup]: [shared] })
        const result = await parentBindingsOf(cup, getGraph)
        expect(result.map(({ binding, parent }) => [binding.universalKey, parent])).toEqual([
            [shared.universalKey, underRoomA],
            [shared.universalKey, underShelf],
        ])
    })

    it('bindingHasParent is set membership', () => {
        expect(bindingHasParent(shared, underShelf)).toBe(true)
        expect(bindingHasParent(shared, { host: roomB, presence: parentRemainderKey(roomB) })).toBe(false)
        expect(bindingHasParent(presenceBindingNode('die-hostless'), underRoomA)).toBe(false)
    })

    it('host tests read "some parent is on H": parentHostsOf is distinct hosts, bindingHasParentOn is membership', () => {
        const twoOnOneHost = presenceBindingNode('die-two', [underRoomA, { host: roomA, presence: 'PRESENCE#other' as any }, underShelf])
        expect(parentHostsOf(twoOnOneHost)).toEqual([roomA, shelf])
        expect(parentHostsOf(presenceBindingNode('die-hostless'))).toEqual([])
        expect(bindingHasParentOn(shared, shelf)).toBe(true)
        expect(bindingHasParentOn(shared, roomB)).toBe(false)
    })

    it('unpointedBindingOf finds the binding with an empty parent set', () => {
        const graph = testLudicGraph(cup, { nodes: [shared, presenceBindingNode('die-hostless')] })
        expect(unpointedBindingOf(graph)?.universalKey).toEqual(presenceBindingNode('die-hostless').universalKey)
    })
})

describe('connectedToPairsOf', () => {
    const base = 'PRESENCE#Base' as EphemeraPresenceNodeId
    const second = 'PRESENCE#r2' as EphemeraPresenceNodeId

    it('reads ConnectedTo edges between two of the host\'s own binding addresses, and nothing else', () => {
        const graph = testLudicGraph(shelf, {
            nodes: [presenceBindingNode(base, roomA), presenceBindingNode(second, roomB)],
            edges: [
                { tag: 'Relational', kind: 'ConnectedTo', from: { owner: shelf, port: base }, to: { owner: shelf, port: second } },
                { tag: 'Relational', kind: 'ConnectedTo', from: { owner: cup, port: base }, to: { owner: shelf, port: second } },
                { tag: 'Relational', kind: 'Custom', relationLabel: 'tied to', from: { owner: shelf, port: base }, to: { owner: shelf, port: second } },
            ],
        })
        expect(connectedToPairsOf(graph)).toEqual([[base, second]])
    })

    it('leaves out a ConnectedTo with a crossing-port end: a crossing port is not a binding', () => {
        const graph = testLudicGraph(shelf, {
            nodes: [presenceBindingNode(second, roomB)],
            edges: [{ tag: 'Relational', kind: 'ConnectedTo', from: { owner: shelf, port: 'PORT-ab6129d' }, to: { owner: shelf, port: second } }],
        })
        expect(connectedToPairsOf(graph)).toEqual([])
    })
})
