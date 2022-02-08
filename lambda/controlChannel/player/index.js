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

export const whoAmI = async (connectionId, RequestId) => {
    const username = await getPlayerByConnectionId(connectionId)
    if (username) {
        const { Characters, CodeOfConductConsent } = await assetDB.getItem({
            AssetId: `PLAYER#${username}`,
            DataCategory: 'Meta::Player',
            ProjectionFields: ['Characters', 'CodeOfConductConsent']
        })
        return {
            statusCode: 200,
            body: JSON.stringify({
                messageType: 'Player',
                PlayerName: username,
                Characters: Object.entries(Characters || {}).reduce((previous, [CharacterId, { Name, scopedId, fileName }]) => ([...previous, { CharacterId, Name, scopedId, fileName }]), []),
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
