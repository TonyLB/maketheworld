/**
 * Terminal affordance publish on Affordances Pertain (D38): thread lookup first, then perspective-filtered roster fallback.
 */
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../internalCache'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { AffordancesPertainPayload } from '../affordanceCache/publishedEvents'
import { isSessionOrientationAffordancesPerceptionThread } from '../../internalCache/perceptionThreads'
import { getCharacterRoomPerspectiveKey } from './kickRoomHeaderBroadcast'
import {
    publishAffordancePerceptionForCharacters,
    publishAffordancePerceptionForPerspective,
} from './publishAffordancePerceptionForCharacters'

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
    const entries = internalCache.PerceptionThreads.list(roomId, perspectiveKey)
    const affordanceThreads = entries.filter(
        (entry) => (
            entry.registration.threadKind === 'sessionOrientationAffordances'
            && isSessionOrientationAffordancesPerceptionThread(entry.thread)
        )
    )

    if (affordanceThreads.length > 0) {
        const deliveries = affordanceThreads.flatMap((entry) => {
            if (!isSessionOrientationAffordancesPerceptionThread(entry.thread)) {
                return []
            }
            const { thread, registration } = entry
            if (registration.threadKind !== 'sessionOrientationAffordances') {
                return []
            }
            if (thread.status === 'Terminal') {
                return []
            }
            if (!registration.targets.length) {
                return []
            }
            return [{
                targets: registration.targets,
                messageGroupId: registration.messageGroupId,
                registrationId: entry.registrationId,
            }]
        })

        if (deliveries.length > 0) {
            await publishAffordancePerceptionForPerspective({
                roomId,
                perspectiveKey,
                deliveries: deliveries.map(({ targets, messageGroupId }) => ({
                    targets,
                    messageGroupId,
                })),
                messageBus: bus,
            })
            for (const { registrationId } of deliveries) {
                internalCache.PerceptionThreads.remove({
                    componentId: roomId,
                    perspectiveKey,
                    registrationId,
                })
            }
        }
        return
    }

    const targets = await resolveAffordanceTargetsForPerspective(roomId, perspectiveKey)
    await publishAffordancePerceptionForCharacters({
        roomId,
        perspectiveKey,
        characterIds: targets,
        messageBus: bus,
    })
}
