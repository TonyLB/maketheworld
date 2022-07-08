// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { InvokeCommand } from '@aws-sdk/client-lambda'
import { v4 as uuidv4 } from 'uuid'

import { getPlayerByConnectionId, convertAssetQuery } from './player/index.js'
import { validateJWT } from './validateJWT.js'
import { parseCommand } from './parse/index.js'
import { render } from '@tonylb/mtw-utilities/dist/perception/index'
import { deliverRenders } from '@tonylb/mtw-utilities/dist/perception/deliverRenders'
import { executeAction as executeActionFromDB } from '@tonylb/mtw-utilities/dist/executeCode/index'

import { splitType, RoomKey } from '@tonylb/mtw-utilities/dist/types'
import { unique } from '@tonylb/mtw-utilities/dist/lists'
import {
    publishMessage,
    ephemeraDB,
    assetDB
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import { defaultColorFromCharacterId } from '@tonylb/mtw-utilities/dist/selfHealing/index'

import { fetchEphemeraForCharacter } from './fetchEphemera'
import fetchImportDefaults from './fetchImportDefaults'

import lambdaClient from './lambdaClient.js'
import internalCache from './internalCache'
import messageBus from './messageBus'
import { extractReturnValue } from './returnValue'

//
// Implement some optimistic locking in the player item update to make sure that on a quick disconnect/connect
// cycle you don't have two lambdas in a race condition where the disconnect update might come after the connect.
//
export const disconnect = async (connectionId) => {

    messageBus.send({
        type: 'Disconnect',
        connectionId
    })
    await messageBus.flush()

}

//
// TODO:  Create an authentication Lambda to attach to the $connect Route, and
// use the validateJWT code (and passed Authorization querystring) to block
// unauthenticated users from websocket access entirely..
//
export const connect = async (token) => {

    const { userName } = await validateJWT(token)
    if (userName) {
    
        messageBus.send({
            type: 'Connect',
            userName
        })

    }
    else {
        messageBus.send({
            type: 'ReturnValue',
            body: { statusCode: 403 }
        })
    }
}

const narrateOOCOrSpeech = async ({ CharacterId, Message, DisplayProtocol } = {}) => {
    if (CharacterId) {
        const { RoomId, Name, Color = defaultColorFromCharacterId(CharacterId) } = await internalCache.get({
            category: 'CharacterMeta',
            key: CharacterId
        })
        if (RoomId) {
            messageBus.send({
                type: 'PublishMessage',
                targets: [`ROOM#${RoomId}`],
                displayProtocol: DisplayProtocol,
                message: [{ tag: 'String', value: Message }],
                characterId: CharacterId,
                name: Name,
                color: Color
            })
            messageBus.send({
                type: 'ReturnValue',
                body: { messageType: 'ActionComplete' }
            })
        }
    }
}

const moveCharacter = ({ CharacterId, RoomId, ExitName } = {}) => {
    messageBus.send({
        type: 'MoveCharacter',
        characterId: CharacterId,
        roomId: RoomId,
        exitName: ExitName
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

const executeAction = async (request) => {
    switch(request.actionType) {
        case 'look':
            messageBus.send({
                type: 'Perception',
                characterId: request.CharacterId,
                ephemeraId: request.EphemeraId
            })
            break
        case 'SayMessage':
        case 'NarrateMessage':
        case 'OOCMessage':
            await narrateOOCOrSpeech({ ...request.payload, DisplayProtocol: request.actionType })
            break
        case 'move':
            moveCharacter(request.payload)
            break
        case 'home':
            return await goHome(request.payload)
        default:
            break        
    }
    await messageBus.flush()
    return extractReturnValue(messageBus)
}

const upload = async ({ fileName, tag, connectionId, requestId, uploadRequestId }) => {
    const PlayerName = await getPlayerByConnectionId(connectionId)
    if (PlayerName) {
        const { Payload } = await lambdaClient.send(new InvokeCommand({
            FunctionName: process.env.ASSETS_SERVICE,
            InvocationType: 'RequestResponse',
            Payload: new TextEncoder().encode(JSON.stringify({
                message: 'upload',
                PlayerName,
                fileName,
                tag,
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

const uploadImage = async ({ fileExtension, tag, connectionId, requestId, uploadRequestId }) => {
    const PlayerName = await getPlayerByConnectionId(connectionId)
    if (PlayerName) {
        const { Payload } = await lambdaClient.send(new InvokeCommand({
            FunctionName: process.env.ASSETS_SERVICE,
            InvocationType: 'RequestResponse',
            Payload: new TextEncoder().encode(JSON.stringify({
                message: 'uploadImage',
                PlayerName,
                fileExtension,
                tag,
                RequestId: uploadRequestId
            }))
        }))
        const url = JSON.parse(new TextDecoder('utf-8').decode(Payload))
        return {
            statusCode: 200,
            body: JSON.stringify({ messageType: "UploadImageURL", RequestId: requestId, url })
        }
    
    }
    return null
}

export const fetchLibrary = async (RequestId) => {
    const Items = await assetDB.query({
        IndexName: 'ZoneIndex',
        zone: 'Library',
        KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
        ExpressionAttributeValues: {
            ':dcPrefix': 'Meta::'
        },
        ExpressionAttributeNames: {
            '#name': 'Name'
        },
        ProjectionFields: ['AssetId', 'DataCategory', 'Connected', 'RoomId', '#name', 'fileURL', 'FirstImpression', 'Pronouns', 'OneCoolThing', 'Outfit']
    })

    const { Characters, Assets } = convertAssetQuery(Items)

    return {
        messageType: 'Library',
        RequestId,
        Characters,
        Assets
    }
}

const fetchLink = async ({ fileName, AssetId, connectionId, requestId }) => {
    const PlayerName = await getPlayerByConnectionId(connectionId)
    if (PlayerName) {
        const { Payload } = await lambdaClient.send(new InvokeCommand({
            FunctionName: process.env.ASSETS_SERVICE,
            InvocationType: 'RequestResponse',
            Payload: new TextEncoder().encode(JSON.stringify({
                message: 'fetch',
                PlayerName,
                fileName,
                AssetId
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

const checkIn = async ({ AssetId, RequestId, connectionId }) => {
    const PlayerName = await getPlayerByConnectionId(connectionId)
    const { player } = await assetDB.getItem({
        AssetId,
        DataCategory: splitType(AssetId)[0] === 'CHARACTER' ? 'Meta::Character' : 'Meta::Asset',
        ProjectionFields: ['player']
    })
    if (PlayerName === player) {
        await lambdaClient.send(new InvokeCommand({
            FunctionName: process.env.ASSETS_SERVICE,
            InvocationType: 'RequestResponse',
            Payload: new TextEncoder().encode(JSON.stringify({
                checkin: AssetId
            }))
        }))
    }
    return {
        statusCode: 200,
        body: JSON.stringify({ messageType: "Success", RequestId })
    }
}

const checkOut = async ({ AssetId, RequestId, connectionId }) => {
    const PlayerName = await getPlayerByConnectionId(connectionId)
    if (PlayerName) {
        await lambdaClient.send(new InvokeCommand({
            FunctionName: process.env.ASSETS_SERVICE,
            InvocationType: 'RequestResponse',
            Payload: new TextEncoder().encode(JSON.stringify({
                PlayerName,
                checkout: AssetId
            }))
        }))
    }
    return {
        statusCode: 200,
        body: JSON.stringify({ messageType: "Success", RequestId })
    }
}

export const subscribe = async ({ connectionId, RequestId, options = {} }) => {
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
        body: JSON.stringify({ RequestId })
    }
}

export const handler = async (event, context) => {

    const { connectionId, routeKey } = event.requestContext
    const request = event.body && JSON.parse(event.body) || {}

    internalCache.clear()
    internalCache.set({ category: 'Global', key: 'ConnectionId', value: connectionId })
    if (request.RequestId) {
        internalCache.set({ category: 'Global', key: 'RequestId', value: request.RequestId })
    }
    messageBus.clear()

    if (routeKey === '$connect') {
        const { Authorization = '' } = event.queryStringParameters || {}
        await connect(Authorization)
    }
    if (routeKey === '$disconnect') {
        await disconnect(connectionId)
    }
    switch(request.message) {
        case 'registercharacter':
            if (request.CharacterId) {
                messageBus.send({
                    type: 'RegisterCharacter',
                    characterId: request.CharacterId
                })
            }
            break
        case 'fetchEphemera':
            if (request.CharacterId) {
                const ephemera = await fetchEphemeraForCharacter({
                    RequestId: request.RequestId,
                    CharacterId: request.CharacterId
                })
                return {
                    statusCode: 200,
                    body: JSON.stringify(ephemera)
                }
            }
            else {
                messageBus.send({
                    type: 'FetchPlayerEphemera'
                })
            }
            break
        case 'fetchImportDefaults':
            if (request.importsByAssetId && request.assetId) {
                messageBus.send({
                    type: 'FetchImportDefaults',
                    importsByAssetId: request.importsByAssetId,
                    assetId: request.assetId
                })
            }
            break
        case 'fetchLibrary':
            const libraryEphemera = await fetchLibrary(request.RequestId)
            return {
                statusCode: 200,
                body: JSON.stringify(libraryEphemera)
            }
        case 'subscribe':
            return subscribe({ connectionId, RequestId: request.RequestId })
        case 'whoAmI':
            messageBus.send({
                type: 'WhoAmI'
            })
            break
        case 'sync':
            messageBus.send({
                type: 'Sync',
                targetId: request.CharacterId,
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
                    const { RoomId } = await ephemeraDB.getItem({
                        EphemeraId: `CHARACTERINPLAY#${request.CharacterId}`,
                        DataCategory: 'Meta::Character',
                        ProjectionFields: ['RoomId']
                    })
                    //
                    // TODO: Figure out whether we can still get use out of request.RoomId, as saved on
                    // the action Links
                    //
                    const { executeMessageQueue = [] } = await executeActionFromDB({ action: request.Action, assetId: request.AssetId, RoomId, CharacterId: request.CharacterId })
                    const epochTime = Date.now()
                    await Promise.all(executeMessageQueue
                        .map((message, index) => ({
                            MessageId: `MESSAGE#${uuidv4()}`,
                            CreatedTime: epochTime + index,
                            ...message
                        }))
                        .map(publishMessage)
                    )
                    return { statusCode: 200, body: JSON.stringify({ RequestId: request.RequestId })}
                case 'Feature':
                    messageBus.send({
                        type: 'Perception',
                        characterId: request.CharacterId,
                        ephemeraId: `FEATURE#${request.FeatureId}`
                    })
                    break
                case 'Character':
                    messageBus.send({
                        type: 'Perception',
                        characterId: request.viewCharacterId,
                        ephemeraId: `CHARACTERINPLAY#${request.CharacterId}`
                    })
                    break
            }
            break
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
                tag: request.tag,
                connectionId,
                requestId: request.RequestId,
                uploadRequestId: request.uploadRequestId
            })
            if (returnVal) {
                return returnVal
            }
            break
        case 'uploadImage':
            const imageReturnVal = await uploadImage({
                fileExtension: request.fileExtension,
                tag: request.tag,
                connectionId,
                requestId: request.RequestId,
                uploadRequestId: request.uploadRequestId
            })
            if (imageReturnVal) {
                return imageReturnVal
            }
            break
        case 'fetch':
            const fetchReturnVal = await fetchLink({
                fileName: request.fileName,
                AssetId: request.AssetId,
                connectionId,
                requestId: request.RequestId
            })
            if (fetchReturnVal) {
                return fetchReturnVal
            }
            break
        case 'checkin':
            return await checkIn({
                AssetId: request.AssetId,
                connectionId,
                RequestId: request.RequestId
            })
        case 'checkout':
            return await checkOut({
                AssetId: request.AssetId,
                connectionId,
                RequestId: request.RequestId
            })
        default:
            break
    }
    console.log(`Message Bus: ${JSON.stringify(messageBus._stream, null, 4)}`)
    await messageBus.flush()
    return extractReturnValue(messageBus)

}