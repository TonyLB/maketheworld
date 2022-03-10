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
    //
    // TODO: Temporarily default Color to result from slicing CharacterId.
    //
    const CharacterId = splitType(EphemeraId)[1]
    const setString = [
        ...(isActive ? ['activeCharacters.#characterId = :character'] : []),
        ...(isInactive ? ['inactiveCharacters.#characterId = :character'] : [])
    ].join(', ')
    const removeString = [
        ...(isActive ? [] : ['activeCharacters.#characterId']),
        ...(isInactive ? [] : ['inactiveCharacters.#characterId'])
    ].join(', ')
    const UpdateExpression = [
        ...(setString ? [`SET ${setString}`] : []),
        ...(removeString ? [`REMOVE ${removeString}`] : [])
    ].join(' ')

    return await ephemeraDB.update({
        EphemeraId: RoomKey(RoomId),
        DataCategory: 'Meta::Room',
        UpdateExpression,
        ConditionExpression: "attribute_exists(activeCharacters) AND attribute_exists(inactiveCharacters)",
        ExpressionAttributeNames: { "#characterId": EphemeraId },
        ...((isActive || isInactive)
            ? {
                ExpressionAttributeValues: {
                    ':character': {
                        EphemeraId,
                        Name,
                        Color: Color || defaultColorFromCharacterId(CharacterId),
                        fileURL: fileURL,
                        ConnectionIds
                    }
                }
            } 
            : {}
        ),
        ...(returnValues ? { ReturnValues: 'ALL_NEW' } : {})
    })
}

export default characterEphemeraDenormalize
