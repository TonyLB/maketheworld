import type {
    EphemeraCharacterId,
    EphemeraFeatureId,
    EphemeraKnowledgeId,
    EphemeraObjectId,
    EphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraPositionGraph } from '../../../../positions/positionGraph'
import type { CarryClosureFragment } from '../../../../positions/positionGraph/expandValidate/interactionUnderTransfer'
import type { Assertion, Change } from '../plan/ungroundedPrimitive'
import type { TransferMembershipStep } from '../parsePlanStep'

/**
 * `EstablishRelationStep`/`DissolveRelationStep` (`parsePlanStep.ts`) minus
 * `hostRoomId` --- the BD-33 assert-and-throw shape, where a relational
 * effect step derives its host from its own endpoint ids at apply time
 * instead of carrying one. Local to the executor (not a `parsePlanStep.ts`
 * edit) because the live relational route still constructs/reads
 * `hostRoomId` today; `parsePlanStep.ts` itself only loses the field at the
 * Migrate slice, once the live route stops needing it.
 */
export type ExecutorEstablishRelationStep = {
    kind: 'establishRelation'
    subjectId: EphemeraObjectId
    targetId: EphemeraObjectId
    relationKind: HostRelationalEdgeKind
    relationLabel?: string
}

export type ExecutorDissolveRelationStep = {
    kind: 'dissolveRelation'
    subjectId: EphemeraObjectId
    targetId: EphemeraObjectId
    relationKind: HostRelationalEdgeKind
    relationLabel?: string
}

/**
 * Referent-kind tag for a `describe` step --- parameterizes over referent kind the same way
 * `MutationKernelTransferStep` (`kernelStep.ts`) already generalized `transferMembership` over
 * entity kind (BD-36), rather than one step shape per look-variant (room look vs. object look vs.
 * feature look, etc).
 */
export type DescribeReferentKind = 'room' | 'object' | 'character' | 'feature' | 'knowledge'

/**
 * The perception kernel's one grounded-effect shape (iteration 9/PK-1): a single already-resolved
 * referent to render a description for. Singular, not carry-closed like `transferMembership`'s
 * `entityIds` --- Grounding resolves an object-directed look to exactly one referent, and there is no
 * carry/expansion concept for a read. Reused verbatim by the kernel layer (`kernelStep.ts`), the same
 * way `establishRelation`/`dissolveRelation` are: a `describe` step needs no kernel-specific widening,
 * since it carries no host-transfer concern for BD-36's entity-kind generalization to apply to.
 */
export type ExecutorDescribeStep = {
    kind: 'describe'
    referentId: EphemeraRoomId | EphemeraObjectId | EphemeraCharacterId | EphemeraFeatureId | EphemeraKnowledgeId
    referentKind: DescribeReferentKind
}

/**
 * The executor's grounded-effect vocabulary: `TransferMembershipStep` is
 * reused as-is from `parsePlanStep.ts` (it never carried a host field), the
 * relational effects are the local, host-field-free shapes above. `ExecutorDescribeStep` is the
 * perception kernel's read-only addition (iteration 9) --- it flows through the same shared,
 * already-grounded instruction list as the mutation kinds, filtered out by each kernel's own
 * type-guard rather than routed by a separate dispatcher (see `positions/AGENT.concepts.md`,
 * "Two kernels").
 */
export type ExecutorParsePlanStep =
    | TransferMembershipStep
    | ExecutorEstablishRelationStep
    | ExecutorDissolveRelationStep
    | ExecutorDescribeStep

/** Stable per-instruction identity --- causal tracking and settled-groups ledger keys. */
export type InstructionId = string

export type GroundedBinaryAssertion = {
    kind: 'assertion'
    predicate: 'containedBy' | 'sameHost'
    subjectId: EphemeraObjectId
    objectId: EphemeraObjectId
    negate: boolean
    /** `sameHost` only --- see `SameHostAssertion`'s doc comment in `ungroundedPrimitive.ts`. */
    relationKind?: HostRelationalEdgeKind
}

/**
 * `objectIds` is a singleton right after Grounding and carry-closed after
 * operand-expansion --- the same tag-transition widening `transferMembership`
 * already uses, and (per Fix 2) genuinely shared with a same-object
 * `transferMembership` via the `GroupId` ledger.
 */
export type GroundedIsolatedFromRelationsAssertion = {
    kind: 'assertion'
    predicate: 'isolatedFromRelations'
    objectIds: ReadonlySet<EphemeraObjectId>
}

export type GroundedAssertion = GroundedBinaryAssertion | GroundedIsolatedFromRelationsAssertion

/**
 * BD-30's progress-tagged instruction. `'retired'` is deliberately not a tag
 * here --- a retired instruction has left the worklist entirely, either into
 * the output-ordered list (atomic effects) or nowhere (generators, which
 * contribute only their minted children).
 */
export type WorklistInstruction =
    | { id: InstructionId; tag: 'ungrounded'; step: Change | Assertion }
    | { id: InstructionId; tag: 'grounded'; step: ExecutorParsePlanStep | GroundedAssertion }
    | { id: InstructionId; tag: 'operandExpanded'; step: ExecutorParsePlanStep | GroundedAssertion }

/** Canonical identity for a settled carry-closure group (Fix 2). */
export type GroupId = string

/**
 * BD-30's "common referent" / settled-groups ledger, revised for
 * member-indexed lookup (Fix 2): `groupIdByObject` lets a later
 * operand-expansion starting from a *different* object recognize it's
 * already part of a settled closure, not just a lookup keyed on the original
 * starting id.
 */
export type ExpansionEnvironment = {
    settledGroups: Map<GroupId, CarryClosureFragment>
    groupIdByObject: Map<EphemeraObjectId, GroupId>
    getGraph: (hostId: EphemeraMembershipHostId) => EphemeraPositionGraph | undefined
    getCurrentHost: (id: EphemeraObjectId) => EphemeraMembershipHostId | undefined
}

export const isExecutorParsePlanStep = (
    step: ExecutorParsePlanStep | GroundedAssertion
): step is ExecutorParsePlanStep =>
    step.kind === 'transferMembership'
    || step.kind === 'establishRelation'
    || step.kind === 'dissolveRelation'
    || step.kind === 'describe'
