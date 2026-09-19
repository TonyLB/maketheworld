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
 */
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { buildLudicCache, type BuildLudicCacheDeps } from './fold'

export type LudicCacheObjectHandle = {
    objectId: EphemeraObjectId
    shortName: string
}

/**
 * `componentCacheNode` (`fold.ts`) falls back to `shortName: hostId` when no real shortName
 * resolves --- there is no placeholder-vs-real discriminator on `EphemeraLudicCacheNode`. A real
 * shortName is never equal to the object's own id, so this is a safe (if sharp-edged) way to tell
 * "nothing resolved" apart from "the shortName really is this" without touching Slice 3's shipped
 * node-construction code. Do not reuse this equality check anywhere the fallback shape might not
 * hold.
 */
export const ludicCacheObjectHandles = async (
    seedHostId: EphemeraMembershipHostId,
    assetStack: readonly string[],
    deps: BuildLudicCacheDeps = {}
): Promise<LudicCacheObjectHandle[]> => {
    const cache = await buildLudicCache(seedHostId, assetStack, deps)
    const handles: LudicCacheObjectHandle[] = []
    for (const node of cache.nodes) {
        if (node.tag === 'Presence' || !isEphemeraObjectId(node.universalKey)) {
            continue
        }
        if (node.shortName === node.universalKey) {
            continue
        }
        handles.push({ objectId: node.universalKey, shortName: node.shortName })
    }
    return handles
}
