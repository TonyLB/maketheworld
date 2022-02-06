import { ephemeraDB } from '../dynamoDB/index.js'

export const forceDisconnect = async (ConnectionId) => {
    const DataCategory = `CONNECTION#${ConnectionId}`
    const [Items, PlayerItems] = await Promise.all([
        ephemeraDB.query({
            IndexName: 'ConnectionIndex',
            ConnectionId,
            KeyConditionExpression: 'begins_with(EphemeraId, :EphemeraPrefix)',
            ExpressionAttributeValues: {
                ':EphemeraPrefix': 'CHARACTERINPLAY#'
            },
            ProjectionFields: ['EphemeraId', 'DataCategory']
        }),
        ephemeraDB.query({
            IndexName: 'DataCategoryIndex',
            DataCategory
        })
    ])

    await Promise.all([
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
        ...(PlayerItems
            .map(({ EphemeraId }) => (
                ephemeraDB.deleteItem({
                    EphemeraId,
                    DataCategory
                })
            ))
        ),
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