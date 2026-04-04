*Status: PENDING REMOVAL --- documents orphaned scaffold code, not shipped behavior.*

## Purpose

Record **Track B** from the render-orchestration simplification pass: a **duplicate orchestration-shaped** helper living under `dataSource/state/` instead of the canonical **`orchestrateRenderRequest` → `intakeRenderRequested` → `findRender`** stack in [`../renderOrchestration/`](../renderOrchestration/).

Broader open work (preview vs passive intake policy, Task 6.5, 7, 8, etc.) lives in [`../renderOrchestration/AGENT.planning.md`](../renderOrchestration/AGENT.planning.md).

## Code scheduled for removal (not done yet)

| Path | Role |
|------|------|
| [`getOrStartRoomRenderForState.ts`](./getOrStartRoomRenderForState.ts) | TDD scaffold overlapping **render orchestration** domain (pointer / cache resolution vs `findRender`). **No production callers** --- only tests import it. |
| [`getOrStartRoomRenderForState.test.ts`](./getOrStartRoomRenderForState.test.ts) | Tests for the scaffold. |

**Intention:** Remove both files (and any exports) per issue tracker. **Do not extend** this API with new features.

**When you delete the implementation and tests:** delete **this document** as well so we do not keep a planning stub for removed code.

## Parallel tracks (context)

| Track | Meaning | Status |
|-------|---------|--------|
| **A** | Canonical: `orchestrateRenderRequest`, intake, `findRender`, delivery under `renderOrchestration/` | Active |
| **B** | `getOrStartRoomRenderForState` (this package) | **Remove** (orphaned scaffold) |
| **C** | Legacy direct `RenderPreviewRequested` bus from app/tests | Obsolete --- preview uses `sendRenderPreviewRequested` + DataSource ingress |

## Canonical path (what to use instead)

Room render resolve policy belongs in **`dataSource/renderOrchestration/`**: see [`../renderOrchestration/AGENT.planning.md`](../renderOrchestration/AGENT.planning.md) and [`../renderOrchestration/AGENT.md`](../renderOrchestration/AGENT.md).

## Policy (do not regress)

1. Do **not** add a **second** orchestration stack in `state/` for the same concerns as `findRender`.
2. New parallel experiments get an explicit **retire** or **merge into canonical** decision before they accumulate tests and docs.

## Historical note

This scaffold was listed under **Track B** in the former `AGENT.planning.simplification.md`; module-specific content was **moved here** (2026). Broader orchestration history and decisions are in [`../renderOrchestration/AGENT.planning.md`](../renderOrchestration/AGENT.planning.md) (see *Completed work* and *Historical decisions*).

March 2026 consolidation (unified `findRender`, DataSource ingress, etc.) is summarized there; detail preserved in git history.
