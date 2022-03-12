import { splitType } from '/opt/utilities/types.js'
import { assetDB, ephemeraDB } from '/opt/utilities/dynamoDB/index.js'

export const getPlayerByConnectionId = async (connectionId) => {
    const { player } = await ephemeraDB.getItem({
        EphemeraId: `CONNECTION#${connectionId}`,
        DataCategory: 'Meta::Connection',
        ProjectionFields: ['player']
    })
    return player
}

//
// Returns all of the meta data about Player in the Ephemera table, as
// well as a connections array of the currently active lifeLine connections
//
export const getConnectionsByPlayerName = async (PlayerName) => {
    const Items = await ephemeraDB.query({
        IndexName: 'DataCategoryIndex',
        DataCategory: 'Meta::Connection',
        FilterExpression: 'player = :player',
        ExpressionAttributeValues: {
            ':player': PlayerName
        },
    })
    const returnVal = Items
        .reduce((previous, { EphemeraId }) => {
            const [ itemType, itemKey ] = splitType(EphemeraId)
            if (itemType === 'CONNECTION') {
                return [...previous, itemKey]
            }
            return previous
        }, [])
    return returnVal
}

export const convertAssetQuery = (queryItems) => {
    const Characters = queryItems
        .filter(({ DataCategory }) => (DataCategory === 'Meta::Character'))
        .map(({ AssetId, Name, scopedId, fileName, fileURL }) => ({ CharacterId: splitType(AssetId)[1], Name, scopedId, fileName, fileURL }))
    const Assets = queryItems
        .filter(({ DataCategory }) => (DataCategory === 'Meta::Asset'))
        .map(({ AssetId, scopedId, Story, instance }) => ({ AssetId: splitType(AssetId)[1], scopedId, Story, instance }))

    return {
        Characters,
        Assets
    }
}

export const whoAmI = async (connectionId, RequestId) => {
    const username = await getPlayerByConnectionId(connectionId)
    if (username) {
        const [{ CodeOfConductConsent }, queryItems] = await Promise.all([
            assetDB.getItem({
                AssetId: `PLAYER#${username}`,
                DataCategory: 'Meta::Player',
                ProjectionFields: ['CodeOfConductConsent']
            }),
            assetDB.query({
                IndexName: 'PlayerIndex',
                player: username,
                ProjectionFields: ['AssetId', 'DataCategory', '#name', 'scopedId', 'fileName', 'fileURL', 'Story', 'instance'],
                ExpressionAttributeNames: {
                    '#name': 'Name'
                }
            })
        ])
        const { Characters, Assets } = convertAssetQuery(queryItems)
        return {
            statusCode: 200,
            body: JSON.stringify({
                messageType: 'Player',
                PlayerName: username,
                Assets,
                Characters,
                CodeOfConductConsent,
                RequestId
            })
        }
    }
    else {
        return {
            statusCode: 200,
            body: JSON.stringify({
                messageType: 'Error'
            })
        }
    }
}
