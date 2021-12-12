const { marshall } = require('@aws-sdk/util-dynamodb')
const { UpdateItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb')
const { v4: uuidv4 } = require('uuid')
const { splitType } = require('../utilities')

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const messageTable = `${TABLE_PREFIX}_messages`

const checkForDisconnect = async (dbClient, { oldImage, newImage }) => {
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
                    DisplayProtocol: "World",
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

exports.checkForDisconnect = checkForDisconnect
