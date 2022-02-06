import { ephemeraDB } from '../dynamoDB/index.js'

export const forceDisconnect = async (ConnectionId) => {
    const Items = await ephemeraDB.query({
        IndexName: 'ConnectionIndex',
        ConnectionId,
        KeyConditionExpression: 'begins_with(EphemeraId, :EphemeraPrefix)',
        ExpressionAttributeValues: {
            ':EphemeraPrefix': 'CHARACTERINPLAY#'
        },
        ProjectionFields: ['EphemeraId', 'DataCategory']
    })

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
        ...(Items
            .map(({ EphemeraId, DataCategory }) => (
                ephemeraDB.update({
                    EphemeraId,
                    DataCategory,
                    UpdateExpression: 'SET Connected = :false REMOVE ConnectionId',
                    ExpressionAttributeValues: {
                        ':false': false
                    }
                })
            )))
    ])
}