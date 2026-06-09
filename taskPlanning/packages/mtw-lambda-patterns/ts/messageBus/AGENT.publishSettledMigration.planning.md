# MessageBus: `publish`/`settle` migration (planning)

**Status:** In progress (P2). Q1-Q9 are locked (P0.5 complete). **Phase P1** complete. Next step: **Phase P2** DataSource port (`publish`, `outboundBusDelivery`, Q7).

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

Introduce a **`publish`/`settle`** pattern alongside the existing **`send`/`flush`** wave model on `InternalMessageBus`, then migrate call sites piecewise until `send` has zero remaining uses and the old machinery can be deleted.

**Motivation:** Domain-authoritative DataSources subscribe and publish events independently. The wave/priority model defers intermediate publications to the next drain, which fights long-running pipelines (Coyote hypothesis, thinking persistence, render orchestration) that need concurrent handling while work continues. Virtual **`laneId`** + manual **`flush(laneId)`** mitigates this but is cumbersome; `publish`/`settle` is the intended steady-state abstraction.

**Design handoff:** Initial brainstorming is captured in an external handoff document (`messageBus-publish-settle-handoff.md`). This plan records task ordering, verification, migration inventory, and **open questions** to resolve before or during implementation.

This file is task-scoped. Archive or delete it when migration completes and lasting behavior lives in package `AGENT.md` files per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Scope and boundaries

### In scope

- Add `publish()`, `settle()`, `_inFlight`, and `flushAndSettle()` to [`InternalMessageBus`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/index.ts) (independent from `_stream` / `flushLane`).
- **Q9:** `registerDeferral` / per-need aggregators for orchestration-class coalescing (see **Open design questions**); required before **PUBLISH-MSG** ingress migrates to `publish`.
- Refactor `flush()` / `flush(laneId)` and `settle()` to return `Promise<boolean>` (`true` if that invocation did work, `false` if a no-op).
- Unit tests for quiescence, concurrent handlers, handler-publishes-during-settle, and coexistence with unchanged `send`/`flush` tests.
- Extend [`DataSource`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts) message-bus port and outbound paths as needed for migration.
- Piecewise migration: `send` -> `publish` per call site; hybrid lambda boundaries until each lambda is fully migrated.
- Retire `laneId` / `flush(laneId)` usage on migrated paths.
- Closeout: delete `send`, `flush`, and flush-adjacent machinery in the **same commit** when grep shows zero production `send` call sites; boundaries keep `flushAndSettle()` (settle loop + `runDeferrals()` tail). Update durable docs.

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

Resolve these in Phase P0 (update this section with decisions as they land). Do not assume defaults in implementation until recorded here. **Q1-Q9 are locked** (Q4-Q5 locked in **Phase P0.5**; Q9 locked in deferral design pass).

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

**Q9 follow-on (locked):** after the idle loop, `flushAndSettle` calls **`runDeferrals()`** for orchestration-class outbound coalescing (see Q9). Distinct from subscriber quiescence; P1 may ship an empty deferral registry stub.

**Fully migrated lambdas (zero production `send`, but `flush` not yet deleted):** Keep `flushAndSettle()` at boundaries; `flush()` returns `false` every iteration until P6 removes it.

**P6 closeout:** Remove `send`, `flush`, `flushLane`, and flush-adjacent types in the **same commit**. `flushAndSettle()` **retains** the boundary shape: loop until subscriber graph quiescent, **then** `runDeferrals()` (Q9). The flush arm disappears only because `flush` is deleted (`didFlush` always `false`); do **not** drop the dual-loop contract early while hybrid cross-seam ping-pong still exists (Q1). Boundaries keep a single operator -- do not split `settle()` and `runDeferrals()` in `app.ts`.

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

**Decision: DataSource lane retirement (Phase P2 closeout).**

Piecewise per-DataSource migration uses **`outboundBusDelivery`** (Q7); **closeout** (when no DataSource still uses `'send'` outbound) removes:

- `laneId` from [`StreamEventParams`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts) (including `laneId: ''` force-default sentinel -- moot without stack inheritance).
- `send` from `DataSourceMessageBusPort` and the `outboundBusDelivery` flag.
- `_inboundFlushLaneStack` and lane merge in subscribe callbacks (`peekInboundFlushLane` / bound `streamEvent` wrapper).
- `sendStreamingEventOnBus` branch (publish-only).

Ingress may still arrive via `send`/`flush` until later phases; outbound `publish` does not inherit inbound lane. Direct `messageBus.send` inside `receiveEvents` bodies (outside `streamEvent`) remains per-call-site migration.

**Migration ordering:** Ephemera-first and per-lambda "fully migrated" definition (Q8).

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

### Q4. Priority and subscriber ordering under `publish` -- **RESOLVED**

Under `send`/`flush`, priority ordering is enforced. Under `publish`, ordering is the handler's responsibility. P0.5 positive audit (see **Q4/Q5 positive audit** Tier 1-3 results below) triaged High/Medium rows; Low rows use defaults below.

**Decision: `publish` ignores `priority`.**

- All matching subscribers are scheduled **concurrently** into `_inFlight` (no priority sort on the publish path).
- **Registration order is not** an ordering guarantee under `publish`.

**Decision: same-payload multi-subscriber default is concurrent invocation.**

- Serial delivery is **not** guaranteed. Handlers that need ordering must enforce it locally (await, explicit sequencing, or single orchestrated publish).

**Decision: retain `priority` on subscriptions during migration.**

- Meaningful **only** for `flush` until P6 removes legacy machinery. Deprecate in steady-state docs at P6 closeout, not during P0.5-P5.

**High/Medium explicit rules (from triage matrix):**

| Row | Rule |
| --- | --- |
| AFF-CACHE-4 | Affordance migration slice (P3) must preserve catalog-before-orchestration **without** flush priority --- explicit await or single orchestrated publish path. |
| DS-OVERLAP-5 / PASS-THROUGH-INT | Concurrent no-op DataSource callbacks are acceptable; **integration tests are the ordering spec** for multi-DS paths. Re-run after each High row migration slice. |
| MOVE-CHAR, PERCEPTION, ROOM-AFFORD, COMP-KICK, COYOTE-LANE | Migrate as **atomic units** (Q2/Q8); hybrid period uses `flushAndSettle` at lambda boundaries (Q1). |
| COYOTE-20 | Priority 20 is a **flush-era deferral** only; coyote handlers run concurrently with default-tier DS under `publish` --- P3 slice confirms no hidden ordering dependency. |
| DISCONNECT-CHAIN, EXECUTE-ACTION, POSITIONS | Medium chains: migrate whole subgraph in one slice or accept concurrent cross-handler delivery with boundary `flushAndSettle`. |

**P1 implementation:** `publish` schedules all matching subscribers **concurrently** into `_inFlight` (ignore `priority`; registration order is not execution order). See triage matrix for per-slice migration constraints where explicit sequencing replaces flush priority.

### Q5. Payload batching and stream persistence -- **RESOLVED**

`flush` batches matching stream items per subscriber (`payloads` may be length > 1) and uses `processedBy` so multiple subscribers can process the same queued message across waves. `publish` delivers a **single-item** `payloads` array per matching subscriber immediately.

**Decision: `publish` delivery contract.**

- Each `publish(payload)` invokes every matching subscriber with `payloads: [payload]` (length 1).
- Each matching subscriber gets an **independent async invocation** per `publish` (tracked in `_inFlight` until `settle`).

**Decision: bucket classification (P0.5 Tier 1B).**

| Bucket | Migration rule |
| --- | --- |
| **1 -- true aggregation** | See **Bucket-1 deep dive** below: fix axis is not always "make consumer idempotent." Some rows migrate freely (downstream already converges); others need **producer coalescing**, **contract/orchestration**, or **consumer hardening** before ingress moves to `publish`. |
| **2 -- per-item parallel** | Migrate freely; N `publish`s equivalent to one batched `flush`. |
| **3 -- DataSource envelope map** | Wrapper is Low risk; check `receiveEvents` for bucket-1 logic inside the body. |

**Decision: no `_stream` persistence dependency on migrated paths.**

- No production path may depend on a message remaining in `_stream` for a later subscriber wave once that path migrates to `publish`. High send-chain rows verified in Tier 1C; chains migrate as atomic units with boundary drain during hybrid period.

### Q6. `clear()` interaction with `_inFlight` -- **RESOLVED**

`clear()` today empties `_stream` only. After `publish`/`settle`, it must account for `_inFlight` as well.

**Decision: `clear()` resets both `_stream` and `_inFlight`.**

- `clear()` empties the send queue **and** clears the in-flight Promise set (bus no longer tracks those handlers).
- **Q9 (locked):** `clear()` invokes each deferral's `onClear`; deferral registrations persist.
- Does **not** cancel underlying async work (Node has no promise cancellation); detached handlers may still complete, but a subsequent `settle()` on the cleared bus has nothing to await.
- Keeps `clear()` a full bus reset for a new invocation scope (matches production: [`lambda/*/app.ts`](../../../../../lambda/ephemera/app.ts) calls `clear()` at handler entry).

**Decision: test teardown -- `settle` (or `flushAndSettle`) before `clear()`.**

When tests use `publish` / `_inFlight`:

1. **`await messageBus.settle()`** (or **`await messageBus.flushAndSettle()`** while `send`/`flush` still exist) at end of test body or in **`afterEach`** before `clear()`.
2. Then **`messageBus.clear()`** for isolation (existing `beforeEach` / `afterEach` pattern).

Do not rely on `clear()` alone to drain async handler work; that drops tracking while promises may still be running and causes cross-test flakes.

**Production lambda boundaries:** `clear()` at ingress start remains correct (empty bus). Boundary exit uses `flushAndSettle()` (Q1), not `clear()`.

**Docs:** Note the teardown pattern in [`AGENT.testing.md`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.testing.md) when P1 lands.

### Q7. `DataSource` port shape -- **RESOLVED**

[`DataSourceMessageBusPort`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts) currently exposes `send` and `subscribe` only.

**Decision: port adds `publish`, not `settle`.**

| Surface | On `DataSourceMessageBusPort`? | Why |
| --- | --- | --- |
| `subscribe` | Yes | DataSource registers ingress in constructor |
| `publish` | Yes | DataSource **produces** outbound `streamEvent` / `streamEnvelope` traffic |
| `settle` | **No** | Drain is a **lambda boundary** (`flushAndSettle` / `settle` in `app.ts`), inline handler deps during lane migration, and test teardown (Q1, Q6) -- not DataSource lifecycle |

Handler deps (Coyote, thinking, etc.) continue to use `Pick<MessageBus, ...>` on the **full domain bus** where inline `flush` / future `publish` is needed -- not via the DataSource port type.

**Decision: piecewise outbound migration via temporary `outboundBusDelivery`.**

Do not flip all DataSources to `publish` in one commit. In Phase P2 infrastructure:

- Add constructor option `outboundBusDelivery?: 'send' | 'publish'` (default **`'send'`**).
- `sendStreamingEventOnBus` branches: `'send'` keeps current path (including lane peek until that DS migrates); `'publish'` calls `messageBus.publish`.
- **Per DataSource:** set `outboundBusDelivery: 'publish'` when migrating that directory (with Q2 atomic units for lane/send call sites in that subgraph).
- **P2 closeout** (Q2): when grep shows no remaining `outboundBusDelivery: 'send'` (or default) in production DataSource constructors, remove the flag, port `send`, lane stack, and `StreamEventParams.laneId`.

Ingress may stay on `send`/`flush` until later lambda phases; outbound piecewise migration does **not** require ingress to `publish` first.

**Decision: package-level port mocks (no open question).**

Today [`index.test.ts`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/index.test.ts) uses `{ send: jest.fn(), subscribe: jest.fn() }`. During migration:

```ts
mockMessageBus = {
    send: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn(),
}
```

- Tests for **default / `'send'`** outbound: assert `mockMessageBus.send` (and lane second arg where still applicable); do not pass `outboundBusDelivery` or pass `'send'`.
- Tests for **`'publish'`** outbound: construct DataSource with `outboundBusDelivery: 'publish'`; assert `mockMessageBus.publish` and **not** `send` for `streamEvent` paths.
- **Subscribe-only** describes (callback wiring, `receiveEvents`, `activeFlushLane` merge): mock needs only `subscribe` until the test invokes `streamEvent` -- then include `send` or `publish` matching the DataSource under test.
- Migrate assertions incrementally per test slice; delete `send` / lane expectations when the test's DataSource flips to `'publish'`.

Optional convenience (not required for P2): a small `createMockDataSourceMessageBusPort()` factory in the test file returning the triple above. No real `InternalMessageBus` needed for unit tests.

**Migration backlog grep:**

```bash
rg "new EphemeraDataSource|new DataSource|outboundBusDelivery" lambda/ packages/mtw-lambda-patterns/ts/dataSource/ --glob '*.ts' | rg -v '\.test\.' || true
```

### Q8. Migration ordering and lane hotspots -- **RESOLVED**

Lane-scoped `flush(laneId)` is concentrated in ephemera thinking, Coyote, and render orchestration paths (see **Migration inventory**).

**Decision: ephemera-first ordering.**

| Order | Phase | Scope |
| --- | --- | --- |
| 1 | P1 | `InternalMessageBus` engine (`publish`, `settle`, `flushAndSettle`, Q1-Q3, Q6) |
| 2 | P2a | DataSource port infrastructure (`publish`, `outboundBusDelivery`, Q7) |
| 3 | P3 | Ephemera **lane hotspots** (highest friction; Q2 atomic units) |
| 4 | P2b + P4 | Remaining ephemera DataSources and `send` sites; per-DS `outboundBusDelivery: 'publish'` with each slice |
| 5 | P5 | assets, wml, connections, cognitoEvent, diagnostics |
| 6 | P2c + P6 | DataSource outbound closeout; delete `send`/`flush` globally |

Smaller lambdas last because ephemera concentration drove the migration; assets/wml still get `flushAndSettle()` at `app.ts` as soon as P1 lands (Q1).

**Decision: lane call sites migrate as atomic groups.**

Authoritative starting list is under Q2 **atomic units** (hypothesisThinkingPersistence blocks, `handleObjectsChangedForHypothesis` + `remainder()`, orchestrationHandler + findRender, etc.). Extend the list when P0.5 triage or P3 work surfaces additional High/Medium rows. **Rule:** do not migrate a named-lane `flush` / inline drain to `publish` until every `send` reachable in that subgraph is also `publish` in the **same change** (Q2).

**Decision: per-lambda "fully migrated" = zero `messageBus.send` in production code.**

- **Counts for lambda status:** `rg 'messageBus\.send\(' lambda/<name>/ --glob '*.ts' | rg -v '\.test\.'` returns no hits.
- **Tests and harnesses** (e.g. `runCoyoteEngineTestHarness.ts`): migrate with each slice; they do **not** gate calling a lambda "fully migrated" for boundary semantics, but must be clean before **P6** global deletion of `send`/`flush`.
- **`outboundBusDelivery`:** a lambda is not fully migrated while any production DataSource constructor in that lambda still defaults to `'send'` (Q7).
- Aligns with Q1: a fully migrated lambda keeps `flushAndSettle()` at `app.ts` until P6 even when production `send` is zero (`flush()` no-ops).

### Q9. Defer buffer (orchestration outbound coalescing) -- **RESOLVED**

Under `flush`, orchestration-class handlers (notably [`publishMessage`](../../../../../lambda/ephemera/publishMessage/index.ts)) receive **batched** `payloads`, merge per-connection outbound work, sort by `CreatedTime`, and `batchMessages` before `apiClient.send`. Under `publish`, each matching subscriber gets **`payloads: [singleItem]`** per call (Q5); concurrent handler invocations no longer share one callback scope. Cross-invocation coalescing requires a **defer buffer**: accumulate outbound side effects during handler execution, deliver after invocation bus activity quiesces.

**This is not a second subscriber queue.** `_inFlight` + `settle()` already drain **subscription handler** work (including recursive `publish`). The defer buffer holds **outbound delivery** (websocket frames, and similar IO) that must not run at end of each per-item handler if coalescing and ordering are to survive migration. Deferred flush is a **finalization phase**, not another round of subscription matching.

#### Problem split (do not conflate)

| Layer | Drained by | Holds |
| --- | --- | --- |
| Subscriber graph | `settle()` / `flushAndSettle` idle loop | Handler promises (`_inFlight`; legacy `_stream`) |
| Outbound defer buffer | `runDeferrals()` **after** idle loop | Per-need aggregator state (e.g. per `connectionId` coalesce) |

#### Locked approach: `registerDeferral` + per-need aggregators

Avoid a bus-owned generic defer queue (`deferOutbound(key, item)`). Instead:

- **`InternalMessageBus`** exposes a thin deferral registry: `registerDeferral(tag, { onClear?, afterSettled })`, `runDeferrals()`, and `clear()` invokes each registrant's `onClear` (default no-op). Registrations persist across invocations.
- **Aggregation logic** lives in independent module-scoped entities (one per concern): `PublishMessageCoalescer`, checkLocation dedup state, diagnostics intake dedup, etc. Handlers call into those entities during execution; entities **enqueue only**, never deliver at end of per-item callback.
- **`flushAndSettle()`** tail (lambda boundary, after idle loop): `await runDeferrals()` then `extractReturnValue` (today: [`app.ts`](../../../../../lambda/ephemera/app.ts) does `flush()` then `extractReturnValue`).

This migrates aggregation **off the bus as aggregation server** (batched `payloads` in one subscribe callback) **onto collaborators** that handlers and DataSources use explicitly. The bus still **dispatches** subscribers; it does not own merge/sort/`batchMessages` semantics.

**Why this fits without over-engineering:** the bus adds ~one registry + one drain call; each bucket-1 row owns its buffer rules. No keyed defer store on the bus; no second subscriber queue.

**Critical timing (locked):** `afterSettled` runs **once per boundary `flushAndSettle`**, after the **full** idle loop exits -- **not** after every mid-handler drain. Boundary `afterSettled` flushes outbound coalesce after the whole invocation's bus graph is quiescent.

**`afterSettled` callback contract (locked for current needs):** **IO-only** -- no `messageBus.publish()` or `messageBus.send()` from registrants. Current bucket-1 consumers fit: **PUBLISH-MSG** (`apiClient.send`), **DIAG-DEDUP** (EventBridge / sweep side effects outside the bus), boundary **`extractReturnValue`** (reads `_stream` already populated during handler phase). **CHECK-LOC** repair should stay in handler phase (or enqueue-only into an entity); do not `send` new bus messages from `afterSettled` in v1.

**No repeat loop (locked for v1):** one idle loop, then one `runDeferrals()`, then HTTP response assembly. A **future** extension if needs expand: wrap idle loop + `runDeferrals()` in an outer repeat until both are no-op (only if a registrant is allowed to enqueue bus work -- not planned for current migration slices). Document in implementation guide; do not build until a concrete registrant requires it.

**Aggregator + `publish`:** handler enqueues to entity, calls `publish`, returns; idle loop drains children; `afterSettled` runs coalescer flush. Child paths that must share the same outbound batch must use the **same** entity (not immediate send).

**`clear()` at ingress (locked):** symmetric with Q6 -- `messageBus.clear()` resets `_stream` / `_inFlight` **and** runs each deferral's `onClear` (ingress lifecycle). Deferral **registrations** persist; per-invocation buffer contents do not. Aggregators with owned buffers supply `onClear: () => reset()`; egress-only deferrals (e.g. `extractReturnValue`) may omit `onClear` or use a no-op.

**Precedent:** `extractReturnValue` is already boundary assembly separate from subscribers; it may register as a deferral with `afterSettled` only (`onClear` optional). Bus-owned registry keeps `app.ts` to `flushAndSettle` + return.

#### Open questions (resolve before PUBLISH-MSG `publish` ingress)

1. **Hook API shape** -- **RESOLVED:** `registerDeferral(tag, { onClear?, afterSettled })` on bus; `clear()` runs `onClear`; `runDeferrals()` runs `afterSettled` after idle loop. Per-need aggregators wrap registration at module load (not explicit `app.ts` flush calls per coalescer). Name avoids "handler" collision with subscribe callbacks.
2. **`flushAndSettle` integration** -- **RESOLVED (v1):** Q1 dual idle loop (`Promise.all([flush, settle])` until both no-op) **inside** `flushAndSettle`, **then** `await runDeferrals()`, **then** `extractReturnValue` / HTTP response. `runDeferrals()` is not a substitute for the flush/settle loop -- it runs only after subscriber-graph quiescence. `afterSettled` hooks are **IO-only**; **no** outer repeat loop on deferrals. Future: repeat wrapper if bus-enqueueing registrants are ever required (out of scope for P1-P5 triage rows).
3. **`clear()` lifecycle** -- **RESOLVED:** Yes. `clear()` at ingress resets defer / aggregator buffers (symmetric with Q6 `_inFlight` reset). Registrations persist.
4. **Aggregators that call `publish`** -- **RESOLVED:** Handler enqueues to entity, may `publish`, **returns** without mid-callback delivery; boundary idle loop drains all spawned handler work; `afterSettled` flushes coalesce. Child paths that share the same outbound batch enqueue to the **same** entity (no immediate send). **Avoid inline `await settle()` in production aggregators** -- it is a global drain (all `_inFlight`, not a subtree), fights Q4 concurrency, and duplicates boundary quiescence. If a handler "needs child results before continuing" in the same callback, **restructure** (child enqueues to shared entity; split subscriber; move continuation to child handler). If that need appears at **boundary** and implies bus enqueue after coalesce flush, that is the signal for the **future repeat wrapper** (idle loop + `afterSettled` until stable), not inline `settle()`. Inline `settle()` / `flushAndSettle()` remain valid for **tests** (Q6), **lambda boundaries**, and **lane migration** inline drains (Q2) -- not mid-handler aggregator sequencing.
5. **Scope of first implementation** -- **RESOLVED:** P1 ships bus `registerDeferral` / `runDeferrals` (empty registry OK; wired into `flushAndSettle` + `clear()`). P4 lands first real registrant: **PUBLISH-MSG** coalescer (blocks **PUBLISH-MSG** `publish` ingress until then). **CHECK-LOC** (P4 triage) and **DIAG-DEDUP** (P5 triage) add deferrals when their migration slices land -- not in P1 stub scope. **`extractReturnValue`** may remain explicit in `app.ts` or register as egress-only deferral (`afterSettled` only); decide in P4 ephemera boundary slice, not a Q9 blocker.
6. **P6 steady state** -- **RESOLVED:** Keep `flushAndSettle` = Q1 loop-until-both-idle **then** `runDeferrals()` for the full hybrid period (P1-P5). Cross-seam `flush` <-> `publish`/`settle` ping-pong requires **both** arms until `send`/`flush` are globally deleted. At P6 closeout, deleting `flush` removes the flush arm from the implementation only; the operator still ends with `runDeferrals()`. Do not plan an intermediate "settle-only `flushAndSettle`" that drops the flush arm while legacy `send` paths remain.

#### Locked API shape

```ts
type DeferralRegistration = {
    onClear?: () => void
    afterSettled: () => Promise<void>
}

// Bus: thin deferral registry
registerDeferral(tag: string, hooks: DeferralRegistration): void
async runDeferrals(): Promise<void>  // Promise.allSettled on afterSettled; log per Q3 spirit

clear(): void {
    this._stream = []
    this._inFlight.clear()
    for (const { onClear } of this._deferrals) {
        onClear?.()
    }
}

// Boundary (replaces app.ts flush + extractReturnValue ordering):
async flushAndSettle(laneId?: string): Promise<void> {
    while (true) {
        const [didFlush, didSettle] = await Promise.all([
            laneId === undefined ? this.flush() : this.flush(laneId),
            this.settle(),
        ])
        if (!didFlush && !didSettle) {
            break
        }
    }
    await this.runDeferrals()
}

// Ephemera: publishMessage coalescer (registers at module load)
publishMessageCoalescer.registerDeferral(messageBus)
// internally: { onClear: () => this.reset(), afterSettled: () => this.flush() }
// handler body: coalescer.enqueue(...); no apiClient.send until afterSettled
```

**Handler contract (orchestration aggregators):** enqueue during handler; **do not** deliver inside callback; **do not** `await settle()` mid-callback for sequencing; **do not** flush coalesce inside callback after `publish`. Return; let boundary idle loop + `afterSettled` deliver.

**Primary migration consumer:** **PUBLISH-MSG** (Tier 3 / Bucket-1 deep dive). **CHECK-LOC** and **DIAG-DEDUP** use producer coalescing/dedup patterns, not necessarily the same defer-outbound machinery.

**Approach:** P1 implements engine + empty deferral registry. P4 implements **PUBLISH-MSG** coalescer + `publish` ingress. Per-slice deferral shape for CHECK-LOC / DIAG-DEDUP is decided in those slices (producer coalesce may need only `onClear` + handler-phase enqueue, or full `afterSettled` IO).

## Getting started

1. Skim task-plan conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read current steady-state messageBus docs (link from here; do not duplicate architecture in this plan):
   - [`packages/mtw-lambda-patterns/ts/messageBus/AGENT.md`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.md)
   - [`packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md) (virtual lanes section is what we are retiring on migrated paths)
   - [`packages/mtw-lambda-patterns/ts/messageBus/AGENT.testing.md`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.testing.md)
3. Read DataSource lane behavior: [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (**Message bus lanes**).
4. Read ephemera lane call-site context: [`lambda/ephemera/messageBus/AGENT.md`](../../../../../lambda/ephemera/messageBus/AGENT.md), [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md), [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md).
5. **Command authority:** tests run via Jest from [`packages/mtw-lambda-patterns/package.json`](../../../../../packages/mtw-lambda-patterns/package.json) (`npm test`). If examples conflict elsewhere, use that package's scripts.
6. Before locking Q4/Q5, run **Phase P0.5** (**Q4/Q5 positive audit**): build the triage matrix; do not guess across all call sites.
7. Run baseline verification before engine edits (from `packages/mtw-lambda-patterns/`):

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

# Batch-aggregation audit (starting point for Q5; see P0.5 for full classifier)
rg 'payloads\.(forEach|map|reduce|length)' lambda/*/messageBus packages/mtw-lambda-patterns/ts/dataSource --glob '*.ts' || true
```

## Q4/Q5 positive audit (Phase P0.5)

Replace prove-the-negative reasoning with a **bounded positive inventory**: list places where Q4/Q5 mechanics **actually apply**, triage each row, then lock Q4/Q5 from **High/Medium** findings only. Low rows use default `publish` rules and existing tests.

### Where risk actually concentrates

| Concern | Real locus | Usually **not** a problem |
| --- | --- | --- |
| **Q4** multi-subscriber / ordering | Many DataSources share [`streamingEventStructureGuard`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts) (any `StreamingEvent`); same-priority callbacks run in `Promise.all` under `flush`; documented `subscriptionPriority` edges | Legacy [`lambda/ephemera/messageBus/index.ts`](../../../../../lambda/ephemera/messageBus/index.ts) / [`lambda/assets/messageBus/index.ts`](../../../../../lambda/assets/messageBus/index.ts) handlers (one discriminated `type` per subscription) |
| **Q5** batch / persistence | Handlers that **combine** multiple `payloads` in one callback (see **Bucket-1 deep dive** for shielding vs contract vs orchestration); multi-wave `send` chains; integration tests that assert drain order | Handlers that only `Promise.all(payloads.map(...))` (batch is throughput, not semantics); bucket-1 rows where downstream already converges (Low triage) |

### Tier 1 -- structural inventory (automated)

**A. Subscription overlap (Q4)**

List every `messageBus.subscribe` / `DataSource.subscribe()` with `tag`, `priority`, and filter scope. Flag subscribers whose filter can match the **same** payload as another.

```bash
# Subscribe registrations
rg 'messageBus\.subscribe\(|\.subscribe\(\)' lambda/ packages/mtw-lambda-patterns/ts/dataSource/ --glob '*.ts' -l

# Documented priority intent
rg 'subscriptionPriority|priority:\s*\d+' lambda/ --glob '*.{ts,md}' | rg -v '\.test\.' || true
```

**Tier 1A results -- subscription inventory (production only; test-only subscribers excluded).**

Every `DataSource.subscribe()` registers via [`packages/mtw-lambda-patterns/ts/dataSource/index.ts`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts): bus filter `streamingEventStructureGuard` (any `StreamingEvent`), tag `dataSource-{dataSourceKey}`, priority `subscriptionPriority` (default **5**). Replayable DataSources also register initialize at priority **1** (`dataSource-{key}-initialize`).

#### ephemera -- legacy handlers ([`messageBus/index.ts`](../../../../../lambda/ephemera/messageBus/index.ts))

| Tag | Priority | Bus filter |
| --- | --- | --- |
| UnregisterCharacter, DisconnectCharacter | 1 | `isUnregisterCharacterMessage`, `isDisconnectCharacterMessage` |
| FetchPlayerEphemera, MapSubscription, MapUnsubscribe | 2 | per-type guards |
| CheckLocation, CharacterEvent | 3 | per-type guards |
| MoveCharacter | 4 | `isMoveCharacter` |
| ExecuteAction | 5 | `isExecuteActionMessage` |
| RoomUpdate | 6 | `isRoomUpdateMessage` |
| EphemeraUpdate, Perception | 10 | per-type guards |
| PublishMessage, MapUpdate | 15 | per-type guards |

Legacy handlers use **non-StreamingEvent** discriminated `type` filters; they do not overlap with DataSource bus filters.

#### ephemera -- DataSource subscribers (13 streaming + 1 initialize)

| dataSourceKey | Subscribe file | Priority | Envelope guard (summary) |
| --- | --- | --- | --- |
| `mtw.ephemera` | [`dataSource/index.ts`](../../../../../lambda/ephemera/dataSource/index.ts) | 5 | assets + diagnostics ingress |
| `mtw.ephemera.state` | [`state/index.ts`](../../../../../lambda/ephemera/dataSource/state/index.ts) | 5 | `api.ephemera` State Change |
| `mtw.ephemera.objects` | [`objects/index.ts`](../../../../../lambda/ephemera/dataSource/objects/index.ts) | 5 | Objects Change, Acme Order, Await RoadRunner |
| `mtw.ephemera.perception` | [`perception/index.ts`](../../../../../lambda/ephemera/dataSource/perception/index.ts) | 5 | perception + renderCache/orch/affordance ingress |
| `mtw.ephemera.renderOrchestration` | [`renderOrchestration/index.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/index.ts) | 5 | Render Requested, State Changed, Look, Character Registered |
| `mtw.ephemera.renderCache` | [`renderCache/index.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts) | 5 | cache API + all renderOrch outbounds + ExampleInvalidated |
| `mtw.ephemera.affordanceCache` | [`affordanceCache/index.ts`](../../../../../lambda/ephemera/dataSource/affordanceCache/index.ts) | **4** | affordanceOrch outbounds + TopologyInvalidated |
| `mtw.ephemera.affordanceOrchestration` | [`affordanceOrchestration/index.ts`](../../../../../lambda/ephemera/dataSource/affordanceOrchestration/index.ts) | 5 | Affordances Requested, Objects Changed, TopologyInvalidated, Character Registered |
| `mtw.ephemera.actions` | [`actions/index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) | 5 | Parse Requested |
| `mtw.ephemera.positions` | [`positions/index.ts`](../../../../../lambda/ephemera/dataSource/positions/index.ts) | 5 | Character Connected/Disconnected |
| `mtw.ephemera.thinking.scheduling` | [`thinking/scheduling/index.ts`](../../../../../lambda/ephemera/dataSource/thinking/scheduling/index.ts) | 5 + init **1** | thinking schedule/job ingress |
| `mtw.ephemera.thinking.results` | [`thinking/results/index.ts`](../../../../../lambda/ephemera/dataSource/thinking/results/index.ts) | 5 | Thinking Result (coyote + actions) |
| `mtw.ephemera.coyoteGame` | [`coyoteGame/index.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/index.ts) | **20** | Objects Changed, Await RoadRunner |

**Ephemera broadcast:** every `StreamingEvent` on the ephemera bus invokes all 13 DataSource callbacks (priorities 4, 5, 20); envelope guards narrow inside.

#### assets -- legacy ([`messageBus/index.ts`](../../../../../lambda/assets/messageBus/index.ts)) + DataSource (8 streaming + 4 initialize)

| Kind | Count | Priorities |
| --- | --- | --- |
| Legacy | 6 handlers | 5 (default), ReturnValue **9** |
| DataSource | `mtw.assets`, `contentHeaders`, `library`, `players`, `characters`, `componentTopology`, `componentExamples`, `components.verticals` | 5; initialize **1** on contentHeaders, library, players, characters |

#### wml, connections, diagnostics, cognitoEvent

| Lambda | Registrations | Notes |
| --- | --- | --- |
| wml | `mtw.wml` streaming (prio 5) + initialize (prio 1) | **Defect:** duplicate `.subscribe()` in [`mtw-wml.ts`](../../../../../lambda/wml/dataSource/mtw-wml.ts) and [`index.ts`](../../../../../lambda/wml/dataSource/index.ts) --- `receiveEvents` runs twice per event |
| connections | `mtw.connections`, `mtw.connections.characters` | prio 5 each |
| diagnostics | `mtw.diagnostics` | prio 5 |
| cognitoEvent | `mtw.cognito` | prio 5 |

#### Envelope-level overlap clusters (same payload matches 2+ subscribers)

| Payload | Subscribers (priority) | Lambda |
| --- | --- | --- |
| `mtw.connections` / Character Registered | renderOrchestration (5), affordanceOrchestration (5) | ephemera |
| `mtw.assets.componentTopology` / TopologyInvalidated | affordanceCache (**4**), affordanceOrchestration (5) | ephemera |
| `mtw.ephemera.objects` / Objects Changed | affordanceOrchestration (5), coyoteGame (**20**) | ephemera |
| `mtw.ephemera.actions` / Await RoadRunner | objects (5), coyoteGame (20) | ephemera |
| `mtw.ephemera.renderOrchestration` / Generation Started, Error, Deferred | renderCache (5), perception (5) | ephemera |
| `mtw.ephemera.affordanceOrchestration` / published types | affordanceCache (4), perception (Affordances Pertain) (5) | ephemera |
| `mtw.assets` / Component Updated or Removed | contentHeaders, characters, componentTopology, componentExamples, componentVerticals (all 5) | assets |
| `mtw.wml` / Zone Changed | mtw.assets, contentHeaders (both 5) | assets |

**B. Batch-semantics classifier (Q5)**

| Bucket | Meaning | Action on `publish` migration |
| --- | --- | --- |
| **1 -- true aggregation** | Behavior changes if one batched `flush` becomes N `publish`s | Redesign or explicit batching before migrate |
| **2 -- per-item parallel** | `Promise.all(payloads.map(...))` only | N `publish`s equivalent; migrate freely |
| **3 -- DataSource envelope map** | `payloads.map` -> `receiveEvents` | Usually one ingress event per `send`; note multi-queued edge cases |

```bash
# Bucket 1 candidates (cross-payload logic)
rg 'payloads\.(reduce|filter|flat)' lambda/ packages/mtw-lambda-patterns/ --glob '*.ts' | rg -v '\.test\.' || true

# Bucket 2 (per-item; lower risk)
rg 'Promise\.all\(payloads\.map' lambda/ --glob '*.ts' -l | rg -v '\.test\.' || true
```

**Tier 1B results -- bucket-1 (true aggregation) list:**

| ID | File | Aggregation behavior |
| --- | --- | --- |
| PLAYER-REDUCE | [`lambda/assets/player/update.ts`](../../../../../lambda/assets/player/update.ts) | `payloads.reduce` groups PlayerSettings per player |
| CHECK-LOC | [`lambda/ephemera/checkLocation/index.ts`](../../../../../lambda/ephemera/checkLocation/index.ts) | Cross-payload expansion (asset -> room -> character), dedup |
| EPH-UPDATE | [`lambda/ephemera/ephemeraUpdate/index.ts`](../../../../../lambda/ephemera/ephemeraUpdate/index.ts) | Accumulates `updatesBySessionId`; one `apiClient.send` per session |
| PUBLISH-MSG | [`lambda/ephemera/publishMessage/index.ts`](../../../../../lambda/ephemera/publishMessage/index.ts) | Accumulates `messagesByConnectionId`; `batchMessages` per connection |
| MAP-SUB | [`lambda/ephemera/mapSubscription/index.ts`](../../../../../lambda/ephemera/mapSubscription/index.ts) | Batches all `characterId`s into one `getItems` + single `ReturnValue` |
| PERCEPTION-RV | [`lambda/ephemera/perception/index.ts`](../../../../../lambda/ephemera/perception/index.ts) | Single trailing `ReturnValue` Success for whole batch |
| FETCH-EPH | [`lambda/ephemera/fetchEphemera/index.ts`](../../../../../lambda/ephemera/fetchEphemera/index.ts) | `payloads.length` gate; one `EphemeraUpdate` for all connected characters |
| DIAG-DEDUP | [`lambda/diagnostics/dataSource/index.ts`](../../../../../lambda/diagnostics/dataSource/index.ts) | `preparedEvents.reduce` dedupes SessionDisconnectProblem by key |
| CONTENT-AGG | [`lambda/assets/contentHeaders/index.ts`](../../../../../lambda/assets/contentHeaders/index.ts) | `events.reduce` groups component events by asset |

#### Bucket-1 deep dive: why flush batching mattered

`flush` batching was doing **three jobs**, not just "dedupe for traffic." Migration stress-tests all three; the fix axis depends on which job mattered.

| Flush job | What batching did | Typical fix when moving to `publish` |
| --- | --- | --- |
| **Shielding** | Dedup / coalesce so downstream never saw duplicates | **Producer coalescing** (per-key Set in handler) or **consumer idempotency** (merge / keyed overwrite) |
| **Contract packaging** | One HTTP / ReturnValue / websocket response from many bus messages | **Response assembly** at lambda boundary (`extractReturnValue` policy, explicit correlation) |
| **Orchestration** | Sort, `CreatedTime` offsets, `messageGroupId`, frame-size `batchMessages` | **Defer buffer** (Q9): enqueue during handlers, flush after `flushAndSettle` idle loop; not fixed by "idempotent consumer" alone |

**Idempotency levels** (duplicate delivery tolerance):

| Level | Question | Enough for N `publish`s? |
| --- | --- | --- |
| **State convergence** | Same final Dynamo / Redux row? | Often yes |
| **Side-effect once** | One move, one sweep, one affordance kick? | No -- need dedup or serialization |
| **Presentation identity** | One chat line per utterance? | No -- client keys on `MessageId`, not content |
| **Causal ordering** | Leave before arrive; sorted connection stream? | No -- explicit ordering contract |

**Per-case assessment** (bucket-1 rows):

| ID | Primary flush job | Idempotency level | Fix axis | N `publish`s OK? | Migration work (phase) |
| --- | --- | --- | --- | --- | --- |
| PLAYER-REDUCE | Shielding (minor) | State convergence | Consumer already OK | **Yes** (extra Dynamo contention only) | P5: migrate freely; optional producer coalesce per player is optimization |
| FETCH-EPH | Shielding | State convergence | Consumer overwrite by `CharacterId` | **Yes** (wasteful) | P4: migrate freely |
| EPH-UPDATE | Contract packaging (wire) | State convergence | Client `updates.forEach`; keyed Redux | **Yes** (extra frames) | P4: migrate freely; optional session coalesce is optimization |
| CONTENT-AGG | Shielding + snapshot coherence | State convergence | `ContentHeadersAggregator.standardForm.merge` | **Mostly yes** | P5: migrate; watch remove-then-update ordering in same burst |
| PERCEPTION-RV | Contract packaging | Correlation (weak) | `extractReturnValue` spread-merge; identical Success collapses | **Mostly yes** (same invocation) | P4: migrate with perception slice; explicit RequestId pairing if multi-ack becomes visible |
| MAP-SUB | Contract packaging | Response shape | `extractReturnValue` overwrites keys; does not union `maps[]` | **No** when multiple bus messages share one invocation | P4: keep one handler batch per API op, or fix boundary merge (deep merge / array union) |
| DIAG-DEDUP | Shielding | Side-effect once | Sweep emits new EventBridge rows per run | **No** | P5: **producer** dedup by `dedupeKey` across events in one invocation (not only within one `receiveEvents` array) |
| CHECK-LOC | Shielding | Side-effect once | `moveCharacter` / affordance kicks use new `MessageId`s | **No** | P4: **producer** per-invocation `Set<characterId>` (or defer ingress); downstream move is not duplicate-safe |
| PUBLISH-MSG | Orchestration + contract | Presentation identity + ordering | Client dedupes `(CreatedTime, MessageId)`; per-connection sort in handler | **No** | P4: **Q9 defer buffer** -- per-connection coalesce; flush after boundary `flushAndSettle` quiescence; handlers enqueue only (see Q9 aggregator + `publish` rules) |

**Reading the table:** rows marked **Yes** or **Mostly yes** are places where downstream work already paid off (or flush was mostly traffic packaging). Rows marked **No** are where flush was **masking architecture debt** -- duplicate side effects, wrong response shape, or ordering -- not something fixed solely by teaching consumers to ignore duplicates.

**Practical rule for P4/P5 slices:**

- Wrong **final state** -> consumer merge / idempotency.
- Duplicate **side effects or UX** -> producer coalescing or serial execution.
- Wrong **order or API response shape** -> contract / orchestration (boundary assembly, **Q9 defer buffer**, explicit awaits).

**Bucket-2 summary (14 handlers):** per-item `Promise.all(payloads.map(...))` only --- migrate freely. Includes moveCharacter, executeAction, disconnectMessage, roomUpdate, assets fetch/upload/decache/collaboration/fetchImports/returnValue, ephemera mapUpdate, characterEvents.

**Bucket-3 summary:** one `DataSource.subscribe()` wrapper pattern (~25 production call sites); risk lives in `receiveEvents` bodies (bucket-1 exceptions: diagnostics dedup, contentHeaders reduce above).

**C. Cross-priority `send` chains (Q4 + Q5)**

Handlers that `messageBus.send` **other message types** during a callback create multi-wave `flush` graphs. Inventory as chain graphs, not every `send` site.

```bash
rg 'messageBus\.send\(' lambda/ephemera --glob '*.ts' | rg -v '\.test\.' || true
```

**Tier 1C results -- send chain graphs (priority tiers):**

Ephemera legacy map: 1 (Unregister/Disconnect) -> 2 (Fetch/Map*) -> 3 (CheckLocation) -> 4 (MoveCharacter) -> 5 (ExecuteAction) -> 6 (RoomUpdate) -> 10 (EphemeraUpdate/Perception) -> 15 (PublishMessage/MapUpdate). DataSource: affordanceCache **4**, default **5**, coyoteGame **20**, initialize **1**.

| ID | Source | Chain | Risk |
| --- | --- | --- | --- |
| DISCONNECT-UNREG | [`disconnectMessage/index.ts`](../../../../../lambda/ephemera/disconnectMessage/index.ts) | UnregisterCharacter **1** -> PublishMessage **15** + RoomUpdate **6** | Medium |
| DISCONNECT-CHAR | same | DisconnectCharacter **1** -> PublishMessage **15** + RoomUpdate **6** | Medium |
| EXECUTE-ACTION | [`parse/executeAction.ts`](../../../../../lambda/ephemera/parse/executeAction.ts) | ExecuteAction **5** -> MoveCharacter **4** / Perception **10** / PublishMessage **15** | Medium |
| MOVE-CHAR | [`moveCharacter/index.ts`](../../../../../lambda/ephemera/moveCharacter/index.ts) | MoveCharacter **4** -> EphemeraUpdate **10**, PublishMessage **15**, RoomUpdate **6**, Perception **10**, MapUpdate **15** | **High** |
| PERCEPTION | [`perception/index.ts`](../../../../../lambda/ephemera/perception/index.ts) | Perception **10** -> PublishMessage **15**; StreamingEvent -> perception/renderOrch DS **5** | **High** |
| ROOM-AFFORD | [`roomUpdate/index.ts`](../../../../../lambda/ephemera/roomUpdate/index.ts) | RoomUpdate **6** -> StreamingEvent Affordances Requested -> affordanceCache **4** -> affordanceOrch **5** | **High** |
| COMP-KICK | [`ephemera/dataSource/index.ts`](../../../../../lambda/ephemera/dataSource/index.ts) | ephemera DS **5** -> StreamingEvent -> perception + renderOrchestration **5** | **High** |
| POSITIONS | [`positions/handleConnectionsCharactersPresence.ts`](../../../../../lambda/ephemera/dataSource/positions/handleConnectionsCharactersPresence.ts) | positions DS **5** -> CheckLocation **3** or PublishMessage **15** + RoomUpdate **6** | Medium |
| ACTIONS-PARSE | [`actions/index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) | actions DS **5** -> PublishMessage **15**, MoveCharacter **4**, ReturnValue, streamEvent side effects | **High** |
| COYOTE-LANE | [`coyoteGame/handlers/handleObjectsChangedForHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handlers/handleObjectsChangedForHypothesis.ts) | coyoteGame DS **20** -> PublishMessage **15** + named-lane flush (Q2 atomic unit) | **High** |
| COYOTE-PLAN | [`handleAwaitRoadRunnerForPlanOutcome.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handlers/handleAwaitRoadRunnerForPlanOutcome.ts) | coyoteGame DS **20** -> PublishMessage **15** + lane flush | Medium |
| CHECK-LOC-CHAIN | [`checkLocation/index.ts`](../../../../../lambda/ephemera/checkLocation/index.ts) | CheckLocation **3** -> MoveCharacter **4** or Perception **10** (successCallback) | Medium |
| FETCH-EPH | [`fetchEphemera/index.ts`](../../../../../lambda/ephemera/fetchEphemera/index.ts) | FetchPlayerEphemera **2** -> EphemeraUpdate **10** | Low |

### Tier 2 -- tests and docs as ground truth

List tests that register multiple DataSources and assert behavior across `messageBus.flush()` / lane drains. These are **known ordering specs** -- re-run after migration; do not re-derive from theory.

```bash
rg 'messageBus\.flush' lambda/ packages/mtw-lambda-patterns/ --glob '*.test.ts' -l
rg 'passThrough|integration\.test' lambda/ephemera/dataSource --glob '*.ts' -l
```

**Tier 2 results -- integration test index:**

| Test file | Spec / triage rows | Re-run command |
| --- | --- | --- |
| [`passThroughOrchestrationToCache.integration.test.ts`](../../../../../lambda/ephemera/dataSource/passThroughOrchestrationToCache.integration.test.ts) | renderOrch -> renderCache; DS-OVERLAP-5, PASS-THROUGH-INT | `npm run test -- --watchAll=false dataSource/passThroughOrchestrationToCache.integration.test.ts` |
| [`passThroughAffordanceOrchestrationToCache.integration.test.ts`](../../../../../lambda/ephemera/dataSource/passThroughAffordanceOrchestrationToCache.integration.test.ts) | affordanceOrch -> affordanceCache; AFF-CACHE-4, PASS-THROUGH-INT | `npm run test -- --watchAll=false dataSource/passThroughAffordanceOrchestrationToCache.integration.test.ts` |
| [`characterRegisteredOrientation.integration.test.ts`](../../../../../lambda/ephemera/dataSource/characterRegisteredOrientation.integration.test.ts) | Character Registered orientation; DS-OVERLAP-5 | `npm run test -- --watchAll=false dataSource/characterRegisteredOrientation.integration.test.ts` |
| [`messageBus/index.test.ts`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/index.test.ts) | Engine priority / lane wave spec (flush path) | `npm test -- ts/messageBus/index.test.ts` (from `packages/mtw-lambda-patterns/`) |

**Secondary tests (flush/lane ordering):** `renderCache/index.test.ts`, `renderCache/passThroughContract.scaffold.test.ts`, `perception/index.test.ts`, `coyoteGame/handlers/handleObjectsChangedForHypothesis.test.ts`, `handleAwaitRoadRunnerForPlanOutcome.test.ts`.

**Documented priority intent (AGENT.md edges):**

| Doc | Edge | Triage row |
| --- | --- | --- |
| [`affordanceCache/AGENT.md`](../../../../../lambda/ephemera/dataSource/affordanceCache/AGENT.md) | prio 4 before orchestration at 5 on TopologyInvalidated | AFF-CACHE-4 |
| [`renderOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md) | lane vs default-lane drain; look path perception lane then default Render Requested | COYOTE-LANE (lane pattern), PASS-THROUGH-INT |

**P0.5 verification:** all primary integration tests and `messageBus/index.test.ts` pass (baseline recorded at audit completion).

### Tier 3 -- triage matrix (fill during P0.5)

For each inventory row: evidence, risk, migration note. Q4/Q5 decisions apply to **High/Medium** rows only.

| ID | Location | Q4/Q5 | Risk | Evidence | Migration note |
| --- | --- | --- | --- | --- | --- |
| DS-OVERLAP-5 | All ephemera DataSources (shared bus filter) | Q4 | **High** | Tier 1A broadcast + envelope clusters | Concurrent DS callbacks OK (envelope no-ops); re-run passThrough integration tests after each slice |
| AFF-CACHE-4 | `affordanceCache` @ priority 4 | Q4 | **High** | AGENT.md; TopologyInvalidated cluster | P3 affordance slice: explicit catalog-before-orchestration (await or single publish); do not rely on flush priority |
| PASS-THROUGH-INT | passThrough + characterRegistered integration tests | Q4 | **High** | Tier 2 index | Tests are ordering spec; gate each High row migration |
| MOVE-CHAR | `moveCharacter/index.ts` | Q4 | **High** | Tier 1C; multi-tier sends | P4: migrate as atomic chain; `flushAndSettle` at boundaries during hybrid |
| PERCEPTION | `perception/index.ts` + perception DS | Q4 | **High** | Tier 1C; StreamingEvent fan-out | P4: migrate chain with actions/render paths; integration tests |
| ROOM-AFFORD | `roomUpdate` -> affordance pipeline | Q4 | **High** | Tier 1C; prio 4->5 edge | P3/P4: migrate affordance subgraph atomically; preserve cache-before-orchestration explicitly |
| COMP-KICK | `ephemera/dataSource/index.ts` component kick | Q4 | **High** | Tier 1C StreamingEvent chain | P4: migrate with perception/renderOrch slice; passThrough tests |
| ACTIONS-PARSE | `actions/index.ts` receiveEvents | Q4 | **High** | Tier 1C | P4: migrate parse response graph as atomic unit |
| COYOTE-LANE | `handleObjectsChangedForHypothesis` | Q4/Q5 | **High** | Q2 atomic unit; lane flush | P3: migrate bootstrap/emit/finalize + remainder in one change |
| PUBLISH-MSG | `publishMessage/index.ts` | Q5/Q9 | **High** | Orchestration: `messagesByConnectionId`, sort, `batchMessages`; client keys `MessageId` | P4: blocked on **Q9** -- defer buffer + post-`flushAndSettle` flush; aggregators enqueue only; child `publish` drained before defer flush |
| COYOTE-20 | `coyoteGame` @ priority 20 | Q4 | **Medium** | `subscriptionPriority: 20` | P3: prio-20 is flush-only deferral; concurrent with tier-5 DS under `publish` --- confirm in coyote slice |
| DISCONNECT-CHAIN | `disconnectMessage` (Unregister + Disconnect) | Q4 | **Medium** | Tier 1C prio 1 -> 15, 6 | P4: migrate whole disconnect subgraph or accept concurrent delivery + boundary drain |
| EXECUTE-ACTION | `parse/executeAction.ts` | Q4 | **Medium** | Tier 1C prio 5 -> 4/10/15 | P4: migrate with actions DS slice |
| POSITIONS | `positions/handleConnectionsCharactersPresence` | Q4 | **Medium** | Tier 1C DS -> legacy sends | P4: migrate positions + CheckLocation/disconnect side effects together |
| CHECK-LOC | `checkLocation/index.ts` | Q5 | **High** | Shielding: character dedup; side-effect-once downstream (`moveCharacter`) | P4: **producer** per-invocation `Set<characterId>` before repair; do not rely on flush batch; ties to CHECK-LOC-CHAIN |
| PLAYER-REDUCE | `assets/player/update.ts` | Q5 | **Low** | State convergence: Dynamo reducer `unique`/filter | P5: migrate freely; optional per-player coalesce is optimization only |
| EPH-UPDATE | `ephemeraUpdate/index.ts` | Q5 | **Low** | State convergence: client keyed by `CharacterId` | P4: migrate freely; extra websocket frames acceptable |
| MAP-SUB | `mapSubscription/index.ts` | Q5 | **Medium** | Contract: `extractReturnValue` spread overwrites `maps` | P4: one bus message per API op today; if multi-send returns, fix boundary merge or keep batch semantics |
| PERCEPTION-RV | `perception/index.ts` (ReturnValue tail) | Q5 | **Low** | Contract: `extractReturnValue` merges identical Success | P4: migrate with perception slice; revisit if multi-ack shapes diverge |
| DIAG-DEDUP | `diagnostics/dataSource/index.ts` | Q5 | **Medium** | Shielding: side-effect-once (`staleSessionSweep`) | P5: **producer** dedup by `dedupeKey` across all events in invocation, not only within one `receiveEvents` batch |
| CONTENT-AGG | `assets/contentHeaders/index.ts` | Q5 | **Low** | Consumer: `StandardForm.merge` in aggregator | P5: migrate freely; note remove/update ordering in same burst |
| WML-DUP-SUB | `wml/dataSource` double `.subscribe()` | Q4 | **Medium** | Tier 1A | P5: remove duplicate registration in WML slice |
| FETCH-EPH | `fetchEphemera/index.ts` | Q5 | **Low** | State convergence: full snapshot overwrite | P4: migrate freely; redundant publishes are traffic-only |
| LEGACY-TYPE | `lambda/*/messageBus/index.ts` handlers | Q4/Q5 | **Low** | 1:1 type filters; bucket 2 | Default publish rules; migrate with tests |

### Optional: observed overlap trace (ambiguous cases)

One diagnostic test: register real ephemera DataSource subscriptions, `publish` (or `send` + `flush`) one representative `StreamingEvent` per family, log `{ tag, priority, header.type }` per callback. Produces an **observed** overlap matrix from the live subscription graph.

### P0.5 outputs (inputs to locking Q4/Q5)

1. Completed subscription overlap table (Tier 1A).
2. Bucket-1 batch callback list (Tier 1B).
3. **Bucket-1 deep dive** (flush jobs, idempotency levels, fix axis per row).
4. Send-chain graph list (Tier 1C).
5. Integration test index (Tier 2).
6. Triage matrix with every **High/Medium** row having a migration note (Tier 3).

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] Phase P0 - resolve open design questions
  - [X] Record Q1 decision in **Open design questions** (hybrid boundary: `flushAndSettle`, `Promise<boolean>` returns).
  - [X] Record Q2 decision in **Open design questions** (`activeFlushLane: undefined` on `publish`, atomic migration units, DataSource lane retirement in P2).
  - [X] Record Q3 decision in **Open design questions** (`allSettled`, log-and-continue, no bus error hook).
  - [X] Record Q6 decision in **Open design questions** (`clear` resets `_inFlight`; `settle` before `clear` in tests).
  - [X] Record Q7 decision in **Open design questions** (port: `subscribe` + `publish`; `outboundBusDelivery`; package mock pattern).
  - [X] Record Q8 decision in **Open design questions** (ephemera-first ordering, Q2 atomic units, production-only `send` for fully migrated).
  - [X] Record decisions for Q4-Q5 (after P0.5) in **Open design questions** (replace questions with locked answers as decided).
  - [X] Record Q9 decision in **Open design questions** (fully locked: `registerDeferral`, `flushAndSettle` + `runDeferrals`, `onClear`, P6 boundary, phased scope).

- [X] Phase P0.5 - Q4/Q5 positive audit (see **Q4/Q5 positive audit**)
  - [X] Tier 1A: subscription overlap table (legacy handlers + all DataSource `subscribe()`).
  - [X] Tier 1B: batch-semantics classifier; list bucket-1 (true aggregation) callbacks.
  - [X] Tier 1C: cross-priority `send` chain graphs from legacy handlers and DataSource bodies.
  - [X] Tier 2: index integration / passThrough tests and documented priority AGENT.md edges.
  - [X] Tier 3: complete triage matrix; every High/Medium row has a migration note.
  - [X] Lock Q4 and Q5 from audit findings (defaults for Low rows; explicit rules for High/Medium).

- [X] Phase P1 - `InternalMessageBus` engine
  - [X] Add `publish()`, `settle()`, `_inFlight`, `flushAndSettle()` (independent from `_stream` / `flushLane`).
  - [X] Refactor `flush()` / `flush(laneId)` to return `Promise<boolean>` per Q1.
  - [X] Implement `settle()` with inner quiescence loop, `Promise.allSettled` per snapshot, rejection logging, and `Promise<boolean>` per Q1/Q3.
  - [X] `publish` passes `activeFlushLane: undefined` per Q2; wrap handler promises with `tag` for Q3 log context.
  - [X] Implement `publish` subscriber scheduling per Q4: concurrent matching subscribers, no priority sort (not migration order).
  - [X] Extend `clear()` to reset `_stream` and `_inFlight` per Q6 and run deferral `onClear` per Q9.
  - [X] Add `registerDeferral` / `runDeferrals` stub per Q9 (empty registry OK in P1); first registrant **PUBLISH-MSG** coalescer in P4.
  - [X] Add tests: `flushAndSettle` cross-seam ping-pong, boolean no-op returns, single subscriber, concurrent subscribers, recursive publish during settle, **settle drains all handlers when one rejects** (Q3), **`clear()` drops `_inFlight` tracking** (Q6), coexistence with existing `send`/`flush` tests; **Q9** tests when defer API locks.
  - [X] Baseline: `npm test -- ts/messageBus/index.test.ts` passes (22 tests; P1 baseline + new publish/settle suite).

- [ ] Phase P2 - `DataSource` port and outbound path (piecewise per Q7; closeout per Q2)
  - [ ] P2a -- infrastructure: `DataSourceMessageBusPort` adds `publish` (keep `send` during migration); constructor `outboundBusDelivery?: 'send' | 'publish'` (default `'send'`); branch in `sendStreamingEventOnBus`.
  - [ ] P2a -- extend package mocks with `publish: jest.fn()`; add tests for `'publish'` outbound path (Q7).
  - [ ] P2b -- per DataSource: set `outboundBusDelivery: 'publish'` with that directory's lane/send atomic migration (coordinate with P3/P4/P5); update that DS's package/lambda tests to assert `publish`.
  - [ ] P2c -- closeout when no production DataSource uses `'send'` outbound: remove `outboundBusDelivery`, port `send`, `_inboundFlushLaneStack`, `StreamEventParams.laneId`, and `send` branch in `sendStreamingEventOnBus`.
  - [ ] Run: `npm test -- ts/dataSource/index.test.ts` from `packages/mtw-lambda-patterns/` after each P2 slice.

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
  - [ ] Migrate bucket-1 rows per **Bucket-1 deep dive** fix axis (producer coalesce / contract / consumer / **Q9 defer**) before ingress moves to `publish`; Low rows may migrate without redesign; **PUBLISH-MSG** requires Q9 locked.
  - [ ] Confirm ephemera `app.ts` already uses `flushAndSettle()` from P3 (no further boundary change until P6).

- [ ] Phase P5 - other lambdas
  - [ ] assets (`app.ts` + DataSources)
  - [ ] wml (`app.ts`, `promoteToCanon.ts`)
  - [ ] connections, cognitoEvent, diagnostics
  - [ ] Each lambda `app.ts`: `flush()` -> `flushAndSettle()` (Q1).

- [ ] Phase P6 - remove legacy machinery and close out
  - [ ] Confirm `rg 'messageBus\.send\(' lambda/` zero production hits and tests/harnesses migrated (Q8).
  - [ ] Delete `send`, `flush`, `flushLane`, lane queue cells, and lane-related types from `InternalMessageBus` in one commit; refactor `flushAndSettle()` to settle-only loop + `runDeferrals()` tail (Q1 P6 + Q9 #6).
  - [ ] Lambda boundaries: keep single `flushAndSettle()` call site (no bare `settle()` + separate `runDeferrals()` in `app.ts`).
  - [ ] Remove lane docs from [`AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md); document `publish`/`settle` steady state in package and [`lambda/ephemera/messageBus/AGENT.md`](../../../../../lambda/ephemera/messageBus/AGENT.md).
  - [ ] Update DataSource implementation doc (lane section retired).
  - [ ] Archive or delete this task plan.

## Verification

### P0.5 audit (ephemera bus-ordering spec)

From `lambda/ephemera/` after triage matrix is drafted; re-run when High/Medium rows migrate:

```bash
npm run test -- --watchAll=false dataSource/passThroughOrchestrationToCache.integration.test.ts
npm run test -- --watchAll=false dataSource/passThroughAffordanceOrchestrationToCache.integration.test.ts
npm run test -- --watchAll=false dataSource/characterRegisteredOrientation.integration.test.ts
```

From `packages/mtw-lambda-patterns/`:

```bash
npm test -- ts/messageBus/index.test.ts
```

### P1 engine (complete)

From `packages/mtw-lambda-patterns/`:

```bash
npm test -- ts/messageBus/index.test.ts
```

22 tests pass (11 legacy flush/lane + 11 publish/settle/flushAndSettle/deferral).

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
| Q6 resolved (`clear` + `_inFlight`; test `settle` before `clear`) | Done |
| Q7 resolved (port `publish` only; `outboundBusDelivery`; mocks) | Done |
| Q8 resolved (ephemera-first; atomic units; production `send` gate) | Done |
| P0.5 Q4/Q5 positive audit + triage | Done |
| Open questions Q4-Q5 resolved (P0.5) | Done |
| Open question Q9 (`registerDeferral` + phased scope) | Done |
| Engine `publish`/`settle` + tests (P1) | Done |
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
| Ordering | Priority-enforced | Concurrent matching subscribers (Q4 locked) |
| Intermediate publications | Deferred to next wave | Scheduled immediately |
| Concurrency | Single wave focus | Natural Node.js async concurrency |
| Tracking | `_stream`, `processedBy`, optional `laneId` | `_inFlight` Promise set |
| `activeFlushLane` in callback | Set by `flush` / `flush(laneId)` | Always `undefined` (Q2) |
| Handler errors | `flush`: `Promise.all` (may reject) | `settle`: `allSettled`, log, continue (Q3) |
| `clear()` | `_stream` only (today) | `_stream` + `_inFlight` reset (Q6); deferral `onClear` (Q9); tests: `settle` first |
| Outbound coalesce (orchestration) | Implicit in batched handler callback | Defer buffer; `runDeferrals()` after `flushAndSettle` idle loop (Q9) |

**Coexistence:** `publish`/`settle` and `send`/`flush` do not share queue or Promise-tracking machinery during migration. Cross-seam side effects are drained at lambda boundaries via `flushAndSettle()` (Q1). Orchestration outbound batching (e.g. `publishMessage`) uses a **defer buffer** finalization phase (Q9), distinct from `_inFlight` subscriber drain. Lane inheritance applies only to `flush`; named-lane subgraphs migrate as **atomic units** without publish -> `send` cascades (Q2).
