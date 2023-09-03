
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

export const connect = async (connectionId: string, userName: string): Promise<{ statusCode: number; message?: string }> => {

    if (connectionId) {
        await Promise.all([
            connectionDB.putItem({
                ConnectionId: `CONNECTION#${connectionId}`,
                DataCategory: 'Meta::Connection',
                player: userName
            }),
            connectionDB.optimisticUpdate({
                Key: {
                    ConnectionId: 'Global',
                    DataCategory: 'Connections'    
                },
                updateKeys: ['connections'],
                updateReducer: (draft: { connections?: Record<string, string> }) => {
                    if (draft.connections === undefined) {
                        draft.connections = {}
                    }
                    if (userName) {
                        draft.connections[connectionId] = userName
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
