import { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { isStandardNDJSONLine } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import { syncImportVerticalPartition } from './syncImportVerticalPartition'

export type HealComponentVerticalResult = {
    assetId: string
    universalKeysProcessed: number
}

/**
 * Re-syncs `Meta::Import` projections for every universal component id that appears in this asset
 * (optionally filtered), using the same partition sync + salvage rules as the live projector.
 */
export async function healComponentVertical(params: {
    assetId: string
    componentUniversalKeys?: EphemeraId[]
}): Promise<HealComponentVerticalResult> {
    const assetId = AssetKey(params.assetId)
    const rows =
        (await assetDB.query<StandardComponentData & { AssetId: string; DataCategory: string }>({
            IndexName: 'DataCategoryIndex',
            Key: { DataCategory: assetId },
            allFields: true,
        })) || []

    const universalKeys = new Set<EphemeraId>()
    for (const line of rows) {
        if (!isStandardNDJSONLine(line)) {
            continue
        }
        const { component } = standardComponentFactory(line)
        const uk = component?.universalKey
        if (!uk) {
            continue
        }
        const id = uk as EphemeraId
        if (params.componentUniversalKeys && !params.componentUniversalKeys.includes(id)) {
            continue
        }
        universalKeys.add(id)
    }

    await Promise.all([...universalKeys].map((uk) => syncImportVerticalPartition(uk)))

    return {
        assetId,
        universalKeysProcessed: universalKeys.size,
    }
}
