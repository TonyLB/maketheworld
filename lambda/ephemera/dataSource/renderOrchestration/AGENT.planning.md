*Status: ACTIVE PLANNING DOCUMENT - renderOrchestration (v2).*

## Purpose

Local implementation plan for `lambda/ephemera/dataSource/renderOrchestration/` (render orchestration v2).

The **system-level narrative** that previously lived in `lambda/ephemera/dataSource/state/AGENT.v2.planning.md` is **folded into this file** --- see [Folded: state v2 orchestration plan (historical record)](#folded-state-v2-orchestration-plan-historical-record). The `state/` copy is a **superseded stub** until `state/` docs are consolidated.

**Related docs**

- Orphaned state-package scaffold (Track B, scheduled removal): `../state/AGENT.declutter.md`
- Status, graduation criteria, product split (preview vs presence), parallel-track policy: `AGENT.md` (same directory)
- State package history (v1, v3 DataSource): `../state/AGENT.v1.planning.md`, `../state/AGENT.v3.planning.md`
- Cross-cutting epic: `../../AGENT.ephemeraPerceptionVertical.planning.md`

---

## Folded: state v2 orchestration plan (historical record)

*The following was moved from `dataSource/state/AGENT.v2.planning.md` (2026 consolidation). It describes the original **why** and **phase** structure for message-bus orchestration; execution status and wiring tables below are the living truth.*

### Relationship to v1

v1 (see `../state/AGENT.v1.planning.md`) established foundations: `Meta::Room` state shape, default mark derivation, renderCache exact-match primitives, fast-path cache validation. **v2** focused on **architecture and orchestration**, not re-defining those foundations.

### Why v2 existed (problem statement)

The v1 direction exposed a mismatch: the pipeline is **asynchronous and multi-step** (cache decision, possible generation start, completion, perception updates). A **single synchronous helper return** is not a natural fit for "early feedback now, final update later." v2 moved orchestration into a **messageBus event-cascade**.

### Architectural split (subsystem roles)

1. **`renderCache`** --- Lookup/generation primitives and cache row persistence. No event delivery ownership.
2. **`state`** (`dataSource/state/`) --- World-state on `Meta::Room` (marks, situation, etc.); default marks and merge helpers; **does not** own cache pointer lifecycle or invalidation semantics.
3. **`renderOrchestration`** (this package) --- Policy and lifecycle: cache hit/miss path, pointer validation/repair (`currentCacheByPerspective`), exact match, generation, `RenderInvalidate`; early feedback on miss; ready after resolve. Owns cascade steps and status transitions.
4. **`perception`** --- Enrich cache-backed data into message-ready content; placeholder/final delivery to characters.

### Original v2 goals (state planning doc)

1. MessageBus-driven orchestration for Room render lifecycle.
2. Early generation feedback ("Generating...") for clients.
3. Final ready feedback after cache write + pointer update.
4. Keep `renderCache` as data primitive and `perception` as delivery layer.
5. Migration path to broader DataSource adoption when replay/subscription justify it.

### Event-cascade plan (phases A--D, original)

**Phase A: Event contracts** --- Internal messageBus shapes: `RenderRequested`, `RenderReady`, `RenderGenerationStarted`, `RenderGenerationCompleted`, `RenderGenerationFailed` (optional). Context: `componentId`, request-scoped `characterId` vs update-scoped `targets`, `perspective`, optional `messageGroupId`, ready payloads with `cacheRecord` or pointer.

**Phase B: Orchestrator handlers** --- (1) Request: read `Meta::Room`, perspective key, validate pointer in `currentCacheByPerspective`. (2) Slow-path: markState, exact-match in renderCache, emit `RenderReady` on hit. (3) Generation-start: on miss + allowed generation, emit `RenderGenerationStarted`, start async generation. (4) Generation-completion: persist cache row/pointers, emit completion then `RenderReady` (or combined).

**Phase C: Perception integration** --- On `RenderGenerationStarted`: placeholder header/message (Room first). On `RenderReady`: enrich and send final; drop stale perception/`componentRender` when completion replaces placeholder (distinct from Meta::Room pointer maintenance in orchestration).

**Phase D: Tests** --- Lifecycle ordering: generation-start before completion; ready after cache write + `currentCacheByPerspective` update; placeholder then final header; generation failure handling.

### Open decisions (from state v2, may overlap Task 6.5+)

1. Event payload: full `cacheRecord` vs `(componentId, cacheId)` and fetch.
2. Failure semantics: dedicated failure event vs error variants on ready.
3. Scope: Rooms-first in v2; Maps as first extension candidate.
4. Perspective pointers: prefer `currentCacheByPerspective: Record<string, cacheId>` (see Schema section below).

### Out of scope (original v2 list)

- Generic component-state API for all component types.
- Full DataSource migration for lifecycle events (in progress elsewhere).
- Feature/Knowledge passive update semantics.

### Incremental migration (original v2 note)

1. Keep existing paths working.
2. Introduce event contracts and handlers behind the same entrypoints.
3. Move call sites from direct helper returns to cascade events.
4. Remove legacy direct orchestration only after parity tests pass.

### Perspective pointer migration (data model, from state v2)

`currentCacheId` alone is insufficient; cache rows are perspective-constrained. Use `currentCacheByPerspective: Record<string, string>` (key = perspective fingerprint, value = `CACHE#...`). **Staleness:** handled in **render orchestration** on each resolve (`findRender`); optional eager clears on state write are a product choice, not required for correctness.

**Rollout guidance:** Add map as additive schema; treat legacy `currentCacheId` as fallback during migration; remove when orchestration/tests are perspective-scoped; use versioned perspective keys (`PERSPECTIVE#v1#...`); dual-read during rollout as needed.

---

## Goals (v2)

1. MessageBus-based lifecycle for render orchestration (where the product contract requires it).
2. Early feedback (`RenderGenerationStarted` / preview steps) vs terminal readiness aligned with cache + pointer reality.
3. Final readiness signals when cache write + pointer updates match the chosen contract (see open Task 6.5).
4. Clean splits: `state`, `renderCache`, this package (`dataSource/renderOrchestration`), `perception` (see layering below).

---

## Canonical wiring (current)

| Piece | Where |
|-------|--------|
| Single-item orchestration (preview + passive) | `dataSource/renderOrchestration/orchestrationHandler.ts` -> `orchestrateRenderRequest` |
| Passive batch | `orchestratePassiveRenderRequestedBatch` / `requestIntakeMessage` |
| A-phase intake | `requestIntake.ts` (`intakeRenderRequested` -> `RenderResolveInput`) |
| B-phase resolve | `findRender.ts` + `tryGeneration.ts` (terminals via `sendMessage`) |
| Types, guards | `dataSource/renderOrchestration/events.ts` (primary ingress is DataSource) |
| **Ingress** | `app.ts` imports `./dataSource/renderOrchestration`; API paths emit `api.ephemera` envelopes (`sendRenderPreviewRequested`, etc.). Adapter maps to legacy `RenderRequested` / `RenderPreviewRequested` and calls `orchestrateRenderRequest`. |

Preview still streams via conversations (`ConversationStep`); bridging to lifecycle events for preview is future-facing (see `lambda/ephemera/dataSource/renderOrchestration/AGENT.md`).

---

## Design direction (orchestration vs generation)

**Orchestration** = sequencing, policy (pointer vs exact vs generate), and what gets published / materialized. It belongs in `dataSource/renderOrchestration/orchestrationHandler`, `findRender`, intake --- not hidden inside `generateRoomPreview` as a second exact-match stack.

**Generation** = the slow path after orchestration commits (`generateRoomPreview` and cache write helpers).

**Intake** does not call `findRender` or publish lifecycle messages. **Shell** chains intake -> `findRender` -> enrichment/materialize (passive and preview share `orchestrateRenderRequest` with intentional branch differences).

**Duplication guard:** If orchestration owns exact-match first, `generateRoomPreview` must not re-implement it as a hidden fast path.

These boundaries can move incrementally; this doc tracks intent, not a single big-bang.

---

## Input boundary (stable)

Normalized core input: **`RenderResolveInput`** in `baseClasses.ts` (maps from `RenderPreviewRequested` / `intakeRenderRequested` after `Meta::Room`). **Correlation fields** (`characterId`, `targets`, `conversationId`, etc.) stay **outside** that type until an explicit correlation layer exists.

---

## Lifecycle events (why preview differs)

Passive / state-driven flows aim for composable lifecycle messages (`RenderRequested`, `RenderGenerationStarted`, `RenderReady`, ...) and eventual presence gating (Task 7).

Authoring preview is request-scoped and uses conversations, not `perception` --- so lifecycle events may be unused there even when they are the long-term abstraction for passive paths. Do not let preview-only criteria force presence design (and vice versa).

---

## Reference: internal message shapes

Authoritative types and guards: `dataSource/renderOrchestration/events.ts`. Draft intent (all use `componentId` for future non-Room use):

- **RenderRequested** --- start lifecycle (direct or derived trigger).
- **RenderGenerationStarted** --- committed to generation; UI placeholder / "generating".
- **RenderReady** --- cache-backed result (hit or post-generation).
- **RenderGenerationCompleted / Failed** --- optional; may collapse into `RenderReady` + errors.

**Handler plan (conceptual map to code):** The old A/B/C labels correspond to intake (`intakeRenderRequested` + pointer fast path), `findRender` (pointer validate, exact match, invalidate, generation hook), and generation/materialize --- not separate top-level handler modules.

---

## State change triggers (Task 7)

**Intent:** `state` publishes state-change messages; `renderOrchestration` subscribes, applies observer policy (no observers -> invalidate pointers only; observers -> `RenderRequested` fan-out), and centralizes cache invalidation vs regeneration policy.

Details unchanged from prior plan; implementation is **not** done until Task 7 lands.

---

## Schema: perspective pointers

Room metadata uses `currentCacheByPerspective: Record<string, string>` (key = perspective fingerprint, value = `CACHE#...`). Legacy `currentCacheId` may still be read as fallback during migration; new writes target the map.

**Migration narrative and rationale:** see [Perspective pointer migration](#perspective-pointer-migration-data-model-from-state-v2) in the folded state v2 section above.

---

## InternalCache RenderCache (invocation memo)

Request-scoped memo for cache rows: `internalCache/renderCache.ts`, cleared at handler start. `mtw.ephemera.renderCache` write path calls `internalCache.RenderCache.set` after successful `putCacheRecord` so same-invocation reads stay coherent.

---

## What's next (open work)

Ordered roughly by dependency / product unlock:

1. **Preview vs passive intake policy (open)**  
   Centralize **intake-error mapping** in one strategy (policy table, not duplicated control flow). Preview and passive share the same orchestration shell with intentional branch differences; errors should not sprawl. Optional: explicit `pointerMode` / shared bootstrap helper without merging product behavior.

2. **Task 6.5 --- Cache lifecycle and ordering (open)**  
   - Emit `RenderGenerationStarted` on passive/state path when committing to generation (after exact-match miss).  
   - React to `mtw.ephemera.renderCache` bus outcomes (`Cache Updated` / `Cache Error`) instead of treating synchronous `generateRoomPreview` return as sole completion signal: pointer update from `Cache Updated`, then `RenderReady` (reconcile with any eager `RenderReady` today).  
   - Ordering tests (overlap with Task 9).  
   - No-observers gate stays **out** of 6.5 (Task 7).

3. **Task 7 --- State-change subscription + observer gate**  
   Subscribe to state changes; implement passive-observer policy; publish `RenderRequested` only when observers exist; otherwise invalidate pointers only.

4. **Task 8 --- Perception refactor**  
   Split intake vs delivery; `renderOrchestration` as explicit middle layer; delivery handlers consume lifecycle events.

5. **Task 9 --- Foundational tests**  
   Fast-path hit/miss/invalid-pointer; ordering (`RenderGenerationStarted` before terminals; cache outcome ordering); state-triggered observer branching.

6. **Tier 3 (foggy)** --- Perspective fan-out policy (10), compact `RenderReady` payloads (11), cross-domain boundaries with `perception` (12), generalization beyond Rooms (13), RenderCache migration checklist (14) --- see `../../renderCache/AGENT.migration.md` for 14.

7. **Docs** --- Keep `AGENT.md` and this file aligned when wiring changes.

**Client / WebSocket:** Multi-stage preview delivery remains coordinated with `../../conversations/AGENT.planning.md`, `../../conversations/AGENT.planning.tasklist.md` section 4, and `charcoal-client` lifeLine docs when wiring `RenderGenerationStarted` and cache lifecycle into preview UX.

---

## Completed work (catch-up summary)

Tier 1--2 items that were fully described in older revisions of this file; details live in git history and tests.

- **Types + perspective key:** `Meta::Room.currentCacheByPerspective`, shared `computePerspectiveKey` / versioning notes (Tier 1 tasks 1--2).
- **Events:** `events.ts` with guards (Tier 1 task 3).
- **Intake fast path:** `intakeRenderRequested` pointer validation + marks error policy (Tier 1 task 4).
- **Handler B / exact-match:** `findRender` exact-match branch + shared `tryGeneration`; not duplicated inside `generateRoomPreview` as policy (Tier 1 task 5).
- **Generation path (Tier 2 task 6):** Cache miss branching, `generateRoomPreview` on miss, pre-mint cache id, persist via `mtw.ephemera.renderCache`, passive conversation registration, preview "generating" only on slow path --- unified under `orchestrateRenderRequest`.
- **Ingress relocation:** Request subscription moved to `dataSource/renderOrchestration` (evolving DataSource; see its `AGENT.md`).

**Historical decisions (March 2026, condensed)** --- Detail lives in git history. Unified `findRender` and `intakeRenderRequested` success/error paths; passive batch shell; sendMessage-first `findRender` + `tryGeneration`; unified `orchestrateRenderRequest`. Ingress moved to `dataSource/renderOrchestration/`; app preview emits `api.ephemera` streaming envelopes instead of raw `RenderPreviewRequested` bus messages. Track B (`getOrStartRoomRenderForState`) documented for removal under `../state/AGENT.declutter.md`.

---

## Integration status (messageBus and consumers)

- **Types:** `RenderOrchestrationMessage` is part of the messageBus type story (`messageBus/baseClasses.ts` imports from `dataSource/renderOrchestration/events`).
- **Ingress:** Render requests enter via the DataSource adapter + `api.ephemera` envelopes, not `registerRenderOrchestration` on the bus.
- **Perception:** Lifecycle consumers for `RenderGenerationStarted` / `RenderReady` remain follow-up work (Tasks 7--8).
- **Wiring:** `orchestrateRenderRequest` / passive batch consume `RenderRequested` and drive materialize + bus as implemented; further contract tightening is 6.5+.
