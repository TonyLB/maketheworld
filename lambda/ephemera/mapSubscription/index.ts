import { MapSubscriptionMessage, MapUnsubscribeMessage, MessageBus } from "../messageBus/baseClasses"
import { connectionDB, exponentialBackoffWrapper } from "@tonylb/mtw-utilities/dist/dynamoDB"

import internalCache from '../internalCache'
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses"

export const mapSubscriptionMessage = async ({ payloads, messageBus }: { payloads: MapSubscriptionMessage[], messageBus: MessageBus }): Promise<void> => {

    const [RequestId, sessionId] = await Promise.all([
        internalCache.Global.get('RequestId'),
        internalCache.Global.get('SessionId')
    ])

    if (sessionId) {

        let subscriptionSuccess = false
        await exponentialBackoffWrapper(async () => {

            const checkCharactersFetch = await connectionDB.getItems({
                Keys: payloads.map(({ characterId }) => ({
                    ConnectionId: `SESSION#${sessionId}`,
                    DataCategory: characterId
                })),
                ProjectionFields: ['DataCategory']
            })
            const checkCharacters = checkCharactersFetch
                .filter((value): value is { DataCategory: EphemeraCharacterId } => (typeof value !== 'undefined'))
                .map(({ DataCategory }) => (DataCategory))
            const validCharacters = payloads
                .map(({ characterId }) => (characterId))
                .filter((characterId) => (checkCharacters.includes(characterId)))
            await connectionDB.transactWrite([
                {
                    Update: {
                        Key: {
                            ConnectionId: 'Map',
                            DataCategory: 'Subscriptions'
                        },
                        updateKeys: ['sessions'],
                        updateReducer: (draft) => {
                            const sessionSubscriptionIndex = (draft.sessions as { sessionId: string; characterIds: EphemeraCharacterId[] }[]).findIndex(({ sessionId: checkSessionId }) => (checkSessionId === sessionId))
                            if (sessionSubscriptionIndex === -1) {
                                draft.sessions = [...draft.sessions, { sessionId, characterIds: validCharacters }]
                            }
                            else {
                                draft.sessions[sessionSubscriptionIndex].characterIds = unique(
                                    draft.sessions[sessionSubscriptionIndex].characterIds,
                                    validCharacters
                                )
                            }
                        },
                        successCallback: ({ sessions }) => {
                            internalCache.Global.set({ key: 'mapSubscriptions', value: sessions })
                            subscriptionSuccess = true                
                        }
                    }
                },
                {
                    ConditionCheck: {
                        Key: {
                            ConnectionId: `SESSION#${sessionId}`,
                            DataCategory: 'Meta::Session'
                        },
                        ProjectionFields: ['DataCategory'],
                        ConditionExpression: 'attribute_exists(DataCategory)'
                    }
                },
                ...(
                    validCharacters.map((characterId) => ({
                        ConditionCheck: {
                            Key: {
                                ConnectionId: `SESSION#${sessionId}`,
                                DataCategory: characterId
                            },
                            ProjectionFields: ['DataCategory'],
                            ConditionExpression: 'attribute_exists(DataCategory)'
                        }
                    }))
                )
            ])
        }, {
            retryErrors: ['TransactionCanceledException'],
        })

        if (subscriptionSuccess) {
            const possibleMaps = await Promise.all(
                payloads.map((payload) => (internalCache.CharacterPossibleMaps.get(payload.characterId)))
            )
    
            await Promise.all(
                possibleMaps.map(({ EphemeraId, mapsPossible }) => (
                    Promise.all(
                        mapsPossible.map(async (MapId) => {
                            const { RoomId } = await internalCache.CharacterMeta.get(EphemeraId)
                            messageBus.send({
                                type: 'Perception',
                                characterId: EphemeraId,
                                ephemeraId: MapId,
                                mustIncludeRoomId: RoomId
                            })
                        })
                    )
                ))
            )
            messageBus.send({
                type: 'ReturnValue',
                body: {
                    messageType: 'SubscribeToMaps',
                    RequestId
                }
            })
        }
        else {
            messageBus.send({
                type: 'ReturnValue',
                body: {
                    messageType: 'Error',
                    message: 'Map Subscription Failed',
                    RequestId
                }
            })
        }

    }
    else {
        messageBus.send({
            type: 'ReturnValue',
            body: {
                messageType: 'Error',
                message: 'Map Subscription Failed',
                RequestId
            }
        })
    }

}

export const mapUnsubscribeMessage = async ({ payloads, messageBus }: { payloads: MapUnsubscribeMessage[], messageBus: MessageBus }): Promise<void> => {

    const sessionId = await internalCache.Global.get('SessionId')
    const RequestId = await internalCache.Global.get('RequestId')

    await connectionDB.optimisticUpdate({
        Key: {
            ConnectionId: 'Map',
            DataCategory: 'Subscriptions'
        },
        updateKeys: ['sessions'],
        updateReducer: (draft) => {
            const sessionMatch = draft.sessions.find(({ sessionId: checkSession }) => (checkSession === sessionId))
            if (sessionMatch) {
                sessionMatch.characterIds = (sessionMatch.characterIds || []).filter((CharacterId) => (!payloads.find(({ characterId }) => (CharacterId === characterId))))
            }
            draft.sessions = draft.sessions.filter(({ characterIds = [] }) => (characterIds.length))
        },
    })
    messageBus.send({
        type: 'ReturnValue',
        body: {
            messageType: 'UnsubscribeFromMaps',
            RequestId
        }
    })

}

export default mapSubscriptionMessage
