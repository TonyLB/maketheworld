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
                    Targets: [`ROOM#${RoomId}`, `NOT-CHARACTER#${CharacterId}`],
                    DisplayProtocol: "WorldMessage",
                    Message: `${Name || 'Someone'} has disconnected.`
                })
            }))
        }
        const updateRoomEphemera = async () => {
            const { RoomId, EphemeraId, Name } = newImage
            const CharacterId = splitType(EphemeraId)[1]
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
                        }, { removeUndefinedValues: true }),
                        ReturnValues: 'UPDATED_NEW'
                    })).then(({ Attributes }) => {
                        const { activeCharacters = {} } = unmarshall(Attributes)
                        return dbClient.send(new PutItemCommand({
                            TableName: messageTable,
                            Item: marshall({
                                MessageId: `MESSAGE#${uuidv4()}`,
                                CreatedTime: epochTime + 2,
                                Targets: [`ROOM#${RoomId}`, `NOT-CHARACTER#${CharacterId}`],
                                DataCategory: 'Meta::Message',
                                DisplayProtocol: 'RoomUpdate',
                                characters: Object.values(activeCharacters)
                            })
                        }))
                    })
                }
                catch(event) {
                    console.log(`ERROR: Disconnect updateRoom`)
                }
            }
            else {
                if (oldImage.RoomId) {
                    const CharacterId = splitType(oldImage.EphemeraId)[1]
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
                            ReturnValues: 'UPDATED_NEW'
                        })).then(({ Attributes }) => {
                            const { activeCharacters = {} } = unmarshall(Attributes)
                            dbClient.send(new PutItemCommand({
                                TableName: messageTable,
                                Item: marshall({
                                    MessageId: `MESSAGE#${uuidv4()}`,
                                    CreatedTime: epochTime + 2,
                                    Targets: [`ROOM#${newImage.RoomId}`, `NOT-CHARACTER#${CharacterId}`],
                                    DataCategory: 'Meta::Message',
                                    DisplayProtocol: 'RoomUpdate',
                                    characters: Object.values(activeCharacters)
                                })
                            }))
                        })
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
