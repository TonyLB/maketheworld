import { ephemeraDB, connectionDB } from '../dynamoDB'

const disconnectOneCharacter = async (ConnectionId: string, CharacterId: string) => {
    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    const DataCategory = `CONNECTION#${ConnectionId}`
    const activeConnectionQuery = await connectionDB.query({
        ConnectionId: CharacterId,
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
            ? [connectionDB.deleteItem({
                ConnectionId: CharacterId,
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
    const Items = await connectionDB.query({
        IndexName: 'DataCategoryIndex',
        DataCategory: `CONNECTION#${ConnectionId}`
    })
    const connectedCharacterIds = Items
        .map(({ ConnectionId }) => (ConnectionId))

    const { ConnectionIds: oldLibrarySubscription = [] } = (await connectionDB.getItem<{
        ConnectionIds: string[]
    }>({
        ConnectionId: 'Library',
        DataCategory: 'Subscriptions',
        ProjectionFields: ['ConnectionIds']
    }) as { ConnectionIds: string[] }) || {}

    await Promise.all([
        connectionDB.deleteItem({
            ConnectionId,
            DataCategory: 'Meta::Connection'
        }),
        connectionDB.update({
            ConnectionId: 'Global',
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
        connectionDB.update({
            ConnectionId: 'Library',
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