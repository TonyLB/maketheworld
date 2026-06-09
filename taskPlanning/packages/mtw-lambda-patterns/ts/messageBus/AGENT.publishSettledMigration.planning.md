# MessageBus: `publish`/`settle` migration (planning)

**Status:** In progress (P0). Q1-Q3 are locked. Next step: resolve Q4-Q8, then Phase P1 engine work.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

Introduce a **`publish`/`settle`** pattern alongside the existing **`send`/`flush`** wave model on `InternalMessageBus`, then migrate call sites piecewise until `send` has zero remaining uses and the old machinery can be deleted.

**Motivation:** Domain-authoritative DataSources subscribe and publish events independently. The wave/priority model defers intermediate publications to the next drain, which fights long-running pipelines (Coyote hypothesis, thinking persistence, render orchestration) that need concurrent handling while work continues. Virtual **`laneId`** + manual **`flush(laneId)`** mitigates this but is cumbersome; `publish`/`settle` is the intended steady-state abstraction.

**Design handoff:** Initial brainstorming is captured in an external handoff document (`messageBus-publish-settle-handoff.md`). This plan records task ordering, verification, migration inventory, and **open questions** to resolve before or during implementation.

This file is task-scoped. Archive or delete it when migration completes and lasting behavior lives in package `AGENT.md` files per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Scope and boundaries

### In scope

- Add `publish()`, `settle()`, `_inFlight`, and `flushAndSettle()` to [`InternalMessageBus`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/index.ts) (independent from `_stream` / `flushLane`).
- Refactor `flush()` / `flush(laneId)` and `settle()` to return `Promise<boolean>` (`true` if that invocation did work, `false` if a no-op).
- Unit tests for quiescence, concurrent handlers, handler-publishes-during-settle, and coexistence with unchanged `send`/`flush` tests.
- Extend [`DataSource`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts) message-bus port and outbound paths as needed for migration.
- Piecewise migration: `send` -> `publish` per call site; hybrid lambda boundaries until each lambda is fully migrated.
- Retire `laneId` / `flush(laneId)` usage on migrated paths.
- Closeout: delete `send`, `flush`, and flush-adjacent machinery in the **same commit** when grep shows zero production `send` call sites; boundaries then use `settle()` only (or `flushAndSettle` aliased to that). Update durable docs.

### Out of scope (noted for continuity only)

- Lambda startup speculative scheduler (Bedrock backlog) -- future work; `settle()` is a prerequisite, not part of this plan.
- Lane-scoped `clear()` -- moot once lanes retire on the new path.
- Deleting `send`/`flush` before the migration backlog reaches zero.

## Success criteria

- `publish`/`settle` passes a dedicated test suite including **quiescence under recursive publish** (handlers call `publish` while `settle` is draining) and **`flushAndSettle` cross-seam ping-pong** (Q1).
- Existing `send`/`flush` tests in [`index.test.ts`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/index.test.ts) continue to pass unchanged until removal phase.
- Migrated DataSource intermediate publications no longer require bespoke `laneId` or manual `flush(laneId)` for concurrent handling.
- Remaining `messageBus.send` call sites are enumerable as a migration backlog (`rg 'messageBus\.send\(' lambda/`).
- No behavior change in handlers that have not been explicitly migrated.

## Open design questions

Resolve these in Phase P0 (update this section with decisions as they land). Do not assume defaults in implementation until recorded here. **Q1-Q3 are locked**; Q4-Q8 remain open.

### Q1. Hybrid lambda boundary drain -- **RESOLVED**

During migration, `send`/`flush` and `publish`/`settle` coexist. A handler invoked via `flush` may call `publish`, scheduling work in `_inFlight` that `flush` does not await. Conversely, a `settle`-invoked handler may `send`, scheduling work on `_stream` that `settle` does not drain.

**Decision:** Use a single boundary operator, `flushAndSettle()`, that loops until both paths are idle for that scope:

```ts
async flushAndSettle(laneId?: string): Promise<void> {
    while (true) {
        const [didFlush, didSettle] = await Promise.all([
            laneId === undefined ? this.flush() : this.flush(laneId),
            this.settle(),
        ])
        if (!didFlush && !didSettle) {
            return
        }
    }
}
```

(`laneId` overload optional for inline lane drains during Phase P3; default-lane `flushAndSettle()` is the lambda `app.ts` contract.)

**`Promise<boolean>` on `flush` and `settle`:**

| Method | Returns `true` when | Returns `false` when |
| --- | --- | --- |
| `flush()` / `flush(laneId)` | At least one subscription callback ran with a non-empty batch (any `flushLane` recursion depth for that lane) | No processable items for that lane at entry (no-op) |
| `settle()` | At least one `publish` handler was scheduled; inner quiescence loop still drains recursive `publish` during the call | `_inFlight` empty throughout the call |

`settle()` keeps an **inner** drain loop (await `_inFlight` to quiescence within one call). The **outer** `flushAndSettle` loop handles **cross-system** ping-pong (`flush` -> `publish` -> `settle` -> `send` -> ...). Parallel `Promise.all([flush(), settle()])` per outer iteration is intentional; the outer loop corrects timing between the two systems.

**Lambda boundaries (`app.ts` and equivalent ingress exits):** Replace `await messageBus.flush()` with `await messageBus.flushAndSettle()` as soon as `flushAndSettle` exists. Safe before any `publish` call sites exist (`settle()` always `false`, one iteration). No per-lambda "only flush" or "only settle" exceptions at boundaries.

**Scope:** `flushAndSettle()` without `laneId` drains the **default lane** (`flush()`) plus global `_inFlight` (`settle()`). Named-lane items remain the responsibility of inline `flush(laneId)` / `flushAndSettle(laneId)` until those paths migrate to `publish` (see **Migration inventory**).

**Fully migrated lambdas (zero production `send`, but `flush` not yet deleted):** Keep `flushAndSettle()` at boundaries; `flush()` returns `false` every iteration until P6 removes it.

**P6 closeout:** Remove `send`, `flush`, `flushLane`, and flush-adjacent types in the **same commit**. `flushAndSettle()` becomes `settle()` only (or is deleted and boundaries call `settle()` directly).

**Non-termination:** Pathological handler cycles that endlessly `send`/`publish` can loop forever -- same class of risk as today's `flushLane` recursion. Out of scope; handlers must not generate unbounded default-lane churn.

**`flushAndSettle` + errors (Q3):** `settle()` does not reject on handler failures. `flush()` still uses `Promise.all` today and **may** reject -- so `flushAndSettle()` can still fail from the `flush` side until P6 removes `flush`. Intentional asymmetry during migration.

### Q2. `activeFlushLane` on the `publish` path -- **RESOLVED**

Today, subscription callbacks receive [`InternalMessageBusCallbackProps`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/index.ts): `payloads`, `messageBus`, and `activeFlushLane`. [`DataSource`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts) pushes `activeFlushLane` onto `_inboundFlushLaneStack` so `streamEvent` / `streamEnvelope` inherit outbound `laneId`.

**Decision: `publish` always passes `activeFlushLane: undefined`.**

- Keep `activeFlushLane` on the callback type until P6 deletes `flush`. Only the `flush` delivery path supplies a real lane value.
- Do not omit the field or add a sentinel; subscribers need no branch for "publish vs flush" on lane.

**Decision: no lane inheritance on the `publish` path.**

`publish` is immediate; outbound lane routing via stack peek is a `send`/`flush` concern only. Do not plumb `activeFlushLane` through `publish` defensively.

**Migration constraint (atomic units):** Avoid situations where a named-lane context migrates to `publish` while handlers in that subgraph still `send()` (or DataSource still `send`s via `streamEvent`) without explicit lane. Partial migration routes those `send`s to the **default** lane while inline `flushAndSettle(laneId)` only drains the **named** lane (Q1) -- a silent ordering break.

Rule: **do not migrate a named-lane `flush` / `flushAndSettle(laneId)` call site to `publish` until every `send` reachable from handlers invoked in that subgraph is also `publish` in the same change.**

Representative atomic units (see **Migration inventory**):

- [`hypothesisThinkingPersistence.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/hypothesisThinkingPersistence.ts) -- bootstrap / emit / finalize blocks (explicit `laneId` on each `send*` + matching `flush(laneId)`).
- [`handleObjectsChangedForHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handlers/handleObjectsChangedForHypothesis.ts) -- lane `send` **and** parallel `remainder()` (`streamEvent` + default-lane `send`) together.
- [`orchestrationHandler.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.ts) + [`findRender.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts) -- terminal vs generation-lane split; `laneId: ''` force-default outbounds migrate with the whole orchestration slice.

**`flush`-invoked handler calls `publish` mid-drain:** Subscribers see `activeFlushLane: undefined`. Safe when the atomic-unit rule is satisfied (no publish -> `send` cascade). Until then, treat as a migration hazard, not a reason to inherit lanes on `publish`.

**Decision: DataSource lane retirement (Phase P2, one commit).**

When DataSource logic has **no remaining `send`** on the outbound path:

- Remove `laneId` from [`StreamEventParams`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts) (including `laneId: ''` force-default sentinel -- moot without stack inheritance).
- Replace `sendStreamingEventOnBus` with `messageBus.publish`.
- Remove `_inboundFlushLaneStack` and lane merge in subscribe callbacks (`peekInboundFlushLane` / bound `streamEvent` wrapper).
- Update `DataSourceMessageBusPort`: `publish` replaces `send` (see **Q7 partial** below).

Ingress may still arrive via `send`/`flush` until later phases; outbound `publish` does not inherit inbound lane. Direct `messageBus.send` inside `receiveEvents` bodies (outside `streamEvent`) remains per-call-site migration.

**Still tied to Q8:** Per-lambda "fully migrated" definition and ephemera-first ordering for lane hotspots.

### Q3. `settle` error semantics -- **RESOLVED**

`flushLane` uses `Promise.all` per priority tier; handler rejections can fail `flush()`. The `publish`/`settle` path adopts a drain-all policy instead.

**Decision: `settle` uses `Promise.allSettled` on each `_inFlight` snapshot.**

Within the inner quiescence loop, await `Promise.allSettled([...snapshot])` so one rejection does not skip peer handlers or abort the drain before `_inFlight` reaches quiescence.

**Decision: log and continue; `settle()` does not reject on handler failures.**

- For each `rejected` `allSettled` result, log (include subscription `tag` when the promise is wrapped at `publish` time).
- `settle()` **resolves** and still returns `Promise<boolean>` per Q1 (`true` if any handler was scheduled, even when some rejected).
- Handler-level recovery: use local `try/catch` in subscribe callbacks (matches [`AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md) guidance). Handlers that catch locally do not surface as `rejected` at settle time.

**Decision: no bus-level error hook.**

Do not add `onError`, subscription error callbacks, or other messageBus-wide catch machinery. Rejections from fire-and-forget `publish` are observable when `settle` drains (`allSettled` + logging), or when handlers catch locally. Producers that need structured error handling should do so in the handler, not via a global bus API.

**`flush` unchanged until P6:** `flush()` / `flush(laneId)` keep current `Promise.all` behavior during migration. Only `settle` adopts `allSettled` + log-and-continue. Aligning `flush` with `settle` is out of scope (legacy path deleted in P6).

### Q4. Priority and subscriber ordering under `publish`

Under `send`/`flush`, priority ordering is enforced. Under `publish`, the handoff states ordering is the handler's responsibility.

- **Question:** Does `publish` ignore `priority` entirely and invoke all matching subscribers in subscription registration order?
- **Question:** If two subscribers match the same payload, is concurrent invocation always correct, or do any existing handlers rely on serial delivery?
- **Question:** Do we keep `priority` on subscriptions during migration (meaningful only for `flush`) or deprecate it in docs immediately?

### Q5. Payload batching and stream persistence

`flush` batches matching stream items per subscriber (`payloads` may be length > 1) and uses `processedBy` so multiple subscribers can process the same queued message across waves. `publish` delivers a **single-item** `payloads` array per matching subscriber immediately.

- **Question:** Which subscribe callbacks perform meaningful **cross-payload aggregation** in one invocation and need redesign before migration?
- **Question:** Is there any production path that depends on a message remaining in `_stream` for a later subscriber wave under `flush`?
- **Question:** Under `publish`, is "each matching subscriber gets an independent async invocation per publish" the guaranteed contract?

### Q6. `clear()` interaction with `_inFlight`

`clear()` today empties `_stream` only.

- **Question:** Does `clear()` affect `_inFlight` promises (cancel, ignore, or leave running)?
- **Question:** Is `clear()` still appropriate at test teardown when both `_stream` and `_inFlight` may be active?

### Q7. `DataSource` port shape

[`DataSourceMessageBusPort`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts) currently exposes `send` and `subscribe` only.

- **Question:** Does the port add `publish` and `settle`, or do DataSources call through a wider bus type?
- **Question:** Does `sendStreamingEventOnBus` become `publish` immediately in Phase P2, or only after ingress paths publish?
- **Question:** How do package-level DataSource tests mock the port during migration?

**Partial (from Q2):** Phase P2 removes `send` and `laneId` from DataSource outbound in one commit; port exposes `publish` (not `send`). `sendStreamingEventOnBus` becomes `publish` in that same commit. Ingress may still use `send`/`flush` until lambda call sites migrate; outbound does not inherit lanes. Remaining Q7 bullets (whether port needs `settle`, test mock shape) stay open.

### Q8. Migration ordering and lane hotspots

Lane-scoped `flush(laneId)` is concentrated in ephemera thinking, Coyote, and render orchestration paths (see **Migration inventory**).

- **Question:** Confirm ephemera-first ordering (engine + DataSource port, then lane hotspots, then remaining ephemera, then assets/wml/smaller lambdas)?
- **Question:** Which lane call sites must migrate as atomic groups (e.g. bootstrap + results emit + `flush(laneId)` in one file)? *(Starting list under Q2 **atomic units**; confirm and extend in P0.)*
- **Question:** Per-lambda definition of "fully migrated" -- zero `send` in production code only, or including tests/harnesses?

## Getting started

1. Skim task-plan conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read current steady-state messageBus docs (link from here; do not duplicate architecture in this plan):
   - [`packages/mtw-lambda-patterns/ts/messageBus/AGENT.md`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.md)
   - [`packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md) (virtual lanes section is what we are retiring on migrated paths)
   - [`packages/mtw-lambda-patterns/ts/messageBus/AGENT.testing.md`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.testing.md)
3. Read DataSource lane behavior: [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (**Message bus lanes**).
4. Read ephemera lane call-site context: [`lambda/ephemera/messageBus/AGENT.md`](../../../../../lambda/ephemera/messageBus/AGENT.md), [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md), [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md).
5. **Command authority:** tests run via Jest from [`packages/mtw-lambda-patterns/package.json`](../../../../../packages/mtw-lambda-patterns/package.json) (`npm test`). If examples conflict elsewhere, use that package's scripts.
6. Run baseline verification before edits (from `packages/mtw-lambda-patterns/`):

```bash
npm test -- ts/messageBus/index.test.ts
```

## Migration inventory (baseline grep)

Refresh these counts when starting a migration phase; they are approximate snapshots for planning.

**`messageBus.send` in `lambda/` (production + tests):** widespread; heaviest in `lambda/ephemera` (`app.ts`, DataSources, perception, Coyote, actions).

**`messageBus.flush()` in `lambda/*/app.ts` (lambda boundaries):**

| Lambda | `app.ts` flush calls |
| --- | --- |
| ephemera | 4 |
| assets | 7 |
| wml | 6 |
| connections | 1 |
| cognitoEvent | 1 |
| diagnostics | 1 |

**Lane-scoped `flush(laneId)` (representative production files):**

- [`hypothesisThinkingPersistence.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/hypothesisThinkingPersistence.ts)
- [`handleObjectsChangedForHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handlers/handleObjectsChangedForHypothesis.ts)
- [`handleAwaitRoadRunnerForPlanOutcome.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handlers/handleAwaitRoadRunnerForPlanOutcome.ts)
- [`acmeOrderThinkingPersistence.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/acmeOrderThinkingPersistence.ts)
- [`orchestrationHandler.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.ts) / [`handleLookCommandRequestedForRenderOrchestration.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts)
- [`runCoyoteEngineTestHarness.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/runCoyoteEngineTestHarness.ts)
- [`promoteToCanon.ts`](../../../../../lambda/wml/promoteToCanon.ts)

**Enumeration commands:**

```bash
# Migration backlog (send)
rg 'messageBus\.send\(' lambda/ --glob '*.ts' | rg -v '\.test\.ts' || true

# Lambda boundaries (flush)
rg 'messageBus\.flush\(' lambda/ --glob '**/app.ts'

# Lane drains
rg 'messageBus\.flush\(' lambda/ --glob '*.ts' | rg -v '\.test\.ts' || true
rg 'flush\(laneId|flush\([a-zA-Z]' lambda/ packages/mtw-lambda-patterns/ --glob '*.ts' || true

# Batch-aggregation audit (starting point for Q5)
rg 'payloads\.(forEach|map|reduce|length)' lambda/*/messageBus packages/mtw-lambda-patterns/ts/dataSource --glob '*.ts' || true
```

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [ ] Phase P0 - resolve open design questions
  - [X] Record Q1 decision in **Open design questions** (hybrid boundary: `flushAndSettle`, `Promise<boolean>` returns).
  - [X] Record Q2 decision in **Open design questions** (`activeFlushLane: undefined` on `publish`, atomic migration units, DataSource lane retirement in P2).
  - [X] Record Q3 decision in **Open design questions** (`allSettled`, log-and-continue, no bus error hook).
  - [ ] Record decisions for Q4-Q8 in **Open design questions** (replace questions with locked answers as decided).
  - [ ] Confirm migration ordering and per-lambda "fully migrated" definition (Q8).

- [ ] Phase P1 - `InternalMessageBus` engine
  - [ ] Add `publish()`, `settle()`, `_inFlight`, `flushAndSettle()` (independent from `_stream` / `flushLane`).
  - [ ] Refactor `flush()` / `flush(laneId)` to return `Promise<boolean>` per Q1.
  - [ ] Implement `settle()` with inner quiescence loop, `Promise.allSettled` per snapshot, rejection logging, and `Promise<boolean>` per Q1/Q3.
  - [ ] `publish` passes `activeFlushLane: undefined` per Q2; wrap handler promises with `tag` for Q3 log context.
  - [ ] Implement per remaining P0 decisions (subscriber ordering, Q4).
  - [ ] Add tests: `flushAndSettle` cross-seam ping-pong, boolean no-op returns, single subscriber, concurrent subscribers, recursive publish during settle, **settle drains all handlers when one rejects** (Q3), coexistence with existing `send`/`flush` tests.
  - [ ] Baseline: `npm test -- ts/messageBus/index.test.ts` passes.

- [ ] Phase P2 - `DataSource` port and outbound path (single commit per Q2)
  - [ ] `DataSourceMessageBusPort`: `publish` replaces `send`; drop `laneId` second argument.
  - [ ] `sendStreamingEventOnBus` -> `publish`; remove `_inboundFlushLaneStack` and subscribe callback lane push/pop.
  - [ ] Remove `laneId` from `StreamEventParams` and bound `streamEvent` lane merge.
  - [ ] Update [`packages/mtw-lambda-patterns/ts/dataSource/index.test.ts`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/index.test.ts) (drop `activeFlushLane` merge / `laneId` send tests; add `publish` port tests).
  - [ ] Run: `npm test -- ts/dataSource/index.test.ts` from `packages/mtw-lambda-patterns/`.

- [ ] Phase P3 - ephemera lane hotspots (highest friction; **atomic units** per Q2)
  - [ ] Coyote hypothesis thinking persistence and handlers (files in **Migration inventory**; each bootstrap/emit/finalize block in one change).
  - [ ] Acme order thinking persistence (atomic with its `flush(laneId)` blocks).
  - [ ] Render orchestration: `orchestrationHandler` + `findRender` + look path (drop `laneId: ''`; no partial publish-with-remaining-`send`).
  - [ ] Coyote engine test harness lane flushes.
  - [ ] Ephemera `app.ts`: `flush()` -> `flushAndSettle()` at all boundary exits (Q1).
  - [ ] Targeted ephemera tests for touched paths (see **Verification**).

- [ ] Phase P4 - remaining ephemera `send` sites
  - [ ] Ingress / EventBridge paths in [`lambda/ephemera/app.ts`](../../../../../lambda/ephemera/app.ts).
  - [ ] Perception, actions, positions, self-healing, and other DataSource `send` call sites.
  - [ ] Handler batch-aggregation audit (Q5) for any subscribe callbacks before their ingress migrates.
  - [ ] Confirm ephemera `app.ts` already uses `flushAndSettle()` from P3 (no further boundary change until P6).

- [ ] Phase P5 - other lambdas
  - [ ] assets (`app.ts` + DataSources)
  - [ ] wml (`app.ts`, `promoteToCanon.ts`)
  - [ ] connections, cognitoEvent, diagnostics
  - [ ] Each lambda `app.ts`: `flush()` -> `flushAndSettle()` (Q1).

- [ ] Phase P6 - remove legacy machinery and close out
  - [ ] Confirm `rg 'messageBus\.send\(' lambda/` zero production hits (definition per Q8).
  - [ ] Delete `send`, `flush`, `flushLane`, lane queue cells, lane-related types, and `flushAndSettle` (or alias it to `settle()`) from `InternalMessageBus` in one commit.
  - [ ] Lambda boundaries: `flushAndSettle()` -> `settle()` (Q1 P6).
  - [ ] Remove lane docs from [`AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md); document `publish`/`settle` steady state in package and [`lambda/ephemera/messageBus/AGENT.md`](../../../../../lambda/ephemera/messageBus/AGENT.md).
  - [ ] Update DataSource implementation doc (lane section retired).
  - [ ] Archive or delete this task plan.

## Verification

### Package (always)

From `packages/mtw-lambda-patterns/`:

```bash
npm test -- ts/messageBus/index.test.ts
npm test -- ts/dataSource/index.test.ts
```

### Ephemera (after Phase P3+)

From `lambda/ephemera/` (see [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) for authority):

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/generators/testHarness/runCoyoteEngineTestHarness.test.ts
npm run test -- --watchAll=false dataSource/perception/index.test.ts
npm run test -- --watchAll=false app.test.ts
```

### Per-migration grep (confirm backlog shrinks)

```bash
rg 'messageBus\.send\(' lambda/ --glob '*.ts' | rg -v '\.test\.ts' | wc -l
rg 'messageBus\.(flush|flushAndSettle)\(' lambda/ --glob '**/app.ts' | wc -l
```

## Progress

| Milestone | Status |
| --- | --- |
| Task plan created | Done |
| Q1 resolved (`flushAndSettle`, boolean drains) | Done |
| Q2 resolved (`activeFlushLane`, atomic units, DataSource P2) | Done |
| Q3 resolved (`allSettled`, log-and-continue, no error hook) | Done |
| Open questions Q4-Q8 resolved (P0) | Not started |
| Engine `publish`/`settle` + tests (P1) | Not started |
| DataSource port migration (P2) | Not started |
| Ephemera lane hotspots (P3) | Not started |
| Remaining ephemera migration (P4) | Not started |
| Other lambdas (P5) | Not started |
| Legacy removal + durable docs (P6) | Not started |

## Behavioral reference (handoff summary)

For implementers; steady-state architecture belongs in package `AGENT.md` after closeout.

| | `send`/`flush` | `publish`/`settle` |
| --- | --- | --- |
| Handler invocation | Synchronous wave, priority-ordered | Async, independent tasks |
| Ordering | Priority-enforced | Handler's responsibility (see Q4) |
| Intermediate publications | Deferred to next wave | Scheduled immediately |
| Concurrency | Single wave focus | Natural Node.js async concurrency |
| Tracking | `_stream`, `processedBy`, optional `laneId` | `_inFlight` Promise set |
| `activeFlushLane` in callback | Set by `flush` / `flush(laneId)` | Always `undefined` (Q2) |
| Handler errors | `flush`: `Promise.all` (may reject) | `settle`: `allSettled`, log, continue (Q3) |

**Coexistence:** `publish`/`settle` and `send`/`flush` do not share queue or Promise-tracking machinery during migration. Cross-seam side effects are drained at lambda boundaries via `flushAndSettle()` (Q1). Lane inheritance applies only to `flush`; named-lane subgraphs migrate as **atomic units** without publish -> `send` cascades (Q2).
