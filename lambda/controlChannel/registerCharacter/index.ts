import { RegisterCharacterMessage, MessageBus } from "../messageBus/baseClasses"
import messageBus from "../messageBus"
import { ephemeraDB, connectionDB, exponentialBackoffWrapper, multiTableTransactWrite } from "@tonylb/mtw-utilities/dist/dynamoDB"

import internalCache from '../internalCache'
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { marshall } from "@aws-sdk/util-dynamodb"

type RoomCharacterActive = {
    EphemeraId: string;
    Color?: string;
    ConnectionIds: string[];
    fileURL?: string;
    Name: string;
}

export const registerCharacter = async ({ payloads }: { payloads: RegisterCharacterMessage[], messageBus: MessageBus }): Promise<void> => {

    const connectionId = await internalCache.get({ category: 'Global', key: 'ConnectionId' })

    if (connectionId) {
        const RequestId = await internalCache.get({ category: 'Global', key: 'RequestId' })
        const handleOneRegistry = async (payload: RegisterCharacterMessage): Promise<void> => {
            const { characterId: CharacterId } = payload
            const EphemeraId = `CHARACTER#${CharacterId}`
            await exponentialBackoffWrapper(async () => {
                const [characterFetch, connectionsFetch] = await Promise.all([
                    ephemeraDB.getItem<{ Name: string; HomeId: string; RoomId: string; fileURL?: string; Color: string; }>({
                        EphemeraId,
                        DataCategory: 'Meta::Character',
                        ProjectionFields: ['#name', 'HomeId', 'RoomId', 'fileURL', 'Color'],
                        ExpressionAttributeNames: {
                            '#name': 'Name'
                        }
                    }),
                    connectionDB.getItem<{ connections: string[] }>({
                        ConnectionId: EphemeraId,
                        DataCategory: 'Meta::Character',
                        ProjectionFields: ['connections']
                    }),
                ])
                const currentConnections = connectionsFetch?.connections
                if (!characterFetch) {
                    return
                }
                const { Name = '', HomeId = '', RoomId = '', fileURL, Color } = characterFetch
                const RoomEphemeraId = `ROOM#${RoomId || HomeId || 'VORTEX'}`
                const { activeCharacters = [] } = (await ephemeraDB.getItem<{ activeCharacters: RoomCharacterActive[] }>({
                    EphemeraId: RoomEphemeraId,
                    DataCategory: 'Meta::Room',
                    ProjectionFields: ['activeCharacters']
                })) || {}
                const newConnections = unique(currentConnections || [], [connectionId])
                const metaCharacterUpdate = (currentConnections !== undefined)
                    ? {
                        TableName: 'Connections',
                        Key: marshall({
                            ConnectionId: EphemeraId,
                            DataCategory: 'Meta::Character'
                        }),
                        ExpressionAttributeValues: marshall({
                            ':oldConnections': currentConnections,
                            ':newConnections': newConnections
                        }),
                        UpdateExpression: 'SET connections = :newConnections',
                        ConditionExpression: 'connections = :oldConnections'
                    }
                    : {
                        TableName: 'Connections',
                        Key: marshall({
                            ConnectionId: EphemeraId,
                            DataCategory: 'Meta::Character'
                        }),
                        ExpressionAttributeValues: marshall({
                            ':newConnections': newConnections
                        }),
                        UpdateExpression: 'SET connections = :newConnections',
                        ConditionExpression: 'attribute_not_exists(connections)'
                    }
                const characterRoomUpdate = RoomId
                    ? []
                    : [{
                        Update: {
                            TableName: 'Ephemera',
                            Key: marshall({
                                EphemeraId,
                                DataCategory: 'Meta::Character',
                            }),
                            UpdateExpression: 'SET RoomId = :roomId',
                            ExpressionAttributeValues: marshall({
                                ':roomId': HomeId || 'VORTEX',
                            }),
                            ConditionExpression: 'attribute_not_exists(RoomId)'
                        }
                    }]
                const newActiveCharacters = [
                    ...activeCharacters.filter((character) => (character.EphemeraId !== EphemeraId)),
                    {
                        EphemeraId,
                        Name,
                        fileURL,
                        Color,
                        ConnectionIds: newConnections
                    }
                ]
                const activeCharactersUpdate = {
                    Update: {
                        TableName: 'Ephemera',
                        Key: marshall({
                            EphemeraId: RoomEphemeraId,
                            DataCategory: 'Meta::Room'
                        }),
                        UpdateExpression: 'SET activeCharacters = :newActiveCharacters',
                        ExpressionAttributeValues: marshall({
                            ':oldActiveCharacters': activeCharacters,
                            ':newActiveCharacters': newActiveCharacters
                        }, { removeUndefinedValues: true}),
                        ConditionExpression: 'activeCharacters = :oldActiveCharacters'
                    }
                }
                await multiTableTransactWrite([{
                    Update: metaCharacterUpdate
                },
                {
                    Put: {
                        TableName: 'Connections',
                        Item: marshall({
                            ConnectionId: `CONNECTION#${connectionId}`,
                            DataCategory: EphemeraId
                        })
                    }
                },
                ...characterRoomUpdate,
                activeCharactersUpdate
                ])
                if ((currentConnections || []).length === 0) {
                    messageBus.send({
                        type: 'EphemeraUpdate',
                        updates: [{
                            type: 'CharacterInPlay',
                            CharacterId,
                            Name: Name || '',
                            Connected: true,
                            RoomId: RoomId || '',
                            fileURL: fileURL || '',
                            Color: Color || 'grey'
                        }]        
                    })
                }
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
