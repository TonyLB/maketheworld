import { MoveCharacterMessage, MessageBus } from "../messageBus/baseClasses"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

export const moveCharacter = async ({ payloads }: { payloads: MoveCharacterMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async (payload) => {
        //
        // TODO: Validate the RoomId as one that is valid for the character to move to, before
        // pushing data to the DB.
        //
        await ephemeraDB.update({
            EphemeraId: `CHARACTER#${payload.characterId}`,
            DataCategory: 'Meta::Character',
            UpdateExpression: 'SET RoomId = :roomId',
            ExpressionAttributeValues: {
                ':roomId': payload.roomId
            }
        })

        //
        // TODO: Transactional update of Character, departing Room and arriving Room in Ephemera table
        //

        //
        // TODO: Publish departure and arrival messages
        //

        //
        // TODO: Update room ephemera for departing and arriving room
        //

        //
        // TODO: Publish roomHeader message to travelling character
        //
    }))
}

export default moveCharacter
