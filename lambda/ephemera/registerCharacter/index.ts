import { RegisterCharacterMessage, MessageBus } from "../messageBus/baseClasses"
import messageBus from "../messageBus"
import { connectionDB, exponentialBackoffWrapper } from "@tonylb/mtw-utilities/dist/dynamoDB"

import internalCache from '../internalCache'
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { isEphemeraCharacterId } from "@tonylb/mtw-interfaces/dist/baseClasses"

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
                const [characterFetch] = await Promise.all([
                    internalCache.CharacterMeta.get(CharacterId),
                ])
                if (!characterFetch) {
                    return
                }
                const { HomeId, RoomId } = characterFetch
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
                            internalCache.CharacterConnections.set(CharacterId, connections)
                            if (connections.length <= 1) {
                                messageBus.send({
                                    type: 'MoveCharacter',
                                    characterId: CharacterId,
                                    roomId: RoomId || HomeId,
                                    suppressSelfMessage: true,
                                    arriveMessage: ' has connected.'
                                })
                                messageBus.send({
                                    type: 'CacheCharacterAssets',
                                    characterId: CharacterId
                                })
                            }        
                        }
                    }}
                ])
    
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
