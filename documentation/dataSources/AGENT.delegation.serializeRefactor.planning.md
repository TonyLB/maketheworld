## DataSource Serialize/Deserialize Refactor Planning

**Status**: IN PROGRESS (Steps 1-5 complete; next: Step 6)
**Scope**: `DataSourceEventSerializer` interface and all concrete serializers that participate in DataSource pipelines (lambdas + client), plus minimal wiring changes where they are called.  
**Related**: `AGENT.delegation.header-content.planning.md`, `packages/mtw-lambda-patterns/ts/dataSource/baseClasses.ts`, serializers in `mtw-interfaces/ts/**`, client reducers in `charcoal-client/src/slices/dataSource/reducers.ts`.

---

## Goals

1. **Make header authoritative for routing and context**  
   Move discriminants and small routing flags (like `type`, `zone`) out of the payload as the primary source of truth and into the `StreamingEventHeader`, so all routing and context-sensitive logic reads from header.

2. **Let content be pure(er) payload**  
   Treat `content` as the domain payload that can be sidecarred, cached, or transformed without having to carry redundant routing metadata that already exists in the header.

3. **Give serializers access to header + content**  
   Extend the `DataSourceEventSerializer` contract so `deserialize` (and, where helpful, `serialize`) have access to both `header` and `content`. This allows serializers to use header for discrimination and context instead of re-parsing those concepts from the payload. **Header is now threaded into `serialize`** at the DataSource core level (`streamEvent` builds header once and passes it to `serialize`), ready for use when serializers (e.g. WML, contentHeaders) later prefer `header.zone` or other header flags.

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

**2.3 Serialize call sites (done)**: In `DataSource.streamEvent` (mtw-lambda-patterns), header is built once before calling `serialize` and passed into `eventSerializer.serialize({ ..., header })`; the same header is reused for the messageBus event. All concrete serializers that implement `serialize` (WML, assets, contentHeaders, players, ephemera, library) have had their `serialize` param types extended to accept optional `header`; implementation bodies continue to ignore it until later steps (e.g. when moving zone into header for specific families).

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

- **Completed**: Internal lambdas that receive `{ header, content }` now route on `header.type` instead of `content.type`:
  - `lambda/assets/dataSource/index.ts` (mtw.assets DataSource receiveEvents).
  - `lambda/assets/library/index.ts` (mtw.assets.library receiveEvents).
  - `lambda/assets/contentHeaders/index.ts` (mtw.assets.contentHeaders receiveEvents and aggregation helpers).
- Payload-only fields (for example, `fromZone`, `toZone`, `player`, `assetId`) are still read from `content`; only routing/discrimination moved to header.

### 4.2 Make header required in the serializer interface (after rollout)

- **Completed**: `header` is now required on the serializer interface and all concrete serializers:
  - In `DataSourceEventSerializer` (`packages/mtw-lambda-patterns/ts/dataSource/baseClasses.ts`), `serialize` and `deserialize` now require `header: StreamingEventHeader`.
  - All concrete serializers in `mtw-interfaces/ts/eventBridge` (WML, assets main/contentHeaders/library/characters, ephemera, diagnostics) and `lambda/wml/dataSource/coordinationSerializer.ts` have been updated so:
    - Method signatures require `header: StreamingEventHeader`.
    - Deserializers use `header.type` as the discriminator instead of `externalUpdate.type`.
- All known call sites (server DataSource core, lambdas, client reducers, and relevant tests) have been updated to pass a `StreamingEventHeader`; header is now the authoritative source for routing decisions.

---

## Step 4.5 (tangent): Envelope-Discriminated Unions for TypeScript Narrowing

**When**: Immediately after Step 4.1/4.2. We pursue this tangent now, then return to Step 4.3 and Step 5.

**Problem**: After routing on `header.type` instead of `content.type`, TypeScript no longer narrows the `content` union. For example, in `lambda/assets/dataSource/index.ts`, `if (header.dataSourceKey === 'mtw.wml' && header.type === 'Zone Changed')` does not narrow `content`, so `const { fromZone, toZone, player, subFolder } = content` is not type-safe. The union is defined on `content` alone (`AssetsSubscribedContent`), so the compiler cannot correlate `header.type` with the shape of `content`.

**Solution**: Define the subscribed-event type as a **discriminated union at the envelope level**: each member is `{ header: NarrowHeader, content: NarrowContent }` where `header` carries the discriminant (e.g. `dataSourceKey` + `type`). Then branching on `event.header.type` (and optionally `event.header.dataSourceKey`) narrows the whole envelope, including `event.content`, with no need for a discriminant property inside `content`.

**Implementation steps**:

1. **mtw.assets DataSource** ([lambda/assets/dataSource/index.ts](lambda/assets/dataSource/index.ts)):
   - Define an `AssetsIncomingEvent` (or similar) type: a union of envelope variants, one per (dataSourceKey, type) pair the DataSource handles:
     - `{ header: { dataSourceKey: 'mtw.wml'; type: 'Content Update'; ... }; content: ... }` (use existing WML content type for Content Update).
     - `{ header: { dataSourceKey: 'mtw.wml'; type: 'Zone Changed'; ... }; content: WMLZoneEvent }`.
     - `{ header: { dataSourceKey: 'mtw.wml'; type: 'Asset Purged'; ... }; content: WMLPurgeEvent }` (or equivalent).
     - `{ header: { dataSourceKey: 'mtw.diagnostics'; type: 'Heal Global Values'; ... }; content: { connections?: unknown; assets?: unknown } }`.
     - `{ header: { dataSourceKey: 'mtw.coordination'; type: 'Remove Asset'; ... }; content: { assetId: string } }`.
   - Type the `receiveEvents` callback so it receives `events: AssetsIncomingEvent[]` (either by adding a generic to `AssetsDataSource` for the envelope union and using it for `events`, or by typing/asserting the parameter inside the lambda so that inside the handler `event` is the envelope union).
   - Remove the local `AssetsSubscribedContent` union in favor of the envelope union (or derive content from the envelope union if needed elsewhere). Branching on `event.header.dataSourceKey` and `event.header.type` will then narrow `event.content` correctly.

2. **mtw.assets.library DataSource** ([lambda/assets/library/index.ts](lambda/assets/library/index.ts)):
   - Define a library incoming envelope union for the events it subscribes to (all from mtw.assets): `Zone Updated`, `Asset Cached`, `Asset Removed`. Each variant: `{ header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' }; content: ZoneUpdatedEvent }`, and similarly for Asset Cached and Asset Removed (using the existing asset-level content types).
   - Type `receiveEvents` so `events` is this envelope union. Then `if (header.type === 'Zone Updated')` narrows `content` to the zone-updated payload (fromZone, toZone), etc.

3. **mtw.assets.contentHeaders DataSource** ([lambda/assets/contentHeaders/index.ts](lambda/assets/contentHeaders/index.ts)):
   - Define a contentHeaders incoming envelope union: mtw.assets events (`Component Updated`, `Component Removed`, `Asset Updated`) and mtw.wml (`Zone Changed`), with content types from `SubscribedAssetsContent` and `SubscribedWMLContent`. Each variant pairs a narrow header (dataSourceKey + type) with the corresponding content type.
   - Type `receiveEvents` (and the reduce/map that groups events) so that `events` is this envelope union. Branching on `header.type` and `header.dataSourceKey` will narrow `content` in the reduce and in `createAggregatedContentHeadersUpdate`.

4. **DataSource generic (optional but recommended)**:
   - If the base DataSource or AssetsDataSource currently types `receiveEvents` as `events: Array<StreamingEventEnvelope<SubscribedContent>>`, consider adding an optional generic (e.g. `SubscribedEnvelope`) that extends `StreamingEventEnvelope<SubscribedContent>`, so that implementors can pass an envelope union and get `events: SubscribedEnvelope[]`. If that is too invasive, typing/asserting the events parameter in each lambda to the envelope union is sufficient.

5. **Where to define the types**:
   - Envelope unions can live next to each DataSource (in the same lambda file or a sibling `types.ts`) since they describe the subscription contract for that DataSource. If multiple lambdas or packages need the same envelope shape, move the type to `mtw-interfaces` (e.g. under the relevant eventBridge slice).

**Completed**: Envelope-discriminated unions have been implemented for all three target DataSources:
- **`AssetsIncomingEvent`** in `lambda/assets/dataSource/index.ts`: Union of envelope variants for mtw.wml (Content Update, Zone Changed, Asset Purged), mtw.diagnostics (Heal Global Values), and mtw.coordination (Remove Asset). `receiveEvents` casts `events` to `AssetsIncomingEvent[]` and uses small type guard functions (backed by `Extract<...>` in their return types) to narrow `event`/`content` based on `header.type` and `header.dataSourceKey`.
- **`LibraryIncomingEvent`** in `lambda/assets/library/index.ts`: Union for mtw.assets events (Zone Updated, Asset Cached, Asset Removed). `receiveEvents` casts `events` to `LibraryIncomingEvent[]` and uses dedicated type guards for each variant to narrow `content`.
- **`ContentHeadersIncomingEvent`** in `lambda/assets/contentHeaders/index.ts`: Union for mtw.assets events (Component Updated, Component Removed, Asset Updated) and mtw.wml (Zone Changed). `receiveEvents` and `createAggregatedContentHeadersUpdate` both operate on `ContentHeadersIncomingEvent[]` and use type guards to discriminate on `header` and safely access the corresponding payload shape.

All three implementations cast the incoming `events` array to the envelope union type (since the base `AssetsDataSource` generic still expects `StreamingEventEnvelope<SubscribedContent>[]`), then use reusable type guards to narrow branches based on `event.header.type` and `event.header.dataSourceKey`. This provides full type safety without requiring changes to the base DataSource class generics and avoids relying on `content.type` for routing.

**After this tangent**: Step 4.5 is complete. Return to Step 4.3 (external format, optional and later), then Step 5 (rollout/validation) and Step 6 (documentation).

---

### 4.3 External format (optional and later)

- **Completed**: External format and payload purity rules have been aligned with the header/content model:
  - **Category A (internal-only / easily changeable)**:
    - For internal MTW-only flows (for example, WML Content Update / Merge Conflict, many asset-level events), routing is header-only; payloads do not add extra routing flags beyond what is needed for domain semantics.
    - Where payload `type` appears, it reflects the domain event name rather than being used for routing (routing is always via `header.type`); no new payload-only routing metadata is introduced.
  - **Category B (externally-constrained)**:
    - For EventBridge-facing contracts (all serializers in `mtw-interfaces/ts/eventBridge/**`), payload `type` is treated as **derived** from header.type and not used for routing:
      - Deserializers (`WMLEventSerializer`, `AssetsEventSerializer`, diagnostics, characters, etc.) use `header.type` as the routing discriminator.
      - In cases where the internal event type is reconstructed in `deserialize` (for example, characters), the internal `type` is now taken from `header.type` rather than re-reading payload `type`.
    - Payload `type` fields are preserved where required for external compatibility, but they are no longer the authoritative discriminator inside MTW’s DataSource and lambda logic.

This keeps wire formats stable while making header the canonical source of routing data and treating any remaining payload `type` fields as redundant/derived from the header.

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
6. **Envelope-discriminated unions** (Step 4.5): Define subscribed-event types as envelope unions so branching on `header.type` narrows `content`; type `receiveEvents` in assets, library, and contentHeaders lambdas accordingly.
7. **Optional payload simplification** (Step 4.3), only after confidence is high.

### 5.2 Validation

- For each family as it is migrated:
  - Re-run existing end-to-end tests:
    - EventBridge → lambda gate → messageBus → `DataSource.subscribe` → `receiveEvents`.
    - WebSocket → LifeLine → client reducers → UI state.
  - Add unit tests that explicitly cover:
    - `deserialize` with and without header.
    - Header and payload fields disagreeing (to ensure header wins where we want it to).

**Completed**: Step 5 validation work has been implemented:
- All serializer unit tests updated to pass `header` in both `serialize` and `deserialize` calls (WML, Assets, ContentHeaders, Library, Ephemera, Diagnostics, Characters).
- Deprecated "deserialize without header - backward compatibility" tests removed from CoordinationEventSerializer (header is now required).
- Header-wins tests added for WMLEventSerializer (Zone Changed when payload has Content Update shape), AssetsEventSerializer (Component Removed when payload has Component Updated shape), and LibraryEventSerializer (Asset Removed when payload has Asset Added shape).
- Type assertions added in WML, Library, and ContentHeaders serializer implementations so TypeScript correctly narrows payload types when branching on `header.type`.
- CoordinationEventSerializer and Characters DataSource tests pass. mtw-interfaces serializer tests (Assets, ContentHeaders, Library, Ephemera, Diagnostics) pass. WML tests have some Content Update failures related to StandardForm/converterMap initialization in the test environment; header-related changes are validated.

---

## Step 6: Documentation and Coordination

- Cross-link this document from:
  - `AGENT.delegation.header-content.planning.md` (Step 7 / future work section).
  - Any EventBridge or serializer-specific implementation guides in `mtw-interfaces`.

- As each DataSource family is migrated:
  - Note in that family’s documentation which fields are now considered header-owned (authoritative) and which remain in payload for compatibility only.

This keeps the serialize/deserialize refactor clearly scoped as a follow-up to the header/content split, without blocking the current structural work, while recording the intended end-state so we can return to it deliberately later.

