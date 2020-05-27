// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')

const breakOutType = (permanentId) => ([permanentId.split('#')[0], permanentId.split('#').slice(1).join('#')])

const itemReducer = (previous, {
    PermanentId: FetchedPermanentId,
    DataCategory,
    ParentId,
    Name,
    Description,
    Visibility,
    Topology = 'Dead-End',
    ContextMapId
}) => {
    const [typeLabel, PermanentId] = breakOutType(FetchedPermanentId)
    if (DataCategory === 'Details') {
        return {
            ...previous,
            [PermanentId]: {
                ...(previous[PermanentId] || {}),
                ["__typename"]: typeLabel === 'NEIGHBORHOOD' ? 'Neighborhood' : 'Room',
                PermanentId,
                ParentId,
                Name,
                Description,
                Visibility: Visibility || (typeLabel === 'NEIGHBORHOOD' ? 'Private' : 'Public'),
                Topology,
                ContextMapId
            }
        }
    }

    const [dataTypeLabel, RoomId] = breakOutType(DataCategory)
    if (typeLabel === 'ROOM' && dataTypeLabel === 'EXIT') {
        return {
            ...previous,
            [PermanentId]: {
                ...(previous[PermanentId] || {}),
                Exits: [
                    ...((previous[PermanentId] && previous[PermanentId].Exits) || []),
                    {
                        RoomId,
                        Name
                    }
                ]
            },
            [RoomId]: {
                ...(previous[RoomId] || {}),
                Entries: [
                    ...((previous[RoomId] && previous[RoomId].Entries) || []),
                    {
                        RoomId: PermanentId,
                        Name
                    }
                ]
            }
        }
    }
    return previous
}

exports.getNodeTree = () => {

    const { TABLE_PREFIX, AWS_REGION } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

    return documentClient.scan({
            TableName: permanentTable,
            FilterExpression: "begins_with(#PermanentId, :Neighborhood) or begins_with(#PermanentId, :Room)",
            ExpressionAttributeNames: {
                "#PermanentId": "PermanentId"
            },
            ExpressionAttributeValues: {
                ":Neighborhood": "NEIGHBORHOOD",
                ":Room": "ROOM"
            }
        }).promise()
        .then(({ Items = [] }) => (Items.reduce(itemReducer, {})))
        .then((itemMap) => (Object.values(itemMap)))
        .then((items) => (items.filter(({ PermanentId }) => (PermanentId))))
        .then((items) => (items.map(({ __typename, ...rest }) => ({
            [__typename]: rest
        }))))

}
