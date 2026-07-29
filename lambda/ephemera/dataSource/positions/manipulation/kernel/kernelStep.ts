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
export type MutationKernelTransferStep = {
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
export type MutationKernelStep = MutationKernelTransferStep | ExecutorEstablishRelationStep | ExecutorDissolveRelationStep

/**
 * The shared, already-grounded instruction list's step vocabulary (iteration 9/PK-1): `KernelStep`
 * widened directly (rather than a sibling type) to add the presentation kernel's read-only
 * `ExecutorDescribeStep`, reused verbatim --- it carries no host-transfer concern for BD-36's
 * entity-kind generalization to apply to. Each kernel filters this shared list down to the steps it
 * owns; the mutation kernel's filter yields `MutationKernelStep[]` (never widened), and the
 * presentation kernel's filter yields `PresentationKernelStep[]`.
 *
 * `KernelStep` itself stays unprefixed, deliberately (PB-K): it is the shared, cross-kernel
 * vocabulary, belonging to neither kernel alone, so it takes no kernel's name. Every other type in
 * this file is specific to one kernel and is named accordingly (`MutationKernel*` /
 * `PresentationKernel*`) --- prefixing `KernelStep` too would erase the one distinction this naming
 * scheme exists to preserve.
 */
export type KernelStep = MutationKernelStep | ExecutorDescribeStep

/**
 * The presentation kernel's own filtered view of `KernelStep` (PB-L): today just `ExecutorDescribeStep`,
 * the shipped describe branch (`presentStepSequence.ts`). A single-member union rather than a bare
 * alias because a future narration step (`AGENT.presentationKernel.planning.md` Phase 2) joins it
 * here, not by widening `KernelStep` again --- `ExecutorDescribeStep` and the narration step are both
 * "things the presentation kernel filters for," the same relationship `MutationKernelStep` already has
 * to its own members.
 */
export type PresentationKernelStep = ExecutorDescribeStep

/**
 * Adapter from the executor's shipped output shape to the kernel's own step vocabulary. The
 * executor's `TransferMembershipStep` always carries exactly one non-null `fromHostId`/`toHostId`
 * (a real player-command transfer), so this just wraps `fromHostId` in a one-element set --- the
 * object-lifecycle routes' pure-add/pure-remove/multi-host shapes are constructed directly as
 * `MutationKernelTransferStep` literals, not through this adapter, since they never go through the
 * Synthesize executor at all. `describe` steps pass through unchanged, same as the relational kinds.
 *
 * Overloaded (not just declared as `ExecutorParsePlanStep => KernelStep`) so that the positionGraph
 * kernel's mutation-only call sites --- which only ever pass a `TransferMembershipStep`/relational
 * step, never a `describe` step --- get `MutationKernelStep` back statically, with no cast needed at
 * the call site.
 */
export function fromExecutorStep(
    step: TransferMembershipStep | ExecutorEstablishRelationStep | ExecutorDissolveRelationStep
): MutationKernelStep
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
 * The mutation kernel's own type-guard filter (mirrors the presentation kernel's
 * `describe`-only filter below): overload resolution on `fromExecutorStep`
 * only picks the narrow `MutationKernelStep`-returning signature at direct call sites,
 * not through `Array.prototype.map` (TS resolves the bare function reference against
 * the general signature there, widening the result to `KernelStep[]`). Mutation-route
 * call sites that map an executor step list through `fromExecutorStep` should filter
 * through this guard rather than assume a `describe` step can't appear --- it's the same
 * "shared list, per-kernel filter" discipline the presentation kernel uses, applied on
 * this side too, and self-documents the invariant instead of casting past it.
 */
export const isKernelMutationStep = (step: KernelStep): step is MutationKernelStep =>
    step.kind === 'transferMembership' || step.kind === 'establishRelation' || step.kind === 'dissolveRelation'

/**
 * The presentation kernel's own type-guard filter (mirrors `isKernelMutationStep` above):
 * pulls the `describe` steps a shared `KernelStep[]` list carries out for `presentStepSequence`,
 * the same "shared list, per-kernel filter" discipline applied on this side.
 */
export const isDescribeStep = (step: KernelStep): step is ExecutorDescribeStep =>
    step.kind === 'describe'
