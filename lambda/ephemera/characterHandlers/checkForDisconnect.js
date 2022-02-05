import { v4 as uuidv4 } from 'uuid'
import { splitType } from '/opt/utilities/types.js'
import { publishMessage } from '/opt/utilities/dynamoDB/index.js'
import publishRoomUpdate from './publishRoomUpdate.js'
import characterEphemeraDenormalize from './characterEphemeraDenormalize.js'

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
            const { RoomId, EphemeraId, Name, Color, ConnectionId } = newImage
            const CharacterId = splitType(EphemeraId)[1]
            if (RoomId) {
                try {
                    await characterEphemeraDenormalize({
                        RoomId,
                        EphemeraId,
                        Name,
                        Color,
                        ConnectionId,
                        isActive: false,
                        isInactive: true,
                        returnValues: true
                    }).then(publishRoomUpdate({
                        notCharacterId: CharacterId,
                        epochTime: epochTime + 2,
                        RoomId
                    }))
                }
                catch(event) {
                    console.log(`ERROR: Disconnect updateRoom`)
                }
            }
            else {
                if (oldImage.RoomId) {
                    const { RoomId } = oldImage
                    const CharacterId = splitType(oldImage.EphemeraId)[1]
                    try {
                        await characterEphemeraDenormalize({
                            RoomId,
                            EphemeraId,
                            isActive: false,
                            isInactive: false,
                            returnValues: true
                        }).then(publishRoomUpdate({
                            notCharacterId: CharacterId,
                            epochTime: epochTime + 2,
                            RoomId
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
