import { marshall } from '@aws-sdk/util-dynamodb'
import { UpdateItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { splitType } from '../utilities/index.js'

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const messageTable = `${TABLE_PREFIX}_messages`

export const checkForDisconnect = async (dbClient, { oldImage, newImage }) => {
    if (!newImage.EphemeraId || ((!newImage.Connected) && oldImage.Connected)) {
        const disconnectMessage = async () => {
            const { Name, RoomId, EphemeraId = '' } = oldImage
            const CharacterId = splitType(EphemeraId)[1]
            await dbClient.send(new PutItemCommand({
                TableName: messageTable,
                Item: marshall({
                    MessageId: `MESSAGE#${uuidv4()}`,
                    DataCategory: 'Meta::Message',
                    CreatedTime: Date.now(),
                    Targets: [`CHARACTER#${CharacterId}`, `ROOM#${RoomId}`],
                    DisplayProtocol: "WorldMessage",
                    Message: `${Name || 'Someone'} has disconnected.`
                })
            }))
        }
        const updateRoomEphemera = async () => {
            const { RoomId, EphemeraId, Name } = newImage
            if (RoomId) {
                try {
                    await dbClient.send(new UpdateItemCommand({
                        TableName: ephemeraTable,
                        Key: marshall({
                            EphemeraId: `ROOM#${RoomId}`,
                            DataCategory: 'Meta::Room'
                        }),
                        UpdateExpression: "SET inactiveCharacters.#characterId = :character REMOVE activeCharacters.#characterId",
                        ExpressionAttributeNames: { "#characterId": EphemeraId },
                        ExpressionAttributeValues: marshall({
                            ":character": {
                                EphemeraId,
                                Name
                            }
                        }, { removeUndefinedValues: true })
                    }))
                }
                catch(event) {
                    console.log(`ERROR: Disconnect updateRoom`)
                }
            }
            else {
                if (oldImage.RoomId) {
                    try {
                        await dbClient.send(new UpdateItemCommand({
                            TableName: ephemeraTable,
                            Key: marshall({
                                EphemeraId: `ROOM#${oldImage.RoomId}`,
                                DataCategory: 'Meta::Room'
                            }),
                            UpdateExpression: "REMOVE activeCharacters.#characterId, inactiveCharacters.#characterId",
                            ConditionExpression: "attribute_exists(activeCharacters) AND attribute_exists(inactiveCharacters)",
                            ExpressionAttributeNames: { "#characterId": oldImage.EphemeraId },
                        }))
                    }
                    catch(event) {
                        console.log(`ERROR: DisconnectEphemera (Delete)`)
                    }
                }
            }
        }
        //
        // Disconnect messages and update Room
        //
        await Promise.all([
            disconnectMessage(),
            updateRoomEphemera()
        ])
    }
    return {}
}
