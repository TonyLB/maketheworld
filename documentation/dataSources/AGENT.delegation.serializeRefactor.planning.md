## DataSource Serialize/Deserialize Refactor Planning

**Status**: IN PROGRESS (Steps 1-2 complete; Step 3 pilot complete)  
**Scope**: `DataSourceEventSerializer` interface and all concrete serializers that participate in DataSource pipelines (lambdas + client), plus minimal wiring changes where they are called.  
**Related**: `AGENT.delegation.header-content.planning.md`, `packages/mtw-lambda-patterns/ts/dataSource/baseClasses.ts`, serializers in `mtw-interfaces/ts/**`, client reducers in `charcoal-client/src/slices/dataSource/reducers.ts`.

---

## Goals

1. **Make header authoritative for routing and context**  
   Move discriminants and small routing flags (like `type`, `zone`) out of the payload as the primary source of truth and into the `StreamingEventHeader`, so all routing and context-sensitive logic reads from header.

2. **Let content be pure(er) payload**  
   Treat `content` as the domain payload that can be sidecarred, cached, or transformed without having to carry redundant routing metadata that already exists in the header.

3. **Give serializers access to header + content**  
   Extend the `DataSourceEventSerializer` contract so `deserialize` (and, where helpful, `serialize`) have access to both `header` and `content`. This allows serializers to use header for discrimination and context instead of re-parsing those concepts from the payload.

4. **Preserve existing external contracts and behavior**  
   Maintain wire formats and observable behavior during the migration. Redundancy between header and content is acceptable during the transition; the goal is to change what code *reads*, not what the network shape *is*, at least initially.

---

## Current Shape (re: serialization)

Today:

- `DataSourceEventSerializer` in `mtw-lambda-patterns` exposes:

  ```ts
  deserialize(params: {
      dataSourceKey: string;
      streamKey: string;
      externalUpdate: ExternalUpdatePayload;
  }): UpdatePayload | null;
  ```

  - No header argument.
  - Implementations switch on `externalUpdate.type` and read any extra context (for example, zones) from the payload.

- The header/content refactor has introduced:
  - `StreamingEventHeader` (authoritative `type`, plus optional flags).
  - `StreamingEventEnvelope<{ header, content }>` in core DataSource plumbing.
  - Client-side `ClientStreamingHeader` and `{ header, content }` payloads for reducers.

- However:
  - Serializers and deserializers are still called with **content only**, so they depend on the payload containing `type` and any other semantics they need.
  - This creates redundancy between header and content that is being **preserved for compatibility**, not because the new architecture truly needs it.

This document plans the follow-up refactor to align serializers with the header/content model without blocking the current structural work.

---

## Step 1: Extend Serializer Interface (Backwards-Compatible)

**Completed**: Interface extended in `baseClasses.ts`; optional `header?: StreamingEventHeader` added to both `deserialize` and `serialize`. All existing call sites and implementations remain valid.

### 1.1 Add optional header parameter to `deserialize` (done)

File: `packages/mtw-lambda-patterns/ts/dataSource/baseClasses.ts`

- Extend the `DataSourceEventSerializer` interface so `deserialize` *can* receive header and timestamp in addition to the current parameters, in a backwards-compatible way:

  ```ts
  deserialize(params: {
      dataSourceKey: string;
      streamKey: string;
      externalUpdate: ExternalUpdatePayload;
      header?: StreamingEventHeader;
  }): UpdatePayload | null;
  ```

- Notes:
  - Existing implementations that ignore `header` remain valid.
  - Callers that do not yet have header available (or have not been updated) can simply omit it.

### 1.2 Consider similar extension for `serialize` (done)

- If helpful, extend `serialize` similarly:

  ```ts
  serialize(params: {
      dataSourceKey: string;
      streamKey: string;
      update: UpdatePayload;
      header?: StreamingEventHeader;
  }): ExternalUpdatePayload;
  ```

- This is not strictly required for the initial migration (the main pressure is on `deserialize`), but it future-proofs serializers that want to make header-aware choices when going from internal to external.

---

## Step 2: Thread Header Into Deserialize Call Sites

**Completed**: All server-side gates (assets, WML, ephemera lambdas) and the client reducer now pass `header` into `deserialize`. Header is built from EventBridge/coreFormat or from the client payload so it matches the header used for messageBus routing. Concrete serializers used by these gates have had their `deserialize` param types updated to accept optional `header` (no implementation changes; serializers still use `externalUpdate.type` until Step 3).

### 2.1 Server-side DataSource receive paths

Files:

- `packages/mtw-lambda-patterns/ts/dataSource/index.ts`
- Lambda gates that call serializers (for example, WML, assets, ephemera)

- Where we currently do:

  ```ts
  const internalEvent = eventSerializer.deserialize({
      dataSourceKey,
      streamKey,
      externalUpdate
  });
  ```

- Update incrementally to:

  ```ts
  const internalEvent = eventSerializer.deserialize({
      dataSourceKey,
      streamKey,
      externalUpdate,
      header
  });
  ```

- Important:
  - `header` should be the same header used for messageBus routing (`StreamingEventHeader`).
  - Do **not** change serializer implementations yet; they can continue to use `externalUpdate.type` for discrimination until they are explicitly migrated.

### 2.2 Client-side reducers

Files:

- `charcoal-client/src/slices/dataSource/reducers.ts`

- Where we currently do:

  ```ts
  const event = eventSerializer.deserialize({
      dataSourceKey,
      streamKey,
      externalUpdate: content
  });
  ```

- Update to mirror the server:

  ```ts
  const event = eventSerializer.deserialize({
      dataSourceKey,
      streamKey,
      externalUpdate: content,
      header
  });
  ```

- This keeps client/server deserialization symmetric and ensures all serializers can rely on the same signature.

---

## Step 3: Migrate Serializers to Use Header (Incremental, One Family at a Time)

**Completed (pilot)**: CoordinationEventSerializer now prefers `header?.type` with fallback to `externalUpdate.type`. New unit tests in [lambda/wml/dataSource/coordinationSerializer.test.ts](../../lambda/wml/dataSource/coordinationSerializer.test.ts) cover: discrimination from header when present; header wins when header and payload type disagree; backward compatibility when header is omitted; and round-trip with header.

### 3.1 Choose a pilot DataSource family

- Pick a family where:
  - Events already use more complex header semantics (for example, WML coordination, assets with zones).
  - The serializer implementation is well-tested and lives in a relatively self-contained file (for example, `lambda/wml/dataSource/coordinationSerializer.ts` or its shared `mtw-interfaces` counterpart).

### 3.2 Update serializer implementation to prefer header

- For the chosen serializer:

  - Change the implementation body from:

    ```ts
    deserialize({ externalUpdate }) {
        if (externalUpdate.type === 'Some Event') {
            // ...
        }
        // ...
    }
    ```

  - To a pattern that:
    - Switches primarily on `params.header?.type` when present.
    - Falls back to `externalUpdate.type` only if header is missing (for safety during rollout).

    ```ts
    deserialize({ externalUpdate, header }) {
        const eventType = header?.type ?? externalUpdate.type;

        if (eventType === 'Some Event') {
            // Use header for routing-level flags (for example, zone) when available
            const zone = header?.zone ?? (externalUpdate as any).zone;
            // Build internal event from externalUpdate and header context
            // ...
        }

        // ...
    }
    ```

- This preserves behavior even if some callers are still not passing header, while making header the authoritative source where it is present.

### 3.3 Add or adjust tests for the migrated serializer

- For the pilot serializer:
  - Add tests that:
    - Call `deserialize` with both `header` and `externalUpdate` and assert that:
      - Discrimination is correct based on `header.type`.
      - Context fields (for example, zone) are taken from header when present.
    - Call `deserialize` without `header` and verify that:
      - Behavior matches the previous implementation (backward compatibility).

- This establishes a clear pattern for future serializer migrations.

---

## Step 4: Gradually Reduce Reliance on Redundant Payload Fields

### 4.1 Internal code: stop reading routing fields from content

- Once a serializer and its call sites consistently pass header:
  - Audit internal code around that serializer (lambdas and client) for places that still inspect `content.type` or payload-level routing metadata.
  - Replace those with reads from the header (`header.type`, `header.zone`, etc.) as appropriate.

- This does not require any external contract changes and can be done incrementally.

### 4.2 Make header required in the serializer interface (after rollout)

- **When**: After Step 2 and Step 3 are complete for all DataSource families (all call sites pass `header`, all serializers read from it with fallback).
- **Change**: In `DataSourceEventSerializer`, make `header` a required parameter for both `deserialize` and `serialize` (remove the `?`).
- **Effect**: TypeScript then enforces that every caller supplies header and every serializer can assume it is present; the fallback `header?.type ?? externalUpdate.type` pattern can be simplified to `header.type`.
- **Prerequisite**: No call site may omit header; all serializers must be migrated first so that this change is a type-only tightening with no behavioral change.

### 4.3 External format (optional and later)

- If and when we want to further simplify payloads:
  - Consider introducing a stricter notion of payload purity for new event types:
    - Header is required to carry `type` and routing flags.
    - Payload formats for new events are defined without embedded `type` fields.
  - For existing event types that must keep `type` in the external contract, treat `externalUpdate.type` as a derived or redundant field:
    - Header remains the authoritative source for routing.
    - Payload `type` is maintained for backward compatibility with any downstream consumers that still expect it.

This phase is intentionally deferred until after header-aware deserialization is well established.

---

## Step 5: Rollout Strategy and Safety Checks

### 5.1 Sequence of changes

1. **Interface extension** (Step 1):
   - Safe, additive change in `mtw-lambda-patterns`.
   - No behavior change.

2. **Call site updates** (Step 2):
   - Pass header into `deserialize` on both server and client.
   - Still no behavior change, because serializers ignore the new field.

3. **Pilot serializer migration** (Step 3 for one family):
   - Serializer begins reading from header when available, but falls back to payload.
   - New tests lock in behavior.

4. **Broader serializer rollout**:
   - Repeat Step 3 for each DataSource family:
     - WML, assets (main and contentHeaders/characters/library/players), ephemera, etc.

5. **Make header required** (Step 4.2): Tighten the interface so `header` is required; simplify serializers to use `header` only.
6. **Optional payload simplification** (Step 4.3), only after confidence is high.

### 5.2 Validation

- For each family as it is migrated:
  - Re-run existing end-to-end tests:
    - EventBridge → lambda gate → messageBus → `DataSource.subscribe` → `receiveEvents`.
    - WebSocket → LifeLine → client reducers → UI state.
  - Add unit tests that explicitly cover:
    - `deserialize` with and without header.
    - Header and payload fields disagreeing (to ensure header wins where we want it to).

---

## Step 6: Documentation and Coordination

- Cross-link this document from:
  - `AGENT.delegation.header-content.planning.md` (Step 7 / future work section).
  - Any EventBridge or serializer-specific implementation guides in `mtw-interfaces`.

- As each DataSource family is migrated:
  - Note in that family’s documentation which fields are now considered header-owned (authoritative) and which remain in payload for compatibility only.

This keeps the serialize/deserialize refactor clearly scoped as a follow-up to the header/content split, without blocking the current structural work, while recording the intended end-state so we can return to it deliberately later.

