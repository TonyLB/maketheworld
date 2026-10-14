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
    readLudicCache,
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
})
