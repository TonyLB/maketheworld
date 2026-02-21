# Streaming Envelope Reversability (Homology Restoration)

**Status**: PHASE 3 DEFERRED — returning to mtw.wml replayability (Phase 1: COMPLETE, Phase 2a: COMPLETE, Phase 2b: COMPLETE, Phase 2c: COMPLETE)  
**Scope**: `StreamingEventEnvelope` / `getContent` contract in mtw-lambda-patterns and lambda apps.  
**Related**: `packages/mtw-lambda-patterns/ts/dataSource/`, `AGENT.delegation.planning.mtw-wml-replayability.md`, `documentation/dataSources/AGENT.delegation.planning.md`

**Note**: Phase 3 (wire `streamEnvelope` at storage call sites) is deferred. The homology machinery (Phases 1–2) is complete and unblocks mtw.wml replayability. Phase 3 will be addressed when storage paths are added as part of that work. This document will be **revisited and likely removed** after mtw.wml replayability is complete.

---

## Problem: Homology Gap

We used to have homologous external and internal representations: round-trips in either direction were stable.

With sidecar storage, that breaks:

- **External** (e.g. `{ wml: { sidecarUrl: string } }`) is deserialized to **internal** (e.g. `StandardFormData`).
- The envelope exposes only `getContent()` — internal content only.
- The original external payload (including sidecar) is closed over but never exposed.
- There is **no way** to recover the original sidecar from `getContent()` after deserialization.
- Round-trip: external sidecar → internal → serialize → external inline (sidecar lost).

This blocks:

- **Storage for replay**: When we store events to Dynamo (e.g. via `streamEvent`), we need external format for sidecar preservation. If we only have internal and re-serialize, we may lose the sidecar. The fix: use `getContent('external')` for storage when we have an envelope.
- **mtw.wml replayability**: When making `mtw.wml` replayable, we need to store snapshots and events that may be sidecarred. Without access to external format at storage time, we cannot preserve the sidecar in Dynamo.

---

## Proposed Solution: `getContent(format?)`

- Extend `getContent` (Phase 1 rename complete) with an optional format argument.
- `getContent()` (or `getContent('internal')`) — lazy evaluation of internal format (current behavior).
- `getContent('external')` — return the original external payload (including sidecar, when available).
- Localize construction and typing in the existing utility `coreFormatToStreamingEnvelope` (and/or new `createEventBridgeEnvelope`).

### Construction Sites

| Site                         | Origin   | External source              | Internal source     | Utility                          |
|-----------------------------|----------|------------------------------|---------------------|----------------------------------|
| EventBridge handlers        | External | Preserved `update`           | Via deserialize     | `coreFormatToStreamingEnvelope` / `createEventBridgeEnvelope` |
| DataSource `streamEvent`    | External | Preserved `coreFormat.update`| Caller's update     | `coreFormatToStreamingEnvelope`  |
| DataSource `streamEnvelope` | Envelope | `await envelope.getContent('external')` | Caller passes envelope | Caller constructs envelope; DataSource uses `getContent('external')` for storage |
| subscribedEvents send-helpers | Internal | Derived via serialize     | Caller's content    | `createInternalOriginEnvelope`   |

**Internal-origin envelopes**: Events synthesized locally (API handlers, messageBus send) have internal content only. Use `createInternalOriginEnvelope` so `getContent('external')` runs `serializer.serialize({ content, header })` on demand. Uniform contract: `getContent('external')` always returns external-shaped data.

### Utilities

| Utility                      | Use when              | `getContent()`        | `getContent('external')`          |
|-----------------------------|-----------------------|------------------------|-----------------------------------|
| `coreFormatToStreamingEnvelope` | External at construction | Lazy deserialize   | Preserved `coreFormat.update`     |
| `createInternalOriginEnvelope`  | Internal at construction | Inline content    | Derived via `serializer.serialize`|

```ts
createInternalOriginEnvelope<Content, Header, External = unknown>(
  header: Header,
  content: Content,
  serializer: { serialize(params: { content: Content; header: Header }): External }
): StreamingEventEnvelope<Content, Header, External>
```

### Implementation Approach: Option 2 (Rename First, Then Add Format)

Incremental changes, each tested against the full pipeline. No parallel APIs; no backward-compat alias (internal repo only).

### Phase 1: Rename (No Behavior Change) — DONE

- Rename `getContentInternal` → `getContent` everywhere:
  - Types: `StreamingEventEnvelope`, `StreamingEventPayloadContract`, `StreamingEventPayload`, lambda `StreamingEventMessage`.
  - Base classes: `packages/mtw-lambda-patterns/ts/dataSource/baseClasses.ts`.
  - Lambda messageBus contracts: `lambda/*/messageBus/baseClasses.ts`.
  - All call sites: `await event.getContentInternal()` → `await event.getContent()`.
  - Structure guards: `typeof message.getContentInternal === 'function'` → `typeof message.getContent === 'function'`.
  - Tests and mocks.
- Verification: Full test run. No logic changes; mechanical rename.

### Phase 2a: Extend StreamingEventEnvelope with External Type Parameter

- Add third generic to `StreamingEventEnvelope<Content, Header, External = unknown>`:
  - Enables type-safe return for `getContent('external')` when overloads are added.
  - Default `External = unknown` keeps existing code compiling.
- Update `StreamingEventPayloadContract`, `StreamingEventPayload`, lambda `StreamingEventMessage` to carry `External` where applicable.
- Extend `makeStreamingEnvelopeGuardFromHeaderGuard` and `makeResolvedEnvelopeGuardFromHeaderGuard` to accept optional `External` type and narrow to `StreamingEventEnvelope<Content, H, External>`.
- Update subscribedEvents envelope unions and variant guards to specify `External` where known (e.g. WML, contentHeaders); use default `unknown` elsewhere.
- Update `coreFormatToStreamingEnvelope` and (later) `createInternalOriginEnvelope` signatures to accept `External`; construction sites will pass it through.
- Verification: Full test run. No runtime behavior change; type definitions updated.

### Phase 2b: Add Optional Format Argument (External-Origin Only)

- Update `getContent` signature to accept optional format:
  - `getContent(): Promise<Content>` — default, returns internal (current behavior).
  - `getContent(format: 'internal'): Promise<Content>`.
  - `getContent(format: 'external'): Promise<CoreExternalFormat['update']>` — returns external when available.
- Add TypeScript overloads to envelope types. Keep `Content` and `External` as generics where applicable.
- **External-origin** (preserve external, derive internal via deserialize):
  - **EventBridge handlers**: Close over `update` (external). `getContent()` → deserialize; `getContent('external')` → `Promise.resolve(update)`.
  - **DataSource streamEvent**: Close over `coreFormat.update`. `getContent()` → `Promise.resolve(internal)`; `getContent('external')` → `Promise.resolve(coreFormat.update)`.
  - **coreFormatToStreamingEnvelope**: Extend to return `getContent` that branches on format; preserve `coreFormat.update` for `getContent('external')`.
- **Internal-origin** (subscribedEvents send-helpers): Extend `getContent` to accept format arg; `getContent()` / `getContent('internal')` → current behavior; `getContent('external')` → throw (not yet supported until Phase 2c).
- Verification: Full test run. Existing call sites use `getContent()` — unchanged behavior. External-origin envelopes support `getContent('external')`.

### Phase 2c: Add Internal-Origin Support (Serialize on Demand)

- Add `createInternalOriginEnvelope(header, content, serializer)` in `streamEventPublisher.ts`.
- `getContent()` → `Promise.resolve(content)`; `getContent('external')` → `Promise.resolve(serializer.serialize({ content, header }))`.
- Migrate subscribedEvents send-helpers to use `createInternalOriginEnvelope` (pass serializer).
- Uniform contract: `getContent('external')` always returns external-shaped data across all envelope types.
- Verification: Full test run. Internal-origin envelopes now support `getContent('external')` via serialize.

### Phase 3: Wire `getContent('external')` for Storage Paths — READY TO START

**Prerequisites (complete):** `streamEnvelope(envelope)` was added as a parallel API to `streamEvent(params)`. It accepts `StreamingEventEnvelope` and uses `await envelope.getContent('external')` for DynamoDB and EventBridge. `receiveEvents` receives both `streamEvent` and `streamEnvelope`. See [AGENT.implementation.md](packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md#choosing-streamevent-vs-streamenvelope) for when to use each.

- Identify call sites that need external for Dynamo storage (e.g. forward/replay flows that must preserve sidecars).
- Wire those flows to use `streamEnvelope(envelope)` instead of `streamEvent(params)` when they have an envelope to preserve.
- Add tests for sidecar preservation (external → store → load → external unchanged).
- Verification: End-to-end test of storage path with sidecarred payload.

### Key Files by Phase

| Phase | Files |
|-------|-------|
| 1 | `baseClasses.ts`, lambda `messageBus/baseClasses.ts`, `streamEventPublisher.ts`, `index.ts`, lambda `app.ts`, `subscribedEvents.ts`, DataSource `receiveEvents` handlers, tests |
| 2a | `baseClasses.ts` (StreamingEventEnvelope, envelope guards), `streamEventPublisher.ts` (signatures), `subscribedEvents.ts` (envelope unions) |
| 2b | `baseClasses.ts`, `streamEventPublisher.ts` (`coreFormatToStreamingEnvelope`), lambda `app.ts`, `index.ts` (streamEvent), `subscribedEvents.ts` (getContent format arg + throw for `external`) |
| 2c | `streamEventPublisher.ts` (`createInternalOriginEnvelope`), `subscribedEvents.ts` (send-helpers) |
| 3 | DataSource storage logic; `receiveEvents` call sites that should use `streamEnvelope` for preservation (e.g. forward/replay flows) |

### Dynamo Usage

- `getContent('external')` plus `toDynamoDBFormat({ header, update }, primaryKeyName, eventId)` — no `getContent('Dynamo')` needed.

### Phase 1 Completed (2025-02-21)

- Renamed `getContentInternal` -> `getContent` across all types, base classes, lambda messageBus contracts, construction sites, call sites, tests, and documentation.
- Verification: DataSource tests (110 passed), WML lambda (242 passed), Assets lambda (120 passed), Ephemera lambda (104 passed).
- `getContentInternal` now appears only in this document (problem/solution framing for Phase 2).

### Phase 2a Completed (2025-02-21)

- Added third generic `External = unknown` to `StreamingEventEnvelope<Content, Header, External>` in baseClasses.ts.
- Extended `makeStreamingEnvelopeGuardFromHeaderGuard` and `makeResolvedEnvelopeGuardFromHeaderGuard` with optional `External` type; narrow to `StreamingEventEnvelope<Content, H, External>`.
- Updated `coreFormatToStreamingEnvelope` in streamEventPublisher.ts to accept `External` generic defaulting to `CoreExternalFormat['update']`.
- SubscribedEvents envelope guards use implicit `External = unknown` (no changes required).
- Verification: DataSource tests (110 passed), WML lambda (242 passed), Assets lambda (120 passed), Ephemera lambda (104 passed), mtw-interfaces (251 passed). No runtime behavior change; type definitions only.

### Phase 2b Completed (2025-02-21)

- Added `getContent(format?: 'internal' | 'external')` overloads to `StreamingEventEnvelope`, `StreamingEventPayloadContract`, `StreamingEventPayload` in baseClasses.ts.
- Extended `coreFormatToStreamingEnvelope` to return `getContent` that branches on format; `getContent('external')` returns `coreFormat.update`.
- Refactored EventBridge handlers (lambda/wml, assets, ephemera app.ts) to use `coreFormatToStreamingEnvelope` for envelope construction.
- Extended DataSource `streamEvent` in index.ts to support `getContent('external')` via `coreFormat.update`.
- Extended internal-origin send-helpers (subscribedEvents, initSubscription, assets/app cacheAsset) to accept format arg; `getContent('external')` throws until Phase 2c.
- Updated lambda messageBus `StreamingEventMessage` contract to `getContent(format?: 'internal' | 'external')`.
- Verification: DataSource tests (112 passed), WML lambda (242 passed), Assets lambda (120 passed), Ephemera lambda (104 passed). External-origin envelopes support `getContent('external')`; internal-origin throw until Phase 2c.

### Phase 2c Completed (2025-02-21)

- Added `createInternalOriginEnvelope(header, content, serializer)` in streamEventPublisher.ts.
- Migrated subscribedEvents send-helpers (WML: sendApplyEdit, sendMoveAsset, sendPurgeAsset; Assets players: sendPlayerSettingsUpdated) to use `createInternalOriginEnvelope`.
- Migrated initSubscription send-helpers (WML, Assets) to use `createInternalOriginEnvelope`.
- Migrated assets/app.ts cacheAsset case to use `createInternalOriginEnvelope`.
- Uniform contract: `getContent('external')` returns external-shaped data across all envelope types.
- Verification: DataSource tests (115 passed), WML lambda (242 passed), Assets lambda (120 passed), Ephemera lambda (104 passed). Internal-origin envelopes now support `getContent('external')` via serialize.

---

## Getting Started

1. **Read the DataSource Pattern**
   - **[packages/mtw-lambda-patterns/ts/dataSource/AGENT.md](packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)** — Serialization Boundary, CoreExternalFormat.
   - **[packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md](packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md)** — Header/Content Envelope Model, `coreFormatToStreamingEnvelope`, Serialization regimes, envelope guards (`makeStreamingEnvelopeGuardFromHeaderGuard`).
   - **Why**: This work changes the envelope contract; understanding the current boundary is essential.

2. **Read This Document**
   - Problem → Solution → Implementation sketch (Phases 1, 2a, 2b, 2c, 3).
   - **Key Insight**: The gap is that external is never exposed after deserialize; the fix is to retain and expose it at construction.
   - **Phase 2a**: Before adding `External` type parameter, understand `StreamingEventEnvelope` and the envelope guard pattern in baseClasses.

3. **Review Construction Sites**
   - [packages/mtw-lambda-patterns/ts/dataSource/baseClasses.ts](packages/mtw-lambda-patterns/ts/dataSource/baseClasses.ts) — `StreamingEventEnvelope`, envelope guards (`makeStreamingEnvelopeGuardFromHeaderGuard`, `makeResolvedEnvelopeGuardFromHeaderGuard`), `StreamingEventPayloadContract`.
   - [packages/mtw-lambda-patterns/ts/dataSource/streamEventPublisher.ts](packages/mtw-lambda-patterns/ts/dataSource/streamEventPublisher.ts) — `coreFormatToStreamingEnvelope`, `createInternalOriginEnvelope`.
   - [lambda/wml/app.ts](lambda/wml/app.ts), [lambda/assets/app.ts](lambda/assets/app.ts), [lambda/ephemera/app.ts](lambda/ephemera/app.ts) — EventBridge envelope construction.
   - [packages/mtw-lambda-patterns/ts/dataSource/index.ts](packages/mtw-lambda-patterns/ts/dataSource/index.ts) — `streamEvent` messageBus send.
   - [lambda/wml/dataSource/subscribedEvents.ts](lambda/wml/dataSource/subscribedEvents.ts), [lambda/assets/players/subscribedEvents.ts](lambda/assets/players/subscribedEvents.ts), [lambda/assets/dataSource/subscribedEvents.ts](lambda/assets/dataSource/subscribedEvents.ts) — envelope unions, variant guards, internal-origin send-helpers.

4. **Run Tests Before Starting**
   - `cd packages/mtw-lambda-patterns && npm run test -- --testPathPattern=dataSource --watchAll=false`
   - Establish baseline before changing the envelope contract.

---

## Post-Completion Context

**How we got here:**

- Making `mtw.wml` replayable (see [AGENT.delegation.planning.mtw-wml-replayability.md](AGENT.delegation.planning.mtw-wml-replayability.md)).
- Replayability requires storing snapshots and events to Dynamo, including sidecarred payloads.
- The current envelope only exposes internal content via `getContent`; the original external (sidecar) is discarded after deserialize.
- We cannot store what we do not have: the homology gap blocks storage to Dynamo for sidecarred payloads.

**Where to return ("pop the stack") after finishing Phase 3:**

1. Return to **mtw.wml replayability** — [AGENT.delegation.planning.mtw-wml-replayability.md](AGENT.delegation.planning.mtw-wml-replayability.md).
2. Continue with delegation and DataSource planning as needed — [documentation/dataSources/AGENT.delegation.planning.md](documentation/dataSources/AGENT.delegation.planning.md).

**Current state (2025-02-21):** Returning to mtw.wml replayability now. Phase 3 deferred; will be completed when wiring storage paths for mtw.wml. See mtw.wml replayability doc for post-completion step to revisit this document.
