import { DisconnectMessage, MessageBus } from "../messageBus/baseClasses"

import { connectionDB, ephemeraDB, exponentialBackoffWrapper, multiTableTransactWrite } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { marshall } from "@aws-sdk/util-dynamodb"
import { splitType } from "@tonylb/mtw-utilities/dist/types"
import messageBus from "../messageBus"
import internalCache from "../internalCache"
import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/dist/baseClasses"

const atomicallyRemoveCharacterAdjacency = async (connectionId: string, characterId: EphemeraCharacterId) => {
    return exponentialBackoffWrapper(async () => {
        const [currentConnections, characterFetch, mapSubscriptions] = await Promise.all([
            internalCache.CharacterConnections.get(characterId),
            internalCache.CharacterMeta.get(characterId),
            internalCache.Global.get("mapSubscriptions")
        ])
        if (!(currentConnections && currentConnections.length)) {
            return
        }
        const { RoomId, Name } = characterFetch || {}
        const { Pronouns, assets, ...rest } = characterFetch || {}

        const currentActiveCharacters = await internalCache.RoomCharacterList.get(RoomId)

        const remainingConnections = currentConnections.filter((value) => (value !== connectionId))

        const remainingCharacters = [
            ...(currentActiveCharacters || []).filter(({ EphemeraId }) => (EphemeraId !== characterId)),
            ...((remainingConnections.length > 0)
                ? [{
                    ...rest,
                    ConnectionIds: remainingConnections
                }]
                : []
            )
        ]
        const adjustMeta = remainingConnections.length > 0
            ? [{
                Update: {
                    TableName: 'Connections',
                    Key: marshall({
                        ConnectionId: characterId,
                        DataCategory: 'Meta::Character'
                    }),
                    UpdateExpression: 'SET connections = :newConnections',
                    ExpressionAttributeValues: marshall({
                        ':newConnections': remainingConnections,
                        ':oldConnections': currentConnections
                    }),
                    ConditionExpression: 'connections = :oldConnections'
                }
            }]
            : [{
                Delete: {
                    TableName: 'Connections',
                    Key: marshall({
                        ConnectionId: characterId,
                        DataCategory: 'Meta::Character'
                    }),
                }
            }]
        const adjustMapSubscriptions = (mapSubscriptions || []).find(({ connectionId: check }) => (check === connectionId))
            ? [{
                Update: {
                    TableName: 'Connections',
                    Key: marshall({
                        ConnectionId: 'Map',
                        DataCategory: 'Subscriptions'
                    }),
                    UpdateExpression: 'SET connections = :newConnections',
                    ExpressionAttributeValues: marshall({
                        ':newConnections': (mapSubscriptions || []).filter(({ connectionId: check }) => (check !== connectionId)),
                        ':oldConnections': mapSubscriptions
                    }),
                    ConditionExpression: 'connections = :oldConnections'
                }
            }]
            : []
        await multiTableTransactWrite([{
            Delete: {
                TableName: 'Connections',
                Key: marshall({
                    ConnectionId: `CONNECTION#${connectionId}`,
                    DataCategory: characterId
                })
            }
        },
        ...adjustMapSubscriptions,
        ...adjustMeta,
        {
            Update: {
                TableName: 'Ephemera',
                Key: marshall({
                    EphemeraId: RoomId,
                    DataCategory: 'Meta::Room'
                }),
                UpdateExpression: 'SET activeCharacters = :newCharacters',
                ExpressionAttributeValues: marshall({
                    ':newCharacters': remainingCharacters,
                    ':oldCharacters': currentActiveCharacters
                }),
                ConditionExpression: 'activeCharacters = :oldCharacters'
            }
        }])
        if (remainingConnections.length === 0) {
            messageBus.send({
                type: 'EphemeraUpdate',
                global: true,
                updates: [{
                    type: 'CharacterInPlay',
                    CharacterId: characterId,
                    Connected: false,
                    targets: []
                }]
            })
            messageBus.send({
                type: 'PublishMessage',
                targets: [RoomId, `!${characterId}`],
                displayProtocol: 'WorldMessage',
                message: [{
                    tag: 'String',
                    value: `${Name || 'Someone'} has disconnected.`
                }]
            })
            messageBus.send({
                type: 'RoomUpdate',
                roomId: RoomId
            })
        }
        internalCache.RoomCharacterList.set({
            key: RoomId,
            value: remainingCharacters
        })

    }, { retryErrors: ['TransactionCanceledException']})
}

export const disconnectMessage = async ({ payloads }: { payloads: DisconnectMessage[], messageBus?: MessageBus }): Promise<void> => {
    //
    // TODO: Figure out whether a forced disconnet invalidates any cached values
    //

    await Promise.all(payloads.map(async (payload) => {
        const ConnectionId = `CONNECTION#${payload.connectionId}`
        const characterQuery = await connectionDB.query<{ DataCategory: EphemeraCharacterId }[]>({
            ConnectionId,
            ExpressionAttributeValues: {
                ':dcPrefix': 'CHARACTER#'
            },
            KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
            ProjectionFields: ['DataCategory']
        })
        await Promise.all([
            ...characterQuery.map(({ DataCategory }) => (atomicallyRemoveCharacterAdjacency(payload.connectionId, DataCategory))),
            connectionDB.deleteItem({
                ConnectionId,
                DataCategory: 'Meta::Connection'
            }),
            connectionDB.optimisticUpdate({
                key: {
                    ConnectionId: 'Global',
                    DataCategory: 'Connections'
                },
                updateKeys: ['connections'],
                updateReducer: (draft) => {
                    draft.connections[payload.connectionId] = undefined
                }
            }),
            connectionDB.optimisticUpdate({
                key: {
                    ConnectionId: 'Library',
                    DataCategory: 'Subscriptions'
                },
                updateKeys: ['ConnectionIds'],
                updateReducer: (draft) => {
                    draft.ConnectionIds = draft.ConnectionIds.filter((value) => (value !== payload.connectionId))
                }
            })
        ])
    }))
}

export default disconnectMessage
