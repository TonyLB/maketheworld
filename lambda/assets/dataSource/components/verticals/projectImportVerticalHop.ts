import { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import internalCache from '../../../internalCache'
import { metaImportDataCategory, metaImportSortKeyEndsWithChild } from './importVerticalKeys'

export type ImportVerticalHeaderType = 'Component Updated' | 'Component Republished' | 'Component Removed'

/**
 * Maintains the Meta::Import hop row for (universalKey, child asset) from authoritative component state.
 * Deletes any prior hop for that child in this partition, then inserts when appropriate.
 */
export async function projectImportVerticalHop(params: {
    headerType: ImportVerticalHeaderType
    component: StandardComponent
    childAssetId: AssetUUID
}): Promise<void> {
    const { headerType, component, childAssetId } = params
    const universalKey = component.universalKey
    if (!universalKey || !childAssetId) {
        return
    }

    const existing = await assetDB.query<{ AssetId: string; DataCategory: string }>({
        Key: { AssetId: universalKey },
        KeyConditionExpression: 'begins_with(DataCategory, :prefix)',
        ExpressionAttributeValues: { ':prefix': 'Meta::Import::' },
        ProjectionFields: ['AssetId', 'DataCategory'],
    })

    await Promise.all(
        existing
            .filter((item) =>
                metaImportSortKeyEndsWithChild({ dataCategory: item.DataCategory, childAssetId })
            )
            .map((item) =>
                assetDB.deleteItem({
                    AssetId: item.AssetId,
                    DataCategory: item.DataCategory,
                })
            )
    )

    const shouldWriteHop =
        headerType !== 'Component Removed' && Boolean(component._from)

    if (shouldWriteHop && component._from) {
        await assetDB.putItem({
            AssetId: universalKey,
            DataCategory: metaImportDataCategory({
                parentAssetId: component._from,
                childAssetId,
            }),
        })
    }

    internalCache.ComponentVerticals.invalidate(universalKey as EphemeraId)
}
