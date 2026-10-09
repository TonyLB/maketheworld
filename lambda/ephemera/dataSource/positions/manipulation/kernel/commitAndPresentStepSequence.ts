import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

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
 * A successful commit also reports the first presentation index the plan did not use, so a caller
 * with further lines for the same beat (`deliverNarrationUnits`) continues the stamping.
 */
export type CommitAndPresentResult =
    | (Extract<MutationKernelCommitResult, { ok: true }> & { nextPresentationIndex: number })
    | Extract<MutationKernelCommitResult, { ok: false }>

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
 * Takes a `CompiledPositionKernelPlan` rather than bare `KernelStep[]` (3e). Presentation order
 * comes from the plan's own `narrate`/`describe` steps, stamped from the commit's `beatAnchorTime`
 * (see `presentStepSequence`); no bundle is declared.
 *
 * Live callers: `actions/index.ts`'s object-directed `look` dispatch, the object-move route
 * (take/drop/give, via `commitAttempt`), and every character route (navigate/home/connect/disconnect,
 * ghost-purge and legal-placement repair, via `orchestrateCharacterMove`). A character move's
 * post-commit work (the eviction-ladder write, the `CharacterMeta` invalidate, `CharacterInPlay`) is
 * a `Character Moved` subscriber in `mtw.ephemera.characters`, so it runs off the bus rather than
 * between commit and presentation.
 */
export const commitAndPresentStepSequence = async (
    plan: CompiledPositionKernelPlan,
    characterId: EphemeraCharacterId,
    deps: CommitAndPresentStepSequenceDeps
): Promise<CommitAndPresentResult> => {
    const mutationSteps = plan.steps.filter(isKernelMutationStep)
    const commitResult = await commitStepSequence({ steps: mutationSteps }, deps.commit)
    if (!commitResult.ok) {
        return commitResult
    }

    const nextPresentationIndex = await presentStepSequence(
        plan.steps,
        characterId,
        deps.perceive,
        commitResult.captures,
        commitResult.beatAnchorTime
    )

    return { ...commitResult, nextPresentationIndex }
}
