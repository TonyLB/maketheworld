# Multi-channel room UI --- concepts and vocabulary

Concept extension of [`AGENT.concepts.md`](AGENT.concepts.md). Normative rules: [`AGENT.multiChannel.contract.md`](AGENT.multiChannel.contract.md). Transcript sort time (orthogonal): [`AGENT.narrativeTranscript.concepts.md`](AGENT.narrativeTranscript.concepts.md).

**Scope:** How **separate semantic domains** (state, room meta, render cache, orchestration, objects, topology) combine into **player-visible** room context that may update on **different cadences**.

---

## Problem we are solving

1. **Full room renders are expensive** (orchestration, cache, generation). They should not be the only way to reflect every **small** change (objects list, character presence, incremental meta).
2. **Those small changes still matter** for UI correctness and for establishing a **coherent baseline** when the user enters a context (what they see now vs what arrives later).
3. **Delivery paths** mix **correlated** fan-in (`mtw.ephemera.perception` + threads + `Render Pertains`) and **imperative** paths (`perceptionMessage`). Without an overarching frame, **which channel carries what** and **how the client composes** them stays implicit.

Without a shared mental model, each feature picks whichever local pattern minimizes immediate friction --- new stream types, new **`Meta::Room`** fields, new perception entry points --- and behavior becomes hard to reconcile across features.

---

## Core tension (two valid pulls)

**Aggregate-oriented view**  
Treat the **room** as one **logical** unit: many **typed** updates about the same **`EphemeraId`**, same cache row family (`Meta::Room`), same mental model for subscribers. Multi-channel stories become **different message kinds** on a **shared** authority, not necessarily separate transport pipes.

**Domain-oriented view**  
Split by **semantic ownership**: `mtw.ephemera.state`, `mtw.ephemera.objects`, `mtw.ephemera.renderOrchestration`, `mtw.ephemera.renderCache`, `mtw.ephemera.perception`, affordance orchestration/cache. Clear boundaries make **reasoning, tests, and event contracts** easier.

**Reconciliation:** These pulls are **compatible at storage** and **tension-prone at process contract**. The same Dynamo **`Meta::Room`** row can hold fields owned by **different** DataSource modules if we document **who writes what**, **what gets invalidated**, and **what clients may assume** about cadence and baseline delivery.

---

## Two logical channels

1. **Room-render channel** --- **Summary-oriented**, **render-backed** content (expensive path; orchestration + cache + perception fan-in).
2. **Room-affordances channel** --- **Structured** facts on a **cheaper cadence**: exits (Area-topology-projected), characters present, runtime objects, features. **Shipped:** `affordanceOrchestration` -> `affordanceCache` -> perception terminal publish.

Channels are **logically distinct**: different internal triggers, different perception handling, different client composition rules. Both use **`DisplayProtocol: 'PerceptionMessage'`** on the wire; **`metaData.roomChannel`** discriminates them (contract).

---

## Cadence and independence

- Each channel **may** publish **independently** on its **own cadence**.
- **Neither** channel **blocks** the other at the protocol level by default.
- The **client** composes one sticky header UX from **both** when both apply, and tolerates **one channel arriving before the other** (last-known-good, placeholders, channel-specific withhold rules).
- **Cross-channel shared revision keys** are **not** required for correctness while render truth and affordance truth stay in separate domains and product accepts **brief skew** and **eventual** server-side cascade (for example objects -> state -> render).

---

## Navigation intent (product framing)

- **No strict coupling required:** No planned journey requires the client to treat one channel as unusable without the other.
- **Dual-channel intent on enter:** When a character **enters a new room context** (move, arrival, first look), the **system intent** is to deliver **both** channels **when practical** --- product intent, not a hard synchronous guarantee.
- **First arrival presentation:** Affordances may arrive before render; **default** is **client** staging (withhold composed affordance material until render has at least **Generating**), not server withholding affordance rows unless product revisits. Norms: contract **Phase C**.

**Optional server-side pairing** (Generating-barrier across channels, paired PerceptionThread) remains **hypothetical** --- see contract **Coupled delivery**.

---

## `Meta::Room` co-location (implementation, not semantics)

Ephemera stores **multiple concerns** on one **`Meta::Room`** item (`activeCharacters`, `state`, cache pointers, `objects`, etc.).

**Co-location is an implementation choice** for atomicity, read efficiency, and cache keying (`ComponentEphemeraMeta`) --- **not** a claim of a single semantic domain. Domain boundaries remain defined by **which module owns writes and outbounds** for each field group.

---

## Decision layer (questions we answer once)

| Question | Why it matters |
| --- | --- |
| **Cadence classes** | Fast-path meta vs render-backed vs control-only |
| **Channels (logical)** | How the client discriminates and composes deltas |
| **Baseline guarantee** | Minimum facts per user action / view entry (formal matrices TBD) |
| **Kickoff orchestration** | Single kick fan-out vs parallel publishes |
| **Correlation** | How slow paths tie to fast updates (threads, fan-in, `messageId`) --- distinct from **transcript position** ([`AGENT.narrativeTranscript.concepts.md`](AGENT.narrativeTranscript.concepts.md)) |

---

## Related documentation

| Doc | Role |
| --- | --- |
| [`AGENT.multiChannel.contract.md`](AGENT.multiChannel.contract.md) | Normative wire, `messageId`, Phase B/C, open decisions |
| [`dataSource/AGENT.md`](dataSource/AGENT.md) | DataSource index |
| [`dataSource/perception/AGENT.md`](dataSource/perception/AGENT.md) | Server publish sites, correlated vs imperative |
| [`charcoal-client/src/components/Message/AGENT.md`](../../charcoal-client/src/components/Message/AGENT.md) | Sticky header UX |
