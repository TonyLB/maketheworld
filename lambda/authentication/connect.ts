
import { v4 as uuidv4 } from 'uuid'
import { connectionDB, META_SESSION_PK, sessionMetaSortKey, playerSessionsPK } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { eventBridgeClient } from "@tonylb/mtw-utilities/ts/eventBridge"
import { publishStreamEvent } from '@tonylb/mtw-lambda-patterns/ts/dataSource/streamEventPublisher'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { PlayersEventSerializer, buildStaleSessionProblemDedupeKey, type PlayerConnectedEvent, type PlayerStaleSessionProblemEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/players'
import { detectStaleSessionsForPlayer } from './staleSessionDetection'

const playersEventSerializer = new PlayersEventSerializer(createNodeDataSourceEnvironment())

class SessionHijackError extends Error {}

export const connect = async (connectionId: string, userName: string, SessionId: string): Promise<{ statusCode: number; message?: string }> => {

    console.log(`[mtw.authentication] connect() invoked`, { connectionId, userName, SessionId })
    const defaultedSessionId = SessionId || uuidv4()
    if (connectionId) {
        let staleSessionIds: string[] = []
        try {
            const results = await Promise.all([
                connectionDB.putItem({
                    ConnectionId: `CONNECTION#${connectionId}`,
                    DataCategory: 'Meta::Connection',
                    player: userName,
                    SessionId: defaultedSessionId,
                    deleteAt: Date.now() + 75 * 60 * 1000
                }),
                connectionDB.transactWrite([
                    {
                        Update: {
                            Key: {
                                ConnectionId: META_SESSION_PK,
                                DataCategory: sessionMetaSortKey(defaultedSessionId)
                            },
                            updateKeys: ['connections', 'player'],
                            updateReducer: (draft: { connections?: string[]; player?: string }) => {
                                if (typeof draft.player !== 'undefined' && draft.player !== userName) {
                                    console.log(`Attempt to hijack an existing session (${draft.player} => ${userName})`)
                                    throw new SessionHijackError(`Attempt to hijack an existing session (${draft.player} => ${userName})`)
                                }
                                if (typeof draft.connections === 'undefined') {
                                    draft.connections = [connectionId]
                                }
                                else {
                                    draft.connections = [
                                        ...draft.connections.filter((id) => (id !== connectionId)),
                                        connectionId
                                    ]
                                }
                                if (typeof draft.player === 'undefined') {
                                    draft.player = userName
                                }
                            }
                        }
                    },
                    {
                        Put: {
                            ConnectionId: playerSessionsPK(userName),
                            DataCategory: sessionMetaSortKey(defaultedSessionId)
                        }
                    }
                ] as Parameters<typeof connectionDB.transactWrite>[0]),
                detectStaleSessionsForPlayer(userName, defaultedSessionId).catch((err) => {
                    console.error(`[mtw.authentication] detectStaleSessionsForPlayer failed`, {
                        userName,
                        connectionId,
                        sessionId: defaultedSessionId,
                        error: err instanceof Error ? err.message : String(err)
                    })
                    return [] as string[]
                })
            ] as Promise<any>[])
            staleSessionIds = results[2] as string[]
        }
        catch (err) {
            if (err instanceof SessionHijackError) {
                console.log(`[mtw.authentication] connect() not authenticated; Player Connected not published`, { userName, connectionId, sessionId: defaultedSessionId })
                return {
                    statusCode: 403,
                    message: 'Invalid SessionID for this player'
                }
            }
            throw err
        }

        // Publish Player Connected event with connection details
        // The subscriptions lambda will handle sending SessionInitialized message
        // after the WebSocket handshake completes
        console.log(`[mtw.authentication] publishing Player Connected`, { userName, connectionId, sessionId: defaultedSessionId })
        const content: PlayerConnectedEvent = {
            type: 'Player Connected',
            player: userName,
            connectionId,
            sessionId: defaultedSessionId,
            timestamp: Date.now()
        }
        const { eventBridgeEvent } = publishStreamEvent({
            header: {
                dataSourceKey: 'mtw.players',
                streamKey: `PLAYER#${userName}`,
                timestamp: content.timestamp,
                type: 'Player Connected'
            },
            content,
            serializer: playersEventSerializer
        })

        const staleSessionEvents = staleSessionIds.map((sessionId) => {
            const attemptCount = 1
            const staleContent: PlayerStaleSessionProblemEvent = {
                type: 'Stale Session Problem',
                sessionId,
                player: userName,
                sourceOperation: 'connect',
                attemptCount,
                dedupeKey: buildStaleSessionProblemDedupeKey(sessionId, attemptCount),
                timestamp: new Date().toISOString()
            }
            return publishStreamEvent({
                header: {
                    dataSourceKey: 'mtw.players',
                    streamKey: `PLAYER#${userName}`,
                    timestamp: Date.now(),
                    type: 'Stale Session Problem'
                },
                content: staleContent,
                serializer: playersEventSerializer
            }).eventBridgeEvent
        })

        const putEventsResult = await eventBridgeClient.send([eventBridgeEvent, ...staleSessionEvents])
        if (putEventsResult?.FailedEntryCount) {
            console.error(`[mtw.authentication] Player Connected PutEvents failed`, {
                userName,
                connectionId,
                sessionId: defaultedSessionId,
                failedEntryCount: putEventsResult.FailedEntryCount,
                entries: putEventsResult.Entries,
            })
        }
        return {
            statusCode: 200
        }
    }
    else {
        return {
            statusCode: 500,
            message: 'Internal Server Error'
        }
    }

}

export default connect
