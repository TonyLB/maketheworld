// Copyright 2024 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { isSubscribeAPIMessage, isUnsubscribeAPIMessage, SubscribeAPIMessage } from "@tonylb/mtw-interfaces/ts/subscriptions"
import { subscriptionLibrary } from "./handlerFramework"
import { fromEventBridgeFormat } from "@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform"
import internalCache from "./internalCache"
import { connectionDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { eventBridgeClient } from "@tonylb/mtw-utilities/ts/eventBridge"
import { apiClient } from "./apiClient"
import { apiClient as rawAPIClient } from "@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient"
import { CoordinationClientSessionInitializedMessage } from "@tonylb/mtw-interfaces/ts/coordination"

// DataSources that receive Initialize Subscription on subscribe (snapshot-on-subscribe).
// Includes replayable (Dynamo replay) and mtw.wml (sidecar snapshot only).
const REPLAYABLE_DATA_SOURCES = [
    'mtw.assets.contentHeaders',
    'mtw.assets.library',
    'mtw.assets.players',
    'mtw.wml', // Sidecar snapshot on subscribe; Dynamo replay of events since snapshot
    'mtw.ephemera.thinking.scheduling',
] as const

/**
 * Determines if a DataSource supports replay functionality (snapshot initialization)
 */
function isReplayableDataSource(dataSourceKey: string): boolean {
    return REPLAYABLE_DATA_SOURCES.includes(dataSourceKey as any)
}

const PLAYER_STREAM_SENTINEL = 'self'

/**
 * Temporarily resolve player-centric stream keys to the authenticated player.
 * This is a stopgap until subscription authorization becomes context-aware.
 * When the request targets `mtw.assets.players`, any sentinel stream key of
 * `'self'` is rewritten to the resolved player name for the current connection.
 */
const resolveStreamKeys = async (request: SubscribeAPIMessage): Promise<SubscribeAPIMessage> => {
    if (request.dataSourceKey !== 'mtw.assets.players') {
        return request
    }

    const player = await internalCache.Global.get('player')
    if (!player) {
        console.warn('mtw.subscriptions: Unable to resolve player for mtw.assets.players subscription; falling back to original stream keys')
        return request
    }

    const resolvedStreamKeys = request.streamKeys
        .map((streamKey) => (streamKey === PLAYER_STREAM_SENTINEL ? player : streamKey))
        .filter((streamKey): streamKey is string => Boolean(streamKey))

    if (!resolvedStreamKeys.length) {
        return { ...request, streamKeys: [player] }
    }

    return { ...request, streamKeys: [...new Set(resolvedStreamKeys)] }
}

export const handler = async (event: any) => {

    const { connectionId, routeKey } = event.requestContext || {}
    const request = (event.body && (JSON.parse(event.body))) || {}

    internalCache.clear()
    internalCache.Global.set({ key: 'ConnectionId', value: connectionId })

    //
    // Handle Websocket calls to update the subscriber lists
    //
    if (isSubscribeAPIMessage(request)) {
        const resolvedRequest = await resolveStreamKeys(request)
        const matches = subscriptionLibrary.matchAll(resolvedRequest)
        if (matches.length > 0) {
            const sessionId = await internalCache.Global.get("SessionId")

            // 1. Set up local subscription storage for every matching handler (e.g. mtw.wml Content Update and Merge Conflict)
            await Promise.all(matches.map((match) => match.subscribe(resolvedRequest, `SESSION#${sessionId}`)))

            // 2. Trigger snapshot initialization for replayable DataSources
            if (isReplayableDataSource(resolvedRequest.dataSourceKey)) {
                console.log(`Triggering snapshot initialization for replayable DataSource: ${resolvedRequest.dataSourceKey}`)
                // Send initialization event for each stream key
                await eventBridgeClient.send(
                    resolvedRequest.streamKeys.map((streamKey) => ({
                        Source: 'mtw.subscriptions',
                        DetailType: `Initialize Subscription - ${resolvedRequest.dataSourceKey}`,
                        Detail: {
                            streamKey,
                            sessionId: `SESSION#${sessionId}`,
                            requestId: resolvedRequest.RequestId
                        }
                    }))
                )
            }
        }
        else {
            console.log(`No match: ${JSON.stringify(resolvedRequest, null, 4)}`)
        }
        return {
            statusCode: 200,
            body: JSON.stringify({ messageType: 'Success', RequestId: resolvedRequest.RequestId })
        }
    }
    if (isUnsubscribeAPIMessage(request)) {
        const matches = subscriptionLibrary.matchAll(request)
        if (matches.length > 0) {
            const sessionId = await internalCache.Global.get("SessionId")
            await Promise.all(matches.map((match) => match.unsubscribe(request, `SESSION#${sessionId}`)))
        }
        else {
            console.log(`No match: ${JSON.stringify(request, null, 4)}`)
        }
        return {
            statusCode: 200,
            body: JSON.stringify({ messageType: 'Success', RequestId: request.RequestId })
        }
    }
    //
    // Handle EventBridge events that may need to be forwarded to subscribers
    //
    if (event.source === 'mtw.connections') {
        if (event["detail-type"] === 'Session Disconnect') {
            const DataCategory = `SESSION#${event.detail?.sessionId}`
            const subscriptionDisconnects = (await connectionDB.query<{ ConnectionId: string; DataCategory: string }>({
                IndexName: 'DataCategoryIndex',
                Key: { DataCategory },
                KeyConditionExpression: 'begins_with(ConnectionId, :streamPrefix)',
                ExpressionAttributeValues: { [':streamPrefix']: 'STREAM#' },
                ProjectionFields: ['ConnectionId']
            }) || []).map(({ ConnectionId }) => (ConnectionId))
            await Promise.all(subscriptionDisconnects.map((ConnectionId) => (connectionDB.deleteItem({ ConnectionId, DataCategory }))))
        }
    }
    else if (event.source === 'mtw.players') {
        if (event["detail-type"] === 'Player Connected') {
            const { connectionId, sessionId, player } = event.detail || {}
            if (connectionId && sessionId && player) {
                // Poll GetConnection to detect when WebSocket handshake has completed
                // The connection is only ready after the $connect handler completes,
                // so we poll with short intervals until it's available
                const maxAttempts = 20  // 20 attempts * 10ms = 200ms max wait
                const pollInterval = 10 // 10ms between attempts
                let connectionReady = false
                
                for (let attempt = 0; attempt < maxAttempts; attempt++) {
                    connectionReady = await rawAPIClient.checkConnection(connectionId)
                    if (connectionReady) {
                        break
                    }
                    await new Promise(resolve => setTimeout(resolve, pollInterval))
                }
                
                if (connectionReady) {
                    try {
                        await apiClient.send(connectionId, {
                            messageType: 'SessionInitialized',
                            SessionId: sessionId,
                            PlayerName: player
                        } as CoordinationClientSessionInitializedMessage)
                    }
                    catch (error: any) {
                        // Log but don't fail - connection might have closed between check and send
                        if (error.name !== 'GoneException' && error.name !== 'BadRequestException') {
                            console.error('Failed to send SessionInitialized message', error)
                        }
                    }
                } else {
                    console.warn(`Connection ${connectionId} not ready after ${maxAttempts * pollInterval}ms, skipping SessionInitialized`)
                }
            }
        }
    }
    else if (event?.source) {
        console.log(`Subscription event: ${JSON.stringify(event, null, 4)}`)
        // fromEventBridgeFormat now handles both lowercase (EventBridge delivery) and capitalized formats
        const coreFormat = fromEventBridgeFormat(event)
        const match = subscriptionLibrary.matchEvent(coreFormat)
        if (match) {
            await match.publish(coreFormat)
        }
    }
    return {
        statusCode: 200,
        body: "{}"
    }

}