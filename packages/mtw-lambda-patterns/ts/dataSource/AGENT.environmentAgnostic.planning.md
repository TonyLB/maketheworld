# DataSource Environment-Agnostic Lazy Envelopes (Planning)

## 1. Purpose

This document captures a follow-up refinement to the DataSource pattern: **make DataSourceEventSerializer environment-agnostic**, so the same serializer logic for resolving content (including sidecars/claim-checks) can be used in:

- **Backend lambdas** (Node / AWS SDK)
- **Client dataSource slices** in `charcoal-client` (browser / Redux)

The goal is to:

- Keep **header/content envelope semantics** exactly as described in `AGENT.md` and `AGENT.implementation.md`.
- **Parameterize the serializer** with a `DataSourceEnvironment` (fetch only) so that resolution (e.g. `maybeFetchSidecarString`) does not assume Node. The serializer already owns resolution (see [AGENT.serializerEnvelope.planning.md](./AGENT.serializerEnvelope.planning.md)); we only inject the environment.
- Allow both backend and frontend to **evolve how snapshots and events are resolved** by touching the serializer (and its env contract), not N call sites or separate client wrappers.

This is a planning doc only; it does not describe current behavior as already implemented.

## 2. Current state (lazy vs resolved, backend vs client)

### 2.1 Backend (mtw-lambda-patterns + lambdas)

Backend DataSources already use a **three-regime envelope model** (see `AGENT.implementation.md`):

- **External/core**: `CoreExternalFormat = { header, update }`
- **Lazy internal**: `StreamingEventEnvelope<Content, Header> = { header, getContentInternal }`
- **Resolved internal**: `ResolvedStreamingEnvelope<Content, Header> = { header, content }`

Key points:

- **Header authoritative**: `StreamingEventHeader` (and extended variants) drive routing and discrimination; payloads are domain data only.
- **Lazy content** on the messageBus: DataSources subscribe with envelope type guards and receive `StreamingEventEnvelope` values; they call `await event.getContentInternal()` to obtain payloads.
- **After serializer-envelope refactor**: Resolution already lives in the serializer. EventBridge handlers pass `getContentInternal: () => deserializer.deserialize({ content: update, header })`. The serializer's `deserialize` and `deserializeSnapshot` perform sidecar resolution (e.g. `maybeFetchSidecarString`) before parsing. The only remaining coupling: the serializer uses global `fetch` (Node) when resolving sidecars.
- **Snapshots**: Use the same envelope family as events:
  - Storage and replay use `CoreExternalFormat` with `header.type === 'Snapshot'`.
  - `createSnapshotCoreFormat` builds the CoreExternalFormat snapshot; `coreFormatToStreamingEnvelope` can build lazy envelopes for snapshots.

### 2.2 Client (`charcoal-client` dataSource slices)

Client slices (`createDataSourceSlice` in `charcoal-client/src/slices/dataSource`) consume **resolved** envelopes only:

- LifeLine converts WebSocket `StreamEvent` messages into:
  - `ClientStreamingMessagePayload = { streamKey, timestamp, header, content }`
- The generic reducer `processRawEnvelope`:
  - Uses `header.type` (and extended header fields) for routing.
  - Calls **dataSource-specific serializers** (`deserialize` / `deserializeSnapshot`) to convert external payloads into internal types.
  - Calls **dataSource-specific aggregators** to maintain `materializedView` and `recentEvents`.

Sidecar support for `mtw.wml` snapshots-on-subscribe is implemented as:

- A **generic sidecar wrapper** in `createDataSourceSlice`:
  - If `header.type === 'Snapshot'` and `content.sidecarUrl` and a `resolveSidecarSnapshot` function is configured, it:
    - Fetches from the URL.
    - Replaces `content` with the resolved external snapshot payload.
    - Dispatches the normal `processRawEnvelope` reducer.
- A WML-specific `resolveSidecarSnapshot` that uses `fetch` and string munging to return `{ wml: string }`.

Important:

- The **dataSource-specific serializers and aggregators are already used consistently** on the client. The only ad-hoc piece is *where* we perform sidecar resolution and how we pass environment-specific primitives (`fetch`) into that logic.
- The client does **not** currently construct or expose a first-class `{ header, getContentInternal }` type; laziness is modeled as "resolve sidecar before reducer" plus resolved `{ header, content }` everywhere.

## 3. Problem statement / opportunity

The serializer-envelope refactor (see [AGENT.serializerEnvelope.planning.md](./AGENT.serializerEnvelope.planning.md)) centralized resolution in the **DataSourceEventSerializer**: `getContentInternal` is simply `() => deserializer.deserialize({ content, header })`, and the serializer's `deserialize` / `deserializeSnapshot` perform sidecar resolution (e.g. `maybeFetchSidecarString`) before parsing.

The remaining issue: the **serializer is Node-bound**:

- Resolution helpers (e.g. `maybeFetchSidecarString`) use global `fetch` or an optional injected fetch. When used in the backend, that's Node fetch; the serializer never receives an explicit "environment."
- Client slices cannot reuse the same serializer for sidecar resolution, because the client runs in the browser. Instead, the client uses an **ad-hoc** `resolveSidecarSnapshot` that fetches from the URL, then passes the resolved payload to `deserializeSnapshot`. So the serializer's built-in sidecar logic is never exercised on the client.

This has two consequences:

1. **Environment coupling**: Lazy envelopes exist only on the backend; the client has to reinvent sidecar semantics in a different shape.
2. **Evolution cost**: Changing the sidecar/claim-check pattern (e.g. richer descriptors, caching, retries) currently requires touching the serializer (backend) and the client's `resolveSidecarSnapshot` (client). After this refactor, only the serializer (and its use of `env`) needs to change; backend and client both use the same serializer configured with their env.

We would prefer:

- **DataSourceEventSerializer** to be **environment-agnostic**: it receives a `DataSourceEnvironment` (or at least a fetch) and uses it inside `deserialize` / `deserializeSnapshot` when resolving sidecars. No new "envelope constructor" layer; the serializer already owns resolution.
- Backend and client each construct (or configure) the serializer with their environment; envelope construction stays as today: `getContentInternal: () => deserializer.deserialize(...)`.

## 4. Target model: environment-agnostic DataSourceEventSerializer

### 4.1 Environment interface

Introduce a small, explicit "environment" interface that captures the one capability that meaningfully differs between Node and browser when resolving sidecars: fetch.

```ts
type DataSourceEnvironment = {
  fetch: (url: string, init?: RequestInit) => Promise<Response>
}
```

Backends and clients each provide an implementation appropriate to their runtime. **DataSourceEventSerializer** (and any resolution helper it uses, e.g. `maybeFetchSidecarString`) depends only on this interface, not on global `fetch` or Node APIs.

### 4.2 Environment-agnostic serializer

**No new "envelope constructor" layer.** The serializer already owns resolution; we only make it **parameterized by environment**:

- **Recommended pattern (across the board)**: Give each serializer class a **constructor that accepts a `DataSourceEnvironment`** and **store it at the class-instance level** (e.g. `private readonly env: DataSourceEnvironment`). Inside `deserialize` and `deserializeSnapshot`, when resolving a sidecar (e.g. via `maybeFetchSidecarString`), the serializer uses `this.env.fetch`. This keeps call sites simple (no per-call env passing) and makes the dependency explicit.

Example shape (conceptual): constructor takes env; instance uses it in resolution:

```ts
// Constructor (e.g. WMLEventSerializer, WMLDataSourceEventSerializer):
constructor(private readonly env: DataSourceEnvironment) { ... }

// In deserialize (e.g. WML Content Update branch):
const wml = await maybeFetchSidecarString(content.wml, this.env.fetch)

// In deserializeSnapshot:
const wml = await maybeFetchSidecarString(externalSnapshot.wml, this.env.fetch)
```

Envelope construction stays unchanged: `getContentInternal: () => deserializer.deserialize({ content, header })`.

Key properties:

- Sidecar detection, fetching, parsing, and validation remain **inside** the serializer; no duplicate "constructor" that builds `getContentInternal`.
- One implementation per DataSource (the serializer) is used in both backend and client by configuring it with the appropriate `env`.

### 4.3 Client-side usage pattern

On the client, we do not need to expose `getContentInternal` in Redux state. The slice already receives `{ header, content }` and calls the serializer. The change:

1. **Configure the serializer with a browser environment.** When creating the slice, pass a serializer instance that was constructed with a client `DataSourceEnvironment` (e.g. `fetch`: browser `fetch`).
2. When a message arrives (including snapshots with `content.sidecarUrl` or per-field sidecars), the slice calls `eventSerializer.deserialize({ content, header })` or `eventSerializer.deserializeSnapshot(content)` as today. The serializer performs sidecar resolution internally using `env.fetch`.
3. Remove the ad-hoc `resolveSidecarSnapshot` callback; the serializer handles sidecars because it has an env.

So: same flow (incoming payload -> serializer -> internal content -> reducer), with the serializer now responsible for fetching when it sees a sidecar descriptor, using the injected env.

### 4.4 Backend usage pattern

On the backend, envelope construction already is `getContentInternal: () => deserializer.deserialize({ content, header })`. With an environment-agnostic serializer:

- Construct the deserializer with a Node (or lambda) `DataSourceEnvironment` (e.g. `fetch`: Node `fetch` or AWS SDK as needed).
- No change to EventBridge handlers or messageBus send code; they already pass the deserializer. Only the deserializer's construction (or configuration) gains an `env` argument.

## 5. Plan of work (incremental)

### Step 0: Documentation and constraints (this doc)

- Capture the target shape and constraints (done here).
- Explicitly call out that:
  - Header semantics and `CoreExternalFormat` **must not change**.
  - Aggregator and serializer contracts **must remain header-driven** and domain-payload-pure.
  - We are not changing client materialized state shape; only how internal content is obtained.

### Step 1: Define a minimal `DataSourceEnvironment` contract (DONE)

- ~~Add a small, well-documented `DataSourceEnvironment` type in `mtw-lambda-patterns` or `mtw-interfaces` (TBD)~~ **Done.** Type lives in **mtw-interfaces** at [ts/DataSourceEnvironment.ts](../../../mtw-interfaces/ts/DataSourceEnvironment.ts). Export for use by serializers and by Step 3 environment implementations. Import path: `@tonylb/mtw-interfaces/ts/DataSourceEnvironment`.
  - Minimal: `fetch` only. JSDoc describes the contract and gives backend vs client implementation notes (no Node-only APIs on the type).
- Do **not** wire it into existing code yet; treat this as a contract definition step. **Contract defined; not yet wired into serializers.**

### Step 2: Make DataSourceEventSerializer environment-agnostic for one reference DataSource (mtw.wml) (DONE)

For WML (`WMLEventSerializer`, `WMLDataSourceEventSerializer` in mtw-interfaces):

- Resolution already lives in the serializer (Phase 2 of serializer-envelope refactor: `maybeFetchSidecarString` inside `deserialize` and `deserializeSnapshot`). Do **not** extract new helpers; **parameterize** the existing ones.
- **Strongly recommend**: Add a **constructor to each class** that accepts a `DataSourceEnvironment` and **store it on the instance** (e.g. `private readonly env`). When the serializer (or `maybeFetchSidecarString`) needs to fetch a sidecar, use `this.env.fetch`. Apply this pattern for both `WMLEventSerializer` and `WMLDataSourceEventSerializer`; use it as the standard pattern for all serializers we refactor.
- Update backend: construct the WML deserializer with a Node/lambda `DataSourceEnvironment` (e.g. `new WMLDataSourceEventSerializer(nodeEnv)`) so EventBridge handlers continue to use `getContentInternal: () => deserializer.deserialize(...)` with an env-aware deserializer.

**Implementation note (done):** WML serializers now take a required `DataSourceEnvironment` constructor argument (fetch only). Minimal Node env added in mtw-lambda-patterns (`createNodeDataSourceEnvironment` in `ts/dataSource/nodeEnvironment.ts`, exported from dataSource index); minimal browser env added in charcoal-client (`createBrowserDataSourceEnvironment` in `src/slices/dataSource/browserEnvironment.ts`). Backend (lambda/wml/dataSource/mtw-wml.ts, lambda/assets/app.ts) and client (wmlDataSource slice, personalAssets index.api.ts) construct serializers with the appropriate env. WML unit tests (mtw-interfaces/ts/eventBridge/wml/index.test.ts) use a test env. `maybeFetchSidecarString` in sidecarResolve.ts was updated to accept `(url: string, init?) => Promise<Response>` for the fetch parameter so `DataSourceEnvironment.fetch` is type-compatible. Step 3 can replace the minimal Node/browser envs with fuller implementations (e.g. AWS SDK for fetch) without changing serializer call patterns.

Success criteria:

- No change in wire format (`CoreExternalFormat`) or header semantics.
- No change in public behavior; only the serializer's internal resolution path uses `env.fetch`.
- Backend still builds envelopes the same way; the deserializer instance is simply configured with an env.

### Step 3: Add environment implementations for backend and client (DONE)

- **Backend environment**:
  - Implement `DataSourceEnvironment` in mtw-lambda-patterns or a lambda-local helper:
    - `fetch`: wraps Node fetch or AWS SDK S3 operations as needed.
- **Client environment**:
  - Implement `DataSourceEnvironment` in `charcoal-client`:
    - `fetch`: browser `fetch`.

**Implementation note (done):** Step 2 added these implementations: `createNodeDataSourceEnvironment()` in mtw-lambda-patterns (Node global fetch) and `createBrowserDataSourceEnvironment()` in charcoal-client (browser fetch). Both satisfy Step 3. Presigned sidecar URLs work with standard fetch; an AWS SDK-based fetch can be added later if a use case requires it.

### Step 4: Teach client slices to resolve via the serializer (one domain) (DONE)

For WML on the client:

- Replace the ad-hoc `resolveSidecarSnapshot` callback with a **serializer instance configured with a browser DataSourceEnvironment**. When the slice receives a message (including snapshots with `content.sidecarUrl` or per-field sidecars), it calls `eventSerializer.deserializeSnapshot(content)` or `eventSerializer.deserialize({ content, header })` as today. The serializer performs sidecar resolution internally using `env.fetch`.
- Remove the generic "if sidecarUrl then call resolveSidecarSnapshot" branch from the slice; the slice always passes the raw payload to the serializer, and the serializer resolves sidecars when present.
- Keep Redux slice public API and state shape unchanged.

**Implementation note (done):** Client slice no longer takes or uses `resolveSidecarSnapshot`; the slice always passes raw `content` to `eventSerializer.deserializeSnapshot` / `eventSerializer.deserialize`. The WML serializer handles domain-shaped snapshot payloads only (e.g. `{ wml: string }` or `{ wml: { sidecarUrl } }`); full-content sidecars are no longer supported on the client. The WML slice no longer exports or passes `resolveSidecarSnapshot`.

Success criteria:

- All parsing/sidecar concerns live in the WML serializer (shared with backend), which is configured with a client `env`.
- The slice sees only `{ header, content }` as today; no new public concepts for consumers. No separate `resolveSidecarSnapshot` callback.

### Step 5: Generalize pattern for other DataSources as needed (DONE)

- Once WML is stable and tested, consider making other serializers environment-agnostic using the same pattern (constructor that accepts `DataSourceEnvironment`, store on instance, use `this.env.fetch` in resolution paths) for:
  - `mtw.assets.contentHeaders` (if we ever add sidecars there).
  - Future DataSources that want claim-check semantics.
- For DataSources that only ever use inline payloads, no change is required; their serializers need no env until they add sidecar resolution.

**Implementation note (done):** No other DataSource currently uses or has been considered for sidecar storage. `mtw.assets.contentHeaders`, `mtw.assets.library`, and `mtw.assets.players` use serializers without a `DataSourceEnvironment` and have inline-only payloads. The pattern is established with WML; when another DataSource needs claim-check/sidecar semantics, apply the same approach (env in constructor, `this.env.fetch` in resolution paths). No further work required until then.

## 6. Non-goals / constraints

- **Do not**:
  - Change existing `CoreExternalFormat` shape or header semantics.
  - Introduce dataSource-specific routing based on payload `type` (header remains authoritative).
  - Change client materialized view shapes or the public Redux API for slices.
- **Short term**:
  - We are not introducing shared browser/Node polyfills in this step; instead, we pass an abstract environment into DataSource logic and implement environment bindings locally.

## 7. Open questions

1. **Environment location**:
   - Should `DataSourceEnvironment` live in `mtw-lambda-patterns` (backend-oriented) or in `mtw-interfaces` (shared contracts)?
   - How much of the environment API do we want to standardize now vs later (just `fetch`/`now`/`log` or more)?

2. **Client-side lazy envelopes vs eager resolution**:
   - The client does not need to expose `{ header, getContentInternal }` in state. The slice receives a payload and calls the serializer (configured with browser env); the serializer resolves sidecars internally and returns internal content. So we keep "resolve once, then work only with `{ header, content }`" with resolution happening inside the serializer.

3. **Caching and retries**:
   - Should sidecar fetch and content resolution include built-in retries, caching, or metrics in the environment?
   - If so, does that belong in the shared environment implementation, or in DataSource-specific helpers?

As these questions are resolved in early steps (especially for WML), this planning doc should be updated and, once the pattern feels stable, folded into the main DataSource `AGENT.implementation.md` as a reference section for environment-agnostic lazy envelopes.

## 8. Context anchor: why this work exists

This section is here explicitly to help us "pop the stack" and remember **why** we did this refactor when we come back later.

- **Immediate driver**: The WML subscriber-sync refactor (`lambda/wml/AGENT.subscriberSync.refactor.planning.md`).
  - Goal there: make the **client WML dataSource slice** the *only* source of truth for backend WML state per asset, and let `personalAssets`:
    - Stop maintaining its own `base` copy of backend WML.
    - Focus on optimistic edits and UI only.
  - To do that safely and evolve it over time, we need sidecar/claim-check handling that we can change *once* and have it affect:
    - Backend WML replay and snapshot-on-subscribe.
    - Client WML dataSource snapshot consumption.

- **Broader evolution**: The general snapshot refactor (sections A–E in the previous snapshot planning work) standardized:
  - `CoreExternalFormat` as `{ header, update }` for both events and snapshots.
  - `header.type === 'Snapshot'` as the single snapshot discriminator.
  - Client `dataSource` slice as the envelope-aware consumer for many domains (contentHeaders, library, players, WML).
  This environment-agnostic lazy-envelope work is the **next layer**, making it practical to evolve sidecar and lazy-resolution behavior without duplicated logic.

- **How to use this when you finish**:
  - When the first implementation of environment-agnostic serializers is done (likely for WML first), come back to this section and check:
    - Are we now able to change "how WML sidecars work" by editing the WML serializer (and its env usage) only, rather than serializer + client `resolveSidecarSnapshot`?
    - Did we actually flip authority in `personalAssets` so that it reads base WML from the WML dataSource slice instead of maintaining its own backend view?
    - Does this make it *easier* to reason about future changes like WML replayability, new DataSources using sidecars, or richer snapshot metadata?

If the answer to those is "yes," then this refactor achieved its purpose in the larger architecture; if not, treat that as a signal to adjust the environment abstraction or its call sites before moving on to the next rabbit-hole.

## 9. Post-completion: revisit serializer-envelope rubric

When this environment-agnostic refactor is complete, **revisit [AGENT.serializerEnvelope.planning.md](./AGENT.serializerEnvelope.planning.md)** (Section 3, "How to use this when you finish") and decide whether its context-anchor rubric has been satisfied. That rubric checks:

- Do EventBridge handlers build envelopes with `getContentInternal` that delegates to the serializer?
- Does the client resolve via the serializer (not a separate `resolveSidecarSnapshot`)?
- Is Initialize Subscription still the only envelope type that bypasses the serializer?
- Can you change "how WML resolves sidecar + deserialize" by editing the serializer only?

**Do this assessment before cleaning up or archiving the serializer-envelope planning document.** If the rubric is satisfied, the planning doc can be archived or folded into implementation docs; if not, address the remaining gaps first.

