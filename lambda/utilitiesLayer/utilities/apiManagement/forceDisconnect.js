import { splitType } from '../types.js'
import { ephemeraDB } from '../dynamoDB/index.js'

const disconnectOneCharacter = async (ConnectionId, CharacterId) => {
    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    const DataCategory = `CONNECTION#${ConnectionId}`
    const activeConnectionQuery = await ephemeraDB.query({
        EphemeraId,
        KeyConditionExpression: 'begins_with(DataCategory, :dc)',
        ExpressionAttributeValues: {
            ':dc': 'CONNECTION#'
        },
        ProjectionFields: ['DataCategory']
    })
    const activeConnections = activeConnectionQuery.map(({ DataCategory }) => (DataCategory))
    await Promise.all([
        ...(activeConnections.includes(DataCategory)
            ? [ephemeraDB.deleteItem({
                EphemeraId,
                DataCategory
            })]
            : []),
        ...((activeConnections.filter((value) => (value !== DataCategory)).length > 0)
            ? []
            : [await ephemeraDB.update({
                EphemeraId,
                DataCategory: 'Meta::Character',
                UpdateExpression: 'SET Connected = :false',
                ExpressionAttributeValues: {
                    ':false': false
                }
            })]),
    ])
}

export const forceDisconnect = async (ConnectionId) => {
    const Items = await ephemeraDB.query({
        IndexName: 'DataCategoryIndex',
        DataCategory: `CONNECTION#${ConnectionId}`
    })
    const connectedCharacterIds = Items
        .filter(({ EphemeraId }) => (splitType(EphemeraId)[0] === 'CHARACTERINPLAY'))
        .map(({ EphemeraId }) => (splitType(EphemeraId)[1]))

    await Promise.all([
        ephemeraDB.deleteItem({
            EphemeraId: `CONNECTION#${ConnectionId}`,
            DataCategory: 'Meta::Connection'
        }),
        ephemeraDB.update({
            EphemeraId: 'Global',
            DataCategory: 'Connections',
            UpdateExpression: 'REMOVE connections.#connectionId',
            ExpressionAttributeNames: {
                '#connectionId': ConnectionId
            }
            //
            // TODO: When self-Healing is lifted to utility layer, add a catchException
            // callback here to heal global connections
            //
        }),
        ...(connectedCharacterIds
            .map((CharacterId) => (
                disconnectOneCharacter(ConnectionId, CharacterId)
            )))
    ])
}