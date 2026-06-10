# Ephemera message bus

This directory holds the ephemera **`MessageBus`** type union ([`baseClasses.ts`](./baseClasses.ts)) and handler subscriptions ([`index.ts`](./index.ts)). The runtime instance is a single **`InternalMessageBus`** shared across the lambda invocation.

## Virtual lanes

Partitioned drains (`flush()`, `flush(laneId)`), optional `send(payload, laneId)`, and subscription **`activeFlushLane`** are defined in **`@tonylb/mtw-lambda-patterns`**:

- [**Virtual lanes** (`InternalMessageBus`)](../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md#virtual-lanes-internalmessagebus) --- semantics, naming, non-goals
- [`ts/messageBus/index.ts`](../../../packages/mtw-lambda-patterns/ts/messageBus/index.ts) --- implementation
- [**Message bus lanes** (DataSource `streamEvent`)](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) --- inbound lane inheritance for streaming outbounds

Ephemera production **`messageBus.send`** call sites are **zero** (P4 closeout). All DataSources with **`streamEvent`** outbounds use **`outboundBusDelivery: 'publish'`**; boundary drain is **`flushAndSettle`** in [`../app.ts`](../app.ts). Legacy **`send`/`flush`** machinery remains in the package until P6.

Lambda exit drains via **`flushAndSettle`** in [`../app.ts`](../app.ts). **EventBridge ingress** (deserialized `StreamingEvent`, Initialize Subscription, legacy `DisconnectCharacter`) and **WebSocket API ingress** (imperative handler triggers, `api.ephemera` synthetic events, ingress `ReturnValue`) use **`publish`** (P4).

## `publish`/`settle` migration

In progress: [`taskPlanning/.../AGENT.publishSettledMigration.planning.md`](../../../taskPlanning/packages/mtw-lambda-patterns/ts/messageBus/AGENT.publishSettledMigration.planning.md) (**Bucket-1 deep dive**). Legacy handlers use 1:1 type filters (Low triage risk) except bucket-1 batch handlers below.

| Handler | Fix axis | Notes |
| --- | --- | --- |
| [`publishMessage`](../publishMessage/index.ts) | **Q9 selective delivery** (landed P4) | `deliveryMode` on [`PublishMessageBase`](./baseClasses.ts): `immediate` (default) wire in handler; `deferred` -> [`publishMessage/coalescer.ts`](../publishMessage/coalescer.ts) + `afterSettled` via `registerDeferral` in [`index.ts`](./index.ts) (**character move only** at producers). Generating/terminal: immediate + explicit `createdTime` on perception payloads. |
| [`checkLocation`](../checkLocation/index.ts) | **Producer coalesce** (landed P4) | [`checkLocation/coalescer.ts`](../checkLocation/coalescer.ts) `tryClaim` + `registerDeferral` `onClear`; outbound `publish` for MoveCharacter/Perception; CheckLocation ingress from **positions** and **self-healing** now **`publish`** |
| [`selfHealing/roomOccupancyDriftFinding`](../dataSource/selfHealing/roomOccupancyDriftFinding.ts) | **Easy migrate** (landed P4 SELF-HEALING) | `RoomUpdate` + `CheckLocation` -> `publish`; completes CHECK-LOC ingress chain; no `outboundBusDelivery` flip; boundary drain only |
| [`positions`](../dataSource/positions/handleConnectionsCharactersPresence.ts) | **Easy migrate** (landed P4 POSITIONS) | Connect/disconnect handlers: `CheckLocation`, `PublishMessage`, `RoomUpdate` -> `publish`; no `outboundBusDelivery` flip (no `streamEvent` outbounds); boundary drain only |
| [`returnValue/collector`](../returnValue/collector.ts) | **Contract** (landed P4 WebSocket ingress) | Subscribe at priority **16** collects `ReturnValue` from **`publish`** (immediate) and **`send`** (on flush); [`extractReturnValue`](../returnValue/index.ts) reads collector only; `onClear` on ingress `messageBus.clear()`; parse + `executeAction` + **MAP-SUB** ReturnValue now **`publish`** |
| [`actions`](../dataSource/actions/index.ts), [`executeAction`](../parse/executeAction.ts) | **Easy migrate** (landed P4 ACTIONS-PARSE) | Imperative `PublishMessage` / `MoveCharacter` / `ReturnValue` -> `publish`; `outboundBusDelivery: 'publish'` on `mtw.ephemera.actions`; boundary drain only |
| [`moveCharacter`](../moveCharacter/index.ts) | **Q9 selective delivery** (landed P4 MOVE-CHAR) | All outbounds `publish`; fallback `WorldMessage` leave/arrive set `deliveryMode: 'deferred'`; primary path registers `characterMove` thread (leave/arrive via [`characterMoveDelivery`](../dataSource/perception/characterMoveDelivery.ts)); boundary drain only |
| [`disconnectMessage`](../disconnectMessage/index.ts) | **Easy migrate** (landed P4 DISCONNECT-CHAIN) | DISCONNECT-UNREG + DISCONNECT-CHAR: `PublishMessage`, `RoomUpdate`, `ReturnValue` -> `publish`; injected bus throughout (no singleton sends); immediate WorldMessage |
| [`roomUpdate`](../roomUpdate/index.ts) | **Atomic with affordance P3** (landed P4 ROOM-AFFORD) | Handler has no direct bus calls; `RoomUpdate` ingress triggers `sendAffordanceRefreshRequestedForRoom` -> `publish`; disconnect/move/positions producers now `publish` RoomUpdate |
| [`mapSubscription`](../mapSubscription/index.ts) | **Contract** (landed P4 MAP-SUB) | `ReturnValue` -> `publish`; one ReturnValue per handler invocation (ingress 1:1 per API op); handler batch aggregation unchanged |
| [`fetchEphemera`](../fetchEphemera/index.ts), [`ephemeraUpdate`](../ephemeraUpdate/index.ts) | **Easy migrate** (landed P4 Easy / Low) | FETCH-EPH `EphemeraUpdate` outbound `publish`; EPH-UPDATE subscriber (producers already `publish`); client keyed by `CharacterId`; boundary drain only |
| [`state/handleApiStateChange`](../dataSource/state/handleApiStateChange.ts) | **Easy migrate** (landed P4 Easy / Low) | ReturnValue `publish` via collector; `mtw.ephemera.state` `outboundBusDelivery: 'publish'` for State Changed outbounds |
| [`dataSource/index.ts`](../dataSource/index.ts) (root `mtw.ephemera` DS) | **Easy migrate** (landed P4 closeout) | Canon Updated / Zone Updated ingress: `CanonSet` / `CanonAdd` / `CanonRemove` -> `publish`; no `outboundBusDelivery` flip (no `streamEvent` outbounds); component kick already `publish` |
| [`materializeRoomStateRender`](../conversations/conversationTypes/roomStateRender/materialize.ts) | **Easy migrate** (landed P4 closeout) | Terminal `RenderReady` / `RenderInvalidate` / `RenderError` -> `publish`; conversation-backed flows only (passive orchestration uses `streamEvent` on renderOrchestration) |
| [`objects`](../dataSource/objects/index.ts), [`thinking.scheduling`](../dataSource/thinking/scheduling/index.ts) | **P2b** (landed P4 closeout) | `outboundBusDelivery: 'publish'` on `Objects Changed` and `Job Completed` `streamEvent` outbounds |

## Testing

Lane-scoped behavior: [`packages/mtw-lambda-patterns/ts/messageBus/index.test.ts`](../../../packages/mtw-lambda-patterns/ts/messageBus/index.test.ts). For async ordering in tests, see [`AGENT.testing.md`](../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.testing.md) (`createAsyncGate` with `flush` / `flush(laneId)`).
