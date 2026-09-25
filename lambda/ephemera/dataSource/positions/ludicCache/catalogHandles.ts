/**
 * Slice 4 of `AGENT.ludicCacheRebuild.planning.md`: the first real consumer (CC3), and the first
 * real test of P6 clause 3 --- a hit returns a **handle**, never a subgraph. `buildLudicCache`
 * stays a pure function; this is the thin handler D6 decided on, and the only thing a consumer
 * (`roomObjectCatalogForCharacter.ts`) is allowed to call. Nothing past this function's return
 * type is `EphemeraLudicCacheData`-shaped --- a caller gets flat `{ objectId, shortName }` handles,
 * never `nodes`/`edges`/`ports`.
 *
 * **Exhaustive, not bucket-filtered, by deliberate choice this slice.** The cache is presence-aware
 * internally (its own `cover` structure), but this handler still returns every object node the
 * walk reaches, matching `collectNestedObjectIds`'s old scope exactly. Filtering the pool to the
 * caller's own presence bucket (AB-9's read-path half) is open debt, not built here.
 *
 * **Slice 5 (PC-3): this is also the instrumentation boundary.** `buildLudicCache` and
 * `enumerateLudicCacheShards` stay pure, so wall time is timed here, around the one call this
 * handler already makes, and `objectCount` is a byproduct of the loop this handler already runs
 * to build handles. The logged line (`logLudicCacheRebuild`) carries only counts --- never
 * `cache.nodes`/`edges` --- so it does not reopen the P6-clause-3 boundary this file exists to hold.
 */
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { buildLudicCache, type BuildLudicCacheDeps } from './fold'
import { logLudicCacheRebuild } from './ludicCacheInstrumentation'

export type LudicCacheObjectHandle = {
    objectId: EphemeraObjectId
    shortName: string
}

export const ludicCacheObjectHandles = async (
    seedHostId: EphemeraMembershipHostId,
    assetStack: readonly string[],
    deps: BuildLudicCacheDeps = {}
): Promise<LudicCacheObjectHandle[]> => {
    const startedAt = Date.now()
    const { cache, stats } = await buildLudicCache(seedHostId, assetStack, deps)
    const handles: LudicCacheObjectHandle[] = []
    let objectCount = 0
    for (const node of cache.nodes) {
        if (node.tag === 'Presence' || !isEphemeraObjectId(node.universalKey)) {
            continue
        }
        objectCount += 1
        if (node.shortName === undefined) {
            continue
        }
        handles.push({ objectId: node.universalKey, shortName: node.shortName })
    }
    logLudicCacheRebuild({
        seedHostId,
        shardFetchCount: stats.shardFetchCount,
        maxDepth: stats.maxDepth,
        objectCount,
        wallTimeMs: Date.now() - startedAt,
    })
    return handles
}
