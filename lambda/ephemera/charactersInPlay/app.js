// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')

const { TABLE_PREFIX, AWS_REGION } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

const promiseDebug = (result) => {
    console.log(result)
    return result
}

const batchDispatcher = (items) => {
    const groupBatches = items.reduce((({ current, requestLists }, item) => {
            if (current.length > 23) {
                return {
                    requestLists: [ ...requestLists, current ],
                    current: [item]
                }
            }
            else {
                return {
                    requestLists,
                    current: [...current, item]
                }
            }
        }), { current: [], requestLists: []})
    const batchPromises = [...groupBatches.requestLists, groupBatches.current]
        .filter((itemList) => (itemList.length))
        .map((itemList) => (documentClient.batchWrite({ RequestItems: {
            [ephemeraTable]: itemList
        } }).promise()))
    return Promise.all(batchPromises)
}

const removeType = (stringVal) => (stringVal.split('#').slice(1).join('#'))

const updateMap = (previous, { CharacterId, ...rest }) => ({
    ...previous,
    [CharacterId]: {
        CharacterId,
        ...(previous[CharacterId] || {}),
        ...rest
    }
})

const getCharactersInPlay = () => {

    return documentClient.scan({
            TableName: ephemeraTable,
            FilterExpression: "begins_with(EphemeraId, :Character)",
            ExpressionAttributeValues: {
                ":Character": "CHARACTERINPLAY#"
            }
        }).promise()
        .then(({ Items }) => (Items.reduce((previous, { EphemeraId, DataCategory, RoomId }) => {
            const CharacterId = removeType(EphemeraId)
            if (DataCategory.startsWith('CONNECTION#')) {
                return updateMap(previous, { CharacterId, ConnectionId: removeType(DataCategory) })
            }
            if (DataCategory === 'Room') {
                return updateMap(previous, { CharacterId, RoomId })
            }
            return previous
        }, {})))
        .then((itemMap) => (Object.values(itemMap)))
        .then((Items) => (Items
            .filter(({ ConnectionId }) => (ConnectionId))
            .map(({ CharacterId, ConnectionId, RoomId }) => ({ CharacterId, ConnectionId, RoomId }))
        ))
        .catch((err) => ({ error: err.stack }))

}

const dbDiff = (oldItems, newItems) => {
    console.log(`Old Items: ${JSON.stringify(oldItems, null, 4)}`)
    console.log(`New Items: ${JSON.stringify(newItems, null, 4)}`)
    const itemsToDelete = oldItems.filter(({ EphemeraId, DataCategory }) => (!newItems.find((item) => (item.EphemeraId === EphemeraId && item.DataCategory === DataCategory))))
    const itemsToUpdate = newItems.filter((newItem) => (!oldItems.find((oldItem) => {
        return !(Object.keys(newItem).find((newKey) => (newItem[newKey] && (!oldItem[newKey] || oldItem[newKey] != newItem[newKey])))
            || Object.keys(oldItem).find((oldKey) => (oldItem[oldKey] && (!newItem[oldKey] || newItem[oldKey] != oldItem[oldKey]))))
    })))
    console.log(`Items to Delete: ${JSON.stringify(itemsToDelete, null, 4)}`)
    console.log(`Items to Update: ${JSON.stringify(itemsToUpdate, null, 4)}`)
    return [
        ...(itemsToDelete.map(({ EphemeraId, DataCategory }) => ({
            DeleteRequest: {
                Key: {
                    EphemeraId,
                    DataCategory
                }
            }
        }))),
        ...(itemsToUpdate.map((Item) => ({
            PutRequest: { Item }
        })))
    ]
}

const putCharacterInPlay = async ({ CharacterId, ConnectionId, RoomId, deleteRecord=false }) => {

    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    const oldItems = await documentClient.query({
            TableName: ephemeraTable,
            KeyConditionExpression: 'EphemeraId = :EphemeraId',
            ExpressionAttributeValues: {
                ":EphemeraId": EphemeraId
            }
        }).promise()
        .then(({ Items }) => (Items))

    const oldRecord = oldItems.reduce((previous, { DataCategory, RoomId }) => {
            if (DataCategory === 'Room') {
                return {
                    ...previous,
                    CharacterId,
                    RoomId
                }
            }
            if (DataCategory.startsWith('CONNECTION#')) {
                return {
                    ...previous,
                    CharacterId,
                    ConnectionId: removeType(DataCategory)
                }
            }
            return previous
        }, {})

    const newRecord = await (deleteRecord
        ? Promise.resolve({
            CharacterId,
            RoomId: RoomId || oldRecord.RoomId
        })
        : Promise.resolve({
            ...oldRecord,
            CharacterId,
            ...(ConnectionId ? { ConnectionId } : {}),
            ...(RoomId ? { RoomId } : {}),
        }))
            .then((Item) => {
                if (!(Item.RoomId || RoomId)) {
                    return documentClient.get({
                            TableName: `${TABLE_PREFIX}_permanents`,
                            Key: {
                                PermanentId: `CHARACTER#${CharacterId}`,
                                DataCategory: 'Details'
                            }
                        }).promise()
                        .then(({ Item }) => (Item || {}))
                        .then(({ HomeId = 'VORTEX' }) => ({ ...Item, RoomId: HomeId }) )
                }
                else {
                    return {
                        ...Item,
                        RoomId: Item.RoomId || RoomId || 'VORTEX'
                    }
                }
            })

    console.log(newRecord.RoomId)
    const newItems = [
        ...(newRecord.ConnectionId ? [{ EphemeraId, DataCategory: `CONNECTION#${newRecord.ConnectionId}` }] : [] ),
        ...(newRecord.RoomId ? [{ EphemeraId, DataCategory: `Room`, RoomId: newRecord.RoomId }] : [] ),
    ]

    const diffItems = dbDiff(oldItems, newItems)

    return batchDispatcher(diffItems)
        .then(() => (newRecord))

}

exports.handler = (event) => {

    const { action = 'NO-OP' } = event

    switch(action) {
        case 'getCharactersInPlay':
            return getCharactersInPlay()
        case 'putCharacterInPlay':
            return putCharacterInPlay({
                CharacterId: event.CharacterId,
                ConnectionId: event.ConnectionId,
                RoomId: event.RoomId
            })
        case 'deleteCharacterInPlay':
            return documentClient.query({
                    TableName: ephemeraTable,
                    KeyConditionExpression: "DataCategory = :ConnectionId",
                    ExpressionAttributeValues: {
                        ":ConnectionId": `CONNECTION#${event.ConnectionId}`
                    },
                    IndexName: 'DataCategoryIndex'
                }).promise()
                .then(({ Items }) => (Items && Items[0]))
                .then(({ EphemeraId }) => (EphemeraId && removeType(EphemeraId)))
                .then((CharacterId) => (
                    (CharacterId && putCharacterInPlay({
                        CharacterId,
                        deleteRecord: true
                    })) || {}
                ))
        default:
            return { statusCode: 500, error: `Unknown handler key: ${action}`}
    }
}