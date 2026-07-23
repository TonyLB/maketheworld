import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    T_JOINT_ABS,
    T_JOINT_ABS_UNARY,
    T_JOINT_MARGIN,
} from './embeddingMatch/thresholds'
import type { IdentityPlanCandidate } from './identityPlanCandidate'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { SandboxState } from './sandboxState'
import type { SpanResolutionConsultAlternative, SpanResolutionOutcome } from './spanResolution'
import { actingCharacterRef, currentHostRef, objectSpanRef } from './plan/ungroundedPrimitive'
import type { GroundingContext } from './synthesize/groundReferent'
import { createExpansionEnvironment } from './synthesize/expansionEnvironment'
import { runExecutor, seedTransferMembership } from './synthesize/executor'
import { validateMembershipPlanDryRun } from './validatePlanDryRun'
import type { DryRunOutcome } from './validatePlanDryRun'

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
        alternatives: readonly SpanResolutionConsultAlternative[]
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
    toConsultAlternative: (candidate: T) => SpanResolutionConsultAlternative
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
    toConsultAlternative: (candidate: T) => SpanResolutionConsultAlternative
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

export type ScoredIdentityPlanCandidate = ScoredPlanCandidate<IdentityPlanCandidate>

export type SelectIdentityPlanTupleResult = SelectPlanTupleResult<IdentityPlanCandidate>

export type SelectIdentityPlanTupleInput = {
    candidates: readonly IdentityPlanCandidate[]
    /** Live KR state (room + acting character's own inventory), for the sandbox-mediated dry run. */
    sandboxState?: SandboxState
    roomId?: EphemeraRoomId
    actorCharacterId?: EphemeraCharacterId
    /** Used to build Consult proposedCommand strings. */
    commandSpan?: string
}

/**
 * Executor-mediated membership dry run (Migrate slice, 2026-07-23): invokes the
 * general Synthesize executor (`seedTransferMembership` + `runExecutor`) in
 * place of `expandTransferMembership` + `evaluateSandboxPlan`, so this dry run
 * exercises exactly the same Grounding -> Expansion -> command-expansion path
 * the live commit side (`executeObjectTakeHold`/`executeObjectDrop`) re-runs at
 * commit time --- one instance of the general executor, not a route-specific
 * one-off. `validateMembershipPlanDryRun`'s locus-vs-operationKind base check
 * (FT-2.2 --- "declared drop but object is on the room graph", exit-edge defer)
 * is orthogonal to Expansion's carry-closure/boundary-sweep and stays a
 * separate up-front gate, run before the executor --- it is not part of what
 * `evaluateSandboxPlan` retires.
 *
 * Identify already resolved this candidate to a concrete `objectId`; Grounding
 * here is trivial (a `resolvedSpans` map with exactly one entry), not a search
 * --- the general executor is still the right vehicle rather than a bypass,
 * since it is what actually threads the shared carry-closure/`isolatedFromRelations`
 * machinery through to `DryRunOutcome.objectIds`.
 */
export const sandboxMembershipDryRun = (
    candidate: IdentityPlanCandidate,
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

    const sourceHostId = locus.kind === 'room' ? roomId : actorCharacterId
    const destinationHostId = locus.kind === 'room' ? actorCharacterId : roomId
    if (sourceHostId === undefined || destinationHostId === undefined) {
        return {
            verdict: 'illegal',
            decidable: true,
            reason: objectManipulationErrorMessages.noMembershipHost,
        }
    }

    const baseOutcome = validateMembershipPlanDryRun(candidate, {
        positionGraph: state.get(sourceHostId),
        actorCharacterId,
    })
    if (baseOutcome.verdict !== 'legal') {
        return baseOutcome
    }

    if (actorCharacterId === undefined) {
        return { verdict: 'illegal', decidable: true, reason: objectManipulationErrorMessages.noMembershipHost }
    }

    const stableRefKey = 'sandboxMembershipDryRun/object'
    const groundingContext: GroundingContext = {
        actingCharacterId: actorCharacterId,
        resolvedSpans: new Map([[stableRefKey, { verdict: 'resolved', candidateIds: [objectId] }]]),
        getCurrentHost: (componentId) => (componentId === actorCharacterId ? roomId : undefined),
    }
    const seed = seedTransferMembership({
        kind: 'change',
        primitive: 'transferMembership',
        object: objectSpanRef('object', stableRefKey),
        from: locus.kind === 'room' ? currentHostRef(actingCharacterRef) : actingCharacterRef,
        to: locus.kind === 'room' ? actingCharacterRef : currentHostRef(actingCharacterRef),
    })
    const env = createExpansionEnvironment(
        (hostId) => state.get(hostId),
        () => sourceHostId
    )

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

    return { verdict: 'legal', decidable: true, objectIds: [...transferStep.objectIds] }
}

/**
 * Membership FT-5 selector: legality partition, then floor + margin on legal survivors.
 */
export function selectIdentityPlanTuple(
    input: SelectIdentityPlanTupleInput
): SelectIdentityPlanTupleResult {
    const { candidates, sandboxState = new Map(), roomId, actorCharacterId, commandSpan = 'object' } = input
    return selectPlanTuple({
        candidates,
        getConfidence: (candidate) => candidate.confidence,
        dryRun: (candidate) => sandboxMembershipDryRun(candidate, sandboxState, roomId, actorCharacterId),
        toConsultAlternative: (candidate) =>
            membershipConsultAlternative(candidate, commandSpan),
    })
}

export function membershipConsultAlternative(
    candidate: IdentityPlanCandidate,
    commandSpan: string
): SpanResolutionConsultAlternative {
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
