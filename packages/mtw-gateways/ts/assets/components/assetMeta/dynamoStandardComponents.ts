import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { excludeUndefined } from '@tonylb/mtw-utilities/ts/lists'
import { tagFromEphemeraId } from '@tonylb/mtw-utilities/ts/graphStorage/cache'
import type { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { isStandardNDJSONLine } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { isStandardComponentData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'

/**
 * Parsed authoritative components for one universal component id (same envelope as assets lambda
 * `internalCache.ComponentData` `ComponentDataCache`).
 */
export type AuthoritativeComponentData = {
    ComponentId: EphemeraId
    byAssets: {
        AssetId: `ASSET#${string}`
        component: StandardComponent
    }[]
}

/**
 * One `getItems` row for `(EphemeraId, DataCategory = asset id)`; same row shape as `ComponentAssetMetaAssetDB.getItems`.
 */
export type AssetDbGetItemsComponentRow = Omit<StandardComponentData, 'universalKey' | 'tag'> & {
    DataCategory?: AssetUUID
    AssetId: ComponentUUID
}

/**
 * Maps a keyed Dynamo row from `getItems` into `{ assetId, component }` (ephemera `ComponentAssetMeta` path).
 */
export function standardComponentPairFromAssetDbGetItemsRow(
    EphemeraId: ComponentUUID,
    value: AssetDbGetItemsComponentRow
): { assetId: AssetUUID; component: StandardComponent } {
    const { DataCategory, AssetId: _assetId, ...rest } = value
    const assetId = DataCategory as AssetUUID
    const componentData = { universalKey: EphemeraId, tag: tagFromEphemeraId(EphemeraId), ...rest }
    if (!isStandardComponentData(componentData)) {
        throw new Error(`Invalid component data for EphemeraId: ${EphemeraId} and DataCategory: ${DataCategory}`)
    }
    const { component } = standardComponentFactory(componentData)
    if (!component) {
        throw new Error(`Failed to create component for EphemeraId: ${EphemeraId} and DataCategory: ${DataCategory}`)
    }
    return { assetId, component }
}

/**
 * Universal-key partition `Query` rows (`AssetId` = universal component id, `DataCategory` = child asset id).
 * Same NDJSON mapping as assets lambda `ComponentData._getPromiseFactory`.
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
