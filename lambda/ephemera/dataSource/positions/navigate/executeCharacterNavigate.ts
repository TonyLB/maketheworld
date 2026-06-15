import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import { applyCharacterRoomMembership } from '../membership/applyCharacterRoomMembership'
import type { PositionsPublishedPayload } from '../publishedEvents'
import type { MembershipApplyResult } from '../membership/types'
import type { MessageBus } from '../../../messageBus/baseClasses'
import { orchestrateCharacterNavigate } from './orchestrateNavigate'

export type ExecuteCharacterNavigateArgs = {
    characterId: EphemeraCharacterId;
    targetRoomId: EphemeraRoomId;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
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
}: ExecuteCharacterNavigateArgs): Promise<MembershipApplyResult> => {
    const characterMeta = await internalCache.CharacterMeta.get(characterId)
    const result = await applyCharacterRoomMembership(
        { characterId, targetRoomId },
        { messageBus, streamEvent }
    )

    if (result.ok && result.changed) {
        await orchestrateCharacterNavigate({
            characterId,
            characterMeta,
            froms: result.froms,
            to: result.to,
            beatAnchorTime: result.beatAnchorTime,
            messageBus,
        })
    }

    return result
}
