import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'

import { mergeAuthoritativeAcrossParticipationOrder } from './assemble'
import type { AggregatePerspective } from './input'
import { aggregatePerspectiveCacheKey } from './keys'
import type { ComponentAggregateInternalCacheSlice } from './ports'
import { mergedComponentResult, type MergedComponentResult } from './result'

import type { AuthoritativeComponentData } from '../assetMeta/dynamoStandardComponents'

type BatchMergePayload = {
    keys: string[]
    mergedResults: MergedComponentResult[]
}

/** Shared merge + DTO path after authoritative rows are resolved (primary cache handler + uncached gateway). */
export function mergedComponentFromAuthoritative(
    perspective: AggregatePerspective,
    authoritative: AuthoritativeComponentData
): MergedComponentResult {
    const merged = mergeAuthoritativeAcrossParticipationOrder(perspective, authoritative)
    return mergedComponentResult({
        universalKey: perspective.universalKey,
        merged,
        mergeParticipationOrderApplied: perspective.mergeParticipationOrder,
    })
}

/**
 * `DeferredCache`-backed merged-component reads at an {@link AggregatePerspective}, matching the
 * structural pattern of assets `internalCache` handlers (`ComponentVerticals`, etc.) but injecting a
 * {@link ComponentAggregateInternalCacheSlice} instead of calling `assetDB` directly.
 *
 * Primary factory output for aggregate reads in lambdas; see `packages/mtw-gateways/AGENT.md`.
 */
export class ComponentAggregateMergedCache {
    _Cache: DeferredCache<MergedComponentResult>
    private readonly slice: ComponentAggregateInternalCacheSlice

    constructor(slice: ComponentAggregateInternalCacheSlice) {
        this.slice = slice
        this._Cache = new DeferredCache<MergedComponentResult>()
    }

    async flush(): Promise<void> {
        await this._Cache.flush()
    }

    clear(): void {
        this._Cache.clear()
    }

    invalidate(cacheKey: string): void {
        this._Cache.invalidate(cacheKey)
    }

    async get(perspectives: AggregatePerspective[]): Promise<MergedComponentResult[]> {
        const cacheKeys = perspectives.map(aggregatePerspectiveCacheKey)
        const perspectiveByKey = new Map(cacheKeys.map((k, i) => [k, perspectives[i]]))

        this._Cache.add({
            promiseFactory: async (fetchNeeded: string[]) => {
                const batchPerspectives = fetchNeeded.map((key) => {
                    const perspective = perspectiveByKey.get(key)
                    if (!perspective) {
                        throw new Error(`aggregate cache: missing perspective for key ${key}`)
                    }
                    return perspective
                })

                const universalKeys = [...new Set(batchPerspectives.map((p) => p.universalKey))]
                const [authoritativeRows, verticalRows] = await Promise.all([
                    this.slice.ComponentData.get(universalKeys),
                    this.slice.ComponentVerticals.get(universalKeys),
                ])
                void verticalRows

                const authoritativeByUniversal = new Map<EphemeraId, AuthoritativeComponentData>()
                universalKeys.forEach((uk, i) => {
                    authoritativeByUniversal.set(
                        uk,
                        authoritativeRows[i] ??
                            ({ ComponentId: uk, byAssets: [] } satisfies AuthoritativeComponentData)
                    )
                })

                const out = fetchNeeded.map((key) => {
                    const perspective = perspectiveByKey.get(key)!
                    const authoritative =
                        authoritativeByUniversal.get(perspective.universalKey) ??
                        ({
                            ComponentId: perspective.universalKey,
                            byAssets: [],
                        } satisfies AuthoritativeComponentData)
                    return mergedComponentFromAuthoritative(perspective, authoritative)
                })
                return { keys: fetchNeeded, mergedResults: out }
            },
            requiredKeys: cacheKeys,
            transform: (payload: BatchMergePayload) =>
                Object.fromEntries(payload.keys.map((k, i) => [k, payload.mergedResults[i]])),
        })

        return Promise.all(cacheKeys.map((key) => this._Cache.get(key)))
    }
}

/** Primary factory: {@link ComponentAggregateMergedCache} for the blessed aggregate cache integration path. */
export function createComponentAggregateCacheHandler(
    slice: ComponentAggregateInternalCacheSlice
): ComponentAggregateMergedCache {
    return new ComponentAggregateMergedCache(slice)
}
