# MessageBus: `publish`/`settle` migration (planning)

**Status:** In progress (P4). Q1-Q9 are locked (P0.5 complete; Q9 **`deliveryMode`**: deferred **only** character-move). **Phase P1** complete. **P2a** complete. **P2b** started (`mtw.ephemera.coyoteGame`, `mtw.ephemera.renderOrchestration`, `mtw.ephemera.affordanceOrchestration`, `mtw.ephemera.actions`, `mtw.ephemera.perception`, `mtw.ephemera.renderCache`, `mtw.ephemera.affordanceCache`). **P3** complete. **P4** EventBridge ingress + **PUBLISH-MSG** + **CHECK-LOC** + **WebSocket / api.ephemera ingress** + **ACTIONS-PARSE** + **POSITIONS** + **COMP-KICK + PERCEPTION** + **RENDER-CACHE** + **AFFORDANCE-CACHE** complete. Next step: **MOVE-CHAR** (first unchecked slice in **Recommended order**).

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

Introduce a **`publish`/`settle`** pattern alongside the existing **`send`/`flush`** wave model on `InternalMessageBus`, then migrate call sites piecewise until `send` has zero remaining uses and the old machinery can be deleted.

**Motivation:** Domain-authoritative DataSources subscribe and publish events independently. The wave/priority model defers intermediate publications to the next drain, which fights long-running pipelines (Coyote hypothesis, thinking persistence, render orchestration) that need concurrent handling while work continues. Virtual **`laneId`** + manual **`flush(laneId)`** mitigates this but is cumbersome; `publish`/`settle` is the intended steady-state abstraction.

**Design handoff:** Initial brainstorming is captured in an external handoff document (`messageBus-publish-settle-handoff.md`). This plan records task ordering, verification, migration inventory, and **open questions** to resolve before or during implementation.

This file is task-scoped. Archive or delete it when migration completes and lasting behavior lives in package `AGENT.md` files per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Scope and boundaries

### In scope

- Add `publish()`, `settle()`, `_inFlight`, and `flushAndSettle()` to [`InternalMessageBus`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/index.ts) (independent from `_stream` / `flushLane`).
- **Q9:** `registerDeferral` / per-need aggregators; **PUBLISH-MSG** **`deliveryMode: 'deferred'`** only for **character move** (leave / header / arrive); default **`immediate`** everywhere else including Generating/terminal replace (see **Open design questions**).
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

(`laneId` overload optional for scoped `flush(laneId)` / `flushAndSettle(laneId)` during Phase P3 migration only; default-lane `flushAndSettle()` is the lambda `app.ts` **boundary drain** contract.)

**`Promise<boolean>` on `flush` and `settle`:**

| Method | Returns `true` when | Returns `false` when |
| --- | --- | --- |
| `flush()` / `flush(laneId)` | At least one subscription callback ran with a non-empty batch (any `flushLane` recursion depth for that lane) | No processable items for that lane at entry (no-op) |
| `settle()` | At least one `publish` handler was scheduled; inner quiescence loop still drains recursive `publish` during the call | `_inFlight` empty throughout the call |

`settle()` keeps an **inner** drain loop (await `_inFlight` to quiescence within one call). The **outer** `flushAndSettle` loop handles **cross-system** ping-pong (`flush` -> `publish` -> `settle` -> `send` -> ...). Parallel `Promise.all([flush(), settle()])` per outer iteration is intentional; the outer loop corrects timing between the two systems.

**Lambda boundaries (`app.ts` and equivalent ingress exits):** Replace `await messageBus.flush()` with `await messageBus.flushAndSettle()` as soon as `flushAndSettle` exists. Safe before any `publish` call sites exist (`settle()` always `false`, one iteration). No per-lambda "only flush" or "only settle" exceptions at boundaries.

**Scope:** `flushAndSettle()` without `laneId` drains the **default lane** (`flush()`) plus global `_inFlight` (`settle()`). Named-lane items remain the responsibility of scoped `flush(laneId)` / `flushAndSettle(laneId)` at call sites until those paths migrate to `publish` (see **Migration inventory**).

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

**Migration constraint (atomic units):** Avoid situations where a named-lane context migrates to `publish` while handlers in that subgraph still `send()` (or DataSource still `send`s via `streamEvent`) without explicit lane. Partial migration routes those `send`s to the **default** lane while scoped `flushAndSettle(laneId)` only drains the **named** lane (Q1) -- a silent ordering break.

Rule: **do not migrate a named-lane `flush` / `flushAndSettle(laneId)` call site to `publish` until every `send` reachable from handlers invoked in that subgraph is also `publish` in the same change.**

Representative atomic units (see **Migration inventory**):

- [`hypothesisThinkingPersistence.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/hypothesisThinkingPersistence.ts) -- bootstrap / emit / finalize blocks (`send*` + scoped `flush(laneId)`); see **Lane flush intent at migration** -- concurrent `publish`, no producer-side mid-invocation drain.
- [`handleObjectsChangedForHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handlers/handleObjectsChangedForHypothesis.ts) -- lane `send` **and** parallel `remainder()` (`streamEvent` + default-lane `send`) together.
- [`orchestrationHandler.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.ts) + [`findRender.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts) -- **Migrated (P3):** terminal and generation outbounds use `publish`; no `laneId: ''` or generation-lane flush.
- [`affordanceOrchestration/orchestrationHandler.ts`](../../../../../lambda/ephemera/dataSource/affordanceOrchestration/orchestrationHandler.ts) + [`publishedEvents.ts`](../../../../../lambda/ephemera/dataSource/affordanceOrchestration/publishedEvents.ts) send-helpers + fan-out -- **Migrated (P3):** outbounds and ingress use `publish`; no named lanes; AFF-CACHE-4 explicit `handleTopologyInvalidated` await before topology fan-out; session orientation calls `orchestrateAffordanceRequest` directly.

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

**Decision: test harness drain before `clear()` (Q6).**

When tests use `publish` / `_inFlight`:

1. **Test harness drain:** **`await messageBus.settle()`** (or **`await messageBus.flushAndSettle()`** while `send`/`flush` still exist) at end of test body or in **`afterEach`** before `clear()`.
2. Then **`messageBus.clear()`** for isolation (existing `beforeEach` / `afterEach` pattern).

Do not rely on `clear()` alone to drain async handler work; that drops tracking while promises may still be running and causes cross-test flakes. This is **not** producer-side mid-invocation drain (see **Bus drain terminology**).

**Production lambda boundaries:** `clear()` at ingress start remains correct (empty bus). **Boundary drain** uses `flushAndSettle()` (Q1), not `clear()`.

**Docs:** Note the teardown pattern in [`AGENT.testing.md`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.testing.md) when P1 lands.

### Q7. `DataSource` port shape -- **RESOLVED**

[`DataSourceMessageBusPort`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts) currently exposes `send` and `subscribe` only.

**Decision: port adds `publish`, not `settle`.**

| Surface | On `DataSourceMessageBusPort`? | Why |
| --- | --- | --- |
| `subscribe` | Yes | DataSource registers ingress in constructor |
| `publish` | Yes | DataSource **produces** outbound `streamEvent` / `streamEnvelope` traffic |
| `settle` | **No** | **Boundary drain** and **test harness drain** only (`flushAndSettle` in `app.ts`; Q6 test teardown) -- not on `DataSourceMessageBusPort`; not producer-side mid-invocation drain in handler bodies |

Handler deps (Coyote, thinking, etc.) continue to use `Pick<MessageBus, ...>` on the **full domain bus** where `publish` (and during migration, legacy `flush` / scoped `flush(laneId)`) is needed -- not via the DataSource port type.

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

Authoritative starting list is under Q2 **atomic units** (hypothesisThinkingPersistence blocks, `handleObjectsChangedForHypothesis` + `remainder()`, render `orchestrationHandler` + findRender, affordance `orchestrationHandler` + `publishedEvents` send-helpers, etc.). Extend the list when P0.5 triage or P3 work surfaces additional High/Medium rows. **P3 ordering:** migrate **`affordanceOrchestration`** immediately after **`renderOrchestration`** (same pass-through orchestration pattern; do not defer affordance orchestration to P4). **Rule:** do not migrate a named-lane scoped drain to `publish` until every `send` reachable in that subgraph is also `publish` in the **same change** (Q2).

**Decision: per-lambda "fully migrated" = zero `messageBus.send` in production code.**

- **Counts for lambda status:** `rg 'messageBus\.send\(' lambda/<name>/ --glob '*.ts' | rg -v '\.test\.'` returns no hits.
- **Tests and harnesses** (e.g. `runCoyoteEngineTestHarness.ts`): migrate with each slice; they do **not** gate calling a lambda "fully migrated" for boundary semantics, but must be clean before **P6** global deletion of `send`/`flush`.
- **`outboundBusDelivery`:** a lambda is not fully migrated while any production DataSource constructor in that lambda still defaults to `'send'` (Q7).
- Aligns with Q1: a fully migrated lambda keeps `flushAndSettle()` at `app.ts` until P6 even when production `send` is zero (`flush()` no-ops).

### Q9. Defer buffer (orchestration outbound coalescing) -- **RESOLVED**

Under `flush`, orchestration-class handlers (notably [`publishMessage`](../../../../../lambda/ephemera/publishMessage/index.ts)) receive **batched** `payloads`, merge per-connection outbound work, sort by `CreatedTime`, and `batchMessages` before `apiClient.send`. That batched **everything** in the wave -- broader than what most sends need. Under `publish`, each matching subscriber gets **`payloads: [singleItem]`** per call (Q5); concurrent handler invocations no longer share one callback scope.

**Locked scope:** **`deliveryMode: 'deferred'`** is required for **one production pattern only -- character move** (multiple `MessageId`s, leave / header / arrive, ordered via `messageGroupId` / `OrchestrateMessages`). All other `PublishMessage` traffic uses **`immediate`** (default): wire in the handler after resolve/Dynamo. **Generating -> terminal** on the same `messageId` uses **immediate** plus **explicit monotonic `createdTime`** (revision contract), not defer -- see **Generating/terminal replace** below. See **PublishMessage: `deliveryMode`** and **Single-invocation render cascades**.

**This is not a second subscriber queue.** `_inFlight` + `settle()` already drain **subscription handler** work (including recursive `publish`). The defer buffer holds **character-move** deferred wire rows until boundary `afterSettled`. **Immediate-mode** wire sends stay in the handler. Deferred flush is a **finalization phase**, not another round of subscription matching.

#### Problem split (do not conflate)

| Layer | Drained by | Holds |
| --- | --- | --- |
| Subscriber graph | `settle()` / `flushAndSettle` idle loop | Handler promises (`_inFlight`; legacy `_stream`) |
| Outbound defer buffer | `runDeferrals()` **after** idle loop | Per-need aggregator state (e.g. per `connectionId` coalesce) |

#### Locked approach: `registerDeferral` + per-need aggregators

Avoid a bus-owned generic defer queue (`deferOutbound(key, item)`). Instead:

- **`InternalMessageBus`** exposes a thin deferral registry: `registerDeferral(tag, { onClear?, afterSettled })`, `runDeferrals()`, and `clear()` invokes each registrant's `onClear` (default no-op). Registrations persist across invocations.
- **Aggregation logic** lives in independent module-scoped entities (one per concern): `PublishMessageCoalescer` (deferred wire rows only), checkLocation dedup state, diagnostics intake dedup, etc. Deferred-mode handlers enqueue to the entity during execution; **`afterSettled`** (or handler phase for CHECK-LOC-style cases) performs IO. Immediate-mode `PublishMessage` does not use the coalescer.
- **`flushAndSettle()`** tail (lambda boundary, after idle loop): `await runDeferrals()` then `extractReturnValue` (today: [`app.ts`](../../../../../lambda/ephemera/app.ts) does `flush()` then `extractReturnValue`).

This migrates aggregation **off the bus as aggregation server** (batched `payloads` in one subscribe callback) **onto collaborators** that handlers and DataSources use explicitly. The bus still **dispatches** subscribers; it does not own merge/sort/`batchMessages` semantics.

**Why this fits without over-engineering:** the bus adds ~one registry + one drain call; each bucket-1 row owns its buffer rules. No keyed defer store on the bus; no second subscriber queue.

**Critical timing (locked):** `afterSettled` runs **once per boundary drain** (`flushAndSettle`), after the **full** idle loop exits -- **not** after every producer-side mid-invocation drain. Boundary `afterSettled` flushes outbound coalesce after the whole invocation's bus graph is quiescent.

**`afterSettled` callback contract (locked for current needs):** **IO-only** -- no `messageBus.publish()` or `messageBus.send()` from registrants. Current bucket-1 consumers fit: **PUBLISH-MSG** (`apiClient.send`), **DIAG-DEDUP** (EventBridge / sweep side effects outside the bus), boundary **`extractReturnValue`** (reads `_stream` already populated during handler phase). **CHECK-LOC** repair should stay in handler phase (or enqueue-only into an entity); do not `send` new bus messages from `afterSettled` in v1.

**No repeat loop (locked for v1):** one idle loop, then one `runDeferrals()`, then HTTP response assembly. A **future** extension if needs expand: wrap idle loop + `runDeferrals()` in an outer repeat until both are no-op (only if a registrant is allowed to enqueue bus work -- not planned for current migration slices). Document in implementation guide; do not build until a concrete registrant requires it.

**Aggregator + `publish` (deferred mode only):** producer sets `deliveryMode: 'deferred'`; handler enqueues wire rows to the coalescer, returns; idle loop drains children; `afterSettled` runs coalescer flush. Child paths that must share the same deferred outbound batch must use the **same** coalescer entity.

**`clear()` at ingress (locked):** symmetric with Q6 -- `messageBus.clear()` resets `_stream` / `_inFlight` **and** runs each deferral's `onClear` (ingress lifecycle). Deferral **registrations** persist; per-invocation buffer contents do not. Aggregators with owned buffers supply `onClear: () => reset()`; egress-only deferrals (e.g. `extractReturnValue`) may omit `onClear` or use a no-op.

**Precedent:** `extractReturnValue` is already boundary assembly separate from subscribers; it may register as a deferral with `afterSettled` only (`onClear` optional). Bus-owned registry keeps `app.ts` to `flushAndSettle` + return.

#### Open questions (resolve before PUBLISH-MSG `publish` ingress)

1. **Hook API shape** -- **RESOLVED:** `registerDeferral(tag, { onClear?, afterSettled })` on bus; `clear()` runs `onClear`; `runDeferrals()` runs `afterSettled` after idle loop. Per-need aggregators wrap registration at module load (not explicit `app.ts` flush calls per coalescer). Name avoids "handler" collision with subscribe callbacks.
2. **`flushAndSettle` integration** -- **RESOLVED (v1):** Q1 dual idle loop (`Promise.all([flush, settle])` until both no-op) **inside** `flushAndSettle`, **then** `await runDeferrals()`, **then** `extractReturnValue` / HTTP response. `runDeferrals()` is not a substitute for the flush/settle loop -- it runs only after subscriber-graph quiescence. `afterSettled` hooks are **IO-only**; **no** outer repeat loop on deferrals. Future: repeat wrapper if bus-enqueueing registrants are ever required (out of scope for P1-P5 triage rows).
3. **`clear()` lifecycle** -- **RESOLVED:** Yes. `clear()` at ingress resets defer / aggregator buffers (symmetric with Q6 `_inFlight` reset). Registrations persist.
4. **Aggregators that call `publish`** -- **RESOLVED:** For **`deliveryMode: 'deferred'`**, handler enqueues to coalescer, may `publish` children, **returns** without mid-callback wire delivery; **boundary drain** (`flushAndSettle` idle loop) drains spawned handler work; `afterSettled` flushes deferred rows. Child paths that share the same deferred batch enqueue to the **same** coalescer. **`deliveryMode: 'immediate'`** (default) sends wire in handler -- no coalescer. **Avoid producer-side mid-invocation drain** (`await settle()` in production aggregators or handler bodies) -- global `_inFlight` quiescence fights Q4 concurrency and duplicates **boundary drain**. If a handler "needs child results before continuing" in the same callback, **restructure** (child enqueues to shared entity; split subscriber; move continuation to child handler). If that need appears at **boundary** and implies bus enqueue after coalesce flush, that is the signal for the **future repeat wrapper** (idle loop + `afterSettled` until stable), not producer-side `settle()`. **Test harness drain** and **boundary drain** are the only intended production/test uses of `settle` / `flushAndSettle` (see **Bus drain terminology**). **Lane migration:** do **not** replace scoped `flush(laneId)` with producer-side `settle()` by default; see **Lane flush intent at migration** (many lane flushes are anti-deferral only; `publish` + continue is often correct).
5. **Scope of first implementation** -- **RESOLVED:** P1 ships bus `registerDeferral` / `runDeferrals` (empty registry OK; wired into `flushAndSettle` + `clear()`). P4 lands **PUBLISH-MSG** dual-path handler + move-only deferred coalescer registrant. **Immediate** `publish` ingress can migrate broadly; **`deliveryMode: 'deferred'`** only on **MOVE-CHAR** / character-move perception legs (see producer table). **CHECK-LOC** (P4 triage) and **DIAG-DEDUP** (P5 triage) add deferrals when their migration slices land -- not in P1 stub scope. **`extractReturnValue`** may remain explicit in `app.ts` or register as egress-only deferral (`afterSettled` only); decide in P4 ephemera boundary slice, not a Q9 blocker.
6. **P6 steady state** -- **RESOLVED:** Keep `flushAndSettle` = Q1 loop-until-both-idle **then** `runDeferrals()` for the full hybrid period (P1-P5). Cross-seam `flush` <-> `publish`/`settle` ping-pong requires **both** arms until `send`/`flush` are globally deleted. At P6 closeout, deleting `flush` removes the flush arm from the implementation only; the operator still ends with `runDeferrals()`. Do not plan an intermediate "settle-only `flushAndSettle`" that drops the flush arm while legacy `send` paths remain.
7. **PublishMessage selective delivery (`immediate` vs `deferred`)** -- **RESOLVED:** Do **not** defer all `PublishMessage` websocket egress to boundary `afterSettled`. Under `flush`, the handler batched **every** queued payload in the wave -- that was accidental scope, not a universal contract. **`deferred` is for character move only** (cross-`MessageId` ordering on one connection). Everything else is **`immediate`**; Generating/terminal uses immediate plus explicit revision timestamps (item 8).

8. **Generating/terminal replace (same `messageId`)** -- **RESOLVED:** **Not deferred.** Intended UX: show Generating placeholder on the client **as soon as** generation starts; terminal **replaces** that row when render completes (client revision model: latest `CreatedTime` per `MessageId`). Under today's hybrid path, render/perception cascades run **in one ephemera invocation** (bus `publish` for `StreamingEvent`s between DataSources; `send` for `PublishMessage` until migrated); boundary `flushAndSettle` batches all `PublishMessage`s into one `publishMessage` handler call -- so Generating and terminal often ship in **one websocket burst** and the placeholder **never appears**. Fix: **`deliveryMode: 'immediate'`** on both legs; on Generating assign `createdTime = T0`, store on perception thread; on terminal `createdTime = Math.max(T0 + 1, getCurrentTimestamp())`; add optional `createdTime` on `PublishPerceptionMessage` if not already on bus type. Coyote hypothesis WorldMessage path already uses explicit `createdTime` for the same pattern.

#### Single-invocation render cascades (why immediate wire matters)

Ephemera DataSources (`renderOrchestration`, `renderCache`, `perception`, ...) share one **`messageBus`** per lambda invocation (side-effect imports in [`app.ts`](../../../../../lambda/ephemera/app.ts)). A typical slow render path in **one** invocation:

1. `renderOrchestration` publishes **`Generation Started`** (`streamEvent` -> `messageBus.publish`).
2. Bedrock / generation runs **in-process** (same invocation, may take seconds).
3. **`Render Generated`** -> `renderCache` -> **`Render Pertains`** -> `perception` -> `PublishMessage`.
4. WebSocket / EventBridge ingress: **one** `flushAndSettle()` at lambda exit ([`app.ts`](../../../../../lambda/ephemera/app.ts) lines 141 / 323) -- no intermediate production `flush` on the main command path.

| Bus API | When work runs | `PublishMessage` wire today |
| --- | --- | --- |
| `publish(StreamingEvent)` | Subscriber callbacks start immediately (`_inFlight`) | N/A |
| `send(PublishMessage)` | Queued on `_stream` until `flush` in `flushAndSettle` | **All** queued rows in one `publishMessage` batch at boundary |

So bus cascades do **not** split Generating and terminal across ephemera invocations; they **do** defer **all** `PublishMessage` wire egress to boundary flush until **`immediate`** delivery is implemented. Cross-lambda starts (EventBridge from assets, etc.) are **separate ingress events**, not mid-cascade handoffs inside ephemera.

#### PublishMessage: `deliveryMode` (move-only deferral)

Add to [`PublishMessageBase`](../../../../../lambda/ephemera/messageBus/baseClasses.ts):

```ts
/** Websocket egress timing. Default `immediate`. */
deliveryMode?: 'immediate' | 'deferred'
```

| Mode | When | Handler behavior |
| --- | --- | --- |
| **`immediate`** (default) | **All** traffic except character-move burst (say/narrate/OOC, affordances, Generating/terminal, single-shot perception, ...) | Resolve targets, `publishMessageDynamoDB`, **`apiClient.send` per connection** in the same handler invocation. |
| **`deferred`** | **Character move only** -- leave, render header, arrive (`messageGroupId` / `OrchestrateMessages` offsets across multiple `MessageId`s on one connection) | Resolve targets, `publishMessageDynamoDB`, **enqueue wire row** on `PublishMessageCoalescer`; **no** `apiClient.send` in handler. `afterSettled` sorts by `CreatedTime`, `batchMessages`, flushes. |

**Producer contract (explicit opt-in to deferral):**

| Producer / pattern | `deliveryMode` | Notes |
| --- | --- | --- |
| **Character move** -- [`moveCharacter`](../../../../../lambda/ephemera/moveCharacter/index.ts), [`characterMoveDelivery`](../../../../../lambda/ephemera/dataSource/perception/characterMoveDelivery.ts), character-move legs in [`orchestrate.ts`](../../../../../lambda/ephemera/dataSource/perception/orchestrate.ts) (leave / header / arrive with move `messageGroupId`s) | `'deferred'` | **Only** production use of defer. |
| **Generating -> terminal** (same `messageId`, render/Coyote placeholders) | **`immediate`** | Explicit `createdTime`: `T0` on Generating, `Math.max(T0 + 1, now)` on terminal; store `T0` on perception thread. |
| Everything else | omit or `'immediate'` | |

Do **not** infer `deferred` from `messageGroupId` inside the handler -- producers set `deliveryMode` explicitly. (Optional future: lint that `deferred` appears only on character-move call sites.)

**Dual-path handler:** Refactor [`publishMessage/index.ts`](../../../../../lambda/ephemera/publishMessage/index.ts) so target resolution, `OrchestrateMessages` offset math, and Dynamo persistence are **shared**; only the wire tail branches on `deliveryMode`. The coalescer holds **deferred rows only** (expect **character-move** traffic in practice). `registerDeferral` + `afterSettled` flush is still required for move under concurrent `publish`; coalescer is often empty when an invocation has no move.

**Why build defer at all:** Migration needs a substitute for flush-era batching **on the move path only**; the dual-path handler is still the P4 **PUBLISH-MSG** slice. Narrow scope keeps the coalescer small and testable.

**Migration:** P4 **PUBLISH-MSG** ships dual-path handler + coalescer. Annotate **MOVE-CHAR** / character-move perception producers with `deliveryMode: 'deferred'`; migrate all other `PublishMessage` `send` -> `publish` with **immediate**; wire Generating/terminal explicit `createdTime` in **COMP-KICK + PERCEPTION** (or adjacent slice). Tests: publishMessage unit tests (both modes); character-move order on deferred `afterSettled`; Generating then terminal visible across two immediate wire sends in integration tests.

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

// Ephemera: publishMessage coalescer (registers at module load; deferred rows only)
publishMessageCoalescer.registerDeferral(messageBus)
// internally: { onClear: () => this.reset(), afterSettled: () => this.flushDeferred() }

// Producer (default immediate):
messageBus.publish({
    type: 'PublishMessage',
    targets: [characterId],
    displayProtocol: 'SayMessage',
    // deliveryMode omitted -> immediate wire send in handler
    ...
})

// Producer (character move -- only deferred use case):
messageBus.publish({
    type: 'PublishMessage',
    displayProtocol: 'WorldMessage',
    deliveryMode: 'deferred',
    messageGroupId: leaveMessageGroupId,
    ...
})

// Producer (Generating placeholder -- immediate + explicit revision time):
messageBus.publish({
    type: 'PublishMessage',
    displayProtocol: 'PerceptionMessage',
    messageId,
    createdTime: generatingCreatedTime,
    // deliveryMode omitted -> immediate; terminal uses createdTime: Math.max(generatingCreatedTime + 1, now)
    ...
})
```

**Handler contract (`publishMessage`):** branch on `deliveryMode`. **`immediate`:** resolve, persist, send wire in handler. **`deferred`:** resolve, persist, enqueue to coalescer only (character move); **do not** `apiClient.send` in handler. Return; let **boundary drain** + `afterSettled` deliver deferred move rows.

**Primary migration consumer:** **PUBLISH-MSG** (Tier 3 / Bucket-1 deep dive). Deferred coalescer scope: **moveCharacter graph only**. **CHECK-LOC** and **DIAG-DEDUP** use producer coalescing/dedup patterns, not `PublishMessage` defer.

**Approach:** P1 implements engine + empty deferral registry. P4 implements **PUBLISH-MSG** dual-path handler + `deliveryMode` on bus type; **`deferred` on MOVE-CHAR / character-move perception only**; Generating/terminal immediate + `createdTime` in perception slice.

#### Bus drain terminology (avoid "inline `settle()`")

The phrase **"inline `settle()`"** conflates distinct scopes and has misled migration planning (e.g. treating `flush(laneId)` as a mandate for `await settle()` in handler bodies). Use these terms instead:

| Term | Where | Role |
| --- | --- | --- |
| **Boundary drain** | Lambda exit (`app.ts` and equivalents): `await flushAndSettle()` then `runDeferrals()` / response assembly | **Required** once per invocation; drains subscriber graph + defer tail after all handler-phase `publish`/`send` |
| **Test harness drain** | Unit/integration tests: `await settle()` or `await flushAndSettle()` before assertions or before `clear()` (Q6) | Makes async subscribers observable; prevents cross-test flakes; **not** production handler code |
| **Producer-side mid-invocation drain** | Inside `receiveEvents`, pipeline orchestration, or aggregators: `await settle()`, `await flush()`, or `await flush(laneId)` to wait for child bus work before continuing | **Avoid** under steady-state `publish`/`settle`; use concurrent `publish` + boundary drain, Q9 defer, or explicit restructure when triage requires strict ordering |
| **Scoped lane drain (legacy `send`/`flush`)** | `send` + `await flush(laneId)` on the old path | Flush-era anti-deferral or scoped sequencing; see **Lane flush intent at migration** -- do **not** default to producer-side `settle()` when migrating |

**Steady-state contract:** handlers **`publish` and return**; **boundary drain** quiesces the invocation. Do not use producer-side mid-invocation drain as a stand-in for boundary drain or for legacy `flush(laneId)` unless triage documents a genuine strict-ordering requirement.

## Getting started

1. Skim task-plan conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read current steady-state messageBus docs (link from here; do not duplicate architecture in this plan):
   - [`packages/mtw-lambda-patterns/ts/messageBus/AGENT.md`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.md)
   - [`packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md) (virtual lanes section is what we are retiring on migrated paths)
   - [`packages/mtw-lambda-patterns/ts/messageBus/AGENT.testing.md`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.testing.md)
3. Read DataSource lane behavior: [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (**Message bus lanes**).
4. Read ephemera lane call-site context: [`lambda/ephemera/messageBus/AGENT.md`](../../../../../lambda/ephemera/messageBus/AGENT.md), [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md), [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md), [`lambda/ephemera/dataSource/affordanceOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/affordanceOrchestration/AGENT.md) (render-orchestration analogue; **P3** slice immediately after render orchestration). Read **Bus drain terminology** and **Lane flush intent at migration** before migrating scoped `flush(laneId)` sites.
5. **Command authority:** tests run via Jest from [`packages/mtw-lambda-patterns/package.json`](../../../../../packages/mtw-lambda-patterns/package.json) (`npm test`). If examples conflict elsewhere, use that package's scripts.
6. Before locking Q4/Q5, run **Phase P0.5** (**Q4/Q5 positive audit**): build the triage matrix; do not guess across all call sites.
7. Run baseline verification before engine edits (from `packages/mtw-lambda-patterns/`):

```bash
npm test -- ts/messageBus/index.test.ts
```

## Lane flush intent at migration (P3+)

When migrating scoped `flush(laneId)` call sites (legacy **scoped lane drain**), **do not assume** the flush proved that work had to run **strictly before** later code in the same handler (e.g. before Bedrock / LLM hops). Under the legacy `send`/`flush` model, an immediate named-lane flush often meant something weaker and more specific:

**Anti-deferral, not a hard prerequisite.** Messages `send` on the **default lane** from inside a **late-priority** subscription callback (notably coyoteGame at priority **20**) are not processed until that callback **returns**. `flushLane` does not recurse into new default-lane items until the current priority tier's callbacks finish. Long non-bus work in that callback (LLM pipeline) therefore deferred default-lane persistence until **after** the LLM run. A dedicated lane plus immediate `flush(laneId)` was a **scoped lane drain** so thinking scheduling / results handlers ran **without** waiting for the LLM stretch -- **without** nesting a global `flush()` inside an outer `flushLane` (re-entrant default-lane drain is brittle and avoided).

| Legacy pattern | Typical effect when nested in late-priority handler |
| --- | --- |
| `send` on default lane, no scoped lane drain | Bus subscriber runs **after** long in-callback work (e.g. entire LLM pipeline) |
| `send` on named lane + `await flush(laneId)` | Scoped lane drain **before** that long work continues (wall-clock), not necessarily because later steps read Dynamo |
| `send` on default lane + nested `flush()` mid-callback | Theoretically processes sooner; **not** a viable steady pattern (chaotic re-entry into global wave drain) |

**Publish migration opens a third option:** `publish` schedules matching subscribers **immediately**; producer code can **continue** (including LLM) while persistence handlers run **concurrently**. **Boundary drain** still quiesces the invocation at exit; **no producer-side mid-invocation drain** for this class (Q9). Do **not** mechanically map `flush(laneId)` -> `await settle()` to preserve "guaranteed before LLM" ordering that was often only a flush-era side effect.

**Coyote hypothesis thinking (canonical example):** [`hypothesisThinkingPersistence.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/hypothesisThinkingPersistence.ts) bootstrap / emit / finalize blocks use scoped lane drain so `mtw.ephemera.thinking.scheduling` / `thinking.results` are not deferred behind the full LLM pipeline. The pipeline keeps `generationId` / `workItemId`s in **memory** (`state.thinking`); Bedrock hops do not read thinking rows back from Dynamo to proceed. **Job / schedule / result persistence can run concurrently with LLM** under `publish`; the refactor is **easier** than reproducing artificial "strictly before Bedrock" ordering. Migrate with `publish` (drop `laneId`), **remove** scoped `flush(laneId)`, **do not** add producer-side `settle()`, and **do not** introduce direct persist bypasses solely to mimic pre-Bedrock wall-clock ordering unless product explicitly requires it.

**When scoped lane flush *did* mean strict ordering:** Some sites (orchestration handoffs, cache-before-orchestration edges) may genuinely require child bus work before the producer continues. Those are the cases for explicit sequencing (AFF-CACHE-4, bucket-1 rows, Q9 defer where applicable) -- not the thinking-bootstrap anti-deferral pattern above. Triage each `flush(laneId)` row; do not treat all lane flushes as the same migration.

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

- [`handleObjectsChangedForHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handlers/handleObjectsChangedForHypothesis.ts)
- [`handleAwaitRoadRunnerForPlanOutcome.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handlers/handleAwaitRoadRunnerForPlanOutcome.ts)
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
| PUBLISH-MSG | [`lambda/ephemera/publishMessage/index.ts`](../../../../../lambda/ephemera/publishMessage/index.ts) | Move: `messagesByConnectionId` + defer; else immediate wire (Generating/terminal: revision times) |
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
| **Orchestration** | Sort, `CreatedTime` offsets, `messageGroupId`, frame-size `batchMessages` | **Character move:** Q9 defer coalescer; **Generating/terminal:** immediate wire + explicit revision `createdTime`; other traffic: immediate |

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
| PUBLISH-MSG | Orchestration + contract (move subset) | Presentation identity + ordering | Move: per-connection sort via defer; Generating/terminal: revision `(CreatedTime, MessageId)` | **Yes** (immediate default); **No** for move defer only | P4: **`immediate`** default; **`deferred`** + coalescer **character move only**; Generating/terminal **immediate** + explicit `createdTime` (Q9 items 7-8) |

**Reading the table:** rows marked **Yes** or **Mostly yes** are places where downstream work already paid off (or flush was mostly traffic packaging). Rows marked **No** are where flush was **masking architecture debt** -- duplicate side effects, wrong response shape, or ordering -- not something fixed solely by teaching consumers to ignore duplicates.

**Practical rule for P4/P5 slices:**

- Wrong **final state** -> consumer merge / idempotency.
- Duplicate **side effects or UX** -> producer coalescing or serial execution.
- Wrong **order or API response shape** -> contract / orchestration (move: **Q9 defer**; Generating/terminal: **immediate** + `createdTime`; boundary assembly / explicit awaits).

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
| [`renderOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md) | ~~lane vs default-lane drain; look path perception lane then default Render Requested~~ **Migrated (P3):** `publish` + boundary drain; look/orientation direct register + `orchestrateRenderRequest` | PASS-THROUGH-INT |

**P0.5 verification:** all primary integration tests and `messageBus/index.test.ts` pass (baseline recorded at audit completion).

### Tier 3 -- triage matrix (fill during P0.5)

For each inventory row: evidence, risk, migration note. Q4/Q5 decisions apply to **High/Medium** rows only.

| ID | Location | Q4/Q5 | Risk | Evidence | Migration note |
| --- | --- | --- | --- | --- | --- |
| DS-OVERLAP-5 | All ephemera DataSources (shared bus filter) | Q4 | **High** | Tier 1A broadcast + envelope clusters | Concurrent DS callbacks OK (envelope no-ops); re-run passThrough integration tests after each slice |
| AFF-CACHE-4 | `affordanceCache` @ priority 4 | Q4 | **High** | AGENT.md; TopologyInvalidated cluster | P3 affordance slice: explicit catalog-before-orchestration (await or single publish); do not rely on flush priority |
| PASS-THROUGH-INT | passThrough + characterRegistered integration tests | Q4 | **High** | Tier 2 index | Tests are ordering spec; gate each High row migration |
| RENDER-CACHE | `renderCache/index.ts` streamEvent outbounds | Q4 | **Medium** | P3 renderOrch already `publish`; PASS-THROUGH-INT | **Migrated (P4):** P2b `outboundBusDelivery: 'publish'`; passThrough integration gate passes |
| AFFORDANCE-CACHE | `affordanceCache/index.ts` + `publishedEvents.ts` | Q4 | **Medium** | P3 affordanceOrch already `publish`; AFF-CACHE-4 landed; PASS-THROUGH-INT | **Migrated (P4):** P2b `outboundBusDelivery: 'publish'`; `publishedEvents.ts` `bus.publish`; passThrough integration gate passes |
| MOVE-CHAR | `moveCharacter/index.ts` | Q4 | **High** | Tier 1C; multi-tier sends | P4: migrate as atomic chain; `flushAndSettle` at boundaries during hybrid |
| PERCEPTION | `perception/index.ts` + perception DS | Q4 | **High** | Tier 1C; StreamingEvent fan-out | P4: migrate chain with actions/render paths; integration tests |
| ROOM-AFFORD | `roomUpdate` -> affordance pipeline | Q4 | **High** | Tier 1C; prio 4->5 edge | P3 (after renderOrch): migrate affordance subgraph atomically with `affordanceOrchestration` slice; preserve cache-before-orchestration explicitly |
| COMP-KICK | `ephemera/dataSource/index.ts` component kick | Q4 | **High** | Tier 1C StreamingEvent chain | P4: migrate with perception/renderOrch slice; passThrough tests |
| ACTIONS-PARSE | `actions/index.ts` receiveEvents | Q4 | **High** | Tier 1C | P4: migrate parse response graph as atomic unit |
| COYOTE-LANE | `handleObjectsChangedForHypothesis` + `hypothesisThinkingPersistence` | Q4/Q5 | **High** | Q2 atomic unit; scoped lane drain anti-deferral (see **Lane flush intent at migration**) | P3: `publish` + drop lanes/scoped flush; thinking concurrent with LLM; **boundary drain** only |
| PUBLISH-MSG | `publishMessage/index.ts` | Q5/Q9 | **High** | Dual-path: **immediate** default; **deferred** coalescer for **character move only** | P4: **`deliveryMode`** + dual-path handler; move-only defer; Generating/terminal immediate + `createdTime` |
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
  - [X] P2a -- infrastructure: `DataSourceMessageBusPort` adds `publish` (keep `send` during migration); constructor `outboundBusDelivery?: 'send' | 'publish'` (default `'send'`); branch in `sendStreamingEventOnBus`.
  - [X] P2a -- extend package mocks with `publish: jest.fn()`; add tests for `'publish'` outbound path (Q7).
  - [ ] P2b -- per DataSource: set `outboundBusDelivery: 'publish'` with that directory's lane/send atomic migration (coordinate with P3/P4/P5); update that DS's package/lambda tests to assert `publish`. **Done:** `mtw.ephemera.coyoteGame` (Coyote hypothesis P3 slice), `mtw.ephemera.renderOrchestration` (render orchestration P3 slice), `mtw.ephemera.affordanceOrchestration` (affordance orchestration P3 slice), `mtw.ephemera.actions` (ACTIONS-PARSE P4 slice), `mtw.ephemera.perception` (**COMP-KICK + PERCEPTION** P4 slice), `mtw.ephemera.renderCache` (**RENDER-CACHE** P4 slice), `mtw.ephemera.affordanceCache` (**AFFORDANCE-CACHE** P4 slice). **Pending (named P4 slices):** none remaining in ephemera pass-through chain; other DS flips land with their P4 slices as needed.
  - [ ] P2c -- closeout when no production DataSource uses `'send'` outbound: remove `outboundBusDelivery`, port `send`, `_inboundFlushLaneStack`, `StreamEventParams.laneId`, and `send` branch in `sendStreamingEventOnBus`.
  - [ ] Run: `npm test -- ts/dataSource/index.test.ts` from `packages/mtw-lambda-patterns/` after each P2 slice.

- [X] Phase P3 - ephemera lane hotspots (highest friction; **atomic units** per Q2)
  - [X] Coyote hypothesis thinking persistence and handlers (files in **Migration inventory**; atomic unit per Q2). **Lane flush intent:** `publish` replaces `send`+scoped `flush(lane)`; no producer-side mid-invocation drain; persistence may run **concurrent** with LLM; **boundary drain** only; see **Bus drain terminology** and **Lane flush intent at migration**. Migrated: `hypothesisThinkingPersistence.ts`, `handleObjectsChangedForHypothesis.ts`, `coyoteGame/index.ts` (`outboundBusDelivery: 'publish'`), `apiEphemera` thinking helpers (dual-path: `laneId` -> `send`, omit -> `publish`), ephemera `app.ts` `flushAndSettle` (4 sites).
  - [X] Acme order thinking persistence (atomic with its `flush(laneId)` blocks). **Coyote handoff:** same **Lane flush intent** recipe as hypothesis (`publish`, drop lanes/scoped `flush`, no producer-side `settle()`; persistence may run concurrent with enrich/Bedrock; **boundary drain** only -- `app.ts` `flushAndSettle` already landed). **Files:** [`acmeOrderThinkingPersistence.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/acmeOrderThinkingPersistence.ts), `sendActionsThinkingResult`, callers in [`enrich/acmeOrder/index.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/index.ts) / [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts). Omit `laneId` on `sendPutThinking*` (dual-path in [`apiEphemera.ts`](../../../../../lambda/ephemera/dataSource/apiEphemera.ts): omit -> `publish`). **Simpler than Coyote:** persistence-only atomic unit (no mixed-lane handler); single segment `acmeOrderEnrich`; publisher `mtw.ephemera.actions` (not coyoteGame); **no** `mtw.ephemera.actions` `outboundBusDelivery` flip for thinking (direct `messageBus`, not `streamEvent`). **Tests:** `acmeOrderThinkingPersistence.test.ts`, `parseCommand.test.ts` thinking assertions; mirror Coyote publish-mock / drop flush-lane pattern. **Docs:** `thinking/AGENT.md` **Acme order** subsection when done.
  - [X] Render orchestration: `orchestrationHandler` + `findRender` + look/orientation ingress (drop `laneId: ''`, generation lane, scoped flush; no partial publish-with-remaining-`send`). **Lane flush intent:** same Coyote recipe (`publish`, drop lanes/scoped `flush`, concurrent subscribers; **boundary drain** only). **Migrated:** `orchestrationHandler.ts`, `findRender.ts`, `generateRoomPreview.ts`, `publishedEvents.ts`, `subscribedEvents.ts` (`sendRenderRequested` -> `publish`), `index.ts` (`outboundBusDelivery: 'publish'`), look path direct `internalCache.PerceptionThreads.register` + `await orchestrateRenderRequest` (no bus self-subscribe), session orientation render channel same pattern. **External kicks** (`kickRoomHeaderBroadcast`, legacy `executeAction` look via `requestFullRoomDescriptionForCharacter`) still use `sendRenderRequested` / `sendPerceptionThreadRegistered` with `publish`. **Tests:** renderOrchestration unit + integration suites; `flushAndSettle` in pass-through integration harnesses.
  - [X] Affordance orchestration: [`affordanceOrchestration/`](../../../../../lambda/ephemera/dataSource/affordanceOrchestration/) (`orchestrationHandler`, `publishedEvents` send-helpers, fan-out paths); migrate in **P3 immediately after render orchestration** (not P4). Coordinate with `affordanceCache` for AFF-CACHE-4 catalog-before-orchestration; re-run `passThroughAffordanceOrchestrationToCache.integration.test.ts`. **Migrated:** `publishedEvents.ts`, `subscribedEvents.ts`, `orchestrationHandler.ts`, `fanOutAffordanceRefreshForRoom.ts`, `sendAffordanceRefreshRequestedForRoom.ts`, `index.ts` (`outboundBusDelivery: 'publish'`), session orientation direct `orchestrateAffordanceRequest`, AFF-CACHE-4 explicit `handleTopologyInvalidated` await before topology fan-out; integration tests use `flushAndSettle`.
  - [X] Coyote engine test harness lane flushes. **Migrated:** [`runCoyoteEngineTestHarness.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/runCoyoteEngineTestHarness.ts) WorldOOC **`publish`** + per-fixture **`flushAndSettle`** (drop named lanes / scoped **`flush(laneId)`**); tests assert **`publish`** / **`flushAndSettle`**.
  - [X] Ephemera `app.ts`: `flush()` -> `flushAndSettle()` at all boundary exits (Q1). (Landed with Coyote hypothesis slice.)
  - [X] Targeted ephemera tests for touched paths (see **Verification**). **Smoke-tested:** affordance P3 slice + **`runCoyoteEngineTestHarness.test.ts`** (14 tests); package baseline `ts/messageBus/index.test.ts`.

- [ ] Phase P4 - remaining ephemera `send` sites (piecewise **atomic units** per Q2; bucket-1 fix axes land **inside** the slice that owns the row -- not a separate pass after all DS work)
  - [X] Ingress / EventBridge paths in [`lambda/ephemera/app.ts`](../../../../../lambda/ephemera/app.ts). **Migrated:** deserialized EventBridge `StreamingEvent`, Initialize Subscription (`initSubscription.ts` -> `publish`), missing-deserializer `Error`, legacy `DisconnectCharacter`; WebSocket API routing unchanged. **Tests:** `app.test.ts` (14 tests), `characterRegisteredOrientation.integration.test.ts`, passThrough orchestration/affordance integration tests; package `ts/messageBus/index.test.ts` baseline.
  - [X] Confirm ephemera `app.ts` already uses `flushAndSettle()` from P3 (no further boundary change until P6).
  - [X] **PUBLISH-MSG** (bucket-1 move subset; Q9): [`publishMessage/index.ts`](../../../../../lambda/ephemera/publishMessage/index.ts) + [`messageBus/baseClasses.ts`](../../../../../lambda/ephemera/messageBus/baseClasses.ts) -- `deliveryMode?: 'immediate' | 'deferred'` (default **`immediate`**); optional `createdTime` on `PublishPerceptionMessage`; dual-path handler (**immediate** wire; **deferred** -> move-only `PublishMessageCoalescer` + `afterSettled`). **`deferred` producers:** MOVE-CHAR + character-move perception legs only. **Tests:** both modes; move order on deferred flush; Generating visible before terminal with immediate + explicit times.
  - [X] **CHECK-LOC** (bucket-1 **No**; Q5): [`checkLocation/index.ts`](../../../../../lambda/ephemera/checkLocation/index.ts) -- per-invocation `Set<characterId>` producer coalesce before repair; migrate handler to `publish`. **Triage:** CHECK-LOC-CHAIN. **Tests:** checkLocation tests. **Migrated:** [`checkLocation/coalescer.ts`](../../../../../lambda/ephemera/checkLocation/coalescer.ts) (`tryClaim` + `registerDeferral` `onClear`); per-payload expansion; outbound `publish` for MoveCharacter/Perception; ingress producers still `send` until **SELF-HEALING** slice (positions ingress migrated in POSITIONS).
  - [X] **WebSocket / api.ephemera ingress** in [`app.ts`](../../../../../lambda/ephemera/app.ts): legacy handler `send`s (`ExecuteAction`, `Perception`, `UnregisterCharacter`, map subscribe, `ReturnValue`, etc.) and synthetic ingress (`sendParseRequested`, `sendStateChange`, `handleFetchThinkingResult`); extend [`apiEphemera.ts`](../../../../../lambda/ephemera/dataSource/apiEphemera.ts) dual-path (`omit laneId` -> `publish`) for remaining send-helpers. **Migrated:** WebSocket ingress `publish`; [`returnValue/collector.ts`](../../../../../lambda/ephemera/returnValue/collector.ts) subscribe (priority **16**) + `onClear` deferral; `extractReturnValue` reads collector only (no `_stream` peek); five `api.ephemera` helpers dual-path. Handler-generated `ReturnValue` from **MAP-SUB** still `send` until that slice (parse + executeAction now `publish`). **Tests:** `app.test.ts` (19 tests), `apiEphemera.test.ts`, `returnValue/collector.test.ts`, `fetchThinkingResult/index.test.ts`.
  - [X] **ACTIONS-PARSE** (Q4 **High**; atomic unit): [`actions/index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) + [`parse/executeAction.ts`](../../../../../lambda/ephemera/parse/executeAction.ts) + parse response / ReturnValue paths; coordinate **P2b** if `mtw.ephemera.actions` flips `outboundBusDelivery: 'publish'`. **Migrated:** all imperative `PublishMessage` / `MoveCharacter` / `ReturnValue` in actions DS + `executeAction` + `runAcmeOrderAffinitiesHarness` -> `publish`; `outboundBusDelivery: 'publish'` on `mtw.ephemera.actions`; no producer-side drain. **Tests:** `index.test.ts`, `parseCommand.test.ts`, `executeAction.test.ts`, `runAcmeOrderAffinitiesHarness.test.ts`.
  - [X] **POSITIONS** (Q4 Medium; atomic unit): [`positions/handleConnectionsCharactersPresence.ts`](../../../../../lambda/ephemera/dataSource/positions/handleConnectionsCharactersPresence.ts) + disconnect / CheckLocation side effects (depends on **CHECK-LOC** coalesce or concurrent-safe boundary drain). **Migrated:** `CheckLocation` / `PublishMessage` / `RoomUpdate` -> `publish` in connect/disconnect handlers; no `outboundBusDelivery` flip (no `streamEvent` outbounds); CHECK-LOC ingress from positions complete. **Tests:** `handleConnectionsCharactersPresence.test.ts`, `checkLocation/index.test.ts`, passThrough integration gates.
  - [X] **RENDER-CACHE** (P2b; Q4 Medium): [`renderCache/index.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts) `outboundBusDelivery: 'publish'` (completes pass-through producer chain after P3 render orchestration); update unit tests to assert `publish` on `streamEvent` outbounds (`Render Pertains`, `Cache Updated`, ...). Hybrid `publish` + `send` + boundary `flushAndSettle` remains valid until **COMP-KICK + PERCEPTION**; this slice is not a hard blocker. **Tests:** `renderCache/index.test.ts`, `renderCache/passThroughContract.scaffold.test.ts`, [`passThroughOrchestrationToCache.integration.test.ts`](../../../../../lambda/ephemera/dataSource/passThroughOrchestrationToCache.integration.test.ts). **Migrated:** `outboundBusDelivery: 'publish'` on `mtw.ephemera.renderCache`; publish assertions on Cache Updated and Render Pertains full-bus paths; passThrough integration gate passes.
  - [X] **AFFORDANCE-CACHE** (P2b; Q4 Medium): [`affordanceCache/index.ts`](../../../../../lambda/ephemera/dataSource/affordanceCache/index.ts) `outboundBusDelivery: 'publish'` + [`affordanceCache/publishedEvents.ts`](../../../../../lambda/ephemera/dataSource/affordanceCache/publishedEvents.ts) (drop direct `bus.send` helpers); mirrors P3 affordance orchestration outbound migration. **Migrated:** `outboundBusDelivery: 'publish'`; `publishedEvents.ts` `PublishBus` + `bus.publish` + `streamEventFromMessageBus`; `index.test.ts`, `publishedEvents.test.ts`, `passThroughContract.scaffold.test.ts`; passThrough integration gate passes. **Tests:** `affordanceCache/*`, [`passThroughAffordanceOrchestrationToCache.integration.test.ts`](../../../../../lambda/ephemera/dataSource/passThroughAffordanceOrchestrationToCache.integration.test.ts).
  - [X] **COMP-KICK + PERCEPTION** (Q4 **High**; atomic unit): [`dataSource/index.ts`](../../../../../lambda/ephemera/dataSource/index.ts) (asset kick StreamingEvents) + [`perception/`](../../../../../lambda/ephemera/dataSource/perception/) DS bodies + legacy [`perception/index.ts`](../../../../../lambda/ephemera/perception/index.ts); **`deliveryMode: 'deferred'`** on character-move `PublishMessage`s only; **immediate** elsewhere; Generating/terminal **immediate** with explicit `createdTime` (`T0` / `max(T0+1, now)` on thread). **P2b:** `mtw.ephemera.perception`. **Migrated:** all perception DS + legacy handler `send` -> `publish`; `outboundBusDelivery: 'publish'`; `PerceptionThreads.createdTime` on render-correlated threads; COMP-KICK kick path already `publish` for StreamingEvents. **Tests:** `dataSource/perception/index.test.ts`, `perception/index.test.ts`, `characterRegisteredOrientation.integration.test.ts`, passThrough integration tests.
  - [ ] **MOVE-CHAR** (Q4 **High**; atomic unit): [`moveCharacter/index.ts`](../../../../../lambda/ephemera/moveCharacter/index.ts) multi-tier send graph; **`deliveryMode: 'deferred'`** on move-related `PublishMessage`s. **Tests:** moveCharacter tests.
  - [ ] **ROOM-AFFORD + disconnect chains** (Q4 Medium/**High**): [`roomUpdate/index.ts`](../../../../../lambda/ephemera/roomUpdate/index.ts) + [`disconnectMessage/index.ts`](../../../../../lambda/ephemera/disconnectMessage/index.ts) (DISCONNECT-UNREG, DISCONNECT-CHAR); affordance fan-out already P3 -- migrate remaining `send` on RoomUpdate -> affordance kick paths. **Tests:** roomUpdate / disconnectMessage tests.
  - [ ] **Easy / Low rows** (bucket-1 migrate freely): [`fetchEphemera/index.ts`](../../../../../lambda/ephemera/fetchEphemera/index.ts) (FETCH-EPH), [`ephemeraUpdate/index.ts`](../../../../../lambda/ephemera/ephemeraUpdate/index.ts) (EPH-UPDATE), [`state/handleApiStateChange.ts`](../../../../../lambda/ephemera/dataSource/state/handleApiStateChange.ts) where triage allows; **P2b** per DS as needed.
  - [ ] **SELF-HEALING** (after **CHECK-LOC**): [`selfHealing/roomOccupancyDriftFinding.ts`](../../../../../lambda/ephemera/dataSource/selfHealing/roomOccupancyDriftFinding.ts) (`RoomUpdate`, `CheckLocation` sends). **Tests:** selfHealing tests if present.
  - [ ] **MAP-SUB** (bucket-1 **No**; Q5 Medium): [`mapSubscription/index.ts`](../../../../../lambda/ephemera/mapSubscription/index.ts) -- contract / `extractReturnValue` merge policy if multi-send per invocation; migrate or keep one bus message per API op. **Tests:** mapSubscription tests.
  - [ ] **COYOTE-PLAN** (Q4 Medium): [`handleAwaitRoadRunnerForPlanOutcome.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handlers/handleAwaitRoadRunnerForPlanOutcome.ts) remaining `PublishMessage` `send`s (coyoteGame outbound already `publish`). **Tests:** `handleAwaitRoadRunnerForPlanOutcome.test.ts`.
  - [ ] **P4 ephemera closeout grep:** `rg 'messageBus\.send\(' lambda/ephemera/ --glob '*.ts' | rg -v '\.test\.ts'` zero production hits (tests/harnesses may remain until P6); complete remaining **P2b** `outboundBusDelivery: 'publish'` flips for ephemera DataSources touched above.

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
npm run test -- --watchAll=false dataSource/passThroughAffordanceOrchestrationToCache.integration.test.ts
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
| DataSource port migration (P2) | P2a done; P2b started (`coyoteGame`, `renderOrchestration`, `affordanceOrchestration`, `actions`, `perception`, `renderCache`, `affordanceCache`); ephemera pass-through chain complete |
| Ephemera lane hotspots (P3) | Done (Coyote hypothesis, Acme order, render/affordance orchestration, Coyote harness) |
| Remaining ephemera migration (P4) | In progress (**PUBLISH-MSG** + **CHECK-LOC** + **WebSocket / api.ephemera ingress** + **ACTIONS-PARSE** + **POSITIONS** + **COMP-KICK + PERCEPTION** + **RENDER-CACHE** + **AFFORDANCE-CACHE** done; next: **MOVE-CHAR** -- see **Recommended order** sub-slices) |
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
| Outbound coalesce (orchestration) | Implicit in batched handler callback | **Character move:** `deferred` + coalescer + `runDeferrals()`; **all else:** `immediate` wire in handler (Q9) |
| Generating/terminal UX | Bundled at boundary flush (placeholder often invisible) | **Immediate** wire + explicit `createdTime` revision pair (Q9 item 8) |

**Coexistence:** `publish`/`settle` and `send`/`flush` do not share queue or Promise-tracking machinery during migration. Cross-seam side effects are drained via **boundary drain** (`flushAndSettle()`, Q1). **`PublishMessage` `deferred`** is **character-move only**; coalescer + **`runDeferrals()`** when move rows were queued. Render cascades stay **one invocation** (see **Single-invocation render cascades**). Lane inheritance applies only to `flush`; named-lane subgraphs migrate as **atomic units** without publish -> `send` cascades (Q2). See **Bus drain terminology**.
