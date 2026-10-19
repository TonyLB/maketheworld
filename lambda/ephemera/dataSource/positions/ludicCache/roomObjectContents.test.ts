import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraPresenceCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import { EphemeraLudicGraph } from '../ludicGraph'
import { testLudicGraph } from '../ludicGraph/testFixtures'
import { buildLudicCache } from './fold'
import { ludicCacheRoomObjectContents } from './roomObjectContents'
import { parentRemainderKey } from '../ludicGraph/testFixtures'

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
    testLudicGraph(roomA, { nodes: [
        { tag: 'Room', universalKey: roomA },
        ...objects.map((universalKey) => ({ tag: 'Object' as const, universalKey })),
        { tag: 'Presence' as const, universalKey: PresenceKey('a_root'), fromHostPresences: [], cover: { members: [] } },
    ] })
const binding = (key: string, from: EphemeraMembershipHostId, cover: EphemeraPresenceCover = { members: [] }) =>
    ({ tag: 'Presence' as const, universalKey: PresenceKey(key), fromHostPresences: [{ host: from, presence: parentRemainderKey(from) }], cover })

const names = namedShortNameDeps({ [table]: 'Table', [box]: 'Box', [cup]: 'Cup', [mug]: 'Mug' })

/** The stored row, stood in for by a cold build with the stored (Canon) names; labels come from `viewerNames`. */
const contentsFor = async (
    graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph>,
    { storedNames = names, viewerNames = names }: { storedNames?: typeof names, viewerNames?: typeof names } = {}
) => ludicCacheRoomObjectContents(roomA, ['ASSET#viewer'], {
    readLudicCache: async (roomId) => ({ cache: (await buildLudicCache(roomId, [], { ...graphsAsDeps(graphs), ...storedNames })).cache, outcome: 'hit' as const }),
    ...viewerNames,
})

describe('ludicCacheRoomObjectContents', () => {
    it('returns an object on the floor with no contents', async () => {
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([[roomA, roomGraph(cup)], [cup, objectGraph(cup)]])

        const { objects: result } = await contentsFor(graphs)

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

        const { objects: result } = await contentsFor(graphs)

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

        const { objects: result } = await contentsFor(graphs)

        expect(result[0].contents).toEqual([{ objectId: cup, shortName: 'Cup' }, { objectId: mug, shortName: 'Mug' }])
    })

    it('stops at one level: a cup in a box on the table appears under the box, not the table', async () => {
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph(table)],
            [table, objectGraph(table, [{ tag: 'Object', universalKey: box }, binding('table-in-a', roomA)])],
            [box, objectGraph(box, [{ tag: 'Object', universalKey: cup }, binding('box-on-table', table)])],
            [cup, objectGraph(cup, [binding('cup-in-box', box)])],
        ])

        const { objects: result } = await contentsFor(graphs)

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

        const { objects: result } = await contentsFor(graphs)

        expect(result).toEqual([{ objectId: table, shortName: 'Table', contents: [{ objectId: cup, shortName: 'Cup' }] }])
    })

    it('shows the viewer\'s label for structure the stored row holds, never the stored name', async () => {
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph(table)],
            [table, objectGraph(table, [{ tag: 'Object', universalKey: cup }, binding('table-in-a', roomA)])],
            [cup, objectGraph(cup)],
        ])

        const { objects: result } = await contentsFor(graphs, { viewerNames: namedShortNameDeps({ [table]: 'Altar', [cup]: 'Chalice' }) })

        expect(result).toEqual([{ objectId: table, shortName: 'Altar', contents: [{ objectId: cup, shortName: 'Chalice' }] }])
    })

    it('drops an object the viewer has no label for, with no fallback to the stored name', async () => {
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph(table)],
            [table, objectGraph(table, [{ tag: 'Object', universalKey: cup }, binding('table-in-a', roomA)])],
            [cup, objectGraph(cup)],
        ])

        const { objects: result } = await contentsFor(graphs, { viewerNames: namedShortNameDeps({ [table]: 'Table' }) })

        expect(result).toEqual([{ objectId: table, shortName: 'Table', contents: [] }])
    })

    it('reads no graph itself: structure comes from the stored cache, and only the room level plus one level of contents is labelled', async () => {
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph(table, mug)],
            [table, objectGraph(table, [{ tag: 'Object', universalKey: box }, binding('table-in-a', roomA)])],
            [box, objectGraph(box, [binding('box-on-table', table)])],
            [mug, objectGraph(mug)],
        ])
        const { cache } = await buildLudicCache(roomA, [], { ...graphsAsDeps(graphs), ...names })
        const viewer = namedShortNameDeps({ [table]: 'Table', [box]: 'Box' })

        await ludicCacheRoomObjectContents(roomA, ['ASSET#viewer'], { readLudicCache: async () => ({ cache, outcome: 'hit' }), ...viewer })

        const labelled = viewer.getComponentAggregate.mock.calls.map(([[perspective]]) => perspective.universalKey).sort()
        expect(labelled).toEqual([box, mug, table])
    })

    it('derives the room level from the cache: every named direct Object, none for a character or an unnamed object', async () => {
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, testLudicGraph(roomA, { nodes: [{ tag: 'Room', universalKey: roomA }, { tag: 'Object', universalKey: cup }, { tag: 'Object', universalKey: nameless }, { tag: 'Character', universalKey: 'CHARACTER#Tess' as any }, { tag: 'Presence', universalKey: PresenceKey('a_root'), fromHostPresences: [], cover: { members: [] } }] })],
            [cup, objectGraph(cup)],
            [nameless, objectGraph(nameless)],
            ['CHARACTER#Tess' as any, testLudicGraph('CHARACTER#Tess' as any, { nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Tess' as any }] })],
        ])

        const { objectIds } = await contentsFor(graphs, { storedNames: namedShortNameDeps({ [cup]: 'Cup' }) as any })

        expect(objectIds).toEqual([cup])
    })

    it('unions the room node\'s covers across all its bindings', async () => {
        const stored = { nodes: [
            { universalKey: roomA, presenceNodes: [{ cover: { members: [{ host: cup }] } }, { cover: { members: [{ host: mug }, { host: cup }] } }] },
            { universalKey: cup, shortName: 'Cup' },
            { universalKey: mug, shortName: 'Mug' },
        ], edges: [] } as any

        const { objectIds } = await ludicCacheRoomObjectContents(roomA, ['ASSET#viewer'], { readLudicCache: async () => ({ cache: stored, outcome: 'hit' }), getComponentAggregate: async () => [] })

        expect(objectIds).toEqual([cup, mug])
    })

    it('reads the stored row as the header reader, so a rebuild it pays for is logged under that name', async () => {
        const readLudicCache = jest.fn(async () => ({ cache: { hostId: roomA, nodes: [], edges: [] } as any, outcome: 'hit' as const }))

        await ludicCacheRoomObjectContents(roomA, ['ASSET#viewer'], { readLudicCache, getComponentAggregate: async () => [] })

        expect(readLudicCache).toHaveBeenCalledWith(roomA, { reader: 'header', withCharacters: true })
    })

    describe('the roster from the characters row', () => {
        const emptyCache = { hostId: roomA, nodes: [], edges: [] } as any
        const readWith = (characters?: any) => ludicCacheRoomObjectContents(roomA, ['ASSET#viewer'], {
            readLudicCache: async () => ({ cache: emptyCache, outcome: 'hit', ...(characters ? { characters } : {}) }),
            getComponentAggregate: async () => [],
        })

        it('returns the characters of the row', async () => {
            const { characterIds } = await readWith({ 'CHARACTER#Tess': ['PRESENCE#a'], 'CHARACTER#Ava': ['PRESENCE#b'] })

            expect(characterIds).toEqual(['CHARACTER#Tess', 'CHARACTER#Ava'])
        })

        it('returns an empty roster for a row with nobody in it', async () => {
            expect((await readWith({})).characterIds).toEqual([])
        })

        it('returns an empty roster when the room has no row (nobody has entered it)', async () => {
            expect((await readWith(undefined)).characterIds).toEqual([])
        })
    })
})
