import { marshall } from '@aws-sdk/util-dynamodb'
import { UpdateItemCommand } from '@aws-sdk/client-dynamodb'

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

//
// Accepts character information, a room, and whether they are active, inactive, or neither
// in that room.  Returns the promise to send that update to the Ephemera table.
//
export const characterEphemeraDenormalize = ({
    dbClient,
    RoomId,
    EphemeraId,
    Name,
    Color,
    ConnectionId,
    isActive,
    isInactive,
    returnValues
}) => {
    //
    // TODO: Temporarily default Color to result from slicing CharacterId.
    //
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

    const updateArguments = {
        TableName: ephemeraTable,
        Key: marshall({
            EphemeraId: `ROOM#${RoomId}`,
            DataCategory: 'Meta::Room'
        }),
        UpdateExpression,
        ConditionExpression: "attribute_exists(activeCharacters) AND attribute_exists(inactiveCharacters)",
        ExpressionAttributeNames: { "#characterId": EphemeraId },
        ...((isActive || isInactive)
            ? {
                ExpressionAttributeValues: marshall({
                    ':character': { EphemeraId, Name, Color, ConnectionId }
                }, { removeUndefinedValues: true })
            } 
            : {}
        ),
        ...(returnValues ? { ReturnValues: 'ALL_NEW' } : {})
    }
    return dbClient.send(new UpdateItemCommand(updateArguments))
}

export default characterEphemeraDenormalize
