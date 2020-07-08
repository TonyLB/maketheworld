// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { v4: uuidv4 } = require('/opt/uuid')
const { documentClient } = require('../utilities')

exports.getMaps = () => {
    const { TABLE_PREFIX, AWS_REGION } = process.env;

    return documentClient.scan({
        TableName: `${TABLE_PREFIX}_permanents`,
        FilterExpression: 'begins_with(PermanentId, :Map)',
        ExpressionAttributeValues: {
            ":Map": `MAP#`
        }
    }).promise()
    .then(({ Items }) => (Items.reduce((previous, { DataCategory, PermanentId, Rooms, ...rest }) => {
        const MapId = PermanentId.slice(4)
        if (DataCategory === 'Details') {
            return {
                ...previous,
                [MapId]: {
                    ...(previous[MapId] || {}),
                    MapId: PermanentId.slice(4),
                    Rooms: [
                        ...((previous[MapId] && previous[MapId].Rooms) || []),
                        ...Rooms
                    ],
                    ...rest
                }
            }
        }
        return previous
    }, {})))
    .then((maps) => (Object.values(maps)))
}

exports.putMap = async ({ MapId, Name, Rooms }) => {
    const { TABLE_PREFIX } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    const PermanentId = `MAP#${MapId || uuidv4()}`

    return documentClient.put({
            TableName: permanentTable,
            Item: {
                PermanentId,
                DataCategory: 'Details',
                Name,
                Rooms
            }
        }).promise()
        .then(() => ([{ Map: {
            MapId: PermanentId.slice(4),
            Name,
            Rooms
        }}]))
}
