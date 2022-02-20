import { v4 as uuidv4 } from 'uuid'

import {
    assetDB
} from '/opt/utilities/dynamoDB/index.js'
import { splitType } from '/opt/utilities/types.js'

export const globalizeDBEntries = async (assetId, normalizedDBEntries) => {
    //
    // Pull scope-to-uuid mapping from Assets
    //
    const Items = await assetDB.query({
        IndexName: 'DataCategoryIndex',
        DataCategory: `ASSET#${assetId}`,
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
    //
    // Add any incoming entries that have not yet been mapped
    // NOTE:  There should be none.
    //
    const scopedToPermanentMapping = Object.values(normalizedDBEntries)
        .filter(({ tag }) => (['Room'].includes(tag)))
        .reduce((previous, { tag, key, isGlobal }) => {
            let prefix = ''
            switch(tag) {
                default:
                    prefix = 'ROOM'
            }
            const newEphemeraId = isGlobal
                ? `${prefix}#${key}`
                : previous[key] || `${prefix}#${uuidv4()}`
            return {
                ...previous,
                [key]: newEphemeraId
            }
        }, currentScopedToPermanentMapping)

    return Object.values(normalizedDBEntries)
        .filter(({ tag }) => (['Room'].includes(tag)))
        .reduce((previous, { key }) => ({
            ...previous,
            [key]: {
                ...(previous[key] || {}),
                EphemeraId: scopedToPermanentMapping[key]
            }
        }),
        normalizedDBEntries)
}

export default globalizeDBEntries