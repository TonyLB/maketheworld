# Ephemera message bus

This directory holds the ephemera **`MessageBus`** type union ([`baseClasses.ts`](./baseClasses.ts)) and handler subscriptions ([`index.ts`](./index.ts)). The runtime instance is a single **`InternalMessageBus`** shared across the lambda invocation.

## Virtual lanes

Partitioned drains (`flush()`, `flush(laneId)`), optional `send(payload, laneId)`, and subscription **`activeFlushLane`** are defined in **`@tonylb/mtw-lambda-patterns`**:

- [**Virtual lanes** (`InternalMessageBus`)](../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md#virtual-lanes-internalmessagebus) --- semantics, naming, non-goals
- [`ts/messageBus/index.ts`](../../../packages/mtw-lambda-patterns/ts/messageBus/index.ts) --- implementation
- [**Message bus lanes** (DataSource `streamEvent`)](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) --- inbound lane inheritance for streaming outbounds

Ephemera-specific lane usage for unmigrated DataSources lives next to those packages. **`renderOrchestration`**, **`affordanceOrchestration`**, **`renderCache`**, **`affordanceCache`**, **`actions`**, and **`perception`** migrated to **`publish`** + boundary drain (P3/P4); see [`../dataSource/renderOrchestration/AGENT.md`](../dataSource/renderOrchestration/AGENT.md), [`../dataSource/affordanceOrchestration/AGENT.md`](../dataSource/affordanceOrchestration/AGENT.md), [`../dataSource/renderCache/AGENT.md`](../dataSource/renderCache/AGENT.md), [`../dataSource/affordanceCache/AGENT.md`](../dataSource/affordanceCache/AGENT.md), [`../dataSource/actions/AGENT.md`](../dataSource/actions/AGENT.md), and [`../dataSource/perception/AGENT.md`](../dataSource/perception/AGENT.md).

Lambda exit drains via **`flushAndSettle`** in [`../app.ts`](../app.ts). **EventBridge ingress** (deserialized `StreamingEvent`, Initialize Subscription, legacy `DisconnectCharacter`) and **WebSocket API ingress** (imperative handler triggers, `api.ephemera` synthetic events, ingress `ReturnValue`) use **`publish`** (P4). Named-lane work remains only on unmigrated paths until their P3/P4 slices land.

## `publish`/`settle` migration

In progress: [`taskPlanning/.../AGENT.publishSettledMigration.planning.md`](../../../taskPlanning/packages/mtw-lambda-patterns/ts/messageBus/AGENT.publishSettledMigration.planning.md) (**Bucket-1 deep dive**). Legacy handlers use 1:1 type filters (Low triage risk) except bucket-1 batch handlers below.

| Handler | Fix axis | Notes |
| --- | --- | --- |
| [`publishMessage`](../publishMessage/index.ts) | **Q9 selective delivery** (landed P4) | `deliveryMode` on [`PublishMessageBase`](./baseClasses.ts): `immediate` (default) wire in handler; `deferred` -> [`publishMessage/coalescer.ts`](../publishMessage/coalescer.ts) + `afterSettled` via `registerDeferral` in [`index.ts`](./index.ts) (**character move only** at producers). Generating/terminal: immediate + explicit `createdTime` on perception payloads. |
| [`checkLocation`](../checkLocation/index.ts) | **Producer coalesce** (landed P4) | [`checkLocation/coalescer.ts`](../checkLocation/coalescer.ts) `tryClaim` + `registerDeferral` `onClear`; outbound `publish` for MoveCharacter/Perception; CheckLocation ingress from **positions** now **`publish`** (POSITIONS); **SELF-HEALING** still `send` |
| [`positions`](../dataSource/positions/handleConnectionsCharactersPresence.ts) | **Easy migrate** (landed P4 POSITIONS) | Connect/disconnect handlers: `CheckLocation`, `PublishMessage`, `RoomUpdate` -> `publish`; no `outboundBusDelivery` flip (no `streamEvent` outbounds); boundary drain only |
| [`returnValue/collector`](../returnValue/collector.ts) | **Contract** (landed P4 WebSocket ingress) | Subscribe at priority **16** collects `ReturnValue` from **`publish`** (immediate) and **`send`** (on flush); [`extractReturnValue`](../returnValue/index.ts) reads collector only; `onClear` on ingress `messageBus.clear()`; parse + `executeAction` ReturnValue now **`publish`** (ACTIONS-PARSE); **MAP-SUB** still `send` |
| [`actions`](../dataSource/actions/index.ts), [`executeAction`](../parse/executeAction.ts) | **Easy migrate** (landed P4 ACTIONS-PARSE) | Imperative `PublishMessage` / `MoveCharacter` / `ReturnValue` -> `publish`; `outboundBusDelivery: 'publish'` on `mtw.ephemera.actions`; boundary drain only |
| [`moveCharacter`](../moveCharacter/index.ts) | **Q9 selective delivery** (landed P4 MOVE-CHAR) | All outbounds `publish`; fallback `WorldMessage` leave/arrive set `deliveryMode: 'deferred'`; primary path registers `characterMove` thread (leave/arrive via [`characterMoveDelivery`](../dataSource/perception/characterMoveDelivery.ts)); boundary drain only |
| [`mapSubscription`](../mapSubscription/index.ts) | **Contract** | `extractReturnValue` merge policy if multi-send per invocation |
| [`ephemeraUpdate`](../ephemeraUpdate/index.ts), [`fetchEphemera`](../fetchEphemera/index.ts), [`perception`](../perception/index.ts) (ReturnValue) | **Easy migrate** | Downstream state/merge already converges; extra frames OK |

## Testing

Lane-scoped behavior: [`packages/mtw-lambda-patterns/ts/messageBus/index.test.ts`](../../../packages/mtw-lambda-patterns/ts/messageBus/index.test.ts). For async ordering in tests, see [`AGENT.testing.md`](../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.testing.md) (`createAsyncGate` with `flush` / `flush(laneId)`).
