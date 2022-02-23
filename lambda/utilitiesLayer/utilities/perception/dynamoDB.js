import { ephemeraDB } from '../dynamoDB/index.js'

export const getRoomMeta = async (rooms) => {
    const getSingleRoomMeta = async (EphemeraId) => {
        const roomItems = await ephemeraDB.query({
            EphemeraId,
            ProjectionFields: ['DataCategory', 'appearances'],
        })
        return { [EphemeraId]: roomItems }
    }
    const allRooms = await Promise.all(rooms.map(getSingleRoomMeta))
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

export const getStateByAsset = async (assets) => {
    const getSingleState = async (assetId) => {
        const { State = {} } = await ephemeraDB.getItem({
            EphemeraId: `ASSET#${assetId}`,
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['#state'],
            ExpressionAttributeNames: {
                '#state': 'State'
            }
        })
        return { [assetId]: Object.entries(State).reduce((previous, [key, { value }]) => ({ ...previous, [key]: value }), {}) }
    }
    const allStates = await Promise.all(assets.map(getSingleState))
    return Object.assign({}, ...allStates)
}
