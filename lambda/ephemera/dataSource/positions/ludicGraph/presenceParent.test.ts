import type { EphemeraAreaId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphStructureNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from './index'
import { bindingHasParent, childParentBindingIdOf, parentBinding, parentBindingsOf, parentOf, parentsOf, unpointedBindingOf } from './presenceParent'
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

describe('parentBinding', () => {
    it('returns the named binding\'s parent', async () => {
        const getGraph = graphsFrom({ [cup]: [presenceBindingNode('cup-shelf', shelf), presenceBindingNode('cup-roomA', roomA)] })
        await expect(parentBinding(cup, presenceBindingNode('cup-roomA').universalKey, getGraph)).resolves.toEqual({ host: roomA, presence: parentRemainderKey(roomA) })
    })

    it('returns undefined for a hostless remainder', async () => {
        const getGraph = graphsFrom({ [roomA]: [presenceBindingNode('roomA-remainder')] })
        await expect(parentBinding(roomA, presenceBindingNode('roomA-remainder').universalKey, getGraph)).resolves.toBeUndefined()
    })

    it('throws when the binding is not on the owner\'s graph', async () => {
        await expect(parentBinding(cup, presenceBindingNode('missing').universalKey, graphsFrom({}))).rejects.toThrow(/not found/)
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

    it('unpointedBindingOf finds the binding with an empty parent set', () => {
        const graph = testLudicGraph(cup, { nodes: [shared, presenceBindingNode('die-hostless')] })
        expect(unpointedBindingOf(graph)?.universalKey).toEqual(presenceBindingNode('die-hostless').universalKey)
    })
})
