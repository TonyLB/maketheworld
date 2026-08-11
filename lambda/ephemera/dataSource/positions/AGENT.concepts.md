# Positions --- concepts and vocabulary

This file records **mental models and vocabulary** for `mtw.ephemera.positions` --- what positions **mean** in the game world, not how we migrate or wire code. Normative obligations for shipped behavior: [`AGENT.contract.md`](AGENT.contract.md). Code map: [`AGENT.implementation.md`](AGENT.implementation.md).

Cross-area topology authoring (Area `ludicGraph`, Exit edges): [`packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md).

---

## Core vocabulary

| Term | Meaning |
| --- | --- |
| **Ludic graph** | A `{ nodes, edges }` structure: heterogeneous **nodes** (references to things in space) and uuid-keyed **edges** (typed relationships between endpoints). Same pattern as Area `ludicGraph` in WML; may exist at multiple **scales**. |
| **Graph role** | Which question a graph instance answers and **who may mutate it** --- see [Graph roles](#graph-roles-shared-shape-different-authority). Same shape, different authority boundary. |
| **Scale** | Which component **hosts** the graph: Area (macro), Room (in-room), Character/container (inventory), etc. |
| **Authored graph** | Blueprint / asset truth merged at participation order (WML `StandardArea.ludicGraph`, future `StandardRoom.ludicGraph`). |
| **Play graph** | Ephemera runtime mutations: who is in which room **now**, object placement in play, etc. |
| **Projection** | A **read model** derived from a graph for one consumer (exits for nav, roster for affordance WML, etc.). Projections are filters, not the graph. |
| **Positions lane** | `mtw.ephemera.positions` --- ephemera authority for **play-time** position truth and the mutations that maintain it. |
| **Character presence** | At play time, which **room** a character occupies and who shares that room --- distinct from Area **authored** participation or exit topology. |
| **Room membership** | The play-time fact that a character is **in** a room (and appears on that room's roster). Shipped: **Character node** in that room's **`ludicGraph`**; reverse via **adjacency index**. Roster display hydrates at read time. |
| **Eviction ladder** (`RoomStack`) | Character-local **`{ asset, room }` frames** used to resolve **legal in-play placement** under current asset access --- trim inaccessible outer frames; surviving top frame is the proposed membership room. Kept in **trim-ready shape** on navigate so resolution is a straight-line pop, not a reconstruction. Stored as **`Meta::Character.RoomStack`** (rename to match vocabulary may follow). See [Eviction ladder (shipped)](#eviction-ladder). |
| **Room asset stack** | Which assets **participate in composing** a room's WML at render time (participation order on **`Meta::Room`**). Answers a **render merge** question --- not where the character **is**, and not the eviction ladder. |
| **`EphemeraLudicGraph`** | Host-bound in-memory play manipulation model (class in [`ludicGraph/`](ludicGraph/)); sole ephemera primitive for membership + relational simulation after read-boundary assembly. |

---

## Graph roles (shared shape, different authority)

The `{ nodes, edges }` pattern recurs across the system. **Graph** names a truth **shape**, not a single scope-of-authority boundary. Instances differ by **which question they answer** and **who writes them**.

| Graph role | Question | Authoritative writer | Steady-state example |
| --- | --- | --- | --- |
| **Authored blueprint** | What did we **design**? | Assets / WML merge | Area `ludicGraph` (Exit edges, macro layout) |
| **Play manipulation** | Where is everyone **now**? | `mtw.ephemera.positions` | `Meta::Room.ludicGraph` + adjacency index; simulated via **`EphemeraLudicGraph`** |
| **Materialized presentation** | What does this **consumer** see at this perspective? | Consumer-specific materialization (e.g. affordanceCache) | `Affordance::` row `topology.exits` |
| **Ephemeral presentation** | What is the **wire-ready** view at read time? | Ephemera compose (cross-cache) | Hydrated roster in `AffordanceRoomDeliverable` |

**Invariant:** membership truth does not define exits; exit truth does not imply roster membership. Consumers that need several views compose **separate projections** --- see [Three play-time questions](#three-play-time-questions) and [`internalCache/AGENT.md`](../../internalCache/AGENT.md) (exit vs membership presentation pipelines).

### Type boundary (storage vs gateway read envelope)

Five names, five roles --- same `{ nodes, edges }` shape, different **authority** and **layer**:

| Type | Layer | Role |
| --- | --- | --- |
| **`EphemeraLudicGraphFieldPayload`** | Dynamo `Meta::*.ludicGraph` attribute | Stored attribute; Character + Object **identity** nodes; `hostId` omitted (row `EphemeraId` is authoritative) |
| **`EphemeraLudicGraphData`** | `@tonylb/mtw-interfaces` | Manipulation JSON with **`hostId`**; `toJSON()` / read-boundary assemble shape |
| **`EphemeraLudicGraph`** | [`lambda/ephemera/.../ludicGraph/`](ludicGraph/) | Host-bound manipulation **class**; immutable simulation API |
| **`PlayLudicGraph`** | `@tonylb/mtw-gateways` | Topology-only **read envelope** (alias of `StandardLudicGraphData`) |
| **`StandardLudicGraph`** | `@tonylb/mtw-wml` | Authored blueprint (Exit-only v1; asset merge authority) |

**Data flow:** Dynamo field + row PK -> `fromFieldPayload` -> **`EphemeraLudicGraph`** -> simulate -> `toStored()` persist; **`internalCache.Positions.getLudicGraph`** -> wrapper **`fromPlayEnvelope`** -> class. Module detail: [`ludicGraph/AGENT.md`](ludicGraph/AGENT.md).

Roster **display** (`DisplayName`, `SessionIds`, ...) hydrates at read time via ephemera **`getRoomCharacterList`** ([`../../internalCache/hydrateRoomRoster.ts`](../../internalCache/hydrateRoomRoster.ts)) --- topology ids from **`Positions.getLudicGraph`** -> **`graph.characterIds`**, display from **`CharacterMeta`** + **`CharacterSessions`**, not from stored `ludicGraph` nodes. Ephemera **`Positions.set(graph)`** seeds memo from coordinator **`postApplyGraphs`** after membership apply; roster is never cached on the graph envelope.

#### WML convergence (future)

Relational edge **wire types** should stay aligned between **`EphemeraLudicRelationalEdgeData`** (stored play JSON) and future WML **`Relational`** tag members (BD-2/BD-3). **Authority** stays separate: WML **`StandardLudicGraph`** owns authored blueprint and seed/snapshot import; **`EphemeraLudicGraph`** owns live play mutation. Adapters (`fromPlayEnvelope`, future `fromWML`) are the seam --- do not merge classes or Dynamo write paths. Future WML **`EdgeList`** consolidation is deferred until heterogeneous room/container edge lists ship in mtw-wml.

**Cross-links:** gateway handler scope --- [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md); authored exit topology --- [`packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md); compose paths --- [`../../internalCache/AGENT.md`](../../internalCache/AGENT.md). Normative scope: [`AGENT.contract.md`](AGENT.contract.md#scope-of-authority-manipulation-vs-presentation).

---

## Shipped mental model (aligned with play truth today)

### Room play graph + adjacency reverse index

**The stance:** the room play graph and its reverse adjacency index are the **sole authority** for play membership. The legacy projections --- **`Meta::Room.activeCharacters`** and **`Meta::Character.RoomId`** --- are neither written nor read as truth. Anything that needs "who is in this room" derives it from the graph; anything that needs "what room is this character in" reads adjacency. Nothing reconstructs membership from a stored projection, and nothing writes one back.

This is why several rules downstream look redundant but are not: forward reads must return empty topology rather than fall back to `activeCharacters`, reverse reads must consult adjacency rather than a stored `RoomId`, and roster *display* fields must be hydrated at read time rather than persisted alongside membership. Each is the same stance applied at a different surface.

At play time, room membership is stored as a **room play graph** plus a **reverse adjacency index**:

- Each room hosts **`Meta::Room.ludicGraph`** --- character and object **nodes**, plus in-host **relational edges** (`On`, `Under`, `Against`, `Custom`).
- Each character has **adjacency rows** (`CHARACTER#` PK, `POSITION#ROOM#...` SK) pointing at host room(s).
- Each object has **adjacency rows** (`OBJECT#` PK, `POSITION#ROOM#...` SK) pointing at host room(s) when placed (**I5**).
- **Roster display** is hydrated at read time from **`CharacterMeta`** + **`CharacterSessions`** --- not stored on the room row.

A character should appear in **at most one** room graph at steady state; duplicate membership (drift) is **visible** in the adjacency array and repaired by end-state apply. Objects follow the same steady-state rule (nodes only); multi-room object adjacency is drift repaired via [`repairObjectPlacementDrift`](membership/repairObjectPlacementDrift.ts).

### Object room placement (nodes only)

Improvisational **`OBJECT#`** placement is **positions-owned** play manipulation:

- **Existence** (improvisation pair + **`Meta::Object`**) lives on the objects lane ([`../objects/AGENT.md`](../objects/AGENT.md)).
- **Where** the object is in play: **`Object`** node on the delivery room **`ludicGraph`** + **`OBJECT#`** adjacency row (**I5**).
- **Spawn + place:** existence on the objects lane ([`../objects/AGENT.md`](../objects/AGENT.md#improvisation-storage)); initial room placement via [`applyObjectRoomMembership`](membership/applyObjectRoomMembership.ts) from the objects two-step coordinator ([`spawnOneImprovisationObject`](../objects/spawnImprovisationObjectsBatch.ts)).
- **Place / remove:** [`applyObjectRoomMembership`](membership/applyObjectRoomMembership.ts) end-state apply; emits **`Object Moved`** on **`mtw.ephemera.positions`** (**I4**).
- **In-host relational edges:** [`manipulation/relational/`](manipulation/relational/) coordinators build relational steps for the kernel; emits **`Object Relation Changed`**. Containment (`in` / inside) deferred to a future nesting operator.
- Existence lane, Coyote snapshots, and affordance compose: see [`../objects/AGENT.md`](../objects/AGENT.md).

### Character inventory graph (D16; object nodes only)

Held-object inventory is **positions-owned** play manipulation on the character host:

- **Storage:** optional **`Meta::Character.ludicGraph`** --- same **`EphemeraLudicGraphFieldPayload`** shape as room hosts; v1 **Object** nodes only.
- **Reverse index:** **`OBJECT#`** PK + **`POSITION#CHARACTER#...`** SK when held by a character.
- **Read:** **`internalCache.Positions.getLudicGraph(characterId)`** (forward); **`getMembershipContainers(objectId)`** may return **`CHARACTER#`** hosts.
- **Persist primitives:** [`manipulation/kernel/`](manipulation/kernel/) --- character-host graph + adjacency transact items via `commitStepSequence`.
- **Cross-host apply:** [`manipulation/membership/executeObjectMove.ts`](manipulation/membership/executeObjectMove.ts) --- one atomic remove-from-host + add-to-host for **either** direction, taking a **host pair** rather than a verb or an acting character. It grounds its transfer set through the Synthesize executor and commits through the kernel --- **no** new `update*LudicGraphs` fork. `takeHold` is `(ROOM# -> CHARACTER#)`, `drop` is the reverse, and `give` would be `(CHARACTER# -> CHARACTER#)` with no new machinery. See [Intent vs. world-effect](#intent-vs-world-effect).

### Manipulation layering (membership transfer)

Every graph mutation is expressed as an ordered **step sequence** and committed through one kernel entrypoint. Kernel API detail: [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md). Normative rules: [`AGENT.contract.md`](AGENT.contract.md#manipulation-persist-layering).

```text
Per-operator ingress            verb-specific args, trusted ids (parse egress, navigate, repair, ...)
        |
        v
Planning                        shared membership adapter (fixed room-host targets)
        |                       or Synthesize executor, re-run at execute time (live grounding)
        v
Kernel step sequence            transferMembership | establishRelation | dissolveRelation
        |
        v
commitStepSequence              lock footprint -> one transactWrite -> re-validate live -> stream facts
        |
        v
Per-operator coordinators       verb-specific follow-on only (the kernel owns the common bundle)
```

**Invariant:** the kernel does **not** discover priors via **`getMembershipContainers`** --- planning always happens upstream.

| Term | Meaning |
| --- | --- |
| **Manipulation kernel** | Graph-grounded persist executor: accept an explicit step sequence, lock the affected hosts, re-validate against freshly-fetched graphs, transact, dual-write adjacency, stream facts |
| **Step sequence** | The ordered instruction list the kernel executes. Order is meaningful and never resorted --- a `dissolveRelation` step mutates the graph before a following `transferMembership` step reads it |
| **Host-local relational patch** | Add/remove **edges** on a fixed host `ludicGraph` without changing membership host. [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md#host-local-relational-patch) |
| **Shared membership adapter** | Reusable **transfer planner** for routes with fixed room-host targets: membership observation + apply mode (`end-state` / `bounded`) -> projected `froms`/`to` |
| **Per-operator coordinator** | Verb-specific ingress wrapper: plans (or runs the executor), then commits; owns only the follow-on effects specific to its verb |
| **Membership host transfer** | Semantic move between eligible hosts (`ROOM#`, `CHARACTER#` in v1); projected to bus facts as `froms[]` / `to` |
| **Apply mode: end-state** | Planner scrubs all prior room hosts, places at target |
| **Apply mode: bounded** | Planner scrubs **only** the trusted-ingress hosts the entity actually occupies --- not an end-state multi-host scrub |
| **Cross-snapshot recheck** | Re-deriving a plan against a later snapshot than the one that selected it (the executor at execute time; the reducer at commit time). A safety property, not duplicated work |
| **Layered vocabulary** | **Kernel** docs: step sequences, graph-grounded persist. **Adapter** docs: transfer planning, apply modes. **Bus facts** docs: membership host transfer projection |

### Two kernels: mutation and presentation

There are exactly **two** kernels, and they filter the *same* `KernelStep[]`.

| Kernel | Filters | Runs |
| --- | --- | --- |
| **Mutation** | mutation + capture steps | in the walk, inside the transaction |
| **Presentation** | describe + narrate steps | after commit |

The presentation kernel has **two branches**: **describe** (a rendered description of a thing) and **narrate** (a world line about something that happened). Both publish into the player's transcript; they differ in where their state comes from --- see [Positional vs. terminal binding](#positional-vs-terminal-binding).

**"Perception" is the wrong word for this and "presentation" is the right one, on the codebase's own usage.** Every `*Presentation*` identifier in production is narration or transcript publishing. So the repo already draws the line:

- **Perception** is the broad experience category --- *and the name of a data source* (`mtw.ephemera.perception`).
- **Presentation** is specifically publishing something into the transcript. It is a **step-kind category**, parallel to mutation.

Naming this kernel "perception" claimed a data source's territory and implied narration should route through it *terminally* --- the exact opposite of the binding rule below. **The repo has already made this mistake once** (the shipped describe branch was called "the perception kernel" before it was renamed `presentStepSequence`), which is why the distinction is recorded here rather than left to taste.

### Positional vs. terminal binding

The single most important distinction in narration, and the reason narration could not simply be appended to the existing kernel:

- A **narrate** step is **positionally bound**: it resolves its audience against graph state *at its own position in the walk*. A leave line must reflect the room the character was still standing in.
- A **describe** step is **terminally bound**: it resolves against **final committed state**. A description must reflect the world as it ended up.

**This is not an ordering rule.** Both branches publish after the commit. It is about *where the state came from*: describe reads the post-commit graphs; narrate reads a roster **captured mid-walk** by a capture step. Restating it as "narration publishes earlier" loses the entire point.

Collapsing the two back into one discipline, in either direction, reintroduces the bug the capture channel exists to remove. Normative form: [`AGENT.contract.md` --- Narration and presentation](AGENT.contract.md#narration-and-presentation).

| Term | Meaning |
| --- | --- |
| **Capture** | A read-only walk step that snapshots one host's roster mid-transaction, under a `captureId`. Carries no write payload |
| **Captured roster** | The plain `EphemeraCharacterId[]` a capture recorded. **Load-bearing** --- it *is* the narration audience, not a diagnostic |
| **Beat** | The moment a mutation commits; `beatAnchorTime` stamps it. Capture happens at the beat, delivery happens at flush |

### Presence and perspective are orthogonal

**Presence** answers *who was where, when*. **Perspective** answers *whether the actor receives their own event, and in what wording*.

Positional binding is a presence tool and answers nothing about perspective. All narration today is third person to one audience; there is no actor/observer copy split anywhere. Second-person copy ("you leave the tavern") is a target-vocabulary question --- an `ACTOR` / `!ACTOR` referent kind --- and is deliberately unbuilt.

This is recorded because the retired `[room, characterId]` targeting idiom **looked** like a perspective mechanism and was not: it was a presence patch, needed at exactly one of its four sites (a departure room, where live roster expansion had already dropped the mover). Someone will otherwise try to solve perspective with the presence tool.

### Abstract op and compiled step (two levels)

Kernel plans are **compiled from abstract operations**, never hand-built per call site.

```text
Call site          "a Move happened: this entity, these froms, this to" (+ narration ingredients)
    |
    v
Compiler           compilePositionKernelOp --- expands into [capture*, dissolve*, transfer, capture, narrate*] + slots
    |
    v
Kernel step list   one shared KernelStep[], filtered by each kernel
```

An **abstract op** names *what happened in the world*. A **compiler** expands it into the kernel-ready sequence. Only the compiler knows that a move brackets leave-then-arrive, so that invariant lives in **one function** instead of being re-derived at every call site.

**Why this matters, concretely:** three call sites once copied the same defensive `[room, characterId]` patch and only one of them needed it --- precisely because nothing shared owned the decision. The compiler is the thing that owns it now.

Two consequences worth stating as vocabulary:

- **Narration carries ingredients, not prose.** An op supplies `characterName`, a copy-kind selector, `objectShortName`; the presentation kernel assembles the string. This leaves room for copy that reacts to what the mutation actually *did*, rather than only to what compile-time intent expected.
- **The compiler holds shape forwards.** The pattern it replaces reasoned **backwards** from endpoint data to an event shape (what kind of move was this? which verb was that?). Holding the shape forward from a named op means the inference never has to be written --- and cannot be re-written later.

### Intent vs. world-effect

**Intents stay distinct where the player's meaning differs; execution unifies where the world-effect is the same.**

`Object Take Hold` and `Object Drop` are two intents: different utterances, different Plan-stage legality errors ("you're not carrying that" vs. "you're already holding that"). They are **one** world-effect --- move an object between two membership hosts --- and so one execution path, distinguished only by which host is which.

The corollary is that a **verb is a property of the delta**, not a declared input: take / drop / give is read off which side of the move was the room. This is why `give` needs no new module, no new event shape at execute time, and no new discriminant.

### Naming: `Kernel` alone names nothing

With two kernels, a bare `Kernel` prefix identifies neither.

| Name | Rule |
| --- | --- |
| `KernelStep` | **Stays unprefixed.** It is the *shared, cross-kernel* instruction vocabulary that each kernel filters down to the steps it owns. It belongs to no single kernel, so it takes no kernel's name |
| `MutationKernel*` | Types the mutation kernel owns: `MutationKernelStep`, `MutationKernelCaptureStep`, `MutationKernelTransferStep`, `MutationKernelCaptures`, `MutationKernelCommitResult` |
| `PresentationKernel*` | Types the presentation kernel owns: `PresentationKernelStep`, `PresentationKernelNarrateStep` |
| `ExecutorDescribeStep` | **Not renamed.** It is owned by `executorTypes.ts` and reused verbatim; renaming would steal it from the executor |

**State the reason for `KernelStep`, not just the exception** --- it reads as an inconsistency, and the next reader will "fix" it by prefixing it, destroying the one distinction the scheme gets right.

### Three play-time questions

Area **topology**, **room membership**, and the **eviction ladder** answer different questions (instances of [graph roles](#graph-roles-shared-shape-different-authority)):

| Question | Domain | Play expression (today) |
| --- | --- | --- |
| Which **exits** exist from this room at this perspective? | Area authored graph -> exit **projection** | Navigable affordances (`topology.exits`) |
| Which **room** is this character in; who is on the roster? | Play-time **membership** | `ludicGraph` nodes, adjacency index; roster hydrated at read time |
| **Where can this character legally be placed** given their asset access? | **Eviction ladder** (`RoomStack`) | Trim frames to accessible assets; top surviving frame -> proposed room; membership apply when endpoint differs (connect: from nowhere; asset loss: from illegal room) |

Exit topology does **not** imply roster membership. Membership does **not** define exits. The ladder is **not** roster membership --- it is **character-local evidence** for resolving a legal membership endpoint. Consumers that need several views compose **separate projections**.

### Eviction ladder

When the world is built from **layered assets** (canon plus temporary or personal overlays), a character can occupy rooms that exist only while certain assets remain accessible. **`Meta::Character.RoomStack`** answers one question under that constraint:

**Where can this character legally be placed in play, given their current asset access?**

**Shape:** an ordered stack of frames `{ asset, room }` from root outward. Outermost frame aligns with **current** presence at the deepest active asset layer; inner frames are **fallback presences** still valid when outer layers are stripped away.

**Purpose:** not a travel diary or breadcrumb log. The stack is maintained in **trim-ready shape** so resolution is always: filter to accessible assets, read the top frame, apply membership when the endpoint must change.

#### Three roles (one storage shape)

| Role | Question | Typical ingress |
| --- | --- | --- |
| **Resolve legal placement** | After trim, what room is legal? | Connect (place **from nowhere**); asset visibility loss (move **from a room they can no longer occupy**) |
| **Maintain stack on intentional moves** | While placing at `targetRoomId`, keep frames aligned for future resolution | Navigate (extend / rewrite-tail / fork in same transact as membership) |
| **Bookkeeping-only trim** | Did asset access change without changing the legal room? | Asset trim when top frame still matches current membership (no `Character Moved`) |

**Resolution triggers** share the same mechanics (`trimRoomStackToAccessibleAssets`, top frame, membership apply when endpoint changes). They differ mainly in **starting membership state**:

| Trigger | Starting state | Outcome when legal room differs |
| --- | --- | --- |
| **Connect** | Out of play --- purged from `ludicGraph` / adjacency; ladder **retained** on disconnect | Place at resolved room (`froms: []` -> `to`) |
| **Asset visibility** | In play at a room that may be invalid after asset loss | Relocate to resolved room (`froms: [illegal...]` -> `to`) |

**Disconnect asymmetry:** disconnect **purges** authoritative play membership (graph nodes, adjacency) but **preserves** `RoomStack`. That preserved stack is the retained answer to "where can they legally go when they return?" --- connect resolves from it without reconstructing history.

**Navigate maintenance** (conceptual operations --- compare destination **asset chain** to the current ladder):

| Operation | When | Effect on ladder |
| --- | --- | --- |
| **Extend rung** | Destination chain **continues** the current chain (adds a further asset layer) | Push a new outer frame |
| **Rewrite tail rung** | Same chain prefix and same deepest asset; different room (lateral move within the layer) | Replace the outer frame's room only |
| **Fork** | Destination chain **diverges** from the current branch (sibling asset at some depth) | Truncate abandoned branch; set the new tail frame |

Example (asset visibility): while a limited-time event overlay is active, middle rungs look like inert bookkeeping. When the event assets deactivate, trim removes the overlay rungs in one pass and lands the character on the last still-valid inner presence (for example suburbs in canon, not a vanished circus tent).

**Relationship to room membership:** membership is **where the character is now** (roster, fan-in, `Character Moved`). The ladder is **how we compute a legal endpoint** when membership is missing (connect) or points at an inaccessible layer (asset loss). A trim that only fixes the ladder while the membership endpoint stays the same is not a membership change. A trim or connect resolution that changes the endpoint is a real move --- membership apply owns that placement.

Code paths: [`AGENT.implementation.md`](AGENT.implementation.md#eviction-ladder-roomstack-storage). Normative rules: [`AGENT.contract.md`](AGENT.contract.md#eviction-ladder-roomstack-storage).

---

## Target mental model (not yet enforced in contract or storage)

Operator design for play-time relational mutations (including unknowns): [`../../diegeticLogic/AGENT.md`](../../diegeticLogic/AGENT.md).

### Fractal position graphs (container scale and edges)

The same **node + edge** pattern recurs at finer granularity beyond room character nodes:

```text
Area.ludicGraph              Room.ludicGraph (shipped v1)      Container graph (future)
  rooms, macro edges    ->    characters (nodes only)       ->  inventory / nested objects
  Exit, bearing, ...        in-room edges (slice 5+)            In, On, ...
```

**Area scale (authored, largely shipped):** relates rooms and region participants; Exit edges project to **navigable affordances** via `projectRoomExits`. Other edge kinds may express **non-traversable** spatial facts (e.g. "north of" without a door).

**Container scale (D16 shipped v1):** **`Meta::Character.ludicGraph`** hosts held **`OBJECT#`** inventory nodes; reverse via **`POSITION#CHARACTER#...`** adjacency. Object **`OBJECT#`** / Area hosts deferred until needed.

**The container corner of this ladder is superseded by [Wholes, parts, and ports](#wholes-parts-and-ports) below** (2026-08-07). "Container graph (future)" named the level without saying what a level *is*; the next subsection does, and it is the shape any object-scale work should be built against.

### Abstraction Fractal

**Status: Target, and the name is locked (2026-08-07).** The organizing principle for composition above and below the human-convenience scale of objects: **the same relation at every level, with no privileged one.** Things are Objects at some scale, related by part-of, up and down. See [Wholes, parts, and ports](#wholes-parts-and-ports) for the shape that realizes it.

**There is no `AbstractionFractal` type, entity, or record.** The name is the principle, not a thing in the world or in the schema. This is stated first because the name reads like a noun while asserting that **there is nothing distinctive at any level to type** --- and minting the type would falsify the claim the name exists to make. If you find yourself writing one, the design has gone wrong somewhere upstream.

**What the name commits to, and what earns it.** *Fractal* is a claim, not a flourish: self-similarity across scale. Two properties carry it, and both are demonstrated rather than hoped for --- **composition is not a tree** (one part can have two wholes, neither containing the other) and **no level is privileged** (a chain can run four deep with every interior term being both a part of what contains it and a whole of what it contains).

**Three departures from the metaphor, recorded here rather than left to the plan** --- a durable doc that adopts a metaphor without its limits is how the metaphor becomes the argument:

| Departure | Nature |
| --- | --- |
| **A DAG, not a tree** | Permanent. One part, two wholes, neither containing the other, is a requirement rather than a preference --- so traversal is a DAG walk, not tree recursion |
| **Finite depth, with a base case** | A real fractal recurses infinitely; this one bottoms out at leaf objects. **Whether the bottom is uniform --- whether a plain lantern uses the same presence mechanism as a rope --- is undecided**, and it is the base case the self-similarity claim rests on |
| **Earned below the room, aspirational above it** | `EphemeraMembershipHostId` is `Room \| Character`. The claims hold within object composition; **Room/Area containment is a structure of different provenance** (authored asset-stack merge, not play-time graph mutation), so the room is still a privileged level |

**The third departure carries a visibility hazard, not merely a cost.** Encapsulation already makes the room/area seam **less visible without making it less real**, and a name asserting uniformity makes it harder still to see. The failure mode is a reader concluding the ladder is uniform because nothing complained. **Do not read quiet as resolution at that seam.**

**What would retire the name:** composition, functional-state aggregate, and multi-host extent turning out to be **three genuinely unlike things** rather than one substrate with distinct relation kinds above it. The name assumes one substrate; it is falsifiable on that, and current evidence runs the other way.

### Wholes, parts, and ports

**Status: Target, and deliberately narrow.** **Three** **shape** claims, and nothing else. The first two were fixed as a **locked frame** on 2026-08-06 after the design work that produced them stopped moving, and the third on 2026-08-09; recorded here, ahead of implementation, because everything still being designed is being designed *inside* them, and a reader who does not know them will mis-read the code that eventually lands. No claim names a record format, an identifier scheme, or a hosting model.

1. **A whole has its own graph, with a root node.** Parts are nodes in it; part relations are edges in it. A whole is therefore *both* a graph and a node in another graph --- `EphemeraLudicGraph` is the recursive type, and "the same relation at every level" is a property of the data rather than a claim about the model.
2. **Boundary crossings are mediated by an explicit binding the interior owns** --- not by direct addressing of interior nodes from outside. That binding is a **port**.
3. **Every `ludicGraph` has the same internal structure, whatever kind of host it belongs to.** Exactly **one** root node, **present in the graph's own node list** and therefore usable as an endpoint of relations like any other node, with the graph carrying a **designation of which node that is**. Object, Room, Character, Area --- and anything that later acquires a graph --- all look the same inside. **A root node is not a privileged kind of node:** the same object is the root of its own graph and an ordinary member of its container's, which is *whole and part are roles, not kinds* restated at the node level. Do not mint a root-node type, and do not write a rule that gives roots different behaviour.

**Clause 3 is conditional, and that is the whole of its scope: it constrains graphs that exist and mints none.** It does **not** say which things are hosts, and it does **not** put Room, Area or Feature into the part-of ladder --- **a uniform graph interior is not a uniform containment ladder.** Reading an inventory claim out of a structure claim is the specific error to avoid here; see the warning below on the room boundary, which clause 3 leaves exactly as it was.

**Vocabulary this establishes:**

| Term | Means |
| --- | --- |
| **Whole** | **A way of referring to something while discussing its parts --- not a type, not a category, and not a thing anything can be a member of.** *"The whole comprising these parts."* Any host, viewed from the inside. **It denotes nothing that "host with a root node" does not already denote**, and clause 3 makes that identity exact rather than approximate |
| **Part** | A node in a host's graph other than the root, reached from the root by a containment edge. **The counterpart term**, used when discussing the thing that contains it |
| *(both, of one object)* | **Whole and part are roles relative to a level, not kinds of object.** The same thing is a part of what contains it and a whole of what it contains, **simultaneously and at every level** --- a string is a part of a machine and a whole of its spans. Any rule that gives parts and wholes different behaviour is therefore not a rule at all, since it assigns two behaviours to one object. **Do not type either word.** The failure mode is live rather than hypothetical: a *room-or-whole* fork was written into design work on 2026-08-09, two days after this claim was locked, treating a room as though it were not a whole |
| **Port** | A **single-use** boundary slot on a whole, allocated by that whole: **one** port records **one** crossing between two ludic graphs. Two connections to the same host are two ports |
| **Egress / ingress** | A port's two ends --- the host it exits to, and its presence on that host's side |
| **Coarsening** | Failed addressing resolves to the **last successfully addressed host** rather than dangling. `OBJECT#BAG:4` with no live port 4 reads as `OBJECT#BAG`: "tied to the bag's strap" degrades to "tied to the bag" |
| **Scale-relative truth** | The model may give **different** answers at different levels with **both correct** --- the coarse one is not an approximation of the fine one. The requirement is that answers be *consistent*, never that they be the same |

**What a port number is not.** This is the load-bearing half, and it is recorded here rather than left to inference because the construct produced two misreadings of the same family within a day, both of which propagated before being caught. A port number is **not** a name for the interior node behind it (`OBJECT#ROPE:1` does not identify a part --- the part is an ordinary nominal id, and the port merely has an edge to it); **not** a reusable public interface; **not** a fan-out point (one interior edge, one exterior referrer); and **not** evidence about the interior at all, since numbering is a property of the *boundary*.

**A port is a scale boundary, not a relay.** The two edges a port joins need not carry the same kind and usually will not: `PowerCord -[ThreadsInto]-> FLASHLIGHT:1` outside, `port 1 -[SolderedTo]-> BatteryCase` inside. Both true, neither a copy --- two relations at different scales. Do **not** build a compatibility matrix across the boundary; cross-boundary coherence is authoring's and improvisation's job, not the representation's.

**Why the shape is worth fixing before the details are settled.** The payoff is **encapsulation, not traversal**: a whole's ports are its published interface and its parts are the implementation, so **interior repartitioning stops being externally breaking**. That extends the invariance across *time* as well as across levels --- a thing can decompose or reabsorb without any external reference knowing what scale it was at.

**One warning that must travel with this entry.** Encapsulation means external code cannot see what scale a thing is at, which is exactly what invariance requires and also exactly what would let a real level asymmetry go unremarked. **`EphemeraMembershipHostId` is `Room | Character`, and the room boundary is a seam of different provenance** --- authored asset-stack merge, not play-time graph mutation. The claims above are earned for object interiors and **aspirational for the ladder above the room**. The failure mode is a future reader concluding the fractal is uniform because nothing complained.

**What is *not* settled, and must not be inferred from this entry:** port identity and reuse, numbered-versus-named and the separator character, where a port record's two halves are stored, everything on the write side of scale change (`divide` / `merge`), **what the root-designating field is called or typed**, and --- the one most likely to be read as included --- **whether Room, Area or Feature belong in the part-of ladder at all.** Clause 3 makes graph *interiors* uniform and says nothing about the containment ladder above the room; that remains open, and the room-boundary warning below is a warning about exactly that. **Also unsettled: what relation kind joins a root to its members.** `HostRelationalEdgeKind` is `'On' | 'Under' | 'Against' | 'Custom'` --- the model has no containment kind at all, so clause 3's *usable as an endpoint* currently has nothing to be an endpoint of. Those are live in [`AGENT.abstractionLayers.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.abstractionLayers.planning.md), whose "What is not locked" section is authoritative about which is which.

**What would re-open these two claims.** Not a preference, not a cheaper-looking alternative, and not a rival proposal that also works: **a corpus case either clause cannot represent**, or a demonstration that the encapsulation claim fails where it was bought --- an interior repartitioning that still breaks external references. Either lifts the clause **by name**, in the plan's discussion record. It is not eroded by exception.

### Authored vs play graphs

- **Area graph** may list a Character as an Area **participant** (authored scope) --- distinct from **runtime presence** in a room graph.
- **Play mutations** (connect, navigate, pick up, place) update **play graphs**; **projections** feed perception, affordance WML, nav, and LLM context.

### Map Position facets (x/y)

WML **Position** facets on maps are a **separate** authoring idiom today ([`packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md`](../../../../packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md)). Target relationship to room graphs (compile-time hint vs runtime edge) is **undecided**.

---

## Graduation rule

When a **target mental model** ships in code and tests, **move** its description from **Target mental model** to **Shipped mental model**. Add matching **must/must-not** obligations to [`AGENT.contract.md`](AGENT.contract.md) and paths to [`AGENT.implementation.md`](AGENT.implementation.md).
