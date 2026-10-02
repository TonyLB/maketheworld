import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { relationKindAndLabelFrom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { Assertion, Change, GroundedReferent, PlanStep } from '../plan/planStep'
import type { MutationKernelStep } from '../../../../positions/manipulation/kernel/kernelStep'
import { groundAssertion } from './groundAssertion'
import { groundChange } from './groundChange'
import type { GroundingContext } from './groundReferent'
import { expandSameHost } from './expandSameHost'
import type {
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
 * the order given. Matches the existing `[sameHostAssertion, change]` seed order
 * convention (BD-15(1)). A move's boundary dissolves are not the executor's to find:
 * Expansion adds them to the attempt as facilitating actions, and the caller seeds them
 * grounded, ahead of the move (BD-28's order), through `seedFromGroundedSteps`.
 */
export const seedFromUngroundedSteps = (steps: readonly PlanStep[]): WorklistInstruction[] =>
    steps.map((step) => ({ id: mintInstructionId(), tag: 'ungrounded', step }))

/**
 * Lowers a grounded `transferMembership` step (Expansion's facilitating dissolves) to its
 * executor effect, reading each referent's `groundedId`. Such a step never meets
 * `groundChange`, so a grounded non-Room host (an actor's inventory graph) is not
 * filtered by its derived-host Room check. A mistyped id is a caller contract
 * violation and throws. Assertions are not lowered: none is produced grounded.
 *
 * A grounded relational `Change` (`establishRelation`/`dissolveRelation`) has no
 * lowering here: it has no `host` to read (AP-7) and never lowers straight to a
 * step --- every relational edge command-expands into a chain instead (AP-6/AP-8).
 */
const lowerGroundedStep = (step: PlanStep<GroundedReferent>): ExecutorParsePlanStep => {
    if (step.kind === 'assertion') {
        throw new Error(`seedFromGroundedSteps: a grounded '${step.predicate}' assertion has no lowering`)
    }
    if (step.primitive !== 'transferMembership') {
        throw new Error(`seedFromGroundedSteps: a grounded '${step.primitive}' change has no direct lowering --- it must command-expand`)
    }
    const objectId = step.object.groundedId
    const fromHostId = step.from.groundedId
    const toHostId = step.to.groundedId
    if (!isEphemeraObjectId(objectId) || !isEphemeraMembershipHostId(fromHostId) || !isEphemeraMembershipHostId(toHostId)) {
        throw new Error(`seedFromGroundedSteps: ill-typed transferMembership ids (${objectId}, ${fromHostId}, ${toHostId})`)
    }
    return { kind: 'transferMembership', objectIds: new Set([objectId]), fromHostId, toHostId }
}

/**
 * Seeds fully grounded steps as `grounded` instructions, in the order given, skipping
 * Grounding entirely (a `runExecutor` seed may carry grounded instructions directly). A
 * grounded relational `Change` seeds as-is (AP-8): it command-expands into a chain rather
 * than lowering directly, since it carries no `host` (AP-7). Everything else (today, only
 * `transferMembership`) lowers through `lowerGroundedStep` as before.
 */
export const seedFromGroundedSteps = (steps: readonly PlanStep<GroundedReferent>[]): WorklistInstruction[] =>
    steps.map((step) => (
        step.kind === 'change' && step.primitive !== 'transferMembership'
            ? { id: mintInstructionId(), tag: 'grounded' as const, step }
            : { id: mintInstructionId(), tag: 'grounded' as const, step: lowerGroundedStep(step) }
    ))

type GroundResult =
    | { ok: true; step: ExecutorParsePlanStep | GroundedAssertion }
    | { ok: false; reason: string }

/**
 * Grounds one `ungrounded` instruction. Reuses `groundChange`/`groundAssertion` unchanged.
 * `groundChange` never returns an `establishRelation`/`dissolveRelation` candidate any more
 * (AP-7/AP-8: relational `Change`s ground by substitution in the producer, not here), so the
 * two branches below are confirmed dead on every live route today, but are still real code the
 * type system must satisfy against `groundChange`'s declared return type.
 */
const groundInstruction = (step: Change | Assertion, context: GroundingContext): GroundResult => {
    if (step.kind === 'change') {
        const result = groundChange(step, context)
        if (!result.ok) {
            return { ok: false, reason: result.reason }
        }
        if (result.candidates.length !== 1) {
            return {
                ok: false,
                reason: `Grounding produced ${result.candidates.length} candidates --- expected exactly one (BD-32; unreachable once the outer per-candidate layer has already selected one)`,
            }
        }
        const candidate = result.candidates[0]!
        if (candidate.kind === 'establishRelation') {
            return {
                ok: true,
                step: {
                    kind: 'establishRelation',
                    subjectId: candidate.subjectId,
                    targetId: candidate.targetId,
                    hostId: candidate.hostRoomId,
                    ...relationKindAndLabelFrom(candidate),
                },
            }
        }
        if (candidate.kind === 'dissolveRelation') {
            return {
                ok: true,
                step: {
                    kind: 'dissolveRelation',
                    subjectId: candidate.subjectId,
                    targetId: candidate.targetId,
                    hostId: candidate.hostRoomId,
                    ...relationKindAndLabelFrom(candidate),
                },
            }
        }
        return { ok: true, step: candidate }
    }

    const result = groundAssertion(step, context)
    if (!result.ok) {
        return { ok: false, reason: result.reason }
    }
    return { ok: true, step: result.assertion }
}

type CommandExpandOutcome =
    | { kind: 'retire'; output: ExecutorParsePlanStep }
    /**
     * `extraKernelSteps` carries kernel-only steps a `children` `WorklistInstruction`
     * cannot (`addCrossingPort`/`removeCrossingPort` are not `ExecutorParsePlanStep`s --- the
     * same reason `MutationKernelSetPresencePortStep` is emitted by the compiler, not the
     * executor, elsewhere). Only ever present (and non-empty) for a `sameHost` crossing; every
     * other command-expansion omits it, so existing callers/tests are unaffected.
     */
    | { kind: 'consumed'; children: WorklistInstruction[]; extraKernelSteps?: MutationKernelStep[] }
    | { kind: 'defer'; decidable: boolean; reason: string }
    | { kind: 'error'; reason: string }

/**
 * Dispatches per specific primitive/predicate, never on `kind: 'change' | 'assertion'`
 * (BD-34 review correction). `transferMembership`/`establishRelation`/`dissolveRelation`
 * retire directly (atomic effects); a grounded relational `Change` (`establishRelation`/
 * `dissolveRelation` primitive) evaluates live state and retires as a generator, minting 0+
 * children --- replacing the retired `GroundedSameHostAssertion`/`'sameHost'` case (AP-8).
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
            // Leg steps (establishRelation/dissolveRelation, already executor-shaped) retire
            // through the ordinary worklist; the port-record steps (addCrossingPort) cannot ---
            // they are not an ExecutorParsePlanStep --- so they ride the side-channel instead.
            const legSteps = result.steps.filter(
                (kernelStep): kernelStep is Extract<MutationKernelStep, { kind: 'establishRelation' | 'dissolveRelation' }> =>
                    kernelStep.kind === 'establishRelation' || kernelStep.kind === 'dissolveRelation'
            )
            const portSteps = result.steps.filter((kernelStep) => kernelStep.kind !== 'establishRelation' && kernelStep.kind !== 'dissolveRelation')
            const children: WorklistInstruction[] = legSteps.map((legStep) => ({
                id: mintInstructionId(),
                tag: 'grounded' as const,
                step: legStep,
            }))
            return { kind: 'consumed', children, ...(portSteps.length > 0 ? { extraKernelSteps: portSteps } : {}) }
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
    /**
     * `extraKernelSteps`: kernel-only steps minted during command-expansion that cannot
     * ride `steps` (see `CommandExpandOutcome`'s doc comment) --- only present, and only
     * non-empty, when a `sameHost` crossing minted at least one `addCrossingPort`/
     * `removeCrossingPort`. A caller building a step sequence must include these alongside
     * `steps`, in the order collected --- no ordering dependency between them and the legs, at
     * any chain depth (`addCrossingPort`/`removeCrossingPort` and a relational step
     * referencing that port commute, since port-address validation is owner-only, never by
     * `portId`; see `compileRelationalFromSkeleton.ts`'s own merge for the full trace).
     */
    | { verdict: 'legal'; steps: readonly ExecutorParsePlanStep[]; extraKernelSteps?: readonly MutationKernelStep[] }
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
 * phase (1): every child minted during a run is already grounded (`sameHost`'s
 * crossing legs), so only a seed can carry an `ungrounded` instruction. A caller that
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
    const output: ExecutorParsePlanStep[] = []
    const extraKernelSteps: MutationKernelStep[] = []

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
        if (commandResult.extraKernelSteps) {
            extraKernelSteps.push(...commandResult.extraKernelSteps)
        }
        worklist = [...commandResult.children, ...rest]
    }

    return { verdict: 'legal', steps: output, ...(extraKernelSteps.length > 0 ? { extraKernelSteps } : {}) }
}
