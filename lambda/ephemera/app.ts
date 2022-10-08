// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { validateJWT } from './validateJWT.js'
import { parseCommand } from './parse'

import {
    EphemeraAPIMessage,
    isRegisterCharacterAPIMessage,
    isFetchEphemeraAPIMessage,
    isFetchImportDefaultsAPIMessage,
    isWhoAmIAPIMessage,
    isSyncAPIMessage,
    isActionAPIMessage,
    isLinkAPIMessage,
    isCommandAPIMessage
} from '@tonylb/mtw-interfaces/dist/ephemera'

import { fetchEphemeraForCharacter } from './fetchEphemera'

import internalCache from './internalCache'
import messageBus from './messageBus'
import { extractReturnValue } from './returnValue'
import { executeAction } from './parse/executeAction'
import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/dist/index.js'
import { splitType } from '@tonylb/mtw-utilities/dist/types.js'

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
                    options: {}
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
                    messageBus.send({
                        type: 'ExecuteAction',
                        actionId: event.detail.actionId,
                        characterId: event.detail.characterId
                    })
                }
                break
        }
    }
    
    if (routeKey === '$connect') {
        const { Authorization = '' } = event.queryStringParameters || {}
        await connect(Authorization)
    }
    if (routeKey === '$disconnect') {
        await disconnect(connectionId)
    }
    if (isRegisterCharacterAPIMessage(request)) {
        if (request.CharacterId) {
            messageBus.send({
                type: 'RegisterCharacter',
                characterId: request.CharacterId
            })
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
    if (isFetchImportDefaultsAPIMessage(request)) {
        if (request.importsByAssetId && request.assetId) {
            messageBus.send({
                type: 'FetchImportDefaults',
                importsByAssetId: request.importsByAssetId,
                assetId: request.assetId
            })
        }
    }
    if (isWhoAmIAPIMessage(request)) {
        messageBus.send({
            type: 'WhoAmI'
        })
    }
    if (isSyncAPIMessage(request)) {
        messageBus.send({
            type: 'Sync',
            targetId: request.CharacterId,
            startingAt: request.startingAt,
            limit: request.limit
        })
    }
    if (isActionAPIMessage(request)) {
        await executeAction(request)
    }
    if (isLinkAPIMessage(request)) {
        switch(splitType(request.to)[0]) {
            case 'ACTION':
                //
                // TODO: Extend WML to assign legal Actions to Rooms, and then use that to check the legal
                // actions to which the character has access, and confirm access before executing
                //
                messageBus.send({
                    type: 'ExecuteAction',
                    actionId: request.to,
                    characterId: request.CharacterId
                })
                break
            case 'FEATURE':
                messageBus.send({
                    type: 'Perception',
                    characterId: request.CharacterId,
                    ephemeraId: request.to as `FEATURE#${string}`
                })
                break
            case 'CHARACTER':
                messageBus.send({
                    type: 'Perception',
                    characterId: request.CharacterId,
                    ephemeraId: `CHARACTER#${splitType(request.to)[1]}`
                })
                break
        }
    }
    if (isCommandAPIMessage(request)) {
        const actionPayload = await parseCommand({ CharacterId: request.CharacterId, command: request.command })
        if (actionPayload?.actionType) {
            await executeAction(actionPayload)
        }
    }
    await messageBus.flush()
    return extractReturnValue(messageBus)

}