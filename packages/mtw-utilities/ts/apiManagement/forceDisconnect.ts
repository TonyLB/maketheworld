import { splitType } from '../types'
import { ephemeraDB } from '../dynamoDB'

const disconnectOneCharacter = async (ConnectionId: string, CharacterId: string) => {
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
    const assignedConnections = activeConnections.filter((value) => (value !== DataCategory))
    await Promise.all([
        ...(activeConnections.includes(DataCategory)
            ? [ephemeraDB.deleteItem({
                EphemeraId,
                DataCategory
            })]
            : []),
        ephemeraDB.update({
            EphemeraId,
            DataCategory: 'Meta::Character',
            UpdateExpression: 'SET Connected = :connected, ConnectionIds = :connectionIds',
            ExpressionAttributeValues: {
                ':connectionIds': assignedConnections,
                ':connected': assignedConnections.length > 0
            }
        })
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

    const { ConnectionIds: oldLibrarySubscription = [] } = await ephemeraDB.getItem({
        EphemeraId: 'Library',
        DataCategory: 'Subscriptions',
        ProjectionFields: ['ConnectionIds']
    }) as { ConnectionIds: string[] }

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
        ephemeraDB.update({
            EphemeraId: 'Library',
            DataCategory: 'Subscriptions',
            UpdateExpression: 'SET ConnectionIds = :connectionIds',
            ExpressionAttributeValues: {
                ':connectionIds': oldLibrarySubscription.filter((value) => (value !== ConnectionId))
            }    
        }),
        ...(connectedCharacterIds
            .map((CharacterId) => (
                disconnectOneCharacter(ConnectionId, CharacterId)
            )))
    ])
}