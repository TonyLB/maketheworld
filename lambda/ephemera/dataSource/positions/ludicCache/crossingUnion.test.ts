/**
 * Slice 0 evidence for foldAsUnion (`AGENT.foldAsUnion.planning.md`): character-to-room crossings, today's behavior
 * pinned, and the payoff as `it.failing`. Hand-authored graphs, injected deps, no `jest.mock`, as `actorUnion.test.ts`.
 *
 * The target model (FA-2): a participant's node is in the room's graph, the room walk never expands a character other
 * than its seed, and the actor's own walk joins in through the union. The payoff asserts through `unionLudicCaches`, the
 * function `buildActorLudicCache` composes with, since `ActorLudicCache` exposes no edges until Phase 2 designs that
 * boundary (AC-5).
 */
import { stripTypedKey } from '@tonylb/mtw-utilities/ts/types'

import type { EphemeraLudicGraph } from '../ludicGraph'
import { unionLudicCaches } from './actorCache'
import { buildLudicCache } from './fold'
import { foldSameHostBuckets } from './mergeReducer'
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

describe('character-to-room crossings: today\'s behavior (Slice 0 pins)', () => {
    it('the room\'s own fold keeps its legs to a participant\'s port, unchanged', () => {
        const roomGraph = actorCrossingGraphs().get(roomId) as EphemeraLudicGraph
        const { edges } = foldSameHostBuckets(roomGraph, roomGraph.presenceNodes.map((node) => presenceUuidFromKey(node.universalKey)))
        expect(edges).toEqual(expect.arrayContaining([tiedTo(tableId, tetherPort), tiedTo(tableId, leashPort)]))
    })

    it('the actor\'s fold drops its own leg from the crossing port', async () => {
        const actor = await fold(actorId)
        expect(actor.edges.some(namesPort(tetherPort))).toBe(false)
        expect(actor.edges).not.toEqual(expect.arrayContaining([tiedTo(tableId, bagId)]))
    })

    it('the room walk expands participants\' shards: held inventory and the joined crossings enter the room row (Slice 2 removes this)', async () => {
        const room = await fold(roomId)
        expect(nodeKeys(room)).toEqual(expect.arrayContaining([actorId, bagId, coinId, leashId]))
        expect(room.edges).toEqual(expect.arrayContaining([tiedTo(tableId, bagId), tiedTo(tableId, leashId)]))
    })
})

describe('character-to-room crossings: the payoff', () => {
    it.failing('the actor\'s cache joins its own crossing and keeps the other character\'s leg unmatched', async () => {
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
        // The other character is outside the union: its crossing stays an open leg.
        expect(union.edges).toEqual(expect.arrayContaining([tiedTo(tableId, leashPort)]))
    })
})
