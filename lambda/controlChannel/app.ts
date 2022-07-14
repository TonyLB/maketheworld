// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { validateJWT } from './validateJWT.js'
import { parseCommand } from './parse'
import { executeAction as executeActionFromDB } from '@tonylb/mtw-utilities/dist/executeCode/index'

import {
    EphemeraAPIMessage,
    isRegisterCharacterAPIMessage,
    isFetchEphemeraAPIMessage,
    isFetchImportDefaultsAPIMessage,
    isWhoAmIAPIMessage,
    isSyncAPIMessage,
    isActionAPIMessage,
    isLinkAPIMessage
} from '@tonylb/mtw-interfaces/dist/ephemera'

import { fetchEphemeraForCharacter } from './fetchEphemera'

import internalCache from './internalCache'
import messageBus from './messageBus'
import { extractReturnValue } from './returnValue'
import { executeAction } from './parse/executeAction'
import { LegalCharacterColor } from './messageBus/baseClasses'

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
    const requestCast = request as EphemeraAPIMessage
    if (isRegisterCharacterAPIMessage(requestCast)) {
        if (requestCast.CharacterId) {
            messageBus.send({
                type: 'RegisterCharacter',
                characterId: requestCast.CharacterId
            })
        }
    }
    if (isFetchEphemeraAPIMessage(requestCast)) {
        if (requestCast.CharacterId) {
            const ephemera = await fetchEphemeraForCharacter({
                RequestId: requestCast.RequestId,
                CharacterId: requestCast.CharacterId
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
    if (isFetchImportDefaultsAPIMessage(requestCast)) {
        if (requestCast.importsByAssetId && requestCast.assetId) {
            messageBus.send({
                type: 'FetchImportDefaults',
                importsByAssetId: requestCast.importsByAssetId,
                assetId: requestCast.assetId
            })
        }
    }
    if (isWhoAmIAPIMessage(requestCast)) {
        messageBus.send({
            type: 'WhoAmI'
        })
    }
    if (isSyncAPIMessage(requestCast)) {
        messageBus.send({
            type: 'Sync',
            targetId: requestCast.CharacterId,
            startingAt: requestCast.startingAt,
            limit: requestCast.limit
        })
    }
    if (isActionAPIMessage(requestCast)) {
        await executeAction(requestCast)
    }
    if (isLinkAPIMessage(requestCast)) {
        switch(requestCast.targetTag) {
            case 'Action':
                const { RoomId } = (await internalCache.get({
                    category: 'CharacterMeta',
                    key: requestCast.CharacterId
                })) || {}
        
                //
                // TODO: Figure out whether we can still get use out of request.RoomId, as saved on
                // the action Links
                //
                const { executeMessageQueue = [] } = await executeActionFromDB({ action: requestCast.Action, assetId: requestCast.AssetId, RoomId, CharacterId: requestCast.CharacterId })
                executeMessageQueue.forEach((message, index) => {
                    messageBus.send({
                        type: 'PublishMessage',
                        targets: message.Targets,
                        message: message.Message,
                        displayProtocol: message.DisplayProtocol as "OOCMessage",
                        characterId: message.CharacterId || '',
                        name: message.Name || '',
                        color: (message.Color || 'grey') as LegalCharacterColor
                    })
                })
                break
            case 'Feature':
                messageBus.send({
                    type: 'Perception',
                    characterId: requestCast.CharacterId,
                    ephemeraId: `FEATURE#${requestCast.FeatureId}`
                })
                break
            case 'Character':
                messageBus.send({
                    type: 'Perception',
                    characterId: requestCast.viewCharacterId,
                    ephemeraId: `CHARACTERINPLAY#${requestCast.CharacterId}`
                })
                break
        }
    }
    switch(request.message) {
        case 'command':
            const actionPayload = await parseCommand({ CharacterId: request.CharacterId, command: request.command })
            if (actionPayload?.actionType) {
                await executeAction(actionPayload)
            }
            //
            // TODO: Build more elaborate error-handling pass-backs
            //
            break;
        default:
            break
    }
    await messageBus.flush()
    return extractReturnValue(messageBus)

}