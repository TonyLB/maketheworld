// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { graphqlClient, gql } = require('./utilities')
const { v4: uuidv4 } = require('/opt/uuid')

const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const { DynamoDBClient, QueryCommand, GetItemCommand, UpdateItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb')
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda')

const REGION = process.env.AWS_REGION
const dbClient = new DynamoDBClient({ region: REGION })
const lambdaClient = new LambdaClient({ region: REGION })

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const permanentsTable = `${TABLE_PREFIX}_permanents`

const removeType = (stringVal) => (stringVal.split('#').slice(1).join('#'))

//
// TODO:  Create an EphemeraTopic SNS endpoint, and move the import of AppSync out to there,
// where any cold-start latency is less relevant, then reroute all Ephemera updates in the
// core Lambdas out to that outlet.
//
const disconnectGQL = ({ CharacterId, RoomId }) => (gql`mutation DisconnectCharacter {
    broadcastEphemera (Ephemera: [{ CharacterInPlay: { CharacterId: "${CharacterId}", RoomId: "${RoomId}", Connected: false } }]) {
        CharacterInPlay {
            CharacterId
            RoomId
            Connected
        }
    }
}`)

const connectGQL = ({ CharacterId, RoomId }) => (gql`mutation ConnectCharacter {
    broadcastEphemera (Ephemera: [{ CharacterInPlay: { CharacterId: "${CharacterId}", RoomId: "${RoomId}", Connected: true } }]) {
        CharacterInPlay {
            CharacterId
            RoomId
            Connected
        }
    }
}`)

const updateWithRoomMessage = async ({ promises, CharacterId, RoomId, messageFunction = () => ('Unknown error') }) => {
    const { Item: CharacterItem } = await dbClient.send(new GetItemCommand({
        TableName: permanentsTable,
        Key: marshall({
            PermanentId: `CHARACTER#${CharacterId}`,
            DataCategory: 'Details'
        })
    }))
    const { Name = '' } = CharacterItem ? unmarshall(CharacterItem) : {}
    await lambdaClient.send(new InvokeCommand({
        FunctionName: process.env.MESSAGE_SERVICE,
        InvocationType: 'RequestResponse',
        Payload: new TextEncoder().encode(JSON.stringify([{
            Targets: [CharacterId, RoomId],
            DisplayProtocol: "World",
            Message: messageFunction(Name),
            MessageId: uuidv4(),
            RoomId
        }]))
    }))
}

const disconnect = async (connectionId) => {
    const { Items = [] } = await dbClient.send(new QueryCommand({
        TableName: ephemeraTable,
        KeyConditionExpression: 'ConnectionId = :ConnectionId and begins_with(EphemeraId, :EphemeraId)',
        ExpressionAttributeValues: marshall({
            ":EphemeraId": "CHARACTERINPLAY#",
            ":ConnectionId": connectionId
        }),
        IndexName: 'ConnectionIndex'
    }))

    await Promise.all(Items
            .map(unmarshall)
            .map(({ RoomId, EphemeraId = '' }) => ({ CharacterId: removeType(EphemeraId), RoomId }))
            .map(({ CharacterId, RoomId }) => (
                //
                // TODO:  Refactor so that instead of sending individual SNS commands, the
                // handler aggregates all of the messages and sends one SNS command with the
                // whole set of simultaneous disconnects (and maybe a batch-write for the ephemera table)
                //
                updateWithRoomMessage({
                    RoomId,
                    CharacterId,
                    promises: [
                        dbClient.send(new PutItemCommand({
                            TableName: ephemeraTable,
                            Item: marshall({
                                EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
                                DataCategory: 'Connection',
                                RoomId,
                                Connected: false
                            })
                        })),
                        graphqlClient.mutate({ mutation: disconnectGQL({ CharacterId, RoomId }) })
                    ],
                    messageFunction: (Name) => (`${Name || 'Someone'} has disconnected.`)
                })
            )
        )
    )

    return { statusCode: 200 }
}

const registerCharacter = async ({ connectionId, CharacterId }) => {

    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    const { Item = {} } = await dbClient.send(new GetItemCommand({
        TableName: ephemeraTable,
        Key: marshall({
            EphemeraId,
            DataCategory: 'Connection'
        })
    }))
    const { DataCategory, RoomId, Connected } = unmarshall(Item)
    if (DataCategory) {
        const updatePromise = Promise.all([
            dbClient.send(new UpdateItemCommand({
                TableName: ephemeraTable,
                Key: marshall({
                    EphemeraId,
                    DataCategory: 'Connection'
                }),
                UpdateExpression: "set ConnectionId = :ConnectionId, Connected = :Connected",
                ExpressionAttributeValues: marshall({
                    ":ConnectionId": connectionId,
                    ":Connected": true
                })
            })),
            graphqlClient.mutate({ mutation: connectGQL({ CharacterId, RoomId }) })
        ])
        if (Connected) {
            await updatePromise
        }
        else {
            await updateWithRoomMessage({
                RoomId,
                CharacterId,
                promises: [ updatePromise ],
                messageFunction: (Name) => (`${Name || 'Someone'} has connected.`)
            })
        }
        return {
            statusCode: 200,
            body: JSON.stringify({ messageType: "Registered", CharacterId })
        }
    }
    return { statusCode: 404 }

}

const lookPermanent = async ({ CharacterId, PermanentId } = {}) => {
    await lambdaClient.send(new InvokeCommand({
        FunctionName: process.env.PERCEPTION_SERVICE,
        InvocationType: 'RequestResponse',
        Payload: new TextEncoder().encode(JSON.stringify({
            CreatedTime: Date.now(),
            CharacterId,
            PermanentId
        }))
    }))
    return {
        statusCode: 200,
        body: JSON.stringify({ messageType: "ActionComplete" })
    }
}

const say = async ({ CharacterId, Message } = {}) => {
    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    const [{ Item: EphemeraItem = {} }, { Item: CharacterItem }] = await Promise.all([
        dbClient.send(new GetItemCommand({
            TableName: ephemeraTable,
            Key: marshall({
                EphemeraId,
                DataCategory: 'Connection'
            })
        })),
        dbClient.send(new GetItemCommand({
            TableName: permanentsTable,
            Key: marshall({
                PermanentId: `CHARACTER#${CharacterId}`,
                DataCategory: 'Details'
            })
        })),

    ])
    const { RoomId } = unmarshall(EphemeraItem)
    const { Name } = unmarshall(CharacterItem)
    if (RoomId) {
        const output = {
            Messages: [{
                MessageId: uuidv4(),
                CreatedTime: Date.now(),
                Targets: [RoomId],
                DisplayProtocol: 'Player',
                CharacterId,
                Message: `${Name} says "${Message}"`
            }]
        }
        await lambdaClient.send(new InvokeCommand({
            FunctionName: process.env.MESSAGE_SERVICE,
            InvocationType: 'RequestResponse',
            Payload: new TextEncoder().encode(JSON.stringify(output))
        }))
    }
    return {
        statusCode: 200,
        body: JSON.stringify({ messageType: "ActionComplete" })
    }
}


exports.disconnect = disconnect
exports.registerCharacter = registerCharacter
exports.handler = (event) => {

    const { connectionId, routeKey } = event.requestContext
    const request = event.body && JSON.parse(event.body) || {}

    if (routeKey === '$disconnect') {
        return disconnect(connectionId)
    }
    switch(request.message) {
        case 'registercharacter':
            if (request.CharacterId) {
                return registerCharacter({ connectionId, CharacterId: request.CharacterId})
            }
            break
        //
        // TODO:  Make a better messaging protocol to distinguish meta-actions like registercharacter
        // from in-game actions like look
        //
        case 'action':
            switch(request.actionType) {
                case 'look':
                    return lookPermanent(request.payload)
                case 'say':
                    return say(request.payload)
                default:
                    break        
            }
        default:
            break
    }
    return { statusCode: 200, body: JSON.stringify({}) }

}