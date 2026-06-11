# Assets message bus

This directory holds the assets **`MessageBus`** type union ([`baseClasses.ts`](./baseClasses.ts)) and handler subscriptions ([`index.ts`](./index.ts)). The runtime instance is a single **`InternalMessageBus`** shared across the lambda invocation.

Steady-state bus API: [`packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md`](../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md).

All ingress and handler outbounds use **`messageBus.publish`**. Lambda exit drains via **`flushAndSettle`** in [`../app.ts`](../app.ts). **EventBridge ingress** (deserialized `StreamingEvent`, Initialize Subscription) and **WebSocket/API ingress** (imperative handler triggers, `api.assets` synthetic events, ingress `ReturnValue`/`Error`) use **`publish`**.

## Handlers

| Handler / area | Notes |
| --- | --- |
| [`returnValue/collector`](../returnValue/collector.ts) | Subscribe at priority **16** collects `ReturnValue` and first `Error` from **`publish`**; [`extractReturnValue`](../returnValue/index.ts) reads collectors only; `onClear` on ingress `messageBus.clear()` |
| [`fetch`](../fetch/index.ts), [`upload`](../upload/index.ts) | `ReturnValue` -> `publish`; boundary drain only |
| [`contentHeaders`](../contentHeaders/index.ts) | `events.reduce` + aggregator merge; `Error` -> `publish` |
| [`library`](../library/index.ts) | `Error` in `receiveEvents` catch -> `publish` |
| [`dataSource/index.ts`](../dataSource/index.ts) (`mtw.assets`) | `Error` / `ReturnValue` -> `publish`; `streamEvent` outbounds via DataSource `publish` |

## Testing

Async ordering in tests: [`packages/mtw-lambda-patterns/ts/messageBus/AGENT.testing.md`](../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.testing.md). Assets collector tests: [`../returnValue/collector.test.ts`](../returnValue/collector.test.ts).
