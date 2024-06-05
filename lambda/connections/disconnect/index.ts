// import { DisconnectMessage, MessageBus, UnregisterCharacterMessage } from "../messageBus/baseClasses"

import { connectionDB, exponentialBackoffWrapper, ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
// import messageBus from "../messageBus"
// import internalCache from "../internalCache"
import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { ebClient } from "../clients"
import { PutEventsCommand } from "@aws-sdk/client-eventbridge"

export const atomicallyRemoveCharacterAdjacency = async (connectionId: string, characterId: EphemeraCharacterId) => {
    return exponentialBackoffWrapper(async () => {
        let saveRoomId = ''
        await connectionDB.transactWrite([
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
                    updateKeys: ['connections', 'RoomId'],
                    updateReducer: (draft) => {
                        draft.connections = draft.connections.filter((value) => (value !== connectionId))
                    },
                    deleteCondition: ({ connections = [] }) => (connections.length === 0),
                    successCallback: async ({ connections, RoomId }) => {
                        saveRoomId = RoomId ?? ''
                        if (connections.length === 0) {
                            await ebClient.send(new PutEventsCommand({
                                Entries: [{
                                    EventBusName: process.env.EVENT_BUS_NAME,
                                    Source: 'mtw.coordination',
                                    DetailType: 'Disconnect Character',
                                    Detail: JSON.stringify({ characterId })
                                }]
                            }))
                            // messageBus.send({
                            //     type: 'EphemeraUpdate',
                            //     updates: [{
                            //         type: 'CharacterInPlay',
                            //         CharacterId: characterId,
                            //         Connected: false,
                            //         connectionTargets: ['GLOBAL', `!CONNECTION#${connectionId}`]
                            //     }]
                            // })
                            // messageBus.send({
                            //     type: 'PublishMessage',
                            //     targets: [RoomId, `!${characterId}`],
                            //     displayProtocol: 'WorldMessage',
                            //     message: [{
                            //         tag: 'String',
                            //         value: `${Name || 'Someone'} has disconnected.`
                            //     }]
                            // })
                            // messageBus.send({
                            //     type: 'RoomUpdate',
                            //     roomId: RoomId
                            // })
                        }
                    }
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
                        draft.connections = draft.connections.filter((value) => (value.connectionId !== connectionId))
                    }
                }
            }
        ])
        await ephemeraDB.optimisticUpdate({
            Key: {
                EphemeraId: saveRoomId,
                DataCategory: 'Meta::Room'
            },
            updateKeys: ['activeCharacters'],
            updateReducer: (draft) => {
                const matchIndex = (draft.activeCharacters as { EphemeraId: string }[]).findIndex(({ EphemeraId }) => (EphemeraId === characterId))
                if (matchIndex === -1) {
                    return
                }
                const { ConnectionIds = [] } = draft.activeCharacters[matchIndex]
                const newConnections = ConnectionIds.filter((checkConnectionId) => (connectionId !== checkConnectionId))
                if (newConnections.length === 0) {
                    draft.activeCharacters = draft.activeCharacters.filter(({ EphemeraId }) => (EphemeraId !== characterId))
                }
                else {
                    draft.activeCharacters[matchIndex].ConnectionIds = newConnections
                }
            }
        })

    }, { retryErrors: ['TransactionCanceledException']})
}

export const unregisterCharacterMessage = async (connectionId: string, characterId: EphemeraCharacterId, RequestId: string): Promise<{ type: 'ReturnValue', body: any }> => {
    if (connectionId) {
        await atomicallyRemoveCharacterAdjacency(connectionId, characterId)
        return {
            type: 'ReturnValue',
            body: {
                messageType: 'Unregistration',
                CharacterId: characterId,
                RequestId
            }
        }
    }
    return {
        type: 'ReturnValue',
        body: {
            RequestId
        }
    }
}

export const disconnectMessage = async (connectionId: string): Promise<void> => {
    //
    // TODO: Figure out whether a forced disconnet invalidates any cached values
    //

    const ConnectionId = `CONNECTION#${connectionId}`
    const [characterQuery] = await Promise.all([
        connectionDB.query<{ ConnectionId: string; DataCategory: EphemeraCharacterId }>({
            Key: { ConnectionId },
            ExpressionAttributeValues: {
                ':dcPrefix': 'CHARACTER#'
            },
            KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
            ProjectionFields: ['DataCategory']
        })
    ])
    await Promise.all([
        ...characterQuery.map(({ DataCategory }) => (atomicallyRemoveCharacterAdjacency(connectionId, DataCategory))),
        connectionDB.deleteItem({
            ConnectionId,
            DataCategory: 'Meta::Connection'
        }),
        connectionDB.optimisticUpdate({
            Key: {
                ConnectionId: 'Global',
                DataCategory: 'Connections'
            },
            updateKeys: ['connections'],
            updateReducer: (draft) => {
                draft.connections[connectionId] = undefined
            }
        })
    ])
}

export default disconnectMessage
