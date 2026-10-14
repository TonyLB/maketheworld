/**
 * Structured CloudWatch logging for `ludicCache` rebuilds (PC-3's instrument). Filter: `[mtw.ephemera.ludicCache] rebuild`.
 *
 * Modeled on `dataSource/catalogHydrateInstrumentation.ts`'s convention (a scoped prefix, one
 * `console.log` call per event, fields as a plain object) rather than folded into that module ---
 * different scope, different field shape, same idiom. **This is one returned/logged snapshot per
 * rebuild, not a running tally**: PC-3 asks for reads and wall time tagged by object count and
 * nesting depth so a knee can be found across many of these lines later, not for an in-process
 * aggregate.
 *
 * **`shardFetchCount` counts SHARDS, NOT DYNAMODB READS --- do not read it as a read count.**
 * Each shard costs one `Meta::Object` graph read, plus one `resolveComponentShortName` merged-
 * aggregate read per node (which already routes `ASSET#IMPROVISATION` through the same
 * ephemeraDB pair-row table a separate improvisation lookup would read --- see
 * `objectShortName.ts` --- so there is no second read to account for). True reads therefore run
 * roughly 2x `shardFetchCount`, not more.
 */

const LOG_PREFIX = '[mtw.ephemera.ludicCache] rebuild'

/**
 * `outcome` is how a consumer's read found the room's stored row (`hit`, `stale`, `absent`, `malformed`), or `cold` for a
 * seed that is not a room and so is rebuilt per request. Hit rate and saved time read straight off this field.
 * `shardFetchCount` and `maxDepth` are the walk's own counts, so a persisted read does not have them (the flight that rebuilt
 * the row may be another invocation's). `storedBytes` is the serialized cache size on a rebuild that wrote a row: the number
 * to set against DynamoDB's 400KB item limit (LCP-6 chose no guard, so this is the only warning).
 */
export type LudicCacheRebuildFields = {
    seedHostId: string
    shardFetchCount?: number
    maxDepth?: number
    objectCount: number
    wallTimeMs: number
    outcome?: 'hit' | 'stale' | 'absent' | 'malformed' | 'cold'
    storedBytes?: number
}

export const logLudicCacheRebuild = (fields: LudicCacheRebuildFields): void => {
    console.log(LOG_PREFIX, { event: 'rebuild', ...fields })
}

/**
 * One line per rebuild the stored read actually runs (the single-flight lead, never a follower), whichever
 * consumer triggered it. A consumer's own `rebuild` line cannot show this: the room header reader and the
 * command path share one stored row, so whichever reads first after a change does the rebuild, and the
 * other then logs a `hit`. `reader` says which consumer paid; `cause` is what that read found (`stale`,
 * `absent` or `malformed`); `wallTimeMs` is the build plus the write; `wrote` is false when a newer row
 * was already there.
 */
export type LudicCacheStoredRebuildFields = {
    seedHostId: string
    reader: string
    cause: 'stale' | 'absent' | 'malformed'
    builtAtVersion: number
    objectCount: number
    shardFetchCount: number
    maxDepth: number
    wallTimeMs: number
    storedBytes: number
    wrote: boolean
}

export const logLudicCacheStoredRebuild = (fields: LudicCacheStoredRebuildFields): void => {
    console.log(LOG_PREFIX, { event: 'stored-rebuild', ...fields })
}
