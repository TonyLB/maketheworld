import {
    EphemeraCharacterId,
    EphemeraRoomId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../../internalCache'

export type HomeResolutionResult =
    | { type: 'Resolved'; fromRoomId: EphemeraRoomId; toRoomId: EphemeraRoomId }
    | { type: 'NoExitContext' }
    | { type: 'AlreadyHome' }

export const homeResolutionErrorMessages = {
    noExitContext: 'Home resolution failed: no current room',
    alreadyHome: 'Home resolution failed: already at home',
} as const

export async function resolveHomeTargetForCharacter(
    characterId: EphemeraCharacterId
): Promise<HomeResolutionResult> {
    const containers = await internalCache.Positions.getMembershipContainers(characterId)
    const fromRoomId = containers[0] ?? null
    if (!fromRoomId || !isEphemeraRoomId(fromRoomId)) {
        return { type: 'NoExitContext' }
    }

    const characterMeta = await internalCache.CharacterMeta.get(characterId)
    const toRoomId = characterMeta?.HomeId
    if (!toRoomId || !isEphemeraRoomId(toRoomId)) {
        return { type: 'NoExitContext' }
    }

    if (fromRoomId === toRoomId) {
        return { type: 'AlreadyHome' }
    }

    return { type: 'Resolved', fromRoomId, toRoomId }
}
