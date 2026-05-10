import { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    deriveRawImportVerticalHopsFromComponents,
    metaImportDataCategory,
    salvageImportVerticalHops,
} from '@tonylb/mtw-gateways/ts/assets/components/verticals'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { excludeUndefined } from '@tonylb/mtw-utilities/ts/lists'
import type { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { isStandardNDJSONLine } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import internalCache from '../../../internalCache'

const META_IMPORT_PREFIX = 'Meta::Import::'

/**
 * Reconciles all `Meta::Import::...` rows for one universal component partition from authoritative
 * cached component rows (same derivation as live projector + heal).
 */
export async function syncImportVerticalPartition(universalKey: EphemeraId): Promise<void> {
    const rows =
        (await assetDB.query<StandardComponentData & { AssetId: string; DataCategory: string }>({
            Key: { AssetId: universalKey },
            allFields: true,
        })) || []

    const componentRows = rows
        .filter(isStandardNDJSONLine)
        .map((line) => {
            const AssetId = line.DataCategory as `ASSET#${string}`
            const { component } = standardComponentFactory(line)
            if (AssetId && component) {
                return {
                    childAssetId: AssetId,
                    component,
                }
            }
            return undefined
        })
        .filter(excludeUndefined)

    const raw = deriveRawImportVerticalHopsFromComponents(componentRows)
    const salvaged = salvageImportVerticalHops(raw)

    const expectedCategories = new Set(
        salvaged.map((h) =>
            metaImportDataCategory({
                parentAssetId: h.parentAssetId,
                childAssetId: h.childAssetId,
            })
        )
    )

    const existingMetaRows = rows.filter(
        (r) => typeof r.DataCategory === 'string' && r.DataCategory.startsWith(META_IMPORT_PREFIX)
    )
    const existingCategories = new Set(existingMetaRows.map((r) => r.DataCategory))

    const toDelete = existingMetaRows.filter((r) => !expectedCategories.has(r.DataCategory))
    const toPut = [...expectedCategories].filter((dc) => !existingCategories.has(dc))

    await Promise.all(
        toDelete.map((r) =>
            assetDB.deleteItem({
                AssetId: universalKey,
                DataCategory: r.DataCategory,
            })
        )
    )

    await Promise.all(
        toPut.map((DataCategory) =>
            assetDB.putItem({
                AssetId: universalKey,
                DataCategory,
            })
        )
    )

    internalCache.ComponentVerticals.invalidate(universalKey)
}
