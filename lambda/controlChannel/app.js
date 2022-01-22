// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { v4: uuidv4 } = require('/opt/uuid')

const AWSXRay = require('aws-xray-sdk')
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const { DynamoDBClient, QueryCommand, GetItemCommand, UpdateItemCommand, PutItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb')
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi')
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda')
const { putPlayer, whoAmI, getConnectionsByPlayerName, getPlayerByConnectionId } = require('./player')
const { validateJWT } = require('./validateJWT')
const { parseCommand } = require('./parse')
const { sync } = require('./sync')

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
const messagesTable = `${TABLE_PREFIX}_messages`
const assetsTable = `${TABLE_PREFIX}_assets`

const removeType = (stringVal) => (stringVal.split('#').slice(1).join('#'))

const splitType = (value) => {
    const sections = value.split('#')
    if (sections.length) {
        return [sections[0], sections.slice(1).join('#')]
    }
    else {
        return ['', '']
    }
}

//
// Implement some optimistic locking in the player item update to make sure that on a quick disconnect/connect
// cycle you don't have the disconnect update come after the connect.
//
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
            IndexName: 'ConnectionIndex',
            ProjectionExpression: 'EphemeraId, DataCategory'
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
        ...(Items
            .map(unmarshall)
            .map(({ EphemeraId, DataCategory }) => (dbClient.send(new UpdateItemCommand({
                TableName: ephemeraTable,
                Key: marshall({
                    EphemeraId,
                    DataCategory
                }),
                UpdateExpression: 'SET Connected = :false REMOVE ConnectionId',
                ExpressionAttributeValues: marshall({
                    ':false': false
                })
            })))))
        ]
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
        await dbClient.send(new PutItemCommand({
            TableName: ephemeraTable,
            Item: marshall({
                EphemeraId: `PLAYER#${userName}`,
                DataCategory: `CONNECTION#${connectionId}`
            })
        }))
    
        return { statusCode: 200 }
    }
    return { statusCode: 403 }
}

const registerCharacter = async ({ connectionId, CharacterId, RequestId }) => {

    //
    // TODO: Create functionality to record what assets a character has access to,
    // and check before registering the character whether you need to cache any
    // as-yet uncached assets in order to support them.
    //
    const { Item } = await dbClient.send(new GetItemCommand({
        TableName: assetsTable,
        Key: marshall({
            AssetId: `CHARACTER#${CharacterId}`,
            DataCategory: 'Meta::Character'
        }),
        ProjectionExpression: "#name, HomeId",
        ExpressionAttributeNames: {
            '#name': 'Name'
        }
    }))
    let fetchedName = ''
    let fetchedHomeId = ''
    if (Item) {
        const { Name, HomeId } = unmarshall(Item)
        fetchedName = Name || ''
        fetchedHomeId = HomeId || ''
    }
    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    await dbClient.send(new UpdateItemCommand({
        TableName: ephemeraTable,
        Key: marshall({
            EphemeraId,
            DataCategory: 'Connection'
        }),
        UpdateExpression: 'SET Connected = :true, ConnectionId = :connectionId, #name = if_not_exists(#name, :name), RoomId = if_not_exists(RoomId, :roomId)',
        ExpressionAttributeNames: {
            '#name': 'Name'
        },
        ExpressionAttributeValues: marshall({
            ':true': true,
            ':connectionId': connectionId,
            ':name': fetchedName,
            ':roomId': fetchedHomeId || 'VORTEX'
        })
    }))

    return { statusCode: 200, body: JSON.stringify({ messageType: 'Registration', CharacterId, RequestId }) }
}

const serialize = ({
    EphemeraId,
    Connected,
    RoomId,
    Name
}) => {
    const [type, payload] = splitType(EphemeraId)
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

const fetchEphemera = async (RequestId) => {
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
        .filter(({ Connected }) => (Connected))
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
        await dbClient.send(new PutItemCommand({
            TableName: messagesTable,
            Item: marshall({
                MessageId: `MESSAGE#${uuidv4()}`,
                DataCategory: 'Meta::Message',
                CreatedTime: Date.now(),
                Targets: [`ROOM#${RoomId}`],
                DisplayProtocol: 'Player',
                CharacterId,
                Message: messageCallback({ Name, Message })
            })
        }))
    }
    return {
        statusCode: 200,
        body: JSON.stringify({ messageType: "ActionComplete" })
    }
}

const narrateOrSpeech = async ({ CharacterId, Message, DisplayProtocol } = {}) => {
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
        await dbClient.send(new PutItemCommand({
            TableName: messagesTable,
            Item: marshall({
                MessageId: `MESSAGE#${uuidv4()}`,
                DataCategory: 'Meta::Message',
                CreatedTime: Date.now(),
                Targets: [`ROOM#${RoomId}`],
                DisplayProtocol,
                CharacterId,
                Message,
                Name
            })
        }))
    }
    return {
        statusCode: 200,
        body: JSON.stringify({ messageType: "ActionComplete" })
    }
}

const moveCharacter = async ({ CharacterId, RoomId, ExitName } = {}) => {
    // await moveCharacterWithMessage({ CharacterId, RoomId, messageCallback: (Name) => (`${Name} left${ ExitName ? ` by ${ExitName} exit` : ''}.`)})
    //
    // TODO: Validate the RoomId as one that is valid for the character to move to, before
    // pushing data to the DB.
    //
    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    await dbClient.send(new UpdateItemCommand({
        TableName: ephemeraTable,
        Key: marshall({
            EphemeraId,
            DataCategory: 'Connection'
        }),
        UpdateExpression: 'SET RoomId = :roomId, leaveMessage = :leave, enterMessage = :enter',
        ExpressionAttributeValues: marshall({
            ':roomId': RoomId,
            ':leave': ` left${ ExitName ? ` by ${ExitName} exit` : ''}.`,
            ':enter': ` arrives.`
        })
    }))
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
    //
    // TODO: Validate that the home RoomID is still a valid destination
    //
    const { HomeId = 'VORTEX' } = unmarshall(Item)
    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    await dbClient.send(new UpdateItemCommand({
        TableName: ephemeraTable,
        Key: marshall({
            EphemeraId,
            DataCategory: 'Connection'
        }),
        UpdateExpression: 'SET RoomId = :roomId, leaveMessage = :leave, enterMessage = :enter',
        ExpressionAttributeValues: marshall({
            ':roomId': `ROOM#${HomeId}`,
            ':leave': ` left to go home.`,
            ':enter': ` arrives.`
        })
    }))

}

const executeAction = (request) => {
    switch(request.actionType) {
        case 'look':
            return lookPermanent(request.payload)
        case 'SayMessage':
        case 'NarrateMessage':
            return narrateOrSpeech({ ...request.payload, DisplayProtocol: request.actionType })
        case 'narrate':
            return narrateOrSpeech({ ...request.payload, DisplayProtocol: 'NarrateMessage' })
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

const upload = async (dbClient, { fileName, connectionId, requestId, uploadRequestId }) => {
    const PlayerName = await getPlayerByConnectionId(dbClient, connectionId)
    if (PlayerName) {
        const { Payload } = await lambdaClient.send(new InvokeCommand({
            FunctionName: process.env.ASSETS_SERVICE,
            InvocationType: 'RequestResponse',
            Payload: new TextEncoder().encode(JSON.stringify({
                message: 'upload',
                PlayerName,
                fileName,
                RequestId: uploadRequestId
            }))
        }))
        const url = JSON.parse(new TextDecoder('utf-8').decode(Payload))
        return {
            statusCode: 200,
            body: JSON.stringify({ messageType: "UploadURL", RequestId: requestId, url })
        }
    
    }
    return null
}

const fetchLink = async (dbClient, { fileName, connectionId, requestId }) => {
    const PlayerName = await getPlayerByConnectionId(dbClient, connectionId)
    if (PlayerName) {
        const { Payload } = await lambdaClient.send(new InvokeCommand({
            FunctionName: process.env.ASSETS_SERVICE,
            InvocationType: 'RequestResponse',
            Payload: new TextEncoder().encode(JSON.stringify({
                message: 'fetch',
                PlayerName,
                fileName
            }))
        }))
        const url = JSON.parse(new TextDecoder('utf-8').decode(Payload))
        return {
            statusCode: 200,
            body: JSON.stringify({ messageType: "FetchURL", RequestId: requestId, url })
        }
    }
    return null
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
            const ephemera = await fetchEphemera(request.RequestId)
            return {
                statusCode: 200,
                body: JSON.stringify(ephemera)
            }
        case 'whoAmI':
            return whoAmI(dbClient, connectionId, request.RequestId)
        case 'sync':
            await sync(dbClient, apiClient, {
                type: request.syncType,
                ConnectionId: connectionId,
                RequestId: request.RequestId,
                TargetId: request.CharacterId,
                startingAt: request.startingAt,
                limit: request.limit
            })
            break;
        case 'putPlayer':
            return putPlayer(request.PlayerName)({ Characters: request.Characters, CodeOfConductConsent: request.CodeOfConductConsent })
        case 'directMessage':
            await dbClient.send(new PutItemCommand({
                TableName: messagesTable,
                Item: marshall({
                    MessageId: `MESSAGE#${uuidv4()}`,
                    DataCategory: 'Meta::Message',
                    CreatedTime: Date.now(),
                    Targets: request.Targets,
                    DisplayProtocol: "Direct",
                    Message: request.Message,
                    Recipients: request.Recipients,
                    CharacterId: request.CharacterId
                })
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
        case 'upload':
            const returnVal = await upload(dbClient, {
                fileName: request.fileName,
                connectionId,
                requestId: request.RequestId,
                uploadRequestId: request.uploadRequestId
            })
            if (returnVal) {
                return returnVal
            }
            break
        case 'fetch':
            const fetchReturnVal = await fetchLink(dbClient, {
                fileName: request.fileName,
                connectionId,
                requestId: request.RequestId
            })
            if (fetchReturnVal) {
                return fetchReturnVal
            }
            break
        default:
            break
    }
    return { statusCode: 200, body: JSON.stringify({}) }

}