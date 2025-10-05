// Copyright 2024 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { isSubscribeAPIMessage, isUnsubscribeAPIMessage } from "@tonylb/mtw-interfaces/ts/subscriptions"
import { subscriptionLibrary } from "./handlerFramework"
import { fromEventBridgeFormat } from "@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform"
import internalCache from "./internalCache"
import { connectionDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { eventBridgeClient } from "@tonylb/mtw-utilities/ts/eventBridge"

// Configuration for replayable DataSources that support snapshot initialization
const REPLAYABLE_DATA_SOURCES = [
    'mtw.assets.contentHeaders'
    // Future: 'mtw.ephemera', 'mtw.players'
] as const

/**
 * Determines if a DataSource supports replay functionality (snapshot initialization)
 */
function isReplayableDataSource(dataSourceKey: string): boolean {
    return REPLAYABLE_DATA_SOURCES.includes(dataSourceKey as any)
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
        const match = subscriptionLibrary.match(request)
        if (match) {
            const sessionId = await internalCache.Global.get("SessionId")
            
            // 1. Set up local subscription storage
            await match.subscribe(request, `SESSION#${sessionId}`)
            
            // 2. Trigger snapshot initialization for replayable DataSources
            if (isReplayableDataSource(request.dataSourceKey)) {
                console.log(`Triggering snapshot initialization for replayable DataSource: ${request.dataSourceKey}`)
                await eventBridgeClient.send([{
                    Source: 'mtw.subscriptions',
                    DetailType: `Initialize Subscription - ${request.dataSourceKey}`,
                    Detail: {
                        streamKey: request.streamKey,
                        sessionId: `SESSION#${sessionId}`,
                        requestId: request.RequestId
                    }
                }])
            }
        }
        else {
            console.log(`No match: ${JSON.stringify(request, null, 4)}`)
        }
        return {
            statusCode: 200,
            body: JSON.stringify({ messageType: 'Success', RequestId: request.RequestId })
        }
    }
    if (isUnsubscribeAPIMessage(request)) {
        const match = subscriptionLibrary.match(request)
        if (match) {
            const sessionId = await internalCache.Global.get("SessionId")
            await match.unsubscribe(request, `SESSION#${sessionId}`)
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
    else if (event?.source) {
        console.log(`Subscription event: ${JSON.stringify(event, null, 4)}`)
        const coreFormat = fromEventBridgeFormat({
            Source: event.source,
            DetailType: event["detail-type"],
            Detail: event.detail
        })
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