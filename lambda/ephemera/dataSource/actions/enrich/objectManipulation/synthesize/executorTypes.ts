import type {
    EphemeraCharacterId,
    EphemeraFeatureId,
    EphemeraKnowledgeId,
    EphemeraObjectId,
    EphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalId, EphemeraLudicTerminalPrimitive, RelationalKindAndLabel } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph } from '../../../../positions/ludicGraph'
import type { DissolveRelationChange, EstablishRelationChange, GroundedReferent } from '../plan/planStep'
import type { TransferMembershipStep } from '../parsePlanStep'
import type { RelationalChainStep } from './findRelationalChain'

/**
 * A relational effect step: one leg of a chain (AP-6), lowered from it by
 * `lowerRelationalChain` and reused verbatim as the kernel's relational step.
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
 * **`hostId`:** mandatory, computed once at Expansion (each leg's own placement in the chain
 * `buildCrossingLegs` builds or `findRelationalChain` finds) rather than re-derived at apply time. This disambiguates
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

/**
 * A relational edge's chain (AP-6, `AGENT.commandAttemptPipeline.planning.md`), retired from the
 * worklist as one output: every leg with its host and every port it crosses, establish's freshly
 * built or dissolve's found. It stays a value through selection; `lowerRelationalChain`
 * (`buildCrossingLegs.ts`) turns the chosen one into kernel steps.
 */
export type ExecutorRelationalChain = {
    kind: 'relationalChain'
    operationKind: 'establishRelation' | 'dissolveRelation'
    steps: readonly RelationalChainStep[]
}

/** What a worklist run retires: an executor step, or a relational edge's whole chain. */
export type ExecutorOutputStep = ExecutorParsePlanStep | ExecutorRelationalChain

/** Stable per-instruction identity --- causal tracking and settled-groups ledger keys. */
export type InstructionId = string

export type GroundedBinaryAssertion = {
    kind: 'assertion'
    predicate: 'containedBy'
    subjectId: EphemeraObjectId
    objectId: EphemeraObjectId
    negate: boolean
}

export type GroundedAssertion = GroundedBinaryAssertion

/**
 * A grounded relational `Change`: the edge as a worklist instruction (`AGENT.implementation.md`,
 * "Relational edges"). It carries no `host` and never lowers straight to an executor step:
 * command-expansion dispatches on its `primitive` and finds its chain (establish via
 * `findShardBoundary`, dissolve via `findRelationalChain`), retiring as one
 * `ExecutorRelationalChain`.
 */
export type GroundedRelationalChange = EstablishRelationChange<GroundedReferent> | DissolveRelationChange<GroundedReferent>

/**
 * BD-30's worklist instruction. Always grounded (AP-10): grounding happens once, completely,
 * before anything is seeded (`seedFromGroundedSteps` is the only seeder), so the worklist
 * never carries an ungrounded `Change`/`Assertion` --- unlike `'retired'`, which is
 * deliberately not a tag here either, since a retired instruction has left the worklist
 * entirely, either into the output-ordered list (atomic effects) or nowhere (generators,
 * which contribute only their minted children).
 */
export type WorklistInstruction = {
    id: InstructionId
    step: ExecutorParsePlanStep | GroundedAssertion | GroundedRelationalChange
}

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
    step: ExecutorParsePlanStep | GroundedAssertion | GroundedRelationalChange
): step is ExecutorParsePlanStep =>
    step.kind === 'transferMembership'
    || step.kind === 'establishRelation'
    || step.kind === 'dissolveRelation'
    || step.kind === 'describe'
