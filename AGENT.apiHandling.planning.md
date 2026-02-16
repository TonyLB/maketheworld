# Lambda API Handling and Internal Events - Planning

**Date**: February 2025  
**Status**: Draft planning – refine assumptions and path  
**Related**: [AGENT.development.md](./AGENT.development.md) (Coordination events section), [packages/mtw-lambda-patterns/ts/dataSource/AGENT.md](./packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)

## Overview

This document plans how we standardize lambda API handling so that coordination-style commands (Apply Edit, Move Asset, Purge Asset, Canonize/Decanonize, Create Snapshot, Remove Asset) are handled via a single, consistent pattern: API request → internal streaming event → existing DataSource `receiveEvents` pipeline. The goal is a clear middle ground between full EventBridge serializer contracts and ad-hoc per-lambda handling.

**Scope**: WML, Assets, and Ephemera lambdas; `mtw-interfaces` coordination types; DataSource subscription and send-helper patterns.

## Current State Assessment

### What exists

- **EventBridge removal**: `mtw.coordination` rules are removed from template.yaml. No lambda registers `CoordinationEventSerializer` as an EventBridge deserializer. Assets no longer subscribes to Remove Asset; WML no longer receives coordination from EventBridge.
- **WML internal pattern**: For Apply Edit, Move Asset, and Purge Asset, WML already does: API handler in `app.ts` → `sendApplyEdit` / `sendMoveAsset` / `sendPurgeAsset` in `subscribedEvents.ts` → messageBus → `receiveEvents` in `mtw-wml.ts`. Payload types come from `@tonylb/mtw-interfaces/ts/eventBridge/coordination`; envelope and routing are defined in WML `subscribedEvents.ts`.
- **Assets**: Subscribes to mtw.wml (Zone Changed, Content Update, Asset Purged) and mtw.diagnostics. `handleRemoveAsset` and `decacheAsset` exist but nothing currently triggers Remove Asset.
- **mtw-interfaces coordination**: Defines internal types (e.g. `ApplyEditRequest`, `MoveAssetRequest`), external types, type guards, and `CoordinationEventSerializer`. The serializer and external types are unused; internal types and guards are still imported by WML.

### Gaps

- **Canonize, Decanonize, Create Snapshot**: Handlers exist in WML `mtw-wml.ts` (`processCanonizeDecanonize`, `processCreateSnapshot`), but there are no send-helpers and no API handlers. They were previously triggered via EventBridge; that path is gone.
- **Remove Asset**: No active trigger. Assets is the natural owner (decache is assets-domain); it could subscribe to `internal` Remove Asset and expose an API or other trigger that sends that event.
- **Contract mismatch**: Coordination is still modeled in mtw-interfaces as an EventBridge contract (serializer, external types), while all coordination traffic is in-process via the `internal` pattern.

## Principles (to refine)

1. **Internal events are in-process only.** Events with `dataSourceKey: 'internal'` never cross process boundaries. No serialization; envelope and routing are local to the lambda that owns the API.
2. **Shared payload types, local envelope.** Payload types (e.g. `ApplyEditRequest`) stay in mtw-interfaces as shared domain contracts. Envelope union, `dataSourceKey`, header guards, and send-helpers live in each lambda’s `subscribedEvents.ts`.
3. **One pipeline.** Coordination-style API calls are mapped into internal streaming events so the same DataSource subscription and `receiveEvents` pipeline handles them, reusing type guards and handlers.
4. **Per-lambda ownership.** Each lambda owns its API surface and how it maps API calls into internal events; no shared EventBridge coordination channel.

## Proposed Direction

### 1. Treat internal events as first-class, not EventBridge

- **Keep in mtw-interfaces**: Internal payload types and type guards for coordination (and Remove Asset if needed). Document that these are for internal messageBus use only.
- **Remove or deprecate**: `CoordinationEventSerializer` and coordination `*External` types, since no EventBridge path uses them.
- **Document**: In DataSource and EventBridge AGENT docs, that `dataSourceKey: 'internal'` events are in-process only and do not use serializers.

### 2. Standardize API → internal flow

For each coordination-style command that a lambda can receive via API:

1. API handler (in that lambda’s `app.ts`) receives the request.
2. Send-helper (in that lambda’s `subscribedEvents.ts`) builds envelope (`dataSourceKey: 'internal'`, header, `getContentInternal`) and calls `messageBus.send()`.
3. Existing `receiveEvents` handles the event via type guards and handlers.

No new machinery; document this as the standard pattern.

### 3. Remove Asset

- **Owner**: Assets (decache and Asset Removed emission are assets-domain).
- **Mechanism**: Assets subscribes to `internal` Remove Asset. Add `sendRemoveAsset` in assets `subscribedEvents.ts` and an API (or other) trigger in assets that calls it. Wire `handleRemoveAsset` into the subscription so it is invoked when that event is received.

### 4. Canonize / Decanonize / Create Snapshot

- **If API-triggered**: Add API handlers in WML `app.ts` and send-helpers (`sendCanonize`, `sendDecanonize`, `sendCreateSnapshot`) in WML `subscribedEvents.ts`. Handlers already exist in `mtw-wml.ts`.
- **If not needed yet**: Either remove from subscribed union and handlers to avoid dead code, or document as reserved for future API and leave in place.

### 5. mtw-interfaces coordination package

- **Keep**: Internal types, type guards, `CoordinationEventUpdate` (and add Remove Asset payload type if Assets owns it).
- **Remove or deprecate**: `CoordinationEventSerializer`, `*External` types.
- **Clarify**: Package comment that coordination types are for internal messageBus events; no EventBridge serialization.

## Work Items (draft – reorder and split as needed)

- [ ] **Documentation**: Add a short "Internal events" subsection to DataSource AGENT.implementation.md (in-process only, send-helpers, no serializer).
- [ ] **Documentation**: Update mtw-interfaces EventBridge AGENT.implementation.md to state coordination is internal-only; no serializer.
- [ ] **Remove Asset**: Add Remove Asset to assets subscribed union (`internal`); add `sendRemoveAsset` and trigger (e.g. API); connect `handleRemoveAsset` to subscription.
- [ ] **Canonize / Decanonize / Create Snapshot**: Decide: wire up (API + send-helpers) or prune (remove from union/handlers or document as reserved).
- [ ] **mtw-interfaces**: Remove or deprecate `CoordinationEventSerializer` and coordination external types; add/keep Remove Asset payload type if needed.
- [ ] **AGENT.development.md**: Point coordination section to this planning doc; update status when work is done.

## Open Questions / Refinement

- **Canonize / Decanonize / Create Snapshot**: Who triggers them today (if anyone)? UI, Step Functions, or future-only? Drives wire-up vs prune.
- **Remove Asset trigger**: API on Assets only, or also callable from WML (e.g. after purge)? Affects where `sendRemoveAsset` is called from.
- **Ephemera**: Docs mentioned Canonize/Decanonize from EventBridge. Confirm whether Ephemera still needs to react to canonize/decanonize in some form (e.g. via mtw.wml Zone Changed or mtw.assets) or if that’s obsolete.
- **Naming**: Is `dataSourceKey: 'internal'` the long-term name, or do we want a per-lambda convention (e.g. `internal.wml`, `internal.assets`)? Currently WML and Assets players use `'internal'`.
- **Testing**: How much of the coordination flow should be covered by integration-style tests (API → messageBus → receiveEvents) vs unit tests only.

## Cross-References

- **[AGENT.development.md](./AGENT.development.md)** – Coordination events subsection (status, done so far, remaining).
- **[packages/mtw-lambda-patterns/ts/dataSource/AGENT.md](./packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)** – DataSource usage; Getting Started and SubscribedEvents pattern.
- **[packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md](./packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md)** – Header/content envelope, type-safe routing, send-helpers.
- **[packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md](./packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md)** – EventBridge contracts and serializers.
- **Reference implementations**: `lambda/wml/dataSource/subscribedEvents.ts` (internal send-helpers), `lambda/assets/players/subscribedEvents.ts` (internal Player Settings Updated).
