## CoreExternalFormat / WebSocketFormat migration plan

### Context

- The subscriptions lambda currently builds `SubscriptionClientMessage` instances via bespoke `transform(CoreExternalFormat)` functions in `handlerFramework/index.ts`.
- Elsewhere in the system, the standard wire contract is:
  - `CoreExternalFormat` (`{ header, update }`, header-authoritative for `dataSourceKey`, `streamKey`, `timestamp`, `type`, plus extended fields).
  - `WebSocketFormat` as the flat WebSocket representation produced by `toWebSocketFormat(coreFormat)` and consumed by `fromWebSocketFormat(message)`.
- During the first phase of the envelope migration, accessing external payloads from envelopes required fully deserializing to internal format, which made it too expensive to route subscription traffic through envelopes just to reshape data for WebSocket.
- Subscriptions intentionally stayed on a direct `CoreExternalFormat` path (via `fromEventBridgeFormat`) with bespoke transforms, specifically to avoid that cost.
- In the second phase, `StreamingEventEnvelope` gained `getContent('external')`, making it possible to access the external payload without paying the full deserialization cost. Subscriptions has not yet been refactored to take advantage of that capability.

### Problem

- Bespoke transforms in subscriptions reconstruct `WebSocketFormat` by hand. This is easy to drift from the canonical format produced by `toWebSocketFormat`:
  - Recent example: missing `eventType` on `StreamEvent` messages for `mtw.wml` and `mtw.assets.players`, which caused client-side deserializers to see `header.type === ''` and drop or complain about those events.
- The client and other lambdas already rely on the invariant that:
  - `eventType` on the WebSocket message is a projection of `header.type`.
  - Extended header fields (for example `RequestIds`) are present either in `extendedHeader` (SNS/EventBridge) or merged at top level (WebSocket).
- Maintaining a parallel, hand-rolled WebSocket contract in subscriptions increases cognitive load and the chance of subtle bugs whenever the core format evolves.

### Decision for now

- Keep the current bespoke transforms in `handlerFramework/index.ts`, but apply a minimal correctness fix:
  - Explicitly set `eventType = event.header.type` for all subscription messages so that downstream consumers see a non-empty `header.type` after `fromWebSocketFormat`.
- Defer the larger structural refactor of subscriptions to a dedicated migration task that can be done deliberately and tested in isolation.
- Track the refactor work in the project issue tracker (for example: "Refactor subscriptions to use unified WebSocketFormat/CoreExternalFormat pipeline") and reference this document from that issue.

### Target architecture

Goal: subscriptions treats events as `CoreExternalFormat` and uses the same WebSocket wire format pipeline as the rest of the system, with minimal per-dataSource customization.

- EventBridge -> subscriptions:
  - Use `fromEventBridgeFormat` to obtain `CoreExternalFormat`.
  - Use `subscriptionLibrary.matchEvent(coreFormat)` strictly on the header (`dataSourceKey`, `type`, `streamKey`), as already documented.
- subscriptions -> WebSocket:
  - Default path for most handlers:
    - Use `wireFormatsFromCoreFormat(coreFormat).webSocketFormat` to obtain `WebSocketFormat`.
    - Optionally apply a very small transform that starts from that `WebSocketFormat` (for example, redacting or reshaping a field), rather than rebuilding it from scratch.
  - Only maintain bespoke logic where there is a genuine domain constraint, such as:
    - Moving correlation IDs (for example `RequestIds`) to a specific top-level location for compatibility with existing clients.
    - Dropping sensitive fields that should never leave the backend.
- Client side:
  - Continue to treat subscription messages as `WebSocketFormat` plus data-source-specific `update` payloads.
  - Use the existing `DataSourceEventSerializer` implementations (`WMLDataSourceEventSerializer`, `PlayerEventSerializer`, etc.) as the single source of truth for external payload validation and translation into internal events.
  - Keep `SubscriptionClientMessage` typings, but conceptually treat them as "WebSocketFormat with update of type X" rather than fully bespoke shapes.

### Migration steps

This refactor should be staged to avoid breaking working subscriptions or coupling it too tightly to unrelated changes.

#### 1. Lock in the minimal fix (immediate)

- Ensure all bespoke transforms in `handlerFramework/index.ts` explicitly set:
  - `eventType: event.header.type`
  - Any required extended header fields (for example `RequestIds`) from `event.header`.
- Verify via browser Network tools and client logs that:
  - `StreamEvent` messages for `mtw.wml`, `mtw.assets.players`, and other data sources now include `eventType`.
  - Client-side deserializers no longer drop valid events or log "Unknown ... event header type" errors.

This step unblocks client correctness without changing the overall subscriptions architecture.

Status: **COMPLETED** – transforms and tests have been updated to set `eventType` consistently, and client behavior has been verified (WML replay events now appear in `recentEvents` and in the UI after reload).

#### 2. Pilot unified pipeline for a low-risk data source

- Choose a relatively simple data source (for example `mtw.assets.library` or `mtw.assets.contentHeaders`) as a pilot for the new pattern.
- For that handler:
  - Remove or simplify the bespoke `transform` so that it either:
    - Uses `wireFormatsFromCoreFormat(coreFormat).webSocketFormat` directly, or
    - Starts from that `webSocketFormat` object and applies minimal tweaks (for example, adjusting one property) before sending.
  - Confirm that the resulting WebSocket messages:
    - Still pass `isSubscriptionClientMessage`.
    - Are correctly deserialized and applied by the corresponding client slice.
- Add tests (or enhance existing ones) that:
  - Exercise the end-to-end path `EventBridge -> subscriptions -> WebSocket -> fromWebSocketFormat -> DataSourceEventSerializer.deserialize` for the pilot data source.
  - Assert on both header fields (`dataSourceKey`, `streamKey`, `timestamp`, `type`) and the external `update` payload.

Status: **COMPLETED** – `mtw.assets.library` now uses the default `wireFormatsFromCoreFormat(coreFormat).webSocketFormat` path in `subscriptionLibrary`, and tests in `lambda/subscriptions/handlerFramework/index.test.ts` cover `EventBridge -> subscriptions -> WebSocket -> fromWebSocketFormat -> LibraryEventSerializer.deserialize` for this data source.

#### 3. Roll out to remaining data sources

- For each remaining data source (`mtw.wml`, `mtw.assets.contentHeaders`, `mtw.assets.players`):
  - Examine the current bespoke transform to understand any intentional deviations from the core `WebSocketFormat` (for example, top-level `RequestIds` vs nested in `update`).
  - Where possible, converge to:
    - Using `wireFormatsFromCoreFormat(coreFormat).webSocketFormat` as the base.
    - Applying only the minimal adjustments needed to preserve the existing public contract.
  - Keep or document any truly necessary bespoke behavior (for example, address obfuscation).
- For each migration step, re-run the same end-to-end tests used for the pilot to confirm behavior.

**mtw.wml pilot (completed):** `mtw.wml` has been piloted on the unified pipeline. Merge Conflict and Content Update handlers no longer use bespoke transforms; they use the default path so that `SubscriptionEvent.publish` sends `wireFormatsFromCoreFormat(coreFormat).webSocketFormat`. WML WebSocket messages therefore get `eventType`, `dataSourceKey`, `streamKey`, `timestamp`, and extended header fields (e.g. `RequestIds`) from the canonical `toWebSocketFormat` merge. End-to-end tests in `handlerFramework/index.test.ts` cover the full path: EventBridge -> subscriptions -> WebSocket -> `fromWebSocketFormat` -> `WMLDataSourceEventSerializer.deserialize` for both Content Update and Merge Conflict.

#### 4. Update documentation and contracts

- Update `lambda/subscriptions/AGENT.md` to:
  - Call out that subscriptions now primarily uses `WebSocketFormat` derived from `CoreExternalFormat` via `wireFormatsFromCoreFormat`.
  - Point to this planning document for historical context and detailed migration notes.
- Update any relevant `mtw-interfaces` docs to clarify that:
  - Subscription messages follow the same `WebSocketFormat` contract as other WebSocket paths.
  - DataSource serializers are the authoritative place for defining external payload shapes.

#### 5. Cleanup and guardrails

- Once all handlers use the unified pipeline, consider:
  - Removing any redundant transforms that simply reproduce what `toWebSocketFormat` already does.
  - Adding small tests in `mtw-lambda-patterns` that assert invariants such as:
    - `toWebSocketFormat` always projects `header.type` into `eventType`.
    - `fromWebSocketFormat` always reconstructs `header.type` from `eventType`.
- Optionally add a lightweight runtime assertion (in development/test builds) that subscription messages with `messageType: 'StreamEvent'` always include a non-empty `eventType`, to prevent regressions like the one that motivated this migration.

### Notes and trade-offs

- Keeping subscriptions on `CoreExternalFormat` rather than envelopes remains reasonable for this lambda, since it primarily routes external payloads and does not need internal deserialization.
- Moving to the unified `WebSocketFormat` pipeline does not require subscriptions to adopt `StreamingEventEnvelope` internally; it only standardizes how `CoreExternalFormat` is rendered onto the wire.
- The staged approach lets us:
  - Fix immediate client-visible bugs quickly.
  - Reduce bespoke surface area over time.
  - Preserve the flexibility of the subscription library while aligning with system-wide format standards.

### Post-completion context

This subscriptions refactor plan emerged while preparing caching work in `lambda/ephemera/AGENT.caching.planning.md`. That ephemera planning doc is part of a broader effort to make it possible to **enter and cache the data needed to exercise the Room Preview UI** end-to-end.

During that prep work, we discovered that:

- The WML DataSource replay path (Initialize Subscription for `mtw.wml`, via `DataSource.initializeSubscription` and `deliverReplayData`) was delivering SNS/WebSocket `StreamEvent` messages without `eventType`, causing the `mtw.wml` client slice to treat replayed updates as having `header.type === ''` and drop them from `recentEvents`.
- The same drift affected `mtw.assets.players`, producing client-side "Unknown player event header type" warnings and dropping those updates.

Fixing the minimal `eventType` issues in subscriptions and the shared DataSource replay logic was a prerequisite to reliably seeing recent WML and player changes on reload, which in turn is required to validate Room Preview behavior against live editing flows. Once the next ephemera caching migration step is complete, this document should serve as the "stack frame" that explains why subscriptions work was interleaved with that effort and where to resume if further CoreExternalFormat/WebSocket alignment is needed.