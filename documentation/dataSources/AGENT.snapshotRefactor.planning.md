# DataSource Snapshot Lazy-Evaluation Refactor

**Status**: PLANNING  
**Scope**: Generic DataSource framework (mtw-lambda-patterns) and all replayable snapshot producers/consumers (initializeSubscription, replay store, client DataSource slices).  
**Related**: `packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`, `packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`, `packages/mtw-lambda-patterns/ts/dataSource/{baseClasses.ts,index.ts,formatTransform.ts}`, `documentation/dataSources/AGENT.delegation.planning.md`, `lambda/*/dataSource/*`, client DataSource slices.

---

## Motivation: bring snapshots up to the streaming envelope model

We have completed the header + lazy-content envelope refactor for **streaming events**:

- Internal events use `StreamingEventEnvelope<Content, Header>` with `header` plus `getContentInternal()`.
- External/core representation is `CoreExternalFormat = { header, update }`.
- Resolved internal representation is `ResolvedStreamingEnvelope<Content, Header> = { header, content }`.
- Aggregators, serializers, and subscribers operate on these consistent shapes, with **header authoritative for routing** and payloads focused on domain data.
- **Payload type migration (complete):** We have removed the legacy pattern of embedding `type` in event content. Producers no longer emit it; consumers no longer require it. Wire formats (WebSocket, SNS Feedback, DynamoDB) carry top-level `eventType`; discrimination is exclusively envelope-based (`header.type`, `eventType`). This simplifies remaining work: no content-type guards or payload-type routing to reconcile.

**Snapshots are still on the old model.** They are materialized blobs pushed through special-purpose paths (Dynamo snapshot rows, initializeSubscription wiring, client reducers) that do not use the same lazy envelope semantics or header-level routing. This limits:

- Our ability to sidecar large snapshot bodies cleanly.
- Reuse of `getContentInternal()` for snapshot bodies vs event payloads.
- Uniform aggregation and replay logic for "snapshot plus deltas" flows.
- Type-safe evolution of snapshot payloads (internal vs external) alongside events.

The goal of this refactor is to bring **snapshots into the same envelope family** as streaming events, with lazy evaluation, header-authoritative routing, and consistent external formats across Dynamo, SNS Feedback, and WebSocket.

---

## Current state (high level)

This section intentionally stays high-level; use code search for exact call-sites.

- Snapshots are stored in Dynamo under `Meta::Snapshot`, with the body encoded directly as a payload (shapes differ by DataSource; some are JSON, some WML, some intermediate forms).
- `initializeSubscription`:
  - Fetches latest snapshot row for `STREAM#${dataSourceKey}::${streamKey}`.
  - Fetches recent events after that snapshot.
  - Delivers a bespoke replay package via SNS Feedback, not expressed as a unified envelope sequence.
- Client DataSource slices:
  - Know how to apply a snapshot and then a stream of events, but snapshots are a special case in reducers.
  - Synthetic snapshots (30 second cleanup) already use `ResolvedStreamingEnvelope` with a placeholder header.
- Aggregators:
  - Treat the internal snapshot format as the **materialized state** type.
  - Already understand `ResolvedStreamingEnvelope` for applying events to snapshots.
  - Have ad hoc understanding of how initial snapshot vs subsequent events differ.

We have **three regimes** for events (core external, lazy internal, resolved internal) but snapshots only participate cleanly in the **resolved** regime, and often without alignment to the header types we use for events.

---

## Target model: snapshots as first-class envelopes

We want snapshots to participate in the same three-regime architecture as events.

### 1. Header semantics

- Snapshots use the same `StreamingEventHeader` family, including:
  - `dataSourceKey`, `streamKey`, `timestamp`, `type`.
  - Optional extended header fields (e.g. `zone`, `RequestIds`, domain flags).
- Snapshots use a **single shared** `type: 'Snapshot'` in the header across all DataSources. Domain is identified by `dataSourceKey` (and `streamKey`), same as for events; no per-domain snapshot type variants.
- Routing and type guards **never depend on snapshot body fields**; they branch exclusively on `header`.

### 2. Content and regimes

- **External/core (`CoreExternalFormat`)**:
  - Snapshots use the same `{ header, update }` shape as events.
  - `update` is the external payload (string or serializable object). For events, `update` does not include a `type` field; discrimination uses `header.type` (and wire formats expose `eventType`). Snapshots use `header.type === 'Snapshot'`; their `update` is domain-shaped (e.g. JSON, WML, sidecar descriptor).
  - Context transforms (`toDynamoDBFormat`, `toSNSFeedbackFormat`, `toWebSocketFormat`) treat snapshots and events uniformly.
- **Lazy internal (`StreamingEventEnvelope`)**:
  - Snapshot messages on the messageBus have `{ header, getContentInternal }` where `getContentInternal`:
    - For inline snapshots: returns the already-deserialized internal snapshot type.
    - For sidecarred snapshots: fetches body from S3 (or other transport), parses, validates, and deserializes on demand.
  - Initialize flows that need to hand a snapshot to aggregators or other code can do so via a resolved envelope derived from the lazy one.
- **Resolved internal (`ResolvedStreamingEnvelope`)**:
  - Aggregators always see `{ header, content }` envelopes, regardless of whether the underlying snapshot was inline or sidecarred.
  - First snapshot in a replay sequence is just another envelope in the list, not a special case type.

### 3. Storage and replay

- **Dynamo snapshot rows**:
  - Store a CoreExternalFormat snapshot (header + external update payload).
  - Use the same extended header rules (base four inlined, extendedHeader sidecar) as events.
  - `Meta::Snapshot` rows no longer encode special-case structures; they are just "snapshot envelopes."
- **Replay delivery** (`initializeSubscription`):
  - Fetches one CoreExternalFormat snapshot (if any) plus CoreExternalFormat events after that snapshot.
  - Transforms both snapshots and events with the same `toSNSFeedbackFormat` pipeline.
  - Clients (and internal replay consumers) can treat the replay sequence as "one snapshot envelope, then N event envelopes."

---

## Design goals and non-goals

**Goals**

- Unify snapshot and event handling in the DataSource framework:
  - Same header semantics and type unions.
  - Same CoreExternalFormat and formatTransform pipelines.
  - Same lazy `getContentInternal` pattern for fetching and deserializing bodies (including sidecars).
- Make initialize and replay flows expressible as:
  - `ResolvedStreamingEnvelope<SnapshotPayload, Header>` for the base snapshot.
  - `ResolvedStreamingEnvelope<UpdatePayload, Header>[]` for subsequent events.
- Allow domain implementations (WML, assets, ephemera) to:
  - Delegate snapshot creation when desired (see delegation planning doc).
  - Decide snapshot body wire format (JSON, WML, sidecar descriptor) while the framework handles envelopes and transport.
- Make client DataSource slices and aggregators:
  - Header-driven and envelope-oriented.
  - Free of snapshot special-casing beyond "first envelope is the base snapshot."

**Non-goals (for this refactor)**

- Redesigning domain-specific snapshot content schemas.
- Changing which lambdas are replayable vs non-replayable.
- Implementing the claim-check pattern end to end (we should design around it, but not block on it).

---

## Workstreams

This section outlines the broad strokes of the refactor; exact task breakdown will live in issues and local AGENT docs as we get closer to implementation.

### A. Core types and contracts (mtw-lambda-patterns)

**Status:** Done (2025-02-17). Snapshot header conventions documented in AGENT.md and AGENT.implementation.md; CoreExternalFormat snapshot usage documented; `createSnapshotCoreFormat`, `coreFormatToResolvedSnapshotEnvelope`, and `coreFormatToStreamingEnvelope` (plus `SNAPSHOT_HEADER_TYPE`) added in streamEventPublisher and re-exported from index.

1. **Define snapshot header conventions**
   - Use a single shared header `type: 'Snapshot'` for all DataSources; domain/stream come from `dataSourceKey` and `streamKey`.
   - Update documentation in `AGENT.md` and `AGENT.implementation.md` to describe snapshot header semantics and examples.
2. **Align CoreExternalFormat with snapshots**
   - Confirm that CoreExternalFormat is already snapshot-friendly (header-only metadata, update body).
   - Document that snapshot rows and replay payloads are expressed as CoreExternalFormat envelopes.
3. **Add snapshot helpers to base classes**
   - Introduce helpers in `baseClasses.ts` and `index.ts` for:
     - Constructing snapshot CoreExternalFormat from a pair `{ header, content }`.
     - Lifting CoreExternalFormat snapshots into `ResolvedStreamingEnvelope` and `StreamingEventEnvelope`.
   - Keep these helpers symmetric with existing event helpers to avoid drift.

### B. Storage and replay pipeline

**Status:** Done (Step B storage/replay envelope work implemented in mtw-lambda-patterns; domain migrations and client alignment continue under Workstreams D and E).

1. **Dynamo snapshot representation**
   - Refactor snapshot writes to store CoreExternalFormat snapshot rows (`header`, `update`) instead of ad hoc shapes.
   - Ensure `DataCategory` and key structure stay the same (`Meta::Snapshot` plus `STREAM#${dataSourceKey}::${streamKey}`).
2. **Snapshot reads and timestamp handling**
   - Make snapshot read paths return a CoreExternalFormat snapshot plus extracted timestamp.
   - Confirm timestamp strategy is consistent with existing event records.
3. **initializeSubscription**
   - Refactor `initializeSubscription` to:
     - Read snapshot and events as CoreExternalFormat envelopes.
     - Convert both to SNS Feedback format using the same formatTransform utilities used for events.
   - Where internal code needs resolved envelopes, convert snapshot and events to `ResolvedStreamingEnvelope` and hand them to aggregators.

### C. Lazy evaluation and sidecar support

**Status:** Done (Step C lazy-evaluation and sidecar behavior wired into mtw-lambda-patterns; docs updated to describe inline and sidecar snapshot envelopes and how domain code should resolve sidecars behind `getContentInternal`).

1. **Unify `getContentInternal` for snapshots and events**
   - Snapshot flows share the same envelope contracts as events. The patterns package provides helpers (`createSnapshotCoreFormat`, `coreFormatToStreamingEnvelope`, `coreFormatToResolvedSnapshotEnvelope`) so domains can build `StreamingEventEnvelope` and `ResolvedStreamingEnvelope` values for both snapshots and events, using the same header semantics and lazy `getContentInternal` contract as the messageBus.
   - For sidecarred snapshots, the snapshot body is expressed as a CoreExternalFormat update that carries a sidecar descriptor (for example, `{ sidecarUrl, contentMetadata }`). Domain code implements `getContentInternal` so that it:
     - Fetches from S3 or other backing store.
     - Parses and validates the fetched payload (for example, WML typeguards).
     - Deserializes into the internal snapshot type.
2. **Document snapshot sidecar pattern**
   - Align with the delegation and sidecar planning doc:
     - Sidecar is a transport concern, not a delegation-only feature.
     - Snapshot creators (self-contained or delegated) choose sidecar vs inline.
     - Snapshot descriptors can be "identical but newer" (fresh presigned URL with same underlying object).
   - DataSource pattern docs (`AGENT.md`, `AGENT.implementation.md`) now call out that snapshot bodies may be inline or sidecar descriptors, that routing remains header-based (`type: 'Snapshot'`), and that `getContentInternal` is the place where domains hide the details of fetching and resolving sidecar content.

### D. Aggregation and client alignment

**Status:** Done (2026-02-18). Aggregator docs updated; processRawSnapshot and processRawEvent unified into processRawEnvelope with header-based discrimination; isSnapshot/isUpdate removed from slice config; performCleanup uses header.type.

1. **Treat snapshots as envelopes in aggregators**
   - Update aggregator documentation and examples so that:
     - Initial snapshot is `ResolvedStreamingEnvelope<SnapshotPayload, Header>` with `header.type` reflecting a snapshot variant.
     - Events remain `ResolvedStreamingEnvelope<UpdatePayload, Header>`.
   - Ensure `applyUpdate` examples show snapshot application as just another envelope.
2. **Client DataSource slices**
   - **Unify incoming envelope handling:** Replace the two reducers (`processRawSnapshot` and `processRawEvent`) with one (process incoming envelope). Use a single deserialize path (serializer branches on `header.type === 'Snapshot'`) and header-based discrimination. Event routing already uses `eventType`/`header.type` exclusively (payload-type migration complete); the remaining simplification is unifying how snapshot and event envelopes are processed. `performCleanup` and the `recentEvents` buffer remain largely unchanged; the change is upstream in how each incoming envelope is processed before updating the materialized view and the buffer.
   - Update client slice docs and contracts to:
     - Treat the replay stream as "one snapshot envelope plus a sequence of event envelopes."
     - Use `header` for routing (for example, skip Merge Conflict for events, branch correctly for snapshot variants).
   - Confirm that synthetic snapshots (30 second cleanup) still produce envelopes that match the snapshot header semantics.

### E. Domain migrations (WML, assets, ephemera, others)

For each replayable DataSource:

1. **Inventory**
   - Identify current snapshot producers (delegated or self-contained) and consumers (initialize, replay, client reducers).
   - Map current snapshot payload types and transport choices (inline JSON, WML, sidecar descriptors).
2. **Adopt the shared envelope model**
   - Update snapshot producers to:
     - Emit CoreExternalFormat snapshots with correct headers (`type: 'Snapshot'`).
     - Use the same serializer and formatTransform pathways as events; serializer branches on `header.type === 'Snapshot'` inside `serialize`/`deserialize` (no dedicated snapshot methods).
   - Update replay and initialize consumers to:
     - Rely on envelope headers for routing and type discrimination. (Event consumers already do this; `eventType`/`header.type` are the sole source of routing. Snapshot consumers should follow the same pattern.)
     - Use `getContentInternal` to obtain snapshot content, not bespoke decode logic.
3. **Testing and staged rollout**
   - Start with a non-critical or low-volume DataSource if possible.
   - Add tests that:
     - Round-trip a snapshot through Dynamo, replay, and client aggregation using envelope-based paths only.
     - Validate both inline and sidecar snapshot bodies.

---

## Open questions for later refinement

This document is a starting point; we expect to iterate as we move closer to implementation.

**Resolved:** Snapshot header type is a single shared value `'Snapshot'` for all DataSources; domain is identified by `dataSourceKey` (and `streamKey`). Aggregators discriminate "snapshot vs event" by `header.type === 'Snapshot'`; no per-domain snapshot type variants.

**Resolved:** Serializers already receive `{ content, header }` (header includes `type`). Snapshot handling does not require dedicated `serializeSnapshot`/`deserializeSnapshot` methods. Implementations can branch inside `serialize` and `deserialize` on `header.type === 'Snapshot'` to handle snapshot payloads; the same serializer class serves both events and snapshots. The refactor can deprecate/remove the optional snapshot-specific methods in favor of this single entry point.

**Resolved:** We do not expose provenance (self-contained vs delegated) to the client; data sources are black boxes. We do not add a separate "snapshot freshness" API; the envelope header already carries `timestamp`, which is sufficient for ordering and for clients to derive age if they need it.

**Resolved:** Payload `type` has been removed from DataSource event contracts. Producers do not emit it; consumers do not require it. Wire formats use top-level `eventType`; routing is exclusively envelope-based. Snapshots in the target model never relied on payload type; no snapshot-specific changes are needed for that.

1. **Client incoming envelope handling**
   - **Resolved.** The unified envelope model simplifies incoming message handling (one reducer, one deserialize path, header-based discrimination); `performCleanup` and `recentEvents` stay. See **Workstream D.2** for the concrete task.

As we work through early migrations, we should update this planning doc with concrete decisions and patterns that prove out well in WML and assets, then treat those as reference implementations for future DataSources.

