# Positions --- concepts and vocabulary

This file records **mental models and vocabulary** for `mtw.ephemera.positions`. Normative obligations for shipped behavior: [`AGENT.contract.md`](AGENT.contract.md). Code map: [`AGENT.implementation.md`](AGENT.implementation.md).

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

---

## Shipped mental model (aligned with code today)

### What positions owns in slice 0

- **Ingress:** `mtw.connections.characters` / `Character Connected` and `Character Disconnected`.
- **Disconnect path:** Positions **directly** updates `Meta::Room.activeCharacters`, invalidates affordance-related caches, and publishes departure messaging when the roster projection **actually changes** (idempotency gate).
- **Connect path:** Positions **bridges** to legacy `CheckLocation` -> `moveCharacter` for roster add, arrival messaging, `CharacterInPlay`, perception threads, and `MapUpdate`.

### Interim storage (not graph-shaped yet)

Play state is still **flat fields**, not a room `positionGraph` in Dynamo:

- `Meta::Character.RoomId` and `RoomStack`
- `Meta::Room.activeCharacters` (roster list)
- `internalCache.RoomCharacterList` memo

Treat these as **projections of a not-yet-materialized play graph**, maintained by positions (partially) and `moveCharacter` (connect and navigate).

### Relationship to Area topology (shipped)

Two questions, two owners:

| Question | Owner | Play expression |
| --- | --- | --- |
| Which **exits** exist from this room at this perspective? | Area authored graph -> `projectRoomExits` -> affordance cache | `Affordance::row.topology.exits` |
| Which **room** is this character in; who is on the roster? | Positions (target) / `moveCharacter` + slice 0 handlers (today) | `RoomId`, `activeCharacters`, `RoomCharacterList` |

Positions does **not** own `projectRoomExits` or `ComponentTopology` hydrate. It **must** keep roster/membership consistent with what affordance compose reads.

### Asymmetry (slice 0)

Connect delegates to `moveCharacter`; disconnect is inline in positions. This is a **migration bridge**, not the target symmetry.

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

At play time a character should appear in **at most one room graph** (best-effort enforcement at the positions authority). `RoomId` / roster lists become **caches or projections** of that invariant, not independent sources of truth.

### Authored vs play graphs

- **Area graph** may list a Character as an Area **participant** (authored scope) --- distinct from **runtime presence** in a room graph.
- **Play mutations** (connect, navigate, pick up, place) update **play graphs** (or interim fields until graphs land); **projections** feed perception, affordance WML, nav, and LLM context.

### Objects and `mtw.ephemera.objects`

Today `Meta::Room.objects` is a **flat list** (Coyote staging). Target: object placement is **edges in a room (or container) graph**. The objects DataSource may remain a command/event lane while **positions** owns play-time graph membership --- or responsibilities merge over time. See [`../objects/AGENT.md`](../objects/AGENT.md).

### Map Position facets (x/y)

WML **Position** facets on maps are a **separate** authoring idiom today ([`packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md`](../../../../packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md)). Target relationship to room graphs (compile-time hint vs runtime edge) is **undecided**.

---

## Graduation rule

When a target concept ships in code and tests, **move** its description from **Target mental model** to **Shipped mental model** and add matching obligations to [`AGENT.contract.md`](AGENT.contract.md). Track graduation in the task plan **Recommended order**.
