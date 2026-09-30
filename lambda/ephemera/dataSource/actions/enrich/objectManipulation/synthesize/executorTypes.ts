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
 * `subjectId`/`targetId` are `EphemeraLudicTerminalId`-typed: any legal host-kind component, or a
 * port-qualified reference on one (a crossing leg's far-side endpoint is a port address, not a bare
 * component id). This matches `HostRelationalEdge` (`manipulation/types.ts`) and
 * `EphemeraLudicRelationalEdgeBase` (interfaces layer), which carry the same type --- no consumer on
 * the kernel write path branches on entity kind, so a `PartOf` edge legitimately puts a Feature in
 * the subject position (`FEATURE#Wall -PartOf-> FEATURE#Niche`). A crossing leg is an ordinary
 * `establishRelation`/`dissolveRelation` step living entirely within one host's own graph --- no
 * separate "leg" step kind.
 *
 * **`hostId`:** mandatory, computed once at Expansion (`expandSameHost`'s resolved host; each
 * `buildCrossingLegs` leg's own placement) rather than re-derived at apply time. This disambiguates
 * two cases a host-intersection search cannot: an endpoint multi-hosted in >=2 shared graphs at
 * once, and a port-to-port edge on one object where interior/exterior scope isn't recoverable from
 * the two port addresses alone. Matches the field `MutationKernelAddCrossingPortStep`/
 * `RemoveCrossingPortStep` (`kernelStep.ts`) already carry.
 */
export type ExecutorEstablishRelationStep = {
    kind: 'establishRelation'
    subjectId: EphemeraLudicTerminalId
    targetId: EphemeraLudicTerminalId
    hostId: EphemeraMembershipHostId
} & RelationalKindAndLabel

export type ExecutorDissolveRelationStep = {
    kind: 'dissolveRelation'
    subjectId: EphemeraLudicTerminalId
    targetId: EphemeraLudicTerminalId
    hostId: EphemeraMembershipHostId
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
 * referent to render a description for. Singular --- Grounding resolves an object-directed look to
 * exactly one referent, and a read has no expansion concept. Reused verbatim by the kernel layer (`kernelStep.ts`), the same
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
 * This is split out of `GroundedBinaryAssertion` (which fused it with `containedBy` under
 * one shared shape) --- `sameHost` is a placement-resolver, not a check with an inverse (its own
 * `negate` was already dropped), so once `containedBy`'s `negate` went back to being
 * unconditionally required, the two no longer belonged in one type. See `SameHostAssertion`'s
 * doc comment in `ungroundedPrimitive.ts` for `relationKind`'s own carried-copy rationale;
 * `relationLabel` is `relationKind: 'Custom'` only --- the crossing-port producer's
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
     * the collapsed ingress seed no longer carries a sibling relational step, so this
     * assertion is the only place `establishRelation`/`dissolveRelation` survives to Expansion ---
     * `expandSameHost`/`buildCrossingLegs` need it to pick the retiring step's own kind.
     */
    operationKind: 'establishRelation' | 'dissolveRelation'
}

/**
 * `objectIds` is the moved object Grounding resolved --- the same set its paired
 * `transferMembership` moves. Anything hosted by that object lives in its own shard and
 * travels with it, so no step widens this set.
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

/**
 * The live-state reads one worklist run shares: injected callbacks, not DB calls.
 */
export type ExpansionEnvironment = {
    getGraph: (hostId: EphemeraMembershipHostId) => EphemeraLudicGraph | undefined
    getCurrentHost: (id: EphemeraObjectId) => EphemeraMembershipHostId | undefined
    /**
     * a plain injected callback, same convention as `getCurrentHost`/`getGraph` --- not a
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
