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
- Intake and exact-match for passive render requests are owned by `requestIntake.ts` and the renderOrchestration messageBus cascade.
- Missing `Meta::Room.state.marks` in intake is a temporary explicit error constraint.

## Input boundary (v1)

The first shared choke-point type is `RenderResolveInput` in:

- `lambda/ephemera/renderOrchestration/baseClasses.ts`

It is the normalized **A-phase output** / **core input**: room, perspective, authoritative `markState`, `markProvenance` (`meta` vs `preview`), optional `pointerHint` from `Meta::Room.currentCacheByPerspective`, plus optional generation fields.

**Mapping (current code, before refactor):**

| Source | How it fills `RenderResolveInput` |
|--------|-----------------------------------|
| `RenderPreviewRequested` (`index.ts`) | `roomId` = `componentId`; `perspective` = payload; `markState` = payload; `markProvenance` = `'preview'`; `pointerHint` omitted; `allowGeneration` / `generationContextWml` from payload. |
| `requestIntake` (after `Meta::Room` load) | `roomId` = room `componentId`; `perspective` = payload; `markState` = `metaRoom.state.marks` (or error before boundary); `markProvenance` = `'meta'`; `pointerHint` = `currentCacheByPerspective[perspectiveKey]` if set; generation fields from `RenderRequested`. |

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

## Current declutter queue

1. **Resolve Track B ownership**
   - Decide if `state/getOrStartRoomRenderForState.ts` is promoted, integrated, or retired.
   - If not promoted, stop treating its TDD scaffold as a blocker for renderOrchestration progress.

2. **Unify acceptance criteria references**
   - Ensure Tier 1 Task 5 references the same canonical execution path as code/tests.
   - Avoid wording that implies two first-class implementations.

3. **Keep docs synchronized with runtime wiring**
   - Any significant path move (app -> bus -> orchestration, etc.) requires same-day doc alignment in:
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

## Exit criteria for this simplification phase

We can declare this declutter pass complete when:

- each responsibility has one canonical owner module
- no unresolved `parallel track` entries remain in this file
- planning tasks map to runtime-wired code paths without ambiguity
