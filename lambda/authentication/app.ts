// Copyright 2023 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import connect from './connect.js'
import { validateJWT } from './validateJWT.js'

export const handler = async (event: any) => {
    console.log('[authentication.handler] Received event', {
        routeKey: event.requestContext?.routeKey,
        connectionId: event.requestContext?.connectionId,
        hasQueryStringParameters: !!event.queryStringParameters,
        queryStringParameters: event.queryStringParameters ? Object.keys(event.queryStringParameters) : []
    })

    const { connectionId, routeKey } = event.requestContext || {}

    if (routeKey === '$connect') {
        console.log('[authentication.handler] Processing $connect route', {
            connectionId,
            hasQueryStringParameters: !!event.queryStringParameters
        })
        
        const { Authorization = '', SessionId = '' } = event.queryStringParameters || {}
        console.log('[authentication.handler] Extracted parameters', {
            hasAuthorization: !!Authorization,
            authorizationLength: Authorization.length,
            hasSessionId: !!SessionId,
            sessionId: SessionId || '(none)'
        })
        
        const validationResult = await validateJWT(Authorization)
        console.log('[authentication.handler] JWT validation result', {
            hasValidationResult: !!validationResult,
            userName: validationResult?.userName || '(none)',
            validationKeys: validationResult ? Object.keys(validationResult) : []
        })
        
        const { userName } = validationResult || {}
        if (userName) {
            console.log('[authentication.handler] Calling connect function', {
                connectionId,
                userName,
                sessionId: SessionId || '(none)'
            })
            const result = await connect(connectionId, userName, SessionId)
            console.log('[authentication.handler] Connect function returned', {
                statusCode: result.statusCode,
                message: result.message || '(none)'
            })
            return result
        }
        else {
            console.log('[authentication.handler] JWT validation failed - no userName', {
                connectionId,
                hasValidationResult: !!validationResult
            })
            return { statusCode: 403 }
        }
    }
    
    console.log('[authentication.handler] Unknown route key', {
        routeKey: routeKey || '(none)',
        connectionId
    })
    return { statusCode: 401 }

}