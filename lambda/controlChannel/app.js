// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0


import AWSXRay from 'aws-xray-sdk'
import { ApiGatewayManagementApiClient } from '@aws-sdk/client-apigatewaymanagementapi'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { v4 as uuidv4 } from 'uuid'

import { whoAmI, getPlayerByConnectionId } from './player/index.js'
import { validateJWT } from './validateJWT.js'
import { parseCommand } from './parse/index.js'
import { sync } from './sync/index.js'
import { render } from '/opt/perception/index.js'

import { splitType } from '/opt/utilities/types.js'
import {
    publishMessage,
    ephemeraDB,
    assetDB
} from '/opt/utilities/dynamoDB/index.js'
import { forceDisconnect } from '/opt/utilities/apiManagement/forceDisconnect.js'
import { defaultColorFromCharacterId } from '/opt/utilities/selfHealing/index.js'

const apiClient = new ApiGatewayManagementApiClient({
    apiVersion: '2018-11-29',
    endpoint: process.env.WEBSOCKET_API
})

const REGION = process.env.AWS_REGION
const lambdaClient = AWSXRay.captureAWSv3Client(new LambdaClient({ region: REGION }))

//
// Implement some optimistic locking in the player item update to make sure that on a quick disconnect/connect
// cycle you don't have the disconnect update come after the connect.
//
export const disconnect = async (connectionId) => {

    await forceDisconnect(connectionId)

    return { statusCode: 200 }
}

//
// TODO:  Create an authentication Lambda to attach to the $connect Route, and
// use the validateJWT code (and passed Authorization querystring) to block
// unauthenticated users from websocket access entirely..
//
export const connect = async (connectionId, token) => {

    const { userName } = await validateJWT(token)
    if (userName) {
        await Promise.all([
            ephemeraDB.putItem({
                EphemeraId: `CONNECTION#${connectionId}`,
                DataCategory: 'Meta::Connection',
                player: userName
            }),
            ephemeraDB.update({
                EphemeraId: 'Global',
                DataCategory: 'Connections',
                UpdateExpression: 'SET connections.#connection = :player',
                ExpressionAttributeValues: {
                    ':player': userName
                },
                ExpressionAttributeNames: {
                    '#connection': connectionId
                },
                //
                // TODO: Activate when selfHeal is in the utility layer
                //
                // catchException: healGlobalValues
            })
        ])
    
        return { statusCode: 200 }
    }
    return { statusCode: 403 }
}

export const registerCharacter = async ({ connectionId, CharacterId, RequestId }) => {

    //
    // TODO: Create functionality to record what assets a character has access to,
    // and check before registering the character whether you need to cache any
    // as-yet uncached assets in order to support them.
    //
    const { Name = '', HomeId = '' } = await assetDB.getItem({
        AssetId: `CHARACTER#${CharacterId}`,
        DataCategory: 'Meta::Character',
        ProjectionFields: ['#name', 'HomeId'],
        ExpressionAttributeNames: {
            '#name': 'Name'
        }    
    })
    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    await Promise.all([
        ephemeraDB.update({
            EphemeraId,
            DataCategory: 'Meta::Character',
            UpdateExpression: 'SET Connected = :true, #name = if_not_exists(#name, :name), RoomId = if_not_exists(RoomId, :roomId)',
            ExpressionAttributeNames: {
                '#name': 'Name'
            },
            ExpressionAttributeValues: {
                ':true': true,
                ':name': Name,
                ':roomId': HomeId || 'VORTEX'
            }
        }),
        ephemeraDB.putItem({
            EphemeraId,
            DataCategory: `CONNECTION#${connectionId}`
        })
    ])

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
    const Items = await ephemeraDB.query({
        IndexName: 'DataCategoryIndex',
        DataCategory: 'Meta::Character',
        KeyConditionExpression: 'begins_with(EphemeraId, :EphemeraPrefix)',
        ExpressionAttributeValues: {
            ':EphemeraPrefix': 'CHARACTERINPLAY#'
        },
        ExpressionAttributeNames: {
            '#name': 'Name'
        },
        ProjectionFields: ['EphemeraId', 'Connected', 'RoomId', '#name']
    })
    const returnItems = Items
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
    //
    // TODO: Create asset management system to allow non-hard-coded asset lists
    //
    const roomMessage = await render({
        CharacterId,
        EphemeraId: PermanentId
    })
    await publishMessage({
        MessageId: `MESSAGE#${uuidv4()}`,
        Targets: [`CHARACTER#${CharacterId}`],
        CreatedTime: Date.now(),
        DisplayProtocol: 'RoomDescription',
        ...roomMessage
    })
    return {
        statusCode: 200,
        body: JSON.stringify({ messageType: "ActionComplete" })
    }
}

const narrateOOCOrSpeech = async ({ CharacterId, Message, DisplayProtocol } = {}) => {
    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    const { RoomId, Name, Color = defaultColorFromCharacterId(CharacterId) } = await ephemeraDB.getItem({
        EphemeraId,
        DataCategory: 'Meta::Character',
        ProjectionFields: ['RoomId', '#name', 'Color'],
        ExpressionAttributeNames: { '#name': 'Name' }
    })
    if (RoomId) {
        await publishMessage({
            MessageId: `MESSAGE#${uuidv4()}`,
            CreatedTime: Date.now(),
            Targets: [`ROOM#${RoomId}`],
            DisplayProtocol,
            CharacterId,
            Message,
            Name,
            Color
        })
    }
    return {
        statusCode: 200,
        body: JSON.stringify({ messageType: "ActionComplete" })
    }
}

const moveCharacter = async ({ CharacterId, RoomId, ExitName } = {}) => {
    //
    // TODO: Validate the RoomId as one that is valid for the character to move to, before
    // pushing data to the DB.
    //
    await ephemeraDB.update({
        EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
        DataCategory: 'Meta::Character',
        UpdateExpression: 'SET RoomId = :roomId, leaveMessage = :leave, enterMessage = :enter',
        ExpressionAttributeValues: {
            ':roomId': RoomId,
            ':leave': ` left${ ExitName ? ` by ${ExitName} exit` : ''}.`,
            ':enter': ` arrives.`
        }
    })
}

const goHome = async ({ CharacterId } = {}) => {

    const { HomeId = 'VORTEX' } = await assetDB.getItem({
        AssetId: `CHARACTER#${CharacterId}`,
        DataCategory: 'Meta::Character',
        ProjectionFields: ['HomeId']
    })
    //
    // TODO: Validate that the home RoomID is still a valid destination
    //
    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    await ephemeraDB.update({
        EphemeraId,
        DataCategory: 'Meta::Character',
        UpdateExpression: 'SET RoomId = :roomId, leaveMessage = :leave, enterMessage = :enter',
        ExpressionAttributeValues: {
            ':roomId': `ROOM#${HomeId}`,
            ':leave': ` left to go home.`,
            ':enter': ` arrives.`
        }
    })

}

const executeAction = (request) => {
    switch(request.actionType) {
        case 'look':
            return lookPermanent(request.payload)
        case 'SayMessage':
        case 'NarrateMessage':
        case 'OOCMessage':
            return narrateOOCOrSpeech({ ...request.payload, DisplayProtocol: request.actionType })
        case 'move':
            return moveCharacter(request.payload)
        case 'home':
            return goHome(request.payload)
        default:
            break        
    }
    return { statusCode: 200, body: JSON.stringify({}) }
}

const upload = async ({ fileName, connectionId, requestId, uploadRequestId }) => {
    const PlayerName = await getPlayerByConnectionId(connectionId)
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

const fetchLink = async ({ fileName, connectionId, requestId }) => {
    const PlayerName = await getPlayerByConnectionId(connectionId)
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

export const handler = async (event, context) => {

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
        case 'fetchEphemera':
            const ephemera = await fetchEphemera(request.RequestId)
            return {
                statusCode: 200,
                body: JSON.stringify(ephemera)
            }
        case 'whoAmI':
            return whoAmI(connectionId, request.RequestId)
        case 'sync':
            await sync(apiClient, {
                type: request.syncType,
                ConnectionId: connectionId,
                RequestId: request.RequestId,
                TargetId: request.CharacterId,
                startingAt: request.startingAt,
                limit: request.limit
            })
            break;
        case 'directMessage':
            await publishMessage({
                MessageId: `MESSAGE#${uuidv4()}`,
                CreatedTime: Date.now(),
                Targets: request.Targets,
                DisplayProtocol: "Direct",
                Message: request.Message,
                Recipients: request.Recipients,
                CharacterId: request.CharacterId
            })
            break;
        //
        // TODO:  Make a better messaging protocol to distinguish meta-actions like registercharacter
        // from in-game actions like look
        //
        case 'action':
            return executeAction(request)
        case 'command':
            const actionPayload = await parseCommand({ CharacterId: request.CharacterId, command: request.command })
            if (actionPayload.actionType) {
                return executeAction(actionPayload)
            }
            //
            // TODO: Build more elaborate error-handling pass-backs
            //
            break;
        case 'upload':
            const returnVal = await upload({
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
            const fetchReturnVal = await fetchLink({
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