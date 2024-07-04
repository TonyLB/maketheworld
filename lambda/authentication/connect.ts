
import { v4 as uuidv4 } from 'uuid'
import { connectionDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge"

const ebClient = new EventBridgeClient({ region: process.env.AWS_REGION })

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
    //     OneCoolThing: 'Enthusiastic Curiosity',
    //     FirstImpression: 'Friendly Tourist',
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
                    }
                    else if (draft.player !== userName) {
                        console.log(`Attempt to hijack an existing session (${draft.player} => ${userName})`)
                    }
                    else {
                        authenticated = true
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
    
        if (authenticated) {
            await ebClient.send(new PutEventsCommand({
                Entries: [{
                    EventBusName: process.env.EVENT_BUS_NAME,
                    Source: 'mtw.coordination',
                    DetailType: 'Player Connected',
                    Detail: JSON.stringify({ player: userName })
                }]
            }))
            return {
                statusCode: 200
            }
        }
        else {
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
