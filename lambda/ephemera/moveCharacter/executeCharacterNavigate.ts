import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../internalCache'
import { applyCharacterRoomMembership } from '../dataSource/positions/membership/applyCharacterRoomMembership'
import type { MembershipApplyResult } from '../dataSource/positions/membership/types'
import type { MoveCharacterMessage, MessageBus } from '../messageBus/baseClasses'
import { orchestrateCharacterNavigate } from './orchestrateNavigate'

export type ExecuteCharacterNavigateArgs = {
    characterId: EphemeraCharacterId;
    targetRoomId: EphemeraRoomId;
    messageBus: MessageBus;
    payload?: Partial<Omit<MoveCharacterMessage, 'characterId' | 'roomId'>>;
}

/**
 * Shared navigate execution: membership persist via positions coordinator, then
 * post-persist presentation orchestration when endpoints changed.
 */
export const executeCharacterNavigate = async ({
    characterId,
    targetRoomId,
    messageBus,
    payload = {},
}: ExecuteCharacterNavigateArgs): Promise<MembershipApplyResult> => {
    const characterMeta = await internalCache.CharacterMeta.get(characterId)
    const result = await applyCharacterRoomMembership(
        { characterId, targetRoomId },
        { messageBus }
    )

    if (result.ok && result.changed) {
        await orchestrateCharacterNavigate({
            payload: {
                type: 'MoveCharacter',
                characterId,
                roomId: targetRoomId,
                ...payload,
            },
            characterMeta,
            from: result.from,
            to: result.to,
            beatAnchorTime: result.beatAnchorTime,
            messageBus,
        })
    }

    return result
}
