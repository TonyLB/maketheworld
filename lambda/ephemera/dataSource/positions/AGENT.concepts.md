# Positions --- concepts and vocabulary

This file records **mental models and vocabulary** for `mtw.ephemera.positions` --- what positions **mean** in the game world, not how we migrate or wire code. Normative obligations for shipped behavior: [`AGENT.contract.md`](AGENT.contract.md). Code map: [`AGENT.implementation.md`](AGENT.implementation.md).

Cross-area topology authoring (Area `positionGraph`, Exit edges): [`packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md).

---

## Core vocabulary

| Term | Meaning |
| --- | --- |
| **Position graph** | A `{ nodes, edges }` structure: heterogeneous **nodes** (references to things in space) and uuid-keyed **edges** (typed relationships between endpoints). Same pattern as Area `positionGraph` in WML; may exist at multiple **scales**. |
| **Graph role** | Which question a graph instance answers and **who may mutate it** --- see [Graph roles](#graph-roles-shared-shape-different-authority). Same shape, different authority boundary. |
| **Scale** | Which component **hosts** the graph: Area (macro), Room (in-room), Character/container (inventory), etc. |
| **Authored graph** | Blueprint / asset truth merged at participation order (WML `StandardArea.positionGraph`, future `StandardRoom.positionGraph`). |
| **Play graph** | Ephemera runtime mutations: who is in which room **now**, object placement in play, etc. |
| **Projection** | A **read model** derived from a graph for one consumer (exits for nav, roster for affordance WML, etc.). Projections are filters, not the graph. |
| **Positions lane** | `mtw.ephemera.positions` --- ephemera authority for **play-time** position truth and the mutations that maintain it. |
| **Character presence** | At play time, which **room** a character occupies and who shares that room --- distinct from Area **authored** participation or exit topology. |
| **Room membership** | The play-time fact that a character is **in** a room (and appears on that room's roster). Shipped: **Character node** in that room's **`positionGraph`**; reverse via **adjacency index**. Roster display hydrates at read time. |
| **Eviction ladder** (`RoomStack`) | Character-local **`{ asset, room }` frames** used to resolve **legal in-play placement** under current asset access --- trim inaccessible outer frames; surviving top frame is the proposed membership room. Kept in **trim-ready shape** on navigate so resolution is a straight-line pop, not a reconstruction. Stored as **`Meta::Character.RoomStack`** (rename to match vocabulary may follow). See [Eviction ladder (shipped)](#eviction-ladder-shipped). |
| **Room asset stack** | Which assets **participate in composing** a room's WML at render time (participation order on **`Meta::Room`**). Answers a **render merge** question --- not where the character **is**, and not the eviction ladder. |
| **`EphemeraPositionGraph`** | Host-bound in-memory play manipulation model (class in [`positionGraph/`](positionGraph/)); sole ephemera primitive for membership + relational simulation after read-boundary assembly. |

---

## Graph roles (shared shape, different authority)

The `{ nodes, edges }` pattern recurs across the system. **Graph** names a truth **shape**, not a single scope-of-authority boundary. Instances differ by **which question they answer** and **who writes them**.

| Graph role | Question | Authoritative writer | Steady-state example |
| --- | --- | --- | --- |
| **Authored blueprint** | What did we **design**? | Assets / WML merge | Area `positionGraph` (Exit edges, macro layout) |
| **Play manipulation** | Where is everyone **now**? | `mtw.ephemera.positions` | `Meta::Room.positionGraph` + adjacency index; simulated via **`EphemeraPositionGraph`** |
| **Materialized presentation** | What does this **consumer** see at this perspective? | Consumer-specific materialization (e.g. affordanceCache) | `Affordance::` row `topology.exits` |
| **Ephemeral presentation** | What is the **wire-ready** view at read time? | Ephemera compose (cross-cache) | Hydrated roster in `AffordanceRoomDeliverable` |

**Invariant:** membership truth does not define exits; exit truth does not imply roster membership. Consumers that need several views compose **separate projections** --- see [Three play-time questions](#three-play-time-questions) and [`internalCache/AGENT.md`](../../internalCache/AGENT.md) (exit vs membership presentation pipelines).

### Type boundary (storage vs gateway read envelope)

Five names, five roles --- same `{ nodes, edges }` shape, different **authority** and **layer**:

| Type | Layer | Role |
| --- | --- | --- |
| **`EphemeraPositionGraphFieldPayload`** | Dynamo `Meta::*.positionGraph` attribute | Stored attribute; Character + Object **identity** nodes; `hostId` omitted (row `EphemeraId` is authoritative) |
| **`EphemeraPositionGraphData`** | `@tonylb/mtw-interfaces` | Manipulation JSON with **`hostId`**; `toJSON()` / read-boundary assemble shape |
| **`EphemeraPositionGraph`** | [`lambda/ephemera/.../positionGraph/`](positionGraph/) | Host-bound manipulation **class**; immutable simulation API |
| **`PlayPositionGraph`** | `@tonylb/mtw-gateways` | Topology-only **read envelope** (alias of `StandardPositionGraphData`) |
| **`StandardPositionGraph`** | `@tonylb/mtw-wml` | Authored blueprint (Exit-only v1; asset merge authority) |

**Data flow:** Dynamo field + row PK -> `fromFieldPayload` -> **`EphemeraPositionGraph`** -> simulate -> `toStored()` persist; **`internalCache.Positions.getPositionGraph`** -> wrapper **`fromPlayEnvelope`** -> class. Module detail: [`positionGraph/AGENT.md`](positionGraph/AGENT.md).

Roster **display** (`DisplayName`, `SessionIds`, ...) hydrates at read time via ephemera **`getRoomCharacterList`** ([`../../internalCache/hydrateRoomRoster.ts`](../../internalCache/hydrateRoomRoster.ts)) --- topology ids from **`Positions.getPositionGraph`** -> **`graph.characterIds`**, display from **`CharacterMeta`** + **`CharacterSessions`**, not from stored `positionGraph` nodes. Ephemera **`Positions.set(graph)`** seeds memo from coordinator **`postApplyGraphs`** after membership apply; roster is never cached on the graph envelope.

#### WML convergence (future)

Relational edge **wire types** should stay aligned between **`EphemeraPositionRelationalEdgeData`** (stored play JSON) and future WML **`Relational`** tag members (BD-2/BD-3). **Authority** stays separate: WML **`StandardPositionGraph`** owns authored blueprint and seed/snapshot import; **`EphemeraPositionGraph`** owns live play mutation. Adapters (`fromPlayEnvelope`, future `fromWML`) are the seam --- do not merge classes or Dynamo write paths. Future WML **`EdgeList`** consolidation is deferred until heterogeneous room/container edge lists ship in mtw-wml.

**Cross-links:** gateway handler scope --- [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md); authored exit topology --- [`packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md); compose paths --- [`../../internalCache/AGENT.md`](../../internalCache/AGENT.md). Normative scope: [`AGENT.contract.md`](AGENT.contract.md#scope-of-authority-manipulation-vs-presentation).

---

## Shipped mental model (aligned with play truth today)

### Room play graph + adjacency reverse index (slice 2)

**The stance:** the room play graph and its reverse adjacency index are the **sole authority** for play membership. The legacy projections --- **`Meta::Room.activeCharacters`** and **`Meta::Character.RoomId`** --- are neither written nor read as truth. Anything that needs "who is in this room" derives it from the graph; anything that needs "what room is this character in" reads adjacency. Nothing reconstructs membership from a stored projection, and nothing writes one back.

This is why several rules downstream look redundant but are not: forward reads must return empty topology rather than fall back to `activeCharacters`, reverse reads must consult adjacency rather than a stored `RoomId`, and roster *display* fields must be hydrated at read time rather than persisted alongside membership. Each is the same stance applied at a different surface.

At play time, room membership is stored as a **room play graph** plus a **reverse adjacency index**:

- Each room hosts **`Meta::Room.positionGraph`** --- character and object **nodes** (slice 2 character; Phase 4 object) plus in-host **relational edges** (`On`, `Under`, `Against`, `Custom` --- Phase B shipped).
- Each character has **adjacency rows** (`CHARACTER#` PK, `POSITION#ROOM#...` SK) pointing at host room(s).
- Each object has **adjacency rows** (`OBJECT#` PK, `POSITION#ROOM#...` SK) pointing at host room(s) when placed (**I5**).
- **Roster display** is hydrated at read time from **`CharacterMeta`** + **`CharacterSessions`** --- not stored on the room row.

A character should appear in **at most one** room graph at steady state; duplicate membership (drift) is **visible** in the adjacency array and repaired by end-state apply. Objects follow the same steady-state rule at Phase 4 (nodes only); multi-room object adjacency is drift repaired via [`repairObjectPlacementDrift`](membership/repairObjectPlacementDrift.ts).

### Object room placement (Phase 4; nodes only)

Improvisational **`OBJECT#`** placement is **positions-owned** play manipulation:

- **Existence** (improvisation pair + **`Meta::Object`**) lives on the objects lane ([`../objects/AGENT.md`](../objects/AGENT.md)).
- **Where** the object is in play: **`Object`** node on the delivery room **`positionGraph`** + **`OBJECT#`** adjacency row (**I5**).
- **Spawn + place:** existence on the objects lane ([`../objects/AGENT.md`](../objects/AGENT.md#improvisation-storage)); initial room placement via [`applyObjectRoomMembership`](membership/applyObjectRoomMembership.ts) from the objects two-step coordinator ([`spawnOneImprovisationObject`](../objects/spawnImprovisationObjectsBatch.ts)).
- **Place / remove:** [`applyObjectRoomMembership`](membership/applyObjectRoomMembership.ts) end-state apply; emits **`Object Moved`** on **`mtw.ephemera.positions`** (**I4**).
- **In-host relational edges:** [`applyHostRelationalPatch`](manipulation/applyHostRelationalPatch.ts) via [`manipulation/relational/`](manipulation/relational/) coordinators; emits **`Object Relation Changed`** (Phase B shipped). Containment (`in` / inside) deferred to future nesting operator.
- Existence lane, Coyote snapshots, and affordance compose: see [`../objects/AGENT.md`](../objects/AGENT.md).

### Character inventory graph (D16; object nodes only)

Held-object inventory is **positions-owned** play manipulation on the character host:

- **Storage:** optional **`Meta::Character.positionGraph`** --- same **`EphemeraPositionGraphFieldPayload`** shape as room hosts; v1 **Object** nodes only.
- **Reverse index:** **`OBJECT#`** PK + **`POSITION#CHARACTER#...`** SK when held by a character.
- **Read:** **`internalCache.Positions.getPositionGraph(characterId)`** (forward); **`getMembershipContainers(objectId)`** may return **`CHARACTER#`** hosts.
- **Persist primitives:** [`manipulation/kernel/`](manipulation/kernel/) --- character-host graph + adjacency transact items via `commitStepSequence` (slice-1 `characterInventoryTransactItems.ts` retired 2026-07-23).
- **Cross-host apply:** [`manipulation/membership/applyObjectSetTakeHold.ts`](manipulation/membership/applyObjectSetTakeHold.ts) --- atomic room-remove + character-add on **`takeHold`** (shipped). [`manipulation/membership/applyObjectSetDrop.ts`](manipulation/membership/applyObjectSetDrop.ts) --- atomic character-remove + room-add on **`drop`** (shipped). Both use shared adapter + kernel --- **no** new `update*PositionGraphs` fork.

### Manipulation layering (membership transfer)

Membership transfer persist is organized in four layers. Coordinators call the shared adapter + **`commitStepSequence`** kernel (`applyHostEffects` retired 2026-07-23). Kernel API detail: [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md). Normative rules: [`AGENT.contract.md`](AGENT.contract.md#manipulation-persist-layering).

```text
Per-operator ingress            verb-specific args, trusted ids (parse egress, navigate, repair, ...)
        |
        v
Shared membership adapter       froms/to planning, apply mode, membership observation -> HostEffect[]
        |
        v
Manipulation kernel             validate + apply HostEffect[] on affected positionGraphs only
        |
        v
Per-operator coordinators       membership host transfer fact projection, stream/cache/bus bundles
```

**Invariant:** the manipulation kernel does **not** discover priors via **`getMembershipContainers`** --- transfer planning lives in the shared membership adapter upstream.

| Term | Meaning |
| --- | --- |
| **Manipulation kernel** | Graph-grounded persist executor: accept **`HostEffect[]`**, read affected hosts' `positionGraph`, validate, transact, dual-write adjacency |
| **Host effect** | One alteration on a fixed host: add/remove identity node on `positionGraph` + matching adjacency dual-write |
| **Host-local relational patch** | Add/remove **edges** on a fixed host `positionGraph` without changing membership host; second kernel primitive (shipped). [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md#host-local-relational-patch-phase-b-shipped-b4) |
| **Shared membership adapter** | Reusable **transfer planner**: membership observation + apply mode (`end-state` / `bounded`) -> **`HostEffect[]`** + projected `froms`/`to` |
| **Per-operator coordinator** | Verb-specific ingress wrapper: calls shared adapter, then kernel; owns fact/cache/bus bundle |
| **Membership host transfer** | Semantic move between eligible hosts (`ROOM#`, `CHARACTER#` in v1); planned by shared adapter; projected to bus facts as `froms[]` / `to` |
| **Apply mode: end-state** | Planner scrubs all prior membership hosts, places at target |
| **Apply mode: bounded** | Planner scrubs **only** hosts named by trusted ingress (v1 **`takeHold`**: passed `roomId` only --- not end-state multi-room scrub) |
| **Layered vocabulary** | **Kernel** docs: host effects, graph-grounded persist. **Adapter** docs: transfer planning, apply modes. **Bus facts** docs: membership host transfer projection |

### Three play-time questions

Area **topology**, **room membership**, and the **eviction ladder** answer different questions (instances of [graph roles](#graph-roles-shared-shape-different-authority)):

| Question | Domain | Play expression (today) |
| --- | --- | --- |
| Which **exits** exist from this room at this perspective? | Area authored graph -> exit **projection** | Navigable affordances (`topology.exits`) |
| Which **room** is this character in; who is on the roster? | Play-time **membership** | `positionGraph` nodes, adjacency index; roster hydrated at read time |
| **Where can this character legally be placed** given their asset access? | **Eviction ladder** (`RoomStack`) | Trim frames to accessible assets; top surviving frame -> proposed room; membership apply when endpoint differs (connect: from nowhere; asset loss: from illegal room) |

Exit topology does **not** imply roster membership. Membership does **not** define exits. The ladder is **not** roster membership --- it is **character-local evidence** for resolving a legal membership endpoint. Consumers that need several views compose **separate projections**.

### Eviction ladder (shipped)

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
| **Connect** | Out of play --- purged from `positionGraph` / adjacency; ladder **retained** on disconnect | Place at resolved room (`froms: []` -> `to`) |
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
Area.positionGraph          Room.positionGraph (shipped v1)   Container graph (future)
  rooms, macro edges    ->    characters (nodes only)       ->  inventory / nested objects
  Exit, bearing, ...        in-room edges (slice 5+)            In, On, ...
```

**Area scale (authored, largely shipped):** relates rooms and region participants; Exit edges project to **navigable affordances** via `projectRoomExits`. Other edge kinds may express **non-traversable** spatial facts (e.g. "north of" without a door).

**Container scale (D16 shipped v1):** **`Meta::Character.positionGraph`** hosts held **`OBJECT#`** inventory nodes; reverse via **`POSITION#CHARACTER#...`** adjacency. Object **`OBJECT#`** / Area hosts deferred until needed.

### Authored vs play graphs

- **Area graph** may list a Character as an Area **participant** (authored scope) --- distinct from **runtime presence** in a room graph.
- **Play mutations** (connect, navigate, pick up, place) update **play graphs**; **projections** feed perception, affordance WML, nav, and LLM context.

### Map Position facets (x/y)

WML **Position** facets on maps are a **separate** authoring idiom today ([`packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md`](../../../../packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md)). Target relationship to room graphs (compile-time hint vs runtime edge) is **undecided**.

---

## Graduation rule

When a **target mental model** ships in code and tests, **move** its description from **Target mental model** to **Shipped mental model**. Add matching **must/must-not** obligations to [`AGENT.contract.md`](AGENT.contract.md) and paths to [`AGENT.implementation.md`](AGENT.implementation.md).
