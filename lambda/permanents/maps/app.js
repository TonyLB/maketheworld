// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('/opt/uuid')


exports.getMaps = () => {
    const { TABLE_PREFIX, AWS_REGION } = process.env;

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

    return documentClient.scan({
        TableName: `${TABLE_PREFIX}_permanents`,
        FilterExpression: 'begins_with(PermanentId, :Map)',
        ExpressionAttributeValues: {
            ":Map": `MAP#`
        }
    }).promise()
    .then(({ Items }) => (Items.reduce((previous, { DataCategory, PermanentId, ...rest }) => {
        const MapId = PermanentId.slice(4)
        if (DataCategory === 'Details') {
            return {
                ...previous,
                [MapId]: {
                    ...(previous[MapId] || {}),
                    MapId: PermanentId.slice(4),
                    ...rest
                }
            }
        }
        if (DataCategory.startsWith('ROOM#')) {
            const RoomId = DataCategory.slice(5)
            const { X, Y } = rest
            return (RoomId && X && Y)
                ? {
                    ...previous,
                    [MapId]: {
                        ...(previous[MapId] || {}),
                        Rooms: [
                            ...((previous[MapId] || {}).Rooms || []),
                            {
                                PermanentId: RoomId,
                                X,
                                Y
                            }
                        ]
                    }
                }
                : previous
        }
    }, {})))
    .then((maps) => (Object.values(maps)))
}

const batchDispatcher = (documentClient) => (items) => {
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
            [`${process.env.TABLE_PREFIX}_permanents`]: itemList
        } }).promise()))
    return Promise.all(batchPromises)
}

exports.putMap = async (payload) => {
    const { TABLE_PREFIX, AWS_REGION } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

    const PermanentId = `MAP#${payload.MapId || uuidv4()}`
    const desiredState = [
        {
            PermanentId,
            DataCategory: 'Details',
            Name: payload.Name
        },
        ...(payload.Rooms.map(({ PermanentId: RoomId, X, Y }) => ({
            PermanentId,
            DataCategory: `ROOM#${RoomId}`,
            X,
            Y
        })))
    ]

    const currentState = await documentClient.query({
        TableName: permanentTable,
        KeyConditionExpression: 'PermanentId = :MapId',
        ExpressionAttributeValues: {
            ':MapId': PermanentId
        }
    }).promise().then(({ Items }) => (Items))

    const stateCompare = ({ DataCategory: DataCategoryA, ...propsA }, { DataCategory: DataCategoryB, ...propsB }) => {
        if (DataCategoryA === 'Details') {
            return propsA.Name === propsB.Name
        }
        return (propsA.X === propsB.X) && (propsA.Y === propsB.Y)
    }

    const deleteEntries = currentState
        .filter(({ DataCategory }) => (!desiredState.find(({ DataCategory: check}) => (check === DataCategory))))
    const putEntries = desiredState
        .filter((entry) => {
            const current = currentState.find(({ DataCategory }) => (DataCategory === entry.DataCategory))
            return !(current && stateCompare(entry, current))
        })
    return Promise.resolve([
        ...(deleteEntries.map(({ PermanentId, DataCategory }) => ({
            DeleteRequest: {
                Key: {
                    PermanentId,
                    DataCategory
                }
            }
        }))),
        ...(putEntries.map((Item) => ({
            PutRequest: {
                Item
            }
        })))
    ])
        .then(batchDispatcher(documentClient))
        .then(() => ([{ Map: {
            ...payload,
            MapId: PermanentId.slice(4)
        }}]))
}
