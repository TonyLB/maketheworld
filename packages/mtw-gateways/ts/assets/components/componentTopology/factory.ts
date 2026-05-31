import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'

import { assembleRoomTopologyAtPerspective } from './assemble'
import {
    validateAssembleRoomTopologyInput,
    type AssembleRoomTopologyInput,
} from './input'
import { componentTopologyPerspectiveCacheKey } from './keys'
import type { ComponentTopologyInternalCacheSlice } from './ports'
import type { ProjectedRoomTopology } from './result'

type BatchTopologyPayload = {
    keys: string[]
    topologies: ProjectedRoomTopology[]
}

/**
 * `DeferredCache`-backed room topology reads at a perspective, composing
 * {@link ComponentTopologyAggregatePort} via {@link assembleRoomTopologyAtPerspective}.
 *
 * Primary factory output for topology reads in lambdas; see `packages/mtw-gateways/AGENT.md`.
 */
export class ComponentTopologyMergedCache {
    _Cache: DeferredCache<ProjectedRoomTopology>
    private readonly slice: ComponentTopologyInternalCacheSlice
    private readonly inputByCacheKey = new Map<string, AssembleRoomTopologyInput>()

    constructor(slice: ComponentTopologyInternalCacheSlice) {
        this.slice = slice
        this._Cache = new DeferredCache<ProjectedRoomTopology>()
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

    async get(input: AssembleRoomTopologyInput): Promise<ProjectedRoomTopology> {
        const validated = validateAssembleRoomTopologyInput(input)
        const cacheKey = componentTopologyPerspectiveCacheKey(validated)
        this.inputByCacheKey.set(cacheKey, validated)

        this._Cache.add({
            promiseFactory: async (fetchNeeded: string[]) => {
                const topologies = await Promise.all(
                    fetchNeeded.map(async (key) => {
                        const batchInput = this.inputByCacheKey.get(key)
                        if (!batchInput) {
                            throw new Error(`componentTopology cache: missing input for key ${key}`)
                        }
                        return assembleRoomTopologyAtPerspective({
                            input: batchInput,
                            aggregate: this.slice.ComponentAggregate,
                        })
                    })
                )
                return { keys: fetchNeeded, topologies }
            },
            requiredKeys: [cacheKey],
            transform: (payload: BatchTopologyPayload) =>
                Object.fromEntries(payload.keys.map((k, i) => [k, payload.topologies[i]])),
        })

        return this._Cache.get(cacheKey)
    }
}

/** Primary factory: {@link ComponentTopologyMergedCache} for lambda InternalCache registration. */
export function createComponentTopologyCacheHandler(
    slice: ComponentTopologyInternalCacheSlice
): ComponentTopologyMergedCache {
    return new ComponentTopologyMergedCache(slice)
}
