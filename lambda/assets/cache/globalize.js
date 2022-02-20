import { v4 as uuidv4 } from 'uuid'

import {
    assetDB
} from '/opt/utilities/dynamoDB/index.js'
import { splitType } from '/opt/utilities/types.js'

export const globalizeDBEntries = async (assetId, dbEntriesList) => {
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
    const scopedToPermanentMapping = dbEntriesList
        .reduce((previous, { tag, key, isGlobal }) => {
            let prefix = ''
            switch(tag) {
                case 'Variable':
                    prefix = 'VARIABLE'
                    break
                case 'Action':
                    prefix = 'ACTION'
                    break
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
    const globalizedDBEntries = dbEntriesList
        .map(({ tag, key, isGlobal, appearances, ...rest }) => {
            switch(tag) {
                case 'Room':
                    return {
                        EphemeraId: scopedToPermanentMapping[key],
                        appearances: appearances.map(({ exits, render, ...rest }) => {
                            const remappedExits = (exits && exits.length > 0)
                                ? exits
                                    .map(({ to, ...other }) => ({ to: splitType(scopedToPermanentMapping[to])[1], ...other }))
                                    .filter(({ to }) => (to))
                                : undefined
                            const remappedRender = (render && render.length > 0)
                                ? render.map((item) => {
                                    if (typeof item === 'string') {
                                        return item
                                    }
                                    switch(item.tag) {
                                        case 'Link':
                                            const { to, ...rest } = item
                                            return {
                                                    ...rest,
                                                    toAction: to,
                                                    toAssetId: assetId
                                                }
                                        default:
                                            return item
                                    }        
                                })
                                : undefined
                            return {
                                exits: remappedExits,
                                render: remappedRender,
                                ...rest
                            }
                        }).map(({ conditions, render, exits, name }) => ({ conditions, render, exits, name })),
                        ...rest
                    }    
                case 'Variable':
                    return {
                        EphemeraId: scopedToPermanentMapping[key],
                        defaultValue: rest['default'],
                        scopedId: key
                    }
                case 'Action':
                    return {
                        EphemeraId: scopedToPermanentMapping[key],
                        src: rest.src,
                        scopedId: key
                    }
                default:
                    return {}
            }
        })
        .filter(({ EphemeraId }) => (EphemeraId))
    return globalizedDBEntries
}

export default globalizeDBEntries