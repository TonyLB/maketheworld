# mtw.ephemera.renderCache (DataSource)

This directory implements the **`mtw.ephemera.renderCache`** DataSource: `api.ephemera` commands (**`Put Cache Record`**, **`Delete Cache Records`**) and **subscription** to **`mtw.ephemera.renderOrchestration`** for the pass-through pipeline.

**Domain** cache schema and shared types live in [`../../renderCache/AGENT.md`](../../renderCache/AGENT.md) (Dynamo shape, `internalCache.RenderCache`, `putCacheRecord` / `deleteCacheRecord` primitives).

**Canonical pass-through semantics** (durable readiness, routing identity, six orchestration outbounds): [AGENT.passThrough.contract.planning.md](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md).

## Getting Started

1. **Contract** --- Skim the [pass-through contract](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md) for **`Render Pertains`** / **`Cache Updated`**, hit vs generate paths, and **routing identity** (why orchestration sends IDs only on hits). This file covers **how** the DataSource implements those rules.
2. **Producer side** --- Read [`../renderOrchestration/AGENT.md`](../renderOrchestration/AGENT.md) so you know what arrives on **`mtw.ephemera.renderOrchestration`** and what orchestration does **not** do (no **`Put Cache Record`** on generation success).
3. **Domain cache** --- For Dynamo shape and `internalCache.RenderCache`, see [`../../renderCache/AGENT.md`](../../renderCache/AGENT.md). **Boundary invariants** for writes vs lookups live below (also skim **Regression / equivalence checks**).
4. **Code path** --- Entry: [`index.ts`](index.ts). Orchestration subscription: [`subscribedEvents.ts`](subscribedEvents.ts) -> [`handleRenderOrchestrationInbound.ts`](handleRenderOrchestrationInbound.ts). Command path: **`Put Cache Record`** / **`Delete Cache Records`** handlers in the same folder.
5. **Tests** --- Run from [`lambda/ephemera/`](../../): `npm test`. Contract-focused: [`passThroughContract.scaffold.test.ts`](passThroughContract.scaffold.test.ts); cross-layer: [`../passThroughOrchestrationToCache.integration.test.ts`](../passThroughOrchestrationToCache.integration.test.ts).
6. **DataSource pattern** --- [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (**publishedEvents.ts** / **subscribedEvents.ts**).

## Responsibilities

- **Commands:** Validate `api.ephemera` envelopes, persist cache rows or delete them, update **`internalCache.RenderCache`**, publish **`Cache Updated`**, **`Cache Deleted`**, or **`Cache Error`** as appropriate (`index.ts`, `putCacheRecord.ts`, `deleteCacheRecord.ts`).
- **Pass-through:** On orchestration stream events, apply contract rules in [`handleRenderOrchestrationInbound.ts`](handleRenderOrchestrationInbound.ts):
  - **`Current Cache Valid`** / **`Exact Match Found`**: orchestration sends **IDs only** + routing; this DataSource **refetches** via **`internalCache.RenderCache.get`**, then emits **`Render Pertains`** only (no Dynamo write).
  - **`Render Generated`**: orchestration signals generation-complete with **full** content and **no** durability promise; this DataSource performs the **single** `putCacheRecord`, then emits **`Render Pertains`** then **`Cache Updated`** (same pairing as the direct **`Put Cache Record`** command path).
- **Imports:** Inbound orchestration payloads use types from [`../renderOrchestration/publishedEvents.ts`](../renderOrchestration/publishedEvents.ts) (ephemera-local; not **`mtw-interfaces`**). Outbound **`Render Pertains`** / **`Cache Updated`** shapes are defined with this DataSource (`baseClasses.ts`); optional future split: local `publishedEvents.ts` for cache-only outbounds per DataSource pattern.

## Boundary invariants

Cross-cutting rules for cache I/O (social + technical):

- **Orchestration and policy** must not call Dynamo or cache persistence helpers directly. Route writes through **`mtw.ephemera.renderCache`** (this DataSource): **`Put Cache Record`** / **`Delete Cache Records`**, or the pass-through path from [`handleRenderOrchestrationInbound.ts`](handleRenderOrchestrationInbound.ts) as defined in the [pass-through contract](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md).
- **`internalCache.RenderCache`** is the only surface that should expose **exact-match** lookup to callers (`getExactMatch`). Do not call `get` and reimplement matcher / markState logic at orchestration or policy call sites.
- **`mtw.ephemera.renderCache`** is the only place that should expose **cache persistence writes** to the rest of the system.

Persistence primitives (`putCacheRecord`, `deleteCacheRecord`, `queryCacheRecordsForComponent`) live under this directory; domain types and schema details remain in [`../../renderCache/AGENT.md`](../../renderCache/AGENT.md).

## Regression / equivalence checks

When changing matching or persistence behavior, validate:

- **Exact-match:** matcher and perspective filtering behavior unchanged; markState normalization and equality unchanged.
- **Bus ordering:** this DataSource still publishes **`Cache Updated`** or **`Cache Error`** as appropriate; **`internalCache.RenderCache.set`** runs after successful persistence and before any subsequent read in the same invocation that depends on the new row.

## Ingress and wiring

- **`receiveEvents`:** Same path for **`api.ephemera`** and subscribed bus envelopes; orchestration events are recognized by [`subscribedEvents.ts`](subscribedEvents.ts) (`isRenderCacheSubscribedEnvelope`) and dispatched in [`index.ts`](index.ts).
- **No indirect invoke:** Orchestration does not call this DataSource as a function; subscription only (contract uncertainty 2).

## Correlation vs routing

**`Render Pertains`** carries lean routing (**`componentId`**, **`perspectiveKey`**, **`cacheId`**, **`cacheRecord`**) for indexing; it does **not** rely on a synthetic **`conversationId`** on the wire for Perception (see **Routing identity on producer streams** in the contract doc).

## Refetch edge cases

If **`Current Cache Valid`** / **`Exact Match Found`** include a **`cacheId`** but refetch misses (stale ID, rare races), the handler logs and emits nothing until product rules tighten (overlaps contract uncertainties 6 and 11).

## Tests

- Package: [`index.test.ts`](index.test.ts), [`putCacheRecord.test.ts`](putCacheRecord.test.ts), [`deleteCacheRecord.test.ts`](deleteCacheRecord.test.ts), [`queryCacheRecordsForComponent.test.ts`](queryCacheRecordsForComponent.test.ts).
- Contract: [`passThroughContract.scaffold.test.ts`](passThroughContract.scaffold.test.ts), shared [`../passThroughContractFixtures.ts`](../passThroughContractFixtures.ts).
- Cross-layer: [`../passThroughOrchestrationToCache.integration.test.ts`](../passThroughOrchestrationToCache.integration.test.ts).

From [`lambda/ephemera/`](../../): `npm test` (Jest).

## Related docs

- [`../renderOrchestration/AGENT.md`](../renderOrchestration/AGENT.md) --- orchestration stream, single-flight, emission map.
- [Pass-through contract (draft)](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md).
- [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md).
