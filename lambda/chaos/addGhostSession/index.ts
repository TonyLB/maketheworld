import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { connectionDB, ephemeraDB, META_SESSION_PK, sessionMetaSortKey, playerSessionsPK } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { v4 as uuidv4 } from 'uuid'

export const addGhostSession = async ({ characterId }: { characterId?: EphemeraCharacterId }): Promise<void> => {
    if (characterId) {
        const sessionId = uuidv4()
        const syntheticPlayer = `chaos:${sessionId}`
        const { RoomId } = (await ephemeraDB.getItem<{ RoomId: string }>({
            Key: {
                EphemeraId: characterId,
                DataCategory: 'Meta::Character'
            },
            ProjectionFields: ['RoomId']
        })) || {}
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
        if (RoomId) {
            const { Name, fileURL, Color } = (await ephemeraDB.getItem<{ Name: string; fileURL: string; Color: string }>({
                Key: {
                    EphemeraId: characterId,
                    DataCategory: 'Meta::Character'
                },
                ProjectionFields: ['Name', 'fileURL', 'Color']
            })) || {}
            await ephemeraDB.optimisticUpdate({
                Key: {
                    EphemeraId: `ROOM#${RoomId}`,
                    DataCategory: 'Meta::Room'
                },
                updateKeys: ['activeCharacters'],
                updateReducer: (draft) => {
                    const findMatch = (draft.activeCharacters || []).find(({ EphemeraId }) => (EphemeraId === characterId))
                    draft.activeCharacters = [
                        ...(draft.activeCharacters || []).filter(({ EphemeraId }) => (EphemeraId !== characterId)),
                        {
                            EphemeraId: characterId,
                            Name,
                            fileURL,
                            Color,
                            SessionIds: [...(findMatch?.sessions ?? []), sessionId]
                        }
                    ]
                }
            })
        }
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
