# Positions --- contracts

This file records **falsifiable rules** for `mtw.ephemera.positions` **as implemented today**. Mental models: [`AGENT.concepts.md`](AGENT.concepts.md). Code map: [`AGENT.implementation.md`](AGENT.implementation.md).

Play membership persistence uses **`Meta::<Kind>.ludicGraph`** (forward; Room / Character / Object / Feature / Area --- see [Host storage](#host-storage-one-shared-serde-one-documented-exception)) + **adjacency index** (reverse) as sole authority --- see [Room play graph + adjacency reverse index](AGENT.concepts.md#room-play-graph--adjacency-reverse-index). **`Character Moved`** and **`Object Moved`** are **membership host transfer** projections on the bus --- `froms[]` / `to` describe eligible host endpoints, not per-host kernel granularity, and the fact bus shape uses plural **`froms[]`**.

---

## DataSource identity

- **`dataSourceKey`** must be `mtw.ephemera.positions`.
- **`replayable`** is `false` for v1.
- **`publisherStrategy`** is `busOnly` (outbound **`Character Moved`**, **`Object Moved`**, **`Object Relation Changed`** and **`Ludic Cache Invalidated`** on internal bus).
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
- **Shipped kernel:** one general **`commitStepSequence`** (**`KernelStep[]`**) covers membership-node add/remove (applied by the presence steps, entity-kind-general: a node is in a host iff some binding of the mover points there) and in-host relational edge add/remove (`establishRelation`/`dissolveRelation`) --- see [`manipulation/kernel/`](manipulation/kernel/).
- Positions kernel in-memory graph simulation **must** use **`EphemeraLudicGraph`** / **`EphemeraLudicGraph[]`** --- **must not** reintroduce bare **`EphemeraLudicGraphFieldPayload`** simulation or ad-hoc merge helpers outside [`ludicGraph/`](ludicGraph/). Mental model: [`AGENT.concepts.md`](AGENT.concepts.md#type-boundary-storage-vs-gateway-read-envelope); module spec: [`ludicGraph/AGENT.md`](ludicGraph/AGENT.md).
- Actions **may** import **`EphemeraLudicGraph`** read-only for observation/legality; actions **must not** persist graphs or build transact items.

**Today (shipped behavior):**

- On graph vs adjacency conflict, **`ludicGraph` wins** (diagnostics repair from graph).
- Transfer-planning pre-reads (**`getMembershipContainers`**) **must** run on coordinator / adapter side, **not** in kernel persist.

**Apply mode (`executeMembershipTransfer`):**

Diffs against its own fetched `priorContainers` end-state style only --- `froms` = every prior host `!== target` (any host kind). **Object-lifecycle administrative routes only** (object room place / remove, spawn, drift repair, and destroy/edit clear) --- **navigate, connect, disconnect, and home do not route through this function**: the character route's own diff, op-build, and compile happen upstream in [`planCharacterMoveTransfer`](manipulation/membership/planCharacterMoveTransfer.ts), and [`orchestrateCharacterMove`](navigate/orchestrateCharacterMove.ts) commits through `commitAndPresentStepSequence`. Compiles its bare `{ kind: 'move', ... }` op through the same shared `compilePositionKernelOp` every other route uses rather than hand-assembling step literals.

Retiring the standalone `planMembershipTransfer` adapter did not carry forward a **bounded** mode (remove only from trusted-ingress hosts, without end-state-scrubbing the rest) --- it had no caller among the migrated routes. A future caller needing bounded semantics must add them back explicitly.

**`takeHold`** and **`drop`** do not reach `executeMembershipTransfer` at all. They go through [`commitAttempt`](manipulation/commitAttempt.ts) and [`planObjectMoveTransfer`](manipulation/membership/planObjectMoveTransfer.ts) instead: the op is built via `buildObjectMoveOp` (whose `dissolvedEdges` is only the mover's own containment strip, in each host it leaves), and every boundary edge's dissolve is the command attempt's own facilitating action, committed in the same sequence ahead of the transfer. `commitAttempt` dry-runs the whole sequence ([`dryRunStepSequence`](manipulation/kernel/dryRunStepSequence.ts)) and refuses any non-`legal` verdict with its reason code: a player move repairs nothing, so a boundary edge no action covers is refused, not dissolved. Administrative repositions still call `executeMembershipTransfer`, whose own dissolve mechanism is [`repairAdministrativeChainDissolve`](manipulation/membership/repairAdministrativeChainDissolve.ts) --- "may sever anything," unconditional, no dry run, since those routes have no legality question to ask. See [`Ludic Network Change Requested`](#ludic-network-change-requested-positions-owned).

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

**Presentation order is compiled.** A plan's `narrate` and `describe` steps, in array order, are its transcript order: `presentStepSequence` stamps entry *i* at `beatAnchorTime + i` (the commit's anchor; 1 ms apart, so every step in one plan has a distinct time) and mints each its own `MessageId`, then publishes it directly. A command attempt's narration units continue the same sequence after the plan's last entry. A move's arrival header is a `describe` step carrying a `header` binding, placed by the compiler between the leave and arrive narrations; its content-ingress listener publishes at that stamped place whenever the render resolves.

### Binding time: world state early, transport state late

**Early-bind a target iff resolving it reads *world* state; late-bind iff it reads *transport* state.**

- **`ROOM#`** resolves against the room's `ludicGraph` --- world state. It **must** be bound at beat time, inside the kernel walk, to a concrete `EphemeraCharacterId[]`.
- **`CHARACTER#`** and **`SESSION#`** resolve against connected sessions --- transport state. They **must** stay late-bound, resolved at flush by [`publishMessage/index.ts`](../../publishMessage/index.ts).

[`getRoomCharacterList`](../../internalCache/hydrateRoomRoster.ts) is the existence proof the two are separable: it already performs one of each, in that order (`readRoomCharacters(roomId)`, the room's characters row, then `CharacterMeta` + `CharacterSessions` hydration). Early binding hoists the first half to beat time and leaves the second where it is.

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

A move, and every presence step it compiles to, names exactly one entity (`moved` on the op, `objectId` on the executor's `transferMembership` step, the step's own `hostId` --- the mover's graph --- on the kernel's), for objects and characters alike. Anything the entity hosts lives in its own shard and travels with it.

- No step **may** widen a move to further entities, and narration **must not** count carried objects. Carrying is what hosting does, not something a move computes.
- A boundary edge is a relational edge with the mover at one end and something staying behind at the other. Because only one entity moves, no relational edge has both ends moving: there is no interior edge for a move to carry.

### A move's severed edges

The command attempt's Expansion classifies the mover's boundary edges ([`boundaryEdgeOutcomes`](ludicGraph/expandValidate/interactionUnderTransfer.ts)) into facilitating dissolve actions listed ahead of the move, and `commitAttempt` commits them in that order, ahead of the transfer. `op.dissolvedEdges` carries only the mover's own containment edge in each host it leaves, each named with its host, which the compiler renders into a `dissolveRelation` step on that host ahead of the transfer. A boundary edge still present when the transfer applies refuses the move ([`applyDeparture`](ludicGraph/expandValidate/applyDeparture.ts) returns `repairable`); it is never silently severed. **Expansion classifies; the attempt and the compiler sequence.**

### Narration is presented only for a committed mutation

The presentation kernel's narrate branch and the attempt's narration sweep **must** run on [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts)'s **`ok: true`** result and never otherwise. A failed, refused or illegal commit narrates nothing.

This is enforced at the type level --- `captures` exists only on the success branch, and both `presentStepSequence` and `deliverNarrationUnits` throw on an unresolvable `captureId` --- but that guard reads as incidental shape unless stated, and "surface a failed move to the player somehow" is a live product question whose eventual answer must not be allowed to erode it.

**Not a contract clause:** the stamped times are `beatAnchorTime + index` regardless of when presentation runs after the commit; a late `present*` call changes publish time, not transcript position.

### Call sites emit ops; only the compiler names steps

No call site outside [`manipulation/kernel/compile/`](manipulation/kernel/compile/) may construct a `{ kind: 'narrate', ... }` step literal, and none outside it may construct a `{ kind: 'capture', ... }` step literal **except** [`commitAttempt`](manipulation/commitAttempt.ts)'s audience resolution, which turns an attempt's declared audiences into captures (next section). The intent of both halves is the same: no ad-hoc audience construction. Call sites supply an op and its narration **ingredients** (`characterName`, copy-kind selectors, `exitName`); the compiler decides shape, ordering, capture ids, and slots, and [`presentStepSequence`](manipulation/kernel/presentStepSequence.ts) assembles the message string at flush.

Builders: [`manipulation/membership/buildCharacterMoveOp.ts`](manipulation/membership/buildCharacterMoveOp.ts) (character routes) and [`manipulation/membership/buildObjectMoveOp.ts`](manipulation/membership/buildObjectMoveOp.ts) (object routes) --- **siblings, not one widened module**. They share no copy-selection logic, and `NarrationSpecification` is a union on narration *family* for the same reason.

### An attempt narrates through its narration units

A command attempt carries its own lines as narration units (vocabulary: [`../actions/AGENT.concepts.md` --- `CommandAttempt`](../actions/AGENT.concepts.md#commandattempt)). Positions compiles no narrate step for an attempt; [`commitAttempt`](manipulation/commitAttempt.ts) resolves each unit's audiences before the commit and [`deliverNarrationUnits`](manipulation/deliverNarrationUnits.ts) delivers them after it. A navigate's header, unlike an attempt's lines, resolves in another component (the render pipeline), so it is delivered through an ingress listener that owns its stamped time and `MessageId`; its placeholder and terminal waves are revisions of one message.

- **Delivered only on `ok: true`**, per the clause above. A refused attempt delivers no unit at all.
- **Delivery order is unit order, walked in the attempt's own action order.** Each unit's lines are stamped `beatAnchorTime + index` in that order, continuing after the plan's own presentation steps. So a facilitating dissolve's line is delivered before the move's, since Expansion lists the dissolve first; each severed relation narrates its own line ("George takes the glass off the tray." / "George picks up the tray.").
- **An audience is declared by referent, `(refs, phase)`, and resolved to rooms by `commitAttempt` before the dry run.** A ref resolves through the referent's stamped `groundedPresence`, walked up presence bindings to every room it reaches; `'actor'` resolves from the actor's live host; a moved entity's *after* resolves from the move's destination. One `capture` step per resolved room is spliced ahead of the unit's first covered action (*before*) or behind its last (*after*), inside the sequence that is dry-run and committed, so captures are in the footprint.
- **Capture ids are minted unique**, never a fixed string: two moves in one attempt must not share a capture. An audience's roster is the **deduplicated union** of its captures' rosters. An unresolvable capture id **must throw**, with no live-roster fallback.
- **Overlapping audiences each deliver.** A character reached by two of a unit's audiences gets each line; an author who wants one line to the union declares one audience over several refs.
- **A referent's audience is every room it is seen in**, including a non-present host bound into several rooms. Perspective narrowed *which* thing a phrase meant, not who can see it change.
- **No per-unit validity check runs.** All-or-nothing commit, plus refusing an action whose result already holds, means every covered action happened.
- **A narration unit never spans attempts.**

**Known gap (accepted):** audience resolution reads ancestor graphs outside the commit footprint, so a container moved between resolution and commit gives a stale audience. Same class as the "no world-legality re-check under lock" entry in [Current limitations](#current-limitations); locking the ancestor chain was judged not worth it.

---

## Membership persistence API

All character **room-membership** mutations for **disconnect**, **navigate**, **connect**, **home** and the two repair sweeps **must** go through [`orchestrateCharacterMove`](navigate/orchestrateCharacterMove.ts).

**A character's membership host is a `ROOM`, and only a `ROOM`.** Objects are unrestricted and may be hosted by rooms, characters, objects, features and areas as the host union already allows; characters **must not** be transferred into any non-Room host's `ludicGraph`. **This is a scoping decision, not a claim that characters are ontologically unlike objects, and must not be cited as one** --- it exists to keep the character path single-hosted while the general graph work matures, and it lifts when that work does.

**The restriction has two halves, and only one of them is enforced.** Its **cardinality** consequence --- a character carries exactly one presence binding, since a room is a pinch point: however the room is grouped into areas, a character in it sits under the room's one binding, and nothing about the grouping multiplies it --- **is** enforced, by an end-of-sequence validator in [`applyStepSequenceCore`](manipulation/kernel/applyStepSequenceCore.ts) that throws when a character's graph would carry more than one presence node. That check is a **ratchet on new writes, not a repair**: a character already carrying a duplicate binding before the sequence ran is untouched. It is deliberately character-only --- objects are multi-present by design.

**The *host-kind* half is unenforced, and that failure is silent.** An Object is a legal `EphemeraMembershipHostId` and [the kernel's presence steps](manipulation/kernel/kernelStep.ts) already admit a character as a mover, so an object-hosted character would persist successfully, then read as having zero **Room** containers, fall through to the `RoomStack`, and present as **out of play**. **Note that the cardinality validator does not catch this** --- an object-hosted character carrying exactly one presence binding satisfies it. What holds the host-kind restriction today is independent read-side narrowings ([`resolveCharacterRoomId`](manipulation/membership/resolveCharacterRoomId.ts) and [`syncMembershipAdjacency`](manipulation/membership/syncMembershipAdjacency.ts) filtering containers with `isEphemeraRoomId`, plus the Room-only apply filters under [Read surface](#read-surface-forward-graph-vs-reverse-containers)) --- none of which refuse the write. Treat this bullet as the statement of intent that those filters implement; **do not** infer from the absence of a guard that the restriction is optional.

### Public apply shape

- **Args:** `{ characterId, targetRoomId: EphemeraRoomId | null }` decide the persist --- `null` = out of play (disconnect). The remaining fields of `OrchestrateCharacterMoveArgs` ([`navigate/orchestrateCharacterMove.ts`](navigate/orchestrateCharacterMove.ts)) are narration ingredients only (`intentKind`, `intentFromRoomId`, `exitName`) plus the pre-fetched `characterMeta` and the bus handles: the ingredients select copy and never change the end state. **Must not** consume stream / intent `fromRoomId` for persist --- `intentFromRoomId` picks exit-aware copy among `froms`, nothing more.
- **Result:** `{ froms, to, changed }` where `changed` is true iff prior container set differs from end state (`{ targetRoomId }` or `{}` when out of play). **`froms`** is required (same semantics as **`MembershipDiff<EphemeraRoomId>`** / bus fact --- every other `MembershipDiff` reference in this section means this Room-typed instantiation; `manipulation/membership/types.ts` also has a bare, host-general `MembershipDiff` used by the kernel-step fact-emission tier, which this route does not touch).
- **Presentation:** there is no separate present-tier function. [`orchestrateCharacterMove`](navigate/orchestrateCharacterMove.ts) hands the compiled plan to [`commitAndPresentStepSequence`](manipulation/kernel/commitAndPresentStepSequence.ts), which commits and then presents it through `presentStepSequence`, stamped from the commit's `beatAnchorTime` (see [Narration and presentation](#narration-and-presentation)). Does **not** publish **`MapUpdate`** (server map runtime retired; see [`../maps/AGENT.md`](../maps/AGENT.md)).
- **Leave/arrive world lines --- every character route:** navigate, home, connect, disconnect, and the ghost-purge sweep all narrate through the compiler. **[`planCharacterMoveTransfer`](manipulation/membership/planCharacterMoveTransfer.ts) builds the op via [`buildCharacterMoveOp`](manipulation/membership/buildCharacterMoveOp.ts) and compiles it via [`compilePositionKernelOp`](manipulation/kernel/compile/compilePositionKernelOp.ts) exactly once, before commit**. The arrival header resolves pre-commit too, since it depends only on `to` and the character's assets, both known before commit, and compiles as a header-bound `describe` step in its ordered place. The audience of each narration step is the mid-walk **captured** roster, and therefore already includes the mover by construction on the leave side. A header whose perspective key is `null` (the character's assets match no stack for the room) publishes the static cache header at its stamped place instead of registering a render listener. Disconnect and ghost-purge pass `to: null`, so no header is ever compiled for them. There is **no** async membership fan-in; `Character Moved` streams as a fact, and its subscribers in `mtw.ephemera.characters` do the post-commit work (see [Membership-changed bundle](#membership-changed-bundle)).
- **One entry point, gated on `to`:** navigate/home/connect/disconnect (and `repairRoomOccupancyDrift`'s ghost purge, and `repairCharacterLegalPlacement`'s relocation call) all go through `orchestrateCharacterMove`, which is the licensed composer: the no-op pre-check and plan build are its own work, and commit and presentation are `commitAndPresentStepSequence`'s.
- **Graph persist path:** `orchestrateCharacterMove` -> [`planCharacterMoveTransfer`](manipulation/membership/planCharacterMoveTransfer.ts) (diff against its own `priorContainers`, builds `buildCharacterMoveOp` and compiles it once, before commit) -> [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts) inside the composer (`MultiKeyUpdate`), committing the compiled plan's mutation-kind steps --- the character's presence move (which applies membership), plus capture steps bracketing it. **Does not route through `executeMembershipTransfer`**, which serves only the object-lifecycle administrative routes (spawn/place/destroy/edit/drift-repair). No `dissolveRelation` steps accompany the character path: a character can never be a relational-edge endpoint, `HostRelationalEdge` being object-only --- `commitStepSequence`'s `getCurrentHost` dep (which only resolves a `dissolveRelation` step's referenced hosts) is therefore a function that is never actually called for this route. `Character Moved` fact emission is folded into `commitStepSequence` / [`factsForStep`](manipulation/kernel/factsForStep.ts) rather than layered on top. Detail: [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md).

### Graph apply (end-state)

- **Must** use pure end-state apply on **`targetRoomId`** only.
- **Must** derive **`MembershipDiff.froms`** from observed prior containers removed (may be **`length > 1`** on drift repair).
- **Must** maintain **`ludicGraph`** + adjacency in the same **`transactWrite`** bundle; **must not** write legacy **`activeCharacters`** / **`RoomId`** membership projections. Mental model: [Room play graph + adjacency reverse index](AGENT.concepts.md#room-play-graph--adjacency-reverse-index).
- On conflict between graph and adjacency, **`ludicGraph` wins** (diagnostics repair from graph).
- **Adjacency row existence is an existential invariant, not a lifecycle event:** a row `(EphemeraId: X, DataCategory: POSITION#<hostId>)` exists **iff** X is a node in `<hostId>`'s `ludicGraph`. It is not a refcount over edges --- edges of every kind (hosting, peer) are orthogonal to this index, which is why the kernel **must not** write adjacency rows for relational edges (see [Edge persist shape](#edge-persist-shape) below). **Forward note:** when hosting-as-shard lands, dissolving a hosting edge (`On`/`In`/`PartOf`) becomes a membership change and **must** be routed through the presence steps (membership follows the mover's bindings), so adjacency keeps following node presence --- not by teaching adjacency to inspect edges.

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
4. `RoomUpdate` per Room host in the sequence's footprint **and** per Room in the net membership change (`membershipChangesOf`'s `left`/`arrived`), published *after* the fact stream. A bystander move (`isBystanderMove`, [`kernel/bystander.ts`](manipulation/kernel/bystander.ts): a character mover at a Room host) leaves the Room out of the footprint, so a character-only commit writes no room graph, bumps no marker and publishes no `Ludic Cache Invalidated`; `RoomUpdate` is what refreshes the room. The room memos (`AffordanceRoomDeliverable`, `ComponentEphemeraMeta`) are invalidated for the same set of rooms ([`kernel/invalidateRoomMemos.ts`](manipulation/kernel/invalidateRoomMemos.ts)).
5. `beatAnchorTime` recorded at commit and returned on the kernel result.

The marker bump and the **`Ludic Cache Invalidated`** fact belong to this bundle too: the bump rides the commit's own transaction, and the fact is streamed after the step facts and before `RoomUpdate`. See [Ludic cache staleness and rebuild](#ludic-cache-staleness-and-rebuild).

A character move adds nothing after the kernel returns. What used to be character-specific post-commit work now runs as **`Character Moved`** subscribers in [`mtw.ephemera.characters`](../characters/AGENT.md): the eviction-ladder write followed by `CharacterMeta.invalidate` (a move changes only `ludicGraph`, which `CharacterMeta` does not project, so the cache is not stale before the ladder write lands), and the `EphemeraUpdate` `CharacterInPlay` room projection.

When **`changed`** is false: `orchestrateCharacterMove` **must** return before calling the kernel at all --- no persist, no fact stream, no cache, no `RoomUpdate`, no `EphemeraUpdate`. This includes eviction-ladder-only updates where the room membership endpoint is unchanged.

**Post-move presentation split:** step 4 **`RoomUpdate`** (roster refresh for all occupants in **`froms`** / **`to`**, reason `roster`) is **separate** from the mover-only arrival header render (a content-ingress listener registered by the plan's header `describe` step --- see [`../messageOrchestration/AGENT.md`](../messageOrchestration/AGENT.md)). Positions **must not** conflate affordance refresh with header render on the membership API. Room affordance refresh consumer: **`mtw.ephemera.affordanceOrchestration`** ([`../affordanceOrchestration/index.ts`](../affordanceOrchestration/index.ts)), on **`RoomUpdate`** for a roster change and on **`Ludic Cache Invalidated`** for an object or structure change (not `Object Moved`; see [Ludic cache staleness and rebuild](#ludic-cache-staleness-and-rebuild)). A roster change never rides `Ludic Cache Invalidated`: a bystander move changes no cache row.

### Ludic cache staleness and rebuild

Each room's [`ludicCache`](AGENT.ludicNetwork.md) is stored as a derived, droppable row triple and rebuilt whole when it is out of date. Mechanism and file map: [`AGENT.implementation.md`](AGENT.implementation.md#stored-row-read-mark-rebuild).

- **Rows per room, all keyed `EphemeraId: <roomId>`:** `DataCategory: 'LudicCache::'` (the cache, labelled `builtAtVersion`), `DataCategory: 'LudicCacheVersion::'` (the marker, holding `version`) and `DataCategory: 'LudicCache::Characters'` (the characters row, below). A second tenant would take a suffix after the `::`. They are read together by exact key, consistently; the characters row is an opt-in third key (the header asks for it, the command path does not).
- **A hit is `builtAtVersion` equal to the marker's `version`, and a hit is trusted:** zero candidates from a hit is a real "no". **An absent, stale or malformed row is rebuilt and written before it is read** --- a miss is never an answer of "no". A row failing `isEphemeraLudicCacheData` is malformed, never thrown.
- **Every writer of a `Meta::<Kind>.ludicGraph` row, and every source of a stored node's name, must mark the rooms whose cache it can change**, or a stored positive goes stale without a refresh. Kernel commits bump the marker (`ADD version :one`) **inside the commit's own transaction**, via the `MultiKeyUpdate` cascade, so graph change and mark commit together or not at all; the rooms are resolved before the transact from the hosts the sequence writes. Writers outside the kernel mark right after their own write: the two diagnostics heals, the Coyote clear, a `Component Updated` for a non-character component, and a zone change into or out of Canon. **A commit that touches only a character's inventory, or only a character's movement, marks no room.** A character rename marks nothing either (the cache holds no character name): `onCharacterComponentUpdated` ([`../dataSource/characterComponentUpdated.ts`](../characterComponentUpdated.ts)) invalidates `CharacterMeta` and the room memos, then publishes `RoomUpdate` for each room the character stands in. A new graph writer or name source **must** be added to the invalidation-completeness test's case list.
- **`LudicCache::Characters` is the authority for a room's character membership.** It maps each present character's id to its binding ids into the room, and holds no name, colour or session (those stay on `CharacterMeta` and `CharacterSessions`). The kernel's `cascade` writes it from a sequence's net membership change (`SET #id` or `REMOVE #id`, one item per room, unconditioned: the mover's own graph serializes its moves), and the Coyote clear deletes it with the room graph. There is no `complete` flag and no rebuild: an absent row is an empty room and the first arrival creates it. It is an index, not the truth about the character: the character's own binding pointer governs, so drift is healed from the pointer by the occupancy drift sweep (and `migrateRoomBystanders`, for legacy room graphs that still name characters).
- **After a kernel commit, `Ludic Cache Invalidated { roomIds }` is published** (after the step facts, before `RoomUpdate`; writers outside the kernel publish it after their mark). **Consumers that act on a cache change subscribe to it, not to `Object Moved`**, so a relational change or a rename refreshes an occupied room too. **Shipped subscriber:** `mtw.ephemera.affordanceOrchestration` fans out a room affordance refresh (reason `objects`) for each invalidated room that has occupants. That makes the room header the cache's second cold-rebuild consumer: it reads the stored row, so the first read after an invalidation rebuilds once per invalidated, occupied room (the stored structure is shared; display labels resolve per occupant perspective at read). This consumer is an async push, not on any command's response path.
- **A rebuild reads the marker first, then every shard graph fresh and strongly consistent** (bypassing the per-invocation memo for graphs not read after the marker), and labels the row with the marker version it read. **The write is monotonic** (`attribute_not_exists(builtAtVersion) OR builtAtVersion < :n`) and **never conditioned on the marker row**, which would contend with kernel commits. **Concurrent rebuilds of one (room, version) coalesce; any caller whose result is not labelled with the version it read starts again from the read, a bounded number of times.**
- **Stored names are Canon + Improvisation, never a viewer's.** The stored row is perspective-free: one row per room. **The room affordance header takes structure from the stored row and resolves each display label from the viewer's perspective at read, with no fallback to the stored name** (reasoning names and display names do not cross over). The command referent pool uses the stored names.
- **A bystander is not in its room's graph or cache.** A bystander is a present character other than the seed that is not a participant (entangled with the room by a boundary edge; none can exist today, so every character is one). The room's graph holds no node for it, the room's Base lists no entry for it (the room's Base covers its explicit entries plus every character in the characters row, read beside the cache, so the coverage is the row), and the walk never fetches its shard, so held inventory never enters a room's cache. The characters row indexes it. A character-seeded walk still expands its own seed. A future participant returns to the room graph, and its arrival rightly marks the room ([`AGENT.implementation.md`](AGENT.implementation.md#shelved-participant-characters)).
- **Cache edges are plain leg-shaped relational edges, and the cache holds no maintenance state.** Nothing is stored per edge or node to support incremental repair; an incremental design would build its structure beside the cache (shelved in [`AGENT.implementation.md`](AGENT.implementation.md#shelved-incremental-ludiccache-maintenance)).
- **A `ConnectedTo` edge is legal only inside its whole's own graph, between the whole's parts and bindings.** An endpoint must be the whole itself, a port address the whole owns (a binding, legal whether or not the whole also has named parts), or a node with a `PartOf` edge to the whole. `applyStepSequenceCore` throws on an `establishRelation` of the kind that breaks this (a structural-invariant violation, like a wrong carried host, not a verdict), in dry run and commit alike; a vanished endpoint is still `stale`, and a `dissolveRelation` is never checked, so a stray edge can always be cleared. Siblings held by a host (two objects `In` one room) are separate wholes: a join between them is a `Custom` relation, and the same pair as `ConnectedTo` throws ([`connectedToLegality.ts`](manipulation/kernel/connectedToLegality.ts)).
- **A `ConnectedTo` edge between a whole's own bindings is carried by every cache that folds the whole's shard.** The fold takes all of a host's bindings (zero or all), so both endpoints are on the whole's cache node and the edge is a plain cache edge between two owner-qualified binding terminals; it needs no stub and no absent-binding allowance. A rope across two rooms reads as the same edge and the same two bindings from either room's cache, and a write to the rope's graph marks both rooms stale ([`connectedToCache.test.ts`](ludicCache/connectedToCache.test.ts)).
- **Seeds other than a room** keep a per-request cold rebuild, unpersisted.

### Eviction ladder (`RoomStack` storage)

Mental model: [**Eviction ladder**](../characters/AGENT.md#eviction-ladder). Code map: [`AGENT.implementation.md` --- Eviction ladder](AGENT.implementation.md#eviction-ladder-roomstack-storage). Ladder maintenance (write-side rules: navigate merge, trim persist, failure tolerance) is owned by **`mtw.ephemera.characters`** --- see [`characters/AGENT.md`](../characters/AGENT.md#ladder-maintenance). This section states only positions' read/routing side.

- **Must not** expose eviction ladder edits on **`OrchestrateCharacterMoveArgs`** --- its persist-deciding fields remain `{ characterId, targetRoomId | null }` (see [Public apply shape](#public-apply-shape)). Ladder shape is internal to persist / resolution helpers.
- **Legal placement resolution:** trim `RoomStack` to accessible assets; surviving top frame is the proposed `targetRoomId`. **Connect** --- place from nowhere (`froms: []`). **Asset visibility loss** --- relocate when the character's **current room's own asset** is no longer accessible (CH-1); the trimmed ladder's top frame is used only to choose the destination, never to decide whether to relocate --- the ladder is maintained by an async subscriber ([`mtw.ephemera.characters`](../characters/AGENT.md)) and can legitimately lag current membership by a beat.
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

All improvisational **object room-placement** mutations **must** go through [`executeMembershipTransfer`](manipulation/membership/executeMembershipTransfer.ts), except an Object's first placement at creation, which goes through [`executeComponentCreation`](manipulation/membership/executeComponentCreation.ts), and an improvised Object's end, which goes through [`executeComponentDestruction`](manipulation/membership/executeComponentDestruction.ts) (both below).

- **Args:** `{ entityId: objectId, target: EphemeraRoomId | null }` --- `null` = removed from all hosts.
- **Graph persist path:** caller -> `executeMembershipTransfer` (diffs against its own fetched `priorContainers`, end-state) -> [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts) (`MultiKeyUpdate`). Every relational chain touching the object **must** be swept explicitly first (`findRelationalChainsTouching`, following crossing ports across hosts, not just the departure host's own plain edges) and dissolved via explicit `dissolveRelation`/`removeCrossingPort` steps ahead of the transfer step, rather than silently stripped --- `removeObject` throws on a residual relational edge by design. Detail: [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md).
- **Must** persist **`ludicGraph`** + adjacency in the same transact; on conflict **`ludicGraph` wins** (mirrors the character-route rule above).
- **Spawn is one kernel commit (objects-lane coordinator):** improvisational **existence** rows (pair, optional `EMBEDDING#IMPROMPTU`) are objects-lane owned, but the **`Meta::Object`** row is the kernel's: [`spawnOneImprovisationObject`](../objects/spawnImprovisationObjectsBatch.ts) **must** call [`executeComponentCreation`](manipulation/membership/executeComponentCreation.ts), which commits a `createComponent` step (the row, born holding its hostless `PRESENCE#Base`) and the first-placement move (re-pointing that Base at the room) in **one** `commitStepSequence` transaction, with the objects lane's rows riding the same call as opaque `existenceItems`. The objects lane's caches are seeded in `afterPersist`, after the write and before any fact streams. **S1:** a failed placement writes nothing, so there is no compensation and no double-fail path. An improvised spawn means *this item, placed in this room*: the order fails as a whole. **No database-level existence guard:** `createComponent` refuses a host already in the sequence's footprint, but its row is an unconditioned `Put` (a `Put` in a transaction carries no condition here, and DynamoDB forbids a separate `ConditionCheck` on the same item), so a fresh `OBJECT#` uuid is what keeps it from overwriting a row.
- **Destroy is one kernel commit (objects-lane coordinator):** an improvised Object's `remove`, orphan repair and the Coyote clear **must** each call [`destroyImprovisedObject`](../objects/persistImprovisationObject.ts), which calls [`executeComponentDestruction`](manipulation/membership/executeComponentDestruction.ts): the chain sweep, the move to nowhere (none for an orphan, which has no containers) and a `destroyComponent` step in **one** `commitStepSequence` transaction, with the objects lane's pair and `EMBEDDING#IMPROMPTU` deletes riding as opaque `existenceItems`. The kernel deletes the `Meta::Object` row (`MultiKeyUpdate` deleting a fetched key, conditioned on the graph it read), so no `Meta::Object` write or delete for an improvised Object happens outside the kernel. **`destroyComponent` throws unless the host's graph holds only its own root and its own presence bindings:** contents **must** leave first, earlier in the same sequence or in an earlier commit, so a wrong order fails loudly instead of stranding a nested Object. The Coyote clear is one commit **per Object** in contents-first order, not one overall (a transaction is capped at 100 items). The objects lane's caches are invalidated in `afterPersist`; the render-cache cleanup stays a best-effort dispatch after the commit. v1 destroys improvised Objects only.
- **Orphan sweep (existence-without-placement):** no designed path leaves an orphan any more (spawn and remove are each one commit), so the sweep is the **defect backstop**: a bug, a manual data edit, a writer outside the kernel, or a host deleted with its contents still on it would each leave rows with no placement. [`orphanedImprovisedObjectSweep`](../../../diagnostics/orphanedImprovisedObjectSweep/) runs by direct invoke (full scan); when litmus confirms an orphan, it **must** emit **`Orphaned Improvised Object Finding`** on **`mtw.diagnostics`** (sweep contract: [`lambda/diagnostics/AGENT.md`](../../../diagnostics/AGENT.md) **Orphaned improvised object sweep**). Objects lane **must** subscribe to the finding and call **`destroyImprovisedObject`** (delete-only repair; see [`objects/AGENT.md`](../objects/AGENT.md) **Diagnostics repair**). **Forward gate:** the sweep's litmus (rows present, no `Object` node on any host graph, no containers) also matches a component created unplaced on purpose (`executeComponentCreation` with `target: null`), and the repair would destroy it. The litmus **must** change before the first `target: null` caller ships.
- **Orphan vs adjacency lag (existence-without-placement):**
  - **Orphan:** `(OBJECT#, ASSET#IMPROVISATION)` pair **and** `Meta::Object` present, no **`Object`** node on any host `ludicGraph`, and `getMembershipContainers(objectId)` empty --- diagnostics **`Orphaned Improvised Object Finding`** (not [`repairObjectPlacementDrift`](manipulation/membership/repairObjectPlacementDrift.ts)).
  - **Adjacency lag:** **`Object`** node present on a host graph but containers empty or missing that host --- [`repairObjectPlacementDrift`](manipulation/membership/repairObjectPlacementDrift.ts) owns sync; orphan sweep **must not** emit a finding.
- **Cross-lane sequencing:** spawn is one transaction (rows and graph together); remove sequences graph then row delete (graph-then-rows), two steps.

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

**One execution path covers both directions.** [`planObjectMoveTransfer`](manipulation/membership/planObjectMoveTransfer.ts) takes a concrete **host pair** (`fromHostId`, `toHostId`), plus `moverBinding`, which names the one binding of the mover that moves (a view-move; see the binding-id bullet under *Presence bindings*), and `alsoLeaving` for a take of a thing in several hosts, which leaves them all (deliberately crude, a shim until a take can say which part: it does not ask whether the thing was spread or drifted; see the shelved take rule in [`AGENT.implementation.md`](AGENT.implementation.md)) --- and takes **no acting character and no verb**. By plan time every host is already concrete, so there is nothing left for Grounding to resolve: `buildObjectMoveOp` derives `dissolvedEdges` from each departure host's own graph (only the mover's own containment edge into that host's root --- boundary edges are the attempt's own dissolve actions; see the `attempt` paragraph under the `mtw.ephemera.actions` ingress). `commitAttempt` dry-runs the whole attempt's sequence ([`dryRunStepSequence`](manipulation/kernel/dryRunStepSequence.ts)) rather than re-running the general Synthesize executor, refuses any non-`legal` verdict with its reason code, and commits the mutation steps via [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts) --- one atomic `MultiKeyUpdate` over every host the sequence touches.

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

**`HostRelationalEdgeKind`** is the hosting kinds (`HostingRelationKind`: `On`, `In`, `PartOf`) plus one peer kind, `Custom`, plus the topology kind `ConnectedTo`:

| Kind | Player language (examples) | Persist |
| --- | --- | --- |
| **`On`** / **`In`** | on, onto, in, inside | Containment: the mover's own edge to its new host's root, written by a `transferMembership` with a `containment` flag (below). **Must not** persist as a peer edge between siblings |
| **`PartOf`** | none (no deterministic authoring) | Containment edge, same shape |
| **`Custom`** | under, against, tied to, wrapped around, long-tail phrases | **`kind: 'Custom'`** + **`relationLabel`** (see below) |
| **`ConnectedTo`** | none yet (no producer) | **`kind: 'ConnectedTo'`**, no label. Topology within one whole: how its parts or bindings join |

**`ConnectedTo` rules (the kind and its legality check; no player-reachable producer yet):** it is **not** a hosting kind (not in `HOSTING_RELATION_KINDS`) and never decides shard placement. It is **symmetric**: `A -ConnectedTo- B` and `B -ConnectedTo- A` are one edge, compared order-insensitively (`ephemeraEdgeEndpointsEqual`; `collapsedEdgeIdentityKey`, `stubPortIdFromEdge` and `isFactOfRelationalEdge` agree), and every other kind stays directional. A move that severs one defers to the adjudicator (`classifyInteractionUnderTransfer`), as a `Custom` edge does. In WML it sits in the Topology class (`LUDIC_EDGE_TOPOLOGY_KINDS`).

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
| `Component Removed` | [`dataSource/index.ts`](../index.ts) `processComponentRemoved` -> [`manipulation/containment/removeAuthoredObject.ts`](manipulation/containment/removeAuthoredObject.ts) |

### `Component Updated` (containment population, cache-time)

- **Ingress:** every asset-cache write, not a player-command route --- `dataSource/index.ts`'s `processComponentUpdated` fires on **every** `Component Updated` event, whatever component kind changed. `cacheAsset` emits that event only for components in its diff, so a re-cache of unchanged content does not reach this handler. **The event carries a per-asset diff, not the resolved component:** each `ludicGraph.nodes` entry is a delta, with added nodes at `ref > 0` and removed nodes inverted to `ref < 0`, and nothing resolves imports. The ingress therefore populates only `ref > 0` nodes (`addedNodesOf`), so a removal diff populates nothing. The no-diff rerun path is the `Fixed Containment Drift Finding` (`mtw.diagnostics`, from `FixedContainmentDriftSweep`): [`healContainmentPopulation`](manipulation/containment/healContainmentPopulation.ts) reruns this same population for one parent's authored children (`authoredChildrenOf`: the union of added nodes across the `ComponentData` pairs of the assets in `Meta::<Tag>.cached`, the same list the sweep judges against, so a child never populated is reached). That is Rooms and Features only, the nestings that never move: an authored Object is outside the fixed sweep because its placement is meant to change (the authored one is only its initial state), it is never healed, and the live-host rule below would skip it anyway.
- **Trigger, duck-typed on shape, not switched on `component.tag`:** any membership-host component whose `.ludicGraph.nodes` is non-empty (every Standard component kind with a membership host id serializes a `ludicGraph` --- Room, Area, Feature, Object, Character). This is deliberate: a host kind gaining authored nesting starts populating with no change to the trigger.
- **Must** treat this as additive-only: for each child named in the updated component's `ludicGraph.nodes`, add the child as a node of the parent's graph, give the child a presence binding whose `fromHostPresences` name the parent host and, when the parent has one, which of its bindings (its `PRESENCE#Base`; see the root rule below), and establish an edge (`subjectId` the child, `targetId`/`hostId` the parent).
- **The edge kind follows the child's kind:** `PartOf` for a Room or Feature (fixed nesting: Room-in-Area, Feature-in-Room), `In` for an Object. `In` is the mobile placement kind, and authored WML has no surface for stating a membership kind, so an authored Object takes what an unstated hosting relation means. Every authored child arrives kind-less in `ludicGraph.nodes`.
- **Must** place an authored Object only when it has **no live host anywhere**, meaning its own graph holds no presence binding with a parent pointer (`parentOf`, the same read as [`parentBindingsOf`](ludicGraph/presenceParent.ts)). Population reruns for every child a parent lists, whatever triggered it, so this one test is what keeps a re-cache from moving a live Object:
  - a new Object has no live host and is placed;
  - an Object a player moved out is skipped when an authored edit or a drift heal reruns its former parent;
  - an Object the author moved to another parent is skipped there while it is still live in the first. **Author repositioning has no live effect, deferred deliberately:** telling "still where it was authored" from "moved since" needs provenance.

  The same rule covers an authored Object under a Character (an authored carried item), with no character-specific branch. A live binding of the wrong shape is skipped, not repaired.
- **Must not** handle removal-on-deauthoring for Rooms and Features: a child that later drops out of `ludicGraph.nodes` keeps its node membership, port, edge, **and its `EphemeraPositionAdjacencyRow` under the former parent** (the population path's binding steps only ever arrive at the parent, so it only ever `Put`s adjacency, never `Delete`s). Provenance and removal are out of scope for Rooms and Features, deferred deliberately rather than overlooked: they never move, so a stale membership costs nothing. Objects do move, and their removal is the [`Component Removed`](#component-removed-authored-object-removal-cache-time) rule below. Note that the departure signal *does* reach this handler --- `cacheAsset` is diff-driven, so the former parent is itself a changed component and its `Component Updated` carries a node list the child has dropped out of; what is deferred is acting on that absence, not learning of it.
- **Nested Objects under a de-authored container: known gap, deferred to the next iteration (the user, 2026-10-11).** `cacheAsset` emits `Component Updated` for a removed component too, so a removed Object that itself lists nested Objects runs population with itself as parent. If removal has already run, its authored children are placed `In` an Object with no live host. Removal itself is unaffected. The obvious guard (skip an Object parent with no live host) is wrong, because it would also stop a newly authored Object's nested children from being placed, and the event does not say it is a removal. A fix needs a way to tell removal from update.
- **Idempotency is caller-side, not reducer-side:** an `addPresenceBinding` step is not safe to replay unconditionally (it would mint a second presence node). Adding a node the parent already holds is harmless (membership arrival is idempotent), but the minting is not. [`containmentPopulationSteps.ts`](manipulation/containment/containmentPopulationSteps.ts) checks current state (already-fetched graphs) before emitting each of its checks independently --- a binding that is correct but whose node the parent lacks is rewritten in place, which adds the node --- so a fully-populated rerun emits nothing and commits no transaction.
- **Must** commit every child named in one parent's update as one `commitStepSequence` call (one `MultiKeyUpdate`), not one call per child --- a separate commit per child would open a window where some children of the same cache pass are populated and others are not.

### `Component Removed` (authored Object removal, cache-time)

- **Ingress:** `cacheAsset` emits `Component Removed` only when a component leaves the file **and** nothing references it. If a parent still lists the Object, `cacheAsset` writes a reference-only stub row and emits no event, so the Object stays live. `dataSource/index.ts`'s `processComponentRemoved` handles it.
- **Must** act on Object ids only. Rooms and Features keep the removal deferral in the `Component Updated` section.
- **Must** move the removed Object's contents to its host before removing it, like emptying a box before throwing it away. Deleting them with it would destroy player-placed things because of an author's edit. Each content goes to the parent host of the Object binding its own binding points at, so a multi-host Object empties each binding into its own host. A pointer naming no binding of the Object (a stale one) falls back to the Object's first host.
- **Must** then remove the Object from every live host, wherever that is (a room, a character's hands, another Object).
- **Both halves go through [`executeMembershipTransfer`](manipulation/membership/executeMembershipTransfer.ts),** the existing object-lifecycle route (`target: null` is destroy). Edge dissolution (chain-aware, via `repairAdministrativeChainDissolve`) and the binding clear are therefore the ones every other destroy uses: no new kernel step, and no third binding emitter. The Object's own graph row is left in place holding its hostless Base, as in every other destroy (a departure to no host keeps the last binding and drops its parent pointer).
- **Contents and the Object commit separately, contents first, so a redelivered event is safe:**
  - a failed content move stops the removal and leaves the Object live;
  - a rerun finds the already-moved contents gone and finishes the job;
  - an Object with no live host is a no-op.

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
- **Must** call `orchestrateCharacterMove({ characterId, targetRoomId: content.toRoomId, intentKind: 'home' })`, which commits and presents when `changed`.
- **Must not** rely on imperative `MoveCharacter` bus messages from actions for home (retired).
- Leave/arrive world copy for home is **compiled** (`intentKind: 'home'` on [`buildCharacterMoveOp`](manipulation/membership/buildCharacterMoveOp.ts)) and reported by [`presentStepSequence`](manipulation/kernel/presentStepSequence.ts) inside the navigate orchestration tail --- see [Narration and presentation](#narration-and-presentation). `intentKind`'s full vocabulary (`'navigate' | 'home' | 'connect' | 'disconnect'`) is declared once as `IntentKind` in [`manipulation/membership/types.ts`](manipulation/membership/types.ts); [`orchestrateCharacterMove.ts`](navigate/orchestrateCharacterMove.ts) and `planCharacterMoveTransfer.ts` both take it directly; a narrower call site derives its subset from `IntentKind` rather than re-declaring literals.

### `Character Connected` (positions-owned)

- **Must** resolve `targetRoomId` via [`resolveConnectTargetRoom`](manipulation/membership/resolveConnectTargetRoom.ts) --- legal placement from nowhere: trim ladder to accessible assets, then top surviving frame (default VORTEX when stack normalizes empty).
- **Must** call `orchestrateCharacterMove({ characterId, targetRoomId, intentKind: 'connect', characterMeta })`, which commits and presents when `changed`.
- **Must not** publish `CheckLocation` or perform inline membership Dynamo writes outside [`manipulation/membership/`](manipulation/membership/).
- **Idempotency:** duplicate connect when already in target room (`changed: false`) **must** be a no-op (no bundle, no orchestration).
- Arrive world-line copy for connect is **compiled** (`intentKind: 'connect'`); with `froms` empty the compiler emits no capture-from and no leave narration, from arity alone rather than a connect-specific branch. Connect reuses the navigate orchestration tail and publishes no imperative world lines.

### `Character Disconnected` (positions-owned)

- **Must** call `orchestrateCharacterMove({ characterId, targetRoomId: null, intentKind: 'disconnect' })` --- purges play membership; **must not** clear `RoomStack` (connect re-resolves legal placement from retained ladder). The character's presence binding is kept, hostless, not deleted, so the reconnect re-points that same binding and anything the character holds keeps naming it (see the presence-nodes section's stable-id rule).
- **Must not** perform inline membership writes outside [`manipulation/membership/`](manipulation/membership/).
- **Idempotency:** duplicate disconnect when already out of play (`changed: false`) **must** be a no-op (no bundle).
- Leave world-line copy for disconnect is **compiled** (`intentKind: 'disconnect'`) and presented by `commitAndPresentStepSequence` (via `orchestrateCharacterMove`, called with `to: null`) --- disconnect has no destination room, so there is no arrival header to render (that branch is unreachable, per the "One entry point, gated on `to`" clause above). No imperative `PublishMessage` in the handler. The ghost-purge sweep in [`repairRoomOccupancyDrift`](manipulation/membership/repairRoomOccupancyDrift.ts) shares this path and this copy verbatim: a ghost session genuinely has disconnected, so **must not** grow a separate drift narration variant.

### `Character Navigate` (positions-owned)

- **Ingress:** typed commands via actions **`Parse Requested`**, UI exit clicks via actions **`Action Assessed`** **`Navigation`** (same execution contract).
- **Must** trust actions-validated `toRoomId` at apply (no topology re-check in positions).
- **Must** call `orchestrateCharacterMove({ characterId, targetRoomId: content.toRoomId, intentKind: 'navigate' })`, which commits and presents when `changed`.
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

### `mtw.diagnostics` --- presence cover drift self-heal

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Presence Cover Drift Finding` | [`index.ts`](index.ts) `receiveEvents` -> [`healPresenceCover`](manipulation/containment/healPresenceCover.ts) |

**Pointers govern; the cover is their stored index.** The comparison (shared with the sweep, one definition: `classifyPresenceCoverDrift`/`coverRebuildsFor` in [`@tonylb/mtw-gateways`](../../../../packages/mtw-gateways/ts/ephemera/positions/classifyPresenceCoverDrift.ts)): a member covered by a binding (listed in its cover) holds exactly one binding whose `fromHostPresences` includes `{ host, that binding }` (PR-25's positive rule: one binding may sit under several parents, so each parent binding that lists the member is named by exactly one of the member's bindings, once; two bindings, or one binding naming a parent twice, is `Duplicate`, and a rebuilt cover lists every binding that names it); a member binding naming a binding that is absent or does not cover it is stale. A pointer with no `presence` (written when a host-addressed move or population lands in a parent with several bindings) is compared at host grain and is never a count mismatch. **For a Room's characters the stored index is the characters row, not the cover:** a bystander is not in the room's graph, so the room's Base lists no character (its coverage of characters is the row) and the classifier never visits one; a character's pointer naming a room whose row no longer lists it is caught from the character's side by the occupancy sweep. **The orphan direction is sensed too, for every other kind:** a member's pointer naming a host whose graph lacks the member's node (`orphanedPointersOf`, judged from the member's side and reported on the member). It is healed by a same-pointer `repairPresenceBinding` (pointer and cover unchanged, so `settleMembership` re-seats the node and the cover entry), only when the host's row exists and holds the named binding. Otherwise it is report-only (`Orphaned` under `unrepairable`). A Character pointing at a Room is a bystander and stays with the occupancy sweep.

**Repair model:**

- **Healable, and only this:** the explicit entries of a binding, rebuilt from the members' pointers. The heal reads the whole's graph and **every member's**, re-classifies, and rewrites each disagreeing cover with `repairPresenceBinding` (in place, same id). No new emitter.
- **Not healable, and reported only:** a member with no binding, or with two bindings at one host binding (fixing either mints or removes a binding, which the single write path reserves to the move compiler and population); a member no binding covers (`Uncovered`) or a second hostless binding; a host with bindings and no `PRESENCE#Base` (`lacksBase`; a heal would invent one). An orphaned pointer whose host row or named binding is absent (`Orphaned`). The sweep returns these under `unrepairable` and does not emit a finding for them.
- **Writes nothing if any member graph cannot be read:** a rebuild over a partial read would drop that member's entry.
- **Idempotent, by recheck:** a redelivered finding whose cover already matches commits no transaction.
- **Never called from a read boundary.**

Sweep (read-only classification): [`../../../diagnostics/presenceCoverDriftSweep/`](../../../diagnostics/presenceCoverDriftSweep/).

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

- **`cover` is the whole of a presence node's bucket-membership statement, and it is one type: `{ members: EphemeraPresenceCoverEntry[] }`, explicit entries only.** **The coverage invariant:** every component node of a whole is covered by at least one of its bindings, checked on the whole's own graph, so an uncovered member is a reportable error and never a silent member of some binding. `coverageViolationsOf` ([`classifyPresenceCoverDrift.ts`](../../../../packages/mtw-gateways/ts/ephemera/positions/classifyPresenceCoverDrift.ts)) is the one definition: `applyStepSequenceCore` throws on it at the end of a run, for the graphs the run wrote (at the end, because a part move passes through states a validator mid-run would refuse), and the drift classifier reports it as `Uncovered`, `SecondHostless` and `BadUnplaced`. A bystander is not a node, so the invariant leaves it out. An entry is a `{ host, presence }` pair --- `host` the covered component's own id, `presence` which of that component's own bindings this entry means (a bare `host` cannot say that; see `EphemeraPresenceCoverEntry`'s definition comment). A cover never means "whatever the other bindings do not list", so it reads the same whatever its siblings hold, and the graph-side type is the same shape as `EphemeraLudicCacheNode`'s. The `Remainder` sentinel is gone: it fails `isEphemeraLudicGraphStructureNode`, like the other retired shapes. **Arity follows the covers --- trivially true of every present constructor, and it must be *held* true as construction widens:** a member listed in several covers holds one binding per cover (PR-10's arity-descends rule). Any constructor that lists a member in a second cover takes on the obligation to mint the matching binding; the `PresenceCoverDriftSweep` reports a count mismatch (an unbound, duplicated or stale member binding), an uncovered member, and a host with bindings and no `PRESENCE#Base`, as report-only items (see [presence cover drift](#mtwdiagnostics--presence-cover-drift-self-heal)). **Retired shapes are rejected, never read:** a tagged cover (`Full`/`Enumerated`), a host-only `fromHostId`, or a `fromHostPresences` with no `presence` fails `isEphemeraLudicGraphStructureNode`, so a surviving row reports through `LudicGraphStaleStructureSweep` rather than being silently reinterpreted. **A stored shape change migrates by repair, not by a read bridge:** population rewrites a wrong-shaped binding in place, and the `FixedContainmentDriftSweep` finding reruns it for data no asset diff will reach (how the 2026-10-11 `fromHostPresences` migration ran).
- **In `ludicCache`, a presence binding nests on its owner's cache node, not in a separate top-level list.** `EphemeraLudicCacheData.nodes` holds components only; each `EphemeraLudicCacheNode` carries its own bindings as a required `presenceNodes: EphemeraLudicCachePresenceNode[]` (`[]` when the host has none --- every cache node is a walked host whose graph was read, so `[]` is a true "none", not "unread"). A binding without an owner is unrepresentable by construction, mirroring the graph side where the container already names the owner.
- **A cut's node set is not the cover, and only the cover states binding provenance.** [`nodesFromPresenceBinding`](ludicGraph/presenceSubGraph.ts) returns the cover's `host` entries **unioned with the root and with the binding's own presence node id** --- the root is in every bucket unconditionally and the presence id is there for `endpointStatus`'s ordinary `nodes.has(owner)` test, neither of them because a binding covers it. **So *this node is here because of this binding* is answerable from `cover.members` and never from the set the cut ranges over**, and a consumer that reads the latter as membership over-claims by exactly those two entries. **No edge is ever a cover member**, so an edge kept in every bucket by the both-neutral rule --- a transit leg --- carries no provenance claim under any cover shape.
- **Clause 3, zero-or-all: if a host consolidates any one of its presence bindings, it consolidates all of them.** Enforced by `assertZeroOrAllPresenceBindings` in [`ludicCache/mergeReducer.ts`](ludicCache/mergeReducer.ts), called from `presenceCacheNodesFromFold` before any cache node is minted for a fold; it throws rather than silently consolidating a partial set.
- **Single write path, and it is what makes clause 3 and write-time completeness checkable at all:** every presence-node mint, re-point or removal goes through [`EphemeraLudicGraph.addPresenceNode`/`replacePresenceNode`/`removePresenceNode`](ludicGraph/index.ts), reached only from `applyStepSequenceCore.ts`'s `createComponent`/`addPresenceBinding`/`reparentPresenceBinding`/`joinPresenceBindings`/`splitPresenceBinding`/`repairPresenceBinding` step handlers, which are in turn emitted only by [`executeComponentCreation.ts`](manipulation/membership/executeComponentCreation.ts) (birth), [`presenceBindingStepsForMove.ts`](manipulation/kernel/compile/presenceBindingStepsForMove.ts) (moves) and [`containmentPopulationSteps.ts`](manipulation/containment/containmentPopulationSteps.ts) (authored population). **Birth is a binding's proper origin:** `createComponent` mints the component's hostless `PRESENCE#Base` with its row, so a component created in the kernel never exists without a binding; `rootStep`'s mint is the late catch-up for components created outside the kernel (authored ones, at cache time). **A further emitter added for convenience costs this guarantee its argument** --- do not add one.
- **`isEphemeraLudicCacheData` ([`ludicCache/types.ts`](ludicCache/types.ts)) enforces two integrity checks with deliberately opposite verdicts, and the cover check resolves by path:** checking a cover entry means walking to the member host's own cache node, then to the entry's named binding on it. An absent host node, or a named binding not found on it, **FAILS** (corruption --- an internal inconsistency within one cache). This is sound rather than overzealous: a cover member is never a character (a character's membership host is a Room only) and the walk reaches every other member, so an absent host can never be a legitimate omission. An edge terminating at a presence node absent from `nodes` **PASSES** (the binding exists and was simply not pulled into this materialization --- legal by design). **Do not make the second case fail defensively** --- it is a guarantee this guard cannot see, not an oversight.
- **A cache cover entry's `presence` field is optional, unlike the graph-side `EphemeraPresenceCoverEntry`'s required one.** It is absent exactly when the fold could not find the member's own binding into the owner --- a thing placed without a move never had one minted. The member is still covered by the entry; only which of its bindings is meant is unknown.
- **Every reference to a binding names its owner, and exterior addressing carries a `PRESENCE#` tag** (`isPresenceTaggedPortId`), decidable from the terminal alone without graph context. In `ludicCache` a bare `PRESENCE#` terminal is corruption: a cache edge ending at a binding uses the exterior form `{ owner, port: 'PRESENCE#...' }`. This is what lets `resolveEndpoint` ([`findRelationalChain.ts`](../actions/enrich/objectManipulation/synthesize/findRelationalChain.ts)) and `isEphemeraLudicCacheData` tell an absent presence binding (legal) from a dangling crossing port (corruption) apart.
- **A catalog handle's `presence` is every bucket the thing is seen in:** each binding in the cache whose cover holds the thing, plus each of the thing's own bindings (a host is the root of its own graph, so it is in each of its own buckets even though `cover` leaves the root out), deduped, in cache order. The seed room is the fallback only when the thing has neither. `presence` is the flat projection of the handle's `placement` (`audienceBuckets`, [`actions/objectViews.ts`](../actions/objectViews.ts)), set where the handle is built and nowhere else: `placement` is one run of bindings per owner, and the thing's own bindings each record the parent bindings they sit under (`under`, from the binding's own `fromHostPresences`, which govern) and the rooms those reach (`rooms`, walking up and stopping at the first room on each path), which is what tells one part of a spread thing from another.
- **The room affordance header reads the cache forward, one level deep** ([`roomObjectContents.ts`](ludicCache/roomObjectContents.ts), `ludicCacheRoomObjectContents`; a sibling of `catalogHandles.ts`, which stays the command path's flat referent pool). The room level is the union of the covers of the room node's bindings, Objects with a stored `shortName` only (the reader returns these ids too, since the compose needs them for the improvisation order). An object's contents are the `cover.members` of its own bindings (a binding's cover is the owner's own graph, root excluded), deduped across bindings, Objects only; a box on a table contributes the box, never the cup in it. Structure comes from the room's stored row, shared by every viewer; each label is resolved per viewer; an object with an unresolved `shortName` is dropped at both levels. No reverse index ("who are this thing's parents") exists, since the header never asks it. The cache is exhaustive, so a cup in a closed box on the floor shows as `Box (with Cup)`. On the wire, a room-level object stub's `ludicGraph` holds bare references to its contents and each content travels as a sibling name stub, the same shape as the `look <object>` path; the client rule is in [`Message/AGENT.md`](../../../../charcoal-client/src/components/Message/AGENT.md).
- **A binding's parents are a stored set of pointers, `fromHostPresences: { host, presence }[]`, and they govern.** In each pointer `host` is the parent's shard; `presence` is which of that host's bindings this one sits under, and it is required. The field is required and an empty set means a hostless binding; the retired single `fromHostPresence` is rejected by the guard, so a surviving row reports through `LudicGraphStaleStructureSweep`. Every reader is set-aware (`parentsOf`, `parentHostsOf`, `bindingHasParentOn`); the only producer that writes more than one parent is the spread (below), and the seam's single-parent read (`parentOf`) throws on a binding with more. A binding with no parent is a hostless binding (Base, or Unplaced when Base is placed). Nothing derives the pointer from a parent's cover, and nothing guesses a binding: cache-time population into a parent with several bindings is refused (logged, nothing written; see [`AGENT.implementation.md`](AGENT.implementation.md)'s shelved multi-binding-parent paragraph).
- **The room rule is stored, and Areas keep a root too.** A Room or Area keeps exactly one hostless binding for good, its `PRESENCE#Base`, and no Unplaced; a room's binding into an Area is a carve-out with `members: []` naming the Area's Base, so a member's bucket is the room itself. **Every Room and Area keeps its Base, whether or not it contains anything or sits in an Area:** it is the root of its presence tree. Population runs for every Room and Area component (`processComponentUpdated` does not wait for nested nodes), and `rootStep` mints Base once per run, before any child is computed, so every child points at the same one. Any other parent (a Feature, an authored Object) with no binding at all gets a hostless Base from `rootStep` too, which its own first placement then re-points (population emits `repairPresenceBinding` on it, keeping the id) rather than minting beside it. A Room's Base is never re-pointed.
- **Base and Unplaced: a host's hostless bindings are two fixed ids, and nothing else is hostless.** `PRESENCE#Base` (`BASE_PRESENCE_ID`, [`ephemeraMeta.ts`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)) exists from the host's birth, is minted first (`createComponent`, `rootStep`), survives every merge, and takes every context-free add whether or not it has a position (the stable lookup is `childParentBindingIdOf`, [`presenceParent.ts`](ludicGraph/presenceParent.ts); a host with no Base is a defect that `lacksBase` reports; the move no longer refuses it, since the F steps check only the bindings they name). `PRESENCE#Unplaced` (`UNPLACED_PRESENCE_ID`) is optional, never holds a parent pointer, and exists only while it covers something: it holds contents that fell out of every placed binding. Base and Unplaced may both be hostless at once, and Base never absorbs Unplaced (a Base that becomes hostless leaves Unplaced where it is). Unplaced is removed when it empties; Base is never removed (the root rule). **A departure (a move to no parent) is the fall-through rule, one of three end-of-run rules (the other two are the root rule, below, and the collision rule, in the move bullet):** the entries leave the binding, each child binding drops it as a parent, and a child left with no parent on the host falls through to Unplaced (minted if absent), while a child another parent still covers (Base, say) gains nothing. A whole binding other than Base is then left with no parent and is removed. Nothing folds into Base on the way, which would attach contents to a context nobody wrote. Context-free adds are therefore never ambiguous, at the accepted cost that when Base has a position they land wherever Base is. **Part moves leave Base's parenting alone:** a part moved out of a hostless Base gets a new binding at the destination and Base stays hostless; how Base's parenting should change under a part move is owed to the parent-set work ([PR-25](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.presence.planning.md#settled-register), PR-26), and a move never adds a parent to a binding; only a spread does (below).
- **`repairPresenceBinding` rewrites a binding's pointer and cover in place, keeping its `universalKey`,** so no child pointer is orphaned. It is stale if the binding is absent (a repair never creates one). Population emits it only when a binding points at the parent in the wrong shape (a pointer not naming the parent's binding, or a room's Area cover with members); a correct binding emits nothing, so a clean rerun (a re-cached component, or a drift-finding heal) commits no transaction.
- **A binding's id is stable for the host's life (PR-21(e)), and a move names its bindings.** A move is a composition of three step kinds (reparent, join, split), written by the planner ([`resolvePresenceMoves`](manipulation/membership/resolvePresenceMoves.ts)), which reads the mover's and the destination's graphs and names every binding; the kernel resolves nothing by host and guesses nothing. `reparentPresenceBinding { hostId, presence, lose?, gain? }` changes one binding's parent set and leaves its id, cover and children alone; it is `stale` (`presenceBindingMoved`) when a parent it loses is no longer in the set, or `destinationBindingMissing` when a parent it gains has no such binding. A whole move is one reparent that loses **every parent of the binding on the `from` host** (PR-25 rule 1) and gains the destination binding; a binding shared by several parents on that host moves once. (`presenceParentSets.payoff.test.ts` runs PR-C5's chest and backgammon set through the planner and kernel: an add to the shared set lands once and shows from both chest bindings, and a die leaves it in one move.) A mover holding no binding at all gets its `PRESENCE#Base` minted ahead of its first move (`addPresenceBinding`). **A spread** (an Object laid partly onto another while it stays where it is, the one caller that writes a shared binding) is the same request with `keepFroms`: one reparent that gains the destination binding and loses nothing, then the same joins, so the mover's one binding sits under both hosts. A spread mover with no binding under the `from` host gains that host's binding as well. Its op strips no containment edge and leaves no host (`froms: []`), so its `Object Moved` fact names no `froms`. **A view-move names its binding** (`moverBinding` on `resolvePresenceMoves`): the one binding it moves, which must hold a parent on a `from` host (`moverBindingMissing` otherwise); the mover's other bindings stay where they are, and the op strips the mover's own containment edge in a `from` host only when no other binding of it stays under that host. A convergence that joins two bindings also dissolves a `ConnectedTo` between them first, so no edge names the absorbed binding. **Extend** (`extendSteps`) is the Plan-level instruction that makes the second binding: a split in place plus a `ConnectedTo` between the pieces. An attempt that extends and then moves states the move's binding by the extend's minted `presenceUuid` (a one-binding `view` on the moved referent), and `commitAttempt` plans the move against the object's graph as the extend leaves it (`withExtendedBinding`), since the new binding does not yet exist. **A destination holding several bindings** (a draped cloth) takes the mover on the **deepest** part, the one furthest below the room, unless where the destination is seen singles one out; two equally deep are `destinationBindingAmbiguous`. A first-iteration stand-in: it gives way to the player's own naming ("the cup on the table") when a command can say which part it means, and an unnamed choice then becomes a question to the player. **A host never drops below one binding, and a departure is a reparent that only loses:** a disconnect, destroy or scrub to no host is one such reparent per binding that leaves. A binding left with no parent is removed at the run's end and its children fall through by the departure rule (to `PRESENCE#Unplaced` unless another parent still covers them); Base is never removed, it becomes hostless. A destroy's departures do the same just before `destroyComponent` deletes the host row. A character's cardinality validator is unaffected: it still carries exactly one. **Convergence is a join the producer writes.** A mover that ends with two bindings under one parent (a scrub's several bindings into one destination, or a binding already held under the destination) is a reparent followed by `joinPresenceBindings { hostId, into, toJoin }`: the binding already under the destination survives, and Base, when it is among them, always does (the kernel refuses a `toJoin` that holds Base). Children that collide beneath the survivor (a child listed under two of the joined bindings) are joined by the planner one level down, in order; covers are never compared. The join step's `cascadeHosts` names the hosts it reads (the joined bindings' parents and their children), for the footprint. **A part of a cover moves by a split then a reparent** (`splitPresenceBinding`, then a reparent of the fresh piece, whose id the producer mints so a later step can name it); no request asks for one yet, and the planner holds only the helper `partMoveSteps`. **The same steps write the parents' covers:** an entry onto each gained parent binding's cover, and off each lost one (a bystander never touches a room graph). **The collision rule: two bindings of one host under the same parent binding, or two non-root bindings under no parent, may exist only inside a run:** `applyStepSequenceCore` throws at the end of a run that leaves them in a graph it wrote. The check reads every binding's parent set, so one binding that names a parent twice trips it too, and one binding under several parents is legal; `addPresenceBinding` and `repairPresenceBinding` carry the binding's whole parent set (`fromHostPresences`), and the cover index lists the binding on every parent in it.
- **Membership follows binding count, and a presence step settles it.** A host holds a mover's node (and its adjacency row) while any binding of the mover points at that host: a move adds the node at the arrival host only for the mover's first binding there, and removes it from the departure host only when the last binding there leaves (`settleMembership`, [`kernel/settleMembership.ts`](manipulation/kernel/settleMembership.ts), called by the add, move, release and repair steps; there is no separate membership step). **Drift is binding-only:** a node held in a host that no binding of the mover points at is left alone by a move or destroy, and is the drift sweeps' to heal. **This holds for a Room host only for non-bystanders:** a bystander (`isBystanderMove`) arriving at or departing a Room writes no node there; its membership is the room's characters row, written from the mover's own bindings (`membershipChangesOf`).
- **Not yet built, and not silently owed by any current call site:** a writer that computes a carve-out of explicit entries beside Base (other than the room's empty Area carve-out); and re-partitioning a whole's contents when a multi-binding departure removes a binding a child names (PR-12 obligation A). See [`AGENT.implementation.md`](AGENT.implementation.md)'s `ludicGraph/` section for the standing forwarding note.

---

## Read surface (forward graph vs reverse containers)

- Live graph state **must** be cached and passed as the **stored payload** (`fromFieldPayload` / `toStored()`), **never** through the authored projection (`fromPlayEnvelope` / `toPlayEnvelope`): that type cannot express runtime-minted structure and drops `ports`, `rootId` and Room/Feature/Area nodes on every read and `set`. A caller that wants the authored shape projects into it explicitly. Mental model: [Type boundary](AGENT.concepts.md#type-boundary-storage-vs-gateway-read-envelope).
- Steady-state roster reads (**affordance compose**, perception fan-out, membership snapshots) **must** use **`getRoomCharacterList`** ([`../../internalCache/hydrateRoomRoster.ts`](../../internalCache/hydrateRoomRoster.ts)), not raw `ephemeraDB` `activeCharacters` and not any gateway roster API.
- **`getRoomCharacterList`** **must** derive on each call from the room's **`LudicCache::Characters`** row (**`readRoomCharacters`**, a strongly consistent `getItem`; an absent row is an empty room) -> **`hydrateRoomRosterFromCharacterIds`** (`CharacterMeta` + `CharacterSessions`); **must not** read stored **`activeCharacters`** from Dynamo on the steady path. Compose pipeline: [`../../internalCache/AGENT.md`](../../internalCache/AGENT.md#membership-presentation-and-roster).
- After membership apply when **`changed`**, the kernel seeds **`Positions.set`** with every committed **`EphemeraLudicGraph`** ([Membership-changed bundle](#membership-changed-bundle) step 1); coordinators **must not** seed it again. Roster reads after commit **must** come from **`getRoomCharacterList`** after that seed; **must not** use transact **`successCallback`** on **`activeCharacters`** for snapshot capture. A writer that changes no graph **must not** `Positions.invalidate` a host: that discards the commit's write-through and forces an eventually-consistent Dynamo re-read.
- **Roster display** **must** hydrate at read time from **`CharacterMeta`** (`Name` -> `DisplayName`, `Color`, `fileURL`) + **`CharacterSessions`** (`SessionIds`) via [`../../internalCache/hydrateRoomRoster.ts`](../../internalCache/hydrateRoomRoster.ts); membership from the room's characters row only (a bystander is not a node in the room's graph).
- **Character forward `getLudicGraph`** **must** read stored **`Meta::Character.ludicGraph`** topology only; empty topology when absent. **Must not** use character forward read for room-membership / reverse reads.
- **Reverse membership reads** (navigate parse endpoint in [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts), membership pre-read in coordinators) **must** use **`internalCache.Positions.getMembershipContainers`** (adjacency index only), not raw `Meta::Character.RoomId` or `CharacterMeta.RoomId`.
- **Reverse object placement reads** **must** use **`internalCache.Positions.getMembershipContainers(objectId)`** (adjacency only); returns host ids of any membership host kind (an object put on a table reads back `OBJECT#`). Empty adjacency means out of play (`[]`). Room-only apply paths **must** filter to **`ROOM#`** hosts when computing room placement diffs.
- **Forward room graph** **must** read stored **`Meta::Room.ludicGraph`** topology only; when graph absent, return empty topology; **must not** merge stored **`activeCharacters`** on gateway forward load for roster display ([sole-authority stance](AGENT.concepts.md#room-play-graph--adjacency-reverse-index)). Forward graph **must** include **`Object`** nodes when present. A bystander character is not a node in a Room's graph: its membership is the characters row plus its own binding pointer.
- **Forward character inventory graph** **must** read stored **`Meta::Character.ludicGraph`** topology only; v1 nodes are **`Object`** membership only; empty topology when absent.
- **Affordance compose** **must** derive in-room object ids from **`ludicCacheRoomObjectContents`** ([`../../internalCache/affordanceRoomDeliverable.ts`](../../internalCache/affordanceRoomDeliverable.ts)), not `graph.objectIds`; the room's wire `ludicGraph` is projected from the same reader (the room root plus its Objects, in reader order; absent when there are none), and the roster comes from the characters row, so the header reads no `Meta::Room`; object names and each object's one level of contents come from `ludicCacheRoomObjectContents` (see the room-header bullet above), not room meta.
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
