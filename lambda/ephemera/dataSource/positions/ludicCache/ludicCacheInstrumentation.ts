/**
 * Structured CloudWatch logging for `ludicCache` rebuilds --- Slice 5 (PC-3) of
 * `AGENT.ludicCacheRebuild.planning.md`. Filter: `[mtw.ephemera.ludicCache] rebuild`.
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

export type LudicCacheRebuildFields = {
    seedHostId: string
    shardFetchCount: number
    maxDepth: number
    objectCount: number
    wallTimeMs: number
}

export const logLudicCacheRebuild = (fields: LudicCacheRebuildFields): void => {
    console.log(LOG_PREFIX, { event: 'rebuild', ...fields })
}
