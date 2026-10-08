import { relationKindAndLabelFrom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { Change, GroundedReferent, PlanStep } from '../plan/planStep'
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

type GroundedInstructionStepResult =
    | { ok: true; step: ExecutorParsePlanStep | GroundedRelationalChange }
    | { ok: false; reason: string }

/**
 * The one choice a grounded `Change` makes on its way into the worklist (`seedFromGroundedSteps`,
 * the only seeder --- the executor's own grounding phase is retired, so every seed is already
 * grounded). A relational `Change` stays as it is: it has no `host` and command-expands into a
 * chain rather than lowering straight to a step. A `transferMembership` lowers to its
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
    return { ok: true, step: { kind: 'transferMembership', objectId, fromHostId, toHostId } }
}

/**
 * Seeds fully grounded steps as worklist instructions, in the order given --- the only
 * seeder (grounding happens once, completely, before anything is seeded; the
 * executor's own grounding phase retired), through `groundedInstructionStep`. A mistyped
 * id is a caller contract violation and throws. Assertions are not seeded: none is
 * produced grounded.
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
        return { id: mintInstructionId(), step: result.step }
    })

type CommandExpandOutcome =
    | { kind: 'retire'; output: ExecutorOutputStep }
    /**
     * BD-30's generator: the instruction is replaced by its minted children, pushed to the
     * front. No command-expansion produces one today --- a relational edge retires as one
     * chain instead --- but it is the worklist's mechanism for an instruction that
     * expands into further instructions. (Containment, once expected to need it, rides a
     * `containment` flag on its one `transferMembership` step instead.)
     */
    | { kind: 'consumed'; children: WorklistInstruction[] }
    | { kind: 'defer'; decidable: boolean; reason: string }
    | { kind: 'error'; reason: string }

/**
 * Dispatches per specific primitive/predicate, never on `kind: 'change' | 'assertion'`
 * (BD-34 review correction). `transferMembership`/`establishRelation`/`dissolveRelation`
 * retire directly (atomic effects); a grounded relational `Change` (`establishRelation`/
 * `dissolveRelation` primitive) evaluates live state and retires as its whole chain, one
 * `ExecutorRelationalChain`, lowered to kernel steps only after selection.
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
 * BD-30's phase-stratified worklist, realized. Every instruction entering this loop is
 * already grounded (grounding happens once, completely, before seeding --- the
 * executor's former grounding phase, which used to ground the first `ungrounded`
 * instruction ahead of command-expansion each iteration, retired along with it). So there
 * is one phase left: command-expand the frontmost item, retiring it into the output list
 * (atomic effect) or replacing it with its minted children pushed to the front (generator).
 * Strict list-order (FIFO) selection, plus push-to-front, is what gives BD-28's sequencing
 * resolution its guarantee. Grounding never widened an operand set and still doesn't: an
 * object's hosted contents live in its own shard and travel with it, so no phase computes a
 * moved set.
 */
export const runExecutor = (
    seed: readonly WorklistInstruction[],
    env: ExpansionEnvironment
): ExecutorOutcome => {
    let worklist: WorklistInstruction[] = [...seed]
    const output: ExecutorOutputStep[] = []

    while (worklist.length > 0) {
        const [frontmost, ...rest] = worklist
        if (frontmost === undefined) {
            return { verdict: 'error', reason: 'Internal error: expected a frontmost instruction' }
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
