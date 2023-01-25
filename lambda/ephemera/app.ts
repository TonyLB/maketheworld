// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { validateJWT } from './validateJWT.js'
import { parseCommand } from './parse'

import {
    EphemeraAPIMessage,
    isRegisterCharacterAPIMessage,
    isFetchEphemeraAPIMessage,
    isWhoAmIAPIMessage,
    isSyncAPIMessage,
    isActionAPIMessage,
    isLinkAPIMessage,
    isCommandAPIMessage,
    isMapSubscribeAPIMessage,
    isEphemeraAPIMessage,
    isSyncNotificationAPIMessage,
    isUpdateNotificationsAPIMessage
} from '@tonylb/mtw-interfaces/dist/ephemera'
import { isEphemeraActionId, isEphemeraCharacterId, isEphemeraFeatureId } from '@tonylb/mtw-interfaces/dist/baseClasses'

import { fetchEphemeraForCharacter } from './fetchEphemera'

import internalCache from './internalCache'
import messageBus from './messageBus'
import { extractReturnValue } from './returnValue'
import { executeAction } from './parse/executeAction'
import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/dist/index.js'

//
// Implement some optimistic locking in the player item update to make sure that on a quick disconnect/connect
// cycle you don't have two lambdas in a race condition where the disconnect update might come after the connect.
//
export const disconnect = async (connectionId: string) => {

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
export const connect = async (token: any) => {

    const { userName } = (await validateJWT(token)) || {}
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

export const handler = async (event: any, context: any) => {

    const { connectionId, routeKey } = event.requestContext || {}
    const request = (event.body && (JSON.parse(event.body) as EphemeraAPIMessage)) || {}

    internalCache.clear()
    internalCache.Global.set({ key: 'ConnectionId', value: connectionId })
    if (request.RequestId) {
        internalCache.Global.set({ key: 'RequestId', value: request.RequestId })
    }
    messageBus.clear()

    // Handle EventBridge messages
    if (['mtw.coordination', 'mtw.diagnostics', 'mtw.development'].includes(event?.source || '')) {
        switch(event["detail-type"]) {
            case 'Decache Asset':
                if (event.detail?.assetId) {
                    messageBus.send({
                        type: 'DecacheAsset',
                        assetId: event.detail.assetId
                    })
                }
                break
            case 'Cache Asset':
                const address: AssetWorkspaceAddress = event.detail.zone === 'Personal'
                    ? {
                        fileName: event.detail.fileName,
                        zone: 'Personal',
                        subFolder: event.detail.subFolder,
                        player: event.detail.player
                    }
                    :  {
                        fileName: event.detail.fileName,
                        zone: event.detail.zone,
                        subFolder: event.detail.subFolder
                    }
                messageBus.send({
                    type: 'CacheAsset',
                    address,
                    options: { updateOnly: event.detail.updateOnly }
                })
                break
            case 'Update Player':
                messageBus.send({
                    type: 'PlayerUpdate',
                    player: event.detail.PlayerName || '',
                    Characters: event.detail.Characters || [],
                    Assets: event.detail.Assets || []
                })
                break
            case 'Force Disconnect':
                console.log(`Force Disconnect: ${JSON.stringify(event.detail, null, 4)}`)
                if (event.detail.connectionId) {
                    messageBus.send({
                        type: 'Disconnect',
                        connectionId: event.detail.connectionId
                    })
                }
                break
            case 'Calculate Cascade':
                if (event.detail.EphemeraId && event.detail.Descent && event.detail.tag) {
                    messageBus.send({
                        type: 'DependencyCascade',
                        targetId: event.detail.EphemeraId
                    })
                }
                break
            case 'Execute Action':
                if (event.detail.actionId && event.detail.characterId) {
                    const { actionId, characterId } = event.detail
                    if (isEphemeraActionId(actionId) && isEphemeraCharacterId(characterId)) {
                        messageBus.send({
                            type: 'ExecuteAction',
                            actionId,
                            characterId
                        })
                    }
                }
                break
            case 'Publish Notification':
                if (event.detail.player && event.detail.message && event.detail.subject) {
                    messageBus.send({
                        type: 'PublishNotification',
                        target: event.detail.player,
                        subject: event.detail.subject,
                        displayProtocol: 'Information',
                        message: [{
                            tag: 'String',
                            value: event.detail.message
                        }]
                    })
                }
            case 'Update Notification':
                if (event.detail.player && event.detail.notificationId && (typeof event.detail.read === 'boolean') && (typeof event.detail.archived === 'boolean')) {
                    messageBus.send({
                        type: 'PublishNotification',
                        target: event.detail.player,
                        displayProtocol: 'UpdateMarks',
                        notificationId: event.detail.notificationId,
                        read: event.detail.read,
                        archived: event.detail.archived
                    })
                }
        }
    }
    else if (routeKey === '$connect') {
        const { Authorization = '' } = event.queryStringParameters || {}
        await connect(Authorization)
    }
    else if (routeKey === '$disconnect') {
        await disconnect(connectionId)
    }
    else {
        if (isEphemeraAPIMessage(request)) {
            if (isRegisterCharacterAPIMessage(request)) {
                if (request.CharacterId && isEphemeraCharacterId(request.CharacterId)) {
                    messageBus.send({
                        type: 'RegisterCharacter',
                        characterId: request.CharacterId
                    })
                }
                else {
                    //
                    // TODO: Error messages back to client
                    //
                    console.log(`TEMPORARY WARNING: '${request.CharacterId}' is not a legitimate CharacterId`)
                }
            }
            if (isFetchEphemeraAPIMessage(request)) {
                //
                // TODO: Create PublishEphemeraUpdate message to aggregate all Ephemera messages
                // pushed during a cycle
                //
                if (request.CharacterId) {
                    const ephemera = await fetchEphemeraForCharacter({
                        CharacterId: request.CharacterId
                    })
                    messageBus.send({
                        type: 'ReturnValue',
                        body: ephemera
                    })
                }
                else {
                    messageBus.send({
                        type: 'FetchPlayerEphemera'
                    })
                }
            }
            if (isSyncAPIMessage(request)) {
                if (isEphemeraCharacterId(request.CharacterId)) {
                    messageBus.send({
                        type: 'Sync',
                        targetId: request.CharacterId,
                        startingAt: request.startingAt,
                        limit: request.limit
                    })
                }
                else {
                    console.log(`Invalid CharacterId on SyncAPI`)
                }
            }
            if (isSyncNotificationAPIMessage(request)) {
                messageBus.send({
                    type: 'SyncNotification',
                    startingAt: request.startingAt,
                    limit: request.limit
                })
            }
            if (isUpdateNotificationsAPIMessage(request)) {
                const player = await internalCache.Global.get('player')
                if (player) {
                    request.updates.forEach(({ notificationId, read, archived }) => {
                        messageBus.send({
                            type: 'PublishNotification',
                            target: player,
                            displayProtocol: 'UpdateMarks',
                            notificationId: notificationId,
                            read: read ?? false,
                            archived: archived ?? false
                        })
                    })
                    messageBus.send({
                        type: 'ReturnValue',
                        body: { message: 'Success' }
                    })
                }
            }
            if (isMapSubscribeAPIMessage(request)) {
                const characterId = request.CharacterId
                if (isEphemeraCharacterId(characterId)) {
                    messageBus.send({
                        type: 'SubscribeToMaps',
                        characterId
                    })
                }
            }
            if (isActionAPIMessage(request)) {
                await executeAction(request)
            }
            if (isLinkAPIMessage(request)) {
                const CharacterId = request.CharacterId
                if (isEphemeraCharacterId(CharacterId)) {
                    if (isEphemeraActionId(request.to)) {
                        messageBus.send({
                            type: 'ExecuteAction',
                            actionId: request.to,
                            characterId: CharacterId
                        })
                    }
                    if (isEphemeraFeatureId(request.to) || isEphemeraCharacterId(request.to)) {
                        messageBus.send({
                            type: 'Perception',
                            characterId: CharacterId,
                            ephemeraId: request.to
                        })
                    }
                }
            }
            if (isCommandAPIMessage(request)) {
                const CharacterId = request.CharacterId
                const actionPayload = await parseCommand({ CharacterId, command: request.command })
                if (actionPayload?.actionType) {
                    await executeAction(actionPayload)
                }
            }
        }
        else {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: 'Invalid message',
                    request
                }, null, 4)
            }
        }
    }

    await messageBus.flush()
    return extractReturnValue(messageBus)

}