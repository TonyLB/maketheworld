import { ephemeraDB } from '../dynamoDB'
import { AssetKey, splitType } from '../types'
import { RoomCache } from './baseClasses'

export const getItemMeta = async (items) => {
    const getSingleMeta = async (EphemeraId) => {
        switch(splitType(EphemeraId)[0]) {
            case 'CHARACTERINPLAY':
                const characterItem = await ephemeraDB.getItem({
                    EphemeraId,
                    DataCategory: 'Meta::Character',
                    ProjectionFields: ['#name', 'fileURL', 'FirstImpression', 'OneCoolThing', 'Outfit', 'Pronouns'],
                    ExpressionAttributeNames: {
                        '#name': 'Name'
                    }
                })
                return { [EphemeraId]: [{
                    DataCategory: 'Meta::Character',
                    ...characterItem
                }] }
            default:
                const metaItems = await ephemeraDB.query({
                    EphemeraId,
                    ProjectionFields: ['DataCategory', 'appearances', '#name', 'activeCharacters'],
                    ExpressionAttributeNames: {
                        '#name': 'name'
                    }
                })
                return { [EphemeraId]: metaItems }        
        }
    }
    const allRooms = await Promise.all(items.map(getSingleMeta))
    return Object.assign({}, ...allRooms)
}

export const getGlobalAssets = async (priorGlobalAssets?: any) => {
    if (priorGlobalAssets !== undefined) {
        return priorGlobalAssets
    }
    const { assets = [] }: { assets?: string[] } = await ephemeraDB.getItem({
        EphemeraId: 'Global',
        DataCategory: 'Assets',
        ProjectionFields: ['assets']
    }) || {}
    return assets
}

export const getCharacterAssets = async (characters, priorCharacterAssets = {}) => {
    //
    // TODO: Add RoomId to projection fields, and then use that to populate the
    // RoomId for any links rendered for that character
    //
    const getSingleCharacterAssets = async (characterId) => {
        const { assets = [], RoomId }: { assets?: string[], RoomId?: string } = await ephemeraDB.getItem({
            EphemeraId: `CHARACTERINPLAY#${characterId}`,
            DataCategory: 'Meta::Character',
            ProjectionFields: ['assets', 'RoomId']
        }) || {}
        return { [characterId]: { assets, RoomId } }
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
                [assetId]: {
                    ...existingStatesByAsset[assetId],
                    State: Object.entries(existingStatesByAsset[assetId]?.State || {})
                        .reduce((previous, [key, item]: [key: string, item: any]) => ({ ...previous, [key]: item?.value }), {}),
                }
            }
        }
        const { State = {}, mapCache = {} }: { State?: Record<string, any>, mapCache?: RoomCache } = await ephemeraDB.getItem({
            EphemeraId: AssetKey(assetId),
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['#state', 'mapCache'],
            ExpressionAttributeNames: {
                '#state': 'State'
            }
        }) || {}
        return {
            [assetId]: {
                State: Object.entries(State).reduce((previous, [key, { value }]) => ({ ...previous, [key]: value }), {}),
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
    const { normalForm = {} }: { normalForm?: Record<string, any> } = await ephemeraDB.getItem({
        EphemeraId: AssetKey(assetId),
        DataCategory: 'Meta::AssetNormalized',
        ProjectionFields: ['normalForm']
    }) || {}
    return normalForm
}