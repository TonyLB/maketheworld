# Assets message bus

This directory holds the assets **`MessageBus`** type union ([`baseClasses.ts`](./baseClasses.ts)) and handler subscriptions ([`index.ts`](./index.ts)). The runtime instance is a single **`InternalMessageBus`** shared across the lambda invocation.

## Virtual lanes

Partitioned drains (`flush()`, `flush(laneId)`), optional `send(payload, laneId)`, and subscription **`activeFlushLane`** are defined in **`@tonylb/mtw-lambda-patterns`**:

- [**Virtual lanes** (`InternalMessageBus`)](../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md#virtual-lanes-internalmessagebus) --- semantics, naming, non-goals
- [`ts/messageBus/index.ts`](../../../packages/mtw-lambda-patterns/ts/messageBus/index.ts) --- implementation
- [**Message bus lanes** (DataSource `streamEvent`)](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) --- inbound lane inheritance for streaming outbounds

Assets production **`messageBus.send`** call sites are **zero** (P5 closeout). All DataSources with **`streamEvent`** outbounds use **`outboundBusDelivery: 'publish'`**; boundary drain is **`flushAndSettle`** in [`../app.ts`](../app.ts). Legacy **`send`/`flush`** machinery remains in the package until P6.

Lambda exit drains via **`flushAndSettle`** in [`../app.ts`](../app.ts). **EventBridge ingress** (deserialized `StreamingEvent`, Initialize Subscription) and **WebSocket/API ingress** (imperative handler triggers, `api.assets` synthetic events, ingress `ReturnValue`/`Error`) use **`publish`** (P5).

## `publish`/`settle` migration

In progress: [`taskPlanning/.../AGENT.publishSettledMigration.planning.md`](../../../taskPlanning/packages/mtw-lambda-patterns/ts/messageBus/AGENT.publishSettledMigration.planning.md) (**Bucket-1 deep dive**). Legacy handlers use 1:1 type filters (Low triage risk) except bucket-1 batch handlers below.

| Handler / area | Fix axis | Notes |
| --- | --- | --- |
| [`returnValue/collector`](../returnValue/collector.ts) | **Contract** (landed P5) | Subscribe at priority **16** collects `ReturnValue` and first `Error` from **`publish`** (and **`send`** on flush during hybrid); [`extractReturnValue`](../returnValue/index.ts) reads collectors only; `onClear` on ingress `messageBus.clear()` |
| [`fetch`](../fetch/index.ts), [`upload`](../upload/index.ts) | **Easy migrate** (landed P5) | `ReturnValue` -> `publish`; boundary drain only |
| [`player/update`](../player/update.ts) | **PLAYER-REDUCE** (landed P5) | Subscriber only; `payloads.reduce` converges; optional per-player producer coalesce is optimization only |
| [`contentHeaders`](../contentHeaders/index.ts) | **CONTENT-AGG** (landed P5) | `events.reduce` + aggregator merge OK; `Error` -> `publish`; watch remove-then-update ordering in same burst |
| [`library`](../library/index.ts) | **Easy migrate** (landed P5) | `Error` in `receiveEvents` catch -> `publish` |
| [`dataSource/index.ts`](../dataSource/index.ts) (`mtw.assets`) | **Easy migrate** (landed P5) | `Error` / `ReturnValue` -> `publish`; `outboundBusDelivery: 'publish'` for `streamEvent` outbounds |
| All assets DataSources | **P2b** (landed P5) | `outboundBusDelivery: 'publish'` on `mtw.assets`, `contentHeaders`, `library`, `players`, `characters`, `componentTopology`, `componentExamples`, `components.verticals` |

## Testing

Async ordering in tests: [`packages/mtw-lambda-patterns/ts/messageBus/AGENT.testing.md`](../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.testing.md). Assets collector tests: [`../returnValue/collector.test.ts`](../returnValue/collector.test.ts).
