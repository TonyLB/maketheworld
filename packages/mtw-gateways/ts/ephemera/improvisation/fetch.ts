import type { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import {
    standardComponentPairFromAssetDbGetItemsRow,
    type EphemeraDbGetItemsComponentRow,
} from '../../assets/components/componentData/fetch'
import type { PersistedReferencedByEntry } from '../../assets/components/componentData/referencedBy'

export type EphemeraImprovisationReadDB = {
    getItems: <Get extends Omit<StandardComponentData, 'universalKey' | 'tag'> & {
        DataCategory?: AssetUUID
        EphemeraId: ComponentUUID
    }>(props: {
        Keys: { EphemeraId: ComponentUUID; DataCategory: AssetUUID }[]
        getAllFields: true
    }) => Promise<Get[]>
}

export async function fetchImprovisationComponentsForAssets(
    db: EphemeraImprovisationReadDB,
    EphemeraId: ComponentUUID,
    assetIds: AssetUUID[]
): Promise<{ assetId: AssetUUID; component: StandardComponent; referencedBy?: PersistedReferencedByEntry[] }[]> {
    const queryKeys = assetIds.map((assetId) => ({
        EphemeraId,
        DataCategory: assetId,
    }))

    const returnValues = await db.getItems<
        Omit<StandardComponentData, 'universalKey' | 'tag'> & {
            DataCategory?: AssetUUID
            EphemeraId: ComponentUUID
        }
    >({
        Keys: queryKeys,
        getAllFields: true,
    })

    const filteredResults = returnValues.filter((value) => {
        const assetId = value.DataCategory ?? ''
        return isSchemaAssetUUID(assetId)
    })

    return filteredResults.map((value) =>
        standardComponentPairFromAssetDbGetItemsRow(EphemeraId, value as EphemeraDbGetItemsComponentRow)
    )
}
