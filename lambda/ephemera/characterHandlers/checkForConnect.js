const { marshall } = require('@aws-sdk/util-dynamodb')
const { UpdateItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb')
const { v4: uuidv4 } = require('uuid')

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const messageTable = `${TABLE_PREFIX}_messages`

const splitType = (value) => {
    const sections = value.split('#')
    if (sections.length) {
        return [sections[0], sections.slice(1).join('#')]
    }
    else {
        return ['', '']
    }
}

const checkForConnect = async (dbClient, { oldImage, newImage }) => {
    if (!(oldImage && oldImage.Connected) && newImage.Connected) {
        const connectMessage = async () => {
            const { Name, RoomId, EphemeraId } = newImage
            const CharacterId = splitType(EphemeraId)[1]
            await dbClient.send(new PutItemCommand({
                TableName: messageTable,
                Item: marshall({
                    MessageId: `MESSAGE#${uuidv4()}`,
                    DataCategory: 'Meta::Message',
                    CreatedTime: Date.now(),
                    Targets: [`CHARACTER#${CharacterId}`, `ROOM#${RoomId}`],
                    DisplayProtocol: "World",
                    Message: `${Name || 'Someone'} has connected.`
                })
            }))
        }
        const updateRoomEphemera = async () => {
            const { RoomId, EphemeraId, Name, ConnectionId } = newImage
            if (RoomId) {
                try {
                    await dbClient.send(new UpdateItemCommand({
                        TableName: ephemeraTable,
                        Key: marshall({
                            EphemeraId: `ROOM#${RoomId}`,
                            DataCategory: 'Meta::Room'
                        }),
                        UpdateExpression: "SET activeCharacters.#characterId = :character REMOVE inactiveCharacters.#characterId",
                        ExpressionAttributeNames: { "#characterId": EphemeraId },
                        ExpressionAttributeValues: marshall({
                            ":character": {
                                EphemeraId,
                                Name,
                                ConnectionId
                            }
                        }, { removeUndefinedValues: true })
                    }))
                }
                catch (event) {
                    console.log('ERROR: Connect updateRoom')
                }
            }
        }
        //
        // Connect messages, update Room, maybe describe for connecting character
        //
        await Promise.all([
            connectMessage(),
            updateRoomEphemera()
        ])
    }
    return {}
}

exports.checkForConnect = checkForConnect
