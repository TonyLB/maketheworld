# Ephemera message bus

This directory holds the ephemera **`MessageBus`** type union ([`baseClasses.ts`](./baseClasses.ts)) and handler subscriptions ([`index.ts`](./index.ts)). The runtime instance is a single **`InternalMessageBus`** shared across the lambda invocation.

## Virtual lanes

Partitioned drains (`flush()`, `flush(laneId)`), optional `send(payload, laneId)`, and subscription **`activeFlushLane`** are defined in **`@tonylb/mtw-lambda-patterns`**:

- [**Virtual lanes** (`InternalMessageBus`)](../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md#virtual-lanes-internalmessagebus) --- semantics, naming, non-goals
- [`ts/messageBus/index.ts`](../../../packages/mtw-lambda-patterns/ts/messageBus/index.ts) --- implementation
- [**Message bus lanes** (DataSource `streamEvent`)](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) --- inbound lane inheritance for streaming outbounds

Ephemera-specific usage (for example **`renderOrchestration`** ingress lane and terminal outbounds on the default lane) lives next to those DataSources; see [`../dataSource/renderOrchestration/`](../dataSource/renderOrchestration/).

Lambda exit drains the **default** lane in [`../app.ts`](../app.ts) (`messageBus.flush()`). Named-lane work is flushed where orchestration schedules it (see **`generateRoomPreview`** / **`flushOrchestrationLane`**). Event-driven **`look`** also **`flush`es** **`lookCommandPerceptionThreadLaneId`** inside [`../dataSource/renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts`](../dataSource/renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts) before the default-lane **`Render Requested`**.

## Testing

Lane-scoped behavior: [`packages/mtw-lambda-patterns/ts/messageBus/index.test.ts`](../../../packages/mtw-lambda-patterns/ts/messageBus/index.test.ts). For async ordering in tests, see [`AGENT.testing.md`](../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.testing.md) (`createAsyncGate` with `flush` / `flush(laneId)`).
