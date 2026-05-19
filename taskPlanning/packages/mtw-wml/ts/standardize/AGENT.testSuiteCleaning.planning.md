# StandardForm test suite cleaning (`index.test.ts`)

**Status:** In progress. Phase 3 complete. Phase 4 Step 2 complete (Layer B integration + unit pairs swept). Next step: **Phase 4 Step 3** (large unit files). See [`AGENT.testSuiteCleaning.classification.md`](./AGENT.testSuiteCleaning.classification.md) section 8.

## Purpose

Reorganize and refresh [`packages/mtw-wml/ts/standardize/index.test.ts`](../../../../../packages/mtw-wml/ts/standardize/index.test.ts) so that:

- The suite is **editable** by humans and agents (target: no single file above a few hundred lines of test body).
- Tests are **grouped by behavior**, not append order.
- **Integration coverage** stays in a `StandardForm` context where needed, split across **two homes**: asset-level suites under `standardize/integration/`, and component-adjacent `*.integration.test.ts` files next to the component under test.

This plan is task-scoped. Delete or archive it when the refactor ships.

## Task-planning framework

- Conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md)
- Root complex-task pattern: [`AGENT.md` "Getting Started pattern for complex tasks"](../../../../../../AGENT.md#getting-started-pattern-for-complex-tasks)

## Problem summary

| Problem | Evidence | Impact |
| --- | --- | --- |
| **Huge single file** | ~5,600 lines; largest file under `standardize/` by ~3.5x (`schemaOrganization.test.ts` is ~2,000) | Edits and reviews choke tooling; hard to find tests |
| **Stale grab-bag** | ~1,930 lines of top-level `it(...)` with no `describe` (lines ~536-2464); legacy "Example" naming on Situation tests | Unclear ownership; misleading names; duplicate concerns |
| **Hub for WML integration** | Room + Feature + Situation + Mark facets, merge/diff/subset, ephemeraWire, etc. in one asset | Need **both** a slim asset-level `integration/` folder and component-adjacent integration files; one central folder alone would bloat awkwardly |
| **Uneven grouping** | Some APIs have named `describe` blocks; most construction/merge/round-trip tests do not | `diff method` is organized; adjacent merge tests are not |

## Current file inventory (top-level structure)

`describe('StandardForm')` contains **16** named child `describe` blocks and **~50+** sibling `it` blocks with **no** enclosing `describe` (the grab-bag).

Approximate line ranges (1-based, from static scan):

| Block | Lines (approx) | ~Lines | Notes |
| --- | --- | ---: | --- |
| `input vs normative typeguards` | 28-55 | 28 | Small, focused |
| `isEmpty()` | 56-151 | 96 | |
| `equals()` | 152-262 | 111 | |
| `standardizeMode` | 263-534 | 272 | Well-scoped; overlaps conceptually with [`wmlStandardizeMode.test.ts`](../../../../../packages/mtw-wml/ts/standardize/wmlStandardizeMode.test.ts) (mode *literals* only) |
| **(ungrouped)** | 536-2464 | **1,929** | Construction, JSON/WML round-trip, merge, schema render, Situation/feature nesting, characters, edits, NDJSON, etc. |
| `assureComponents method` | 2466-2551 | 86 | |
| `diff method` | 2552-3198 | 647 | Includes nested describes (nested change, top-level move, key changes) |
| `subset method` | 3200-3716 | 517 | Map/position/cascade scenarios |
| **(ungrouped)** | 3718-3907 | 190 | NDJSON round-trip, sub-component grouping |
| `key changes via merge` | 3908-4208 | 301 | validation / reference updates / merge / integration |
| `byId` | 4209-4242 | 34 | |
| `byUniversalId` | 4243-4278 | 36 | |
| `finalize` | 4279-4425 | 147 | |
| **(ungrouped)** | 4426-4477 | 52 | origin merge; nested Situation facet edits |
| `Asset-level ShortName and Summary` | 4479-5148 | 670 | Large but thematically coherent |
| `validate()` | 5149-5278 | 130 | circular parent detection |
| `removeComponent` | 5279-5514 | 236 | includes `cascade` nested describe |
| `referencedBy` | 5515-end | 85 | |

**Test count (rough):** ~217 `it(...)` under `StandardForm` (grep `^\s*it\(`).

## Staleness signals (non-exhaustive)

Use these as a cleanup checklist while splitting/moving tests:

- **"Example" vocabulary** in test titles and fixtures while asserting **Situation** behavior (e.g. `should correctly return JSON for examples nested in rooms`, keys `Example1`, comments "Example link").
- **[`standardize/AGENT.md`](../../../../../packages/mtw-wml/ts/standardize/AGENT.md)** Getting Started still points at `example.test.ts` and `edits.test.ts` under `components/`; **`example.test.ts` does not exist** (Situation replaced Example).
- **Append-only history:** large ungrouped block between `standardizeMode` and `assureComponents` suggests tests were added at file root without a home `describe`.
- **Partial extraction already done:** [`wmlStandardizeMode.test.ts`](../../../../../packages/mtw-wml/ts/standardize/wmlStandardizeMode.test.ts), [`keys/facets/integration.test.ts`](../../../../../packages/mtw-wml/ts/standardize/keys/facets/integration.test.ts), and per-component `*.test.ts` files exist; some `index.test.ts` cases may belong there instead.

Fixture guidance for *new* or *moved* tests: [`packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md`](../../../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md) (Situation vs Example, `situations` not `examples`, ephemeraWire `<Render>` rules).

## Two-layer integration model (agreed)

Use **both** patterns together. They share the same harness (`StandardForm` + multi-component `<Asset>` fixtures when needed) but differ in **file location** and **what is under test**.

### Layer A: Asset-level (`standardize/integration/`)

**Purpose:** StandardForm APIs and asset-wide behavior with no single natural component owner. Keeps the central folder focused; avoids turning it into a dump for every Room/Feature scenario.

**Typical contents (from current `index.test.ts`):**

- `merge`, `diff`, `subset`, `validate`, `finalize`, `removeComponent`, `referencedBy`
- `assureComponents`, `byId`, `byUniversalId`, key-change-via-merge orchestration
- Asset-level ShortName / Summary / topLevel / imports / NDJSON graphs
- Generic construction round-trips that are not anchored on one component type

**Naming:** `standardForm.<apiOrTheme>.test.ts` under `integration/`.

### Layer B: Component-adjacent (`components/<tag>.integration.test.ts`)

**Purpose:** Multi-component scenarios where the **primary assertion** is a specific component's fields, schema, or localized round-trip (situation facet lists on Room, Feature nested in Room, Lens/Mark under Room, etc.). Discoverable beside the code you are changing.

**Typical contents (candidates from grab-bag and existing component tests):**

- Situation / Feature / Knowledge nesting JSON and schema (today's "examples nested in rooms" block)
- Room + Situation facet behavior, hoisting, rendering-level relocation when Room is the subject
- ephemeraWire Room/Object/Character cases where Room (or a dedicated `room.ephemeraWire.integration.test.ts`) is the hub
- Move informal integration already in [`room.test.ts`](../../../../../packages/mtw-wml/ts/standardize/components/room.test.ts) (e.g. `describe('Lens output in schema')` uses full `<Asset>` + `StandardForm`) into `room.integration.test.ts` and trim `room.test.ts` toward unit scope

**Naming:** `<component>.integration.test.ts` next to `<component>.test.ts`. Optional suffix split if a file grows large (e.g. `room.ephemeraWire.integration.test.ts`).

### Layer 0: Unit tests (unchanged home)

| Area | File(s) | Scope |
| --- | --- | --- |
| Single-component WML/schema/merge | `components/*.test.ts` | One component tag in isolation |
| ReferenceList algebra | `keys/referenceList.test.ts` | List ops without full asset graph |
| Facet payload/unit | `keys/facets/*.test.ts` | Facet in isolation |
| Facet cross-type wiring | `keys/facets/integration.test.ts` | Facet family; do not duplicate |
| Mode literals/guards | `wmlStandardizeMode.test.ts` | Not full asset scenarios |

### Placement rules

1. **Harness:** Component-adjacent integration may still construct `StandardForm`; co-location is about ownership, not avoiding the asset graph.
2. **Primary assertion:**
   - Component field, component `toJSON()`, or component `schema` / WML slice -> **Layer B** (owner = component whose API surface is under test).
   - `form.merge`, `form.diff`, `form.subset`, `form.validate`, topLevel, imports, `referencedBy`, etc. -> **Layer A**.
3. **Owner when both tags matter:** Anchor by the component being developed, not tag count. Feature-in-Room JSON shape -> `feature.integration.test.ts` if Feature lists are under test; Room situation facet list -> `room.integration.test.ts`. Do not duplicate the same asset in two files; cross-link in describe titles if needed.
4. **File size:** `room.test.ts` is already ~1,567 lines with embedded integration. Split **unit** vs **integration** when touching Room (same discipline as `index.test.ts`).

## Target end state (draft)

Not implemented yet; refine destinations during Phase 1 classification.

```
packages/mtw-wml/ts/standardize/
  index.test.ts                         # Delete or thin smoke after split
  integration/                          # Layer A: asset-level only
    standardForm.construct.test.ts
    standardForm.merge.test.ts
    standardForm.diff.test.ts
    standardForm.subset.test.ts
    standardForm.validate.test.ts
    standardForm.removeComponent.test.ts
    standardForm.referencedBy.test.ts
    standardForm.finalize.test.ts
    standardForm.assetMeta.test.ts        # ShortName, Summary, topLevel
    ...
  testHelpers/                          # optional shared WML fixtures
  components/
    room.test.ts                        # unit: StandardRoom in isolation
    room.integration.test.ts            # Layer B: Room-centric multi-component
    room.ephemeraWire.integration.test.ts   # optional if wire cases grow
    feature.test.ts
    feature.integration.test.ts
    situation.test.ts
    situation.integration.test.ts       # e.g. marks when Situation is hub
    ...
```

**Precedent already in repo:** [`keys/facets/integration.test.ts`](../../../../../packages/mtw-wml/ts/standardize/keys/facets/integration.test.ts) (facet-adjacent); informal Room+Lens block at end of [`room.test.ts`](../../../../../packages/mtw-wml/ts/standardize/components/room.test.ts) (to formalize as Layer B).

Goals:

- **No file > ~800 lines** (stretch: ~400-500 for agent-friendly edits), including `room.test.ts` after unit/integration split.
- **Layer A** stays relatively small (API-themed files); **Layer B** absorbs the long tail of component-specific multi-tag scenarios.
- Every integration file has a clear top-level `describe` (component name or `StandardForm.<api>`).
- **Shared helpers** for repeated asset snippets where copy-paste hurts (optional `testHelpers/`).
- **Rename** stale "example" tests to "situation" when touching them.

Open questions (resolved in Phase 1 -- see [`AGENT.testSuiteCleaning.classification.md`](./AGENT.testSuiteCleaning.classification.md) Decisions):

- ~~Whether `index.test.ts` is deleted outright or kept as a one-test smoke file.~~ **Thin smoke** (1-2 construct round-trips) after split.
- ~~Which ephemeraWire cases land in `room.ephemeraWire.integration.test.ts` vs `integration/standardForm.ephemeraWire.test.ts`.~~ **Room hub** -> Layer B; **asset-wide mode/merge policy** -> Layer A `standardForm.standardizeMode.test.ts`.
- ~~Whether any Layer B tests are better owned under `situation.integration.test.ts` vs `room.integration.test.ts`.~~ **Room** for facet lists / hoisting; **feature** / **knowledge** when their child lists are primary.

## Getting started

Before moving tests:

1. Skim task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md) (this document follows that framework).
2. Read StandardForm role: [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../../packages/mtw-wml/ts/standardize/AGENT.md) (Overview, Semantic Modes, subset/merge/diff).
3. Read testing/fixture notes: [`packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md`](../../../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md).
4. For edit algebra context on diff/merge cases: [`components/AGENT.editAlgebra.md`](../../../../../packages/mtw-wml/ts/standardize/components/AGENT.editAlgebra.md), [`keys/AGENT.referenceList.editAlgebra.md`](../../../../../packages/mtw-wml/ts/standardize/keys/AGENT.referenceList.editAlgebra.md).

**Command authority:** Jest via [`packages/mtw-wml/package.json`](../../../../../packages/mtw-wml/package.json) (`npm test` = `jest`). Run from **`packages/mtw-wml/`** unless noted otherwise.

**Baseline verification (run before edits):**

```bash
cd packages/mtw-wml
npm test -- ts/standardize/index.test.ts
```

Optional narrower checks while splitting:

```bash
cd packages/mtw-wml
npm test -- ts/standardize/index.test.ts -t "diff method"
npm test -- ts/standardize/index.test.ts -t "subset method"
```

Typecheck (package-wide):

```bash
cd packages/mtw-wml
npx tsc -p tsconfig.json --noEmit
```

**Stale-term regression search (repo root):**

```bash
rg "\.examples\b" packages/mtw-wml/ts/standardize --glob "*.test.ts"
rg "examples nested|Example link|<Example" packages/mtw-wml/ts/standardize/index.test.ts
```

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as each sub-step lands.

- [X] Phase 0 - baseline and guardrails
  - [X] Run full `index.test.ts` baseline; record pass count and duration in Progress below
  - [X] Agree two-layer layout (Layer A `standardize/integration/` + Layer B `components/*.integration.test.ts`)

**Shared test helpers (guidance, not a Phase 0 deliverable):** Do not add `testHelpers/` up front. Introduce shared fixtures only during Phase 2 when a concrete extraction duplicates the same WML asset snippet across files; copy-paste in one new file is fine.

- [X] Phase 1 - inventory and classify (no moves yet)
  - [X] Tag each ungrouped `it` (lines ~536-2464) with destination: **Layer A path**, **Layer B path** (`room.integration.test.ts`, etc.), unit elsewhere, or delete
  - [X] Tag named `describe` blocks in `index.test.ts` (most -> Layer A; note any -> Layer B)
  - [X] Inventory informal integration in `room.test.ts` (and other large `components/*.test.ts`) for Layer B migration
  - [X] List duplicate/overlapping coverage vs `keys/facets/integration.test.ts`, `wmlStandardizeMode.test.ts`
  - [X] Mark tests to rename (Example -> Situation) vs delete as redundant

- [X] Phase 2 - mechanical split (behavior-neutral)
  - [X] **Layer A:** Extract named asset-level `describe` blocks to `integration/standardForm.*.test.ts` one at a time (`diff`, `subset`, `validate`, ...); green after each
  - [X] **Layer A:** Move remaining asset-level grab-bag slices (generic construct/merge/NDJSON not owned by a component)
  - [X] **Layer B:** Create `components/*.integration.test.ts` files; move component-anchored grab-bag tests from `index.test.ts`
  - [X] **Layer B:** Move informal multi-component blocks from `room.test.ts` (and peers) into `*.integration.test.ts`; shrink unit files
  - [X] Split `standardizeMode` / ephemeraWire per Phase 1 owner (Layer A vs `room.ephemeraWire.integration.test.ts`)
  - [X] Remove or thin `index.test.ts` when empty
  - [X] Add `testHelpers/` only if duplication across new files justifies it (see guidance above) — **not needed**; no `testHelpers/` added (see Progress)

- [X] Phase 3 - staleness pass
  - [X] Rename misleading test titles and fixture keys (Example -> Situation)
  - [X] Remove or relocate tests superseded by component/facet unit tests
  - [X] Update [`standardize/AGENT.md`](../../../../../packages/mtw-wml/ts/standardize/AGENT.md) Getting Started: two-layer layout, drop `example.test.ts`, list `integration/` + `*.integration.test.ts` convention

- [ ] Phase 4 - coverage sweeps (redundancy + gaps)
  - [X] Add sweep rubric and per-file rows to [`AGENT.testSuiteCleaning.classification.md`](./AGENT.testSuiteCleaning.classification.md) section 8 (template + inventory)
  - [X] **Step 0:** Cross-cutting partners -- `keys/facets/integration.test.ts`, `wmlStandardizeMode.test.ts`, `processComponents.test.ts`, `schemaOrganization.test.ts` (overlap context for later files)
  - [X] **Step 1:** Layer A -- `integration/standardForm.*.test.ts` (15 files; smallest API surface first: `equals`, `isEmpty`, `lookup`, ... then `construct`, `merge`, `diff`, `subset`, `assetMeta`)
  - [X] **Step 2:** Layer B -- each `components/*.integration.test.ts` + `*.ephemeraWire.integration.test.ts` paired with its `components/<tag>.test.ts` unit file
  - [ ] **Step 3:** Large unit files still at integration risk -- `room.test.ts`, `worldState.test.ts`, `map.test.ts`, `guidance.test.ts`
  - [ ] **Step 4:** Consolidate -- redundancy table, gap backlog, and triage (keep / delete / move / add) in classification section 8; no test changes required to complete Phase 4
  - [ ] Gate green after any optional fix slices (if triage items are implemented before Phase 5)

- [ ] Phase 5 - finish
  - [ ] Full `npm test` in `packages/mtw-wml`
  - [ ] `npx tsc -p tsconfig.json --noEmit`
  - [ ] Delete or archive this task plan

## Phase 4 recommended order (coverage sweeps)

Phase 4 is **read-only analysis** unless you explicitly implement a triage item in the same PR. Each sweep fills one row in classification section 8. Work **one file (or file pair) at a time** so overlap notes stay accurate.

### Sweep questions (every file)

For each `it` / `describe`, record:

1. **Primary assertion** -- facet class, `StandardComponent` unit, `StandardForm.<api>`, `processComponents`, schema org, etc.
2. **Redundancy (a)** -- same assertion + same harness elsewhere? (cite file + test title; distinguish "similar fixture" from true duplicate)
3. **Gap (b)** -- behavior in implementation or AGENT.md with no test at this layer? (cite API / edge case)
4. **Action** -- `keep` | `delete` | `move` | `narrow` | `add` (defer implementation unless doing a fix slice)

### Execution order

| Step | Scope | Why this order |
| --- | --- | --- |
| **0** | Overlap partners (facets integration, `wmlStandardizeMode`, `processComponents`, `schemaOrganization`) | Establishes what "already covered elsewhere" means before judging Layer A/B files |
| **1a** | Layer A small APIs: `equals`, `isEmpty`, `referencedBy`, `finalize`, `lookup`, `assureComponents`, `validate`, `standardizeMode`, `removeComponent` | Fast passes; calibrate rubric |
| **1b** | Layer A heavy APIs: `construct`, `merge`, `keyChangesViaMerge`, `subset`, `diff`, `assetMeta` | Highest cross-file overlap risk (merge/diff/subset/construct) |
| **2a** | Layer B thin files: `guidance`, `message`, `moment`, `worldState`, `situation`, `feature`, `knowledge` (+ ephemeraWire siblings) | Pair each `*.integration.test.ts` with `<tag>.test.ts` |
| **2b** | Layer B heavy: `map.integration`, `room.integration`, `room.ephemeraWire.integration` | Room/map/schema-org interactions |
| **3** | Unit files with residual multi-tag risk: `room.test.ts`, `worldState.test.ts`, `map.test.ts`, `guidance.test.ts` | Find informal integration left in unit files |
| **4** | Consolidate section 8 | Single redundancy matrix + gap backlog; link to Phase 1 section 4 overlap rules |

### Per-file Jest (while sweeping)

```bash
cd packages/mtw-wml
npm test -- ts/standardize/integration/standardForm.diff.test.ts   # example: one Layer A file
npm test -- ts/standardize/components/room.integration.test.ts ts/standardize/components/room.test.ts
```

### Deliverables

- Updated [`AGENT.testSuiteCleaning.classification.md`](./AGENT.testSuiteCleaning.classification.md) **section 8** (all rows filled or explicitly deferred)
- Optional: short "top gaps" / "top redundancies" list in planning Progress when Step 4 completes
- Implementation of delete/move/add items is **out of scope** for Phase 4 completion unless tracked as follow-up slices before Phase 5

## Verification

From `packages/mtw-wml/`:

| Step | Command |
| --- | --- |
| During refactor (index + Layer A) | `npm test -- ts/standardize/index.test.ts` then `ts/standardize/integration/` |
| Layer B component integration | `npm test -- ts/standardize/components/room.integration.test.ts` (etc.) |
| Room unit after split | `npm test -- ts/standardize/components/room.test.ts` |
| Full package | `npm test` |
| Typecheck | `npx tsc -p tsconfig.json --noEmit` |
| Stale Example references | `rg "examples nested\|Example1\|<Example" packages/mtw-wml/ts/standardize --glob "*.test.ts"` |

After each extraction PR/slice: same commands; no test count should drop without an explicit deletion note in Progress.

## Progress

| Milestone | Status | Notes |
| --- | --- | --- |
| Create task plan | Done | This document |
| Phase 0 baseline run | Done | 217 passed, ~0.73s (`npm test -- ts/standardize/index.test.ts`) |
| Two-layer layout agreed | Done | Layer A `integration/` + Layer B `components/*.integration.test.ts` |
| Phase 1 classification spreadsheet | Done | [`AGENT.testSuiteCleaning.classification.md`](./AGENT.testSuiteCleaning.classification.md): 64 ungrouped `it`, 16 describes, 8 delete tags, 5 rename titles |
| Layer A named-describe extraction | Done | 13 files under `integration/`; 139 tests; `index.test.ts` 78 tests (~2,400 lines); total 217 |
| Layer A grab-bag extraction | Done | Added `standardForm.merge.test.ts` (17 tests); expanded `construct` (+14), `lookup` (+1), `assetMeta` (+1); thin smoke left in `index.test.ts` |
| First Layer B split | Done | 8 `components/*.integration.test.ts` files (29 tests); `room.integration.test.ts` largest (14 tests) |
| Grab-bag fully classified and moved | Done | All grab-bag and `standardizeMode` moved from `index.test.ts` |
| `room.test.ts` unit/integration split | Done | Situation facet + Lens blocks -> `room.integration.test.ts`; `room.test.ts` ~1,464 lines (Character Integration stays unit) |
| `standardizeMode` / ephemeraWire split | Done | `standardForm.standardizeMode.test.ts` (4); `room.ephemeraWire.integration.test.ts` (10); feature/knowledge ephemeraWire (2 each); 2 dup tests deleted |
| Peer informal integration | Done | map shared-ref -> `map.integration.test.ts`; guidance -> `guidance.integration.test.ts` |
| `index.test.ts` thinned | Done | 2 smoke tests, ~52 lines |
| Gate test count (`index` + `integration/` + `*.integration.test.ts`) | Done | **226 passed** (+9 vs 217: unit-file moves into gate; -2 dup deletes) |
| `testHelpers/` | Not needed | Phase 2 complete with no shared fixture dir; per-file WML is scenario-specific; existing `components/utils/testing.ts` (`mergeTest`) covers component unit merges |
| Phase 3 staleness pass | Done | Example->Situation renames in Layer B + integration files; 0 tests deleted (overlap audit); `AGENT.md` Test layout section + `components/AGENT.implementation.md` |
| AGENT.md test pointers updated | Done | Test layout (two layers); `situation.ts` replaces `example.ts`; no `example.test.ts` |
| Gate test count post-Phase 3 | Done | **226 passed**, ~1.6s; `tsc --noEmit` clean |
| Phase 4 coverage sweeps | Step 2 done | Section 8 Step 2a/2b filled (49 Layer B integration `it` across 12 files); **0 redundancies** to delete; **0 new gap backlog** items (Layer A backlog unchanged); gate 226 pass |
| Phase 4 Step 3 | Not started | Large unit files: `room.test.ts`, `worldState.test.ts`, `map.test.ts`, `guidance.test.ts` |
| Task plan archived | Not started | Phase 5 |

## Work log

- **2026-05-19:** Created plan from static analysis of `index.test.ts` (~5,599 lines, 16 top-level `describe` blocks, ~1,929-line ungrouped `it` region).
- **2026-05-19:** Baseline: 217 tests passing in ~0.73s from `packages/mtw-wml/`.
- **2026-05-19:** Adopted two-layer integration model (asset-level `integration/` + component-adjacent `*.integration.test.ts`); updated placement rules and phases.
- **2026-05-19:** Phase 1 complete. Baseline re-run: 217 passed, ~0.75s. Classification artifact: 64 ungrouped `it` + 16 top-level `describe` blocks tagged; `room.test.ts` Layer B inventory; overlap matrix vs facets + wmlStandardizeMode; 5 Example->Situation renames and 2 `standardizeMode` delete candidates noted for Phase 2/3.
- **2026-05-19:** Layer A named-describe extraction. Created `packages/mtw-wml/ts/standardize/integration/` with 13 `standardForm.*.test.ts` files (construct, isEmpty, equals, assureComponents, diff, subset, keyChangesViaMerge, lookup, finalize, assetMeta, validate, removeComponent, referencedBy). `index.test.ts` retains `standardizeMode` + grab-bag (78 tests). Combined: 217 passed; `tsc --noEmit` clean.
- **2026-05-19:** Layer A grab-bag extraction. Created `standardForm.merge.test.ts`; moved 33 asset-level ungrouped tests from `index.test.ts` into `merge`, `construct`, `lookup`, `assetMeta`. Left thin smoke (2 construct tests) plus Layer B grab-bag and `standardizeMode` in `index.test.ts` (45 tests, ~1,289 lines). `integration/` now 14 files, 172 tests; combined 217 passed; `tsc --noEmit` clean.
- **2026-05-19:** Layer B grab-bag extraction. Created 8 `components/*.integration.test.ts` files (room 14, feature 3, knowledge 3, situation 3, worldState 2, map 2, message 1, moment 1). Moved finalize character/room test from `standardForm.finalize.test.ts` to `room.integration.test.ts`. `index.test.ts` now 19 tests (`standardizeMode` + smoke, ~328 lines). Combined 217 passed; `tsc --noEmit` clean.
- **2026-05-19:** Layer B informal integration + ephemeraWire split. Moved Situation facet + Lens from `room.test.ts` to `room.integration.test.ts` (19 tests); map shared-ref, guidance facet round-trip; feature/knowledge ephemeraWire files. Split `standardizeMode`: deleted 2 dups; `standardForm.standardizeMode.test.ts` (4); `room.ephemeraWire.integration.test.ts` (10). `index.test.ts` smoke only (2 tests, ~52 lines). Gate: 226 passed; `tsc --noEmit` clean.
- **2026-05-19:** `testHelpers/` deferred permanently for this task: no cross-file duplicate WML asset snippets met the Phase 2 bar; repeated `<Asset uuid=(Test)>`-style setup is intentional per-scenario, not shared fixtures.
- **2026-05-19:** Added **Phase 4** (systematic coverage sweeps: redundancy + gaps per file) and renumbered ship/verify to **Phase 5**. Extended classification **section 8** with sweep rubric, file inventory (~`it` counts), Step 0-4 tables, and consolidated backlog templates. Recommended execution order in planning doc (overlap partners -> Layer A small/heavy -> Layer B thin/heavy -> large unit files -> consolidate).
- **2026-05-19:** Phase 3 staleness pass. Renamed 5 Layer B `it` titles and fixture keys (`testFeatureSituation`, `situation1`/`situation2`, etc.) in `room.integration.test.ts`, `feature.integration.test.ts`, `knowledge.integration.test.ts`, `standardForm.diff.test.ts`, `standardForm.construct.test.ts`; updated comments in `subset`, `removeComponent`, `keys/facets/integration.test.ts`; optional `processComponents.test.ts` key hygiene. Overlap audit (classification section 4): **0 deletions** -- retained distinct harnesses (StandardForm vs facet unit vs `processComponents`). Added **Test layout (two layers)** to `standardize/AGENT.md`; fixed `situation.ts` / `situation.test.ts` pointers in `components/AGENT.implementation.md`. Gate: 226 passed; `tsc --noEmit` clean.
- **2026-05-19:** Phase 4 Step 0. Finalized classification section 8 (sweep depth, `it` counts, Step 0 table + overlap context). Swept facets integration (39), `wmlStandardizeMode` (4), `processComponents` (19), `schemaOrganization` (65): **0 redundancies** to delete; documented harness boundaries and processComponents title pairs; gaps noted (Guidance facets elsewhere, `standardizeMode` not in processComponents tests, proposed `<Parent>` tag deferred, diff reference-change in `diff.test`). Partner suite 127 pass; gate 226 pass; `tsc --noEmit` clean.
- **2026-05-19:** Phase 4 Step 1. Swept all 15 Layer A `integration/standardForm.*.test.ts` files (175 `it`) + `index.test.ts` smoke (2 `it`). **0 redundancies** to delete (Step 0 overlap rules applied). Gaps deferred to classification section 8 backlog: diff nested reference debt (existing TODO), `validate` missing-parent, optional `mapContents` / `resolveInitialStandardizeMode`. Layer A-only gate: **177 passed**; full gate unchanged at 226; `tsc --noEmit` clean. No test or `AGENT.md` code changes (analysis-only).
- **2026-05-19:** Phase 4 Step 2. Swept all 12 Layer B integration files (49 `it`) paired with unit files (`guidance` through `room.ephemeraWire`). **0 redundancies** to delete; documented keep-both pairs (room removed-feature, character unit vs integration, processComponents title pairs, facet unit vs situation asset smoke, worldState standalone vs room Lens-in-Room). **0 new gaps** at Layer B; Step 3 handoff noted for large unit files. Gate: **226 passed**; `tsc --noEmit` clean. No test or `AGENT.md` changes (analysis-only).
