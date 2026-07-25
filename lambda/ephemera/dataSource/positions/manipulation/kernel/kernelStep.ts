import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { TransferMembershipStep } from '../../../actions/enrich/objectManipulation/parsePlanStep'
import type {
    ExecutorDescribeStep,
    ExecutorDissolveRelationStep,
    ExecutorEstablishRelationStep,
    ExecutorParsePlanStep,
} from '../../../actions/enrich/objectManipulation/synthesize/executorTypes'

/**
 * BD-27c/BD-36's kernel-layer step vocabulary --- a deliberately narrow superset of the Synthesize
 * executor's `ExecutorParsePlanStep`. The transfer case widens twice: `entityIds` admits both
 * `EphemeraObjectId` and `EphemeraCharacterId`, since the kernel's membership transfer generalizes
 * over entity kind (BD-36), while the Synthesize executor's own `TransferMembershipStep` stays
 * object-only and unwidened (it only ever grounds objects --- character movement never goes through
 * Grounding/Expansion/Validation at all, so there is no ambiguity for it to resolve). And (object-
 * lifecycle Migrate row) `fromHostIds`/`toHostId` widen from a singular non-null pair to a plural
 * `froms` set + nullable `to`, mirroring `MembershipDiff`'s existing `{froms: HostId[], to: HostId |
 * null}` shape exactly --- this is what lets one step kind cover a real transfer (both populated,
 * the only shape the two player routes ever produce), a pure add (`fromHostIds` empty --- spawn),
 * and a pure remove (`toHostId` null --- destroy/clear, a stray-room scrub with no consolidation
 * target). Relational steps are reused verbatim from the executor's types: relational edges stay
 * `EphemeraObjectId`-typed this iteration (BD-36's character-relation widening is explicitly
 * deferred), so there is nothing to generalize there.
 */
export type KernelTransferMembershipStep = {
    kind: 'transferMembership'
    entityIds: ReadonlySet<EphemeraObjectId | EphemeraCharacterId>
    fromHostIds: ReadonlySet<EphemeraMembershipHostId>
    toHostId: EphemeraMembershipHostId | null
}

/**
 * The positionGraph kernel's own machinery (`commitStepSequence.ts`, `applyStepSequenceCore.ts`,
 * `computeStepSequenceFootprint.ts`, `factsForStep.ts`) --- `transactWrite` bundling, footprint
 * locking, fact-streaming --- exists only to solve mutation problems, so it keeps accepting exactly
 * this narrower type, unchanged in shape from before the `describe` widening below. A `describe`
 * step must never reach any of these; the positionGraph kernel's own type-guard filter (Phase 3)
 * excludes it before a step sequence is ever built, so this alias --- not the widened `KernelStep`
 * --- is what those files' signatures should keep using.
 */
export type KernelMutationStep = KernelTransferMembershipStep | ExecutorEstablishRelationStep | ExecutorDissolveRelationStep

/**
 * The shared, already-grounded instruction list's step vocabulary (iteration 9/PK-1): `KernelStep`
 * widened directly (rather than a sibling type) to add the perception kernel's read-only
 * `ExecutorDescribeStep`, reused verbatim --- it carries no host-transfer concern for BD-36's
 * entity-kind generalization to apply to. Each kernel filters this shared list down to the steps it
 * owns; the positionGraph kernel's filter yields `KernelMutationStep[]` (never widened), and the
 * perception kernel's filter yields `ExecutorDescribeStep[]`.
 */
export type KernelStep = KernelMutationStep | ExecutorDescribeStep

/**
 * Adapter from the executor's shipped output shape to the kernel's own step vocabulary. The
 * executor's `TransferMembershipStep` always carries exactly one non-null `fromHostId`/`toHostId`
 * (a real player-command transfer), so this just wraps `fromHostId` in a one-element set --- the
 * object-lifecycle routes' pure-add/pure-remove/multi-host shapes are constructed directly as
 * `KernelTransferMembershipStep` literals, not through this adapter, since they never go through the
 * Synthesize executor at all. `describe` steps pass through unchanged, same as the relational kinds.
 *
 * Overloaded (not just declared as `ExecutorParsePlanStep => KernelStep`) so that the positionGraph
 * kernel's mutation-only call sites --- which only ever pass a `TransferMembershipStep`/relational
 * step, never a `describe` step --- get `KernelMutationStep` back statically, with no cast needed at
 * the call site.
 */
export function fromExecutorStep(
    step: TransferMembershipStep | ExecutorEstablishRelationStep | ExecutorDissolveRelationStep
): KernelMutationStep
export function fromExecutorStep(step: ExecutorParsePlanStep): KernelStep
export function fromExecutorStep(step: ExecutorParsePlanStep): KernelStep {
    return step.kind === 'transferMembership'
        ? {
            kind: 'transferMembership',
            entityIds: step.objectIds,
            fromHostIds: new Set([step.fromHostId]),
            toHostId: step.toHostId,
        }
        : step
}

/**
 * The positionGraph kernel's own type-guard filter (mirrors the perception kernel's
 * planned `describe`-only filter, Phase 3): overload resolution on `fromExecutorStep`
 * only picks the narrow `KernelMutationStep`-returning signature at direct call sites,
 * not through `Array.prototype.map` (TS resolves the bare function reference against
 * the general signature there, widening the result to `KernelStep[]`). Mutation-route
 * call sites that map an executor step list through `fromExecutorStep` should filter
 * through this guard rather than assume a `describe` step can't appear --- it's the same
 * "shared list, per-kernel filter" discipline the perception kernel will use, applied on
 * this side too, and self-documents the invariant instead of casting past it.
 */
export const isKernelMutationStep = (step: KernelStep): step is KernelMutationStep =>
    step.kind === 'transferMembership' || step.kind === 'establishRelation' || step.kind === 'dissolveRelation'

/**
 * The perception kernel's own type-guard filter (Phase 3, mirrors `isKernelMutationStep` above):
 * pulls the `describe` steps a shared `KernelStep[]` list carries out for `perceiveStepSequence`,
 * the same "shared list, per-kernel filter" discipline applied on this side.
 */
export const isDescribeStep = (step: KernelStep): step is ExecutorDescribeStep =>
    step.kind === 'describe'
