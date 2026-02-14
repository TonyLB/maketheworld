# DataSource Delegation & Sidecar Planning

**Status**: PLANNING  
**Scope**: Generic DataSource framework (mtw-lambda-patterns) and delegated backends (e.g. WML manifest/chunks).  
**Related**: `documentation/dataSources/index.md`, `packages/mtw-lambda-patterns/ts/dataSource/index.ts`, `lambda/wml/s3Storage/*`, `lambda/wml/dataSource/*`

---

## Goals

1. **Clarify delegation modes for DataSources**  
   Make explicit the architectural distinction between:
   - DataSources that own their *own* snapshots and event history (self-contained aggregators), and
   - DataSources that **delegate** aggregation and state management to an external subsystem (e.g. WML manifest+chunks), while still participating in the generic subscriptions/replay contract.

2. **Make sidecar snapshots a delivery concern by default**  
   Ensure that the generic sidecar mechanism is primarily about *transport* (how a snapshot body moves through EventBridge/WebSocket), not about *how* snapshots are computed or where they are stored.

3. **Provide a first-class pattern for delegated aggregation**  
   Define a clear, optional pattern where a DataSource can:
   - Defer snapshot and delta computation to an external system, and
   - Still maintain enough internal representation (and possibly storage) to cooperate with that system without re-implementing its logic.

4. **Align WML with the delegated pattern without overfitting the framework**  
   Treat the WML manifest-and-chunk machinery as a *client* of the generic delegation pattern, not as the de facto shape of all sidecar DataSources.

---

## Current DataSource & Sidecar Behavior

### Generic DataSource (mtw-lambda-patterns)

- **Replayable DataSources** (inline snapshots):
  - Maintain snapshots and events in Dynamo.
  - Use `snapshotContentGenerator` (optional) and `getSnapshotExternal()` to produce a full snapshot.
  - Use `getRecentEvents()` to fetch events since a given timestamp.
  - `initializeSubscription` emits a `Snapshot` (inline payload) + any recent events via `deliverReplayData`.

- **Sidecar extension**:
  - Adds optional `snapshotSidecarUrlGenerator(streamKey) -> SidecarSnapshotDescriptor`.
  - In `initializeSubscription`, when `snapshotSidecarUrlGenerator` is present:
    - It builds a `Snapshot` with `sidecarUrl` (no inline payload).
    - It still calls `getRecentEvents` for post-snapshot events.
    - The client dataSource wrapper calls `resolveSidecarSnapshot` to fetch the body and then runs the normal `processRawSnapshot` path.

In this **self-contained** mode, sidecars are a *delivery optimization* over the same internal snapshot+events model.

### WML DataSource (delegated today, but implicitly)

- **Backend WML**:
  - Stores its authoritative history as a **manifest** in S3:
    - `manifest-latest.ndjson` with `snapshot` and `chunk` events.
    - Snapshot objects at `{uuid}.wml/snapshots/*.wml`.
    - Chunks at `{uuid}.wml/chunks/*.wml`.
  - Materialized view file at `{uuid}.wml` tracks the current content.

- **Sidecar snapshot generator (`getSidecarSnapshotDescriptor`)**:
  - Reads **only** the manifest events for a given asset.
  - Computes:
    - `latestSnapshot` from `type: 'snapshot'` events.
    - `chunksAfterSnapshot` from `type: 'chunk'` events with later timestamps.
  - Decision:
    - If there is a snapshot and **no chunks after it** → use that snapshot file.
    - Otherwise → use the **materialized view** (`uuid.wml`) as the sidecar.
  - Returns `{ sidecarUrl, createdAt, expiresAt }`.

- **DataSource layer**:
  - Treats `snapshotSidecarUrlGenerator` as the source of truth for the snapshot body.
  - Does **not** reconstruct from manifest in `initializeSubscription`.
  - Does **not** use any Dynamo-based event store for WML snapshots.

This is effectively a **delegated aggregation** mode (the WML S3/manifest system is the real aggregator), but that mode is not explicitly modeled in the DataSource framework.

---

## Architectural Distinction: Two Delegation Modes

### Mode A: Self-contained DataSource (sidecar as delivery only)

- **Source of truth**: The DataSource's own snapshot+event history (e.g. Dynamo).
- **Snapshot creation**:
  - Uses `snapshotContentGenerator` or re-aggregates from events.
  - Maintains its own invariants and aggregation semantics.
- **Sidecar usage**:
  - Takes the internal snapshot and stores it in S3 for transport (e.g. large JSON, NDJSON logs).
  - Emits `Snapshot { sidecarUrl }`.
  - Client uses `resolveSidecarSnapshot` to fetch and deserialize to the same internal snapshot type, then uses normal reducers.

This mode is ideal for:

- Medium-to-large DataSources that still want the DataSource itself to be the owner of history.
- Future "large NDJSON log" cases where snapshots are too big to send inline, but the DataSource still owns the log's logical state.

### Mode B: Delegated aggregation (external state manager)

- **Source of truth**: An external subsystem that manages state and change:
  - For WML: S3 manifest + chunk + snapshot + materialized view.
  - For other domains: specialized storage/aggregation layers.
- **DataSource's role**:
  - Subscribe to that external system's events/snapshots.
  - Optionally *mirror* or index those into its own storage for replay, but not re-implement the aggregation logic.
  - Provide a uniform subscription and snapshot interface to clients.

- **Sidecar usage**:
  - External system may produce the snapshot body (e.g. via reconstruction from manifest).
  - DataSource uses `snapshotSidecarUrlGenerator` as a small adapter—"ask external system where the snapshot body lives"—then emits `Snapshot { sidecarUrl }`.
  - Optionally, the DataSource also stores a representation of that snapshot and events in Dynamo to support replay within the generic framework.

This mode is appropriate when:

- There is an existing, robust change-tracking system (like WML's manifest/chunk model).
- Re-implementing that logic inside a DataSource would be overkill or risk divergence.
- We still want DataSource subscriptions and replay to *cooperate* with that external system, rather than compete with it.

---

## Where WML Is Today (vs. Where We Want It)

**Today (mtw.wml)**:

- Sidecar snapshot selection is implemented directly in `getSidecarSnapshotDescriptor`:
  - Decision is driven by manifest-only logic.
  - When chunks exist after the latest snapshot, we **trust the materialized view** rather than reconstructing from manifest.
- The DataSource framework sees only:
  - `Snapshot { sidecarUrl }` with `createdAt` from the descriptor.
  - No Dynamo-based snapshot/history for WML.

**Concerns**:

1. **Stale snapshot behavior**  
   - If manifest has an old snapshot and a set of chunks, but the materialized view does not reflect all changes (or we consider it too old), we still serve the snapshot or the raw view without reconstruction.

2. **Hard-wiring WML storage into the sidecar hook**  
   - The generic `snapshotSidecarUrlGenerator` hook is currently used with a WML-specific implementation that assumes a manifest/chunk layout.
   - This makes it awkward to reuse sidecars for future DataSources (e.g. large NDJSON logs) that do not share that layout.

3. **Lack of explicit "delegated aggregation" mode**  
   - The framework currently assumes that `snapshotContentGenerator` / `snapshotSidecarUrlGenerator` are *internally consistent* with the DataSource's own representation.
   - There is no explicit contract for "I delegate snapshot/delta computation to this other system and keep a mirrored index."

---

## Desired Direction (High-Level)

1. **Make Mode A (self-contained) the default mental model for sidecars**
   - Sidecar primarily affects how snapshot bodies are transported, not how they are computed.
   - The DataSource stays the authoritative aggregator for its own domain unless explicitly configured otherwise.

2. **Introduce a first-class Mode B (delegated aggregation) in DataSource design**
   - Explicitly document and support patterns where:
     - An external subsystem owns snapshot/delta semantics.
     - The DataSource:
       - Knows *how* to ask that subsystem for "current snapshot as of time T" and "events after T".
       - Optionally mirrors those snapshots/events into Dynamo for generic replay.
   - Clearly separate:
     - "Delegation to external aggregator" from
     - "Sidecar as a transport optimization."

3. **Refine WML to use the delegated pattern instead of inlining manifest logic into sidecars**
   - Treat manifest + chunk + materialized view as the WML aggregator.
   - Have the WML DataSource:
     - Ask that aggregator for a "current StandardFormData snapshot".
     - Optionally write that snapshot body to S3 and point to it via `sidecarUrl`.
     - Mirror basic snapshot metadata in Dynamo if we want replay or diagnostic tooling.

4. **Keep the DataSource framework usable for non-WML sidecar use cases**
   - Avoid baking WML-specific manifest semantics into the sidecar API surface.
   - Ensure that "large NDJSON logs with sidecar snapshots" can plug in with:
     - A generic `snapshotContentGenerator` (build snapshot from internal history).
     - A generic `snapshotSidecarUrlGenerator` (write snapshot body to S3).
     - No need for manifest/chunk knowledge.

---

## Foundational step: explicit header vs content in DataSource events (implemented)

DataSource events **now** explicitly distinguish **header** (small, always-inline, never-sidecarred) from **content** (the full payload that is actually recorded/transmitted in external form and may grow large or be sidecar-backed). This is implemented in `mtw-lambda-patterns` (e.g. `StreamingEventHeader`, `StreamingEventEnvelope`), the lambda gates (assets, WML, ephemera), and the client DataSource slices (`ClientStreamingHeader`, `ClientStreamingEnvelope`). The **next step** is to introduce lazy `getContentInternal`.

- **Header fields (implemented)**: At minimum include `type` (the discriminant for TypeScript unions) and envelope metadata (`dataSourceKey`, `streamKey`, `timestamp`), and may include a few small domain flags like `zone`. These fields:
  - Are always present and never stored in sidecars.
  - Are exactly what typeguards and routing logic need to inspect first.
  - Do not require access to the heavy content body.
- **Content fields (implemented)**: Everything else that the DataSource records and transmits as its external payload (e.g. WML text, StandardFormData serialized as JSON/NDJSON, large component lists, or `{ sidecarUri: string }` references). Today content is passed eagerly (and in some paths is still internal). When we add lazy resolution, we will add a function `getContentInternal` **constructed** from this representation (external inline, sidecar ref, or already-internal) that when executed produces the internal form; handlers will call that function when they need it.

Current implementation (eager content today):

- **Lambda gates (assets, WML, ephemera)**: Build a **header** and publish `{ dataSourceKey, streamKey, timestamp, header, content }` to the messageBus. `header` contains only cheap discriminant/metadata fields; `content` is the payload (today often internal after deserialization at the gate).
- **DataSource subscription**: `subscribedEventTypeGuard(header: StreamingEventHeader)` and the messageBus filter operate on **header** only. `receiveEvents` receives `events: Array<StreamingEventEnvelope<SubscribedContent>>` and uses `event.header.*` for routing and `event.content` when it needs to compute or emit.
- **Client**: DataSource slices use `ClientStreamingHeader` and `ClientStreamingEnvelope`; reducers branch on `header` and deserialize `content` for aggregation.

The lazy `getContentInternal` refactor is a mechanical next step: add a function `getContentInternal: () => Promise<Internal>` (or sync) to the envelope, constructed at event creation from the current `content` (or from external/sidecar when we carry that), and have handlers call it when they need internal form while leaving all header-based routing unchanged.

### Bridge to lazy resolution: getContentInternal as a constructed function

- We add an async (or sync) function on the envelope that **when executed** returns the internal representation of the content. Call it `getContentInternal`; the important part is that it is **constructed at event creation time** from whatever we have.
- **Inline external content:** The function simply deserializes the inline payload when called.
- **Sidecarred content:** The function fetches the sidecar, interprets the response into external content (e.g. JSON parse), then deserializes to internal.
- **Already-internal content (e.g. same-process messageBus today):** The function returns the content as-is (identity). No fetch, no deserialize.
- Handlers and routing: routing uses only header; handlers that need the payload call this function. No need to first migrate the entire pipeline to "external only on the bus"—we can introduce this lazy function alongside current content (internal or external) and have the constructor choose the right implementation.

---

## Design direction: external by default, internal on demand

To maintain the separation (metadata-only routing, no unnecessary deserialization) without special-case "when this particular condition" logic as we generalize delegated systems and sidecar:

- **Pipeline contract**: The envelope carries **header** plus a way to obtain internal on demand. That can be (a) external or sidecar ref plus a lazy `getContentInternal()` constructed at event creation, or (b) during transition, inline internal content with a lazy function that returns it. Prefer carrying external (or sidecar ref) and constructing the lazy function from that so we avoid unnecessary deserialization at the gate.
- **Internal when needed**: The lazy function is **constructed from** the incoming representation (inline external, sidecar ref, or already-internal). Handlers call it only when they need the machine-readable form (e.g. to compute, transform, or apply). Routing and filtering use only envelope + metadata; they never call this function.
- **One rule everywhere**: Handlers/filters do not "provide Internal by default"; they receive a payload that can be turned into Internal on demand. Delegated vs self-contained and sidecar vs inline then align to the same rule: don't deserialize by default; only when needed.

This is a **structural refactor** (add lazy `getContentInternal` constructed at event creation; have receiveEvents call it only when it needs Internal), not a growing set of epicycles. We will loop back to what this means for the sidecar pattern as we implement it.

---

## Sidecar: snapshot/event level, and reuse of existing typeguards

**Flexibility at snapshot/event level (not DataSource level):** Sidecar does not need to be a DataSource-level choice ("this DataSource always delivers sidecar" vs "always inline"). The external shape can express "body here" vs "body at this URI" per snapshot or per event. The translation step from external to internal then checks for a sidecar marker (e.g. `sidecarUri`), loads from that URI if present, parses the string (see format note below), and validates the result—without any new parameter on the DataSource itself. So we gain the flexibility to mix inline and sidecar at the data level. When content is sidecarred, the lazy function `getContentInternal` is the place that performs "fetch sidecar -> interpret to external -> deserialize to internal"; the rest of the pipeline stays sidecar-agnostic.

**Validating parsed sidecar body with existing typeguards:** After parsing the sidecar response (string) into an object (or array for NDJSON), we must check that the result is the correct external/internal shape for that DataSource. We already have typeguards for exactly that purpose, applied to incoming EventBridge/wire data and keyed by dataSourceKey:

- **Events:** `isSubscriptionClientMessage` in `packages/mtw-interfaces/ts/subscriptions.ts` uses `isWMLContentEventExternal`, `isContentHeadersExternal`, `isLibraryExternal`, `isPlayerExternal` on `message.update` per dataSourceKey. The same guards can be run on the parsed sidecar body for event payloads—no new DataSource parameters.
- **Snapshot body:** For WML, `isWMLMaterializedView` in `packages/mtw-interfaces/ts/eventBridge/wml/index.ts` validates StandardFormData-shaped objects. Other DataSources can expose a snapshot-body guard in their eventBridge module if the shape differs from event payloads.

So we do **not** need to extend the parameters that define the DataSource. We reuse the existing typeguards already used for EventBridge/wire validation; the only requirement is a convention for which guard applies to snapshot body vs event payload when they differ (e.g. WML snapshot body uses `isWMLMaterializedView`).

**Sidecar body format:** The fetched sidecar is a string (bytes). We must be deliberate about how we parse it: e.g. JSON (`JSON.parse`), NDJSON (split lines, parse each line), or domain-specific text (e.g. WML). That choice can be per DataSource or per field; once parsed, the existing typeguards validate the result. Document the chosen convention (e.g. "structured sidecar body is JSON unless otherwise specified") when implementing.

---

## Open Questions (to refine before implementation)

1. **Where should delegated systems register their "snapshot contract"?**
   - Should the DataSource own a small, explicit interface like `getDelegatedSnapshot(streamKey, now)` that external systems implement?
   - Or should we keep it at the level of `snapshotContentGenerator`/`snapshotSidecarUrlGenerator`, but with documented semantics for "delegated" vs "self-contained" modes?

2. **Do we want a mirrored Dynamo representation for delegated systems?**
   - **Resolved: Yes.** We benefit from a mirrored Dynamo representation, *particularly* in sidecar situations: we can pull the snapshot `sidecarUrl` (or equivalent) from the Dynamo representation and hand it off directly on subscribe, rather than delegating any *new* activity to the source system upon a pure informational fetch. That keeps subscription init a read from the DataSource's own store instead of a live call into the external aggregator.
   - *Caveat: It's not quite as simple as that—see follow-up discussion.*

3. **Snapshot freshness policy in delegated mode**
   - How should "age" and "completeness" be evaluated when the external system is responsible?
   - For WML:
     - When manifest shows snapshot + chunks, should we *always* reconstruct from manifest for sidecars?
     - Or can we trust the materialized view under some well-defined conditions?

4. **Client expectations**
   - From the client's point of view, `Snapshot` + `Content Update` semantics should be uniform across modes A and B.
   - What minimal invariants must hold for all DataSources, regardless of where aggregation happens?

---

## Next Steps

1. **Write a short companion doc in `mtw-lambda-patterns`** clarifying the two modes (self-contained vs delegated) and how `snapshotContentGenerator` / `snapshotSidecarUrlGenerator` are intended to be used in each.
2. **Decide WML's long-term mode**:
   - Fully delegated (manifest is primary, DataSource mirrors/relays), or
   - Hybrid (DataSource reconstructs from manifest into its own snapshot history).
3. **Update WML sidecar path** to:
   - Stop trusting the materialized view as a fallback when manifest clearly indicates additional chunks.
   - Prefer reconstruction from manifest for the "current snapshot" (even if the body is then stored in S3 for sidecar delivery).
4. **Design a generic contract for delegated aggregators** (even if initially only WML uses it), so future large-object dataSources can plug in without copy-pasting WML-specific conventions.
5. **Loop back: sidecar pattern** — Revisit the sidecar transport pattern (and current mtw.wml implementation) in light of the "external by default, internal on demand" direction above; ensure sidecar fits the same rule without special cases.

