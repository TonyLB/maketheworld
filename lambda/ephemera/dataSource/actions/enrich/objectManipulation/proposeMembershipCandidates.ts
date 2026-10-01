import { CommandAttempt } from '../../commandAttempt'
import { PositionAttemptAction } from '../../commandAttempt/action'
import { buildCommandAttemptReferent } from '../../commandAttempt/referent'
import type { ManipulationVerbClass } from '../../baseClasses'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { enumerateIdentityAssignments } from './enumerateIdentityAssignments'
import {
    membershipOperationKindFromVerbClass,
    type IdentityPlanCandidate,
} from './identityPlanCandidate'
import {
    actingCharacterRef,
    currentHostRef,
    groundStepBySubstitution,
    objectSpanRef,
    type TransferMembershipChange,
} from './plan/planStep'
import type { MembershipPlanCandidate } from './selectPlanCandidate'
import type { ObjectSpanCandidate, SpanCandidatePool } from './spanResolution'

/**
 * `refKey` is synthesized, not carried from a Parse-stamped `stableRefKey`: this route
 * has no tokenized skeleton to stamp one onto (relational-route-only machinery) --- see
 * `AGENT.concepts.md`'s Parse section.
 */
const primaryObjectRefKey = 'primaryObject'

/**
 * Plan's half of a membership attempt: depends only on the operation and the object
 * phrase, not on which identity candidate it is paired with.
 */
export const planMembershipDesiredResult = (
    operationKind: 'takeHold' | 'drop',
    span: string,
    refKey: string = primaryObjectRefKey
): TransferMembershipChange => ({
    kind: 'change',
    primitive: 'transferMembership',
    object: objectSpanRef(span, refKey),
    from: operationKind === 'takeHold' ? currentHostRef(actingCharacterRef) : actingCharacterRef,
    to: operationKind === 'takeHold' ? actingCharacterRef : currentHostRef(actingCharacterRef),
})

export type GroundMembershipCandidateContext = {
    /** The player's words, verbatim. */
    words: string
    /** The object phrase the desired result refers to. */
    span: string
    catalog: readonly ObjectManipulationCatalogEntry[]
}

/**
 * Grounds one (identity, plan) tuple by substitution --- the producer's half of AP-1's
 * ground + expand split. Builds the planned `Change` (Plan's job), substitutes the
 * candidate's id in by `stableRefKey` (`groundStepBySubstitution`, route-agnostic), and
 * wraps the result in an **un-expanded** attempt (one primary action, no boundary
 * dissolves yet --- Expand is the shared stage's job, `selectPlanCandidate.ts`). Called
 * per candidate by the pool-walking producer below, and directly by callers that already
 * hold an `IdentityPlanCandidate` outside a pool (the identity-only fallback, the
 * complexity-LLM re-ground exit).
 */
export const groundMembershipCandidate = (
    candidate: IdentityPlanCandidate,
    context: GroundMembershipCandidateContext
): MembershipPlanCandidate => {
    const { words, span, catalog } = context
    const { objectId } = candidate.identity
    const { operationKind } = candidate.plan

    const plannedResult = planMembershipDesiredResult(operationKind, span)
    const groundedStep = groundStepBySubstitution(
        plannedResult,
        new Map([[primaryObjectRefKey, objectId]])
    ) as TransferMembershipChange

    const catalogEntry = catalog.find((entry) => entry.objectId === objectId)
    const shortName = catalogEntry?.normalizedShortName ?? span
    const referent = buildCommandAttemptReferent(primaryObjectRefKey, objectId, shortName, catalogEntry?.gloss)
    const primaryAction = new PositionAttemptAction(
        [],
        groundedStep,
        `${operationKind === 'takeHold' ? 'Take' : 'Drop'}: ${shortName}`
    )

    return {
        identity: candidate.identity,
        plan: candidate.plan,
        identities: new Map([[primaryObjectRefKey, candidate.identity]]),
        confidence: candidate.confidence,
        desiredResult: groundedStep,
        attempt: CommandAttempt.create(words, [referent], [primaryAction]),
    }
}

export type ProposeMembershipCandidatesInput = {
    pool: SpanCandidatePool
    /** Every candidate is proposed with the verb-derived operation (illegal-if-wrong). */
    verbClass: ManipulationVerbClass
}

/**
 * Deterministic membership propose-N (FT-2.2): one plan (the verb's operation) × the
 * one-key assignments over the v1-locus candidates (room or held), formed by
 * `enumerateIdentityAssignments`. Legality, not this producer, rejects a wrong
 * operation for a candidate's locus. Returns ungrounded (identity, plan) tuples ---
 * grounding is `groundMembershipCandidate`'s job, called by `selectIdentityPlanTuple`
 * once sandbox state, the catalog and the player's words are all in hand.
 */
export function proposeMembershipCandidates(
    input: ProposeMembershipCandidatesInput
): IdentityPlanCandidate[] {
    const { pool, verbClass } = input
    const operationKind = membershipOperationKindFromVerbClass(verbClass)
    const source = (pool.shortlist ?? pool.candidates).filter(isV1MembershipLocus)
    return enumerateIdentityAssignments(new Map([[primaryObjectRefKey, source]]))
        .map(({ identities, confidence }) => ({
            identity: identities.get(primaryObjectRefKey)!,
            plan: { kind: 'transferMembership', operationKind },
            confidence,
        }))
}

function isV1MembershipLocus(candidate: ObjectSpanCandidate): boolean {
    return candidate.locus.kind === 'room' || candidate.locus.kind === 'heldByActor'
}
