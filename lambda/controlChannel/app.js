// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { InvokeCommand } from '@aws-sdk/client-lambda'
import { v4 as uuidv4 } from 'uuid'

import { whoAmI, getPlayerByConnectionId } from './player/index.js'
import { validateJWT } from './validateJWT.js'
import { parseCommand } from './parse/index.js'
import { sync } from './sync/index.js'
import { render } from '/opt/utilities/perception/index.js'
import { deliverRenders } from '/opt/utilities/perception/deliverRenders.js'
import { executeAction as executeActionFromDB } from '/opt/utilities/executeCode/index.js'

import { splitType, RoomKey } from '/opt/utilities/types.js'
import { unique } from '/opt/utilities/lists.js'
import {
    publishMessage,
    ephemeraDB,
    assetDB
} from '/opt/utilities/dynamoDB/index.js'
import { forceDisconnect } from '/opt/utilities/apiManagement/forceDisconnect.js'
import { defaultColorFromCharacterId } from '/opt/utilities/selfHealing/index.js'

import fetchEphemera, { fetchEphemeraForCharacter } from './fetchEphemera/index.js'

import lambdaClient from './lambdaClient.js'

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
    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    const [{ Name = '', HomeId = '' }, characterQueryItems = []] = await Promise.all([
        assetDB.getItem({
            AssetId: `CHARACTER#${CharacterId}`,
            DataCategory: 'Meta::Character',
            ProjectionFields: ['#name', 'HomeId'],
            ExpressionAttributeNames: {
                '#name': 'Name'
            }
        }),
        ephemeraDB.query({
            EphemeraId,
            KeyConditionExpression: 'begins_with(DataCategory, :dc)',
            ExpressionAttributeValues: {
                ':dc': 'CONNECTION#'
            }
        })
    ])
    const ConnectionIds = [...(new Set([
        ...characterQueryItems.map(({ DataCategory }) => (splitType(DataCategory)[1])),
        connectionId
    ]))]
    await Promise.all([
        ephemeraDB.update({
            EphemeraId,
            DataCategory: 'Meta::Character',
            UpdateExpression: 'SET Connected = :true, #name = if_not_exists(#name, :name), RoomId = if_not_exists(RoomId, :roomId), ConnectionIds = :connectionIds',
            ExpressionAttributeNames: {
                '#name': 'Name'
            },
            ExpressionAttributeValues: {
                ':true': true,
                ':name': Name,
                ':roomId': HomeId || 'VORTEX',
                ':connectionIds': ConnectionIds
            }
        }),
        ephemeraDB.putItem({
            EphemeraId,
            DataCategory: `CONNECTION#${connectionId}`
        })
    ])

    return { statusCode: 200, body: JSON.stringify({ messageType: 'Registration', CharacterId, RequestId }) }
}

const lookPermanent = async ({ CharacterId, PermanentId } = {}) => {
    //
    // TODO: Create asset management system to allow non-hard-coded asset lists
    //
    const renderOutputs = await render({
        renderList: [{
            CharacterId,
            EphemeraId: PermanentId
        }]
    })
    await deliverRenders({
        renderOutputs
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
            Targets: [RoomKey(RoomId)],
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
            ':roomId': RoomKey(HomeId),
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

export const subscribe = async ({ connectionId, requestId, options = {} }) => {
    const { ConnectionIds = [] } = await ephemeraDB.getItem({
        EphemeraId: 'Library',
        DataCategory: 'Subscriptions',
        ProjectionFields: ['ConnectionIds']
    })
    await ephemeraDB.update({
        EphemeraId: 'Library',
        DataCategory: 'Subscriptions',
        UpdateExpression: 'SET ConnectionIds = :connectionIds',
        ExpressionAttributeValues: {
            ':connectionIds': unique(ConnectionIds, [connectionId])
        }
    })
    return {
        statusCode: 200,
        body: JSON.stringify({ RequestId: requestId })
    }
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
            let ephemera = {}
            if (request.CharacterId) {
                ephemera = await fetchEphemeraForCharacter({
                    RequestId: request.RequestId,
                    CharacterId: request.CharacterId
                })
            }
            else {
                ephemera = await fetchEphemera(request.RequestId)
            }
            return {
                statusCode: 200,
                body: JSON.stringify(ephemera)
            }
        case 'subscribe':
            return subscribe({ connectionId, RequestId: request.RequestId })
        case 'whoAmI':
            return whoAmI(connectionId, request.RequestId)
        case 'sync':
            await sync({
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
        case 'link':
            switch(request.targetTag) {
                case 'Action':
                    const { executeMessageQueue = [] } = await executeActionFromDB({ action: request.Action, assetId: request.AssetId, RoomId: request.RoomId, CharacterId: request.CharacterId })
                    const epochTime = Date.now()
                    await Promise.all(executeMessageQueue
                        .map((message, index) => ({
                            MessageId: `MESSAGE#${uuidv4()}`,
                            CreatedTime: epochTime + index,
                            ...message
                        }))
                        .map(publishMessage)
                    )
                    break
                case 'Feature':
                    await lookPermanent({
                        CharacterId: request.CharacterId,
                        PermanentId: `FEATURE#${request.FeatureId}`
                    })
                    break
                case 'Character':
                    await lookPermanent({
                        CharacterId: request.viewCharacterId,
                        PermanentId: `CHARACTERINPLAY#${request.CharacterId}`
                    })
                    break
            }
            return { statusCode: 200, body: JSON.stringify({ RequestId: request.RequestId })}
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