# Coyote Game DataSource directory reorganization

**Status:** Plan drafted; **implementation is in scope** for this initiative and follows **Recommended order** below (moves, imports, verification, doc link updates). Checkboxes track progress until the reorg ships and this file is retired.

## Task-planning context

- Conventions for task plans (durability, checkboxes, what belongs here vs in package docs): [`taskPlanning/AGENT.md`](../../../../AGENT.md)
- Root complex-task pattern (foundations, integration, verification): [`AGENT.md`](../../../../../AGENT.md#getting-started-pattern-for-complex-tasks)

## Purpose

Reduce sprawl under [`lambda/ephemera/dataSource/coyoteGame/`](../../../../../lambda/ephemera/dataSource/coyoteGame/) by grouping files by responsibility: **ingress handlers**, **`utilities/`** (Coyote-wide helpers that are not LLM pipeline code), **LLM / generator stacks** under `generators/` (**pipeline-local**, **shared parsers**, **`abstract/`**), and **harness-only** code under `generators/testHarness/`. The flat layout (many single-purpose modules distinguished only by filename) has become hard to navigate and obscures which pieces are bus entrypoints vs reusable generator internals.

## Scope

### In scope for this initiative (task plan + execution)

- Everything captured in this document: target layout, locked rules below, inventory mapping, any remaining open decisions, **Recommended order**, and **Verification**.
- **Implementing** the reorganization: creating directories, moving modules and tests, updating imports and any path-sensitive tooling (including CI or Jest config if paths require it), fixing external references, and keeping **durable docs** aligned with the tree ([Implementation conventions (locked)](#implementation-conventions-locked)).
- **Parity:** behavior and public contracts stay the same (no semantic or protocol change). Prefer updating importers over compatibility re-exports ([Implementation conventions (locked)](#implementation-conventions-locked)).

### Out of scope for this initiative

- Changing **runtime behavior**, **public API** of the DataSource, or **event contracts** beyond parity-preserving file moves and import rewiring.
- Unrelated refactors, new features, or opportunistic cleanup outside what the directory layout requires.

## Target structure (intent)

All paths are relative to `lambda/ephemera/dataSource/coyoteGame/`.

| Area | Path | Role |
| --- | --- | --- |
| Handlers | `handlers/` | Functions invoked directly from `receiveEvents` (or thin wrappers) for each subscribed ingress shape. |
| Utilities | `utilities/` | Cross-cutting helpers used by handlers and/or multiple pipelines (**room snapshots**, room membership guards, formatting glue) that are **not** Bedrock orchestration, prompt assembly, or model-output parsing. Keeps `generators/` for generator-shaped code only ([Utilities folder (locked)](#utilities-folder-locked)). |
| Generators | `generators/` | Hypothesis / outcome LLM stacks: pipelines, `sharedParsers/`, `abstract/`, `testHarness/` (rows below). Excludes `utilities/` ([Utilities folder (locked)](#utilities-folder-locked)). |
| Abstract contracts | `generators/abstract/` | Shared **non-parse** contract material: DTO shapes, shared types, type guards, and validators that are not model-output parsers. Prefer not to park parse-of-LLM-output modules here; use **`sharedParsers/`** or a pipeline folder per [Parser placement (locked)](#parser-placement-locked). |
| Shared parsers | `generators/sharedParsers/` | Parsers whose **applicability** crosses pipeline boundaries: outputs **read** by another pipeline, written to **shared cache** for later consumers, or otherwise treated as a stable cross-cutting contract (including **terminal** model-output parsers and **intermediate** parsers when the parsed artifact is cached or reused outside the owning pipeline's internal hop chain). |
| Pipelines | `generators/pipelines/` | One subdirectory per **named pipeline** (today: `hypothesis`, `outcome`). Pipeline-local prompts, Bedrock wrappers, orchestration, and parsers that **apply only inside** that pipeline's hop sequence. |
| Hypothesis pipeline | `generators/pipelines/hypothesis/` | Stage-one through phase-plan hop orchestration, hypothesis-specific prompts, and hypothesis-only Bedrock helpers. Durable pipeline-focused doc: **`AGENT.md`** in this folder ([Implementation conventions (locked)](#implementation-conventions-locked)). |
| Outcome pipeline | `generators/pipelines/outcome/` | Plan-outcome generation, outcome prompts, and outcome-specific formatting. Durable pipeline-focused doc: **`AGENT.md`** here ([Implementation conventions (locked)](#implementation-conventions-locked)). |
| Test harness | `generators/testHarness/` | `runCoyoteEngineTestHarness`, fixture modules, and any utilities **only** consumed by that harness (not production bus paths). |

### Parser placement (locked)

**Rule:** Place a parser by **where its output contract applies** (who may depend on the parsed shape), not by which Bedrock call produced the string or where the file was authored.

- **`generators/pipelines/<pipeline>/`** — The parsed value is used **only** within that pipeline's orchestration (multiple hops in the same pipeline still count as one pipeline). Internal handoffs between steps stay here.
- **`generators/sharedParsers/`** — The parsed value is **read outside** that internal hop chain: another pipeline, durable **cache** consumed later, harness parity with production contracts, or any other **shared** dependency surface.

**Norm:** Every parse-of-model-output (or similar) module lives in **exactly one** of those two places according to that rule. Do not use **where it was produced** as the placement criterion.

**Coyote mapping under this rule (current code):**

| Module | Placement | Rationale |
| --- | --- | --- |
| `parseHypothesisModelOutput.ts` (+ test) | `generators/sharedParsers/` | Produces **`intent`** / optional **`walkthrough`** / optional **`phasePlan`** for **`CoyoteGame`** intent row; **outcome** and prompts consume that cached record. Cross-pipeline applicability. |
| `parseHypothesisStageOneOutput.ts` (+ test) | `generators/pipelines/hypothesis/` | Stage-one **seam** only feeds **combine** and later hypothesis hops; not a cache contract read by outcome. |
| `coyoteHop1Handoff.ts` (+ test) | `generators/pipelines/hypothesis/` | Plan-selection hop handoff only between hypothesis hops. |

If **outcome** later gains dedicated parse modules whose outputs are **only** used inside outcome, they stay under `pipelines/outcome/`. If a parser's output joins the same **shared cache or cross-pipeline** story as intent, it moves to **`sharedParsers/`**.

### Utilities folder (locked)

**Preference (locked for this plan):** Put Coyote-wide helpers that **support** generators (and handlers) but **do not** read as generator code under **`utilities/`** at the **`coyoteGame/`** package root (`lambda/ephemera/dataSource/coyoteGame/utilities/`), **not** under `generators/shared/` or another `generators/*` sibling. Rationale: `generators/` should stay aligned with LLM pipelines, parsers, and harness wiring; snapshot loading, room guards, render-tree constants, and similar infra belong beside the DataSource without implying they are part of the model stack.

**Current modules assigned to `utilities/` (locked):** `coyoteRoomObjectSnapshot.ts`, `collectActiveCharactersInCoyoteRooms.ts`, `coyoteRenderTree.ts`, `isCoyoteGameRoom.ts` (each with its `.test.ts` when present). `coyoteRenderTree` is also imported from **`dataSource/actions/`** (affinities harness); keep it in **`utilities/`** so presentation glue stays out of `generators/` even when sibling packages import it.

### Implementation conventions (locked)

Norms for how to execute this reorg (harness wiring, imports, docs, and where future work lands). Aligns with usual task-plan practice: **keep durable documentation current as the branch evolves**, not only at the end.

1. **Test harness and `pipelines/hypothesis/`:** `generators/testHarness/` may import from `generators/pipelines/hypothesis/` (for example **`generateHypothesis`**) whenever the harness needs production orchestration. **Do not** duplicate hypothesis pipeline orchestration inside the harness; one implementation, shared imports.

2. **No barrel files:** Avoid adding `index.ts` (or similar) barrel re-exports in new subfolders **when avoidable**. Prefer **direct imports** to concrete modules so navigation and search stay obvious at this depth of nesting.

3. **External importers:** When paths move, **update every importer** (e.g. `dataSource/actions/`, harness entrypoints) to the new module paths. **Do not** add re-export shims at old paths for compatibility.

4. **Durable docs track the work:** Update [`coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md), pipeline `AGENT.md` files, and cross-tree indexes **as part of** the same initiative as moves, so links and narrative stay accurate on the branch.

5. **Per-pipeline `AGENT.md`:** Add **`generators/pipelines/hypothesis/AGENT.md`** and **`generators/pipelines/outcome/AGENT.md`**. Cross-link with the package-root [`AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) and other relevant docs. **Migrate** pipeline-specific detail from root **`coyoteGame/AGENT.md`** into the matching pipeline file as needed; keep the root file for DataSource ingress/egress, cross-cutting overview, and pointers into pipelines, `utilities/`, `sharedParsers/`, and the harness.

6. **Future development:** New hypothesis-only or outcome-only Bedrock, prompt, and pipeline-local parse code should land under the corresponding **`generators/pipelines/<name>/`** tree so additions have a **well-defined** home; extend pipeline `AGENT.md` when behavior or contracts grow.

### Root-level layout (locked)

Keep the DataSource entry (`index.ts`), subscribed ingress type guards (`subscribedEvents.ts`), published egress types (`publishedEvents.ts`), and area doc [`AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) **flat at `coyoteGame/` root**. Do not introduce `entry/` or `contracts/` for these files in this reorganization.

## Frozen map

Roughly 50 TypeScript modules live in the flat directory today. This section is now the **locked destination map** for the reorganization. Parser placement is **locked** ([Parser placement (locked)](#parser-placement-locked)). **`utilities/`** membership is **locked** ([Utilities folder (locked)](#utilities-folder-locked)). Implementation norms are **locked** ([Implementation conventions (locked)](#implementation-conventions-locked)). Root layout is **locked** ([Root-level layout (locked)](#root-level-layout-locked)).

### Locked `handlers/`

| Current file | Notes |
| --- | --- |
| `handleObjectsChangedForHypothesis.ts` (+ `.test.ts`) | Dispatched from `index.ts` when `isObjectsChangedPayload`. |
| `handleAwaitRoadRunnerForPlanOutcome.ts` (+ `.test.ts`) | Dispatched when `isAwaitRoadRunnerPublishedPayload`. |

### Locked `generators/pipelines/hypothesis/`

| Current file | Notes |
| --- | --- |
| `coyoteHypothesisPipeline.ts` (+ test) | Linear pipeline runner for hypothesis Bedrock chain. |
| `generateHypothesis.ts` (+ test) | Production + harness entry for hypothesis generation. |
| `invokeBedrockHypothesis.ts` (+ test) | Stage-one / plan-selection / phase-plan Bedrock wrappers. |
| `buildHypothesisStageOnePrompt.ts` (+ test) | |
| `buildHypothesisStageTwoPrompt.ts` (+ test) | Shared fragments; parts not wired in production per `AGENT.md`. |
| `buildHypothesisPrompt.ts` (+ test) | Legacy single-call comparison. |
| `buildHypothesisPlanSelectionPromptParts.ts` (+ test) | |
| `buildHypothesisPhasePlanHopPromptParts.ts` (+ test) | |
| `combineHypothesisClusters.ts` (+ test) | Combine + render for stage-two hops. |
| `coyoteHypothesisPromptShared.ts` | Shared invariant geography across hypothesis prompts. |
| `coyoteHypothesisPhasePlanContext.ts` (+ test) | Hop-2-only context for phase-plan validation. |
| `parseHypothesisStageOneOutput.ts` (+ test) | Pipeline-local: seam contract for stage one only ([Parser placement (locked)](#parser-placement-locked)). |
| `coyoteHop1Handoff.ts` (+ test) | Pipeline-local: plan-selection handoff between hypothesis hops only ([Parser placement (locked)](#parser-placement-locked)). |

### Locked `generators/pipelines/outcome/`

| Current file | Notes |
| --- | --- |
| `generatePlanOutcome.ts` (+ test) | |
| `buildPlanOutcomePrompt.ts` (+ test) | |
| `formatPhasePlanForOutcomePrompt.ts` (+ test) | Consumes intent record shape for outcome prompt tail. |

### Locked `generators/sharedParsers/`

| Current file | Notes |
| --- | --- |
| `parseHypothesisModelOutput.ts` (+ test) | Terminal hypothesis parse into cache-facing intent fields ([Parser placement (locked)](#parser-placement-locked)). |

### Locked `generators/abstract/`

Use for **shared types, type guards, and validators** that are not pipeline-local and are **not** `sharedParsers/` (see target table). Do **not** move the three hypothesis parse modules listed above into `abstract/`; their homes are **`sharedParsers/`** or **`pipelines/hypothesis/`** per the locked rule.

### Locked `utilities/`

| Current file | Notes |
| --- | --- |
| `coyoteRoomObjectSnapshot.ts` (+ test) | Staged-object snapshot loader: hypothesis, outcome, and harness overrides ([Utilities folder (locked)](#utilities-folder-locked)). |
| `collectActiveCharactersInCoyoteRooms.ts` | Active characters across Coyote demo rooms; outcome handler input assembly, not LLM code ([Utilities folder (locked)](#utilities-folder-locked)). |
| `coyoteRenderTree.ts` | Hypothesis line-break constant and render-tree shape; handlers, harness, and **`dataSource/actions/`** import ([Utilities folder (locked)](#utilities-folder-locked)). |
| `isCoyoteGameRoom.ts` | Async guard: whether a room id is a Coyote game demo room ([Utilities folder (locked)](#utilities-folder-locked)). |

### Locked `generators/testHarness/`

| Current file | Notes |
| --- | --- |
| `runCoyoteEngineTestHarness.ts` (+ test) | |
| `coyoteEngineTestFixtures.ts` (+ test) | |

### Remain at `coyoteGame/` root (locked)

| Current file | Notes |
| --- | --- |
| `index.ts` (+ `index.test.ts`) | `EphemeraDataSource` construction and `receiveEvents` wiring. |
| `subscribedEvents.ts` | Ingress envelope guard and `CoyoteGameSubscribedContent`. |
| `publishedEvents.ts` (+ test) | Stream / bus payload types for hypothesis and outcome lanes. |

These three modules and root [`AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) stay flat at `coyoteGame/` root ([Root-level layout (locked)](#root-level-layout-locked)).

## Open decisions and unknowns

No open structural decisions remain in this plan. Parser placement, utilities membership, implementation conventions, and root layout are all locked in this document.

## Getting started (for implementers)

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) (checkbox and verification conventions).
2. Read [Implementation conventions (locked)](#implementation-conventions-locked) in this plan (harness, barrels, paths, docs split).
3. Read [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) for steady-state flows (Objects Changed vs Await RoadRunner, harness scope); after pipeline docs exist, use **`generators/pipelines/hypothesis/AGENT.md`** and **`generators/pipelines/outcome/AGENT.md`** for pipeline-local detail.
4. Read [`lambda/ephemera/dataSource/coyoteGame/index.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/index.ts) for the only bus dispatch surface today.
5. Trace imports from `handleObjectsChangedForHypothesis` and `handleAwaitRoadRunnerForPlanOutcome` outward to validate the proposed tree and adjust the mapping table above before moving files.

There is no `AGENT.development.md` under `coyoteGame/` yet; optional follow-up is to add one with the canonical Jest command after the tree stabilizes. Until then, use the verification block below (aligned with existing `AGENT.md` guidance).

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. When a step has nested bullets, mark each nested line `[X]` as it is done so partial progress is visible.

- [X] Phase 0 - lock the tree
  - [X] Parser placement: **`sharedParsers/`** vs **`pipelines/<name>/`** by applicability of parsed output ([Parser placement (locked)](#parser-placement-locked)).
  - [X] **`utilities/`** at **`coyoteGame/`** root for non-generator, cross-cutting helpers: **`coyoteRoomObjectSnapshot`**, **`collectActiveCharactersInCoyoteRooms`**, **`coyoteRenderTree`**, **`isCoyoteGameRoom`** ([Utilities folder (locked)](#utilities-folder-locked)).
  - [X] **Implementation conventions:** harness may import **`pipelines/hypothesis/`**; **no** barrel `index.ts` where avoidable; **update** external import paths (**no** shims); durable docs track moves; add **per-pipeline `AGENT.md`** and migrate detail from root; future work in **`pipelines/`** ([Implementation conventions (locked)](#implementation-conventions-locked)).
  - [X] Root layout: keep `index.ts`, `subscribedEvents.ts`, `publishedEvents.ts`, and root `AGENT.md` flat at `coyoteGame/` root ([Root-level layout (locked)](#root-level-layout-locked)).
  - [X] Replace the **Current inventory and proposed mapping** section with a locked **Frozen map** and align headings/wording to final decisions.

- [X] Phase 1 - handlers and entry clarity
  - [X] Add `handlers/` and move the two `handle*` modules (+ tests); fix imports from `index.ts`.
  - [X] Confirm no behavior change (unit tests for handlers and `index.test.ts`).

- [ ] Phase 2 - generators skeleton
  - [ ] Add `generators/abstract/`, `generators/sharedParsers/`, `generators/pipelines/hypothesis/`, `generators/pipelines/outcome/`, `generators/testHarness/` (empty or with moved files only).
  - [ ] Move modules in dependency order (deepest / leaf parsers first, then prompts, then orchestrators) to avoid broken intermediate states, or use a single branch with one mechanical move commit.

- [ ] Phase 3 - `utilities/`
  - [ ] Add **`utilities/`** and move the four locked modules (+ tests): **`coyoteRoomObjectSnapshot`**, **`collectActiveCharactersInCoyoteRooms`**, **`coyoteRenderTree`**, **`isCoyoteGameRoom`**; fix imports including **`dataSource/actions/`** for **`coyoteRenderTree`** ([Utilities folder (locked)](#utilities-folder-locked)).

- [ ] Phase 4 - test harness
  - [ ] Move harness runner and fixtures (+ tests) under `generators/testHarness/`.
  - [ ] Update any `actions` or other cross-package imports that reference old paths.

- [ ] Phase 5 - docs and cleanup
  - [ ] Add **`generators/pipelines/hypothesis/AGENT.md`** and **`generators/pipelines/outcome/AGENT.md`**; cross-link with package-root [`AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) and migrate pipeline-specific sections out of the root file as appropriate ([Implementation conventions (locked)](#implementation-conventions-locked)).
  - [ ] Update [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) file links, layout overview, and "Key Files" style navigation for the new tree.
  - [ ] Update [`lambda/ephemera/dataSource/AGENT.md`](../../../../../lambda/ephemera/dataSource/AGENT.md) and other cross-tree indexes if they reference coyoteGame paths.
  - [ ] Grep repo for `dataSource/coyoteGame/` path references; fix stragglers (prefer **direct** new paths; [Implementation conventions (locked)](#implementation-conventions-locked)).
  - [ ] Mark **Recommended order** checkboxes in this document to match reality; then archive or delete this task plan per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Verification

From `lambda/ephemera/` (see also [`coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) **Verification**):

```bash
npx jest dataSource/coyoteGame/ dataSource/actions/
```

After moves, prefer a focused coyoteGame-only run during iteration:

```bash
npx jest dataSource/coyoteGame/
```

Add or adjust patterns if Jest config relies on path globs affected by new directories.

## Progress

| Milestone | Status |
| --- | --- |
| Draft task plan (this file) | Done |
| Parser placement rule (`sharedParsers/` vs pipeline-local by applicability) | Done |
| `utilities/` for non-generator cross-cutting helpers (snapshot + room/render helpers) | Done |
| Implementation conventions (harness, barrels, paths, docs, pipeline AGENT split) | Done |
| Lock remaining directory decisions and frozen file map | Done |
| Implement directory reorganization | Not started |
| Update durable `AGENT.md` and repo references | Not started |
| Retire or archive this task plan | Not started |
