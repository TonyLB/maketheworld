# Positions --- contracts

This file records **falsifiable rules** for `mtw.ephemera.positions` **as implemented today**. Mental models: [`AGENT.concepts.md`](AGENT.concepts.md). Code map: [`AGENT.implementation.md`](AGENT.implementation.md).

Play membership persistence uses **`Meta::<Kind>.ludicGraph`** (forward; Room / Character / Object / Feature / Area --- see [Host storage](#host-storage-one-shared-serde-one-documented-exception)) + **adjacency index** (reverse) as sole authority --- see [Room play graph + adjacency reverse index](AGENT.concepts.md#room-play-graph--adjacency-reverse-index). **`Character Moved`** and **`Object Moved`** are **membership host transfer** projections on the bus --- `froms[]` / `to` describe eligible host endpoints, not per-host kernel granularity, and the fact bus shape uses plural **`froms[]`**.

---

## DataSource identity

- **`dataSourceKey`** must be `mtw.ephemera.positions`.
- **`replayable`** is `false` for v1.
- **`publisherStrategy`** is `busOnly` (outbound **`Character Moved`**, **`Object Moved`** and **`Object Relation Changed`** on internal bus).
- Subscription guards live in [`subscribedEvents.ts`](subscribedEvents.ts); new ingress types must register a header guard there (not a separate DataSource module).

---

## Scope of authority (manipulation vs presentation)

Mental model: [**Graph roles**](AGENT.concepts.md#graph-roles-shared-shape-different-authority). This section states normative boundaries only.

**Positions must own (play manipulation truth):**

- Membership persist (`Meta::<Kind>.ludicGraph` on any membership host kind, adjacency index) per membership sections below, and the eviction ladder (`RoomStack`), written after a successful apply and outside its bundle (see [Eviction ladder](#eviction-ladder-roomstack-storage)).
- **`Object`** nodes on room **`ludicGraph`** + **`OBJECT#`** adjacency rows; objects lane owns existence rows (improvisation pair + **`Meta::Object`**) only.
- **`Meta::Character.ludicGraph`** for character-hosted inventory; cross-host membership apply under [`manipulation/membership/`](manipulation/membership/).
- **`Character Moved`** and **`Object Moved`** descriptive fact streams --- **membership host transfer projection** from persist outcome at apply.
- Gateway topology read backing for stored membership graph and adjacency (see [Read surface](#read-surface-forward-graph-vs-reverse-containers)).

**Positions must not own (presentation truth):**

- Roster **display** fields (`DisplayName`, `SessionIds`, `Color`, `fileURL`) as steady-state authority --- hydrate at read time per [Read surface](#read-surface-forward-graph-vs-reverse-containers).
- Affordance wire compose (`AffordanceRoomDeliverable`) or exit topology (`projectRoomExits`, `ComponentTopology`, `AffordanceCache`).

**Gateway read envelope:**

- **`PlayLudicGraph`** **must** be topology only (alias of `StandardLudicGraphData`); **must not** carry roster display fields or reverse-membership encodings on the forward graph.
- Forward **`getLudicGraph`** **must** return stored topology only on Dynamo load; **`Positions.set`** **must** accept topology-only graphs.

**Deferred (edge-reference cleanup):** object removal prunes play-only (Exit) edges on hosts participating in the removal transaction only (Relational edges are assert-and-throw, not pruned --- caller must dissolve them explicitly first). Cross-host or edge-only references without a node-removal path are not swept by membership adjacency today. See [`ludicGraph/AGENT.md`](ludicGraph/AGENT.md) **Known limitation (deferred)** and [`../objects/AGENT.md`](../objects/AGENT.md) **Deferred (cross-host edge references)**.

**Deferred (character-relation widening):** `HostRelationalEdge` endpoints are typed `EphemeraLudicTerminalPrimitive`, but no write path authors a relation with a character end, and [`commitAttempt`](manipulation/commitAttempt.ts) refuses a relational action whose subject or target is not an Object --- so `removeCharacter`'s assert-and-throw is vacuously satisfied today. Widening waits for a KR-write path that authors character relations, which does not exist yet. See [`ludicGraph/AGENT.md`](ludicGraph/AGENT.md) **Character-relation widening**.

---

## Manipulation persist layering

Mental model: [**Manipulation layering**](AGENT.concepts.md#manipulation-layering-membership-transfer). Code map: [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md). Gateway conflict policy: [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md).

**Architectural:**

- Every graph-grounded persist **must** converge on one kernel entrypoint, **`commitStepSequence`**. Planning happens strictly upstream --- in the shared membership adapter, or in the Synthesize executor re-run at execute time; the kernel only transacts.
- Kernel **must** accept explicit **`KernelStep[]`** only; **must not** call **`getMembershipContainers`** to discover priors.
- **Must not** add parallel persist paths (new `update*LudicGraphs` with bundled planner + transact; per-verb diff computers outside `executeMembershipTransfer` ([`manipulation/membership/executeMembershipTransfer.ts`](manipulation/membership/executeMembershipTransfer.ts))).
- **Shipped kernel:** one general **`commitStepSequence`** (**`KernelStep[]`**) covers membership-node add/remove (`transferMembership`, entity-kind-general) and in-host relational edge add/remove (`establishRelation`/`dissolveRelation`) --- see [`manipulation/kernel/`](manipulation/kernel/).
- Positions kernel in-memory graph simulation **must** use **`EphemeraLudicGraph`** / **`EphemeraLudicGraph[]`** --- **must not** reintroduce bare **`EphemeraLudicGraphFieldPayload`** simulation or ad-hoc merge helpers outside [`ludicGraph/`](ludicGraph/). Mental model: [`AGENT.concepts.md`](AGENT.concepts.md#type-boundary-storage-vs-gateway-read-envelope); module spec: [`ludicGraph/AGENT.md`](ludicGraph/AGENT.md).
- Actions **may** import **`EphemeraLudicGraph`** read-only for observation/legality; actions **must not** persist graphs or build transact items.

**Today (shipped behavior):**

- On graph vs adjacency conflict, **`ludicGraph` wins** (diagnostics repair from graph).
- Transfer-planning pre-reads (**`getMembershipContainers`**) **must** run on coordinator / adapter side, **not** in kernel persist.

**Apply mode (`executeMembershipTransfer`):**

Diffs against its own fetched `priorContainers` end-state style only --- `froms` = every prior host `!== target` (any host kind). **Object-lifecycle administrative routes only** (object room place / remove, spawn, drift repair, and destroy/edit clear) --- **navigate, connect, disconnect, and home do not route through this function**: the character route's own diff, op-build, and compile happen upstream in [`planCharacterMoveTransfer`](manipulation/membership/planCharacterMoveTransfer.ts), and [`orchestrateCharacterRoomMembership`](manipulation/membership/orchestrateCharacterRoomMembership.ts) calls `commitStepSequence` directly. Compiles its bare `{ kind: 'move', ... }` op through the same shared `compilePositionKernelOp` every other route uses rather than hand-assembling a `transferMembership` step literal.

Retiring the standalone `planMembershipTransfer` adapter did not carry forward a **bounded** mode (remove only from trusted-ingress hosts, without end-state-scrubbing the rest) --- it had no caller among the migrated routes. A future caller needing bounded semantics must add them back explicitly.

**`takeHold`** and **`drop`** do not reach `executeMembershipTransfer` at all. They go through [`commitAttempt`](manipulation/commitAttempt.ts) and [`planObjectMoveTransfer`](manipulation/membership/planObjectMoveTransfer.ts) instead: the op is built via `buildObjectMoveOp` (whose `dissolvedEdges` is only the mover's own containment strip), and every boundary edge's dissolve is the command attempt's own facilitating action, committed in the same sequence ahead of the transfer. `commitAttempt` dry-runs the whole sequence ([`dryRunStepSequence`](manipulation/kernel/dryRunStepSequence.ts)) and refuses any non-`legal` verdict with its reason code: a player move repairs nothing, so a boundary edge no action covers is refused, not dissolved. Administrative repositions still call `executeMembershipTransfer`, whose own dissolve mechanism is [`repairAdministrativeChainDissolve`](manipulation/membership/repairAdministrativeChainDissolve.ts) --- "may sever anything," unconditional, no dry run, since those routes have no legality question to ask. See [`Ludic Network Change Requested`](#ludic-network-change-requested-positions-owned).

Module paths: [`manipulation/membership/planObjectMoveTransfer.ts`](manipulation/membership/planObjectMoveTransfer.ts) (take/drop/give's plan stage), [`manipulation/membership/executeMembershipTransfer.ts`](manipulation/membership/executeMembershipTransfer.ts) (the administrative path), [`manipulation/kernel/`](manipulation/kernel/) (kernel --- `commitStepSequence.ts`, `applyStepSequenceCore.ts`, `kernelStep.ts`). Kernel invariants: [`manipulation/AGENT.implementation.md` --- Kernel invariants](manipulation/AGENT.implementation.md#kernel-invariants).

---

## Manipulation tier discipline

`build*Op` and `compile*` are pure. `plan*` reads and evaluates, never writes. `commit*` writes. `present*` publishes post-commit. **No function does the core work of more than one tier.** Spanning tiers is permitted only by **composition** --- calling one tier, then another, adding no decision of its own --- and only in two shapes: an `orchestrate*` function (one per route family, which may also do that route's own glue: resolve its target, gather its narration ingredients), or a **generic composer** that takes its input as data and encodes no domain decision (e.g. [`commitAndPresentStepSequence`](manipulation/kernel/commitAndPresentStepSequence.ts), whose entire body is commit-then-present with no decision of its own).

**The test:** remove a candidate function's calls to other tiers --- is there any decision left in its body? If no, it is a composer. If yes, that decision belongs to exactly one tier, and the rest of the body belongs somewhere else.

**Named, temporary exception: [`executeMembershipTransfer`](manipulation/membership/executeMembershipTransfer.ts).** For the object-lifecycle administrative routes (spawn / place / remove / destroy / edit / drift-repair), this one function still fuses `plan*`-tier work (the containers diff, the [`repairAdministrativeChainDissolve`](manipulation/membership/repairAdministrativeChainDissolve.ts) repair policy) with the `commit*`-tier `commitStepSequence` call --- real work at two tiers in one function, not composition of already-tiered calls. This is deliberate and tracked, not an oversight: splitting it today would mean building a throwaway `plan*`/`commit*` split ahead of a general plan-propose/evaluate loop these administrative routes are exactly shaped for (no legality question to ask, "may sever anything," an unconditional repair) --- the real split falls out of building that loop rather than needing its own design now. Resolving this fusion is part of whatever future work builds that loop; it is not a permanent carve-out.

---

## Narration and presentation

Mental model: [**Positional vs. terminal binding**](AGENT.concepts.md#positional-vs-terminal-binding) and [**Abstract op and compiled step**](AGENT.concepts.md#abstract-op-and-compiled-step-two-levels). Code map: [`manipulation/AGENT.implementation.md` --- Presentation kernel](manipulation/AGENT.implementation.md#presentation-kernel).

Narration a position change produces reaches the player by one of two paths, never hand-built at a call site. Character leave/arrive (navigate, home, connect, disconnect, ghost-purge) is **compiled** into narrate steps. A command attempt's lines (object take/drop/give, containment, relational dissolves) are its **narration units**, delivered by `commitAttempt`'s post-commit sweep ([An attempt narrates through its narration units](#an-attempt-narrates-through-its-narration-units)). The binding-time and capture rules below hold for both. Per-route bundles are in the route sections below.

### Binding time: world state early, transport state late

**Early-bind a target iff resolving it reads *world* state; late-bind iff it reads *transport* state.**

- **`ROOM#`** resolves against the room's `ludicGraph` --- world state. It **must** be bound at beat time, inside the kernel walk, to a concrete `EphemeraCharacterId[]`.
- **`CHARACTER#`** and **`SESSION#`** resolve against connected sessions --- transport state. They **must** stay late-bound, resolved at flush by [`publishMessage/index.ts`](../../publishMessage/index.ts).

[`getRoomCharacterList`](../../internalCache/hydrateRoomRoster.ts) is the existence proof the two are separable: it already performs one of each, in that order (`Positions.getLudicGraph(roomId).characterIds`, then `CharacterMeta` + `CharacterSessions` hydration). Early binding hoists the first half to beat time and leaves the second where it is.

**Consequence, and the rule that actually bites: a narrate step carries no room target at all.** `captureId` is its sole audience input.

- A `PresentationKernelNarrateStep` **must not** carry a bare `ROOM#` in `targets`, and **must not** union one with a captured audience. A `ROOM#` re-expands against the **live** roster at flush, so pairing the two lets the terminally-bound reading win wherever they disagree --- which is the same defect class as the retired `[room, characterId]` tack-on, entering from the other end.
- An unresolvable `captureId` **must throw**. It **must not** degrade to a room target or to an empty audience. Capture ids are minted only by [`compilePositionKernelOp`](manipulation/kernel/compile/compilePositionKernelOp.ts) and by [`commitAttempt`](manipulation/commitAttempt.ts)'s audience resolution, each beside the capture step it emits, so a miss means the plan is internally inconsistent, and either quiet recovery hides that behind a silently-wrong or silently-absent delivery.

**Beat-time and flush-time capture differ only under concurrent third-party membership change**, and beat time is the correct answer there: the audience for "Tess left" is who was standing in the room at that beat, not who wandered in while an LLM was still generating a header.

### Capture steps are read-only by shape

A **`MutationKernelCaptureStep`** carries **`hostId`** + **`captureId`** and **no write payload**. That shape requirement is what makes a read-only step safe inside the mutation walk --- enforce it by shape, **not** by excluding capture from the walk.

- A capture step **must not** contribute to the `transactWrite` write set. It contributes to the **read/lock** set only.
- A capture **must** be an entry in the `KernelStep[]` array, **not** a side-table threaded past the walk. [`computeStepSequenceFootprint`](manipulation/kernel/computeStepSequenceFootprint.ts) is the transaction's lock-set declaration and is computed **once, up front**: `MultiKeyUpdate` cannot be re-entered mid-reducer to lock a newly-discovered host. As an array step the footprint picks up `hostId` automatically and it is structurally impossible to forget. As a side-table, every caller would have to remember to union capture hosts into the footprint --- and it would fail *late and selectively*, since navigate happens to work (its move already locks both rooms) while the first break would be a capture against an otherwise-unmutated host.
- **Any value read out of the `MultiKeyUpdate` reducer after it returns must be severed from the Immer draft, per element.** `applyStepSequenceCore` runs inside that reducer under `exponentialBackoffWrapper`, behind Immer's `produce()`, which revokes every draft-backed object once the reducer returns; a value that still aliases a draft element throws on the next read. Spreading the *container* (`[...array]`) is not enough --- each element must be copied too (`{...node}`), not just the array holding them.
- Captured values **must** be plain `EphemeraCharacterId[]`, and the reducer **must** record them by **assignment, never append**. Ids being primitive strings makes the per-element copy free here by construction rather than by discipline, but **assignment, never append** is an independent rule: the reducer body can run several times, and an accumulating `push` duplicates narration across retry attempts.
- Capture **must not** validate. `hydrateRoomRosterFromCharacterIds` drops characters whose `CharacterMeta` is missing; that is a validity concern, neither world nor transport, and it stays at flush.

**Captures are compiled only when the op narrates.** A non-narrating move (object spawn/destroy/place/remove, and the navigate pre-commit mutation-only compile) produces no capture steps and therefore locks no extra hosts. Do not "fix" a missing capture by defaulting `captures` to an empty map at a call site.

### Positions derives no narration copy

An attempt's lines come only from the narration units its actions' creators authored (Plan's templates, Expansion; the authorship rules are [`../actions/AGENT.contract.md`](../actions/AGENT.contract.md#command-attempt)'s). Positions fills labels and delivers; it **must not** synthesize a line for an action, and **must not** derive a verb from a move's delta or infer one backwards from a published fact. An action no narration unit covers narrates nothing. The delta cannot carry the act: `coins: Table -> Pouch` has a room on neither side, a relation's state maps to many acts (tie / lash / knot), and manner has no source in it at all.

### A move transfers one entity

A move, and every `transferMembership` step it compiles to, names exactly one entity (`moved` on the op, `objectId` on the executor's step, `entityId` on the kernel's), for objects and characters alike. Anything the entity hosts lives in its own shard and travels with it.

- No step **may** widen a move to further entities, and narration **must not** count carried objects. Carrying is what hosting does, not something a move computes.
- A boundary edge is a relational edge with the mover at one end and something staying behind at the other. Because only one entity moves, no relational edge has both ends moving: there is no interior edge for a move to carry.

### A move's severed edges

The command attempt's Expansion classifies the mover's boundary edges ([`boundaryEdgeOutcomes`](ludicGraph/expandValidate/interactionUnderTransfer.ts)) into facilitating dissolve actions listed ahead of the move, and `commitAttempt` commits them in that order, ahead of the transfer. `op.dissolvedEdges` carries only the mover's own containment edge, which the compiler renders into a `dissolveRelation` step ahead of the transfer. A boundary edge still present when the transfer applies refuses the move ([`applyTransfer`](ludicGraph/expandValidate/applyTransfer.ts) returns `repairable`); it is never silently severed. **Expansion classifies; the attempt and the compiler sequence.**

### Narration is presented only for a committed mutation

The presentation kernel's narrate branch and the attempt's narration sweep **must** run on [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts)'s **`ok: true`** result and never otherwise. A failed, refused or illegal commit narrates nothing.

This is enforced at the type level --- `captures` exists only on the success branch, and both `presentStepSequence` and `deliverNarrationUnits` throw on an unresolvable `captureId` --- but that guard reads as incidental shape unless stated, and "surface a failed move to the player somehow" is a live product question whose eventual answer must not be allowed to erode it.

**Not a contract clause:** *when* the messageOrchestration bundle is declared relative to the commit. Declaring after a successful commit is a consistency preference across the orchestrators, not a correctness requirement --- the fan-in is explicitly tolerant of unresolved slots (see [`../messageOrchestration/AGENT.md`](../messageOrchestration/AGENT.md), "Publish behavior"). Do not write it up as normative.

### Call sites emit ops; only the compiler names steps

No call site outside [`manipulation/kernel/compile/`](manipulation/kernel/compile/) may construct a `{ kind: 'narrate', ... }` step literal, and none outside it may construct a `{ kind: 'capture', ... }` step literal **except** [`commitAttempt`](manipulation/commitAttempt.ts)'s audience resolution, which turns an attempt's declared audiences into captures (next section). The intent of both halves is the same: no ad-hoc audience construction. Call sites supply an op and its narration **ingredients** (`characterName`, copy-kind selectors, `exitName`); the compiler decides shape, ordering, capture ids, and slots, and [`presentStepSequence`](manipulation/kernel/presentStepSequence.ts) assembles the message string at flush.

Builders: [`manipulation/membership/buildCharacterMoveOp.ts`](manipulation/membership/buildCharacterMoveOp.ts) (character routes) and [`manipulation/membership/buildObjectMoveOp.ts`](manipulation/membership/buildObjectMoveOp.ts) (object routes) --- **siblings, not one widened module**. They share no copy-selection logic, and `NarrationSpecification` is a union on narration *family* for the same reason.

### An attempt narrates through its narration units

A command attempt carries its own lines as narration units (vocabulary: [`../actions/AGENT.concepts.md` --- `CommandAttempt`](../actions/AGENT.concepts.md#commandattempt)). Positions compiles no narrate step and declares no compiled slot for an attempt; [`commitAttempt`](manipulation/commitAttempt.ts) resolves each unit's audiences before the commit and [`deliverNarrationUnits`](manipulation/deliverNarrationUnits.ts) delivers them after it. Navigate's compiled narrate steps and bundle are unaffected: their header slot genuinely resolves in another component, which an attempt's lines never do.

- **Delivered only on `ok: true`**, per the clause above. A refused attempt delivers no unit at all.
- **Delivery order is unit order, walked in the attempt's own action order.** Each unit's lines are bundle slots in that order. So a facilitating dissolve's line is delivered before the move's, since Expansion lists the dissolve first; each severed relation narrates its own line ("George takes the glass off the tray." / "George picks up the tray.").
- **An audience is declared by referent, `(refs, phase)`, and resolved to rooms by `commitAttempt` before the dry run.** A ref resolves through the referent's stamped `groundedPresence`, walked up presence bindings to every room it reaches; `'actor'` resolves from the actor's live host; a moved entity's *after* resolves from the move's destination. One `capture` step per resolved room is spliced ahead of the unit's first covered action (*before*) or behind its last (*after*), inside the sequence that is dry-run and committed, so captures are in the footprint.
- **Capture ids are minted unique**, never a fixed string: two moves in one attempt must not share a capture. An audience's roster is the **deduplicated union** of its captures' rosters. An unresolvable capture id **must throw**, with no live-roster fallback.
- **Overlapping audiences each deliver.** A character reached by two of a unit's audiences gets each line; an author who wants one line to the union declares one audience over several refs.
- **A referent's audience is every room it is seen in**, including a non-present whole bound into several rooms. Perspective narrowed *which* thing a phrase meant, not who can see it change.
- **No per-unit validity check runs.** All-or-nothing commit, plus refusing an action whose result already holds, means every covered action happened.
- **A narration unit never spans attempts.**

**Known gap (accepted):** audience resolution reads ancestor graphs outside the commit footprint, so a container moved between resolution and commit gives a stale audience. Same class as the "no world-legality re-check under lock" entry in [Current limitations](#current-limitations); locking the ancestor chain was judged not worth it.

---

## Membership persistence API

All character **room-membership** mutations for **disconnect**, **navigate**, and **connect** **must** go through [`orchestrateCharacterRoomMembership`](manipulation/membership/orchestrateCharacterRoomMembership.ts).

**A character's membership host is a `ROOM`, and only a `ROOM`.** Objects are unrestricted and may be hosted by rooms, characters, objects, features and areas as the host union already allows; characters **must not** be transferred into any non-Room host's `ludicGraph`. **This is a scoping decision, not a claim that characters are ontologically unlike objects, and must not be cited as one** --- it exists to keep the character path single-hosted while the general graph work matures, and it lifts when that work does.

**The restriction has two halves, and only one of them is enforced.** Its **cardinality** consequence --- a character carries exactly one presence binding, since a room is never a graph member and so never binds it anywhere else --- **is** enforced, by an end-of-sequence validator in [`applyStepSequenceCore`](manipulation/kernel/applyStepSequenceCore.ts) that throws when a character's graph would carry more than one presence node. That check is a **ratchet on new writes, not a repair**: a character already carrying a duplicate binding before the sequence ran is untouched. It is deliberately character-only --- objects are multi-present by design.

**The *host-kind* half is unenforced, and that failure is silent.** An Object is a legal `EphemeraMembershipHostId` and [`MutationKernelTransferStep`](manipulation/kernel/kernelStep.ts) already admits a character as a transferable entity, so an object-hosted character would persist successfully, then read as having zero **Room** containers, fall through to the `RoomStack`, and present as **out of play**. **Note that the cardinality validator does not catch this** --- an object-hosted character carrying exactly one presence binding satisfies it. What holds the host-kind restriction today is independent read-side narrowings ([`resolveCharacterRoomId`](manipulation/membership/resolveCharacterRoomId.ts) and [`syncMembershipAdjacency`](manipulation/membership/syncMembershipAdjacency.ts) filtering containers with `isEphemeraRoomId`, plus the Room-only apply filters under [Read surface](#read-surface-forward-graph-vs-reverse-containers)) --- none of which refuse the write. Treat this bullet as the statement of intent that those filters implement; **do not** infer from the absence of a guard that the restriction is optional.

### Public apply shape

- **Args:** `{ characterId, targetRoomId: EphemeraRoomId | null }` decide the persist --- `null` = out of play (disconnect). The remaining fields of `MembershipApplyArgs` ([`manipulation/membership/types.ts`](manipulation/membership/types.ts)) are narration ingredients and correlation only (`bundleId`, `intentKind`, `intentFromRoomId`, `exitName`, `resolveHeaderSlot`): they select copy and never change the end state. **Must not** consume stream / intent `fromRoomId` for persist --- `intentFromRoomId` picks exit-aware copy among `froms`, nothing more.
- **Result:** `{ froms, to, changed }` where `changed` is true iff prior container set differs from end state (`{ targetRoomId }` or `{}` when out of play). **`froms`** is required (same semantics as **`MembershipDiff<EphemeraRoomId>`** / bus fact --- every other `MembershipDiff` reference in this section means this Room-typed instantiation; `manipulation/membership/types.ts` also has a bare, host-general `MembershipDiff` used by the kernel-step fact-emission tier, which this route does not touch).
- **Navigate presentation:** [`presentCharacterMove`](navigate/presentCharacterMove.ts) receives full **`froms[]`** from the apply result for presentation (arrival-room header slot, render kicks). Does **not** publish **`MapUpdate`** (server map runtime retired; see [`../maps/AGENT.md`](../maps/AGENT.md)).
- **Leave/arrive world lines --- every character route:** navigate, home, connect, disconnect, and the ghost-purge sweep all narrate through the compiler. **[`planCharacterMoveTransfer`](manipulation/membership/planCharacterMoveTransfer.ts) builds the op via [`buildCharacterMoveOp`](manipulation/membership/buildCharacterMoveOp.ts) and compiles it via [`compilePositionKernelOp`](manipulation/kernel/compile/compilePositionKernelOp.ts) exactly once, before commit**. The header slot resolves pre-commit too, since it depends only on `to` and the character's assets, both known before commit. The resulting `CompiledPositionKernelPlan` flows through the commit result to [`presentStepSequence`](manipulation/kernel/presentStepSequence.ts), which reports the narration steps unchanged --- the audience is the mid-walk **captured** roster, and therefore already includes the mover by construction on the leave side. Rules: [Narration and presentation](#narration-and-presentation). There is **no** async membership fan-in; `Character Moved` still streams as a fact, but perception does not subscribe to it.
- **One orchestrate-tier entry point, one present-tier function, both gated on `to`:** navigate/home/connect/disconnect (and `repairRoomOccupancyDrift`'s ghost purge, and `repairCharacterLegalPlacement`'s relocation call) all go through [`orchestrateCharacterMove`](navigate/orchestrateCharacterMove.ts), which calls the membership coordinator and then presents through [`presentCharacterMove`](navigate/presentCharacterMove.ts). `presentCharacterMove` declares the bundle and presents leave/arrive narration for every caller; only when `to !== null` does it also resolve the arrival header slot (`registerIngressSlot`) or fall back to an imperative `Perception` publish. Disconnect and ghost-purge pass `to: null`, which is `planCharacterMoveTransfer`'s own guarantee that no header slot was ever compiled for them --- so that branch is simply never reached, not separately guarded against. `presentCharacterMove` is named `present*`, not `orchestrate*`, under the [tier discipline above](#manipulation-tier-discipline): it calls no other tier, so it does the core work of exactly one; `orchestrateCharacterMove` is the licensed composer above it, additionally running the eviction-ladder write in parallel with presentation when `to !== null` (see that function's own doc comment for why this can't route through the kernel's generic `commitAndPresentStepSequence` composer).
- **Graph persist path:** coordinator ([`orchestrateCharacterRoomMembership`](manipulation/membership/orchestrateCharacterRoomMembership.ts)) -> [`planCharacterMoveTransfer`](manipulation/membership/planCharacterMoveTransfer.ts) (diff against its own `priorContainers`, builds `buildCharacterMoveOp` and compiles it once, before commit) -> [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts) (`MultiKeyUpdate`), committing the compiled plan's mutation-kind steps --- a `transferMembership` step, plus capture steps bracketing it. **No longer routes through `executeMembershipTransfer`**, which now serves only the object-lifecycle administrative routes (spawn/place/destroy/edit/drift-repair); `MembershipApplyArgs.compileMutationSteps` is retired along with it. No `dissolveRelation` steps accompany the character path: a character can never be a relational-edge endpoint, `HostRelationalEdge` being object-only --- `commitStepSequence`'s `getCurrentHost` dep (which only resolves a `dissolveRelation` step's referenced hosts) is therefore a function that is never actually called for this route. `Character Moved` fact emission is folded into `commitStepSequence` / [`factsForStep`](manipulation/kernel/factsForStep.ts) rather than layered on top by the coordinator. Detail: [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md).

### Graph apply (end-state)

- **Must** use pure end-state apply on **`targetRoomId`** only.
- **Must** derive **`MembershipDiff.froms`** from observed prior containers removed (may be **`length > 1`** on drift repair).
- **Must** maintain **`ludicGraph`** + adjacency in the same **`transactWrite`** bundle; **must not** write legacy **`activeCharacters`** / **`RoomId`** membership projections. Mental model: [Room play graph + adjacency reverse index](AGENT.concepts.md#room-play-graph--adjacency-reverse-index).
- On conflict between graph and adjacency, **`ludicGraph` wins** (diagnostics repair from graph).
- **Adjacency row existence is an existential invariant, not a lifecycle event:** a row `(EphemeraId: X, DataCategory: POSITION#<hostId>)` exists **iff** X is a node in `<hostId>`'s `ludicGraph`. It is not a refcount over edges --- edges of every kind (hosting, peer) are orthogonal to this index, which is why the kernel **must not** write adjacency rows for relational edges (see [Edge persist shape](#edge-persist-shape) below). **Forward note:** when hosting-as-shard lands, dissolving a hosting edge (`On`/`In`/`PartOf`) becomes a membership change and **must** be routed as a `transferMembership` step, so adjacency keeps following node presence --- not by teaching adjacency to inspect edges.

#### Host storage: one shared serde, one documented exception

- Every membership host kind **must** persist its forward graph as **`Meta::<Kind>.ludicGraph`** --- `Meta::Room`, `Meta::Character`, `Meta::Object`, `Meta::Feature`, `Meta::Area` --- carrying the identical **`EphemeraLudicGraphFieldPayload`** shape and decoded through the identical **`fromFieldPayload`**. There is **no** per-kind stored shape.
- Decode **must** go through **one shared plain-serde body**: a direct `ludicGraph` field read whose absent-value default is a trivial empty graph. Per-kind factory helpers are **thin wrappers** over that body and **must not** add per-kind decode behavior.
- **`Room` alone** carries an absent-value fallback: when `ludicGraph` is missing, it reconstructs from **`Meta::Room.activeCharacters`** via `seedFromActiveCharacters` rather than defaulting to empty. **This asymmetry is deliberate.** Room is the only host kind with a second data source its graph can be reconstructed from; the others have no connect/disconnect lifecycle and therefore no reconstruction source. **Must not** be "regularized" away, and **must not** be generalized to another kind without first establishing that kind has its own independent second source.
- Adding a new host kind therefore costs a `Meta::<Kind>` record, a thin wrapper, and a dispatch branch --- **not** a new serde.

### Membership-changed bundle

When **`MembershipDiff.changed`** is true, persist and its follow-on effects **must** happen together or not at all. **The kernel ([`commitStepSequence`](manipulation/kernel/commitStepSequence.ts)) owns most of the bundle**, in this order --- coordinators **must not** re-implement any of it:

1. Cache memo for **every** committed graph --- `Positions.set` unconditionally, plus `ComponentEphemeraMeta.invalidate` / `AffordanceRoomDeliverable.invalidate` for Room hosts. **Must** run *before* any fact streams, to avoid an affordance-refresh race.
2. `setMembershipContainers` for the moved entity.
3. **`Character Moved`** on `mtw.ephemera.positions` (membership host transfer projection), streamed from [`factsForStep`](manipulation/kernel/factsForStep.ts) in step order.
4. `RoomUpdate` per Room host in the sequence's footprint, published *after* the fact stream.
5. `beatAnchorTime` recorded at commit and returned on the kernel result.

The character coordinator ([`orchestrateCharacterRoomMembership`](manipulation/membership/orchestrateCharacterRoomMembership.ts)) adds only what is character-specific, after a successful commit:

6. `roomRosterSnapshots` on the apply result, built from **`getRoomCharacterList`** after the kernel's graph memo seed.
7. `CharacterMeta.invalidate(characterId)`.
8. `EphemeraUpdate` `CharacterInPlay` room projection.

When **`changed`** is false: the coordinator **must** return before calling the kernel at all --- no persist, no fact stream, no cache, no `RoomUpdate`, no `EphemeraUpdate`. This includes eviction-ladder-only updates where the room membership endpoint is unchanged.

**Post-move presentation split:** step 4 **`RoomUpdate`** (affordance refresh for all occupants in **`froms`** / **`to`**) is **separate** from the mover-only arrival header render (an ingress slot registered with **`mtw.ephemera.messageOrchestration`** in navigate orchestration --- see [`../messageOrchestration/AGENT.md`](../messageOrchestration/AGENT.md)). Positions **must not** conflate affordance refresh with header render on the membership API. **`Object Moved`** affordance refresh consumer: **`mtw.ephemera.affordanceOrchestration`** ([`../affordanceOrchestration/index.ts`](../affordanceOrchestration/index.ts)).

### Eviction ladder (`RoomStack` storage)

Mental model: [**Eviction ladder**](AGENT.concepts.md#eviction-ladder). Code map: [`AGENT.implementation.md` --- Eviction ladder](AGENT.implementation.md#eviction-ladder-roomstack-storage).

- **Must not** expose eviction ladder edits on **`MembershipApplyArgs`** --- its persist-deciding fields remain `{ characterId, targetRoomId | null }` (see [Public apply shape](#public-apply-shape)). Ladder shape is internal to persist / resolution helpers.
- **Pending move:** ladder ownership is planned to move to a new `mtw.ephemera.characters` dataSource, written from a `Character Moved` subscription --- [`AGENT.charactersDataSource.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.charactersDataSource.planning.md). The rules below describe today's positions-side write.
- **Legal placement resolution:** trim `RoomStack` to accessible assets; surviving top frame is the proposed `targetRoomId`. **Connect** --- place from nowhere (`froms: []`). **Asset visibility loss** --- relocate when the character's **current room's own asset** is no longer accessible (CH-1); the trimmed ladder's top frame is used only to choose the destination, never to decide whether to relocate --- the ladder is maintained by an async subscriber ([`mtw.ephemera.characters`](../characters/AGENT.md)) and can legitimately lag current membership by a beat.
- **Navigate ladder timing:** after successful graph persist when **`MembershipDiff.to !== null`** (navigate, home and connect alike), callers **must** run ladder maintenance in the parallel tail ([`persistRoomStackNavigate`](../characters/roomStack/persistRoomStackNavigate.ts) + [`presentCharacterMove`](navigate/presentCharacterMove.ts), both invoked from [`orchestrateCharacterMove`](navigate/orchestrateCharacterMove.ts)'s `Promise.all`). **Must not** gate the membership-changed bundle on ladder completion.
- **Navigate merge:** ladder persist **must** use per-frame `timeWritten` (epoch ms) stamped from **`beatAnchorTime`** at graph persist. A write at time `T` **must not** overwrite or truncate frames with `timeWritten > T`, and **must not** extend outer frames unless `T` exceeds all existing frame timestamps. Missing `timeWritten` **must** be treated as `0` (legacy rows).
- **Trim persist:** asset/connect trim **must** filter inaccessible frames and **preserve** survivor `timeWritten` values. **Must not** use navigate merge semantics on trim paths.
- **Failure tolerance:** ladder persist failure after retry exhaustion **must not** fail membership apply or navigate presentation orchestration; errors **must** be logged.
- On **disconnect**, the coordinator **must** purge play membership (`ludicGraph`, adjacency) and **must preserve** `RoomStack` (connect resolves legal placement from the retained stack).
- **Must not** emit **`Character Moved`** or run the membership-changed bundle when **only** the eviction ladder changes and the room membership endpoint is unchanged.
- When asset loss **trim** changes the membership endpoint for an **in-play** character, relocation **must** go through [`repairCharacterLegalPlacement`](manipulation/membership/repairCharacterLegalPlacement.ts) -> [`orchestrateCharacterMove`](navigate/orchestrateCharacterMove.ts). **Out-of-play** characters (**`getMembershipContainers`** empty): trim **`RoomStack` only** --- **must not** re-insert into play.

### `Character Moved` fact

Membership host transfer projection --- coordinators **must** derive fact fields from persist diff (or adapter projection), not from ingress args alone.

- **Must** stream only when **`MembershipDiff.changed`** after successful graph persist.
- **`froms: EphemeraRoomId[]`** = distinct prior membership hosts removed at apply (`[]` = out of play). **May** emit **`froms.length > 1`** when drift repair scrubs multiple hosts.
- **`to`** = destination membership host after apply (`null` on disconnect).
- **`beatAnchorTime`** = recorded time at persistence apply.
- **Must not** populate **`legalExits`** on emitted facts.
- **Must not** branch **`streamEvent`** on ingress type (navigate vs disconnect); emission is descriptive from **`MembershipDiff`** only.
- **`streamEvent`** is a **required** coordinator dependency (no in-module fallback). **`receiveEvents`** passes the DataSource instance `streamEvent`.
- Payload contract: [`publishedEvents.ts`](publishedEvents.ts). **No perception consumer:** leave/arrive narration compiles inline (see [Narration and presentation](#narration-and-presentation)), and perception does not subscribe to `Character Moved` at all. The fact remains a descriptive stream for any future consumer.

### Object room membership (nodes only)

All improvisational **object room-placement** mutations **must** go through [`executeMembershipTransfer`](manipulation/membership/executeMembershipTransfer.ts).

- **Args:** `{ entityId: objectId, target: EphemeraRoomId | null }` --- `null` = removed from all hosts.
- **Graph persist path:** caller -> `executeMembershipTransfer` (diffs against its own fetched `priorContainers`, end-state) -> [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts) (`MultiKeyUpdate`). Every relational chain touching the object **must** be swept explicitly first (`findRelationalChainsTouching`, following crossing ports across hosts, not just the departure host's own plain edges) and dissolved via explicit `dissolveRelation`/`removeCrossingPort` steps ahead of the transfer step, rather than silently stripped --- `removeObject` throws on a residual relational edge by design. Detail: [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md).
- **Must** persist **`ludicGraph`** + adjacency in the same transact; on conflict **`ludicGraph` wins** (mirrors the character-route rule above).
- **Spawn initial placement (objects-lane coordinator):** improvisational **existence** (pair + **`Meta::Object`**) is objects-lane owned; **initial room placement** at spawn **must** call `executeMembershipTransfer` from the objects coordinator ([`spawnOneImprovisationObject`](../objects/spawnImprovisationObjectsBatch.ts)) --- same pipeline as place/remove/drift repair. **Two atomic steps**, not one cross-lane transact.
- **S1 compensating delete:** if placement fails after successful existence create, objects coordinator **must** call `persistDeleteImprovisationObject` before treating the row as failed. If compensation delete also fails, **must** `console.error` with `objectId`, placement error, and delete error **and** emit **`Spawn Compensation Problem`** on **`mtw.ephemera.objects`** via [`streamSpawnCompensationProblem`](../objects/problemReports.ts). Diagnostics intake runs [`orphanedImprovisedObjectSweep`](../../../diagnostics/orphanedImprovisedObjectSweep/); when litmus confirms orphan, **must** emit **`Orphaned Improvised Object Finding`** on **`mtw.diagnostics`** (sweep contract: [`lambda/diagnostics/AGENT.md`](../../../diagnostics/AGENT.md) **Orphaned improvised object sweep**). Objects lane **must** subscribe to the finding and call **`persistDeleteImprovisationObject`** (delete-only repair; see [`objects/AGENT.md`](../objects/AGENT.md) **Diagnostics repair**).
- **Orphan vs adjacency lag (existence-without-placement):**
  - **Orphan:** `(OBJECT#, ASSET#IMPROVISATION)` pair **and** `Meta::Object` present, no **`Object`** node on any host `ludicGraph`, and `getMembershipContainers(objectId)` empty --- diagnostics **`Orphaned Improvised Object Finding`** (not [`repairObjectPlacementDrift`](manipulation/membership/repairObjectPlacementDrift.ts)).
  - **Adjacency lag:** **`Object`** node present on a host graph but containers empty or missing that host --- [`repairObjectPlacementDrift`](manipulation/membership/repairObjectPlacementDrift.ts) owns sync; orphan sweep **must not** emit a finding.
- **Cross-lane sequencing:** spawn sequences existence then graph (rows-then-graph); remove sequences graph then row delete (graph-then-rows) --- both are two-step by design.

### `Object Moved` fact

Membership host transfer projection --- coordinators **must** derive fact fields from persist diff (or adapter projection), not from ingress args alone.

- **Must** stream only when membership diff **`changed`** after successful object graph persist.
- Payload: `{ type: 'Object Moved', objectId, froms[], to, beatAnchorTime }` --- endpoints are `EphemeraMembershipHostId` (all five host kinds; `isObjectMovedPublishedPayload` validates against the wide union, not a Room/Character-only one). v1 **`takeHold`**: `froms: [ROOM#...]`, `to: CHARACTER#...`. v1 **`drop`**: `froms: [CHARACTER#...]`, `to: ROOM#...`. A containment move onto an `On` host (`put cup on table`) also produces this fact, with `to` an `OBJECT#` id --- the containment kinds are the first live producer of a non-Room/Character endpoint here.
- **Must not** populate presentation fields on the fact.
- Fan-in consumer for affordance refresh: **`mtw.ephemera.affordanceOrchestration`** ([`../affordanceOrchestration/index.ts`](../affordanceOrchestration/index.ts)).

### Object membership-changed bundle (room-only)

When object room-only **`MembershipDiff.changed`**, the bundle is the kernel's --- `Positions.set` + Room-host cache invalidation, `setMembershipContainers(objectId)`, the **`Object Moved`** fact, and one **`RoomUpdate`** per affected room, in that order (the same order as the [character bundle](#membership-changed-bundle)). `executeMembershipTransfer` ([`manipulation/membership/executeMembershipTransfer.ts`](manipulation/membership/executeMembershipTransfer.ts)) **must not** duplicate any of it; on `changed: false` it returns before calling the kernel.

A severed boundary relation streams **`Object Relation Changed`** alongside the move, suppressed only when the caller passes `suppressRelationalFacts: true` (e.g. [`repairObjectPlacementDrift`](manipulation/membership/repairObjectPlacementDrift.ts)'s consistency scrub). Destroy/edit (`{ entityId: objectId, target: null }`, always end-state-to-null across every prior host of either kind) follows the identical kernel path and fact rule, leaving `suppressRelationalFacts` unset --- this case is folded into `executeMembershipTransfer` rather than a separate coordinator.

### Cross-host object membership-changed bundle (object move: `takeHold` / `drop` / `give`)

**One execution path covers both directions.** [`planObjectMoveTransfer`](manipulation/membership/planObjectMoveTransfer.ts) takes a concrete **host pair** (`fromHostId`, `toHostId`) --- and takes **no acting character and no verb**. By plan time both hosts are already concrete, so there is nothing left for Grounding to resolve: `buildObjectMoveOp` derives `dissolvedEdges` from the departure host's own graph (only the mover's own containment edge into that host's root --- boundary edges are the attempt's own dissolve actions; see the `attempt` paragraph under the `mtw.ephemera.actions` ingress). `commitAttempt` dry-runs the whole attempt's sequence ([`dryRunStepSequence`](manipulation/kernel/dryRunStepSequence.ts)) rather than re-running the general Synthesize executor, refuses any non-`legal` verdict with its reason code, and commits the mutation steps via [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts) --- one atomic `MultiKeyUpdate` over every host the sequence touches.

**Intents stay distinct; execution unifies.** Take-hold and drop remain two Plan-stage legality branches, because the player-facing errors genuinely differ per direction ("you're not carrying that" vs. "you're already holding that") and they are different utterances --- both publish through the one `Ludic Network Change Requested` event now, but the world-effect was already one operation before that, distinguished only by its host pair. **Must not** reintroduce a per-direction execution module, and **must not** introduce `updateDropLudicGraphs` or any new `update*LudicGraphs` fork.

The plan is **re-derived, not scrubbed from trusted ingress**: `commitAttempt`'s dry run re-classifies boundary edges against the departure host's current graph (any the attempt does not dissolve refuses the move), and the reducer re-validates presence and boundary-edge classification on the locked graphs at commit time. A concurrent modification since selection aborts the whole transact rather than applying a stale plan.

The post-persist bundle is the kernel's, for the moved entity, in this order:

1. `Positions.set` on **every** committed graph --- both hosts; `ComponentEphemeraMeta.invalidate` / `AffordanceRoomDeliverable.invalidate` for Room hosts only.
2. `setMembershipContainers(objectId)` -> the arrival host.
3. **`Object Moved`**, streamed in step order. `takeHold`: `froms: [ROOM#...]`, `to: CHARACTER#...`. `drop`: `froms: [CHARACTER#...]`, `to: ROOM#...`. When the attempt carries relational actions (a facilitating dissolve, say), their **`Object Relation Changed`** facts stream **after** every step fact, one per action's edge, not interleaved in step order. A move's own containment strip and containment establish are not relational actions: their facts stream in step order whether or not the attempt carries any.
4. **`RoomUpdate`** per Room host only --- a character endpoint has no room affordance to refresh.

An attempt whose result has not succeeded (a challenge still pending or refused), a boundary edge the attempt does not dissolve, or a stale/failed commit **must** return `{ ok: false }` without committing (no persist, no bundle, **no narration**). It currently yields no player feedback; surfacing failure is an open product question, not a licence to narrate an uncommitted move.

**Narration** is owned by [`commitAttempt`](manipulation/commitAttempt.ts): it resolves the attempt's narration-unit audiences to capture steps and its labels before the commit, then, on `ok: true`, delivers the units. The rules, and the one-entity move shape, are in [Narration and presentation](#narration-and-presentation). Playbook: [`manipulation/AGENT.implementation.md` --- Apply modes](manipulation/AGENT.implementation.md#apply-modes).

### Host-local relational-changed bundle (`establishRelation` / `dissolveRelation`)

Graph persist: [`commitAttempt`](manipulation/commitAttempt.ts) builds each relational action's `establishRelation` / `dissolveRelation` steps via [`planRelationalEdgeTransfer`](manipulation/relational/planRelationalEdgeTransfer.ts) and commits them with the rest of the attempt via [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts). Relational steps **must not** route through the shared membership adapter; they compose with membership transfer by appearing in the same step sequence.

The bundle is kernel-owned:

1. **`Object Relation Changed`** streamed in step order.
2. `internalCache.Positions.set` for **`hostId`** --- **unconditional** across host kinds; **must not** skip the cache seed just because the host isn't a Room (that would leave a character's cached graph stale).
3. **`ComponentEphemeraMeta.invalidate`** / **`AffordanceRoomDeliverable.invalidate`** for **`hostId`** --- **only** when **`hostId`** is a Room (`isEphemeraRoomId`); these caches have no Character-hosted equivalent.
4. Internal **`RoomUpdate`** for **`hostId`** --- **only** when **`hostId`** is a Room; a Character-hosted relation has no room affordance to refresh.

**Must skip** the entire bundle when **`changed: false`** (idempotent duplicate edge on **`op: 'add'`**). A relational action's lines are its attempt's narration units ([An attempt narrates through its narration units](#an-attempt-narrates-through-its-narration-units)); positions derives none from the bundle.

### Object placement drift repair

- **Steady state:** at most one room per **`OBJECT#`**; multi-room adjacency is drift.
- **Graph-forward repair:** [`repairObjectPlacementDrift`](manipulation/membership/repairObjectPlacementDrift.ts) --- adjacency-only via [`syncMembershipAdjacencyToRoom`](manipulation/membership/syncMembershipAdjacency.ts); multi-container scrub via **`executeMembershipTransfer`** retaining the finding room, with `suppressRelationalFacts: true` --- a severed boundary relation here is a silent consistency fixup, not a player-visible event, so it must not stream **`Object Relation Changed`** (`Object Moved` streams unaffected). Applies when a graph **`Object`** node exists (adjacency lag); **not** for existence-without-placement orphans (pair + meta without graph node --- see **Orphan vs adjacency lag** above and [`orphanedImprovisedObjectSweep`](../../../diagnostics/orphanedImprovisedObjectSweep/)).
- **Deferred:** `Object Placement Drift Finding` diagnostics sweep (character analog: [`roomOccupancyDriftSweep`](../../../diagnostics/roomOccupancyDriftSweep/)).

---

## Host-local relational patch

Kernel: [`manipulation/kernel/`](manipulation/kernel/) (`establishRelation` / `dissolveRelation` steps). Coordinators: [`manipulation/relational/`](manipulation/relational/). Code map: [`manipulation/AGENT.implementation.md` --- Host-local relational patch](manipulation/AGENT.implementation.md#host-local-relational-patch).

Mental model: [**Host-local relational patch**](AGENT.concepts.md#manipulation-layering-membership-transfer) (in-host topology without membership-host change). Distinct from membership transfer (which moves nodes between hosts) and from the adjacency reverse index (**no** adjacency dual-write for relational edges).

### Relation kinds

**`HostRelationalEdgeKind`** is the hosting kinds (`HostingRelationKind`: `On`, `In`, `PartOf`) plus one peer kind, `Custom`:

| Kind | Player language (examples) | Persist |
| --- | --- | --- |
| **`On`** / **`In`** | on, onto, in, inside | Containment: the mover's own edge to its new host's root, written by a `transferMembership` with a `containment` flag (below). **Must not** persist as a peer edge between siblings |
| **`PartOf`** | none (no deterministic authoring) | Containment edge, same shape |
| **`Custom`** | under, against, tied to, wrapped around, long-tail phrases | **`kind: 'Custom'`** + **`relationLabel`** (see below) |

There is no deterministic parse of a peer relation: `Custom` is produced only by the LLM Plan fallback, and the relation's words live in `relationLabel`. There are no closed peer kinds; a move that severs any peer edge defers to the adjudicator. **Manner, not physics:** the graph cannot tell clearance (a lamp under a table, moved away) from a pinned relation (a rope lashed to a post), and `Custom` has no finer kind, so the adjudicator meets a severed peer subject-move either way. The rule is the manner in which the move happens, not what the graph holds.

Containment (`put X in Y`, `put X on Y`) is the only relational parse that stays deterministic, and it is not a peer edge: it is a `transferMembership` with a `containment` flag, built by [`matchContainmentTemplate`](../actions/enrich/objectManipulation/plan/matchContainmentTemplate.ts) at Plan stage. Peer `Custom` + label is produced only by the LLM Plan fallback. Positions **must** trust ingress **`kind`** / **`relationLabel`** at apply (same pattern as trusted **`objectId`** on **`Object Take Hold`**). Pre-ingress, actions reads host graphs via read-only **`EphemeraLudicGraph`** from [`ludicGraph/`](ludicGraph/) to find each candidate's chain; there is no construction-time legality check, and the kernel rechecks every leg at commit; stored edge wire shape is **`EphemeraLudicRelationalEdgeData`** (`tag: 'Relational'` on host **`ludicGraph.edges`**); gateway read projection passes through stored relational edges ([`packages/mtw-gateways/ts/ephemera/positions/project.ts`](../../../../packages/mtw-gateways/ts/ephemera/positions/project.ts)).

### Edge persist shape

Relational mutations **must** persist on a **fixed host** --- the host's own **`Meta::<Kind>.ludicGraph`** forward graph only. `RelationalIngressArgs.hostId` is an `EphemeraMembershipHostId`, so **any** of the five host kinds is a legal persist target and all five dispatch through storage. **Room and Character are the kinds production ingress is confirmed to produce today** (a Character host arises when subject and target already share the acting character's inventory graph); Object / Feature / Area are storage-supported and grounding-reachable but have no confirmed production ingress path yet, so **absence of one is not evidence the host kind is illegal**. **Must not** write adjacency rows for relational edges (forward-graph only; see [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md#host-local-relational-patch)).

**`HostRelationalPatch`** (kernel input; one add or remove on one host):

```typescript
type HostRelationalEdgeKind =
    | 'On' | 'In' | 'PartOf' | 'Custom'

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

**Rules:**

- **`relationLabel` belongs structurally to `Custom`**, and the rule runs **both** ways: a `Custom` edge **must** carry a non-empty label, and **no other kind may carry one at all**. This is expressed in the type (`RelationalEdgeKindAndLabel`, and `RelationalKindAndLabel` for the DTO lane's `relationKind` spelling), not by runtime checks at each layer --- an illegal pairing does not compile.
- **`Custom`** edges **must** persist **`relationLabel`** on the stored forward-graph edge --- **not** presentation-only copy in perception.
- **`isEphemeraLudicRelationalEdgeData` must reject a non-`Custom` edge carrying a label**, since such a value is unrepresentable and a guard accepting it would lie about what it narrows. A stored row in that shape is recovered by [`extractRelationalEdgesFromStored`](ludicGraph/baseClasses.ts)'s fallback **with the stray label stripped** --- sound and lossless. A `Custom` row with no usable label is **not** recoverable there and is dropped.
- **`establishRelation`** ingress **must** map to **`op: 'add'`**; **`dissolveRelation`** **must** map to **`op: 'remove'`** matching **`from`**, **`to`**, **`kind`**, and **`relationLabel`** (when **`Custom`**).

### Kernel and compound apply

- All **`establishRelation`** / **`dissolveRelation`** applies **must** route through **`commitStepSequence`** as explicit relational steps. **Must not** add a relational-specific kernel entrypoint alongside it.
- Composed commands (**drop** + **`establishRelation`**, etc.) **must** carry membership and relational steps in **one** step sequence and therefore **one** **`transactWrite`** (atomic all-or-nothing); **must not** apply them as independent transacts with partial commit.
- **Legality is re-verified inside the transaction, never from a snapshot.** The `MultiKeyUpdate` reducer re-runs `EphemeraLudicGraph.applyRelationalPatch` --- the single shared legality authority, including `bothObjectsOnGraph` --- against freshly-fetched, locked graphs, and throws to abort on any staleness or illegality. On conflict, **`ludicGraph` wins** (same authority as membership graph).
- A `sameHost` violation discovered only at commit time (a concurrent write moved one of the objects since selection) is caught by that same `bothObjectsOnGraph` check --- **must not** be given a bespoke `sameHost`-specific mechanism.
- Self-healing a stale assumption (recomputing a fresh repair and bundling it atomically) is **not** attempted: any staleness fails the whole transact with one generic error code. This is an acknowledged interim answer standing in for a not-yet-built persistence-level backtrack channel, not a permanent design conclusion (open as BD-18 in [`AGENT.backtrackChannel.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.backtrackChannel.planning.md)).

### Legality (actions-owned pre-ingress; positions-owned at apply)

| Case | Actions (pre-publish dry run) | Positions apply |
| --- | --- | --- |
| Both **`from`** and **`to`** nodes on host graph | Required before egress | Re-validate; reject if absent |
| Exact duplicate edge already present | Refused: the relation already holds | Refuses the whole attempt (see **Duplicate establish**); the kernel's **`op: 'add'`** stays a no-op backstop |
| **`dissolveRelation`** with no matching edge | **Error** before egress | Reject **`op: 'remove'`** when edge absent |

### Ingress summary

**The per-attempt hand-off:** relational ingress carries no pre-built `steps` across the bus. Actions **must** publish one `Ludic Network Change Requested` event per selected attempt (membership, relational and containment alike; payload + guard in [`../actions/publishedEvents.ts`](../actions/publishedEvents.ts)), carrying the whole `CommandAttempt` and nothing it already holds --- no primitive named in the header, since a plan can mix kinds. Positions **must** subscribe in [`subscribedEvents.ts`](subscribedEvents.ts) and delegate to [`manipulation/commitAttempt.ts`](manipulation/commitAttempt.ts), which dispatches per action by its `desiredResult`'s primitive, re-expands each against live state (membership via [`planObjectMoveTransfer`](manipulation/membership/planObjectMoveTransfer.ts), which also threads a containment action's optional `containment` flag through; relational via [`planRelationalEdgeTransfer`](manipulation/relational/planRelationalEdgeTransfer.ts), rebuilding the chain fresh rather than trusting a stale dry-run snapshot), concatenates every action's resulting kernel steps, and commits the whole attempt in **one** `commitStepSequence` transact --- not one per action. A relational action's edge (subject, target, kind, label) is passed through as `relationalEdges` for its one post-commit fact, the same mechanism the [relation fact](#object-relation-changed-fact) already established. The bespoke `Object Containment` event is retired; the old envelope/guard/dispatch (`ObjectContainmentPublishedPayload`, `isEphemeraPositionsActionsObjectContainmentEnvelope`) are deleted.

### `Object Relation Changed` fact

- Payload: `{ type: 'Object Relation Changed', subjectId, targetId, hostId, relationKind, relationLabel?, operation: 'establish' | 'dissolve', beatAnchorTime }`.
- Streamed from coordinator on successful persist when **`changed: true`**; no consumer narrates from it any more (an attempt's relational lines are its narration units, delivered by `commitAttempt`'s post-commit sweep, [`manipulation/deliverNarrationUnits.ts`](manipulation/deliverNarrationUnits.ts)).
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

### `mtw.assets`

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Component Updated` | [`dataSource/index.ts`](../index.ts) `processComponentUpdated` -> [`manipulation/containment/populateContainmentAtCache.ts`](manipulation/containment/populateContainmentAtCache.ts) |

### `Component Updated` (containment population, cache-time)

- **Ingress:** every asset-cache write, not a player-command route --- `dataSource/index.ts`'s `processComponentUpdated` fires on **every** `Component Updated` event, whatever component kind changed, and re-fires on every re-cache of already-cached, unchanged content (`cacheAsset` re-runs frequently).
- **Trigger, duck-typed on shape, not switched on `component.tag`:** any membership-host component whose `.ludicGraph.nodes` is non-empty (every Standard component kind with a membership host id serializes a `ludicGraph` --- Room, Area, Feature, Object, Character). This is deliberate: a host kind gaining authored nesting starts populating with no change to the trigger.
- **Must** treat this as additive-only: for each child named in the updated component's `ludicGraph.nodes`, add the child as a node of the parent's graph, add a presence binding on the child (`addPresenceBinding`, `fromHostId` the parent), and establish a `PartOf` edge (`subjectId` the child, `targetId`/`hostId` the parent) --- never `In`, which is reserved for mobile placement (Objects), not fixed/authored nesting (Room-in-Area, Feature-in-Room).
- **Must not** handle removal-on-deauthoring: a child that later drops out of `ludicGraph.nodes` keeps its node membership, port, edge, **and its `EphemeraPositionAdjacencyRow` under the former parent** (the population path's `transferMembership` step carries `fromHostIds: new Set()`, so it only ever `Put`s adjacency, never `Delete`s). Provenance and removal are out of scope for the CoyoteGame prototype, deferred deliberately rather than overlooked. Note that the departure signal *does* reach this handler --- `cacheAsset` is diff-driven, so the former parent is itself a changed component and its `Component Updated` carries a node list the child has dropped out of; what is deferred is acting on that absence, not learning of it.
- **Idempotency is caller-side, not reducer-side:** neither a pure-add `transferMembership` step nor an `addPresenceBinding` step is safe to replay unconditionally (the former returns an `illegal` verdict on an already-present member; the latter would mint a second presence node). [`containmentPopulationSteps.ts`](manipulation/containment/containmentPopulationSteps.ts) checks current state (already-fetched graphs) before emitting each of the three steps independently, so a fully-populated rerun emits nothing and commits no transaction.
- **Must** commit every child named in one parent's update as one `commitStepSequence` call (one `MultiKeyUpdate`), not one call per child --- a separate commit per child would open a window where some children of the same cache pass are populated and others are not.

### `mtw.ephemera.actions`

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Character Navigate` | [`index.ts`](index.ts) `receiveEvents` -> [`navigate/orchestrateCharacterMove.ts`](navigate/orchestrateCharacterMove.ts) |
| `Character Home` | [`index.ts`](index.ts) `receiveEvents` -> [`navigate/orchestrateCharacterMove.ts`](navigate/orchestrateCharacterMove.ts) |
| `Ludic Network Change Requested` | [`index.ts`](index.ts) `receiveEvents` -> [`manipulation/commitAttempt.ts`](manipulation/commitAttempt.ts) (membership, relational and containment actions alike) |

**`positions/index.ts`'s dispatch is the sole reconstruction point for a published `attempt`.** `index.ts` **must** be the only place that calls `CommandAttempt.fromJSON` on it, before handing the result to `commitAttempt` as a plain `attempt: CommandAttempt` arg. **Positions honors verdicts and never judges them.** Adjudicate runs actions-side, per candidate ([`actions/commandAttempt/adjudicate.ts`](../actions/commandAttempt/adjudicate.ts)), and the attempt arrives with its verdicts recorded. `commitAttempt` commits only an attempt whose `result` has succeeded, and **must** take a move's facilitating dissolves only from the attempt's own actions, never derive them: positions re-classifies boundary edges against its own later snapshot only to verify, and a boundary edge no action covers (the world changed since the actions-side dry run, or a containment move, whose producer expands none) refuses the move.

### `Ludic Network Change Requested` (positions-owned)

- **Ingress:** the generalized hand-off via actions **`Parse Requested`** only. Stream contract: `{ characterId, attempt: CommandAttemptData, confidence? }` --- no primitive in the header or payload; a plan can mix action kinds. Payload type + guard in actions [`publishedEvents.ts`](../actions/publishedEvents.ts).
- **Must** call [`commitAttempt`](manipulation/commitAttempt.ts), which dispatches each action of the reconstructed attempt by its `desiredResult`'s primitive:
  - **`transferMembership`:** re-derives the object's live host fresh via `getMembershipContainers` (zero or multiple current containers is a drift/race condition this does not attempt to repair --- no-op rather than guess). Its `desiredResult` may carry an optional `containment: 'On' | 'In'` flag, threaded straight through to `planObjectMoveTransfer`/`compilePositionKernelOp`, whose established edge's host is always the destination, by construction (no ancestry walk). Resolves presentation labels and builds (not commits) the plan via [`planObjectMoveTransfer`](manipulation/membership/planObjectMoveTransfer.ts).
  - **`establishRelation` / `dissolveRelation`:** rebuilds the chain fresh against live state via [`planRelationalEdgeTransfer`](manipulation/relational/planRelationalEdgeTransfer.ts) (ancestry walk + `runExecutor`, the same mechanism actions' own pre-publish dry run uses, not a trusted pre-built `steps` array) and carries the edge through as one of `relationalEdges` for its post-commit fact.
- **Must** concatenate every action's resulting kernel steps and commit the whole attempt in **one** `commitStepSequence` transact (one `MultiKeyUpdate`), not one per action.
- **All-or-nothing:** an action that cannot be built against live state **must** refuse the whole attempt, with its own log line, and nothing is written, siblings included. This covers drift, a take or drop already held (refused with an "already on" message, not skipped), zero or several live containers, an unresolvable derived referent, a planner refusal (including a dissolve with no chain or several chains), and a dry-run refusal. A "no-op rather than guess" outcome is a refusal under this rule.
- **Duplicate establish:** an establish whose exact edge is already on its carried host **must** refuse the whole attempt (all-or-nothing, see the `commitAttempt` clause above), not no-op. `commitAttempt` checks this against the live graph before the attempt commits, so no narration is emitted for a relation that did not newly form.
- **Must** reject a dissolve apply when the matching edge is absent on the host graph (kernel **`op: 'remove'`** matching edge **`from`**, **`to`**, **`kind`**, and **`relationLabel`** when **`Custom`**).

### `Character Home` (positions-owned)

- **Ingress:** typed **`home`** / **`HomeIntent`** via actions **`Parse Requested`**, trusted home via actions **`Action Assessed`** **`Home`** (`source: 'uiHome'`).
- **Must** trust actions-resolved `toRoomId` (`CharacterMeta.HomeId`) at apply --- no exit topology re-check in positions.
- **Must** call `orchestrateCharacterMove({ characterId, targetRoomId: content.toRoomId, intentKind: 'home' })`, which calls the membership coordinator then post-persist orchestration when `changed`.
- **Must not** rely on imperative `MoveCharacter` bus messages from actions for home (retired).
- Leave/arrive world copy for home is **compiled** (`intentKind: 'home'` on [`buildCharacterMoveOp`](manipulation/membership/buildCharacterMoveOp.ts)) and reported by [`presentStepSequence`](manipulation/kernel/presentStepSequence.ts) inside the navigate orchestration tail --- see [Narration and presentation](#narration-and-presentation). `intentKind`'s full vocabulary (`'navigate' | 'home' | 'connect' | 'disconnect'`) is declared once as `IntentKind` in [`manipulation/membership/types.ts`](manipulation/membership/types.ts); [`orchestrateCharacterMove.ts`](navigate/orchestrateCharacterMove.ts) and `planCharacterMoveTransfer.ts` both take it directly; a narrower call site derives its subset from `IntentKind` rather than re-declaring literals.

### `Character Connected` (positions-owned)

- **Must** resolve `targetRoomId` via [`resolveConnectTargetRoom`](manipulation/membership/resolveConnectTargetRoom.ts) --- legal placement from nowhere: trim ladder to accessible assets, then top surviving frame (default VORTEX when stack normalizes empty).
- **Must** call `orchestrateCharacterMove({ characterId, targetRoomId, intentKind: 'connect', characterMeta })`, which calls the membership coordinator then post-persist orchestration when `changed`.
- **Must not** publish `CheckLocation` or perform inline membership Dynamo writes outside [`manipulation/membership/`](manipulation/membership/).
- **Idempotency:** duplicate connect when already in target room (`changed: false`) **must** be a no-op (no bundle, no orchestration).
- Arrive world-line copy for connect is **compiled** (`intentKind: 'connect'`); with `froms` empty the compiler emits no capture-from and no leave narration, from arity alone rather than a connect-specific branch. Connect reuses the navigate orchestration tail and publishes no imperative world lines.

### `Character Disconnected` (positions-owned)

- **Must** call `orchestrateCharacterMove({ characterId, targetRoomId: null, intentKind: 'disconnect' })` --- purges play membership; **must not** clear `RoomStack` (connect re-resolves legal placement from retained ladder).
- **Must not** perform inline membership writes outside [`manipulation/membership/`](manipulation/membership/).
- **Idempotency:** duplicate disconnect when already out of play (`changed: false`) **must** be a no-op (no bundle).
- Leave world-line copy for disconnect is **compiled** (`intentKind: 'disconnect'`) and presented by [`presentCharacterMove`](navigate/presentCharacterMove.ts), called with `to: null` --- disconnect has no destination room, so there is no arrival header to render (that branch is unreachable, per the "One present-tier function, gated on `to`" clause above). No imperative `PublishMessage` in the handler. The ghost-purge sweep in [`repairRoomOccupancyDrift`](manipulation/membership/repairRoomOccupancyDrift.ts) shares this path and this copy verbatim: a ghost session genuinely has disconnected, so **must not** grow a separate drift narration variant.

### `Character Navigate` (positions-owned)

- **Ingress:** typed commands via actions **`Parse Requested`**, UI exit clicks via actions **`Action Assessed`** **`Navigation`** (same execution contract).
- **Must** trust actions-validated `toRoomId` at apply (no topology re-check in positions).
- **Must** call `orchestrateCharacterMove({ characterId, targetRoomId: content.toRoomId, intentKind: 'navigate' })`, which calls the membership coordinator then post-persist orchestration when `changed`.
- **Must not** rely on imperative `MoveCharacter` bus messages from actions for parse-based or UI-exit navigation (retired).
- Leave/arrive world copy for navigate is **compiled** and reported synchronously in the orchestration tail --- see [Narration and presentation](#narration-and-presentation). Exit-aware leave copy comes from the parse's `exitName` travelling as a narration *ingredient* on the op; **must not** be re-derived from fact `legalExits`.

### `mtw.diagnostics` --- occupancy drift repair

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Room Occupancy Drift Finding` | [`index.ts`](index.ts) `receiveEvents` -> [`repairRoomOccupancyDrift`](manipulation/membership/repairRoomOccupancyDrift.ts) |

**Repair model (graph-forward):**

- Enumerate character nodes on the room **`ludicGraph`**; **must not** use **`Meta::Character.RoomId`** or **`Meta::Room.activeCharacters`** as authority.
- **Sessions gate:** no live sessions -> **`orchestrateCharacterMove({ characterId, targetRoomId: null, intentKind: 'disconnect' })`** (full graph purge; membership-changed bundle when `changed`).
- **In-play, adjacency lag:** graph correct but **`getMembershipContainers`** omits this room -> [`syncMembershipAdjacencyToRoom`](manipulation/membership/syncMembershipAdjacency.ts) only (**must not** run the membership-changed bundle).
- **Idempotency:** at-least-once finding delivery **must** be safe (no-op when already repaired).
- **Explicit gap:** stale adjacency without a graph node is out of scope for this room-forward scan.

Sweep (read-only classification): [`../../../diagnostics/roomOccupancyDriftSweep/`](../../../diagnostics/roomOccupancyDriftSweep/).

### `mtw.diagnostics` --- `ludicGraph` structural staleness self-heal

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Ludic Graph Stale Structure Finding` | [`index.ts`](index.ts) `receiveEvents` -> [`healLudicGraphStructure`](ludicGraph/healLudicGraphStructure.ts) |

**Repair model, scoped tightly (`rootId` is recorded, never derived):**

- **Healable, and only these two:** a host-bound graph's `rootId` (canonically `hostId`) when missing or invalid, and the root's own node (canonically derivable from `rootId` alone, via `nodeFromId`) when absent from `nodes` --- concepts clause 3's requirement, the shipped guard's own check.
- **Not healable, and must not be attempted here:** `ports` or any other stored shape drift. A row stale for a reason outside this healable set is reported and left untouched, not force-fit. **Scope of the `ports` line:** it was drawn against *repairing a port at all*, on the ground that a port has no interior witness so any repair must read the exterior --- which meant the reverse index. **A port that disagrees with the referrer it itself names is not that case:** it names the one row to check, so the repair reads one named graph and no reverse index. That repair is real, and it is the **separate** heal below, still not this one --- this handler stays single-record. What remains permanently outside both is a port missing `fromHostId`, or one whose named referrer holds no matching edge: those ask *who **should** refer here*, which only the reverse index answers.
- **Idempotent:** at-least-once finding delivery **must** be safe --- a row already matching the shipped shape is a no-op read, no write issued.
- **Never called from a read boundary.** `fromFieldPayload`/`isEphemeraLudicGraphFieldPayload` stay strict; this repair is the one-time, write-carrying opposite of a `??=` default. It runs only from this finding consumer (always `dryRun: false`) or an explicit manual invocation (`dryRun` either way) --- growing a read-time fallback here undoes the stored-graph reset that cleared every legacy payload.

Sweep (read-only classification): [`../../../diagnostics/ludicGraphStaleStructureSweep/`](../../../diagnostics/ludicGraphStaleStructureSweep/).

### `mtw.diagnostics` --- `ludicGraph` port mismatch self-heal

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Ludic Graph Port Mismatch Finding` | [`index.ts`](index.ts) `receiveEvents` -> [`healLudicGraphPortMismatch`](ludicGraph/healLudicGraphPortMismatch.ts) |

**Why a second heal rather than a wider first one:** shape staleness is judged from one row; a mismatch cannot be. This handler reads the interior row **and** the row of the host the port names, which is exactly what `healLudicGraphStructure` must never do.

**Repair model (the [port-record conflict rule](#port-records-field-scope-and-the-conflict-rule): compare where comparison is possible; where an exterior reference exists it governs):**

- **Healable:** a **crossing port** whose `kind` or `exteriorRelationLabel` disagrees with the edge(s) crossing into it in the **named** referrer's graph. The repair rewrites those two fields from the exterior edge and **must not** touch any other field, any other port, or the referrer.
- **Not a mismatch at all, and no write:** the referrer holds no edge into this port, its graph is absent, or its graph fails the shape guard (that last is the *structure* finding, which orders the two heals rather than duplicating them).
- **Reported unhealable:** the matching exterior edges into a **crossing port** disagree with **each other**. A crossing port's single-use lifecycle means one crossing, so a split fan is broken exteriorly and picking one edge to believe would invent an answer.
- **Presence bindings are out of scope for this heal entirely, not a carved-out case within it.** A presence binding is a graph **node** ([`EphemeraLudicGraphStructureNode`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts), tag `'Presence'`), never a port record --- `EphemeraPresencePort`/`EphemeraPresencePortKind` do not exist, and `EphemeraLudicGraph.ports` holds only `EphemeraCrossingPort`. There is no `kind === 'Present'` port left for this classifier to dispatch on, and no fan-disagreement case for it either --- see [Presence nodes](#presence-nodes-cover-consolidation-and-the-single-write-path) below for what replaced it.
- **Idempotent, and by recheck rather than by assumption:** the handler re-reads both rows and re-classifies before writing, so at-least-once redelivery of a finding whose mismatch is already repaired is a no-op read.
- **Never called from a read boundary,** for both of the reasons the structure heal already carries: a read-time default hides a stale row forever, and a read-time repair makes every read a write.

Comparison (shared with the sweep, one definition): [`@tonylb/mtw-gateways/ts/ephemera/positions`](../../../../packages/mtw-gateways/ts/ephemera/positions/classifyLudicGraphPortMismatch.ts) `classifyLudicGraphPortMismatch`.
Sweep (read-only classification): [`../../../diagnostics/ludicGraphPortMismatchSweep/`](../../../diagnostics/ludicGraphPortMismatchSweep/).

---

## Port records: field scope and the conflict rule

A `ludicGraph` port ([`EphemeraLudicGraphPort`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)) is stored **interior-side only** --- on the graph of the whole that owns the port --- but it carries facts of **two scopes**, and which scope a field belongs to is what decides who wins a disagreement. The two self-heal sections above apply this rule and cite it rather than restating it.

**Crossing-only:** `EphemeraLudicGraph.ports` holds `EphemeraCrossingPort` alone. A presence binding is a graph node ([Presence nodes](#presence-nodes-cover-consolidation-and-the-single-write-path) below), never a port record --- there is no presence port type, and `EphemeraLudicGraphPort` survives only as a single-member union alias for call sites not yet narrowed to `EphemeraCrossingPort` directly.

- **Interior scope --- the port's existence, its `portId`, its single-use lifecycle, and its `kind`.** The interior owns the binding, so these are authoritative without qualification: no exterior fact can overrule them. That authority is exercised **against** an exterior witness --- a disagreeing exterior edge triggers the heal above, which rewrites `kind` from that edge rather than defending the stored value.
- **Exterior scope --- `fromHostId` and the exterior relation label (`exteriorRelationLabel`).** These are facts *about the exterior relationship*, held interior-side as **denormalized copies**. The authoritative instance is the referring edge in the named host's own graph.
- **The conflict rule, and it is unconditional now that every port is a crossing port: compare where comparison is possible; where an exterior reference exists it governs; where none exists the stored value stands.** Every port has exactly one interior edge and one exterior referrer, so the "none exists" branch has no remaining live case --- it is kept in the rule's statement because a witness can still be **absent from the read** (referrer graph missing, or failing its shape guard) even though one exists in principle; that case is *not a mismatch at all*, per the heal section above.
- **This is not a witness requirement.** An uncontested value needs no exterior instance to justify it. A port whose named referrer holds no matching edge is **not** thereby wrong, and **must not** be repaired toward absence.
- **One rule, not one per field.** The same shape governs `kind` --- checked wherever an exterior edge exists --- so a port's record has a single consistency rule.

**Address form.** A port address is the structured value `{ owner, port }` (`EphemeraLudicPortAddress`); its string notation separates owner and port with a second `#` (`OBJECT#ROPE#ab6129d`), and `isEphemeraTaggedId` **must** throw on that nested form rather than affirm it as a plain tagged id. A port id is an opaque token: nothing **may** depend on port ids being sequential, comparable, or meaningful.

**`exteriorRelationLabel` stays optional regardless of the above** --- its optionality is `kind === 'Custom'` carrying a label versus other kinds carrying none, a different axis from whether a port has an exterior endpoint.

**Two things this rule replaced, stated because both were believed and both were too strong.** *The halves are complementary, not duplicated* is **false**: the port names its host and the referring edge names the port, so `fromHostId` is reconstructible from the exterior side and the two can contradict each other. And *the interior is authoritative* was an over-reading of the locked frame's clause about the interior **owning the binding** --- ownership of the binding is not authority over every field on it. The mental-model half of this correction is in [`AGENT.concepts.md`](AGENT.concepts.md#wholes-parts-and-ports).

---

## Presence nodes: cover, consolidation, and the single write path

A presence binding is a graph node ([`EphemeraLudicGraphStructureNode`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts), tag `'Presence'`), minted 1:1 with the port uuid it replaces (`PRESENCE#{uuid}`), never a `Present`-kind edge or port record --- both were considered and neither was built (no writer in this codebase has ever minted a `Present` edge). The mental model is in [`AGENT.concepts.md`](AGENT.concepts.md#presence-as-a-cover).

- **`cover` is the whole of a presence node's bucket-membership statement, and it is one of two alternates, never both:** `{ tag: 'Full' }` (every node of the host, no member list stored) or `{ tag: 'Enumerated'; members: EphemeraPresenceCoverEntry[] }`, where each entry is a `{ host, presence }` pair --- `host` the covered component's own id, `presence` which of that component's own bindings this entry means (a bare `host` cannot say that; see `EphemeraPresenceCoverEntry`'s definition comment). `fullCoverage` is illegal in `ludicCache`: the structure arm of `EphemeraLudicCacheNode` takes the `'Enumerated'` arm only, so a fold must expand it to an explicit list, structurally rather than by runtime guard.
- **In `ludicCache`, a presence binding nests on its owner's cache node, not in a separate top-level list.** `EphemeraLudicCacheData.nodes` holds components only; each `EphemeraLudicCacheNode` carries its own bindings as a required `presenceNodes: EphemeraLudicCachePresenceNode[]` (`[]` when the host has none --- every cache node is a walked host whose graph was read, so `[]` is a true "none", not "unread"). A binding without an owner is unrepresentable by construction, mirroring the graph side where the container already names the owner.
- **A cut's node set is not the cover, and only the cover states binding provenance.** [`nodesFromPresenceBinding`](ludicGraph/presenceSubGraph.ts) returns the cover's `host` entries **unioned with the root and with the binding's own presence node id** --- the root is in every bucket unconditionally and the presence id is there for `endpointStatus`'s ordinary `nodes.has(owner)` test, neither of them because a binding covers it. **So *this node is here because of this binding* is answerable from `cover.members` and never from the set the cut ranges over**, and a consumer that reads the latter as membership over-claims by exactly those two entries. **No edge is ever a cover member**, so an edge kept in every bucket by the both-neutral rule --- a transit leg --- carries no provenance claim under any cover shape.
- **`consolidated: boolean` is a separate, explicit field, deliberately not collapsed into `cover`'s shape.** `consolidated: false` with a non-empty `cover` is a legal graph-side **preview** state that authorizes nothing in a cache --- **every authorization check on cover information must filter on `consolidated: true`.**
- **Clause 3, zero-or-all: if a host consolidates any one of its presence bindings, it consolidates all of them.** Enforced by `assertZeroOrAllPresenceBindings` in [`ludicCache/mergeReducer.ts`](ludicCache/mergeReducer.ts), called from `presenceCacheNodesFromFold` before any cache node is minted for a fold; it throws rather than silently consolidating a partial set.
- **Single write path, and it is what makes clause 3 and write-time completeness checkable at all:** every presence-node mint or removal goes through [`EphemeraLudicGraph.addPresenceNode`/`removePresenceNode`](ludicGraph/index.ts), reached only from `applyStepSequenceCore.ts`'s `addPresenceBinding`/`removePresenceBinding` step handlers, which are in turn emitted only by [`presenceBindingStepsForMove.ts`](manipulation/kernel/compile/presenceBindingStepsForMove.ts) and [`containmentPopulationSteps.ts`](manipulation/containment/containmentPopulationSteps.ts). **A third emitter added for convenience costs this guarantee its argument** --- do not add one.
- **`isEphemeraLudicCacheData` ([`ludicCache/types.ts`](ludicCache/types.ts)) enforces two integrity checks with deliberately opposite verdicts, and the cover check resolves by path:** checking a cover entry means walking to the member host's own cache node, then to the entry's named binding on it. An absent host node, or a named binding not found on it, **FAILS** (corruption --- an internal inconsistency within one cache). This is sound rather than overzealous: a cover member is never a character (a character's membership host is a Room only) and the walk reaches every other member, so an absent host can never be a legitimate omission. An edge terminating at a presence node absent from `nodes` **PASSES** (the binding exists and was simply not pulled into this materialization --- legal by design). **Do not make the second case fail defensively** --- it is a guarantee this guard cannot see, not an oversight.
- **A cache cover entry's `presence` field is optional, unlike the graph-side `EphemeraPresenceCoverEntry`'s required one.** It is absent exactly when the fold could not find the member's own binding into the owner --- a thing placed without a move never had one minted. The member is still covered by the entry; only which of its bindings is meant is unknown.
- **Every reference to a binding names its owner, and exterior addressing carries a `PRESENCE#` tag** (`isPresenceTaggedPortId`), decidable from the terminal alone without graph context. In `ludicCache` a bare `PRESENCE#` terminal is corruption: a cache edge ending at a binding uses the exterior form `{ owner, port: 'PRESENCE#...' }`, and a `supportedBy` hop carries `host` beside `presenceBucketIds` (the crossing's own host). This is what lets `resolveEndpoint` ([`findRelationalChain.ts`](../actions/enrich/objectManipulation/synthesize/findRelationalChain.ts)) and `isEphemeraLudicCacheData` tell an absent presence binding (legal) from a dangling crossing port (corruption) apart.
- **A catalog handle's `presence` is every bucket the thing is seen in:** each binding in the cache whose cover holds the thing, plus each of the thing's own bindings (a host is the root of its own graph, so it is in each of its own buckets even though `cover` leaves the root out), deduped, in cache order. The seed room is the fallback only when the thing has neither.
- **Not yet built, and not silently owed by any current call site:** real, enumerated bucket-membership computation. Every write-side emitter still mints `cover: { tag: 'Full' }` unconditionally; no caller needs anything narrower today. See [`AGENT.implementation.md`](AGENT.implementation.md)'s `ludicGraph/` section for the standing forwarding note.

---

## Read surface (forward graph vs reverse containers)

- Live graph state **must** be cached and passed as the **stored payload** (`fromFieldPayload` / `toStored()`), **never** through the authored projection (`fromPlayEnvelope` / `toPlayEnvelope`): that type cannot express runtime-minted structure and drops `ports`, `rootId` and Room/Feature/Area nodes on every read and `set`. A caller that wants the authored shape projects into it explicitly. Mental model: [Type boundary](AGENT.concepts.md#type-boundary-storage-vs-gateway-read-envelope).
- Steady-state roster reads (**affordance compose**, perception fan-out, membership snapshots) **must** use **`getRoomCharacterList`** ([`../../internalCache/hydrateRoomRoster.ts`](../../internalCache/hydrateRoomRoster.ts)), not raw `ephemeraDB` `activeCharacters` and not any gateway roster API.
- **`getRoomCharacterList`** **must** derive on each call from **`internalCache.Positions.getLudicGraph(roomId)`** -> **`graph.characterIds`** -> **`hydrateRoomRosterFromCharacterIds`** (`CharacterMeta` + `CharacterSessions`); **must not** read stored **`activeCharacters`** from Dynamo on the steady path. Compose pipeline: [`../../internalCache/AGENT.md`](../../internalCache/AGENT.md#membership-presentation-and-roster).
- After membership apply when **`changed`**, the kernel seeds **`Positions.set`** with every committed **`EphemeraLudicGraph`** ([Membership-changed bundle](#membership-changed-bundle) step 1); coordinators **must not** seed it again. **`roomRosterSnapshots`** on the apply result **must** come from **`getRoomCharacterList`** after that seed; **must not** use transact **`successCallback`** on **`activeCharacters`** for snapshot capture.
- **Roster display** **must** hydrate at read time from **`CharacterMeta`** (`Name` -> `DisplayName`, `Color`, `fileURL`) + **`CharacterSessions`** (`SessionIds`) via [`../../internalCache/hydrateRoomRoster.ts`](../../internalCache/hydrateRoomRoster.ts); membership topology from stored **`ludicGraph`** nodes only.
- **Character forward `getLudicGraph`** **must** read stored **`Meta::Character.ludicGraph`** topology only; empty topology when absent. **Must not** use character forward read for room-membership / reverse reads.
- **Reverse membership reads** (navigate parse endpoint in [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts), membership pre-read in coordinators) **must** use **`internalCache.Positions.getMembershipContainers`** (adjacency index only), not raw `Meta::Character.RoomId` or `CharacterMeta.RoomId`.
- **Reverse object placement reads** **must** use **`internalCache.Positions.getMembershipContainers(objectId)`** (adjacency only); returns host ids of any membership host kind (an object put on a table reads back `OBJECT#`). Empty adjacency means out of play (`[]`). Room-only apply paths **must** filter to **`ROOM#`** hosts when computing room placement diffs.
- **Forward room graph** **must** read stored **`Meta::Room.ludicGraph`** topology only; when graph absent, return empty topology; **must not** merge stored **`activeCharacters`** on gateway forward load for roster display ([sole-authority stance](AGENT.concepts.md#room-play-graph--adjacency-reverse-index)). Forward graph **must** include **`Object`** nodes when present.
- **Forward character inventory graph** **must** read stored **`Meta::Character.ludicGraph`** topology only; v1 nodes are **`Object`** membership only; empty topology when absent.
- **Affordance compose** **must** derive in-room object ids via **`graph.objectIds`** on **`Positions.getLudicGraph`** ([`../../internalCache/affordanceRoomDeliverable.ts`](../../internalCache/affordanceRoomDeliverable.ts)); **`shortName`** from improvisation merge, not room meta.
- **Reverse membership** **must** read adjacency rows only; empty adjacency means out of play (`[]`).
- **Authoritative writer** for play position state remains the membership persistence API; ephemera memo when `changed`: **`Positions.set(EphemeraLudicGraph)`** for every committed graph and **`setMembershipContainers`** for the character or object, both from the kernel. Gateway **`createPositionsCacheHandler`** remains **`PlayLudicGraph`** in/out (wrapper adapts on ephemera only). Gateway module scope: [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md).

### Must not reintroduce (doc-only guard, no CI)

**Must not** reintroduce removed presentation-layer symbols on the positions gateway read envelope or ephemera roster compose path: **`characterRosterMeta`**, **`roomEndpoint`**, **`PlayPositionRoomRosterEntry`**, **`projectRoomGraphFromRosterEntries`**, **`projectRoomRosterFromGraph`**, **`PositionsCacheHandler.getRoomRoster`**, **`PositionsData.getRoomRoster`**. Roster presentation belongs in ephemera **`getRoomCharacterList`** only.

---

## Explicit non-ownership

- **Must not** implement `projectRoomExits`, `ensureAffordanceTopology`, or exit validation (owned by topology + [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts)).
- **Must not** mutate legacy `Meta::Room.objects` (the field does not exist on room meta; objects lane writes improvisation pair + **`Meta::Object`** + graph only --- see [`../objects/`](../objects/)).
- **Must not** write play membership fields outside [`manipulation/membership/`](manipulation/membership/).
- **Must not** publish **`CheckLocation`** (retired).

### Disconnect ingress

- **Must** consume disconnect only via **`mtw.connections.characters`** / **`Character Disconnected`** (not legacy `Disconnect Character` EventBridge or ephemera `disconnectMessage`).
- **`unregistercharacter`** WebSocket ingress is **connections-owned** (`service: connections`); ephemera does not handle it.

---

## Current limitations

- **No world-legality re-check under lock, and a `stale` verdict is not retried.** [`applyStepSequenceCore`](manipulation/kernel/applyStepSequenceCore.ts) performs no world-legality checks --- membership presence, footprint bounds, boundary edges, and carried-host consistency are graph invariants, not affordances like a lock or a fixed-in-place flag. A legality judgment made upstream (at enrich, before a step sequence is built) is not re-checked at commit time: if a concurrent write invalidates it between judgment and commit, it commits anyway. Separately, [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts)'s retry list (`retryErrors: ['TransactionCanceledException']`) only catches DynamoDB-detected write conflicts --- a `stale` verdict (`MutationKernelApplyOutcome`'s `stale` arm) throws a plain `Error`, which is not one, so it propagates straight to `{ ok: false, STEP_SEQUENCE_TRANSACT_FAILED }` today rather than being retried. Neither gap is a verdict-vocabulary problem and neither is fixed by widening a verdict type further --- the fix, whenever taken, is a legality re-check inside the locked reducer plus a decision about who re-plans, which is the same re-propose-edge mechanism named in [`AGENT.concepts.md`'s plan/evaluate loop entry](AGENT.concepts.md#plan-evaluate-loop), aimed at a different trigger (state moved) than that entry's own repairable-plan-defect case.

---

## Consumer expectations

Downstream code **may** assume that after a **successful** membership apply with `changed: true`, `Positions` memo and affordance invalidation reflect the updated roster for all affected rooms in **`froms`** and **`to`**. After a **successful** object membership apply with `changed: true`, downstream **may** assume affordance memo reflects updated **`StandardRoom.objects`** for affected rooms. After a **successful** relational apply with `changed: true`, downstream **may** assume **`Positions`** memo for **`hostId`** reflects updated **`ludicGraph`** topology including stored relational edges (gateway read projection passes through relational edges per [`packages/mtw-gateways/ts/ephemera/positions/project.ts`](../../../../packages/mtw-gateways/ts/ephemera/positions/project.ts)); affordance deliverable invalidation only applies when **`hostId`** is a Room. Downstream **must** remain idempotent under at-least-once ingress (see [`packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md`](../../../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md) consumer guidance).
