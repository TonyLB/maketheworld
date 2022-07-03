import { splitType } from '@tonylb/mtw-utilities/dist/types.js'
import { assetDB, ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
import { generatePersonalAssetLibrary } from '@tonylb/mtw-utilities/dist/selfHealing/index.js'

export const getPlayerByConnectionId = async (connectionId) => {
    const { player } = await ephemeraDB.getItem({
        EphemeraId: `CONNECTION#${connectionId}`,
        DataCategory: 'Meta::Connection',
        ProjectionFields: ['player']
    })
    return player
}

export const convertAssetQuery = (queryItems) => {
    const Characters = queryItems
        .filter(({ DataCategory }) => (DataCategory === 'Meta::Character'))
        .map(({ AssetId, Name, scopedId, fileName, fileURL, FirstImpression, Pronouns, OneCoolThing, Outfit }) => ({ CharacterId: splitType(AssetId)[1], Name, scopedId, fileName, fileURL, Pronouns, FirstImpression, OneCoolThing, Outfit }))
    const Assets = queryItems
        .filter(({ DataCategory }) => (DataCategory === 'Meta::Asset'))
        .map(({ AssetId, scopedId, Story, instance }) => ({ AssetId: splitType(AssetId)[1], scopedId, Story, instance }))

    return {
        Characters,
        Assets
    }
}

