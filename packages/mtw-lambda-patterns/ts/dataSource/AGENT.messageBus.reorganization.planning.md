# MessageBus Reorganization Planning

This document records findings from auditing messageBus usage and DataSource integration, starting with the **WML lambda**. The goal is to align message types with the lazy-evaluation refactor (`getContentInternal`) and to apply the same insights to other call sites (e.g. assets, ephemera) later.

## Context: Lazy evaluation refactor

DataSources now receive events as **`StreamingEventEnvelope<Content>`** with content obtained via `getContentInternal()` rather than a synchronous `content` property. MessageBus senders may provide optional `getContentInternal` on streaming event messages; the DataSource `subscribe()` callback in the patterns package builds the envelope using:

```ts
getContentInternal: streamingEvent.getContentInternal ?? (() => Promise.resolve(streamingEvent.content))
```

So both shapes (eager `content` only, or lazy `getContentInternal` with optional `content`) are supported at runtime. Type definitions in each lambda's messageBus baseClasses should reflect what is actually sent so that types stay in sync with behavior.

---

## WML lambda findings

### Message types (lambda/wml/messageBus/baseClasses.ts)

The WML messageBus defines three streaming event types that all use `type: 'StreamingEvent'` but differ by `dataSourceKey` and content shape:

| Type | dataSourceKey | Content shape | getContentInternal |
|------|---------------|---------------|--------------------|
| **StreamingEventMessage** | `'internal'` | `CoordinationEventUpdate` | *(was missing in type; see below)* |
| **InitializeSubscriptionEventMessage** | `'mtw.subscriptions'` | `{ sessionId, requestId }` | N/A (not used) |
| **ExternalStreamingEventMessage** | `string` (e.g. mtw.coordination, mtw.diagnostics) | `unknown` | optional |

### Disconnect identified and corrected

- **StreamingEventMessage** was typed with `content: CoordinationEventUpdate` and **no** `getContentInternal`. In practice, `app.ts` sends internal events (applyEdit, moveAsset, purgeAsset) with **both** `content` and `getContentInternal: () => Promise.resolve(content)`. The DataSource layer uses `getContentInternal` when building the envelope, so runtime behavior was already correct; the type was out of date.
- **Correction**: Add `getContentInternal?: () => Promise<CoordinationEventUpdate>` to `StreamingEventMessage` so the type matches what is sent and aligns with `ExternalStreamingEventMessage`.

### Usage summary (WML)

1. **StreamingEventMessage (internal)**  
   - **Produced**: `app.ts` WebSocket handlers for `applyEdit`, `moveAsset`, `purgeAsset`.  
   - **Consumed**: DataSource `subscribe()` (streamingEventTypeGuard passes when `header.dataSourceKey === 'internal'` and type in COORDINATION_EVENT_TYPES). Envelope is built and passed to `receiveEvents`.  
   - **Handlers**: `mtw-wml.ts` uses `event.getContentInternal()` in processApplyEdit, processMoveAsset, processPurgeAsset, canonize/decanonize, create snapshot.

2. **InitializeSubscriptionEventMessage**  
   - **Produced**: `app.ts` when handling EventBridge `mtw.subscriptions` / "Initialize Subscription - mtw.wml".  
   - **Consumed**: `subscribeToInitializeEvents()` in the patterns package (separate subscription). Callback uses `payload.content` and `payload.streamKey` directly; no envelope, no getContentInternal.

3. **ExternalStreamingEventMessage**  
   - **Produced**: `app.ts` when handling EventBridge events from `mtw.coordination` or `mtw.diagnostics` (deserialized to internal form; message has `content` and `getContentInternal`).  
   - **Consumed**: Same DataSource `subscribe()` as internal events (WML subscribes to `mtw.diagnostics`; coordination types also pass the guard when relevant).  
   - **Handlers**: e.g. `processS3StructureFinding` calls `event.getContentInternal()` and narrows the result.

### Type guard note

`isStreamingEventMessage` narrows to `StreamingEventMessage` only, but at runtime the same `type: 'StreamingEvent'` shape is used for all three message variants. The patterns package does not rely on that guard; it uses separate filters (initialize vs. content events). So the guard is only for separating streaming events from ReturnValue/Error in WML code if needed.

---

## Refactoring possibility: envelope-on-bus + contract assurance + Option A

This section describes a concrete refactoring direction for evaluation. It combines: (1) messages on the bus that are streaming events **are** already envelope-shaped; (2) `streamingEventTypeGuard` as defensive contract assurance; (3) Option A so `subscribedEventTypeGuard` operates on envelopes and provides type narrowing.

### Contract: the bus carries envelope messages

- **Publish side**: Senders put **envelope-shaped** messages on the bus. A streaming event message has the shape `{ header, getContentInternal }` (and any other fields in the contract). Construction of that shape happens at **send** time (e.g. in app.ts or wherever we call `messageBus.send(...)`).
- **Bus**: The messageBus carries these messages as-is. No transformation from "raw message" to "envelope" in the bus or in the DataSource subscription path.
- **Subscribe side**: Subscribers receive envelope messages. We **validate** and **filter** them; we do **not** build envelopes in the DataSource pattern.

So "build an envelope" language does not apply in the subscription path. We receive envelopes, assure the contract, filter, and pass through.

### Role of `streamingEventTypeGuard`: defensive contract assurance

- **Re-envisioned purpose**: Assure that the message on the messageBus **is** a valid StreamingEvent envelope (contract compliance). The guard answers: "Is this value a well-formed StreamingEvent envelope?" (required shape, `header`, `getContentInternal`, etc.)
- **Not**: Building an envelope from a raw message, or extracting a header to pass to another guard. We are **validating** that the message already conforms to the envelope contract.
- **Implication**: Implementing code (each lambda's messageBus and send sites) is responsible for putting envelope-shaped messages on the bus; this guard is the defensive check that the contract is being followed.

### Role of `subscribedEventTypeGuard`: envelope type guard (Option A)

- **New signature**: Operates on **envelope** messages, not just `StreamingEventHeader`. For example: `(envelope: StreamingEventEnvelope<BroadPayload>) => envelope is StreamingEventEnvelope<SubscribedContent>`.
- **Responsibilities**: (1) Runtime filtering: does this DataSource subscribe to this envelope? (2) Type narrowing: TypeScript narrows to `StreamingEventEnvelope<SubscribedContent>`. One guard, one source of truth for both.
- **DataSources pull**: Each DataSource supplies an envelope type guard that narrows from the bus's broad envelope type to its own `SubscribedContent`. The pattern applies this guard and passes only narrowed envelopes to `receiveEvents`; no cast, type derived from the guard.

### MessageBus / baseClasses: broad union

- Each lambda's `messageBus/baseClasses.ts` encodes a **single broad union** of what can be published onto that bus (all streaming event payloads that any publisher might send, or a coarse type). Subscribers care about subsets; they narrow via their envelope type guard.
- The bus does not list per-subscriber variants; it describes "what can be on the bus." DataSources describe "what I subscribe to" via their envelope type guard and `SubscribedContent` generic.

### Subscription flow (after refactor)

1. MessageBus delivers messages (already envelope-shaped for streaming events).
2. **`streamingEventTypeGuard`**: Used as the subscription filter. Defensive check per message: "Is this a valid StreamingEvent envelope?" Messages that fail never reach the callback.
3. Callback runs with **payloads**: the envelope messages that passed the filter (step 2). No separate batching step; the messageBus invokes the callback with exactly those payloads.
4. **`subscribedEventTypeGuard`**: Applied to each payload (or to the array). Envelope type guard: filter and narrow to `StreamingEventEnvelope<SubscribedContent>` for this DataSource. Only narrowed envelopes are passed on.
5. Pass narrowed envelopes to `receiveEvents`. TypeScript type comes from the guard; no cast.

### Spheres of authority (summary)

| Layer | Responsibility |
|-------|----------------|
| **Publish sites** | Build envelope-shaped messages when sending streaming events. |
| **messageBus / baseClasses** | Define broad union of publishable message types; bus carries messages as-is. |
| **`streamingEventTypeGuard`** | Defensive: assure the message on the bus is a valid StreamingEvent envelope (contract compliance). |
| **`subscribedEventTypeGuard`** | Envelope type guard: filter and narrow to this DataSource's `SubscribedContent`; single source of truth for runtime and type. |

### What we do *not* do in this vision

- We do **not** build envelopes in the DataSource subscription callback. Envelopes are built at publish time.
- We do **not** extract a header from a raw message to call a header-only guard; the guard operates on the envelope.
- We do **not** rely on a generic + annotation alone for the type of `events` in `receiveEvents`; the type is derived from the envelope type guard.

### Trade-off: no compile-time header/payload alignment

We accept a deliberate trade-off between **compile-time safety** and **bus simplicity/maintainability**:

- **What we give up**: The MessageBus has a **broad** type constraint (e.g. `WMLStreamingPayload` union). We do **not** get compile-time guarantees that the **header** (e.g. `dataSourceKey`, `type`) and the **payload** returned by `getContentInternal()` are aligned. A sender could combine an `mtw.coordination` header with a `DiagnosticsEventUpdate` payload and the type system would not object. The stream-event contract check only validates **structure** (has header, getContentInternal, etc.). The `subscribedEventTypeGuard` only inspects the header and **assumes** the payload matches; it cannot verify without calling `getContentInternal()`. So **sending sites must get it right**; mistakes show up at runtime.

- **What we get**: We could technically enforce header/payload alignment at compile time only by having the MessageBus (and baseClasses) **know about every individual subscribed payload** and encode the link between header discriminants and payload types (e.g. a discriminated union or overloaded `send()`). That would bloat the bus layer and tie it to every DataSource's domain types (coordinationSerializer, diagnostics, init shape, etc.), increasing maintenance cost and inverting the desired dependency direction. By keeping the bus **dumb** with a single broad type, we keep baseClasses small, avoid the bus depending on subscriber payload types, and let DataSources own their narrow view via their envelope type guard. New events are "add to the broad union and add a send site," not "change the bus's type algebra."

So: we trade away **header/payload compile-time safety at the bus** for **lower complexity and maintenance at the bus** and **clear separation** (bus = transport, DataSources = domain).

### Optional: typed send-helpers

We can recover **sender-side compile-time safety** without giving up the dumb bus by introducing **typed send-helpers** in a per-DataSource `subscribedEvents` module. The concrete pattern, prototype (WML), and prospective rollout are described in **Prototype: WML subscribedEvents.ts** and **Prospective change: subscribedEvents as DataSource standard** below.

### Prototype: WML subscribedEvents.ts

A prototype of the subscribed-events pattern (types + envelope type guards + typed send-helpers) was implemented for the WML DataSource. Results are recorded here so the same pattern can be applied at other DataSource sites (e.g. assets, ephemera).

- **Location**: [lambda/wml/dataSource/subscribedEvents.ts](../../../../lambda/wml/dataSource/subscribedEvents.ts)

- **Contents**:
  - **Types**: `WMLSubscribedPayload` (union of `CoordinationEventUpdate | DiagnosticsEventUpdate`). Re-export of `COORDINATION_EVENT_TYPES` from coordinationSerializer for use by the DataSource's `subscribedEventTypeGuard`.
  - **Envelope type guards**: Six guards moved from mtw-wml.ts — `isApplyEditEnvelope`, `isMoveAssetEnvelope`, `isCanonizeOrDecanonizeEnvelope`, `isCreateSnapshotEnvelope`, `isPurgeAssetEnvelope`, `isDiagnosticsEnvelope`. Same logic and signatures; they narrow `StreamingEventEnvelope<WMLSubscribedPayload>` to the specific payload type for each branch.
  - **Send-helpers**: Three typed helpers for the internal coordination events that app.ts sends: `sendApplyEdit(bus, streamKey, content)`, `sendMoveAsset(bus, streamKey, content)`, `sendPurgeAsset(bus, streamKey, content)`. Init and ExternalStreamingEvent are unchanged (no helpers in this prototype).

- **Consumers**:
  - **mtw-wml.ts**: Imports `WMLSubscribedPayload`, `COORDINATION_EVENT_TYPES`, and all six envelope type guards from `./subscribedEvents`. Uses them in the DataSource constructor and in `receiveEvents`. No local definition of types or guards.
  - **app.ts**: Imports `sendApplyEdit`, `sendMoveAsset`, `sendPurgeAsset` from `./dataSource/subscribedEvents`. For the `applyEdit`, `moveAsset`, and `purgeAsset` cases, builds the content object and calls the corresponding helper instead of constructing the message inline. Passes `messageBus` as the first argument to each helper.

- **Send-helper signature pattern**: `sendX(bus, streamKey, content: XRequest)`. The helper builds `header` (dataSourceKey: 'internal', streamKey, timestamp, type from content) and the envelope shape expected by the bus (`StreamingEventMessage`), then calls `bus.send(...)`. The bus parameter is typed as `{ send: (payload: StreamingEventMessage) => void }` so the module does not import the messageBus instance and tests can inject a mock.

- **Decisions / gotchas**:
  - Bus is passed in as the first argument to every send-helper to avoid coupling subscribedEvents to the messageBus singleton and to keep tests injectable.
  - Message shape remains the current `StreamingEventMessage` from messageBus/baseClasses; no change to the DataSource or messageBus contract.
  - Payload types (ApplyEditRequest, MoveAssetRequest, PurgeAssetRequest) are imported from coordinationSerializer in subscribedEvents.ts; the file also imports `StreamingEventMessage` from `../messageBus/baseClasses` for the bus parameter type.

- **Replication at other DataSource sites**: Add a `subscribedEvents.ts` (or equivalent name) in that DataSource's directory. Define or re-export (1) the subscribed payload type and any payload types used by guards/helpers, (2) the envelope type guards that narrow to those payloads, and (3) typed send-helpers for each event kind that send sites publish. Have the DataSource implementation import types and guards from that file; have send sites import and call the helpers, passing the messageBus (or test double) as the first argument. The same pattern gives sender-side compile-time safety without changing the bus.

### subscribedEvents as DataSource standard (rollout complete)

**Current state:** The subscribedEvents pattern (types, envelope type guards, and typed send-helpers) is the **standard for DataSource implementations**. Rollout is complete: WML, ephemera, and all five assets DataSource sites have a `subscribedEvents.ts` in their directory; the pattern is documented in [AGENT.implementation.md](AGENT.implementation.md). MessageBus and DataSource contracts are unchanged (e.g. `subscribedEventTypeGuard` remains `(header) => boolean`; the "envelope-on-bus + Option A" refactor below has not been done).

**Decisions** (as implemented):

1. **Send-helper scope**: Send-helpers are needed only for events that *this lambda* publishes to its own messageBus. We do not add helpers for events this lambda only forwards from EventBridge. Before rollout we audit each lambda: where does it call messageBus.send and for which event shapes? Only those get send-helpers in that lambda's subscribedEvents.

2. **Init and other special subscriptions**: Leave Initialize Subscription (and similar control/bootstrap events) out of subscribedEvents for now. They stay on their separate subscription path; no convention yet for describing them in the subscribedEvents file.

3. **Naming and location**: Standardize on **`subscribedEvents.ts`** in the **same directory as the DataSource implementation** (the directory that contains the file which instantiates the DataSource). So for WML that is `lambda/wml/dataSource/subscribedEvents.ts`; for assets top-level, `lambda/assets/dataSource/subscribedEvents.ts`; for assets.players, `lambda/assets/players/subscribedEvents.ts`; and so on.

4. **Payload types from upstream**: SubscribedEvents imports payload types from wherever they are defined (sibling module, mtw-interfaces, etc.); it owns the subscription union, envelope guards, and send-helpers. Implementers do not move upstream type definitions into subscribedEvents.

5. **Testing**: We do not require unit tests for send-helpers; they are simple enough that requiring tests would be over-engineering. Rely on existing handler/integration tests.

6. **Multiple DataSources in one lambda**: We already have **one DataSource per directory**. In the assets lambda there are five DataSources, each in its own directory (`dataSource/`, `players/`, `library/`, `contentHeaders/`, `characters/`). So one `subscribedEvents.ts` per directory is sufficient—each directory has exactly one DataSource, and that directory gets one subscribedEvents file. No need for DataSource-prefixed filenames (e.g. `mtw-wml.subscribedEvents.ts`) unless we ever introduce multiple DataSource implementations in the same directory, which we do not have today.

### Possible future refactor: WML lambda types (sketch, not implemented)

How the types in `lambda/wml/messageBus/baseClasses.ts` and `lambda/wml/dataSource/mtw-wml.ts` **would** look if we later adopt envelope-on-bus + contract assurance + Option A. The codebase does **not** currently follow this sketch; it is retained for future consideration.

#### messageBus/baseClasses.ts (after)

- **ReturnValueMessage**, **ErrorMessage**: Unchanged.
- **One broad streaming type** (replaces StreamingEventMessage, InitializeSubscriptionEventMessage, ExternalStreamingEventMessage): The bus carries envelope-shaped messages only. Define a single type that describes "any streaming event that can be published on this bus," with a **broad payload union** for what `getContentInternal()` can return, e.g.:

  ```ts
  // Broad union: every payload type any publisher might put on the bus.
  export type WMLStreamingPayload =
      | CoordinationEventUpdate
      | DiagnosticsEventUpdate
      | { sessionId: string; requestId: string }   // init
      | unknown   // or explicit external payloads if preferred

  // Envelope-on-bus: what senders send and what the subscription filter sees.
  export type StreamingEventMessage = {
      type: 'StreamingEvent';
      header: StreamingEventHeader;
      getContentInternal: () => Promise<WMLStreamingPayload>;
      streamKey: string;
      timestamp: number;
      // optional content for backward compat or debugging if desired
  }
  ```

- **MessageType** = ReturnValueMessage | ErrorMessage | StreamingEventMessage. No per-subscriber or per-variant streaming types; one envelope shape, one broad payload union.
- **Contract for defensive guard**: The shape above is what `streamingEventTypeGuard` validates (has `type`, `header`, `getContentInternal`, etc.). We might export a type like `ValidStreamingEventEnvelope` or use `StreamingEventMessage` as the contract type.
- **Re-exports**: `StreamingEventHeader` (and any types the patterns package needs) still re-exported. No `isStreamingEventMessage` narrow to a specific payload; it can remain "is this a StreamingEvent?" for non-DataSource code if needed.

Init vs. content: Init is just one kind of envelope on the bus (header.type / dataSourceKey identifies it). The init subscription uses its own filter (e.g. envelope with `dataSourceKey === 'mtw.subscriptions'` and the right header.type); the wmlDataSource content subscription uses its envelope type guard. Same message shape, different filters.

#### mtw-wml.ts DataSource (after)

- **WMLSubscribedPayload**: Unchanged. `CoordinationEventUpdate | DiagnosticsEventUpdate` — the union this DataSource subscribes to.
- **Aggregate envelope type guard** (replaces the boolean `subscribedEventTypeGuard`): Same logic as today, but as a type predicate on the envelope so TypeScript narrows. Supplied to the DataSource constructor as `subscribedEventTypeGuard`:

  ```ts
  const isWMLSubscribedEnvelope = (
      e: StreamingEventEnvelope<WMLStreamingPayload>
  ): e is StreamingEventEnvelope<WMLSubscribedPayload> =>
      (e.header.dataSourceKey === 'internal' && COORDINATION_EVENT_TYPES.has(e.header.type)) ||
      e.header.dataSourceKey === 'mtw.diagnostics'
  ```

- **Per-event envelope guards**: Unchanged. `isApplyEditEnvelope`, `isMoveAssetEnvelope`, `isPurgeAssetEnvelope`, `isCanonizeOrDecanonizeEnvelope`, `isCreateSnapshotEnvelope`, `isDiagnosticsEnvelope` — they still narrow `StreamingEventEnvelope<WMLSubscribedPayload>` to the specific payload type for each branch. They stay in mtw-wml.ts; no need to move them to baseClasses.
- **DataSource constructor**: Pass `subscribedEventTypeGuard: isWMLSubscribedEnvelope` (the envelope type guard). The pattern will filter with it and pass only narrowed envelopes to `receiveEvents`.
- **receiveEvents**: No cast. `events` is already `Array<StreamingEventEnvelope<WMLSubscribedPayload>>` because the pattern applied the envelope type guard. We iterate and use the per-event guards to branch; no `event as StreamingEventEnvelope<WMLSubscribedPayload>`.

#### Summary table

| Concern | Today | After refactor |
|--------|--------|-----------------|
| **baseClasses streaming types** | Three named types (internal, init, external) with different shapes | One broad `StreamingEventMessage` (envelope shape + `WMLStreamingPayload`) |
| **baseClasses role** | Define each variant publishers can send | Define contract + broad union; subscribers narrow |
| **subscribedEventTypeGuard** | `(header) => boolean` in mtw-wml | `(envelope) => envelope is StreamingEventEnvelope<WMLSubscribedPayload>` in mtw-wml |
| **receiveEvents events type** | Generic + cast to `WMLSubscribedPayload` | Derived from envelope type guard; no cast |
| **Per-event guards** | In mtw-wml, narrow to Apply Edit / Move Asset / etc. | Unchanged; still in mtw-wml |

### Practical implications (if the future refactor is done)

- **Init vs. content subscriptions**: How does "Initialize Subscription" fit? Separate subscription that also receives envelope-shaped messages, or a distinct message shape that stays outside the envelope contract?
- **Migration**: Changes to DataSource constructor (envelope type guard signature), patterns package `subscribe()` (no envelope construction; contract check + envelope guard), and all call sites (supply envelope type guard; senders already sending envelope shape).
- **Broad union definition**: Per-lambda; what goes in the broad union and how coarse (e.g. `unknown` vs. explicit union of all payload types).
- **Testing**: Existing tests that mock messages or envelopes may need to align with the new contract and guard signatures.

---

## Other call sites (audit complete)

Rollout to assets and ephemera is done. For future lambdas or type-safety checks, keep in mind:

- Ensure every message type that is sent **with** `getContentInternal` declares it in the type (optional where backward compatibility is desired).
- Ensure any message that flows into DataSource `receiveEvents` is documented as producing envelopes via `getContentInternal ?? (() => Promise.resolve(content))`.
