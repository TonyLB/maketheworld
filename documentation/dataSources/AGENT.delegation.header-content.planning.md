# DataSource Header/Content Refactor Planning

**Status**: IN PROGRESS  
**Scope**: Generic DataSource framework (`mtw-lambda-patterns`) and all concrete DataSources (lambdas + client slices).  
**Related**: `documentation/dataSources/AGENT.delegation.planning.md`, `packages/mtw-lambda-patterns/ts/dataSource/*`, `lambda/*/dataSource/*`, `charcoal-client/src/slices/dataSource/*`

---

## Goals

1. **Make header vs content explicit in DataSource events**  
   Clearly separate:
   - **Header**: small, always-inline metadata that is never sidecarred, used for routing and TypeScript union discrimination.
   - **Content**: the full external payload that is actually recorded/transmitted (inline or as a sidecar reference), which serializers and aggregators operate on.

2. **Preserve current behavior (eager semantics)**  
   This refactor must not change the observable behavior of existing DataSources; it is a structural change only. All deserialization remains eager for now.

3. **Prepare for lazy `getInternal` and sidecar resolution**  
   Once header/content is explicit everywhere, a follow-up lazy refactor can replace direct content access with `getInternal(): Promise<Internal>` without changing routing logic.

---

## Current Shape (high level)

Today, the in-process DataSource event pipeline looks conceptually like this:

```mermaid
flowchart LR
  EB[EventBridge external] --> Gate[Lambda gate]
  Gate --> Bus[messageBus]
  Bus --> DS[DataSource.subscribe]
  DS --> Receive[receiveEvents]
```

- Gate lambdas deserialize external EventBridge events into **internal** payloads and put those directly on the message bus (often in a `detailEnvelope` field).
- `DataSource.subscribe` uses a `subscribedEventTypeGuard` against that payload shape.
- `receiveEvents` assumes it receives full internal payloads and uses them both for routing and work.
- There is no explicit header/content split.

---

## Desired Envelope Shape

We want a single in-process event envelope that clearly separates header and content:

```mermaid
flowchart LR
  EB[EventBridge external] --> Gate[Lambda gate]
  Gate --> Bus[messageBus]
  Bus --> DS[DataSource.subscribe]
  DS --> Receive[receiveEvents]

  subgraph EventEnvelope[DataSource event envelope]
    Header[header: type, dataSourceKey, streamKey, timestamp, zone?]
    Content[content: external payload (inline or sidecar-ref)]
  end

  Gate -->|build header + content| EventEnvelope
  EventEnvelope -->|on bus| DS
  DS -->|header-only routing| Receive
  Receive -->|use header for branching, content for semantics| Receive
```

- **Header**:
  - Always present, never sidecarred.
  - Includes at least:
    - `dataSourceKey`, `streamKey`, `timestamp`
    - `type` (the discriminant for TypeScript unions)
    - Optional small domain flags like `zone` where they are part of the event semantics.
  - Is what typeguards and routing logic inspect.
- **Content**:
  - The full **external** payload that is stored/transmitted:
    - WML text, JSON/NDJSON, large arrays, or `{ sidecarUri: string }` style references.
  - This is what serializers and aggregators operate on.
  - In a later lazy step, `getInternal()` will interpret `content` (and any sidecar references) to produce the internal representation.

For this planning doc, **headers and content remain eager**; we are not yet introducing laziness.

---

## Step 1 (COMPLETED): Core Types in `mtw-lambda-patterns`

### 1.1 Add explicit header and envelope types

In `packages/mtw-lambda-patterns/ts/dataSource/baseClasses.ts` (implemented):

- Introduce:

```ts
export type StreamingEventHeader = {
    dataSourceKey: string;
    streamKey: string;
    timestamp: number;
    type: string;
    // Optional small flags like zone can be added per DataSource
};

export type StreamingEventEnvelope<Content = EventPayload> = {
    header: StreamingEventHeader;
    content: Content;
};
```

- Keep the existing:
  - `EventPayload` (union base `{ type: string } & Record<string, unknown>`).
  - `StreamingEvent` (external EventBridge format).
  - `StreamingEventPayload` (if still needed for compatibility) for now; we will migrate internal uses toward `StreamingEventEnvelope`.

### 1.2 Thread envelope into `DataSource` generics

In `packages/mtw-lambda-patterns/ts/dataSource/index.ts` (implemented):

- `DataSource` now uses:
  - `readonly subscribedEventTypeGuard?: (header: StreamingEventHeader) => boolean`
  - `readonly receiveEvents?: (params: { events: Array<StreamingEventEnvelope<UpdatePayload>>; streamEvent: StreamEventFunction<UpdatePayload> }) => Promise<void>`
  - A `subscribe()` implementation that:
    - Builds a `StreamingEventHeader` from the message bus payload.
    - Wraps the existing `detailEnvelope` as `content` in `StreamingEventEnvelope<UpdatePayload>`.

- For this first step, `content` remains the existing **internal** payload; a later step can swap that to external if desired.

### 1.3 Preserve serializer contracts

- Do **not** change `DataSourceEventSerializer` yet:
  - `serialize` and `deserialize` still map between `UpdatePayload` and `ExternalUpdatePayload`.
  - Snapshot serialization/deserialization remains as-is.

The goal here is purely structural: separate what is used for routing (`header`) from what is used for semantics (`content`).

---

## Step 2 (COMPLETED): `DataSource.subscribe` and messageBus integration

### 2.1 Adapt the subscription filter to headers

In `DataSource.subscribe()` (`packages/mtw-lambda-patterns/ts/dataSource/index.ts`), the internal `streamingEventTypeGuard` now:

- Expects internal streaming messages shaped like:

  ```ts
  {
      type: 'StreamingEvent',
      dataSourceKey: string,
      streamKey: string,
      timestamp: number,
      detailEnvelope: EventPayload
  }
  ```

- Returns `false` unless:
  - `message.type === 'StreamingEvent'`, and
  - `message.detailEnvelope` exists with a string `type` field.

- When those checks pass, it builds a `StreamingEventHeader` and delegates to the configured `subscribedEventTypeGuard`:

  ```ts
  const header: StreamingEventHeader = {
      dataSourceKey: message.dataSourceKey,
      streamKey: message.streamKey,
      timestamp: message.timestamp,
      type: message.detailEnvelope.type
  };
  return this.subscribedEventTypeGuard(header);
  ```

This ensures that **routing and filtering are header-only**, and protects against malformed or non-streaming messages reaching DataSource handlers.

### 2.2 Pass envelopes into `receiveEvents`

- In the subscription callback, all payloads are now wrapped into `StreamingEventEnvelope<UpdatePayload>` instances:

  ```ts
  const events: Array<StreamingEventEnvelope<UpdatePayload>> = payloads.map((streamingEvent) => {
      const header: StreamingEventHeader = {
          dataSourceKey: streamingEvent.dataSourceKey,
          streamKey: streamingEvent.streamKey,
          timestamp: streamingEvent.timestamp,
          type: streamingEvent.detailEnvelope.type as string
      };
      return {
          header,
          content: streamingEvent.detailEnvelope as UpdatePayload
      };
  });

  await this.receiveEvents?.({
      events,
      streamEvent: (params) => this.streamEvent(params)
  });
  ```

- `receiveEvents` implementations now clearly see:
  - `event.header` for routing decisions (e.g., `event.header.type`, `event.header.dataSourceKey`).
  - `event.content` for the actual payload semantics.

This keeps current behavior (content is still the internal payload) while codifying the header/content split in the core DataSource plumbing and tests.

---

## Step 3 (COMPLETED): Update DataSource Implementations to Use `header` and `content`

Every concrete DataSource must be updated to use `event.header` for routing and `event.content` for the payload.

**Completed:** Lambda-specific abstract classes (WML, Assets, Ephemera) now declare `subscribedEventTypeGuard?: (header: StreamingEventHeader) => boolean` and `receiveEvents` with `events: Array<StreamingEventEnvelope<UpdatePayload>>`. All concrete DataSources (WML, assets main/contentHeaders/characters/library/players, ephemera) use header-only guards and envelope-shaped events; WML messageBus types document the header/content split. All related tests updated to pass header objects to guards and `{ header, content }` to `receiveEvents`.

### 3.1 WML DataSource

File: `lambda/wml/dataSource/mtw-wml.ts`

- `subscribedEventTypeGuard`:
  - Change its parameter type to the new `StreamingEventHeader` (or a WML-specific subtype).
  - Use `header.dataSourceKey`, `header.type`, and any other header flags to decide which events it cares about.

- `receiveEvents`:
  - Events parameter becomes `Array<StreamingEventEnvelope<CoordinationEventUpdate>>` (or similar).
  - Replace any usage of `(event as any).detailEnvelope` with `event.content`.
  - Any branching that currently looks at `payload.type` should, where possible, use `event.header.type` instead.

### 3.2 Assets DataSources

Files:

- `lambda/assets/dataSource/index.ts`
- `lambda/assets/contentHeaders/index.ts`
- `lambda/assets/characters/index.ts`
- `lambda/assets/library/index.ts`
- `lambda/assets/players/index.ts`

Changes:

- `subscribedEventTypeGuard`:
  - Take a header-shaped parameter.
  - Use `header.dataSourceKey`, `header.type`, and possibly `header.zone` for filtering, not the full content.

- `receiveEvents`:
  - Process `events: Array<StreamingEventEnvelope<InternalUpdatePayload>>`.
  - Use `event.header.type` for routing (e.g. is this a Content Update?).
  - Use `event.content` for the actual update objects when calling helpers, Dynamo, or `streamEvent`.

### 3.3 Ephemera DataSource

File: `lambda/ephemera/dataSource/index.ts`

- Same pattern:
  - `subscribedEventTypeGuard` on headers.
  - `receiveEvents` on `{ header, content }`, using `header` for routing and `content` for work.

### 3.4 WML messageBus types

File: `lambda/wml/messageBus/baseClasses.ts`

- Normalize the message types so they correspond cleanly to:
  - A header part (what DataSource cares about for routing).
  - A content part (payload, formerly `event` or `detailEnvelope`).

This keeps WML’s internal messageBus aligned with the generic DataSource envelope.

---

## Step 4 (COMPLETED): Lambda Gates Build `{ header, content }`

For this refactor, gates still deserialize external events eagerly; we only change what they send to the messageBus. All three lambda gates (WML, assets, ephemera) now build an explicit `{ header, content }` envelope for DataSource processing while preserving Initialize Subscription behavior.

### 4.1 Common `StreamingEvent` shape on the messageBus

Each gate now publishes internal streaming messages in a consistent shape:

```ts
type InternalStreamingEventMessage<Content = EventPayload> = {
    type: 'StreamingEvent';
    dataSourceKey: string;
    streamKey: string;
    timestamp: number;
    header: StreamingEventHeader;
    content: Content;
}
```

- **Header**:
  - `dataSourceKey`: the producing DataSource key (e.g. `mtw.wml`, `mtw.assets`, `mtw.coordination`).
  - `streamKey`: the logical stream identifier (asset id, zone id, etc.).
  - `timestamp`: event timestamp from the EventBridge core format.
  - `type`: the internal event type (e.g. `'Content Update'`, `'Zone Changed'`, `'Asset Removed'`).
- **Content**:
  - The fully deserialized **internal** event payload for that DataSource family.
  - **Initialize Subscription**:
  - Initialize Subscription messages from `mtw.subscriptions` use the same header/content shape, with the **target** DataSource encoded in the header type:

  ```ts
  {
      type: 'StreamingEvent',
      dataSourceKey: 'mtw.subscriptions',
      streamKey,
      header: {
          dataSourceKey: 'mtw.subscriptions',
          streamKey,
          timestamp,
          type: `Initialize Subscription - ${targetDataSourceKey}` // e.g. "Initialize Subscription - mtw.assets.contentHeaders"
      },
      content: {
          sessionId,
          requestId
      },
      timestamp
  }
  ```

  - Each DataSource instance knows its own `dataSourceKey`, and `DataSource.subscribeToInitializeEvents()` type-guards on `header.type === "Initialize Subscription - ${this.dataSourceKey}"`. This is how the system determines **which** DataSource should handle a given Initialize Subscription event.

### 4.2 Assets lambda

File: `lambda/assets/app.ts`

- In the EventBridge event handling path:
  - Keep:
    - `fromEventBridgeFormat(event)` to get `coreFormat` (external).
    - `deserializer.deserialize({ externalUpdate: coreFormat.update })` to get `internalEvent` (for now).
  - After deserializing:
    - Compute `header` from `internalEvent` and the envelope (`dataSourceKey`, `streamKey`, `timestamp`).
    - Send:

    ```ts
    messageBus.send({
        type: 'StreamingEvent',
        dataSourceKey: coreFormat.dataSourceKey,
        streamKey: coreFormat.streamKey,
        timestamp: /* event time */,
        header,
        content: internalEvent
    });
    ```

### 4.3 WML lambda

File: `lambda/wml/app.ts`

- For EventBridge messages (excluding the special Initialize Subscription case):
  - Keep deserializing into internal WML events.
  - Compute `header` (type/zone/etc.) and send `{ header, content: internalEvent }` with the same outer envelope fields.

### 4.4 Ephemera lambda

File: `lambda/ephemera/app.ts`

- Apply the same pattern:
  - After any deserialization step, build `header` and `content` and send them on the messageBus.

This ensures all DataSources see a consistent `{ header, content }` envelope regardless of which lambda produced the event.

---

## Step 5 (COMPLETED): Client-Side Alignment

The client has been updated in lockstep so it also treats incoming events as `{ header, content }`.

### 5.1 LifeLine subscription

File: `charcoal-client/src/slices/dataSource/index.api.ts`

- On `StreamEvent` for a given `dataSourceKey`, the LifeLine subscription now:
  - Derives a `ClientStreamingHeader` from the incoming `update` (`type` plus optional `zone` when present).
  - Treats the wire `update` object as `content`.
  - Dispatches:

  ```ts
  dispatch(processRawSnapshot({ streamKey, timestamp, header, content }))
  // or
  dispatch(processRawEvent({ streamKey, timestamp, header, content }))
  ```

  depending on whether `header.type === 'Snapshot'`.

### 5.2 Client header/content types and reducers

Files:

- `charcoal-client/src/slices/dataSource/baseClasses.ts`
- `charcoal-client/src/slices/dataSource/reducers.ts`

- Introduced lightweight client envelope types:
  - `ClientStreamingHeader` (at least `type: string`, optional small flags like `zone`).
  - `ClientStreamingEnvelope<Content>` and payload helpers `ClientSnapshotMessagePayload` / `ClientUpdateMessagePayload`, which add `streamKey` and `timestamp` around `{ header, content }`.
- Updated `processRawSnapshot` and `processRawEvent` reducers to:
  - Accept `PayloadAction<ClientSnapshotMessagePayload<ExternalSnapshotPayload>>` and `PayloadAction<ClientUpdateMessagePayload<ExternalUpdatePayload>>`.
  - Use `content` as the external payload passed into `eventSerializer.deserializeSnapshot` / `eventSerializer.deserialize`.
  - Keep header-only semantics for routing/branching while leaving `subscribedStreams.recentEvents` as internal snapshot/update events.

After this step, both server and client treat DataSource events as `{ header, content }` with a shared meaning; the client’s reducers continue to aggregate internal snapshots and updates while the LifeLine subscription and action payloads are explicitly envelope-shaped.

---

## Step 6 (COMPLETED): Tests and Validation

### 6.1 `mtw-lambda-patterns` tests

File: `packages/mtw-lambda-patterns/ts/dataSource/index.test.ts`

- Update tests that:
  - Construct synthetic streaming events for `subscribe()`.
  - Assert on payloads passed into `receiveEvents`.

They should now assert that:

- `subscribedEventTypeGuard` sees a `StreamingEventHeader`.
- `receiveEvents` receives an array of `StreamingEventEnvelope` instances.

### 6.2 Lambda DataSource tests

Files:

- `lambda/wml/dataSource/mtw-wml.test.ts`
- `lambda/assets/dataSource/index.test.ts`
- Tests for contentHeaders, characters, library, players
- `lambda/ephemera/dataSource/index.test.ts`

- Update all test event constructions to use `{ header, content }` and adjust expectations accordingly.

### 6.3 Behavior checks

For each family (WML, assets, ephemera):

- Walk one or two representative flows through:
  - EventBridge → lambda gate → messageBus → `DataSource.subscribe` → `receiveEvents`
- Confirm that:
  - Emitted events/snapshots to SNS/WebSocket are unchanged.
  - Dynamo writes and other side effects match prior behavior.

### 6.4 Completed

All mtw-lambda-patterns and lambda DataSource tests were audited and updated to use and assert on `{ header, content }`. Behavior checks were performed for WML, assets, and ephemera (full test suites plus targeted flow coverage); all tests pass and observable behavior (emitted events/snapshots, Dynamo writes, side effects) is unchanged. Completed 2025-02-12.

---

## Step 7: Future `getInternal` and Sidecar Work (Context Only)

Once the header/content split is fully implemented:

- A follow-up refactor can introduce `getInternal(): Promise<Internal>` on the envelope, with:
  - `content` remaining the single external source of truth (inline or `{ sidecarUri }`).
  - `getInternal` implemented per DataSource using existing serializers and sidecar loaders.
- Routing/typeguards will continue to use `header` only, so the lazy step focuses purely on how handlers obtain internal payloads, not on how they decide which events to handle.

This document is intentionally scoped to the **structural header/content refactor**; lazy evaluation and sidecar semantics are handled in `AGENT.delegation.planning.md` and future implementation docs.

