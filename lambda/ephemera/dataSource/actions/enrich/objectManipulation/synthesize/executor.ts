import { relationKindAndLabelFrom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { Assertion, Change, GroundedReferent, PlanStep } from '../plan/planStep'
import { groundAssertion } from './groundAssertion'
import { groundChange } from './groundChange'
import type { GroundingContext } from './groundReferent'
import { expandSameHost } from './expandSameHost'
import type {
    ExecutorOutputStep,
    ExecutorParsePlanStep,
    ExpansionEnvironment,
    GroundedAssertion,
    GroundedRelationalChange,
    InstructionId,
    WorklistInstruction,
} from './executorTypes'
import { isExecutorParsePlanStep } from './executorTypes'

let instructionIdCounter = 0
const mintInstructionId = (): InstructionId => {
    instructionIdCounter += 1
    return `instr-${instructionIdCounter}`
}

/**
 * Seeds an ordered list of Plan-emitted `PlanStep`s directly, tagged `ungrounded`, in
 * the order given (BD-15(1)). A move's boundary dissolves are not the executor's to find:
 * Expansion adds them to the attempt as facilitating actions, and the caller seeds them
 * grounded, ahead of the move (BD-28's order), through `seedFromGroundedSteps`.
 */
export const seedFromUngroundedSteps = (steps: readonly PlanStep[]): WorklistInstruction[] =>
    steps.map((step) => ({ id: mintInstructionId(), tag: 'ungrounded', step }))

type GroundedInstructionStepResult =
    | { ok: true; step: ExecutorParsePlanStep | GroundedRelationalChange }
    | { ok: false; reason: string }

/**
 * The one choice a grounded `Change` makes on its way into the worklist, shared by
 * seeding (`seedFromGroundedSteps`) and Grounding (`groundInstruction`). A relational
 * `Change` stays as it is: it has no `host` and command-expands into a chain
 * (AP-6) rather than lowering straight to a step. A `transferMembership` lowers to its
 * executor effect, here, where each id is checked for its slot; Grounding attaches ids
 * without typing them. A grounded non-Room host (an actor's inventory graph) is admitted.
 */
const groundedInstructionStep = (change: Change<GroundedReferent>): GroundedInstructionStepResult => {
    if (change.primitive !== 'transferMembership') {
        return { ok: true, step: change }
    }
    const objectId = change.object.groundedId
    const fromHostId = change.from.groundedId
    const toHostId = change.to.groundedId
    if (!isEphemeraObjectId(objectId) || !isEphemeraMembershipHostId(fromHostId) || !isEphemeraMembershipHostId(toHostId)) {
        return { ok: false, reason: `ill-typed transferMembership ids (${objectId}, ${fromHostId}, ${toHostId})` }
    }
    return { ok: true, step: { kind: 'transferMembership', objectIds: new Set([objectId]), fromHostId, toHostId } }
}

/**
 * Seeds fully grounded steps as `grounded` instructions, in the order given, skipping
 * Grounding entirely (a `runExecutor` seed may carry grounded instructions directly), through
 * `groundedInstructionStep`. A mistyped id is a caller contract violation and throws.
 * Assertions are not seeded: none is produced grounded.
 */
export const seedFromGroundedSteps = (steps: readonly PlanStep<GroundedReferent>[]): WorklistInstruction[] =>
    steps.map((step) => {
        if (step.kind === 'assertion') {
            throw new Error(`seedFromGroundedSteps: a grounded '${step.predicate}' assertion has no lowering`)
        }
        const result = groundedInstructionStep(step)
        if (!result.ok) {
            throw new Error(`seedFromGroundedSteps: ${result.reason}`)
        }
        return { id: mintInstructionId(), tag: 'grounded' as const, step: result.step }
    })

type GroundResult =
    | { ok: true; step: ExecutorParsePlanStep | GroundedAssertion | GroundedRelationalChange }
    | { ok: false; reason: string }

/**
 * Grounds one `ungrounded` instruction: `groundChange` gives the one grounded `Change`
 * (AP-1), and `groundedInstructionStep` makes the same choice seeding makes.
 */
const groundInstruction = (step: Change | Assertion, context: GroundingContext): GroundResult => {
    if (step.kind === 'change') {
        const result = groundChange(step, context)
        if (!result.ok) {
            return result
        }
        return groundedInstructionStep(result.change)
    }

    const result = groundAssertion(step, context)
    if (!result.ok) {
        return { ok: false, reason: result.reason }
    }
    return { ok: true, step: result.assertion }
}

type CommandExpandOutcome =
    | { kind: 'retire'; output: ExecutorOutputStep }
    /**
     * BD-30's generator: the instruction is replaced by its minted children, pushed to the
     * front. No command-expansion produces one today --- a relational edge retires as one
     * chain instead (AP-6) --- but it is the worklist's mechanism for an instruction that
     * expands into further instructions, which containment's two-step plans (slice 3c) are
     * expected to need.
     */
    | { kind: 'consumed'; children: WorklistInstruction[] }
    | { kind: 'defer'; decidable: boolean; reason: string }
    | { kind: 'error'; reason: string }

/**
 * Dispatches per specific primitive/predicate, never on `kind: 'change' | 'assertion'`
 * (BD-34 review correction). `transferMembership`/`establishRelation`/`dissolveRelation`
 * retire directly (atomic effects); a grounded relational `Change` (`establishRelation`/
 * `dissolveRelation` primitive) evaluates live state and retires as its whole chain, one
 * `ExecutorRelationalChain` (AP-6), lowered to kernel steps only after selection.
 * `containedBy` has no shipped evaluation logic anywhere in this codebase yet (verified: no
 * live route implements it) --- errors rather than fabricating behavior, per "grow the
 * technique set as concrete cases demand."
 */
const commandExpand = (
    step: ExecutorParsePlanStep | GroundedAssertion | GroundedRelationalChange,
    env: ExpansionEnvironment
): CommandExpandOutcome => {
    if (isExecutorParsePlanStep(step)) {
        return { kind: 'retire', output: step }
    }

    if (step.kind === 'change') {
        const subjectId = step.subject.groundedId
        const targetId = step.target.groundedId
        if (!isEphemeraObjectId(subjectId) || !isEphemeraObjectId(targetId)) {
            return { kind: 'error', reason: `commandExpand: ill-typed ${step.primitive} ids (${subjectId}, ${targetId})` }
        }
        const result = expandSameHost(
            {
                subjectId,
                objectId: targetId,
                operationKind: step.primitive,
                ...relationKindAndLabelFrom(step),
            },
            env
        )
        if (result.verdict === 'crossed') {
            return { kind: 'retire', output: { kind: 'relationalChain', operationKind: step.primitive, steps: result.chain } }
        }
        if (result.verdict === 'defer') {
            return { kind: 'defer', decidable: result.decidable, reason: result.reason }
        }
        return { kind: 'error', reason: result.reason }
    }

    switch (step.predicate) {
        case 'containedBy':
            return {
                kind: 'error',
                reason: 'containedBy command-expansion is not yet implemented --- no concrete worked example requires it this slice',
            }
    }
}

export type ExecutorOutcome =
    | { verdict: 'legal'; steps: readonly ExecutorOutputStep[] }
    | { verdict: 'defer'; decidable: boolean; reason: string }
    | { verdict: 'error'; reason: string }

/**
 * BD-30's phase-stratified worklist, realized. Priority per iteration: (1)
 * ground the first `ungrounded`; (2) else command-expand the frontmost item,
 * retiring it into the output list (atomic effect) or replacing it with its
 * minted children pushed to the front (generator). Strict list-order (FIFO)
 * selection at every phase, plus push-to-front, is what gives BD-28's
 * sequencing resolution its guarantee --- no separate priority tier needed.
 * Grounding never widens an operand set: an object's hosted contents live in
 * its own shard and travel with it, so no phase between grounding and
 * command-expansion computes a moved set.
 *
 * `groundingContext` is optional because a fully-grounded seed never reaches
 * phase (1): any child minted during a run is already grounded, so only a seed can
 * carry an `ungrounded` instruction. A caller that
 * already holds concrete ids can seed `grounded` instructions directly
 * (`seedFromGroundedSteps`) and omit it, rather than assembling a context whose
 * resolutions would be identity mappings. Seeding an `ungrounded` instruction without
 * one is a caller error and errors out.
 */
export const runExecutor = (
    seed: readonly WorklistInstruction[],
    env: ExpansionEnvironment,
    groundingContext?: GroundingContext
): ExecutorOutcome => {
    let worklist: WorklistInstruction[] = [...seed]
    const output: ExecutorOutputStep[] = []

    while (worklist.length > 0) {
        const ungroundedIndex = worklist.findIndex((item) => item.tag === 'ungrounded')
        if (ungroundedIndex >= 0) {
            const item = worklist[ungroundedIndex]!
            if (item.tag !== 'ungrounded') {
                continue
            }
            if (groundingContext === undefined) {
                return {
                    verdict: 'error',
                    reason: 'runExecutor: an ungrounded instruction was seeded without a GroundingContext',
                }
            }
            const result = groundInstruction(item.step, groundingContext)
            if (!result.ok) {
                return { verdict: 'error', reason: result.reason }
            }
            worklist = worklist.map((entry, index) =>
                index === ungroundedIndex ? { id: item.id, tag: 'grounded' as const, step: result.step } : entry
            )
            continue
        }

        const [frontmost, ...rest] = worklist
        if (frontmost === undefined || frontmost.tag !== 'grounded') {
            return { verdict: 'error', reason: 'Internal error: expected a grounded frontmost instruction' }
        }
        const commandResult = commandExpand(frontmost.step, env)
        if (commandResult.kind === 'error') {
            return { verdict: 'error', reason: commandResult.reason }
        }
        if (commandResult.kind === 'defer') {
            return { verdict: 'defer', decidable: commandResult.decidable, reason: commandResult.reason }
        }
        if (commandResult.kind === 'retire') {
            output.push(commandResult.output)
            worklist = rest
            continue
        }
        worklist = [...commandResult.children, ...rest]
    }

    return { verdict: 'legal', steps: output }
}
