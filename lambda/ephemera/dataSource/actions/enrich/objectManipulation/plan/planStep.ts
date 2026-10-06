import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { RelationalKindAndLabel } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraThingId } from '../thing'

/**
 * The id a referent grounds to --- the same union a `ReferentAssignment`'s two namespaces
 * carry (below).
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
export type ObjectSpanReferent = {
    referentType: 'objectSpan'
    span: string
    stableRefKey?: string
    groundedId?: GroundedId
    /** Names the thing for the attempt's prose once known (stamped by key, `stampCandidateReferents.ts`). */
    shortName?: string
    gloss?: string
}
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
    /**
     * A containment move: the transfer also establishes an `On`/`In` edge whose
     * host is always `to` by construction, not discovered by ancestry walk --- containment's
     * producer (`compileAttemptsFromSkeleton.ts`) sets this; `PartOf` never reaches
     * here (ND-4, `parseCommand.ts` hard-errors it earlier).
     */
    containment?: 'On' | 'In'
}

export type EstablishRelationChange<R extends Referent = Referent> = {
    kind: 'change'
    primitive: 'establishRelation'
    subject: R
    target: R
} & RelationalKindAndLabel

export type DissolveRelationChange<R extends Referent = Referent> = {
    kind: 'change'
    primitive: 'dissolveRelation'
    subject: R
    target: R
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

export type Assertion<R extends Referent = Referent> = ContainedByAssertion<R>

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

/**
 * A structural key for a referent with no `stableRefKey` of its own: `'actingCharacter'`, `` `currentHost(actingCharacter)` ``,
 * `` `currentHost(span:<key>)` ``. Total over `Referent` so a `currentHost` nested on any kind stays
 * nameable: membership nests both live (a take's `from` is `currentHost(span:<key>)`, a
 * drop's `to` is `currentHost(actingCharacter)`).
 */
export type DerivedReferentKey = string

export const derivedReferentKey = (referent: Referent): DerivedReferentKey => {
    switch (referent.referentType) {
        case 'actingCharacter':
            return 'actingCharacter'
        case 'objectSpan':
            return `span:${referent.stableRefKey}`
        case 'currentHost':
            return `currentHost(${derivedReferentKey(referent.referentTarget)})`
        case 'graphNode':
            return `graphNode:${referent.groundedId}`
    }
}

/**
 * Grounding's input: one value per referent, in two namespaces with different
 * lifetimes. A span's value is decided once, when identities are selected, and belongs to
 * the candidate wherever it goes --- keyed by `stableRefKey` (Identify/Plan's key). A derived
 * value (`actingCharacter`, `currentHost(X)`) is a fact about one snapshot of the world, built
 * fresh by whoever holds that snapshot --- keyed structurally, by `derivedReferentKey`.
 */
export type ReferentAssignment = {
    spans: ReadonlyMap<string, GroundedId>
    derived: ReadonlyMap<DerivedReferentKey, GroundedId>
}

/** Every referent slot of a step, whatever its kind. */
export const stepReferents = (step: PlanStep): Referent[] =>
    step.kind === 'assertion'
        ? [step.subject, step.object]
        : step.primitive === 'transferMembership'
            ? [step.object, step.from, step.to]
            : [step.subject, step.target]

/** True when every referent of this step carries a known id. */
export const isGroundedStep = (step: PlanStep): step is PlanStep<GroundedReferent> =>
    stepReferents(step).every((referent) => referent.groundedId !== undefined)
