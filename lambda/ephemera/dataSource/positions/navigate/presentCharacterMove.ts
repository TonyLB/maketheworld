import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { ActionsPublishedPayload } from '../../actions/publishedEvents'
import { MessageBus } from '../../../messageBus/baseClasses'
import { presentStepSequence } from '../manipulation/kernel/presentStepSequence'
import type { MutationKernelCaptures } from '../manipulation/kernel/types'
import type { CompiledPositionKernelPlan } from '../manipulation/kernel/compile/compilePositionKernelOp'

/** A move's compiled plan carries its header as a header-bound `describe` step, which `presentStepSequence` delivers itself, so this dep is structurally unused --- present only because `PresentStepSequenceDeps` requires it. */
const noopActionsStreamEvent: StreamEventFunction<ActionsPublishedPayload> = async () => {}

export type PresentCharacterMoveArgs = {
    characterId: EphemeraCharacterId;
    /**
     * The plan `planCharacterMoveTransfer` already compiled pre-commit (3e) --- this function
     * presents it, it does not rebuild it. Absent means the move had nothing to compile (an unchanged
     * membership, or repair's own navigate-tail calls with no matching intent).
     */
    plan?: CompiledPositionKernelPlan;
    /** The commit's captured rosters, from `orchestrateCharacterRoomMembership`'s result --- required to resolve narration audiences. */
    captures?: MutationKernelCaptures;
    /** The commit's beat anchor, from the same result: the plan's presentation steps are stamped from it. */
    beatAnchorTime?: number;
    messageBus: MessageBus;
}

/**
 * Post-persist character-move presentation (S1-13, merged with disconnect's presentation 3f):
 * presents the move's compiled plan --- leave and arrive narration, and (navigate/connect) the
 * arrival header as a header-bound `describe` step, in the compiler's order, each stamped
 * `beatAnchorTime + index`. Does not perform membership Dynamo writes or `RoomUpdate`/`EphemeraUpdate`
 * (the coordinator owns those). Named `present*`, not `orchestrate*`: it never calls commit, so under
 * the Phase 3 tier rule it does the core work of exactly one tier.
 *
 * The `Move` op is built and compiled exactly **once**, pre-commit, by `planCharacterMoveTransfer`
 * (3e) --- including the header binding, since `to` and `characterMeta.assets` (the only inputs
 * `getCharacterRoomPerspectiveKey` needs) are both known before commit. This function only presents
 * the resulting plan.
 */
export const presentCharacterMove = async ({
    characterId,
    plan,
    captures,
    beatAnchorTime,
    messageBus,
}: PresentCharacterMoveArgs): Promise<void> => {
    if (!plan) {
        return
    }

    await presentStepSequence(
        plan.steps,
        characterId,
        { streamEvent: noopActionsStreamEvent, messageBus },
        captures,
        beatAnchorTime
    )
}
