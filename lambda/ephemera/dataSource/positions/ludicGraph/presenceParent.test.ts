import type { EphemeraAreaId, EphemeraFeatureId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphStructureNode, EphemeraPresenceCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import type { EphemeraLudicGraph } from './index'
import { parentBinding, parentBindingsOf } from './presenceParent'
import { testLudicGraph } from './testFixtures'

const area = 'AREA#Town' as EphemeraAreaId
const roomA = 'ROOM#A' as EphemeraRoomId
const roomB = 'ROOM#B' as EphemeraRoomId
const shelf = 'OBJECT#Shelf' as EphemeraObjectId
const cup = 'OBJECT#Cup' as EphemeraObjectId
const lamp = 'FEATURE#Lamp' as EphemeraFeatureId

const bindingKey = (name: string) => PresenceKey(name) as EphemeraPresenceNodeId

const binding = (
    name: string,
    fromHostId: EphemeraMembershipHostId,
    cover: EphemeraPresenceCover = { members: [{ tag: 'Remainder' }] }
): EphemeraLudicGraphStructureNode => ({ tag: 'Presence', universalKey: bindingKey(name), fromHostId, cover })

const graphsFrom = (nodes: Partial<Record<EphemeraMembershipHostId, EphemeraLudicGraphStructureNode[]>>) => (
    jest.fn(async (hostId: EphemeraMembershipHostId): Promise<EphemeraLudicGraph> => (
        testLudicGraph(hostId, { nodes: nodes[hostId] ?? [] })
    ))
)

describe('parentBindingsOf', () => {
    it('names the parent host of every binding, reading only the owner graph by default', async () => {
        const getGraph = graphsFrom({ [cup]: [binding('cup-shelf', shelf), binding('cup-roomA', roomA)] })
        const result = await parentBindingsOf(cup, getGraph)
        expect(result.map(({ parent }) => parent)).toEqual([{ host: shelf }, { host: roomA }])
        expect(getGraph).toHaveBeenCalledTimes(1)
    })

    it('returns nothing for a host with no bindings', async () => {
        await expect(parentBindingsOf(cup, graphsFrom({}))).resolves.toEqual([])
    })

    describe('resolvePresence', () => {
        const resolve = (getGraph: ReturnType<typeof graphsFrom>) => (
            parentBindingsOf(cup, getGraph, { resolvePresence: true }).then((r) => r.map(({ parent }) => parent))
        )

        it('names the parent\'s only binding when the parent is not a room', async () => {
            const getGraph = graphsFrom({
                [cup]: [binding('cup-shelf', shelf)],
                [shelf]: [binding('shelf-roomA', roomA)],
            })
            await expect(resolve(getGraph)).resolves.toEqual([{ host: shelf, presence: bindingKey('shelf-roomA') }])
        })

        it('leaves presence unset for an Area-hosted room: its only binding is the Area carve-out', async () => {
            const getGraph = graphsFrom({
                [cup]: [binding('cup-roomA', roomA)],
                [roomA]: [binding('roomA-area', area)],
            })
            await expect(resolve(getGraph)).resolves.toEqual([{ host: roomA }])
        })

        it('leaves presence unset when the parent holds two bindings: never guess', async () => {
            const getGraph = graphsFrom({
                [cup]: [binding('cup-lamp', lamp)],
                [lamp]: [binding('lamp-roomA', roomA), binding('lamp-roomB', roomB)],
            })
            await expect(resolve(getGraph)).resolves.toEqual([{ host: lamp }])
        })

        it('leaves presence unset when the parent has no binding', async () => {
            const getGraph = graphsFrom({ [cup]: [binding('cup-shelf', shelf)] })
            await expect(resolve(getGraph)).resolves.toEqual([{ host: shelf }])
        })

        it('prefers the parent binding whose Enumerated cover lists the child, even among several', async () => {
            const getGraph = graphsFrom({
                [cup]: [binding('cup-lamp', lamp)],
                [lamp]: [
                    binding('lamp-roomA', roomA),
                    binding('lamp-roomB', roomB, {
                        members: [{ host: cup, presence: bindingKey('cup-lamp') }],
                    }),
                ],
            })
            await expect(resolve(getGraph)).resolves.toEqual([{ host: lamp, presence: bindingKey('lamp-roomB') }])
        })
    })
})

describe('parentBinding', () => {
    it('returns the named binding\'s parent', async () => {
        const getGraph = graphsFrom({ [cup]: [binding('cup-shelf', shelf), binding('cup-roomA', roomA)] })
        await expect(parentBinding(cup, bindingKey('cup-roomA'), getGraph)).resolves.toEqual({ host: roomA })
    })

    it('throws when the binding is not on the owner\'s graph', async () => {
        await expect(parentBinding(cup, bindingKey('missing'), graphsFrom({}))).rejects.toThrow(/not found/)
    })
})
