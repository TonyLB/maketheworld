import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { RelationalKindAndLabel } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraThingId } from '../thing'

/**
 * The id a referent grounds to --- the same union Grounding's candidates carry
 * (`GroundReferentResult`, `synthesize/groundReferent.ts`).
 */
export type GroundedId = EphemeraThingId | EphemeraMembershipHostId

/**
 * A referent is grounded or ungrounded by what is known about it, not by where it
 * sits in the pipeline. Every arm says how the thing was named (a phrase, the actor,
 * a derived host) and carries an optional `groundedId` once its id is known; Grounding
 * adds the id without discarding the rest, so a grounded `objectSpan` keeps the
 * `stableRefKey` tie the attempt's prose reads.
 *
 * stableRefKey is optional here: the only current constructor call sites
 * (compileUngroundedPlan.ts, fed by the legacy frame types) have no real key to
 * pass -- Step 2b's native Plan matcher, not yet built, is what will construct
 * these from Parse's skeleton with a real key. Don't invent placeholder values.
 */
export type ObjectSpanReferent = { referentType: 'objectSpan'; span: string; stableRefKey?: string; groundedId?: GroundedId }
export type ActingCharacterReferent = { referentType: 'actingCharacter'; groundedId?: GroundedId }
export type CurrentHostReferent = { referentType: 'currentHost'; referentTarget: Referent; groundedId?: GroundedId }
/**
 * Born grounded: a thing known only by its id in a graph, which no phrase named ---
 * e.g. the post at the far end of a boundary edge that Expansion must dissolve.
 */
export type GraphNodeReferent = { referentType: 'graphNode'; groundedId: GroundedId }
export type Referent = ObjectSpanReferent | ActingCharacterReferent | CurrentHostReferent | GraphNodeReferent
export type GroundedReferent = Referent & { groundedId: GroundedId }

export type TransferMembershipChange<R extends Referent = Referent> = {
    kind: 'change'
    primitive: 'transferMembership'
    object: R
    from: R
    to: R
}

export type EstablishRelationChange<R extends Referent = Referent> = {
    kind: 'change'
    primitive: 'establishRelation'
    subject: R
    target: R
    /** The graph the relation lives in. Plan's default is BD-6's `currentHost(actingCharacter)`. */
    host: R
} & RelationalKindAndLabel

export type DissolveRelationChange<R extends Referent = Referent> = {
    kind: 'change'
    primitive: 'dissolveRelation'
    subject: R
    target: R
    /** The graph the relation lives in. Plan's default is BD-6's `currentHost(actingCharacter)`. */
    host: R
} & RelationalKindAndLabel

export type Change<R extends Referent = Referent> = TransferMembershipChange<R> | EstablishRelationChange<R> | DissolveRelationChange<R>

/**
 * BD-14: `negate` rather than paired predicate names (e.g. `notContainedBy`) ---
 * a flag reuses one evaluation path instead of forking the (disjunctive)
 * predicate logic into two copies that must be kept in sync. Single member
 * today; grow this union as concrete cases demand (BD-14 scope discipline).
 */
export type ContainedByAssertion<R extends Referent = Referent> = {
    kind: 'assertion'
    predicate: 'containedBy'
    subject: R
    object: R
    negate: boolean
}

/**
 * BD-28/BD-34: "this object's (or object-set's) relations to anything outside
 * itself must be severed" --- what take/drop needs to sever boundary
 * relations explicitly (streaming a fact) rather than via `removeObject`'s
 * implicit edge-stripping. Folded into `Assertion` rather than a fourth
 * top-level `PlanStep` kind or a new `Change` primitive: it shares
 * `Assertion`'s retirement shape (evaluates live state, mints 0+ repair-shaped
 * children, contributes no kernel step of its own) --- see
 * `synthesize/AGENT.implementation.md` for how the executor lowers it. No
 * `negate`: unlike the binary predicates above, this one
 * has no meaningful negated form Plan would ever emit.
 */
export type IsolatedFromRelationsAssertion<R extends Referent = Referent> = {
    kind: 'assertion'
    predicate: 'isolatedFromRelations'
    object: R
}

export type Assertion<R extends Referent = Referent> = ContainedByAssertion<R> | IsolatedFromRelationsAssertion<R>

/**
 * A Plan step, generic over what is known about its referents: `PlanStep` (the default)
 * admits any mix, and `PlanStep<GroundedReferent>` names a step whose every referent has
 * a known id, which Expansion emits and the executor can seed without grounding.
 */
export type PlanStep<R extends Referent = Referent> = Change<R> | Assertion<R>

export const objectSpanRef = (span: string, stableRefKey?: string): Referent => ({
    referentType: 'objectSpan',
    span,
    ...(stableRefKey !== undefined ? { stableRefKey } : {}),
})

export const actingCharacterRef: Referent = { referentType: 'actingCharacter' }

export const currentHostRef = (referentTarget: Referent): Referent => ({
    referentType: 'currentHost',
    referentTarget,
})

export const graphNodeRef = (groundedId: GroundedId): GraphNodeReferent => ({
    referentType: 'graphNode',
    groundedId,
})

/** Adds a known id to a referent, keeping everything already known about it. */
export const withGroundedId = <R extends Referent>(referent: R, groundedId: GroundedId): R & { groundedId: GroundedId } => ({
    ...referent,
    groundedId,
})
