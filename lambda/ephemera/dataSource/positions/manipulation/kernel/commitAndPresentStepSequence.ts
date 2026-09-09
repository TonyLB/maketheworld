import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { sendMessageBundleDeclared } from '../../../messageOrchestration/subscribedEvents'
import { commitStepSequence, type CommitStepSequenceDeps } from './commitStepSequence'
import { presentStepSequence, type PresentStepSequenceDeps } from './presentStepSequence'
import { isKernelMutationStep } from './kernelStep'
import type { CompiledPositionKernelPlan } from './compile/compilePositionKernelOp'
import type { MutationKernelCommitResult } from './types'

/**
 * `commit`/`perceive` stay two separate dependency bags (not one merged `streamEvent`) because they
 * publish onto genuinely different bus payload scopes --- `commitStepSequence` streams
 * `PositionsPublishedPayload` (`Object Moved`/`Character Moved`/`Object Relation Changed`),
 * `presentStepSequence` streams `ActionsPublishedPayload` (`Look Command Requested`). Intersecting
 * them under one `streamEvent` field would force a caller to hand-construct a function satisfying
 * both `StreamEventFunction` instantiations at once, which isn't the actual shape of the bus.
 */
export type CommitAndPresentStepSequenceDeps = {
    commit: CommitStepSequenceDeps
    perceive: PresentStepSequenceDeps
}

/**
 * The generic commit-then-present composer (renamed from `executeStepSequence` in 3g --- `execute`
 * named a tier ambiguously across this stack; this function computes nothing of its own, it only
 * sequences two tiers, so its name says what it does rather than borrowing a tier verb). Under the
 * Phase 3 tier rule this is the licensed **composer** case, not an `orchestrate*` function: remove the
 * calls to `commitStepSequence`/`presentStepSequence` and there is no decision left in the body.
 *
 * Iteration 9/Phase 3's sequencing contract: invoke the ludicGraph (mutation) kernel first,
 * `await` its commit to completion, and only then invoke the perception kernel against the same
 * shared, already-grounded compiled plan --- never list order, never parallel. This is a
 * property of *invocation* (the `await` below), not an assumption baked into how `steps` happens to
 * be ordered; a caller must not rely on `describe` steps trailing mutation steps in the array.
 *
 * If the commit does not succeed (`ok: false` --- stale candidate, concurrent modification, transact
 * failure), the perception kernel is never invoked: a description must reflect final committed
 * state, and there is no committed state to describe when the mutation half aborted.
 *
 * Takes a `CompiledPositionKernelPlan` rather than bare `KernelStep[]` (3e) --- `plan.slots` is
 * the one thing every hand-rolled commit-then-present caller (`orchestrateObjectMove.ts` before that
 * slice) had to wedge a `sendMessageBundleDeclared` call between the two legs for; that declare call
 * lives inside this composer instead. `bundleId` is only read when `plan.slots.length > 0` --- a
 * plan with no slots (e.g. a bare `describe`, which never declares a bundle) can pass any string.
 *
 * Live callers: `actions/index.ts`'s object-directed `look` dispatch, and `orchestrateObjectMove.ts`
 * (take/drop/give). The character routes (navigate/home/connect/disconnect) do **not** call this ---
 * `orchestrateCharacterRoomMembership` already commits internally, and navigate additionally needs
 * its eviction-ladder write to run in parallel with presentation rather than serially after commit,
 * which this composer's strictly-serial shape cannot express (see `orchestrateCharacterMove.ts`'s own
 * doc comment for that carve-out).
 */
export const commitAndPresentStepSequence = async (
    plan: CompiledPositionKernelPlan,
    bundleId: string,
    characterId: EphemeraCharacterId,
    deps: CommitAndPresentStepSequenceDeps
): Promise<MutationKernelCommitResult> => {
    const mutationSteps = plan.steps.filter(isKernelMutationStep)
    const commitResult = await commitStepSequence({ steps: mutationSteps }, deps.commit)
    if (!commitResult.ok) {
        return commitResult
    }

    if (plan.slots.length > 0) {
        sendMessageBundleDeclared(deps.perceive.messageBus, bundleId, { bundleId, slots: [...plan.slots] })
    }

    await presentStepSequence(plan.steps, characterId, deps.perceive, commitResult.captures)

    return commitResult
}
