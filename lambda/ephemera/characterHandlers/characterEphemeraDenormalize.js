import { splitType, RoomKey } from '/opt/utilities/types.js'
import { ephemeraDB } from '/opt/utilities/dynamoDB/index.js'
import { defaultColorFromCharacterId } from '/opt/utilities/selfHealing/index.js'

//
// Accepts character information, a room, and whether they are active, inactive, or neither
// in that room.  Returns the promise to send that update to the Ephemera table.
//
export const characterEphemeraDenormalize = async ({
    RoomId,
    EphemeraId,
    Name,
    fileURL,
    Color,
    ConnectionIds,
    isActive,
    isInactive,
    returnValues
}) => {
    const CharacterId = splitType(EphemeraId)[1]

    return await ephemeraDB.optimisticUpdate({
        key: {
            EphemeraId: RoomKey(RoomId),
            DataCategory: 'Meta::Room'
        },
        updateKeys: ['activeCharacters', 'inactiveCharacters'],
        updateReducer: (draft) => {
            if (draft.activeCharacters === undefined) {
                draft.activeCharacters = {}
            }
            if (draft.inactiveCharacters === undefined) {
                draft.inactiveCharacters = {}
            }
            if (isActive) {
                draft.activeCharacters[EphemeraId] = {
                    EphemeraId,
                    Name,
                    Color: Color || defaultColorFromCharacterId(CharacterId),
                    fileURL: fileURL,
                    ConnectionIds
                }
            }
            else {
                if (EphemeraId in draft.activeCharacters) {
                    draft.activeCharacters[EphemeraId] = undefined
                }
            }
            if (isInactive) {
                draft.inactiveCharacters[EphemeraId] = {
                    EphemeraId,
                    Name,
                    Color: Color || defaultColorFromCharacterId(CharacterId),
                    fileURL: fileURL,
                    ConnectionIds
                }
            }
            else {
                if (EphemeraId in draft.inactiveCharacters) {
                    draft.inactiveCharacters[EphemeraId] = undefined
                }
            }
        },
        ...(returnValues ? { ReturnValues: 'ALL_NEW' } : {})
    })
}

export default characterEphemeraDenormalize
