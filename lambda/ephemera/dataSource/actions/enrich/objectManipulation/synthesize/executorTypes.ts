import type {
    EphemeraCharacterId,
    EphemeraFeatureId,
    EphemeraKnowledgeId,
    EphemeraObjectId,
    EphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalId, EphemeraLudicTerminalPrimitive, HostRelationalEdgeKind, RelationalKindAndLabel } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph } from '../../../../positions/ludicGraph'
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
 *
 * `subjectId`/`targetId` are `EphemeraLudicTerminalPrimitive` (LP4g, 2026-08-19):
 * widened from `EphemeraObjectId` once reading the whole kernel write path end to
 * end showed no consumer branches on entity kind --- the `Object` in this file's
 * neighboring `buildObjectRelationalFact` was annotation, not behaviour. This is
 * also the prerequisite for LP4c: a `PartOf` edge legitimately puts a Feature in
 * the subject position (`FEATURE#Wall -PartOf-> FEATURE#Niche`, LD-8).
 *
 * Widened again to `EphemeraLudicTerminalId` (PV1-3): a crossing leg's far-side
 * endpoint is a port address, not a bare component id --- `HostRelationalEdge`
 * (`manipulation/types.ts`) and `EphemeraLudicRelationalEdgeBase` (interfaces layer,
 * LP7) already carry the wider type; this step type was the one place still
 * narrower than the edge it produces. A leg is an ordinary `establishRelation`/
 * `dissolveRelation` step living entirely within one host's own graph --- no new
 * "leg" step kind, per PV1-3's plan review.
 */
export type ExecutorEstablishRelationStep = {
    kind: 'establishRelation'
    subjectId: EphemeraLudicTerminalId
    targetId: EphemeraLudicTerminalId
} & RelationalKindAndLabel

export type ExecutorDissolveRelationStep = {
    kind: 'dissolveRelation'
    subjectId: EphemeraLudicTerminalId
    targetId: EphemeraLudicTerminalId
} & RelationalKindAndLabel

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
    predicate: 'containedBy'
    subjectId: EphemeraObjectId
    objectId: EphemeraObjectId
    negate: boolean
}

/**
 * PV1-3b-4 split this out of `GroundedBinaryAssertion` (which fused it with `containedBy` under
 * one shared shape) --- `sameHost` is a placement-resolver, not a check with an inverse (its own
 * `negate` was already dropped, PV1-3b-10), so once `containedBy`'s `negate` went back to being
 * unconditionally required, the two no longer belonged in one type. See `SameHostAssertion`'s
 * doc comment in `ungroundedPrimitive.ts` for `relationKind`'s own carried-copy rationale;
 * `relationLabel` is `relationKind: 'Custom'` only (PV1-3) --- the crossing-port producer's
 * `exteriorRelationLabel`/leg label needs the actual text, not just the `Custom` tag.
 */
export type GroundedSameHostAssertion = {
    kind: 'assertion'
    predicate: 'sameHost'
    subjectId: EphemeraObjectId
    objectId: EphemeraObjectId
    relationKind?: HostRelationalEdgeKind
    relationLabel?: string
    /**
     * PV1-3b-4: the collapsed ingress seed no longer carries a sibling relational step, so this
     * assertion is the only place `establishRelation`/`dissolveRelation` survives to Expansion ---
     * `expandSameHost`/`buildCrossingLegs` need it to pick the retiring step's own kind.
     */
    operationKind: 'establishRelation' | 'dissolveRelation'
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

export type GroundedAssertion = GroundedBinaryAssertion | GroundedSameHostAssertion | GroundedIsolatedFromRelationsAssertion

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
    settledGroups: Map<GroupId, EphemeraLudicGraph>
    groupIdByObject: Map<EphemeraObjectId, GroupId>
    getGraph: (hostId: EphemeraMembershipHostId) => EphemeraLudicGraph | undefined
    getCurrentHost: (id: EphemeraObjectId) => EphemeraMembershipHostId | undefined
    /**
     * PV1-3: a plain injected callback, same convention as `getCurrentHost`/`getGraph` --- not a
     * live DB call. `findShardBoundary`'s recursive walk calls this at every node it reaches, not
     * only at `subjectId`/`targetId` themselves, so a caller whose worklist never seeds a
     * `sameHost` assertion (every route but the relational/tie pipeline) can safely pass a stub
     * that returns `[]` --- it is never invoked.
     */
    getMembershipContainers: (id: EphemeraPositionAdjacencyContainedId) => EphemeraMembershipHostId[]
}

export const isExecutorParsePlanStep = (
    step: ExecutorParsePlanStep | GroundedAssertion
): step is ExecutorParsePlanStep =>
    step.kind === 'transferMembership'
    || step.kind === 'establishRelation'
    || step.kind === 'dissolveRelation'
    || step.kind === 'describe'
