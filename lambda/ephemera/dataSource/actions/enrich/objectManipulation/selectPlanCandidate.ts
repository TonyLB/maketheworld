import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { CommandAttempt } from '../../commandAttempt'
import { adjudicateAttempt } from '../../commandAttempt/adjudicate'
import { attemptActionsFromBoundaryOutcomes } from '../../commandAttempt/expandBoundaryChallenges'
import {
    T_JOINT_ABS,
    T_JOINT_ABS_UNARY,
    T_JOINT_MARGIN,
} from './embeddingMatch/thresholds'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { groundMembershipCandidate } from './proposeMembershipCandidates'
import type { IdentityPlanCandidate, IdentityPlanIdentity, MembershipPlanStub } from './identityPlanCandidate'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { SandboxState } from './sandboxState'
import type { ConsultAlternative, SpanCandidateLocus, SpanResolutionOutcome } from './spanResolution'
import type { ExpansionEnvironment } from './synthesize/executorTypes'
import { runExecutor, seedFromGroundedSteps } from './synthesize/executor'
import { groundChange } from './synthesize/groundChange'
import {
    actingCharacterRef,
    currentHostRef,
    derivedReferentKey,
    isGroundedStep,
    type GroundedReferent,
    type PlanStep,
    type ReferentAssignment,
    type TransferMembershipChange,
} from './plan/planStep'
import { validateMembershipPlanDryRun } from './validatePlanDryRun'
import type { DryRunOutcome, ValidatedPlan } from './validatePlanDryRun'

/**
 * AP-1's stage sketch (`AGENT.commandAttemptPipeline.planning.md#stage-sketch`): the
 * selection unit every producer builds and the shared stage consumes. `identities` is the
 * joint assignment, one entry per `stableRefKey` --- membership populates a single entry
 * today and keeps reading its own flat `identity` field (below); a multi-referent producer
 * (relational, slice 2a) is the first real reader of the map form.
 */
export type PlanCandidate = {
    identities: ReadonlyMap<string, IdentityPlanIdentity>
    confidence: number
    /**
     * Not yet expanded (no boundary actions) or adjudicated. Grounded exactly where the
     * route's assignment is already complete at this point: relational's producer grounds
     * fully here (its `Change` has no derived referents at all, AP-6/AP-7/AP-8). Membership's
     * does not --- its `from`/`to` are derived, so its attempt stays wholly ungrounded until
     * `sandboxMembershipDryRun`'s `groundMembershipDesiredResult` has a sandbox snapshot to
     * build the derived half from (AP-10).
     */
    attempt: CommandAttempt
}

/** Built by the route (sandbox state, prefetch), not by the stage itself. */
export type PlanStageEnvironment = {
    expansion: ExpansionEnvironment
}

/**
 * Membership's own candidate, extending `PlanCandidate` with what its exit needs (AP-1's
 * stage sketch), replacing `GroundedMembershipCandidate`. `desiredResult` is the exact
 * value the attempt's primary action wraps, carried alongside so `sandboxMembershipDryRun`
 * seeds the executor from it without narrowing the attempt's action family.
 */
export type MembershipPlanCandidate = PlanCandidate & {
    identity: IdentityPlanIdentity
    plan: MembershipPlanStub
    desiredResult: TransferMembershipChange
}

/**
 * The object's actual host, read off its locus --- independent of which operation a
 * candidate claims. Expansion needs this (boundary edges live on the graph the object is
 * really on, whichever operation is proposed); so does exit-edge escalation. Undefined for
 * loci that are not closed-world atomic in v1 (another character's inventory, inside an
 * object), and when the relevant host id is missing. Validation (`validateMembershipPlanDryRun`)
 * is the one place this gets compared against what the step's `from` referent requires.
 */
export const membershipSourceHostId = (
    locus: SpanCandidateLocus,
    roomId: EphemeraRoomId | undefined,
    actorCharacterId: EphemeraCharacterId | undefined
): EphemeraMembershipHostId | undefined => {
    if (locus.kind === 'room') {
        return roomId
    }
    if (locus.kind === 'heldByActor') {
        return actorCharacterId
    }
    return undefined
}

/**
 * Expand + Adjudicate, the shared stage's half of AP-1's ground + expand split. Grounding
 * itself does not run here (AP-10): the primary action's `desiredResult` stays ungrounded
 * until `sandboxMembershipDryRun`'s `groundMembershipDesiredResult` has a sandbox snapshot
 * to ground its derived `from`/`to` against; this function only reads concrete values already
 * in hand (`candidate.identity`, `roomId`, `actorCharacterId`), never the step's own referents.
 * Expansion adds one facilitating action per boundary edge from the candidate's source graph
 * (each already fully grounded --- `graphNode` referents, born grounded), with a graph
 * challenge on each `defer`; Adjudicate then judges the challenges it may (`adjudicateAttempt`),
 * so the dry run validates a judged attempt. A candidate with no source graph skips expansion.
 */
export const expandAndAdjudicateMembershipCandidate = (
    candidate: MembershipPlanCandidate,
    environment: PlanStageEnvironment,
    roomId: EphemeraRoomId | undefined,
    actorCharacterId: EphemeraCharacterId | undefined
): MembershipPlanCandidate => {
    const { objectId, locus } = candidate.identity
    const sourceHostId = membershipSourceHostId(locus, roomId, actorCharacterId)
    const sourceGraph = sourceHostId !== undefined ? environment.expansion.getGraph(sourceHostId) : undefined
    const primaryAction = candidate.attempt.actions()[0]!
    const actions = sourceGraph !== undefined
        ? attemptActionsFromBoundaryOutcomes(primaryAction, new Set([objectId]), sourceGraph)
        : [primaryAction]

    return {
        ...candidate,
        attempt: adjudicateAttempt(CommandAttempt.create(candidate.attempt.words, candidate.attempt.referents(), actions)),
    }
}

/** Builds the stage's `expansion` environment from the sandbox-state-backed graph lookup
 * `sandboxMembershipDryRun` already builds inline, named once per AP-1's sketch. */
export const membershipPlanStageEnvironment = (
    sandboxState: SandboxState,
    roomId: EphemeraRoomId | undefined,
    actorCharacterId: EphemeraCharacterId | undefined
): PlanStageEnvironment => ({
    expansion: {
        getGraph: (hostId) => sandboxState.get(hostId),
        // Not read by Expand (`attemptActionsFromBoundaryOutcomes` takes the graph directly);
        // declared only to satisfy `ExpansionEnvironment`'s shape.
        getCurrentHost: () => undefined,
        getMembershipContainers: () => [],
    },
})

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

export type ScoredIdentityPlanCandidate = ScoredPlanCandidate<MembershipPlanCandidate>

export type SelectIdentityPlanTupleResult = SelectPlanTupleResult<MembershipPlanCandidate>

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
 * AP-10's derived half, built against the sandbox snapshot this dry run holds --- the only
 * place membership's two derived referents (`actingCharacter`, `currentHost(actingCharacter)`)
 * can be resolved, since Plan/the producer never see sandbox state. Not a generic graph
 * walk: `roomId`/`actorCharacterId`, validated non-undefined by the caller, already ARE
 * these two values (locus decides which of the two is the move's source vs. destination for
 * takeHold vs. drop; either way, both referents ground to the same pair). Combined with the
 * span half (freshly built from `candidate.identity.objectId`, since the producer no longer
 * grounds the step at all --- `groundMembershipCandidate`'s doc comment) into one complete
 * `ReferentAssignment`, so `groundChange` grounds the whole step in a single, total pass.
 */
const groundMembershipDesiredResult = (
    step: TransferMembershipChange,
    objectId: EphemeraObjectId,
    actorCharacterId: EphemeraCharacterId,
    roomId: EphemeraRoomId
): TransferMembershipChange<GroundedReferent> => {
    const stableRefKey = step.object.referentType === 'objectSpan' ? step.object.stableRefKey : undefined
    if (stableRefKey === undefined) {
        // planMembershipDesiredResult always stamps one; reaching here is a construction bug.
        throw new Error('groundMembershipDesiredResult: desired result has no object stableRefKey to ground against')
    }
    const assignment: ReferentAssignment = {
        spans: new Map([[stableRefKey, objectId]]),
        derived: new Map([
            [derivedReferentKey(actingCharacterRef), actorCharacterId],
            [derivedReferentKey(currentHostRef(actingCharacterRef)), roomId],
        ]),
    }
    return groundChange(step, assignment) as TransferMembershipChange<GroundedReferent>
}

/**
 * Membership dry run: validates an already-expanded, adjudicated attempt (built by the
 * producer, then this stage's `expandAndAdjudicateMembershipCandidate` --- neither grounds
 * the primary step; see their doc comments). `validateMembershipPlanDryRun`'s
 * locus-vs-operationKind base check (FT-2.2 --- "declared drop but object is on the room
 * graph", exit-edge defer) runs first, as an up-front gate. Then the attempt's result
 * decides:
 * - `pending`: a challenge Adjudicate may not judge (an `Under` subject-move) defers to the
 *   complexity LLM, as before;
 * - `impossible`: illegal;
 * - `succeeded`: the primary step is grounded in full (`groundMembershipDesiredResult`, one
 *   `groundChange` call, span and derived together --- AP-10), then the attempt is seeded
 *   and run through the executor. Facilitating dissolves (already fully grounded ---
 *   `graphNode` referents, born grounded) seed first, BD-28's order; the newly-grounded
 *   primary `transferMembership` seeds last. Every seeded step is grounded by construction,
 *   so nothing here mirrors the executor's former mid-worklist grounding phase (retired,
 *   AP-10).
 *
 * The executor no longer classifies boundary edges itself: Expansion did, once, and a met
 * challenge is lowered like any other facilitating action. The commit side does not re-run
 * this: `planObjectMoveTransfer` re-derives the boundary sweep against a later snapshot and
 * honors the attempt's met edges.
 */
export const sandboxMembershipDryRun = (
    candidate: MembershipPlanCandidate,
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

    if (actorCharacterId === undefined || roomId === undefined) {
        // Narrows both for groundMembershipDesiredResult below. Unreachable in practice: the
        // sourceHostId/destinationHostId check above already requires both defined, for
        // either locus (room's source is roomId, heldByActor's destination is roomId; the
        // other locus mirrors it for actorCharacterId).
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

    const groundedPrimary = groundMembershipDesiredResult(candidate.desiredResult, objectId, actorCharacterId, roomId)
    // actions()[0] is always the primary action (attemptActionsFromBoundaryOutcomes's own
    // return shape: `[primaryAction, ...boundaryActions]`), so the rest are facilitating
    // dissolves, already fully grounded (graphNode referents). Seeded first, BD-28's order;
    // the newly-grounded primary seeds last.
    const facilitatingSteps = candidate.attempt.actions()
        .slice(1)
        .map((action) => action.desiredResult)
        .filter((step): step is PlanStep<GroundedReferent> => step !== undefined && isGroundedStep(step))
    const seed = seedFromGroundedSteps([...facilitatingSteps, groundedPrimary])
    const env: ExpansionEnvironment = {
        getGraph: (hostId) => state.get(hostId),
        getCurrentHost: () => sourceHostId,
        getMembershipContainers: () => [],
    }

    const outcome = runExecutor(seed, env)

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
    const environment = membershipPlanStageEnvironment(sandboxState, roomId, actorCharacterId)
    const expanded = candidates
        .map((candidate) => groundMembershipCandidate(candidate, { words, span: commandSpan, catalog }))
        .map((candidate) => expandAndAdjudicateMembershipCandidate(candidate, environment, roomId, actorCharacterId))
    return selectPlanTuple({
        candidates: expanded,
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
