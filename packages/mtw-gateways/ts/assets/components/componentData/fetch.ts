import type { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { AssetUUID, ComponentUUID, isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'
import { tagFromEphemeraId } from '@tonylb/mtw-utilities/ts/graphStorage/cache'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { isStandardComponentData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'

/**
 * One `getItems` row for `(EphemeraId, DataCategory = asset id)`; same row shape as `ComponentAssetMetaAssetDB.getItems`.
 */
export type AssetDbGetItemsComponentRow = Omit<StandardComponentData, 'universalKey' | 'tag'> & {
    DataCategory?: AssetUUID
    AssetId: ComponentUUID
}

/**
 * Maps a keyed Dynamo row from `getItems` into `{ assetId, component }` (pair-addressed path).
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

export type ComponentAssetMetaAssetDB = {
    getItems: <Get extends Omit<StandardComponentData, 'universalKey' | 'tag'> & { DataCategory?: AssetUUID; AssetId: ComponentUUID }>(props: {
        Keys: { AssetId: ComponentUUID; DataCategory: AssetUUID }[]
        getAllFields: true
    }) => Promise<Get[]>
}

export async function fetchComponentsForAssets(
    assetDB: ComponentAssetMetaAssetDB,
    EphemeraId: ComponentUUID,
    assetIds: AssetUUID[]
): Promise<{ assetId: AssetUUID; component: StandardComponent }[]> {
    const queryKeys = assetIds.map((assetId) => ({
        AssetId: EphemeraId,
        DataCategory: assetId,
    }))

    const returnValues = await assetDB.getItems<
        Omit<StandardComponentData, 'universalKey' | 'tag'> & { DataCategory?: AssetUUID; AssetId: ComponentUUID }
    >({
        Keys: queryKeys,
        getAllFields: true,
    })

    const filteredResults = returnValues.filter((value) => {
        const assetId = value.DataCategory ?? ''
        return isSchemaAssetUUID(assetId)
    })

    return filteredResults.map((value) => standardComponentPairFromAssetDbGetItemsRow(EphemeraId, value))
}
