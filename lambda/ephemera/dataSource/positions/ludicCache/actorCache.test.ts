/**
 * The actor's cache (ISS8314, `AGENT.actorCache.planning.md`, Slice 1): the stored room row unioned with a fold seeded at
 * the actor. Hand-authored graphs, no `jest.mock`, injected deps, as `actorUnion.test.ts`.
 */
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { mergedComponentResult, type ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import { buildActorLudicCache, unionLudicCaches } from './actorCache'
import { buildLudicCache } from './fold'
import { readLudicCacheWithOutcome } from './store'
import type { EphemeraLudicCacheData } from './types'
import { actorCacheGraphs, actorId, bagId, coinId, graphReader, lampId, ropeAtTable, ropeHeld, ropeId, roomId, tableId } from './actorCacheTestFixtures'

/** Names each object for its id, with `overrides` for chosen ones. */
const aggregateNamed = (overrides: Record<string, string> = {}): ComponentAggregateMergedCache['get'] => async ([perspective]) => [mergedComponentResult({
    universalKey: perspective.universalKey as EphemeraObjectId,
    merged: new StandardObject({ tag: 'Object', shortName: overrides[perspective.universalKey] ?? perspective.universalKey.replace('OBJECT#', '').toLowerCase() }),
    mergeParticipationOrderApplied: perspective.mergeParticipationOrder,
})]

const roomRow = async (names: Record<string, string> = {}): Promise<EphemeraLudicCacheData> => (
    await buildLudicCache(roomId, [], { getLudicGraph: graphReader(actorCacheGraphs()), getComponentAggregate: aggregateNamed(names) })
).cache

const build = async (room: EphemeraLudicCacheData, actorNames: Record<string, string> = {}, extra: Parameters<typeof buildActorLudicCache>[2] = {}) => buildActorLudicCache(actorId, roomId, {
    readLudicCache: async () => ({ cache: room, outcome: 'hit' }),
    resolveCanonStack: async () => ['ASSET#Canon'],
    buildDeps: { getLudicGraph: graphReader(actorCacheGraphs()), getComponentAggregate: aggregateNamed(actorNames) },
    ...extra,
})

describe('buildActorLudicCache', () => {
    afterEach(() => jest.restoreAllMocks())

    it('reaches the room and the hand, with `rooms` resolved for each held part', async () => {
        const cache = await build(await roomRow())
        const handles = cache.handles()
        const placementOf = (objectId: string) => handles.find((handle) => handle.objectId === objectId)?.placement
        const roomsOf = (objectId: string, presence: string) => placementOf(objectId)?.find((run) => run.host === objectId)?.bindings.find((binding) => binding.presence === presence)?.rooms

        expect(handles.map((handle) => handle.objectId)).toEqual(expect.arrayContaining([tableId, bagId, coinId, ropeId]))
        expect(handles.every((handle) => handle.shortName.length > 0)).toBe(true)
        // The table-tied part resolves only because the room half supplies the table.
        expect(roomsOf(ropeId, ropeAtTable)).toEqual([roomId])
        expect(roomsOf(ropeId, ropeHeld)).toEqual([roomId])
    })

    it('names the wholly held objects: nested in held is held, half-held and room objects are not (AC-3)', async () => {
        const cache = await build(await roomRow())
        const held = cache.heldObjectIds()

        expect(held.has(bagId)).toBe(true)
        expect(held.has(coinId)).toBe(true)
        expect(held.has(ropeId)).toBe(false)
        expect(held.has(tableId)).toBe(false)
    })

    it('lets the actor half\'s node win a collision (AC-4)', async () => {
        const cache = await build(await roomRow({ [ropeId]: 'room rope' }), { [ropeId]: 'actor rope' })
        expect(cache.handles().find((handle) => handle.objectId === ropeId)?.shortName).toBe('actor rope')
    })

    it('never writes the room row, and leaves the room cache unchanged', async () => {
        const room = await roomRow()
        const before = JSON.parse(JSON.stringify(room))
        const writeRow = jest.fn(async () => true)
        const readRows = jest.fn(async () => ({ version: 1, row: { builtAtVersion: 1, cache: room } }))
        const cache = await build(room, {}, {
            readLudicCache: (id, deps) => readLudicCacheWithOutcome(id, { ...deps, readRows, writeRow }),
        })

        expect(room.nodes.map((node) => node.universalKey)).not.toContain(bagId)
        expect(cache.handles().map((handle) => handle.objectId)).toContain(coinId)
        expect(writeRow).not.toHaveBeenCalled()
        expect(room).toEqual(before)
    })

    it('names the actor half with the room\'s Canon stack, and reads the ordinary graphs (AC-2, AC-4)', async () => {
        const resolveCanonStack = jest.fn(async () => ['ASSET#Canon'])
        const buildSpy = jest.fn(buildLudicCache)
        const buildDeps = { getLudicGraph: graphReader(actorCacheGraphs()), getComponentAggregate: aggregateNamed() }
        await build(await roomRow(), {}, { resolveCanonStack, build: buildSpy, buildDeps })

        expect(resolveCanonStack).toHaveBeenCalledWith(roomId)
        expect(buildSpy).toHaveBeenCalledWith(actorId, ['ASSET#Canon'], buildDeps)
    })

    it('reads the stored row as the command reader, and logs each half with counts, never cache structure', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
        const room = await roomRow()
        const readLudicCache = jest.fn(async () => ({ cache: room, outcome: 'hit' as const }))
        await build(room, {}, { readLudicCache })

        expect(readLudicCache).toHaveBeenCalledWith(roomId, { reader: 'command' })
        const lines = log.mock.calls.map(([, fields]) => fields as Record<string, unknown>)
        expect(lines.find((fields) => fields?.seedHostId === roomId)).toEqual(expect.objectContaining({ outcome: 'hit', objectCount: expect.any(Number) }))
        lines.forEach((fields) => {
            expect(fields).not.toHaveProperty('nodes')
            expect(fields).not.toHaveProperty('edges')
        })
    })

    it('logs the actor half\'s shard count and wall time', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
        await build(await roomRow())
        const actorLine = log.mock.calls.map(([, fields]) => fields).find((fields) => fields?.seedHostId === actorId)
        expect(actorLine).toEqual(expect.objectContaining({ outcome: 'cold', shardFetchCount: expect.any(Number), wallTimeMs: expect.any(Number) }))
    })
})

describe('ActorLudicCache.containersOf', () => {
    // What the stored membership adjacency says of the same world: the cache's ancestry must equal it (ISS8314 Slice 5).
    const adjacency: Record<string, string[]> = {
        [actorId]: [roomId],
        [bagId]: [actorId],
        [coinId]: [bagId],
        [tableId]: [roomId],
        [lampId]: [tableId],
        [ropeId]: [tableId, actorId],
    }

    it.each(Object.entries(adjacency))('answers %s as the stored adjacency does', async (id, containers) => {
        const cache = await build(await roomRow())

        expect([...cache.containersOf(id as never)].sort()).toEqual([...containers].sort())
    })

    it('has no containers for a room, or for a node the cache does not hold', async () => {
        const cache = await build(await roomRow())

        expect(cache.containersOf(roomId)).toEqual([])
        expect(cache.containersOf('OBJECT#Absent' as never)).toEqual([])
    })
})

describe('unionLudicCaches', () => {
    it('keeps an edge held by both halves once', async () => {
        const room = await roomRow()
        const { cache: actor } = await buildLudicCache(actorId, [], { getLudicGraph: graphReader(actorCacheGraphs()), getComponentAggregate: aggregateNamed() })
        const shared = room.edges[0]
        const union = unionLudicCaches({ ...room, edges: room.edges }, { ...actor, edges: [...actor.edges, shared] })
        expect(union.edges.filter((edge) => JSON.stringify(edge) === JSON.stringify(shared))).toHaveLength(1)
    })
})
