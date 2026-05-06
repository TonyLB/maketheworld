# Map subscription refactor (deferred)

Status: deferred. Trigger after PR8 lands temporary `mtw.ephemera.maps` stub and `Map / Subscriptions` coupling is removed.

## Purpose

Track the deferred redesign of map subscription and publishing behavior after the temporary stub window. This plan exists so PR8 can intentionally defer map publishing while preserving a clear path to a full, durable architecture.

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../AGENT.md).

## Getting started

1. Review planning conventions in [`taskPlanning/AGENT.md`](../../AGENT.md).
2. Review current (legacy/orphaned) imperative map subscription paths:
   - [`lambda/ephemera/mapSubscription/index.ts`](../../../lambda/ephemera/mapSubscription/index.ts)
   - [`lambda/ephemera/mapUpdate/index.ts`](../../../lambda/ephemera/mapUpdate/index.ts)
   - [`lambda/ephemera/ephemeraUpdate/index.ts`](../../../lambda/ephemera/ephemeraUpdate/index.ts)
   - [`lambda/ephemera/internalCache/global.ts`](../../../lambda/ephemera/internalCache/global.ts) (`mapSubscriptions` reads)
3. Review current client map-consumption behavior:
   - [`charcoal-client/src/slices/activeCharacters/index.api.ts`](../../../charcoal-client/src/slices/activeCharacters/index.api.ts)
   - [`charcoal-client/src/slices/activeCharacters/receiveMapEphemera.ts`](../../../charcoal-client/src/slices/activeCharacters/receiveMapEphemera.ts)
   - [`charcoal-client/src/components/Maps/View/index.tsx`](../../../charcoal-client/src/components/Maps/View/index.tsx)
4. Review DataSource/event plumbing patterns to align with:
   - [`lambda/ephemera/dataSource/subscribedEvents.ts`](../../../lambda/ephemera/dataSource/subscribedEvents.ts)
   - [`charcoal-client/src/slices/dataSource/streamEventPubSub/AGENT.md`](../../../charcoal-client/src/slices/dataSource/streamEventPubSub/AGENT.md)
   - [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)

## Problem statement

During PR8, map publishing is intentionally disabled behind a temporary `mtw.ephemera.maps` stub DataSource that returns syntactically valid empty snapshots. This avoids continued investment in imperative `Map / Subscriptions` infrastructure while preserving subscribe/unsubscribe request/ack behavior.

This deferred plan defines how to restore map functionality in a DataSource-native way.

## Design assumptions to preserve

- Keep client-facing subscribe/unsubscribe correlation semantics stable.
- Avoid re-introducing aggregate-row coupling (`ConnectionId='Map', DataCategory='Subscriptions'`).
- Prefer DataSource-native subscriptions, serialization, and stream delivery over imperative message-bus fanout.
- Preserve clear ownership boundaries with perception/render orchestration; map publishing should not bypass those boundaries ad hoc.

## Open decisions (deferred)

Pending decisions use `[ ]` and locked decisions use `[X]`.

- [ ] M1 - Canonical `mtw.ephemera.maps` stream shape
  - [ ] Snapshot schema (empty/partial/full) and content contract
  - [ ] Incremental update schema and merge behavior on client
  - [ ] Backward compatibility layer for existing `receiveMapEphemera` expectations

- [ ] M2 - Subscription identity and routing
  - [ ] Stream key identity (`character`, `session+character`, or alternate)
  - [ ] Multi-character session semantics
  - [ ] Unsubscribe behavior and stale-subscription cleanup policy

- [ ] M3 - Perception pipeline integration model
  - [ ] Source of truth for map visibility/eligibility by character context
  - [ ] Relationship to room/perception update triggers
  - [ ] Ordering guarantees vs other ephemera updates

- [ ] M4 - Migration and rollout strategy
  - [ ] How archived imperative paths are retired permanently
  - [ ] Whether to add temporary adapters or do one-shot client contract update
  - [ ] Rollback triggers and observability checkpoints

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark each nested line as progress is made; when all nested lines are complete, mark the parent line `[X]`.

- [ ] Phase 1 - Lock contracts and ownership
  - [ ] Lock M1-M4 decisions.
  - [ ] Write contract examples for snapshot and update payloads.
  - [ ] Confirm ownership split with perception/render orchestration.

- [ ] Phase 2 - Implement DataSource-native map stream
  - [ ] Implement `mtw.ephemera.maps` snapshot/update production path.
  - [ ] Implement subscription routing and unsubscribe cleanup without aggregate map row.
  - [ ] Add/adjust serializers and stream-event deserializers as needed.

- [ ] Phase 3 - Client adoption
  - [ ] Update client map consumption to DataSource stream contract.
  - [ ] Remove temporary stub assumptions and ensure map rendering repopulates.
  - [ ] Validate subscribe/unsubscribe acknowledgements remain stable.

- [ ] Phase 4 - Legacy retirement
  - [ ] Remove archived imperative code after confidence window.
  - [ ] Update durable docs (`lambda/ephemera/AGENT.md`, client docs, interface notes).
  - [ ] Delete this plan when work is fully merged and durable docs are updated.

## Verification strategy

- Run targeted ephemera lambda tests (`lambda/ephemera`), including map update and dataSource tests.
- Run client tests in `charcoal-client` for active character/map state handling.
- Add focused integration checks for subscribe -> map stream snapshot -> incremental updates -> unsubscribe.
- Validate no runtime dependency remains on `ConnectionId='Map', DataCategory='Subscriptions'`.
