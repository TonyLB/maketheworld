# DataSource Environment-Agnostic Lazy Envelopes (Planning)

## 1. Purpose

This document captures a follow-up refinement to the DataSource pattern: **make lazy-evaluation envelopes environment-agnostic**, so the same DataSource-centric logic for resolving content (including sidecars/claim-checks) can be applied consistently in:

- **Backend lambdas** (Node / AWS SDK)
- **Client dataSource slices** in `charcoal-client` (browser / Redux)

The goal is to:

- Keep **header/content envelope semantics** exactly as described in `AGENT.md` and `AGENT.implementation.md`.
- Move **sidecar/claim-check and content-resolution behavior** into a single, DataSource-owned abstraction that is **parameterized by an environment** rather than hard-coded to Node.
- Allow both backend and frontend to **evolve how snapshots and events are resolved** (inline vs sidecar, validation, parsing) by touching *one* implementation per DataSource, not N call sites.

This is a planning doc only; it does not describe current behavior as already implemented.

## 2. Current state (lazy vs resolved, backend vs client)

### 2.1 Backend (mtw-lambda-patterns + lambdas)

Backend DataSources already use a **three-regime envelope model** (see `AGENT.implementation.md`):

- **External/core**: `CoreExternalFormat = { header, update }`
- **Lazy internal**: `StreamingEventEnvelope<Content, Header> = { header, getContentInternal }`
- **Resolved internal**: `ResolvedStreamingEnvelope<Content, Header> = { header, content }`

Key points:

- **Header authoritative**: `StreamingEventHeader` (and extended variants) drive routing and discrimination; payloads are domain data only.
- **Lazy content** on the messageBus: DataSources subscribe with envelope type guards and receive `StreamingEventEnvelope` values; they call `await event.getContentInternal()` to obtain payloads. Sidecar resolution is intended to live behind `getContentInternal`.
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

The snapshot refactor established a clean, envelope-based architecture:

- Header is authoritative for routing.
- Snapshots and events share the same envelope family.
- Sidecar descriptors are intended to be treated as just another `update` shape; the *how* of fetching and resolving is a domain concern hidden behind `getContentInternal`.

However, the **lazy-evaluation contract is currently bound to the backend environment**:

- Backend `getContentInternal` implementations assume Node/lambda context (Node fetch or AWS SDK, internal caches, etc.).
- Client slices implement sidecar handling with an **ad-hoc thunk wrapper** that:
  - Knows about `content.sidecarUrl` shape.
  - Uses browser `fetch` directly.
  - Then feeds the resolved payload into the serializer.

This has two consequences:

1. **Environment coupling**: Lazy envelopes exist only on the backend; the client has to reinvent sidecar semantics in a different shape.
2. **Evolution cost**: Changing the sidecar/claim-check pattern (for example, richer descriptors, caching, retries, metrics) requires touching:
   - Backend DataSource code.
   - Client slice wrappers.
   - Potentially more call sites as we add new domains or transports.

We would prefer:

- A **single, DataSource-owned definition** of "how this domain resolves content (including sidecars)," written once, and
- The ability to **re-use that definition in both backend and frontend** by injecting an environment, without refactoring call sites.

## 4. Target model: environment-agnostic lazy envelopes

### 4.1 Environment interface

Introduce a small, explicit "environment" interface that captures the operations lazy envelopes need, without tying them to Node vs browser:

```ts
type DataSourceEnvironment = {
  fetch: (url: string, init?: RequestInit) => Promise<Response>
  now: () => number
  log: (level: 'info' | 'warn' | 'error', message: string, meta?: unknown) => void
  // Optional: metrics, S3 helpers, caching hooks, etc.
}
```

Backends and clients would each provide an implementation of `DataSourceEnvironment` appropriate to their runtime, but **DataSource-centric logic would only depend on this interface**, not on concrete global APIs.

### 4.2 Environment-aware lazy envelope constructors

For each DataSource (or shared helper in mtw-interfaces), we can define **environment-aware constructors** that take:

- A `DataSourceEnvironment`.
- A `CoreExternalFormat` or `{ header, externalPayload }` pair.

And produce a `StreamingEventEnvelope<InternalContent, Header>`:

```ts
function makeWmlLazyEnvelope(
  env: DataSourceEnvironment,
  coreFormat: CoreExternalFormat
): StreamingEventEnvelope<WmlInternalPayload, CoreExternalFormat['header']> {
  return {
    header: coreFormat.header,
    getContentInternal: async () => {
      const update = coreFormat.update as any
      if (update.sidecarUrl) {
        const res = await env.fetch(update.sidecarUrl)
        const raw = await res.text()
        // parse + validate + convert to internal snapshot/update
        return deserializeWmlFromSnapshotBody(raw, coreFormat.header)
      }
      // Inline payload path
      return deserializeWmlFromInline(update, coreFormat.header)
    }
  }
}
```

Key properties:

- Sidecar detection, fetching, parsing, and validation all live **inside** `getContentInternal`.
- The implementation uses only `env.fetch`, `env.log`, etc., and pure helper functions (parsers, type guards).
- This function can be used in **both**:
  - Backend lambdas (with a Node/AWS-flavored `env`).
  - Client code (with a browser/Redux-flavored `env`).

### 4.3 Client-side usage pattern

On the client, we do not necessarily want to keep `getContentInternal` around inside Redux state, but we can:

1. Construct a lazy envelope with an environment-aware helper.
2. Immediately resolve it once per incoming message.
3. Feed the resulting `{ header, content }` into the existing `processRawEnvelope` / aggregator pipeline.

Conceptually:

```ts
// WebSocket handler -> build CoreExternalFormat-equivalent payload
const coreFormat = { header, update }

// Use environment-aware helper to get lazy envelope
const lazyEnvelope = makeWmlLazyEnvelope(browserEnv, coreFormat)

// Resolve once, then call existing serializer/aggregator-friendly path
const internalContent = await lazyEnvelope.getContentInternal()
dispatch(processResolvedEnvelope({ header: lazyEnvelope.header, content: internalContent }))
```

This gives us:

- A **single DataSource-specific implementation** of sidecar and inline payload handling.
- The ability to **change sidecar semantics once** (for example, retries, shaping metadata, metrics) and have both backend and client pick it up.
- A clear separation between:
  - Environment-agnostic domain logic (lazy envelope constructors, serializers, aggregators).
  - Environment-specific plumbing (how `env` is implemented and where envelopes are resolved).

### 4.4 Backend usage pattern

On the backend, we already construct lazy envelopes close to the messageBus, but they are currently bound to Node. With an environment interface:

- The send-helpers in `subscribedEvents.ts` and the DataSource subscription handlers can also call environment-aware constructors.
- This lets WML, contentHeaders, library, players, etc. share envelope-construction logic with clients.

## 5. Plan of work (incremental)

### Step 0: Documentation and constraints (this doc)

- Capture the target shape and constraints (done here).
- Explicitly call out that:
  - Header semantics and `CoreExternalFormat` **must not change**.
  - Aggregator and serializer contracts **must remain header-driven** and domain-payload-pure.
  - We are not changing client materialized state shape; only how internal content is obtained.

### Step 1: Define a minimal `DataSourceEnvironment` contract

- Add a small, well-documented `DataSourceEnvironment` type in `mtw-lambda-patterns` or `mtw-interfaces` (TBD):
  - Keep it minimal: `fetch`, `now`, `log` to start.
  - Document how backends and clients should implement it (no Node-only APIs on the type).
- Do **not** wire it into existing code yet; treat this as a contract definition step.

### Step 2: Extract environment-agnostic helpers for one reference DataSource (mtw.wml)

For `mtw.wml`:

- Identify current snapshot and event resolution paths that:
  - Detect sidecar descriptors.
  - Fetch and parse WML.
  - Build internal snapshot/update types.
- Extract that logic into environment-agnostic helpers that take a `DataSourceEnvironment` and `{ header, externalPayload }`, and return either:
  - A `StreamingEventEnvelope` with `getContentInternal` using `env`, or
  - A simple `() => Promise<InternalPayload>` thunk that can be plugged into `coreFormatToStreamingEnvelope`.
- Update backend send-helpers and callbacks to use these helpers, still in the lambda layer only.

Success criteria:

- No change in wire format (`CoreExternalFormat`).
- No change in header semantics.
- No change in public behavior; only internal construction of `getContentInternal` moves to the helper.

### Step 3: Add environment implementations for backend and client

- **Backend environment**:
  - Implement `DataSourceEnvironment` in mtw-lambda-patterns or a lambda-local helper:
    - `fetch`: wraps Node fetch or AWS SDK S3 operations as needed.
    - `now`: uses existing `getCurrentTimestamp`.
    - `log`: routes to lambda logger / console.
- **Client environment**:
  - Implement `DataSourceEnvironment` in `charcoal-client`:
    - `fetch`: browser `fetch`.
    - `now`: `Date.now()`.
    - `log`: console or a client logging abstraction.

### Step 4: Teach client slices to resolve via environment-aware helpers (one domain)

For WML on the client:

- Replace the ad-hoc `resolveSidecarSnapshot` wrapper with a **call into the environment-aware helper**:
  - WebSocket message → `CoreExternalFormat`-equivalent → environment-aware lazy envelope (using client `env`) → resolve once → feed `{ header, content }` into reducers.
- Keep Redux slice public API and state shape unchanged.

Success criteria:

- All parsing/sidecar concerns live in WML-specific, environment-aware code that is shared with backend.
- The slice sees only `{ header, content }` as today; no new public concepts for consumers.

### Step 5: Generalize pattern for other DataSources as needed

- Once WML is stable and tested, consider applying the same approach to:
  - `mtw.assets.contentHeaders` (if we ever add sidecars there).
  - Future DataSources that want claim-check semantics.
- For DataSources that only ever use inline payloads, no change is required; they can continue to deserialize content directly in the aggregator/serializer path.

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
   - Do we want to expose `{ header, getContentInternal }` as a first-class type on the client, or keep the pattern "construct lazy envelopes, resolve once, then work only with `{ header, content }`"?
   - The current client pattern favors resolved state; this plan assumes we keep that and only refactor *how* we obtain `content`.

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
  - When the first implementation of environment-agnostic lazy envelopes is done (likely for WML first), come back to this section and check:
    - Are we now able to change "how WML sidecars work" by editing one or two helpers, rather than 4–6 scattered places?
    - Did we actually flip authority in `personalAssets` so that it reads base WML from the WML dataSource slice instead of maintaining its own backend view?
    - Does this make it *easier* to reason about future changes like WML replayability, new DataSources using sidecars, or richer snapshot metadata?

If the answer to those is "yes," then this refactor achieved its purpose in the larger architecture; if not, treat that as a signal to adjust the environment abstraction or its call sites before moving on to the next rabbit-hole.

