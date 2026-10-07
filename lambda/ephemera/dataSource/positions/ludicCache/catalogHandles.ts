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
 * **Each handle names every bucket it is seen in** (`presence`): each binding in the cache whose
 * cover holds the object, plus each of the object's own bindings (a host is the root of its own
 * graph, so it is in each of its own buckets, though `cover` leaves the root out) --- walked or
 * not. The caller's perspective decides *which* thing a phrase means, not who can see it change,
 * so a bucket bound into a room the walk never reached counts, and a whole bound into several
 * rooms names every one. The seed room when it is in no bucket (the object sits in the room's own
 * graph and has no binding of its own; a room has no binding). Still flat scalars, and still not
 * a filter: this records where each thing is seen and drops nothing.
 *
 * **Slice 5 (PC-3): this is also the instrumentation boundary.** `buildLudicCache` and
 * `enumerateLudicCacheShards` stay pure, so wall time is timed here, around the one call this
 * handler already makes, and `objectCount` is a byproduct of the loop this handler already runs
 * to build handles. The logged line (`logLudicCacheRebuild`) carries only counts --- never
 * `cache.nodes`/`edges` --- so it does not reopen the P6-clause-3 boundary this file exists to hold.
 */
import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { buildLudicCache, type BuildLudicCacheDeps } from './fold'
import { logLudicCacheRebuild } from './ludicCacheInstrumentation'
import type { EphemeraLudicCacheData } from './types'

export type LudicCacheObjectHandle = {
    objectId: EphemeraObjectId
    shortName: string
    /** Reasoning gloss, present only where authored or improvised (see `AGENT.concepts.md`'s `CommandAttempt` section). Still a flat scalar, not a widening past the handle boundary this file's own header comment states. */
    gloss?: string
    /** Every presence bucket this object is seen in, or the seed room (see the header). */
    presence?: (EphemeraPresenceNodeId | EphemeraRoomId)[]
}

/** Each host's buckets: its own bindings and every binding in the cache whose cover holds it, deduped, in cache order (which the fold keeps byte-identical). */
const bucketsByMember = (cache: EphemeraLudicCacheData): Map<string, EphemeraPresenceNodeId[]> => {
    const buckets = new Map<string, EphemeraPresenceNodeId[]>()
    const addBucket = (host: string, binding: EphemeraPresenceNodeId) => {
        const held = buckets.get(host) ?? []
        if (!held.includes(binding)) {
            buckets.set(host, [...held, binding])
        }
    }
    for (const node of cache.nodes) {
        for (const binding of node.presenceNodes) {
            addBucket(node.universalKey, binding.universalKey)
            for (const member of binding.cover.members) {
                addBucket(member.host, binding.universalKey)
            }
        }
    }
    return buckets
}

export const ludicCacheObjectHandles = async (
    seedHostId: EphemeraMembershipHostId,
    assetStack: readonly string[],
    deps: BuildLudicCacheDeps = {}
): Promise<LudicCacheObjectHandle[]> => {
    const startedAt = Date.now()
    const { cache, stats } = await buildLudicCache(seedHostId, assetStack, deps)
    const handles: LudicCacheObjectHandle[] = []
    const buckets = bucketsByMember(cache)
    const seedRoom = isEphemeraRoomId(seedHostId) ? seedHostId : undefined
    let objectCount = 0
    for (const node of cache.nodes) {
        if (!isEphemeraObjectId(node.universalKey)) {
            continue
        }
        objectCount += 1
        if (node.shortName === undefined) {
            continue
        }
        const presence = buckets.get(node.universalKey) ?? (seedRoom !== undefined ? [seedRoom] : undefined)
        handles.push({
            objectId: node.universalKey,
            shortName: node.shortName,
            ...(node.gloss !== undefined ? { gloss: node.gloss } : {}),
            ...(presence !== undefined ? { presence } : {}),
        })
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
