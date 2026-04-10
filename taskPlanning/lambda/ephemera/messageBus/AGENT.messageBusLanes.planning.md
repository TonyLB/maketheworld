# Message bus lanes (virtual sub-buses) - DRAFT

**Document status: DRAFT.** This task plan covers **partitioned drains** on the single ephemera **`InternalMessageBus`**: optional **lane** metadata so independent cascades (e.g. render orchestration + downstream `StreamingEvent` traffic) can be **flushed** without interleaving with unrelated work, **without** a second `MessageBus` instance or duplicate handler registration.

**Ephemera adopts lanes first:** implementation and call-site rollout are expected to land in **`lambda/ephemera`** and **`packages/mtw-lambda-patterns`** together; perception and other consumers **reference** this plan rather than duplicating transport design.

**Refinement rule:** Follow [`taskPlanning/AGENT.md`](../../../AGENT.md). Promote out of draft when **Recommended order** and **Verification** are concrete.

---

## Purpose

- Give **one** place for **lane** semantics (see **Naming: `laneId` (not `busId`)** below), **centralized filtering in `flush`**, and **plumbing** rules (`send`, `DataSource.streamEvent`, `app` flush sites).
- Record why we **rejected** multiple physical `MessageBus` instances for this problem (subscription duplication, `streamEvent` bound to `this.messageBus` on construction, etc.).
- Keep **cross-lane edges** (explicit hand-off from a lane to default traffic) as a **follow-on**; do not block the first slice on bridging policy.

---

## Problem statement

While `renderOrchestration` (and related paths) coordinate work on the main bus, we still want **decoupled cascade drains** for **generating**-class delivery and its downstream messaging, without rewiring every DataSource onto a second bus instance.

**Requirements (agreed direction):**

- **Single** message bus **implementation** and **one** subscription graph per process.
- **Virtual** lanes by **data**: queue items carry optional lane id; **`flush(lane?)`** processes only items in that lane (see **API spec (queue cell, `send`, `flush`)**).
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

The **natural** transport field is **on this item** (e.g. `laneId?: string` alongside `payload`), with **`send(payload)` / `send(payload, laneId)`** setting it. That avoids polluting every ephemera **`MessageType`** union member when not needed for logging.

Handlers can keep **unchanged** payload shapes; **only** `flush` and `send` need lane awareness at first.

---

## API spec (queue cell, `send`, `flush`)

### Naming: `laneId` (not `busId`)

- **Use `laneId`** on the internal queue cell and in **`send` / `flush` APIs** for the virtual partition.
- **`busId` was rejected** for this feature: it suggests a **second physical bus** or process-wide bus identity, which overlaps with the **multiple `MessageBus` instances** approach we already ruled out (duplicate subscriptions, `streamEvent` bound to `this.messageBus`, etc.). It also reads oddly next to the single **`InternalMessageBus`** type.
- **`laneId`** matches the mental model: **one** bus, **many lanes** of traffic; same subscription graph and queue, **filtered drain** per lane.

### Queue cell (target shape)

```text
{ processedBy: string[]; payload: PayloadType; laneId?: string }
```

- **Default lane:** items where **`laneId` is omitted** (equivalently `undefined`). **No sentinel string** for default in v1; call sites use `send(payload)` / `flush()` for that lane.

### `send` (TypeScript overloads)

```ts
send(payload: PayloadType): void;
send(payload: PayloadType, laneId: string): void;
```

- **`send(payload)`** enqueues in the **default lane** (cell has no `laneId` field set).
- **`send(payload, laneId)`** enqueues in the named lane; **`laneId` is a non-empty string**. (If implementation ever receives an empty string, treat as default lane or assert; prefer non-empty strings only for named lanes.)

Handlers still receive **`payload` only** in callbacks; lane stays on the cell for **routing / flush** unless we later thread it for logging.

### `flush` (TypeScript overloads)

```ts
flush(): Promise<void>;
flush(laneId: string): Promise<void>;
```

- **`flush()`** runs the existing priority / subscription processing **only for items in the default lane** (cells with no `laneId`). Other lanes remain in `_stream` until their own drain.
- **`flush(laneId)`** runs the same logic **only for items** whose **`laneId` equals that string**. Default-lane items are not included.

**Recursive `flush`:** today `InternalMessageBus.flush` re-enters `flush()` until idle. The lane-scoped implementation should **keep draining the same lane** in those inner calls (same binding as the outer `flush` / `flush(laneId)`), so a lane drain runs to quiescence for that lane without switching to "all lanes." Document nested / concurrent `flush` policy when implementing (see **Recommended order**).

### Future-friendly option shape (optional later)

If more per-`send` options appear (without growing positional parameters), a single overload is acceptable:

```ts
send(payload: PayloadType, options?: { laneId?: string }): void;
```

with **`options?.laneId` absent** meaning default lane. The dual overloads above are the v1 spelling unless we need options immediately.

---

## Design notes (agreed)

| Topic | Direction |
| --- | --- |
| **Centralized filtering** | **`flush(lane?)`** considers only stream items matching that lane; reduces per-handler mistakes vs ad hoc `laneId` on every payload. |
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
2. Read **Where lane id lives**, **`InternalMessageBus`** (code touchpoints), and **API spec (queue cell, `send`, `flush`)** (naming, default lane, overloads).
3. Read perception delivery context in [`../dataSource/perception/AGENT.perceptionRefactor.planning.md`](../dataSource/perception/AGENT.perceptionRefactor.planning.md) (Delivery sequencing).

---

## Recommended order

Pending work uses `[ ]`, completed work uses `[X]`. Nested bullets track sub-steps under a parent step.

- [X] **Spec** lane naming (`laneId` vs `busId`), default-lane rules, and `send` / `flush` signatures (TypeScript-friendly overloads).
  - [X] **Naming:** `laneId` (see **Naming: `laneId` (not `busId`)**).
  - [X] **Default lane + overloads:** see **API spec (queue cell, `send`, `flush`)**.
- [X] **Implement** queue-cell metadata + filtered `flush` in **`mtw-lambda-patterns`** `InternalMessageBus`; extend unit tests in [`packages/mtw-lambda-patterns/ts/messageBus/index.test.ts`](../../../../packages/mtw-lambda-patterns/ts/messageBus/index.test.ts).
  - [X] **`InternalMessageBus`:** `laneId?` on cells, `send` / `flush` overloads, private `flushLane(activeLane)`.
  - [X] **Tests:** isolation, no cross-lane drain, priority within a named lane, re-entrancy, empty-string lane id.
- [X] **Plumb** optional lane through ephemera **`MessageBus`** / `app` `flush` call sites (minimal vertical slice).
- [X] **Plumb** lane through **`DataSource.streamEvent` / `streamEnvelope`** (or agreed alternative) so orchestration emissions stay on the active lane.
- [X] **Document** re-entrancy / nested `flush` policy in code comment or durable `AGENT.md` near the bus.
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
| API spec (`laneId`, `send` / `flush` overloads, default lane) | Done |
| `InternalMessageBus` lane metadata + filtered flush | Done |
| Ephemera + DataSource plumbing | Not started |
| Consumer docs linked | Not started |

---

## Open questions

- Whether **`clear()`** is lane-scoped or global (v1 likely **global**, unchanged from today).
- **Performance** of scanning `_stream` per flush (likely fine at Lambda scale; revisit if profiling says otherwise).
