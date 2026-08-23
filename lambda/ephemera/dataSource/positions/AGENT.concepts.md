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
| **Play manipulation** | Where is everyone **now**? | `mtw.ephemera.positions` | `Meta::<Kind>.ludicGraph` (any membership host kind) + adjacency index; simulated via **`EphemeraLudicGraph`** |
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

**Room is the worked example here, not the only host.** The same forward-graph shape is stored on every membership host kind as **`Meta::<Kind>.ludicGraph`** (Room, Character, Object, Feature, Area), through one shared serde --- see [Host storage](AGENT.contract.md#host-storage-one-shared-serde-one-documented-exception). Room's `activeCharacters` reconstruction fallback is the one host-side irregularity. **This says nothing about which kinds are levels in a part-of ladder** --- that a kind can host a graph is an inventory fact, not a structure claim (see the [wholes/parts warning](#wholes-parts-and-ports)).

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

### Object-hosted graph (MK2; storage only)

An **`Object`** can itself host a **`ludicGraph`**, the same shared plain shape as the character inventory graph above (MD-1(c)):

- **Storage:** optional **`Meta::Object.ludicGraph`** --- identical **`EphemeraLudicGraphFieldPayload`** shape; empty when absent, no reconstruction source.
- **Read:** **`internalCache.Positions.getLudicGraph(objectId)`** (forward), backed by **`getObjectLudicGraphFromDynamo`**.
- **Persist primitives:** same **`manipulation/kernel/`** `commitStepSequence` path as Room/Character, dispatched via `hostDataCategory`/`graphFromMeta`'s `Meta::Object` branch.
- **Not yet wired:** no route today *produces* a transferMembership/establishRelation step targeting an Object host --- `Object Moved`'s v1 `froms`/`to` endpoints stay **`ROOM#`**/**`CHARACTER#`** only ([`AGENT.contract.md`](AGENT.contract.md), D8). This slice closes the storage-layer dead end LP0 left behind; it does not add a caller that generates Object-hosted membership steps.

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

### Fractal ludic graphs (container scale and edges)

The same **node + edge** pattern recurs at finer granularity beyond room character nodes:

```text
Area.ludicGraph              Room.ludicGraph (shipped v1)      Container graph (future)
  rooms, macro edges    ->    characters (nodes only)       ->  inventory / nested objects
  Exit, bearing, ...        in-room edges (slice 5+)            In, On, ...
```

**Area scale (authored, largely shipped):** relates rooms and region participants; Exit edges project to **navigable affordances** via `projectRoomExits`. Other edge kinds may express **non-traversable** spatial facts (e.g. "north of" without a door).

**Container scale (D16 shipped v1; Object storage MK2):** **`Meta::Character.ludicGraph`** hosts held **`OBJECT#`** inventory nodes; reverse via **`POSITION#CHARACTER#...`** adjacency. **`Meta::Object.ludicGraph`** storage ships as of MK2 (see [Object-hosted graph](#object-hosted-graph-mk2-storage-only) above) --- no route produces an Object-hosted transfer yet, storage only. Area hosts remain deferred until needed.

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
| **Earned below the room, aspirational above it** | ~~`EphemeraMembershipHostId` is `Room \| Character`.~~ **Corrected 2026-08-19 (LP4e): the type is all five kinds** --- `Room \| Character \| Object \| Feature \| Area`, widened by LP0 on 2026-08-16 --- so the *type-level* half of this departure is gone. **The departure itself is not:** the claims hold within object composition; **Room/Area containment is a structure of different provenance** (authored asset-stack merge, not play-time graph mutation), so the room is still a privileged level. **A wide host union is not an earned ladder**, and reading one from the other is the same inference the clause-3 warning below forbids |

**The third departure carries a visibility hazard, not merely a cost.** Encapsulation already makes the room/area seam **less visible without making it less real**, and a name asserting uniformity makes it harder still to see. The failure mode is a reader concluding the ladder is uniform because nothing complained. **Do not read quiet as resolution at that seam.**

**What would retire the name:** composition, functional-state aggregate, and multi-host extent turning out to be **three genuinely unlike things** rather than one substrate with distinct relation kinds above it. The name assumes one substrate; it is falsifiable on that, and current evidence runs the other way.

### Wholes, parts, and ports

**Status: Target, and deliberately narrow.** **Three** **shape** claims, and nothing else. The first two were fixed as a **locked frame** on 2026-08-06 after the design work that produced them stopped moving, and the third on 2026-08-09; recorded here, ahead of implementation, because everything still being designed is being designed *inside* them, and a reader who does not know them will mis-read the code that eventually lands. No claim names a record format, an identifier scheme, or a hosting model.

1. **A whole has its own graph, with a root node.** Parts are nodes in it; part relations are edges in it. A whole is therefore *both* a graph and a node in another graph --- `EphemeraLudicGraph` is the recursive type, and "the same relation at every level" is a property of the data rather than a claim about the model.
2. **Boundary crossings are mediated by an explicit binding the interior owns** --- not by direct addressing of interior nodes from outside. That binding is a **port**. **"Owns" is about the *binding*, not about every value recorded on it, and the difference has been read away once.** This clause says a port exists only because its interior minted it and cannot be conjured from outside; it does **not** say the interior wins every disagreement between what a port records and what the exterior refers to. Some of a port's fields describe the exterior relationship rather than the interior --- which host it faces above all --- and those defer to the exterior reference where one exists to disagree with. **Reading an authority claim out of an ownership claim is the specific error to avoid here**, the same shape as the inventory-out-of-structure warning on clause 3.
3. **Every `ludicGraph` has the same internal structure, whatever kind of host it belongs to.** Exactly **one** root node, **present in the graph's own node list** and therefore usable as an endpoint of relations like any other node, with the graph carrying a **designation of which node that is**. Object, Room, Character, Area --- and anything that later acquires a graph --- all look the same inside. **A root node is not a privileged kind of node:** the same object is the root of its own graph and an ordinary member of its container's, which is *whole and part are roles, not kinds* restated at the node level. Do not mint a root-node type, and do not write a rule that gives roots different behaviour. **The root-in-nodes half of this clause is shipped, not merely designed --- LP4i (2026-08-20).** Every host-bound construction path now includes the root's own node, and `isEphemeraLudicGraphFieldPayload` (`ephemeraMeta.ts`) rejects a stored payload whose root has no backing node, so a stale row fails loudly at the read boundary rather than producing a dangling root. Detection and idempotent repair for existing stale rows: [`ludicGraphStaleStructureSweep`](../../../diagnostics/ludicGraphStaleStructureSweep/) / [`healLudicGraphStructure.ts`](ludicGraph/healLudicGraphStructure.ts).

**Clause 3 is conditional, and that is the whole of its scope: it constrains graphs that exist and mints none.** It does **not** say which things are hosts, and it does **not** put Room, Area or Feature into the part-of ladder --- **a uniform graph interior is not a uniform containment ladder.** Reading an inventory claim out of a structure claim is the specific error to avoid here; see the warning below on the room boundary, which clause 3 leaves exactly as it was.

**Vocabulary this establishes:**

| Term | Means |
| --- | --- |
| **Whole** | **A way of referring to something while discussing its parts --- not a type, not a category, and not a thing anything can be a member of.** *"The whole comprising these parts."* Any host, viewed from the inside. **It denotes nothing that "host with a root node" does not already denote**, and clause 3 makes that identity exact rather than approximate |
| **Part** | A node in a host's graph other than the root, joined to the root by a **`PartOf`** containment edge --- **`niche -PartOf-> wall`**, member to root (see the direction rule below). **The counterpart term**, used when discussing the thing that contains it |
| **Contents** | A node joined to the root by an **`In`** containment edge (**`crystalBall -In-> kitchen`**). **`In` and `PartOf` are two non-exclusive containment kinds** (settled 2026-08-09), so a box's lid is a part, its crystal ball is contents, and a thing may be **both** --- do not write the pair as a mutually-exclusive switch. **The distinction lives on the *edge*, never on the node:** the ball is not a different kind of object from the lid, and it is simultaneously a whole of its own interior. Typing the edge is what keeps this compatible with *whole and part are roles, not kinds*; typing the node would contradict it |
| **Hosting kind / peer kind** | **Target, decided 2026-08-19 (AB-54); not yet enforced anywhere in code.** Relation kinds partition in two. A **hosting kind** --- `On`, `In`, `PartOf` --- puts the subordinate node in **its host's own graph**: a cup on a tray is a node in the tray's `ludicGraph`, and the tray is a node in the room's. A **peer kind** --- `Under`, `Against`, `Custom` --- leaves both endpoints in the same graph and hosts nothing. **`On` joining the hosting side is the whole of what is new**, and the reason is that `On` versus `In` was two entirely different representational structures for a difference that is really about **apprehension** (*`On` admits nested things to referent-search always, `In` sometimes*) --- an attention property, which belongs to `ludicCache`, not to the edge kind. **The partition is read off shipped behaviour rather than imposed on it:** `Under` is already non-hosting (moving a table does not carry the boots under it). **Consequence worth stating because it is a deletion:** nothing *travels* with a moved thing, so carry-closure stops being a traversal and becomes a read of the shard. **This is *the* partition of relation kinds --- there is no second, narrower one.** The older term *containment kind* (`{In, PartOf}`, AB-48, 2026-08-09) named a subset of exactly this partition before `On` joined it, and retired as a named set once AB-54 merged the mechanism; the word *containment* stays, for the phenomenon (a containment subgraph is still a star, see below), but not as a collective noun standing in for `{In, PartOf}`. Where a comment or a doc genuinely means that pair, name the two kinds explicitly rather than reaching for a collective noun --- an unnamed pair can silently acquire a third member, which is exactly how this drift happened |
| *(both, of one object)* | **Whole and part are roles relative to a level, not kinds of object.** The same thing is a part of what contains it and a whole of what it contains, **simultaneously and at every level** --- a string is a part of a machine and a whole of its spans. Any rule that gives parts and wholes different behaviour is therefore not a rule at all, since it assigns two behaviours to one object. **Do not type either word.** The failure mode is live rather than hypothetical: a *room-or-whole* fork was written into design work on 2026-08-09, two days after this claim was locked, treating a room as though it were not a whole |
| **Port** | A **single-use** boundary slot on a whole, allocated by that whole: **one** port records **one** crossing between two ludic graphs. Two connections to the same host are two ports |
| **Egress / ingress** | A port's two ends --- the host it exits to, and its presence on that host's side |
| **Coarsening** | Failed addressing resolves to the **last successfully addressed host** rather than dangling. `OBJECT#BAG#4d1f0ac` with no live port `4d1f0ac` reads as `OBJECT#BAG`: "tied to the bag's strap" degrades to "tied to the bag" |
| **Scale-relative truth** | The model may give **different** answers at different levels with **both correct** --- the coarse one is not an approximation of the fine one. The requirement is that answers be *consistent*, never that they be the same |

**How a port address is written, and the three parts do not have the same standing.** **(i) The separator is a second `#`** --- `OBJECT#ROPE#ab6129d` --- chosen so that `isEphemeraTaggedId` **throws** on a nested form rather than silently affirming it. **Decided 2026-08-17, and scoped: it governs the serde/string form, not the domain type.** **(ii) The port id is a compact opaque token, not an ordinal and not a name.** **Provisional**, with a named rollback line --- do not build anything that depends on tokens being sequential, comparable, or meaningful, and do not cite existing code as evidence the choice was right. **(iii) At the domain level a port-qualified terminal is a *structured* value, not a string**, and **which form is actually stored is still open.** So read the notation below as a way of writing an address down, not as a claim about the persisted shape. **Corrected 2026-08-20** --- this section previously wrote port addresses as `OBJECT#ROPE:1`, with a colon and an ordinal, which contradicted (i) and (ii) in the one document a reader would most reasonably believe.

**What a port id is not.** This is the load-bearing half, and it is recorded here rather than left to inference because the construct produced two misreadings of the same family within a day, both of which propagated before being caught. A port id is **not** a name for the interior node behind it (`OBJECT#ROPE#ab6129d` does not identify a part --- the part is an ordinary nominal id, and the port merely has an edge to it); **not** a reusable public interface; **not** a fan-out point (one interior edge, one exterior referrer); and **not** evidence about the interior at all, since **allocation is a property of the *boundary***.

**A port is a scale boundary, not a relay.** The two edges a port joins need not carry the same kind and usually will not: `PowerCord -[ThreadsInto]-> OBJECT#FLASHLIGHT#7c2e91b` outside, `port 7c2e91b -[SolderedTo]-> BatteryCase` inside. Both true, neither a copy --- two relations at different scales. Do **not** build a compatibility matrix across the boundary; cross-boundary coherence is authoring's and improvisation's job, not the representation's.

> **The *claim* above stands; this *example* is under active question, and the notation fix did not touch that.** A power cord threading into a flashlight is a **spanning object**, and spanning things are modelled as **parts in their own whole's graph** --- so the cord is plausibly a **member of the flashlight's `ludicGraph`**, with no port mediating anything, which would make this illustration demonstrate something other than what it is cited for. **The generalisation being tested is that a crossing keeps getting drawn as a relationship edge because it is real and useful and edge-shaped, not because any structure requires one** --- and this example is one of four recorded instances. Tracked as **AB-57** in [`AGENT.abstractionLayers.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.abstractionLayers.planning.md); **do not build against this example until that row closes**, and do not delete it either --- it is evidence.

**Why the shape is worth fixing before the details are settled.** The payoff is **encapsulation, not traversal**: a whole's ports are its published interface and its parts are the implementation, so **interior repartitioning stops being externally breaking**. That extends the invariance across *time* as well as across levels --- a thing can decompose or reabsorb without any external reference knowing what scale it was at.

**One warning that must travel with this entry.** Encapsulation means external code cannot see what scale a thing is at, which is exactly what invariance requires and also exactly what would let a real level asymmetry go unremarked. **`EphemeraMembershipHostId` is all five kinds as of LP0 (2026-08-16) --- `Room | Character | Object | Feature | Area` --- and the room boundary is still a seam of different provenance** --- authored asset-stack merge, not play-time graph mutation. The claims above are earned for object interiors and **aspirational for the ladder above the room**. The failure mode is a future reader concluding the fractal is uniform because nothing complained.

**What is *not* settled, and must not be inferred from this entry:** port identity and reuse, numbered-versus-named and the separator character, everything on the write side of scale change (`divide` / `merge`), and --- the one most likely to be read as included --- **whether Room or Area belong in the part-of ladder at all.** (**Feature was settled 2026-08-15**, on the case `FEATURE#Wall -PartOf-> FEATURE#Niche`: a wall may host a niche as a part. Room and Area remain open, and Feature's answer does not generalise to them.)

**Containment runs root-to-part, and that is a constructor discipline rather than a structural claim (AB-53, resolved 2026-08-19).** Within any one graph, every containment edge is **incident to the root** (running member -> root, per the direction rule below), so the containment subgraph is a **star**. Multi-level nesting is achieved by **nesting graphs** --- shards inside shards --- not by node-to-node containment edges inside a single graph. **Read this as *how the constructor builds graphs in iteration 1*, not as a property to reason from.** The type does not forbid a node-to-node containment edge and nothing asserts the star topology at runtime; if a use case for multiple levels in one graph arrives, **the discipline is dropped rather than defended.** **What makes that cheap, and why it is recorded here rather than left implicit:** the thing the restriction currently props up is carry-closure, and carry-closure already has a better-specified replacement in AB-5's **mint the whole, move the whole, dissolve the whole** --- which never traverses to discover what travels, and so works on a multi-level graph unchanged. **Two things currently rest on the star topology and must be re-checked if it goes:** `PartOf` cycle detection (unrepresentable today, hence unchecked) and any reader that assumes a containment edge's `to` is the root.

**Edge direction: a relation kind is a predicate on its *subject*. Written down 2026-08-20 (LD-16), having been an unwritten convention every shipped kind already followed --- and its absence is exactly what let a defect through.** `from` is the thing the relation is asserted *about*, `to` is what it is asserted *against*: `glass -On-> tray` is "the glass is on the tray", `boots -Under-> table`, `rope -Against-> tree`. **Containment obeys the same rule:** `crystalBall -In-> kitchen`, `niche -PartOf-> wall` --- **member to root**, and it reads as English in the same direction as the other four.

**The correction this replaced, recorded because the mistake is instructive rather than embarrassing.** AB-4 and premise 9 specified containment as *"root to part"* on 2026-08-09, and the first fixtures written against it (2026-08-19) spelled `ROOM#Kitchen -PartOf-> OBJECT#crystalBall` --- *"the kitchen is part of the crystal ball"* --- inverted against the kind's own name. **What *"root to part"* was actually right about is incidence, not direction:** every containment edge is incident to the root, which is what makes the containment subgraph a **star**, which is what makes cycles unrepresentable. **All of that survives the flip untouched**; only the arrow moved. **The general lesson, and it is the fourth instance of this exact pattern here:** a verdict written in one vocabulary was inherited into a later one --- except the vocabulary that shifted was a convention nobody had written down, so there was nothing to check it against. That is why it is written down now.

**The root-designating field is `rootId`, shipped 2026-08-19 (LP4a).** Typed `EphemeraLudicTerminalId` on `EphemeraLudicGraphData` --- recorded as an input, never derived from the edges (a BFS traversal tree is order-dependent even though the induced edge set is not). A host-bound graph is always rooted at its own host (`rootId === hostId`); a carry closure (`computeCarryClosure`) is rooted at the object being moved. See [`ludicGraph/AGENT.md`](ludicGraph/AGENT.md).

**Where a port record's two halves are stored --- settled 2026-08-06, corrected here 2026-08-15 because this entry still listed it as open and a reader believed it, and corrected a second time on 2026-08-23 for the same reason.** ~~The halves are **complementary, not duplicated**, and the **interior is authoritative**.~~ **Both clauses were too strong, and the second was being read far past what locked it.** A port is stored **interior-side only** --- the whole's own graph carries an **egress list** (port -> the host it exits to) as a top-level element --- **but the record mixes facts of two scopes.** The port's existence, its `portId`, its lifecycle and its `kind` are the **interior's**; which host it faces, and how that relationship is labelled, are **the exterior's**, held here as denormalized copies. So the halves are not complementary (they can contradict each other, and nothing structural prevents it), and the interior is authoritative **about things within its scope** rather than across the board. **The normative form of the rule --- *compare where comparison is possible; where an exterior reference exists it governs* --- is in [`AGENT.contract.md`](AGENT.contract.md#port-records-field-scope-and-the-conflict-rule)**, along with what enforces it; this entry states only the mental model. Clause 2 above carries the matching ownership-versus-authority warning. **What survives unchanged from 2026-08-15:** the *shape* claim that follows. The exterior needs no port record of its own, because **a port-address reference already names both the host and the port** --- `ROOM#A`'s edge to `OBJECT#BOX#ac123e6` says which port of which whole, so exterior port data would restate what the reader already holds. An ingress denormalization may live in `positionCache`; it is a cache, and it is not truth. Clause 3 makes graph *interiors* uniform and says nothing about the containment ladder above the room; that remains open, and the room-boundary warning below is a warning about exactly that. ~~**Also unsettled: what relation kind joins a root to its members.**~~ **Answered 2026-08-09 and recorded here 2026-08-15 --- `In` and `PartOf`, two non-exclusive containment kinds** (see the vocabulary table above). ~~**The gap is now an implementation gap rather than a design one:** `HostRelationalEdgeKind` is still `'On' | 'Under' | 'Against' | 'Custom'` in shipped code, so the model cannot yet say *in* about anything.~~ **Closed 2026-08-19 by LP4c-i:** `HostRelationalEdgeKind` now reads `'On' | 'Under' | 'Against' | 'Custom' | 'In' | 'PartOf'`, so the model can say *in* and *part of*, and clause 3's *usable as an endpoint* has something to be an endpoint of. **The widening is representation only and deliberately inert** --- no ingress path authors a containment edge (BD-2's exclusion is ingress-only, LD-13), and the four ingress-lane copies of the union were left narrow on purpose. Tracked in [`AGENT.abstractionLayers.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.abstractionLayers.planning.md)'s Channel D, which owns re-enabling authoring on the actions lane (it was the ludicGraph-ports plan's until that plan closed 2026-08-23). Those are live in [`AGENT.abstractionLayers.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.abstractionLayers.planning.md), whose "What is not locked" section is authoritative about which is which.

**What would re-open these two claims.** Not a preference, not a cheaper-looking alternative, and not a rival proposal that also works: **a corpus case either clause cannot represent**, or a demonstration that the encapsulation claim fails where it was bought --- an interior repartitioning that still breaks external references. Either lifts the clause **by name**, in the plan's discussion record. It is not eroded by exception.

### Presence as a cover

**Status: Target, and narrower than the section title suggests --- this entry states a *semantics*, and deliberately not a mechanism.** Recorded here ahead of implementation for the same reason as the entry above: the design work that produced it has stopped moving, and rows in [`AGENT.presence.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.presence.planning.md) are phrased in this vocabulary and unreadable without it. **It names no record format and no query path.**

**Nothing here is ever serialised, and this is the first thing to know rather than a caveat at the end.** **There is no `buckets` field, no `cover` record, and none should be minted.** What is **stored** is nodes, edges, and presence bindings; **buckets and the cover are *derived* from those** --- or, for a whole with at most one binding, not even derived, since the single bucket **is** the node list. The cover is **what the storage is graded against**, not a parallel copy of it. **The test, and it is the same one the entry above uses: *would you serialise it?* --- and you would not.**

**Why minting one would be actively wrong, not merely redundant.** A stored bucket set is a **second encoding** of what the edges and bindings already determine, so it can **disagree** with them --- and there is no tiebreak, because the derived answer is the definition. That is the same reasoning that makes presence **implicit** for a whole with one binding: a stored presence record there could only ever restate the membership the graph already carries. **If you find yourself writing a bucket table, the question to ask is which stored fact it is duplicating.**

**Read the two senses of *present* first, because everything below uses only one of them and fusing them is the documented failure.**

| Sense | Question it answers | Status |
| --- | --- | --- |
| **Membership** | *Is the whole there at all?* | **Derived** --- from where its parts are. A whole is present in a host because some part of it is |
| **Apprehensibility** | *Does the whole answer "what is here" at that host's scale?* | **Declared**, and **not derivable**. Working name: **apprehension scale**. Not specified here |

**The evidence that they are two, and it is a corpus case rather than an intuition.** A rope and a moonbase computer system with parts scattered across a base have **identical port topology**, and require **different** room-scale answers: you see a rope from any room it passes through, and from a terminal you see *a terminal*, not a computer system. No structural predicate separates them, so apprehensibility must be declared. **What that case does *not* show is that membership must be declared** --- the computer system genuinely *is* present in the lab in the membership sense. **Everything below is the membership sense.**

**The formulation, in four claims.**

1. **Presence is a cover of a whole's graph, indexed by the whole's *presence bindings*** --- the distinguishable ways it is present, **not** by the set of hosts it is present in. For each binding, presence names a subset of the whole's nodes: the part of the whole that is *there*. **The index is finer than the host set, and that is the claim**: one host may hold **two** bindings into the same whole, and those are **two buckets**, not one. **A grappling hook gun that is part of a contraption spanning two rooms has one host --- the contraption --- and two disjoint buckets, inherited from the contraption's two.** Collapsing them by host merges exactly the split that makes the case work. **Why it must be this way rather than merely may:** binding arity is **inherited** from the parent, and the host set is not, so host-indexing discards the inherited distinctions.
2. **The cover ranges over *nodes only*.** Edges are not bucket members. **An edge may therefore span two buckets, and this is required rather than tolerated** --- a thread whose spans connect across rooms is how a route through those rooms stays recoverable, and eliminating cross-bucket edges would delete the structure that makes it work.
3. **Buckets may overlap**, and their **union is every node** --- *totality*. **The root is in every bucket**, unconditionally, and is exempt not from coverage but from needing an edge to establish it: the root **is** the whole, so its membership is definitional rather than derived.
4. **Totality's domain is *hosted* wholes.** A whole with no hosts has an empty cover and is **outside** the invariant rather than in violation of it. Hostless wholes are representable --- disconnected characters are one, and they persist today.

**Aggregating the buckets from every binding reconstitutes every *node* of the graph.** That is the property the formulation exists to guarantee --- and it is a claim about **nodes only**, because that is all the cover ranges over.

**Do not read that as *reconstitutes the graph*.** Edges are not bucket members, so aggregation neither recovers them nor needs to: **edges come from the graph, which is what is stored.** The failure this guards against is concrete rather than pedantic --- **an aggregation built as a per-bucket edge union silently drops every edge that spans two buckets**, and those are required by this design. A thread whose spans connect across rooms loses exactly the connections that make its route recoverable. **The aggregate of the buckets is the node set; the graph is that node set plus its edges.**

**Totality is maintained *by construction*, and reading that as a weakness is a mistake worth pre-empting.** The host index is minted from where the parts are, so **no fiction can produce a node in no bucket** --- the falsifier hunt closed on being unable to write one, in any of its three forms. **An invariant kept invariant by construction is what a theorem is**, and making the bad state unrepresentable is the design win.

**What the check is therefore aimed at.** *By construction* here is a claim about a **constructor discipline**, true exactly to the extent the discipline is complete --- unlike `a + b > a`, which holds on the axioms. So the check verifies **write paths**, never the world. The known shortfall is **nested** wholes: a whole that straddles two hosts obliges partitioning its parts, and *their* parts, to the depth of the composition. A constructor that stops at the top level leaves a well-formed outer cover over silently unaligned inner ones, and that is the shape of the test worth writing.

**Three guards, and they are anti-reclassification rules rather than falsifiability rescues.** A node found in no bucket is **never** grounds for deciding its tag does not bear presence, **never** grounds for deciding its whole is hostless, and **never** excused by the node being a member of some **other** whole's graph as well. All three convert an observed violation into a retroactive domain exclusion. **The third is the most tempting, because its excuse is frequently true and always irrelevant:** a part may be a node in several graphs at once --- a spring inside a box that is also part of a contraption's mechanism is a node in both --- but **totality is stated per graph**, so being placed in the box says nothing about whether the contraption's cover is well formed. **Under a by-construction invariant these matter more, not less:** if the only remaining failure mode is a constructor bug, a checker that can excuse failures by reclassification is precisely what hides constructor bugs. **Hostlessness is read from the whole's own presence-port list --- a stored field --- never inferred from an empty cover, which is derived from the walk and can therefore launder a bug.**

**Why the recursion terminates.** Membership derives a whole's hosts from its parts' locations, and those parts are wholes in turn --- so the definition needs a base case or it is a fixpoint anchored to nothing. **The base case is the room:** rooms are never *members* of any graph, so the descent bottoms out rather than continuing. **This is load-bearing, and it is inherited rather than owned** --- it holds only while the room boundary stays a seam of different provenance (see the warning in the entry above). If rooms ever enter the part-of ladder, this argument needs rebuilding, not patching.

**Vocabulary this establishes:**

| Term | Means |
| --- | --- |
| **Cover** | The whole family of buckets for one whole. **A semantics, not a stored object** --- the test is *would you serialise it?*, and you would not. What is stored is edges, ports and membership; the cover is what that storage is **graded against** |
| **Bucket** | The subset of a whole's nodes present at one **presence binding**. **Derived, never stored** --- a way of *talking about* the node set a binding reaches, not a record. **Keyed by the binding, not by the host** --- one host may hold two bindings into the same whole, and those are two buckets. The host is a **property** of a bucket, recoverable from it; it is not the key. **Do not index a cover by host**: it is the one error this vocabulary was rewritten to remove, and it silently merges disjoint buckets rather than failing |
| **Presence binding** | One distinguishable way a whole is present --- what the cover is indexed by. **Mechanised today as a presence port**, and the two are not the same claim: *the index is finer than the host set* is semantics, *a binding is realised as a port* is mechanism and stays swappable |
| **Totality** | The invariant that the buckets' union is every node, over hosted wholes |
| **Aggregation** | Recombining every bucket to recover the whole graph. **Overlap dedupes**; it is not an error |
| **Presence port** | A port that carries presence, as opposed to a purely relational crossing (a cord threading into a flashlight locates nothing). **The discriminator does not exist in code** --- `EphemeraLudicGraphPort` has no `kind` --- so *count the presence ports* is not yet a field read, and adding it is an obligation of this design rather than a hoped-for future |

**What is *not* settled and must not be inferred from this entry --- this is the load-bearing half.** **The mechanism is not part of the claim.** The candidate is a walk from each presence port over presence-bearing edges, and it is a **candidate**: ports, `Present` edges and reachability must stay swappable. The swap-out test for anything written above is *would this survive the **walk** being abandoned?* --- buckets, index-by-binding, totality and aggregation do; a reachability rule does not, and neither does *port* as the name of a binding. **Also unsettled:** what sub-graph a bucket *induces* and what becomes of an edge with one endpoint outside it (a **reduction** convention, not a cover question); whether presence writes are transactional with the mutation kernel; and **apprehension scale itself**, which is named above only to keep it distinct from membership.

**What would re-open this entry.** A corpus case the cover cannot express --- **not** a case that violates totality, since by construction none exists and looking for one is a category error. The live target is the **constructor**: a nested straddling whole whose inner covers cannot be built correctly by any discipline stated here. Alternatively, a demonstration that membership must be **declared** after all, which would collapse the two senses back into one and take the derivation argument with it.

### Authored vs play graphs

- **Area graph** may list a Character as an Area **participant** (authored scope) --- distinct from **runtime presence** in a room graph.
- **Play mutations** (connect, navigate, pick up, place) update **play graphs**; **projections** feed perception, affordance WML, nav, and LLM context.

### Map Position facets (x/y)

WML **Position** facets on maps are a **separate** authoring idiom today ([`packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md`](../../../../packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md)). Target relationship to room graphs (compile-time hint vs runtime edge) is **undecided**.

---

## Graduation rule

When a **target mental model** ships in code and tests, **move** its description from **Target mental model** to **Shipped mental model**. Add matching **must/must-not** obligations to [`AGENT.contract.md`](AGENT.contract.md) and paths to [`AGENT.implementation.md`](AGENT.implementation.md).
