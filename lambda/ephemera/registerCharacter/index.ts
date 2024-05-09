import { RegisterCharacterMessage, MessageBus } from "../messageBus/baseClasses"
import messageBus from "../messageBus"
import { connectionDB, exponentialBackoffWrapper } from "@tonylb/mtw-utilities/dist/dynamoDB"

import internalCache from '../internalCache'
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { isEphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses"

export const registerCharacter = async ({ payloads }: { payloads: RegisterCharacterMessage[], messageBus: MessageBus }): Promise<void> => {

    const [connectionId, sessionId] = await Promise.all([internalCache.Global.get('ConnectionId'), internalCache.Global.get('SessionId')])

    if (connectionId) {
        const RequestId = await internalCache.Global.get('RequestId')
        const handleOneRegistry = async (payload: RegisterCharacterMessage): Promise<void> => {
            const { characterId: CharacterId } = payload
            if (!(isEphemeraCharacterId(CharacterId) && connectionId)) {
                return
            }
            await exponentialBackoffWrapper(async () => {
                const [characterFetch] = await Promise.all([
                    internalCache.CharacterMeta.get(CharacterId),
                ])
                if (!characterFetch) {
                    return
                }
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
                        updateKeys: ['connections', 'sessions'],
                        updateReducer: (draft) => {
                            draft.sessions = unique(draft.sessions || [], [sessionId])
                            draft.connections = unique(draft.connections || [], [connectionId])
                        },
                        successCallback: ({ connections, sessions }) => {
                            internalCache.CharacterSessions.set(CharacterId, sessions)
                            if (sessions.length <= 1) {
                                messageBus.send({
                                    type: 'CheckLocation',
                                    characterId: CharacterId,
                                    forceMove: true,
                                    arriveMessage: ' has connected.'
                                })
                                //
                                // TODO: Create a path to checking character assets are cached as part of first registry
                                // of a character as being in-play
                                //

                                // messageBus.send({
                                //     type: 'CacheCharacterAssets',
                                //     characterId: CharacterId
                                // })
                                messageBus.send({
                                    type: 'EphemeraUpdate',
                                    updates: [{
                                        type: 'CharacterInPlay',
                                        CharacterId,
                                        Connected: true,
                                        connectionTargets: ['GLOBAL', `CONNECTION#${connectionId}`]
                                    }]
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
