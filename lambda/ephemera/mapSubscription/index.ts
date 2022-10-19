import { MapSubscriptionMessage, MessageBus } from "../messageBus/baseClasses"
import { connectionDB, exponentialBackoffWrapper, multiTableTransactWrite } from "@tonylb/mtw-utilities/dist/dynamoDB"

import internalCache from '../internalCache'
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import { marshall } from "@aws-sdk/util-dynamodb"

export const mapSubscriptionMessage = async ({ payloads, messageBus }: { payloads: MapSubscriptionMessage[], messageBus: MessageBus }): Promise<void> => {

    const connectionId = await internalCache.Global.get('ConnectionId')
    const RequestId = await internalCache.Global.get('RequestId')

    if (connectionId) {

        let subscriptionSuccess = false
        await exponentialBackoffWrapper(async () => {

            const [checkCharactersFetch, checkSubscriptions] = await Promise.all([
                Promise.all(
                    payloads.map(({ characterId }) => (
                        connectionDB.getItem<{ DataCategory: EphemeraCharacterId }>({
                            ConnectionId: `CONNECTION#${connectionId}`,
                            DataCategory: characterId,
                            ProjectionFields: ['DataCategory']
                        })
                    ))
                ),
                internalCache.Global.get('mapSubscriptions')
            ])
            const checkCharacters = checkCharactersFetch
                .filter((value): value is { DataCategory: EphemeraCharacterId } => (typeof value !== 'undefined'))
                .map(({ DataCategory }) => (DataCategory))
            const validCharacters = payloads
                .map(({ characterId }) => (characterId))
                .filter((characterId) => (checkCharacters.includes(characterId)))
            const newConnections = (checkSubscriptions || []).find(({ connectionId: check }) => (check === connectionId))
                ? (checkSubscriptions || []).map((subscriptions) => (subscriptions.connectionId === connectionId ? unique(subscriptions, validCharacters) : subscriptions))
                : [
                    ...(checkSubscriptions || []),
                    {
                        connectionId, characterIds: validCharacters
                    }
                ]
            if (newConnections.length) {
                await multiTableTransactWrite([
                    {
                        Update: {
                            TableName: 'Connections',
                            Key: marshall({
                                ConnectionId: 'Map',
                                DataCategory: 'Subscriptions'
                            }),
                            UpdateExpression: 'SET connections = :newConnections',
                            ExpressionAttributeValues: marshall({
                                ':newConnections': newConnections,
                                ...((typeof checkSubscriptions === 'undefined')
                                    ? {}
                                    : { ':oldConnections': checkSubscriptions }
                                )
                            }),
                            ConditionExpression: (typeof checkSubscriptions === 'undefined')
                                ? 'attribute_not_exists(connections)'
                                : 'connections = :oldConnections'
                        }
                    },
                    {
                        ConditionCheck: {
                            TableName: 'Connections',
                            Key: marshall({
                                ConnectionId: `CONNECTION#${connectionId}`,
                                DataCategory: 'Meta::Connection'
                            }),
                            ConditionExpression: 'attribute_exists(DataCategory)'
                        }
                    },
                    ...payloads.map(({ characterId }) => ({
                        ConditionCheck: {
                            TableName: 'Connections',
                            Key: marshall({
                                ConnectionId: `CONNECTION#${connectionId}`,
                                DataCategory: characterId
                            }),
                            ConditionExpression: 'attribute_exists(DataCategory)'
                        }
                    }))
                ])
                subscriptionSuccess = true    
            }
        }, {
            retryErrors: ['TransactionCanceledException'],
            retryCallback: async () => {
                internalCache.Global.invalidate('mapSubscriptions')
            }
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

    }

    messageBus.send({
        type: 'ReturnValue',
        body: {
            messageType: 'Error',
            message: 'Map Subscription Failed',
            RequestId
        }
    })

}

export default mapSubscriptionMessage
