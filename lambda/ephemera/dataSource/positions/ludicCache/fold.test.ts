/**
 * Fixtures are hand-authored `EphemeraLudicGraph`s, matching this directory's house style --- no
 * `jest.mock` of `internalCache` anywhere in `ludicCache/`.
 *
 * **The realistic same-host fold case, confirmed with the plan's author (2026-09-18):** a ROOM
 * cannot itself carry more than one presence binding (rooms are not multi-hosted, and may never
 * be, being character-viewpoint atomics) --- `mergeReducer.test.ts`'s `foldSameHostBuckets`
 * fixtures, which put several buckets directly on a room's own graph, encode a scenario that
 * cannot arise from a real write. The real case is a **multi-hosted child**: an object present
 * inside two different containing objects at once carries two presence bindings on its OWN
 * graph (one per parent, minted by `presenceBindingStepsForMove` onto the mover's own item), and
 * an edge inside *that child's own interior* can straddle those two bindings. `objZ` below is
 * that child --- present inside both `objX` and `objY`, with an interior `pebble1 -Under->
 * pebble2` edge split across its two bindings' covers.
 */
import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphStructureNode, EphemeraPresenceCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import { EphemeraLudicGraph } from '../ludicGraph'
import { testLudicGraph } from '../ludicGraph/testFixtures'
import { buildLudicCache } from './fold'

const roomA = 'ROOM#A' as EphemeraRoomId
const objX = 'OBJECT#X' as EphemeraObjectId
const objY = 'OBJECT#Y' as EphemeraObjectId
const objZ = 'OBJECT#Z' as EphemeraObjectId
const pebble1 = 'OBJECT#Pebble1' as EphemeraObjectId
const pebble2 = 'OBJECT#Pebble2' as EphemeraObjectId
const boxId = 'OBJECT#Box' as EphemeraObjectId
const boulder = 'OBJECT#Boulder' as EphemeraObjectId
const pebble = 'OBJECT#Pebble' as EphemeraObjectId

const enumeratedCover = (...hosts: EphemeraMembershipHostId[]): EphemeraPresenceCover => ({
    tag: 'Enumerated',
    members: hosts.map((host) => ({ host, presence: `PRESENCE#${host}-binding` as EphemeraPresenceNodeId })),
})

/** A presence binding minted on ITS OWN graph (`presenceBindingStepsForMove.ts`'s convention):
 * `hostId` is the mover, `fromHostId` is the parent it's now present at. */
const presenceNode = (
    uuid: string,
    fromHostId: EphemeraMembershipHostId,
    cover: EphemeraPresenceCover
): EphemeraLudicGraphStructureNode => ({
    tag: 'Presence',
    universalKey: PresenceKey(uuid),
    fromHostId,
    cover,
})

const testAssetUUID = 'ASSET#test'

const noShortNameDeps = () => ({
    getComponentAggregate: jest.fn(async () => []),
    getImprovisationObject: jest.fn(async () => undefined),
})

describe('buildLudicCache', () => {
    it('folds a multi-hosted child\'s own straddling interior edge and stitches every host\'s component/presence nodes into one cache', async () => {
        const roomGraph = testLudicGraph(roomA, {
            nodes: [
                { tag: 'Room', universalKey: roomA },
                { tag: 'Object', universalKey: objX },
                { tag: 'Object', universalKey: objY },
            ],
        })
        const xGraph = testLudicGraph(objX, {
            nodes: [
                { tag: 'Object', universalKey: objX },
                { tag: 'Object', universalKey: objZ },
                presenceNode('x_to_room', roomA, enumeratedCover(objZ)),
            ],
        })
        const yGraph = testLudicGraph(objY, {
            nodes: [
                { tag: 'Object', universalKey: objY },
                { tag: 'Object', universalKey: objZ },
                presenceNode('y_to_room', roomA, enumeratedCover(objZ)),
            ],
        })
        const zGraph = testLudicGraph(objZ, {
            nodes: [
                { tag: 'Object', universalKey: objZ },
                { tag: 'Object', universalKey: pebble1 },
                { tag: 'Object', universalKey: pebble2 },
                presenceNode('z_at_x', objX, enumeratedCover(pebble1)),
                presenceNode('z_at_y', objY, enumeratedCover(pebble2)),
            ],
            edges: [{ tag: 'Relational', from: pebble1, to: pebble2, kind: 'Under' }],
        })
        const pebble1Graph = testLudicGraph(pebble1, { nodes: [{ tag: 'Object', universalKey: pebble1 }] })
        const pebble2Graph = testLudicGraph(pebble2, { nodes: [{ tag: 'Object', universalKey: pebble2 }] })

        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph], [objX, xGraph], [objY, yGraph], [objZ, zGraph],
            [pebble1, pebble1Graph], [pebble2, pebble2Graph],
        ])
        const getLudicGraph = async (hostId: EphemeraMembershipHostId) => {
            const graph = graphs.get(hostId)
            if (!graph) {
                throw new Error(`No fixture graph for ${hostId}`)
            }
            return graph
        }

        const shortNameDeps = noShortNameDeps()
        const { cache, stats } = await buildLudicCache(roomA, [testAssetUUID], { getLudicGraph, ...shortNameDeps })

        // Slice 5 (PC-3): stats pass through from enumerateLudicCacheShards unmodified. Six shards
        // fetched (roomA, objX, objY, objZ, pebble1, pebble2); deepest path is roomA -> objX -> objZ
        // -> pebble1 (or the objY/pebble2 twin), three hops.
        expect(stats).toEqual({ shardFetchCount: 6, maxDepth: 3 })

        expect(cache.hostId).toBe(roomA)

        // Component nodes: one per walked host, shortName resolved inline for objects
        // (placeholder --- the mock deps return nothing authored --- vs. the host's own id for
        // every non-object component, which never attempts the object resolver at all).
        expect(shortNameDeps.getComponentAggregate).toHaveBeenCalledTimes(5) // objX, objY, objZ, pebble1, pebble2
        expect(cache.nodes).toEqual(expect.arrayContaining([
            { tag: 'Room', universalKey: roomA, shortName: roomA },
            { tag: 'Object', universalKey: objX, shortName: objX },
            { tag: 'Object', universalKey: objY, shortName: objY },
            { tag: 'Object', universalKey: objZ, shortName: objZ },
            { tag: 'Object', universalKey: pebble1, shortName: pebble1 },
            { tag: 'Object', universalKey: pebble2, shortName: pebble2 },
        ]))

        // Presence cache nodes: X's and Y's own bindings to ROOM (each bringing objZ along), and
        // Z's own two bindings (each bringing one pebble along) --- four bindings total, none of
        // them a same-host straddle in themselves.
        expect(cache.nodes).toEqual(expect.arrayContaining([
            {
                tag: 'Presence', universalKey: 'PRESENCE#x_to_room', fromHostId: roomA, consolidated: true,
                cover: { tag: 'Enumerated', members: [{ host: objZ, presence: 'PRESENCE#x_to_room' }] },
            },
            {
                tag: 'Presence', universalKey: 'PRESENCE#y_to_room', fromHostId: roomA, consolidated: true,
                cover: { tag: 'Enumerated', members: [{ host: objZ, presence: 'PRESENCE#y_to_room' }] },
            },
            {
                tag: 'Presence', universalKey: 'PRESENCE#z_at_x', fromHostId: objX, consolidated: true,
                cover: { tag: 'Enumerated', members: [{ host: pebble1, presence: 'PRESENCE#z_at_x' }] },
            },
            {
                tag: 'Presence', universalKey: 'PRESENCE#z_at_y', fromHostId: objY, consolidated: true,
                cover: { tag: 'Enumerated', members: [{ host: pebble2, presence: 'PRESENCE#z_at_y' }] },
            },
        ]))

        // The payoff: objZ's own interior edge, split across its two bindings' covers, is
        // reassembled by foldSameHostBuckets --- this is what would come back stubbed on both
        // sides if the same-host fold were skipped or misapplied.
        expect(cache.edges).toEqual([
            { tag: 'Relational', from: pebble1, to: pebble2, kind: 'Under', supportedBy: [] },
        ])
    })

    // 3b: the one-way-walk failure this exists to rule out --- a crossing port whose matching leg
    // exists on only one side of the boundary must not be silently resolved into a wrong edge (or
    // resolved at all); it is incomplete data, correctly dropped, not a defect to paper over.
    it('does not invent an edge across a parent/child boundary when only one side carries a matching leg', async () => {
        const roomGraph = testLudicGraph(roomA, {
            nodes: [{ tag: 'Room', universalKey: roomA }, { tag: 'Object', universalKey: boulder }],
            // Deliberately NO parent-side leg naming boxId's port --- the child names a crossing
            // port and a leg touching it, but the parent's own leg is missing (mid-write, or a
            // genuine data gap).
        })
        const boxGraph = testLudicGraph(boxId, {
            nodes: [
                { tag: 'Object', universalKey: boxId },
                { tag: 'Object', universalKey: pebble },
                presenceNode('box_to_room', roomA, enumeratedCover()),
            ],
            edges: [{ tag: 'Relational', from: { owner: boxId, port: 'port_1' }, to: pebble, kind: 'On' }],
            ports: [{ portId: 'port_1', fromHostId: boxId, kind: 'On' }],
        })
        const boulderGraph = testLudicGraph(boulder, { nodes: [{ tag: 'Object', universalKey: boulder }] })
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph], [boxId, boxGraph], [boulder, boulderGraph],
        ])
        const getLudicGraph = async (hostId: EphemeraMembershipHostId) => {
            const graph = graphs.get(hostId)
            if (!graph) {
                throw new Error(`No fixture graph for ${hostId}`)
            }
            return graph
        }

        const { cache } = await buildLudicCache(roomA, [], { getLudicGraph, ...noShortNameDeps() })

        expect(cache.edges).toEqual([])
    })

    // Slice 5b: componentCacheNode's shortName resolution is the loop's only I/O and must run
    // concurrently across sibling hosts, not serialize behind the purely synchronous fold/collapse
    // pass that follows it.
    it('resolves sibling hosts\' shortNames concurrently rather than one at a time', async () => {
        const roomGraph = testLudicGraph(roomA, {
            nodes: [
                { tag: 'Room', universalKey: roomA },
                { tag: 'Object', universalKey: objX },
                { tag: 'Object', universalKey: objY },
            ],
        })
        const xGraph = testLudicGraph(objX, { nodes: [{ tag: 'Object', universalKey: objX }] })
        const yGraph = testLudicGraph(objY, { nodes: [{ tag: 'Object', universalKey: objY }] })
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph], [objX, xGraph], [objY, yGraph],
        ])
        const getLudicGraph = async (hostId: EphemeraMembershipHostId) => {
            const graph = graphs.get(hostId)
            if (!graph) {
                throw new Error(`No fixture graph for ${hostId}`)
            }
            return graph
        }

        let inFlight = 0
        let maxInFlight = 0
        const getComponentAggregate: ReturnType<typeof noShortNameDeps>['getComponentAggregate'] = jest.fn(async () => {
            inFlight += 1
            maxInFlight = Math.max(maxInFlight, inFlight)
            await Promise.resolve()
            inFlight -= 1
            return []
        })

        await buildLudicCache(roomA, [testAssetUUID], {
            getLudicGraph,
            getComponentAggregate,
            getImprovisationObject: jest.fn(async () => undefined),
        })

        // Two object hosts (objX, objY) each call getComponentAggregate once; a serialized loop
        // would never have both in flight together.
        expect(getComponentAggregate).toHaveBeenCalledTimes(2)
        expect(maxInFlight).toBe(2)
    })

    // 3e: idempotence/confluence --- a retried rebuild against the same underlying graphs must
    // not duplicate a node or grow supportedBy. Byte-identical, not merely equal after sorting,
    // since supportedBy's outer-list order is meaningful (LR-8).
    it('produces a byte-identical cache when run twice against the same graphs', async () => {
        const roomGraph = testLudicGraph(roomA, {
            nodes: [
                { tag: 'Room', universalKey: roomA },
                { tag: 'Object', universalKey: objX },
            ],
        })
        const xGraph = testLudicGraph(objX, {
            nodes: [
                { tag: 'Object', universalKey: objX },
                presenceNode('x_to_room', roomA, enumeratedCover()),
            ],
        })
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([[roomA, roomGraph], [objX, xGraph]])
        const getLudicGraph = async (hostId: EphemeraMembershipHostId) => {
            const graph = graphs.get(hostId)
            if (!graph) {
                throw new Error(`No fixture graph for ${hostId}`)
            }
            return graph
        }

        const deps = { getLudicGraph, ...noShortNameDeps() }
        const first = await buildLudicCache(roomA, [testAssetUUID], deps)
        const second = await buildLudicCache(roomA, [testAssetUUID], deps)

        expect(second).toEqual(first)
    })
})
