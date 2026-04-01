*Status: ACTIVE PLANNING DOCUMENT - renderOrchestration (v2).*

## Purpose

This document tracks the local implementation plan for `lambda/ephemera/renderOrchestration/`.

It implements the v2 architecture described in:

- `lambda/ephemera/state/AGENT.v2.planning.md`

Parallel-track declutter is tracked in:

- `lambda/ephemera/renderOrchestration/AGENT.planning.simplification.md`

Transitional ingress adapter status for DataSource-shape intake is documented in:

- `lambda/ephemera/dataSource/renderOrchestration/AGENT.md`

## Goals (v2)

1. Implement a messageBus-based event cascade for render lifecycle orchestration.
2. Publish early feedback events so clients see "Generating..." immediately when generation starts.
3. Publish final ready events only after cache write + pointer updates complete.
4. Keep responsibilities cleanly split across:
   - `state` (world-state storage/invariants)
   - `renderCache` (cache primitives)
   - `renderOrchestration` (policy + lifecycle cascade)
   - `perception` (enrichment + delivery)

## Module layering direction: orchestration vs generation (intended)

This section records **where we want the code to go**, so refactors do not accidentally reinforce the opposite split (bunching all branching inside a module named for "generation").

### Orchestration (under `renderOrchestration/`)

**Orchestration** means: for a given bus message or API-driven flow, decide **what happens next** --- sequencing, policy branches, and **what gets published** on the messageBus (and how conversations / correlation attach). That **includes** decisions such as:

- exact-match cache hit vs need to generate
- pointer validity vs clear-and-continue (for `RenderRequested` / intake)
- when to emit progress vs terminal signals (preview `ConversationStep` vs lifecycle events), consistent with task acceptance criteria

Putting those decisions in orchestration handlers is **not** inherently a "god module" problem. Orchestration **should** coordinate. What we avoid is **inlining** every low-level concern (raw Dynamo shapes, LLM prompts) in one file without **named helpers** or **leaf modules**. Shared cache rules can live in `renderCache` / small functions that orchestration **calls**.

Registration and dispatch live in `index.ts` (and may later move to dedicated handler files); **orchestration logic** may grow there or alongside it under `renderOrchestration/`, while **implementation** of "run the model and write this cache row" stays elsewhere.

### Generation (`generateRoomPreview` and friends)

**Generation** means: **implement** the slow path that actually **produces** new room preview content (and the cache write that belongs with that path), when orchestration has already committed to "generate now."

Over time, `generateRoomPreview` should **not** be the hiding place for the **full** preview request pipeline (exact match + branch + generate). A module named for generation should read like **generation**, not like "everything that can happen when someone asks for a preview."

### Alignment with passive intake and shell

**Intake** (`intakeRenderRequested` in `requestIntake.ts`) reads world/meta and produces `RenderResolveInput` (`success` | `error`). It does **not** call `findRender`, publish bus messages, or run generation. The **passive shell** (`orchestratePassiveRenderRequestedBatch` in `orchestrationHandler.ts`) chains intake -> `findRender` -> `enrichRenderResolveForPassive`. Preview follows the same layering in `index.ts` (preview intake map -> `findRender` -> `enrichRenderResolveForPreview`).

### Duplication guard

If orchestration owns "try exact match first," **`generateRoomPreview`** must not **repeat** that check as a hidden fast path, or we get two sources of truth. Prefer: orchestration branches, then calls a **narrow** `generateRoomPreview` (or renames it to `generateRoomPreviewContent` / similar) that assumes **miss**; or both call a **single** shared helper for exact match that lives next to render-cache primitives.

### Migration

These boundaries can move **incrementally**. Documenting the direction does not require one big bang; each PR can nudge orchestration, intake, and generation toward the split above.

## Lifecycle events: why they exist (and why preview feels confusing)

The `renderOrchestration` lifecycle events (e.g. `RenderRequested`, `RenderGenerationStarted`, `RenderReady`) exist to make a multi-step render lifecycle:

- composable across multiple triggers (direct request, state change, cache outcomes)
- presence-aware ("tree falls in forest"): do expensive work only when someone will observe the output
- decoupled at the boundaries: orchestration publishes lifecycle facts; delivery systems subscribe and decide how to show them

This intent is easiest to see in the presence-based delivery flow (Rooms first in v2):

- `renderOrchestration` can apply early "observer policy" gates (no observers -> invalidate pointers only; do not generate)
- `perception` can subscribe to `RenderGenerationStarted` / `RenderReady` and send placeholder vs final messages to the right recipients

By contrast, the authoring preview flow (`generateRoomPreview`) is intentionally not presence-gated:

- it is a request-scoped, direct-to-requester experience
- it streams `ConversationStep` messages via the conversations subsystem (not `perception`)

That means: lifecycle events may be unused in the preview wedge even when they are the correct long-term abstraction. Do not let preview-only acceptance criteria force premature presence-oriented design choices (and vice versa).

## Proposed internal message contracts (draft)

These are internal messageBus messages (not EventBridge contracts).

All messages use `componentId` so the same lifecycle can extend beyond Rooms later.

### 1) RenderRequested

- **When**: a render lifecycle should begin (direct request or update-driven trigger).
- **Payload** (draft):
  - `componentId`
  - `perspective` (asset stack)
  - request-scoped `characterId` (optional)
  - update-scoped explicit targets (optional; otherwise perception derives from presence/subscriptions)
  - `messageGroupId` / request correlation (optional)
  - `allowGeneration` + `generationContextWml` (optional; authoring-only in v2)

### 2) RenderGenerationStarted

- **When**: the system has committed to generating content and wants immediate UI feedback.
- **Payload**:
  - `componentId`
  - request-scoped `characterId` (optional)
  - update-scoped targets (optional)
  - `messageGroupId` (optional)
  - minimal metadata for placeholder rendering (e.g. `status: 'generating'`)

### 3) RenderReady

- **When**: a cache-backed render is available (cache hit or generation completion).
- **Payload**:
  - `componentId`
  - `cacheId` (first-cut default for compact payloads)
  - optional `cacheRecord` (allowed fast-path to avoid immediate fetch when producer already has the full record)
  - request-scoped `characterId` (optional)
  - update-scoped targets (optional)
  - `messageGroupId` (optional)

### 4) RenderGenerationCompleted / RenderGenerationFailed

- Optional explicit lifecycle events, depending on whether we want `RenderReady` to be the only completion signal.

## Handler plan (messageBus cascade)

### Handler A: Request intake

- Input: `RenderRequested`
- Responsibilities:
  - For Rooms:
    - read `Meta::Room`
    - derive perspective key/fingerprint from request perspective
    - attempt fast-path pointer lookup in `currentCacheByPerspective`
    - if valid -> publish `RenderReady`
    - if invalid -> clear pointer and fall through to slow path

### Handler B: Exact-match lookup

- Input: `RenderRequested` (multi-stage / future work may add derived follow-up messages; cache invalidation is `RenderInvalidate` today).
- Responsibilities:
  - ensure markState (use `Meta::Room.state.marks` or compute defaults)
  - call renderCache exact-match lookup
  - on hit -> publish `RenderReady`
  - on miss + generation allowed -> publish `RenderGenerationStarted` and enqueue generation work

### Handler C: Generation worker + completion publish

- Input: generation work message (implementation detail)
- Responsibilities:
  - call renderCache generation primitive
  - update `Meta::Room.currentCacheByPerspective[perspectiveKey]` to point to the newly written `CACHE#...` row
  - publish `RenderReady` (and optionally `RenderGenerationCompleted`)

### Handler D: Perception integration

Owned by `perception`, but must be planned here for contract clarity:

- On `RenderGenerationStarted`: send placeholder header (Rooms first).
- On `RenderReady`: enrich chosen cache record and send final header/full description.
- Ensure cache invalidation happens so placeholder is replaced by final header.

## Testing plan

1. Unit tests for handler A/B:
   - fast-path cache pointer hit -> RenderReady
   - pointer miss -> clears pointer then continues to lookup
   - exact-match hit -> RenderReady
2. Unit tests for generation lifecycle:
   - RenderGenerationStarted published before generation completion
   - RenderReady only after cache row write + pointer update
3. Perception integration tests:
   - placeholder header then final header (ordering)

## Integration with `state` (state change triggers)

**Intent**: `state` owns world-state changes; `renderOrchestration` reacts when those changes matter for someone.

### State-side behavior

- When a relevant state change occurs (e.g. Room-level markState change):
  - `state` publishes a **state change message** onto the messageBus (exact contract to be defined in the state planning docs).
  - Payload should include at least:
    - `componentId` (Room)
    - old/new state snapshot or a diff sufficient for downstream decisions

### renderOrchestration subscription

- `renderOrchestration` subscribes to these state change messages and:
  - checks whether there are characters currently present / subscribed who would passively perceive the change
    - mirrors existing patterns used by `perception` / map subscription today
  - if **no passive observers**:
    - invalidate any cached render state as needed (clear `Meta::Room.currentCacheByPerspective` or equivalent)
    - do **not** request a new render yet
  - if **there are passive observers**:
    - treat this as a render-needed event
    - derive perspective from each relevant character viewpoint (or consolidated policy)
    - publish `RenderRequested` message(s) with:
      - `componentId`
      - perspective (derived from character)
      - request-scoped `characterId` when appropriate
      - update-scoped targets when appropriate

### Design consequences

- `state` remains responsible for recording and publishing changes, not for deciding render policy.
- `renderOrchestration` centralizes:
  - presence-aware render decisions
  - cache invalidation policy vs immediate regeneration
  - fan-out into one-or-more `RenderRequested` messages per change.

## Perspective-scoped cache pointers (schema decision)

`currentCacheId` is not sufficient for passive observation because cache records are perspective-constrained.

Planned shape for Room metadata:

- `currentCacheByPerspective: Record<string, string>`
  - key: normalized perspective identifier/fingerprint
  - value: `CACHE#...` id

Why map over list pairs:

- O(1)-style lookup by perspective key
- easier atomic update of a single perspective pointer
- simpler invalidation (clear map) on state mutations

Transition note:

- During migration, handlers may read legacy `currentCacheId` as fallback.
- New writes should target `currentCacheByPerspective`.

## InternalCache RenderCache (request-scoped memo + upsert overlay)

To reduce duplicate Dynamo reads and to make render orchestration decisions more consistent within a single handler invocation, the ephemera lambda now includes a request-scoped memo for render-cache rows:

- **`internalCache.RenderCache`** lives in [`lambda/ephemera/internalCache/renderCache.ts`](internalCache/renderCache.ts) and is instantiated/cleared via [`lambda/ephemera/internalCache/index.ts`](internalCache/index.ts).
- **Lifecycle**: `internalCache.clear()` is called at the start of the handler run, so the memo is **invocation-scoped** (no cross-invocation caching).

### API summary

- **`internalCache.RenderCache.get(componentId)`**
  - Memoizes the full list of Dynamo `CACHE#...` rows for `componentId`.
  - First call loads via the underlying `queryCacheRecordsForComponent` implementation.
  - Subsequent calls return the same cached array for that `componentId`, avoiding double-queries within the same invocation.

- **`internalCache.RenderCache.set(...)`**
  - Intended to keep the memo coherent after in-process writes.
  - **No-op** if `get(componentId)` has not run yet for that `componentId` (prevents creating a half-initialized view).
  - Upsert semantics into the memoized array (in-memory only):
    - If `cacheId` (Dynamo `DataCategory`) is provided: replace the entry with that `DataCategory` or append if missing.
    - If `cacheId` is omitted: match/replace based on `markState` equality semantics (via `markStatesEqual`), or append if none match.

### How this integrates with `mtw.ephemera.renderCache`

- The `mtw.ephemera.renderCache` DataSource write path calls `internalCache.RenderCache.set(...)` after a successful `putCacheRecord`, using the returned `DataCategory` as the memo `cacheId`.
- As a result, subsequent reads through `internalCache.RenderCache.get` during the same invocation can observe the just-written cache row without another Dynamo query.

### Why this matters for `renderOrchestration`

With `internalCache.RenderCache`, render orchestration can:

- run “does a matching render already exist?” checks using `internalCache.RenderCache.get` without triggering multiple Dynamo queries for the same component in one handler run
- align fast-path/slow-path decisions with a coherent view of the cache memo after successful writes (provided the write uses the `mtw.ephemera.renderCache` DataSource path)

## Next task list (near-term clear -> longer-term foggy)

### Tier 1: Clear, immediate tasks (implement now)

1. [x] **Type shape update (early priority)**
   - Update shared metadata types to include:
     - `Meta::Room.currentCacheByPerspective: Record<string, string>`
   - Keep `currentCacheId` as temporary optional fallback during migration.
2. [x] **Perspective key utility**
   - Define one shared, versioned function for deriving a stable perspective key/fingerprint from perspective input.
   - Reuse existing perspective-id semantics where valid, but move toward a shared package utility used across lambdas.
   - Add a canonicalization step before keying to keep semantics stable across call sites:
     - preserve base->leaf order
     - remove exact duplicate asset ids while preserving first occurrence
     - validate all ids as `ASSET#...`
   - Encode version in the key (`PERSPECTIVE#v1#...`) so future ordering/canonicalization changes can ship as `v2` without ambiguous collisions.
   - Document that v1 canonicalization is intentionally conservative (mostly no-op on well-formed stacks) and exists to prevent accidental key fragmentation.
   - Migration compatibility:
     - keep legacy perspective id readers during transition
     - switch all new writes to shared `computePerspectiveKey` output
     - if/when key semantics change, dual-read legacy + new keys until backfill completes
3. [x] **Event contract file**
   - Create `renderOrchestration/events.ts` with `RenderRequested`, `RenderGenerationStarted`, `RenderReady`, and optional completion/failure message types + type guards.
4. [x] **Request intake handler (fast path)**
   - Implement handler A to read `Meta::Room`, resolve perspective key, validate `currentCacheByPerspective[perspectiveKey]`, and publish `RenderReady` on hit.
   - On invalid pointer, clear that pointer entry and continue.
   - **Temporary orchestration constraint (active):** treat missing `Meta::Room.state.marks` as an error for `RenderRequested` intake (`marks_missing`). Do not invent defaults in intake yet; state-mark resolution policy is deferred to a later orchestration-focused task.
5. **Handler B: Exact-match lookup (post-intake, not "LLM slow path")**
   - **Perspective shift (see "Module layering direction" above):** Task 5 is **orchestration**: after Handler A, decide whether an **exact-match** cache row already satisfies the request (using `Meta::Room` mark state or defaults + renderCache exact-match), then publish `RenderReady` on hit or hand off toward generation. That branching **belongs in the render orchestration cascade** (Handler B under **Handler plan**), not as an undocumented side effect of **`generateRoomPreview`**.
   - Implement exact-match lookup in the **`RenderRequested` -> `findRender`** lifecycle and publish `RenderReady` on hit.
   - Naming note: "slow path" here means **after pointer fast-path miss** (Handler A), not the generation/LLM path. Exact-match hit is still a **fast** outcome for the user (no generation).
   - Acceptance criteria (preview-aligned, when the same rule applies to preview orchestration):
     - exact-match hit must not emit any "generating" signal (no `RenderGenerationStarted`, no preview "generating" step).
   - Acceptance criteria (presence-aligned, later when wired):
     - `RenderReady` is emitted for exact-match hits without starting generation.
   - Explicitly deferred (do not solve in Task 5):
     - presence/observer gating of whether `RenderReady` should be published at all when there are no passive observers. That policy is introduced and validated under Task 7 (state-change subscription wiring), because the preview wedge is not presence-gated.
     - any fallback/default algorithm for missing room state marks; until that policy is chosen, missing marks remain an explicit intake error.

### Tier 2: Mostly clear tasks (some implementation choices open)

6. [x] **Generation path + completion updates (core; done)**
   - [x] Cache-miss branching: when passive resolve finds no satisfying row, **`allowGeneration`** selects generation (`tryPassiveRenderGeneration` / preview `tryGeneration`) vs **`invalidate`** resolve outcome and bus **`RenderInvalidate`** (preview and passive paths stay distinct at the type level).
   - [x] On miss when generation is allowed: call **`generateRoomPreview`** (shared slow path after exact-match): LLM + build cache row fields (markState, renderedContent, provenance, perspectiveId, perspectiveMatcher; optional ids remain future fields).
   - [x] Pre-mint **`DataCategory`** / return **`cacheId`** + materialized **`cacheRecord`** from generation so orchestration can emit **`RenderReady`** with a full row without waiting on the async write round-trip.
   - [x] Persist via the DataSource command (not ad hoc Dynamo from orchestration): **`sendPutCacheRecord`** / `Put Cache Record` on `api.ephemera`, executed by **`mtw.ephemera.renderCache`**.
   - [x] Passive path: mint **`conversationId`**, register **`roomStateRender`** in `internalCache.Conversations`, wire **`onGenerating`** to the composite handle (progress delivery still stubbed in **`materializeRoomStateRender`** until client/stream wiring).
   - [x] Preview-aligned ordering: preview **"generating"** step only on the slow path (exact-match and invalid-context do not emit it); unchanged from preview orchestration in **`renderOrchestration/index.ts`**.

6.5. **Generation path + completion updates (cache lifecycle & presence ordering; open)**
   - Emit **`RenderGenerationStarted`** on the passive / state-driven path when committing to the slow (generation) path (after exact-match miss), before terminal success or failure.
   - React to **`mtw.ephemera.renderCache`** bus outcomes instead of treating the synchronous return from **`generateRoomPreview`** as the only completion signal:
     - On **`Cache Updated`**: update **`Meta::Room.currentCacheByPerspective[perspectiveKey]`** to the persisted **`CACHE#...`** id, then emit **`RenderReady`** (reconcile with today's eager **`RenderReady`** if the product contract requires persistence-ack-first).
     - On **`Cache Error`**: clear/invalidate the perspective pointer entry and emit **`RenderGenerationFailed`** (or defer rerender per policy).
   - Ordering acceptance criteria (presence-aligned):
     - **`RenderGenerationStarted`** before any terminal completion (success/failure).
     - pointer update aligned with **`Cache Updated`** before **`RenderReady`** when that contract is adopted.
   - Add ordering tests (see Task 9) once the above is wired.
   - Explicitly deferred (still not in 6.5):
     - the no-passive-observers early-exit gate for state-driven renders (invalidate pointers only; do not generate). That gate is implemented and tested under Task 7.
7. **State-change subscription wiring**
   - Subscribe renderOrchestration to state change messages.
   - Implement the passive-observer gate (presence/subscription aware). This is the first task where the "tree falls in forest" policy becomes concrete and testable:
     - If no observers: invalidate perspective cache pointers only; do not emit `RenderRequested`, and do not emit lifecycle delivery events (`RenderGenerationStarted` / `RenderReady`).
     - If observers: publish one-or-more `RenderRequested` messages with derived perspective(s), and allow the normal lifecycle cascade to proceed.
   - During the remainder of the invocation, treat `internalCache.RenderCache` as the coherent memoized view after successful cache writes, and rely on `mtw.ephemera.renderCache` to keep that memo aligned when it can.
8. **Perception handler refactor for clean DAG**
   - Split current perception responsibilities into at least two handler roles:
     - intake/request handlers (translate user/system intents into `RenderRequested`)
     - delivery handlers (consume `RenderGenerationStarted`/`RenderReady` and publish user-facing messages)
   - Remove direct room render execution from monolithic Perception handling path, so `renderOrchestration` is the explicit middle layer.
   - Preserve existing behavior for non-render-orchestration perception paths during migration.
9. **Foundational test coverage**
   - Add unit tests for fast-path hit/miss/invalid-pointer behavior.
   - Add ordering tests:
     - `RenderGenerationStarted` before any terminal completion (success/failure)
     - `Cache Updated` before pointer update and `RenderReady`
     - `Cache Error` before `RenderGenerationFailed`
   - Add state-triggered tests for observer/no-observer branching.

### Tier 3: Intentionally foggy tasks (documented unknowns)

10. **Perspective fan-out policy**
   - Unknown: one render per observing perspective vs consolidation heuristics.
   - Unknown: cap/batching strategy when many distinct passive perspectives exist.
11. **Ready payload strategy**
   - Prefer compact `RenderReady` payloads: include `cacheId` (and enough identity to resolve records).
   - Downstream consumers can fetch the full record from `internalCache.RenderCache.get(componentId)` (deduped within the invocation) and select by `DataCategory === cacheId` when needed.
   - Only carry full `cacheRecord` on the bus if you can justify the bus payload size saving more than any memoized fetch cost.
12. **Cross-domain subscription boundaries with `perception`**
   - Clarify that `perception` is responsible for delivery and user-facing message construction, while `renderOrchestration` is responsible for render policy and cache lifecycle coordination (including reacting to `mtw.ephemera.renderCache` outcomes).
   - Still unknown: the exact split of targeting/derivation logic between `renderOrchestration` vs `perception`; capture the decision as a contract in the message types.
13. **Generalization beyond Rooms**
   - Unknown: whether Maps/Features can share identical invalidation + passive-observer rules.
   - Expect contract reuse, but policy likely diverges by component type.
14. **RenderCache migration checklist**
    - Track the long-term RenderCache decoupling steps in `../renderCache/AGENT.migration.md` (lookup moves into `internalCache.RenderCache`, persistence moves behind `mtw.ephemera.renderCache`).

## Integration follow-up after event contracts land

- Add render orchestration event types to `lambda/ephemera/messageBus/baseClasses.ts` union types.
- Register `renderOrchestration` subscriptions in `lambda/ephemera/messageBus/index.ts`.
- Add perception-side lifecycle consumers for `RenderGenerationStarted` and `RenderReady`.
- Wire `handleRenderOrchestrationMessage` / `orchestratePassiveRenderRequestedBatch` to consume `RenderRequested` and emit `RenderReady` / `RenderInvalidate` / `RenderError` as appropriate (done).
- **Multi-stage WebSocket / authoring preview:** Correlated **multiple messages per request** (e.g. generating vs completion) for **`generateRoomPreview`** is planned in [`../conversations/AGENT.planning.md`](../conversations/AGENT.planning.md) (**Multi-stage WebSocket delivery and coordination trap**), [`../conversations/AGENT.planning.tasklist.md`](../conversations/AGENT.planning.tasklist.md) **section 4**, and [`../../../charcoal-client/src/slices/lifeLine/AGENT.md`](../../../charcoal-client/src/slices/lifeLine/AGENT.md). Align **`RenderGenerationStarted`** / cache lifecycle with that contract when wiring preview orchestration.

