const { marshall } = require('@aws-sdk/util-dynamodb')
const { UpdateItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb')
const { v4: uuidv4 } = require('uuid')
const { InvokeCommand } = require('@aws-sdk/client-lambda')

const { splitType } = require('../utilities')

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const messageTable = `${TABLE_PREFIX}_messages`

const checkForMovement = async ({ dbClient, lambdaClient }, { oldImage, newImage }) => {
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
                            DisplayProtocol: "World",
                            Message: `${Name}${leaveMessage || ' has left.'}`
                        }]
                        : []
                const arrival = newRoomId
                        ? [{
                            MessageId: `MESSAGE#${uuidv4()}`,
                            DataCategory: 'Meta::Message',
                            CreatedTime: epochTime + 1,
                            Targets: [`CHARACTER#${CharacterId}`, `ROOM#${newRoomId}`],
                            DisplayProtocol: "World",
                            Message: `${Name}${enterMessage || ' has left.'}`
                        }]
                        : []
                if (newRoomId) {
                    const args = {
                        CreatedTime: epochTime,
                        CharacterId,
                        PermanentId: `ROOM#${newRoomId}`,
                        DisplayProtocol: 'RoomHeader',
                        additionalMessages: [...departure, ...arrival]
                    }
                    await lambdaClient.send(new InvokeCommand({
                        FunctionName: process.env.PERCEPTION_SERVICE,
                        InvocationType: 'RequestResponse',
                        Payload: new TextEncoder().encode(JSON.stringify(args))
                    }))
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
            //
            // TODO:  Figure out how to package the perception function with other messages,
            // so that they get published more or less together.
            //
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
                            UpdateExpression: "SET inactiveCharacters.#characterId = :character REMOVE activeCharacters.#characterId",
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
                messages(),
                leaveRoomEphemera(),
                enterRoomEphemera()
            ])
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

exports.checkForMovement = checkForMovement
