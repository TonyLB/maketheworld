import { v4 as uuidv4 } from 'uuid'

import { splitType } from '/opt/utilities/types.js'
import { render } from '/opt/utilities/perception/index.js'
import { publishMessage } from '/opt/utilities/dynamoDB/index.js'
import { publishRoomAndCharacterMessage, roomOccupancyEphemera } from './utilities.js'

export const checkForMovement = async ({ oldImage, newImage }) => {
    if (newImage.Connected === oldImage.Connected && newImage.RoomId !== oldImage.RoomId) {
        const epochTime = Date.now()
        const CharacterId = splitType(newImage.EphemeraId)[1]
        const { Name } = newImage
        const messages = async () => {
            const { RoomId: oldRoomId } = oldImage
            const { leaveMessage, enterMessage, RoomId: newRoomId } = newImage
            const departure = oldRoomId
                ? () => (publishRoomAndCharacterMessage({
                    CreatedTime: epochTime - 1,
                    CharacterId,
                    RoomId: oldRoomId,
                    Message: `${Name}${leaveMessage || ' has left.'}`
                }))
                : () => (Promise.resolve({}))
            const arrival = newRoomId
                ? () => (publishRoomAndCharacterMessage({
                    CreatedTime: epochTime + 1,
                    CharacterId,
                    RoomId: newRoomId,
                    Message: `${Name}${enterMessage || ' has arrived.'}`
                }))
                : () => (Promise.resolve({}))
            if (newRoomId) {
                const [{ EphemeraId: removeOne, CharacterId: removeTwo, ...roomMessage }] = await render([{
                    CharacterId,
                    EphemeraId: `ROOM#${newRoomId}`,
                }])
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
                await roomOccupancyEphemera({
                    CharacterId,
                    RoomId,
                    anchorTime: epochTime,
                    isActive: false,
                    isInactive: false,
                    wasActive: oldImage.Connected
                })
            }
        }
        const enterRoomEphemera = async () => {
            const { RoomId, EphemeraId, Name, Color, ConnectionIds } = newImage
            if (RoomId) {
                const CharacterId = splitType(EphemeraId)[1]
                await roomOccupancyEphemera({
                    CharacterId,
                    RoomId,
                    Name,
                    Color,
                    ConnectionIds,
                    anchorTime: epochTime,
                    isActive: newImage.Connected,
                    isInactive: !newImage.Connected,
                })
            }
        }
        //
        // Movement messages and update Rooms (if Connected)
        //
        await Promise.all([
            leaveRoomEphemera(),
            enterRoomEphemera()
        ])
        if (newImage.Connected) {
            await messages()
        }
    }
    return {}
}
