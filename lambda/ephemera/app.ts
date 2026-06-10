// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { StartExecutionCommand } from '@aws-sdk/client-sfn'
import getCurrentTimestamp from './internalUtils/dateUtil'

import {
    EphemeraAPIMessage,
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
    isFetchThinkingResultAPIMessage,
} from '@tonylb/mtw-interfaces/ts/ephemera'
import { isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraKnowledgeId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { fetchEphemeraForCharacter } from './fetchEphemera'
import { handleFetchThinkingResult } from './fetchThinkingResult'
import internalCache from './internalCache'
import messageBus from './messageBus'
import { extractReturnValue } from './returnValue'

import { sfnClient } from './clients'
import { confirmGuestCharacter } from './guestCharacter'
import { AssetsEventSerializer, ComponentExamplesEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import { DiagnosticsEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { ConnectionsEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/connections'
import { ConnectionsCharactersEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/connections/characters'
import { fromEventBridgeFormat } from '@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform'
import { coreFormatToStreamingEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { sendParseRequested, sendStateChange } from './dataSource/apiEphemera'
import { sendInitializeSubscription } from './dataSource/initSubscription'
import { isStateChangeCommand } from './dataSource/localApiEvents'

// Import DataSources to trigger their messageBus subscriptions (side-effect imports)
import './dataSource'  // mtw.ephemera DataSource
import './dataSource/renderCache'  // mtw.ephemera.renderCache DataSource
import './dataSource/renderOrchestration'  // mtw.ephemera.renderOrchestration DataSource (evolving; see dataSource/renderOrchestration/AGENT.md)
import './dataSource/affordanceOrchestration'  // mtw.ephemera.affordanceOrchestration (M4 scaffold; see dataSource/affordanceOrchestration/AGENT.md)
import './dataSource/affordanceCache'  // mtw.ephemera.affordanceCache (M4; see dataSource/affordanceCache/AGENT.md)
import './dataSource/perception'  // mtw.ephemera.perception DataSource (see dataSource/perception/AGENT.md)
import './dataSource/actions'  // mtw.ephemera.actions DataSource (inert bus-only stub)
import './dataSource/coyoteGame'  // mtw.ephemera.coyoteGame DataSource (stub; Coyote Game wiring follows)
import './dataSource/thinking/results'  // mtw.ephemera.thinking.results (Thinking Result persistence from bus)
import './dataSource/thinking/scheduling'  // mtw.ephemera.thinking.scheduling (Put Thinking Schedule via api.ephemera)
import './dataSource/objects'  // mtw.ephemera.objects DataSource (before state: shared Meta::Room ordering)
import './dataSource/state'  // mtw.ephemera.state DataSource (see lambda/ephemera/dataSource/state/AGENT.planning.perceptionVertical.md)
import './dataSource/positions'  // mtw.ephemera.positions DataSource (positions in play; first ingress: mtw.connections.characters)

// Event deserializers for incoming EventBridge events
const eventDeserializers = {
    'mtw.assets': new AssetsEventSerializer(),
    'mtw.assets.componentExamples': new ComponentExamplesEventSerializer(),
    'mtw.diagnostics': new DiagnosticsEventSerializer(createNodeDataSourceEnvironment()),
    'mtw.connections': new ConnectionsEventSerializer(createNodeDataSourceEnvironment()),
    'mtw.connections.characters': new ConnectionsCharactersEventSerializer(createNodeDataSourceEnvironment()),
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
        if (event.source === 'mtw.subscriptions' && event["detail-type"].startsWith('Initialize Subscription -')) {
            const streamKey = event.detail?.streamKey || ''
            const dataSourceKey = (event["detail-type"] as string).replace(/^Initialize Subscription - /, '')
            sendInitializeSubscription(
                messageBus,
                dataSourceKey,
                streamKey,
                event.detail?.sessionId,
                event.detail?.requestId
            )
            await messageBus.flushAndSettle()
            return
        }

        // Find the appropriate deserializer for this data source
        const deserializer = eventDeserializers[event.source as keyof typeof eventDeserializers]
        
        if (deserializer) {
            const coreFormat = fromEventBridgeFormat(event)
            if (event.source === 'mtw.connections' && event['detail-type'] === 'Character Registered') {
                const update = coreFormat.update as { characterId?: string; sessionId?: string }
                console.log('[mtw.ephemera] EventBridge ingest', {
                    source: event.source,
                    detailType: event['detail-type'],
                    streamKey: coreFormat.header.streamKey,
                    characterId: update?.characterId,
                    sessionId: update?.sessionId,
                })
            }
            const envelope = coreFormatToStreamingEnvelope(coreFormat, () =>
                (deserializer as any).deserialize({ content: coreFormat.update as any, header: coreFormat.header }) as Promise<any>
            )
            const timestamp = envelope.header.timestamp ?? (event.time ? new Date(event.time).getTime() : getCurrentTimestamp())
            messageBus.publish({
                type: 'StreamingEvent',
                dataSourceKey: envelope.header.dataSourceKey,
                streamKey: envelope.header.streamKey,
                header: envelope.header,
                getContent: envelope.getContent,
                timestamp
            })
        } else {
            // No deserializer available - this is an error condition
            messageBus.publish({
                type: 'Error',
                body: {
                    error: `No deserializer available for data source: ${event.source}`
                }
            })
        }
        // Flush messageBus and return after handling EventBridge events
        await messageBus.flushAndSettle()
        return
    }

    // Handle legacy EventBridge messages that don't use DataSource pattern yet
    if (['mtw.diagnostics', 'mtw.development', 'mtw.players', 'mtw.wml'].includes(event?.source || '')) {
        switch(event["detail-type"]) {
            case 'Disconnect Character':
                console.log(`Disconnect Character: ${JSON.stringify(event.detail, null, 4)}`)
                if (event.detail.characterId) {
                    messageBus.publish({
                        type: 'DisconnectCharacter',
                        characterId: event.detail.characterId
                    })
                }
                break
            case 'Player Connected':
                await confirmGuestCharacter(event.detail.player)
                await messageBus.flushAndSettle()
                return await extractReturnValue(messageBus)
        }
    }
    else {
        if (isEphemeraAPIMessage(request)) {
            if (isUnregisterCharacterAPIMessage(request)) {
                if (request.CharacterId && isEphemeraCharacterId(request.CharacterId)) {
                    messageBus.send({
                        type: 'UnregisterCharacter',
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

            if (isFetchThinkingResultAPIMessage(request)) {
                await handleFetchThinkingResult(request, messageBus)
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

    // Boundary drain: quiesces hybrid publish/settle + send/flush graph for this invocation.
    await messageBus.flushAndSettle()
    return extractReturnValue(messageBus)

}