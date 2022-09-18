import { DisconnectMessage, MessageBus } from "../messageBus/baseClasses"

import { connectionDB, ephemeraDB, exponentialBackoffWrapper, multiTableTransactWrite } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { forceDisconnect } from '@tonylb/mtw-utilities/dist/apiManagement/forceDisconnect'
import { marshall } from "@aws-sdk/util-dynamodb"

//
// TODO:
//    - Remove Meta::Connection record
//    - Update Library subscriptions
//    - Update Global connections
//    - Remove all Character adjacency records using transactions to atomically update Meta::Character item
//    - Update activeCharacters in current room for Meta::Character items that were removed
//

type RoomCharacterActive = {
    EphemeraId: string;
    Color?: string;
    ConnectionIds: string[];
    fileURL?: string;
    Name: string;
}

const atomicallyRemoveCharacterAdjacency = async (connectionId, characterId) => {
    return exponentialBackoffWrapper(async () => {
        const { connections: currentConnections } = (await connectionDB.getItem<{ connections: string[] }>({
            ConnectionId: `CONNECTION#${connectionId}`,
            DataCategory: `CHARACTER#${characterId}`,
            ProjectionFields: ['connections']
        })) || {}
        if (!currentConnections) {
            return
        }

        const remainingConnections = currentConnections.filter((value) => (value !== connectionId))

        //
        // TODO: Refactor below so that it _always_ updates the current room for the character ... updating
        // the ConnectionIds array if there are remaining connections, otherwise removing the entry for
        // the character
        //

        if (remainingConnections.length > 0) {
            await multiTableTransactWrite([{
                    Delete: {
                        TableName: 'Connections',
                        Key: marshall({
                            ConnectionId: `CONNECTION#${connectionId}`,
                            DataCategory: `CHARACTER#${characterId}`
                        })
                    }
                },
                {
                    Update: {
                        TableName: 'Connections',
                        Key: marshall({
                            ConnectionId: `CONNECTION#${connectionId}`,
                            DataCategory: `CHARACTER#${characterId}`
                        }),
                        UpdateExpression: 'SET connections = :newConnections',
                        ExpressionAttributeValues: marshall({
                            ':newConnections': remainingConnections,
                            ':oldConnections': currentConnections
                        }),
                        ConditionExpression: 'connections = :oldConnections'
                    }
                }])
        }
        else {

            const { RoomId: currentRoomId } = (await ephemeraDB.getItem<{ RoomId: string }>({
                EphemeraId: `CHARACTER#${characterId}`,
                DataCategory: 'Meta::Character',
                ProjectionFields: ['RoomId']
            })) || {}
            const { activeCharacters: currentActiveCharacters = [] } = (await ephemeraDB.getItem<{ activeCharacters: RoomCharacterActive[] }>({
                EphemeraId: `ROOM#${currentRoomId}`,
                DataCategory: 'Meta::Room',
                ProjectionFields: ['activeCharacters']
            })) || {}

            const remainingCharacters = currentActiveCharacters.filter(({ EphemeraId }) => (EphemeraId !== `CHARACTER#${characterId}`))
            await multiTableTransactWrite([{
                Delete: {
                    TableName: 'Connections',
                    Key: marshall({
                        ConnectionId: `CONNECTION#${connectionId}`,
                        DataCategory: `CHARACTER#${characterId}`
                    })
                }
            },
            {
                Delete: {
                    TableName: 'Connections',
                    Key: marshall({
                        ConnectionId: `CONNECTION#${connectionId}`,
                        DataCategory: `CHARACTER#${characterId}`
                    }),
                }
            },
            {
                Update: {
                    TableName: 'Ephemera',
                    Key: marshall({
                        EphemeraId: `ROOM#${currentRoomId}`,
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

        }

    }, { retryErrors: ['ConditionalCheckFailedException']})
}

export const disconnectMessage = async ({ payloads }: { payloads: DisconnectMessage[], messageBus?: MessageBus }): Promise<void> => {
    //
    // TODO: Figure out whether a forced disconnet invalidates any cached values
    //

    await Promise.all(payloads.map(async (payload) => (
        forceDisconnect(payload.connectionId)
    )))
}

export default disconnectMessage
