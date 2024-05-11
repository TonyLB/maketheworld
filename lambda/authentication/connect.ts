
import { v4 as uuidv4 } from 'uuid'
import { connectionDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

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
        await Promise.all([
            connectionDB.putItem({
                ConnectionId: `CONNECTION#${connectionId}`,
                DataCategory: 'Meta::Connection',
                player: userName,
                SessionId: defaultedSessionId
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
                    }
                    else if (draft.player !== userName) {
                        throw new Error('Attempt to hijack an existing session')
                    }
                }
            }),
            connectionDB.optimisticUpdate({
                Key: {
                    ConnectionId: 'Global',
                    DataCategory: 'Connections'    
                },
                updateKeys: ['connections', 'sessions'],
                updateReducer: (draft: { connections?: Record<string, string>; sessions?: Record<string, string> }) => {
                    if (draft.connections === undefined) {
                        draft.connections = {}
                    }
                    if (draft.sessions === undefined) {
                        draft.sessions = {}
                    }
                    if (userName) {
                        draft.connections[connectionId] = userName
                        draft.sessions[defaultedSessionId] = userName
                    }
                },
            })
        ] as Promise<any>[])
    
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
