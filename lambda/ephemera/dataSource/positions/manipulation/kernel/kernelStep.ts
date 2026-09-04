import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
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
 * target). Relational steps are reused verbatim from the executor's types: `subjectId`/`targetId`
 * are `EphemeraLudicTerminalPrimitive`-typed (LP4g, 2026-08-19 --- widened from `EphemeraObjectId`
 * once reading the kernel's write path end to end showed no consumer branches on entity kind), so
 * there is nothing to generalize here.
 */
export type MutationKernelTransferStep = {
    kind: 'transferMembership'
    entityIds: ReadonlySet<EphemeraObjectId | EphemeraCharacterId>
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
 */
export type MutationKernelCaptureStep = {
    kind: 'capture'
    hostId: EphemeraMembershipHostId
    captureId: string
}

/**
 * The ludicGraph kernel's own machinery (`commitStepSequence.ts`, `applyStepSequenceCore.ts`,
 * `computeStepSequenceFootprint.ts`, `factsForStep.ts`) --- `transactWrite` bundling, footprint
 * locking, fact-streaming --- exists only to solve mutation problems, so it keeps accepting this
 * narrower type. `MutationKernelCaptureStep` joins it (PB-J), widening it for the first time since
 * the `describe` widening was drawn *against* --- capture reads a host's roster, so it needs the same
 * footprint-locking and reducer-walk machinery every other mutation step gets, even though it writes
 * nothing. A `describe` step must never reach any of these; the ludicGraph kernel's own type-guard
 * filter (Phase 3) excludes it before a step sequence is ever built, so this alias --- not the widened
 * `KernelStep` --- is what those files' signatures should keep using.
 */
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
 * Everything the copy-generator needs and nothing the presentation kernel's plumbing does --- the
 * structural form of the same boundary `kind: 'narrate'` draws at the walk-dispatch level (see
 * `PresentationKernelNarrateStep` below). Discriminated on narration *family*, deliberately not on
 * `direction`: `direction` is a membership-narration concept (leave/arrive between ludicGraph
 * hosts), not a universal property of narration, and the axis a second member actually arrives along
 * is family --- and Phase 4 paid that prediction off exactly: `ObjectMoveNarrationSpec` shares not
 * one field with `MembershipNarrationSpec`, carrying item/actor vocabulary instead, while a
 * direction-discriminated union would have had to split both families down an axis only one of them
 * has.
 *
 * Kept as plain data with dispatch living in `presentStepSequence`'s `buildNarrationCopy`, rather
 * than as a polymorphic class with a `buildCopy` method. Two families and one dispatcher is still a
 * thin seam; the escalation trigger below remains unmet on all three conditions. The
 * choice is worth revisiting, but the trigger is narrower than "a second family shows up" or "the
 * internals differ per family" --- a `switch` over a union exists precisely to let internals differ,
 * and N branches with N different bodies is that working as intended. The real signal is the
 * expression problem's axis: unions make adding *operations* cheap and adding *types* expensive,
 * classes invert it. Escalate when
 *
 *   1. multiple distinct operations switch over this union from separate files (not just the single
 *      `buildNarrationCopy`), **and**
 *   2. family count is churning faster than operation count, so "add a family" means hunting down
 *      every switch, **and**
 *   3. per-family *modules* can't already solve it.
 *
 * That third condition is what usually settles it. Heavy per-family logic --- e.g. an object-move
 * narration doing complex work across several ludicGraphs' captures --- reads like class
 * pressure, but it is cohesion pressure, and a module named for the family
 * (`objectTransferNarration.ts` exporting one builder) gives the same locality while keeping
 * `buildNarrationCopy` a two-line dispatcher. Complex capture work needs
 * `buildCopy(narration, captures)`, a signature change, not methods on the step. The case a closed
 * union genuinely *cannot* serve is narration families contributed by code that does not own the
 * union --- asset-authored narration, should that ever land. Weigh against the cost: these specs
 * ride inside `KernelStep[]` through structural test comparison, which plain data survives cleanly
 * and class instances do not (`toStrictEqual` compares prototypes; getters and private fields are
 * not own-enumerable).
 *
 * The Immer hazard sometimes cited alongside that is **not** a class-vs-plain distinction, and an
 * earlier revision of this comment overstated it. `EphemeraLudicGraph` instances cross a
 * `MultiKeyUpdate` reducer's boundary safely today (`commitStepSequence`'s `committedGraphs`, read
 * after the reducer returns) precisely because `fromFieldPayload` plain-copies every node and edge
 * rather than retaining the draft's own element references --- see its doc comment. The real rule is
 * PB-E's, and it is about provenance rather than class-ness: anything retained past a reducer's
 * return must have its references into the draft severed **per element** (`{...node}`, not merely
 * `[...array]`, which would keep the draft's elements alive inside a fresh outer array). A plain
 * object aliasing draft-backed sub-objects fails that test; a carefully-constructed class instance
 * passes it. In any case a `KernelStep[]` is built by the compiler *before* `commitStepSequence` is
 * called --- the reducer closes over it and reads it, never constructs it --- so nothing riding here
 * is draft-backed to begin with.
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
 * Object take/drop/give narration (Phase 4, PB-3/PB-M) --- the second family, and the one the
 * comment above predicted would arrive along the *family* axis rather than the direction one. It
 * shares no field with `MembershipNarrationSpec`, which is what makes discriminating on family
 * rather than on `direction` the right call in retrospect.
 *
 * **No `direction`, deliberately.** The compiler emits both bracket sides for an object move exactly
 * as it does for a character move (PB-M: never special-case the character-hosted side), but a
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
    /** Execute-time carry-closure size (LP4a: `EphemeraLudicGraph.objectIds.size`), not the Plan-stage intent's object count. */
    carriedCount: number
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
 * the line; someone who left between the beat and the flush not getting it). That is PB-A's
 * distinction collapsed, and the same defect class as the `[room, characterId]` tack-on this phase
 * retired, entering from the other end. The captured roster already includes the mover by
 * construction --- capture-from runs before the transfer step, capture-to after --- which is what
 * made that tack-on unnecessary and makes a room target unnecessary for the same reason.
 */
export type PresentationKernelNarrateStep = {
    kind: 'narrate'
    narration: NarrationSpecification
    captureId: string
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
 * The presentation kernel's narration filter (Phase 2, sibling to `isDescribeStep` above): pulls the
 * `narrate` steps a shared `KernelStep[]` list carries, of whatever narration family. Family-level
 * dispatch is the copy-generator's business, not the filter's --- see `NarrationSpecification`.
 */
export const isNarrateStep = (step: KernelStep): step is PresentationKernelNarrateStep =>
    step.kind === 'narrate'
