*Status: ACTIVE PLANNING DOCUMENT - renderOrchestration (v2).*

## Purpose

Local implementation plan for `lambda/ephemera/renderOrchestration/`, aligned with `lambda/ephemera/state/AGENT.v2.planning.md`.

**Related docs**

- Parallel-track declutter: `AGENT.planning.simplification.md`
- Evolving DataSource for render orchestration (ingress today; see graduation): `lambda/ephemera/dataSource/renderOrchestration/AGENT.md`

---

## Goals (v2)

1. MessageBus-based lifecycle for render orchestration (where the product contract requires it).
2. Early feedback (`RenderGenerationStarted` / preview steps) vs terminal readiness aligned with cache + pointer reality.
3. Final readiness signals when cache write + pointer updates match the chosen contract (see open Task 6.5).
4. Clean splits: `state`, `renderCache`, `renderOrchestration`, `perception` (see layering below).

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

Preview still streams via conversations (`ConversationStep`); bridging to lifecycle events for preview is future-facing (see `lambda/ephemera/renderOrchestration/AGENT.md` and `dataSource/renderOrchestration/AGENT.md`).

---

## Design direction (orchestration vs generation)

**Orchestration** = sequencing, policy (pointer vs exact vs generate), and what gets published / materialized. It belongs in `dataSource/renderOrchestration/orchestrationHandler`, `findRender`, intake --- not hidden inside `generateRoomPreview` as a second exact-match stack.

**Generation** = the slow path after orchestration commits (`generateRoomPreview` and cache write helpers).

**Intake** does not call `findRender` or publish lifecycle messages. **Shell** chains intake -> `findRender` -> enrichment/materialize (passive and preview share `orchestrateRenderRequest` with intentional branch differences).

**Duplication guard:** If orchestration owns exact-match first, `generateRoomPreview` must not re-implement it as a hidden fast path.

These boundaries can move incrementally; this doc tracks intent, not a single big-bang.

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

---

## InternalCache RenderCache (invocation memo)

Request-scoped memo for cache rows: `internalCache/renderCache.ts`, cleared at handler start. `mtw.ephemera.renderCache` write path calls `internalCache.RenderCache.set` after successful `putCacheRecord` so same-invocation reads stay coherent.

---

## What's next (open work)

Ordered roughly by dependency / product unlock:

1. **Task 6.5 --- Cache lifecycle and ordering (open)**  
   - Emit `RenderGenerationStarted` on passive/state path when committing to generation (after exact-match miss).  
   - React to `mtw.ephemera.renderCache` bus outcomes (`Cache Updated` / `Cache Error`) instead of treating synchronous `generateRoomPreview` return as sole completion signal: pointer update from `Cache Updated`, then `RenderReady` (reconcile with any eager `RenderReady` today).  
   - Ordering tests (overlap with Task 9).  
   - No-observers gate stays **out** of 6.5 (Task 7).

2. **Task 7 --- State-change subscription + observer gate**  
   Subscribe to state changes; implement passive-observer policy; publish `RenderRequested` only when observers exist; otherwise invalidate pointers only.

3. **Task 8 --- Perception refactor**  
   Split intake vs delivery; `renderOrchestration` as explicit middle layer; delivery handlers consume lifecycle events.

4. **Task 9 --- Foundational tests**  
   Fast-path hit/miss/invalid-pointer; ordering (`RenderGenerationStarted` before terminals; cache outcome ordering); state-triggered observer branching.

5. **Tier 3 (foggy)** --- Perspective fan-out policy (10), compact `RenderReady` payloads (11), cross-domain boundaries with `perception` (12), generalization beyond Rooms (13), RenderCache migration checklist (14) --- see `../renderCache/AGENT.migration.md` for 14.

6. **Docs** --- Keep `AGENT.md`, this file, and `AGENT.planning.simplification.md` aligned when wiring changes.

**Client / WebSocket:** Multi-stage preview delivery remains coordinated with `../conversations/AGENT.planning.md`, `../conversations/AGENT.planning.tasklist.md` section 4, and `charcoal-client` lifeLine docs when wiring `RenderGenerationStarted` and cache lifecycle into preview UX.

---

## Completed work (catch-up summary)

Tier 1--2 items that were fully described in older revisions of this file; details live in git history and tests.

- **Types + perspective key:** `Meta::Room.currentCacheByPerspective`, shared `computePerspectiveKey` / versioning notes (Tier 1 tasks 1--2).
- **Events:** `events.ts` with guards (Tier 1 task 3).
- **Intake fast path:** `intakeRenderRequested` pointer validation + marks error policy (Tier 1 task 4).
- **Handler B / exact-match:** `findRender` exact-match branch + shared `tryGeneration`; not duplicated inside `generateRoomPreview` as policy (Tier 1 task 5).
- **Generation path (Tier 2 task 6):** Cache miss branching, `generateRoomPreview` on miss, pre-mint cache id, persist via `mtw.ephemera.renderCache`, passive conversation registration, preview "generating" only on slow path --- unified under `orchestrateRenderRequest`.
- **Ingress relocation:** Request subscription moved to `dataSource/renderOrchestration` (evolving DataSource; see its `AGENT.md`).

---

## Integration status (messageBus and consumers)

- **Types:** `RenderOrchestrationMessage` is part of the messageBus type story (`messageBus/baseClasses.ts` imports from `dataSource/renderOrchestration/events`).
- **Ingress:** Render requests enter via the DataSource adapter + `api.ephemera` envelopes, not `registerRenderOrchestration` on the bus.
- **Perception:** Lifecycle consumers for `RenderGenerationStarted` / `RenderReady` remain follow-up work (Tasks 7--8).
- **Wiring:** `orchestrateRenderRequest` / passive batch consume `RenderRequested` and drive materialize + bus as implemented; further contract tightening is 6.5+.
