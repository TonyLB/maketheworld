# StandardRoom.examples legacy investigation plan

Status: in progress. Next step: **Recommended order** -- propose deprecation gate and removal checklist for `StandardRoom.examples` (verification run documented under **Verification run (2026-04-22)**; lambda `esbuild` / client `vite build` gates pass while package-wide `tsc` remains baseline debt). Feature/Knowledge defer sites are recorded in **Out-of-scope Feature/Knowledge defer registry** and [`AGENT.featureKnowledgeExamples.planning.md`](AGENT.featureKnowledgeExamples.planning.md).

## Purpose and scope

This task plan tracks how we investigate and methodically work through remaining dependencies on `StandardRoom.examples` so the property can be deprecated and eventually removed with low risk.

This file is task-scoped and temporary. Keep durable behavior docs in package `AGENT.md` files and link them here.

## Getting Started

1. Read the task-planning framework in [`taskPlanning/AGENT.md`](../../AGENT.md) for durability, checklist, and verification expectations.
2. Read WML and standardization orientation docs:
   - [`packages/mtw-wml/ts/AGENT.md`](../../../../packages/mtw-wml/ts/AGENT.md)
   - [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md)
   - [`packages/mtw-wml/ts/standardize/components/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.md)
3. Use the root complex-task pattern for sequencing and verification:
   - [`AGENT.md#getting-started-pattern-for-complex-tasks`](../../../../AGENT.md#getting-started-pattern-for-complex-tasks)
4. Baseline the current `StandardRoom.examples` footprint before changing code.

## Working assumptions

- Room prose for active ephemera paths is moving to situation facets and/or ephemera-wire room `render` payloads.
- Feature and Knowledge still use `examples` references for now.
- We should not remove `StandardRoom.examples` until all runtime call sites are either migrated or intentionally retained with explicit rationale.

## Scope boundaries after runtime classification

In-scope for this task plan: remove or replace runtime dependencies where `StandardRoom.examples` is still on the active Room path.

Out of scope for this task plan: Feature/Knowledge migrations that continue to rely on `examples` and do not block Room-only deprecation work.

In-scope deferred: Room transitional compatibility paths that we intentionally stage behind a follow-up gate before final removal.

### Owner placeholders for this plan

- `TBD(room-runtime)` - owner for in-scope Room runtime replace slices.
- `TBD(room-transitional)` - owner for in-scope deferred Room transitional compatibility slices (still use for any future deferred Room paths).
- **`componentRender.ts` (Room transitional):** plan maintainer (self). Render-channel readiness gate for removing the Room `ExamplesData` / first-example fallback **accepted 2026-04-22** (rooms no longer depend on that fallback for correctness in real flows).
- `TBD(feature-knowledge-followup)` - owner for out-of-scope Feature/Knowledge migration follow-up planning; task plan stub: [`AGENT.featureKnowledgeExamples.planning.md`](AGENT.featureKnowledgeExamples.planning.md).

## Progress

| Phase | Goal | Status | Notes |
| --- | --- | --- | --- |
| 1 | Build complete call-site inventory | Complete | Baseline frozen on 2026-04-22 (runtime/test/docs buckets below) |
| 2 | Classify each site (hard dependency vs transitional fallback vs test/docs) | Complete | Runtime scope split into in-scope Room paths, out-of-scope Feature/Knowledge defer paths; Room transitional defer for `componentRender.ts` completed (`replace`) |
| 3 | Refactor highest-confidence runtime sites | Complete | All in-scope Room runtime `replace` slices shipped, including [`lambda/ephemera/internalCache/componentRender.ts`](../../../../lambda/ephemera/internalCache/componentRender.ts) |
| 4 | Update tests/docs and re-baseline inventory | In progress | `componentRender` slice updated tests and [`componentRender.AGENT.md`](../../../../lambda/ephemera/internalCache/componentRender.AGENT.md); verification run 2026-04-22 (unit tests, bundle gates, inventory; package-wide `tsc` debt noted) |
| 5 | Decide deprecation gate for `StandardRoom.examples` | Pending | Gate should be explicit and test-backed |

## Recommended order

Use `[ ]` for pending and `[X]` for completed work. Mark each nested line `[X]` as it is completed so partial progress is visible.

- [X] Freeze a baseline inventory of direct `StandardRoom.examples` usage.
  - [X] Capture runtime call sites (non-test, non-doc files).
  - [X] Capture test-only references.
  - [X] Capture documentation-only references.
- [X] Classify runtime sites by migration strategy.
  - [X] `remove`: no longer needed after situation-facet migration.
  - [X] `replace`: should read from situations/render instead of examples.
  - [X] `defer`: intentionally keep for temporary compatibility.
- [X] Refactor in-scope Room runtime sites one slice at a time (smallest surface first).
  - [X] `lambda/assets/componentExamples/exampleEnrichment.ts` (`replace`)
    - [X] Apply minimal Room-path code change (keep Feature/Knowledge behavior stable).
    - [X] Add or update targeted tests for Room-negative and Feature/Knowledge-positive behavior.
    - [X] Re-run inventory search and confirm this file leaves the Room examples runtime bucket.
  - [X] `charcoal-client/src/components/Message/RoomDescription.tsx` (`replace`)
    - [X] Remove `component.examples` Room prose fallback and keep render/situation/default precedence.
    - [X] Add or update focused tests for render, situation, and prose-missing default paths.
    - [X] Re-run inventory search and confirm this file leaves the Room examples runtime bucket.
  - [X] `charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.ts` (Room path `replace`)
    - [X] Remove Room participation in Example-membership checks.
    - [X] Preserve Feature/Knowledge Example behavior (out-of-scope behavior is not changed in this task plan).
    - [X] Add or update tests for Room Situation/Guidance positive paths and Room Example negative path.
    - [X] Re-run inventory search and confirm Room dependency delta for this file.
  - [X] `charcoal-client/src/slices/personalAssets/index.ts` (`requestLLMGeneration`, `replace`)
    - [X] Stop reading `room.examples`; write generated Room prose through designated situation/render target.
    - [X] Add or update focused tests for successful writes and missing-target guard behavior.
    - [X] Re-run inventory search and confirm this file leaves the Room examples runtime bucket.
  - [X] `lambda/ephemera/dataSource/perception/orchestrate.ts` (`replace`)
    - [X] Replace Example-based Room placeholder WML with Room `<Render>` placeholder payload.
    - [X] Add or update perception tests for generation/error placeholder behavior and unchanged terminal `Render Pertains` behavior.
    - [X] Re-run inventory search and confirm this file leaves the Room examples runtime bucket.
  - [X] `lambda/ephemera/internalCache/componentRender.ts` (`defer` then `replace`; `replace` landed)
    - [X] Render-channel readiness gate satisfied (2026-04-22): Room prose is correct without relying on `ExamplesData` / first-example fallback in real flows; transitional fallback may be removed in code when ready.
    - [X] Follow-up owner and trigger: **Owner** - plan maintainer (self). **Trigger** - land `replace` in a focused PR after updating [`lambda/ephemera/internalCache/componentRender.ts`](../../../../lambda/ephemera/internalCache/componentRender.ts) and [`lambda/ephemera/internalCache/componentRender.test.ts`](../../../../lambda/ephemera/internalCache/componentRender.test.ts); re-run inventory for this file.
    - [X] Land follow-up `replace` slice (removed Room-path `ExamplesData` fallback; dropped `examples: []` from Room `DeferredCache` default stub row).
- [X] Track out-of-scope Feature/Knowledge defer sites explicitly (no code changes in this task plan).
  - [X] `charcoal-client/src/components/Message/ComponentDescription.tsx` remains intentionally unchanged for Room-only migration.
  - [X] Feature/Knowledge path in `charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.ts` remains intentionally unchanged.
  - [X] Record follow-up owner/task link for Feature/Knowledge examples migration planning (`TBD(feature-knowledge-followup)`): [`AGENT.featureKnowledgeExamples.planning.md`](AGENT.featureKnowledgeExamples.planning.md).
- [X] Run full verification for touched packages/lambdas.
  - [X] Unit tests for modified areas.
  - [X] Typecheck/build checks for modified areas (`lambda/ephemera` `tsc --noEmit` clean; `lambda/assets` and `lambda/ephemera` `npm run build` esbuild clean; `charcoal-client` `vite build` clean; package-wide `tsc` still not baseline-clean -- see **Verification run (2026-04-22)**).
  - [X] Re-run inventory and compare against baseline.
- [ ] Propose deprecation gate and removal checklist for `StandardRoom.examples`.

## Investigation matrix (living)

Track each call site and its disposition here before code changes.

| Area | File | Current usage shape | Classification | Action owner | Status |
| --- | --- | --- | --- | --- | --- |
| assets | `lambda/assets/componentExamples/exampleEnrichment.ts` | helper now reads `component.examples` only for `Feature`/`Knowledge`; `Room` removed from parent-id lookup | Runtime dependency (Room path removed) | `TBD(room-runtime)` | Completed (`replace`) |
| ephemera | `lambda/ephemera/internalCache/componentRender.ts` | Room prose from `renderCache` only; Feature/Knowledge still use `examples` via `_examples` | Runtime dependency (Room examples path removed) | Plan maintainer (self) | Completed (`replace`) |
| ephemera | `lambda/ephemera/dataSource/perception/orchestrate.ts` | full-room placeholder WML uses Room `render` via `situationRoomRenderPayloadFromCacheRenderedContent` (no `StandardRoom.examples` / synthetic Example) | Runtime dependency (Room examples placeholder path removed) | `TBD(room-runtime)` | Completed (`replace`) |
| charcoal-client | `charcoal-client/src/components/Message/RoomDescription.tsx` | room prose from `render` then first situation facet, then defaults; no `component.examples` read | Runtime dependency (Room path removed) | `TBD(room-runtime)` | Completed (`replace`) |
| charcoal-client | `charcoal-client/src/slices/personalAssets/index.ts` | `requestLLMGeneration` writes Room generation output to default Situation facet payload; no Room Example read/write path | Runtime dependency (Room path removed) | `TBD(room-runtime)` | Completed (`replace`) |
| charcoal-client | `charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.ts` | layered tab utilities: Room uses Situation/Guidance; Feature/Knowledge still use `parent.examples` for sibling detection | Runtime mixed dependency | Room path: `TBD(room-runtime)`; Feature/Knowledge path: [`AGENT.featureKnowledgeExamples.planning.md`](AGENT.featureKnowledgeExamples.planning.md) (`TBD(feature-knowledge-followup)`) | Completed (`replace` Room path), deferred (`Feature/Knowledge` path) |
| charcoal-client | `charcoal-client/src/components/Message/ComponentDescription.tsx` | feature/knowledge description reads first example from parent reference list | Runtime non-room dependency | [`AGENT.featureKnowledgeExamples.planning.md`](AGENT.featureKnowledgeExamples.planning.md) (`TBD(feature-knowledge-followup)`) | Deferred (`defer`; unchanged this initiative) |

### Scope labeling for deferred sites

- In-scope Room transitional for `componentRender.ts` is **complete** (`replace` landed; see slice update below).
- Out of scope (Feature/Knowledge for this task plan); follow-up planning: [`AGENT.featureKnowledgeExamples.planning.md`](AGENT.featureKnowledgeExamples.planning.md) (`TBD(feature-knowledge-followup)`):
  - `charcoal-client/src/components/Message/ComponentDescription.tsx`
  - Feature/Knowledge path in `charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.ts`

### Out-of-scope Feature/Knowledge defer registry

Explicit register of call sites intentionally left on `examples` for Feature/Knowledge while this plan retires Room-only paths. No further code changes here until the follow-up plan is executed.

| Call site | Role today | Why unchanged in this initiative | Follow-up owner |
| --- | --- | --- | --- |
| [`charcoal-client/src/components/Message/ComponentDescription.tsx`](../../../../charcoal-client/src/components/Message/ComponentDescription.tsx) | Feature/Knowledge display text from first linked `StandardExample` via `component.examples.payload[0]` | Not on the Room path; widens scope to non-Room examples migration | `TBD(feature-knowledge-followup)` -- [`AGENT.featureKnowledgeExamples.planning.md`](AGENT.featureKnowledgeExamples.planning.md) |
| [`charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.ts`](../../../../charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.ts) | Example membership and reference-list logic for `StandardFeature` / `StandardKnowledge` only (`parent.examples.payload`); Room path uses Situation/Guidance only | Preserved in the Room slice; Feature/Knowledge migration belongs to follow-up work | `TBD(feature-knowledge-followup)` -- [`AGENT.featureKnowledgeExamples.planning.md`](AGENT.featureKnowledgeExamples.planning.md) |

## Baseline inventory snapshot (2026-04-22)

This baseline is frozen before refactor work so we can compare deltas after each slice.

### Runtime call sites (non-test, non-doc)

Direct reads of `room`/`component`/`parent` example references where `Room` can participate:

- `lambda/assets/componentExamples/exampleEnrichment.ts`
- `charcoal-client/src/components/Message/RoomDescription.tsx`
- `charcoal-client/src/components/Message/ComponentDescription.tsx`
- `charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.ts`
- `charcoal-client/src/slices/personalAssets/index.ts`

Room row construction paths that still serialize examples for room payloads (historical baseline only):

- `lambda/ephemera/internalCache/componentRender.ts` (default room payload included `examples: []`) **superseded:** post-slice, Room `DeferredCache` stub omits `examples` and Room prose does not use `ExamplesData`.

Post-baseline: `lambda/ephemera/dataSource/perception/orchestrate.ts` no longer uses `StandardRoomData.examples` for placeholders (see Slice update: `orchestrate.ts`).

### Test-only references

Known tests that currently include room example fields or read room examples:

- `packages/mtw-wml/ts/standardize/components/component.test.ts`
- `packages/mtw-wml/ts/standardize/components/room.test.ts`
- `packages/mtw-wml/ts/standardize/index.test.ts`
- `lambda/assets/internalCache/assetData.test.ts`
- `lambda/assets/internalCache/componentData.test.ts`
- `lambda/assets/componentExamples/exampleAssociatedFilter.test.ts`
- `lambda/ephemera/internalCache/componentAssetMeta.test.ts`
- `lambda/ephemera/internalCache/componentRender.test.ts`
- `lambda/ephemera/internalCache/componentStackMerge.test.ts`
- `charcoal-client/src/components/Maps/Controller/index.test.tsx`

### Documentation-only references

Known documentation/planning mentions to revisit after runtime migration:

- `charcoal-client/src/components/Message/AGENT.md`
- `charcoal-client/src/components/Message/AGENT.RoomDescription.md`
- `charcoal-client/src/components/Workbench/foundations/LayeredContext/AGENT.layered-context-patterns.md`
- `lambda/assets/AGENT.event.md`
- `packages/mtw-wml/ts/AGENT.md` (critical note still mentions room examples)

### Inventory commands used

- `rg "\.examples\b" /Users/anthonylower-basch/Code/maketheworld`
- `rg "\b(room|component|parent)\.examples\b" /Users/anthonylower-basch/Code/maketheworld`
- `rg "tag:\s*'Room'[\s\S]{0,180}examples|StandardRoomData[\s\S]{0,220}examples" /Users/anthonylower-basch/Code/maketheworld --multiline`

### Verification run (2026-04-22)

Commands run from repo root paths below.

**Unit tests (PASS)**

- `lambda/assets`: `cd lambda/assets && npx jest componentExamples/exampleEnrichment.test.ts --watchAll=false` (13 tests).
- `lambda/ephemera`: `cd lambda/ephemera && npx jest dataSource/perception/ internalCache/componentRender.test.ts --watchAll=false` (28 tests across 5 suites).
- `charcoal-client`: `cd charcoal-client && npm run test:single -- src/components/Message/RoomDescription.test.tsx src/components/Workbench/foundations/LayeredContext/layeredContextUtils.test.ts src/slices/personalAssets/requestLLMGeneration.test.ts` (3 files, all pass; `RoomDescription` file reports skipped cases as before).

**Typecheck / build**

**Why `esbuild` can pass when `tsc` does not:** `esbuild` bundles TypeScript by stripping types; it does not run the TypeScript checker. A clean `npm run build` on the lambdas therefore proves entry-point graph and syntax are bundleable, not that `tsc` would be clean. For **ship confidence** on this initiative, lambda `esbuild` + targeted tests are the meaningful gates; full-package `tsc` is still worth fixing over time as a separate hygiene track.

- `lambda/ephemera`: `cd lambda/ephemera && npx tsc --noEmit` **PASS**.
- `lambda/ephemera`: `cd lambda/ephemera && npm run build` (esbuild bundle of `app.ts`) **PASS**.
- `lambda/assets`: `cd lambda/assets && npx tsc --noEmit` **FAIL** at repo head with errors in `characters/`, `dataSource/caching/`, `library/`, etc., not in `componentExamples/exampleEnrichment.ts`.
- `lambda/assets`: `cd lambda/assets && npm run build` (esbuild bundle of `app.ts`) **PASS**.
- `charcoal-client`: `npm run check` (`tsc --noEmit --skipLibCheck`) **FAIL** at repo head with many errors (for example MUI `Theme` / `ThemeProvider` exports, `LibraryCharacter.Name`, and other files unrelated to the Room `examples` migration paths). Official `npm run build` is `tsc && vite build`, so it would fail for the same reason; **`npx vite build` alone** (production bundle without the `tsc` gate) **PASS** at repo head.

Package-wide `tsc` cleanup for `lambda/assets` and `charcoal-client` remains optional follow-up work, not a blocker for recording this verification slice.

**Inventory (compare to baseline intent)**

- `\b(room|component|parent)\.examples\b` in `*.ts` / `*.tsx`: runtime-style hits remain in `lambda/assets/componentExamples/exampleEnrichment.ts` (Feature/Knowledge only), `charcoal-client/.../layeredContextUtils.ts` (Feature/Knowledge branches), `charcoal-client/.../ComponentDescription.tsx`, and `packages/mtw-wml/ts/standardize/components/component.test.ts` (`room.examples` in tests). No `RoomDescription.tsx` or `personalAssets` hits; aligns with completed Room slices.
- `StandardRoomData` near `examples` in TS: no multiline matches in the same shape as the deprecated orchestrate path (spot-check via search).
- `tag: 'Room'` within ~180 chars of `examples` in TS: remaining hits are **test** payloads (for example `lambda/assets/componentExamples/exampleAssociatedFilter.test.ts`, `lambda/assets/internalCache/assetData.test.ts`, `lambda/assets/internalCache/componentData.test.ts`), consistent with the baseline **test-only references** bucket.

### Slice update (2026-04-22): `exampleEnrichment.ts`

- Applied: `getExamplesReferenceList()` now returns `examples` for `Feature` and `Knowledge` only.
- Tests: `lambda/assets/componentExamples/exampleEnrichment.test.ts` updated with Room-negative + Feature/Knowledge-positive parent-id assertions; focused file run passes.
- Inventory delta:
  - `rg "\b(room|component|parent)\.examples\b" lambda/assets/componentExamples` now reports only `Feature`/`Knowledge` lines in `exampleEnrichment.ts`.
  - `exampleEnrichment.ts` no longer has a `Room.examples` runtime read path.

### Slice update (2026-04-22): `RoomDescription.tsx`

- Applied: removed Room prose fallback through `component.examples.payload[0]`; component now resolves prose as `render` -> first `situation` -> defaults.
- Tests: `charcoal-client/src/components/Message/RoomDescription.test.tsx` updated with focused situation-only and prose-missing-default assertions; targeted file run passes.
- Inventory delta:
  - `rg "\b(room|component|parent)\.examples\b" charcoal-client/src/components/Message` no longer reports `RoomDescription.tsx`.
  - Remaining examples hits in this folder are intentional docs plus `ComponentDescription.tsx` (Feature/Knowledge path).

### Slice update (2026-04-22): `layeredContextUtils.ts`

- Applied: Room is excluded from Example-membership checks in `getReferenceList()`, `isReferenceListChild()`, and `getLayeredContext()`.
- Preserved: Feature/Knowledge Example layering behavior remains intact; Room layered behavior remains through `SituationFacet` and `Guidance`.
- Tests: added `charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.test.ts` covering Room Situation+, Room Guidance+, Room Example-, and Feature/Knowledge Example+; targeted file run passes.
- Inventory delta:
  - `rg "\.examples\b" charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.ts` now shows Example checks gated to Feature/Knowledge branches only.
  - Room Example membership is no longer a positive path in this file.

### Slice update (2026-04-22): `personalAssets/requestLLMGeneration`

- Applied: `requestLLMGeneration` no longer reads or writes `room.examples`; generated Room `summary`/`description` now write to the Room default Situation facet payload (`SITUATION#DEFAULT`), while preserving existing SCHEMADIRTY heartbeat semantics for non-empty generation results.
- Tests: added `charcoal-client/src/slices/personalAssets/requestLLMGeneration.test.ts` with coverage for default-situation write success, missing-room guard behavior, and empty-generation no-intent behavior; focused file run passes via `npx vitest run src/slices/personalAssets/requestLLMGeneration.test.ts`.
- Inventory delta:
  - `rg "\b(room|component|parent)\.examples\b" charcoal-client/src/slices/personalAssets` returns no matches.
  - `charcoal-client/src/slices/personalAssets/index.ts` no longer has a Room examples runtime read/write path.

### Slice update (2026-04-22): `lambda/ephemera/dataSource/perception/orchestrate.ts`

- Applied: `placeholderRoomFullWml` now builds Room `render` using `situationRoomRenderPayloadFromCacheRenderedContent` (same mapping family as terminal `roomRenderWmlFromCacheRecord`), with a word-joiner displayName and empty summary so serialized `<Render>` satisfies the DisplayName/Summary/Description parse contract; removed `StandardExample` and `StandardRoomData.examples` from this path.
- Tests: `lambda/ephemera/dataSource/perception/index.test.ts` asserts parsed ephemera-wire placeholders for `Generation Started`, `Orchestration Error`, and `Generation Deferred` (full-room `PublishMessage`); existing `Render Pertains` integration tests unchanged.
- Verification: `npx jest dataSource/perception/` from `lambda/ephemera/` passes (22 tests).
- Inventory delta:
  - `rg "tag:\s*'Room'[\s\S]{0,160}examples" lambda/ephemera/dataSource/perception/orchestrate.ts --multiline` and `rg "StandardRoomData[\s\S]{0,220}examples" lambda/ephemera/dataSource/perception/orchestrate.ts --multiline` return no matches.
  - `rg "\.examples\b" lambda/ephemera/dataSource/perception/orchestrate.ts` returns no matches.

### Gate decision (2026-04-22): `componentRender.ts` render-channel readiness

- **Decision:** The render-channel readiness gate for removing the Room `ExamplesData` / first-example fallback in [`lambda/ephemera/internalCache/componentRender.ts`](../../../../lambda/ephemera/internalCache/componentRender.ts) is **satisfied**.
- **Rationale:** Prior slices (client Room prose, `requestLLMGeneration`, perception placeholders, render-cache-first room assembly) mean real flows no longer depend on that fallback for correct Room display prose.
- **Shipped:** `replace` slice landed same initiative (see **Slice update: `componentRender.ts`** below).

### Slice update (2026-04-22): `lambda/ephemera/internalCache/componentRender.ts`

- Applied: Room branch uses **`renderCache`** only for `<Render>` prose (`situationRoomRenderPayloadFromCacheRenderedContent`); removed `ExamplesData` / first-example fallback and **`standardExampleToRenderPayload`**. Room `DeferredCache` default stub row no longer includes `examples: []`.
- Tests: [`lambda/ephemera/internalCache/componentRender.test.ts`](../../../../lambda/ephemera/internalCache/componentRender.test.ts) asserts empty cache yields no `<Render>` and `Examples.get` is not called for Room; cache-hit tests unchanged in intent.
- Docs: [`lambda/ephemera/internalCache/componentRender.AGENT.md`](../../../../lambda/ephemera/internalCache/componentRender.AGENT.md) updated for cache-only Room prose.
- Verification: `npx jest internalCache/componentRender.test.ts --watchAll=false` from `lambda/ephemera/` passes (6 tests).
- Inventory delta: `rg "\.examples\b" lambda/ephemera/internalCache/componentRender.ts` reports only Feature/Knowledge `naiveFirstExample` lines (no Room-path reads).

## Runtime slice recommendation: `lambda/assets/componentExamples/exampleEnrichment.ts`

### Current behavior in context

- `enrichExampleEvent()` is used for `Example` component events in `mtw.assets.componentExamples`.
- It computes `parentIds` via `getParentIdsForExample()`.
- `getParentIdsForExample()` currently treats `Room`, `Feature`, and `Knowledge` identically by reading each parent's `examples` reference list.
- For `Room`, this is legacy behavior that conflicts with the room-situations migration.
- Existing unit test coverage (`exampleEnrichment.test.ts`) still asserts room parent discovery through `Room.examples`.

### Recommendation

Classification: `replace` (not `remove` yet).

For this slice, update parent lookup semantics so `enrichExampleEvent()` no longer derives room parent relationships from `Room.examples`:

1. Restrict `getExamplesReferenceList()`/parent scan to `Feature` and `Knowledge` only.
2. Keep `Room` parent relationship handling on the room-situation event path in `componentExamples/index.ts` (already explicit: `parentIds: [roomId]` for situation updates/removals).
3. Do not remove `StandardRoom.examples` type support in this slice; only remove this call-site dependency.

Rationale:

- This is the smallest change that aligns `assets.componentExamples` with current room-situations architecture.
- It isolates room migration work from feature/knowledge example behavior, reducing blast radius.
- It prevents stale room example references from affecting parent-id enrichment for Example events.

### Risks and mitigations

- Risk: hidden producer still emitting Example events intended to resolve room parents via `Room.examples`.
  - Mitigation: add/adjust tests to assert that room parents are not inferred from `Room.examples` in `enrichExampleEvent()`.
- Risk: regressions for Feature/Knowledge parent-id enrichment.
  - Mitigation: keep and strengthen existing Feature/Knowledge example-parent tests.

### Acceptance criteria for this slice

- `enrichExampleEvent()` parent-id discovery no longer uses `Room.examples`.
- `Feature` and `Knowledge` parent-id discovery remains unchanged.
- Test coverage includes:
  - positive parent-id case for Feature/Knowledge via examples
  - negative case proving Room examples are ignored in this path
- Re-run inventory confirms this runtime call site is removed from the `room/component/parent.examples` bucket for `lambda/assets/componentExamples/exampleEnrichment.ts`.

## Runtime slice recommendation: `charcoal-client/src/components/Message/RoomDescription.tsx`

### Current behavior in context

- `RoomDescription` already prefers room prose in this order:
  1. `StandardRoom.render` (ephemera wire `<Render>`)
  2. first room `Situation` facet payload
  3. fallback to first `StandardExample` via `component.examples.payload[0]`
- The third step is the remaining room-example dependency in this component.

### Recommendation

Classification: `replace`.

For this initiative, remove room prose fallback through `StandardRoom.examples` in `RoomDescription` and rely on:

1. `StandardRoom.render` (primary)
2. room `situations` payloads (secondary)
3. existing safe defaults (`Untitled` / empty description/summary) when prose payload is missing

Rationale:

- This component is already structured around render/situation precedence, so removing examples is a narrow and coherent change.
- It directly removes one of the remaining room-example runtime dependencies.

### Risks and mitigations

- Risk: some payloads may still arrive without render/situation prose and previously displayed Example-derived text.
  - Mitigation: add/update tests that assert expected fallback to defaults (not Example) for prose-missing rooms.
- Risk: docs still state Example fallback.
  - Mitigation: update docs after behavior change (tracked in documentation-only inventory bucket).

### Acceptance criteria for this slice

- `RoomDescription.tsx` no longer reads `component.examples`.
- Tests cover:
  - render-based prose path
  - situation-based prose path
  - prose-missing path using defaults
- Inventory query no longer reports `RoomDescription.tsx` in the room examples runtime bucket.

## Runtime slice recommendation: `charcoal-client/src/components/Message/ComponentDescription.tsx`

### Current behavior in context

- `ComponentDescription` resolves display text only for `StandardFeature` and `StandardKnowledge`.
- It reads `component.examples.payload[0]` to fetch first `StandardExample` and render name/description.
- It does not execute against `StandardRoom`.

### Recommendation

Classification: `defer` for this task.

Keep this call site unchanged for now because it is not a `StandardRoom.examples` dependency and is tied to current Feature/Knowledge authoring semantics.

Rationale:

- Changing this now broadens scope from room-specific migration to a larger examples-to-situations migration for other component types.
- It is valuable to keep Feature/Knowledge behavior stable while we retire room-specific legacy paths first.

### Acceptance criteria for this slice

- This file remains intentionally unchanged during room-example dependency removal.
- Plan records it as out-of-scope for room-only deprecation, to revisit when Feature/Knowledge migration is scheduled.

## Runtime slice recommendation: `charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.ts`

### Current behavior in context

- This utility drives layered-tab detection and sibling derivation for Workbench.
- It already has first-class room-situation support (`SituationFacet` tag path via `isSituationFacetChild()` / `findSituationFacetSiblings()`).
- It still uses `parent.examples` in shared helpers (`getReferenceList`, `isReferenceListChild`, `getLayeredContext`) where parent may be `Room`, `Feature`, or `Knowledge`.
- As written, Room example membership can still classify stack context as `Example`, even though Room situation facets are now the preferred room layering model.

### Recommendation

Classification: split strategy.

- `replace` for Room path:
  - Remove Room participation in Example-membership checks (`parent.examples`) for layered context.
  - Keep Room layered behaviors to:
    1. `SituationFacet` path
    2. `Guidance` path
- `defer` for Feature/Knowledge path:
  - Keep Example-based layering for Feature/Knowledge unchanged in this initiative.

Rationale:

- This isolates room-specific deprecation without destabilizing Feature/Knowledge editors.
- The utility already has explicit Room situation handling, so migration is mostly a gate/branching refinement rather than a redesign.

### Risks and mitigations

- Risk: existing drafts that rely on Room->Example layered tabs may no longer show as layered.
  - Mitigation: add selector/utility tests for Room stacks:
    - Room->Situation => layered (`SituationFacet`)
    - Room->Guidance => layered (`Guidance`)
    - Room->Example => no layered context (or expected non-layered behavior)
- Risk: regressions in Feature/Knowledge Example tabs due to shared helper edits.
  - Mitigation: explicit regression tests for Feature/Knowledge Example sibling derivation and child membership.

### Acceptance criteria for this slice

- `layeredContextUtils.ts` no longer treats `Room.examples` as a layered membership source.
- Room layered context remains valid for `SituationFacet` and `Guidance`.
- Feature/Knowledge Example layered context remains unchanged.
- Inventory query no longer reports Room-example dependency from this file (while acknowledging intentional Feature/Knowledge example usage remains).

## Runtime slice recommendation: `charcoal-client/src/slices/personalAssets/index.ts` (`requestLLMGeneration`)

### Current behavior in context

- `requestLLMGeneration({ assetId, roomId })` sends `llmGenerate` and receives `{ description, summary }`.
- It then mutates the in-memory `StandardForm` by:
  1. resolving the Room,
  2. reading `room.examples.payload[0]`,
  3. resolving that Example component,
  4. writing generated `description`/`summary` into that Example payload.
- Room authoring UI has shifted to situation/render editing (`DefaultRenderEditor`, situation facets); `RoomEditor` explicitly notes room examples are no longer surfaced for editing.

### Recommendation

Classification: `replace`.

For room-scoped migration, stop writing generation results through `Room.examples` and write to the room's situation/render pathway instead:

1. Primary target: default room Situation facet payload used by authoring flow.
2. Fallback target: room `render` payload only if that is the chosen canonical authoring sink.
3. Keep Feature/Knowledge generation behavior unchanged (out of scope here).

Rationale:

- This slice is a direct Room-example write dependency in client-memory authoring state.
- Keeping this path on Example creates hidden legacy coupling even when Room examples are no longer UI-authorable.

### Risks and mitigations

- Risk: generated prose may become invisible if written to a field not read by current editors/previews.
  - Mitigation: align write target with current Room editor/view precedence (render/situation) and add integration-style tests around `requestLLMGeneration`.
- Risk: existing assets that still have only Example prose might not receive updates in the same place.
  - Mitigation: decide and document one compatibility rule (e.g., migrate-on-write or write-only to new model with defaults).

### Acceptance criteria for this slice

- `requestLLMGeneration` no longer reads `room.examples`.
- Generated room prose is written to the designated room prose model (situation/render) and is visible in current Room editing/view paths.
- Tests cover:
  - successful room generation write through the new target field
  - no-op/guard behavior when room or target payload is missing
- Inventory query no longer reports this file in the room examples runtime bucket.

## Paired ephemera recommendation: `perception/orchestrate.ts` + `internalCache/componentRender.ts`

### What `perception/orchestrate.ts` is doing

- `orchestrateRoomDescriptionStreams()` is a fan-in coordinator inside `mtw.ephemera.perception`.
- It consumes:
  - `Render Pertains` from `mtw.ephemera.renderCache` (terminal, durable cache-backed signal),
  - `Generation Started`, `Orchestration Error`, and `Generation Deferred` from `mtw.ephemera.renderOrchestration`.
- For `Render Pertains`, it publishes terminal room/header perception messages using `roomRenderWmlFromCacheRecord()` (render-channel prose from `cacheRecord.renderedContent`).
- For `Generation Started` and error/deferred, it publishes placeholder rows. The full-room placeholder helper builds Room `render` WML (no synthetic Example / `StandardRoom.examples`; see Slice update in this document).

### How this interacts with render orchestration

- `renderOrchestration` emits orchestration lifecycle events (`Generation Started`, `Render Generated`, etc.).
- `renderCache` owns durable cache records and emits `Render Pertains` after hit/refetch or post-write readiness.
- Perception treats `Render Pertains` as the terminal "ready to show prose" signal, while orchestration lifecycle events drive interim placeholders/status.
- Therefore, the placeholder shape in `orchestrate.ts` is compatibility UI glue, not the durable prose path.

### Classification and sequencing

1. `lambda/ephemera/dataSource/perception/orchestrate.ts` -> `replace`
  - Replace Example-based placeholder full-room WML with Room `<Render>` placeholder payload (ephemera-wire shape).
   - This is low-risk because placeholders are transient and already superseded by terminal `Render Pertains`.

2. `lambda/ephemera/internalCache/componentRender.ts` -> `defer` short-term, then `replace`
   - Transitional fallback was kept until the render-channel readiness gate was satisfied (**cleared 2026-04-22**; see **Gate decision** above).
   - **`replace` shipped:** Room path is render-cache-only; no `ExamplesData` fallback; Room `DeferredCache` stub omits `examples: []` (see **Slice update: `componentRender.ts`** in this document).

### Risks and mitigations

- Risk: placeholder rendering regressions during generation/error states.
  - Mitigation: add focused perception tests for `Generation Started` and error/deferred message shape.
- Risk: removing `componentRender` fallback too early could impact non-terminal/imperative paths still expecting example-shaped room prose.
  - Mitigation: stage as second step; gate on verification that render-channel room prose comes from render cache / room render payloads.

### Acceptance criteria for the paired slice

- `orchestrate.ts` placeholder full-room helper no longer references `Room.examples`.
- Perception tests confirm:
  - `Generation Started` emits render-channel placeholder rows with expected metadata.
  - terminal `Render Pertains` behavior remains unchanged.
- `componentRender.ts`: `replace` complete; durable doc updated ([`componentRender.AGENT.md`](../../../../lambda/ephemera/internalCache/componentRender.AGENT.md)).

## Verification checklist (per slice)

For each individual call-site refactor:

1. Prove behavior before change with a focused test or fixture.
2. Apply the minimal code change.
3. Run local tests for the touched module.
4. Re-run targeted inventory search to confirm expected delta.
5. Update this plan's matrix and recommended-order checkboxes.

## Suggested inventory commands

Prefer narrow searches and keep outputs with the task PR/notes.

- `rg "\.examples\b" lambda/assets lambda/ephemera lambda/wml`
- `rg "instanceof StandardRoom" lambda/assets lambda/ephemera lambda/wml`
- `rg "tag:\s*'Room'[\s\S]{0,160}examples" lambda --multiline`
- `rg "StandardRoomData[\\s\\S]{0,220}examples" lambda --multiline`

## Exit criteria

Treat this task as complete when all are true:

- No unclassified runtime `StandardRoom.examples` call sites remain.
- Every in-scope deferred Room site has an explicit compatibility rationale, owner, and follow-up trigger.
- Out-of-scope Feature/Knowledge defer sites are explicitly documented with follow-up ownership.
- Tests cover migrated behavior for each changed runtime path.
- A concrete deprecation/removal gate for `StandardRoom.examples` is documented.

## Cleanup when done

- Move any lasting subsystem guidance to durable package docs.
- Remove this planning doc once the initiative is shipped.
