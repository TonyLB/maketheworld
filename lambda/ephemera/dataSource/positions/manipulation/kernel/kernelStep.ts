import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { TransferMembershipStep } from '../../../actions/enrich/objectManipulation/parsePlanStep'
import type {
    ExecutorDescribeStep,
    ExecutorDissolveRelationStep,
    ExecutorEstablishRelationStep,
    ExecutorParsePlanStep,
} from '../../../actions/enrich/objectManipulation/synthesize/executorTypes'
import type { MembershipEmissionCopyKind } from '../../../perception/membershipPresentationFanIn'

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
 * Positional capture (`AGENT.presentationKernel.planning.md` PB-J): a read-only walk step that
 * snapshots a host's roster mid-walk, so narration built later can reflect "who was there at this
 * beat" rather than final committed state. It carries no write payload --- that shape constraint is
 * what makes it safe to admit into the mutation kernel's own `transactWrite` walk (a step that could
 * write would need to join the transact item set; this one never does). `captureId` is caller-
 * assigned identity, never position --- the walk's array position is what makes the snapshot
 * positional, not the id.
 */
export type MutationKernelCaptureStep = {
    kind: 'capture'
    hostId: EphemeraMembershipHostId
    captureId: string
}

/**
 * The positionGraph kernel's own machinery (`commitStepSequence.ts`, `applyStepSequenceCore.ts`,
 * `computeStepSequenceFootprint.ts`, `factsForStep.ts`) --- `transactWrite` bundling, footprint
 * locking, fact-streaming --- exists only to solve mutation problems, so it keeps accepting this
 * narrower type. `MutationKernelCaptureStep` joins it (PB-J), widening it for the first time since
 * the `describe` widening was drawn *against* --- capture reads a host's roster, so it needs the same
 * footprint-locking and reducer-walk machinery every other mutation step gets, even though it writes
 * nothing. A `describe` step must never reach any of these; the positionGraph kernel's own type-guard
 * filter (Phase 3) excludes it before a step sequence is ever built, so this alias --- not the widened
 * `KernelStep` --- is what those files' signatures should keep using.
 */
export type MutationKernelStep =
    | MutationKernelTransferStep
    | ExecutorEstablishRelationStep
    | ExecutorDissolveRelationStep
    | MutationKernelCaptureStep

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
 *
 * Widened again (Phase 2) to admit `PresentationKernelNarrateStep`, alongside `ExecutorDescribeStep`
 * --- both presentation-kernel-owned, neither ever reaching the mutation kernel's own filter.
 */
export type KernelStep = MutationKernelStep | ExecutorDescribeStep | PresentationKernelNarrateStep

/**
 * Positional narration (`AGENT.presentationKernel.planning.md` PB-J/PB-L, Phase 2): a read-only
 * presentation-kernel step, never entering the mutation walk. Emitted only by the compiler
 * (`compile/compilePositionKernelOp.ts`) --- PB-I --- which is why it carries no built `message`
 * (PB-2): the ingredients (`direction`, `characterName`, `copyKind`, `exitName`) travel with the
 * step, and `presentStepSequence` assembles the actual copy at flush time, alongside resolving
 * `captureId` against the commit's captured audience. `captureId` carries identity only, never
 * position --- the capture step's own array position is what makes the snapshot positional, not
 * this reference to it.
 *
 * `kind` is the single, flat `'narrate'` --- mirroring `describe`'s own shape in this file
 * (`kind: 'describe'` at the walk-dispatch level, `referentKind` as the nested classifier only the
 * describe handler reads): no kernel-walking consumer (`isKernelMutationStep`, the mutation walk,
 * the footprint) ever needs to distinguish a leave narration from an arrive one --- that question
 * belongs entirely to the copy-generator (`presentStepSequence`'s narration branch), which is why
 * `direction` lives as a plain data field here rather than being folded into `kind`. Splitting `kind`
 * into `'narrate-leave'`/`'narrate-arrive'` would make the walk-dispatch discriminant carry
 * copy-generation concerns it never asks about.
 */
export type PresentationKernelNarrateStep = {
    kind: 'narrate'
    direction: 'leave' | 'arrive'
    captureId: string
    roomId: EphemeraMembershipHostId
    characterName: string
    copyKind: MembershipEmissionCopyKind
    exitName?: string
    bundleId: string
    slotId: string
}

/**
 * The presentation kernel's own filtered view of `KernelStep` (PB-L): `ExecutorDescribeStep` (the
 * shipped describe branch, `presentStepSequence.ts`) and `PresentationKernelNarrateStep` (the
 * narration branch, Phase 2) --- both "things the presentation kernel filters for," the same
 * relationship `MutationKernelStep` already has to its own members.
 */
export type PresentationKernelStep = ExecutorDescribeStep | PresentationKernelNarrateStep

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
    step.kind === 'transferMembership' ||
    step.kind === 'establishRelation' ||
    step.kind === 'dissolveRelation' ||
    step.kind === 'capture'

/**
 * The presentation kernel's own type-guard filter (mirrors `isKernelMutationStep` above):
 * pulls the `describe` steps a shared `KernelStep[]` list carries out for `presentStepSequence`,
 * the same "shared list, per-kernel filter" discipline applied on this side.
 */
export const isDescribeStep = (step: KernelStep): step is ExecutorDescribeStep =>
    step.kind === 'describe'

/**
 * The presentation kernel's narration filter (Phase 2, sibling to `isDescribeStep` above): pulls the
 * `narrate-leave`/`narrate-arrive` steps a shared `KernelStep[]` list carries.
 */
export const isNarrateStep = (step: KernelStep): step is PresentationKernelNarrateStep =>
    step.kind === 'narrate'
