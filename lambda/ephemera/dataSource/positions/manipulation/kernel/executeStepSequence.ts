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
export type ExecuteStepSequenceDeps = {
    commit: CommitStepSequenceDeps
    perceive: PresentStepSequenceDeps
}

/**
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
 * Takes a `CompiledPositionKernelPlan` rather than bare `KernelStep[]` (3e, MS-2) --- `plan.slots` is
 * the one thing every hand-rolled commit-then-present caller (`orchestrateObjectMove.ts` before this
 * slice) had to wedge a `sendMessageBundleDeclared` call between the two legs for; that declare call
 * now lives inside this composer instead. `bundleId` is only read when `plan.slots.length > 0` --- a
 * plan with no slots (e.g. a bare `describe`, which never declares a bundle) can pass any string.
 *
 * Live caller: `actions/index.ts`'s object-directed `look` dispatch, in-process.
 */
export const executeStepSequence = async (
    plan: CompiledPositionKernelPlan,
    bundleId: string,
    characterId: EphemeraCharacterId,
    deps: ExecuteStepSequenceDeps
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
