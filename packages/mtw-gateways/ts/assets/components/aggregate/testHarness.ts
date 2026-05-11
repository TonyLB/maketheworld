import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { AuthoritativeComponentData } from '../assetMeta/dynamoStandardComponents'
import type { ImportVerticalMetaImportProjectionEntry } from '../verticals/consistency'
import type { ComponentAggregateInternalCacheSlice } from './ports'

/**
 * Approved in-memory double: same `ComponentData` / `ComponentVerticals` method names and batch
 * contracts as assets `internalCache` handlers, without importing lambda `InternalCache`.
 */
export function inMemoryComponentAggregateInternalCacheSlice(options: {
    authoritativeByUniversal?: ReadonlyMap<EphemeraId, AuthoritativeComponentData>
    verticalsByUniversal?: ReadonlyMap<EphemeraId, ImportVerticalMetaImportProjectionEntry>
}): ComponentAggregateInternalCacheSlice {
    const authoritativeByUniversal = options.authoritativeByUniversal ?? new Map()
    const verticalsByUniversal = options.verticalsByUniversal ?? new Map()

    return {
        ComponentData: {
            async get(ComponentIds: EphemeraId[]) {
                return Promise.all(
                    ComponentIds.map(async (id) => {
                        const row = authoritativeByUniversal.get(id)
                        if (row) return row
                        return { ComponentId: id, byAssets: [] } satisfies AuthoritativeComponentData
                    })
                )
            },
        },
        ComponentVerticals: {
            async get(universalKeys: EphemeraId[]) {
                return Promise.all(
                    universalKeys.map(async (id) => {
                        const row = verticalsByUniversal.get(id)
                        if (row) return row
                        return { universalKey: id, hops: [] as const }
                    })
                )
            },
        },
    }
}
