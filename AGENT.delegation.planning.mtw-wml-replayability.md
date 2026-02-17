---
title: mtw.wml Replayability Planning
status: DRAFT
scope: mtw.wml DataSource replayability and WML Dynamo mirror
related:
  - documentation/dataSources/AGENT.delegation.planning.md
  - lambda/wml/AGENT.event.md
  - packages/mtw-lambda-patterns/ts/dataSource/AGENT.md
  - packages/mtw-interfaces/ts/eventBridge/wml/index.ts
---

## Context

The `mtw.wml` DataSource currently:

- Publishes streaming events (Content Update, Merge Conflict, Zone Changed, Snapshot Created size metrics).
- Uses delegated snapshot creation plus sidecar URLs to deliver initial state to clients.
- Sets `replayable: true` so it participates in `InitializeSubscription`, but instead of using a Dynamo mirror it responds with a one-off sidecar snapshot (via `snapshotSidecarUrlGenerator`) and `getRecentEvents` for WML effectively returns `[]` (no stored history).

We have now:

- Standardized **event contracts** around `StandardForm` internally and WML strings on the wire.
- Implemented a **client WML dataSource slice** that:
  - Receives snapshots as WML text (via sidecar).
  - Deserializes WML to `StandardForm`, then to `StandardFormData` for Redux.
- Documented that:
  - **Internal operations** (server and client aggregators) use `StandardForm`.
  - **Wire and mirror** should use **WML strings** plus metadata, not `StandardFormData`.
  - **Redux** continues to use `StandardFormData` as the immutable storage shape.

This document focuses specifically on making `mtw.wml` **replayable** using that model, before we refactor the delegation adapter itself.

## Goals

- **Replayable DataSource**: Treat `mtw.wml` like other replayable data sources:
  - Dynamo-backed snapshots per asset stream.
  - Recent events stored per stream for targeted replay.
  - `initializeSubscription` returns snapshot + events for a specific session/streamKey.
- **WML-first persistence**:
  - Dynamo mirror stores WML text plus essential snapshot metadata (zone, timestamps, etc.). Any size or diagnostic metrics (like chunks-before-snapshot or snapshot size) are optional and used only for monitoring, not replay correctness.
  - Replay path deserializes WML to `StandardForm` before aggregation or further processing.- **Client compatibility**:
  - Subscription init for WML uses the generic client dataSource slice path (snapshot message + events).
  - The WML slice continues to store `StandardFormData` in Redux and uses `StandardForm` for any local computation.
- **Delegation-compatible**:
  - The replay/mirror design does not preclude future WML delegation refactors.
  - Delegation remains a choice of **snapshot source**, not a different replay mechanism.

## Non-Goals (for this phase)

- Changing the **delegated snapshot adapter** behavior (manifest vs materialized view selection logic).
- Redesigning or generalizing the Dynamo schema for all DataSources.
- Modifying the existing client WML slice aggregation semantics or personalAssets flows beyond what replay support requires.

## High-Level Design Sketch

### 1. Snapshot storage model

- **Snapshot body in Dynamo**:
  - Primary content: **WML string** for the asset.
  - Additional metadata fields:
    - AssetId (partition key).
    - Snapshot timestamp / version marker.
    - Optional zone and size metrics as currently surfaced in Snapshot Created events.
  - The mirror does **not** store `StandardFormData`; structured JSON is only needed at the client boundary.

- **Events in Dynamo**:
  - Store the same external event shapes as today (`WMLContentEventExternal`, zone changes, purges).
  - Content events remain WML deltas; zone/purge events are structured JSON.

### 2. Replay and initializeSubscription

- **On initializeSubscription** for `mtw.wml`:
  - Read latest snapshot from Dynamo by streamKey (AssetId).
  - Read events after that snapshot timestamp for the same streamKey.
  - For the snapshot:
    - Internal replay path deserializes from WML → `StandardForm`.
    - Either:
      - Emits a **Snapshot** message with inline WML content to the client, or
      - Emits a Snapshot with a sidecar URL pointing to the WML S3 object, consistent with other sidecar usage.
  - For events:
    - Use the existing WML event serializer to deserialize to `StandardForm`-based events where needed.

- **Client behavior**:
  - WML dataSource slice:
    - Receives snapshot payload with WML text (or sidecar URL resolved to WML).
    - Uses `WMLDataSourceEventSerializer.deserializeSnapshot` to convert WML → `StandardForm` → `StandardFormData`.
    - Stores `StandardFormData` as `materializedView` in Redux and uses `WMLAggregator` for subsequent events.

### 3. Relationship to delegation

- Delegation remains responsible for providing a **current WML snapshot** for an asset:
  - That WML snapshot is written both:
    - To S3 (for sidecar or materialized view).
    - To Dynamo (mirror) as the snapshot body.
- Replay does not change how snapshots are *created*; it changes how they are:
  - **Mirrored** into Dynamo.
  - **Delivered** back to subscribers via initializeSubscription.

## Open Questions / Design Decisions

1. **Dynamo schema details**  
   - Exact table/GSIs for WML snapshots and events (reuse existing DataSource patterns vs new partition/sort key scheme).
   - How much metadata (zone, chunk counts, etc.) lives alongside WML in the snapshot item.

2. **Snapshot wire shape to client**  
   - Should the client see:
     - `{ type: 'Snapshot', payload: { wml: string } }`, or
     - `{ type: 'Snapshot', payload: { sidecarUrl: string } }` where the sidecar content is WML?
   - Current slice already supports sidecar snapshots; we should decide whether initializeSubscription uses inline WML, sidecars, or both (depending on size).

3. **Cut-over strategy**  
   - How to migrate from the existing snapshot-on-subscribe behavior (purely delegated sidecar) to replay-backed initializeSubscription without breaking existing clients.
   - Whether to run replay and legacy sidecar subscription in parallel for a period for validation.

4. **Failure modes**  
   - What happens when:
     - A snapshot exists in S3 but not yet mirrored in Dynamo.
     - Dynamo snapshot is older than S3 snapshot (eventual consistency lag).
   - Policies for re-seeding the mirror from S3 when Dynamo entries are missing or clearly stale.

## Next Steps (before tactical plan)

1. **Confirm desired snapshot wire shape to client** (inline WML vs sidecar vs both).
2. **Decide Dynamo keying strategy for WML** (align with other DataSources where possible).
3. **Outline replay call path for mtw.wml**:
   - Where `snapshotContentGenerator` will live.
   - How it will call into the WML mirror/Dynamo layer.
4. **Identify any tests that must be added or adapted**:
   - Lambda-level: initializeSubscription for mtw.wml.
   - Interface-level: snapshot-related contracts in `mtw-interfaces/ts/eventBridge/wml`.
   - Client-level: WML dataSource slice receiving replay snapshots.

Once these are sketched out and stable, we can switch to Plan mode and derive a concrete, executable task plan from this document.

