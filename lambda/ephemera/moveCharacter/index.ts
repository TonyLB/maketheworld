import { MoveCharacterMessage, MessageBus } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import { applyCharacterRoomMembership } from "../dataSource/positions/membership/applyCharacterRoomMembership"
import { orchestrateCharacterNavigate } from "./orchestrateNavigate"

export type { RoomStackItem } from '../dataSource/positions/membership/types'

export const moveCharacter = async ({ payloads, messageBus }: { payloads: MoveCharacterMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async (payload) => {
        const characterMeta = await internalCache.CharacterMeta.get(payload.characterId)
        const result = await applyCharacterRoomMembership(
            { characterId: payload.characterId, targetRoomId: payload.roomId },
            { messageBus }
        )

        if (result.ok && result.changed) {
            await orchestrateCharacterNavigate({
                payload,
                characterMeta,
                from: result.from,
                to: result.to,
                beatAnchorTime: result.beatAnchorTime,
                messageBus,
            })
        }
    }))
}

export default moveCharacter
