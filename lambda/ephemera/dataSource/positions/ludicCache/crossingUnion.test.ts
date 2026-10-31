/**
 * Evidence for the crossing union (positions contract, "Cache edges keep unmatched crossing legs"): character-to-room crossings, today's behavior
 * pinned, and the payoff as `it.failing`. Hand-authored graphs, injected deps, no `jest.mock`, as `actorUnion.test.ts`.
 *
 * The model: a participant's node is in the room's graph, the room walk never expands a character other
 * than its seed, and the actor's own walk joins in through the union. The payoff asserts through `unionLudicCaches`, the
 * function `buildActorLudicCache` composes with, since `ActorLudicCache` exposes no edges until Phase 2 designs that
 * boundary (AC-5).
 */
import { stripTypedKey } from '@tonylb/mtw-utilities/ts/types'

import type { EphemeraLudicGraph } from '../ludicGraph'
import { unionLudicCaches } from './actorCache'
import { buildLudicCache } from './fold'
import { cacheFromHostGraph } from './cacheFromHostGraph'
import type { EphemeraLudicCacheData, EphemeraLudicCacheEdge } from './types'
import { actorCrossingGraphs, actorId, bagId, coinId, graphReader, leashId, leashPort, roomId, tableId, tetherPort } from './actorCacheTestFixtures'

const presenceUuidFromKey = stripTypedKey('PRESENCE')

const noShortNameDeps = () => ({ getComponentAggregate: jest.fn(async () => []) })

const fold = async (seed: typeof roomId | typeof actorId): Promise<EphemeraLudicCacheData> => (
    await buildLudicCache(seed, [], { getLudicGraph: graphReader(actorCrossingGraphs()), ...noShortNameDeps() })
).cache

const tiedTo = (from: unknown, to: unknown) => expect.objectContaining({ from, to, kind: 'Custom', relationLabel: 'tied to' })
const namesPort = (port: { owner: string; port: string }) => (edge: EphemeraLudicCacheEdge): boolean =>
    [edge.from, edge.to].some((terminal) => JSON.stringify(terminal) === JSON.stringify(port))
const nodeKeys = (cache: EphemeraLudicCacheData) => cache.nodes.map((node) => node.universalKey)

describe('character-to-room crossings: the halves (Slice 0 pins, updated by Slice 2)', () => {
    it('the room\'s own fold keeps its legs to a participant\'s port, unchanged', () => {
        const roomGraph = actorCrossingGraphs().get(roomId) as EphemeraLudicGraph
        const { edges } = cacheFromHostGraph(roomGraph, roomGraph.presenceNodes.map((node) => presenceUuidFromKey(node.universalKey)))
        expect(edges).toEqual(expect.arrayContaining([tiedTo(tableId, tetherPort), tiedTo(tableId, leashPort)]))
        // Each leg is held by the room's graph alone, so both of its ends sit there, the open port end included.
        expect(edges.filter(namesPort(tetherPort)).map((edge) => edge.endHosts)).toEqual([{ from: roomId, to: roomId }])
    })

    it('the actor\'s fold keeps its own leg from the crossing port, open', async () => {
        const actor = await fold(actorId)
        expect(actor.edges).toEqual(expect.arrayContaining([tiedTo(tetherPort, bagId)]))
        expect(actor.edges).not.toEqual(expect.arrayContaining([tiedTo(tableId, bagId)]))
    })

    it('the room walk never expands a participant\'s shard: its inventory and the unjoined legs stay in their own halves', async () => {
        const room = await fold(roomId)
        expect(nodeKeys(room)).not.toEqual(expect.arrayContaining([bagId]))
        expect(nodeKeys(room)).not.toContain(coinId)
        expect(nodeKeys(room)).not.toContain(leashId)
        expect(room.edges).toEqual(expect.arrayContaining([tiedTo(tableId, tetherPort), tiedTo(tableId, leashPort)]))
        expect(room.edges).not.toEqual(expect.arrayContaining([tiedTo(tableId, bagId)]))
    })
})

describe('character-to-room crossings: the payoff', () => {
    it('the actor\'s cache joins its own crossing and keeps the other character\'s leg unmatched', async () => {
        const room = await fold(roomId)
        const actor = await fold(actorId)

        // The room row holds no character's inventory.
        expect(nodeKeys(room)).not.toContain(bagId)
        expect(nodeKeys(room)).not.toContain(coinId)
        expect(nodeKeys(room)).not.toContain(leashId)

        const union = unionLudicCaches(room, actor)
        // The actor's crossing: one joined edge, no leg left over.
        expect(union.edges.filter((edge) => edge.from === tableId && edge.to === bagId)).toHaveLength(1)
        expect(union.edges.some(namesPort(tetherPort))).toBe(false)
        // The table end sits in the room's graph, the bag end in the actor's (`endHosts`, AC-7 (a)).
        expect(union.edges.find((edge) => edge.from === tableId && edge.to === bagId)?.endHosts).toEqual({ from: roomId, to: actorId })
        // The other character is outside the union: its crossing stays an open leg.
        expect(union.edges).toEqual(expect.arrayContaining([tiedTo(tableId, leashPort)]))
    })
})
