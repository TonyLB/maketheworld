import { DisconnectMessage, MessageBus } from "../messageBus/baseClasses"

import { connectionDB, ephemeraDB, exponentialBackoffWrapper, multiTableTransactWrite } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { marshall } from "@aws-sdk/util-dynamodb"
import { splitType } from "@tonylb/mtw-utilities/dist/types"
import messageBus from "../messageBus"
import internalCache from "../internalCache"

type RoomCharacterActive = {
    EphemeraId: string;
    Color?: string;
    ConnectionIds: string[];
    fileURL?: string;
    Name: string;
}

const atomicallyRemoveCharacterAdjacency = async (connectionId, characterId) => {
    return exponentialBackoffWrapper(async () => {
        const [currentConnections, characterFetch, mapSubscriptions] = await Promise.all([
            internalCache.CharacterConnections.get(characterId),
            internalCache.CharacterMeta.get(`CHARACTER#${characterId}`),
            internalCache.Global.get("mapSubscriptions")
        ])
        if (!(currentConnections && currentConnections.length)) {
            return
        }
        const { RoomId, Name, fileURL, Color, EphemeraId } = characterFetch || {}
        const { Pronouns, assets, ...rest } = characterFetch || {}

        const currentActiveCharacters = await internalCache.RoomCharacterList.get(RoomId)

        const remainingConnections = currentConnections.filter((value) => (value !== connectionId))

        const remainingCharacters = [
            ...(currentActiveCharacters || []).filter(({ EphemeraId }) => (EphemeraId !== `CHARACTER#${characterId}`)),
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
                        ConnectionId: `CHARACTER#${characterId}`,
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
                        ConnectionId: `CHARACTER#${characterId}`,
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
                    DataCategory: `CHARACTER#${characterId}`
                })
            }
        },
        ...adjustMapSubscriptions,
        ...adjustMeta,
        {
            Update: {
                TableName: 'Ephemera',
                Key: marshall({
                    EphemeraId: `ROOM#${RoomId}`,
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
                    Name: Name || '',
                    Connected: false,
                    RoomId: RoomId || '',
                    fileURL: fileURL || '',
                    Color: Color || 'grey'
                }]
            })
            messageBus.send({
                type: 'PublishMessage',
                targets: [{ roomId: RoomId }, { excludeCharacterId: characterId }],
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
        const characterQuery = await connectionDB.query({
            ConnectionId,
            ExpressionAttributeValues: {
                ':dcPrefix': 'CHARACTER#'
            },
            KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
            ProjectionFields: ['DataCategory']
        })
        await Promise.all([
            ...characterQuery.map(({ DataCategory }) => (atomicallyRemoveCharacterAdjacency(payload.connectionId, splitType(DataCategory)[1]))),
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
