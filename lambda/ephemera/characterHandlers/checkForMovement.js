import { marshall } from '@aws-sdk/util-dynamodb'
import { UpdateItemCommand, PutItemCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb'
import { v4 as uuidv4 } from 'uuid'

import { splitType } from '../utilities/index.js'
import { render } from '/opt/perception/index.js'
import publishRoomUpdate from './publishRoomUpdate.js'
import characterEphemeraDenormalize from './characterEphemeraDenormalize.js'

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
                        CharacterId,
                        assets: ['TEST'],
                        EphemeraId: `ROOM#${newRoomId}`,
                    })
                    await dbClient.send(new BatchWriteItemCommand({ RequestItems: {
                        [messageTable]: [
                            ...arrival,
                            {
                                MessageId: `MESSAGE#${uuidv4()}`,
                                CreatedTime: epochTime,
                                Targets: [`CHARACTER#${CharacterId}`],
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
                    const CharacterId = splitType(EphemeraId)[1]
                    // try {
                        await characterEphemeraDenormalize({
                            dbClient,
                            EphemeraId,
                            RoomId,
                            isActive: false,
                            isInactive: false,
                            returnValues: true
                        }).then(publishRoomUpdate({
                            dbClient,
                            notCharacterId: CharacterId,
                            epochTime: epochTime + 2,
                            RoomId
                        }))
                    // }
                    // catch(event) {
                    //     console.log(`ERROR: leaveRoomEphemera`)
                    // }
                }
            }
            const enterRoomEphemera = async () => {
                const { RoomId, EphemeraId, Name, Color, ConnectionId } = newImage
                if (RoomId) {
                    const CharacterId = splitType(EphemeraId)[1]
                    // try {
                        await characterEphemeraDenormalize({
                            dbClient,
                            RoomId,
                            EphemeraId,
                            Name,
                            Color,
                            ConnectionId,
                            isActive: true,
                            isInactive: false,
                            returnValues: true
                        }).then(publishRoomUpdate({
                            dbClient,
                            notCharacterId: CharacterId,
                            epochTime: epochTime + 2,
                            RoomId
                        }))
                    // }
                    // catch(event) {
                    //     console.log(`ERROR: enterRoomEphemera`)
                    // }
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
                        await characterEphemeraDenormalize({
                            dbClient,
                            RoomId,
                            EphemeraId,
                            isActive: false,
                            isInactive: false
                        })
                    }
                    catch(event) {
                        console.log(`ERROR: disconnected leaveRoomEphemera`)
                    }
                }
            }
            const enterRoomEphemera = async () => {
                const { RoomId, EphemeraId, Name, Color, ConnectionId } = newImage
                if (RoomId) {
                    try {
                        await characterEphemeraDenormalize({
                            dbClient,
                            RoomId,
                            EphemeraId,
                            Name,
                            Color,
                            ConnectionId,
                            isActive: false,
                            isInactive: true
                        })
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
