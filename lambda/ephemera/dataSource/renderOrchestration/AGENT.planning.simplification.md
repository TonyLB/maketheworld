*Status: ACTIVE SIMPLIFICATION TRACKER - reduce parallel speculative paths.*

## Purpose

Track parallel implementation tracks, point at the canonical runtime path, and keep **remaining work** visible. This is a declutter board, not a design brainstorm doc.

For full render-orchestration roadmap (lifecycle, state, perception), see `AGENT.planning.md`.

---

## What's next (remaining work)

These are the active simplification / alignment items worth attention next:

1. **Track B (`dataSource/state/getOrStartRoomRenderForState.ts`)**  
   Decide: integrate as a thin caller of `findRender` / shared intake, or retire and stop treating its scaffold as a runtime contract.

2. **Preview vs passive policy alignment** (same shell, different knobs)  
   Centralize intake-error mapping in one strategy (policy table, not duplicated control flow). Optional: explicit `pointerMode` / shared bootstrap helper without merging product behavior.

3. **Lifecycle and cache ordering (Task 6.5 in `AGENT.planning.md`)**  
   `RenderGenerationStarted`, react to `mtw.ephemera.renderCache` outcomes, pointer updates vs eager `RenderReady` - still open.

4. **State-change subscription + observer gate (Task 7)**  
   Wire `renderOrchestration` to state-change messages; no-observers vs observers policy.

5. **Perception refactor (Task 8)**  
   Split intake vs delivery; consume lifecycle events instead of monolithic imperative paths where appropriate.

6. **Docs**  
   Keep `AGENT.md`, `AGENT.planning.md`, and this file aligned when wiring changes.

---

## Canonical wiring (current)

| Concern | Owner |
|---------|--------|
| Policy + single-item orchestration | `dataSource/renderOrchestration/orchestrationHandler.ts` (`orchestrateRenderRequest`) |
| A-phase intake | `requestIntake.ts` (`intakeRenderRequested`) |
| B-phase resolve | `findRender.ts`, `tryGeneration.ts` |
| Types + guards | `dataSource/renderOrchestration/events.ts` (primary definitions; not the primary ingress) |
| **Ingress (API and synthetic internal requests)** | `dataSource/renderOrchestration/` subscribes to `api.ephemera` envelopes (`Render Requested` / `Render Preview Requested`), maps to legacy payloads, calls `orchestrateRenderRequest`. Wired from `app.ts` via side-effect import. |

Preview generation implementation: `generateRoomPreview.ts`.  
Missing `Meta::Room.state.marks` on passive intake remains a temporary explicit error until state policy decides defaults.

**DataSource ingress (evolving):** internal-only, non-replayable, outbound contract still TBD; may absorb orchestration over time. See `lambda/ephemera/dataSource/renderOrchestration/AGENT.md`.

---

## Input boundary (stable)

Normalized core input: `RenderResolveInput` in `baseClasses.ts` (maps from `RenderPreviewRequested` / `intakeRenderRequested` after `Meta::Room`). Correlation fields (`characterId`, `targets`, `conversationId`, etc.) stay outside that type until an explicit correlation layer exists.

---

## Parallel tracks (compact)

| Track | Status |
|-------|--------|
| **A** Canonical orchestration (`orchestrateRenderRequest`, intake, `findRender`, delivery) | Active - evolve in place |
| **B** `dataSource/state/getOrStartRoomRenderForState.ts` | **Open** - integrate or retire |
| **C** App preview tests / direct `RenderPreviewRequested` bus sends | **Obsolete** - app uses `sendRenderPreviewRequested` + DataSource ingress; tests assert `StreamingEvent` envelope |

---

## Completed work (historical summary)

Condensed so it does not dominate this file:

- **Unified stack:** Single-item preview and passive share `orchestrateRenderRequest`; batch passive uses `orchestratePassiveRenderRequestedBatch`.
- **Three horizontals:** Intake (`RenderResolveInput`) -> `findRender` (effect-only, terminals via `sendMessage`) -> delivery (materialize / `ConversationStep` / bus).
- **Coordination trap resolved:** `findRender` + `tryGeneration` use sendMessage-first terminals; no duplicate orchestration stacks for preview vs passive.
- **Ingress relocation:** Request subscription moved from `registerRenderOrchestration` to `dataSource/renderOrchestration` (evolving DataSource; see its `AGENT.md`).

Do **not** add a fourth parallel orchestration stack. Unify core + delivery, then evolve callers (already started with ingress adapter).

---

## Simplification policy (when adding code)

1. Add new parallel tracks to this inventory immediately.
2. Mark status: `keep` | `merge into canonical` | `retire` | `quarantine (do not extend)`.
3. One-line owner module.
4. Do not extend non-canonical tracks with new features.

---

## Exit criteria (this declutter phase)

This simplification pass is complete when:

- Each responsibility has one canonical owner module.
- No unresolved parallel-track entries remain (Track B resolved).
- Planning docs match runtime wiring without ambiguity.

---

## Decision log (append-only)

Use this template for new entries:

- **Date:** / **Topic:** / **Decision:** / **Canonical owner:** / **Tracks affected:** / **Follow-up tasks:**

**2026-03-28 through 2026-03-31** - Consolidated decisions (detail preserved in git history): centralized `findRender`; `intakeRenderRequested` success/error; passive batch shell; sendMessage-first `findRender` + `tryGeneration`; unified `orchestrateRenderRequest` (single-item entry; batch helper on a later-removed `renderOrchestration` barrel, then removed once ingress moved to DataSource).

**Ingress (post-2026-03-31)** - Render request ingress moved to `lambda/ephemera/dataSource/renderOrchestration/` (evolving DataSource; orchestration may consolidate there). App preview path emits `api.ephemera` streaming envelopes instead of raw `RenderPreviewRequested` bus messages.
