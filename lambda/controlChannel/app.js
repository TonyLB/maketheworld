// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { v4: uuidv4 } = require('/opt/uuid')

const AWSXRay = require('aws-xray-sdk')
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const { DynamoDBClient, QueryCommand, GetItemCommand, UpdateItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb')
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda')

const REGION = process.env.AWS_REGION
const dbClientBase = new DynamoDBClient({ region: REGION })
let dbClient = AWSXRay.captureAWSv3Client(dbClientBase)
const lambdaClient = AWSXRay.captureAWSv3Client(new LambdaClient({ region: REGION }))

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

    await Promise.all([
        dbClient.send(new UpdateItemCommand({
            TableName: ephemeraTable,
            Key: marshall({
                EphemeraId: 'Global',
                DataCategory: 'Connections'
            }),
            UpdateExpression: 'DELETE connections :connection',
            ExpressionAttributeValues: {
                ':connection': { 'SS': [connectionId] }
            }
        })),
        ...(Items
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
            ))
        )]
    )

    return { statusCode: 200 }
}

const connect = async (connectionId) => {

    await dbClient.send(new UpdateItemCommand({
        TableName: ephemeraTable,
        Key: marshall({
            EphemeraId: 'Global',
            DataCategory: 'Connections'
        }),
        UpdateExpression: 'ADD connections :connection',
        ExpressionAttributeValues: {
            ':connection': { 'SS': [connectionId] }
        }
    }))

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
            //
            // TODO:  Add Connection -> connectionId data elements to the Ephemera table that will record the
            // authenticated player and the list of characters connected to a given connection.
            //
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
                //
                // TODO:  Refactor updateWithRoomMessage to take advantage of the fact that we can
                // now pull denormalized character information from the Ephemera table on the first
                // GetItem up at the top of this procedure (i.e. we can pre-determine
                // the messages to be delivered rather than pass a callback)
                //
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

const fetchEphemera = async () => {
    const { Payload = {} } =  await lambdaClient.send(new InvokeCommand({
        FunctionName: process.env.EPHEMERA_SERVICE,
        InvocationType: 'RequestResponse',
        Payload: new TextEncoder().encode(JSON.stringify({ action: 'fetchEphemera' }))
    }))
    return {
        statusCode: 200,
        body: new TextDecoder('ascii').decode(Payload)
    }
}

const lookPermanent = async ({ CharacterId, PermanentId } = {}) => {
    const arguments = {
        CreatedTime: Date.now(),
        CharacterId,
        PermanentId
    }
    await lambdaClient.send(new InvokeCommand({
        FunctionName: process.env.PERCEPTION_SERVICE,
        InvocationType: 'RequestResponse',
        Payload: new TextEncoder().encode(JSON.stringify(arguments))
    }))
    return {
        statusCode: 200,
        body: JSON.stringify({ messageType: "ActionComplete" })
    }
}

const emote = async ({ CharacterId, Message, messageCallback = () => ('') } = {}) => {
    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    const [{ Item: EphemeraItem = {} }] = await Promise.all([
        dbClient.send(new GetItemCommand({
            TableName: ephemeraTable,
            Key: marshall({
                EphemeraId,
                DataCategory: 'Connection'
            })
        })),
    ])
    const { RoomId, Name } = unmarshall(EphemeraItem)
    if (RoomId) {
        const output = {
            Messages: [{
                MessageId: uuidv4(),
                CreatedTime: Date.now(),
                Targets: [`ROOM#${RoomId}`],
                DisplayProtocol: 'Player',
                CharacterId,
                Message: messageCallback({ Name, Message })
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

const moveCharacterWithMessage = async ({ CharacterId, RoomId, messageCallback } = {}) => {
    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    if (RoomId) {
        const CreatedTime = Date.now()

        const [{ Item = {} }] = await Promise.all([
            dbClient.send(new GetItemCommand({
                TableName: ephemeraTable,
                Key: marshall({
                    EphemeraId,
                    DataCategory: 'Connection',
                }),
                ProjectionExpression: "#name, RoomId",
                ExpressionAttributeNames: {
                    '#name': 'Name'
                }
            })),
            lambdaClient.send(new InvokeCommand({
                FunctionName: process.env.EPHEMERA_SERVICE,
                InvocationType: 'RequestResponse',
                Payload: new TextEncoder().encode(JSON.stringify({
                    action: 'updateEphemera',
                    directCall: true,
                    Updates: [{
                        putCharacterInPlay: {
                            CharacterId,
                            RoomId
                        }
                    }]
                }))
            })),
            //
            // TODO:  Check first whether the room is already present, and only after
            // that fails denormalize out of permanents.
            //
            lambdaClient.send(new InvokeCommand({
                FunctionName: process.env.EPHEMERA_SERVICE,
                InvocationType: 'RequestResponse',
                Payload: new TextEncoder().encode(JSON.stringify({
                    action: 'denormalize',
                    PermanentId: `ROOM#${RoomId}`
                }))
            }))

        ])
        const { Name = 'Someone', RoomId: CurrentRoomId } = unmarshall(Item)
        const messages = [{
            MessageId: uuidv4(),
            CreatedTime,
            TimeOffset: -1,
            Targets: [`CHARACTER#${CharacterId}`, `ROOM#${CurrentRoomId}`],
            DisplayProtocol: "World",
            Message: messageCallback(Name)
        },
        {
            MessageId: uuidv4(),
            CreatedTime,
            TimeOffset: 1,
            RoomId,
            Targets: [ `CHARACTER#${CharacterId}`, `ROOM#${RoomId}`],
            DisplayProtocol: "World",
            Message: `${Name} has arrived.`
        }]
        //
        // TODO: Refactor Message Service so that perception messages can be sent as part of the payload,
        // parsed by an invoke from MESSAGE, then folded into the list and delivered simultaneously.
        //
        // Alternately, maybe fold the Perception service directly into the Message service, if it is
        // never going to be called without returning a message.
        //
        await Promise.all([
            lambdaClient.send(new InvokeCommand({
                FunctionName: process.env.MESSAGE_SERVICE,
                InvocationType: 'Event',
                Payload: new TextEncoder().encode(JSON.stringify({ Messages: messages }))
            })),
            lambdaClient.send(new InvokeCommand({
                FunctionName: process.env.PERCEPTION_SERVICE,
                InvocationType: 'Event',
                Payload: new TextEncoder().encode(JSON.stringify({
                    CreatedTime,
                    CharacterId,
                    PermanentId: `ROOM#${RoomId}`
                }))
            }))
        ])
    }
}

const moveCharacter = async ({ CharacterId, RoomId, ExitName } = {}) => {
    await moveCharacterWithMessage({ CharacterId, RoomId, messageCallback: (Name) => (`${Name} left${ ExitName ? ` by ${ExitName} exit` : ''}.`)})
}

const goHome = async ({ CharacterId } = {}) => {

    const { Item = {} } = await dbClient.send(new GetItemCommand({
        TableName: permanentsTable,
        Key: marshall({
            PermanentId: `CHARACTER#${CharacterId}`,
            DataCategory: 'Details'
        }),
        ProjectionExpression: 'HomeId'
    }))
    const { HomeId = 'VORTEX' } = unmarshall(Item)
    await moveCharacterWithMessage({ CharacterId, RoomId: HomeId, messageCallback: (Name) => (`${Name} left to go home.`)})

}

exports.disconnect = disconnect
exports.connect = connect
exports.registerCharacter = registerCharacter
exports.handler = (event) => {

    dbClient = AWSXRay.captureAWSv3Client(dbClientBase)

    const { connectionId, routeKey } = event.requestContext
    const request = event.body && JSON.parse(event.body) || {}

    if (routeKey === '$connect') {
        return connect(connectionId)
    }
    if (routeKey === '$disconnect') {
        return disconnect(connectionId)
    }
    switch(request.message) {
        case 'registercharacter':
            if (request.CharacterId) {
                return registerCharacter({ connectionId, CharacterId: request.CharacterId})
            }
            break
        case 'fetchEphemera':
            return fetchEphemera()
        //
        // TODO:  Make a better messaging protocol to distinguish meta-actions like registercharacter
        // from in-game actions like look
        //
        case 'action':
            switch(request.actionType) {
                case 'look':
                    return lookPermanent(request.payload)
                case 'say':
                    return emote({ ...request.payload, messageCallback: ({ Name, Message }) => (`${Name} says "${Message}"`)})
                case 'pose':
                    return emote({ ...request.payload, messageCallback: ({ Name, Message }) => (`${Name}${Message.match(/^[,']/) ? "" : " "}${Message}`)})
                case 'spoof':
                    return emote({ ...request.payload, messageCallback: ({ Message }) => (Message)})
                case 'move':
                    return moveCharacter(request.payload)
                case 'home':
                    return goHome(request.payload)
                default:
                    break        
            }
        default:
            break
    }
    return { statusCode: 200, body: JSON.stringify({}) }

}