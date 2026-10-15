/**
 * Two kinds of test here. Most inject an in-memory row store through `ReadLudicCacheDeps` (the
 * monotonic write is reproduced in the fake, so the retry rule is exercised against the same
 * refusal Dynamo gives); the last block mocks `ephemeraDB` at its module path to pin the exact
 * requests `readLudicCache` makes (one consistent `getItems`, the conditional write, the consistent
 * graph read). `ephemeraDB`'s methods are spied, not the module replaced: `internalCache` builds its
 * own handlers from the real one at import.
 */
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { singleFlightFactory, SingleFlightFailedError } from '@tonylb/mtw-lambda-patterns/ts/singleFlight'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../internalCache'
import { EphemeraLudicGraph } from '../ludicGraph'
import { testLudicGraph } from '../ludicGraph/testFixtures'
import { buildLudicCache } from './fold'
import {
    LUDIC_CACHE_DATA_CATEGORY,
    LUDIC_CACHE_READ_MAX_ATTEMPTS,
    LUDIC_CACHE_VERSION_DATA_CATEGORY,
    getFreshLudicGraph,
    ludicCacheMarkerBumpItems,
    markLudicCacheStale,
    readLudicCache,
    readLudicCacheWithOutcome,
    type LudicCacheRow,
    type ReadLudicCacheDeps,
} from './store'
import type { EphemeraLudicCacheData } from './types'

const roomA = 'ROOM#A' as EphemeraRoomId
const boxId = 'OBJECT#Box' as EphemeraObjectId
const canonStack = ['ASSET#canon']

const fixtureGraphs = () => new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
    [roomA, testLudicGraph(roomA, { nodes: [{ tag: 'Room', universalKey: roomA }, { tag: 'Object', universalKey: boxId }] })],
    [boxId, testLudicGraph(boxId, { nodes: [{ tag: 'Object', universalKey: boxId }] })],
])

const freshGraph = (graphs = fixtureGraphs()) => jest.fn(async (hostId: EphemeraMembershipHostId) => graphs.get(hostId) as EphemeraLudicGraph)

/** Names by perspective: a stack holding the viewer's asset would name the box differently. */
const getComponentAggregate = jest.fn(async (
    [perspective]: { universalKey: string, mergeParticipationOrder: readonly `ASSET#${string}`[] }[]
) => {
    const viewerStack = perspective.mergeParticipationOrder.includes('ASSET#viewer')
    const merged = perspective.universalKey === roomA
        ? new StandardRoom({ tag: 'Room', shortName: 'a courtyard' })
        : new StandardObject({ tag: 'Object', shortName: viewerStack ? 'the viewer\'s box' : 'a wooden box' })
    return [mergedComponentResult({
        universalKey: perspective.universalKey as EphemeraObjectId,
        merged,
        mergeParticipationOrderApplied: perspective.mergeParticipationOrder,
    })]
})

const emptyCache = (marker: string): EphemeraLudicCacheData => ({ hostId: roomA, nodes: [{ tag: 'Room', universalKey: roomA, shortName: marker, presenceNodes: [] }], edges: [] })

/** In-memory rows with Dynamo's monotonic write semantics. Rows go through JSON, as they do through Dynamo. */
const makeStore = (initial: { version?: number; row?: { builtAtVersion: number; cache: EphemeraLudicCacheData } } = {}) => {
    const state = { version: initial.version ?? 0, row: initial.row }
    return {
        state,
        readRows: jest.fn(async () => ({ version: state.version, row: state.row })),
        writeRow: jest.fn(async (row: LudicCacheRow) => {
            if (state.row && state.row.builtAtVersion >= row.builtAtVersion) {
                return false
            }
            state.row = JSON.parse(JSON.stringify({ builtAtVersion: row.builtAtVersion, cache: row.cache }))
            return true
        }),
    }
}

const leader: NonNullable<ReadLudicCacheDeps['runSingleFlight']> = async ({ computation }) => computation()

const baseDeps = (store: ReturnType<typeof makeStore>, overrides: ReadLudicCacheDeps = {}): ReadLudicCacheDeps => ({
    readRows: store.readRows,
    writeRow: store.writeRow,
    getFreshLudicGraph: freshGraph(),
    resolveCanonStack: jest.fn(async () => canonStack),
    clearNameMemos: jest.fn(),
    buildDeps: { getComponentAggregate },
    runSingleFlight: leader,
    ...overrides,
})

describe('readLudicCache', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('returns a hit as is, reading no graphs and no names', async () => {
        const stored = emptyCache('stored')
        const store = makeStore({ version: 2, row: { builtAtVersion: 2, cache: stored } })
        const build = jest.fn()
        const deps = baseDeps(store, { build })
        const runSingleFlight = jest.fn(leader) as unknown as NonNullable<ReadLudicCacheDeps['runSingleFlight']>

        await expect(readLudicCache(roomA, { ...deps, runSingleFlight })).resolves.toBe(stored)

        expect(build).not.toHaveBeenCalled()
        expect(deps.getFreshLudicGraph).not.toHaveBeenCalled()
        expect(getComponentAggregate).not.toHaveBeenCalled()
        expect(runSingleFlight).not.toHaveBeenCalled()
        expect(store.writeRow).not.toHaveBeenCalled()
    })

    it('reports how the first read found the row: hit, stale, absent', async () => {
        const hit = makeStore({ version: 2, row: { builtAtVersion: 2, cache: emptyCache('stored') } })
        const stale = makeStore({ version: 3, row: { builtAtVersion: 2, cache: emptyCache('old') } })
        const absent = makeStore()

        await expect(readLudicCacheWithOutcome(roomA, baseDeps(hit))).resolves.toMatchObject({ outcome: 'hit' })
        await expect(readLudicCacheWithOutcome(roomA, baseDeps(stale))).resolves.toMatchObject({ outcome: 'stale' })
        await expect(readLudicCacheWithOutcome(roomA, baseDeps(absent))).resolves.toMatchObject({ outcome: 'absent' })
    })

    it('reports a row that fails its guard as malformed, not absent', async () => {
        const malformed = { ...makeStore({ version: 1 }), readRows: jest.fn(async () => ({ version: 1, malformed: true })) }
        const store = makeStore({ version: 1 })

        const result = await readLudicCacheWithOutcome(roomA, baseDeps(store, { readRows: malformed.readRows }))

        expect(result.outcome).toBe('malformed')
    })

    describe('the rebuild log line', () => {
        const storedRebuilds = (spy: jest.SpyInstance) => spy.mock.calls.filter(([, fields]) => fields?.event === 'stored-rebuild')

        it('is written by the read that rebuilds, whichever consumer it is, saying who paid and why', async () => {
            const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
            const store = makeStore({ version: 3, row: { builtAtVersion: 2, cache: emptyCache('old') } })

            await readLudicCache(roomA, { ...baseDeps(store), reader: 'header' })

            expect(storedRebuilds(spy)).toEqual([[
                '[mtw.ephemera.ludicCache] rebuild',
                expect.objectContaining({
                    event: 'stored-rebuild',
                    seedHostId: roomA,
                    reader: 'header',
                    cause: 'stale',
                    builtAtVersion: 3,
                    objectCount: 1,
                    shardFetchCount: 2,
                    maxDepth: 1,
                    wrote: true,
                    storedBytes: expect.any(Number),
                    wallTimeMs: expect.any(Number),
                }),
            ]])
            spy.mockRestore()
        })

        it('is not written by a hit, and the next reader then finds a hit', async () => {
            const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
            const store = makeStore({ version: 3, row: { builtAtVersion: 2, cache: emptyCache('old') } })
            await readLudicCache(roomA, { ...baseDeps(store), reader: 'header' })
            spy.mockClear()

            await expect(readLudicCacheWithOutcome(roomA, { ...baseDeps(store), reader: 'command' })).resolves.toMatchObject({ outcome: 'hit' })

            expect(storedRebuilds(spy)).toEqual([])
            spy.mockRestore()
        })

        it('says the write was refused when a newer row was already there', async () => {
            const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
            const store = makeStore({ version: 1 })
            store.writeRow.mockImplementationOnce(async () => {
                store.state.row = { builtAtVersion: 2, cache: emptyCache('newer') }
                return false
            })

            await readLudicCache(roomA, { ...baseDeps(store), reader: 'command' }).catch(() => undefined)

            expect(storedRebuilds(spy)[0][1]).toMatchObject({ reader: 'command', cause: 'absent', wrote: false })
            spy.mockRestore()
        })
    })

    it('rebuilds and writes an absent row, labelled with the marker version (absent marker is 0)', async () => {
        const store = makeStore()

        const cache = await readLudicCache(roomA, baseDeps(store))

        expect(cache.nodes.map(({ universalKey, shortName }) => [universalKey, shortName])).toEqual([[roomA, 'a courtyard'], [boxId, 'a wooden box']])
        expect(store.writeRow).toHaveBeenCalledTimes(1)
        expect(store.writeRow.mock.calls[0][0]).toMatchObject({ EphemeraId: roomA, DataCategory: LUDIC_CACHE_DATA_CATEGORY, builtAtVersion: 0 })
        // ...and the next read is a hit.
        const build = jest.fn()
        await expect(readLudicCache(roomA, baseDeps(store, { build }))).resolves.toEqual(cache)
        expect(build).not.toHaveBeenCalled()
    })

    it('rebuilds a row labelled with an older version than the marker, and never matches against it', async () => {
        const store = makeStore({ version: 3, row: { builtAtVersion: 2, cache: emptyCache('old') } })

        const cache = await readLudicCache(roomA, baseDeps(store))

        expect(cache.nodes.map(({ shortName }) => shortName)).toEqual(['a courtyard', 'a wooden box'])
        expect(store.writeRow.mock.calls[0][0]).toMatchObject({ builtAtVersion: 3 })
        expect(store.state.row?.builtAtVersion).toBe(3)
    })

    it('reads the marker first, then builds from the fresh reader and never from the Positions memo', async () => {
        const store = makeStore({ version: 1 })
        const order: string[] = []
        store.readRows.mockImplementation(async () => { order.push('marker'); return { version: store.state.version, row: store.state.row } })
        const graphs = fixtureGraphs()
        const fresh = jest.fn(async (hostId: EphemeraMembershipHostId) => { order.push(`graph ${hostId}`); return graphs.get(hostId) as EphemeraLudicGraph })
        const memo = jest.spyOn(internalCache.Positions, 'getLudicGraph')

        await readLudicCache(roomA, baseDeps(store, { getFreshLudicGraph: fresh }))

        expect(order[0]).toBe('marker')
        expect(fresh).toHaveBeenCalledTimes(2)
        // A graph memoized before another invocation's bump is not used to build a row labelled with the bumped version.
        expect(memo).not.toHaveBeenCalled()
        memo.mockRestore()
    })

    it('resolves names against the room\'s Canon stack, never a stack the caller could pass', async () => {
        const store = makeStore()
        const deps = baseDeps(store)

        const cache = await readLudicCache(roomA, deps)

        expect(deps.resolveCanonStack).toHaveBeenCalledWith(roomA)
        const stacks = getComponentAggregate.mock.calls.map(([[perspective]]) => perspective.mergeParticipationOrder)
        expect(stacks.length).toBeGreaterThan(0)
        stacks.forEach((stack) => expect(stack).not.toContain('ASSET#viewer'))
        expect(cache.nodes.find(({ universalKey }) => universalKey === boxId)?.shortName).toBe('a wooden box')
    })

    it('stored hit equals a cold build for the same fixture', async () => {
        const store = makeStore()
        await readLudicCache(roomA, baseDeps(store))

        const hit = await readLudicCache(roomA, baseDeps(store, { build: jest.fn() }))
        const { cache: cold } = await buildLudicCache(roomA, canonStack, { getLudicGraph: freshGraph(), getComponentAggregate })

        expect(hit).toEqual(cold)
    })

    it('a slow build of N whose write is refused by an N+1 row retries and returns the N+1 row', async () => {
        const store = makeStore({ version: 1 })
        const newer = emptyCache('newer')
        const build = jest.fn(async (...args: Parameters<typeof buildLudicCache>) => {
            // While this build runs, another invocation bumps the marker and writes version 2.
            store.state.version = 2
            store.state.row = { builtAtVersion: 2, cache: newer }
            return buildLudicCache(...args)
        })

        const result = await readLudicCache(roomA, baseDeps(store, { build: build as typeof buildLudicCache }))

        expect(result).toBe(newer)
        expect(await store.writeRow.mock.results[0].value).toBe(false)
        expect(build).toHaveBeenCalledTimes(1)
        expect(store.readRows).toHaveBeenCalledTimes(3) // first read, the refused write's re-read, then the retry's read (a hit)
    })

    it('a build of N that writes after the marker moved to N+1 returns N to its own callers', async () => {
        const store = makeStore({ version: 1 })
        const build = jest.fn(async (...args: Parameters<typeof buildLudicCache>) => {
            store.state.version = 2
            return buildLudicCache(...args)
        })

        const result = await readLudicCache(roomA, baseDeps(store, { build: build as typeof buildLudicCache }))

        // Labelled with the version this caller read: as current as a read a moment earlier. No retry.
        expect(build).toHaveBeenCalledTimes(1)
        expect(store.state.row?.builtAtVersion).toBe(1)
        expect(result.nodes.map(({ shortName }) => shortName)).toEqual(['a courtyard', 'a wooden box'])
        // Readers after it see a label below N+1 and rebuild.
        await readLudicCache(roomA, baseDeps(store))
        expect(store.state.row?.builtAtVersion).toBe(2)
    })

    it('a follower whose flight returns a row not labelled N starts again, and the retry bound holds', async () => {
        const store = makeStore({ version: 5 })
        const build = jest.fn()
        const runSingleFlight = jest.fn(async () => ({ builtAtVersion: 4, cache: emptyCache('behind') }))

        await expect(readLudicCache(roomA, baseDeps(store, { build, runSingleFlight: runSingleFlight as any }))).rejects.toThrow(/after \d+ attempts/)

        expect(store.readRows).toHaveBeenCalledTimes(LUDIC_CACHE_READ_MAX_ATTEMPTS)
        expect(runSingleFlight).toHaveBeenCalledTimes(LUDIC_CACHE_READ_MAX_ATTEMPTS)
        expect(build).not.toHaveBeenCalled()
    })

    it('a follower whose flight returns the row for N returns it', async () => {
        const store = makeStore({ version: 5 })
        const theirs = emptyCache('theirs')
        const runSingleFlight = jest.fn(async () => ({ builtAtVersion: 5, cache: theirs }))

        await expect(readLudicCache(roomA, baseDeps(store, { runSingleFlight: runSingleFlight as any }))).resolves.toBe(theirs)
        expect(runSingleFlight.mock.calls[0]).toEqual([expect.objectContaining({ argumentHash: `${roomA}::5` })])
    })

    it('treats a failed flight as a cache-update collision and surfaces the carried error past the bound', async () => {
        const store = makeStore({ version: 1 })
        let calls = 0
        const recovering = jest.fn(async (params: Parameters<typeof leader>[0]) => {
            calls++
            if (calls === 1) {
                throw new SingleFlightFailedError('Error: throttled')
            }
            return leader(params)
        })
        await expect(readLudicCache(roomA, baseDeps(store, { runSingleFlight: recovering as any }))).resolves.toEqual(expect.objectContaining({ hostId: roomA }))
        expect(recovering).toHaveBeenCalledTimes(2)

        const failing = jest.fn(async () => { throw new SingleFlightFailedError('Error: throttled') })
        const carried = await readLudicCache(roomA, baseDeps(makeStore({ version: 1 }), { runSingleFlight: failing as any })).catch((error) => error)
        expect(carried).toBeInstanceOf(SingleFlightFailedError)
        expect(carried.summary).toBe('Error: throttled')
        expect(failing).toHaveBeenCalledTimes(LUDIC_CACHE_READ_MAX_ATTEMPTS)
    })

    it('throws any other flight error without retrying', async () => {
        const store = makeStore()
        const runSingleFlight = jest.fn(async () => { throw new Error('boom') })

        await expect(readLudicCache(roomA, baseDeps(store, { runSingleFlight: runSingleFlight as any }))).rejects.toThrow('boom')
        expect(runSingleFlight).toHaveBeenCalledTimes(1)
    })

    it('the build step never throws a refused write out of singleFlight (the real factory marks no instance FAILED)', async () => {
        const records = new Map<string, any>()
        const keyOf = ({ Key }: any) => `${Key.EphemeraId}|${Key.DataCategory}`
        const run = singleFlightFactory<any>({
            getItemFunction: async (params: any) => records.get(keyOf(params)),
            optimisticUpdateFunction: async (params: any) => {
                const record = records.get(keyOf(params)) ?? { ...params.Key }
                params.updateReducer(record)
                records.set(keyOf(params), record)
                return record
            },
            primaryKey: 'EphemeraId',
            mode: 'coalesce',
        })
        const store = makeStore({ version: 1 })
        store.writeRow.mockImplementationOnce(async () => {
            // Another invocation's newer row lands first: this write is refused.
            store.state.row = { builtAtVersion: 2, cache: emptyCache('newer') }
            store.state.version = 2
            return false
        })

        const result = await readLudicCache(roomA, baseDeps(store, { runSingleFlight: run as any }))

        expect(result.nodes[0].shortName).toBe('newer')
        const instances = [...records.values()].flatMap(({ Instances }) => Instances ?? [])
        expect(instances.length).toBeGreaterThan(0)
        expect(instances.map(({ Status }: any) => Status)).not.toContain('FAILED')
    })
})

describe('name memos on a rebuild', () => {
    it('are dropped after the marker is read and before the Canon stack or any name is, and not at all on a hit', async () => {
        const order: string[] = []
        const store = makeStore({ version: 3 })
        store.readRows.mockImplementation(async () => { order.push('marker'); return { version: store.state.version, row: store.state.row } })
        const deps = baseDeps(store, {
            clearNameMemos: jest.fn(() => { order.push('clear') }),
            resolveCanonStack: jest.fn(async () => { order.push('stack'); return canonStack }),
            build: (async () => { order.push('build'); return { cache: emptyCache('built'), stats: { shardFetchCount: 1, maxDepth: 0 } } }) as any,
        })

        await readLudicCache(roomA, deps)
        expect(order).toEqual(['marker', 'clear', 'stack', 'build'])

        order.length = 0
        store.state.version = 3
        await readLudicCache(roomA, deps)
        expect(order).toEqual(['marker'])
    })

    it('by default clear every per-invocation memo a stored name is read through', async () => {
        const memos = [internalCache.RoomAssets, internalCache.AssetMetaData, internalCache.ComponentData, internalCache.ComponentVerticals, internalCache.ComponentAggregate]
        const spies = memos.map((memo) => jest.spyOn(memo, 'clear').mockImplementation(() => undefined))
        const { clearNameMemos: _unused, ...deps } = baseDeps(makeStore({ version: 1 }))

        await readLudicCache(roomA, deps)

        spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1))
        spies.forEach((spy) => spy.mockRestore())
    })
})

describe('the stored rows against Dynamo', () => {
    const mockedDB = {
        getItems: jest.spyOn(ephemeraDB, 'getItems') as unknown as jest.Mock,
        getItem: jest.spyOn(ephemeraDB, 'getItem') as unknown as jest.Mock,
        conditionalPutItem: jest.spyOn(ephemeraDB, 'conditionalPutItem') as unknown as jest.Mock,
    }

    beforeEach(() => {
        Object.values(mockedDB).forEach((mock) => mock.mockReset())
    })

    afterAll(() => {
        Object.values(mockedDB).forEach((mock) => mock.mockRestore())
    })

    const marker = (version: number) => ({ EphemeraId: roomA, DataCategory: LUDIC_CACHE_VERSION_DATA_CATEGORY, version })
    const row = (builtAtVersion: number, cache: unknown) => ({ EphemeraId: roomA, DataCategory: LUDIC_CACHE_DATA_CATEGORY, builtAtVersion, cache })

    it('reads both rows in one consistent getItems by exact key, and tells them apart by DataCategory whatever the order', async () => {
        const stored = emptyCache('stored')
        mockedDB.getItems.mockResolvedValueOnce([marker(4), row(4, stored)])
        await expect(readLudicCache(roomA)).resolves.toEqual(stored)

        mockedDB.getItems.mockResolvedValueOnce([row(7, stored), marker(7)])
        await expect(readLudicCache(roomA)).resolves.toEqual(stored)

        expect(mockedDB.getItems).toHaveBeenCalledTimes(2)
        expect(mockedDB.getItems.mock.calls[0][0]).toEqual({
            Keys: [
                { EphemeraId: roomA, DataCategory: LUDIC_CACHE_DATA_CATEGORY },
                { EphemeraId: roomA, DataCategory: LUDIC_CACHE_VERSION_DATA_CATEGORY },
            ],
            ConsistentRead: true,
            getAllFields: true,
        })
    })

    it('reads the characters row in the same getItems only when asked, and returns it with the cache', async () => {
        const stored = emptyCache('stored')
        const characters = { EphemeraId: roomA, DataCategory: 'LudicCache::Characters', complete: true, 'CHARACTER#Tess': ['PRESENCE#a'] }
        mockedDB.getItems.mockResolvedValueOnce([characters, marker(4), row(4, stored)])

        const asked = await readLudicCacheWithOutcome(roomA, { withCharacters: true })

        expect(mockedDB.getItems).toHaveBeenCalledTimes(1)
        expect(mockedDB.getItems.mock.calls[0][0].Keys).toEqual([
            { EphemeraId: roomA, DataCategory: LUDIC_CACHE_DATA_CATEGORY },
            { EphemeraId: roomA, DataCategory: LUDIC_CACHE_VERSION_DATA_CATEGORY },
            { EphemeraId: roomA, DataCategory: 'LudicCache::Characters' },
        ])
        expect(asked).toEqual({ cache: stored, outcome: 'hit', characters })

        mockedDB.getItems.mockResolvedValueOnce([marker(4), row(4, stored)])
        const notAsked = await readLudicCacheWithOutcome(roomA)
        expect(mockedDB.getItems.mock.calls[1][0].Keys).toHaveLength(2)
        expect(notAsked).not.toHaveProperty('characters')
    })

    it('returns no characters when the row is absent', async () => {
        mockedDB.getItems.mockResolvedValueOnce([marker(4), row(4, emptyCache('stored'))])

        expect(await readLudicCacheWithOutcome(roomA, { withCharacters: true })).not.toHaveProperty('characters')
    })

    it('treats a malformed row as absent and rebuilds it, never throwing', async () => {
        // First read: marker 2 beside a row that fails its guard. A flight (leader) then rebuilds.
        mockedDB.getItems.mockResolvedValue([marker(2), row(2, { hostId: 'not-a-host', nodes: 'nope' })])
        mockedDB.conditionalPutItem.mockResolvedValue(true)
        const build = jest.fn(async () => ({ cache: emptyCache('rebuilt'), stats: { shardFetchCount: 1, maxDepth: 0 } }))

        const result = await readLudicCache(roomA, {
            resolveCanonStack: async () => canonStack,
            build: build as any,
            runSingleFlight: leader,
        })

        expect(result.nodes[0].shortName).toBe('rebuilt')
        expect(build).toHaveBeenCalledTimes(1)
    })

    it('writes through the monotonic conditional put', async () => {
        mockedDB.getItems.mockResolvedValue([])
        mockedDB.conditionalPutItem.mockResolvedValue(true)

        await readLudicCache(roomA, {
            resolveCanonStack: async () => canonStack,
            build: (async () => ({ cache: emptyCache('x'), stats: { shardFetchCount: 1, maxDepth: 0 } })) as any,
            runSingleFlight: leader,
        })

        expect(mockedDB.conditionalPutItem).toHaveBeenCalledWith(
            expect.objectContaining({ EphemeraId: roomA, DataCategory: LUDIC_CACHE_DATA_CATEGORY, builtAtVersion: 0 }),
            { ConditionExpression: 'attribute_not_exists(builtAtVersion) OR builtAtVersion < :n', ExpressionAttributeValues: { ':n': 0 } }
        )
    })

    it('getFreshLudicGraph reads the host row strongly consistent and normalizes a missing graph as the gateway does', async () => {
        mockedDB.getItem.mockResolvedValueOnce(undefined)

        const graph = await getFreshLudicGraph(boxId)

        expect(mockedDB.getItem).toHaveBeenCalledWith({
            Key: { EphemeraId: boxId, DataCategory: 'Meta::Object' },
            ProjectionFields: ['ludicGraph'],
            ConsistentRead: true,
        })
        expect([...graph.nodeIds]).toEqual([boxId])
    })

    it('ludicCacheMarkerBumpItems is one ADD per room on the marker row', () => {
        expect(ludicCacheMarkerBumpItems([roomA])).toEqual([{
            PrimitiveUpdate: {
                Key: { EphemeraId: roomA, DataCategory: LUDIC_CACHE_VERSION_DATA_CATEGORY },
                ProjectionFields: ['version'],
                UpdateExpression: 'ADD version :one',
                ExpressionAttributeValues: { ':one': 1 },
            },
        }])
        expect(ludicCacheMarkerBumpItems([])).toEqual([])
    })

    describe('markLudicCacheStale', () => {
        const strictUpdate = jest.spyOn(ephemeraDB, 'strictPrimitiveUpdate') as unknown as jest.Mock

        beforeEach(() => { strictUpdate.mockReset() })
        afterAll(() => { strictUpdate.mockRestore() })

        it('bumps each distinct room once, on the marker row', async () => {
            strictUpdate.mockResolvedValue(undefined)
            await markLudicCacheStale([roomA, roomA])
            expect(strictUpdate).toHaveBeenCalledTimes(1)
            expect(strictUpdate).toHaveBeenCalledWith({
                Key: { EphemeraId: roomA, DataCategory: LUDIC_CACHE_VERSION_DATA_CATEGORY },
                UpdateExpression: 'ADD version :one',
                ExpressionAttributeValues: { ':one': { N: '1' } },
            })
        })

        it('throws a failed bump rather than leaving a wrong row reading as a hit', async () => {
            strictUpdate.mockRejectedValue(new Error('slow down'))
            await expect(markLudicCacheStale([roomA])).rejects.toThrow('slow down')
        })

        it('makes the next read stale: a row labelled with the old version is rebuilt', async () => {
            const stored = emptyCache('stored')
            mockedDB.getItems.mockResolvedValue([marker(5), row(4, stored)])
            mockedDB.conditionalPutItem.mockResolvedValue(true)
            const build = jest.fn(async () => ({ cache: emptyCache('rebuilt'), stats: { shardFetchCount: 1, maxDepth: 0 } }))
            const result = await readLudicCache(roomA, { resolveCanonStack: async () => canonStack, build: build as any, runSingleFlight: leader })
            expect(result.nodes[0].shortName).toBe('rebuilt')
        })
    })
})
