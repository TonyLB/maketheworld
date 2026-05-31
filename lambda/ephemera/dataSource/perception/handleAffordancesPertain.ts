/**
 * Terminal affordance publish on Affordances Pertain (D38): perspective-filtered fan-out via ComponentStackMerge.
 */
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../internalCache'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { AffordancesPertainPayload } from '../affordanceCache/publishedEvents'
import { getCharacterRoomPerspectiveKey } from './kickRoomHeaderBroadcast'
import { publishAffordancePerceptionForCharacters } from './publishAffordancePerceptionForCharacters'

export async function resolveAffordanceTargetsForPerspective(
    roomId: EphemeraRoomId,
    perspectiveKey: string
): Promise<EphemeraCharacterId[]> {
    const occupants = await internalCache.RoomCharacterList.get(roomId)
    if (!occupants.length) {
        return []
    }
    const matches = await Promise.all(
        occupants.map(async ({ EphemeraId }) => {
            const characterId = EphemeraId as EphemeraCharacterId
            const characterMeta = await internalCache.CharacterMeta.get(characterId)
            const characterPerspectiveKey = await getCharacterRoomPerspectiveKey(roomId, characterMeta?.assets || [])
            if (characterPerspectiveKey === perspectiveKey) {
                return characterId
            }
            return null
        })
    )
    return matches.filter((target): target is EphemeraCharacterId => Boolean(target))
}

export async function handleAffordancesPertain(
    payload: AffordancesPertainPayload,
    bus: MessageBus
): Promise<void> {
    const { roomId, perspectiveKey } = payload
    const targets = await resolveAffordanceTargetsForPerspective(roomId, perspectiveKey)
    await publishAffordancePerceptionForCharacters({
        roomId,
        characterIds: targets,
        messageBus: bus,
    })
}
