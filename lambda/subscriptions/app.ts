// Copyright 2024 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { isSubscribeAPIMessage, isUnsubscribeAPIMessage } from "@tonylb/mtw-interfaces/ts/subscriptions"
import { subscriptionLibrary } from "./handlerFramework"
import internalCache from "./internalCache"
import { connectionDB } from "@tonylb/mtw-utilities/ts/dynamoDB"

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
            await match.subscribe(request, `SESSION#${sessionId}`)
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
        const transformedEvent = {
            source: event.source,
            detailType: event["detail-type"],
            ...event.detail
        }
        const match = subscriptionLibrary.matchEvent(transformedEvent)
        if (match) {
            await match.publish(transformedEvent)
        }
    }
    return {
        statusCode: 200,
        body: "{}"
    }

}