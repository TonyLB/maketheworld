import { MoveCharacterMessage, MessageBus } from "../messageBus/baseClasses"
import { connectionDB, ephemeraDB, exponentialBackoffWrapper, multiTableTransactWrite } from "@tonylb/mtw-utilities/dist/dynamoDB"
import internalCache from "../internalCache"
import { marshall } from "@aws-sdk/util-dynamodb"
import { RoomCharacterListItem } from "../internalCache/baseClasses"
import { splitType } from "@tonylb/mtw-utilities/dist/types"

export const moveCharacter = async ({ payloads, messageBus }: { payloads: MoveCharacterMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async (payload) => {
        //
        // TODO: Validate the RoomId as one that is valid for the character to move to, before
        // pushing data to the DB.
        //

        await exponentialBackoffWrapper(async () => {

            internalCache.RoomCharacterList.invalidate(payload.roomId)
            const [characterMeta, arrivingCharacters, connections] = await Promise.all([
                internalCache.CharacterMeta.get(payload.characterId),
                internalCache.RoomCharacterList.get(payload.roomId),
                internalCache.CharacterConnections.get(payload.characterId)
            ])
            internalCache.RoomCharacterList.invalidate(`ROOM#${characterMeta.RoomId}`)
            const departingCharacters = await internalCache.RoomCharacterList.get(`ROOM#${characterMeta.RoomId}`)
            const newDepartingCharacters = departingCharacters.filter(({ EphemeraId }) => (EphemeraId !== characterMeta.EphemeraId))
            const newArrivingCharacters: RoomCharacterListItem[] = [
                ...arrivingCharacters
                    .filter(({ EphemeraId }) => (EphemeraId !== characterMeta.EphemeraId)),
                {
                    EphemeraId: characterMeta.EphemeraId,
                    Name: characterMeta.Name,
                    fileURL: characterMeta.fileURL,
                    Color: characterMeta.Color,
                    ConnectionIds: connections || []
                }
            ]
            await multiTableTransactWrite([{
                Update: {
                    TableName: 'Ephemera',
                    Key: marshall({
                        EphemeraId: characterMeta.EphemeraId,
                        DataCategory: 'Meta::Character'
                    }),
                    UpdateExpression: 'SET RoomId = :newRoomId',
                    ExpressionAttributeValues: marshall({
                        ':newRoomId': splitType(payload.roomId)[1]
                    }, { removeUndefinedValues: true})
                }
            },
            {
                Update: {
                    TableName: 'Ephemera',
                    Key: marshall({
                        EphemeraId: `ROOM#${characterMeta.RoomId}`,
                        DataCategory: 'Meta::Room'
                    }),
                    UpdateExpression: 'SET activeCharacters = :newActiveCharacters',
                    ExpressionAttributeValues: marshall({
                        ':oldActiveCharacters': departingCharacters,
                        ':newActiveCharacters': newDepartingCharacters
                    }, { removeUndefinedValues: true}),
                    ConditionExpression: 'activeCharacters = :oldActiveCharacters'
                }
            },
            {
                Update: {
                    TableName: 'Ephemera',
                    Key: marshall({
                        EphemeraId: payload.roomId,
                        DataCategory: 'Meta::Room'
                    }),
                    UpdateExpression: 'SET activeCharacters = :newActiveCharacters',
                    ExpressionAttributeValues: marshall({
                        ':oldActiveCharacters': arrivingCharacters,
                        ':newActiveCharacters': newArrivingCharacters
                    }, { removeUndefinedValues: true}),
                    ConditionExpression: 'activeCharacters = :oldActiveCharacters'
                }
            }])

            internalCache.RoomCharacterList.set({ key: `ROOM#${characterMeta.RoomId}`, value: newDepartingCharacters })
            internalCache.RoomCharacterList.set({ key: payload.roomId, value: newArrivingCharacters })

            messageBus.send({
                type: 'PublishMessage',
                targets: [{ roomId: `ROOM#${characterMeta.RoomId}` }, { characterId: payload.characterId }],
                displayProtocol: 'WorldMessage',
                message: [{
                    tag: 'String',
                    value: `${characterMeta.Name || 'Someone'}${payload.leaveMessage || ' has left.'}`
                }]
            })
            messageBus.send({
                type: 'RoomUpdate',
                roomId: characterMeta.RoomId
            })

            messageBus.send({
                type: 'Perception',
                characterId: payload.characterId,
                ephemeraId: payload.roomId
            })

            messageBus.send({
                type: 'PublishMessage',
                targets: [{ roomId: payload.roomId }, { characterId: payload.characterId }],
                displayProtocol: 'WorldMessage',
                message: [{
                    tag: 'String',
                    value: `${characterMeta.Name || 'Someone'} has arrived.`
                }]
            })
            messageBus.send({
                type: 'RoomUpdate',
                roomId: splitType(payload.roomId)[1]
            })

        }, { retryErrors: ['TransactionCanceledException']})
    }))
}

export default moveCharacter
