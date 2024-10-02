// Copyright 2024 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { subscriptionLibrary } from "./handlerFramework"

export const handler = async (event: any) => {

    //
    // Handle Websocket calls to update the subscriber lists
    //
    if (event?.requestContext?.routeKey === 'subscriptions') {
        const request = JSON.parse(event.body ?? "{}")
        //
        // TODO: Create typeguard in mtw-interfaces and apply here
        //
        const match = subscriptionLibrary.match(request)
        if (match) {
            console.log(`Matched [${match._source}]: ${JSON.stringify(request, null, 4)}`)
        }
        else {
            console.log(`No match: ${JSON.stringify(request, null, 4)}`)
        }
    
    }
    //
    // Handle EventBridge events that may need to be forwarded to subscribers
    //
    if (event?.source) {

    }
    return {
        statusCode: 200,
        body: "{}"
    }

}