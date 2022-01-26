import { marshall } from '@aws-sdk/util-dynamodb'
import { UpdateItemCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { splitType } from '../utilities/index.js'
import { render } from '/opt/perception/index.js'

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const messageTable = `${TABLE_PREFIX}_messages`

export const checkForConnect = async (dbClient, { oldImage, newImage }) => {
    if (!oldImage.EphemeraId || (!(oldImage.Connected ?? false) && newImage.Connected)) {
        if (newImage.Connected) {
            const epochTime = Date.now()
            const connectMessage = async () => {
                const { Name, RoomId, EphemeraId } = newImage
                const CharacterId = splitType(EphemeraId)[1]
                const connectMessage = {
                    MessageId: `MESSAGE#${uuidv4()}`,
                    DataCategory: 'Meta::Message',
                    CreatedTime: epochTime + 1,
                    Targets: [`ROOM#${RoomId}`, `NOT-CHARACTER#${CharacterId}`],
                    DisplayProtocol: "WorldMessage",
                    Message: `${Name || 'Someone'} has connected.`
                }
                const roomMessage = await render({
                    assets: ['TEST'],
                    EphemeraId: `ROOM#${newImage.RoomId}`,
                })
                await dbClient.send(new BatchWriteItemCommand({ RequestItems: {
                    [messageTable]: [
                        {
                            MessageId: `MESSAGE#${uuidv4()}`,
                            CreatedTime: epochTime,
                            Targets: [`ROOM#${newImage.RoomId}`, `CHARACTER#${CharacterId}`],
                            DataCategory: 'Meta::Message',
                            DisplayProtocol: 'RoomHeader',
                            ...roomMessage
                        },
                        connectMessage
                    ].map((message) => ({
                        PutRequest: { Item: marshall(message) }
                    }))
                }}))
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
        else {
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
                            UpdateExpression: "SET inactiveCharacters.#characterId = :character REMOVE activeCharacters.#characterId",
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
            await updateRoomEphemera()
        }
    }
    return {}
}
