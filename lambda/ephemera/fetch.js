// Copyright 2021 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb'

const REGION = process.env.AWS_REGION
const dbClient = new DynamoDBClient({ region: REGION })

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

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
                type: 'CharacterInPlay',
                CharacterId: payload,
                Connected,
                RoomId,
                Name
            }
        //
        // TODO:  More serializers for more data types!
        //
        default:
            return null
    }
}

export const fetchEphemera = async (RequestId) => {
    const { Items = [] } = await dbClient.send(new QueryCommand({
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
        RequestId,
        updates: returnItems
    }
}

export default fetchEphemera
