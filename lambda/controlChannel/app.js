// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { v4: uuidv4 } = require('/opt/uuid')

const AWSXRay = require('aws-xray-sdk')
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const { DynamoDBClient, QueryCommand, GetItemCommand, UpdateItemCommand, PutItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb')
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi')
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda')
const { putPlayer, whoAmI, getConnectionsByPlayerName } = require('./player')
const { validateJWT } = require('./validateJWT')
const { parseCommand } = require('./parse')

const apiClient = new ApiGatewayManagementApiClient({
    apiVersion: '2018-11-29',
    endpoint: process.env.WEBSOCKET_API
})

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
    const DataCategory = `CONNECTION#${connectionId}`
    const [{ Items = [] }, { Items: PlayerItems = []}] = await Promise.all([
        dbClient.send(new QueryCommand({
            TableName: ephemeraTable,
            KeyConditionExpression: 'ConnectionId = :ConnectionId and begins_with(EphemeraId, :EphemeraId)',
            ExpressionAttributeValues: marshall({
                ":EphemeraId": "CHARACTERINPLAY#",
                ":ConnectionId": connectionId
            }),
            IndexName: 'ConnectionIndex'
        })),
        dbClient.send(new QueryCommand({
            TableName: ephemeraTable,
            IndexName: 'DataCategoryIndex',
            KeyConditionExpression: 'DataCategory = :dc',
            ExpressionAttributeValues: marshall({
                ":dc": DataCategory
            }),
            ProjectionExpression: 'EphemeraId'
        }))
    ])

    await Promise.all([
        ...(PlayerItems
            .map(unmarshall)
            .map(({ EphemeraId }) => (dbClient.send(new DeleteItemCommand({
                TableName: ephemeraTable,
                Key: marshall({
                    EphemeraId,
                    DataCategory
                })
            }))))
        ),
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
                                },
                                {
                                    addCharacterToRoom: {
                                        CharacterId,
                                        RoomId,
                                        Connected: false,
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

//
// TODO:  Create an authentication Lambda to attach to the $connect Route, and
// use the validateJWT code (and passed Authorization querystring) to block
// unauthenticated users from websocket access entirely..
//
const connect = async (connectionId, token) => {

    const { userName } = await validateJWT(token)
    if (userName) {
        await Promise.all([
            dbClient.send(new UpdateItemCommand({
                TableName: ephemeraTable,
                Key: marshall({
                    EphemeraId: 'Global',
                    DataCategory: 'Connections'
                }),
                UpdateExpression: 'ADD connections :connection',
                ExpressionAttributeValues: {
                    ':connection': { 'SS': [connectionId] }
                }
            })),
            dbClient.send(new PutItemCommand({
                TableName: ephemeraTable,
                Item: marshall({
                    EphemeraId: `PLAYER#${userName}`,
                    DataCategory: `CONNECTION#${connectionId}`
                })
            }))
        ])
    
        return { statusCode: 200 }
    }
    return { statusCode: 403 }
}

const registerCharacter = async ({ connectionId, CharacterId, RequestId }) => {

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
                    },
                    {
                        addCharacterToRoom: {
                            CharacterId,
                            RoomId,
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
            body: JSON.stringify({ RequestId, messageType: "Registered", CharacterId })
        }
    }
    return { statusCode: 404, body: JSON.stringify({ messageType: 'Error', RequestId }) }

}

const fetchEphemera = async (RequestId) => {
    const { Payload = {} } =  await lambdaClient.send(new InvokeCommand({
        FunctionName: process.env.EPHEMERA_SERVICE,
        InvocationType: 'RequestResponse',
        Payload: new TextEncoder().encode(JSON.stringify({ action: 'fetchEphemera', RequestId }))
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

        const { Item = {} } = await dbClient.send(new GetItemCommand({
                TableName: ephemeraTable,
                Key: marshall({
                    EphemeraId,
                    DataCategory: 'Connection',
                }),
                ProjectionExpression: "#name, RoomId, Connected, ConnectionId",
                ExpressionAttributeNames: {
                    '#name': 'Name',
                }
            }))

        const { Name = 'Someone', RoomId: CurrentRoomId, Connected, ConnectionId } = unmarshall(Item)
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
        await Promise.all([
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
                        },
                    },
                    {
                        addCharacterToRoom: {
                            CharacterId,
                            RoomId,
                            Connected,
                            ConnectionId
                        },
                    },
                    {
                        removeCharacterFromRoom: {
                            CharacterId,
                            RoomId: CurrentRoomId
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
            })),

        //
        // TODO: Refactor Message Service so that perception messages can be sent as part of the payload,
        // parsed by an invoke from MESSAGE, then folded into the list and delivered simultaneously.
        //
        // Alternately, maybe fold the Perception service directly into the Message service, if it is
        // never going to be called without returning a message.
        //
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

const executeAction = (request) => {
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
    return { statusCode: 200, body: JSON.stringify({}) }
}

exports.disconnect = disconnect
exports.connect = connect
exports.registerCharacter = registerCharacter
exports.handler = async (event, context) => {

    dbClient = AWSXRay.captureAWSv3Client(dbClientBase)

    const { connectionId, routeKey } = event.requestContext
    const request = event.body && JSON.parse(event.body) || {}

    if (routeKey === '$connect') {
        const { Authorization = '' } = event.queryStringParameters || {}
        return connect(connectionId, Authorization)
    }
    if (routeKey === '$disconnect') {
        return disconnect(connectionId)
    }
    switch(request.message) {
        case 'registercharacter':
            if (request.CharacterId) {
                return registerCharacter({ connectionId, CharacterId: request.CharacterId, RequestId: request.RequestId })
            }
            break
        case 'putCharacter':
            //
            // Long-term, the permanents table should have DBStreams enabled so that it
            // will automatically message correctly on a simple update command.  Short-term,
            // we coordinate updating the character and messaging the player here.
            //
            if (request.CharacterId) {
                const { CharacterId, Name, FirstImpression, OneCoolThing, Outfit, Pronouns, Player, RequestId } = request
                //
                // TODO: Restructure permanents storage so that Player denormalizes Name information into the Characters
                // item
                //
                const { Item: oldPlayerItem } = await dbClient.send(new GetItemCommand({
                    TableName: permanentsTable,
                    Key: marshall({
                        PermanentId: `PLAYER#${Player}`,
                        DataCategory: 'Details'
                    })
                }))
                const oldPlayer = unmarshall(oldPlayerItem)
                const newPlayerItem = {
                    ...oldPlayer,
                    Characters: {
                        ...oldPlayer.Characters,
                        [CharacterId]: { Name }
                    }
                }
                const notifyPromise = (Player && Name)
                    ? getConnectionsByPlayerName(dbClient, Player)
                        .then((connections) => {
                            const { PermanentId, DataCategory, Characters, ...rest } = newPlayerItem
                            const Data = JSON.stringify({
                                messageType: 'Player',
                                PlayerName: removeType(PermanentId),
                                RequestId,
                                Characters: Object.entries(Characters).map(([CharacterId, rest]) => ({ CharacterId, ...rest })),
                                ...rest
                            })
                            return Promise.all(connections.map((ConnectionId) => (
                                apiClient.send(new PostToConnectionCommand({
                                    ConnectionId,
                                    Data
                                }))
                            )))
                        })
                    : Promise.resolve()
                await Promise.all([
                    lambdaClient.send(new InvokeCommand({
                        FunctionName: process.env.PERMANENTS_SERVICE,
                        Payload: new TextEncoder().encode(JSON.stringify({
                            action: "updatePermanents",
                            Updates: [{
                                putCharacter: {
                                    CharacterId,
                                    Name,
                                    FirstImpression,
                                    OneCoolThing,
                                    Outfit,
                                    Pronouns,
                                    Player
                                }
                            },
                            {
                                putPlayer: newPlayerItem
                            }]
                        }))
                    })),
                    notifyPromise
                ])
            }
            break;
        case 'fetchEphemera':
            return fetchEphemera()
        case 'whoAmI':
            return whoAmI(dbClient, connectionId, request.RequestId)
        case 'putPlayer':
            return putPlayer(request.PlayerName)({ Characters: request.Characters, CodeOfConductConsent: request.CodeOfConductConsent })
        case 'directMessage':
            await lambdaClient.send(new InvokeCommand({
                FunctionName: process.env.MESSAGE_SERVICE,
                InvocationType: 'Event',
                Payload: new TextEncoder().encode(JSON.stringify({ Messages: [{
                    Targets: request.Targets,
                    DisplayProtocol: "Direct",
                    Message: request.Message,
                    Recipients: request.Recipients,
                    CharacterId: request.CharacterId,
                    MessageId: uuidv4()
                }]}))
            }))
            break;
        //
        // TODO:  Make a better messaging protocol to distinguish meta-actions like registercharacter
        // from in-game actions like look
        //
        case 'action':
            return executeAction(request)
        case 'command':
            const actionPayload = await parseCommand({ dbClient, CharacterId: request.CharacterId, command: request.command })
            if (actionPayload.actionType) {
                return executeAction(actionPayload)
            }
            //
            // TODO: Build more elaborate error-handling pass-backs
            //
            break;
        default:
            break
    }
    return { statusCode: 200, body: JSON.stringify({}) }

}