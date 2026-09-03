# Positions --- contracts

This file records **falsifiable rules** for `mtw.ephemera.positions` **as implemented today**. Mental models: [`AGENT.concepts.md`](AGENT.concepts.md). Code map: [`AGENT.implementation.md`](AGENT.implementation.md).

Play membership persistence uses **`Meta::<Kind>.ludicGraph`** (forward; Room / Character / Object / Feature / Area --- see [Host storage](#host-storage-one-shared-serde-one-documented-exception)) + **adjacency index** (reverse) as sole authority --- see [Room play graph + adjacency reverse index](AGENT.concepts.md#room-play-graph--adjacency-reverse-index). **`Character Moved`** and **`Object Moved`** are **membership host transfer** projections on the bus --- `froms[]` / `to` describe eligible host endpoints, not per-host kernel granularity, and the fact bus shape uses plural **`froms[]`**.

---

## DataSource identity

- **`dataSourceKey`** must be `mtw.ephemera.positions`.
- **`replayable`** is `false` for v1.
- **`publisherStrategy`** is `busOnly` (outbound **`Character Moved`** on internal bus).
- Subscription guards live in [`subscribedEvents.ts`](subscribedEvents.ts); new ingress types must register a header guard there (not a separate DataSource module).

---

## Scope of authority (manipulation vs presentation)

Mental model: [**Graph roles**](AGENT.concepts.md#graph-roles-shared-shape-different-authority). This section states normative boundaries only.

**Positions must own (play manipulation truth):**

- Membership persist (`Meta::<Kind>.ludicGraph` on any membership host kind, adjacency index) and eviction ladder (`RoomStack`) bundled with apply per membership sections below.
- **`Object`** nodes on room **`ludicGraph`** + **`OBJECT#`** adjacency rows (**I5**); objects lane owns existence rows (improvisation pair + **`Meta::Object`**) only.
- **`Meta::Character.ludicGraph`** for character-hosted inventory (**D16**); cross-host membership apply under [`manipulation/membership/`](manipulation/membership/).
- **`Character Moved`** and **`Object Moved`** descriptive fact streams --- **membership host transfer projection** from persist outcome at apply.
- Gateway topology read backing for stored membership graph and adjacency (see [Read surface](#read-surface-forward-graph-vs-reverse-containers)).

**Positions must not own (presentation truth):**

- Roster **display** fields (`DisplayName`, `SessionIds`, `Color`, `fileURL`) as steady-state authority --- hydrate at read time per [Read surface](#read-surface-forward-graph-vs-reverse-containers).
- Affordance wire compose (`AffordanceRoomDeliverable`) or exit topology (`projectRoomExits`, `ComponentTopology`, `AffordanceCache`).

**Gateway read envelope:**

- **`PlayLudicGraph`** **must** be topology only (alias of `StandardLudicGraphData`); **must not** carry roster display fields or reverse-membership encodings on the forward graph.
- Forward **`getLudicGraph`** **must** return stored topology only on Dynamo load; **`Positions.set`** **must** accept topology-only graphs.

**Deferred (edge-reference cleanup):** object removal prunes play-only (Exit) edges on hosts participating in the removal transaction only (Relational edges are assert-and-throw, not pruned --- caller must dissolve them explicitly first). Cross-host or edge-only references without a node-removal path are not swept by membership adjacency today. See [`ludicGraph/AGENT.md`](ludicGraph/AGENT.md) **Known limitation (deferred)** and [`../objects/AGENT.md`](../objects/AGENT.md) **Deferred (cross-host edge references)**.

**Deferred (character-relation widening, BD-36):** `HostRelationalEdge` endpoints are `EphemeraObjectId`-typed only --- a character can never hold a Relational edge, so `removeCharacter`'s assert-and-throw is vacuously satisfied today. Widening to admit `EphemeraCharacterId` waits for a KR-write path that authors character relations, which does not exist yet. See [`ludicGraph/AGENT.md`](ludicGraph/AGENT.md) **Known limitation (deferred)**.

---

## Manipulation persist layering

Mental model: [**Manipulation layering**](AGENT.concepts.md#manipulation-layering-membership-transfer). Code map: [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md). Gateway conflict policy: [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md).

**Architectural:**

- Every graph-grounded persist **must** converge on one kernel entrypoint, **`commitStepSequence`**. Planning happens strictly upstream --- in the shared membership adapter, or in the Synthesize executor re-run at execute time; the kernel only transacts.
- Kernel **must** accept explicit **`KernelStep[]`** only; **must not** call **`getMembershipContainers`** to discover priors.
- **Must not** add parallel persist paths (new `update*LudicGraphs` with bundled planner + transact; per-verb diff computers outside `executeMembershipTransfer` ([`manipulation/membership/executeObjectMove.ts`](manipulation/membership/executeObjectMove.ts))).
- **Shipped kernel:** one general **`commitStepSequence`** (**`KernelStep[]`**) covers membership-node add/remove (`transferMembership`, entity-kind-general per BD-36) and in-host relational edge add/remove (`establishRelation`/`dissolveRelation`) --- see [`manipulation/kernel/`](manipulation/kernel/).
- Positions kernel in-memory graph simulation **must** use **`EphemeraLudicGraph`** / **`EphemeraLudicGraph[]`** --- **must not** reintroduce bare **`EphemeraLudicGraphFieldPayload`** simulation or ad-hoc merge helpers outside [`ludicGraph/`](ludicGraph/). Mental model: [`AGENT.concepts.md`](AGENT.concepts.md#type-boundary-storage-vs-gateway-read-envelope); module spec: [`ludicGraph/AGENT.md`](ludicGraph/AGENT.md).
- Actions **may** import **`EphemeraLudicGraph`** read-only for observation/legality; actions **must not** persist graphs or build transact items.

**Today (shipped behavior):**

- On graph vs adjacency conflict, **`ludicGraph` wins** (diagnostics repair from graph).
- Transfer-planning pre-reads (**`getMembershipContainers`**) **must** run on coordinator / adapter side, **not** in kernel persist.

**Apply mode (`executeMembershipTransfer`):**

Diffs against its own fetched `priorContainers` end-state style only --- `froms` = every prior host `!== target` (any host kind; a room-filtered `getMembershipContainers` override narrows this for room-only callers). Covers navigate, connect, disconnect, home, object room place / remove, spawn, drift repair, and destroy/edit clear.

PV1-1b (retiring the standalone `planMembershipTransfer` adapter) did not carry forward a **bounded** mode (remove only from trusted-ingress hosts, without end-state-scrubbing the rest) --- it had no caller among the routes PV1-1b migrated. A future caller needing bounded semantics must add them back explicitly.

**`takeHold`** and **`drop`** do **not** reach the kernel through `executeMembershipTransfer`. Their transfer set is grounded by the Synthesize executor, re-run at execute time against live graphs, via `executeObjectMove` (the carry-closure sibling in the same file) --- see [`Object Take Hold`](#object-take-hold-positions-owned) and [`Object Drop`](#object-drop-positions-owned).

Module paths: [`manipulation/membership/executeObjectMove.ts`](manipulation/membership/executeObjectMove.ts) (transfer pipeline), [`manipulation/kernel/`](manipulation/kernel/) (kernel --- `commitStepSequence.ts`, `applyStepSequenceCore.ts`, `kernelStep.ts`). Kernel invariants: [`manipulation/AGENT.implementation.md` --- Kernel invariants](manipulation/AGENT.implementation.md#kernel-invariants).

---

## Narration and presentation

Mental model: [**Positional vs. terminal binding**](AGENT.concepts.md#positional-vs-terminal-binding) and [**Abstract op and compiled step**](AGENT.concepts.md#abstract-op-and-compiled-step-two-levels). Code map: [`manipulation/AGENT.implementation.md` --- Presentation kernel](manipulation/AGENT.implementation.md#presentation-kernel).

Every narration a position change produces --- character leave/arrive (navigate, home, connect, disconnect, ghost-purge) and object take/drop/give --- is **compiled**, not hand-built. This section states the rules that hold across all of them. Per-route bundles are in the route sections below.

### Binding time: world state early, transport state late

**Early-bind a target iff resolving it reads *world* state; late-bind iff it reads *transport* state.**

- **`ROOM#`** resolves against the room's `ludicGraph` --- world state. It **must** be bound at beat time, inside the kernel walk, to a concrete `EphemeraCharacterId[]`.
- **`CHARACTER#`** and **`SESSION#`** resolve against connected sessions --- transport state. They **must** stay late-bound, resolved at flush by [`publishMessage/index.ts`](../../publishMessage/index.ts).

[`getRoomCharacterList`](../../internalCache/hydrateRoomRoster.ts) is the existence proof the two are separable: it already performs one of each, in that order (`Positions.getLudicGraph(roomId).characterIds`, then `CharacterMeta` + `CharacterSessions` hydration). Early binding hoists the first half to beat time and leaves the second where it is.

**Consequence, and the rule that actually bites: a narrate step carries no room target at all.** `captureId` is its sole audience input.

- A `PresentationKernelNarrateStep` **must not** carry a bare `ROOM#` in `targets`, and **must not** union one with a captured audience. A `ROOM#` re-expands against the **live** roster at flush, so pairing the two lets the terminally-bound reading win wherever they disagree --- which is the same defect class as the retired `[room, characterId]` tack-on, entering from the other end.
- An unresolvable `captureId` **must throw**. It **must not** degrade to a room target or to an empty audience. Capture ids are minted only by [`compilePositionKernelOp`](manipulation/kernel/compile/compilePositionKernelOp.ts), so a miss means the plan is internally inconsistent, and either quiet recovery hides that behind a silently-wrong or silently-absent delivery.

**Beat-time and flush-time capture differ only under concurrent third-party membership change**, and beat time is the correct answer there: the audience for "Tess left" is who was standing in the room at that beat, not who wandered in while an LLM was still generating a header.

### Capture steps are read-only by shape

A **`MutationKernelCaptureStep`** carries **`hostId`** + **`captureId`** and **no write payload**. That shape requirement is what makes a read-only step safe inside the mutation walk --- enforce it by shape, **not** by excluding capture from the walk.

- A capture step **must not** contribute to the `transactWrite` write set. It contributes to the **read/lock** set only.
- A capture **must** be an entry in the `KernelStep[]` array, **not** a side-table threaded past the walk. [`computeStepSequenceFootprint`](manipulation/kernel/computeStepSequenceFootprint.ts) is the transaction's lock-set declaration and is computed **once, up front**: `MultiKeyUpdate` cannot be re-entered mid-reducer to lock a newly-discovered host. As an array step the footprint picks up `hostId` automatically and it is structurally impossible to forget. As a side-table, every caller would have to remember to union capture hosts into the footprint --- and it would fail *late and selectively*, since navigate happens to work (its move already locks both rooms) while the first break would be a capture against an otherwise-unmutated host.
- Captured values **must** be plain `EphemeraCharacterId[]`, and the reducer **must** record them by **assignment, never append**. `applyStepSequenceCore` runs inside a `MultiKeyUpdate` reducer under `exponentialBackoffWrapper`, so the body can run several times; an accumulating `push` duplicates narration across retry attempts. (Immer `produce()` also revokes draft-backed objects after the reducer returns --- ids being primitive strings makes that free here by construction rather than by discipline.)
- Capture **must not** validate. `hydrateRoomRosterFromCharacterIds` drops characters whose `CharacterMeta` is missing; that is a validity concern, neither world nor transport, and it stays at flush.

**Captures are compiled only when the op narrates.** A non-narrating move (object spawn/destroy/place/remove, and the navigate pre-commit mutation-only compile) produces no capture steps and therefore locks no extra hosts. Do not "fix" a missing capture by defaulting `captures` to an empty map at a call site.

### An object move's verb is a property of the delta

take / drop / give is derived from **which side of the move was the room**, inside [`compilePositionKernelOp`](manipulation/kernel/compile/compilePositionKernelOp.ts): `to` is a room -> `drop`; a `from` is a room -> `takeHold`; neither -> `give`.

- **No call site may pass a verb**, and no code may infer one backwards from a published fact. The retired `inferOperationFromFact` did exactly that, and `give` falls out of the forward rule with no new discriminant.
- The moved set **must** travel as `moved: { kind: 'closure', fragment }` for objects and `{ kind: 'entity', entityId }` for characters. Primacy is **`fragment.rootId`** --- recorded by `computeCarryClosure` from its `startId` argument, never derived from traversal shape (its BFS guards with `closureSet.has(...)`, so a doubly-reachable object is absorbed via whichever edge was reached first). **Must not** reintroduce a set-plus-separate-primary-id shape: that is a cross-field invariant nothing enforces.
- Severed boundary edges **must not** enter the fragment. Expansion classifies them ([`boundaryEdgeOutcomes`](ludicGraph/expandValidate/interactionUnderTransfer.ts)) and they travel to the compiler on `op.dissolvedEdges`, which renders them into `dissolveRelation` steps ahead of the transfer. **Expansion classifies; the compiler sequences.**

### Narration is presented only for a committed mutation

The presentation kernel's narrate branch **must** run on [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts)'s **`ok: true`** result and never otherwise. A failed or illegal commit narrates nothing.

This is enforced at the type level --- `captures` exists only on the success branch, and `presentStepSequence` throws on an unresolvable `captureId` --- but that guard reads as incidental shape unless stated, and "surface a failed move to the player somehow" is a live product question whose eventual answer must not be allowed to erode it.

**Not a contract clause:** *when* the messageOrchestration bundle is declared relative to the commit. Declaring after a successful commit is a consistency preference across the orchestrators, not a correctness requirement --- the fan-in is explicitly tolerant of unresolved slots (see [`../messageOrchestration/AGENT.md`](../messageOrchestration/AGENT.md), "Publish behavior"). Do not write it up as normative.

### Call sites emit ops; only the compiler names steps

No call site outside [`manipulation/kernel/compile/`](manipulation/kernel/compile/) may construct a `{ kind: 'narrate', ... }` or `{ kind: 'capture', ... }` step literal. Call sites supply an op and its narration **ingredients** (`characterName`, copy-kind selectors, `objectShortName`, `exitName`); the compiler decides shape, ordering, capture ids, and slots, and [`presentStepSequence`](manipulation/kernel/presentStepSequence.ts) assembles the message string at flush.

Builders: [`membership/buildCharacterMoveOp.ts`](membership/buildCharacterMoveOp.ts) (character routes) and [`membership/buildObjectMoveOp.ts`](membership/buildObjectMoveOp.ts) (object routes) --- **siblings, not one widened module**. They share no copy-selection logic, and `NarrationSpecification` is a union on narration *family* for the same reason.

---

## Membership persistence API

All character **room-membership** mutations for **disconnect**, **navigate**, and **connect** **must** go through [`applyCharacterRoomMembership`](membership/applyCharacterRoomMembership.ts).

**A character's membership host is a `ROOM`, and only a `ROOM`.** Objects are unrestricted and may be hosted by rooms, characters, objects, features and areas as the host union already allows; characters **must not** be transferred into any non-Room host's `ludicGraph`. **This is a scoping decision, not a claim that characters are ontologically unlike objects, and must not be cited as one** --- it exists to keep the character path single-hosted while the general graph work matures, and it lifts when that work does.

**It is currently unenforced, and the failure is silent.** An Object is a legal `EphemeraMembershipHostId` and [`MutationKernelTransferStep`](manipulation/kernel/kernelStep.ts) already admits a character as a transferable entity, so an object-hosted character would persist successfully, then read as having zero **Room** containers, fall through to the `RoomStack`, and present as **out of play**. What holds the restriction today is four independent read-side narrowings ([`resolveCharacterRoomId`](membership/resolveCharacterRoomId.ts) and [`syncMembershipAdjacency`](membership/syncMembershipAdjacency.ts) filtering containers with `isEphemeraRoomId`, plus the Room-only apply filters under [Read surface](#read-surface-forward-graph-vs-reverse-containers)) --- none of which refuse the write. Treat this bullet as the statement of intent that those filters implement; **do not** infer from the absence of a guard that the restriction is optional.

### Public apply shape

- **Args:** `{ characterId, targetRoomId: EphemeraRoomId | null }` --- `null` = out of play (disconnect). **Must not** consume stream / intent `fromRoomId` for persist.
- **Result:** `{ froms, to, changed }` where `changed` is true iff prior container set differs from end state (`{ targetRoomId }` or `{}` when out of play). **`froms`** is required (same semantics as **`MembershipDiff`** / bus fact).
- **Navigate orchestration:** [`orchestrateCharacterNavigate`](navigate/orchestrateNavigate.ts) receives full **`froms[]`** from the apply result for presentation (arrival-room header slot, render kicks). Does **not** publish **`MapUpdate`** (server map runtime retired; see [`../maps/AGENT.md`](../maps/AGENT.md)).
- **Leave/arrive world lines --- every character route:** navigate, home, connect, disconnect, and the ghost-purge sweep all narrate through the compiler. A coordinator builds its op via [`buildCharacterMoveOp`](membership/buildCharacterMoveOp.ts), [`compilePositionKernelOp`](manipulation/kernel/compile/compilePositionKernelOp.ts) expands it into positionally-captured narration steps, and [`presentStepSequence`](manipulation/kernel/presentStepSequence.ts) reports them --- the audience is the mid-walk **captured** roster, and therefore already includes the mover by construction on the leave side. Rules: [Narration and presentation](#narration-and-presentation). There is **no** async membership fan-in; `Character Moved` still streams as a fact, but perception does not subscribe to it. `narratedInline` on the fact is a **vestige** of the migration that retired that fan-in --- it suppressed a duplicate leg while both paths coexisted, and gates nothing today.
- **Two orchestrators, not one:** navigate/home/connect share [`orchestrateCharacterNavigate`](navigate/orchestrateNavigate.ts) (they all have a destination room, so the arrival header slot and `registerIngressSlot` make sense). Disconnect and ghost-purge use [`orchestrateCharacterDisconnect`](membership/orchestrateCharacterDisconnect.ts), which declares the bundle and presents leave narration only --- **must not** be routed through the navigate orchestrator, whose header/render logic presumes a `to`.
- **Graph persist path:** coordinator ([`applyCharacterRoomMembership`](membership/applyCharacterRoomMembership.ts)) -> [`executeMembershipTransfer`](manipulation/membership/executeObjectMove.ts) (single entity, diffed against its own `priorContainers`) -> [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts) (`MultiKeyUpdate`) --- a `transferMembership` step, plus capture steps bracketing it (`compileMutationSteps` on `MembershipApplyArgs`). No `dissolveRelation` steps accompany it: a character can never be a relational-edge endpoint, `HostRelationalEdge` being object-only. `Character Moved` fact emission is folded into `commitStepSequence` / [`factsForStep`](manipulation/kernel/factsForStep.ts) rather than layered on top by the coordinator. Detail: [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md).

### Graph apply (end-state)

- **Must** use pure end-state apply on **`targetRoomId`** only.
- **Must** derive **`MembershipDiff.froms`** from observed prior containers removed (may be **`length > 1`** on drift repair).
- **Must** maintain **`ludicGraph`** + adjacency in the same **`transactWrite`** bundle; **must not** write legacy **`activeCharacters`** / **`RoomId`** membership projections. Mental model: [Room play graph + adjacency reverse index](AGENT.concepts.md#room-play-graph--adjacency-reverse-index).
- On conflict between graph and adjacency, **`ludicGraph` wins** (diagnostics repair from graph).
- **Adjacency row existence is an existential invariant, not a lifecycle event:** a row `(EphemeraId: X, DataCategory: POSITION#<hostId>)` exists **iff** X is a node in `<hostId>`'s `ludicGraph`. It is not a refcount over edges --- edges of every kind (hosting, peer) are orthogonal to this index, which is why the kernel **must not** write adjacency rows for relational edges (see [Edge persist shape](#edge-persist-shape-bd-3) below). **Forward note:** when hosting-as-shard lands, dissolving a hosting edge (`On`/`In`/`PartOf`) becomes a membership change and **must** be routed as a `transferMembership` step, so adjacency keeps following node presence --- not by teaching adjacency to inspect edges.

#### Host storage: one shared serde, one documented exception

- Every membership host kind **must** persist its forward graph as **`Meta::<Kind>.ludicGraph`** --- `Meta::Room`, `Meta::Character`, `Meta::Object`, `Meta::Feature`, `Meta::Area` --- carrying the identical **`EphemeraLudicGraphFieldPayload`** shape and decoded through the identical **`fromFieldPayload`**. There is **no** per-kind stored shape.
- Decode **must** go through **one shared plain-serde body**: a direct `ludicGraph` field read whose absent-value default is a trivial empty graph. Per-kind factory helpers are **thin wrappers** over that body and **must not** add per-kind decode behavior.
- **`Room` alone** carries an absent-value fallback: when `ludicGraph` is missing, it reconstructs from **`Meta::Room.activeCharacters`** via `seedFromActiveCharacters` rather than defaulting to empty. **This asymmetry is deliberate.** Room is the only host kind with a second data source its graph can be reconstructed from; the others have no connect/disconnect lifecycle and therefore no reconstruction source. **Must not** be "regularized" away, and **must not** be generalized to another kind without first establishing that kind has its own independent second source.
- Adding a new host kind therefore costs a `Meta::<Kind>` record, a thin wrapper, and a dispatch branch --- **not** a new serde.

### Membership-changed bundle

When **`MembershipDiff.changed`** is true, persist and its follow-on effects **must** happen together or not at all. **The kernel owns most of the bundle** --- coordinators **must not** re-implement any of it:

1. **`Character Moved`** on `mtw.ephemera.positions` (membership host transfer projection), streamed from [`factsForStep`](manipulation/kernel/factsForStep.ts) in step order.
2. Cache memo for **every** committed graph --- `Positions.set` unconditionally, plus `ComponentEphemeraMeta.invalidate` / `AffordanceRoomDeliverable.invalidate` for Room hosts. **Must** run *before* any fact streams, to avoid an affordance-refresh race.
3. `setMembershipContainers` for the moved entity.
4. `RoomUpdate` per affected Room host, published *after* the fact stream.
5. `beatAnchorTime` recorded at apply and returned on the kernel result.

The character coordinator ([`applyCharacterRoomMembership`](membership/applyCharacterRoomMembership.ts)) adds only what is character-specific, after a successful commit:

6. `CharacterMeta.invalidate(characterId)`.
7. `EphemeraUpdate` `CharacterInPlay` room projection.
8. `roomRosterSnapshots` on the apply result, built from **`getRoomCharacterList`** after the kernel's graph memo seed.

When **`changed`** is false: the coordinator **must** return before calling the kernel at all --- no persist, no fact stream, no cache, no `RoomUpdate`, no `EphemeraUpdate`. This includes eviction-ladder-only updates where the room membership endpoint is unchanged.

**Post-move presentation split:** step 4 **`RoomUpdate`** (affordance refresh for all occupants in **`froms`** / **`to`**) is **separate** from the mover-only arrival header render (an ingress slot registered with **`mtw.ephemera.messageOrchestration`** in navigate orchestration --- see [`../messageOrchestration/AGENT.md`](../messageOrchestration/AGENT.md)). Positions **must not** conflate affordance refresh with header render on the membership API. **`Object Moved`** affordance refresh consumer: **`mtw.ephemera.affordanceOrchestration`** ([`../affordanceOrchestration/index.ts`](../affordanceOrchestration/index.ts)).

### Eviction ladder (`RoomStack` storage)

Mental model: [**Eviction ladder**](AGENT.concepts.md#eviction-ladder). Code map: [`AGENT.implementation.md` --- Eviction ladder](AGENT.implementation.md#eviction-ladder-roomstack-storage).

- **Must not** expose eviction ladder edits on **`MembershipApplyArgs`** --- public apply remains `{ characterId, targetRoomId | null }` only. Ladder shape is internal to persist / resolution helpers.
- **Legal placement resolution:** trim `RoomStack` to accessible assets; surviving top frame is the proposed `targetRoomId`. **Connect** --- place from nowhere (`froms: []`). **Asset visibility loss** --- relocate from an illegal occupancy when top frame differs from current membership.
- **Navigate ladder timing:** after successful graph persist when **`MembershipDiff.to !== null`**, navigate callers **must** run ladder maintenance in the parallel tail ([`persistRoomStackNavigate`](membership/persistRoomStackNavigate.ts) + [`orchestrateCharacterNavigate`](navigate/orchestrateNavigate.ts) via [`afterCharacterMembershipNavigateChanged`](navigate/afterCharacterMembershipNavigateChanged.ts)). **Must not** gate the membership-changed bundle on ladder completion.
- **Navigate merge:** ladder persist **must** use per-frame `timeWritten` (epoch ms) stamped from **`beatAnchorTime`** at graph persist. A write at time `T` **must not** overwrite or truncate frames with `timeWritten > T`, and **must not** extend outer frames unless `T` exceeds all existing frame timestamps. Missing `timeWritten` **must** be treated as `0` (legacy rows).
- **Trim persist:** asset/connect trim **must** filter inaccessible frames and **preserve** survivor `timeWritten` values. **Must not** use navigate merge semantics on trim paths.
- **Failure tolerance:** ladder persist failure after retry exhaustion **must not** fail membership apply or navigate presentation orchestration; errors **must** be logged.
- On **disconnect**, the coordinator **must** purge play membership (`ludicGraph`, adjacency) and **must preserve** `RoomStack` (connect resolves legal placement from the retained stack).
- **Must not** emit **`Character Moved`** or run the membership-changed bundle when **only** the eviction ladder changes and the room membership endpoint is unchanged.
- When asset loss **trim** changes the membership endpoint for an **in-play** character, relocation **must** go through [`repairCharacterLegalPlacement`](membership/repairCharacterLegalPlacement.ts) -> [`applyCharacterRoomMembership`](membership/applyCharacterRoomMembership.ts). **Out-of-play** characters (**`getMembershipContainers`** empty): trim **`RoomStack` only** --- **must not** re-insert into play.

### `Character Moved` fact

Membership host transfer projection --- coordinators **must** derive fact fields from persist diff (or adapter projection), not from ingress args alone.

- **Must** stream only when **`MembershipDiff.changed`** after successful graph persist.
- **`froms: EphemeraRoomId[]`** = distinct prior membership hosts removed at apply (`[]` = out of play). **May** emit **`froms.length > 1`** when drift repair scrubs multiple hosts.
- **`to`** = destination membership host after apply (`null` on disconnect).
- **`beatAnchorTime`** = recorded time at persistence apply.
- **Must not** populate **`legalExits`** on emitted facts.
- **Must not** branch **`streamEvent`** on ingress type (navigate vs disconnect); emission is descriptive from **`MembershipDiff`** only.
- **`streamEvent`** is a **required** coordinator dependency (no in-module fallback). **`receiveEvents`** passes the DataSource instance `streamEvent`.
- Payload contract: [`publishedEvents.ts`](publishedEvents.ts). **No perception consumer:** leave/arrive narration compiles inline (see [Narration and presentation](#narration-and-presentation)), and perception no longer subscribes to `Character Moved` at all. The fact remains a descriptive stream for any future consumer; `narratedInline` on it is a vestige of the migration window and gates nothing.

### Object room membership (nodes only)

All improvisational **object room-placement** mutations **must** go through [`executeMembershipTransfer`](manipulation/membership/executeObjectMove.ts).

- **Args:** `{ entityId: objectId, target: EphemeraRoomId | null }` --- `null` = removed from all hosts.
- **Graph persist path:** caller -> `executeMembershipTransfer` (diffs against its own fetched `priorContainers`, end-state) -> [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts) (`MultiKeyUpdate`). Every relational chain touching the object **must** be swept explicitly first (PV1-3c: `findRelationalChainsTouching`, following crossing ports across hosts, not just the departure host's own plain edges) and dissolved via explicit `dissolveRelation`/`removeCrossingPort` steps ahead of the transfer step, rather than silently stripped --- `removeObject` throws on a residual relational edge by design. Detail: [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md).
- **Must** persist **`ludicGraph`** + adjacency in the same transact; on conflict **`ludicGraph` wins** (mirrors the character-route rule above).
- **Spawn initial placement (objects-lane coordinator):** improvisational **existence** (pair + **`Meta::Object`**) is objects-lane owned; **initial room placement** at spawn **must** call `executeMembershipTransfer` from the objects coordinator ([`spawnOneImprovisationObject`](../objects/spawnImprovisationObjectsBatch.ts)) --- same pipeline as place/remove/drift repair. **Two atomic steps**, not one cross-lane transact (**I1** cross-lane spawn bundle retired).
- **S1 compensating delete:** if placement fails after successful existence create, objects coordinator **must** call `persistDeleteImprovisationObject` before treating the row as failed. If compensation delete also fails, **must** `console.error` with `objectId`, placement error, and delete error **and** emit **`Spawn Compensation Problem`** on **`mtw.ephemera.objects`** via [`streamSpawnCompensationProblem`](../objects/problemReports.ts). Diagnostics intake runs [`orphanedImprovisedObjectSweep`](../../../diagnostics/orphanedImprovisedObjectSweep/); when litmus confirms orphan, **must** emit **`Orphaned Improvised Object Finding`** on **`mtw.diagnostics`** (sweep contract: [`lambda/diagnostics/AGENT.md`](../../../diagnostics/AGENT.md) **Orphaned improvised object sweep**). Objects lane **must** subscribe to the finding and call **`persistDeleteImprovisationObject`** (delete-only repair; see [`objects/AGENT.md`](../objects/AGENT.md) **Diagnostics repair**).
- **Orphan vs adjacency lag (existence-without-placement):**
  - **Orphan:** `(OBJECT#, ASSET#IMPROVISATION)` pair **and** `Meta::Object` present, no **`Object`** node on any host `ludicGraph`, and `getMembershipContainers(objectId)` empty --- diagnostics **`Orphaned Improvised Object Finding`** (not [`repairObjectPlacementDrift`](membership/repairObjectPlacementDrift.ts)).
  - **Adjacency lag:** **`Object`** node present on a host graph but containers empty or missing that host --- [`repairObjectPlacementDrift`](membership/repairObjectPlacementDrift.ts) owns sync; orphan sweep **must not** emit a finding.
- **Cross-lane sequencing:** spawn sequences existence then graph (rows-then-graph); remove sequences graph then row delete (graph-then-rows) --- both are two-step by design.

### `Object Moved` fact (I4)

Membership host transfer projection --- coordinators **must** derive fact fields from persist diff (or adapter projection), not from ingress args alone.

- **Must** stream only when membership diff **`changed`** after successful object graph persist.
- Payload: `{ type: 'Object Moved', objectId, froms[], to, beatAnchorTime }` --- membership-host endpoints (`ROOM#`, `CHARACTER#` in v1; **D8**). v1 **`takeHold`**: `froms: [ROOM#...]`, `to: CHARACTER#...`. v1 **`drop`**: `froms: [CHARACTER#...]`, `to: ROOM#...`.
- **Must not** populate presentation fields on the fact.
- Fan-in consumer for affordance refresh: **`mtw.ephemera.affordanceOrchestration`** ([`../affordanceOrchestration/index.ts`](../affordanceOrchestration/index.ts)).

### Object membership-changed bundle (room-only)

When object room-only **`MembershipDiff.changed`**, the bundle is the kernel's --- **`Object Moved`** fact, `Positions.set` + Room-host cache invalidation, `setMembershipContainers(objectId)`, and one **`RoomUpdate`** per affected room, in that order. `executeMembershipTransfer` ([`manipulation/membership/executeObjectMove.ts`](manipulation/membership/executeObjectMove.ts)) **must not** duplicate any of it; on `changed: false` it returns before calling the kernel.

A severed boundary relation streams **`Object Relation Changed`** alongside the move, suppressed only when the caller passes `suppressRelationalFacts: true` (e.g. [`repairObjectPlacementDrift`](membership/repairObjectPlacementDrift.ts)'s consistency scrub). Destroy/edit (`{ entityId: objectId, target: null }`, always end-state-to-null across every prior host of either kind) follows the identical kernel path and fact rule, leaving `suppressRelationalFacts` unset --- PV1-1b folded this case into `executeMembershipTransfer` rather than a separate coordinator.

### Cross-host object membership-changed bundle (object move: `takeHold` / `drop` / `give`)

**One execution path covers both directions.** [`executeObjectMove`](manipulation/membership/executeObjectMove.ts) takes a **host pair** --- `{ objectIds, fromHostId, toHostId }` --- and takes **no acting character and no verb**. It seeds the Synthesize executor **grounded** from those concrete host ids (no `GroundingContext`, no referent round trip), compiles the resulting move into a plan, and commits the plan's mutation steps via [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts) --- one atomic `MultiKeyUpdate` over the departure and arrival hosts.

**Intents stay distinct; execution unifies.** `Object Take Hold` and `Object Drop` remain two events with two Plan-stage legality branches, because the player-facing errors genuinely differ per direction ("you're not carrying that" vs. "you're already holding that") and they are different utterances. The world-effect is one operation. **Must not** reintroduce a per-direction execution module, and **must not** introduce `updateDropLudicGraphs` or any new `update*LudicGraphs` fork.

The transfer set is **re-derived, not scrubbed from trusted ingress**: operand expansion recomputes the carry closure fresh against current graph state, and the reducer re-validates presence and boundary-edge classification on the locked graphs at commit time. A concurrent modification since selection aborts the whole transact rather than applying a stale plan.

The post-persist bundle is the kernel's, per entity in the transfer set:

1. **`Object Moved`**, streamed in step order after any `Object Relation Changed` for severed boundary edges. `takeHold`: `froms: [ROOM#...]`, `to: CHARACTER#...`. `drop`: `froms: [CHARACTER#...]`, `to: ROOM#...`.
2. `Positions.set` on **every** committed graph --- both hosts; `ComponentEphemeraMeta.invalidate` / `AffordanceRoomDeliverable.invalidate` for Room hosts only.
3. `setMembershipContainers(objectId)` -> the arrival host.
4. **`RoomUpdate`** per Room host only --- a character endpoint has no room affordance to refresh.

An illegal or stale executor verdict **must** return `{ ok: false }` without committing (no persist, no bundle, **no narration**). It currently yields no player feedback; surfacing failure is an open product question, not a licence to narrate an uncommitted move.

**Narration** is owned by [`orchestrateObjectMove`](manipulation/membership/orchestrateObjectMove.ts), which wraps `executeObjectMove`: it derives the acting character and room from the host pair, resolves labels **before** the commit (so the compiled plan carries capture steps), then declares the bundle and presents narration on the `ok: true` result. Verb derivation and the moved-set shape are in [Narration and presentation](#narration-and-presentation). Playbook: [`manipulation/AGENT.implementation.md` --- Apply modes](manipulation/AGENT.implementation.md#apply-modes).

### Host-local relational-changed bundle (`establishRelation` / `dissolveRelation`)

Graph persist: [`applyObjectRelationalChange`](manipulation/relational/applyObjectRelationalChange.ts) builds an `establishRelation` / `dissolveRelation` step sequence and commits it via [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts). Relational steps **must not** route through the shared membership adapter; they compose with membership transfer by appearing in the same step sequence.

The bundle is kernel-owned:

1. **`Object Relation Changed`** streamed in step order.
2. `internalCache.Positions.set` for **`hostId`** --- **unconditional** across host kinds; **must not** skip the cache seed just because the host isn't a Room (that would leave a character's cached graph stale).
3. **`ComponentEphemeraMeta.invalidate`** / **`AffordanceRoomDeliverable.invalidate`** for **`hostId`** --- **only** when **`hostId`** is a Room (`isEphemeraRoomId`); these caches have no Character-hosted equivalent.
4. Internal **`RoomUpdate`** for **`hostId`** --- **only** when **`hostId`** is a Room; a Character-hosted relation has no room affordance to refresh.

**Must skip** the entire bundle when **`changed: false`** (idempotent duplicate edge on **`op: 'add'`**). Relational fan-in **requires** actions intent leg; perception does not defer on fact-only settle for relational clusters. Character-hosted relation narration is unresolved UX/copy design (BD-15/16) --- the perception leg adapter declines (returns no leg) for a non-Room **`hostId`** rather than guessing copy.

### Object placement drift repair

- **Steady state:** at most one room per **`OBJECT#`**; multi-room adjacency is drift.
- **Graph-forward repair:** [`repairObjectPlacementDrift`](membership/repairObjectPlacementDrift.ts) --- adjacency-only via [`syncObjectMembershipAdjacencyToRoom`](membership/syncObjectMembershipAdjacency.ts); multi-container scrub via **`executeMembershipTransfer`** retaining the finding room, with `suppressRelationalFacts: true` --- a severed boundary relation here is a silent consistency fixup, not a player-visible event, so it must not stream **`Object Relation Changed`** (`Object Moved` streams unaffected). Applies when a graph **`Object`** node exists (adjacency lag); **not** for existence-without-placement orphans (pair + meta without graph node --- see **Orphan vs adjacency lag** above and [`orphanedImprovisedObjectSweep`](../../../diagnostics/orphanedImprovisedObjectSweep/)).
- **Deferred:** `Object Placement Drift Finding` diagnostics sweep (character analog: [`roomOccupancyDriftSweep`](../../../diagnostics/roomOccupancyDriftSweep/)).

---

## Host-local relational patch

Kernel: [`manipulation/kernel/`](manipulation/kernel/) (`establishRelation` / `dissolveRelation` steps). Coordinators: [`manipulation/relational/`](manipulation/relational/). Code map: [`manipulation/AGENT.implementation.md` --- Host-local relational patch](manipulation/AGENT.implementation.md#host-local-relational-patch).

Mental model: [**Host-local relational patch**](AGENT.concepts.md#manipulation-layering-membership-transfer) (in-host topology without membership-host change). Distinct from membership transfer (which moves nodes between hosts) and from the adjacency reverse index (**no** adjacency dual-write for relational edges).

### Relation kind enum (BD-2)

v1 **`HostRelationalEdgeKind`** on stored forward-graph edges **must** be one of:

| Kind | Player language (examples) | Persist |
| --- | --- | --- |
| **`On`** | on, onto | **`kind: 'On'`** only |
| **`Under`** | under, beneath | **`kind: 'Under'`** only |
| **`Against`** | against, leaning against | **`kind: 'Against'`** only |
| **`Custom`** | tied to, wrapped around, long-tail phrases | **`kind: 'Custom'`** + **`relationLabel`** (see below) |

**Excluded from this operator (BD-2):** **`In`**, **`inside`**, and other containment language --- **must not** persist as **`establishRelation`** v1; actions routes to future **nested container** operator with player-facing defer copy (not positions ingress).

Parse/enrich owns normalization from **`relationSpan`** -> **`kind`** (+ optional label); positions **must** trust ingress **`kind`** / **`relationLabel`** at apply (same pattern as trusted **`objectId`** on **`Object Take Hold`**). Implementation: [`normalizeRelationSpan`](../actions/enrich/objectManipulation/normalizeRelationSpan.ts) + [`relationKind`](../actions/enrich/objectManipulation/relationKind.ts) types in actions enrich (B2 shipped). B3 legality pre-ingress: [`evaluateRelationalLegality`](../actions/enrich/objectManipulation/evaluateRelationalLegality.ts) observes host graph via read-only **`EphemeraLudicGraph`** from [`ludicGraph/`](ludicGraph/); stored edge wire shape is **`EphemeraLudicRelationalEdgeData`** (`tag: 'Relational'` on host **`ludicGraph.edges`**); gateway read projection passes through stored relational edges ([`packages/mtw-gateways/ts/ephemera/positions/project.ts`](../../../../packages/mtw-gateways/ts/ephemera/positions/project.ts)).

### Edge persist shape (BD-3)

Relational mutations **must** persist on a **fixed host** --- the host's own **`Meta::<Kind>.ludicGraph`** forward graph only. `RelationalIngressArgs.hostId` is an `EphemeraMembershipHostId`, so **any** of the five host kinds is a legal persist target and all five dispatch through storage. **Room and Character are the kinds production ingress is confirmed to produce today** (BD-15/16 --- a Character host arises genuinely when subject and target already share the acting character's inventory graph); Object / Feature / Area are storage-supported and grounding-reachable but have no confirmed production ingress path yet, so **absence of one is not evidence the host kind is illegal**. **Must not** write adjacency rows for relational edges (forward-graph only; see [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md#host-local-relational-patch)).

**`HostRelationalPatch`** (kernel input; one add or remove on one host):

```typescript
type HostRelationalEdgeKind =
    | 'On' | 'In' | 'PartOf' | 'Under' | 'Against' | 'Custom' | 'Present'

/** The kind/label pairing, shared by every type that carries one. */
type RelationalEdgeKindAndLabel<K extends string = HostRelationalEdgeKind> =
    | { kind: Exclude<K, 'Custom'> }
    | { kind: 'Custom'; relationLabel: string }

type HostRelationalEdge =
    | ({ from: EphemeraLudicTerminalPrimitive; to: EphemeraLudicTerminalPrimitive }
        & { kind: Exclude<HostRelationalEdgeKind, 'Custom'> })
    | ({ from: EphemeraLudicTerminalPrimitive; to: EphemeraLudicTerminalPrimitive }
        & { kind: 'Custom'; relationLabel: string })

type HostRelationalPatch = {
    hostId: EphemeraMembershipHostId
    edge: HostRelationalEdge
    op: 'add' | 'remove'
}
```

**BD-3 rules:**

- **`relationLabel` belongs structurally to `Custom`**, and the rule runs **both** ways: a `Custom` edge **must** carry a non-empty label, and **no other kind may carry one at all**. This is expressed in the type (`RelationalEdgeKindAndLabel`, and `RelationalKindAndLabel` for the DTO lane's `relationKind` spelling), not by runtime checks at each layer --- an illegal pairing does not compile.
- **`Custom`** edges **must** persist **`relationLabel`** on the stored forward-graph edge --- **not** presentation-only copy in perception.
- **`isEphemeraLudicRelationalEdgeData` must reject a non-`Custom` edge carrying a label**, since such a value is unrepresentable and a guard accepting it would lie about what it narrows. A stored row in that shape is recovered by [`extractRelationalEdgesFromStored`](ludicGraph/baseClasses.ts)'s fallback **with the stray label stripped** --- sound and lossless. A `Custom` row with no usable label is **not** recoverable there and is dropped.
- **`establishRelation`** ingress **must** map to **`op: 'add'`**; **`dissolveRelation`** **must** map to **`op: 'remove'`** matching **`from`**, **`to`**, **`kind`**, and **`relationLabel`** (when **`Custom`**) (**BD-7**).

### Kernel and compound apply (BD-9)

- All **`establishRelation`** / **`dissolveRelation`** applies **must** route through **`commitStepSequence`** as explicit relational steps. **Must not** add a relational-specific kernel entrypoint alongside it.
- Composed commands (**drop** + **`establishRelation`**, etc.) **must** carry membership and relational steps in **one** step sequence and therefore **one** **`transactWrite`** (atomic all-or-nothing --- **BD-9**); **must not** apply them as independent transacts with partial commit.
- **Legality is re-verified inside the transaction, never from a snapshot.** The `MultiKeyUpdate` reducer re-runs `EphemeraLudicGraph.applyRelationalPatch` --- the single shared legality authority, including `bothObjectsOnGraph` --- against freshly-fetched, locked graphs, and throws to abort on any staleness or illegality. On conflict, **`ludicGraph` wins** (same authority as membership graph).
- A `sameHost` violation discovered only at commit time (a concurrent write moved one of the objects since selection) is caught by that same `bothObjectsOnGraph` check --- **must not** be given a bespoke `sameHost`-specific mechanism.
- Self-healing a stale assumption (recomputing a fresh repair and bundling it atomically) is **not** attempted: any staleness fails the whole transact with one generic error code. This is an acknowledged interim answer standing in for a not-yet-built persistence-level backtrack channel, not a permanent design conclusion (**BD-18**).

### Legality (actions-owned pre-ingress; positions-owned at apply)

| Case | Phase B--C (actions) | Positions apply |
| --- | --- | --- |
| Both **`from`** and **`to`** nodes on host graph | Required before egress | Re-validate; reject if absent |
| Exact duplicate edge already present | Idempotent success / no-op | **`op: 'add'`** no-op when edge matches |
| Conflicting or non-trivial existing relational topology on subject/target | **Error** stub (**BD-10** defer bucket until Phase D plan LLM) | **Must not** receive ingress until actions resolves |
| **`dissolveRelation`** with no matching edge | **Error** before egress | Reject **`op: 'remove'`** when edge absent |

### Ingress summary

Actions **must** publish **`Object Establish Relation`** and **`Object Dissolve Relation`** on grounded **`EstablishRelation`** parse from **`Parse Requested`** ([`../actions/index.ts`](../actions/index.ts); payload + guards in [`../actions/publishedEvents.ts`](../actions/publishedEvents.ts)). Positions **must** subscribe in [`subscribedEvents.ts`](subscribedEvents.ts) and delegate to coordinators under [`manipulation/relational/`](manipulation/relational/). Normative handler rules: [Ingress --- `Object Establish Relation`](#object-establish-relation-positions-owned), [Ingress --- `Object Dissolve Relation`](#object-dissolve-relation-positions-owned). Coordinators **must** trust actions-resolved **`subjectId`**, **`targetId`**, **`relationKind`**, optional **`relationLabel`**, and **`hostId`** (Room or Character) --- no catalog re-resolve in positions v1. Both **`Object Establish Relation`** (PV1-3b-2) and **`Object Dissolve Relation`** (PV1-3b-15) carry **`steps: MutationKernelStep[]`**, the Expansion-derived, already-ordered mutation-kernel chain (port steps before the legs that reference them); **`hostId`** on either payload is narration/perception use only (a genuine crossing has no single host). A genuine crossing establish (peer relation across a shard boundary, **C2**) and a genuine crossing dissolve alike reach ingress and commit in one `commitStepSequence` transact via [`executeEstablishEdgeChain`](manipulation/relational/executeObjectEstablishRelation.ts) --- `operationKind`-agnostic despite its establish-flavored name (PV1-3b-16): it treats `establishRelation`/`dissolveRelation`/`addCrossingPort`/`removeCrossingPort` steps symmetrically, so both coordinators share the one commit path.

### `Object Relation Changed` fact

- Payload: `{ type: 'Object Relation Changed', subjectId, targetId, hostId, relationKind, relationLabel?, operation: 'establish' | 'dissolve', beatAnchorTime }`.
- Streamed from coordinator on successful persist when **`changed: true`**; perception fan-in wires actions intent + **`Object Relation Changed`** fact -> **`WorldMessage`** ([`../perception/objectManipulationPresentationFanIn.ts`](../perception/objectManipulationPresentationFanIn.ts)).
- Post-persist bundle detail: [Host-local relational-changed bundle](#host-local-relational-changed-bundle-establishrelation--dissolverelation).

**Must not** route relational patch through **`executeMembershipTransfer`**.

---

## Ingress

### `mtw.connections.characters`

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Character Connected` | [`handleCharacterConnected`](handleConnectionsCharactersPresence.ts) |
| `Character Disconnected` | [`handleCharacterDisconnected`](handleConnectionsCharactersPresence.ts) |

Positions **must not** subscribe to `Character Registered` (session orientation is render + affordance orchestration; see [`../../AGENT.md`](../../AGENT.md)).

### `mtw.ephemera.actions`

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Character Navigate` | [`index.ts`](index.ts) `receiveEvents` -> [`navigate/executeCharacterNavigate.ts`](navigate/executeCharacterNavigate.ts) |
| `Character Home` | [`index.ts`](index.ts) `receiveEvents` -> [`navigate/executeCharacterNavigate.ts`](navigate/executeCharacterNavigate.ts) |
| `Object Take Hold` | [`index.ts`](index.ts) `receiveEvents` -> [`manipulation/membership/orchestrateObjectMove.ts`](manipulation/membership/orchestrateObjectMove.ts) (room -> character) |
| `Object Drop` | [`index.ts`](index.ts) `receiveEvents` -> [`manipulation/membership/orchestrateObjectMove.ts`](manipulation/membership/orchestrateObjectMove.ts) (character -> room) |
| `Object Establish Relation` | [`index.ts`](index.ts) `receiveEvents` -> [`manipulation/relational/executeObjectEstablishRelation.ts`](manipulation/relational/executeObjectEstablishRelation.ts) |
| `Object Dissolve Relation` | [`index.ts`](index.ts) `receiveEvents` -> [`manipulation/relational/executeObjectEstablishRelation.ts`](manipulation/relational/executeObjectEstablishRelation.ts) (`executeEstablishEdgeChain`, shared with establish, PV1-3b-16) |

### `Object Take Hold` (positions-owned)

- **Ingress:** typed pick-up via actions **`Parse Requested`** only (**D13** --- no **`Action Assessed`** branch in v1).
- **Must** trust actions-resolved `objectIds` (carry-closed transfer set, BD-13; size 1 for an ordinary command) and `roomId` (source room at egress) at apply --- no re-read of in-room catalog in positions.
- **Must** call [`orchestrateObjectMove`](manipulation/membership/orchestrateObjectMove.ts) with `{ objectIds, fromHostId: roomId, toHostId: characterId }` --- one atomic `MultiKeyUpdate` transact (departure room + arrival character) via [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts) (**D14**). The branch names its **host pair** and nothing else: **must not** pass a verb, a direction flag, or an acting character (see [Narration and presentation](#narration-and-presentation)).
- **Live re-derivation, not bounded scrub from trusted ingress alone:** the executor re-runs at execute time and the `MultiKeyUpdate` reducer re-validates the transfer (presence + boundary-edge classification) against freshly-fetched host graphs at commit time --- a concurrent modification since selection aborts the whole transact rather than applying a stale plan.
- **Character inventory:** **must** add every object in `objectIds` at target `characterId`; internal relational edges among the set are recreated on the destination host, derived live from the fetched source graph (not passed in).

### `Object Drop` (positions-owned)

- **Ingress:** typed drop via actions **`Parse Requested`** only (no **`Action Assessed`** branch in v1). Stream contract: **`Object Drop`**, payload `{ characterId, objectIds, roomId }` (symmetric to **`Object Take Hold`**; `objectIds` is a set, not a singular id). Payload type + guard in actions [`publishedEvents.ts`](../actions/publishedEvents.ts); actions **`Parse Requested`** publishes **`Object Drop`** when enrich yields `operationKind: drop`.
- **Must** trust actions-resolved `objectIds` (carry-closed transfer set, BD-13; size 1 for an ordinary command) and `roomId` (destination room at egress) at apply --- no re-read of held inventory catalog in positions.
- **Must** call [`orchestrateObjectMove`](manipulation/membership/orchestrateObjectMove.ts) with `{ objectIds, fromHostId: characterId, toHostId: roomId }` --- the same entry point as take-hold, with the host pair reversed; one atomic `MultiKeyUpdate` transact (departure character + arrival room) via [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts).
- **Live re-derivation, not bounded scrub from trusted ingress alone:** same commit-time re-validation as `Object Take Hold`, above.

### `Object Establish Relation` (positions-owned)

- **Ingress:** typed establish via actions **`Parse Requested`** only (no **`Action Assessed`** branch in v1). Stream contract: **`Object Establish Relation`**, payload `{ characterId, subjectId, targetId, hostId, relationKind, relationLabel?, confidence?, steps }` (**`hostId`** widened from Room-only **`roomId`**, BD-15/16 slice 4; **`steps: MutationKernelStep[]`** added PV1-3b-2 --- see [Ingress summary](#ingress-summary)). Payload type + guard in actions [`publishedEvents.ts`](../actions/publishedEvents.ts); actions **`Parse Requested`** publishes when enrich yields grounded **`EstablishRelation`** with **`operationKind: establishRelation`**.
- **Must** trust actions-resolved `steps` at apply --- no re-read of in-room catalog in positions, no re-derivation of any step's host (each carries its own, PV1-3b-7).
- **Must** call [`executeEstablishEdgeChain`](manipulation/relational/executeObjectEstablishRelation.ts) with `{ steps }` --- one `commitStepSequence` transact, port steps before the legs that reference them; handles both a portless single-host edge (one-entry `steps`) and a genuine multi-host crossing uniformly (PV1-3b-2 retired the old single-host-only `executeObjectEstablishRelation`).
- **Idempotency:** duplicate establish when exact edge already present (`changed: false`) **must** be a no-op (no bundle).

### `Object Dissolve Relation` (positions-owned)

- **Ingress:** typed dissolve via actions **`Parse Requested`** only (no **`Action Assessed`** branch in v1). Stream contract: **`Object Dissolve Relation`**, payload `{ characterId, subjectId, targetId, hostId, relationKind, relationLabel?, confidence?, steps }` (**`steps: MutationKernelStep[]`** added PV1-3b-15, mirroring PV1-3b-2 --- see [Ingress summary](#ingress-summary)). Payload type + guard in actions [`publishedEvents.ts`](../actions/publishedEvents.ts); actions **`Parse Requested`** publishes when enrich yields grounded **`EstablishRelation`** with **`operationKind: dissolveRelation`**.
- **Must** trust actions-resolved `steps` at apply --- no re-read of in-room catalog in positions, no re-derivation of any step's host (each carries its own, PV1-3b-7).
- **Must** call [`executeEstablishEdgeChain`](manipulation/relational/executeObjectEstablishRelation.ts) with `{ steps }` --- one `commitStepSequence` transact, port-removal steps alongside the dissolve legs that reference them, handling both a portless single-host edge (one-entry `steps`) and a genuine multi-host crossing dissolve uniformly (PV1-3b-16; the old single-host-only `executeObjectDissolveRelation` is retired, mirroring PV1-3b-2's retirement of its establish-side counterpart).
- **Must** reject apply when matching edge absent on host graph (kernel **`op: 'remove'`** matching edge **`from`**, **`to`**, **`kind`**, and **`relationLabel`** when **`Custom`**).

### `Character Home` (positions-owned)

- **Ingress:** typed **`home`** / **`HomeIntent`** via actions **`Parse Requested`**, trusted home via actions **`Action Assessed`** **`Home`** (`source: 'uiHome'`).
- **Must** trust actions-resolved `toRoomId` (`CharacterMeta.HomeId`) at apply --- no exit topology re-check in positions.
- **Must** call `applyCharacterRoomMembership({ characterId, targetRoomId: content.toRoomId })` then post-persist orchestration when `changed`.
- **Must not** rely on imperative `MoveCharacter` bus messages from actions for home (retired).
- Leave/arrive world copy for home is **compiled** (`intentKind: 'home'` on [`buildCharacterMoveOp`](membership/buildCharacterMoveOp.ts)) and reported by [`presentStepSequence`](manipulation/kernel/presentStepSequence.ts) inside the navigate orchestration tail --- see [Narration and presentation](#narration-and-presentation).

### `Character Connected` (positions-owned)

- **Must** resolve `targetRoomId` via [`resolveConnectTargetRoom`](membership/resolveConnectTargetRoom.ts) --- legal placement from nowhere: trim ladder to accessible assets, then top surviving frame (default VORTEX when stack normalizes empty).
- **Must** call `applyCharacterRoomMembership({ characterId, targetRoomId })` then post-persist orchestration when `changed`.
- **Must not** publish `CheckLocation` or perform inline membership Dynamo writes outside [`membership/`](membership/).
- **Idempotency:** duplicate connect when already in target room (`changed: false`) **must** be a no-op (no bundle, no orchestration).
- Arrive world-line copy for connect is **compiled** (`intentKind: 'connect'`); with `froms` empty the compiler emits no capture-from and no leave narration, from arity alone rather than a connect-specific branch. Connect reuses the navigate orchestration tail and publishes no imperative world lines.

### `Character Disconnected` (positions-owned)

- **Must** call `applyCharacterRoomMembership({ characterId, targetRoomId: null })` --- purges play membership; **must not** clear `RoomStack` (connect re-resolves legal placement from retained ladder).
- **Must not** perform inline membership writes outside [`membership/`](membership/).
- **Idempotency:** duplicate disconnect when already out of play (`changed: false`) **must** be a no-op (no bundle).
- Leave world-line copy for disconnect is **compiled** (`intentKind: 'disconnect'`) and presented by [`orchestrateCharacterDisconnect`](membership/orchestrateCharacterDisconnect.ts), **not** the navigate orchestrator --- disconnect has no `to`, so there is no arrival header to render. No imperative `PublishMessage` in the handler. The ghost-purge sweep in [`repairRoomOccupancyDrift`](membership/repairRoomOccupancyDrift.ts) shares this path and this copy verbatim: a ghost session genuinely has disconnected, so **must not** grow a separate drift narration variant.

### `Character Navigate` (positions-owned)

- **Ingress:** typed commands via actions **`Parse Requested`**, UI exit clicks via actions **`Action Assessed`** **`Navigation`** (same execution contract).
- **Must** trust actions-validated `toRoomId` at apply (no topology re-check in positions).
- **Must** call `applyCharacterRoomMembership({ characterId, targetRoomId: content.toRoomId })` then post-persist orchestration when `changed`.
- **Must not** rely on imperative `MoveCharacter` bus messages from actions for parse-based or UI-exit navigation (retired).
- Leave/arrive world copy for navigate is **compiled** and reported synchronously in the orchestration tail --- see [Narration and presentation](#narration-and-presentation). Exit-aware leave copy comes from the parse's `exitName` travelling as a narration *ingredient* on the op; **must not** be re-derived from fact `legalExits`.

### `mtw.diagnostics` --- occupancy drift repair

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Room Occupancy Drift Finding` | [`index.ts`](index.ts) `receiveEvents` -> [`repairRoomOccupancyDrift`](membership/repairRoomOccupancyDrift.ts) |

**Repair model (graph-forward):**

- Enumerate character nodes on the room **`ludicGraph`**; **must not** use **`Meta::Character.RoomId`** or **`Meta::Room.activeCharacters`** as authority.
- **Sessions gate:** no live sessions -> **`applyCharacterRoomMembership({ characterId, targetRoomId: null })`** (full graph purge; membership-changed bundle when `changed`).
- **In-play, adjacency lag:** graph correct but **`getMembershipContainers`** omits this room -> [`syncMembershipAdjacencyToRoom`](membership/syncMembershipAdjacency.ts) only (**must not** run the membership-changed bundle).
- **Idempotency:** at-least-once finding delivery **must** be safe (no-op when already repaired).
- **Explicit gap:** stale adjacency without a graph node is out of scope for this room-forward scan.

Sweep (read-only classification): [`../../../diagnostics/roomOccupancyDriftSweep/`](../../../diagnostics/roomOccupancyDriftSweep/).

### `mtw.diagnostics` --- `ludicGraph` structural staleness self-heal (LP4i)

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Ludic Graph Stale Structure Finding` | [`index.ts`](index.ts) `receiveEvents` -> [`healLudicGraphStructure`](ludicGraph/healLudicGraphStructure.ts) |

**Repair model, scoped tightly (`rootId` is recorded, never derived):**

- **Healable, and only these two:** a host-bound graph's `rootId` (canonically `hostId`) when missing or invalid, and the root's own node (canonically derivable from `rootId` alone, via `nodeFromId`) when absent from `nodes` --- concepts clause 3's requirement, the shipped guard's own check.
- **Not healable, and must not be attempted here:** `ports` or any other stored shape drift. A row stale for a reason outside this healable set is reported and left untouched, not force-fit. **Re-scoped 2026-08-23 (LP6a):** the `ports` line above was drawn against *repairing a port at all*, on the ground that a port has no interior witness so any repair must read the exterior --- which meant the reverse index, and therefore LD-17. **A port that disagrees with the referrer it itself names is not that case:** it names the one row to check, so the repair reads one named graph and no reverse index. That repair is real, and it is the **separate** heal below, still not this one --- this handler stays single-record. What remains permanently outside both is a port missing `fromHostId`, or one whose named referrer holds no matching edge: those ask *who **should** refer here*, which only the reverse index answers.
- **Idempotent:** at-least-once finding delivery **must** be safe --- a row already matching the shipped shape is a no-op read, no write issued.
- **Never called from a read boundary.** `fromFieldPayload`/`isEphemeraLudicGraphFieldPayload` stay strict; this repair is the one-time, write-carrying opposite of a `??=` default. It runs only from this finding consumer (always `dryRun: false`) or an explicit manual invocation (`dryRun` either way) --- growing a read-time fallback here is LPM's reset undone.

Sweep (read-only classification): [`../../../diagnostics/ludicGraphStaleStructureSweep/`](../../../diagnostics/ludicGraphStaleStructureSweep/).

### `mtw.diagnostics` --- `ludicGraph` port mismatch self-heal (LP6a, LD-18)

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Ludic Graph Port Mismatch Finding` | [`index.ts`](index.ts) `receiveEvents` -> [`healLudicGraphPortMismatch`](ludicGraph/healLudicGraphPortMismatch.ts) |

**Why a second heal rather than a wider first one:** shape staleness is judged from one row; a mismatch cannot be. This handler reads the interior row **and** the row of the host the port names, which is exactly what `healLudicGraphStructure` must never do.

**Repair model (the [port-record conflict rule](#port-records-field-scope-and-the-conflict-rule): compare where comparison is possible; where an exterior reference exists it governs):**

- **Healable:** a **crossing port** whose `kind` or `exteriorRelationLabel` disagrees with the edge(s) crossing into it in the **named** referrer's graph. The repair rewrites those two fields from the exterior edge and **must not** touch any other field, any other port, or the referrer. This heal path is **crossing-port-only, and the classifier tests for it explicitly** (PR-15, 2026-08-26): a presence port's `kind` is fixed at `'Present'` and has no exterior edge to mirror, so there is nothing here for it to disagree with. **Not an invariant that holds by itself.** Edge *incidence* cannot distinguish an edge that crosses a port from one that terminates at it, so without the test a port-to-port edge between two presence ports read as a mismatch at both ends and this heal rewrote both ports' `kind` from it --- destroying the binding rather than repairing it.
- **Not a mismatch at all, and no write:** the referrer holds no edge into this port, its graph is absent, or its graph fails the shape guard (that last is the *structure* finding, which orders the two heals rather than duplicating them).
- **Reported unhealable:** the matching exterior edges into a **crossing port** disagree with **each other**. A crossing port's single-use lifecycle means one crossing, so a split fan is broken exteriorly and picking one edge to believe would invent an answer --- a presence port's fan disagreeing is its normal state, not corruption, and is not this case.
- **Idempotent, and by recheck rather than by assumption:** the handler re-reads both rows and re-classifies before writing, so at-least-once redelivery of a finding whose mismatch is already repaired is a no-op read.
- **Never called from a read boundary,** for both of the reasons the structure heal already carries: a read-time default hides a stale row forever, and a read-time repair makes every read a write (LD-18's binding constraint).

Comparison (shared with the sweep, one definition): [`@tonylb/mtw-gateways/ts/ephemera/positions`](../../../../packages/mtw-gateways/ts/ephemera/positions/classifyLudicGraphPortMismatch.ts) `classifyLudicGraphPortMismatch`.
Sweep (read-only classification): [`../../../diagnostics/ludicGraphPortMismatchSweep/`](../../../diagnostics/ludicGraphPortMismatchSweep/).

---

## Port records: field scope and the conflict rule

A `ludicGraph` port ([`EphemeraLudicGraphPort`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)) is stored **interior-side only** --- on the graph of the whole that owns the port --- but it carries facts of **two scopes**, and which scope a field belongs to is what decides who wins a disagreement. Recorded here 2026-08-23, on the close of the ludicGraph-ports task plan; the two self-heal sections above are the shipped consequence and cite this rule rather than restating it.

**Shipped 2026-08-26 as a discriminated union on `kind` (the port vocabulary split):** `EphemeraCrossingPort` (`kind !== 'Present'`, optional `exteriorRelationLabel`) and `EphemeraPresencePort` (`kind: 'Present'`, no `exteriorRelationLabel` field at all --- carrying one is a compile-time-unrepresentable shape on this branch, not just a rejected runtime value). `EphemeraLudicGraphPort` is kept as the union alias, for call sites not yet narrowed on `kind`.

- **Interior scope --- the port's existence, its `portId`, its single-use lifecycle, and its `kind`.** The interior owns the binding, so these are authoritative without qualification: no exterior fact can overrule them. **For a crossing port** that authority is exercised **against** an exterior witness --- a disagreeing exterior edge triggers the heal above, which rewrites `kind` from that edge rather than defending the stored value. **For a presence port** there is no such witness to check against, so the same authority is simply never contested.
- **Exterior scope --- `fromHostId` and the exterior relation label (`exteriorRelationLabel`).** These are facts *about the exterior relationship*, held interior-side as **denormalized copies**. The authoritative instance is the referring edge in the named host's own graph.
- **The conflict rule, and it is conditional --- this is the whole of it: compare where comparison is possible; where an exterior reference exists it governs; where none exists the stored value stands.**
- **This is not a witness requirement.** An uncontested value needs no exterior instance to justify it. A port whose named referrer holds no matching edge is **not** thereby wrong, and **must not** be repaired toward absence.
- **One rule, not one per field --- for a crossing port.** The same shape governs `kind` --- checked wherever an exterior edge exists, vacuously true where none does --- so a crossing port's record has a single consistency rule. **A presence port has no exterior edge to check `kind` against at all**, so this row states what the rule looks like when it has something to compare, not a claim that spans both port kinds.

**Two things this rule replaced, stated because both were believed and both were too strong.** *The halves are complementary, not duplicated* is **false**: the port names its host and the referring edge names the port, so `fromHostId` is reconstructible from the exterior side and the two can contradict each other. And *the interior is authoritative* was an over-reading of the locked frame's clause about the interior **owning the binding** --- ownership of the binding is not authority over every field on it. The mental-model half of this correction is in [`AGENT.concepts.md`](AGENT.concepts.md#wholes-parts-and-ports).

---

## Read surface (forward graph vs reverse containers)

- Steady-state roster reads (**affordance compose**, perception fan-out, membership snapshots) **must** use **`getRoomCharacterList`** ([`../../internalCache/hydrateRoomRoster.ts`](../../internalCache/hydrateRoomRoster.ts)), not raw `ephemeraDB` `activeCharacters` and not any gateway roster API.
- **`getRoomCharacterList`** **must** derive on each call from **`internalCache.Positions.getLudicGraph(roomId)`** -> **`graph.characterIds`** -> **`hydrateRoomRosterFromCharacterIds`** (`CharacterMeta` + `CharacterSessions`); **must not** read stored **`activeCharacters`** from Dynamo on the steady path. Compose pipeline: [`../../internalCache/AGENT.md`](../../internalCache/AGENT.md#membership-presentation-and-roster).
- After membership apply when **`changed`**, the coordinator **must** seed **`Positions.set(postApplyGraph)`** from kernel **`postApplyGraphs`** (each graph is **`EphemeraLudicGraph`**); **`roomRosterSnapshots`** on the apply result **must** come from **`getRoomCharacterList`** after graph memo seed; **must not** use transact **`successCallback`** on **`activeCharacters`** for snapshot capture.
- **Roster display** **must** hydrate at read time from **`CharacterMeta`** (`Name` -> `DisplayName`, `Color`, `fileURL`) + **`CharacterSessions`** (`SessionIds`) via [`../../internalCache/hydrateRoomRoster.ts`](../../internalCache/hydrateRoomRoster.ts); membership topology from stored **`ludicGraph`** nodes only.
- **Character forward `getLudicGraph`** **must** read stored **`Meta::Character.ludicGraph`** topology only (D16); empty topology when absent. **Must not** use character forward read for room-membership / reverse reads.
- **Reverse membership reads** (navigate parse endpoint in [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts), membership pre-read in coordinators) **must** use **`internalCache.Positions.getMembershipContainers`** (adjacency index only), not raw `Meta::Character.RoomId` or `CharacterMeta.RoomId`.
- **Reverse object placement reads** **must** use **`internalCache.Positions.getMembershipContainers(objectId)`** (adjacency only); returns eligible host ids (`ROOM#`, `CHARACTER#` in v1). Empty adjacency means out of play (`[]`). **This stays narrow on purpose and is not stale:** the *forward* host union is all five kinds, but **contained-side eligibility is a separate undecided question** (D16 / I5) that the host-storage widening deliberately did not touch. Do not widen this line by analogy with forward storage. Room-only apply paths **must** filter to **`ROOM#`** hosts when computing room placement diffs.
- **Forward room graph** **must** read stored **`Meta::Room.ludicGraph`** topology only; when graph absent, return empty topology; **must not** merge stored **`activeCharacters`** on gateway forward load for roster display ([sole-authority stance](AGENT.concepts.md#room-play-graph--adjacency-reverse-index)). Forward graph **must** include **`Object`** nodes when present.
- **Forward character inventory graph** **must** read stored **`Meta::Character.ludicGraph`** topology only (D16); v1 nodes are **`Object`** membership only; empty topology when absent.
- **Affordance compose** **must** derive in-room object ids via **`graph.objectIds`** on **`Positions.getLudicGraph`** ([`../../internalCache/affordanceRoomDeliverable.ts`](../../internalCache/affordanceRoomDeliverable.ts)); **`shortName`** from improvisation merge, not room meta.
- **Reverse membership** **must** read adjacency rows only; empty adjacency means out of play (`[]`).
- **Authoritative writer** for play position state remains the membership persistence API; ephemera memo when `changed`: **`Positions.set(EphemeraLudicGraph)`** from **`postApplyGraphs`**; **`setMembershipContainers`** for the character or object. Gateway **`createPositionsCacheHandler`** remains **`PlayLudicGraph`** in/out (wrapper adapts on ephemera only). Gateway module scope: [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md).

### Must not reintroduce (D3 --- doc-only guard, no CI)

**Must not** reintroduce removed presentation-layer symbols on the positions gateway read envelope or ephemera roster compose path: **`characterRosterMeta`**, **`roomEndpoint`**, **`PlayPositionRoomRosterEntry`**, **`projectRoomGraphFromRosterEntries`**, **`projectRoomRosterFromGraph`**, **`PositionsCacheHandler.getRoomRoster`**, **`PositionsData.getRoomRoster`**. Roster presentation belongs in ephemera **`getRoomCharacterList`** only.

---

## Explicit non-ownership

- **Must not** implement `projectRoomExits`, `ensureAffordanceTopology`, or exit validation (owned by topology + [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts)).
- **Must not** mutate legacy `Meta::Room.objects` (field removed from room meta Phase 6; objects lane writes improvisation pair + **`Meta::Object`** + graph only --- see [`../objects/`](../objects/)).
- **Must not** write play membership fields outside [`membership/`](membership/).
- **Must not** publish **`CheckLocation`** (retired).

### Disconnect ingress

- **Must** consume disconnect only via **`mtw.connections.characters`** / **`Character Disconnected`** (not legacy `Disconnect Character` EventBridge or ephemera `disconnectMessage`).
- **`unregistercharacter`** WebSocket ingress is **connections-owned** (`service: connections`); ephemera does not handle it.

---

## Consumer expectations

Downstream code **may** assume that after a **successful** membership apply with `changed: true`, `Positions` memo and affordance invalidation reflect the updated roster for all affected rooms in **`froms`** and **`to`**. After a **successful** object membership apply with `changed: true`, downstream **may** assume affordance memo reflects updated **`StandardRoom.objects`** for affected rooms. After a **successful** relational apply with `changed: true`, downstream **may** assume **`Positions`** memo for **`hostId`** reflects updated **`ludicGraph`** topology including stored relational edges (gateway read projection passes through relational edges per [`packages/mtw-gateways/ts/ephemera/positions/project.ts`](../../../../packages/mtw-gateways/ts/ephemera/positions/project.ts)); affordance deliverable invalidation only applies when **`hostId`** is a Room. Downstream **must** remain idempotent under at-least-once ingress (see [`packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md`](../../../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md) consumer guidance).
