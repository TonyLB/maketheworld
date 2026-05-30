import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { defaultComponentFromTag } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import type { AuthoritativeComponentData } from '../componentData/dynamoStandardComponents'
import { tagFromEphemeraWrappedId } from '../componentData/defaults'
import type {
    ComponentAcrossAssetsEntry,
    ComponentDataParticipationLoader,
} from '../componentData/componentDataCache'
import type { ImportVerticalMetaImportProjectionEntry } from '../verticals/consistency'
import type { ComponentAggregateInternalCacheSlice } from './ports'

function defaultStubForUniversalComponent(universalKey: EphemeraId): StandardComponent {
    const tag = tagFromEphemeraWrappedId(universalKey)
    const defaultData = defaultComponentFromTag(tag, undefined, universalKey as ComponentUUID)
    const { component } = standardComponentFactory(defaultData)
    if (!component) {
        throw new Error(`No default component for universal key ${universalKey}`)
    }
    return component
}

/**
 * In-memory participation loader backed by full authoritative rows per universal key.
 */
export function inMemoryComponentDataParticipationLoader(options: {
    authoritativeByUniversal?: ReadonlyMap<EphemeraId, AuthoritativeComponentData>
}): ComponentDataParticipationLoader {
    const authoritativeByUniversal = options.authoritativeByUniversal ?? new Map()

    return {
        async getAcrossAssets(universalKey: ComponentUUID, assetList: AssetUUID[]) {
            const row = authoritativeByUniversal.get(universalKey as EphemeraId)
            const byAsset = new Map<AssetUUID, ComponentAcrossAssetsEntry>()
            for (const entry of row?.byAssets ?? []) {
                byAsset.set(entry.AssetId, {
                    component: entry.component,
                    ...(entry.referencedBy ? { referencedBy: entry.referencedBy } : {}),
                })
            }
            return assetList.reduce<Record<AssetUUID, ComponentAcrossAssetsEntry>>((previous, assetId) => {
                const existing = byAsset.get(assetId)
                const component =
                    existing?.component ?? defaultStubForUniversalComponent(universalKey as EphemeraId)
                return {
                    ...previous,
                    [assetId]: {
                        component,
                        ...(existing?.referencedBy ? { referencedBy: existing.referencedBy } : {}),
                    },
                }
            }, {})
        },
    }
}

/**
 * Approved in-memory double: same `ComponentData` / `ComponentVerticals` method names and batch
 * contracts as assets `internalCache` handlers, without importing lambda `InternalCache`.
 */
export function inMemoryComponentAggregateInternalCacheSlice(options: {
    authoritativeByUniversal?: ReadonlyMap<EphemeraId, AuthoritativeComponentData>
    verticalsByUniversal?: ReadonlyMap<EphemeraId, ImportVerticalMetaImportProjectionEntry>
}): ComponentAggregateInternalCacheSlice {
    const verticalsByUniversal = options.verticalsByUniversal ?? new Map()

    return {
        ComponentData: inMemoryComponentDataParticipationLoader({
            authoritativeByUniversal: options.authoritativeByUniversal,
        }),
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
