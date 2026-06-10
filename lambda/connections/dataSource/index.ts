import { InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider"
import { ConnectionsEventSerializer, ConnectionsEventUpdate } from "@tonylb/mtw-interfaces/ts/eventBridge/connections"
import { DiagnosticsEventSerializer, DiagnosticsStaleSessionIdFindingEvent } from "@tonylb/mtw-interfaces/ts/eventBridge/diagnostics"
import { DataSource } from "@tonylb/mtw-lambda-patterns/ts/dataSource"
import { createNodeDataSourceEnvironment } from "@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/ts/errors"
import { connectionDB, META_SESSION_PK, sessionMetaSortKey } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { cognitoClient } from "../clients"
import { createCognitoUser } from "../createUser"
import { disconnect } from "../disconnect"
import { generateInvitationCode, validateInvitationCode } from "../invitationCodes"
import { registerCharacterMessage } from "../registerCharacter"
import { handleStaleSessionFinding } from "../staleSessionFinding"
import { getSessionPlayerForTeardown, tearDownStaleSession } from "../staleSessionTeardown"
import messageBus from "../messageBus"
import { ConnectionsAPIPayload, isApiConnectionsEnvelope } from "./apiConnections"
import { ConnectionsExternalSubscribedContent, isConnectionsSubscribedEnvelope, isDiagnosticsStaleSessionFindingEnvelope } from "./subscribedEvents"
import "./charactersDataSource"

export const diagnosticsDeserializer = new DiagnosticsEventSerializer(createNodeDataSourceEnvironment())
const connectionsEventSerializer = new ConnectionsEventSerializer(createNodeDataSourceEnvironment())

const isConnectionsIncomingEnvelope = (envelope: any): envelope is {
    header: { dataSourceKey: string; type: string };
    getContent: () => Promise<ConnectionsAPIPayload | ConnectionsExternalSubscribedContent>;
} => (
    isApiConnectionsEnvelope(envelope) || isConnectionsSubscribedEnvelope(envelope)
)

const corsResponse = (body: unknown) => ({
    statusCode: 200,
    body: JSON.stringify(body),
    headers: { 'Access-Control-Allow-Origin': '*' }
})

const handleApiConnectionsPayload = async (content: ConnectionsAPIPayload) => {
    switch(content.type) {
        case '$disconnect':
            await disconnect(content.connectionId)
            return
        case 'validateInvitation': {
            const valid = await validateInvitationCode(content.invitationCode)
            return corsResponse({ valid })
        }
        case 'signIn':
            try {
                const results = await cognitoClient.send(new InitiateAuthCommand({
                    AuthFlow: 'USER_PASSWORD_AUTH',
                    AuthParameters: {
                        USERNAME: content.userName,
                        PASSWORD: content.password
                    },
                    ClientId: process.env.COGNITO_USER_POOL_CLIENT
                }))
                const { AuthenticationResult } = results
                return corsResponse({
                    AccessToken: AuthenticationResult?.AccessToken,
                    IdToken: AuthenticationResult?.IdToken,
                    RefreshToken: AuthenticationResult?.RefreshToken
                })
            }
            catch (error: any) {
                return corsResponse({
                    errorMessage: 'Incorrect username or password.'
                })
            }
        case 'signUp': {
            const result = await createCognitoUser(content)
            return corsResponse(result)
        }
        case 'accessToken':
            try {
                const results = await cognitoClient.send(new InitiateAuthCommand({
                    AuthFlow: 'REFRESH_TOKEN_AUTH',
                    AuthParameters: {
                        REFRESH_TOKEN: content.RefreshToken
                    },
                    ClientId: process.env.COGNITO_USER_POOL_CLIENT
                }))
                const { AuthenticationResult } = results
                return corsResponse({
                    AccessToken: AuthenticationResult?.AccessToken,
                    IdToken: AuthenticationResult?.IdToken,
                })
            }
            catch (error: any) {
                return corsResponse({
                    errorMessage: 'Invalid refresh token.'
                })
            }
        case 'registerCharacter': {
            const result = await registerCharacterMessage({
                connectionId: content.connectionId,
                characterId: content.characterId,
                requestId: content.requestId,
                streamEvent: streamConnectionsEvent
            })
            return result
        }
        case 'dropConnection': {
            const epochTime = Date.now()
            const { dropAfter } = (await connectionDB.optimisticUpdate<{ dropAfter?: number }>({
                Key: {
                    ConnectionId: META_SESSION_PK,
                    DataCategory: sessionMetaSortKey(content.sessionId)
                },
                updateKeys: ['connections', 'dropAfter'],
                updateReducer: (draft: { connections?: string[]; dropAfter?: number }) => {
                    if (typeof draft.connections === 'undefined') {
                        draft.connections = []
                        draft.dropAfter = epochTime + 4000
                    }
                    else {
                        draft.connections = draft.connections.filter((id) => (id !== content.connectionId))
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
        case 'checkSession': {
            const epochTime = Date.now()
            const player = await getSessionPlayerForTeardown(content.sessionId)
            let shouldDrop = false
            await connectionDB.optimisticUpdate<{ connections: string[]; dropAfter?: number; shouldDrop?: string }>({
                Key: {
                    ConnectionId: META_SESSION_PK,
                    DataCategory: sessionMetaSortKey(content.sessionId)
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
                    await tearDownStaleSession(content.sessionId, {
                        sourceOperation: 'checkSession',
                        player,
                        streamEvent: streamConnectionsEvent
                    })
                })
            }
            return
        }
        case 'generateInvitation': {
            const invitationCode = await generateInvitationCode()
            return { invitationCode }
        }
    }
}

export const connectionsDataSource = new DataSource<
    never,
    ConnectionsEventUpdate,
    ConnectionsAPIPayload | ConnectionsExternalSubscribedContent,
    any,
    'ConnectionId'
>({
    dynamo: connectionDB as any,
    sns: {
        send: async () => undefined
    },
    messageBus: messageBus,
    primaryKeyName: 'ConnectionId',
    dataSourceKey: 'mtw.connections',
    feedbackTopicArn: process.env.FEEDBACK_TOPIC ?? '',
    replayable: false,
    outboundBusDelivery: 'publish',
    eventSerializer: connectionsEventSerializer,
    subscribedEventTypeGuard: isConnectionsIncomingEnvelope as any,
    receiveEvents: async ({ events }) => {
        await Promise.all(events.map(async (event) => {
            if (isApiConnectionsEnvelope(event as any)) {
                const content = await event.getContent() as ConnectionsAPIPayload
                try {
                    const result = await handleApiConnectionsPayload(content)
                    if (typeof result !== 'undefined') {
                        messageBus.publish({
                            type: 'ReturnValue',
                            body: result as Record<string, any>
                        })
                    }
                } catch (error) {
                    messageBus.publish({
                        type: 'Error',
                        body: {
                            error: error instanceof Error ? error.message : String(error),
                            statusCode: 500
                        }
                    })
                }
                return
            }
            if (isDiagnosticsStaleSessionFindingEnvelope(event as any)) {
                const content = await event.getContent() as DiagnosticsStaleSessionIdFindingEvent
                await handleStaleSessionFinding(content)
                return
            }
            throw new Error('Invalid subscribed event for mtw.connections DataSource')
        }))
    }
})

connectionsDataSource.subscribe()

export const streamConnectionsEvent = async (params: {
    update: ConnectionsEventUpdate;
    streamKey: string;
    header: { type: string };
}) => connectionsDataSource.streamEvent(params as any)
