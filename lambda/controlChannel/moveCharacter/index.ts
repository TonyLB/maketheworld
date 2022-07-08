import { MoveCharacterMessage, MessageBus } from "../messageBus/baseClasses"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

export const moveCharacter = async ({ payloads }: { payloads: MoveCharacterMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async (payload) => {
        //
        // TODO: Validate the RoomId as one that is valid for the character to move to, before
        // pushing data to the DB.
        //
        await ephemeraDB.update({
            EphemeraId: `CHARACTERINPLAY#${payload.characterId}`,
            DataCategory: 'Meta::Character',
            UpdateExpression: 'SET RoomId = :roomId, leaveMessage = :leave, enterMessage = :enter',
            ExpressionAttributeValues: {
                ':roomId': payload.roomId,
                ':leave': ` left${ payload.exitName ? ` by ${payload.exitName} exit` : ''}.`,
                ':enter': ` arrives.`
            }
        })
    }))
}

export default moveCharacter
