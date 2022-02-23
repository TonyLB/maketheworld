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

export const getCharacterAssets = async (characters) => {
    const getSingleCharacterAssets = async (characterId) => {
        const { assets = [] } = await ephemeraDB.getItem({
            EphemeraId: `CHARACTERINPLAY#${characterId}`,
            DataCategory: 'Meta::Character',
            ProjectionFields: ['assets']
        })
        return { [characterId]: assets }
    }
    const allCharacters = await Promise.all(characters.map(getSingleCharacterAssets))
    return Object.assign({}, ...allCharacters)
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
