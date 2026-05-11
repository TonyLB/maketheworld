import type { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses';
import { AssetUUID, ComponentUUID, isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema';
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses';
import { AssetKey } from '@tonylb/mtw-utilities/ts/types';
import { metaDataCategoryForEphemeraId } from './metaCategory'
import { standardComponentPairFromAssetDbGetItemsRow } from './dynamoStandardComponents'

export type ComponentAssetMetaAssetDB = {
    getItems: <Get extends Omit<StandardComponentData, 'universalKey' | 'tag'> & { DataCategory?: AssetUUID, AssetId: ComponentUUID }>(props: {
        Keys: { AssetId: ComponentUUID, DataCategory: AssetUUID }[],
        getAllFields: true
    }) => Promise<Get[]>
    getItem: <T extends { cached?: string[] }>(props: {
        Key: {
            AssetId: ComponentUUID,
            DataCategory: string
        },
        ProjectionFields: ['cached']
    }) => Promise<T | undefined>
}

export async function fetchComponentsForAssets(
    assetDB: ComponentAssetMetaAssetDB,
    EphemeraId: ComponentUUID,
    assetIds: AssetUUID[]
): Promise<{ assetId: AssetUUID; component: StandardComponent }[]> {
    const queryKeys = assetIds.map((assetId) => ({
        AssetId: EphemeraId,
        DataCategory: assetId
    }));

    const returnValues = await assetDB.getItems<Omit<StandardComponentData, 'universalKey' | 'tag'> & { DataCategory?: AssetUUID, AssetId: ComponentUUID }>({
        Keys: queryKeys,
        getAllFields: true
    });

    const filteredResults = returnValues
        .filter((value) => {
            const assetId = value.DataCategory ?? ''
            return isSchemaAssetUUID(assetId)
        });

    return filteredResults.map((value) => standardComponentPairFromAssetDbGetItemsRow(EphemeraId, value))
}

export async function fetchCachedAssetIdsForComponent(
    assetDB: ComponentAssetMetaAssetDB,
    EphemeraId: ComponentUUID
): Promise<AssetUUID[]> {
    const DataCategory = metaDataCategoryForEphemeraId(EphemeraId)
    const assetListFetch = await assetDB.getItem<{ cached: string[] }>({
        Key: {
            AssetId: EphemeraId,
            DataCategory
        },
        ProjectionFields: ['cached']
    })
    return (assetListFetch?.cached || []).map((assetKey) => (AssetKey(assetKey)))
}
