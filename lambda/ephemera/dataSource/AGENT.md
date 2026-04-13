# Ephemera DataSource layer - Agent Navigation Guide

**Status:** ACTIVE. This directory implements the [`EphemeraDataSource`](abstract.ts) pattern ([`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)) for **internal bus** integration, asset-event consumption, and ephemera-domain streaming. It is the **index** for DataSource packages under `lambda/ephemera/dataSource/` and for **cross-cutting contracts** that span those packages.

**Parent lambda:** [`../AGENT.md`](../AGENT.md) (WebSocket, perception product, transition context). For event topology beyond DataSources, see [`../AGENT.event.md`](../AGENT.event.md).

---

## Cross-cutting contracts (start here for multi-domain work)

| Doc | Role |
| --- | --- |
| [**AGENT.multiChannel.contract.md**](AGENT.multiChannel.contract.md) | Multi-cadence / multi-channel player updates, **`Meta::Room`** as shared storage, **room-render** vs **room-affordances** direction, decision norms |
| [**AGENT.multiChannel.plan.md** (task plan)](../../../taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md) | Executable plan: Phase B/C server + client alignment, verification (Phase A contract + types done) |

**Wire note:** **`PublishPerceptionMessage`** ([`messageBus/baseClasses.ts`](../messageBus/baseClasses.ts)) uses **`PerceptionMessageMetaData`**; room rows distinguish channels with **`metaData.roomChannel`** per the multi-channel contract (lambda emitters populate it in **Phase B**).

Task-planning drafts (dispose after tasks land) live under [`taskPlanning/lambda/ephemera/`](../../../taskPlanning/lambda/ephemera/); the pass-through narrative is in [`AGENT.passThrough.contract.planning.md`](../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md).

---

## Shared primitives (this folder root)

| File | Role |
| --- | --- |
| [`abstract.ts`](abstract.ts) | `EphemeraDataSource` --- `ephemeraDB`, SNS, `messageBus`, `EphemeraId` primary key |
| [`apiEphemera.ts`](apiEphemera.ts) | **`api.ephemera`** streaming helpers (`sendStateChange`, `sendObjectsChange`, cache primitives, etc.) and envelope guards |
| [`localApiEvents.ts`](localApiEvents.ts) | Payload types for **`api.ephemera`** commands shared across packages |
| [`subscribedEvents.ts`](subscribedEvents.ts) | Guards for **`mtw.assets`** envelopes consumed by the main ephemera DataSource ([`index.ts`](index.ts)) |
| [`index.ts`](index.ts) | **`mtw.ephemera`** DataSource --- assets subscription, `processComponentUpdated`, etc. |

**Ingress convention:** Many flows use **`dataSourceKey: 'api.ephemera'`** on the internal bus for lambda-invoked commands (not necessarily API Gateway). Package-local `localApiEvents.ts` files document additional **`api.ephemera`** header types.

---

## DataSource instances (by `dataSourceKey`)

Side-effect **`import './dataSource/...'`** from [`../app.ts`](../app.ts) registers subscriptions. Each row links to package **`AGENT.md`** where present.

| Key | Directory | Notes |
| --- | --- | --- |
| **`mtw.ephemera`** | [`./`](./) ([`index.ts`](index.ts)) | Subscribes to **`mtw.assets`**; blueprint / component reconciliation |
| **`mtw.ephemera.examples`** | [`componentExamples.ts`](componentExamples.ts) | Component examples stream |
| **`mtw.ephemera.renderCache`** | [`renderCache/`](renderCache/) | Durable **`CACHE#...`** rows, **`Render Pertains`**, orchestration handoff --- [`renderCache/AGENT.md`](renderCache/AGENT.md) |
| **`mtw.ephemera.renderOrchestration`** | [`renderOrchestration/`](renderOrchestration/) | **`findRender`**, generation, six outbound types --- [`renderOrchestration/AGENT.md`](renderOrchestration/AGENT.md) |
| **`mtw.ephemera.perception`** | [`perception/`](perception/) | Audience fan-in, **`PublishMessage`** --- [`perception/AGENT.md`](perception/AGENT.md) |
| **`mtw.ephemera.state`** | [`state/`](state/) | **`Meta::Room.state`** marks merge, **`State Changed`** --- [`state/AGENT.md`](state/AGENT.md) |
| **`mtw.ephemera.objects`** | [`objects/`](objects/) | **`Meta::Room.objects`** (structured **`uuid` + `shortName`**) merge, **`Objects Changed`** --- [`objects/AGENT.md`](objects/AGENT.md); executable history: [`taskPlanning/.../objects/AGENT.objectHandling.plan.md`](../../../taskPlanning/lambda/ephemera/dataSource/objects/AGENT.objectHandling.plan.md) |

**Virtual / cross-cutting:** **`api.ephemera`** is not a `DataSource` class but the **`dataSourceKey`** for internal command envelopes consumed by multiple subscribers above.

---

## Cache and storage touchpoints

- **`Meta::Room`** and related ephemera meta: read-through [`../internalCache/componentEphemeraMeta.ts`](../internalCache/componentEphemeraMeta.ts) --- [`../internalCache/componentEphemeraMeta.AGENT.md`](../internalCache/componentEphemeraMeta.AGENT.md).
- Render cache rows and queries: documented in [`renderCache/AGENT.md`](renderCache/AGENT.md).

---

## Testing

From [`lambda/ephemera/`](../): `npm test`. Integration: [`passThroughOrchestrationToCache.integration.test.ts`](passThroughOrchestrationToCache.integration.test.ts).

---

## Related documentation

| Doc | Role |
| --- | --- |
| [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) | **`busOnly`**, **`publishedEvents.ts`**, serialization boundaries |
| [`../internalCache/AGENT.md`](../internalCache/AGENT.md) | Per-invocation caches, **`PerceptionThreads`**, **`ComponentEphemeraMeta`** |
| [`../perception/AGENT.md`](../perception/AGENT.md) | Imperative perception handler (outside DataSource tree) |
