---
title: mtw.wml Replayability Planning
status: DRAFT
scope: mtw.wml DataSource replayability and WML Dynamo mirror
related:
  - AGENT.streamingEnvelope.reversability.planning.md (homology restoration; Phase 3 deferred, revisit after completion)
  - documentation/dataSources/AGENT.delegation.planning.md
  - lambda/wml/AGENT.event.md
  - packages/mtw-lambda-patterns/ts/dataSource/AGENT.md
  - packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md (Serialization resolution architecture)
  - packages/mtw-interfaces/ts/eventBridge/wml/index.ts
---

## Recent changes (environment-agnostic serializer)

The client slice passes raw `content` to the serializer; the WML serializer (configured with `createBrowserDataSourceEnvironment()`) performs sidecar resolution internally. There is no separate `resolveSidecarSnapshot` callback. Snapshots must use **domain-shaped payloads**: `{ wml: string }` (inline) or `{ wml: { sidecarUrl: string } }` (per-field sidecar). Full-content `{ sidecarUrl }` is not supported. See `AGENT.implementation.md` (Serialization resolution architecture).

---

## Context

The `mtw.wml` DataSource currently:

- Publishes streaming events (Content Update, Merge Conflict, Zone Changed, Snapshot Created size metrics).
- Uses delegated snapshot creation plus sidecar URLs to deliver initial state to clients.
- Sets `replayable: true` so it participates in `InitializeSubscription`, but instead of using a Dynamo mirror it responds with a one-off sidecar snapshot and `getRecentEvents` for WML effectively returns `[]` (no stored history). Snapshot delivery uses domain-shaped payloads (e.g. `{ wml: { sidecarUrl } }`). The legacy `snapshotSidecarUrlGenerator` is unwired; we will use `snapshotContentGenerator` directly (S3Storage snapshot creation when needed, always fresh presigned URL).

We have now:

- Standardized **event contracts** around `StandardForm` internally and WML strings on the wire.
- Implemented a **client WML dataSource slice** that:
  - Passes raw `content` and `header` to `WMLDataSourceEventSerializer.deserialize({ content, header })`; the serializer routes on `header.type` and for snapshots resolves sidecars and deserializes WML to `StandardForm`, then to `StandardFormData` for Redux.
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
  - Existing `Snapshot Created` events (with `chunksBeforeSnapshot` and `snapshotSize` from the S3 snapshot writer) are treated as diagnostic signals only; they are not part of the replay or correctness path.

## Non-Goals (for this phase)

- Changing the **delegated snapshot adapter** behavior (manifest vs materialized view selection logic).
- Redesigning or generalizing the Dynamo schema for all DataSources.
- Modifying the existing client WML slice aggregation semantics or personalAssets flows beyond what replay support requires.

## High-Level Design Sketch

### 1. Snapshot storage model

- **Snapshot body in Dynamo**:
  - Primary content: **WML** for the asset — semantically a string, but in practice we are far more likely to store `{ sidecarUrl: string }` claim-checks into the S3 Storage system's `snapshots` storage than inline WML text.
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
    - Emits a **Snapshot** message with a **domain-shaped** payload: either `{ wml: string }` (inline) or `{ wml: { sidecarUrl: string } }` (per-field sidecar). Full-content `{ sidecarUrl }` is not supported on the client.
  - For events:
    - Use the existing WML event serializer to deserialize to `StandardForm`-based events where needed.

- **Client behavior**:
  - WML dataSource slice:
    - Passes raw `content` and `header` to `deserialize({ content, header })`. The serializer routes on `header.type` and for snapshots resolves any sidecar descriptor and converts WML → `StandardForm` → `StandardFormData`.
    - Stores `StandardFormData` as `materializedView` in Redux and uses `WMLAggregator` for subsequent events.

### 3. Relationship to delegation

- **Delegation = different implementation of `snapshotContentGenerator`.** No separate architectural pattern is needed. The base DataSource already uses `snapshotContentGenerator` as the single plug point; self-contained sources read from Dynamo, delegated sources (WML) use S3Storage to create snapshots when needed and always return domain-shaped payloads with a freshly presigned sidecar URL. See `documentation/dataSources/AGENT.delegation.planning.md`.
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
   - Use **domain-shaped** payloads: `{ wml: string }` (inline) or `{ wml: { sidecarUrl: string } }` (per-field sidecar). Full-content `{ sidecarUrl }` is not supported. The slice passes raw `content` to the serializer, which resolves sidecars internally.

3. **Cut-over strategy**  
   - How to migrate from the existing snapshot-on-subscribe behavior (purely delegated sidecar) to replay-backed initializeSubscription without breaking existing clients.
   - Whether to run replay and legacy sidecar subscription in parallel for a period for validation.

4. **Failure modes**  
   - What happens when:
     - A snapshot exists in S3 but not yet mirrored in Dynamo.
     - Dynamo snapshot is older than S3 snapshot (eventual consistency lag).
   - Policies for re-seeding the mirror from S3 when Dynamo entries are missing or clearly stale.

## Next Steps (before tactical plan)

1. **Confirm desired snapshot wire shape to client** (inline WML vs domain-shaped sidecar; both supported as `{ wml: string }` or `{ wml: { sidecarUrl } }`).
2. **Decide Dynamo keying strategy for WML** (align with other DataSources where possible).
3. **Outline replay call path for mtw.wml**:
   - `snapshotContentGenerator` is the existing DataSource hook; no new framework wiring needed. For WML: when Dynamo mirror exists, `getSnapshotExternal` loads from Dynamo first; when no snapshot in Dynamo for that stream, `generateSnapshot` calls `snapshotContentGenerator`. WML's `snapshotContentGenerator` uses S3Storage to create a new snapshot in `snapshots/` when unsnapshotted events post-date the latest snapshot, then always generates a fresh presigned URL and returns domain-shaped `{ wml: { sidecarUrl } }`.
4. **Identify any tests that must be added or adapted**:
   - Lambda-level: initializeSubscription for mtw.wml.
   - Interface-level: snapshot-related contracts in `mtw-interfaces/ts/eventBridge/wml`.
   - Client-level: WML dataSource slice receiving replay snapshots.

Once these are sketched out and stable, we can switch to Plan mode and derive a concrete, executable task plan from this document.

## Implementation Steps

These steps reflect the current state: event storage already works; the main gap is snapshot wiring.

### Step 1: Wire snapshotContentGenerator (required)

**Status**: Not started.

**Problem**: WML passes `snapshotSidecarUrlGenerator` but the base DataSource expects `snapshotContentGenerator`. The WML abstract does not map one to the other, so `snapshotContentGenerator` is undefined. `generateSnapshot` then returns minimal content (streamKey, timestamp, etc.) and the delivered snapshot is useless.

**Fix**: Dispense with the legacy `snapshotSidecarUrlGenerator` and wire `snapshotContentGenerator` directly in `lambda/wml/dataSource/mtw-wml.ts`. Remove `snapshotSidecarUrlGenerator` from the WML abstract.

**snapshotContentGenerator logic**:

1. **Use S3Storage snapshot capability when needed**: If the manifest has unsnapshotted events that post-date the most recent snapshot, use S3Storage to consistently create a new S3 object in the `snapshots/` section of WML storage.
2. **Always generate a fresh presigned URL**: Whether or not we created a new snapshot, generate a new presigned URL (30-minute expiry) so the presigning time-span is refreshed even when pointing to the same S3 object. The 5-minute snapshot lifecycle ensures the URL remains valid for the duration the DataSource expects (see Step 3).
3. **Return domain-shaped payload**: Return `{ wml: { sidecarUrl } }` for the DataSource/serializer pipeline.

This replaces the current `getSidecarSnapshotDescriptor`-based flow with a flow that (a) ensures S3 has an up-to-date snapshot when edits have occurred since the last snapshot, and (b) always delivers a freshly presigned URL for client fetch.

**Verification**: initializeSubscription delivers a Snapshot with domain-shaped `{ wml: { sidecarUrl } }`; client can fetch and apply.

### Step 2: Event storage (already working)

**Status**: Done.

**Current state**: With `replayable: true`, `streamEvent` already stores events to Dynamo. Content Update, Zone Changed, etc. from `processApplyEdit`, `processMoveAsset`, etc. are persisted. `getRecentEvents` queries Dynamo and returns them.

**Action**: None. No changes needed.

### Step 3: Snapshot mirroring to Dynamo (design + implementation)

**Status**: Design decided; implementation pending.

**Current state**: Once `snapshotContentGenerator` is wired (Step 1), `generateSnapshot` returns domain-shaped payloads. The base DataSource flow will serialize and store via `storeSnapshotToStore` when generating. `loadSnapshotFromStore` will load on replay.

**Design decision (resolved)**: Snapshots have a 5-minute cache lifecycle (`expiresAt: now + 300000`). Use a 30-minute presigned URL expiry. The 5-minute lifecycle ensures any snapshot we deliver is at most 5 minutes old; the URL in that snapshot will have at least ~25 minutes remaining. Clients fetch within seconds of receiving the init snapshot. **Store `{ wml: { sidecarUrl } }` directly in Dynamo** — no S3 key resolution at replay time needed. The natural lifecycle handles validity.

**Action**: Use 30-minute presigned URL when generating sidecar URLs. Store the domain-shaped payload (including sidecarUrl) via the base DataSource flow; no WML-specific storage/load logic required.

### Step 4: streamEnvelope for sidecar preservation (Phase 3, deferred)

**Status**: Deferred.

**Current state**: All WML handlers use `streamEvent` with derived content; no events carry field-level sidecars. When Content Update or other events gain sidecarred payloads, those flows should use `streamEnvelope(event)` instead of `streamEvent(params)` to preserve sidecars.

**Action**: Revisit when events have sidecarred content. See [AGENT.streamingEnvelope.reversability.planning.md](AGENT.streamingEnvelope.reversability.planning.md) Phase 3.

### Summary

| Step | Description | Status |
|------|-------------|--------|
| 1 | Wire snapshotContentGenerator | Required |
| 2 | Event storage | Done |
| 3 | Snapshot mirroring to Dynamo | Design decided; implementation pending |
| 4 | streamEnvelope for sidecar preservation | Deferred |

---

## Getting Started

1. **Read the DataSource pattern**
   - **[packages/mtw-lambda-patterns/ts/dataSource/AGENT.md](packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)** — Replayable vs non-replayable, snapshot generation, event storage.
   - **[packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md](packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md)** — `snapshotContentGenerator`, `getSnapshotExternal`, `loadSnapshotFromStore`, `storeSnapshotToStore`, `initializeSubscription`, serialization boundary.
   - **Why**: This work wires WML into the DataSource replay flow; understanding the hook points and storage lifecycle is essential.

2. **Read this document**
   - Context → Goals → Implementation Steps (especially Step 1).
   - **Key insight**: WML currently passes `snapshotSidecarUrlGenerator` (unwired). We replace it with `snapshotContentGenerator` that (a) creates an S3 snapshot when manifest has unsnapshotted events, (b) always generates a fresh 30-minute presigned URL, (c) returns domain-shaped `{ wml: { sidecarUrl } }`.

3. **Review key files**
   - [lambda/wml/dataSource/mtw-wml.ts](lambda/wml/dataSource/mtw-wml.ts) — WML DataSource config; `snapshotSidecarUrlGenerator` call site to replace.
   - [lambda/wml/dataSource/abstract.ts](lambda/wml/dataSource/abstract.ts) — WML abstract; remove `snapshotSidecarUrlGenerator` param.
   - [lambda/wml/s3Storage/sidecarSnapshot.ts](lambda/wml/s3Storage/sidecarSnapshot.ts) — Current `getSidecarSnapshotDescriptor`; manifest/snapshot logic to extend or replace.
   - [lambda/wml/s3Storage/manifest/orchestration.ts](lambda/wml/s3Storage/manifest/orchestration.ts), [lambda/wml/s3Storage/snapshots/index.ts](lambda/wml/s3Storage/snapshots/index.ts) — S3Storage snapshot creation when unsnapshotted events exist.
   - [packages/mtw-lambda-patterns/ts/dataSource/index.ts](packages/mtw-lambda-patterns/ts/dataSource/index.ts) — `generateSnapshot`, `getSnapshotExternal` flow.

4. **Run tests before starting**
   - `cd packages/mtw-lambda-patterns && npm run test -- --testPathPattern=dataSource --watchAll=false`
   - `cd lambda/wml && npm run test -- --watchAll=false`
   - Establish baseline before changing the WML DataSource wiring.

---

## Post-completion

After mtw.wml replayability is complete:

- **Revisit [AGENT.streamingEnvelope.reversability.planning.md](AGENT.streamingEnvelope.reversability.planning.md)**: Mark Phase 3 complete, verify all storage paths use `streamEnvelope` where needed for sidecar preservation, and likely remove or archive that planning doc once the work is fully absorbed.

