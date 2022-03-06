import { ephemeraDB } from '../dynamoDB/index.js'
import { AssetKey } from '../types.js'

export const getItemMeta = async (items) => {
    const getSingleMeta = async (EphemeraId) => {
        const metaItems = await ephemeraDB.query({
            EphemeraId,
            ProjectionFields: ['DataCategory', 'appearances', '#name'],
            ExpressionAttributeNames: {
                '#name': 'name'
            }
        })
        return { [EphemeraId]: metaItems }
    }
    const allRooms = await Promise.all(items.map(getSingleMeta))
    return Object.assign({}, ...allRooms)
}

export const getGlobalAssets = async (priorGlobalAssets) => {
    if (priorGlobalAssets !== undefined) {
        return priorGlobalAssets
    }
    const { assets = [] } = await ephemeraDB.getItem({
        EphemeraId: 'Global',
        DataCategory: 'Assets',
        ProjectionFields: ['assets']
    })
    return assets
}

export const getCharacterAssets = async (characters, priorCharacterAssets = {}) => {
    const getSingleCharacterAssets = async (characterId) => {
        const { assets = [] } = await ephemeraDB.getItem({
            EphemeraId: `CHARACTERINPLAY#${characterId}`,
            DataCategory: 'Meta::Character',
            ProjectionFields: ['assets']
        })
        return { [characterId]: assets }
    }
    const neededCharacters = await Promise.all(
        characters
            .filter((character) => (!(character in priorCharacterAssets)))
            .map(getSingleCharacterAssets)
    )
    return Object.assign(priorCharacterAssets, ...neededCharacters)
}

export const getStateByAsset = async (assets, existingStatesByAsset = {}) => {
    const getSingleState = async (assetId, existingStatesByAsset = {}) => {
        if (existingStatesByAsset[assetId]) {
            return {
                [assetId]: existingStatesByAsset[assetId]
            }
        }
        const { State = {}, mapCache = {} } = await ephemeraDB.getItem({
            EphemeraId: AssetKey(assetId),
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['#state', 'mapCache'],
            ExpressionAttributeNames: {
                '#state': 'State'
            }
        })
        return {
            [assetId]: {
                state: Object.entries(State).reduce((previous, [key, { value }]) => ({ ...previous, [key]: value }), {}),
                mapCache
            }
        }
    }
    const allStates = await Promise.all(assets.map((assetId) => (getSingleState(assetId, existingStatesByAsset))))
    return Object.assign({}, ...allStates)
}

export const getNormalForm = async (assetId, existingNormalFormsByAsset = {}) => {
    if (existingNormalFormsByAsset[assetId]) {
        return existingNormalFormsByAsset[assetId]
    }
    const { normalForm = {} } = await ephemeraDB.getItem({
        EphemeraId: AssetKey(assetId),
        DataCategory: 'Meta::AssetNormalized',
        ProjectionFields: ['normalForm']
    })
    return normalForm
}