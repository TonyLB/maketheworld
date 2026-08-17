import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { boundaryEdgeOutcomes } from '../../../../positions/ludicGraph/expandValidate/interactionUnderTransfer'
import type { Assertion, Change, TransferMembershipChange, UngroundedPlanStep } from '../plan/ungroundedPrimitive'
import type { TransferMembershipStep } from '../parsePlanStep'
import { groundAssertion } from './groundAssertion'
import { groundChange } from './groundChange'
import type { GroundingContext } from './groundReferent'
import { expandSameHost } from './expandSameHost'
import { lookupOrComputeClosure } from './expansionEnvironment'
import type {
    ExecutorParsePlanStep,
    ExpansionEnvironment,
    GroundedAssertion,
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
 * Seeds an ordered list of Plan-emitted `UngroundedPlanStep`s directly, tagged
 * `ungrounded`, in the order given --- the general seeding path for anything
 * that isn't a `transferMembership` (which must go through
 * `seedTransferMembership` instead, so its `isolatedFromRelations` pairing is
 * never forgotten). Matches the existing `[sameHostAssertion, change]` seed
 * order convention (BD-15(1)).
 */
export const seedFromUngroundedSteps = (steps: readonly UngroundedPlanStep[]): WorklistInstruction[] =>
    steps.map((step) => ({ id: mintInstructionId(), tag: 'ungrounded', step }))

/**
 * BD-34's centralized pairing constructor, Plan-seed half: a `transferMembership`
 * `Change` is never seeded alone --- its `isolatedFromRelations` sibling is
 * seeded first (BD-28's sequencing resolution), referencing the same object
 * referent, both `ungrounded`.
 */
export const seedTransferMembership = (change: TransferMembershipChange): WorklistInstruction[] => {
    const isolatedFromRelations: Assertion = {
        kind: 'assertion',
        predicate: 'isolatedFromRelations',
        object: change.object,
    }
    return [
        { id: mintInstructionId(), tag: 'ungrounded', step: isolatedFromRelations },
        { id: mintInstructionId(), tag: 'ungrounded', step: change },
    ]
}

/**
 * BD-34's centralized pairing constructor, grounded half: whatever introduces a
 * concrete `TransferMembershipStep` must do it through here, not push it onto
 * the worklist directly --- otherwise its boundary edges never get swept and
 * `removeObject`'s assert-and-throw (BD-33) spuriously fires on a legitimate,
 * unaddressed edge.
 *
 * Two callers, and repair is only one of them: `expandSameHost`'s `repaired`
 * outcome (wrapped at the call site in `commandExpand` below, leaving
 * `expandSameHost.ts` itself unchanged), and `executeObjectMove`, which seeds
 * the whole worklist this way because at execute time the hosts are already
 * concrete --- there is nothing left for Grounding to resolve. Named for the
 * tag rather than for either caller, so the pairing invariant reads as the
 * general rule it is.
 */
export const seedGroundedTransferMembership = (transferStep: TransferMembershipStep): WorklistInstruction[] => {
    const [startId] = transferStep.objectIds
    if (startId === undefined) {
        throw new Error('seedGroundedTransferMembership: transferStep.objectIds must not be empty')
    }
    return [
        {
            id: mintInstructionId(),
            tag: 'grounded',
            step: { kind: 'assertion', predicate: 'isolatedFromRelations', objectIds: new Set([startId]) },
        },
        { id: mintInstructionId(), tag: 'grounded', step: transferStep },
    ]
}

type GroundResult =
    | { ok: true; step: ExecutorParsePlanStep | GroundedAssertion }
    | { ok: false; reason: string }

/**
 * Grounds one `ungrounded` instruction. Reuses `groundChange`/`groundAssertion`
 * unchanged; strips `hostRoomId` off a grounded relational `Change` (BD-33 ---
 * the executor's own `ExecutorEstablishRelationStep`/`ExecutorDissolveRelationStep`
 * have no host field to carry it in) rather than ever reading it.
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
                    relationKind: candidate.relationKind,
                    ...(candidate.relationLabel !== undefined ? { relationLabel: candidate.relationLabel } : {}),
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
                    relationKind: candidate.relationKind,
                    ...(candidate.relationLabel !== undefined ? { relationLabel: candidate.relationLabel } : {}),
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

/**
 * Operand-expansion is a universal phase every grounded instruction passes
 * through; it is a no-op except where an instance's own semantics define a
 * closable operand set --- today, exactly `transferMembership` and
 * `isolatedFromRelations`, both reusing `lookupOrComputeClosure` (Fix 2), so
 * a paired pair sharing one starting object computes the closure at most once.
 */
const operandExpand = (
    step: ExecutorParsePlanStep | GroundedAssertion,
    env: ExpansionEnvironment
): GroundResult => {
    if (step.kind === 'transferMembership') {
        const [startId] = step.objectIds
        if (startId === undefined) {
            return { ok: false, reason: 'transferMembership has no object to expand' }
        }
        const sourceGraph = env.getGraph(step.fromHostId)
        if (!sourceGraph) {
            return { ok: false, reason: `No graph found for host ${step.fromHostId}` }
        }
        const closure = lookupOrComputeClosure(env, startId, sourceGraph)
        return { ok: true, step: { ...step, objectIds: closure.members } }
    }

    if (step.kind === 'assertion' && step.predicate === 'isolatedFromRelations') {
        const [startId] = step.objectIds
        if (startId === undefined) {
            return { ok: false, reason: 'isolatedFromRelations has no object to expand' }
        }
        const hostId = env.getCurrentHost(startId)
        if (!hostId) {
            return { ok: false, reason: `No current host found for ${startId}` }
        }
        const graph = env.getGraph(hostId)
        if (!graph) {
            return { ok: false, reason: `No graph found for host ${hostId}` }
        }
        const closure = lookupOrComputeClosure(env, startId, graph)
        return { ok: true, step: { ...step, objectIds: closure.members } }
    }

    return { ok: true, step }
}

type CommandExpandOutcome =
    | { kind: 'retire'; output: ExecutorParsePlanStep }
    | { kind: 'consumed'; children: WorklistInstruction[] }
    | { kind: 'defer'; decidable: boolean; reason: string }
    | { kind: 'error'; reason: string }

/**
 * Dispatches per specific primitive/predicate, never on `kind: 'change' | 'assertion'`
 * (BD-34 review correction). `transferMembership`/`establishRelation`/`dissolveRelation`
 * retire directly (atomic effects); `sameHost`/`isolatedFromRelations` evaluate live
 * state and retire as generators, minting 0+ children. `containedBy` has no shipped
 * evaluation logic anywhere in this codebase yet (verified: no live route implements
 * it) --- errors rather than fabricating behavior, per "grow the technique set as
 * concrete cases demand."
 */
const commandExpand = (
    step: ExecutorParsePlanStep | GroundedAssertion,
    env: ExpansionEnvironment
): CommandExpandOutcome => {
    if (isExecutorParsePlanStep(step)) {
        return { kind: 'retire', output: step }
    }

    switch (step.predicate) {
        case 'containedBy':
            return {
                kind: 'error',
                reason: 'containedBy command-expansion is not yet implemented --- no concrete worked example requires it this slice',
            }
        case 'sameHost': {
            if (step.relationKind === undefined) {
                return { kind: 'error', reason: 'sameHost assertion missing relationKind --- required to command-expand' }
            }
            const result = expandSameHost(
                { subjectId: step.subjectId, objectId: step.objectId, relationKind: step.relationKind, negate: step.negate },
                env.getCurrentHost,
                env.getGraph
            )
            if (result.verdict === 'satisfied') {
                return { kind: 'consumed', children: [] }
            }
            if (result.verdict === 'repaired') {
                return { kind: 'consumed', children: seedGroundedTransferMembership(result.transferStep) }
            }
            if (result.verdict === 'defer') {
                return { kind: 'defer', decidable: result.decidable, reason: result.reason }
            }
            return { kind: 'error', reason: result.reason }
        }
        case 'isolatedFromRelations': {
            const [startId] = step.objectIds
            if (startId === undefined) {
                return { kind: 'error', reason: 'isolatedFromRelations has no object to sweep' }
            }
            const hostId = env.getCurrentHost(startId)
            if (!hostId) {
                return { kind: 'error', reason: `No current host found for ${startId}` }
            }
            const graph = env.getGraph(hostId)
            if (!graph) {
                return { kind: 'error', reason: `No graph found for host ${hostId}` }
            }

            const outcomes = boundaryEdgeOutcomes(step.objectIds, graph)

            const carryOutcome = outcomes.find((entry) => entry.outcome === 'carry')
            if (carryOutcome !== undefined) {
                return {
                    kind: 'error',
                    reason: 'Carry closure left a carry-classified edge on the boundary --- internal inconsistency',
                }
            }

            const deferOutcome = outcomes.find((entry) => entry.outcome === 'defer')
            if (deferOutcome !== undefined) {
                return {
                    kind: 'defer',
                    decidable: deferOutcome.edge.kind !== 'Custom',
                    reason: 'Boundary edge interaction under transfer requires LLM validation (BD-10)',
                }
            }

            const dissolveOutcomes = outcomes.filter((entry) => entry.outcome === 'dissolve')
            // LP4 widened HostRelationalEdge.from/to; boundary dissolve is still Object-only
            // in practice here too (see applyObjectRelationalChange.ts's identical fix).
            const children: WorklistInstruction[] = dissolveOutcomes.map((entry) => {
                if (!isEphemeraObjectId(entry.edge.from) || !isEphemeraObjectId(entry.edge.to)) {
                    throw new Error(`Boundary dissolve edge ${entry.edge.from} -> ${entry.edge.to} has a non-Object endpoint`)
                }
                return {
                    id: mintInstructionId(),
                    tag: 'grounded' as const,
                    step: {
                        kind: 'dissolveRelation' as const,
                        subjectId: entry.edge.from,
                        targetId: entry.edge.to,
                        relationKind: entry.edge.kind,
                        ...(entry.edge.relationLabel !== undefined ? { relationLabel: entry.edge.relationLabel } : {}),
                    },
                }
            })
            return { kind: 'consumed', children }
        }
    }
}

export type ExecutorOutcome =
    | { verdict: 'legal'; steps: readonly ExecutorParsePlanStep[] }
    | { verdict: 'defer'; decidable: boolean; reason: string }
    | { verdict: 'error'; reason: string }

/**
 * BD-30's phase-stratified worklist, realized. Priority per iteration: (1)
 * ground the first `ungrounded`; (2) else operand-expand the first
 * `grounded`; (3) else command-expand the frontmost `operandExpanded` item,
 * retiring it into the output list (atomic effect) or replacing it with its
 * minted children pushed to the front (generator). Strict list-order (FIFO)
 * selection at every phase, plus push-to-front, is what gives BD-28's
 * sequencing resolution its guarantee --- no separate priority tier needed.
 *
 * `groundingContext` is optional because a fully-grounded seed never reaches
 * phase (1): every child minted during a run is already grounded (see
 * `seedGroundedTransferMembership` and the `dissolveRelation` children below),
 * so only a seed can carry an `ungrounded` instruction. Callers that already
 * hold concrete ids --- `executeObjectMove` --- omit it rather than assembling
 * a context whose resolutions would be identity mappings. Seeding an
 * `ungrounded` instruction without one is a caller error and errors out.
 */
export const runExecutor = (
    seed: readonly WorklistInstruction[],
    env: ExpansionEnvironment,
    groundingContext?: GroundingContext
): ExecutorOutcome => {
    let worklist: WorklistInstruction[] = [...seed]
    const output: ExecutorParsePlanStep[] = []

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

        const groundedIndex = worklist.findIndex((item) => item.tag === 'grounded')
        if (groundedIndex >= 0) {
            const item = worklist[groundedIndex]!
            if (item.tag !== 'grounded') {
                continue
            }
            const result = operandExpand(item.step, env)
            if (!result.ok) {
                return { verdict: 'error', reason: result.reason }
            }
            worklist = worklist.map((entry, index) =>
                index === groundedIndex ? { id: item.id, tag: 'operandExpanded' as const, step: result.step } : entry
            )
            continue
        }

        const [frontmost, ...rest] = worklist
        if (frontmost === undefined || frontmost.tag !== 'operandExpanded') {
            return { verdict: 'error', reason: 'Internal error: expected an operandExpanded frontmost instruction' }
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
