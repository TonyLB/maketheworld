import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    T_JOINT_ABS,
    T_JOINT_ABS_UNARY,
    T_JOINT_MARGIN,
} from './embeddingMatch/thresholds'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import {
    groundMembershipCandidates,
    membershipSourceHostId,
    type GroundedMembershipCandidate,
} from './groundMembershipCandidates'
import type { IdentityPlanCandidate } from './identityPlanCandidate'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { SandboxState } from './sandboxState'
import type { ConsultAlternative, SpanResolutionOutcome } from './spanResolution'
import type { GroundingContext } from './synthesize/groundReferent'
import type { ExpansionEnvironment } from './synthesize/executorTypes'
import { runExecutor, seedFromGroundedSteps, seedFromUngroundedSteps } from './synthesize/executor'
import { isGroundedStep, type PlanStep } from './plan/planStep'
import { validateMembershipPlanDryRun } from './validatePlanDryRun'
import type { DryRunOutcome, ValidatedPlan } from './validatePlanDryRun'

export type ScoredPlanCandidate<T> = {
    candidate: T
    dryRun: DryRunOutcome
}

export type SelectPlanTupleResult<T> =
    | {
        verdict: 'resolved'
        candidate: T
        /** The winning candidate's own dry-run outcome (carries membership's `objectIds`, if any). */
        dryRun: DryRunOutcome
        legalSurvivors: readonly ScoredPlanCandidate<T>[]
    }
    | {
        verdict: 'consult'
        alternatives: readonly ConsultAlternative[]
        legalSurvivors: readonly ScoredPlanCandidate<T>[]
    }
    | {
        verdict: 'defer'
        candidate: T
        dryRun: DryRunOutcome
        deferSurvivors: readonly ScoredPlanCandidate<T>[]
    }
    | {
        verdict: 'abstain'
        reason: string
    }
    | {
        verdict: 'error'
        reason: string
    }

export type SelectPlanTupleInput<T> = {
    candidates: readonly T[]
    getConfidence: (candidate: T) => number
    dryRun: (candidate: T) => DryRunOutcome
    toConsultAlternative: (candidate: T) => ConsultAlternative
}

/**
 * FT-5 cross-tuple selector core: legality partition, then floor + margin on legal survivors.
 */
export function selectPlanTuple<T>(
    input: SelectPlanTupleInput<T>
): SelectPlanTupleResult<T> {
    const { candidates, getConfidence, dryRun, toConsultAlternative } = input

    if (candidates.length === 0) {
        return {
            verdict: 'error',
            reason: objectManipulationErrorMessages.noCatalog,
        }
    }

    const scored: ScoredPlanCandidate<T>[] = candidates.map((candidate) => ({
        candidate,
        dryRun: dryRun(candidate),
    }))

    const legal = scored
        .filter(({ dryRun: outcome }) => outcome.verdict === 'legal')
        .sort((a, b) => getConfidence(b.candidate) - getConfidence(a.candidate))

    if (legal.length > 0) {
        return selectAmongLegal(legal, getConfidence, toConsultAlternative)
    }

    const defer = scored
        .filter(({ dryRun: outcome }) => outcome.verdict === 'defer')
        .sort((a, b) => getConfidence(b.candidate) - getConfidence(a.candidate))

    if (defer.length > 0) {
        return {
            verdict: 'defer',
            candidate: defer[0]!.candidate,
            dryRun: defer[0]!.dryRun,
            deferSurvivors: defer,
        }
    }

    const illegalHead = scored
        .filter(({ dryRun: outcome }) => outcome.verdict === 'illegal')
        .sort((a, b) => getConfidence(b.candidate) - getConfidence(a.candidate))[0]

    return {
        verdict: 'error',
        reason: illegalHead?.dryRun.reason
            ?? objectManipulationErrorMessages.noMatch,
    }
}

function selectAmongLegal<T>(
    legal: ScoredPlanCandidate<T>[],
    getConfidence: (candidate: T) => number,
    toConsultAlternative: (candidate: T) => ConsultAlternative
): SelectPlanTupleResult<T> {
    const head = legal[0]!
    const absFloor = legal.length === 1 ? T_JOINT_ABS_UNARY : T_JOINT_ABS
    const runnerUp = legal[1]
    const headConfidence = getConfidence(head.candidate)
    const margin = runnerUp === undefined
        ? 1
        : headConfidence - getConfidence(runnerUp.candidate)
    const marginPasses = legal.length === 1 || margin >= T_JOINT_MARGIN

    if (headConfidence >= absFloor && marginPasses) {
        return {
            verdict: 'resolved',
            candidate: head.candidate,
            dryRun: head.dryRun,
            legalSurvivors: legal,
        }
    }

    if (
        legal.length > 1
        && headConfidence >= absFloor
        && margin < T_JOINT_MARGIN
    ) {
        return {
            verdict: 'consult',
            alternatives: legal.map(({ candidate }) => toConsultAlternative(candidate)),
            legalSurvivors: legal,
        }
    }

    // Grey band: head below floor (or unary below unary floor) -> Abstain (FT-3.2)
    return {
        verdict: 'abstain',
        reason: objectManipulationErrorMessages.noMatch,
    }
}

export type ScoredIdentityPlanCandidate = ScoredPlanCandidate<GroundedMembershipCandidate>

export type SelectIdentityPlanTupleResult = SelectPlanTupleResult<GroundedMembershipCandidate>

export type SelectIdentityPlanTupleInput = {
    candidates: readonly IdentityPlanCandidate[]
    /** Live KR state (room + acting character's own inventory), for the sandbox-mediated dry run. */
    sandboxState?: SandboxState
    roomId?: EphemeraRoomId
    actorCharacterId?: EphemeraCharacterId
    /** The object phrase: the attempt's desired result refers to it, and Consult proposedCommand strings use it. */
    commandSpan?: string
    /** The player's words, for each candidate's attempt. */
    words?: string
    /** Supplies each candidate's short name and gloss when grounding its attempt. */
    catalog?: readonly ObjectManipulationCatalogEntry[]
}

/**
 * Membership dry run: validates an already-grounded, adjudicated attempt (built by
 * `groundMembershipCandidates`). `validateMembershipPlanDryRun`'s locus-vs-operationKind
 * base check (FT-2.2 --- "declared drop but object is on the room graph", exit-edge defer)
 * runs first, as an up-front gate. Then the attempt's result decides:
 * - `pending`: a challenge Adjudicate may not judge (an `Under` subject-move) defers to the
 *   complexity LLM, as before;
 * - `impossible`: illegal;
 * - `succeeded`: the attempt is lowered and run through the executor. Its fully grounded
 *   steps (Expansion's facilitating dissolves) are seeded first, BD-28's order; the primary
 *   `transferMembership` is seeded ungrounded, and its object already carries the
 *   candidate's `groundedId`, so only `from`/`to` are derived.
 *
 * The executor no longer classifies boundary edges itself: Expansion did, once, and a met
 * challenge is lowered like any other facilitating action. The commit side does not re-run
 * this: `planObjectMoveTransfer` re-derives the boundary sweep against a later snapshot and
 * honors the attempt's met edges.
 */
export const sandboxMembershipDryRun = (
    candidate: GroundedMembershipCandidate,
    state: SandboxState,
    roomId: EphemeraRoomId | undefined,
    actorCharacterId: EphemeraCharacterId | undefined
): DryRunOutcome => {
    const { locus, objectId } = candidate.identity

    if (locus.kind !== 'room' && locus.kind !== 'heldByActor') {
        // heldByOtherCharacter / withinObject: not closed-world atomic in v1 --- unchanged from
        // today; the sandbox has no way to check another character's inventory graph anyway.
        return {
            verdict: 'defer',
            decidable: false,
            reason: objectManipulationErrorMessages.unimplementedAtomicOperation,
        }
    }

    const sourceHostId = membershipSourceHostId(locus, roomId, actorCharacterId)
    const destinationHostId = locus.kind === 'room' ? actorCharacterId : roomId
    if (sourceHostId === undefined || destinationHostId === undefined) {
        return {
            verdict: 'illegal',
            decidable: true,
            reason: objectManipulationErrorMessages.noMembershipHost,
        }
    }

    const sourceGraph = state.get(sourceHostId)
    const baseOutcome = validateMembershipPlanDryRun(candidate, {
        ludicGraph: sourceGraph,
    })
    if (baseOutcome.verdict !== 'legal') {
        return baseOutcome
    }

    if (actorCharacterId === undefined) {
        return { verdict: 'illegal', decidable: true, reason: objectManipulationErrorMessages.noMembershipHost }
    }
    if (sourceGraph === undefined) {
        // Without a source graph, Expansion could not look for boundary edges, so the attempt
        // cannot be trusted as complete.
        return { verdict: 'illegal', decidable: true, reason: `No graph found for host ${sourceHostId}` }
    }

    const result = candidate.attempt.result
    if (result.status === 'pending') {
        return { verdict: 'defer', decidable: true, reason: 'Boundary edge interaction under transfer requires LLM validation (BD-10)' }
    }
    if (result.status === 'impossible') {
        return { verdict: 'illegal', decidable: true, reason: result.reason }
    }

    const { desiredResult } = candidate
    const stableRefKey = desiredResult.object.referentType === 'objectSpan' ? desiredResult.object.stableRefKey : undefined
    if (stableRefKey === undefined) {
        // planMembershipDesiredResult always stamps one; reaching here is a construction bug.
        throw new Error('sandboxMembershipDryRun: desired result has no object stableRefKey to ground against')
    }
    const groundingContext: GroundingContext = {
        actingCharacterId: actorCharacterId,
        resolvedSpans: new Map([[stableRefKey, { verdict: 'resolved', candidateIds: [objectId] }]]),
        getCurrentHost: (componentId) => (componentId === actorCharacterId ? roomId : undefined),
    }
    const steps = candidate.attempt.actions()
        .map((action) => action.desiredResult)
        .filter((step): step is PlanStep => step !== undefined)
    const seed = [
        ...seedFromGroundedSteps(steps.filter(isGroundedStep)),
        ...seedFromUngroundedSteps(steps.filter((step) => !isGroundedStep(step))),
    ]
    const env: ExpansionEnvironment = {
        getGraph: (hostId) => state.get(hostId),
        getCurrentHost: () => sourceHostId,
        getMembershipContainers: () => [],
    }

    const outcome = runExecutor(seed, env, groundingContext)

    if (outcome.verdict === 'error') {
        return { verdict: 'illegal', decidable: true, reason: outcome.reason }
    }
    if (outcome.verdict === 'defer') {
        return { verdict: 'defer', decidable: outcome.decidable, reason: outcome.reason }
    }

    const transferStep = outcome.steps.find(
        (step): step is Extract<typeof step, { kind: 'transferMembership' }> => step.kind === 'transferMembership'
    )
    if (!transferStep) {
        return { verdict: 'illegal', decidable: true, reason: objectManipulationErrorMessages.unimplementedAtomicOperation }
    }

    return {
        verdict: 'legal',
        decidable: true,
        plan: {
            steps: outcome.steps,
            ...(outcome.extraKernelSteps && outcome.extraKernelSteps.length > 0
                ? { extraKernelSteps: outcome.extraKernelSteps }
                : {}),
        },
    }
}

/** The moved object (one entry); anything it hosts travels with its shard (`transferMembership`'s own invariant). */
export const transferredObjectIds = (plan: ValidatedPlan | undefined): EphemeraObjectId[] | undefined => {
    const transferStep = plan?.steps.find(
        (step): step is Extract<typeof step, { kind: 'transferMembership' }> => step.kind === 'transferMembership'
    )
    return transferStep ? [...transferStep.objectIds] : undefined
}

/**
 * Membership FT-5 selector: legality partition, then floor + margin on legal survivors.
 */
export function selectIdentityPlanTuple(
    input: SelectIdentityPlanTupleInput
): SelectIdentityPlanTupleResult {
    const { candidates, sandboxState = new Map(), roomId, actorCharacterId, commandSpan = 'object', words = commandSpan, catalog = [] } = input
    const grounded = groundMembershipCandidates(candidates, {
        words,
        span: commandSpan,
        catalog,
        sandboxState,
        roomId,
        actorCharacterId,
    })
    return selectPlanTuple({
        candidates: grounded,
        getConfidence: (candidate) => candidate.confidence,
        dryRun: (candidate) => sandboxMembershipDryRun(candidate, sandboxState, roomId, actorCharacterId),
        toConsultAlternative: (candidate) =>
            membershipConsultAlternative(candidate, commandSpan),
    })
}

export function membershipConsultAlternative(
    candidate: IdentityPlanCandidate,
    commandSpan: string
): ConsultAlternative {
    void commandSpan
    const verb = candidate.plan.operationKind === 'drop' ? 'drop' : 'take'
    return {
        objectId: candidate.identity.objectId,
        label: candidate.identity.label,
        proposedCommand: `${verb} the ${candidate.identity.label}`,
    }
}

export function selectIdentityPlanTupleToSpanOutcome(
    result: SelectIdentityPlanTupleResult
): SpanResolutionOutcome {
    if (result.verdict === 'resolved') {
        return {
            verdict: 'resolved',
            objectId: result.candidate.identity.objectId,
            locus: result.candidate.identity.locus,
        }
    }
    if (result.verdict === 'consult') {
        return {
            verdict: 'consult',
            alternatives: result.alternatives,
        }
    }
    if (result.verdict === 'defer') {
        return {
            verdict: 'resolved',
            objectId: result.candidate.identity.objectId,
            locus: result.candidate.identity.locus,
        }
    }
    // abstain and error both map to SpanResolutionOutcome error (Abstain is terminal-parse only)
    return {
        verdict: 'error',
        reason: result.reason,
    }
}

export function resolvedObjectIdFromTupleSelection(
    result: SelectIdentityPlanTupleResult
): EphemeraObjectId | undefined {
    if (result.verdict === 'resolved' || result.verdict === 'defer') {
        return result.candidate.identity.objectId
    }
    return undefined
}
