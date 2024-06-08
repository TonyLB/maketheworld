// import { DisconnectMessage, MessageBus, UnregisterCharacterMessage } from "../messageBus/baseClasses"

import { connectionDB, exponentialBackoffWrapper, ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
// import messageBus from "../messageBus"
// import internalCache from "../internalCache"
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
                        succeedAll: true,
                        successCallback: async ({ sessions }) => {
                            if (sessions.length === 0) {
                                await ebClient.send(new PutEventsCommand({
                                    Entries: [{
                                        EventBusName: process.env.EVENT_BUS_NAME,
                                        Source: 'mtw.coordination',
                                        DetailType: 'Disconnect Character',
                                        Detail: JSON.stringify({ characterId })
                                    }]
                                }))
                                // messageBus.send({
                                //     type: 'EphemeraUpdate',
                                //     updates: [{
                                //         type: 'CharacterInPlay',
                                //         CharacterId: characterId,
                                //         Connected: false,
                                //         connectionTargets: ['GLOBAL', `!CONNECTION#${connectionId}`]
                                //     }]
                                // })
                                // messageBus.send({
                                //     type: 'PublishMessage',
                                //     targets: [RoomId, `!${characterId}`],
                                //     displayProtocol: 'WorldMessage',
                                //     message: [{
                                //         tag: 'String',
                                //         value: `${Name || 'Someone'} has disconnected.`
                                //     }]
                                // })
                                // messageBus.send({
                                //     type: 'RoomUpdate',
                                //     roomId: RoomId
                                // })
                            }
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
        }),
        connectionDB.optimisticUpdate({
            Key: {
                ConnectionId: 'Global',
                DataCategory: 'Sessions'
            },
            updateKeys: ['connections'],
            updateReducer: (draft) => {
                draft.connections[connectionId] = undefined
            }
        })
    ])
}

export default disconnect
