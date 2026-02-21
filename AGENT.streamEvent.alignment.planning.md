# streamEnvelope: Envelope-Accepting Publishing API

**Status**: PLANNING
**Scope**: Add `streamEnvelope(envelope)` alongside `streamEvent(params)`. Enables more sophisticated transform and filter patterns: preserve sidecars, forward external-origin events, publish sidecar-bearing results (e.g. S3 snapshotting). Not about mirroring subscriber data; about having the right tools for how we transform and filter.
**Related**: [AGENT.streamingEnvelope.reversability.planning.md](AGENT.streamingEnvelope.reversability.planning.md), `packages/mtw-lambda-patterns/ts/dataSource/`

---

## Problem

We need more sophisticated tools for how we transform and filter events before publishing. Today we have one golden-path API: `streamEvent(params)` accepts resolved internal content (`{ update, streamKey, header }`) and derives external via `serialize(internal)` for storage and EventBridge. That works well when a DataSource receives a resolved event, computes a resolved result, and publishes it. But it does not support:

1. **Preserving sidecars** — Events we receive may already have sidecarred payloads (e.g. from EventBridge or replay). When we forward or store them, we must preserve the original external format. Re-deriving via `serialize(internal)` can inline or alter the payload and loses the sidecar.

2. **Publishing envelope-shaped results** — Some flows produce sidecar-bearing output (e.g. S3 storage of large snapshots). We need a way to publish envelopes that carry `getContent('external')` for storage and EventBridge, without forcing the caller through the params-based path.

**Avoid a false binary**: "Preserve" (pass-through) and "derive via serialize(internal)" are endpoints, not the full spectrum. With field-level sidecar possibilities, we will need flows that do custom surgery on the structure: e.g. a payload with `spreadSheet: sidecarrable` and `flags: JSON`; a derived DataSource alters spreadSheet when a flag is set, passes it unchanged otherwise, and always transforms flags. That result is neither "preserve the original" nor "serialize(internal)" — it is partial preservation plus partial transform. We should not constrain derived events to go only through `streamEvent`. `streamEnvelope` accepts envelopes however they were produced: preserve, derive, custom surgery, or hybrid.

**Not about mirroring**: This is not about mirroring or replaying subscriber data unchanged. It is about having the right primitives for transform and filter pipelines that may need to preserve, forward, or emit envelope-shaped payloads (including sidecars).

## Proposed Solution: Add streamEnvelope Alongside streamEvent

Keep `streamEvent(params)` as the golden-path utility for the common case (resolved-in, resolved-out). Add `streamEnvelope(envelope)` for envelope-accepting flows.

- **streamEvent(params)** — Unchanged. Golden path: DataSource receives resolved event, computes resolved result, publishes. Simple params interface.

- **streamEnvelope(envelope)** — New. Accepts `StreamingEventEnvelope`; uses `await envelope.getContent('external')` for DynamoDB and EventBridge; passes envelope to messageBus. Use when:
  - Forwarding or storing external-origin events (preserve sidecars).
  - Publishing envelope-shaped results (e.g. S3 snapshotting).
  - Partial preservation + partial transform (custom surgery on structure; e.g. field-level sidecars).
  - Any flow where the caller has or constructs an envelope.

Both share the same wire format and storage behavior (unresolved envelopes, `getContent('external')` for storage). The distinction is the calling pattern, not the output.

## High-Level Implementation Steps

1. **Add streamEnvelope implementation**
   - Add `streamEnvelope(envelope: StreamingEventEnvelope)` on DataSource.
   - Use `coreFormat = { header: envelope.header, update: await envelope.getContent('external') }`; `toDynamoDBFormat`; `putItem`; EventBridge; messageBus.
   - Extract shared storage primitive if helpful; both streamEvent and streamEnvelope use `getContent('external')` for the stored payload.

2. **Wire receiveEvents with streamEnvelope**
   - Pass `streamEnvelope` alongside `streamEvent` to `receiveEvents` callback (e.g. `{ streamEvent, streamEnvelope }`).
   - Call sites that forward or preserve envelopes use `streamEnvelope`; golden-path flows keep using `streamEvent`.

3. **Add tests**
   - streamEnvelope: external-origin envelope with sidecarred payload → verify stored `update` preserves original sidecar.
   - streamEvent: unchanged behavior; existing tests pass.
   - Document when to use each API in AGENT.implementation.md.

## Key Files

| Area | Files |
|------|-------|
| streamEvent / streamEnvelope impl | `packages/mtw-lambda-patterns/ts/dataSource/index.ts` |
| Envelope utilities | `packages/mtw-lambda-patterns/ts/dataSource/streamEventPublisher.ts` |
| receiveEvents callback | `index.ts` subscribe callback; DataSource `receiveEvents` signature |
| Call sites (future streamEnvelope use) | `lambda/wml/dataSource/`, `lambda/assets/dataSource/`, etc. |
| Tests | `packages/mtw-lambda-patterns/ts/dataSource/index.test.ts` |

---

## Getting Started

1. **Read the parent planning document**
   - [AGENT.streamingEnvelope.reversability.planning.md](AGENT.streamingEnvelope.reversability.planning.md) — Problem (homology gap), solution (getContent format), Phases 1–2c (complete), Phase 3 (pending).
   - **Why**: This work supports Phase 3 (wire `getContent('external')` for storage). `streamEnvelope` is the envelope-accepting path; Phase 3 call sites that need preservation use it.

2. **Read the DataSource pattern**
   - [packages/mtw-lambda-patterns/ts/dataSource/AGENT.md](packages/mtw-lambda-patterns/ts/dataSource/AGENT.md) — Serialization Boundary, streamEvent method.
   - [packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md](packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) — Header/Content Envelope Model, `createInternalOriginEnvelope`, `coreFormatToStreamingEnvelope`.

3. **Review current streamEvent usage**
   - `rg "streamEvent\("` in `lambda/` and `packages/mtw-lambda-patterns/`.
   - Understand which flows are golden-path (params) vs. which may need envelope-accepting (streamEnvelope).

4. **Run tests before starting**
   - `cd packages/mtw-lambda-patterns && npm run test -- --testPathPattern=dataSource --watchAll=false`
   - Lambda tests: WML (242), Assets (120), Ephemera (104).
   - Establish baseline before adding streamEnvelope.

---

## Post-Completion Context

**How we got here:**

- [AGENT.streamingEnvelope.reversability.planning.md](AGENT.streamingEnvelope.reversability.planning.md) Phase 3 calls for wiring `getContent('external')` for storage paths.
- An earlier plan proposed refactoring `streamEvent` to accept envelopes, collapsing the API into one. That would have broken all call sites and overloaded the golden-path utility.
- We chose instead to add `streamEnvelope(envelope)` as a parallel API. Keep `streamEvent(params)` for the common case (resolved-in, resolved-out). Use `streamEnvelope` for transform/filter flows that need to preserve sidecars, forward external-origin events, or publish envelope-shaped results (e.g. S3 snapshotting). This is not about mirroring subscriber data; it is about having sophisticated tools for how we transform and filter.

**Where to return ("pop the stack") after finishing:**

1. **Resume Phase 3 of [AGENT.streamingEnvelope.reversability.planning.md](AGENT.streamingEnvelope.reversability.planning.md)**.
   - Wire storage paths that need preservation to use `streamEnvelope`; add sidecar preservation tests.
2. Then return to **mtw.wml replayability** — [AGENT.delegation.planning.mtw-wml-replayability.md](AGENT.delegation.planning.mtw-wml-replayability.md).
3. Continue with delegation and DataSource planning as needed — [documentation/dataSources/AGENT.delegation.planning.md](documentation/dataSources/AGENT.delegation.planning.md).
