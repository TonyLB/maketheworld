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
- Passive A-phase is `intakePassiveRenderRequested` in `requestIntake.ts`; resolve and delivery run in `passiveRenderOrchestration.ts` and `index.ts` (messageBus cascade).
- Missing `Meta::Room.state.marks` in intake is a temporary explicit error constraint.

## Input boundary (v1)

The first shared choke-point type is `RenderResolveInput` in:

- `lambda/ephemera/renderOrchestration/baseClasses.ts`

It is the normalized **A-phase output** / **core input**: room, perspective, authoritative `markState`, `markProvenance` (`meta` vs `preview`), optional `pointerHint` from `Meta::Room.currentCacheByPerspective`, plus optional generation fields.

**Mapping (current code, before refactor):**

| Source | How it fills `RenderResolveInput` |
|--------|-----------------------------------|
| `RenderPreviewRequested` (`index.ts`) | `roomId` = `componentId`; `perspective` = payload; `markState` = payload; `markProvenance` = `'preview'`; `pointerHint` omitted; `allowGeneration` / `generationContextWml` from payload. |
| `intakePassiveRenderRequested` (after `Meta::Room` load) | `roomId` = room `componentId`; `perspective` = payload; `markState` = `metaRoom.state.marks` (or `marks_missing` before resolve); `markProvenance` = `'meta'`; `pointerHint` = `currentCacheByPerspective[perspectiveKey]` if set; generation fields from `RenderRequested`. |

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

**Goal:** Replace parallel vertical stacks (preview in `index.ts` vs passive in `requestIntake.ts`) with **horizontal layers**: same responsibilities, one place each.

**Three horizontals**

| Layer | Role | Notes |
|-------|------|--------|
| **Intake** | Wire / world -> `RenderResolveInput` (A-phase) | Passive: `intakePassiveRenderRequested` + `PassiveIntakeResult` (`renderIntake.ts`). Preview: map in `index.ts`. Intake-only errors (e.g. missing marks) do not publish the bus. |
| **findRender** (resolve) | `RenderResolveInput` -> `RenderResolveOutput` (B-phase core) | Pointer validation, exact-match, generation; single implementation shared by all pipelines. Policy for pointer clear lives in one place (intake vs findRender: pick one rule; do not split). |
| **Delivery** | `RenderResolveOutput` + context -> side effects | Bus (`RenderReady`, `RenderInvalidate`, `RenderError`), preview conversation `sendMessage`, future dataSource subscribers. Two adapters (passive vs preview) are still **one** delivery layer, not two resolve stacks. |

**Delivery layer (phase 1 done):** Orchestration forwards `RenderResolveOutput` with `terminalHandle?.sendMessage(output)` / `handle?.sendMessage(output)`; passive and preview **materialize** those terminals (`materializeRoomStateRender`, `materializeGenerateRoomPreview`) using local `enrichRenderResolveForPassive` / `enrichRenderResolveForPreview` helpers before bus or WebSocket shaping.

**Resolve layer (phase 2 done):** `renderOrchestration/findRender.ts` exports `findRender` (pointer validation, exact-match, `tryGeneration` hook, `invalidate` when no match and generation does not run). Pointer clear on invalid hint lives only here. Passive and preview wire different `tryGeneration` implementations; `index.ts` re-exports `findRender` for other callers (e.g. Track B).

**Phased sequence (recommended order)**

1. **Delivery first** -- [done] Extract delivery from `requestIntake.ts` and `index.ts`; enrich helpers now live inside materialize (`roomStateRender` / `generateRoomPreview`); both paths run **after** resolve.
2. **findRender second** -- [done] Shared resolve in `findRender.ts`; passive shell (`passiveRenderOrchestration.ts`) and preview handler in `index.ts` call `findRender` before delivery; generation is injected via `tryGeneration`.
3. **Intake / shell third** -- [done] Passive A-phase: `requestIntake.ts` (`intakePassiveRenderRequested`) + `renderIntake.ts` (`PassiveIntakeResult`). Passive shell: `passiveRenderOrchestration.ts` (`orchestratePassiveRenderRequestedBatch`, alias `requestIntakeMessage`) chains intake -> `findRender` -> terminal `sendMessage`. `index.ts` `handleRenderOrchestrationMessage` calls that batch for `RenderRequested`; preview A-phase is `intakeRenderPreviewRequested` in `index.ts`. Optional later: one intake surface for all request types.

### Coordination trap: `findRender` / `tryGeneration` must move together (for sendMessage-first resolve)

Refactoring **only** `findRender` to push outcomes onto `sendMessage` does **not** simplify much or add general streaming capability while **`tryGeneration` stays terminal-return coded** (`Promise<RenderResolveOutput | null>`): the slow path still collapses to **one** awaited return.

Refactoring **only** `tryGeneration` / `generateRoomPreview` buys little and is **blocked** by the current contract: **`findRender` awaits a single result** from `tryGeneration` and branches on **`null` vs non-null** (fall through to `invalidate` when `null`). Without changing `findRender`, generation cannot become truly `sendMessage`-first end-to-end.

**Implication:** meaningful movement toward **event-oriented** delivery through the conversation handle (multiple steps, terminals only on the wire) requires **coordinated** changes to **both** the resolve shell (`findRender` control flow and dependencies) **and** the generation hook (`tryGeneration` / `generateRoomPreview`).

### Optional future: two-level refactor (beneficial; not scheduled)

Design sketch only: a **two-level** change that avoids the trap above:

1. **`tryGeneration` / `generateRoomPreview`:** emit terminal outcomes **via** `sendMessage` (conversation handle), not a generic sink abstraction, instead of returning full `RenderResolveOutput`; completion might be **`void`** / **`Promise<void>`** when the slow path finishes. Optionally keep a **minimal return type** solely for **control** (e.g. preserve the **`null` semantic** ("generation did not run; caller should invalidate")) without carrying resolve payloads in the return channel.

2. **`findRender`:** **Decision:** thread `sendMessage` through `FindRenderDependencies` so pointer hit, exact match, and generation paths **all** emit via the same conversation handle. Do **not** pursue the alternative of restructuring so terminal `RenderResolveOutput` values can live **outside** `findRender` in multiple places; keep one resolve shell that owns branching, including mapping **`null`/skip** from `tryGeneration` to **`invalidate`** in one place.

This makes metaphorical **return values** visible on **`sendMessage`**, aligned with preview and passive streaming -- at the cost of a **coordinated** migration and tests that mock `sendMessage`.

**Pattern we are not pursuing:** stacking more **`onGenerating`-style** hooks inside `generateRoomPreview` is a recognizable incremental option (it can surface **one** extra intermediate signal without touching `findRender`), but it does **not** unlock full multi-step streaming through `findRender` and would **defer** the coordinated contract change above. We are **not** investing in that direction; when we move, we expect to tackle the coordinated **two-level** refactor (`sendMessage` threaded through `findRender` and generation) described above.

Do **not** add a fourth parallel implementation (e.g. a duplicate orchestration stack) as a "bridge" to a future `renderOrchestration` dataSource; **unify core + delivery**, then relocate the **caller** (messageBus registration vs dataSource) in one move when ready.

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
- **Decision:** `intakePassiveRenderRequested` returns `PassiveIntakeResult` (`ok` / `marks_missing` / `not_room`). `orchestratePassiveRenderRequestedBatch` in `passiveRenderOrchestration.ts` performs findRender + passive delivery; `tryPassiveRenderGeneration` lives there. `requestIntakeMessage` remains an alias for the batch. Preview path unchanged except renamed preview intake helper in `index.ts`.
- **Canonical owner:** A-phase `requestIntake.ts` + `renderIntake.ts`; passive shell `passiveRenderOrchestration.ts`; bus entry `index.ts`.
- **Tracks affected:** Track A.
- **Follow-up tasks:** Optional unified intake API; Track B caller of `findRender` + intake.

## Exit criteria for this simplification phase

We can declare this declutter pass complete when:

- each responsibility has one canonical owner module
- no unresolved `parallel track` entries remain in this file
- planning tasks map to runtime-wired code paths without ambiguity
