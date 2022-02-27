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
    // Extract imported assets to lookup scope mappings
    //
    const importAssetMappings = Object.values(normalizedDBEntries)
        .filter(({ tag }) => (tag === 'Import'))
        .reduce((previous, { from, mapping }) => ({
            ...previous,
            [from]: mapping
        }), {})

    const populateMapping = async (assetId) => {
        const items = await assetDB.query({
            IndexName: 'DataCategoryIndex',
            DataCategory: AssetKey(assetId),
            ProjectionFields: ['AssetId', 'scopedId']
        })
        return items.reduce((previous, { AssetId, scopedId }) => {
            const mapping = importAssetMappings[assetId]
            return Object.entries(mapping)
                .filter(([_, checkKey]) => (checkKey === scopedId))
                .reduce((accumulator, [localKey]) => ({
                    ...accumulator,
                    [localKey]: AssetId
                }), previous)
        }, {})
    }

    const importedAssetEntries = await Promise.all(
        Object.keys(importAssetMappings).map((importedAsset) => (populateMapping(importedAsset)))
    )

    const importedScopeMapping = Object.assign({}, ...importedAssetEntries)

    //
    // Pull existing scope-to-uuid mapping from Ephemera
    //
    const Items = await ephemeraDB.query({
        IndexName: 'DataCategoryIndex',
        DataCategory: AssetKey(assetId),
        ProjectionFields: ['EphemeraId', '#key'],
        ExpressionAttributeNames: {
            '#key': 'key'
        }
    })
    //
    // Derive all existing scope-to-uuid mappings from stored data
    //
    const currentScopedToPermanentMapping = Items
        .reduce((previous, { key, EphemeraId }) => ({
            ...previous,
            ...(key ? { [key]: EphemeraId } : {})
        }), importedScopeMapping)

    const scopeMap = new ScopeMap(currentScopedToPermanentMapping)
    const mappedNormalForm = scopeMap.translateNormalForm(normalizedDBEntries)

    return {
        scopeMap: scopeMap.serialize()
    }
    
}

export default localizeDBEntries