# Positions --- concepts and vocabulary

This file records **mental models and vocabulary** for `mtw.ephemera.positions` --- what positions **mean** in the game world, not how we migrate or wire code. Normative obligations for shipped behavior: [`AGENT.contract.md`](AGENT.contract.md). Code map: [`AGENT.implementation.md`](AGENT.implementation.md). Migration sequencing and engineering forks: [`taskPlanning/.../AGENT.positionsDataSource.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md).

Cross-area topology authoring (Area `positionGraph`, Exit edges): [`packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md).

---

## Core vocabulary

| Term | Meaning |
| --- | --- |
| **Position graph** | A `{ nodes, edges }` structure: heterogeneous **nodes** (references to things in space) and uuid-keyed **edges** (typed relationships between endpoints). Same pattern as Area `positionGraph` in WML; may exist at multiple **scales**. |
| **Scale** | Which component **hosts** the graph: Area (macro), Room (in-room), Character/container (inventory), etc. |
| **Authored graph** | Blueprint / asset truth merged at participation order (WML `StandardArea.positionGraph`, future `StandardRoom.positionGraph`). |
| **Play graph** | Ephemera runtime mutations: who is in which room **now**, object placement in play, etc. |
| **Projection** | A **read model** derived from a graph for one consumer (exits for nav, roster for affordance WML, etc.). Projections are filters, not the graph. |
| **Positions lane** | `mtw.ephemera.positions` --- ephemera authority for **play-time** position truth and the mutations that maintain it. |
| **Character presence** | At play time, which **room** a character occupies and who shares that room --- distinct from Area **authored** participation or exit topology. |
| **Room membership** | The play-time fact that a character is **in** a room (and appears on that room's roster). Shipped: **Character node** in that room's **`positionGraph`**; reverse via **adjacency index**; transitional **`RoomId`** / **`activeCharacters`** dual-write (**S2-2**). |
| **Eviction ladder** (`RoomStack`) | Character-local **`{ asset, room }` frames** used to resolve **legal in-play placement** under current asset access --- trim inaccessible outer frames; surviving top frame is the proposed membership room. Kept in **trim-ready shape** on navigate so resolution is a straight-line pop, not a reconstruction. Stored as **`Meta::Character.RoomStack`** (rename to match vocabulary may follow). See [Eviction ladder (shipped)](#eviction-ladder-shipped). |
| **Room asset stack** | Which assets **participate in composing** a room's WML at render time (participation order on **`Meta::Room`**). Answers a **render merge** question --- not where the character **is**, and not the eviction ladder. |

---

## Shipped mental model (aligned with play truth today)

### Room play graph + adjacency reverse index (slice 2)

At play time, room membership is stored as a **room play graph** plus a **reverse adjacency index**:

- Each room hosts **`Meta::Room.positionGraph`** --- character **nodes** (slice 2 v1; no in-room edges yet).
- Each character has **adjacency rows** (`CHARACTER#` PK, `POSITION#ROOM#...` SK) pointing at host room(s).
- **Transitional dual-write:** `activeCharacters` (roster display) and `Meta::Character.RoomId` stay in sync at persist until initiative close (**S2-6**). Gateway reads prefer stored graph + adjacency; bootstrap fallbacks use legacy fields when adjacency/graph absent.

A character should appear in **at most one** room graph at steady state; duplicate membership (drift) is **visible** in the adjacency array and repaired by end-state apply (**S2-4**).

### Three play-time questions

Area **topology**, **room membership**, and the **eviction ladder** answer different questions:

| Question | Domain | Play expression (today) |
| --- | --- | --- |
| Which **exits** exist from this room at this perspective? | Area authored graph -> exit **projection** | Navigable affordances (`topology.exits`) |
| Which **room** is this character in; who is on the roster? | Play-time **membership** | `positionGraph` nodes, adjacency index, roster projection from `activeCharacters` |
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
| **Bookkeeping-only trim** | Did asset access change without changing the legal room? | Asset trim when top frame still matches current membership (**S1-9** --- no `Character Moved`) |

**Resolution triggers** share the same mechanics (`trimRoomStackToAccessibleAssets`, top frame, membership apply when endpoint changes). They differ mainly in **starting membership state**:

| Trigger | Starting state | Outcome when legal room differs |
| --- | --- | --- |
| **Connect** | Out of play --- purged from `positionGraph` / adjacency; ladder **retained** on disconnect | Place at resolved room (`froms: []` -> `to`) |
| **Asset visibility** | In play at a room that may be invalid after asset loss | Relocate to resolved room (`froms: [illegal...]` -> `to`) |

**Disconnect asymmetry:** disconnect **purges** authoritative play membership (graph nodes, adjacency, `RoomId`) but **preserves** `RoomStack`. That preserved stack is the retained answer to "where can they legally go when they return?" --- connect resolves from it without reconstructing history.

**Navigate maintenance** (conceptual operations --- compare destination **asset chain** to the current ladder):

| Operation | When | Effect on ladder |
| --- | --- | --- |
| **Extend rung** | Destination chain **continues** the current chain (adds a further asset layer) | Push a new outer frame |
| **Rewrite tail rung** | Same chain prefix and same deepest asset; different room (lateral move within the layer) | Replace the outer frame's room only |
| **Fork** | Destination chain **diverges** from the current branch (sibling asset at some depth) | Truncate abandoned branch; set the new tail frame |

Example (asset visibility): while a limited-time event overlay is active, middle rungs look like inert bookkeeping. When the event assets deactivate, trim removes the overlay rungs in one pass and lands the character on the last still-valid inner presence (for example suburbs in canon, not a vanished circus tent).

**Relationship to room membership:** membership is **where the character is now** (roster, fan-in, `Character Moved`). The ladder is **how we compute a legal endpoint** when membership is missing (connect) or points at an inaccessible layer (asset loss). A trim that only fixes the ladder while the membership endpoint stays the same is not a membership change (**S1-9**). A trim or connect resolution that changes the endpoint is a real move --- membership apply owns that placement.

Code paths: [`AGENT.implementation.md`](AGENT.implementation.md#eviction-ladder-roomstack-storage). Normative rules: [`AGENT.contract.md`](AGENT.contract.md#eviction-ladder-roomstack-storage).

---

## Target mental model (not yet enforced in contract or storage)

### Fractal position graphs (container scale and edges)

The same **node + edge** pattern recurs at finer granularity beyond room character nodes:

```text
Area.positionGraph          Room.positionGraph (shipped v1)   Container graph (future)
  rooms, macro edges    ->    characters (nodes only)       ->  inventory / nested objects
  Exit, bearing, ...        in-room edges (slice 5+)            In, On, ...
```

**Area scale (authored, largely shipped):** relates rooms and region participants; Exit edges project to **navigable affordances** via `projectRoomExits`. Other edge kinds may express **non-traversable** spatial facts (e.g. "north of" without a door).

**Room scale (shipped v1):** each room hosts a play graph with **character nodes**. In-room edges and object nodes land in slice **5+**.

**Container scale (future):** a Character (or held Object) hosts a graph for inventory and nested placement ("glass on tray on table", "broom against wall").

### Authored vs play graphs

- **Area graph** may list a Character as an Area **participant** (authored scope) --- distinct from **runtime presence** in a room graph.
- **Play mutations** (connect, navigate, pick up, place) update **play graphs** (or interim flat fields until graphs land); **projections** feed perception, affordance WML, nav, and LLM context.

### Objects and `mtw.ephemera.objects`

Today `Meta::Room.objects` is a **flat list** (Coyote staging). Target: object placement is **edges in a room (or container) graph**. The objects DataSource may remain a command/event lane while **positions** owns play-time graph membership --- or responsibilities merge over time. See [`../objects/AGENT.md`](../objects/AGENT.md).

### Map Position facets (x/y)

WML **Position** facets on maps are a **separate** authoring idiom today ([`packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md`](../../../../packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md)). Target relationship to room graphs (compile-time hint vs runtime edge) is **undecided**.

---

## Graduation rule

When a **target mental model** ships in code and tests, **move** its description from **Target mental model** to **Shipped mental model**. Add matching **must/must-not** obligations to [`AGENT.contract.md`](AGENT.contract.md) and paths to [`AGENT.implementation.md`](AGENT.implementation.md).

Implementation sequencing, module boundaries, and open engineering forks stay in the task plan [**Open decisions**](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md#open-decisions-implementation--plan-only) --- not in this file ([`taskPlanning/AGENT.md`](../../../../taskPlanning/AGENT.md#open-decisions-implementation--plan-only)).
