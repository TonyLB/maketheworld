import { DisconnectMessage, MessageBus, UnregisterCharacterMessage } from "../messageBus/baseClasses"

import { legacyConnectionDB as connectionDB, connectionDB as newConnectionDB, exponentialBackoffWrapper, multiTableTransactWrite } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { marshall } from "@aws-sdk/util-dynamodb"
import messageBus from "../messageBus"
import internalCache from "../internalCache"
import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/dist/baseClasses"

export const atomicallyRemoveCharacterAdjacency = async (connectionId: string, characterId: EphemeraCharacterId) => {
    return exponentialBackoffWrapper(async () => {
        const [currentConnections, characterFetch] = await Promise.all([
            internalCache.CharacterConnections.get(characterId),
            internalCache.CharacterMeta.get(characterId),
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
        await newConnectionDB.transactWrite([
            {
                Delete: {
                    ConnectionId: `CONNECTION#${connectionId}`,
                    DataCategory: characterId
                }
            },
            {
                Update: {
                    Key: {
                        ConnectionId: characterId,
                        DataCategory: 'Meta::Character'
                    },
                    updateKeys: ['connections'],
                    updateReducer: (draft) => {
                        draft.connections = draft.connections.filter((value) => (value !== connectionId))
                    },
                    deleteCondition: ({ connections = [] }) => (connections.length === 0)
                }
            },
            {
                Update: {
                    Key: {
                        ConnectionId: 'Map',
                        DataCategory: 'Subscriptions'
                    },
                    updateKeys: ['connections'],
                    updateReducer: (draft) => {
                        draft.connections = draft.connections.filter((value) => (value !== connectionId))
                    }
                }
            }
        ])
        await multiTableTransactWrite([
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
            }
        ])
        if (remainingConnections.length === 0) {
            messageBus.send({
                type: 'EphemeraUpdate',
                updates: [{
                    type: 'CharacterInPlay',
                    CharacterId: characterId,
                    Connected: false,
                    targets: ['GLOBAL', `!CONNECTION#${connectionId}`]
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

export const unregisterCharacterMessage = async ({ payloads }: { payloads: UnregisterCharacterMessage[], messageBus?: MessageBus }): Promise<void> => {
    const connectionId = await internalCache.Global.get("ConnectionId")
    const RequestId = await internalCache.Global.get("RequestId")
    if (connectionId) {
        await Promise.all(
            payloads.map(async ({ characterId }) => {
                await atomicallyRemoveCharacterAdjacency(connectionId, characterId)
                messageBus.send({
                    type: 'ReturnValue',
                    body: {
                        messageType: 'Unregistration',
                        CharacterId: characterId,
                        RequestId
                    }
                })
            })
        )
    }

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
