// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

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
    isActionAPIMessage,
    isEphemeraApiStateChangeAPIMessage,
} from '@tonylb/mtw-interfaces/ts/ephemera'
import { isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraKnowledgeId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { fetchEphemeraForCharacter } from './fetchEphemera'
import internalCache from './internalCache'
import messageBus from './messageBus'
import { extractReturnValue } from './returnValue'

import { sfnClient } from './clients'
import { confirmGuestCharacter } from './guestCharacter'
import { AssetsEventSerializer, ComponentExamplesEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import { fromEventBridgeFormat } from '@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform'
import { coreFormatToStreamingEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { sendParseRequested, sendStateChange } from './dataSource/apiEphemera'
import { isStateChangeCommand } from './dataSource/localApiEvents'

// Import DataSources to trigger their messageBus subscriptions (side-effect imports)
import './dataSource'  // mtw.ephemera DataSource
import './dataSource/componentExamples'  // mtw.ephemera.examples DataSource
import './dataSource/renderCache'  // mtw.ephemera.renderCache DataSource
import './dataSource/renderOrchestration'  // mtw.ephemera.renderOrchestration DataSource (evolving; see dataSource/renderOrchestration/AGENT.md)
import './dataSource/perception'  // mtw.ephemera.perception DataSource (see dataSource/perception/AGENT.md)
import './dataSource/actions'  // mtw.ephemera.actions DataSource (inert bus-only stub)
import './dataSource/coyoteGame'  // mtw.ephemera.coyoteGame DataSource (stub; Coyote Game wiring follows)
import './dataSource/objects'  // mtw.ephemera.objects DataSource (before state: shared Meta::Room ordering)
import './dataSource/state'  // mtw.ephemera.state DataSource (see lambda/ephemera/dataSource/state/AGENT.planning.perceptionVertical.md)

// Event deserializers for incoming EventBridge events
const eventDeserializers = {
    'mtw.assets': new AssetsEventSerializer(),
    'mtw.assets.componentExamples': new ComponentExamplesEventSerializer(),
    // Add other data source deserializers here as needed
} as const

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
            const coreFormat = fromEventBridgeFormat(event)
            const envelope = coreFormatToStreamingEnvelope(coreFormat, () =>
                (deserializer as any).deserialize({ content: coreFormat.update as any, header: coreFormat.header }) as Promise<any>
            )
            const timestamp = envelope.header.timestamp ?? (event.time ? new Date(event.time).getTime() : getCurrentTimestamp())
            messageBus.send({
                type: 'StreamingEvent',
                dataSourceKey: envelope.header.dataSourceKey,
                streamKey: envelope.header.streamKey,
                header: envelope.header,
                getContent: envelope.getContent,
                timestamp
            })
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
    if (['mtw.diagnostics', 'mtw.development', 'mtw.players', 'mtw.wml'].includes(event?.source || '')) {
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
                sendParseRequested(messageBus, request.CharacterId, {
                    characterId: request.CharacterId,
                    command: request.command,
                    ...(request.RequestId ? { requestId: request.RequestId } : {}),
                })
                // Legacy reference (Phase 1 intentionally disables direct imperative parse/execute):
                // const parsedAction = await parseCommand({
                //     CharacterId: request.CharacterId,
                //     command: request.command
                // })
                // if (parsedAction) {
                //     messageBus.send({
                //         type: 'ExecuteAction',
                //         action: parsedAction
                //     })
                // }
            }

            if (isActionAPIMessage(request)) {
                messageBus.send({
                    type: 'ExecuteAction',
                    action: request
                })
            }

            if (isEphemeraApiStateChangeAPIMessage(request)) {
                const cmd = {
                    componentId: request.componentId,
                    markState: request.markState,
                    ...(request.RequestId ? { requestId: request.RequestId } : {}),
                }
                if (!isStateChangeCommand(cmd)) {
                    if (request.RequestId) {
                        messageBus.send({
                            type: 'ReturnValue',
                            body: {
                                messageType: 'Error',
                                RequestId: request.RequestId,
                                message: 'Invalid ephemera state change payload',
                            },
                        })
                    }
                }
                else {
                    sendStateChange(messageBus, request.componentId, cmd)
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

    // Default-lane drain: terminal render-orchestration outbounds use `laneId: ''` from `publishOrchestration`.
    // Named `renderOrchestration:*` lanes are flushed in parallel with generation inside `generateRoomPreview`.
    await messageBus.flush()
    return extractReturnValue(messageBus)

}