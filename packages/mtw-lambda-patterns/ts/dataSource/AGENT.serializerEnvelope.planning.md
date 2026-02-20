# DataSource Serializer-Envelope Refactor (Planning)

## 1. Purpose

This document captures a **prerequisite refactor** for the environment-agnostic lazy-envelope work: **move resolution logic (including sidecar fetch and deserialize) into `getContentInternal`**, and have that logic live in (or be invoked by) the **DataSourceEventSerializer** for the majority of cases.

The goal is to:

- Centralize "resolve external payload to internal" (inline vs sidecar, fetch, parse, validate, deserialize) in the serializer, so that `getContentInternal` delegates to it.
- Enable the environment-agnostic refactor (see `AGENT.environmentAgnostic.planning.md`) to proceed with a single, DataSource-owned definition of resolution that can be parameterized by an environment.

This is a planning doc; it does not describe current behavior as already implemented.

## 2. Scope and plan

### Phase 1: Move `getContentInternal` generation into the deserializer

**Goal**: Change the architecture so that the deserializer owns the production of `getContentInternal`, rather than call sites eagerly deserializing and wrapping the result. This phase does **not** yet engage with sidecars on the backend; we assume inline payloads only. Once the architecture is in place, we can plan sidecar handling with concrete code to point at.

**Out of scope for Phase 1**:
- Sidecar resolution on the backend (to be planned in a later phase)
- Client-side sidecar handling (resolveSidecarSnapshot, etc.)
- Initialize Subscription (control payload; does not use the serializer; no change)

**Items**:

1. ~~**Refactor dataSource client-side slice to expect a possibly asynchronous `deserialize`**~~ (DONE):
   - Generate the right kind of thunk to await the deserialize and then call the reducer on the returned values.
   - Audit the LifeLine subscription process to confirm that subscriptions can *execute* that kind of thunk (suspected yes, but verify).

2. **Extend `DataSourceEventSerializer`** (in `packages/mtw-lambda-patterns/ts/dataSource/baseClasses.ts`):
   - Add a method that produces `getContentInternal` given `{ header, update }` in external/core format.
   - Signature concept: `createGetContentInternal(params: { header; update }): () => Promise<InternalContent>`.
   - For Phase 1, the implementation delegates to existing `deserialize({ content: update, header })`; no sidecar, no fetch. The important change is that the *caller* no longer invokes deserialize directly; the deserializer returns a thunk that will do so when `getContentInternal()` is called.

3. **Implement on each backend serializer class**:
   - WML: `WMLEventSerializer` (or equivalent in `mtw-interfaces/ts/eventBridge/wml`)
   - contentHeaders: `ContentHeadersEventSerializer` (or equivalent in `mtw-interfaces`)
   - ephemera: whichever deserializer the ephemera lambda uses
   - Any other DataSources that receive EventBridge events and build messageBus envelopes

4. **Update EventBridge handler call sites** (WML, assets, ephemera app handlers):
   - Stop eagerly calling `deserializer.deserialize({ content: update, header })` before building the messageBus payload.
   - Instead: call `deserializer.createGetContentInternal({ header, update })` and pass the returned function as `getContentInternal` on the StreamingEvent message.
   - Ensure error handling (deserialize returns null) is preserved, but moved into the thunk or the consumer.

5. **Adjust `DataSource.streamEvent`**: No change. It already builds `getContentInternal: () => Promise.resolve(update)` where `update` is internal content; the publisher owns that payload. This path does not go through a deserializer.

**Phase 1 Item 1 completion notes** (done):
- Slice always provides an async thunk that awaits deserialize (or `createGetContentInternal` when available) before dispatching.
- Reducer accepts `__contentResolved: true` for pre-deserialized content; skips deserialize and uses content directly.
- LifeLine and payload shape unchanged; resolution stays inside the slice boundary.
- LifeLine audit: Redux Thunk middleware executes async thunks; subscriptions can run them.

**Success criteria for Phase 1**:
- Client dataSource slice expects and can execute thunks that await `deserialize` (or equivalent) before calling the reducer; LifeLine subscription can run those thunks. (Item 1: done)
- All EventBridge handlers that build StreamingEvent messages use the deserializer's `createGetContentInternal` (or equivalent) instead of eagerly deserializing.
- No behavioral change for inline payloads; only the *location* of the deserialize call moves into the thunk.
- We can point at concrete deserializer code as the single place where resolution (and, later, sidecar) will live.

---

### Phase 2 (planned later): Backend sidecar resolution

- **To be planned** once Phase 1 is done. We need concrete deserializer code in the right place before we can design how sidecar resolution fits in.
- Likely touchpoints: `createGetContentInternal` (or equivalent) would gain awareness of `update.sidecarUrl` and, when present, fetch and parse before deserializing. That logic will live in the serializer.

## 3. Context anchor: why this work exists and what comes next

This section is here explicitly to help us "pop the stack" and remember **why** we are doing this refactor and **how** it connects to the next one.

- **How we got here**: We were planning the environment-agnostic lazy-envelope refactor (this repo's `AGENT.environmentAgnostic.planning.md`). That refactor would let us use the same resolution logic in both backend lambdas and client dataSource slices by injecting a `DataSourceEnvironment`. During that planning, we asked: *Where should resolution (sidecar fetch, parse, deserialize) live?* The natural answer was: in the **DataSourceEventSerializer**, which already owns `deserialize` and `deserializeSnapshot` for domain payloads. We then audited all producers of unresolved envelopes (or their client-side equivalent) and confirmed that the **majority** fit the serializer: EventBridge → messageBus, client StreamEvent with sidecar, and any future replay-from-store path. The only envelope that does **not** fit is Initialize Subscription (control payload `{ sessionId, requestId }`), which stays as a simple resolved envelope.

  So we discovered: we need to **move resolution into `getContentInternal` and into the deserializer** *before* we can profitably do the environment-agnostic refactor. Otherwise we would be parameterizing resolution logic that is still scattered across EventBridge handlers, client `resolveSidecarSnapshot` wrappers, and ad-hoc thunks—instead of centralizing it in one place per DataSource.

- **What this refactor achieves**:
  - EventBridge handlers (WML, assets, ephemera) would build envelopes with a *lazy* `getContentInternal` that calls the serializer's "resolve external → internal" (instead of eagerly deserializing before building the envelope).
  - Client sidecar handling would move from the generic `resolveSidecarSnapshot` wrapper into the serializer (or a thin wrapper that invokes it). The client would build a lazy envelope from the StreamEvent message and resolve via the serializer.
  - One place per DataSource owns: "given external payload (possibly with `sidecarUrl`), produce internal payload." That place is the serializer (or a method it exposes for resolution).

- **What comes next**: Once this refactor is done, we can return to `AGENT.environmentAgnostic.planning.md` and execute it. The serializer's resolution logic will be the thing we parameterize with `DataSourceEnvironment` (fetch, now, log). We will not be inventing new resolution paths; we will be making the *existing* serializer-owned resolution paths environment-agnostic.

- **How to use this when you finish**:
  - When the serializer-envelope refactor is done, come back to this section and check:
    - Do EventBridge handlers build envelopes with `getContentInternal` that delegates to the serializer's resolve logic?
    - Does the client build lazy envelopes (or equivalent) that resolve via the serializer, rather than a separate `resolveSidecarSnapshot` callback?
    - Is Initialize Subscription still the only envelope type that does *not* go through the serializer?
    - Can you change "how WML resolves sidecar + deserialize" by editing the WML serializer (or its resolver) and no other call sites?

  If the answer to those is "yes," then we can proceed to the environment-agnostic refactor; if not, fix the remaining call sites before moving on.

## 4. Getting Started

This section guides AI agents (and human collaborators) through context gathering before beginning implementation work.

1. **Understand Project Foundations**
   - **Read** [root AGENT.md](../../../../AGENT.md)
     - **Why**: Establishes documentation standards and the "Getting Started" pattern for complex tasks
     - **Focus**: 7-step template for complex migrations/refactorings
   - **Read** [DataSource AGENT.md](./AGENT.md)
     - **Why**: This refactor modifies the DataSource pattern; you need to understand the current envelope model
     - **Focus**: Header/content envelope, serialization boundary, `getContentInternal` contract
   - **Read** [AGENT.environmentAgnostic.planning.md](./AGENT.environmentAgnostic.planning.md)
     - **Why**: This serializer-envelope refactor is a prerequisite; understanding the next refactor clarifies intent
     - **Focus**: Why resolution belongs in the serializer, environment interface, target model

2. **Read This Planning Document**
   - **Why**: Orients you within the refactor; the Context anchor explains how this work fits into the larger environment-agnostic effort.
   - **Structure**: Purpose → Scope and plan (Phase 1 items, Phase 2 placeholder) → Context anchor
   - **Recommended order**: Purpose → Section 2 (Phase 1 items 1–5) → Section 3 (Context anchor)
   - **Key insight**: Phase 1 starts with the *client* (Item 1) so the slice can handle async deserialize before we change the backend interface

3. **Understand Core Integration Points**
   - **Why**: Knowing where resolution lives today (call sites) vs where it will live (serializer) prevents wasted edits in the wrong place.
   - **Client slice** ([charcoal-client/src/slices/dataSource/](../../../../charcoal-client/src/slices/dataSource/)): `processRawEnvelope`, `processRawEnvelopeWithSidecar`, `createDataSourceSlice`; always returns async thunk that awaits deserialize before dispatching (Item 1 done)
   - **baseClasses** ([baseClasses.ts](./baseClasses.ts)): `DataSourceEventSerializer` with `deserialize`, `deserializeSnapshot`; will gain `createGetContentInternal` (or equivalent)
   - **EventBridge handlers** (WML, assets, ephemera app.ts): Eagerly call `deserializer.deserialize`, then pass result via `getContentInternal: () => Promise.resolve(internalEvent)`; will instead pass serializer-produced thunk
   - **LifeLine subscription**: Dispatches to processRawEnvelope; must be able to execute async thunks (audit in Item 1)

4. **Review Implemented Code**
   - **Why**: Concrete examples show the current pattern; you need to see the eager-deserialize flow before changing it.
   - **Serializer contract**: [baseClasses.ts](./baseClasses.ts) – `DataSourceEventSerializer` interface
   - **WML serializer**: [packages/mtw-interfaces/ts/eventBridge/wml/index.ts](../../../mtw-interfaces/ts/eventBridge/wml/index.ts) – `WMLEventSerializer`, `WMLSnapshotDeserializer`
   - **Client slice factory**: [charcoal-client/src/slices/dataSource/index.ts](../../../../charcoal-client/src/slices/dataSource/index.ts) – `processRawEnvelopeWithSidecar`, how LifeLine dispatches
   - **EventBridge handler example**: [lambda/wml/app.ts](../../../../lambda/wml/app.ts) – fromEventBridgeFormat, deserialize, messageBus.send

5. **Check Testing Patterns**
   - **Why**: Tests encode expected behavior; updating them correctly depends on understanding how sidecar and sync deserialize are currently exercised.
   - **Client dataSource slice**: [charcoal-client/src/slices/dataSource/index.test.ts](../../../../charcoal-client/src/slices/dataSource/index.test.ts) – sidecar resolution, processRawEnvelope
   - **mtw-lambda-patterns dataSource**: [index.test.ts](./index.test.ts) – streamEvent, initializeSubscription, format transforms

6. **Identify Next Task**
   - **Why**: Phase 1 items are ordered; starting elsewhere risks unblocking work or duplicating effort.
   - **Current focus**: Phase 1, Item 2 – Extend DataSourceEventSerializer with createGetContentInternal
   - **Progress**: Item 1 complete; work through Phase 1 items 2–5 in order
   - **Phase 2**: Backend sidecar resolution – to be planned after Phase 1 is done

7. **Run Tests Before Starting**
   - **Why**: Establish a known-good baseline before making changes; both client slice and DataSource tests are affected. Failures later can then be attributed to your edits, not pre-existing issues.
   - **Client** (from repo root): `cd charcoal-client && npm run test -- --testPathPattern=dataSource --watchAll=false`
   - **mtw-lambda-patterns** (from repo root): `cd packages/mtw-lambda-patterns && npm run test -- --testPathPattern=dataSource --watchAll=false`
