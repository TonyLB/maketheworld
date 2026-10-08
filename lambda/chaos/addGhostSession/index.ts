import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { connectionDB, META_SESSION_PK, sessionMetaSortKey, playerSessionsPK } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { v4 as uuidv4 } from 'uuid'

export const addGhostSession = async ({ characterId }: { characterId?: EphemeraCharacterId }): Promise<void> => {
    if (characterId) {
        const sessionId = uuidv4()
        const syntheticPlayer = `chaos:${sessionId}`
        await connectionDB.transactWrite([
            {
                Put: {
                    ConnectionId: META_SESSION_PK,
                    DataCategory: sessionMetaSortKey(sessionId),
                    player: syntheticPlayer
                }
            },
            {
                Put: {
                    ConnectionId: playerSessionsPK(syntheticPlayer),
                    DataCategory: sessionMetaSortKey(sessionId)
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
        const sessionId = uuidv4()
        const syntheticPlayer = `chaos:${sessionId}`
        await connectionDB.transactWrite([
            {
                Put: {
                    ConnectionId: META_SESSION_PK,
                    DataCategory: sessionMetaSortKey(sessionId),
                    player: syntheticPlayer
                }
            },
            {
                Put: {
                    ConnectionId: playerSessionsPK(syntheticPlayer),
                    DataCategory: sessionMetaSortKey(sessionId)
                }
            }
        ])
    }
}

export default addGhostSession
