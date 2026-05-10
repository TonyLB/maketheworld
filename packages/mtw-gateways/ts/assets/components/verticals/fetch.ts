import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import {
    parseMetaImportDataCategory,
    prefixedAssetIdsFromHop,
} from './keys'

export type ImportVerticalHop = {
    universalKey: string
    dataCategory: string
    parentStripped: string
    childStripped: string
    parentAssetId: AssetUUID
    childAssetId: AssetUUID
}

/**
 * Narrow assetDB slice for querying Meta::Import rows under a universal component partition.
 */
export type ImportVerticalAssetDB = {
    query: <T extends { AssetId: string; DataCategory: string }>(props: {
        Key: { AssetId: string }
        KeyConditionExpression: string
        ExpressionAttributeValues: Record<string, string>
        ProjectionFields?: string[]
    }) => Promise<T[]>
}

const META_IMPORT_BEGINS_WITH = 'Meta::Import::'

/**
 * Load all Meta::Import hop rows for universal component id `universalKey` (one partition query).
 * Rows with malformed DataCategory values are omitted.
 */
export async function queryImportVerticalMeta(
    assetDB: ImportVerticalAssetDB,
    universalKey: string
): Promise<ImportVerticalHop[]> {
    const rows = await assetDB.query<{ AssetId: string; DataCategory: string }>({
        Key: { AssetId: universalKey },
        KeyConditionExpression: 'begins_with(DataCategory, :prefix)',
        ExpressionAttributeValues: { ':prefix': META_IMPORT_BEGINS_WITH },
        ProjectionFields: ['AssetId', 'DataCategory'],
    })

    const hops: ImportVerticalHop[] = []
    for (const item of rows) {
        const parsed = parseMetaImportDataCategory(item.DataCategory)
        if (!parsed) {
            continue
        }
        const { parentAssetId, childAssetId } = prefixedAssetIdsFromHop(parsed)
        hops.push({
            universalKey: item.AssetId,
            dataCategory: item.DataCategory,
            parentStripped: parsed.parentStripped,
            childStripped: parsed.childStripped,
            parentAssetId,
            childAssetId,
        })
    }
    return hops
}
