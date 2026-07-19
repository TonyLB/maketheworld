import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

/**
 * stableRefKey is optional here: the only current constructor call sites
 * (compileUngroundedPlan.ts, fed by the legacy frame types) have no real key to
 * pass -- Step 2b's native Plan matcher, not yet built, is what will construct
 * these from Parse's skeleton with a real key. Don't invent placeholder values.
 */
export type ObjectSpanReferent = { referentType: 'objectSpan'; span: string; stableRefKey?: string }
export type ActingCharacterReferent = { referentType: 'actingCharacter' }
export type CurrentHostReferent = { referentType: 'currentHost'; referentTarget: Referent }
export type Referent = ObjectSpanReferent | ActingCharacterReferent | CurrentHostReferent

export type TransferMembershipChange = {
    kind: 'change'
    primitive: 'transferMembership'
    object: Referent
    from: Referent
    to: Referent
}

export type EstablishRelationChange = {
    kind: 'change'
    primitive: 'establishRelation'
    subject: Referent
    target: Referent
    relationKind: HostRelationalEdgeKind
    relationLabel?: string
}

export type DissolveRelationChange = {
    kind: 'change'
    primitive: 'dissolveRelation'
    subject: Referent
    target: Referent
    relationKind: HostRelationalEdgeKind
    relationLabel?: string
}

export type Change = TransferMembershipChange | EstablishRelationChange | DissolveRelationChange

/**
 * BD-14: `negate` rather than paired predicate names (e.g. `notContainedBy`) ---
 * a flag reuses one evaluation path instead of forking the (disjunctive)
 * predicate logic into two copies that must be kept in sync. Single member
 * today; grow this union as concrete cases demand (BD-14 scope discipline).
 */
export type ContainedByAssertion = {
    kind: 'assertion'
    predicate: 'containedBy'
    subject: Referent
    object: Referent
    negate: boolean
}

/**
 * BD-15/16: does `subject` share a membership host with `object`? Reuses the same
 * generic shape as `ContainedByAssertion` --- no new fields --- since `subject`/`object`
 * carry the same directional roles as the paired relational `Change`'s `subject`/`target`
 * (guaranteed to align: both are built from the same frame in one compiler pass).
 */
export type SameHostAssertion = {
    kind: 'assertion'
    predicate: 'sameHost'
    subject: Referent
    object: Referent
    negate: boolean
}

export type Assertion = ContainedByAssertion | SameHostAssertion

export type UngroundedPlanStep = Change | Assertion

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
