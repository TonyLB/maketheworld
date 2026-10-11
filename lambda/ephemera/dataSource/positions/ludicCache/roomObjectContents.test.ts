import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraPresenceCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import { EphemeraLudicGraph } from '../ludicGraph'
import { testLudicGraph } from '../ludicGraph/testFixtures'
import { ludicCacheRoomObjectContents } from './roomObjectContents'

const roomA = 'ROOM#A' as EphemeraRoomId
const roomB = 'ROOM#B' as EphemeraRoomId
const table = 'OBJECT#Table' as EphemeraObjectId
const box = 'OBJECT#Box' as EphemeraObjectId
const cup = 'OBJECT#Cup' as EphemeraObjectId
const mug = 'OBJECT#Mug' as EphemeraObjectId
const nameless = 'OBJECT#Nameless' as EphemeraObjectId

const namedShortNameDeps = (names: Record<string, string>) => ({
    getComponentAggregate: jest.fn(async ([perspective]: { universalKey: string, mergeParticipationOrder: readonly `ASSET#${string}`[] }[]) => {
        const name = names[perspective.universalKey]
        return name
            ? [mergedComponentResult({
                universalKey: perspective.universalKey as EphemeraObjectId,
                merged: new StandardObject({ tag: 'Object', shortName: name }),
                mergeParticipationOrderApplied: perspective.mergeParticipationOrder,
            })]
            : []
    }),
})

const graphsAsDeps = (graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph>) => ({
    getLudicGraph: async (hostId: EphemeraMembershipHostId) => {
        const graph = graphs.get(hostId)
        if (!graph) {
            throw new Error(`No fixture graph for ${hostId}`)
        }
        return graph
    },
})

type Node = NonNullable<Parameters<typeof testLudicGraph>[1]>['nodes']
const objectGraph = (id: EphemeraObjectId, extra: Node = []) => testLudicGraph(id, { nodes: [{ tag: 'Object', universalKey: id }, ...extra] })
const roomGraph = (...objects: EphemeraObjectId[]) =>
    testLudicGraph(roomA, { nodes: [{ tag: 'Room', universalKey: roomA }, ...objects.map((universalKey) => ({ tag: 'Object' as const, universalKey }))] })
const binding = (key: string, from: EphemeraMembershipHostId, cover: EphemeraPresenceCover = { members: [{ tag: 'Remainder' }] }) =>
    ({ tag: 'Presence' as const, universalKey: PresenceKey(key), fromHostPresence: { host: from }, cover })

const names = namedShortNameDeps({ [table]: 'Table', [box]: 'Box', [cup]: 'Cup', [mug]: 'Mug' })

describe('ludicCacheRoomObjectContents', () => {
    it('returns an object on the floor with no contents', async () => {
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([[roomA, roomGraph(cup)], [cup, objectGraph(cup)]])

        const result = await ludicCacheRoomObjectContents(roomA, [cup], [], { ...graphsAsDeps(graphs), ...names })

        expect(result).toEqual([{ objectId: cup, shortName: 'Cup', contents: [] }])
    })

    it('reads a table\'s contents from the cover of its own binding', async () => {
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph(table)],
            [table, objectGraph(table, [
                { tag: 'Object', universalKey: cup },
                binding('table-in-a', roomA),
            ])],
            [cup, objectGraph(cup, [binding('cup-on-table', table)])],
        ])

        const result = await ludicCacheRoomObjectContents(roomA, [table], [], { ...graphsAsDeps(graphs), ...names })

        expect(result).toEqual([{ objectId: table, shortName: 'Table', contents: [{ objectId: cup, shortName: 'Cup' }] }])
    })

    it('unions the covers of a table bound into two rooms, once each', async () => {
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph(table)],
            [table, objectGraph(table, [
                { tag: 'Object', universalKey: cup },
                { tag: 'Object', universalKey: mug },
                binding('table-in-b', roomB, { members: [{ host: cup, presence: PresenceKey('cup-on-table') }] }),
                binding('table-in-a', roomA, { members: [{ host: cup, presence: PresenceKey('cup-on-table') }, { host: mug, presence: PresenceKey('mug-on-table') }] }),
            ])],
            [cup, objectGraph(cup)],
            [mug, objectGraph(mug)],
        ])

        const result = await ludicCacheRoomObjectContents(roomA, [table], [], { ...graphsAsDeps(graphs), ...names })

        expect(result[0].contents).toEqual([{ objectId: cup, shortName: 'Cup' }, { objectId: mug, shortName: 'Mug' }])
    })

    it('stops at one level: a cup in a box on the table appears under the box, not the table', async () => {
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph(table)],
            [table, objectGraph(table, [{ tag: 'Object', universalKey: box }, binding('table-in-a', roomA)])],
            [box, objectGraph(box, [{ tag: 'Object', universalKey: cup }, binding('box-on-table', table)])],
            [cup, objectGraph(cup, [binding('cup-in-box', box)])],
        ])

        const result = await ludicCacheRoomObjectContents(roomA, [table], [], { ...graphsAsDeps(graphs), ...names })

        expect(result).toEqual([{ objectId: table, shortName: 'Table', contents: [{ objectId: box, shortName: 'Box' }] }])
    })

    it('drops an object whose shortName never resolved, at both levels', async () => {
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph(table, nameless)],
            [table, objectGraph(table, [
                { tag: 'Object', universalKey: cup },
                { tag: 'Object', universalKey: nameless },
                binding('table-in-a', roomA),
            ])],
            [cup, objectGraph(cup)],
            [nameless, objectGraph(nameless)],
        ])

        const result = await ludicCacheRoomObjectContents(roomA, [table, nameless], [], { ...graphsAsDeps(graphs), ...names })

        expect(result).toEqual([{ objectId: table, shortName: 'Table', contents: [{ objectId: cup, shortName: 'Cup' }] }])
    })
})
