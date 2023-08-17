import { MoveCharacterMessage, MessageBus } from "../messageBus/baseClasses"
import { ephemeraDB, exponentialBackoffWrapper } from "@tonylb/mtw-utilities/dist/dynamoDB"
import internalCache from "../internalCache"
import { splitType } from "@tonylb/mtw-utilities/dist/types"
import { roomCharacterListReducer } from "../internalCache/baseClasses"

export type RoomStackItem = {
    asset: string;
    RoomId: string;
}

export const moveCharacter = async ({ payloads, messageBus }: { payloads: MoveCharacterMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async (payload) => {
        //
        // TODO: Validate the RoomId as one that is valid for the character to move to, before
        // pushing data to the DB.
        //

        await exponentialBackoffWrapper(async () => {

            const [characterMeta, connections, roomAssets = [], canonAssets = []] = await Promise.all([
                internalCache.CharacterMeta.get(payload.characterId),
                internalCache.CharacterConnections.get(payload.characterId),
                internalCache.RoomAssets.get(payload.roomId),
                internalCache.Global.get('assets')
            ])
            if (payload.roomId === characterMeta.RoomId) {
                return
            }
            const orderIndexByAsset = Object.assign({}, ...([...canonAssets, ...characterMeta.assets || []].map((asset, index) => ({ [asset]: index })))) as Record<string, number>
            const { targetAsset, minIndex: targetAssetListIndex } = roomAssets.reduce<{ targetAsset?: string, minIndex?: number }>((previous, asset) => {
                const assetIndex = orderIndexByAsset[asset]
                if (typeof assetIndex !== 'undefined') {
                    if (typeof previous.minIndex === 'undefined' || previous.minIndex > assetIndex) {
                        return {
                            targetAsset: asset,
                            minIndex: assetIndex
                        }
                    }
                }
                return previous
            }, {})

            await ephemeraDB.transactWrite([
                {
                    Update: {
                        Key: {
                            EphemeraId: characterMeta.EphemeraId,
                            DataCategory: 'Meta::Character'
                        },
                        updateKeys: ['RoomId', 'RoomStack'],
                        updateReducer: (draft) => {
                            draft.RoomId = splitType(payload.roomId)[1]
                            if (!(typeof targetAssetListIndex === 'undefined')) {
                                const indexOfFirstReplacement = (draft.RoomStack as RoomStackItem[]).findIndex(({ asset: stackAsset }) => (!(stackAsset in orderIndexByAsset && orderIndexByAsset[stackAsset] < targetAssetListIndex)))
                                draft.RoomStack = [
                                    ...(indexOfFirstReplacement === -1 ? draft.RoomStack : draft.RoomStack.slice(0, indexOfFirstReplacement)),
                                    {
                                        asset: targetAsset,
                                        RoomId: draft.RoomId
                                    }
                                ]
                            }
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
                            draft.activeCharacters = roomCharacterListReducer(
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
