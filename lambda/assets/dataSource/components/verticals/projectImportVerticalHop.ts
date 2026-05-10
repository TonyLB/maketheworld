import { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { syncImportVerticalPartition } from './syncImportVerticalPartition'

export type ImportVerticalHeaderType = 'Component Updated' | 'Component Republished' | 'Component Removed'

/**
 * Maintains `Meta::Import` hop rows for `component.universalKey` from authoritative cached
 * component state (full partition sync + cycle salvage).
 */
export async function projectImportVerticalHop(params: {
    headerType: ImportVerticalHeaderType
    component: StandardComponent
    childAssetId: AssetUUID
}): Promise<void> {
    const { component, childAssetId } = params
    const universalKey = component.universalKey
    if (!universalKey || !childAssetId) {
        return
    }
    await syncImportVerticalPartition(universalKey as EphemeraId)
}
