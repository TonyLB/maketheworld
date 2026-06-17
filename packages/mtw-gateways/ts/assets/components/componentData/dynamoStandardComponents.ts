import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { excludeUndefined } from '@tonylb/mtw-utilities/ts/lists'
import type { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { isStandardNDJSONLine } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'

import type { PersistedReferencedByEntry } from './referencedBy'

export type { AssetDbGetItemsComponentRow, ComponentPairPersistedFields, EphemeraDbGetItemsComponentRow } from './fetch'
export { standardComponentPairFromAssetDbGetItemsRow } from './fetch'

/**
 * Parsed authoritative components for one universal component id (same envelope as assets lambda
 * `internalCache.ComponentData` partition reads and participation-scoped batch assembly).
 */
export type AuthoritativeComponentData = {
    ComponentId: EphemeraId
    byAssets: {
        AssetId: `ASSET#${string}`
        component: StandardComponent
        referencedBy?: PersistedReferencedByEntry[]
    }[]
}

/**
 * Universal-key partition `Query` rows (`AssetId` = universal component id, `DataCategory` = child asset id).
 * Maintenance-only: use via {@link exhaustiveComponentPartitionScan}, not hot paths.
 */
export function authoritativeComponentDataFromUniversalPartitionRows(
    componentId: EphemeraId,
    rows: ReadonlyArray<StandardComponentData & { AssetId: string; DataCategory: string }>
): AuthoritativeComponentData {
    const byAssets = rows
        .filter(isStandardNDJSONLine)
        .map((line) => {
            const AssetId = line.DataCategory as `ASSET#${string}`
            const { component } = standardComponentFactory(line)
            if (AssetId && component) {
                return {
                    AssetId,
                    component,
                }
            }
            return undefined
        })
        .filter(excludeUndefined)
    return { ComponentId: componentId, byAssets }
}

/** Maps {@link AuthoritativeComponentData} into import-vertical derive input `{ childAssetId, component }[]`. */
export function componentRowsFromAuthoritativeComponentData(
    entry: AuthoritativeComponentData
): { childAssetId: string; component: StandardComponent }[] {
    return entry.byAssets.map(({ AssetId, component }) => ({
        childAssetId: AssetId,
        component,
    }))
}

/**
 * Parse NDJSON component lines from a universal-key partition `Query`. Same semantics as
 * {@link authoritativeComponentDataFromUniversalPartitionRows} then {@link componentRowsFromAuthoritativeComponentData}.
 */
export function componentRowsFromUniversalPartitionLines(
    rows: ReadonlyArray<StandardComponentData & { AssetId: string; DataCategory: string }>
): { childAssetId: string; component: StandardComponent }[] {
    const componentId = (rows[0]?.AssetId ?? '') as EphemeraId
    return componentRowsFromAuthoritativeComponentData(
        authoritativeComponentDataFromUniversalPartitionRows(componentId, rows)
    )
}
