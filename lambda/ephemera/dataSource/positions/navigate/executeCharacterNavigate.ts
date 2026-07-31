import { v4 as uuidv4 } from 'uuid'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import { applyCharacterRoomMembership } from '../membership/applyCharacterRoomMembership'
import type { PositionsPublishedPayload } from '../publishedEvents'
import type { MembershipApplyResult, MembershipDiff } from '../membership/types'
import type { MessageBus } from '../../../messageBus/baseClasses'
import { compilePositionKernelOp } from '../manipulation/kernel/compile/compilePositionKernelOp'
import { isKernelMutationStep } from '../manipulation/kernel/kernelStep'
import { buildCharacterMoveOp } from '../membership/buildCharacterMoveOp'
import { afterCharacterMembershipNavigateChanged } from './afterCharacterMembershipNavigateChanged'

export type ExecuteCharacterNavigateArgs = {
    characterId: EphemeraCharacterId;
    targetRoomId: EphemeraRoomId;
    /** messageOrchestration bundle correlation id; when omitted (connect/disconnect/repair callers), a fresh one is minted --- those paths have no fan-in intent leg carrying a matching bundleId anyway, so leave/arrive slots (if any) fall back to direct publish. */
    bundleId?: string;
    /** `navigate` (typed command / UI exit) or `home` --- selects leave/arrive copy-kind (`buildCharacterMoveOp.ts`). Defaults to `navigate`. */
    intentKind?: 'navigate' | 'home';
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
 * Compiles the abstract `Move` op via `compileMutationSteps`, so the committed step sequence is
 * `[capture(from), transfer, capture(to)]` rather than a bare `transferMembership` step --- the
 * mechanism that lets narration be *positionally* bound (its audience resolved mid-walk rather than
 * against the live roster at flush). Narration itself is reported from `orchestrateCharacterNavigate`
 * post-commit, alongside the header slot it already resolves there, not here --- see that function's
 * doc comment for why the op is compiled twice.
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

    const compileMutationSteps = (diff: MembershipDiff) => compilePositionKernelOp(
        buildCharacterMoveOp({
            characterId,
            characterName: characterMeta.Name,
            froms: diff.froms,
            to: diff.to,
            bundleId,
            intentKind,
            intentFromRoomId,
            exitName,
            headerSlot: null,
        })
    ).steps.filter(isKernelMutationStep)

    const result = await applyCharacterRoomMembership(
        { characterId, targetRoomId, compileMutationSteps, narrationHandledInline: true },
        { messageBus, streamEvent }
    )

    await afterCharacterMembershipNavigateChanged({
        characterId,
        characterMeta,
        result,
        bundleId,
        intentKind,
        intentFromRoomId,
        exitName,
        messageBus,
    })

    return result
}
