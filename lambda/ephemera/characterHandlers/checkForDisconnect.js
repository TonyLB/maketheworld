import { v4 as uuidv4 } from 'uuid'
import { splitType } from '/opt/utilities/types.js'
import { publishMessage } from '/opt/utilities/dynamoDB/index.js'
import { roomOccupancyEphemera } from './utilities.js'

export const checkForDisconnect = async ({ oldImage, newImage }) => {
    const epochTime = Date.now()
    if (!newImage.EphemeraId || ((!newImage.Connected) && oldImage.Connected)) {
        const disconnectMessage = async () => {
            const { Name, RoomId, EphemeraId = '' } = oldImage
            const CharacterId = splitType(EphemeraId)[1]
            await publishMessage({
                MessageId: `MESSAGE#${uuidv4()}`,
                CreatedTime: Date.now(),
                Targets: [`ROOM#${RoomId}`, `NOT-CHARACTER#${CharacterId}`],
                DisplayProtocol: "WorldMessage",
                Message: `${Name || 'Someone'} has disconnected.`
            })
        }
        const updateRoomEphemera = async () => {
            const RoomId = newImage.RoomId || oldImage.RoomId
            const { EphemeraId, Name, Color, ConnectionId } = newImage
            const CharacterId = splitType(EphemeraId)[1]
            if (RoomId) {
                await roomOccupancyEphemera({
                    CharacterId,
                    RoomId,
                    Name,
                    Color,
                    ConnectionId,
                    anchorTime: epochTime,
                    isActive: false,
                    //
                    // If no newImage record, remove character from this room
                    // and all rooms
                    //
                    isInactive: Boolean(newImage.RoomId),
                    wasActive: oldImage.Connected
                })
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
