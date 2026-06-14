import { MoveCharacterMessage, MessageBus } from "../messageBus/baseClasses"
import { executeCharacterNavigate } from "./executeCharacterNavigate"

export type { RoomStackItem } from '../dataSource/positions/membership/types'

export const moveCharacter = async ({ payloads, messageBus }: { payloads: MoveCharacterMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async (payload) => {
        const { characterId, roomId, ...rest } = payload
        await executeCharacterNavigate({
            characterId,
            targetRoomId: roomId,
            messageBus,
            payload: rest,
        })
    }))
}

export default moveCharacter
