import { v4 as uuidv4 } from 'uuid'
import { splitType } from '/opt/utilities/types.js'
import { render } from '/opt/perception/index.js'
import publishRoomUpdate from './publishRoomUpdate.js'
import characterEphemeraDenormalize from './characterEphemeraDenormalize.js'
import { publishMessage } from '/opt/utilities/dynamoDB/index.js'

export const checkForConnect = async ({ oldImage, newImage }) => {
    const epochTime = Date.now()
    if (!oldImage.EphemeraId || (!(oldImage.Connected ?? false) && newImage.Connected)) {
        if (newImage.Connected) {
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
                    CharacterId,
                    assets: ['TEST'],
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
                const { RoomId, EphemeraId, Name, Color, ConnectionId } = newImage
                if (RoomId) {
                    const CharacterId = splitType(EphemeraId)[1]
                    try {
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
                            isInactive: true,
                            returnValues: true
                        })
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
