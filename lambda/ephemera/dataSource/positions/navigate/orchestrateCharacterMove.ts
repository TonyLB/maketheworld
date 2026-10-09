import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import { orchestrateCharacterRoomMembership } from '../manipulation/membership/orchestrateCharacterRoomMembership'
import type { PositionsPublishedPayload } from '../publishedEvents'
import type { MembershipApplyResult, IntentKind } from '../manipulation/membership/types'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { MoveHeaderBinding } from '../manipulation/kernel/compile/positionKernelOp'
import { getCharacterRoomPerspectiveKey } from '../../perception/kickRoomHeaderBroadcast'
import { presentCharacterMove } from './presentCharacterMove'

export type OrchestrateCharacterMoveArgs = {
    characterId: EphemeraCharacterId;
    /** null = out of play (disconnect / ghost-purge repair). */
    targetRoomId: EphemeraRoomId | null;
    /** Selects leave/arrive copy-kind (`buildCharacterMoveOp.ts`) --- forwarded to `orchestrateCharacterRoomMembership`. */
    intentKind: IntentKind;
    /** The intent's own departure room, used to pick exit-aware copy among possibly several `froms`. */
    intentFromRoomId?: EphemeraRoomId;
    /** Normalized exit label, navigate only --- selects `exitAware` copy. */
    exitName?: string;
    /**
     * Pre-fetched character meta (connect already has it, from `resolveConnectTargetRoom`); when
     * omitted and `targetRoomId` is non-null (navigate/home), fetched here. Never fetched for a
     * null target (disconnect/ghost-purge never read it --- only a destination
     * room needs `characterMeta`, for the arrival header's perspective).
     */
    characterMeta?: CharacterMetaItem;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
}

/**
 * The convergence of navigate / home / connect / disconnect (3g's correction), plus
 * `repairRoomOccupancyDrift`'s ghost purge and `repairCharacterLegalPlacement`'s relocation call
 * --- six call sites that were the same operation (membership persist, then present) differing only
 * in `intentKind`, whether there's a destination room, and two optional copy fields. Folds the former
 * `executeCharacterNavigate` (navigate/home) and `afterCharacterMembershipNavigateChanged` (the
 * parallel navigate tail) into one function, gated on `targetRoomId !== null` rather than on which
 * caller you are --- the same discriminator `presentCharacterMove` (3f) already gates on one tier down.
 *
 * Builds and compiles the abstract `Move` op exactly once, before commit (3e) ---
 * `orchestrateCharacterRoomMembership` forwards `intentKind`/`intentFromRoomId`/`exitName` and this
 * function's `resolveHeader` into `planCharacterMoveTransfer`, which builds the compiled plan and
 * carries it through commit; `presentCharacterMove` presents that same plan rather than rebuilding it.
 *
 * The object-move route (`commitAttempt`) is a sibling, not absorbed here --- 3g's correction: it commits or does not
 * depending on entity kind, which is the disjoint-bodies case ruled out for a shared name.
 *
 * Rules: `dataSource/positions/AGENT.contract.md` --- "Narration and presentation".
 */
export const orchestrateCharacterMove = async ({
    characterId,
    targetRoomId,
    intentKind,
    intentFromRoomId,
    exitName,
    characterMeta: suppliedCharacterMeta,
    messageBus,
    streamEvent,
}: OrchestrateCharacterMoveArgs): Promise<MembershipApplyResult> => {
    const characterMeta = targetRoomId !== null
        ? (suppliedCharacterMeta ?? await internalCache.CharacterMeta.get(characterId))
        : suppliedCharacterMeta

    const resolveHeader = targetRoomId !== null
        ? async (to: EphemeraRoomId): Promise<MoveHeaderBinding> => {
            const assets = characterMeta?.assets || []
            return { perspectiveKey: await getCharacterRoomPerspectiveKey(to, assets), assets }
        }
        : undefined

    const result = await orchestrateCharacterRoomMembership(
        { characterId, targetRoomId, intentKind, intentFromRoomId, exitName, resolveHeader },
        { messageBus, streamEvent }
    )

    if (!result.ok || !result.changed) {
        return result
    }

    await presentCharacterMove({
        characterId,
        plan: result.plan,
        captures: result.captures,
        beatAnchorTime: result.beatAnchorTime,
        messageBus,
    })

    return result
}
