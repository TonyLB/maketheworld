# Message bus lanes (virtual sub-buses) - DRAFT

**Document status: DRAFT.** This task plan covers **partitioned drains** on the single ephemera **`InternalMessageBus`**: optional **lane** metadata so independent cascades (e.g. render orchestration + downstream `StreamingEvent` traffic) can be **flushed** without interleaving with unrelated work, **without** a second `MessageBus` instance or duplicate handler registration.

**Ephemera adopts lanes first:** implementation and call-site rollout are expected to land in **`lambda/ephemera`** and **`packages/mtw-lambda-patterns`** together; perception and other consumers **reference** this plan rather than duplicating transport design.

**Refinement rule:** Follow [`taskPlanning/AGENT.md`](../../../AGENT.md). Promote out of draft when **Recommended order** and **Verification** are concrete.

---

## Purpose

- Give **one** place for **lane** semantics (`busId` / `laneId` naming TBD), **centralized filtering in `flush`**, and **plumbing** rules (`send`, `DataSource.streamEvent`, `app` flush sites).
- Record why we **rejected** multiple physical `MessageBus` instances for this problem (subscription duplication, `streamEvent` bound to `this.messageBus` on construction, etc.).
- Keep **cross-lane edges** (explicit hand-off from a lane to default traffic) as a **follow-on**; do not block the first slice on bridging policy.

---

## Problem statement

While `renderOrchestration` (and related paths) coordinate work on the main bus, we still want **decoupled cascade drains** for **generating**-class delivery and its downstream messaging, without rewiring every DataSource onto a second bus instance.

**Requirements (agreed direction):**

- **Single** message bus **implementation** and **one** subscription graph per process.
- **Virtual** lanes by **data**: queue items carry optional lane id; **`flush(lane?)`** processes only items in that lane (default lane = items **without** a lane id, when `flush()` is called with no argument --- exact API TBD).
- **Centralize** lane filtering in **`flush`** so handlers keep receiving familiar payloads; propagation can be via **`send`** options / queue-cell metadata rather than threading id through every `MessageType` variant (see **Where lane id lives** below).

**Non-goals (v1):**

- Cross-lane ordering guarantees beyond an explicit **bridge** `send` later.
- Changing external EventBridge contracts.

---

## Where lane id lives (natural place)

The internal queue cell in [`packages/mtw-lambda-patterns/ts/messageBus/index.ts`](../../../../packages/mtw-lambda-patterns/ts/messageBus/index.ts) is today:

```text
{ processedBy: string[]; payload: PayloadType }
```

The **natural** transport field is **on this item** (e.g. `laneId?: string` alongside `payload`), with **`send(payload, lane?)`** (or equivalent) setting it. That avoids polluting every ephemera **`MessageType`** union member when not needed for logging.

Handlers can keep **unchanged** payload shapes; **only** `flush` and `send` need lane awareness at first.

---

## Design notes (agreed)

| Topic | Direction |
| --- | --- |
| **Centralized filtering** | **`flush(lane?)`** considers only stream items matching that lane; reduces per-handler mistakes vs ad hoc `busId` on every payload. |
| **DataSource `streamEvent`** | Must plumb lane into outbound **`StreamingEvent`** posts (same lane as the inbound work unit). |
| **Re-entrancy** | Not a theoretical veto: nested or interleaved `flush` calls are **policy** (document **serialization** or allowed ordering if needed). Same class of care as any async shared resource. |
| **Cross-lane edges** | **Deferred:** e.g. lane completes then **`send`** without lane + **`flush()`** for default traffic. |

---

## Relationship to other plans

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../AGENT.md) | Task planning framework |
| [`../dataSource/perception/AGENT.perceptionRefactor.planning.md`](../dataSource/perception/AGENT.perceptionRefactor.planning.md) | Perception fan-in; **delivery sequencing** may **consume** lanes once implemented |
| [`../dataSource/AGENT.passThrough.contract.planning.md`](../dataSource/AGENT.passThrough.contract.planning.md) | Pass-through / readiness; orthogonal to transport lanes but both touch **when** client-visible work runs |

---

## Code touchpoints (non-exhaustive)

| Area | File / pattern |
| --- | --- |
| Core bus | [`packages/mtw-lambda-patterns/ts/messageBus/index.ts`](../../../../packages/mtw-lambda-patterns/ts/messageBus/index.ts) (`InternalMessageBus`, `send`, `flush`) |
| Ephemera bus type | [`lambda/ephemera/messageBus/baseClasses.ts`](../../../../lambda/ephemera/messageBus/baseClasses.ts) (`MessageBus` extends `InternalMessageBus`) |
| Flush entry | [`lambda/ephemera/app.ts`](../../../../lambda/ephemera/app.ts) |
| DataSource publish | [`packages/mtw-lambda-patterns/ts/dataSource/index.ts`](../../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts) (`streamEvent`, `streamEnvelope`) |
| Typed ingress | [`lambda/ephemera/dataSource/renderOrchestration/subscribedEvents.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/subscribedEvents.ts) (`sendRenderRequested`, etc.) |

---

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../AGENT.md) (durability, what belongs in a task plan).
2. Read **Where lane id lives** and **`InternalMessageBus`** above.
3. Read perception delivery context in [`../dataSource/perception/AGENT.perceptionRefactor.planning.md`](../dataSource/perception/AGENT.perceptionRefactor.planning.md) (Delivery sequencing).

---

## Recommended order

Pending work uses `[ ]`, completed work uses `[X]`. Nested bullets track sub-steps under a parent step.

- [ ] **Spec** lane naming (`laneId` vs `busId`), default-lane rules, and `send` / `flush` signatures (TypeScript-friendly overloads).
- [ ] **Implement** queue-cell metadata + filtered `flush` in **`mtw-lambda-patterns`** `InternalMessageBus`; extend unit tests in [`packages/mtw-lambda-patterns/ts/messageBus/index.test.ts`](../../../../packages/mtw-lambda-patterns/ts/messageBus/index.test.ts).
- [ ] **Plumb** optional lane through ephemera **`MessageBus`** / `app` `flush` call sites (minimal vertical slice).
- [ ] **Plumb** lane through **`DataSource.streamEvent` / `streamEnvelope`** (or agreed alternative) so orchestration emissions stay on the active lane.
- [ ] **Document** re-entrancy / nested `flush` policy in code comment or durable `AGENT.md` near the bus.
- [ ] **Link** consumers (perception plan, pass-through notes if needed).

---

## Verification

- **`mtw-lambda-patterns`:** `cd packages/mtw-lambda-patterns && npm test` (or project-standard command for that package) with focus on `ts/messageBus`.
- **`lambda/ephemera`:** `cd lambda/ephemera && npm test` after ephemera wiring; add targeted tests for lane-isolated drains when handlers exist.

Adjust commands if the repo uses a root test runner; confirm against package `package.json`.

---

## Progress

| Milestone | Status |
| --- | --- |
| Task plan created | Done |
| `InternalMessageBus` lane metadata + filtered flush | Not started |
| Ephemera + DataSource plumbing | Not started |
| Consumer docs linked | Not started |

---

## Open questions

- Exact **default lane** representation (`undefined` vs sentinel).
- Whether **`clear()`** is lane-scoped or global.
- **Performance** of scanning `_stream` per flush (likely fine at Lambda scale; revisit if profiling says otherwise).
