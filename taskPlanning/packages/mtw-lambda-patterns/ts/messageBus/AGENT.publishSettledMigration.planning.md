# MessageBus: `publish`/`settle` migration (planning)

**Status:** In progress (P0). Q1-Q3, Q6-Q8 are locked. Next step: **Phase P0.5** Q4/Q5 positive audit, then lock Q4-Q5, then Phase P1 engine work.

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

Resolve these in Phase P0 (update this section with decisions as they land). Do not assume defaults in implementation until recorded here. **Q1-Q3, Q6-Q8 are locked**; Q4-Q5 remain open until **Phase P0.5** audit completes.

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

### Q4. Priority and subscriber ordering under `publish`

Under `send`/`flush`, priority ordering is enforced. Under `publish`, the handoff states ordering is the handler's responsibility.

- **Question:** Does `publish` ignore `priority` entirely and invoke all matching subscribers in subscription registration order?
- **Question:** If two subscribers match the same payload, is concurrent invocation always correct, or do any existing handlers rely on serial delivery?
- **Question:** Do we keep `priority` on subscriptions during migration (meaningful only for `flush`) or deprecate it in docs immediately?

**Approach:** Do not prove-the-negative across all call sites. Build a **positive inventory** in **Phase P0.5** (see **Q4/Q5 positive audit**); lock Q4 defaults for High/Medium rows only. Low rows migrate with `publish` and rely on existing tests.

### Q5. Payload batching and stream persistence

`flush` batches matching stream items per subscriber (`payloads` may be length > 1) and uses `processedBy` so multiple subscribers can process the same queued message across waves. `publish` delivers a **single-item** `payloads` array per matching subscriber immediately.

- **Question:** Which subscribe callbacks perform meaningful **cross-payload aggregation** in one invocation and need redesign before migration?
- **Question:** Is there any production path that depends on a message remaining in `_stream` for a later subscriber wave under `flush`?
- **Question:** Under `publish`, is "each matching subscriber gets an independent async invocation per publish" the guaranteed contract?

**Approach:** Same **Phase P0.5** audit. Classify callbacks into true aggregation vs per-item `map`; only bucket 1 (and unusual multi-event batches) need redesign before `publish`.

### Q6. `clear()` interaction with `_inFlight` -- **RESOLVED**

`clear()` today empties `_stream` only. After `publish`/`settle`, it must account for `_inFlight` as well.

**Decision: `clear()` resets both `_stream` and `_inFlight`.**

- `clear()` empties the send queue **and** clears the in-flight Promise set (bus no longer tracks those handlers).
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
| **Q5** batch / persistence | Handlers that **combine** multiple `payloads` in one callback; multi-wave `send` chains across priorities; integration tests that assert drain order | Handlers that only `Promise.all(payloads.map(...))` (batch is throughput, not semantics) |

### Tier 1 -- structural inventory (automated)

**A. Subscription overlap (Q4)**

List every `messageBus.subscribe` / `DataSource.subscribe()` with `tag`, `priority`, and filter scope. Flag subscribers whose filter can match the **same** payload as another.

```bash
# Subscribe registrations
rg 'messageBus\.subscribe\(|\.subscribe\(\)' lambda/ packages/mtw-lambda-patterns/ts/dataSource/ --glob '*.ts' -l

# Documented priority intent
rg 'subscriptionPriority|priority:\s*\d+' lambda/ --glob '*.{ts,md}' | rg -v '\.test\.' || true
```

**Ephemera DataSource subscribers (seed list -- all use broad `StreamingEvent` structure guard unless noted):**

| DataSource | Subscribe file | Priority (if non-default) |
| --- | --- | --- |
| `mtw.ephemera` | [`dataSource/index.ts`](../../../../../lambda/ephemera/dataSource/index.ts) | 5 (default) |
| `mtw.ephemera.perception` | [`perception/index.ts`](../../../../../lambda/ephemera/dataSource/perception/index.ts) | 5 |
| `mtw.ephemera.renderOrchestration` | [`renderOrchestration/index.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/index.ts) | 5 |
| `mtw.ephemera.renderCache` | [`renderCache/index.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts) | 5 |
| `mtw.ephemera.affordanceOrchestration` | [`affordanceOrchestration/index.ts`](../../../../../lambda/ephemera/dataSource/affordanceOrchestration/index.ts) | 5 |
| `mtw.ephemera.affordanceCache` | [`affordanceCache/index.ts`](../../../../../lambda/ephemera/dataSource/affordanceCache/index.ts) | **4** (documented: before orchestration fan-out) |
| `mtw.ephemera.coyoteGame` | [`coyoteGame/index.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/index.ts) | **20** |
| `mtw.ephemera.actions` | [`actions/index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) | 5 |
| `mtw.ephemera.positions` | [`positions/index.ts`](../../../../../lambda/ephemera/dataSource/positions/index.ts) | 5 |
| `mtw.ephemera.thinking.scheduling` | [`thinking/scheduling/index.ts`](../../../../../lambda/ephemera/dataSource/thinking/scheduling/index.ts) | 5 |
| `mtw.ephemera.thinking.results` | [`thinking/results/index.ts`](../../../../../lambda/ephemera/dataSource/thinking/results/index.ts) | 5 |
| `mtw.ephemera.objects` | [`objects/index.ts`](../../../../../lambda/ephemera/dataSource/objects/index.ts) | 5 |
| `mtw.ephemera.state` | [`state/index.ts`](../../../../../lambda/ephemera/dataSource/state/index.ts) | 5 |

Also inventory other lambdas: [`assets/dataSource`](../../../../../lambda/assets/dataSource/index.ts), [`wml/dataSource`](../../../../../lambda/wml/dataSource/index.ts), [`connections/dataSource`](../../../../../lambda/connections/dataSource/index.ts), [`diagnostics/dataSource`](../../../../../lambda/diagnostics/dataSource/index.ts), [`cognitoEvent/dataSource`](../../../../../lambda/cognitoEvent/dataSource/index.ts).

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

**Seed bucket 1 (review first):**

- [`lambda/assets/player/update.ts`](../../../../../lambda/assets/player/update.ts) -- `payloads.reduce` merges settings per player
- [`lambda/ephemera/checkLocation/index.ts`](../../../../../lambda/ephemera/checkLocation/index.ts) -- cross-payload dedup / expansion across asset, room, player shapes

**C. Cross-priority `send` chains (Q4 + Q5)**

Handlers that `messageBus.send` **other message types** during a callback create multi-wave `flush` graphs. Inventory as chain graphs, not every `send` site.

```bash
rg 'messageBus\.send\(' lambda/ephemera --glob '*.ts' | rg -v '\.test\.' || true
```

**Seed chain graphs (review first):**

- [`disconnectMessage/index.ts`](../../../../../lambda/ephemera/disconnectMessage/index.ts) -- `UnregisterCharacter` (priority 1) -> `PublishMessage` (15) + `RoomUpdate` (6)
- [`parse/executeAction.ts`](../../../../../lambda/ephemera/parse/executeAction.ts)
- [`moveCharacter/index.ts`](../../../../../lambda/ephemera/moveCharacter/index.ts)
- [`perception/index.ts`](../../../../../lambda/ephemera/perception/index.ts)

### Tier 2 -- tests and docs as ground truth

List tests that register multiple DataSources and assert behavior across `messageBus.flush()` / lane drains. These are **known ordering specs** -- re-run after migration; do not re-derive from theory.

```bash
rg 'messageBus\.flush' lambda/ packages/mtw-lambda-patterns/ --glob '*.test.ts' -l
rg 'passThrough|integration\.test' lambda/ephemera/dataSource --glob '*.ts' -l
```

**Seed integration / contract tests:**

- [`passThroughOrchestrationToCache.integration.test.ts`](../../../../../lambda/ephemera/dataSource/passThroughOrchestrationToCache.integration.test.ts)
- [`passThroughAffordanceOrchestrationToCache.integration.test.ts`](../../../../../lambda/ephemera/dataSource/passThroughAffordanceOrchestrationToCache.integration.test.ts)
- [`characterRegisteredOrientation.integration.test.ts`](../../../../../lambda/ephemera/dataSource/characterRegisteredOrientation.integration.test.ts)
- [`packages/mtw-lambda-patterns/ts/messageBus/index.test.ts`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/index.test.ts) (engine priority / wave spec)

**Seed documented priority intent:**

- [`affordanceCache/AGENT.md`](../../../../../lambda/ephemera/dataSource/affordanceCache/AGENT.md) -- priority 4 before orchestration at 5
- [`renderOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md) -- terminal vs generation-lane / default-lane drain

### Tier 3 -- triage matrix (fill during P0.5)

For each inventory row: evidence, risk, migration note. Q4/Q5 decisions apply to **High/Medium** rows only.

| ID | Location | Q4/Q5 | Risk | Evidence | Migration note |
| --- | --- | --- | --- | --- | --- |
| DS-OVERLAP-5 | All ephemera DataSources @ priority 5 | Q4 | **High** | Shared `streamingEventStructureGuard` | `publish` = concurrent; priority tiers among DataSources **lost** on new path |
| AFF-CACHE-4 | `affordanceCache` @ priority 4 | Q4 | **High** | AGENT.md | Migrate with affordanceOrchestration slice |
| COYOTE-20 | `coyoteGame` @ priority 20 | Q4 | **Medium** | Explicit `subscriptionPriority: 20` | Confirm no ordering dependency on running after default tier |
| PLAYER-REDUCE | `assets/player/update.ts` | Q5 | **Medium** | `payloads.reduce` | Batch semantics or accept N publishes |
| CHECK-LOC | `ephemera/checkLocation` | Q5 | **Medium** | Cross-payload dedup | Same |
| LEGACY-TYPE | `lambda/*/messageBus/index.ts` handlers | Q4/Q5 | **Low** | 1:1 type filters | Per-item `map`; migrate with tests |
| DISCONNECT-CHAIN | `disconnectMessage` | Q4 | **Medium** | prio 1 -> 15, 6 `send`s | Migrate whole chain or accept new ordering |
| PASS-THROUGH-INT | passThrough integration tests | Q4 | **High** | Multi-DataSource + `flush` | Re-run after each slice; tests are spec |

*(Extend table during P0.5; delete resolved rows or move notes into Q4/Q5 when locked.)*

### Optional: observed overlap trace (ambiguous cases)

One diagnostic test: register real ephemera DataSource subscriptions, `publish` (or `send` + `flush`) one representative `StreamingEvent` per family, log `{ tag, priority, header.type }` per callback. Produces an **observed** overlap matrix from the live subscription graph.

### P0.5 outputs (inputs to locking Q4/Q5)

1. Completed subscription overlap table (Tier 1A).
2. Bucket-1 batch callback list (Tier 1B).
3. Send-chain graph list (Tier 1C).
4. Integration test index (Tier 2).
5. Triage matrix with every **High/Medium** row having a migration note (Tier 3).

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [ ] Phase P0 - resolve open design questions
  - [X] Record Q1 decision in **Open design questions** (hybrid boundary: `flushAndSettle`, `Promise<boolean>` returns).
  - [X] Record Q2 decision in **Open design questions** (`activeFlushLane: undefined` on `publish`, atomic migration units, DataSource lane retirement in P2).
  - [X] Record Q3 decision in **Open design questions** (`allSettled`, log-and-continue, no bus error hook).
  - [X] Record Q6 decision in **Open design questions** (`clear` resets `_inFlight`; `settle` before `clear` in tests).
  - [X] Record Q7 decision in **Open design questions** (port: `subscribe` + `publish`; `outboundBusDelivery`; package mock pattern).
  - [X] Record Q8 decision in **Open design questions** (ephemera-first ordering, Q2 atomic units, production-only `send` for fully migrated).
  - [ ] Record decisions for Q4-Q5 (after P0.5) in **Open design questions** (replace questions with locked answers as decided).

- [ ] Phase P0.5 - Q4/Q5 positive audit (see **Q4/Q5 positive audit**)
  - [ ] Tier 1A: subscription overlap table (legacy handlers + all DataSource `subscribe()`).
  - [ ] Tier 1B: batch-semantics classifier; list bucket-1 (true aggregation) callbacks.
  - [ ] Tier 1C: cross-priority `send` chain graphs from legacy handlers and DataSource bodies.
  - [ ] Tier 2: index integration / passThrough tests and documented priority AGENT.md edges.
  - [ ] Tier 3: complete triage matrix; every High/Medium row has a migration note.
  - [ ] Lock Q4 and Q5 from audit findings (defaults for Low rows; explicit rules for High/Medium).

- [ ] Phase P1 - `InternalMessageBus` engine
  - [ ] Add `publish()`, `settle()`, `_inFlight`, `flushAndSettle()` (independent from `_stream` / `flushLane`).
  - [ ] Refactor `flush()` / `flush(laneId)` to return `Promise<boolean>` per Q1.
  - [ ] Implement `settle()` with inner quiescence loop, `Promise.allSettled` per snapshot, rejection logging, and `Promise<boolean>` per Q1/Q3.
  - [ ] `publish` passes `activeFlushLane: undefined` per Q2; wrap handler promises with `tag` for Q3 log context.
  - [ ] Implement `publish` subscriber ordering per locked Q4 (from P0.5).
  - [ ] Extend `clear()` to reset `_stream` and `_inFlight` per Q6.
  - [ ] Add tests: `flushAndSettle` cross-seam ping-pong, boolean no-op returns, single subscriber, concurrent subscribers, recursive publish during settle, **settle drains all handlers when one rejects** (Q3), **`clear()` drops `_inFlight` tracking** (Q6), coexistence with existing `send`/`flush` tests.
  - [ ] Baseline: `npm test -- ts/messageBus/index.test.ts` passes.

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
  - [ ] Migrate bucket-1 batch callbacks per P0.5 triage before their ingress moves to `publish`.
  - [ ] Confirm ephemera `app.ts` already uses `flushAndSettle()` from P3 (no further boundary change until P6).

- [ ] Phase P5 - other lambdas
  - [ ] assets (`app.ts` + DataSources)
  - [ ] wml (`app.ts`, `promoteToCanon.ts`)
  - [ ] connections, cognitoEvent, diagnostics
  - [ ] Each lambda `app.ts`: `flush()` -> `flushAndSettle()` (Q1).

- [ ] Phase P6 - remove legacy machinery and close out
  - [ ] Confirm `rg 'messageBus\.send\(' lambda/` zero production hits and tests/harnesses migrated (Q8).
  - [ ] Delete `send`, `flush`, `flushLane`, lane queue cells, lane-related types, and `flushAndSettle` (or alias it to `settle()`) from `InternalMessageBus` in one commit.
  - [ ] Lambda boundaries: `flushAndSettle()` -> `settle()` (Q1 P6).
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
| P0.5 Q4/Q5 positive audit + triage | Not started |
| Open questions Q4-Q5 resolved (P0.5) | Not started |
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
| `clear()` | `_stream` only (today) | `_stream` + `_inFlight` reset (Q6); tests: `settle` first |

**Coexistence:** `publish`/`settle` and `send`/`flush` do not share queue or Promise-tracking machinery during migration. Cross-seam side effects are drained at lambda boundaries via `flushAndSettle()` (Q1). Lane inheritance applies only to `flush`; named-lane subgraphs migrate as **atomic units** without publish -> `send` cascades (Q2).
