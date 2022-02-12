import { v4 as uuidv4 } from 'uuid'
import { splitType } from '/opt/utilities/types.js'
import { render } from '/opt/utilities/perception/index.js'
import { publishMessage } from '/opt/utilities/dynamoDB/index.js'
import { roomOccupancyEphemera } from './utilities.js'

export const checkForConnect = async ({ oldImage, newImage }) => {
    const epochTime = Date.now()
    if (!oldImage.EphemeraId || (!(oldImage.Connected ?? false) && newImage.Connected)) {
        const connectMessage = async () => {
            const { Name, RoomId, EphemeraId } = newImage
            const CharacterId = splitType(EphemeraId)[1]
            const roomMessage = await render({
                CharacterId,
                EphemeraId: `ROOM#${newImage.RoomId}`,
            })
            await Promise.all([
                publishMessage({
                    MessageId: `MESSAGE#${uuidv4()}`,
                    CreatedTime: epochTime + 1,
                    Targets: [`ROOM#${RoomId}`, `NOT-CHARACTER#${CharacterId}`],
                    DisplayProtocol: "WorldMessage",
                    Message: `${Name || 'Someone'} has connected.`
                }),
                publishMessage({
                    MessageId: `MESSAGE#${uuidv4()}`,
                    CreatedTime: epochTime,
                    Targets: [`CHARACTER#${CharacterId}`],
                    DisplayProtocol: 'RoomHeader',
                    ...roomMessage
                })
            ])
        }
        const updateRoomEphemera = async () => {
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
                    //
                    // Technically (though it's unlikely) the character record could
                    // somehow be created in a non-connected state, and need to be
                    // populated into the inactive portion of a room
                    //
                    isActive: newImage.Connected,
                    isInactive: !newImage.Connected,
                    wasActive: false
                })
            }
        }
        //
        // Update ephemera first, then deliver messages as appropriate
        //
        await updateRoomEphemera()
        if (newImage.Connected) {
            await connectMessage()
        }
    }
    return {}
}
