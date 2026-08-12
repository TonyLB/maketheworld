# Diegetic logic --- concepts and vocabulary

Concept extension of [`../AGENT.concepts.md`](../AGENT.concepts.md). Normative rules: **`AGENT.contract.md`** *(not yet drafted)*. Unknowns detail: [`AGENT.unknowns.concepts.md`](AGENT.unknowns.concepts.md).

---

## Core vocabulary

| Term | Meaning |
| --- | --- |
| **Diegetic logic** | Rules for keeping **in-fiction** claims mutually coherent when play state changes --- what we assert, what we leave unstated, and what each consumer may treat as true. |
| **Known** | A claim the system **commits** to in manipulation truth or in a durable projection (for example a character on a room roster, an object node in a play graph). |
| **Unknown** | Deliberately **uncommitted** detail --- not a bug, not necessarily fillable on demand. See [`AGENT.unknowns.concepts.md`](AGENT.unknowns.concepts.md). |
| **Operation** | A play-time **verb** (navigate, place, relate, ...) proposed as a small graph delta plus any presentation obligations. Design lives here until it graduates. |
| **Projection** | A **read model** for one consumer (exits, roster, affordance WML, render context). Projections filter truth; they do not redefine authority. |

---

## Positive patterns

**Story-sufficient structure.** Store and mutate only what downstream storytelling needs. Finer relational detail (`On`, `In`, inventory graphs) arrives as **operations** need it, not as a global spatial algebra.

**Local edits.** An operation proposes a **bounded** change to a host graph (and related indices). Legality is evaluated in context, not against an enumerated catalog of all possible relationships.

**Separate roles, compose views.** Manipulation truth, authored blueprint, and presentation material are distinct graph roles ([`../dataSource/positions/AGENT.concepts.md`](../dataSource/positions/AGENT.concepts.md#graph-roles-shared-shape-different-authority)). Diegetic logic specifies how an operation respects those boundaries; consumers compose projections.

**Intent, fact, presentation.** Many verbs already split across lanes (`actions` intent, `positions` fact, `perception` copy). New operators should follow that shape unless a single lane clearly owns the whole verb.

---

## Relation to positions (today)

Shipped play graphs hold **membership** (character and object **nodes** in rooms; adjacency reverse index) and **in-host relational edges** on room **`ludicGraph`** (`On`, `Under`, `Against`, `Custom` + label --- Phase B). Nested containment (`in` / inside) remains future work ([`../dataSource/positions/AGENT.concepts.md`](../dataSource/positions/AGENT.concepts.md#fractal-ludic-graphs-container-scale-and-edges)).

Operator fiction and transcript obligations for shipped manipulation verbs: [`AGENT.operators.concepts.md`](AGENT.operators.concepts.md). Normative persist and ingress rules: [`../dataSource/positions/AGENT.contract.md`](../dataSource/positions/AGENT.contract.md).

---

## Future: nested containment (post-vertical)

v1 in-room objects are **top-level nodes** on **`Meta::Room.ludicGraph`**, sufficient for **`takeHold`** on loose objects. Later slices may add nested portable containment, non-local extent via relational claims, and derived scene closures --- without dual-authority membership or monolithic room indexes.

Design direction when nested container-host manipulation ships: fractal hosts in [`../dataSource/positions/AGENT.concepts.md`](../dataSource/positions/AGENT.concepts.md#fractal-ludic-graphs-container-scale-and-edges); unknowns / elaborate vs assert in [`AGENT.unknowns.concepts.md`](AGENT.unknowns.concepts.md). Shipped operators: [`AGENT.operators.concepts.md`](AGENT.operators.concepts.md).
