
import { v4 as uuidv4 } from 'uuid'
import { connectionDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { eventBridgeClient } from "@tonylb/mtw-utilities/ts/eventBridge"

const confirmGuestCharacter = async ({ characterId, name }: { characterId?: string; name?: string }): Promise<void> => {
    //
    // TODO: confirmGuestCharacter should hang off of a "PlayerConnected" EventBridge notification, when the player
    // is connecting for the first time, and be evaluated in Ephemera lambda
    //

    // if (!(characterId && name)) {
    //     return
    // }
    // await pushCharacterEphemera({
    //     key: characterId,
    //     EphemeraId: `CHARACTER#${characterId}`,
    //     Name: name,
    //     Color: 'pink',
    //     Pronouns: {
    //         subject: 'they',
    //         object: 'them',
    //         possessive: 'their',
    //         adjective: 'theirs',
    //         reflexive: 'themself'
    //     },
    //     assets: [],
    //     RoomId: 'VORTEX'
    // })
}

export const connect = async (connectionId: string, userName: string, SessionId: string): Promise<{ statusCode: number; message?: string }> => {
    console.log('[authentication.connect] Starting connection', {
        connectionId,
        userName,
        providedSessionId: SessionId || '(none)',
        hasConnectionId: !!connectionId,
        hasUserName: !!userName
    })

    const defaultedSessionId = SessionId || uuidv4()
    console.log('[authentication.connect] SessionId resolved', {
        defaultedSessionId,
        wasProvided: !!SessionId,
        wasGenerated: !SessionId
    })

    if (connectionId) {
        let authenticated = false
        console.log('[authentication.connect] Starting database operations')
        
        try {
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
                        ConnectionId: `SESSION#${defaultedSessionId}`,
                        DataCategory: 'Meta::Session'
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
                            console.log('[authentication.connect] New session created', {
                                sessionId: defaultedSessionId,
                                player: userName,
                                connectionId
                            })
                        }
                        else if (draft.player !== userName) {
                            console.log(`[authentication.connect] Attempt to hijack an existing session (${draft.player} => ${userName})`)
                        }
                        else {
                            authenticated = true
                            console.log('[authentication.connect] Existing session authenticated', {
                                sessionId: defaultedSessionId,
                                player: userName,
                                connectionId
                            })
                        }
                    }
                }),
                connectionDB.optimisticUpdate({
                    Key: {
                        ConnectionId: 'Global',
                        DataCategory: 'Sessions'    
                    },
                    updateKeys: ['sessions'],
                    updateReducer: (draft: { sessions?: Record<string, string> }) => {
                        if (draft.sessions === undefined) {
                            draft.sessions = {}
                        }
                        if (userName) {
                            draft.sessions[defaultedSessionId] = userName
                        }
                    },
                })
            ] as Promise<any>[])
            console.log('[authentication.connect] Database operations completed', {
                authenticated,
                sessionId: defaultedSessionId
            })
        }
        catch (error) {
            console.error('[authentication.connect] Database operations failed', {
                error,
                connectionId,
                userName,
                sessionId: defaultedSessionId
            })
            return {
                statusCode: 500,
                message: 'Database operation failed'
            }
        }
    
        if (authenticated) {
            console.log('[authentication.connect] Authentication successful, publishing events', {
                connectionId,
                userName,
                sessionId: defaultedSessionId
            })
            
            try {
                // Publish Player Connected event with connection details
                // The subscriptions lambda will handle sending SessionInitialized message
                // after the WebSocket handshake completes
                await eventBridgeClient.send([{
                    Source: 'mtw.players',
                    DetailType: 'Player Connected',
                    Detail: {
                        player: userName,
                        connectionId,
                        sessionId: defaultedSessionId,
                        timestamp: Date.now()
                    }
                }])
                
                console.log('[authentication.connect] Events published successfully, returning success', {
                    connectionId,
                    sessionId: defaultedSessionId
                })
                
                // Return success immediately - this allows API Gateway to complete the WebSocket handshake
                // The subscriptions lambda will send the SessionInitialized message after handshake completes
                return {
                    statusCode: 200
                }
            }
            catch (error) {
                console.error('[authentication.connect] Failed to publish events', {
                    error,
                    connectionId,
                    sessionId: defaultedSessionId
                })
                // Still return success since database operations succeeded
                // Event publishing failure shouldn't block connection establishment
                return {
                    statusCode: 200
                }
            }
        }
        else {
            console.log('[authentication.connect] Authentication failed - session hijack attempt or invalid session', {
                connectionId,
                userName,
                sessionId: defaultedSessionId
            })
            return {
                statusCode: 403,
                message: 'Invalid SessionID for this player'
            }
        }

    }
    else {
        console.error('[authentication.connect] No connectionId provided', {
            connectionId,
            userName
        })
        return {
            statusCode: 500,
            message: 'Internal Server Error'
        }
    }

}

export default connect
