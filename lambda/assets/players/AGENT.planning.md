# mtw.assets.players Planning

**Status**: ⚠️ TEMPORARY DOCUMENT — delete after the mtw.assets players data source ships and permanent docs are updated  
**Tracked in**: [`../AGENT.event.md`](../AGENT.event.md) (Temporary Documents section) and [`../../../../AGENT.drafts.planning.md`](../../../../AGENT.drafts.planning.md)

---

## Getting Started

1. **Review Project Foundations**  
   - Read the root [`AGENT.md`](../../../../AGENT.md) to refresh documentation standards and the temporary-doc cleanup pattern that this file follows.
   - Skim [`AGENT.architecture.events.md`](../../../../AGENT.architecture.events.md) for the event-mesh principles that motivate having domain-authoritative data sources.

2. **Understand Current Planning Context**  
   - In [`../../../../AGENT.drafts.planning.md`](../../../../AGENT.drafts.planning.md) search for the assets/player migration notes to see how this effort ties into the broader draft-system work.

3. **Map Core Integration Points**  
   - Inspect [`../dataSource/index.ts`](../dataSource/index.ts) to see how `mtw.assets` currently reacts to WML events and what information is available to downstream subscribers.
   - Review [`../internalCache/playerLibrary.ts`](../internalCache/playerLibrary.ts) and [`../player/info.ts`](../player/info.ts) to understand today’s player snapshot generation and how `PlayerInfo` messages are assembled.

4. **Study Reference Implementations**  
   - Look at the replayable data source pattern in [`../library/index.ts`](../library/index.ts) and [`../contentHeaders/index.ts`](../contentHeaders/index.ts) for how we configure snapshot generators, aggregators, and serializers.
   - Revisit the non-replayable pattern in [`../../wml/dataSource/mtw-wml.ts`](../../wml/dataSource/mtw-wml.ts) to confirm how upstream events are published for others to consume.

5. **Check Testing Patterns**  
   - Examine [`../dataSource/index.test.ts`](../dataSource/index.test.ts) and [`../library/index.test.ts`](../library/index.test.ts) to mirror test structure, mocking strategy, and expectations for new data sources.

6. **Locate the Next Tasks**  
   - Use the Implementation Checklist below as the authoritative task list; update it as decisions evolve.

7. **Baseline Verification**  
   - Before coding, run the assets lambda test suite:  
     `cd lambda/assets && npm test -- --watchAll=false`  
     This confirms that existing data sources are green prior to introducing the new player stream.

---

## High-Level Plan

- Define EventBridge contracts and serializers for the forthcoming `mtw.assets.players` replayable data source in `@tonylb/mtw-interfaces`.
- Implement a replayable player data source that subscribes to `mtw.assets` events, derives per-player updates, and exposes snapshots via the generic pattern.
- Transition the client player slice to rely on the new data source (replacing the `whoAmI` life-line dependency) once backend streaming is ready.
  - **Migration Status**: Client currently subscribes to `mtw.assets.players` but uses manual event processing. Must migrate to `createDataSourceSlice` pattern to get proper out-of-order event handling (timestamp-based sorting and re-aggregation).
- Treat the player name as the per-stream identifier: the EventBridge `streamKey` for `mtw.assets.players` will be `PlayerName`. Payloads no longer need to echo the name.
- Keep connection-scoped fields (e.g. `SessionId`) out of the data source payloads. The subscriptions lambda already knows the target session and can enrich outgoing websocket messages with the current session ID as a special case.
- Until subscription authorization grows richer context, the subscriptions lambda rewrites a sentinel stream key (`self`) to the authenticated `PlayerName` when clients subscribe to `mtw.assets.players`. Document this provisional shim and remove it when we implement proper context-aware routing.
- **Legacy API Messages**: `updatePlayerSettings` currently flows through the assets lambda as an ad-hoc messageBus type (`PlayerSettings`). We’ll subscribe to that legacy message for now so the new data source stays in sync, but note that the longer-term goal is to fold these direct API hooks into the unified data-source handler pattern (mirroring how other services route incoming API traffic through data sources).

---

## Implementation Checklist

- [x] Author `mtw.assets.players` event types, external payloads, and serializer in `packages/mtw-interfaces/ts/eventBridge/`.
- [x] Add snapshot generation utilities (reuse or refactor `CachePlayerLibraryData`) to support replayable subscriptions.
- [ ] Implement the `mtw.assets.players` data source (constructor, subscriptions to `mtw.assets`, streamEvent logic, and tests).  
  ✅ Emit granular deltas (`Player Asset Assigned/Removed`, `Player Settings Updated`) derived directly from incoming `mtw.assets` events—no in-memory ownership cache.  
  🔄 Follow-up: Once client integration is complete, remove the now-unused legacy streaming paths and retire full-snapshot fallback (keep only for replay).
- [x] Register the new data source with the subscriptions lambda (`lambda/subscriptions/handlerFramework`) so clients receive the granular deltas.
- [x] Update the client (`charcoal-client/src/slices/player`) to subscribe to the new stream and retire the ad-hoc `whoAmI` refresh path.
  ⚠️ **PARTIAL**: Client is subscribing to `mtw.assets.players` stream, but still using manual event processing in `subscribeAction` instead of the generic `createDataSourceSlice` pattern. This causes state to be dependent on event arrival order rather than timestamp order.
- [ ] Migrate client player slice to use `createDataSourceSlice` pattern (like `contentHeaders` slice) to get proper out-of-order event handling, event caching, and timestamp-based re-aggregation.
  - Replace manual `subscribeAction` event processing with generic data source slice
  - Use `processRawSnapshot` and `processRawEvent` actions from the generic pattern
  - Map materialized view to `PlayerPublic` format (preserving `SessionId` handling from coordination messages)
  - Ensure `SessionId` continues to be handled separately via `SessionInitialized` coordination messages

---

## Cleanup

- Summarize final architecture decisions in `lambda/assets/AGENT.event.md` and link to any long-term documentation that replaced this plan.
- Update client and interface documentation (e.g., `charcoal-client/AGENT.md`, `packages/mtw-interfaces/AGENT.md`) with the new player data source contract.
- Once all knowledge is migrated, remove `lambda/assets/players/AGENT.planning.md` and delete the temporary document entry in the parent planning docs.

---

