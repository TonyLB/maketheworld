import { MapSubscriptionMessage, MapUnsubscribeMessage, MessageBus } from "../messageBus/baseClasses"
import { connectionDB, exponentialBackoffWrapper } from "@tonylb/mtw-utilities/dist/dynamoDB"

import internalCache from '../internalCache'
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses"

export const mapSubscriptionMessage = async ({ payloads, messageBus }: { payloads: MapSubscriptionMessage[], messageBus: MessageBus }): Promise<void> => {

    const connectionId = await internalCache.Global.get('ConnectionId')
    const RequestId = await internalCache.Global.get('RequestId')

    if (connectionId) {

        let subscriptionSuccess = false
        await exponentialBackoffWrapper(async () => {

            const checkCharactersFetch = await connectionDB.getItems({
                Keys: payloads.map(({ characterId }) => ({
                    ConnectionId: `CONNECTION#${connectionId}`,
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
                        updateKeys: ['connections'],
                        updateReducer: (draft) => {
                            const connectionSubscriptionIndex = (draft.connections as { connectionId: string; characterIds: EphemeraCharacterId[] }[]).findIndex(({ connectionId: checkConnectionId }) => (checkConnectionId === connectionId))
                            if (connectionSubscriptionIndex === -1) {
                                draft.connections = [...draft.connections, { connectionId, characterIds: validCharacters }]
                            }
                            else {
                                draft.connections[connectionSubscriptionIndex].characterIds = unique(
                                    draft.connections[connectionSubscriptionIndex].characterIds,
                                    validCharacters
                                )
                            }
                        },
                        successCallback: ({ connections }) => {
                            internalCache.Global.set({ key: 'mapSubscriptions', value: connections })
                            subscriptionSuccess = true                
                        }
                    }
                },
                {
                    ConditionCheck: {
                        Key: {
                            ConnectionId: `CONNECTION#${connectionId}`,
                            DataCategory: 'Meta::Connection'
                        },
                        ProjectionFields: ['DataCategory'],
                        ConditionExpression: 'attribute_exists(DataCategory)'
                    }
                },
                ...(
                    validCharacters.map((characterId) => ({
                        ConditionCheck: {
                            Key: {
                                ConnectionId: `CONNECTION#${connectionId}`,
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

    const connectionId = await internalCache.Global.get('ConnectionId')
    const RequestId = await internalCache.Global.get('RequestId')

    await connectionDB.optimisticUpdate({
        Key: {
            ConnectionId: 'Map',
            DataCategory: 'Subscriptions'
        },
        updateKeys: ['connections'],
        updateReducer: (draft) => {
            const connectionMatch = draft.connections.find(({ connectionId: checkConnection }) => (checkConnection === connectionId))
            if (connectionMatch) {
                connectionMatch.characterIds = (connectionMatch.characterIds || []).filter((CharacterId) => (!payloads.find(({ characterId }) => (CharacterId === characterId))))
            }
            draft.connections = draft.connections.filter(({ characterIds = [] }) => (characterIds.length))
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
