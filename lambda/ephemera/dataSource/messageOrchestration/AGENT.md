# `mtw.ephemera.messageOrchestration`

**Status:** Scaffolded 2026-07-26 --- bus-only, non-replayable `EphemeraDataSource`. Registered from [`../../app.ts`](../../app.ts) via `import './dataSource/messageOrchestration'`. Mechanism only: no real producer or consumer is wired onto it yet. See [`taskPlanning/lambda/ephemera/AGENT.messageOrchestrationConsolidation.planning.md`](../../../../taskPlanning/lambda/ephemera/AGENT.messageOrchestrationConsolidation.planning.md) for the full migration this DataSource is Phase 2 of.

## Role

Ordered-array/settle-then-flush replacement for `OrchestrateMessagesData`'s before/during/after tree (`internalCache/orchestrateMessages.ts`): Plan/Synthesize's compiler declares a bundle's slots up front, in compiled order; each slot is resolved independently and reports its content; once every slot has reported (or the bundle settles with some slots unresolved), the resolved subset flushes to `messageBus.publish` in the original compiled order. Decouples resolution order from delivery order without a graph/tree abstraction.

| Layer | Owner |
| --- | --- |
| Instruction compile (produces the ordered slot list) | Plan/Synthesize |
| Slot resolution (a mutation's fact-streaming, the perception kernel's per-step render) | Whichever component owns that slot |
| Bundle correlation, settle, ordered flush | **`mtw.ephemera.messageOrchestration`** (this package) |
| Terminal WebSocket delivery | `messageBus.publish` (`PublishMessage`), called directly from this DataSource's fan-in handler |

## Ingress

Two `api.ephemera` command kinds, both in-process only (no EventBridge --- see [`../localApiEvents.ts`](../localApiEvents.ts)'s header comment on the pattern this reuses):

- **`Message Bundle Declared`** (`MessageBundleDeclareCommand`, [`localApiEvents.ts`](localApiEvents.ts)): `{ bundleId, slots: [{ slotId, expectedPublishType }] }` --- the full, compiled-order slot list, emitted once per bundle.
- **`Message Slot Reported`** (`MessageSlotReportCommand`, [`localApiEvents.ts`](localApiEvents.ts)): `{ bundleId, slotId, message }` where `message` is a `PublishMessage` (`../../messageBus/baseClasses.ts`) --- the eventual bus-publish payload, held until the bundle settles rather than published immediately.

Envelope guards + typed send-helpers (`sendMessageBundleDeclared`, `sendMessageSlotReported`): [`subscribedEvents.ts`](subscribedEvents.ts), mirroring `dataSource/perception/subscribedEvents.ts`'s `sendCharacterPerceptionRequested` shape. **No caller invokes these yet** --- Phase 3 (navigate) and Phase 5 (object-look kernel) wire producers in.

## Fan-in / settle mechanics

[`messageOrchestrationFanIn.ts`](messageOrchestrationFanIn.ts) is a `FanInCluster` spec on the shipped `FanInCluster`/`FanInClusterStore` framework (`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`'s fan-in section; concrete precedent `dataSource/perception/membershipPresentationFanIn.ts`). Cluster identity is `bundleId`, known on every leg --- **unlike** membership presentation's provisional/unify case, **either** leg kind (`bundle-declare` or `slot-report`) may seed the cluster, so a slot-report that arrives before its bundle-declare still joins the same cluster instead of being silently dropped. `completed` is "the bundle has been declared and every declared `slotId` has a registered leg." Settle is `messageBus`'s existing deferral tail (`registerDeferral`/`flushAndSettle`/`settleDeferrals()`), the same mechanism membership presentation and object manipulation presentation fan-in already use for "optional leg never arrives" --- registered here via a manual `messageBus.registerDeferral('fanIn-mtw.ephemera.messageOrchestration', { onClear, afterSettled })` ([`index.ts`](index.ts)), mirroring `dataSource/perception/index.ts`'s pattern rather than `FanInClusterStore`'s own `registerDeferral` convenience method --- the convenience method calls `settleDeferrals()` unconditionally, which throws if `setHandlerContext` was never called (i.e. no event has reached `receiveEvents` yet); the manual form guards on `getOpenPartialCount() > 0` first, same as perception's two-store wiring.

## Publish behavior

On completion (all slots reported) or settle (deferral tail fires with some slots still unresolved), the cluster's `handler` iterates the declared slot list **in compiled order** and calls `messageBus.publish` for each slot that has a report, skipping any that never resolved ("tolerantly failed" --- Phase 1's design). No `CreatedTime`/offset recomputation happens here; slots publish with whatever `createdTime` their reported `PublishMessage` already carries. Replacing `allOffsets()`-based `CreatedTime` computation with directly-assigned sequential values from this already-ordered array is Phase 4's job, once a real producer exists.

`expectedPublishType` on each declared slot is carried through but **not validated** against the reported message's `displayProtocol` in this slice --- there is no caller yet that could violate it; deferred, not silently dropped.

## Explicit non-goals (this slice)

- No real producer or consumer wired in --- Phase 3 (navigate's tail), Phase 4 (`publishMessage`'s `CreatedTime` computation), and Phase 5 (object-look's perception kernel) migrate existing call sites onto this DataSource later.
- No `CreatedTime`/offset computation (Phase 4).
- No EventBridge / DataSource-to-DataSource subscription --- API Ingress only for this iteration (MO-5 in the planning doc, deliberately deferred).
- No outbound stream events --- output is a direct `messageBus.publish` call, not a further stream republish ([`publishedEvents.ts`](publishedEvents.ts) is a `busOnly` placeholder).

## Related documentation

| Doc | Role |
| --- | --- |
| [`taskPlanning/lambda/ephemera/AGENT.messageOrchestrationConsolidation.planning.md`](../../../../taskPlanning/lambda/ephemera/AGENT.messageOrchestrationConsolidation.planning.md) | Full migration this DataSource is Phase 2 of; Phase 0/1 design record |
| [`../perception/AGENT.md`](../perception/AGENT.md) | Concrete `FanInCluster`/`FanInClusterStore` precedent this package mirrors |
| [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md#fan-in-cluster-pattern-multi-leg-ingress-correlation) | Fan-in framework doc |
| [`../../internalCache/orchestrateMessages.ts`](../../internalCache/orchestrateMessages.ts) | The mechanism this migration retires (Phase 6, last step) |
