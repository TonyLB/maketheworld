import { RegisterCharacterMessage, MessageBus } from "../messageBus/baseClasses"
import messageBus from "../messageBus"
import { connectionDB, ephemeraDB, exponentialBackoffWrapper } from "@tonylb/mtw-utilities/dist/dynamoDB"

import internalCache from '../internalCache'
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { isEphemeraCharacterId, isEphemeraRoomId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import { roomCharacterListReducer } from "../internalCache/baseClasses"

export const registerCharacter = async ({ payloads }: { payloads: RegisterCharacterMessage[], messageBus: MessageBus }): Promise<void> => {

    const connectionId = await internalCache.Global.get('ConnectionId')

    if (connectionId) {
        const RequestId = await internalCache.Global.get('RequestId')
        const handleOneRegistry = async (payload: RegisterCharacterMessage): Promise<void> => {
            const { characterId: CharacterId } = payload
            if (!(isEphemeraCharacterId(CharacterId))) {
                return
            }
            await exponentialBackoffWrapper(async () => {
                const [characterFetch, currentConnections] = await Promise.all([
                    internalCache.CharacterMeta.get(CharacterId),
                    internalCache.CharacterConnections.get(CharacterId)
                ])
                if (!characterFetch) {
                    return
                }
                const { Name = '', HomeId, RoomId, fileURL, Color } = characterFetch
                const newConnections = unique(currentConnections || [], [connectionId]) as string[]
                await connectionDB.transactWrite([
                    {
                        Put: {
                            ConnectionId: `CONNECTION#${connectionId}`,
                            DataCategory: CharacterId
                        }
                    },
                    { Update: {
                        Key: {
                            ConnectionId: CharacterId,
                            DataCategory: 'Meta::Character'
                        },
                        updateKeys: ['connections'],
                        updateReducer: (draft) => {
                            draft.connections = unique(draft.connections || [], [connectionId])
                        },
                        successCallback: ({ connections }) => {
                            if (connections.length <= 1) {
                                messageBus.send({
                                    type: 'EphemeraUpdate',
                                    updates: [{
                                        type: 'CharacterInPlay',
                                        CharacterId,
                                        Name: Name || '',
                                        Connected: true,
                                        RoomId: RoomId || HomeId,
                                        fileURL: fileURL || '',
                                        Color: Color || 'grey',
                                        targets: ['GLOBAL', `CONNECTION#${connectionId}`]
                                    }]        
                                })
                                messageBus.send({
                                    type: 'PublishMessage',
                                    targets: [RoomId || HomeId, `!${CharacterId}`],
                                    displayProtocol: 'WorldMessage',
                                    message: [{
                                        tag: 'String',
                                        value: `${Name || 'Someone'} has connected.`
                                    }]
                                })
                                messageBus.send({
                                    type: 'CacheCharacterAssets',
                                    characterId: CharacterId
                                })
                                messageBus.send({
                                    type: 'RoomUpdate',
                                    roomId: RoomId || HomeId
                                })
                            }        
                        }
                    }}
                ])
                await ephemeraDB.transactWrite([
                    {
                        Update: {
                            Key: {
                                EphemeraId: RoomId || HomeId,
                                DataCategory: 'Meta::Room'
                            },
                            updateKeys: ['activeCharacters'],
                            updateReducer: (draft) => {
                                draft.activeCharacters = roomCharacterListReducer(
                                    draft.activeCharacters,
                                    {
                                        EphemeraId: CharacterId,
                                        Name,
                                        fileURL,
                                        Color,
                                        ConnectionIds: newConnections
                                    }
                                )
                            },
                            successCallback: ({ EphemeraId, activeCharacters }) => {
                                if (typeof EphemeraId !== 'undefined' && isEphemeraRoomId(EphemeraId)) {
                                    internalCache.RoomCharacterList.set({ key: EphemeraId, value: activeCharacters })
                                }
                            }
                        },
                    },
                    {
                        Update: {
                            Key: {
                                EphemeraId: CharacterId,
                                DataCategory: 'Meta::Character'
                            },
                            updateKeys: ['RoomId', 'HomeId'],
                            updateReducer: (draft) => {
                                draft.RoomId = draft.RoomId || draft.HomeId
                            }
                        }
                    }
                ])
                messageBus.send({
                    type: 'Perception',
                    characterId: CharacterId,
                    ephemeraId: RoomId || HomeId,
                    header: true
                })
    
            }, { retryErrors: ['TransactionCanceledException']})
    
        }

        await Promise.all(payloads.map(handleOneRegistry))

        if (payloads.length > 0) {
            messageBus.send({
                type: 'ReturnValue',
                body: {
                    messageType: 'Registration',
                    CharacterId: payloads[0].characterId,
                    RequestId
                }
            })
        }
    }

}

export default registerCharacter
