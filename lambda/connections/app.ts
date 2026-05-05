// Copyright 2024 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { connectionDB, META_SESSION_PK, sessionMetaSortKey } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/ts/errors"
import { disconnect } from './disconnect'
import { generateInvitationCode, validateInvitationCode } from "./invitationCodes"
import { InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider"
import { cognitoClient } from "./clients"
import { createCognitoUser } from "./createUser"
import { handleStaleSessionFinding } from "./staleSessionFinding"
import { getSessionPlayerForTeardown, tearDownStaleSession } from "./staleSessionTeardown"

export const handler = async (event: any) => {

    //
    // EventBridge (diagnostics findings)
    //
    if (event?.source === 'mtw.diagnostics' && event['detail-type'] === 'Stale SessionId Finding') {
        return await handleStaleSessionFinding(event.detail ?? {})
    }

    const { connectionId, routeKey, resourcePath } = event.requestContext || {}

    //
    // Handle direct disconnect call from RealTimeWebSocket
    //
    if (routeKey === '$disconnect') {
        await disconnect(connectionId)
        return
    }

    //
    // Handle call from AnonymousAPI
    //
    if (resourcePath === '/validateInvitation') {
        const json = JSON.parse(event.body)
        if (typeof json === 'object' && 'invitationCode' in json) {
            const valid = await validateInvitationCode(json.invitationCode)
            return {
                statusCode: 200,
                body: JSON.stringify({ valid }),
                headers: { 'Access-Control-Allow-Origin': '*' }
            }
        }
    }
    if (resourcePath === '/signIn') {
        const json = JSON.parse(event.body)
        if (typeof json === 'object' && 'userName' in json && 'password' in json) {
            try {
                const results = await cognitoClient.send(new InitiateAuthCommand({
                    AuthFlow: 'USER_PASSWORD_AUTH',
                    AuthParameters: {
                        USERNAME: json.userName,
                        PASSWORD: json.password
                    },
                    ClientId: process.env.COGNITO_USER_POOL_CLIENT
                }))
                const { AuthenticationResult } = results
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        AccessToken: AuthenticationResult?.AccessToken,
                        IdToken: AuthenticationResult?.IdToken,
                        RefreshToken: AuthenticationResult?.RefreshToken
                    }),
                    headers: { 'Access-Control-Allow-Origin': '*' }
                }
            }
            catch (error: any) {
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        errorMessage: 'Incorrect username or password.'
                    }),
                    headers: { 'Access-Control-Allow-Origin': '*' }
                }
            }
        }
    }
    if (resourcePath === '/signUp') {
        const json = JSON.parse(event.body)
        if (typeof json === 'object' && 'userName' in json && 'inviteCode' in json && 'password' in json) {
            const result = await createCognitoUser(json)
            return {
                statusCode: 200,
                body: JSON.stringify(result),
                headers: { 'Access-Control-Allow-Origin': '*' }
            }
        }
    }
    if (resourcePath === '/accessToken') {
        const json = JSON.parse(event.body)
        if (typeof json === 'object' && 'RefreshToken' in json) {
            try {
                const results = await cognitoClient.send(new InitiateAuthCommand({
                    AuthFlow: 'REFRESH_TOKEN_AUTH',
                    AuthParameters: {
                        REFRESH_TOKEN: json.RefreshToken
                    },
                    ClientId: process.env.COGNITO_USER_POOL_CLIENT
                }))
                const { AuthenticationResult } = results
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        AccessToken: AuthenticationResult?.AccessToken,
                        IdToken: AuthenticationResult?.IdToken,
                    }),
                    headers: { 'Access-Control-Allow-Origin': '*' }
                }
            }
            catch (error: any) {
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        errorMessage: 'Invalid refresh token.'
                    }),
                    headers: { 'Access-Control-Allow-Origin': '*' }
                }
            }
        }
    }

    //
    // Handle messages from RealTimeWebSocket
    //
    if (event.message === 'dropConnection') {
        const epochTime = Date.now()
        const { sessionId, connectionId } = event
        const { dropAfter } = (await connectionDB.optimisticUpdate<{ dropAfter?: number }>({
            Key: {
                ConnectionId: META_SESSION_PK,
                DataCategory: sessionMetaSortKey(sessionId)
            },
            updateKeys: ['connections', 'dropAfter'],
            updateReducer: (draft: { connections?: string[]; dropAfter?: number }) => {
                if (typeof draft.connections === 'undefined') {
                    draft.connections = []
                    draft.dropAfter = epochTime + 4000
                }
                else {
                    draft.connections = draft.connections.filter((id) => (id !== connectionId))
                    if (draft.connections.length === 0) {
                        draft.dropAfter = epochTime + 4000
                    }
                    else {
                        draft.dropAfter = undefined
                    }
                }
            }
        }) || {})
        return { dropAfter }
    }
    if (event.message === 'checkSession') {
        const epochTime = Date.now()
        const { sessionId } = event
        const player = await getSessionPlayerForTeardown(sessionId)
        let shouldDrop = false
        await connectionDB.optimisticUpdate<{ connections: string[]; dropAfter?: number; shouldDrop?: string }>({
            Key: {
                ConnectionId: META_SESSION_PK,
                DataCategory: sessionMetaSortKey(sessionId)
            },
            updateKeys: ['connections', 'dropAfter', 'shouldDrop'],
            updateReducer: (draft) => {
                if (typeof draft.dropAfter === 'number' && draft.dropAfter < epochTime && !(Array.isArray(draft.connections) && draft.connections.length > 0)) {
                    draft.shouldDrop = 'Yes'
                    shouldDrop = true
                }
            },
            deleteCondition: ({ shouldDrop }) => (Boolean(shouldDrop))
        })
        if (shouldDrop) {
            await asyncSuppressExceptions(async () => {
                await tearDownStaleSession(sessionId, { sourceOperation: 'checkSession', player })
            })
        }
        return
    }
    if (event.message === 'generateInvitation') {
        const invitationCode = await generateInvitationCode()
        return { invitationCode }
    }
    throw new Error('Invalid parameters')
}