import { v4 as uuidv4 } from 'uuid'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import { orchestrateCharacterRoomMembership } from '../manipulation/membership/orchestrateCharacterRoomMembership'
import type { PositionsPublishedPayload } from '../publishedEvents'
import type { MembershipApplyResult, ExecuteNavigateIntentKind } from '../manipulation/membership/types'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { MessageOrchestrationSlotSpec } from '../../messageOrchestration/localApiEvents'
import { getCharacterRoomPerspectiveKey } from '../../perception/kickRoomHeaderBroadcast'
import { NAVIGATE_HEADER_SLOT_ID } from './navigateBundleSlotIds'
import { afterCharacterMembershipNavigateChanged } from './afterCharacterMembershipNavigateChanged'

export type ExecuteCharacterNavigateArgs = {
    characterId: EphemeraCharacterId;
    targetRoomId: EphemeraRoomId;
    /** messageOrchestration bundle correlation id; when omitted (connect/disconnect/repair callers), a fresh one is minted --- those paths have no fan-in intent leg carrying a matching bundleId anyway, so leave/arrive slots (if any) fall back to direct publish. */
    bundleId?: string;
    /** `navigate` (typed command / UI exit) or `home` --- selects leave/arrive copy-kind (`buildCharacterMoveOp.ts`). Defaults to `navigate`. */
    intentKind?: ExecuteNavigateIntentKind;
    /** The intent's own departure room (actions' `fromRoomId`), used to pick exit-aware copy among possibly several `froms` (drift repair). */
    intentFromRoomId?: EphemeraRoomId;
    /** Normalized exit label, navigate only --- selects `exitAware` copy. */
    exitName?: string;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
}

/**
 * Shared navigate execution: membership persist via positions coordinator, then
 * parallel navigate tail (ladder persist + presentation) when endpoints changed.
 *
 * Builds and compiles the abstract `Move` op exactly once, before commit (3e, MS-2) ---
 * `orchestrateCharacterRoomMembership` forwards `intentKind`/`intentFromRoomId`/`exitName` and this
 * function's `resolveHeaderSlot` into `planCharacterMoveTransfer`, which builds the compiled plan
 * (`[capture(from), transfer, capture(to), narrate*]`) and carries it through commit. Narration is
 * still *reported* post-commit, by `presentCharacterMove` (audience resolution needs the
 * commit's captured rosters) --- but it presents the same plan built here, rather than rebuilding it.
 *
 * Rules: `dataSource/positions/AGENT.contract.md` --- "Narration and presentation".
 */
export const executeCharacterNavigate = async ({
    characterId,
    targetRoomId,
    bundleId: suppliedBundleId,
    intentKind = 'navigate',
    intentFromRoomId,
    exitName,
    messageBus,
    streamEvent,
}: ExecuteCharacterNavigateArgs): Promise<MembershipApplyResult> => {
    const characterMeta = await internalCache.CharacterMeta.get(characterId)
    const bundleId = suppliedBundleId ?? uuidv4()

    const resolveHeaderSlot = async (to: EphemeraRoomId): Promise<MessageOrchestrationSlotSpec | null> => {
        const perspectiveKey = await getCharacterRoomPerspectiveKey(to, characterMeta.assets || [])
        return perspectiveKey ? {
            slotId: NAVIGATE_HEADER_SLOT_ID,
            expectedPublishType: 'PerceptionMessage',
            componentId: to,
            perspectiveKey,
            targets: [characterId],
            contentStream: 'render',
            format: 'header',
        } : null
    }

    const result = await orchestrateCharacterRoomMembership(
        { characterId, targetRoomId, bundleId, intentKind, intentFromRoomId, exitName, resolveHeaderSlot },
        { messageBus, streamEvent }
    )

    await afterCharacterMembershipNavigateChanged({
        characterId,
        characterMeta,
        result,
        bundleId,
        messageBus,
    })

    return result
}
