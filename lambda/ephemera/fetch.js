// Copyright 2021 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb')

//
// Some temporary functions to (poorly) handle serialization from the Ephemera
// table structures to the format that is (currently) delivered over the
// websocket Lifeline.
//
// TODO:  Rework both sides of the protocol to be less beholden to GraphQL
// weirdness
//

const splitEphemeraId = (EphemeraId) => {
    const sections = EphemeraId.split('#')
    if (!(sections.length > 1)) {
        return [EphemeraId]
    }
    else {
        return [sections[0], sections.slice(1).join('#')]
    }
}

const serialize = ({
    EphemeraId,
    Connected,
    RoomId,
    Name
}) => {
    const [type, payload] = splitEphemeraId(EphemeraId)
    switch(type) {
        case 'CHARACTERINPLAY':
            return {
                CharacterInPlay: {
                    CharacterId: payload,
                    Connected,
                    RoomId,
                    Name
                }
            }
        //
        // TODO:  More serializers for more data types!
        //
        default:
            return null
    }
}

const fetchEphemera = () => {
    const { Items = [] } = dbClient.send(new QueryCommand({
        TableName: ephemeraTable,
        KeyConditionExpression: 'DataCategory = :DataCategory and begins_with(EphemeraId, :EphemeraId)',
        ExpressionAttributeValues: marshall({
            ":EphemeraId": "CHARACTERINPLAY#",
            ":DataCategory": "Connection"
        }),
        IndexName: 'DataCategoryIndex'
    }))
    const returnItems = Items.map(unmarshall)
        .map(serialize)
        .filter((value) => value)
    //
    // TODO:  Instead of depending upon APIGateway to route the message back
    // to its own connection, maybe manually route multiple messages, so that
    // you can break a large scan into limited message-lengths.
    //
    return {
        messageType: 'Ephemera',
        updates: returnItems
    }
}

exports.fetchEphemera = fetchEphemera
