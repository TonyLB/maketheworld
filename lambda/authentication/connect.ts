
import { v4 as uuidv4 } from 'uuid'
import { connectionDB, META_SESSION_PK, sessionMetaSortKey } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { eventBridgeClient } from "@tonylb/mtw-utilities/ts/eventBridge"
import { publishStreamEvent } from '@tonylb/mtw-lambda-patterns/ts/dataSource/streamEventPublisher'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { PlayersEventSerializer, type PlayerConnectedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/players'

const playersEventSerializer = new PlayersEventSerializer(createNodeDataSourceEnvironment())

export const connect = async (connectionId: string, userName: string, SessionId: string): Promise<{ statusCode: number; message?: string }> => {

    console.log(`[mtw.authentication] connect() invoked`, { connectionId, userName, SessionId })
    const defaultedSessionId = SessionId || uuidv4()
    if (connectionId) {
        let authenticated = false
        await Promise.all([
            connectionDB.putItem({
                ConnectionId: `CONNECTION#${connectionId}`,
                DataCategory: 'Meta::Connection',
                player: userName,
                SessionId: defaultedSessionId,
                deleteAt: Date.now() + 75 * 60 * 1000
            }),
            connectionDB.optimisticUpdate({
                Key: {
                    ConnectionId: META_SESSION_PK,
                    DataCategory: sessionMetaSortKey(defaultedSessionId)
                },
                updateKeys: ['connections', 'player'],
                updateReducer: (draft: { connections?: string[]; player?: string }) => {
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
                        authenticated = true
                    }
                    else if (draft.player !== userName) {
                        console.log(`Attempt to hijack an existing session (${draft.player} => ${userName})`)
                    }
                    else {
                        authenticated = true
                    }
                }
            })
        ] as Promise<any>[])
    
        if (authenticated) {
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
            const putEventsResult = await eventBridgeClient.send([eventBridgeEvent])
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
            console.log(`[mtw.authentication] connect() not authenticated; Player Connected not published`, { userName, connectionId, sessionId: defaultedSessionId })
            return {
                statusCode: 403,
                message: 'Invalid SessionID for this player'
            }
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
