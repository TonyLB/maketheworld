# Ephemera message bus

This directory holds the ephemera **`MessageBus`** type union ([`baseClasses.ts`](./baseClasses.ts)) and handler subscriptions ([`index.ts`](./index.ts)). The runtime instance is a single **`InternalMessageBus`** shared across the lambda invocation.

Steady-state bus API: [`packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md`](../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md).

All ingress and handler outbounds use **`messageBus.publish`**. Lambda exit drains via **`flushAndSettle`** in [`../app.ts`](../app.ts) (settle loop + deferral tail). **EventBridge ingress** (deserialized `StreamingEvent`, Initialize Subscription) and **WebSocket API ingress** (imperative handler triggers, `api.ephemera` synthetic events, ingress `ReturnValue`) use **`publish`**.

## Bucket-1 handlers (deferral / coalesce / contract)

| Handler | Fix axis | Notes |
| --- | --- | --- |
| [`publishMessage`](../publishMessage/index.ts) | **Selective delivery** | `deliveryMode` on [`PublishMessageBase`](./baseClasses.ts): `immediate` (default) wire in handler; `deferred` -> [`publishMessage/coalescer.ts`](../publishMessage/coalescer.ts) + `afterSettled` (**character move only** at producers). Generating/terminal: immediate + explicit `createdTime`. |
| [`checkLocation`](../checkLocation/index.ts) | **Producer coalesce** | [`checkLocation/coalescer.ts`](../checkLocation/coalescer.ts) `tryClaim` + `registerDeferral` `onClear`; outbound `publish` for MoveCharacter/Perception |
| [`returnValue/collector`](../returnValue/collector.ts) | **Contract** | [`createBoundaryResponseCollector`](../../../packages/mtw-lambda-patterns/ts/messageBus/boundaryResponseCollector.ts) at priority **16** collects `ReturnValue` and bus `Error` from **`publish`**; [`extractReturnValue`](../returnValue/index.ts) reads collector only; `onClear` on ingress `messageBus.clear()`. WebSocket app errors use **`ReturnValue` body `messageType: 'Error'`** (200 response); boundary infrastructure failures use bus **`Error`** (non-200). In-game command feedback uses **`PublishMessage`**, not the collector. |
| [`mapSubscription`](../mapSubscription/index.ts) | **Contract** | One `ReturnValue` per handler invocation (ingress 1:1 per API op) |

## Testing

Async ordering in tests: [`packages/mtw-lambda-patterns/ts/messageBus/AGENT.testing.md`](../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.testing.md). Package examples: [`packages/mtw-lambda-patterns/ts/messageBus/index.test.ts`](../../../packages/mtw-lambda-patterns/ts/messageBus/index.test.ts).
