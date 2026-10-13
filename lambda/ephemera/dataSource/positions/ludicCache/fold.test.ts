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
 * graph (one per parent, written by `presenceBindingStepsForMove` onto the mover's own item), and
 * an edge inside *that child's own interior* can straddle those two bindings. `objZ` below is
 * that child --- present inside both `objX` and `objY`, with an interior `pebble1 -Custom: under->
 * pebble2` edge split across its two bindings' covers.
 */
import type { EphemeraAreaId, EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphStructureNode, EphemeraPresenceCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { StandardFeature } from '@tonylb/mtw-wml/ts/standardize/components/feature'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'

import { EphemeraLudicGraph } from '../ludicGraph'
import { testLudicGraph } from '../ludicGraph/testFixtures'
import { buildLudicCache } from './fold'
import { isEphemeraLudicCacheData } from './types'
import { parentRemainderKey } from '../ludicGraph/testFixtures'

const roomA = 'ROOM#A' as EphemeraRoomId
const objX = 'OBJECT#X' as EphemeraObjectId
const objY = 'OBJECT#Y' as EphemeraObjectId
const objZ = 'OBJECT#Z' as EphemeraObjectId
const pebble1 = 'OBJECT#Pebble1' as EphemeraObjectId
const pebble2 = 'OBJECT#Pebble2' as EphemeraObjectId
const boxId = 'OBJECT#Box' as EphemeraObjectId
const boulder = 'OBJECT#Boulder' as EphemeraObjectId
const pebble = 'OBJECT#Pebble' as EphemeraObjectId

/** Each entry is a covered member and the uuid of that member's OWN binding into the cover's host. */
const enumeratedCover = (...entries: [EphemeraMembershipHostId, string][]): EphemeraPresenceCover => ({
    members: entries.map(([host, uuid]) => ({ host, presence: PresenceKey(uuid) as EphemeraPresenceNodeId })),
})

/** A presence binding held on ITS OWN graph (`presenceBindingStepsForMove.ts`'s convention):
 * `hostId` is the mover, `parentHost` is the parent it's now present at. */
const presenceNode = (
    uuid: string,
    parentHost: EphemeraMembershipHostId,
    cover: EphemeraPresenceCover
): EphemeraLudicGraphStructureNode => ({
    tag: 'Presence',
    universalKey: PresenceKey(uuid),
    fromHostPresence: { host: parentHost, presence: parentRemainderKey(parentHost) },
    cover,
})

const testAssetUUID = 'ASSET#test'

const noShortNameDeps = () => ({
    getComponentAggregate: jest.fn(async () => []),
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
                presenceNode('x_to_room', roomA, enumeratedCover([objZ, 'z_at_x'])),
            ],
        })
        const yGraph = testLudicGraph(objY, {
            nodes: [
                { tag: 'Object', universalKey: objY },
                { tag: 'Object', universalKey: objZ },
                presenceNode('y_to_room', roomA, enumeratedCover([objZ, 'z_at_y'])),
            ],
        })
        const zGraph = testLudicGraph(objZ, {
            nodes: [
                { tag: 'Object', universalKey: objZ },
                { tag: 'Object', universalKey: pebble1 },
                { tag: 'Object', universalKey: pebble2 },
                presenceNode('z_at_x', objX, enumeratedCover([pebble1, 'p1_at_z'])),
                presenceNode('z_at_y', objY, enumeratedCover([pebble2, 'p2_at_z'])),
            ],
            edges: [{ tag: 'Relational', from: pebble1, to: pebble2, kind: 'Custom', relationLabel: 'under' }],
        })
        const pebble1Graph = testLudicGraph(pebble1, {
            nodes: [{ tag: 'Object', universalKey: pebble1 }, presenceNode('p1_at_z', objZ, enumeratedCover())],
        })
        const pebble2Graph = testLudicGraph(pebble2, {
            nodes: [{ tag: 'Object', universalKey: pebble2 }, presenceNode('p2_at_z', objZ, enumeratedCover())],
        })

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

        // Component nodes: one per walked host, shortName resolved via the merged aggregate for
        // every kind alike (the mock deps return nothing authored, so all resolve unresolved/undefined).
        // Each carries its OWN bindings (PNR-1): X's and Y's into ROOM (each bringing objZ along),
        // Z's two (each bringing one pebble along), each pebble's into Z with an empty cover, and
        // the room none --- none of them a same-host straddle in themselves. Each cover entry
        // names the MEMBER's own binding into the covering binding's host (objZ is in X through
        // z_at_x), never the covering binding.
        expect(shortNameDeps.getComponentAggregate).toHaveBeenCalledTimes(6) // roomA, objX, objY, objZ, pebble1, pebble2
        const binding = (uuid: string, parentHost: EphemeraMembershipHostId, members: { host: EphemeraMembershipHostId, presence: string }[]) => ({
            tag: 'Presence', universalKey: PresenceKey(uuid), fromHostPresence: { host: parentHost, presence: parentRemainderKey(parentHost) },
            cover: { members },
        })
        expect(cache.nodes).toHaveLength(6)
        expect(cache.nodes).toEqual(expect.arrayContaining([
            { tag: 'Room', universalKey: roomA, presenceNodes: [] },
            { tag: 'Object', universalKey: objX, presenceNodes: [binding('x_to_room', roomA, [{ host: objZ, presence: 'PRESENCE#z_at_x' }])] },
            { tag: 'Object', universalKey: objY, presenceNodes: [binding('y_to_room', roomA, [{ host: objZ, presence: 'PRESENCE#z_at_y' }])] },
            {
                tag: 'Object',
                universalKey: objZ,
                presenceNodes: [
                    binding('z_at_x', objX, [{ host: pebble1, presence: 'PRESENCE#p1_at_z' }]),
                    binding('z_at_y', objY, [{ host: pebble2, presence: 'PRESENCE#p2_at_z' }]),
                ],
            },
            { tag: 'Object', universalKey: pebble1, presenceNodes: [binding('p1_at_z', objZ, [])] },
            { tag: 'Object', universalKey: pebble2, presenceNodes: [binding('p2_at_z', objZ, [])] },
        ]))
        // The first run of the guard over real fold output: every cover entry resolves by path.
        expect(isEphemeraLudicCacheData(cache)).toBe(true)

        // The payoff: objZ's own interior edge, split across its two bindings' covers, is
        // reassembled by foldSameHostBuckets --- this is what would come back stubbed on both
        // sides if the same-host fold were skipped or misapplied.
        expect(cache.edges).toEqual([
            { tag: 'Relational', from: pebble1, to: pebble2, kind: 'Custom', relationLabel: 'under' },
        ])
    })

    // A graph-side 'Full' cover (what every move writes) has no entries; the fold expands it and
    // looks each member's own binding up in the member's graph. A member bound in twice gets an
    // entry per binding; a member with no binding into the host (placed without a move, so none
    // was ever minted) stays covered with `presence` absent (PNR-3).
    it('expands a Full cover to each member\'s own bindings into the host', async () => {
        const objW = 'OBJECT#W' as EphemeraObjectId
        const roomGraph = testLudicGraph(roomA, {
            nodes: [{ tag: 'Room', universalKey: roomA }, { tag: 'Object', universalKey: objX }],
        })
        const xGraph = testLudicGraph(objX, {
            nodes: [
                { tag: 'Object', universalKey: objX },
                { tag: 'Object', universalKey: objZ },
                { tag: 'Object', universalKey: objW },
                presenceNode('x_to_room', roomA, { members: [{ tag: 'Remainder' }] }),
            ],
        })
        const zGraph = testLudicGraph(objZ, {
            nodes: [
                { tag: 'Object', universalKey: objZ },
                presenceNode('z_at_x_1', objX, { members: [{ tag: 'Remainder' }] }),
                presenceNode('z_at_x_2', objX, { members: [{ tag: 'Remainder' }] }),
            ],
        })
        const wGraph = testLudicGraph(objW, { nodes: [{ tag: 'Object', universalKey: objW }] })
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([[roomA, roomGraph], [objX, xGraph], [objZ, zGraph], [objW, wGraph]])
        const getLudicGraph = async (hostId: EphemeraMembershipHostId) => {
            const graph = graphs.get(hostId)
            if (!graph) {
                throw new Error(`No fixture graph for ${hostId}`)
            }
            return graph
        }

        const { cache } = await buildLudicCache(roomA, [testAssetUUID], { getLudicGraph, ...noShortNameDeps() })

        const xBinding = cache.nodes.find((node) => node.universalKey === objX)?.presenceNodes
            .find((presenceNode) => presenceNode.universalKey === 'PRESENCE#x_to_room')
        expect(xBinding).toEqual({
            tag: 'Presence', universalKey: 'PRESENCE#x_to_room', fromHostPresence: { host: roomA, presence: parentRemainderKey(roomA) },
            cover: {
                members: expect.arrayContaining([
                    { host: objZ, presence: 'PRESENCE#z_at_x_1' },
                    { host: objZ, presence: 'PRESENCE#z_at_x_2' },
                    { host: objW },
                ]),
            },
        })
        expect(xBinding?.cover.members).toHaveLength(3)
        expect(isEphemeraLudicCacheData(cache)).toBe(true)
    })

    // `A` holds B, C and other stuff, with presences { B, Remainder } and { C, Remainder }.
    // Each remainder expands against the whole's claimed set, so B never leaks into P2 nor C into P1.
    it('expands several remainders against the claimed set, not each binding\'s own list', async () => {
        const objB = 'OBJECT#B' as EphemeraObjectId
        const objC = 'OBJECT#C' as EphemeraObjectId
        const objD = 'OBJECT#D' as EphemeraObjectId
        const roomGraph = testLudicGraph(roomA, {
            nodes: [{ tag: 'Room', universalKey: roomA }, { tag: 'Object', universalKey: objX }],
        })
        const xGraph = testLudicGraph(objX, {
            nodes: [
                { tag: 'Object', universalKey: objX },
                { tag: 'Object', universalKey: objB },
                { tag: 'Object', universalKey: objC },
                { tag: 'Object', universalKey: objD },
                presenceNode('p1', roomA, { members: [{ host: objB, presence: 'PRESENCE#b_in_p1' as EphemeraPresenceNodeId }, { tag: 'Remainder' }] }),
                presenceNode('p2', roomA, { members: [{ host: objC, presence: 'PRESENCE#c_in_p2' as EphemeraPresenceNodeId }, { tag: 'Remainder' }] }),
            ],
        })
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph], [objX, xGraph],
            ...[objB, objC, objD].map((id): [EphemeraMembershipHostId, EphemeraLudicGraph] => [id, testLudicGraph(id, { nodes: [{ tag: 'Object', universalKey: id }] })]),
        ])
        const getLudicGraph = async (hostId: EphemeraMembershipHostId) => {
            const graph = graphs.get(hostId)
            if (!graph) {
                throw new Error(`No fixture graph for ${hostId}`)
            }
            return graph
        }

        const { cache } = await buildLudicCache(roomA, [testAssetUUID], { getLudicGraph, ...noShortNameDeps() })

        const bindings = cache.nodes.find((node) => node.universalKey === objX)?.presenceNodes ?? []
        expect(bindings.find((binding) => binding.universalKey === 'PRESENCE#p1')?.cover.members).toEqual([
            { host: objB, presence: 'PRESENCE#b_in_p1' },
            { host: objD },
        ])
        expect(bindings.find((binding) => binding.universalKey === 'PRESENCE#p2')?.cover.members).toEqual([
            { host: objC, presence: 'PRESENCE#c_in_p2' },
            { host: objD },
        ])
    })

    // The room rule (PR-21(f)), as population stores it: the room's hostless remainder holds its
    // contents and its Area binding is a carve-out with no members. The fold keeps both as stored.
    it('keeps a room\'s empty Area carve-out empty while its hostless remainder holds its contents', async () => {
        const town = 'AREA#Town' as EphemeraAreaId
        const roomGraph = testLudicGraph(roomA, {
            nodes: [
                { tag: 'Room', universalKey: roomA },
                { tag: 'Object', universalKey: objX },
                { tag: 'Presence', universalKey: PresenceKey('a_root'), cover: { members: [{ tag: 'Remainder' }] } },
                presenceNode('a_in_town', town, { members: [] }),
            ],
        })
        const xGraph = testLudicGraph(objX, { nodes: [{ tag: 'Object', universalKey: objX }] })
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([[roomA, roomGraph], [objX, xGraph]])
        const getLudicGraph = async (hostId: EphemeraMembershipHostId) => graphs.get(hostId) as EphemeraLudicGraph

        const { cache } = await buildLudicCache(roomA, [testAssetUUID], { getLudicGraph, ...noShortNameDeps() })

        const roomBindings = cache.nodes.find((node) => node.universalKey === roomA)?.presenceNodes ?? []
        expect(roomBindings).toEqual([
            { tag: 'Presence', universalKey: 'PRESENCE#a_root', cover: { members: [{ host: objX }] } },
            { tag: 'Presence', universalKey: 'PRESENCE#a_in_town', fromHostPresence: { host: town, presence: parentRemainderKey(town) }, cover: { members: [] } },
        ])
        expect(isEphemeraLudicCacheData(cache)).toBe(true)
    })

    // A non-room seed: the seed's own bindings nest on the seed's node, like any walked host's.
    // A binding whose cover holds nothing still names its owner --- the node it sits on.
    it('nests an object seed\'s own bindings on the seed node, including one with an empty cover', async () => {
        const roomB = 'ROOM#B' as EphemeraRoomId
        const xGraph = testLudicGraph(objX, {
            nodes: [
                { tag: 'Object', universalKey: objX },
                { tag: 'Object', universalKey: objZ },
                presenceNode('x_to_room_a', roomA, enumeratedCover()),
                presenceNode('x_to_room_b', roomB, { members: [{ tag: 'Remainder' }] }),
            ],
        })
        const zGraph = testLudicGraph(objZ, {
            nodes: [{ tag: 'Object', universalKey: objZ }, presenceNode('z_in_x', objX, { members: [{ tag: 'Remainder' }] })],
        })
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([[objX, xGraph], [objZ, zGraph]])
        const getLudicGraph = async (hostId: EphemeraMembershipHostId) => {
            const graph = graphs.get(hostId)
            if (!graph) {
                throw new Error(`No fixture graph for ${hostId}`)
            }
            return graph
        }

        const { cache } = await buildLudicCache(objX, [testAssetUUID], { getLudicGraph, ...noShortNameDeps() })

        expect(cache.nodes).toEqual([
            {
                tag: 'Object',
                universalKey: objX,
                presenceNodes: [
                    {
                        tag: 'Presence', universalKey: 'PRESENCE#x_to_room_a', fromHostPresence: { host: roomA, presence: parentRemainderKey(roomA) },
                        cover: { members: [] },
                    },
                    {
                        tag: 'Presence', universalKey: 'PRESENCE#x_to_room_b', fromHostPresence: { host: roomB, presence: parentRemainderKey(roomB) },
                        cover: { members: [{ host: objZ, presence: 'PRESENCE#z_in_x' }] },
                    },
                ],
            },
            {
                tag: 'Object',
                universalKey: objZ,
                presenceNodes: [{
                    tag: 'Presence', universalKey: 'PRESENCE#z_in_x', fromHostPresence: { host: objX, presence: parentRemainderKey(objX) },
                    cover: { members: [] },
                }],
            },
        ])
        expect(isEphemeraLudicCacheData(cache)).toBe(true)
    })

    // A child bound twice into one host crosses at each binding, never only the first found: the
    // collapsed edge carries one route per binding, side by side (LR-8).
    it('collapses a crossing to one edge when a child is bound twice into the same host', async () => {
        const roomGraph = testLudicGraph(roomA, {
            nodes: [{ tag: 'Room', universalKey: roomA }, { tag: 'Object', universalKey: boulder }, { tag: 'Object', universalKey: boxId }],
            edges: [{ tag: 'Relational', from: boulder, to: { owner: boxId, port: 'port_1' }, kind: 'On' }],
        })
        const boxGraph = testLudicGraph(boxId, {
            nodes: [
                { tag: 'Object', universalKey: boxId },
                { tag: 'Object', universalKey: pebble },
                presenceNode('box_in_a_1', roomA, { members: [{ tag: 'Remainder' }] }),
                presenceNode('box_in_a_2', roomA, { members: [] }),
            ],
            edges: [{ tag: 'Relational', from: { owner: boxId, port: 'port_1' }, to: pebble, kind: 'On' }],
            ports: [{ portId: 'port_1', fromHostId: roomA, kind: 'On' }],
        })
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph], [boxId, boxGraph],
            [boulder, testLudicGraph(boulder, { nodes: [{ tag: 'Object', universalKey: boulder }] })],
            [pebble, testLudicGraph(pebble, { nodes: [{ tag: 'Object', universalKey: pebble }] })],
        ])
        const getLudicGraph = async (hostId: EphemeraMembershipHostId) => {
            const graph = graphs.get(hostId)
            if (!graph) {
                throw new Error(`No fixture graph for ${hostId}`)
            }
            return graph
        }

        const { cache } = await buildLudicCache(roomA, [], { getLudicGraph, ...noShortNameDeps() })

        // Two routes (one per binding of the box) collapse to one identity, so one edge.
        expect(cache.edges.filter((edge) => edge.from === boulder && edge.to === pebble)).toHaveLength(1)
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
        })

        // Three component hosts (roomA, objX, objY) each call getComponentAggregate once; a
        // serialized loop would never have all three in flight together.
        expect(getComponentAggregate).toHaveBeenCalledTimes(3)
        expect(maxInFlight).toBe(3)
    })

    // 3e: idempotence/confluence --- a retried rebuild against the same underlying graphs must
    // not duplicate a node or an edge. Byte-identical, not merely equal after sorting.
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

    // `shortName` resolves for every cache kind, not only Object ---
    // the generalized `resolveComponentShortName` covers Room/Feature/Object alike via the same
    // merged-aggregate mechanism. Character is exercised separately below: a character present
    // as a MEMBER of another host's graph is deliberately never walked (`enumerateShards.ts`'s
    // "never recursed into" guard, unrelated to this slice), so this scenario uses Feature and
    // Object as the non-seed members --- both kinds the walk does visit.
    it('resolves shortName for a room, a feature, and an object hosted in the same room', async () => {
        const featureId = 'FEATURE#Statue' as EphemeraFeatureId

        const roomGraph = testLudicGraph(roomA, {
            nodes: [
                { tag: 'Room', universalKey: roomA },
                { tag: 'Feature', universalKey: featureId },
                { tag: 'Object', universalKey: boxId },
            ],
        })
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph],
            [featureId, testLudicGraph(featureId, { nodes: [{ tag: 'Feature', universalKey: featureId }] })],
            [boxId, testLudicGraph(boxId, { nodes: [{ tag: 'Object', universalKey: boxId }] })],
        ])
        const getLudicGraph = async (hostId: EphemeraMembershipHostId) => {
            const graph = graphs.get(hostId)
            if (!graph) {
                throw new Error(`No fixture graph for ${hostId}`)
            }
            return graph
        }

        const componentByKey: Record<string, StandardComponent> = {
            [roomA]: new StandardRoom({ tag: 'Room', shortName: 'a quiet courtyard' }),
            [featureId]: new StandardFeature({ tag: 'Feature', shortName: 'a weathered statue', gloss: 'chipped marble, missing a hand' }),
            [boxId]: new StandardObject({ tag: 'Object', shortName: 'a wooden box', gloss: 'battered tin, dented lid' }),
        }
        const getComponentAggregate = jest.fn(async (
            [perspective]: { universalKey: string, mergeParticipationOrder: readonly `ASSET#${string}`[] }[]
        ) => {
            const component = componentByKey[perspective.universalKey]
            return component
                ? [mergedComponentResult({
                    universalKey: perspective.universalKey as EphemeraObjectId,
                    merged: component,
                    mergeParticipationOrderApplied: perspective.mergeParticipationOrder,
                })]
                : []
        })

        const { cache } = await buildLudicCache(roomA, [testAssetUUID], { getLudicGraph, getComponentAggregate })

        expect(cache.nodes).toEqual(expect.arrayContaining([
            { tag: 'Room', universalKey: roomA, shortName: 'a quiet courtyard', presenceNodes: [] },
            { tag: 'Feature', universalKey: featureId, shortName: 'a weathered statue', gloss: 'chipped marble, missing a hand', presenceNodes: [] },
            { tag: 'Object', universalKey: boxId, shortName: 'a wooden box', gloss: 'battered tin, dented lid', presenceNodes: [] },
        ]))
        // The room was given no Gloss, so its cache node has none --- absence, not an empty string sentinel.
        const roomNode = cache.nodes.find((node) => node.universalKey === roomA)
        expect((roomNode as { gloss?: string } | undefined)?.gloss).toBeUndefined()
    })

    // The seed itself is always walked regardless of kind (`enumerateShards.ts`'s exemption for
    // the seed from the character-recursion guard), so a character-seeded cache --- the shape a
    // future held-inventory-style cache would build --- resolves the character's own shortName.
    it('resolves shortName for a character-seeded cache', async () => {
        const characterId = 'CHARACTER#Guide' as EphemeraCharacterId
        const characterGraph = testLudicGraph(characterId, { nodes: [{ tag: 'Character', universalKey: characterId }] })
        const getLudicGraph = async (hostId: EphemeraMembershipHostId) => {
            if (hostId !== characterId) {
                throw new Error(`No fixture graph for ${hostId}`)
            }
            return characterGraph
        }
        const getComponentAggregate = jest.fn(async (
            [perspective]: { universalKey: string, mergeParticipationOrder: readonly `ASSET#${string}`[] }[]
        ) => [mergedComponentResult({
            universalKey: perspective.universalKey as EphemeraCharacterId,
            merged: new StandardCharacter({ tag: 'Character', shortName: 'a friendly guide' }),
            mergeParticipationOrderApplied: perspective.mergeParticipationOrder,
        })])

        const { cache } = await buildLudicCache(characterId, [testAssetUUID], { getLudicGraph, getComponentAggregate })

        expect(cache.nodes).toEqual(expect.arrayContaining([
            { tag: 'Character', universalKey: characterId, shortName: 'a friendly guide', presenceNodes: [] },
        ]))
    })
})
