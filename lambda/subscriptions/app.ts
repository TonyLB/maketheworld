// Copyright 2024 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { isSubscribeAPIMessage } from "@tonylb/mtw-interfaces/ts/subscriptions"
import { subscriptionLibrary } from "./handlerFramework"
import internalCache from "./internalCache"

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
    }
    //
    // Handle EventBridge events that may need to be forwarded to subscribers
    //
    if (event?.source) {
        const match = subscriptionLibrary.matchEvent(event)
        if (match) {
            await match.publish()
        }
    }
    return {
        statusCode: 200,
        body: "{}"
    }

}