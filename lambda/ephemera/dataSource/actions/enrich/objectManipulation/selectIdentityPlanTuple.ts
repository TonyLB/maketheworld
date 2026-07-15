import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    T_JOINT_ABS,
    T_JOINT_ABS_UNARY,
    T_JOINT_MARGIN,
} from './embeddingMatch/thresholds'
import type { IdentityPlanCandidate } from './identityPlanCandidate'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { evaluateSandboxPlan } from './sandboxPlan'
import type { SandboxPlanStep } from './sandboxPlan'
import type { SandboxState } from './sandboxState'
import type { SpanResolutionConsultAlternative, SpanResolutionOutcome } from './spanResolution'
import { expandTransferMembership } from './synthesize/expandTransferMembership'
import { relationalStepToSandboxPlanStep } from './synthesize/toSandboxPlanStep'
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
 * Sandbox-mediated membership dry run (Slice 4b, Expansion wired in Slice 2 of
 * the Pipeline A -> B migration). Invokes `expandTransferMembership` (Synthesize's
 * Expansion sub-role) to compute the real carry-closed transfer set + any
 * required dissolve steps, instead of validating a naive single-object set ---
 * replacing BD-17's interim blanket rejection of any carry-classified boundary
 * edge with a real, KR-grounded computation. Grounding is a no-op here: Identify
 * already resolved this candidate to a concrete `objectId`, so the
 * `TransferMembershipStep` is built directly rather than via `groundChange`.
 *
 * Slice 3 (2026-07-15, `MultiKeyUpdate` redesign): a legal multi-object transfer
 * is no longer declined here --- the real transfer set is threaded through via
 * `DryRunOutcome.objectIds` so the bus/`execute*` path (which now calls
 * `applyObjectSetTakeHold`/`applyObjectSetDrop`, built on `applyObjectSetTransfer`)
 * can actually apply it.
 */
const sandboxMembershipDryRun = (
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

    const expandResult = expandTransferMembership(
        { kind: 'transferMembership', objectIds: new Set([objectId]), fromHostId: sourceHostId, toHostId: destinationHostId },
        (hostId) => state.get(hostId)
    )

    if (expandResult.verdict === 'error') {
        return { verdict: 'illegal', decidable: true, reason: expandResult.reason }
    }
    if (expandResult.verdict === 'defer') {
        return { verdict: 'defer', decidable: expandResult.decidable, reason: expandResult.reason }
    }

    // expandResult.verdict === 'complete'. Dissolve steps are purely Expansion-derived (no
    // pre-existing proposer candidate to preserve), so convert them via the standard converter.
    // The transferMembership step keeps the *real* candidate (preserving its stated
    // operationKind, which the sandbox's own legality check compares against `context`'s
    // direction to catch e.g. "drop" claimed on a room-locus object) --- only the transferSet
    // widens to Expansion's carry-closed result.
    const dissolveConversions = expandResult.dissolveSteps.map(relationalStepToSandboxPlanStep)
    const conversionFailure = dissolveConversions.find((result) => !result.ok)
    if (conversionFailure && !conversionFailure.ok) {
        return { verdict: 'illegal', decidable: true, reason: conversionFailure.reason }
    }

    const planSteps: SandboxPlanStep[] = [
        ...dissolveConversions.flatMap((result) => (result.ok ? [result.step] : [])),
        {
            kind: 'transferMembership',
            candidate,
            transferSet: expandResult.transferStep.objectIds,
            context: { sourceHostId, destinationHostId },
        },
    ]

    const outcome = evaluateSandboxPlan(state, planSteps)

    if (outcome.verdict !== 'legal') {
        return { verdict: outcome.verdict, decidable: outcome.decidable, reason: outcome.reason }
    }

    return { verdict: 'legal', decidable: true, objectIds: [...expandResult.transferStep.objectIds] }
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

function membershipConsultAlternative(
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
