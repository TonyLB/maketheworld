import { marshall } from '@aws-sdk/util-dynamodb'
import { UpdateItemCommand, PutItemCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb'
import { v4 as uuidv4 } from 'uuid'

import { splitType } from '../utilities/index.js'
import { render } from '/opt/perception/index.js'

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const messageTable = `${TABLE_PREFIX}_messages`

export const checkForMovement = async (dbClient, { oldImage, newImage }) => {
    if (newImage.Connected === oldImage.Connected && newImage.RoomId !== oldImage.RoomId) {
        const epochTime = Date.now()
        if (newImage.Connected) {
            const CharacterId = splitType(newImage.EphemeraId)[1]
            const { Name } = newImage
            const messages = async () => {
                const { RoomId: oldRoomId } = oldImage
                const { leaveMessage, enterMessage, RoomId: newRoomId } = newImage
                const departure = oldRoomId
                        ? [{
                            MessageId: `MESSAGE#${uuidv4()}`,
                            DataCategory: 'Meta::Message',
                            CreatedTime: epochTime - 1,
                            Targets: [`CHARACTER#${CharacterId}`, `ROOM#${oldRoomId}`],
                            DisplayProtocol: "WorldMessage",
                            Message: `${Name}${leaveMessage || ' has left.'}`
                        }]
                        : []
                const arrival = newRoomId
                        ? [{
                            MessageId: `MESSAGE#${uuidv4()}`,
                            DataCategory: 'Meta::Message',
                            CreatedTime: epochTime + 1,
                            Targets: [`CHARACTER#${CharacterId}`, `ROOM#${newRoomId}`],
                            DisplayProtocol: "WorldMessage",
                            Message: `${Name}${enterMessage || ' has arrived.'}`
                        }]
                        : []
                if (newRoomId) {
                    const roomMessage = await render({
                        assets: ['TEST'],
                        EphemeraId: `ROOM#${newRoomId}`,
                    })
                    await dbClient.send(new BatchWriteItemCommand({ RequestItems: {
                        [messageTable]: [
                            ...arrival,
                            {
                                MessageId: `MESSAGE#${uuidv4()}`,
                                CreatedTime: epochTime,
                                Targets: [`ROOM#${newRoomId}`, `CHARACTER#${CharacterId}`],
                                DataCategory: 'Meta::Message',
                                DisplayProtocol: 'RoomHeader',
                                ...roomMessage
                            },
                            ...departure
                        ].map((message) => ({
                            PutRequest: { Item: marshall(message) }
                        }))
                    }}))
                }
                else {
                    //
                    // Somehow the character is moving to nowhere, so publish the departure message.
                    //
                    if (departureMessage.length) {
                        await dbClient.send(new PutItemCommand({
                            TableName: messageTable,
                            Item: departureMessage[0]
                        }))    
                    }
                }
            }
            const leaveRoomEphemera = async () => {
                const { RoomId, EphemeraId } = oldImage
                if (RoomId) {
                    try {
                        await dbClient.send(new UpdateItemCommand({
                            TableName: ephemeraTable,
                            Key: marshall({
                                EphemeraId: `ROOM#${RoomId}`,
                                DataCategory: 'Meta::Room'
                            }),
                            UpdateExpression: "REMOVE activeCharacters.#characterId, inactiveCharacters.#characterId",
                            ConditionExpression: "attribute_exists(activeCharacters) AND attribute_exists(inactiveCharacters)",
                            ExpressionAttributeNames: { "#characterId": EphemeraId },
                        }))
                    }
                    catch(event) {
                        console.log(`ERROR: leaveRoomEphemera`)
                    }
                }
            }
            const enterRoomEphemera = async () => {
                const { RoomId, EphemeraId, ConnectionId } = newImage
                if (RoomId) {
                    try {
                        await dbClient.send(new UpdateItemCommand({
                            TableName: ephemeraTable,
                            Key: marshall({
                                EphemeraId: `ROOM#${RoomId}`,
                                DataCategory: 'Meta::Room'
                            }),
                            UpdateExpression: "SET activeCharacters.#characterId = :character REMOVE inactiveCharacters.#characterId",
                            ConditionExpression: "attribute_exists(activeCharacters) AND attribute_exists(inactiveCharacters)",
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
                    catch(event) {
                        console.log(`ERROR: enterRoomEphemera`)
                    }
                }
            }
            //
            // Movement messages and update Rooms
            //
            await Promise.all([
                leaveRoomEphemera(),
                enterRoomEphemera()
            ])
            await messages()
        }
        else {
            const leaveRoomEphemera = async () => {
                const { RoomId, EphemeraId } = oldImage
                if (RoomId) {
                    try {
                        await dbClient.send(new UpdateItemCommand({
                            TableName: ephemeraTable,
                            Key: marshall({
                                EphemeraId: `ROOM#${RoomId}`,
                                DataCategory: 'Meta::Room'
                            }),
                            UpdateExpression: "REMOVE activeCharacters.#characterId, inactiveCharacters.#characterId",
                            ExpressionAttributeNames: { "#characterId": EphemeraId }
                        }))    
                    }
                    catch(event) {
                        console.log(`ERROR: disconnected leaveRoomEphemera`)
                    }
                }
            }
            const enterRoomEphemera = async () => {
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
                                    Name,
                                }
                            }, { removeUndefinedValues: true })
                        }))
                    }
                    catch(event) {
                        console.log(`ERROR: disconnected enterRoomEphemera`)
                    }
                }
            }
            //
            // Update room (no messages for movement of unconnected characters)
            //
            await Promise.all([
                leaveRoomEphemera(),
                enterRoomEphemera()
            ])
        }
    }
    return {}
}
