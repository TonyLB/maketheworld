// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { parseCommand } from './parse'
import { StartExecutionCommand } from '@aws-sdk/client-sfn'
import getCurrentTimestamp from './internalUtils/dateUtil'

import {
    EphemeraAPIMessage,
    isRegisterCharacterAPIMessage,
    isFetchEphemeraAPIMessage,
    isSyncAPIMessage,

    isLinkAPIMessage,

    isMapSubscribeAPIMessage,
    isEphemeraAPIMessage,
    isMapUnsubscribeAPIMessage,
    isUnregisterCharacterAPIMessage,
    isCommandAPIMessage,
    isActionAPIMessage
} from '@tonylb/mtw-interfaces/ts/ephemera'
import { EphemeraAssetId, EphemeraCharacterId, isEphemeraAssetId, isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraKnowledgeId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { fetchEphemeraForCharacter } from './fetchEphemera'
import internalCache from './internalCache'
import messageBus from './messageBus'
import { extractReturnValue } from './returnValue'

import { sfnClient } from './clients'
import { confirmGuestCharacter } from './guestCharacter'
import { AssetsEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'

// Import DataSources to trigger their messageBus subscriptions (side-effect imports)
import './dataSource'  // mtw.ephemera DataSource

// Event deserializers for incoming EventBridge events
const eventDeserializers = {
    'mtw.assets': new AssetsEventSerializer(),
    // Add other data source deserializers here as needed
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
        }
    }

    // Handle EventBridge messages by publishing to messageBus for DataSource processing
    if (event?.source && event["detail-type"]) {
        // Find the appropriate deserializer for this data source
        const deserializer = eventDeserializers[event.source as keyof typeof eventDeserializers]
        
        if (deserializer) {
            const header = {
                dataSourceKey: event.source,
                streamKey: event.detail.streamKey || '',
                timestamp: event.time ? new Date(event.time).getTime() : getCurrentTimestamp(),
                type: event["detail-type"] as string
            }
            // Deserialize the external EventBridge event to internal format
            const internalEvent = deserializer.deserialize({
                dataSourceKey: event.source,
                detailType: event["detail-type"],
                streamKey: event.detail.streamKey || '', // Extract streamKey from detail
                externalUpdate: event.detail,
                header
            })
            
            // If deserialization failed, log error and skip this event
            if (!internalEvent) {
                messageBus.send({
                    type: 'Error',
                    body: {
                        error: `Failed to deserialize event from ${event.source}: ${event["detail-type"]}`
                    }
                })
            } else {
                // Publish deserialized event to messageBus for DataSource processing, using header/content.
                messageBus.send({
                    type: 'StreamingEvent',
                    dataSourceKey: event.source,
                    streamKey: event.detail.streamKey || '',
                    header,
                    content: internalEvent,
                    timestamp: header.timestamp
                })
            }
        } else {
            // No deserializer available - this is an error condition
            messageBus.send({
                type: 'Error',
                body: {
                    error: `No deserializer available for data source: ${event.source}`
                }
            })
        }
        // Flush messageBus and return after handling EventBridge events
        await messageBus.flush()
        return
    }

    // Handle legacy EventBridge messages that don't use DataSource pattern yet
    if (['mtw.coordination', 'mtw.diagnostics', 'mtw.development', 'mtw.players', 'mtw.wml'].includes(event?.source || '')) {
        switch(event["detail-type"]) {
            case 'Disconnect Character':
                console.log(`Disconnect Character: ${JSON.stringify(event.detail, null, 4)}`)
                if (event.detail.characterId) {
                    messageBus.send({
                        type: 'DisconnectCharacter',
                        characterId: event.detail.characterId
                    })
                }
                break
            case 'Player Connected':
                await confirmGuestCharacter(event.detail.player)
                await messageBus.flush()
                return await extractReturnValue(messageBus)
        }
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

            if (isLinkAPIMessage(request)) {
                const CharacterId = request.CharacterId
                if (CharacterId && isEphemeraCharacterId(CharacterId)) {

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
                        ephemeraId: request.to,
                        directResponse: request.directResponse
                    })
                }
            }

            if (isCommandAPIMessage(request)) {
                const parsedAction = await parseCommand({
                    CharacterId: request.CharacterId,
                    command: request.command
                })
                if (parsedAction) {
                    messageBus.send({
                        type: 'ExecuteAction',
                        action: parsedAction
                    })
                }
            }

            if (isActionAPIMessage(request)) {
                messageBus.send({
                    type: 'ExecuteAction',
                    action: request
                })
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