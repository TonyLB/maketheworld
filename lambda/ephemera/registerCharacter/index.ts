import { RegisterCharacterMessage, MessageBus } from "../messageBus/baseClasses"
import messageBus from "../messageBus"
import { exponentialBackoffWrapper, multiTableTransactWrite } from "@tonylb/mtw-utilities/dist/dynamoDB"

import internalCache from '../internalCache'
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { marshall } from "@aws-sdk/util-dynamodb"
import { RoomCharacterListItem } from "../internalCache/baseClasses"
import { isEphemeraCharacterId } from "@tonylb/mtw-interfaces/dist/baseClasses"

export const registerCharacter = async ({ payloads }: { payloads: RegisterCharacterMessage[], messageBus: MessageBus }): Promise<void> => {

    const connectionId = await internalCache.Global.get('ConnectionId')

    if (connectionId) {
        const RequestId = await internalCache.Global.get('RequestId')
        const handleOneRegistry = async (payload: RegisterCharacterMessage): Promise<void> => {
            const { characterId: CharacterId } = payload
            if (!(isEphemeraCharacterId(CharacterId))) {
                return
            }
            await exponentialBackoffWrapper(async () => {
                const [characterFetch, currentConnections] = await Promise.all([
                    internalCache.CharacterMeta.get(CharacterId),
                    internalCache.CharacterConnections.get(CharacterId)
                ])
                if (!characterFetch) {
                    return
                }
                const { Name = '', HomeId, RoomId, fileURL, Color } = characterFetch
                const activeCharacters = await internalCache.RoomCharacterList.get(RoomId)
                const newConnections = unique(currentConnections || [], [connectionId]) as string[]
                const metaCharacterUpdate = (typeof currentConnections !== 'undefined')
                    ? {
                        TableName: 'Connections',
                        Key: marshall({
                            ConnectionId: CharacterId,
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
                            ConnectionId: CharacterId,
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
                                EphemeraId: CharacterId,
                                DataCategory: 'Meta::Character',
                            }),
                            UpdateExpression: 'SET RoomId = :roomId',
                            ExpressionAttributeValues: marshall({
                                ':roomId': HomeId,
                            }),
                            ConditionExpression: 'attribute_not_exists(RoomId)'
                        }
                    }]
                const newActiveCharacters: RoomCharacterListItem[] = [
                    ...(activeCharacters || []).filter((character) => (character.EphemeraId !== CharacterId)),
                    {
                        EphemeraId: CharacterId,
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
                            EphemeraId: RoomId,
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
                console.log(`Register: activeCharactersUpdate: ${JSON.stringify(activeCharactersUpdate, null, 4)}`)
                await multiTableTransactWrite([{
                    Update: metaCharacterUpdate
                },
                {
                    Put: {
                        TableName: 'Connections',
                        Item: marshall({
                            ConnectionId: `CONNECTION#${connectionId}`,
                            DataCategory: CharacterId
                        })
                    }
                },
                ...characterRoomUpdate,
                activeCharactersUpdate
                ])
                if ((currentConnections || []).length === 0) {
                    messageBus.send({
                        type: 'EphemeraUpdate',
                        global: true,
                        updates: [{
                            type: 'CharacterInPlay',
                            CharacterId,
                            Name: Name || '',
                            Connected: true,
                            RoomId,
                            fileURL: fileURL || '',
                            Color: Color || 'grey',
                            targets: []
                        }]        
                    })
                    messageBus.send({
                        type: 'PublishMessage',
                        targets: [RoomId, `!${CharacterId}`],
                        displayProtocol: 'WorldMessage',
                        message: [{
                            tag: 'String',
                            value: `${Name || 'Someone'} has connected.`
                        }]
                    })
                    messageBus.send({
                        type: 'RoomUpdate',
                        roomId: RoomId
                    })
                }
                internalCache.RoomCharacterList.set({ key: RoomId, value: newActiveCharacters })

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
