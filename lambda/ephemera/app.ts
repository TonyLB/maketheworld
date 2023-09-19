// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { parseCommand } from './parse'
import { StartExecutionCommand } from '@aws-sdk/client-sfn'

import {
    EphemeraAPIMessage,
    isRegisterCharacterAPIMessage,
    isFetchEphemeraAPIMessage,
    isSyncAPIMessage,
    isActionAPIMessage,
    isLinkAPIMessage,
    isCommandAPIMessage,
    isMapSubscribeAPIMessage,
    isEphemeraAPIMessage,
    isSyncNotificationAPIMessage,
    isUpdateNotificationsAPIMessage,
    isMapUnsubscribeAPIMessage,
    isUnregisterCharacterAPIMessage
} from '@tonylb/mtw-interfaces/ts/ephemera'
import { EphemeraAssetId, EphemeraCharacterId, isEphemeraActionId, isEphemeraAssetId, isEphemeraCharacterId, isEphemeraComputedId, isEphemeraFeatureId, isEphemeraKnowledgeId, isEphemeraVariableId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { fetchEphemeraForCharacter } from './fetchEphemera'

import internalCache from './internalCache'
import messageBus from './messageBus'
import { extractReturnValue } from './returnValue'
import { executeAction } from './parse/executeAction'
import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/dist/readOnly'
import dependencyCascade from './dependentMessages/dependencyCascade.js'
import { sfnClient } from './clients'
import { cacheAsset } from './cacheAsset'
import decacheAsset from './decacheAsset'

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

export const handler = async (event: any, context: any) => {

    const { connectionId, routeKey } = event.requestContext || {}
    const request = (event.body && (JSON.parse(event.body) as EphemeraAPIMessage)) || {}

    internalCache.clear()
    internalCache.Global.set({ key: 'ConnectionId', value: connectionId })
    if (request.RequestId) {
        internalCache.Global.set({ key: 'RequestId', value: request.RequestId })
    }
    messageBus.clear()

    //
    // Handle direct calls (not by way of API, probably by way of Step Functions)
    //
    if (event?.message) {
        switch(event.message) {
            case 'cacheAssets':
                const addresses: { AssetId: EphemeraAssetId | EphemeraCharacterId; address: AssetWorkspaceAddress }[] = event.addresses || []
                addresses.forEach((address) => {
                    internalCache.AssetAddress.set({ EphemeraId: address.AssetId, address: address.address })
                })
                await Promise.all(event.assetIds.map((assetId) => (cacheAsset({ messageBus, assetId, updateOnly: event.options.updateOnly }))))
                await messageBus.flush()
                return {}
            case 'decacheAssets':
                if (event.assetIds.find((assetId) => (!(isEphemeraAssetId(assetId) || isEphemeraCharacterId(assetId))))) {
                    throw new Error('AssetIds incorrectly formatted for decacheAssets')
                }
                await Promise.all(event.assetIds.map((assetId) => (decacheAsset({ messageBus, assetId }))))
                await messageBus.flush()
                return {}
        }
    }

    // Handle EventBridge messages
    if (['mtw.coordination', 'mtw.diagnostics', 'mtw.development'].includes(event?.source || '')) {
        switch(event["detail-type"]) {
            case 'Update Player':
                messageBus.send({
                    type: 'PlayerUpdate',
                    player: event.detail.PlayerName || '',
                    Characters: event.detail.Characters || [],
                    Assets: event.detail.Assets || [],
                    guestName: event.detail.guestName,
                    guestId: event.detail.guestId
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
                if (event.detail.EphemeraId && (isEphemeraVariableId(event.detail.EphemeraId) || isEphemeraComputedId(event.detail.EphemeraId))) {
                    await dependencyCascade({
                        payloads: [{ targetId: event.detail.EphemeraId, value: event.detail.value }],
                        messageBus
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
                break
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
                break
            case 'Canonize Asset':
            case 'Decanonize Asset':
                const { assetId } = event.detail
                if (assetId) {
                    messageBus.send({
                        type: event["detail-type"] === 'Canonize Asset' ? 'CanonAdd' : 'CanonRemove',
                        assetId: `ASSET#${assetId}` as const
                    })
                    await messageBus.flush()
                    return await extractReturnValue(messageBus)
                }
                else {
                    return JSON.stringify(`Invalid arguments specified for ${event["detail-type"]} event`)
                }
            case 'Set Canon Assets':
                const { assetIds } = event.detail
                if (assetIds && Array.isArray(assetIds)) {
                    messageBus.send({
                        type: 'CanonSet',
                        assetIds: assetIds.filter(isEphemeraAssetId)
                    })
                    await messageBus.flush()
                    return await extractReturnValue(messageBus)
                }
                else {
                    return JSON.stringify(`Invalid arguments specified for ${event["detail-type"]} event`)
                }
        }
    }
    else if (routeKey === '$disconnect') {
        await disconnect(connectionId)
    }
    else {
        if (isEphemeraAPIMessage(request)) {
            if (isRegisterCharacterAPIMessage(request) || isUnregisterCharacterAPIMessage(request)) {
                const messageType = isRegisterCharacterAPIMessage(request) ? 'RegisterCharacter' : 'UnregisterCharacter'
                if (request.CharacterId && isEphemeraCharacterId(request.CharacterId)) {
                    messageBus.send({
                        type: messageType,
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
                    await sfnClient.send(new StartExecutionCommand({
                        stateMachineArn: process.env.SYNC_MESSAGE_SFN,
                        input: JSON.stringify({
                            RequestId: request.RequestId,
                            ConnectionId: connectionId,
                            Target: request.CharacterId,
                            StartingAt: `${request.startingAt} || 0}`
                        })
                    }))
                    return { statusCode: 200, body: "{}" }
                }
                else {
                    console.log(`Invalid CharacterId on SyncAPI`)
                }
            }
            if (isSyncNotificationAPIMessage(request)) {
                const player = await internalCache.Global.get("player")
                await sfnClient.send(new StartExecutionCommand({
                    stateMachineArn: process.env.SYNC_MESSAGE_SFN,
                    input: JSON.stringify({
                        RequestId: request.RequestId,
                        ConnectionId: connectionId,
                        Target: player,
                        StartingAt: `${request.startingAt} || 0}`
                    })
                }))
                return { statusCode: 200, body: "{}" }
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
            if (isMapUnsubscribeAPIMessage(request)) {
                const characterId = request.CharacterId
                if (isEphemeraCharacterId(characterId)) {
                    messageBus.send({
                        type: 'UnsubscribeFromMaps',
                        characterId
                    })
                }
            }
            if (isActionAPIMessage(request)) {
                await executeAction(request)
            }
            if (isLinkAPIMessage(request)) {
                const CharacterId = request.CharacterId
                if (CharacterId && isEphemeraCharacterId(CharacterId)) {
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
                if (isEphemeraKnowledgeId(request.to)) {
                    messageBus.send({
                        type: 'Perception',
                        characterId: CharacterId,
                        ephemeraId: request.to
                    })
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