import type { EphemeraObjectId, EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCrossingPort, EphemeraMetaObject, EphemeraPresenceCover, EphemeraPresenceCoverEntry, EphemeraPresenceParentPointer } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { ParentBinding } from '../../ludicGraph/presenceParent'
import type {
    ExecutorDescribeStep,
    ExecutorDissolveRelationStep,
    ExecutorEstablishRelationStep,
} from '../../../actions/enrich/objectManipulation/synthesize/executorTypes'
/**
 * The kernel-layer step vocabulary --- a deliberately narrow superset of the Synthesize executor's
 * `ExecutorParsePlanStep`. Membership (an entity's node in a host's graph) has no step of its own: it
 * is a consequence of the mover's presence bindings (a node is in host H iff some binding of it
 * points at H), applied inside the presence steps below (`addPresenceBinding`,
 * `movePresenceBinding`, `repairPresenceBinding`) by
 * `settleMembership.ts`. The executor's own `TransferMembershipStep` is the *action-layer* primitive
 * a player command plans; `planObjectMoveTransfer` compiles it to presence steps.
 */

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
 * Mints one presence binding on `hostId`'s own graph: cache-time containment population's add
 * (a child's first binding into an authored parent, or a whole's hostless root). A move never
 * emits this: it re-points the mover's existing binding (`movePresenceBinding`, below), so a
 * binding keeps its id for the whole's life (PR-21(e)). At-most-one presence is not a property of
 * this step; for characters it is enforced separately, by an end-of-sequence validator in
 * `applyStepSequenceCore.ts` --- characters are single-hosted, per `AGENT.contract.md`. Objects get
 * no such enforcement, deliberately --- multi-presence is the point.
 *
 * **Carries no port record (presenceNodes Slice 7a, PN-23).** The presence binding is a NODE
 * (`applyStepSequenceCore.ts`'s handler mints it via `addPresenceNode`). `presenceUuid` is minted
 * fresh per binding and becomes the node's `PRESENCE#{presenceUuid}` key.
 *
 * With a parent pointer, it also adds the node to that host if absent (`settleMembership.ts`), so
 * the pointer's host is in the step's footprint.
 */
export type MutationKernelAddPresenceBindingStep = {
    kind: 'addPresenceBinding'
    hostId: EphemeraMembershipHostId
    /** The parent binding this one sits under (PR-21); absent for a hostless binding. */
    fromHostPresence?: EphemeraPresenceParentPointer
    /** Defaults to `{ members: [] }`: the cover index adds each child's entry as its pointer is written. */
    cover?: EphemeraPresenceCover
    presenceUuid: string
}

/**
 * Creates a component's host row, born holding one hostless binding (`PRESENCE#Base`,
 * no parent pointer), so a component never exists without a binding. Birth is a binding's proper
 * origin; `containmentPopulationSteps.ts`'s `rootStep` is the late catch-up for components created
 * outside the kernel. A placement later in the same sequence re-points this binding
 * (`movePresenceBinding`), keeping its id.
 *
 * The host is not fetched: `commitStepSequence` leaves it out of the `MultiKeyUpdate` keys and
 * writes `{ ...meta, ludicGraph }` as a `Put` through the wrapper's `cascade`. v1 creates
 * improvised Objects only; `meta` is the row's non-graph fields.
 */
export type MutationKernelCreateComponentStep = {
    kind: 'createComponent'
    hostId: EphemeraObjectId
    meta: Omit<EphemeraMetaObject, 'ludicGraph'>
}

/**
 * Ends a component: drops its host from the outcome, and `commitStepSequence` turns that into a
 * conditioned `Delete` of the host row (`MultiKeyUpdate` deleting a fetched key). The mirror of
 * `createComponent`. The handler throws unless the host's graph holds nothing but its own root and
 * its own presence bindings, so anything it hosts must leave first, earlier in the same sequence
 * or in an earlier commit. v1 destroys improvised Objects only.
 */
export type MutationKernelDestroyComponentStep = {
    kind: 'destroyComponent'
    hostId: EphemeraObjectId
}

/**
 * Rewrites an existing binding's parent pointer and cover IN PLACE, keeping its `universalKey`
 * (so no child pointer is orphaned). The explicit repair path for a binding population would now
 * write differently (a pointer not naming the parent's binding, a room's Area cover with members); a correct binding never
 * emits one, so a rerun of population is a true no-op once repaired. A missing binding is stale,
 * never silently created. A pointer names the host the mover now sits in, so the node is added there
 * if absent (`settleMembership.ts`). Every present producer repairs within one host; a repair that
 * leaves another host names the binding it leaves in `previousParent`, so the footprint locks that
 * host and its cover entry and node go with the move.
 */
export type MutationKernelRepairPresenceBindingStep = {
    kind: 'repairPresenceBinding'
    hostId: EphemeraMembershipHostId
    presenceId: EphemeraPresenceNodeId
    fromHostPresence?: EphemeraPresenceParentPointer
    previousParent?: EphemeraPresenceParentPointer
    cover: EphemeraPresenceCover
}

/**
 * A binding of a host, as a move names it: the host whose graph holds the binding, and its id there.
 * The same shape as a stored parent pointer (`fromHostPresences`) (`ParentBinding`, `presenceParent.ts`), now that
 * `presence` is required there.
 */
export type PresenceBindingRef = ParentBinding

/**
 * A move's presence write: takes one binding of the mover (`presence`, on
 * `hostId`'s own graph), or the `subCover` part of its cover, from the parent binding it sits under
 * now (`from`; `null` for a hostless binding, a first placement) to the parent binding `to`, or to
 * no parent (`to: null`). Nothing is resolved by host and nothing is guessed: the producer names
 * both ends, and the handler is `stale` when `presence` or `to.presence` is gone, or when the stored
 * pointer is no longer `from` (an optimistic check against a concurrent writer). `from.host` and
 * `to.host` may be equal: a move between two bindings of one parent.
 *
 * - **A whole binding** (no `subCover`): if the mover holds no binding under `to`, the binding is
 *   re-pointed and keeps its id and cover, so no child pointer naming it is orphaned (PR-21(e)). If
 *   it already holds one there, the moved entries join it and the moved binding is removed.
 * - **A `subCover` part**: only those entries move, to the mover's binding under `to` or to a new one
 *   (`mintedPresence`, minted by the producer so a later step can name it). The source binding stays,
 *   even with an empty cover. Every entry must be listed by the source's cover.
 * - **To no parent**: the entries land in `PRESENCE#Base` if it is hostless, else in
 *   `PRESENCE#Unplaced` (minted if absent). Base moved to no parent absorbs Unplaced. A whole holding
 *   no Base is `stale` (`baseMissing`): every whole holds Base from creation on, and stored data was
 *   migrated to it.
 * - **Children re-point, and collisions merge.** Each moved entry is a child's binding, re-pointed to
 *   the binding that now covers it; a child left holding two bindings under it has them merged by
 *   this same move one level down.
 * - **The cover index.** The same step writes the parent covers: an entry onto `to`'s binding when a
 *   binding arrives there and off `from`'s when one leaves. A bystander never touches a room graph,
 *   so its parent covers are not written.
 *
 * It also applies membership (`settleMembership.ts`): the node leaves `from.host` unless another
 * binding of the mover still points there, and arrives at `to.host` unless it is already there. Both
 * hosts are in the step's footprint.
 *
 * `cover` is the planner's read of the moved binding's cover (whole moves), carried because the
 * footprint is computed from the steps before any graph loads, and the children to lock are only
 * named there (as a join's `absorbedCover` was); the handler checks it against the stored cover, so
 * one that changed since planning is `stale`. `cascadeHosts` names the hosts of any child bindings
 * the planner found would collide, so their merge's own children are locked too.
 */
export type MutationKernelMovePresenceBindingStep = {
    kind: 'movePresenceBinding'
    hostId: EphemeraMembershipHostId
    presence: EphemeraPresenceNodeId
    from: ParentBinding | null
    to: PresenceBindingRef | null
    subCover?: readonly EphemeraPresenceCoverEntry[]
    mintedPresence?: EphemeraPresenceNodeId
    cover?: EphemeraPresenceCover
    cascadeHosts?: readonly EphemeraMembershipHostId[]
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
    | ExecutorEstablishRelationStep
    | ExecutorDissolveRelationStep
    | MutationKernelCaptureStep
    | MutationKernelCreateComponentStep
    | MutationKernelDestroyComponentStep
    | MutationKernelAddPresenceBindingStep
    | MutationKernelMovePresenceBindingStep
    | MutationKernelRepairPresenceBindingStep
    | MutationKernelAddCrossingPortStep
    | MutationKernelRemoveCrossingPortStep

/**
 * Every `MutationKernelStep` kind, as a record so adding a kind to the union without listing it here
 * fails to compile. Read by `ludicCache/invalidationCompleteness.integration.test.ts`, which must
 * carry a case for each kind that writes a graph.
 */
export const mutationKernelStepKinds = {
    establishRelation: true,
    dissolveRelation: true,
    capture: true,
    createComponent: true,
    destroyComponent: true,
    addPresenceBinding: true,
    movePresenceBinding: true,
    repairPresenceBinding: true,
    addCrossingPort: true,
    removeCrossingPort: true,
} as const satisfies Record<MutationKernelStep['kind'], true>

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
 * hosts), not a universal property of narration; `TemplateNarrationSpec` shares no field with
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
 * A narration template: the carrier for authored narration (an attempt's narration units, filled at
 * delivery). Sharing no field with `MembershipNarrationSpec` (see that type's own doc
 * comment for why the union discriminates on family rather than on `direction`).
 *
 * `parts` is a flat sequence of literal text, the actor slot, and references to entities by id,
 * never a token string, so authored text can carry any characters without escaping. Nothing here
 * names a role an entity plays (no `object`, `subject`, `target`): a part refers to an entity, and
 * `labels` supplies each referenced entity's display label at flush. That is what lets a relational
 * default or an authored template use this same arm without a new field or family.
 *
 * `actorName` is separate from `labels` because the actor is the narration's own slot (later the
 * key for role variants), not an entity the template happens to mention.
 *
 * **No `direction`, deliberately.** Which side of an action a line is heard from is its audience's
 * phase (`before`/`after`), which chooses the capture the step reads; the copy itself is the same
 * either way. An empty captured roster simply publishes to nobody.
 *
 * Parts come from whatever created the action (Plan's templates, Expansion), never from the
 * delta; see `narrationTemplate.ts` for the fill.
 */
export type NarrationPart =
    | { text: string }
    | { slot: 'actor' }
    | { ref: string }

export type TemplateNarrationSpec = {
    kind: 'template'
    parts: NarrationPart[]
    actorName: string
    /** Display label per entity id, for every `ref` part. */
    labels: Record<string, string>
}

export type NarrationSpecification = MembershipNarrationSpec | TemplateNarrationSpec

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
 * The remaining flat field is exactly the delivery half --- `captureId` resolves the audience ---
 * and is read only by the presentation kernel's plumbing, never by the copy-generator. Everything the copy-generator reads lives under
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
 * capture-from runs before the presence steps, capture-to after --- which is what makes a room
 * target unnecessary here.
 */
export type PresentationKernelNarrateStep = {
    kind: 'narrate'
    narration: NarrationSpecification
    captureId: string
}

/**
 * The presentation kernel's own filtered view of `KernelStep`: `ExecutorDescribeStep` (the
 * describe branch, `presentStepSequence.ts`) and `PresentationKernelNarrateStep` (the narration
 * branch) --- both "things the presentation kernel filters for," the same relationship
 * `MutationKernelStep` already has to its own members.
 */
export type PresentationKernelStep = ExecutorDescribeStep | PresentationKernelNarrateStep

/**
 * The mutation kernel's own type-guard filter (mirrors the presentation kernel's
 * `describe`-only filter below): pulls the mutation steps out of a shared `KernelStep[]` list ---
 * the same "shared list, per-kernel filter" discipline the presentation kernel uses, which
 * self-documents the invariant instead of casting past it.
 */
export const isKernelMutationStep = (step: KernelStep): step is MutationKernelStep =>
    step.kind === 'establishRelation' ||
    step.kind === 'dissolveRelation' ||
    step.kind === 'capture' ||
    step.kind === 'createComponent' ||
    step.kind === 'destroyComponent' ||
    step.kind === 'addPresenceBinding' ||
    step.kind === 'movePresenceBinding' ||
    step.kind === 'repairPresenceBinding' ||
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
