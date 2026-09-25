import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import { EphemeraLudicGraph } from '../ludicGraph'
import { testLudicGraph } from '../ludicGraph/testFixtures'
import { ludicCacheObjectHandles } from './catalogHandles'

const makeObjectComponent = (shortName: string) => new StandardObject({ tag: 'Object', shortName })

const roomA = 'ROOM#A' as EphemeraRoomId
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

        expect(handles).toEqual([{ objectId: namedId, shortName: 'Named Thing' }])
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
})
