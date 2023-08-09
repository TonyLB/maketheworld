import { MoveCharacterMessage, MessageBus } from "../messageBus/baseClasses"
import { ephemeraDB, exponentialBackoffWrapper } from "@tonylb/mtw-utilities/dist/dynamoDB"
import internalCache from "../internalCache"
import { splitType } from "@tonylb/mtw-utilities/dist/types"
import { EphemeraCharacterId, LegalCharacterColor } from "@tonylb/mtw-interfaces/dist/baseClasses"

export type ActiveCharacterListEntry = {
    EphemeraId: EphemeraCharacterId;
    Name: string;
    fileURL?: string;
    Color?: LegalCharacterColor;
    ConnectionIds: string[];
}

export const activeListReducer = (previous: ActiveCharacterListEntry[], entry: ActiveCharacterListEntry): ActiveCharacterListEntry[] => ([
    ...previous
        .filter(({ EphemeraId }) => (EphemeraId !== entry.EphemeraId)),
    entry
])

export const moveCharacter = async ({ payloads, messageBus }: { payloads: MoveCharacterMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async (payload) => {
        //
        // TODO: Validate the RoomId as one that is valid for the character to move to, before
        // pushing data to the DB.
        //

        await exponentialBackoffWrapper(async () => {

            const [characterMeta, connections] = await Promise.all([
                internalCache.CharacterMeta.get(payload.characterId),
                internalCache.CharacterConnections.get(payload.characterId)
            ])
            if (payload.roomId === characterMeta.RoomId) {
                return
            }
            await ephemeraDB.transactWrite([
                {
                    PrimitiveUpdate: {
                        Key: {
                            EphemeraId: characterMeta.EphemeraId,
                            DataCategory: 'Meta::Character'
                        },
                        ProjectionFields: ['RoomId'],
                        UpdateExpression: 'SET RoomId = :newRoomId',
                        ExpressionAttributeValues: {
                            ':newRoomId': splitType(payload.roomId)[1]
                        }
                    }
                },
                {
                    Update: {
                        Key: {
                            EphemeraId: characterMeta.RoomId,
                            DataCategory: 'Meta::Room'
                        },
                        updateKeys: ['activeCharacters'],
                        updateReducer: (draft) => {
                            draft.activeCharacters = draft.activeCharacters.filter(({ EphemeraId }) => (EphemeraId !== characterMeta.EphemeraId))
                        },
                        successCallback: ({ activeCharacters }) => {
                            internalCache.RoomCharacterList.set({ key: characterMeta.RoomId, value: activeCharacters })
                            messageBus.send({
                                type: 'PublishMessage',
                                targets: [characterMeta.RoomId, payload.characterId],
                                displayProtocol: 'WorldMessage',
                                message: [{
                                    tag: 'String',
                                    value: `${characterMeta.Name || 'Someone'}${payload.leaveMessage || ' has left.'}`
                                }]
                            })
                            messageBus.send({
                                type: 'RoomUpdate',
                                roomId: characterMeta.RoomId
                            })
                        }
                    }
                },
                {
                    Update: {
                        Key: {
                            EphemeraId: payload.roomId,
                            DataCategory: 'Meta::Room'
                        },
                        updateKeys: ['activeCharacters'],
                        updateReducer: (draft) => {
                            draft.activeCharacters = activeListReducer(
                                draft.activeCharacters,
                                {
                                    EphemeraId: characterMeta.EphemeraId,
                                    Name: characterMeta.Name,
                                    fileURL: characterMeta.fileURL,
                                    Color: characterMeta.Color,
                                    ConnectionIds: connections || []
                                }
                            )
                        },
                        successCallback: ({ activeCharacters }) => {
                            internalCache.RoomCharacterList.set({ key: payload.roomId, value: activeCharacters })
                            messageBus.send({
                                type: 'Perception',
                                characterId: payload.characterId,
                                ephemeraId: payload.roomId,
                                header: true
                            })
                
                            messageBus.send({
                                type: 'PublishMessage',
                                targets: [payload.roomId, payload.characterId],
                                displayProtocol: 'WorldMessage',
                                message: [{
                                    tag: 'String',
                                    value: `${characterMeta.Name || 'Someone'} has arrived.`
                                }]
                            })
                            messageBus.send({
                                type: 'RoomUpdate',
                                roomId: payload.roomId
                            })
                            messageBus.send({
                                type: 'MapUpdate',
                                characterId: payload.characterId,
                                previousRoomId: characterMeta.RoomId,
                                roomId: payload.roomId
                            })
                        }
                    }
                }
            ])
    
        }, { retryErrors: ['TransactionCanceledException']})
    }))
}

export default moveCharacter
