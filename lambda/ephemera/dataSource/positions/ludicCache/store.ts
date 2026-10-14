/**
 * The stored `ludicCache` row, and `readLudicCache`: the one read a room-seeded consumer makes.
 * See `AGENT.ludicCachePersistence.planning.md` (LCP-1, -2, -4, -5) for the decisions this holds.
 *
 * Two rows per room, on `EphemeraId: <roomId>`:
 * - `LudicCache::`: the full `EphemeraLudicCacheData` plus `builtAtVersion`, the marker version the
 *   build read first.
 * - `LudicCacheVersion::`: the marker, `version`, bumped by whatever changes a graph or a name
 *   (Slice 3). Absent reads as version 0. A separate row because an update is billed on the item's
 *   size, and the marker is bumped far more often than the cache is rewritten.
 *
 * **A hit is exact:** the row passes its guard and `builtAtVersion` equals the marker's `version`.
 * Anything else (absent, stale, malformed) is rebuilt, written and returned before it is read; a
 * malformed row is treated as absent, never thrown.
 *
 * **Read order is what makes the label honest.** The build reads the marker first, then every shard
 * graph fresh and strongly consistent (`getFreshLudicGraph`, bypassing the per-invocation `Positions`
 * memo), so the content is never older than its label. Content newer than its label is harmless:
 * it reads as stale and costs one more rebuild.
 *
 * **Concurrent rebuilds** coalesce through `singleFlight` keyed on (`roomId`, marker version), and
 * the write is monotonic (`attribute_not_exists(builtAtVersion) OR builtAtVersion < :n`), with no
 * transaction and no touch on the marker, so it never contends with a kernel commit. A refused write
 * returns the row it finds. **Every caller, builder or follower, applies one rule to what the
 * flight returned:** labelled with the version it read, return it; anything else is a cache-update
 * collision, so start again from the row read, a bounded number of times.
 *
 * **The persisted path takes only a `roomId`.** The Canon stack is resolved here, never passed in,
 * so a viewer's perspective cannot reach a name written into a row shared by every viewer (LCP-1).
 */
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import {
    singleFlightFactory,
    SingleFlightFailedError,
    type SingleFlightParams,
} from '@tonylb/mtw-lambda-patterns/ts/singleFlight'
import { normalizeStoredLudicGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/factory'
import type { EphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import internalCache from '../../../internalCache'
import { resolveCanonAssetStackForRoom } from '../../state/resolveAssetStackForRoom'
import { EphemeraLudicGraph, hostDataCategory, nodeFromId } from '../ludicGraph'
import { buildLudicCache, type BuildLudicCacheDeps } from './fold'
import { isEphemeraLudicCacheData, type EphemeraLudicCacheData } from './types'

export const LUDIC_CACHE_DATA_CATEGORY = 'LudicCache::' as const
export const LUDIC_CACHE_VERSION_DATA_CATEGORY = 'LudicCacheVersion::' as const

/** `SINGLEFLIGHT#<category>` row; keep stable for coordination records. */
export const LUDIC_CACHE_REBUILD_SINGLE_FLIGHT_CATEGORY = 'ephemera-ludic-cache-rebuild' as const
export const LUDIC_CACHE_REBUILD_SINGLE_FLIGHT_TIMEOUT_MS = 60000

/** How many times one read starts again from the row after a flight returns a result not labelled with the version it read. */
export const LUDIC_CACHE_READ_MAX_ATTEMPTS = 3

export type LudicCacheRow = {
    EphemeraId: EphemeraRoomId
    DataCategory: typeof LUDIC_CACHE_DATA_CATEGORY
    cache: EphemeraLudicCacheData
    builtAtVersion: number
}

type LudicCacheVersionRow = {
    EphemeraId: EphemeraRoomId
    DataCategory: typeof LUDIC_CACHE_VERSION_DATA_CATEGORY
    version: number
}

/** A cache and the marker version it was built at: what a rebuild flight hands every caller. */
export type LabelledLudicCache = {
    builtAtVersion: number
    cache: EphemeraLudicCacheData
}

type StoredRows = {
    /** The marker's `version`; 0 when the marker row is absent. */
    version: number
    /** The cache row, only when it passes its guard: a malformed row reads as absent. */
    row?: LabelledLudicCache
}

export type RunWithSingleFlightLudicCacheRebuild = <T>(params: SingleFlightParams<T>) => Promise<T>

const defaultRunWithSingleFlight: RunWithSingleFlightLudicCacheRebuild = <T>(params: SingleFlightParams<T>) => (
    singleFlightFactory<T>({
        optimisticUpdateFunction: ephemeraDB.optimisticUpdate.bind(ephemeraDB),
        getItemFunction: ephemeraDB.getItem.bind(ephemeraDB),
        primaryKey: 'EphemeraId',
        timeoutMs: LUDIC_CACHE_REBUILD_SINGLE_FLIGHT_TIMEOUT_MS,
        mode: 'coalesce',
    })(params)
)

const MARKER_BUMP_EXPRESSION = 'ADD version :one'

/**
 * One `PrimitiveUpdate` per room, bumping its marker (`ADD` also creates the row at 1), for a
 * kernel transaction to carry so the graph write and its stale-mark commit together or not at all
 * (LCP-3). The rooms are the caller's: see `roomsInvalidatedByHosts`.
 */
export const ludicCacheMarkerBumpItems = (roomIds: readonly EphemeraRoomId[]) => roomIds.map((roomId) => ({
    PrimitiveUpdate: {
        Key: { EphemeraId: roomId, DataCategory: LUDIC_CACHE_VERSION_DATA_CATEGORY },
        ProjectionFields: ['version'],
        UpdateExpression: MARKER_BUMP_EXPRESSION,
        ExpressionAttributeValues: { ':one': 1 },
    },
}))

/**
 * The same bump as plain concurrent `UpdateItem`s, for the writers that cannot ride a kernel
 * transaction (asset-side name changes, the diagnostics heals, the Coyote clear). Each is marked
 * right after its own write, so a short window is accepted (LCP-4). A failed bump is thrown, never
 * suppressed: an unwritten marker would leave a wrong row reading as a hit.
 */
export const markLudicCacheStale = async (roomIds: readonly EphemeraRoomId[]): Promise<void> => {
    await Promise.all([...new Set(roomIds)].map((roomId) => ephemeraDB.strictPrimitiveUpdate({
        Key: { EphemeraId: roomId, DataCategory: LUDIC_CACHE_VERSION_DATA_CATEGORY },
        UpdateExpression: MARKER_BUMP_EXPRESSION,
        ExpressionAttributeValues: { ':one': { N: '1' } },
    })))
}

export type ReadLudicCacheDeps = {
    readRows?: (roomId: EphemeraRoomId) => Promise<StoredRows>
    /** The monotonic write; `false` when a row labelled this version or newer is already there. */
    writeRow?: (row: LudicCacheRow) => Promise<boolean>
    getFreshLudicGraph?: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
    resolveCanonStack?: (roomId: EphemeraRoomId) => Promise<string[]>
    build?: typeof buildLudicCache
    buildDeps?: Omit<BuildLudicCacheDeps, 'getLudicGraph'>
    runSingleFlight?: RunWithSingleFlightLudicCacheRebuild
    clearNameMemos?: () => void
}

const labelFromRow = (row: Partial<LudicCacheRow> | undefined): LabelledLudicCache | undefined => (
    row && typeof row.builtAtVersion === 'number' && isEphemeraLudicCacheData(row.cache)
        ? { builtAtVersion: row.builtAtVersion, cache: row.cache }
        : undefined
)

/**
 * One consistent `getItems` over the two exact keys. Rows come back unordered, so they are told
 * apart by `DataCategory`; `getItems` does not retry `UnprocessedKeys`, so a throttled key is simply
 * absent, which reads as an absent or stale row and is rebuilt (slower, never wrong).
 */
const defaultReadRows = async (roomId: EphemeraRoomId): Promise<StoredRows> => {
    const items = await ephemeraDB.getItems<Partial<LudicCacheRow> & Partial<LudicCacheVersionRow>>({
        Keys: [
            { EphemeraId: roomId, DataCategory: LUDIC_CACHE_DATA_CATEGORY },
            { EphemeraId: roomId, DataCategory: LUDIC_CACHE_VERSION_DATA_CATEGORY },
        ],
        ConsistentRead: true,
        getAllFields: true,
    })
    const marker = items.find((item) => item.DataCategory === LUDIC_CACHE_VERSION_DATA_CATEGORY)
    const stored = items.find((item) => item.DataCategory === LUDIC_CACHE_DATA_CATEGORY)
    return {
        version: typeof marker?.version === 'number' ? marker.version : 0,
        row: labelFromRow(stored),
    }
}

const defaultWriteRow = (row: LudicCacheRow): Promise<boolean> => ephemeraDB.conditionalPutItem(row, {
    ConditionExpression: 'attribute_not_exists(builtAtVersion) OR builtAtVersion < :n',
    ExpressionAttributeValues: { ':n': row.builtAtVersion },
})

/**
 * A shard graph read straight from its host row: strongly consistent, and bypassing the
 * per-invocation `Positions` memo, so the rebuild never builds from a graph older than the marker
 * it read first. Rebuild-only: the shared gateway read is unchanged. Normalizes a missing or partial
 * stored graph exactly as the gateway does, so a rebuild from here equals a cold build.
 */
export const getFreshLudicGraph = async (hostId: EphemeraMembershipHostId): Promise<EphemeraLudicGraph> => {
    const row = await ephemeraDB.getItem<{ ludicGraph?: EphemeraLudicGraphFieldPayload }>({
        Key: { EphemeraId: hostId, DataCategory: hostDataCategory(hostId) },
        ProjectionFields: ['ludicGraph'],
        ConsistentRead: true,
    })
    return EphemeraLudicGraph.fromFieldPayload(hostId, normalizeStoredLudicGraph(row?.ludicGraph, hostId, nodeFromId(hostId).tag as Exclude<ReturnType<typeof nodeFromId>['tag'], 'Presence'>))
}

/**
 * Drops every per-invocation memo a stored name is read through: the Canon stack (`RoomAssets`,
 * `AssetMetaData`) and the component data the names come from. The same hazard `getFreshLudicGraph`
 * closes for graphs: a memo filled before another invocation's rename bump would otherwise build an
 * old name and label it with the new version, a persistent wrong hit. Rebuild-only, and called
 * after the marker is read, so whatever is fetched next is no older than the label.
 */
const clearNameMemos = (): void => {
    internalCache.RoomAssets.clear()
    internalCache.AssetMetaData.clear()
    internalCache.ComponentData.clear()
    internalCache.ComponentVerticals.clear()
    internalCache.ComponentAggregate.clear()
}

const rebuild = async (
    roomId: EphemeraRoomId,
    version: number,
    deps: Required<Pick<ReadLudicCacheDeps, 'readRows' | 'writeRow' | 'getFreshLudicGraph' | 'resolveCanonStack' | 'build' | 'clearNameMemos'>> & Pick<ReadLudicCacheDeps, 'buildDeps'>
): Promise<LabelledLudicCache> => {
    deps.clearNameMemos()
    const assetStack = await deps.resolveCanonStack(roomId)
    const { cache } = await deps.build(roomId, assetStack, { ...deps.buildDeps, getLudicGraph: deps.getFreshLudicGraph })
    const wrote = await deps.writeRow({ EphemeraId: roomId, DataCategory: LUDIC_CACHE_DATA_CATEGORY, cache, builtAtVersion: version })
    if (wrote) {
        return { builtAtVersion: version, cache }
    }
    // Refused: a row labelled this version or newer is already there. Return what is found (never
    // throw the refusal); a caller that read this version applies the same label rule to it.
    const { row } = await deps.readRows(roomId)
    return row ?? { builtAtVersion: version, cache }
}

export const readLudicCache = async (
    roomId: EphemeraRoomId,
    deps: ReadLudicCacheDeps = {}
): Promise<EphemeraLudicCacheData> => {
    const resolved = {
        readRows: deps.readRows ?? defaultReadRows,
        writeRow: deps.writeRow ?? defaultWriteRow,
        getFreshLudicGraph: deps.getFreshLudicGraph ?? getFreshLudicGraph,
        resolveCanonStack: deps.resolveCanonStack ?? ((id: EphemeraRoomId) => resolveCanonAssetStackForRoom(id, internalCache)),
        build: deps.build ?? buildLudicCache,
        clearNameMemos: deps.clearNameMemos ?? clearNameMemos,
        buildDeps: deps.buildDeps,
    }
    const runSingleFlight = deps.runSingleFlight ?? defaultRunWithSingleFlight

    let carried: unknown
    for (let attempt = 0; attempt < LUDIC_CACHE_READ_MAX_ATTEMPTS; attempt++) {
        const { version, row } = await resolved.readRows(roomId)
        if (row && row.builtAtVersion === version) {
            return row.cache
        }
        try {
            const flight = await runSingleFlight<LabelledLudicCache>({
                category: LUDIC_CACHE_REBUILD_SINGLE_FLIGHT_CATEGORY,
                argumentHash: `${roomId}::${version}`,
                computation: () => rebuild(roomId, version, resolved),
                retrieval: async () => {
                    const { row: found } = await resolved.readRows(roomId)
                    // Nothing (or a malformed row) to retrieve is not a result: label it so the rule below retries.
                    return found ?? { builtAtVersion: -1, cache: undefined as unknown as EphemeraLudicCacheData }
                },
            })
            if (flight.builtAtVersion === version) {
                return flight.cache
            }
            carried = undefined
        }
        catch (error) {
            // The lead failed and said so: the row is not the outcome of its task. Start again; the
            // next attempt starts a new flight. Anything else is not a collision.
            if (!(error instanceof SingleFlightFailedError)) {
                throw error
            }
            carried = error
        }
    }
    throw carried ?? new Error(`readLudicCache: no cache labelled with the marker version for ${roomId} after ${LUDIC_CACHE_READ_MAX_ATTEMPTS} attempts`)
}
