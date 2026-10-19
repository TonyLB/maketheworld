import type { EphemeraAreaId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphStructureNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from './index'
import { childParentBindingIdOf, parentBinding, parentBindingsOf } from './presenceParent'
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
