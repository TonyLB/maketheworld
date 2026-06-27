import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import { applyCharacterRoomMembership } from '../membership/applyCharacterRoomMembership'
import type { PositionsPublishedPayload } from '../publishedEvents'
import type { MembershipApplyResult } from '../membership/types'
import type { MessageBus } from '../../../messageBus/baseClasses'
import { afterCharacterMembershipNavigateChanged } from './afterCharacterMembershipNavigateChanged'

export type ExecuteCharacterNavigateArgs = {
    characterId: EphemeraCharacterId;
    targetRoomId: EphemeraRoomId;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
}

/**
 * Shared navigate execution: membership persist via positions coordinator, then
 * parallel navigate tail (ladder persist + presentation) when endpoints changed.
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

    await afterCharacterMembershipNavigateChanged({
        characterId,
        characterMeta,
        result,
        messageBus,
    })

    return result
}
