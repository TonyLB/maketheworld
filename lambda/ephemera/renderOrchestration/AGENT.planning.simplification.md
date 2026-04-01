*Status: ACTIVE SIMPLIFICATION TRACKER - reduce parallel speculative paths.*

## Why this exists

`renderOrchestration` planning has spawned multiple partial implementations in different places.
This file tracks those parallel tracks so we can:

- pick one canonical path per responsibility
- stop accidental duplicate work
- retire or quarantine speculative branches quickly

Use this as a declutter board, not as a design brainstorm doc.

## Strategic intent: two prototypes, one core (why migrate toward unity)

Room generation did not start with two product pipelines. It started with a **first prototype**: preview-style flows (`generateRoomPreview` and friends) to prove that generation could work **at all**, using the roughest viable delivery. The **second prototype** is what we actually want long-term: **renders that emerge from state changes** (passive / lifecycle-driven orchestration).

The **manual preview development path is intentionally disposable** once it has served its purpose. What we must **not** throw away is the **core behavior** that preview validated: exact-match vs generation, cache semantics, error and ordering properties, and the unit tests that guard them.

So the high-value artifact is **not** "a refined preview pipeline and a separate optimized state-update pipeline" forever. It is **abstracting the shared core** so we:

- keep everything that worked in the first prototype
- add everything the second prototype needs (meta, pointers, lifecycle events, presence policy later)
- **progressively migrate** preview-shaped code into that shared core while tests stay green, instead of letting two divergent definitions of "render" drift apart

That is why simplification work should **move toward** a unified core (shared resolve logic + thin input/output adapters), not **away** from it. Parallel tracks in this inventory are technical debt when they duplicate that core without a clear merge or retire plan.

## Canonical direction (current)

Until explicitly changed here, assume:

- Orchestration policy lives in `lambda/ephemera/renderOrchestration/`.
- Preview generation implementation lives in `lambda/ephemera/renderOrchestration/generateRoomPreview.ts`.
- Passive A-phase is `intakeRenderRequested` in `requestIntake.ts`; resolve and delivery run in `orchestrationHandler.ts` and `index.ts` (messageBus cascade).
- Single-item orchestration for both preview and passive is **`orchestrateRenderRequest`** in `orchestrationHandler.ts`: it accepts `RenderRequested | RenderPreviewRequested`, branches for bootstrap conversation row, handle acquisition, and `findRender` pointer policy, then runs the shared intake -> errors -> `findRender` pipeline. **`handleRenderOrchestrationMessage`** in `index.ts` dispatches every payload with `orchestrateRenderRequest({ payload, messageBus })`.
- Missing `Meta::Room.state.marks` in intake is a temporary explicit error constraint.

## Input boundary (v1)

The first shared choke-point type is `RenderResolveInput` in:

- `lambda/ephemera/renderOrchestration/baseClasses.ts`

It is the normalized **A-phase output** / **core input**: room, perspective, authoritative `markState`, `markProvenance` (`meta` vs `preview`), optional `pointerHint` from `Meta::Room.currentCacheByPerspective`, plus optional generation fields.

**Mapping (current code):**

| Source | How it fills `RenderResolveInput` |
|--------|-----------------------------------|
| `RenderPreviewRequested` (`orchestrateRenderRequest` in `orchestrationHandler.ts`) | `roomId` = `componentId`; `perspective` = payload; `markState` = payload; `markProvenance` = `'preview'`; `pointerHint` omitted; `allowGeneration` / `generationContextWml` from payload. |
| `intakeRenderRequested` (after `Meta::Room` load) | `roomId` = room `componentId`; `perspective` = payload; `markState` = `metaRoom.state.marks` (or `marks_missing` before resolve); `markProvenance` = `'meta'`; `pointerHint` = `currentCacheByPerspective[perspectiveKey]` if set; `allowGeneration` from payload or explicit `false` when omitted; `generationContextWml` from `RenderRequested`. |

Bus-only fields (`characterId`, `targets`, `messageGroupId`, `conversationId`, `requestId`) stay **outside** this type until we define an output boundary or explicit correlation layer.

## Parallel speculative tracks inventory

### Track A: Active renderOrchestration cascade (canonical)

- **Location:** `renderOrchestration/index.ts`, `renderOrchestration/requestIntake.ts`
- **Status:** Keep and evolve
- **Reason:** Runtime-integrated path; tests and wiring are active.
- **Next:** Continue implementing Tier 1/2 tasks here unless this file records a direction change.

### Track B: State helper scaffold duplicating orchestration intent

- **Location:** `state/getOrStartRoomRenderForState.ts` (+ test scaffold)
- **Status:** Unresolved parallel track
- **Observed overlap:** Fast-path cache pointer validation + slow-path exact-match/generation intent.
- **Current risk:** Competes with Track A for ownership of the same policy.
- **Decision needed:** Either:
  - integrate as a shared helper called by Track A, or
  - de-scope/retire and stop treating its tests as runtime expectation.

### Track C: Older direct app-level preview invocation expectations

- **Location:** prior expectations in `app.generateRoomPreview.test.ts`
- **Status:** Merged into canonical path
- **Resolution:** App now publishes `RenderPreviewRequested`; orchestration handles exact-match/generation path.

## Simplification policy

When a new implementation appears for an existing responsibility:

1. Add it to this inventory immediately.
2. Mark one status:
   - `keep`
   - `merge into canonical`
   - `retire`
   - `quarantine (do not extend)`
3. Record the owner module in one line.
4. Do not add new features to non-canonical tracks.

## Unified orchestration shape (target)

**Goal:** Replace parallel vertical stacks (historically separate preview vs passive orchestration) with **horizontal layers**: same responsibilities, one place each. Single-item preview and passive now share `orchestrateRenderRequest`; batch passive remains `orchestratePassiveRenderRequestedBatch`.

**Three horizontals**

| Layer | Role | Notes |
|-------|------|--------|
| **Intake** | Wire / world -> `RenderResolveInput` (A-phase) | Passive: `intakeRenderRequested` returns `RenderResolveInput` (`success`/`error`). Preview: `intakeRenderPreviewRequested` inside `orchestrateRenderRequest` (success-only mapping today). Intake-only errors (e.g. missing marks) do not publish the bus. |
| **findRender** (resolve) | `RenderResolveInput` + `FindRenderDependencies` -> **`Promise<void>`** (B-phase core) | Terminals emit only via `deps.sendMessage(RenderResolveOutput)`. Pointer validation, exact-match, shared `tryGeneration` hook, `invalidate` when generation returns `skip`. Policy for pointer clear lives in one place. |
| **Delivery** | `RenderResolveOutput` through conversation `sendMessage` -> materialize / bus | `materializeRoomStateRender` / `materializeGenerateRoomPreview` map terminal resolve shapes to `RenderReady` / `RenderInvalidate` / `RenderError` or WebSocket steps. Preview vs passive differ in how the handle is obtained, not in duplicate resolve stacks. |

**Delivery layer (phase 1 done):** Terminal payloads reach clients through conversation `sendMessage` (wired from `FindRenderDependencies.sendMessage` and from shared `tryGeneration`); materialize layers shape to bus or `ConversationStep`.

**Resolve layer (phase 2 done):** `renderOrchestration/findRender.ts` exports `findRender` (pointer validation, exact-match, `tryGeneration` hook, `invalidate` when no match and generation does not run). Pointer clear on invalid hint lives only here. Shared `tryGeneration.ts` wraps `generateRoomPreview` for preview and passive; `index.ts` re-exports `findRender` for other callers (e.g. Track B).

**Phased sequence (recommended order)**

1. **Delivery first** -- [done] Extract delivery from `requestIntake.ts` and `index.ts`; enrich helpers now live inside materialize (`roomStateRender` / `generateRoomPreview`); both paths run **after** resolve.
2. **findRender second** -- [done] Shared resolve in `findRender.ts`; passive and preview single-item paths call `findRender` from `orchestrateRenderRequest` in `orchestrationHandler.ts`; terminals emit via `sendMessage` (`findRender` deps + shared `tryGeneration.ts`).
3. **Intake / shell third** -- [done] Passive A-phase: `requestIntake.ts` (`intakeRenderRequested`) returning `RenderResolveInput` (`success`/`error`). Passive shell: `orchestrationHandler.ts` (`orchestratePassiveRenderRequestedBatch`, alias `requestIntakeMessage`) chains intake -> `findRender`. `index.ts` `handleRenderOrchestrationMessage` fans out to `orchestrateRenderRequest` for each `RenderRequested` / `RenderPreviewRequested` payload; preview intake is `intakeRenderPreviewRequested` (invoked inside `orchestrateRenderRequest` for preview payloads). Optional later: one intake surface for all request types.

### Historical: coordination trap (`findRender` / `tryGeneration` had to move together)

Previously, pushing terminals only through `findRender` did not help while `tryGeneration` still returned full `RenderResolveOutput`; conversely, changing only `tryGeneration` was blocked until `findRender` could branch on control (`skip` vs success/fail) and emit invalidate in one place. **This is resolved** by the two-level work below.

### Two-level refactor (sendMessage-first resolve) -- [done]

Implemented coordinated changes so terminals are visible on **`sendMessage`**, not on the `findRender` return channel (`findRender` is **`Promise<void>`**).

1. **`tryGeneration` (`tryGeneration.ts`):** Shared adapter calls `generateRoomPreview`, emits progress/terminals via injected `sendMessage`, returns **`RenderGenerationReturn`** (`success` | `skip` | `fail`) for control only. `allowGeneration === false` maps to **`skip`** (invalidate in `findRender`). Preview and passive both use this module.

2. **`findRender`:** `FindRenderDependencies` includes **`sendMessage`**; pointer hit, exact match, and invalidate-after-**skip** paths **`await sendMessage(output)`**. Generation success/fail terminals are emitted inside **`tryGeneration`**; `findRender` returns **`void`** in those cases.

**Intentionally unchanged at this layer:** `generateRoomPreview` still returns **`GenerateRoomPreviewResult`** to the adapter; only the orchestration boundary stopped returning `RenderResolveOutput` from the generation hook.

**Pattern we are still not pursuing:** stacking more **`onGenerating`-style** hooks inside `generateRoomPreview` as a substitute for unified resolve/delivery policy. That path can surface one extra signal without touching `findRender`, but it does **not** replace the coordinated shell above.

Do **not** add a fourth parallel implementation (e.g. a duplicate orchestration stack) as a "bridge" to a future `renderOrchestration` dataSource; **unify core + delivery**, then relocate the **caller** (messageBus registration vs dataSource) in one move when ready.

## Remaining differences: preview vs passive handlers (alignment queue)

Preview and passive are implemented in one shell (**`orchestrateRenderRequest`**) with explicit branches for bootstrap, handle resolution, and pointer-enabled vs no-op `findRender` dependencies. The items below are the **policy differences** that those branches preserve; they are not duplicate orchestration stacks anymore.

1. **Bootstrap**
   - Current state: both handlers already bootstrap by writing `internalCache.Conversations.set(...)` directly.
   - Intentional preserved differences:
     - Preview may reuse caller-provided `conversationId` (or generate one), and uses `CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW` routing.
     - Passive always generates `conversationId` internally and uses `CONVERSATION_TYPE_ROOM_STATE_RENDER` routing with passive bus-delivery fields.
   - **Consolidation policy:** treat these differences as required routing policy inputs to a shared bootstrap helper, not cleanup targets. No additional "bootstrap unification" cleanup is needed beyond preserving these policy knobs explicitly.

2. **Delivery target + envelope mapping**
   - Preview: sends `findRender` output to preview conversation handle only.
   - Passive: maps some intake failures to bus `RenderError`, and otherwise sends through roomState conversation handle for materialization.
   - **Alignment intent:** keep one `sendMessage` surface for resolve outputs and push bus/conversation mapping to the same delivery adapter boundary.

3. **Pointer/cache policy wiring**
   - Intentional preserved difference:
     - Passive is pointer-enabled (`getCacheRecordById`, `clearPerspectivePointer`, mark/perspective validation) because room-state orchestration should first ask whether the room is already in the requested state.
     - Preview is pointer-disabled by policy (`getCacheRecordById: async () => undefined`, `clearPerspectivePointer: async () => {}`) because preview requests represent proposed state, not authoritative persisted state.
   - **Consolidation policy:** preserve this as an explicit resolve-mode switch (e.g. `pointerMode: enabled|disabled`) in shared logic, rather than forcing both paths through the same pointer behavior.

4. **Intake error policy**
   - Passive: explicit intake error mapping (`RENDER_REQUESTED_NOT_ROOM` -> bus `RenderError`; `META_ROOM_MARKS_MISSING` -> failed terminal delivery).
   - Preview: proceeds only on `RenderResolveInputSuccess` (no explicit intake-error handling branch today).
   - **Alignment intent:** centralize intake-error mapping in one strategy function so passive and preview differ by policy table, not control-flow structure.

These are intentionally listed as burn-down items. As each aligns, the adapter layer should shrink from "two handler shapes" toward "one handler + small policy objects."

**Relation to other work**

- **Task 6.5** (`AGENT.planning.md`): lifecycle ordering (`RenderGenerationStarted`, `Cache Updated` -> pointer -> `RenderReady`) attaches to the **unified** resolve/delivery shell, not a second copy of policy.
- **Track B** (`state/getOrStartRoomRenderForState.ts`): revisit **after** `findRender` exists -- integrate as a thin caller, or retire; avoid competing resolve definitions.

## Current declutter queue

1. **Resolve Track B ownership**
   - Decide if `state/getOrStartRoomRenderForState.ts` is promoted, integrated, or retired (see **Unified orchestration shape** above).
   - If not promoted, stop treating its TDD scaffold as a blocker for renderOrchestration progress.

2. **Unify acceptance criteria references**
   - Ensure Tier 1 Task 5 and related planning bullets reference the same canonical execution path as code/tests.
   - Avoid wording that implies two first-class implementations once the three horizontals land.

3. **Keep docs synchronized with runtime wiring**
   - Any significant path move (app -> bus -> orchestration, delivery extraction, `findRender`, etc.) requires same-day doc alignment in:
     - `renderOrchestration/AGENT.md`
     - `renderOrchestration/AGENT.planning.md`
     - this file

## Decision log (append-only)

Use this mini template for each simplification decision:

- **Date:**
- **Topic:**
- **Decision:**
- **Canonical owner:**
- **Tracks affected:**
- **Follow-up tasks:**

- **Date:** 2026-03-28
- **Topic:** findRender horizontal (B-phase)
- **Decision:** Centralize resolve in `findRender.ts`. Invalid pointer rows are cleared inside `findRender` only. Preview passes no-op `getCacheRecordById` / `clearPerspectivePointer` because `pointerHint` is never set on that path. Generation differences stay in `tryGeneration` (passive generation hook vs preview `generateRoomPreview`).
- **Canonical owner:** `lambda/ephemera/renderOrchestration/findRender.ts`
- **Tracks affected:** Track A (passive + preview orchestration); Track B may call `findRender` next.
- **Follow-up tasks:** Intake/shell phase 3 (2026-03-29 entry).

- **Date:** 2026-03-29
- **Topic:** Intake / shell (phase 3)
- **Decision:** `intakeRenderRequested` returns `RenderResolveInput` (`success` / `error`). `orchestratePassiveRenderRequestedBatch` in `orchestrationHandler.ts` performs `findRender` + terminal delivery via conversation `sendMessage` (shared `tryGeneration.ts` for the slow path) and maps intake errors using the outer request payload. `requestIntakeMessage` remains an alias for the batch. Preview path unchanged except renamed preview intake helper in `index.ts`.
- **Canonical owner:** A-phase `requestIntake.ts`; passive shell `orchestrationHandler.ts`; bus entry `index.ts`.
- **Tracks affected:** Track A.
- **Follow-up tasks:** Optional unified intake API; Track B caller of `findRender` + intake.

- **Date:** 2026-03-30
- **Topic:** Two-level sendMessage-first resolve (`findRender` + `tryGeneration`)
- **Decision:** `findRender` is effect-only (`Promise<void>`); `FindRenderDependencies.sendMessage` emits terminals for pointer/exact/invalidate; shared `tryGeneration.ts` emits generation terminals and returns `RenderGenerationReturn`. Passive intake sets `allowGeneration` explicitly when absent on `RenderRequested` (`false`) so default-allow semantics live in `tryGeneration`. Tests assert `sendMessage` / deps rather than `findRender` return values where applicable.
- **Canonical owner:** `findRender.ts`, `tryGeneration.ts`, `index.ts`, `orchestrationHandler.ts`
- **Tracks affected:** Track A.
- **Follow-up tasks:** Track B integration or retire; optional `generateRoomPreview` API tightening; doc sync in `AGENT.md` / `AGENT.planning.md` if readers still assume `RenderResolveOutput` return from `findRender`.

- **Date:** 2026-03-31
- **Topic:** Unified single-item render orchestration (`orchestrateRenderRequest`)
- **Decision:** `orchestrateRenderRequest` in `orchestrationHandler.ts` replaces the parallel preview handler in `index.ts` and the former passive-only single-item entry. Preview vs passive differ only in intentional branches (bootstrap row, handle, `findRender` pointer deps and ordering constraints preserved from prior behavior). `handleRenderOrchestrationMessage` uses a single `payloads.map` to `orchestrateRenderRequest`.
- **Canonical owner:** `orchestrationHandler.ts` (single-item); `index.ts` (bus entry + re-exports).
- **Tracks affected:** Track A.
- **Follow-up tasks:** Burn-down items in **Remaining differences** (intake error policy table, etc.) unchanged in scope.

## Exit criteria for this simplification phase

We can declare this declutter pass complete when:

- each responsibility has one canonical owner module
- no unresolved `parallel track` entries remain in this file
- planning tasks map to runtime-wired code paths without ambiguity
