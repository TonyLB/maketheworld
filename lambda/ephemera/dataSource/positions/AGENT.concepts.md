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
| **Room membership** | The play-time fact that a character is **in** a room (and appears on that room's roster). Target: a **node** in that room's play graph; shipped interim: scalar `RoomId` plus roster list kept in sync. |

---

## Shipped mental model (aligned with play truth today)

### Play membership is flat, not graph-shaped yet

At play time, room membership is expressed as **paired flat fields**, not as nodes in a room `positionGraph`:

- Each character has a current **`RoomId`** (and optional **`RoomStack`** for nested context).
- Each room has an **`activeCharacters`** roster listing who is present.

These are **two views of the same membership fact** and must stay consistent. They are **projections of membership** we have not yet stored as graph nodes and edges.

### Two questions, two domains

Area **topology** and in-room **membership** answer different questions:

| Question | Domain | Play expression (today) |
| --- | --- | --- |
| Which **exits** exist from this room at this perspective? | Area authored graph -> exit **projection** | Navigable affordances (`topology.exits`) |
| Which **room** is this character in; who is on the roster? | Play-time **position** / membership | `RoomId`, `activeCharacters`, roster projections |

Exit topology does **not** imply roster membership, and roster membership does **not** define exits. Consumers that need both (for example affordance WML) compose **separate projections**.

---

## Target mental model (not yet enforced in contract or storage)

### Fractal position graphs

The same **node + edge** pattern recurs at finer granularity:

```text
Area.positionGraph          Room.positionGraph (future)     Container graph (future)
  rooms, macro edges    ->    characters, objects, features  ->  inventory / nested objects
  Exit, bearing, ...        On, Against, Inside, ...          In, On, ...
```

**Area scale (authored, largely shipped):** relates rooms and region participants; Exit edges project to **navigable affordances** via `projectRoomExits`. Other edge kinds may express **non-traversable** spatial facts (e.g. "north of" without a door).

**Room scale (future):** each room hosts a play (and optionally authored) graph. **Character presence** in a room means: the **Character node appears in that room's graph** --- not only a scalar `RoomId` duplicated elsewhere.

**Container scale (future):** a Character (or held Object) hosts a graph for inventory and nested placement ("glass on tray on table", "broom against wall").

### Characters are atomic across rooms

At play time a character should appear in **at most one room graph** (enforced at the positions authority). `RoomId` and roster lists become **projections** of that invariant, not independent sources of truth.

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
