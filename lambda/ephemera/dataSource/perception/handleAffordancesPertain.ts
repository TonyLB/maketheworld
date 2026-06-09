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

    let skippedSessionOrientationTerminal = 0
    let skippedSessionOrientationEmptyTargets = 0
    let publishedSessionOrientationAffordances = 0

    if (affordanceThreads.length > 0) {
        const deliveries = affordanceThreads.flatMap((entry) => {
            if (!isSessionOrientationAffordancesPerceptionThread(entry.thread)) {
                return []
            }
            const { thread, registration, registrationId } = entry
            if (registration.threadKind !== 'sessionOrientationAffordances') {
                return []
            }
            if (thread.status === 'Terminal') {
                skippedSessionOrientationTerminal += 1
                return []
            }
            if (!registration.targets.length) {
                skippedSessionOrientationEmptyTargets += 1
                return []
            }
            return [{
                targets: registration.targets,
                messageGroupId: registration.messageGroupId,
                registrationId,
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
            publishedSessionOrientationAffordances = deliveries.length
            for (const { registrationId } of deliveries) {
                internalCache.PerceptionThreads.remove({
                    componentId: roomId,
                    perspectiveKey,
                    registrationId,
                })
            }
        }

        const summary = {
            roomId,
            perspectiveKey,
            bucketSize: entries.length,
            sessionOrientationThreadCount: affordanceThreads.length,
            publishedSessionOrientationAffordances,
            skippedSessionOrientationTerminal,
            skippedSessionOrientationEmptyTargets,
            deliveryPath: 'sessionOrientationAffordances' as const,
            fallbackTargetsMatched: 0,
            fallbackPublished: 0,
        }
        if (publishedSessionOrientationAffordances === 0) {
            console.warn('[mtw.ephemera.perception] handleAffordancesPertain: session orientation threads present but no publish', summary)
        }
        else {
            console.log('[mtw.ephemera.perception] handleAffordancesPertain', summary)
        }
        return
    }

    const targets = await resolveAffordanceTargetsForPerspective(roomId, perspectiveKey)
    const fallbackPublished = targets.length
    await publishAffordancePerceptionForCharacters({
        roomId,
        perspectiveKey,
        characterIds: targets,
        messageBus: bus,
    })

    const summary = {
        roomId,
        perspectiveKey,
        bucketSize: entries.length,
        sessionOrientationThreadCount: 0,
        publishedSessionOrientationAffordances: 0,
        skippedSessionOrientationTerminal: 0,
        skippedSessionOrientationEmptyTargets: 0,
        deliveryPath: 'rosterFallback' as const,
        fallbackTargetsMatched: targets.length,
        fallbackPublished,
    }
    if (entries.length === 0 && targets.length === 0) {
        console.warn('[mtw.ephemera.perception] handleAffordancesPertain: no threads and no roster matches', summary)
    }
    else {
        console.log('[mtw.ephemera.perception] handleAffordancesPertain', summary)
    }
}
