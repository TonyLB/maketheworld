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
        const [connectionFetch, characterFetch] = await Promise.all([
            connectionDB.getItem<{ connections: string[] }>({
                ConnectionId: `CHARACTER#${characterId}`,
                DataCategory: 'Meta::Character',
                ProjectionFields: ['connections']
            }),
            internalCache.get({
                category: 'CharacterMeta',
                key: characterId
            })
        ])
        const { connections: currentConnections } = connectionFetch || {}
        if (!currentConnections) {
            return
        }
        const { RoomId, Name, fileURL, Color } = characterFetch || {}

        const currentActiveCharacters = await internalCache.get({
            category: 'RoomCharacterList',
            key: characterId
        })

        const remainingConnections = currentConnections.filter((value) => (value !== connectionId))

        const remainingCharacters = (currentActiveCharacters || []).filter(({ EphemeraId }) => (EphemeraId !== `CHARACTER#${characterId}`))
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
        await multiTableTransactWrite([{
            Delete: {
                TableName: 'Connections',
                Key: marshall({
                    ConnectionId: `CONNECTION#${connectionId}`,
                    DataCategory: `CHARACTER#${characterId}`
                })
            }
        },
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
        }
        //
        // TODO: As part of ISS1476 add set to RoomCharacterList cache, and use here to update cache
        //

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
            ...characterQuery.map(async ({ DataCategory }) => (atomicallyRemoveCharacterAdjacency(payload.connectionId, splitType(DataCategory)[1]))),
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
