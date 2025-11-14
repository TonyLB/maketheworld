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
  - ✅ **Migration Complete**: Client now uses `createDataSourceSlice` pattern with proper out-of-order event handling. Selectors read directly from `playerDataSource` materialized view. Stream key resolution is complete - `playerDataSource` auto-subscribes using actual `PlayerName` from `SessionInitialized` message.
- Treat the player name as the per-stream identifier: the EventBridge `streamKey` for `mtw.assets.players` will be `PlayerName`. Payloads no longer need to echo the name.
- Keep connection-scoped fields (e.g. `SessionId`) out of the data source payloads. The subscriptions lambda already knows the target session and can enrich outgoing websocket messages with the current session ID as a special case.
- **Stream Key Resolution**: ✅ **Complete** - Extended `SessionInitialized` coordination message to include `PlayerName`, added hold condition to `playerDataSource` SSM, and implemented auto-subscribe via `onReady` callback. The `SessionInitialized` handler was moved to `lifeLine` slice to avoid timing issues. All `'self'` magic-word references have been removed from the client.
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
  ✅ **Complete**: Client now uses `createDataSourceSlice` pattern with proper out-of-order event handling.
- [x] Migrate client player slice to use `createDataSourceSlice` pattern (like `contentHeaders` slice) to get proper out-of-order event handling, event caching, and timestamp-based re-aggregation.
  - ✅ Replace manual `subscribeAction` event processing with generic data source slice
  - ✅ Use `processRawSnapshot` and `processRawEvent` actions from the generic pattern
  - ✅ Update selectors to read directly from `playerDataSource` materialized view (single source of truth)
  - ✅ Ensure `SessionId` continues to be handled separately via `SessionInitialized` coordination messages
- [x] Fix stream key resolution to eliminate reactive workaround:
  - [x] Extend `SessionInitialized` coordination message to include `PlayerName` (backend change in `lambda/subscriptions/app.ts` and `packages/mtw-interfaces/ts/coordination.ts`)
  - [x] Add hold condition to `playerDataSource` SSM to wait for `PlayerName` from `SessionInitialized` message
  - [x] Update `playerDataSource` subscription to use actual `PlayerName` instead of `'self'` once received (via `onReady` auto-subscribe)
  - [x] Move `SessionInitialized` handler to `lifeLine` slice to avoid chicken-and-egg timing issues
  - [x] Remove reactive stream key mapping workaround from `reducers.ts` (the `'self'` → actual name fallback logic)
  - [x] Update selector to use actual stream key directly (simplify `getPlayerSnapshot` helper)
  - [x] Remove all `'self'` magic-word references from client player data-source

- [ ] Deprecate `player` slice (most functionality now in `playerDataSource`):
  - [x] Remove or deprecate `addAsset` reducer - assets now come from `playerDataSource`, this is effectively a no-op
  - [ ] Remove or deprecate `receivePlayer` reducer - only used for legacy `Player` messages during migration
  - [ ] Simplify state machine: remove `SYNCHRONIZE` state (since `syncAction` is now a no-op), transition directly `INITIAL -> SUBSCRIBE -> CONNECTED -> UNSUBSCRIBE`
  - [ ] Minimize `publicData` initialization - remove unused `Assets`, `Characters`, etc. (selectors now read from `playerDataSource`)
  - [ ] Move onboarding actions (`updateOnboardingComplete`, `addOnboardingComplete`, `removeOnboardingComplete`) to separate `onboarding` slice or keep in `player` temporarily
  - [ ] Move onboarding selectors (`getActiveOnboardingChapter`, `getOnboardingPage`, `getNextOnboardingEntry`, `getNextOnboarding`) to separate `onboarding` slice or keep in `player` temporarily
  - [ ] Remove legacy `Player` message handling once migration is complete (currently in `subscribeAction` for backward compatibility)
  - [ ] Consider removing `player` slice entirely once onboarding is moved and legacy message handling is removed

- [ ] **Post-deprecation verification**: After removing the `player` slice, verify that the backend no longer sends legacy `Player` messages:
  - [ ] Check `lambda/subscriptions` for any code that still sends `Player` message type
  - [ ] Check `lambda/assets` for any code that still sends `Player` message type
  - [ ] Verify that all player data now flows exclusively through `mtw.assets.players` data source stream
  - [ ] Remove any remaining backend code that generates legacy `Player` messages

---

## Cleanup

- Summarize final architecture decisions in `lambda/assets/AGENT.event.md` and link to any long-term documentation that replaced this plan.
- Update client and interface documentation (e.g., `charcoal-client/AGENT.md`, `packages/mtw-interfaces/AGENT.md`) with the new player data source contract.
- Once all knowledge is migrated, remove `lambda/assets/players/AGENT.planning.md` and delete the temporary document entry in the parent planning docs.

---

