import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { v4 as uuidv4 } from 'uuid'

export const addGhostSession = async ({ characterId }: { characterId?: EphemeraCharacterId }): Promise<void> => {
    if (characterId) {
        const sessionId = uuidv4()
        await connectionDB.transactWrite([
            {
                Put: {
                    ConnectionId: `SESSION#${sessionId}`,
                    DataCategory: 'Meta::Session'
                }
            },
            {
                Put: {
                    ConnectionId: `SESSION#${sessionId}`,
                    DataCategory: characterId
                }
            },
            {
                Put: {
                    ConnectionId: characterId,
                    DataCategory: 'Meta::Character',
                    sessions: [sessionId]
                }
            }
        ])
    }
    else {
        connectionDB.putItem({
            ConnectionId: `SESSION#${uuidv4()}`,
            DataCategory: 'Meta::Session'
        })
    }
}

export default addGhostSession
