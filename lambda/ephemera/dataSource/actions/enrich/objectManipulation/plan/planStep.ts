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
 * Grounds a step by substitution (AP-1, `AGENT.commandAttemptPipeline.planning.md`):
 * an `objectSpan` referent whose `stableRefKey` has an entry in the assignment gets that
 * id, keeping everything else about it. Referents with no `stableRefKey`, or none in the
 * assignment, pass through unchanged --- e.g. membership's derived `from`/`to` referents,
 * which ground later in the executor's own grounding pass, not here. Route-agnostic: every
 * producer (membership today, relational from slice 2a) grounds its own ungrounded `Change`
 * the same way, over its own stableRefKey assignment.
 */
export const groundStepBySubstitution = (
    step: Change,
    groundedIdByRefKey: ReadonlyMap<string, GroundedId>
): Change => {
    const substitute = (referent: Referent): Referent => {
        if (referent.referentType === 'objectSpan' && referent.stableRefKey !== undefined) {
            const groundedId = groundedIdByRefKey.get(referent.stableRefKey)
            if (groundedId !== undefined) {
                return withGroundedId(referent, groundedId)
            }
        }
        return referent
    }
    if (step.primitive === 'transferMembership') {
        return { ...step, object: substitute(step.object), from: substitute(step.from), to: substitute(step.to) }
    }
    return { ...step, subject: substitute(step.subject), target: substitute(step.target), host: substitute(step.host) }
}

/** True when every referent of this step carries a known id. */
export const isGroundedStep = (step: PlanStep): step is PlanStep<GroundedReferent> => {
    const referents: Referent[] = step.kind === 'assertion'
        ? [step.subject, step.object]
        : step.primitive === 'transferMembership'
            ? [step.object, step.from, step.to]
            : [step.subject, step.target, step.host]
    return referents.every((referent) => referent.groundedId !== undefined)
}
