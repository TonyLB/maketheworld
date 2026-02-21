# streamEvent Envelope Alignment

**Status**: PLANNING
**Scope**: Align `DataSource.streamEvent` to accept `StreamingEventEnvelope` instead of `{ update, streamKey, header }`. Enables consistent use of `getContent('external')` for storage and EventBridge, preserving sidecars when present.
**Related**: [AGENT.streamingEnvelope.reversability.planning.md](AGENT.streamingEnvelope.reversability.planning.md), `packages/mtw-lambda-patterns/ts/dataSource/`

---

## Problem

`streamEvent` receives internal content (`{ update, streamKey, header }`). It derives external via `serialize(internal)` for storage and EventBridge. Aligning on envelopes lets `streamEvent` use `getContent('external')` for storage and EventBridge, preserving sidecars when the envelope carries them.

## Proposed Solution: streamEvent Accepts Envelope

Align `streamEvent` to accept `StreamingEventEnvelope` as input:

- **Create path**: Call sites wrap internal content in `createInternalOriginEnvelope(header, content, serializer)` and pass the envelope.
- **Storage**: `streamEvent` uses `await envelope.getContent('external')` for DynamoDB storage, preserving sidecars when present.
- **Publish**: Full flow: store + EventBridge + messageBus. Pass the envelope itself to the messageBus (subscribers call `getContent()` when they need the content).

## High-Level Implementation Steps

1. **Refactor streamEvent signature**
   - Change `streamEvent(params: StreamEventParams)` to `streamEvent(envelope: StreamingEventEnvelope)`.
   - Use `getContent('external')` for storage and EventBridge; pass the envelope itself to the messageBus (subscribers call `getContent()` when they need the content).

2. **Extract storage primitive**
   - Factor shared logic: `coreFormat = { header: envelope.header, update: await envelope.getContent('external') }`; `toDynamoDBFormat(coreFormat, ...)`; `putItem`.

3. **Migrate create call sites**
   - Find all `streamEvent({ update, streamKey, header })` callers.
   - Replace with `streamEvent(createInternalOriginEnvelope(header, content, this.eventSerializer))` where `header` is the full header (dataSourceKey, streamKey, timestamp, type) and `content` is internal. The DataSource supplies `this.eventSerializer` and base header fields; call sites supply type, extended fields, and content.

4. **Update tests**
   - DataSource index.test.ts, streamEventPublisher.test.ts.
   - Lambda DataSource tests (assets, wml, ephemera).
   - Add sidecar preservation test: internal-origin envelope with sidecarred serialize output → streamEvent → verify stored `update` preserves sidecar.

## Key Files

| Area | Files |
|------|-------|
| streamEvent impl | `packages/mtw-lambda-patterns/ts/dataSource/index.ts` |
| Envelope utilities | `packages/mtw-lambda-patterns/ts/dataSource/streamEventPublisher.ts` |
| Create call sites | `lambda/wml/dataSource/mtw-wml.ts`, `lambda/assets/dataSource/index.ts`, `lambda/assets/library/index.ts`, `lambda/assets/players/index.ts`, `lambda/assets/contentHeaders/index.ts`, `lambda/assets/characters/index.ts`, `lambda/assets/dataSource/caching/*.ts` |
| Tests | `packages/mtw-lambda-patterns/ts/dataSource/index.test.ts`, lambda `*/*/index.test.ts`, `*/*/abstract.test.ts` |

---

## Getting Started

1. **Read the parent planning document**
   - [AGENT.streamingEnvelope.reversability.planning.md](AGENT.streamingEnvelope.reversability.planning.md) — Problem (homology gap), solution (getContent format), Phases 1–2c (complete), Phase 3 (pending).
   - **Why**: This work is a side-quest to improve Phase 3’s design. Phase 3 will wire `getContent('external')` for storage; this alignment makes that wiring natural by having `streamEvent` operate on envelopes.

2. **Read the DataSource pattern**
   - [packages/mtw-lambda-patterns/ts/dataSource/AGENT.md](packages/mtw-lambda-patterns/ts/dataSource/AGENT.md) — Serialization Boundary, streamEvent method.
   - [packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md](packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) — Header/Content Envelope Model, `createInternalOriginEnvelope`, `coreFormatToStreamingEnvelope`.

3. **Review current streamEvent usage**
   - `rg "streamEvent\("` in `lambda/` and `packages/mtw-lambda-patterns/`.
   - Understand how callers build `{ update, streamKey, header }` and where they get the serializer (DataSource has it).

4. **Run tests before starting**
   - `cd packages/mtw-lambda-patterns && npm run test -- --testPathPattern=dataSource --watchAll=false`
   - Lambda tests: WML (242), Assets (120), Ephemera (104).
   - Establish baseline before changing the streamEvent contract.

---

## Post-Completion Context

**How we got here:**

- [AGENT.streamingEnvelope.reversability.planning.md](AGENT.streamingEnvelope.reversability.planning.md) Phase 3 calls for wiring `getContent('external')` for storage paths.
- An initial Phase 3 plan proposed `storeEventFromEnvelope` as a separate mirror API.
- We chose instead to align `streamEvent` on envelopes: one API, sidecar preservation via `getContent('external')`, better long-term design. We rejected a `mirrorOnly` option (storing events a DataSource never published) as it would muddy authority boundaries and create multiple sources of truth.

**Where to return ("pop the stack") after finishing:**

1. **Resume Phase 3 of [AGENT.streamingEnvelope.reversability.planning.md](AGENT.streamingEnvelope.reversability.planning.md)**.
   - With `streamEvent` envelope-aligned, Phase 3 reduces to: add sidecar preservation tests; update the planning doc to record Phase 3 completion.
2. Then return to **mtw.wml replayability** — [AGENT.delegation.planning.mtw-wml-replayability.md](AGENT.delegation.planning.mtw-wml-replayability.md).
3. Continue with delegation and DataSource planning as needed — [documentation/dataSources/AGENT.delegation.planning.md](documentation/dataSources/AGENT.delegation.planning.md).
