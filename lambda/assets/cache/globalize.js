import {
    assetDB
} from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
import { AssetKey } from '@tonylb/mtw-utilities/dist/types.js'
import ScopeMap from '../serialize/scopeMap.js'

export const globalizeDBEntries = async (assetId, normalizedDBEntries) => {
    //
    // Pull scope-to-uuid mapping from Assets
    //
    const Items = await assetDB.query({
        IndexName: 'DataCategoryIndex',
        DataCategory: AssetKey(assetId),
        ProjectionFields: ['AssetId', 'scopedId']
    })
    //
    // Derive all existing scope-to-uuid mappings from stored data
    //
    const currentScopedToPermanentMapping = Items
        .reduce((previous, { scopedId, AssetId }) => ({
            ...previous,
            ...(scopedId ? { [scopedId]: AssetId } : {})
        }), {})

    const scopeMap = new ScopeMap(currentScopedToPermanentMapping)

    return scopeMap.translateNormalForm(normalizedDBEntries)
}

export default globalizeDBEntries