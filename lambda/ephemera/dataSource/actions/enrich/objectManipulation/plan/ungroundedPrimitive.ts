import type { RelationalKindAndLabel } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

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
} & RelationalKindAndLabel

export type DissolveRelationChange = {
    kind: 'change'
    primitive: 'dissolveRelation'
    subject: Referent
    target: Referent
} & RelationalKindAndLabel

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
 * BD-28/BD-34: "this object's (or object-set's) relations to anything outside
 * itself must be severed" --- what carry/take/drop needs to sever boundary
 * relations explicitly (streaming a fact) rather than via `removeObject`'s
 * implicit edge-stripping. Folded into `Assertion` rather than a fourth
 * top-level `UngroundedPlanStep` kind or a new `Change` primitive: it shares
 * `Assertion`'s retirement shape (evaluates live state, mints 0+ repair-shaped
 * children, contributes no kernel step of its own) even though it needs
 * operand-expansion (unlike `containedBy`) --- see
 * `AGENT.synthesizeStepSequencing.planning.md`'s "Executor design" for the
 * full reasoning. No `negate`: unlike the binary predicates above, this one
 * has no meaningful negated form Plan would ever emit.
 */
export type IsolatedFromRelationsAssertion = {
    kind: 'assertion'
    predicate: 'isolatedFromRelations'
    object: Referent
}

export type Assertion = ContainedByAssertion | IsolatedFromRelationsAssertion

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
