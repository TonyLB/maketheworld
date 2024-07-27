import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { connectionDB, ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { v4 as uuidv4 } from 'uuid'

export const addGhostSession = async ({ characterId }: { characterId?: EphemeraCharacterId }): Promise<void> => {
    if (characterId) {
        const sessionId = uuidv4()
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
        connectionDB.putItem({
            ConnectionId: `SESSION#${uuidv4()}`,
            DataCategory: 'Meta::Session'
        })
    }
}

export default addGhostSession
