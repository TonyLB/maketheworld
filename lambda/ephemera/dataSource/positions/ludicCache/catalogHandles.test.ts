import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraPresenceCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import { EphemeraLudicGraph } from '../ludicGraph'
import { testLudicGraph } from '../ludicGraph/testFixtures'
import { ludicCacheObjectHandles } from './catalogHandles'

const makeObjectComponent = (shortName: string) => new StandardObject({ tag: 'Object', shortName })

const roomA = 'ROOM#A' as EphemeraRoomId
const roomB = 'ROOM#B' as EphemeraRoomId
const boxId = 'OBJECT#Box' as EphemeraObjectId
const pebble = 'OBJECT#Pebble' as EphemeraObjectId
const namedId = 'OBJECT#Named' as EphemeraObjectId

const noShortNameDeps = () => ({
    getComponentAggregate: jest.fn(async () => []),
})

/** Resolves each host's shortName from `names` via a mocked merged aggregate, matching the real
 * per-host `getComponentAggregate([perspective])` call shape. */
const namedShortNameDeps = (names: Record<string, string>) => ({
    getComponentAggregate: jest.fn(async ([perspective]: { universalKey: string, mergeParticipationOrder: readonly `ASSET#${string}`[] }[]) => {
        const name = names[perspective.universalKey]
        return name
            ? [mergedComponentResult({
                universalKey: perspective.universalKey as EphemeraObjectId,
                merged: makeObjectComponent(name),
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

describe('ludicCacheObjectHandles', () => {
    it('returns a flat handle per object node, never the raw cache shape', async () => {
        const roomGraph = testLudicGraph(roomA, {
            nodes: [{ tag: 'Room', universalKey: roomA }, { tag: 'Object', universalKey: namedId }],
        })
        const namedGraph = testLudicGraph(namedId, { nodes: [{ tag: 'Object', universalKey: namedId }] })
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph], [namedId, namedGraph],
        ])

        const handles = await ludicCacheObjectHandles(roomA, [], {
            ...graphsAsDeps(graphs),
            ...namedShortNameDeps({ [namedId]: 'Named Thing' }),
        })

        expect(handles).toEqual([{ objectId: namedId, shortName: 'Named Thing', presence: [roomA] }])
    })

    it('excludes an object whose shortName never resolved', async () => {
        const roomGraph = testLudicGraph(roomA, {
            nodes: [{ tag: 'Room', universalKey: roomA }, { tag: 'Object', universalKey: namedId }],
        })
        const namedGraph = testLudicGraph(namedId, { nodes: [{ tag: 'Object', universalKey: namedId }] })
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph], [namedId, namedGraph],
        ])

        const handles = await ludicCacheObjectHandles(roomA, [], { ...graphsAsDeps(graphs), ...noShortNameDeps() })

        expect(handles).toEqual([])
    })

    // Terminal semantics: an unresolved crossing port (one side of a parent/child boundary
    // missing its matching leg) leaves cache.edges empty for that pair, mirroring
    // fold.test.ts's "does not invent an edge" regression --- but it must never suppress the
    // object NODE handle itself. A `not consolidated here` edge is not `nothing exists`.
    it('still returns every object handle when a crossing port is left unresolved', async () => {
        const roomGraph = testLudicGraph(roomA, {
            nodes: [{ tag: 'Room', universalKey: roomA }, { tag: 'Object', universalKey: boxId }],
        })
        const boxGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, { tag: 'Object', universalKey: pebble }],
            edges: [{ tag: 'Relational', from: { owner: boxId, port: 'port_1' }, to: pebble, kind: 'On' }],
            ports: [{ portId: 'port_1', fromHostId: boxId, kind: 'On' }],
        })
        const pebbleGraph = testLudicGraph(pebble, { nodes: [{ tag: 'Object', universalKey: pebble }] })
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph], [boxId, boxGraph], [pebble, pebbleGraph],
        ])

        const handles = await ludicCacheObjectHandles(roomA, [], {
            ...graphsAsDeps(graphs),
            ...namedShortNameDeps({ [boxId]: 'Box', [pebble]: 'Pebble' }),
        })

        expect(handles.map(({ objectId }) => objectId).sort()).toEqual([boxId, pebble].sort())
    })

    // Slice 5 (PC-3): the handler is the instrumentation boundary --- buildLudicCache/
    // enumerateLudicCacheShards stay pure, so this is the only place that can time a rebuild or
    // count its objects. Assert the log fires with the right counts, not that behavior changed.
    it('logs one structured rebuild line carrying counts, never cache structure', async () => {
        const roomGraph = testLudicGraph(roomA, {
            nodes: [{ tag: 'Room', universalKey: roomA }, { tag: 'Object', universalKey: namedId }],
        })
        const namedGraph = testLudicGraph(namedId, { nodes: [{ tag: 'Object', universalKey: namedId }] })
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph], [namedId, namedGraph],
        ])
        const spy = jest.spyOn(console, 'log').mockImplementation(() => {})

        await ludicCacheObjectHandles(roomA, [], {
            ...graphsAsDeps(graphs),
            ...namedShortNameDeps({ [namedId]: 'Named Thing' }),
        })

        expect(spy).toHaveBeenCalledWith('[mtw.ephemera.ludicCache] rebuild', expect.objectContaining({
            event: 'rebuild',
            seedHostId: roomA,
            shardFetchCount: 2,
            maxDepth: 1,
            objectCount: 1,
        }))
        const [, fields] = spy.mock.calls[0]
        expect(typeof (fields as { wallTimeMs: unknown }).wallTimeMs).toBe('number')

        spy.mockRestore()
    })

    // Each handle names the bucket the walk saw it in, so Grounding can stamp it.
    describe('presence', () => {
        const boxBinding = PresenceKey('box-in-a')
        const boxOtherBinding = PresenceKey('box-in-b')
        const stone = 'OBJECT#Stone' as EphemeraObjectId
        type Binding = { key: typeof boxBinding, from: EphemeraMembershipHostId, cover?: EphemeraPresenceCover }
        const boxInRoom = (bindings: Binding[]) => new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, testLudicGraph(roomA, {
                nodes: [{ tag: 'Room', universalKey: roomA }, { tag: 'Object', universalKey: boxId }],
            })],
            [boxId, testLudicGraph(boxId, {
                nodes: [
                    { tag: 'Object', universalKey: boxId },
                    { tag: 'Object', universalKey: pebble },
                    { tag: 'Object', universalKey: stone },
                    ...bindings.map(({ key, from, cover }) => ({ tag: 'Presence' as const, universalKey: key, fromHostId: from, cover: cover ?? { tag: 'Full' as const } })),
                ],
            })],
            [pebble, testLudicGraph(pebble, { nodes: [{ tag: 'Object', universalKey: pebble }] })],
            [stone, testLudicGraph(stone, { nodes: [{ tag: 'Object', universalKey: stone }] })],
        ])
        const names = namedShortNameDeps({ [boxId]: 'Box', [pebble]: 'Pebble', [stone]: 'Stone' })
        // A bucket names the host that owns it: the box's binding lives on the box's graph, even when the pebble is the one seen through it.
        const ofBox = (presence: typeof boxBinding) => ({ host: boxId, presence })
        const presenceOf = (handles: { objectId: string, presence?: unknown }[], objectId: string) =>
            handles.find((handle) => handle.objectId === objectId)?.presence

        // A host is the root of its own graph, so it is in each of its own buckets even though
        // `cover` leaves the root out: the box's handle names its own binding, not the room.
        it('names the box\'s own binding for the box, and that binding for a thing inside it', async () => {
            const handles = await ludicCacheObjectHandles(roomA, [], {
                ...graphsAsDeps(boxInRoom([{ key: boxBinding, from: roomA }])),
                ...names,
            })

            expect(handles).toEqual(expect.arrayContaining([
                { objectId: boxId, shortName: 'Box', presence: [ofBox(boxBinding)] },
                { objectId: pebble, shortName: 'Pebble', presence: [ofBox(boxBinding)] },
            ]))
        })

        // The payoff: a whole bound into several rooms ("kick the table") is seen in every one.
        it('names every one of a whole\'s own bindings, including one into a room the walk never reached', async () => {
            const handles = await ludicCacheObjectHandles(roomA, [], {
                ...graphsAsDeps(boxInRoom([{ key: boxOtherBinding, from: roomB }, { key: boxBinding, from: roomA }])),
                ...names,
            })

            expect(presenceOf(handles, boxId)).toEqual([ofBox(boxOtherBinding), ofBox(boxBinding)])
        })

        it('names both the covering bucket and a contained thing\'s own binding, once each', async () => {
            const pebbleInBox = PresenceKey('pebble-in-box')
            const graphs = boxInRoom([{
                key: boxBinding,
                from: roomA,
                cover: { tag: 'Enumerated', members: [{ host: pebble, presence: pebbleInBox }] },
            }])
            graphs.set(pebble, testLudicGraph(pebble, {
                nodes: [
                    { tag: 'Object', universalKey: pebble },
                    { tag: 'Presence', universalKey: pebbleInBox, fromHostId: boxId, cover: { tag: 'Full' } },
                ],
            }))

            const handles = await ludicCacheObjectHandles(roomA, [], { ...graphsAsDeps(graphs), ...names })

            expect(presenceOf(handles, pebble)).toEqual(expect.arrayContaining([ofBox(boxBinding), { host: pebble, presence: pebbleInBox }]))
            expect(presenceOf(handles, pebble)).toHaveLength(2)
        })

        // Perspective picks which thing a phrase means, not who can see it change: a box bound into
        // two rooms with `Full` covers shows the pebble in both, walked or not.
        it('lists every bucket that holds it, including one bound into a room the walk never reached', async () => {
            const handles = await ludicCacheObjectHandles(roomA, [], {
                ...graphsAsDeps(boxInRoom([{ key: boxOtherBinding, from: roomB }, { key: boxBinding, from: roomA }])),
                ...names,
            })

            expect(presenceOf(handles, pebble)).toEqual([ofBox(boxOtherBinding), ofBox(boxBinding)])
        })

        // A straddling whole partitions its contents: each half's things are in that half's bucket only.
        it('names only the bucket whose Enumerated cover holds it', async () => {
            const handles = await ludicCacheObjectHandles(roomA, [], {
                ...graphsAsDeps(boxInRoom([
                    { key: boxBinding, from: roomA, cover: { tag: 'Enumerated', members: [{ host: pebble, presence: PresenceKey('pebble-in-box') }] } },
                    { key: boxOtherBinding, from: roomB, cover: { tag: 'Enumerated', members: [{ host: stone, presence: PresenceKey('stone-in-box') }] } },
                ])),
                ...names,
            })

            expect(presenceOf(handles, pebble)).toEqual([ofBox(boxBinding)])
            expect(presenceOf(handles, stone)).toEqual([ofBox(boxOtherBinding)])
        })

        it('falls back to the seed room when the containing host has no binding', async () => {
            const handles = await ludicCacheObjectHandles(roomA, [], { ...graphsAsDeps(boxInRoom([])), ...names })

            expect(presenceOf(handles, pebble)).toEqual([roomA])
        })
    })
})
