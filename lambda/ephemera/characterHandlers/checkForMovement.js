import { v4 as uuidv4 } from 'uuid'

import { splitType } from '/opt/utilities/types.js'
import { render } from '/opt/perception/index.js'
import publishRoomUpdate from './publishRoomUpdate.js'
import characterEphemeraDenormalize from './characterEphemeraDenormalize.js'
import { publishMessage } from '/opt/utilities/dynamoDB/index.js'

export const checkForMovement = async ({ oldImage, newImage }) => {
    if (newImage.Connected === oldImage.Connected && newImage.RoomId !== oldImage.RoomId) {
        const epochTime = Date.now()
        if (newImage.Connected) {
            const CharacterId = splitType(newImage.EphemeraId)[1]
            const { Name } = newImage
            const messages = async () => {
                const { RoomId: oldRoomId } = oldImage
                const { leaveMessage, enterMessage, RoomId: newRoomId } = newImage
                const departure = oldRoomId
                    ? () => (publishMessage({
                            MessageId: `MESSAGE#${uuidv4()}`,
                            CreatedTime: epochTime - 1,
                            Targets: [`CHARACTER#${CharacterId}`, `ROOM#${oldRoomId}`],
                            DisplayProtocol: "WorldMessage",
                            Message: `${Name}${leaveMessage || ' has left.'}`
                        }))
                    : () => (Promise.resolve({}))
                const arrival = newRoomId
                    ? () => (publishMessage({
                            MessageId: `MESSAGE#${uuidv4()}`,
                            CreatedTime: epochTime + 1,
                            Targets: [`CHARACTER#${CharacterId}`, `ROOM#${newRoomId}`],
                            DisplayProtocol: "WorldMessage",
                            Message: `${Name}${enterMessage || ' has arrived.'}`
                        }))
                    : () => (Promise.resolve({}))
                if (newRoomId) {
                    const roomMessage = await render({
                        CharacterId,
                        assets: ['TEST'],
                        EphemeraId: `ROOM#${newRoomId}`,
                    })
                    await Promise.all([
                        arrival(),
                        departure(),
                        publishMessage({
                            MessageId: `MESSAGE#${uuidv4()}`,
                            CreatedTime: epochTime,
                            Targets: [`CHARACTER#${CharacterId}`],
                            DisplayProtocol: 'RoomHeader',
                            ...roomMessage
                        })
                    ])
                }
                else {
                    //
                    // Somehow the character is moving to nowhere, so publish the departure message.
                    //
                    if (departureMessage.length) {
                        await departure()
                    }
                }
            }
            const leaveRoomEphemera = async () => {
                const { RoomId, EphemeraId } = oldImage
                if (RoomId) {
                    const CharacterId = splitType(EphemeraId)[1]
                    // try {
                        await characterEphemeraDenormalize({
                            EphemeraId,
                            RoomId,
                            isActive: false,
                            isInactive: false,
                            returnValues: true
                        }).then(publishRoomUpdate({
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
                            RoomId,
                            EphemeraId,
                            Name,
                            Color,
                            ConnectionId,
                            isActive: true,
                            isInactive: false,
                            returnValues: true
                        }).then(publishRoomUpdate({
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
