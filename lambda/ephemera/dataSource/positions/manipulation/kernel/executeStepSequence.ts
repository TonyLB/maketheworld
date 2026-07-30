import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { commitStepSequence, type CommitStepSequenceDeps } from './commitStepSequence'
import { presentStepSequence, type PresentStepSequenceDeps } from './presentStepSequence'
import { isKernelMutationStep, type KernelStep } from './kernelStep'
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
 * Iteration 9/Phase 3's sequencing contract: invoke the positionGraph (mutation) kernel first,
 * `await` its commit to completion, and only then invoke the perception kernel against the same
 * shared, already-grounded `KernelStep[]` list --- never list order, never parallel. This is a
 * property of *invocation* (the `await` below), not an assumption baked into how `steps` happens to
 * be ordered; a caller must not rely on `describe` steps trailing mutation steps in the array.
 *
 * If the commit does not succeed (`ok: false` --- stale candidate, concurrent modification, transact
 * failure), the perception kernel is never invoked: a description must reflect final committed
 * state, and there is no committed state to describe when the mutation half aborted.
 *
 * No live production caller yet (Phase 4 --- Plan-stage dispatch for object-directed look --- is
 * what gives this a real command route); this is the shared entry point that caller will use.
 */
export const executeStepSequence = async (
    steps: readonly KernelStep[],
    characterId: EphemeraCharacterId,
    deps: ExecuteStepSequenceDeps
): Promise<MutationKernelCommitResult> => {
    const mutationSteps = steps.filter(isKernelMutationStep)
    const commitResult = await commitStepSequence({ steps: mutationSteps }, deps.commit)
    if (!commitResult.ok) {
        return commitResult
    }

    await presentStepSequence(steps, characterId, deps.perceive, commitResult.captures)

    return commitResult
}
