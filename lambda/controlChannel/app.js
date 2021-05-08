// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

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

const updateWithRoomMessage = async ({ promises, CharacterId, RoomId, messageFunction = () => ('Unknown error') }) => {
    const { Item: CharacterItem } = await dbClient.send(new GetItemCommand({
        TableName: permanentsTable,
        Key: marshall({
            PermanentId: `CHARACTER#${CharacterId}`,
            DataCategory: 'Details'
        })
    }))
    const { Name = '' } = CharacterItem ? unmarshall(CharacterItem) : {}
    await Promise.all([
        lambdaClient.send(new InvokeCommand({
            FunctionName: process.env.MESSAGE_SERVICE,
            InvocationType: 'Event',
            Payload: new TextEncoder().encode(JSON.stringify({ Messages: [{
                Targets: [`CHARACTER#${CharacterId}`, `ROOM#${RoomId}`],
                DisplayProtocol: "World",
                Message: messageFunction(Name),
                MessageId: uuidv4()
            }]}))
        })),
        ...promises
    ])
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
                // TODO:  Refactor so that instead of sending individual Lambda commands, the
                // handler aggregates all of the messages and sends one command with the
                // whole set of simultaneous disconnects
                //
                // TODO:  Refactor so that commands are sent in the correct order (connect before messages,
                // messages before disconnect) to avoid parallel race conditions that can cause either failure
                // to broadcast "Player has connected" messages, or GoneException errors (for messages sent
                // incorrectly to disconnected characters)
                //
                updateWithRoomMessage({
                    RoomId,
                    CharacterId,
                    promises: [
                        lambdaClient.send(new InvokeCommand({
                            FunctionName: process.env.EPHEMERA_SERVICE,
                            InvocationType: 'Event',
                            Payload: new TextEncoder().encode(JSON.stringify({
                                action: 'updateEphemera',
                                directCall: true,
                                Updates: [{
                                    putCharacterInPlay: {
                                        CharacterId,
                                        Connected: false,
                                        ConnectionId: null
                                    }
                                }]
                            }))
                        }))                        
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
            lambdaClient.send(new InvokeCommand({
                FunctionName: process.env.EPHEMERA_SERVICE,
                InvocationType: 'Event',
                Payload: new TextEncoder().encode(JSON.stringify({
                    action: 'updateEphemera',
                    directCall: true,
                    Updates: [{
                        putCharacterInPlay: {
                            CharacterId,
                            Connected: true,
                            ConnectionId: connectionId
                        }
                    }]
                }))
            }))
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
    const arguments = {
        CreatedTime: Date.now(),
        CharacterId,
        PermanentId
    }
    await lambdaClient.send(new InvokeCommand({
        FunctionName: process.env.PERCEPTION_SERVICE,
        InvocationType: 'Event',
        Payload: new TextEncoder().encode(JSON.stringify(arguments))
    }))
    return {
        statusCode: 200,
        body: JSON.stringify({ messageType: "ActionComplete" })
    }
}

//
// TODO:  Would it be waaaay more efficient overall to denormalize Name into CharacterInPlay Ephemera?
//
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
                Targets: [`ROOM#${RoomId}`],
                DisplayProtocol: 'Player',
                CharacterId,
                Message: `${Name} says "${Message}"`
            }]
        }
        await lambdaClient.send(new InvokeCommand({
            FunctionName: process.env.MESSAGE_SERVICE,
            InvocationType: 'Event',
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