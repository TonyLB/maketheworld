import { v4 as uuidv4 } from 'uuid'

import { publishMessage } from '/opt/utilities/dynamoDB/index.js'

import characterEphemeraDenormalize from './characterEphemeraDenormalize.js'
import publishRoomUpdate from './publishRoomUpdate.js'

export const publishRoomAndCharacterMessage = async ({
    CreatedTime,
    RoomId,
    CharacterId,
    Message
}) => {
    await publishMessage({
        MessageId: `MESSAGE#${uuidv4()}`,
        CreatedTime,
        Targets: [`CHARACTER#${CharacterId}`, `ROOM#${RoomId}`],
        DisplayProtocol: "WorldMessage",
        Message
    })
}

export const roomOccupancyEphemera = async ({
    CharacterId,
    RoomId,
    Name,
    Color,
    ConnectionIds,
    anchorTime,
    isActive,
    isInactive,
    wasActive
}) => {
    const characterData = await characterEphemeraDenormalize({
        EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
        RoomId,
        Name,
        Color,
        ConnectionIds,
        isActive,
        isInactive,
        returnValues: true
    })
    if (isActive || wasActive) {
        await publishRoomUpdate({
            notCharacterId: CharacterId,
            epochTime: anchorTime + 2,
            RoomId
        })(characterData)
    }
}
