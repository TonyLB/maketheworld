// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')

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
