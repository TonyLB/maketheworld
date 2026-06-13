# DataSource Pattern - Implementation Guide

## Overview

This document provides detailed implementation information for the DataSource pattern. For high-level usage guidance, see [AGENT.md](./AGENT.md).

### **Design principles (serialization boundary)**

The serialization refactor established these principles (authority and typing only; wire/stored payload shape is unchanged; `type` may remain in the body for compatibility):

- **Single header representation:** One header type (`StreamingEventHeader` and extended variants) is used in memory for internal (messageBus, receiveEvents) and external (serializer params, CoreExternalFormat.header) use; only the wire encoding differs per transport.
- **Header authoritative for routing:** All routing and type guards use `header.type` (and extended header fields). Payload may still carry `type` for wire compatibility; routing must not depend on payload `type` when header is available.
- **Single path and single builder:** All lambdas use `fromEventBridgeFormat` and pass `coreFormat.header` + `coreFormat.update` to deserialize. Wire envelope construction is centralized in the publisher (`publishStreamEvent` / `wireFormatsFromCoreFormat`); DataSource and initialize lambda do not hand-build CoreExternalFormat.
- **CoreExternalFormat header-only:** In-memory format is `{ header, update }` only; no duplicated top-level envelope fields.
- **Event contracts:** Cross-lambda EventBridge contracts (types, serializers) live in mtw-interfaces; API-triggered internal events use lambda-local `localApiEvents.ts` (see below).
- **Outgoing update payloads:** Types for **published** DataSource updates (`streamEvent` / `streamEnvelope`, the `UpdatePayload` generic) follow the publishing boundary: **cross-lambda** (`publisherStrategy: 'eventBridge+bus'`, default) **must** define **outgoing** event types in **mtw-interfaces** (with serializers) so every implementing site and consumer shares the same wire contract; **`busOnly`** DataSources **must** colocate **outgoing** payload unions and guards in **`publishedEvents.ts`** in the same directory as the DataSource (see **publishedEvents.ts and outgoing update payloads** below).
- **Header predicates centralize guards:** Per DataSource, header-level discriminants (and optional header union types) are the single source for aggregate and per-event envelope guards across regimes (lazy internal, resolved internal, external/core).

## Technical Details

### **Live vs Replay Event Delivery**

The DataSource pattern uses two different delivery mechanisms depending on the context:

- **Live Events** (`streamEvent`): New changes are published to EventBridge for fan-out to all current subscribers. The subscriptions lambda deserializes with `fromEventBridgeFormat` and sends **`toWebSocketFormat`** (flat extended header fields at the message top level).
- **Replay Events** (`initializeSubscription`): Historical data is delivered directly to a specific session via SNS Feedback (when replay is enabled). SNS bodies use **`toSNSFeedbackFormat`** (nested `extendedHeader`). The feedback lambda deserializes with `fromSNSFeedbackFormat` and sends **`toWebSocketFormat`** before WebSocket delivery --- same flat client contract as live events. See [`lambda/feedback/AGENT.md`](../../../../lambda/feedback/AGENT.md).

This dual approach ensures efficient delivery while maintaining the correct scope for each type of event. **Client ingress** (`fromWebSocketFormat`) always sees canonical flat WebSocket StreamEvents on both paths.

### **Replay Content**: The method delivers:
1. **Current Snapshot**: The most recent materialized state for the stream
2. **Recent Events**: Events that occurred strictly after the replay cursor (`replayAt ?? createdAt`)
3. **Complete Context**: Everything the subscriber needs to understand the current state

### **Snapshot envelope conventions**
Snapshots use the same header semantics as streaming events. A single shared `header.type: 'Snapshot'` is used for all DataSources; snapshot rows and replay payloads use the same `{ header, update }` envelope shape as events. Example: build a snapshot header as `{ dataSourceKey, streamKey, timestamp, type: 'Snapshot' }`; the `update` field carries the external snapshot payload.

`snapshotContentGenerator` is the hook for snapshot creation; it may recapitulate from the Dynamo mirror or call an external system (e.g. mtw.wml calls S3Storage). Sidecar (inline vs URL) is a transport choice orthogonal to where content comes from. Returning a fresh presigned URL for the same S3 object ("identical but newer") is fine—it extends the access window without redundant writes.

### **SNS Feedback Delivery**: Replay data is delivered via the Feedback SNS topic, which allows:
- **Targeted Delivery**: Data goes directly to the specified `sessionId`
- **No Fan-out**: Avoids broadcasting historical data to all subscribers
- **Efficient Replay**: Only the requesting session receives the replay data
- **WebSocket Integration**: SNS messages are delivered to the session's WebSocket connection

### **Integration with MessageBus**: The data source integrates seamlessly with the existing messageBus pattern:
- **Type Safety**: Full TypeScript integration with type guards derived from `receiveEvent` signature
- **Concurrent handlers**: `publish` schedules matching subscribers immediately; boundary `flushAndSettle` quiesces the invocation
- **Error Handling**: Graceful failure without breaking other messageBus handlers
- **Bus outbounds**: `streamEvent` / `streamEnvelope` call `messageBus.publish` for local delivery

### **Message bus outbounds (`streamEvent` / `streamEnvelope`)**

[`DataSourceMessageBusPort`](index.ts) exposes `publish` and `subscribe`. All bus outbounds use **`messageBus.publish(payload)`** (no lanes, no `send`). See [`../messageBus/AGENT.implementation.md`](../messageBus/AGENT.implementation.md).

### **EventBridge Integration**: The subscription system works with the broader EventBridge architecture:
- **Event Reception**: Lambda receives EventBridge events and deserializes them to internal format before routing to messageBus
- **Type Filtering**: Data source only processes events it's interested in via type guards
- **State Derivation**: Incoming events are processed into local state changes
- **Event Propagation**: Local changes are serialized and streamed to subscribers via EventBridge

### **Serialization Boundaries**: The serializer is applied at three key boundaries:
- **EventBridge Publishing**: Internal `UpdatePayload` → `ExternalUpdatePayload` for EventBridge
- **DynamoDB Storage**: Internal `UpdatePayload` → `ExternalUpdatePayload` for replay storage
- **Replay Delivery**: Stored `ExternalUpdatePayload` → delivered via SNS (no re-serialization needed)

### **Type Constraints**:
- **`UpdatePayload`**: Can be any type (class instances, functions, complex objects)
- **`ExternalUpdatePayload`**: Must be `string | SerializableObject` for EventBridge compatibility

### **Benefits**:
- **Type Safety**: Internal types stay internal, external contracts are explicit
- **Evolution Independence**: Internal and external events can evolve separately
- **Clean Architecture**: Clear separation of concerns between business logic and external integration
- **Performance**: Avoids unnecessary deserialize/serialize cycles in replay operations
- **Flexibility**: Rich internal types with EventBridge-compatible external formats
- **Consistency**: Class-based approach provides uniform implementation pattern across all serializers

### **Event Processing Flow**:
- **Outgoing**: DataSource → (1) internal format → messageBus for local processing, (2) serialize → EventBridge/DynamoDB for external distribution
- **Incoming**: EventBridge → deserialize → messageBus → DataSource processing

### **Serialization data flow**

Full pipeline as implemented in code and formatTransform:

**Outbound (publish):**
1. **Internal update** – Caller (DataSource or initialize lambda) has internal `UpdatePayload` and a **header fragment** (e.g. `type`, extended fields).
2. **streamEvent** – DataSource merges fragment with base header (`dataSourceKey`, `streamKey`, `timestamp`) to form full **header**.
3. **Serializer** – `eventSerializer.serialize({ content: update, header })` produces external payload `update` (e.g. `{ type, ... }`).
4. **CoreExternalFormat** – `publishStreamEvent` builds `{ header, update }` (no other top-level fields).
5. **Context transforms** – formatTransform produces wire shapes for each transport:
   - **EventBridge**: `toEventBridgeFormat` maps `header.type` to `DetailType` and derives `Detail.extendedHeader` from the extended part of the header.
   - **DynamoDB**: `toDynamoDBFormat` stores `header.type` as `eventType` on the record (preferred discriminator for replay) and persists `extendedHeader` sidecarred from the header.
   - **SNS Feedback**: `toSNSFeedbackFormat` flattens the envelope into SNS message shape, projecting `header.type` to top-level `eventType` for downstream consumers.
   - **WebSocket**: `toWebSocketFormat` flattens the envelope into a WebSocket message, projecting `header.type` to top-level `eventType` and merging extended header fields at the top level.
6. **EventBridge** – Caller sends the event (DataSource sends via AWS SDK; initialize lambda does not use EventBridge for init).

**Inbound (consume):**
1. **EventBridge** – Lambda receives raw event (source, detail-type, detail, time).
2. **fromEventBridgeFormat** – formatTransform parses Detail + extendedHeader into `coreFormat = { header: fullHeader, update }`.
3. **Deserialize** – Lambda calls `deserializer.deserialize({ content: coreFormat.update, header: coreFormat.header })` to get internal payload.
4. **messageBus** – Lambda builds `StreamingEventMessage` with `header` from `coreFormat.header`, `getContent` returning the deserialized payload, and sends to messageBus.
5. **DataSource processing** – Patterns subscribe() applies envelope type guard, then passes narrowed events to DataSource `receiveEvents`.

Replay path: DataSource `deliverReplayData` builds CoreExternalFormat (snapshot and replay events) with `{ header, update }` and publishes **`toSNSFeedbackFormat`** to the feedback topic (no EventBridge on that path). The feedback lambda normalizes to flat WebSocket via `fromSNSFeedbackFormat` then `toWebSocketFormat`. Snapshot subscribe replay puts `replayAt` on `coreFormat.header` when present (SNS wire: `extendedHeader.replayAt` until feedback transform); metadata fields `createdAt`, `replayAt`, and `expiresAt` are stripped from `update` before send. SNS Feedback and WebSocket both carry `eventType` as a projection of `header.type` so that downstream consumers and replay handlers can discriminate on envelope metadata rather than payload `type`.

**Snapshot and CoreExternalFormat:** Snapshot records (e.g. Dynamo `Meta::Snapshot` rows) and replay delivery payloads are expressed as CoreExternalFormat envelopes: the same `{ header, update }` shape as streaming events. The header carries `type: 'Snapshot'` and the base four fields; `update` is the snapshot body (external payload). Existing `wireFormatsFromCoreFormat` and all format transforms (`toDynamoDBFormat`, `toSNSFeedbackFormat`, `toWebSocketFormat`, etc.) apply to snapshot envelopes without change.

### **Division of responsibility (serialization boundary)**

| Responsibility | Owner |
|----------------|--------|
| **Build full header** | DataSource (or init sender). Merges base four (`dataSourceKey`, `streamKey`, `timestamp`, `type`) with header fragment. Extended fields come from fragment / buildHeader. |
| **Build wire envelope** | formatTransform (`toEventBridgeFormat`, `toDynamoDBFormat`, `toSNSFeedbackFormat`, `toWebSocketFormat`). Reads from `coreFormat.header` and `coreFormat.update` only. |
| **Serialize/deserialize payload** | DataSource event serializer. Operates on content + header; must not duplicate envelope fields in content. |
| **Routing and discrimination** | **Header is authoritative.** Type guards and routing use `header.type` (and extended header fields). Payload may still carry `type` for wire compatibility; routing logic must not depend on payload `type` when header is available. |

### **Batch Event Processing Architecture**:
**Flexible Event Processing**: The DataSource pattern now supports batch processing through the `receiveEvents` method, providing a flexible foundation for various event processing patterns.

**Key Features**:
- **Batch Input**: `receiveEvents({ events, streamEvent, streamEnvelope })` accepts an array of events for processing and two publishing helpers (see [Choosing streamEvent vs streamEnvelope](#choosing-streamevent-vs-streamenvelope)).
- **Flexible Processing**: Supports any processing pattern - aggregation, parallel processing, or sequential processing as needed
- **Processing Foundation**: Provides the foundation for advanced event processing patterns
- **Pattern Agnostic**: Implementation can choose the most appropriate processing approach for the use case

### **Fan-in cluster pattern (multi-leg ingress correlation)**

Implementation: [`fanInCluster.ts`](./fanInCluster.ts), [`fanInClusterStore.ts`](./fanInClusterStore.ts), tests in [`fanInCluster.test.ts`](./fanInCluster.test.ts).

**Purpose:** Correlate **multi-leg ingress** inside a DataSource `receiveEvents` pipeline. Partial clusters accumulate legs in any order, **unify** when a leg proves two open partials are the same transition, complete when required legs are present, and handle negative cases (optional legs never arrive) via [`messageBus` deferral](../messageBus/AGENT.implementation.md) at `flushAndSettle` tail.

**Scope:** One `FanInClusterStore` **per DataSource instance** (not shared per-invocation). Fan-in runs **inside** `receiveEvents` --- route legs through the store; do not wrap `receiveEvents` externally. Non-fan-in envelopes in the same batch continue through normal domain handlers (see mixed-batch test in `fanInCluster.test.ts`).

#### `FanInCluster` (abstract; concrete subclasses per spec)

Each fan-in **spec** is a subclass holding a leg bag and completion rules. Legs may arrive in **any order**; identity may be **provisional** until an authoritative leg (usually the **fact**) arrives.

| Method / property | Role |
| --- | --- |
| **`canAcceptLeg(leg)`** | Spec guard + no contradiction with legs already in this partial. |
| **`canUnifyWith(other)`** | Same transition, compatible endpoints --- not blind merge of unrelated partials. |
| **`unifyWith(other)`** | Merge leg bags; store removes the absorbed partial. |
| **`registerLeg(leg)`** | Add leg; recompute `completed`. |
| **`clusterIdentity()`** | Stable store key when computable from authoritative legs; `null` while provisional. |
| **`completed`** | All **required** legs for this spec are present. |
| **`handler(ctx, { deferralExecution })`** | Positive completion (`deferralExecution: false`) or settle-time negative case (`deferralExecution: true`). |

**Unify guardrails (subclass responsibility):** compatible transition identity; authoritative legs win over provisional endpoints when present; reject endpoint contradictions; at most one leg per kind unless spec allows more; store removes cluster from open set after non-deferral `handler`.

#### `FanInClusterStore`

| Operation | Role |
| --- | --- |
| **`route(leg)`** | Find join target via `canAcceptLeg`; else seed partial via constructor registry; after register, unify compatible open partials; fire `handler` when `completed`. |
| **`settleDeferrals()`** | For each still-open partial: `handler({ deferralExecution: true })`. |
| **`clear()`** | Drop open partials; wired to deferral **`onClear`** at invocation boundary. |
| **`setHandlerContext(ctx)`** | Required before `route` / `settleDeferrals`; set at start of each `receiveEvents` batch. |
| **`registerDeferral(messageBus, tag)`** | Registers `{ onClear: clear, afterSettled: settleDeferrals }`; unique tag per DataSource. |

**Constructor registry:** DataSource passes an array of `(leg) => Cluster | null` factories --- one per fan-in spec. A factory returns a new empty cluster when the leg can **seed** that spec, or `null` when the leg does not match.

#### Wiring sketch

```typescript
// Module scope (one FanInClusterStore per DataSource instance)
const fanInStore = new FanInClusterStore([myClusterFromLeg, /* other spec factories */])

// Module load: register deferral; tag must be unique per DataSource
fanInStore.registerDeferral(messageBus, 'fanIn-myDataSource')

// In receiveEvents
fanInStore.setHandlerContext(ctx)
for (const envelope of events) {
    const leg = await toFanInLeg(envelope)   // spec-specific; may be undefined
    if (leg) {
        await fanInStore.route(leg)
    } else {
        await handleNonFanInEvent(envelope)  // normal domain logic
    }
}
// Tail: messageBus.flushAndSettle() -> fanInStore.settleDeferrals() via registerDeferral
```

#### Deferral interaction with coalescers

[`InternalMessageBus.runDeferrals`](../messageBus/index.ts) runs all `afterSettled` hooks **concurrently** (`Promise.allSettled`). Ephemera registers outbound coalescers (e.g. [`publishMessage/coalescer.ts`](../../../../lambda/ephemera/publishMessage/coalescer.ts)) that flush deferred WebSocket batches IO-only at the same tail.

- Fan-in `afterSettled` may invoke handlers that publish derived side effects (e.g. bus messages).
- Do **not** assume fan-in settle runs before coalescer flush --- deferrals are parallel.
- `onClear` is independent: fan-in drops partials; coalescers reset enqueue buffers --- both run on `messageBus.clear()` at ingress.

**First consumer (ephemera):** membership presentation emission on [`mtw.ephemera.perception`](../../../../lambda/ephemera/dataSource/perception/AGENT.md) --- cluster spec in [`membershipPresentationFanIn.ts`](../../../../lambda/ephemera/dataSource/perception/membershipPresentationFanIn.ts) (synthetic-leg tests shipped; **`FanInClusterStore`** wiring on [`index.ts`](../../../../lambda/ephemera/dataSource/perception/index.ts) pending). Task plan: [`taskPlanning/.../AGENT.fanInPattern.planning.md`](../../../../taskPlanning/packages/mtw-lambda-patterns/ts/dataSource/AGENT.fanInPattern.planning.md) Phase 1.

### **Header/Content Envelope Model**

DataSource events use a header + getContent contract. The same logical envelope appears in three regimes: **CoreExternalFormat** (external, before/after format transforms), **StreamingEventEnvelope** (messageBus, lazy content via getContent), and **ResolvedStreamingEnvelope** (aggregators, replay, serializer params); all share the same header semantics.

- **Header**: Always present, never sidecarred. Contains `dataSourceKey`, `streamKey`, `timestamp`, `type`, and optional domain flags (e.g. `zone`). Used for routing and type guards. When both header and payload carry a `type`, **header.type is authoritative for routing and discrimination**.
- **Payload**: Obtained via `getContent()`. What serializers and aggregators operate on. **Internal** content payloads do not include a `type` property; discrimination is by envelope/header only. External (wire) payloads may retain `type` for the receiving side, but routing logic must not depend on payload `type` when header is available.
- **`subscribedEventTypeGuard`**: An **envelope type guard** `(envelope: StreamingEventEnvelope<unknown>) => envelope is StreamingEventEnvelope<SubscribedContent>`. The DataSource supplies this; the patterns package builds envelopes as `unknown`, filters with it, and passes only narrowed envelopes to `receiveEvents`. The guard inspects only `envelope.header` (no `getContent()` call); the bus uses required `getContent: () => Promise<unknown>` so messageBus baseClasses stay free of DataSource payload imports.
- **`receiveEvents`**: Receives `events: Array<StreamingEventEnvelope<SubscribedContent>>`; use `event.header` for branching and `event.getContent()` for payload semantics.
- **Initialize Subscription**: DataSource instances type-guard on `header.type === "Initialize Subscription - ${this.dataSourceKey}"` to determine which DataSource handles a given Initialize Subscription event. Init uses the same streaming-event contract: senders provide `getContent`; the init subscription callback obtains the payload via `await payload.getContent()`. See [lambda/subscriptions/AGENT.eventBridge.md](../../../../lambda/subscriptions/AGENT.eventBridge.md) for the EventBridge event format.

### **Extending the header (type-safe)**

The envelope and serializer support an optional **extended header** shape so data sources can add small domain-specific fields (e.g. `zone?: Zone`) and have them type-checked and narrowable.

**Generic types (defaults preserve existing behavior):**

- **`StreamingEventEnvelope<Content, Header>`**: Second type param `Header extends StreamingEventHeader = StreamingEventHeader`. The envelope's `header` is typed as `Header`, so subscribed unions can use extended header types for narrowing.
- **`DataSourceEventSerializer<..., Header>`**: Fifth type param `Header extends StreamingEventHeader = StreamingEventHeader`. `serialize` and `deserialize` accept `header: Header`, so implementations can rely on extended fields when present.
- **`DataSource<..., Header>`**: Final type param `Header extends StreamingEventHeader = StreamingEventHeader`. When publishing via `streamEvent`, the built header is typed as `Header` and passed to the serializer and messageBus.

**When to extend:**

- **Subscribed events (consuming):** In your subscribed envelope union (e.g. `AssetsIncomingEvent`), use a named extended type for variants that carry domain fields, e.g. `WMLStreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' }`. After narrowing with a type guard, `event.header.zone` is typed.
- **Publishing (producing):** When this DataSource must *emit* events whose header includes optional fields (e.g. `zone` on Zone Changed), give the DataSource that `Header` type and supply **`buildHeader`**.

**`buildHeader` (optional constructor parameter):**

- **Intent:** For DataSources that use an extended `Header` type and publish events with those extra fields, the framework cannot infer how to fill them (e.g. it only knows `dataSourceKey`, `streamKey`, `timestamp`, `type`). `buildHeader` is the hook that lets the data source supply the full header when publishing.
- **Signature:** `buildHeader?: (params: { update: UpdatePayload; streamKey: string; timestamp: number }) => Header`
- **When absent:** The DataSource builds the standard 4-field header itself. This is the default; existing DataSources do not need to change.
- **When present:** On each `streamEvent` call, the DataSource invokes `buildHeader({ update, streamKey, timestamp })` and uses the return value as the header for `eventSerializer.serialize({ update, header })` and for the messageBus payload. The implementation can derive extra fields from `update` (e.g. set `zone` from a Zone Changed payload).
- **Example:** A WML DataSource that publishes Zone Changed events with `header.zone` would define `type WMLStreamingEventHeader = StreamingEventHeader & { zone?: Zone }`, instantiate `DataSource<..., WMLStreamingEventHeader>` with a serializer typed to accept that header, and pass `buildHeader` that returns the base fields plus `zone` when the update is zone-related.

**streamEvent and the header fragment:**

- The DataSource supplies `dataSourceKey`, `streamKey`, and `timestamp` for every streamed event; the caller need not send those.
- Callers must pass a **header fragment** (`StreamEventHeaderFragment<Header>`): `type` and any extended header fields. Type: `Omit<Header, 'dataSourceKey' | 'streamKey' | 'timestamp'>`. The DataSource merges the fragment with the base header to form the full header.
- **Resolution:** Full header is always `{ dataSourceKey: this.dataSourceKey, streamKey, timestamp: now, ...params.header }`.
- Supply the fragment so routing uses `header.type` (and extended fields) explicitly; the payload need not carry `type`.

### **Choosing streamEvent vs streamEnvelope**

The DataSource provides two publishing APIs. Both use the same wire format and storage behavior (unresolved envelopes, `getContent('external')` for storage). The distinction is the calling pattern.

| API | Use when |
|-----|----------|
| **`streamEvent(params)`** | Golden path: DataSource receives resolved event, computes resolved result, publishes. Simple params interface `{ update, streamKey, header }`. External payload is derived via `serialize(internal)`. |
| **`streamEnvelope(envelope)`** | Envelope-accepting flows: forwarding or storing external-origin events (preserve sidecars), publishing envelope-shaped results (e.g. S3 snapshotting), or any flow where the caller has or constructs an envelope. Uses `await envelope.getContent('external')` for DynamoDB and EventBridge; passes envelope to messageBus. |

**Avoid a false binary**: "Preserve" (pass-through) and "derive via serialize(internal)" are endpoints, not the full spectrum. With field-level sidecar possibilities, flows may do custom surgery on the structure: e.g. a payload with `spreadSheet: sidecarrable` and `flags: JSON`; a derived DataSource alters spreadSheet when a flag is set, passes it unchanged otherwise, and always transforms flags. That result is neither pure preserve nor pure derive. `streamEnvelope` accepts envelopes however they were produced: preserve, derive, custom surgery, or hybrid.

**Not about mirroring**: This is not about mirroring or replaying subscriber data unchanged. It is about having the right primitives for transform and filter pipelines that may need to preserve, forward, or emit envelope-shaped payloads (including sidecars).

**receiveEvents** receives both `streamEvent` and `streamEnvelope`. Use `streamEvent` for golden-path (resolved-in, resolved-out); use `streamEnvelope` when forwarding or preserving envelopes, publishing envelope-shaped output, or doing partial preservation plus partial transform.

**Future work (sidecarred event payloads):** When Content Update or other events gain field-level sidecarred payloads (e.g. `{ wml: { sidecarUrl } }`), identify the storage call sites in `receiveEvents` that produce those events and switch them to `streamEnvelope(envelope)` instead of `streamEvent(params)`. Construct an envelope with external content and pass it to `streamEnvelope` so `getContent('external')` preserves the sidecar to Dynamo and EventBridge. Add tests for sidecar preservation (external → store → load → external unchanged).

**Serialization: extendedHeader and wire-level eventType**

- **Wire:** Every wire format (EventBridge Detail, DynamoDB, SNS, WebSocket) uses the same rule: extended header = "header minus base four" (dataSourceKey, streamKey, timestamp, type). On EventBridge, DynamoDB, and SNS it is a separate field `extendedHeader` (one object, no key enumeration). On WebSocket the extended part is merged at top level into the flat message. The format layer (formatTransform) applies this rule in every to* and from* transform so that adding a new extended header field does not require editing multiple places.
- **Wire event type projection:** In addition to `extendedHeader`, context transforms project `header.type` onto a small, transport-specific top-level field so that external consumers can discriminate on envelope metadata:
  - **EventBridge** uses `DetailType` / `detail-type` as the canonical wire event type.
  - **DynamoDB** persists `eventType` on each event row as the preferred discriminator when reconstructing `header.type` during replay; legacy rows without `eventType` fall back to `update.type`.
  - **SNS Feedback** includes `eventType` on the flat SNS message body. The feedback lambda deserializes StreamEvent bodies via `fromSNSFeedbackFormat` and re-serializes with `toWebSocketFormat` before WebSocket delivery (same flat contract as the subscriptions lambda).
  - **WebSocket** includes `eventType` on the flat WebSocket message so clients can route on envelope metadata instead of payload `type`.
- **In-memory:** Those properties are **merged into the `header` field.** CoreExternalFormat has two fields only: `header` (required, full: base four + extended properties) and `update`. There are no top-level `dataSourceKey`, `streamKey`, `timestamp`, or `RequestId`; those exist only on `header`. Producers put extended fields in the header fragment; the DataSource sets `coreFormat.header` (full). Serializers should not duplicate envelope fields in content. When serializing, the format layer derives `Detail.extendedHeader` from `coreFormat.header`; when deserializing, it merges `Detail.extendedHeader` into `coreFormat.header`.
- **Consumers:** Read **`coreFormat.header`** (e.g. `event.header.RequestIds`); extended properties are already merged. No backward compatibility for an unextended header; we always have a full header in memory. When both a wire `eventType` and a payload `type` are present, `eventType` (and therefore `header.type`) is authoritative for routing; payload `type` is preserved for contract compatibility only.
- **Adding a new envelope field:** Define (or extend) the concrete extended header type and typeguard in the **data source** that uses it; ensure the DataSource passes it in the header fragment. No changes to the format layer logic.
- **Example (mtw.wml):** The mtw.wml data source uses an extended header type `WMLStreamingEventHeader` with `RequestIds?: string[]` for Content Update and Merge Conflict events. Producers pass `RequestIds` in the header fragment when calling `streamEvent`; the serializer does not put `RequestIds` in the content (payload purity). Consumers read `event.header.RequestIds`; the subscriptions handler sources top-level `RequestIds` in the WebSocket message from the event header. Non-empty `RequestIds` means a client-originated applyEdit was resolved; empty `[]` or omitted means no pending confirmation (see **Stream correlation ids** below).
- **Example (Snapshot `replayAt`):** Replayable snapshots carry `replayAt` on the extended header, not in domain `update`. `deliverReplayData` and `storeSnapshotToStore` set `replayAt` on `coreFormat.header`; metadata fields are stripped from `update` before wire send. Covered by `index.test.ts` (*should put replayAt on extendedHeader and not in update*). Client ingress reads header only; see [`charcoal-client/src/slices/dataSource/streamEventPubSub/AGENT.md`](../../../../charcoal-client/src/slices/dataSource/streamEventPubSub/AGENT.md).

**Stream correlation ids (RequestId / RequestIds)**

Two correlation channels exist; do not conflate them:

| Channel | Wire shape | Client handler | Client DataSource `requestIdTracking`? |
| --- | --- | --- | --- |
| **Stream extended header** | `header.RequestIds[]` or `header.RequestId` on `StreamEvent` | `createDataSourceSlice` `processEnvelope` | **Yes** (opt-in per slice) |
| **LifeLine RPC** | Top-level `RequestId` on immediate `ReturnValue` / `Error` / `Success` | `socketDispatchPromise`, `socketDispatchConversation` | **No** (LifeLine owns this) |

Ephemera `handleApiStateChange`, assets `returnValue`, and thinking `fetchThinkingResult` use the **RPC channel**. The client DataSource factory records ids from **stream headers only**.

**Field shapes:** Extended headers may use `RequestIds` (string array, mtw.wml) or `RequestId` (string). Both merge to the WebSocket top level via [`formatTransform.ts`](./formatTransform.ts). Semantic rule for stream-header recording: **non-empty** = resolved client-originated action; **empty array or omitted** = ignore (no confirmation). Do not filter by `header.type` in client reducers; the header field is the contract.

**Per-data-source inventory (stream-header producers, production code):**

| dataSourceKey | Non-empty producer today | Header field | Notes |
| --- | --- | --- | --- |
| `mtw.wml` | Yes: `processApplyEdit` in `lambda/wml/dataSource/mtw-wml.ts` | `RequestIds` | Non-empty when Apply Edit payload had `RequestId`; `Content Update` and `Merge Conflict`. Primitives bootstrap sends `RequestIds: []`. Zone/snapshot/purge omit field. |
| `mtw.assets.contentHeaders` | No | `RequestId` (reserved) | Producers set `header: { type }` only; wire types in `mtw-interfaces/ts/subscriptions.ts` anticipate `RequestId`. |
| `mtw.assets.library` | No | `RequestId` (reserved) | Same |
| `mtw.assets.players` | No | `RequestId` (reserved) | Same |
| `mtw.ephemera.thinking.scheduling` | No | `RequestId` (reserved) | `Job Completed` header has type only |
| Other ephemera/assets stream publishers | No | --- | Field omitted |

**Client factory (charcoal-client):** Opt-in `requestIdTracking` on `createDataSourceSlice` normalizes stream-header ids into `confirmedRequestIds: { id, seenAt }[]` regardless of wire shape. Config: `headerField?: 'RequestIds' | 'RequestId' | 'both'` (default `both`). See [`charcoal-client/src/slices/dataSource/AGENT.implementation.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.implementation.md).

**Payload/contract/messageBus:** `StreamingEventPayload`, `StreamingEventPayloadContract`, and lambda `StreamingEventMessage` types keep `header: StreamingEventHeader` so structure guards and bus contracts stay payload-agnostic; any extended header is still assignable to the base type at runtime.

**Client stored envelopes (recentEvents):** The client DataSource slice stores full envelope information per recent event via `RecentEventEnvelope<Payload, Header>` (header + content + timestamp). This aligns with the type-safe extended header support above: slices can use extended header types (e.g. `WMLStreamingEventHeader`) in stored envelopes and get correct narrowing when consuming `recentEvents`. Synthetic snapshots produced by the 30-second cleanup use a placeholder header (`type: 'Snapshot'`, empty `dataSourceKey`/`streamKey`); they are not passed to the aggregator. The stored envelope `{ header, content }` is passed into `applyUpdate(snapshot, envelope)` so aggregators use `envelope.header` (e.g. to ignore Merge Conflict by `header.type`) for routing and `envelope.content` for domain data.

### **MessageBus and streaming event contract**

Streaming events on the messageBus follow a single contract so that baseClasses stay payload-agnostic and DataSources own their narrow view.

**Lazy content:** DataSources receive events as `StreamingEventEnvelope<Content>` and obtain content via `getContent()`. **`getContent` is required** on every streaming event message. The patterns package callback uses `getContent` only.

**Spheres of authority:**

| Layer | Responsibility |
|-------|----------------|
| **Publish sites** | Build envelope-shaped messages when sending streaming events: header and **required** `getContent`. |
| **messageBus / baseClasses** | Each lambda defines a single broad `StreamingEventMessage` with **required** `getContent: () => Promise<unknown>`. No imports from dataSource or subscribedEvents. |
| **Patterns subscribe()** | Structure guard validates well-formed streaming event; callback normalizes to `StreamingEventEnvelope<unknown>`, applies DataSource's envelope type guard, passes narrowed envelopes to `receiveEvents`. |
| **subscribedEventTypeGuard** | Envelope type guard: filter and narrow to this DataSource's `SubscribedContent`; inspects only `envelope.header`. |

**Trade-off:** The bus does not enforce compile-time alignment between header (e.g. `dataSourceKey`, `type`) and the payload returned by `getContent()`. Sending sites must get it right; mistakes show up at runtime. We accept this so that baseClasses stay dumb and DataSources own their subscription types. Typed send-helpers in subscribedEvents recover sender-side compile-time safety without coupling the bus to payload types.

**Initialize Subscription** uses a separate subscription path (e.g. `dataSourceKey === 'mtw.subscriptions'`); it is not part of the envelope type guard flow and is out of scope for subscribedEvents. Lambdas that forward init from EventBridge can use a dedicated send-helper (e.g. `dataSource/initSubscription.ts`) with `sendInitializeSubscription(bus, dataSourceKey, streamKey, sessionId, requestId)` so the init message is built with `getContent` only.

### **SubscribedEvents pattern**

Each DataSource implementation should colocate its subscription surface in a **`subscribedEvents.ts`** file in the **same directory** as the file that instantiates the DataSource (e.g. `lambda/wml/dataSource/subscribedEvents.ts`, `lambda/assets/players/subscribedEvents.ts`). One such file per DataSource directory.

**Contents of subscribedEvents.ts:**

1. **Aggregate envelope type guard**: A single guard (e.g. `isWMLSubscribedEnvelope`, `isAssetsSubscribedEnvelope`) with signature `(e: StreamingEventEnvelope<unknown>) => e is StreamingEventEnvelope<SubscribedPayload>`. It inspects only `e.header` (e.g. `dataSourceKey`, `type`); no call to `getContent()`. The DataSource constructor receives this as `subscribedEventTypeGuard`; the patterns package filters with it and passes narrowed envelopes to `receiveEvents`. The messageBus in each lambda uses a single broad `StreamingEventMessage` with required `getContent: () => Promise<unknown>` so baseClasses stay payload-agnostic.

2. **Subscribed payload type and per-event envelope guards**: A TypeScript union of the payload types this DataSource subscribes to. Per-event guards should accept `StreamingEventEnvelope<SubscribedContent>` (the type `receiveEvents` actually receives) and narrow to the specific envelope variant (e.g. `event is Extract<AssetsIncomingEvent, { header: { type: 'Zone Changed' } }>`), so they work without casting the events array. Export any constants used by the aggregate guard (e.g. event type sets).

3. **Typed send-helpers (optional)**: For each event kind that **this lambda** publishes to its own messageBus (not events it only forwards from EventBridge), add a helper `sendX(bus, streamKey, content)`. The bus is the first argument so the module stays decoupled from the messageBus singleton and tests can inject a mock. Signature pattern: `sendX(bus: { publish: (payload: StreamingEventMessage) => void }, streamKey: string, content: XPayload): void`. The helper builds the envelope shape (header, getContent) and calls `bus.publish(...)`.

**Conventions:**

- Payload types for API-triggered events (dataSourceKey: `'api.wml'` or `'api.assets'`) are imported from `./localApiEvents`; payload types for cross-lambda events (mtw.wml, mtw.assets, etc.) are imported from mtw-interfaces. subscribedEvents owns the subscription union, envelope guards, and send-helpers only.
- Initialize Subscription and other special/bootstrap events are out of scope for subscribedEvents; they stay on their separate subscription path.
- Send-helpers are only for events **this lambda** publishes to its own messageBus; do not add helpers for events the lambda only forwards from EventBridge.
- In lambdas with multiple DataSources (e.g. assets: dataSource, players, library, contentHeaders, characters), each DataSource lives in its own directory and has exactly one `subscribedEvents.ts` in that directory.
- Reference implementation: [lambda/wml/dataSource/subscribedEvents.ts](../../../../lambda/wml/dataSource/subscribedEvents.ts).

### **publishedEvents.ts and outgoing update payloads**

Each DataSource publishes incremental updates via **`streamEvent`** and **`streamEnvelope`**. The TypeScript types for those **outgoing** payloads (the **`UpdatePayload`** type argument on `DataSource`) must live where consumers can share them:

- **`publisherStrategy: 'eventBridge+bus'` (default):** Updates are serialized and published to **EventBridge** as well as the process message bus. **Outgoing** event types and serializers **must** live in **`mtw-interfaces`** (typically under `packages/mtw-interfaces/ts/eventBridge/`), alongside cross-lambda **subscribed** payload types, so multiple lambdas and tooling import one contract.

- **`publisherStrategy: 'busOnly'`:** The DataSource does **not** publish to EventBridge; **`streamEvent`** / **`streamEnvelope`** still publish to the process **messageBus** for in-lambda subscribers only (see **`index.test.ts`** in this package for `busOnly`). **Outgoing** payload unions, type guards, and optional send-style helpers for those updates **must** be colocated in **`publishedEvents.ts`** in the **same directory** as the file that instantiates the DataSource (one such file per DataSource directory), mirroring **`subscribedEvents.ts`** for the subscribe side. Do **not** add types to **`mtw-interfaces`** for payloads that only cross this boundary unless the same shape is also shared on the wire elsewhere.

**Naming:** **`publishedEvents.ts`** pairs with **`subscribedEvents.ts`** (outgoing vs incoming). It does **not** replace **`localApiEvents.ts`**, which holds **`api.*` in-process command** shapes injected from API handlers, not arbitrary **`streamEvent`** domain outbounds.

### **localApiEvents.ts and API-triggered internal events**

Events with `dataSourceKey: 'api.wml'` or `'api.assets'` are **in-process only**—they never cross process boundaries. They are used when a lambda's API handler maps an incoming request into a streaming event that the same lambda's DataSource `receiveEvents` processes. WML uses `'api.wml'`; Assets players use `'api.assets'`. Examples: Apply Edit, Move Asset, Purge Asset (WML); Player Settings Updated (Assets Players).

**When to add `localApiEvents.ts`:** Add this file in a DataSource directory when that DataSource has API-triggered internal events. Ephemera has none today; add when needed.

**Contents of `localApiEvents.ts`:** Payload types and type guards for those internal events (e.g. `ApplyEditRequest`, `MoveAssetRequest`, `PlayerSettingsUpdatedEvent`). No serializers; no EventBridge logic.

**Flow:** API handler (in `app.ts`) receives request -> send-helper (in `subscribedEvents.ts`) builds envelope with `dataSourceKey: 'api.wml'` or `'api.assets'` and calls `messageBus.publish()` -> existing `receiveEvents` handles the event via type guards and handlers.

**Convention:** `subscribedEvents.ts` imports from `./localApiEvents`. This keeps internal event contracts local to the lambda rather than in mtw-interfaces, since they are in-process only and not shared across lambdas via EventBridge.

**Reserved handlers (WML):** Canonize/Decanonize and Create Snapshot have handlers in WML with no current call path. They are reserved for reactivation when the publishing UI is built (see AGENT.collaboration.publishing). Do not remove them.

### **Type-Safe Routing with Envelope-Level Discriminated Unions and Payload Purity**:

When using the header + getContent envelope shape (`StreamingEventEnvelope<Content>`), discriminants such as `type` and `dataSourceKey` live on the `header`, not on the payload. To keep routing logic type-safe without embedding redundant `type` fields in `content`, and to keep payloads focused on domain data, the recommended pattern is:

1. **Define an envelope-level union** for subscribed events in the lambda layer (using `getContent` to match `StreamingEventEnvelope`):

   ```ts
   export type AssetsIncomingEvent =
       | {
             header: StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' };
             getContent: () => Promise<WMLZoneEvent>;
         }
       | {
             header: StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Asset Purged' };
             getContent: () => Promise<WMLPurgeEvent>;
         }
       | {
             header: StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Heal Global Values' };
             getContent: () => Promise<{ type: 'Heal Global Values'; connections?: unknown; assets?: unknown }>;
         };
   ```

2. Either **cast the incoming `events` array** to the envelope union where you need stronger typing, or **type per-event guards** to accept `StreamingEventEnvelope<SubscribedContent>` and narrow to the union variant (preferred, so no cast is needed).

3. **Use small, focused type guard functions** to route on `header` while narrowing the envelope (and therefore the return type of `getContent()`). The guard should accept `StreamingEventEnvelope<SubscribedContent>` so it works with the events array without a cast:

   ```ts
   const isWMLZoneChangedEvent = (event: StreamingEventEnvelope<AssetsSubscribedContent>): event is Extract<
       AssetsIncomingEvent,
       { header: { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' } }
   > => (
       event.header.dataSourceKey === 'mtw.wml' &&
       event.header.type === 'Zone Changed'
   );

   // In receiveEvents (event is StreamingEventEnvelope<SubscribedContent>; guards narrow to union variant)
   await Promise.all(events.map(async (event) => {
       if (isWMLZoneChangedEvent(event)) {
           const content = await event.getContent(); // fully narrowed
           const { fromZone, toZone } = content;
           // ...
       }
   }));
   ```

This pattern works around a TypeScript limitation: the compiler does not automatically narrow a union based on checks of **nested** discriminant properties (for example, `event.header.type`) even though it does so for top-level discriminants (`event.type`). By using envelope unions plus explicit type guards, DataSource implementations can keep routing decisions based on header fields while still enjoying precise typing of the content payloads.

**Payload Purity Guidelines**:

- **Header is authoritative for routing**: `header.type`, `header.dataSourceKey`, and any small routing flags added to the header are the single source of truth for routing and discrimination. Lambdas and serializers should never rely on payload `type` for routing once header is available.
- **Payloads focus on domain data**: The payload (from `getContent()`) should represent the domain event body (for example, WML edits, asset metadata), not duplicate routing metadata that already exists in the header.
- **Compatibility with existing contracts**:
  - For externally-constrained contracts (for example, EventBridge payloads in `mtw-interfaces/ts/eventBridge/**`), payload `type` is preserved where required, but treated as **derived** from `header.type` and not used for routing.
  - When reconstructing internal events in `deserialize`, use `header.type` to set the internal `type` field; payload `type` is at most validated, not trusted as the primary discriminator.

Following these guidelines keeps wire formats stable while making header the canonical location for routing metadata and allowing payloads to remain as pure as possible representations of domain state.

### Serialization / resolution regimes and header predicates (events and snapshots, inline and sidecar)

The same logical streaming envelope appears in three processing regimes, which differ only in how content is represented or obtained:

- **External/core (`CoreExternalFormat`)**: Before deserialize, the lambda and subscriptions handler work with `CoreExternalFormat` where `update` is the external payload and `header` carries the authoritative routing metadata.
- **Lazy internal (`StreamingEventEnvelope`)**: On the messageBus and DataSource side, `StreamingEventEnvelope<Content>` wraps the same header with `getContent()` instead of an inline `content` field, so internal payload can be loaded lazily (and, in future, potentially cached internally).
- **Resolved internal (`ResolvedStreamingEnvelope`)**: Aggregators, replay flows, and serializer params use `ResolvedStreamingEnvelope<Content, Header>` where the payload is fully realized as `content`.

All three regimes share the same header semantics; the only differences between them are when and how content is obtained. Snapshot bodies follow the same rule: they can be inline payloads (for example, JSON or WML) or sidecar descriptors (for example, `{ sidecarUrl, contentMetadata }`), but routing is always based on the header (`type: 'Snapshot'`, `dataSourceKey`, `streamKey`). To make this easier to reason about, and to avoid repeating envelope-level type guards for each regime, we centralize header-level routing logic and derive envelope guards mechanically from it. Sidecar resolution (fetching from S3, parsing, deserializing) happens behind `getContent` in domain code; from the patterns package perspective, both inline and sidecar snapshots are just CoreExternalFormat updates carried in the same envelope family.

At the header level, each DataSource (or domain) should define:

- A header union that describes the combinations of `dataSourceKey`, `type`, and any extended header fields it subscribes to, and/or
- One or more header-focused predicates that accept a `StreamingEventHeader` and return a type guard for that header union (or selected subsets).

Envelope-level guards for different regimes should then be built from those header predicates, not by restating the routing logic:

- **StreamingEventEnvelope (lazy internal)**: a guard that accepts `StreamingEventEnvelope<unknown>` and uses only `envelope.header` to decide whether it matches, refining the header and payload type together. After the guard, `envelope.header` is narrowed to the subscribed header union when the aggregate predicate is typed as `HeaderGuard<ThatUnion>` and the guard is built with that union as `H`.
- **ResolvedStreamingEnvelope (resolved internal)**: a guard that accepts `ResolvedStreamingEnvelope<unknown, StreamingEventHeader>` (or an alias) and refines to `ResolvedStreamingEnvelope<UpdatePayload, HeaderUnion>`.
- **CoreExternalFormat (external/core)**: a guard that accepts `CoreExternalFormat` and uses only `coreFormat.header` for routing, never `coreFormat.update.type`.

When implementing a subscribedEvents module, define an exported header union type (e.g. `ContentHeadersSubscribedHeader`) and type the aggregate predicate as `HeaderGuard<ThatUnion>`, passing that union as the second type argument to `makeStreamingEnvelopeGuardFromHeaderGuard`, so that call sites get narrowed `envelope.header` after the guard.

Conceptually, the pattern looks like this:

```ts
// Header-level union and predicate (defined once per DataSource/domain)
type ContentHeadersSubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' | 'Component Removed' | 'Asset Updated' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' })

const isContentHeadersSubscribedHeader = (header: StreamingEventHeader): header is ContentHeadersSubscribedHeader => {
    if (header.dataSourceKey === 'mtw.assets') {
        return ['Component Updated', 'Component Removed', 'Asset Updated'].includes(header.type)
    }
    if (header.dataSourceKey === 'mtw.wml') {
        return header.type === 'Zone Changed'
    }
    return false
}

// Helpers (defined once in the patterns package) that lift header predicates into envelope guards
type HeaderGuard<H extends StreamingEventHeader> = (header: StreamingEventHeader) => header is H

function makeStreamingEnvelopeGuardFromHeaderGuard<
    SubscribedContent,
    H extends StreamingEventHeader
>(headerGuard: HeaderGuard<H>) {
    return (
        envelope: StreamingEventEnvelope<unknown>
    ): envelope is StreamingEventEnvelope<SubscribedContent> & { header: H } => (
        headerGuard(envelope.header)
    )
}

function makeResolvedEnvelopeGuardFromHeaderGuard<
    SubscribedContent,
    H extends StreamingEventHeader
>(headerGuard: HeaderGuard<H>) {
    return (
        envelope: ResolvedStreamingEnvelope<unknown, StreamingEventHeader>
    ): envelope is ResolvedStreamingEnvelope<SubscribedContent, H> => (
        headerGuard(envelope.header)
    )
}

// Usage in a subscribedEvents module (lazy internal regime)
export const isContentHeadersSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<ContentHeadersSubscribedContent, ContentHeadersSubscribedHeader>(
    isContentHeadersSubscribedHeader
)
```

**Variant (narrow) envelope guards.** Guards that narrow to a single event variant (e.g. "is this a Zone Changed event?") use the same `makeStreamingEnvelopeGuardFromHeaderGuard` with a **narrow** `HeaderGuard<H>` and the variant's `Content` and `H` as the two type arguments. No separate helper or regime: the aggregate guard uses the full subscribed `Content` union and broad `H`; variant guards use `VariantContent` and narrow `H` (e.g. `StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' }`). The header predicate is the single place that defines "what is this event type?" for that variant; adding or changing a subscribed event type requires updating one header predicate (and payload types), not N separate guard functions.

In the external/core regime, a similar helper can derive a `CoreExternalFormat` guard from the same `HeaderGuard`, keeping subscriptions routing logic aligned with DataSource and aggregator code without duplicating the header checks.

Our goal is that by centralizing header-level routing predicates and using small helpers to derive envelope guards, we keep the header as the single source of routing truth across all regimes and make it easier to reason about streaming behavior without having to re-derive envelope type guards in multiple places.

### Serialization resolution architecture (sidecars and environment)

Resolution (sidecar fetch, parse, deserialize) is centralized in the **DataSourceEventSerializer**. EventBridge handlers pass `getContent: () => deserializer.deserialize({ content: update, header })`; the serializer owns resolution. **Initialize Subscription** is the only envelope type that bypasses the serializer (control payload `{ sessionId, requestId }` with `getContent: () => Promise.resolve(payload)`).

**Domain-shaped payloads:** For sidecars, use per-field descriptors (e.g. `{ wml: { sidecarUrl: string } }`) rather than full-content `{ sidecarUrl }`. Full-content sidecar is not supported on the client. Snapshots should use domain-shaped payloads: `{ wml: string }` (inline) or `{ wml: { sidecarUrl: string } }` (per-field sidecar). The `maybeFetchSidecarString` helper in `sidecarResolve.ts` resolves inline string or `{ sidecarUrl }` to string; serializers call it with `this.env.fetch`.

**Rubric (all satisfied):** (1) EventBridge handlers build envelopes with `getContent` that delegates to the serializer. (2) Client resolves via the serializer only. (3) Initialize Subscription is the only envelope that bypasses the serializer. (4) Changing "how WML resolves sidecar + deserialize" requires editing only the WML serializer.

## Timestamp Handling Strategy

The DataSource pattern uses a consistent timestamp strategy across all event and storage operations.

### **Timestamp Storage Locations**:
- **DynamoDB Records**: Timestamp embedded in `DataCategory` field as `EVENT#${timestamp}::${uuid}` (no separate timestamp field)
- **Replayable Snapshots**: Snapshot rows carry **`createdAt`** (envelope generation / cache) and **`replayAt`** (replay lower bound). `initializeSubscription` uses the replay cursor **`replayAt ?? createdAt`** so legacy rows without `replayAt` still replay correctly. Replay queries use a strict lower bound on that cursor (see `getRecentEvents` / `initializeSubscription` in [`index.ts`](./index.ts)).
- **Non-Replayable getSnapshot()**: Throws error - snapshots are not supported for non-replayable data sources
- **MessageBus Events**: Timestamp included in event metadata for internal coordination
- **EventBridge Events**: No timestamp in Detail payload (EventBridge provides automatic timestamps)

### **Timestamp Extraction Pattern**:
- **Single Source of Truth**: Timestamps extracted once from `DataCategory` in `getRecentEvents()`
- **Clean Data Flow**: Raw DynamoDB data → processed data with extracted timestamp → usage
- **No Redundancy**: Avoids storing timestamps in multiple places or passing around raw `DataCategory` strings

### **Implementation Details**:
- **Storage**: `DataCategory: 'EVENT#${getCurrentTimestamp()}::${uuidv4()}'`
- **Extraction**: `parseInt(DataCategory.split('::')[0].replace('EVENT#', ''))`
- **Sorting**: Events sorted by extracted timestamp for chronological replay
- **Delivery**: Clean timestamp field passed to replay consumers

### **Benefits**:
- **Consistency**: Single timestamp source eliminates sync issues
- **Efficiency**: No redundant timestamp storage in DynamoDB records
- **Clarity**: Clean separation between metadata (timestamps) and payload data
- **Performance**: Minimal storage overhead while maintaining full temporal ordering

## Data Storage Strategy

### **Local DynamoDB Table** (Optional - when `replayable` is enabled)
Each replayable data source maintains a local DynamoDB table for replay data across multiple subscribable streams. The Primary Key will be variable (`AssetId`, `EphemeraId`, and so on), but the general pattern will be that all stream records have a PK of `STREAM#${dataSourceKey}::${streamKey}`.

This granular PK structure enables (when replay is enabled):
- **Stream Isolation**: Each stream maintains its own snapshot and event history
- **Efficient Querying**: Direct access to specific stream data without filtering
- **Concurrent Operations**: Multiple streams can be processed simultaneously without conflicts
- **Scalable Architecture**: Support for large numbers of streams within a single data source

### **Record Types** (when replay is enabled):
- **Snapshot Records**: DataCategory of `Meta::Snapshot` - Contains the complete current state for a specific stream
- **Event Records**: DataCategory of `EVENT#${epochTime}::${uuid}` - Contains incremental changes for a specific stream

### **Naming Conventions**

**Data Source Keys**: The `dataSourceKey` parameter should use the full EventBridge source naming convention for consistency:

- **Primary Data Sources**: Use the full EventBridge source name (e.g., `'mtw.assets'`, `'mtw.ephemera'`, `'mtw.connections'`)
- **Sub-Sources**: For specialized data sources within a larger service, extend the pattern (e.g., `'mtw.assets.contentHeaders'`, `'mtw.assets.characterData'`)

This naming convention ensures that:
- **DynamoDB Keys**: Use the same identifier as EventBridge sources (`STREAM#mtw.assets::streamKey`)
- **EventBridge Events**: Use the same source identifier (`Source: 'mtw.assets'`)
- **Code Clarity**: Makes it immediately clear which service/system owns each data source
- **Consistency**: Eliminates confusion between different naming schemes across the system

**Discovering Implementations**: This pattern doc does not enumerate call-sites. Use search for a live inventory:

- **Envelope unions**: `rg "IncomingEvent"` or `rg "export type \w+IncomingEvent"` (e.g. `AssetsIncomingEvent`, `LibraryIncomingEvent`) in lambda files
- **DataSource instantiations**: `rg "dataSourceKey: 'mtw\."` in `lambda/`
- **Serializers**: See [EventBridge AGENT.implementation.md](../../../mtw-interfaces/ts/eventBridge/AGENT.implementation.md#discovering-implementations) for serializer and contract discovery

## EventBridge Integration Patterns

### **Incoming Event Processing**
The DataSource pattern integrates with EventBridge through a standardized messageBus routing pattern:

**Event Reception**: Lambda handlers receive EventBridge events, deserialize them to internal format, and route them to messageBus.
**Data Source Subscription**: Data sources automatically subscribe to relevant internal format events using their configured type guards and event processing functions.

### **EventBridge Architecture Simplification**
The subscription system enables a simplified EventBridge architecture:

**Before**: Complex EventBridge routing with multiple direct subscriptions
- Each lambda directly subscribes to multiple EventBridge event types
- Complex routing logic in each lambda handler
- Tight coupling between event sources and consumers

**After**: Centralized messageBus routing with data source subscriptions
- Single EventBridge event handler deserializes all events and routes them to messageBus
- Data sources subscribe to messageBus internal format events they care about
- Loose coupling with type-safe event processing
- Easier testing and maintenance

**Benefits**:
- **Simplified Event Handling**: Single point of EventBridge event reception
- **Type Safety**: Full TypeScript integration with derived type guards
- **Flexible Routing**: Data sources can subscribe to any messageBus event type
- **Better Testing**: MessageBus events can be easily mocked and tested
- **Performance**: Reduced EventBridge subscription complexity

### **Multi-Context Serialization Challenge**

The DataSource pattern currently faces a serialization complexity issue where different transmission contexts require different structural representations of the same core metadata (`dataSourceKey`, `type`, and `streamKey`).

**The Problem**: Instead of having a core format with context-specific transforms, the codebase has evolved a _de facto_ union format that accommodates all required structures simultaneously, leading to:
- Functions expecting both `detailType` and `type` fields at separate levels
- Redundant metadata storage across different contexts
- Complex serialization logic that tries to satisfy multiple format requirements
- Difficulty maintaining clean separation between internal and external representations

**Context-Specific Format Requirements**:

**EventBridge Format**:
- **Filtering Priority**: `dataSourceKey` (`source`) and `type` (`detailType`) as top-level fields
- **Structure**: `{ source, detailType, detail: { streamKey, update } }`
- **Use Case**: Cross-service communication with EventBridge filtering capabilities

**DynamoDB Format**:
- **Sorting Priority**: `dataSourceKey` and `streamKey` encoded in string keys
- **Structure**: `{ PK: 'STREAM#${dataSourceKey}::${streamKey}', type, update }`
- **Use Case**: Efficient querying and sorting by stream and data source

**WebSocket Format**:
- **Transmission Priority**: All metadata as properties of the message
- **Structure**: `{ messageType: 'StreamEvent', message: { dataSourceKey, streamKey, type, update } }`
- **Use Case**: Real-time client delivery with complete context

**Proposed Solution**: Core External Format + Context Transforms

**Core External Format**: Header-authoritative in-memory representation. Two fields only; envelope metadata lives on `header`:
```typescript
interface CoreExternalFormat {
    header: { dataSourceKey: string; streamKey: string; timestamp: number; type: string; [key: string]: unknown };
    update: { type: string; [key: string]: unknown };
}
```
Header is the single source of truth for all envelope metadata (base four + extended); there are no duplicated top-level fields.

**Context-Specific Transformers**: Bidirectional transforms for each transmission context:
- **EventBridge Transformer**: 
  - `CoreExternalFormat` → EventBridge event structure (for publishing)
  - EventBridge event structure → `CoreExternalFormat` (for receiving)
- **DynamoDB Transformer**: 
  - `CoreExternalFormat` → DynamoDB record structure (for storage)
  - DynamoDB record structure → `CoreExternalFormat` (for replay)
- **WebSocket Transformer**: 
  - `CoreExternalFormat` → WebSocket message structure (for delivery)
  - WebSocket message structure → `CoreExternalFormat` (for processing received messages)

**Benefits of This Approach**:
- **Single Source of Truth**: Core format eliminates metadata duplication
- **Clear Boundaries**: Each context has explicit transformation logic
- **Maintainability**: Changes to core format propagate cleanly through transformers
- **Type Safety**: Each transformer can have proper TypeScript types
- **Testability**: Individual transformers can be tested in isolation
- **Performance**: Avoids complex union format processing

**Implementation Strategy**:
1. **Define Core Format**: Establish the standard external representation
2. **Create Transformers**: Build context-specific transformation classes
3. **Refactor Serializers**: Update existing serialization logic to use core format + transforms
4. **Update DataSource**: Modify DataSource to use the new serialization pattern
5. **Migrate Existing Code**: Gradually update code that expects the old union format

### **EventSerializer Implementation**

The DataSource pattern uses the `eventSerializer` constructor parameter to handle the transformation between internal messageBus events and external transmission formats.

**Purpose**: Enable DataSources to maintain clean internal event processing while supporting proper external event contracts for cross-service communication.

**Method**: `eventSerializer` constructor parameter - Optional serializer for external integration
- **`serialize(params)`**: Convert internal update payload to external format for transmission. Params: `{ content, header }` (same shape as `ResolvedStreamingEnvelope`; content = internal payload).
- **`deserialize(params)`**: Convert external update payload back to internal format. Params: `{ content, header }` (content = external payload). Caller is responsible for building `header` from the wire (e.g. from payload.type) before calling; the deserializer routes only on `header.type`.

**New Architecture**: Event serializers are now defined in `mtw-interfaces/ts/eventBridge/` and imported by lambdas:
- **Centralized Contracts**: All event types and serializers in shared interface layer
- **Service Isolation**: No cross-lambda dependencies
- **Import Pattern**: `import { MyEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge'`

**Implementation Guide**: For detailed technical guidelines on implementing EventBridge event contracts, see **[EventBridge Implementation Guide](../../../mtw-interfaces/ts/eventBridge/AGENT.implementation.md)**.

**Serialization and envelope**: Serialize/deserialize use the same shape as `ResolvedStreamingEnvelope`: `{ content, header }`. The param is named `content` to align with `ResolvedStreamingEnvelope<Content, Header>`. Routing and discrimination use **header.type** only; the deserializer does not branch on `content.type`. External payload should include `type` so the receiving side can build the header before calling deserialize. For deserialize-params narrowing, use envelope-level type guards (see mtw-interfaces: Library, Players, WML, ContentHeaders).

**Standard Pattern**: Use class-based serializers for better type safety, testability, and reusability:

```typescript
// Define serializer as a class for better type safety and testability
export class MyEventSerializer implements DataSourceEventSerializer<MyInternalType, MyExternalType> {
    serialize({ content, header }: { content: MyInternalType; header: StreamingEventHeader }): MyExternalType {
        // Route on header.type; transform internal content to external format (include type for far end)
        return { type: header.type, /* domain fields */ }
    }
    
    deserialize(params: { content: MyExternalType; header: StreamingEventHeader }): MyInternalType | null {
        // Route on params.header.type only; do not branch on params.content.type
        return /* internal update */
    }
}

// Use in DataSource
const myDataSource = new MyDataSource({
    dataSourceKey: 'mtw.mydomain',
    eventSerializer: new MyEventSerializer(),
    // ... other params
})
```

**Key Principles**:
- **Internal Format**: Clean, domain-specific representations optimized for manipulation (`StandardComponent`, embedded `type` properties)
- **External Format**: Transmittable representations optimized for cross-service communication (WML strings, `detailType` metadata)
- **Boundary Enforcement**: Serialization only occurs at the external transmission boundary
- **Type Safety**: Full TypeScript support for both internal and external event structures

**Integration with Multi-Context Architecture**: The `eventSerializer` works with the core external format - it transforms between internal format and `CoreExternalFormat`, while context-specific transformers handle the final conversion to specific transmission formats (EventBridge, DynamoDB, WebSocket).

## Aggregation

The DataSource pattern optionally supports aggregation logic to describe how clients and subscribers should combine snapshots with streaming events to maintain current state.

### **Core Concept**

Aggregation treats the internal snapshot format as the materialized state. An aggregator describes how to:
1. Create an empty snapshot (before any data arrives)
2. Apply delta events to a snapshot to produce a new snapshot

**Key Insight**: Rather than defining a separate "materialized state" type, the internal snapshot format IS the materialized state. This simplifies the type system and aligns with how snapshots are actually used.

### **ResolvedStreamingEnvelope and DataSourceAggregator Interface**

Resolved envelope shape (header + content, no lazy getter). Same shape used for aggregator applyUpdate, client recentEvents, and conceptually for serialize/deserialize params:

```typescript
export type ResolvedStreamingEnvelope<Content, Header extends StreamingEventHeader = StreamingEventHeader> = {
    header: Header;
    content: Content;
}
```

```typescript
export interface DataSourceAggregator<
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader = StreamingEventHeader
> {
    /**
     * Create an empty snapshot (for initialization before any data arrives).
     * @param streamKey - Identifies the stream; may be used to tune empty data per stream (e.g. asset ID).
     */
    createEmpty(streamKey: string): SnapshotPayload

    /**
     * Apply a single update event to a snapshot.
     * Use envelope.header.type (and extended header fields if present) for routing
     * (e.g. skip applying Merge Conflict); use envelope.content for domain data.
     * Returns the new snapshot (immutable pattern).
     */
    applyUpdate(
        snapshot: SnapshotPayload,
        envelope: ResolvedStreamingEnvelope<UpdatePayload, Header>
    ): AggregationResult<SnapshotPayload>
}
```

### **AggregationResult Type**

```typescript
export type AggregationResult<SnapshotPayload> = 
    | { success: true; snapshot: SnapshotPayload }
    | { success: false; error: Error; snapshot: SnapshotPayload }
```

This result type supports **partial failure** - individual events can fail without stopping subsequent event processing. The unchanged snapshot is returned on failure, allowing the aggregator to continue processing subsequent events.

### **Usage Pattern**

Aggregators are provided to the DataSource constructor and accessed via `getAggregator()`:

```typescript
const dataSource = new DataSource({
    // ... other parameters
    aggregator: new ContentHeadersAggregator()
})

// Later, clients can access the aggregator
const aggregator = dataSource.getAggregator()
if (aggregator) {
    let currentState = aggregator.createEmpty(streamKey)
    
    // Apply snapshot (envelope = { header, content })
    const snapshotResult = aggregator.applyUpdate(currentState, { header, content: snapshot })
    if (snapshotResult.success) {
        currentState = snapshotResult.snapshot
    }
    
    // Apply subsequent events (each envelope is { header, content })
    for (const envelope of events) {
        const result = aggregator.applyUpdate(currentState, envelope)
        if (result.success) {
            currentState = result.snapshot
        } else {
            console.warn('Failed to apply event:', result.error)
            // Continue with unchanged state
        }
    }
}
```

### **Design Decisions**

- **Optional Feature**: Aggregators are optional - not all DataSources need them
- **Immutable Pattern**: All operations return new snapshots rather than mutating
- **Timestamp Ordering**: Expected to be handled by clients (events typically have timestamps)
- **Partial Failure**: Individual events can fail without breaking the aggregation chain
- **Type Safety**: Full TypeScript generics ensure compile-time correctness

### **Future Considerations**

Potential future additions to the aggregation pattern:
- Utility functions for timestamp-ordered batch application
- Merge strategies for handling concurrent updates
- Conflict resolution patterns for complex state

## Generic Type System

The DataSource pattern uses a sophisticated generic type system to ensure type safety across different DynamoDB table configurations.

### **KeyType Generic Parameter**
The `DataSource` class is generic over `KeyType` to properly type DynamoDB interactions:

```typescript
export class DataSource<SnapshotPayload, UpdatePayload, SubscribedEvent, ExternalUpdatePayload, KeyType extends string>
```

### **DynamoUtils Interface**
The `DynamoUtils` interface is generic over `KeyType` to match the underlying DynamoDB client types:

```typescript
export type DynamoUtils<KeyType extends string = string> = {
    putItem: (item: any) => Promise<unknown>
    getItem: <Get extends Partial<Record<string, any> & Record<KeyType, string> & { DataCategory: string }>>(args: any) => Promise<Get | undefined>
    query: <Query extends Record<string, any> & Record<KeyType, string> & { DataCategory: string }>(args: any) => Promise<Query[]>
    optimisticUpdate: (params: any) => Promise<any>
}
```

### **Type Safety Benefits**
- **Compile-time Validation**: TypeScript ensures correct key usage at compile time
- **IntelliSense Support**: IDE provides accurate autocomplete for key operations
- **Refactoring Safety**: Changes to key names are caught by the type system
- **Documentation**: Types serve as inline documentation for expected key structure

### **Usage in Lambda-specific Base Classes**
Lambda-specific base classes extend the generic DataSource with concrete key types:

```typescript
// Assets lambda uses 'AssetId' as primary key
export class AssetsDataSource<...> extends DataSource<..., 'AssetId'>

// Ephemera lambda uses 'EphemeraId' as primary key  
export class EphemeraDataSource<...> extends DataSource<..., 'EphemeraId'>
```

## Error Handling and Edge Cases

### **Non-Replayable Data Source Behavior**
- **`getSnapshot()`**: Throws error - snapshots are not supported for non-replayable data sources
- **`initializeSubscription()`**: Throws error - subscription initialization is not supported
- **DynamoDB Operations**: Skipped entirely to save resources
- **Event Streaming**: Still works normally for EventBridge publishing

### **Timestamp Parsing Safety**
- **Null Checks**: Added safety checks for undefined `DataCategory` fields
- **Fallback Values**: Default to timestamp `0` when parsing fails
- **Error Recovery**: Graceful degradation when timestamp extraction fails

### **Event Serialization Failures**
- **Deserialization Errors**: Return `null` when external events cannot be parsed
- **Type Validation**: Validate external event structure before processing
- **Logging**: Log serialization failures for debugging

## Performance Considerations

### **SingleFlight Coordination**
- **Distributed Locking**: Prevents multiple lambda instances from generating snapshots simultaneously
- **Cache Efficiency**: Reuses snapshot generation results across lambda instances
- **Resource Optimization**: Minimizes redundant snapshot generation operations

### **Parallel Operations**
- **DynamoDB + EventBridge**: Storage and publishing operations run in parallel
- **Stream Independence**: Different streams can be processed concurrently
- **Event Processing**: Multiple incoming events can be processed in parallel

### **Memory Management**
- **Snapshot Caching**: In-memory caching with expiration for frequently accessed snapshots
- **Event Batching**: Potential for batch processing multiple events (future enhancement)
- **Resource Cleanup**: Automatic cleanup of expired cache entries

## Testing Implementation

### **Mock Strategy**
- **DynamoDB Mocks**: Mock all DynamoDB operations with resolved promises
- **EventBridge Mocks**: Mock EventBridge publishing operations
- **SNS Mocks**: Mock SNS feedback operations for replay delivery
- **Timestamp Mocks**: Mock `getCurrentTimestamp()` for predictable test results

### **Test Coverage**
- **Unit Tests**: Individual method functionality with mocked dependencies
- **Integration Tests**: Full pipeline testing with real AWS service interactions
- **Error Scenarios**: Network failures, serialization errors, invalid data
- **Performance Tests**: Large dataset handling, concurrent operations

### **Test Data Patterns**
- **Consistent Stream Keys**: Use consistent test stream identifiers
- **Realistic Payloads**: Use realistic data structures in tests
- **Edge Cases**: Test boundary conditions and error states
- **Type Safety**: Ensure tests validate TypeScript type constraints

## Future Implementation Considerations

### **Claim-Check Pattern**
For large snapshots or event contents, implement S3 storage with claim-check records:
- **S3 Storage**: Push large payloads to S3 with pre-signed URLs
- **Claim-Check Records**: Store metadata with S3 object references
- **Delivery Optimization**: Reduce message size while maintaining data access

### **Metrics and Monitoring**
- **Performance Metrics**: Track snapshot generation time, event processing latency
- **Error Rates**: Monitor serialization failures, DynamoDB errors
- **Resource Usage**: Track memory usage, cache hit rates
- **Business Metrics**: Event throughput, subscriber counts

### **Retention Policies**
- **Configurable Retention**: Allow per-data-source retention configuration
- **Automatic Cleanup**: Implement background cleanup of expired data
- **Storage Optimization**: Compress old events, archive historical data

### **Advanced Event Processing**
- **Event Aggregation**: Support for N-to-1 aggregation patterns where multiple related events are collected and processed together to generate a single derived event (foundation now in place with batch processing)
- **Event Ordering**: Guarantee ordered processing for events from the same source
- **Dead Letter Queues**: Handle failed event processing with retry logic
- **Event Validation**: Built-in validation for external EventBridge event formats

---

**Related files:** Format and types: [formatTransform.ts](./formatTransform.ts), [baseClasses.ts](./baseClasses.ts), [index.ts](./index.ts). Event contracts: [mtw-interfaces/ts/eventBridge/AGENT.implementation.md](../../../mtw-interfaces/ts/eventBridge/AGENT.implementation.md). Subscriptions: [lambda/subscriptions/handlerFramework/baseClasses.ts](../../../../lambda/subscriptions/handlerFramework/baseClasses.ts), [lambda/subscriptions/AGENT.md](../../../../lambda/subscriptions/AGENT.md). Inbound lambdas: `lambda/wml/app.ts`, `lambda/assets/app.ts`, `lambda/ephemera/app.ts`. Initialize (outbound): `lambda/initialize/app.ts`.

**For usage guidance and high-level concepts, see [AGENT.md](./AGENT.md)**
