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
 * phrase, not on which identity candidate it is paired with. A take moves the object from
 * wherever it is (`currentHost` of the object itself: the room, or a table it sits on) to
 * the actor; a drop moves it from the actor to the room the actor is in.
 */
export const planMembershipDesiredResult = (
    operationKind: 'takeHold' | 'drop',
    span: string,
    refKey: string = primaryObjectRefKey
): TransferMembershipChange => ({
    kind: 'change',
    primitive: 'transferMembership',
    object: objectSpanRef(span, refKey),
    from: operationKind === 'takeHold' ? currentHostRef(objectSpanRef(span, refKey)) : actingCharacterRef,
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
 * The producer's half of the ground + expand split --- builds the planned `Change`
 * (Plan's job) and wraps it in an **un-expanded** attempt (one primary action, no boundary
 * dissolves yet --- Expand is the shared stage's job, `selectPlanCandidate.ts`). Called per
 * candidate by the pool-walking producer below, and directly by callers that already hold
 * an `IdentityPlanCandidate` outside a pool (the identity-only fallback, the complexity-LLM
 * re-ground exit).
 *
 * **Despite its name, this no longer grounds the step** (revised 2026-10-02):`plannedResult`'s `object` referent carries no `groundedId` here ---
 * only `candidate.identities`/`candidate.identity.objectId` (used below for the attempt's
 * referent/description, and read directly by Expand, `expandAndAdjudicateMembershipCandidate`)
 * carry the identity, and the attempt's referent carries it onward (the span half). The step
 * is grounded per snapshot --- `buildReferentAssignment` then `groundChange` --- by
 * `sandboxMembershipDryRun` for its own dry run, and again by positions' `commitAttempt`
 * after the hand-off; the published step stays ungrounded. `TransferMembershipChange`'s own type still admits
 * either a bare or a grounded `object`/`from`/`to`, so nothing here needs its own grounded
 * variant.
 */
export const groundMembershipCandidate = (
    candidate: IdentityPlanCandidate,
    context: GroundMembershipCandidateContext
): MembershipPlanCandidate => {
    const { words, span, catalog } = context
    const { objectId } = candidate.identity
    const { operationKind } = candidate.plan

    const plannedResult: TransferMembershipChange = planMembershipDesiredResult(operationKind, span)

    const catalogEntry = catalog.find((entry) => entry.objectId === objectId)
    const shortName = catalogEntry?.normalizedShortName ?? span
    const referent = buildCommandAttemptReferent(primaryObjectRefKey, objectId, shortName, catalogEntry?.gloss)
    const primaryAction = new PositionAttemptAction(
        [],
        plannedResult,
        `${operationKind === 'takeHold' ? 'Take' : 'Drop'}: ${shortName}`
    )

    return {
        identity: candidate.identity,
        plan: candidate.plan,
        identities: new Map([[primaryObjectRefKey, candidate.identity]]),
        confidence: candidate.confidence,
        desiredResult: plannedResult,
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
