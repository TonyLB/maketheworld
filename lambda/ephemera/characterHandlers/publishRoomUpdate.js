import { v4 as uuidv4 } from 'uuid'
import { publishMessage } from '/opt/utilities/dynamoDB/index.js'

import { splitType } from '/opt/utilities/types.js'

export const publishRoomUpdate = ({ RoomId, notCharacterId, epochTime }) => ({ activeCharacters = {} }) => {
    const Characters = Object.values(activeCharacters).map(({ EphemeraId, ...rest }) => ({
        CharacterId: splitType(EphemeraId)[1],
        ...rest
    }))
    return publishMessage({
        MessageId: `MESSAGE#${uuidv4()}`,
        CreatedTime: epochTime,
        Targets: [`ROOM#${RoomId}`, `NOT-CHARACTER#${notCharacterId}`],
        RoomId,
        DisplayProtocol: 'RoomUpdate',
        Characters
    })
}

export default publishRoomUpdate
