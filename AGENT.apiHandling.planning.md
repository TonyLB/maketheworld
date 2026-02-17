# Lambda API Handling and Internal Events - Planning

**Date**: February 2025  
**Status**: Draft planning – refine assumptions and path  
**Related**: [AGENT.development.md](./AGENT.development.md) (Coordination events section), [packages/mtw-lambda-patterns/ts/dataSource/AGENT.md](./packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)

## Overview

This document plans how we standardize lambda API handling so that coordination-style commands (Apply Edit, Move Asset, Purge Asset, Canonize/Decanonize, Create Snapshot) are handled via a single, consistent pattern. Remove Asset is treated separately: prune as legacy (asset removal flows through WML authority). API request → internal streaming event → existing DataSource `receiveEvents` pipeline. The goal is a clear middle ground between full EventBridge serializer contracts and ad-hoc per-lambda handling.

**Scope**: WML, Assets, and Ephemera lambdas; `mtw-interfaces` coordination types; DataSource subscription and send-helper patterns.

## Current State Assessment

### What exists

- **EventBridge removal**: `mtw.coordination` rules are removed from template.yaml. No lambda registers `CoordinationEventSerializer` as an EventBridge deserializer. Assets no longer subscribes to Remove Asset; WML no longer receives coordination from EventBridge.
- **WML internal pattern**: For Apply Edit, Move Asset, and Purge Asset, WML already does: API handler in `app.ts` → `sendApplyEdit` / `sendMoveAsset` / `sendPurgeAsset` in `subscribedEvents.ts` → messageBus → `receiveEvents` in `mtw-wml.ts`. Payload types come from `lambda/wml/dataSource/localApiEvents.ts`; envelope and routing are defined in WML `subscribedEvents.ts`.
- **Assets**: Subscribes to mtw.wml (Zone Changed, Content Update, Asset Purged) and mtw.diagnostics. `handleAssetPurged` does decache + emit Asset Removed. `handleRemoveAsset` exists but is legacy (no trigger); to be pruned.
- **mtw-interfaces coordination**: Removed. Internal types (e.g. `ApplyEditRequest`, `MoveAssetRequest`), type guards, and payload types now live in `lambda/wml/dataSource/localApiEvents.ts`.

### Gaps

- **Canonize, Decanonize, Create Snapshot**: Handlers exist in WML `mtw-wml.ts` (`processCanonizeDecanonize`, `processCreateSnapshot`), but there are no send-helpers and no API handlers. They were previously triggered via EventBridge; that path is gone. (See "Canonize / Decanonize: Temporarily Dead" and "Create Snapshot: Temporarily Dead" below.)
- **Remove Asset**: Legacy handler in Assets (`handleRemoveAsset`) with no trigger. The authoritative removal flow already exists: WML purge → Asset Purged → Assets `handleAssetPurged`. (See "Remove Asset: Legacy (Prune)" below.)
- **Contract mismatch**: Coordination is still modeled in mtw-interfaces as an EventBridge contract (serializer, external types), while all coordination traffic is in-process via the `internal` pattern.

### Canonize / Decanonize: Temporarily Dead (Reserved for Future Use)

Canonize and Decanonize are **intentionally retained** but currently have no call path. They were triggered via the `mtw.coordination` EventBridge development tool, which has been removed. The UI calling path (e.g. Library UI "Adopt to Canon" / "Return to Library") will be built as part of the collaboration and publishing work in [AGENT.collaboration.publishing.md](./AGENT.collaboration.publishing.md). That work is likely some time away, but these handlers will be needed again when the publishing flow is fully wired. **Do not remove them**; treat them as reserved for reactivation. When the time comes, add API handlers in WML `app.ts` and send-helpers in WML `subscribedEvents.ts`, reusing the existing `processCanonizeDecanonize` logic.

### Create Snapshot: Temporarily Dead (Reserved for Delegation Pattern)

Create Snapshot is **intentionally retained** but currently has no call path. It will be needed when the mtw.wml DataSource delegates snapshot creation to the manifest-and-chunk storage system, as planned in [documentation/dataSources/AGENT.delegation.planning.md](./documentation/dataSources/AGENT.delegation.planning.md). The current implementation is a reference for the functionality required; it will probably be refactored and may not continue to exist in its present form when the delegation pattern is implemented. **Do not remove it**; keep it as a reference for the functionality we will need then.

### Remove Asset: Legacy (Prune)

Remove Asset is **legacy** from the previous architecture in which a coordination layer could imperatively tell Assets to decache an asset without going through WML. Asset removal is a WML concern: WML owns the purge (and zone transitions such as moving to Archive). The authoritative flow is **WML purgeAsset → Asset Purged (mtw.wml) → Assets handleAssetPurged** (decache + emit Asset Removed). One possible historical reason for Remove Asset was to support "remove from cache but don't purge" when an asset moved to Archive (so it no longer consumes Asset resources but could be rehydrated). Even that case should flow through WML authority and mtw.wml events—for example, WML could emit an appropriate event when an asset moves to Archive. **Prune the imperative Remove Asset path**: remove `handleRemoveAsset` and do not add any capacity for Assets to imperatively remove an asset. Assets reacts to WML events only.

## Principles (to refine)

1. **Internal events are in-process only.** Events with `dataSourceKey: 'internal'` never cross process boundaries. No serialization; envelope and routing are local to the lambda that owns the API.
2. **localApiEvents.ts pattern.** Payload types for API-triggered internal events live in the owning lambda, in a `localApiEvents.ts` file per DataSource directory. Envelope union, `dataSourceKey`, header guards, and send-helpers live in `subscribedEvents.ts`. mtw-interfaces holds only cross-lambda EventBridge contracts.
3. **One pipeline.** Coordination-style API calls are mapped into internal streaming events so the same DataSource subscription and `receiveEvents` pipeline handles them, reusing type guards and handlers.
4. **Per-lambda ownership.** Each lambda owns its API surface and how it maps API calls into internal events; no shared EventBridge coordination channel.

## localApiEvents.ts: Standard Pattern

**Standardize on `localApiEvents.ts`** for payload types and type guards for API-triggered events (dataSourceKey: `'internal'`). This naming avoids confusion with "internal" meaning same-lambda streaming events from other data sources (e.g. mtw.assets events consumed by Library, ContentHeaders within Assets) - those have distinct dataSourceKeys and their types stay in mtw-interfaces.

### Naming and location

- **File name**: `localApiEvents.ts`
- **Location**: Same directory as `subscribedEvents.ts` for that DataSource (e.g. `lambda/wml/dataSource/localApiEvents.ts`, `lambda/assets/players/localApiEvents.ts`)
- **When to add**: Only when a DataSource has API-triggered internal events. Ephemera has none today; add when needed.

### Contents

- Payload types for events with `dataSourceKey: 'internal'` (e.g. `ApplyEditRequest`, `MoveAssetRequest`, `PlayerSettingsUpdatedEvent`)
- Type guards (e.g. `isApplyEditRequest`, `isPlayerSettingsUpdatedEvent`)
- No serializers; no EventBridge logic. `subscribedEvents.ts` imports from `./localApiEvents` and uses these types for the subscription union and send-helpers.

### Migration

| Lambda | Action |
|--------|--------|
| **WML** | Create `lambda/wml/dataSource/localApiEvents.ts`; move payload types from `mtw-interfaces/eventBridge/coordination`; update imports in subscribedEvents, mtw-wml, moveAsset. |
| **Assets Players** | Rename `lambda/assets/players/coordinationSerializer.ts` to `localApiEvents.ts`; update imports. |
| **Ephemera** | No change. Add `lambda/ephemera/dataSource/localApiEvents.ts` when internal events are introduced. |

## Proposed Direction

### 1. Treat internal events as first-class, not EventBridge

- **Move to lambda**: API-triggered internal payload types move from mtw-interfaces to `localApiEvents.ts` in each owning lambda (see localApiEvents.ts pattern above).
- **Remove or deprecate**: `CoordinationEventSerializer` and coordination `*External` types in mtw-interfaces, since no EventBridge path uses them.
- **Document**: In DataSource and EventBridge AGENT docs, that `dataSourceKey: 'internal'` events are in-process only and do not use serializers.

### 2. Standardize API → internal flow

For each coordination-style command that a lambda can receive via API:

1. API handler (in that lambda's `app.ts`) receives the request.
2. Send-helper (in that lambda's `subscribedEvents.ts`) builds envelope (`dataSourceKey: 'internal'`, header, `getContentInternal`) and calls `messageBus.send()`.
3. Existing `receiveEvents` handles the event via type guards and handlers.

No new machinery; document this as the standard pattern.

### 3. Remove Asset

- **Direction**: Prune. Remove Asset is legacy; do not wire it up. Asset removal flows through WML authority: purgeAsset → Asset Purged → Assets handleAssetPurged. Remove `handleRemoveAsset` from Assets DataSource. (See "Remove Asset: Legacy (Prune)" above.)

### 4. Canonize / Decanonize / Create Snapshot

- **Canonize / Decanonize**: Keep handlers and subscription; document as reserved (see "Canonize / Decanonize: Temporarily Dead" above). Reactivate when the publishing UI is built (AGENT.collaboration.publishing): add API handlers and send-helpers.
- **Create Snapshot**: Keep handler and subscription; document as reserved (see "Create Snapshot: Temporarily Dead" above). Will be refactored when the delegation pattern (AGENT.delegation.planning) is implemented; current implementation is a reference for the functionality needed.

### 5. mtw-interfaces coordination package

- **Remove or deprecate**: Entire coordination package after WML migration. `CoordinationEventSerializer`, `*External` types, and internal types move to WML `localApiEvents.ts`.
- **Clarify**: mtw-interfaces holds only cross-lambda EventBridge contracts and shared domain primitives.

## Work Items (draft – reorder and split as needed)

- [x] **localApiEvents migration**: Create WML `localApiEvents.ts`, move types from mtw-interfaces; rename Assets Players `coordinationSerializer.ts` to `localApiEvents.ts`; update all imports.
- [ ] **Documentation**: Add "localApiEvents.ts" and API-triggered internal events subsection to DataSource AGENT.implementation.md.
- [ ] **Documentation**: Update mtw-interfaces EventBridge AGENT.implementation.md; remove or deprecate coordination package.
- [ ] **Remove Asset**: Prune `handleRemoveAsset` from Assets DataSource; no imperative Remove Asset at Assets-domain level.
- [ ] **Canonize / Decanonize / Create Snapshot**: All documented as reserved (do not remove). Reactivate/refactor when respective planning docs proceed.
- [ ] **AGENT.development.md**: Point coordination section to this planning doc; update status when work is done.

## Open Questions / Refinement

- **Ephemera**: Docs mentioned Canonize/Decanonize from EventBridge. Confirm whether Ephemera still needs to react to canonize/decanonize in some form (e.g. via mtw.wml Zone Changed or mtw.assets) or if that's obsolete.
- **Naming**: Is `dataSourceKey: 'internal'` the long-term name, or do we want a per-lambda convention (e.g. `internal.wml`, `internal.assets`)? Currently WML and Assets players use `'internal'`.
- **Testing**: How much of the coordination flow should be covered by integration-style tests (API → messageBus → receiveEvents) vs unit tests only.

## Cross-References

- **[AGENT.development.md](./AGENT.development.md)** – Coordination events subsection (status, done so far, remaining).
- **[AGENT.collaboration.publishing.md](./AGENT.collaboration.publishing.md)** – Future publishing UI; Canonize/Decanonize will be reactivated when this work proceeds.
- **[documentation/dataSources/AGENT.delegation.planning.md](./documentation/dataSources/AGENT.delegation.planning.md)** – Delegation pattern; Create Snapshot functionality will be refactored when mtw.wml delegates snapshot creation to manifest-and-chunk storage.
- **[packages/mtw-lambda-patterns/ts/dataSource/AGENT.md](./packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)** – DataSource usage; Getting Started and SubscribedEvents pattern.
- **[packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md](./packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md)** – Header/content envelope, type-safe routing, send-helpers.
- **[packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md](./packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md)** – EventBridge contracts and serializers.
- **Reference implementations**: `lambda/wml/dataSource/subscribedEvents.ts` (internal send-helpers), `lambda/assets/players/subscribedEvents.ts` (internal Player Settings Updated). `lambda/assets/players/coordinationSerializer.ts` renamed to `localApiEvents.ts`.
