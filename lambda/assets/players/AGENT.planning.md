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
- Treat the player name as the per-stream identifier: the EventBridge `streamKey` for `mtw.assets.players` will be `PlayerName`. Payloads no longer need to echo the name.
- Keep connection-scoped fields (e.g. `SessionId`) out of the data source payloads. The subscriptions lambda already knows the target session and can enrich outgoing websocket messages with the current session ID as a special case.

---

## Implementation Checklist

- [x] Author `mtw.assets.players` event types, external payloads, and serializer in `packages/mtw-interfaces/ts/eventBridge/`.
- [ ] Add snapshot generation utilities (reuse or refactor `CachePlayerLibraryData`) to support replayable subscriptions.
- [ ] Implement the `mtw.assets.players` data source (constructor, subscriptions to `mtw.assets`, streamEvent logic, and tests).
- [ ] Register the new data source with the subscriptions lambda (`lambda/subscriptions/handlerFramework`) and add integration tests as needed.
- [ ] Update the client (`charcoal-client/src/slices/player`) to subscribe to the new stream and retire the ad-hoc `whoAmI` refresh path.

---

## Cleanup

- Summarize final architecture decisions in `lambda/assets/AGENT.event.md` and link to any long-term documentation that replaced this plan.
- Update client and interface documentation (e.g., `charcoal-client/AGENT.md`, `packages/mtw-interfaces/AGENT.md`) with the new player data source contract.
- Once all knowledge is migrated, remove `lambda/assets/players/AGENT.planning.md` and delete the temporary document entry in the parent planning docs.

---

