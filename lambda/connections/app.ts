// Copyright 2024 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { connectionDB, exponentialBackoffWrapper } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/ts/errors"
import { atomicallyRemoveCharacterAdjacency, disconnect } from './disconnect'
import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { generateInvitationCode, validateInvitationCode } from "./invitationCodes"
import { InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider"
import { cognitoClient, ebClient } from "./clients"
import { createCognitoUser } from "./createUser"
import { PutEventsCommand } from "@aws-sdk/client-eventbridge"

export const handler = async (event: any) => {

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
                ConnectionId: `SESSION#${sessionId}`,
                DataCategory: 'Meta::Session'
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
        let shouldDrop = false
        await connectionDB.optimisticUpdate<{ connections: string[]; dropAfter?: number; shouldDrop?: string }>({
            Key: {
                ConnectionId: `SESSION#${sessionId}`,
                DataCategory: 'Meta::Session'
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
                await exponentialBackoffWrapper(async () => {
                    const characterQuery = await connectionDB.query<{ ConnectionId: string; DataCategory: EphemeraCharacterId }>({
                        Key: { ConnectionId: `SESSION#${sessionId}` },
                        ExpressionAttributeValues: {
                            ':dcPrefix': 'CHARACTER#'
                        },
                        KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
                        ProjectionFields: ['DataCategory']
                    })

                    await Promise.all(characterQuery.map(({ DataCategory }) => (atomicallyRemoveCharacterAdjacency(sessionId, DataCategory))))

                    await connectionDB.transactWrite([
                        {
                            Update: {
                                Key: {
                                    ConnectionId: 'Global',
                                    DataCategory: 'Sessions'
                                },
                                updateKeys: ['sessions'],
                                updateReducer: (draft) => {
                                    if (typeof draft.sessions === 'undefined') {
                                        draft.sessions = {}
                                    }
                                    else {
                                        draft.sessions[sessionId] = undefined
                                    }
                                }
                            }
                        },
                        {
                            Update: {
                                Key: {
                                    ConnectionId: 'Library',
                                    DataCategory: 'Subscriptions'
                                },
                                updateKeys: ['SessionIds'],
                                updateReducer: (draft) => {
                                    draft.SessionIds = (draft.SessionIds ?? []).filter((value) => (value !== sessionId))
                                }
                            }
                        },
                        {
                            Update: {
                                Key: {
                                    ConnectionId: 'Map',
                                    DataCategory: 'Subscriptions'
                                },
                                updateKeys: ['SessionIds'],
                                updateReducer: (draft) => {
                                    draft.SessionIds = (draft.SessionIds ?? []).filter((value) => (value !== sessionId))
                                }
                            }
                        }
                    ])
                }, {
                    retryErrors: ['TransactionCanceledException']
                })
                await ebClient.send(new PutEventsCommand({
                    Entries: [{
                        EventBusName: process.env.EVENT_BUS_NAME,
                        Source: 'mtw.connections',
                        DetailType: 'Session Disconnect',
                        Detail: JSON.stringify({ sessionId })
                    }]
                }))
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