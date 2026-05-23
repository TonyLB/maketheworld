import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'

import { assembleComponentExamplesAtPerspective } from './assemble'
import {
    validateAssembleComponentExamplesInput,
    type AssembleComponentExamplesInput,
} from './input'
import { componentExamplesPerspectiveCacheKey } from './keys'
import type { ComponentExamplesInternalCacheSlice } from './ports'
import type { AuthoredExampleSet } from './result'

type BatchExamplesPayload = {
    keys: string[]
    exampleSets: AuthoredExampleSet[]
}

/**
 * `DeferredCache`-backed authored-slice reads at a cache-host perspective, composing
 * {@link ComponentExamplesAggregatePort} via {@link assembleComponentExamplesAtPerspective}.
 *
 * Primary factory output for examples reads in lambdas; see `packages/mtw-gateways/AGENT.md`.
 */
export class ComponentExamplesMergedCache {
    _Cache: DeferredCache<AuthoredExampleSet>
    private readonly slice: ComponentExamplesInternalCacheSlice
    private readonly inputByCacheKey = new Map<string, AssembleComponentExamplesInput>()

    constructor(slice: ComponentExamplesInternalCacheSlice) {
        this.slice = slice
        this._Cache = new DeferredCache<AuthoredExampleSet>()
    }

    async flush(): Promise<void> {
        await this._Cache.flush()
    }

    clear(): void {
        this._Cache.clear()
        this.inputByCacheKey.clear()
    }

    invalidate(cacheKey: string): void {
        this._Cache.invalidate(cacheKey)
        this.inputByCacheKey.delete(cacheKey)
    }

    async get(input: AssembleComponentExamplesInput): Promise<AuthoredExampleSet> {
        const validated = validateAssembleComponentExamplesInput(input)
        const cacheKey = componentExamplesPerspectiveCacheKey(validated)
        this.inputByCacheKey.set(cacheKey, validated)

        this._Cache.add({
            promiseFactory: async (fetchNeeded: string[]) => {
                const exampleSets = await Promise.all(
                    fetchNeeded.map(async (key) => {
                        const batchInput = this.inputByCacheKey.get(key)
                        if (!batchInput) {
                            throw new Error(`componentExamples cache: missing input for key ${key}`)
                        }
                        return assembleComponentExamplesAtPerspective({
                            input: batchInput,
                            aggregate: this.slice.ComponentAggregate,
                        })
                    })
                )
                return { keys: fetchNeeded, exampleSets }
            },
            requiredKeys: [cacheKey],
            transform: (payload: BatchExamplesPayload) =>
                Object.fromEntries(payload.keys.map((k, i) => [k, payload.exampleSets[i]])),
        })

        return this._Cache.get(cacheKey)
    }
}

/** Primary factory: {@link ComponentExamplesMergedCache} for lambda InternalCache registration. */
export function createComponentExamplesCacheHandler(
    slice: ComponentExamplesInternalCacheSlice
): ComponentExamplesMergedCache {
    return new ComponentExamplesMergedCache(slice)
}
