import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../internalCache'
import { applyCharacterRoomMembership } from '../dataSource/positions/membership/applyCharacterRoomMembership'
import type { PositionsPublishedPayload } from '../dataSource/positions/publishedEvents'
import type { MembershipApplyResult } from '../dataSource/positions/membership/types'
import type { MoveCharacterMessage, MessageBus } from '../messageBus/baseClasses'
import { orchestrateCharacterNavigate } from './orchestrateNavigate'

export type ExecuteCharacterNavigateArgs = {
    characterId: EphemeraCharacterId;
    targetRoomId: EphemeraRoomId;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
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
    streamEvent,
    payload = {},
}: ExecuteCharacterNavigateArgs): Promise<MembershipApplyResult> => {
    const characterMeta = await internalCache.CharacterMeta.get(characterId)
    const result = await applyCharacterRoomMembership(
        { characterId, targetRoomId },
        { messageBus, streamEvent }
    )

    if (result.ok && result.changed) {
        await orchestrateCharacterNavigate({
            payload: {
                type: 'MoveCharacter',
                characterId,
                roomId: targetRoomId,
                suppressDeparture: true,
                suppressArrival: true,
                ...payload,
            },
            characterMeta,
            froms: result.froms,
            to: result.to,
            beatAnchorTime: result.beatAnchorTime,
            messageBus,
        })
    }

    return result
}
