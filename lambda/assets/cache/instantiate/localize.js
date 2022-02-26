import { v4 as uuidv4 } from 'uuid'

import {
    assetDB,
    ephemeraDB
} from '/opt/utilities/dynamoDB/index.js'
import { splitType, AssetKey } from '/opt/utilities/types.js'
import ScopeMap from '../../serialize/scopeMap.js'

export const localizeDBEntries = async ({
    assetId,
    normalizedDBEntries
}) => {
    //
    // Pull existing scope-to-uuid mapping from Ephemera
    //
    const Items = await ephemeraDB.query({
        IndexName: 'DataCategoryIndex',
        DataCategory: AssetKey(assetId),
        ProjectionFields: ['EphemeraId', 'scopedId']
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
    const mappedNormalForm = scopeMap.translateNormalForm(normalizedDBEntries)

    return {
        scopeMap: scopeMap.serialize()
    }
    
}

export default localizeDBEntries