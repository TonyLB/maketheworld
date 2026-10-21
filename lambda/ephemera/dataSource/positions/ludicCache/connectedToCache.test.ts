/**
 * A rope across two rooms, read by each room's `ludicCache`. The rope graph is the real output of
 * `extendSteps` plus a move of the new binding through `applyStepSequenceCore`, not a hand-written
 * fixture, so the producer's shape and the cache's reading of it cannot drift apart unseen.
 */
import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../ludicGraph'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../ludicGraph/testFixtures'
import { applyStepSequenceCore } from '../manipulation/kernel/applyStepSequenceCore'
import type { MutationKernelStep } from '../manipulation/kernel/kernelStep'
import { extendSteps } from '../manipulation/membership/extendSteps'
import { buildLudicCache } from './fold'
import { roomsInvalidatedByHosts } from './roomsInvalidatedByHosts'
import { isEphemeraLudicCacheData } from './types'

const roomA = 'ROOM#Bridge' as EphemeraRoomId
const roomB = 'ROOM#Galley' as EphemeraRoomId
const rope = 'OBJECT#Rope' as EphemeraObjectId
const presence = (name: string) => `PRESENCE#${name}` as EphemeraPresenceNodeId

// The room's root binding lists the rope by the rope's own binding, as a real rope placed by a move is.
const room = (id: EphemeraRoomId, held: [EphemeraObjectId, string][] = []) => testLudicGraph(id, {
    nodes: [
        ...held.map(([universalKey]) => ({ tag: 'Object' as const, universalKey })),
        presenceBindingNode(parentRemainderKey(id), undefined, {
            members: held.map(([host, binding]) => ({ host, presence: presence(binding) })),
        }),
    ],
})
const before = (): Map<EphemeraMembershipHostId, EphemeraLudicGraph> => new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
    [rope, testLudicGraph(rope, { nodes: [{ tag: 'Object', universalKey: rope }, presenceBindingNode('pA', roomA)] })],
    [roomA, room(roomA, [[rope, 'pA']])],
    [roomB, room(roomB)],
])
const moveNewBinding: MutationKernelStep = {
    kind: 'reparentPresenceBinding',
    hostId: rope,
    presence: presence('pB'),
    lose: [{ host: roomA, presence: parentRemainderKey(roomA) }],
    gain: [{ host: roomB, presence: parentRemainderKey(roomB) }],
}
const committed = (): Map<EphemeraMembershipHostId, EphemeraLudicGraph> => {
    const start = before()
    const outcome = applyStepSequenceCore(
        [...extendSteps({ hostId: rope, binding: start.get(rope)!.presenceNodes[0], presenceUuid: 'pB' }), moveNewBinding],
        start
    )
    if (outcome.verdict !== 'legal') { throw new Error(`expected legal, got ${JSON.stringify(outcome)}`) }
    return outcome.graphs as Map<EphemeraMembershipHostId, EphemeraLudicGraph>
}

const cacheFor = async (seed: EphemeraRoomId, graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph>) => {
    const getLudicGraph = async (hostId: EphemeraMembershipHostId) => {
        const graph = graphs.get(hostId)
        if (!graph) { throw new Error(`No fixture graph for ${hostId}`) }
        return graph
    }
    return (await buildLudicCache(seed, [], { getLudicGraph, getComponentAggregate: jest.fn(async () => []) })).cache
}

const bindingA = { owner: rope, port: presence('pA') }
const bindingB = { owner: rope, port: presence('pB') }

describe('ludicCache of a rope across two rooms', () => {
    it.each([[roomA], [roomB]])('carries the ConnectedTo edge, and both of the rope\'s bindings, in %s\'s cache', async (seed) => {
        const cache = await cacheFor(seed, committed())

        expect(isEphemeraLudicCacheData(cache)).toBe(true)
        // The stored row is read back through this guard after a JSON round trip.
        expect(isEphemeraLudicCacheData(JSON.parse(JSON.stringify(cache)))).toBe(true)
        expect(cache.edges).toHaveLength(1)
        const [edge] = cache.edges
        expect(edge.kind).toBe('ConnectedTo')
        expect([edge.from, edge.to]).toEqual(expect.arrayContaining([bindingA, bindingB]))
        // The far endpoint is not absent: the rope's shard folds whole, so both bindings are on its node.
        const ropeNode = cache.nodes.find((node) => node.universalKey === rope)!
        expect(ropeNode.presenceNodes.map((node) => node.universalKey).sort()).toEqual([presence('pA'), presence('pB')])
    })

    it('reads as the same fact from either room', async () => {
        const graphs = committed()

        const fromA = await cacheFor(roomA, graphs)
        const fromB = await cacheFor(roomB, graphs)

        const ropeNodeOf = (cache: typeof fromA) => cache.nodes.find((node) => node.universalKey === rope)
        expect(fromA.edges).toEqual(fromB.edges)
        expect(ropeNodeOf(fromA)).toEqual(ropeNodeOf(fromB))
    })

    it('holds one edge however the stored edge orders its endpoints', async () => {
        const graphs = committed()
        const ropeGraph = graphs.get(rope)!
        const [stored] = ropeGraph.relationalEdges
        const flipped = testLudicGraph(rope, {
            nodes: [{ tag: 'Object', universalKey: rope }, ...ropeGraph.presenceNodes],
            edges: [{ tag: 'Relational', from: stored.to, to: stored.from, kind: 'ConnectedTo' }],
        })

        const cache = await cacheFor(roomA, new Map(graphs).set(rope, flipped))

        expect(cache.edges).toHaveLength(1)
        expect(cache.edges[0].kind).toBe('ConnectedTo')
    })

    it('is byte-identical when built twice', async () => {
        const graphs = committed()

        expect(await cacheFor(roomA, graphs)).toEqual(await cacheFor(roomA, graphs))
    })

    it('marks both rooms stale when the rope\'s graph is written', async () => {
        const graphs = committed()

        const rooms = await roomsInvalidatedByHosts([rope], async (hostId) => graphs.get(hostId)!)

        expect([...rooms].sort()).toEqual([roomA, roomB].sort())
    })
})
