import { connectionDB, exponentialBackoffWrapper, ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { ebClient } from "../clients"
import { PutEventsCommand } from "@aws-sdk/client-eventbridge"

export const atomicallyRemoveCharacterAdjacency = async (sessionId: string, characterId: EphemeraCharacterId) => {
    return exponentialBackoffWrapper(async () => {
        const [{ RoomId: saveRoomId = '' } = {}] = await Promise.all([
            ephemeraDB.getItem<{ RoomId: string }>({
                Key: {
                    EphemeraId: characterId,
                    DataCategory: 'Meta::Character'
                },
                ProjectionFields: ['RoomId'],
            }),
            connectionDB.transactWrite([
                {
                    Delete: {
                        ConnectionId: `SESSION#${sessionId}`,
                        DataCategory: characterId
                    }
                },
                {
                    Update: {
                        Key: {
                            ConnectionId: characterId,
                            DataCategory: 'Meta::Character'
                        },
                        updateKeys: ['sessions'],
                        updateReducer: (draft) => {
                            draft.sessions = draft.sessions.filter((value) => (value !== sessionId))
                        },
                        deleteCondition: ({ sessions = [] }) => (sessions.length === 0),
                        deleteCallback: async () => {
                            await ebClient.send(new PutEventsCommand({
                                Entries: [{
                                    EventBusName: process.env.EVENT_BUS_NAME,
                                    Source: 'mtw.coordination',
                                    DetailType: 'Disconnect Character',
                                    Detail: JSON.stringify({ characterId })
                                }]
                            }))
                        }
                    }
                },
                {
                    Update: {
                        Key: {
                            ConnectionId: 'Map',
                            DataCategory: 'Subscriptions'
                        },
                        updateKeys: ['sessions'],
                        updateReducer: (draft) => {
                            draft.sessions = (draft.sessions ?? []).filter((value) => (value.sessionId !== sessionId))
                        }
                    }
                }
            ])
        ])
        if (saveRoomId) {
            await ephemeraDB.optimisticUpdate({
                Key: {
                    EphemeraId: `ROOM#${saveRoomId}`,
                    DataCategory: 'Meta::Room'
                },
                updateKeys: ['activeCharacters'],
                updateReducer: (draft) => {
                    const matchIndex = (draft.activeCharacters ?? [] as { EphemeraId: string }[]).findIndex(({ EphemeraId }) => (EphemeraId === characterId))
                    if (matchIndex === -1) {
                        return
                    }
                    const { SessionIds = [] } = draft.activeCharacters[matchIndex]
                    const newSessions = SessionIds.filter((checkSessionId) => (sessionId !== checkSessionId))
                    if (newSessions.length === 0) {
                        draft.activeCharacters = draft.activeCharacters.filter(({ EphemeraId }) => (EphemeraId !== characterId))
                    }
                    else {
                        draft.activeCharacters[matchIndex].SessionIds = newSessions
                    }
                }
            })    
        }
        else {
            throw new Error(`No room identified for character: ${characterId}`)
        }

    }, { retryErrors: ['TransactionCanceledException']})
}

export const unregisterCharacterMessage = async (sessionId: string, characterId: EphemeraCharacterId, RequestId: string): Promise<{ type: 'ReturnValue', body: any }> => {
    if (sessionId) {
        await atomicallyRemoveCharacterAdjacency(sessionId, characterId)
        return {
            type: 'ReturnValue',
            body: {
                messageType: 'Unregistration',
                CharacterId: characterId,
                RequestId
            }
        }
    }
    return {
        type: 'ReturnValue',
        body: {
            RequestId
        }
    }
}

export const disconnect = async (connectionId: string): Promise<void> => {
    //
    // TODO: Figure out whether a forced disconnet invalidates any cached values
    //

    const ConnectionId = `CONNECTION#${connectionId}`
    await Promise.all([
        connectionDB.deleteItem({
            ConnectionId,
            DataCategory: 'Meta::Connection'
        })
    ])
}

export default disconnect
