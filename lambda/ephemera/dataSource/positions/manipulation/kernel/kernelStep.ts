import type { EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCrossingPort, EphemeraPresencePort } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { TransferMembershipStep } from '../../../actions/enrich/objectManipulation/parsePlanStep'
import type {
    ExecutorDescribeStep,
    ExecutorDissolveRelationStep,
    ExecutorEstablishRelationStep,
    ExecutorParsePlanStep,
} from '../../../actions/enrich/objectManipulation/synthesize/executorTypes'
/**
 * The kernel-layer step vocabulary --- a deliberately narrow superset of the Synthesize executor's
 * `ExecutorParsePlanStep`. `entityIds` spans four id kinds: `EphemeraObjectId`/`EphemeraCharacterId`
 * for a real player-driven transfer, plus `EphemeraRoomId`/`EphemeraFeatureId` for cache-time
 * containment authoring (Room-in-Area, Feature-in-Room, Feature-in-Feature); the executor's own
 * `TransferMembershipStep` stays object-only, since character movement never goes through
 * Grounding/Expansion/Validation and a Room/Feature never reaches the executor at all.
 * `fromHostIds`/`toHostId` are a plural `froms` set plus a nullable `to`, mirroring `MembershipDiff`'s
 * `{froms: HostId[], to: HostId | null}` shape --- one step kind covers a real transfer (both
 * populated, the only shape the two player routes produce), a pure add (`fromHostIds` empty ---
 * spawn, or a Room/Feature's cache-time parent assignment), and a pure remove (`toHostId` null ---
 * destroy/clear, a stray-room scrub with no consolidation target). A Room/Feature/Area id may only
 * ever appear in the pure-add shape: `applyStepSequenceCore.ts`'s "real transfer" branch
 * (`applyTransferSet`) is Object/Character-only, since Room/Feature/Area are hosts that never
 * relocate; a Room/Feature id reaching that branch is a caller bug, rejected there rather than
 * silently mishandled. Relational steps are reused verbatim from the executor's types:
 * `subjectId`/`targetId` are `EphemeraLudicTerminalPrimitive`-typed, since no consumer on the
 * kernel's write path branches on entity kind, so there is nothing to generalize here.
 */
export type MutationKernelTransferStep = {
    kind: 'transferMembership'
    entityIds: ReadonlySet<EphemeraObjectId | EphemeraCharacterId | EphemeraRoomId | EphemeraFeatureId>
    fromHostIds: ReadonlySet<EphemeraMembershipHostId>
    toHostId: EphemeraMembershipHostId | null
}

/**
 * Positional capture (normative rules: `dataSource/positions/AGENT.contract.md`, "Capture steps are
 * read-only by shape"): a read-only walk step that
 * snapshots a host's roster mid-walk, so narration built later can reflect "who was there at this
 * beat" rather than final committed state. It carries no write payload --- that shape constraint is
 * what makes it safe to admit into the mutation kernel's own `transactWrite` walk (a step that could
 * write would need to join the transact item set; this one never does). `captureId` is caller-
 * assigned identity, never position --- the walk's array position is what makes the snapshot
 * positional, not the id.
 *
 * The ludicGraph kernel's own machinery (`commitStepSequence.ts`, `applyStepSequenceCore.ts`,
 * `computeStepSequenceFootprint.ts`, `factsForStep.ts`) --- `transactWrite` bundling, footprint
 * locking, fact-streaming --- takes `MutationKernelStep[]`, which this step joins alongside every
 * other mutation step even though it writes nothing, since it needs the same footprint-locking and
 * reducer-walk machinery. A `describe` step must never reach any of these; `isKernelMutationStep`'s
 * type-guard filter (below) excludes it before a step sequence is ever built, which is why that
 * narrower alias --- not the wider `KernelStep` --- is what those files' signatures use.
 */
export type MutationKernelCaptureStep = {
    kind: 'capture'
    hostId: EphemeraMembershipHostId
    captureId: string
}

/**
 * the moved object's own presence port, on its own graph (`hostId` is the moved object's
 * own id --- a legal `EphemeraMembershipHostId`, LP0). RD-2 (2026-09-04): multiplicity moved from
 * the step to the sequence --- N bindings is N `addPresencePort` steps, paired with a
 * `removePresencePort` per departure host, rather than one step replacing whatever was there. This
 * is what lets a pure add (spawn/population-everywhere) be expressed without touching
 * `MutationKernelTransferStep` (PR-12 in `AGENT.presence.planning.md`). At-most-one presence
 * (PR-10) is no longer a reducer-enforced property of this step; for characters it is enforced
 * separately, by an end-of-sequence validator in `applyStepSequenceCore.ts` (RD-1's single-hosted
 * restriction, `AGENT.contract.md`). Objects get no such enforcement, deliberately --- multi-
 * presence is the point. No `Present` edge is written --- PR-10 makes the cover implicit, derived
 * from the binding list, not a record either step maintains.
 */
export type MutationKernelAddPresencePortStep = {
    kind: 'addPresencePort'
    hostId: EphemeraMembershipHostId
    port: EphemeraPresencePort
}

/**
 * The remove half of RD-2's split. Addressed by host pair (`hostId` + `fromHostId`), not by
 * `portId` --- unlike `removeCrossingPort`, because the compiler has no prior-state read to learn a
 * `portId` from; that read is exactly what the old replace-all step existed to avoid. Removing an
 * absent binding is a silent no-op in the reducer, which is what lets the compiler emit one of
 * these per departure host without knowing which one (if any) actually held the port.
 */
export type MutationKernelRemovePresencePortStep = {
    kind: 'removePresencePort'
    hostId: EphemeraMembershipHostId
    fromHostId: EphemeraMembershipHostId
}

/**
 * a crossing-port record's own add/remove, distinct from a leg edge (an ordinary
 * `establishRelation`/`dissolveRelation` step whose endpoint happens to be a port address --- see
 * `executorTypes.ts`'s widening note). Unlike `setPresencePort`'s replace-all (presence is
 * at-most-one, PR-10), crossing ports are add/remove-by-`portId` --- a host can carry more than one
 * crossing port at once (one per relation that crosses it), so a fresh `tie` must not clobber an
 * existing crossing left by an earlier one. Split into two step kinds, mirroring
 * `establishRelation`/`dissolveRelation`'s own pairing, rather than one step with an `op` flag ---
 * consistent with how this kernel already prefers a step kind per effect over a flag field.
 */
export type MutationKernelAddCrossingPortStep = {
    kind: 'addCrossingPort'
    hostId: EphemeraMembershipHostId
    port: EphemeraCrossingPort
}

export type MutationKernelRemoveCrossingPortStep = {
    kind: 'removeCrossingPort'
    hostId: EphemeraMembershipHostId
    portId: string
}

export type MutationKernelStep =
    | MutationKernelTransferStep
    | ExecutorEstablishRelationStep
    | ExecutorDissolveRelationStep
    | MutationKernelCaptureStep
    | MutationKernelAddPresencePortStep
    | MutationKernelRemovePresencePortStep
    | MutationKernelAddCrossingPortStep
    | MutationKernelRemoveCrossingPortStep

/**
 * The shared, already-grounded instruction list's step vocabulary: `MutationKernelStep`, the
 * presentation kernel's read-only `ExecutorDescribeStep` (reused verbatim from the executor's own
 * types), and `PresentationKernelNarrateStep`. Each kernel filters this shared list down to the
 * steps it owns; the mutation kernel's filter yields `MutationKernelStep[]`, and the presentation
 * kernel's filter yields `PresentationKernelStep[]`.
 *
 * `KernelStep` itself stays unprefixed, deliberately (PB-K): it is the shared, cross-kernel
 * vocabulary, belonging to neither kernel alone, so it takes no kernel's name. Every other type in
 * this file is specific to one kernel and is named accordingly (`MutationKernel*` /
 * `PresentationKernel*`) --- prefixing `KernelStep` too would erase the one distinction this naming
 * scheme exists to preserve.
 */
export type KernelStep = MutationKernelStep | ExecutorDescribeStep | PresentationKernelNarrateStep

/**
 * Everything the copy-generator needs and nothing the presentation kernel's plumbing does --- the
 * structural form of the same boundary `kind: 'narrate'` draws at the walk-dispatch level (see
 * `PresentationKernelNarrateStep` below). Discriminated on narration *family*, deliberately not on
 * `direction`: `direction` is a membership-narration concept (leave/arrive between ludicGraph
 * hosts), not a universal property of narration; `ObjectMoveNarrationSpec` shares no field with
 * `MembershipNarrationSpec`, carrying item/actor vocabulary instead, so a `direction`-discriminated
 * union would have had to split both families down an axis only one of them has.
 *
 * Kept as plain data with dispatch living in `presentStepSequence`'s `buildNarrationCopy`, rather
 * than as a polymorphic class with a `buildCopy` method --- two families and one dispatcher does not
 * meet the escalation trigger for promoting a union to a class hierarchy (see
 * [`AGENT.concepts.md` --- Representation choice: union vs class](../../AGENT.concepts.md#representation-choice-union-vs-class-escalation-trigger)
 * for the general rule this was calibrated against). These specs also ride inside `KernelStep[]`
 * through `toStrictEqual` structural comparison in tests, which plain data survives and class
 * instances would not --- a reason to prefer data here independent of the trigger.
 *
 * A `KernelStep[]` is built by the compiler *before* `commitStepSequence` is called --- the reducer
 * closes over it and reads it, never constructs it --- so nothing riding here is Immer-draft-backed
 * to begin with (see [`AGENT.contract.md` --- Capture steps are read-only by shape](../../AGENT.contract.md#capture-steps-are-read-only-by-shape)
 * for the reducer-provenance rule that would otherwise apply).
 */

/**
 * Membership narration copy-kind vocabulary --- shared by `buildCharacterMoveOp.ts` (which selects
 * it per leave/arrive) and `publishMembershipPresentation.ts`'s suffix builders (which render it to
 * copy). Lives here, not in `perception/`, because this is where `MembershipNarrationSpec` --- its
 * only structural consumer --- is defined; the old home (`perception/membershipPresentationFanIn.ts`)
 * was retired along with the async membership fan-in, once it had nothing left in it but this type.
 */
export type MembershipEmissionCopyKind =
    | 'exitAware'
    | 'home'
    | 'connect'
    | 'disconnect'
    | 'genericNavigate'
    | 'genericFactOnly'

export type MembershipNarrationSpec = {
    kind: 'membershipMove'
    direction: 'leave' | 'arrive'
    characterName: string
    copyKind: MembershipEmissionCopyKind
    exitName?: string
}

/**
 * Object take/drop/give narration --- the second `NarrationSpecification` family, sharing no field
 * with `MembershipNarrationSpec` (see that type's own doc comment for why the union discriminates on
 * family rather than on `direction`).
 *
 * **No `direction`, deliberately.** The compiler emits both bracket sides for an object move exactly
 * as it does for a character move (never special-case the character-hosted side), but a
 * character's inventory graph has no roster, so exactly one of the two narrate steps ever has an
 * audience. Which side that is, is already answered by `verb`, so the same spec renders correctly on
 * both and the empty side simply publishes to nobody.
 *
 * `verb` is derived by the compiler from which side of the move was the room, never declared by the
 * caller --- see `objectMoveVerb` in `compilePositionKernelOp.ts`.
 */
export type ObjectMoveNarrationSpec = {
    kind: 'objectMove'
    verb: 'takeHold' | 'drop' | 'give'
    characterName: string
    objectShortName: string
}

export type NarrationSpecification = MembershipNarrationSpec | ObjectMoveNarrationSpec

/**
 * Positional narration (rules: `dataSource/positions/AGENT.contract.md`, "Narration and
 * presentation"): a read-only presentation-kernel step, never entering the mutation walk. Emitted
 * only by the compiler (`compile/compilePositionKernelOp.ts`), which is why it carries no built
 * `message`: the ingredients travel with the step under `narration`, and `presentStepSequence`
 * assembles the actual copy at flush time, alongside resolving `captureId` against the commit's
 * captured audience. `captureId` carries identity only, never position --- the capture step's own
 * array position is what makes the snapshot positional, not this reference to it.
 *
 * `kind` is the single, flat `'narrate'` --- mirroring `describe`'s own shape in this file
 * (`kind: 'describe'` at the walk-dispatch level, `referentKind` as the nested classifier only the
 * describe handler reads): no kernel-walking consumer (`isKernelMutationStep`, the mutation walk,
 * the footprint) ever needs to distinguish a leave narration from an arrive one --- that question
 * belongs entirely to the copy-generator (`presentStepSequence`'s narration branch). Splitting
 * `kind` into `'narrate-leave'`/`'narrate-arrive'` would make the walk-dispatch discriminant carry
 * copy-generation concerns it never asks about.
 *
 * The remaining flat fields are exactly the delivery half --- `captureId` resolves the audience,
 * `bundleId` and `slotId` route the report --- and are read only by the presentation kernel's
 * plumbing, never by the copy-generator. Everything the copy-generator reads lives under
 * `narration`, so that boundary is structural rather than conventional.
 *
 * `captureId` is the **sole** audience input, deliberately: there is no accompanying `roomId`
 * target. A bare `ROOM#` in a `PublishMessage`'s `targets` resolves through a live roster read at
 * flush time (`publishMessage/index.ts`'s `getRoomCharacterList`), i.e. terminally --- so carrying
 * one alongside `captureId` would union a positionally-bound audience with a terminally-bound one
 * and let the terminal reading win wherever they disagree (a latecomer to the arrival room getting
 * the line; someone who left between the beat and the flush not getting it). That collapses the
 * positional/terminal distinction, the same defect class a retired `[room, characterId]` tack-on
 * had from the other end. The captured roster already includes the mover by construction ---
 * capture-from runs before the transfer step, capture-to after --- which is what makes a room
 * target unnecessary here.
 */
export type PresentationKernelNarrateStep = {
    kind: 'narrate'
    narration: NarrationSpecification
    captureId: string
    bundleId: string
    slotId: string
}

/**
 * The presentation kernel's own filtered view of `KernelStep`: `ExecutorDescribeStep` (the
 * describe branch, `presentStepSequence.ts`) and `PresentationKernelNarrateStep` (the narration
 * branch) --- both "things the presentation kernel filters for," the same relationship
 * `MutationKernelStep` already has to its own members.
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
 * Overloaded (not just declared as `ExecutorParsePlanStep => KernelStep`) so that the ludicGraph
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
    step.kind === 'capture' ||
    step.kind === 'addPresencePort' ||
    step.kind === 'removePresencePort' ||
    step.kind === 'addCrossingPort' ||
    step.kind === 'removeCrossingPort'

/**
 * The presentation kernel's own type-guard filter (mirrors `isKernelMutationStep` above):
 * pulls the `describe` steps a shared `KernelStep[]` list carries out for `presentStepSequence`,
 * the same "shared list, per-kernel filter" discipline applied on this side.
 */
export const isDescribeStep = (step: KernelStep): step is ExecutorDescribeStep =>
    step.kind === 'describe'

/**
 * The presentation kernel's narration filter (sibling to `isDescribeStep` above): pulls the
 * `narrate` steps a shared `KernelStep[]` list carries, of whatever narration family. Family-level
 * dispatch is the copy-generator's business, not the filter's --- see `NarrationSpecification`.
 */
export const isNarrateStep = (step: KernelStep): step is PresentationKernelNarrateStep =>
    step.kind === 'narrate'
