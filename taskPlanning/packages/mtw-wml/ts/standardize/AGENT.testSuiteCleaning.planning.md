# StandardForm test suite cleaning (`index.test.ts`)

**Status:** In progress. Two-layer layout agreed (asset `integration/` + component `*.integration.test.ts`). Next step: Phase 1 classify each test as Layer A, Layer B, unit, or delete.

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

Open questions (resolve in Phase 1):

- Whether `index.test.ts` is deleted outright or kept as a one-test smoke file.
- Which ephemeraWire cases land in `room.ephemeraWire.integration.test.ts` vs `integration/standardForm.ephemeraWire.test.ts` (asset-wide merge/render vs Room-as-hub).
- Whether any Layer B tests are better owned under `situation.integration.test.ts` vs `room.integration.test.ts` (document owner in classification table).

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

- [ ] Phase 1 - inventory and classify (no moves yet)
  - [ ] Tag each ungrouped `it` (lines ~536-2464) with destination: **Layer A path**, **Layer B path** (`room.integration.test.ts`, etc.), unit elsewhere, or delete
  - [ ] Tag named `describe` blocks in `index.test.ts` (most -> Layer A; note any -> Layer B)
  - [ ] Inventory informal integration in `room.test.ts` (and other large `components/*.test.ts`) for Layer B migration
  - [ ] List duplicate/overlapping coverage vs `keys/facets/integration.test.ts`, `wmlStandardizeMode.test.ts`
  - [ ] Mark tests to rename (Example -> Situation) vs delete as redundant

- [ ] Phase 2 - mechanical split (behavior-neutral)
  - [ ] **Layer A:** Extract named asset-level `describe` blocks to `integration/standardForm.*.test.ts` one at a time (`diff`, `subset`, `validate`, ...); green after each
  - [ ] **Layer A:** Move remaining asset-level grab-bag slices (generic construct/merge/NDJSON not owned by a component)
  - [ ] **Layer B:** Create `components/*.integration.test.ts` files; move component-anchored grab-bag tests from `index.test.ts`
  - [ ] **Layer B:** Move informal multi-component blocks from `room.test.ts` (and peers) into `*.integration.test.ts`; shrink unit files
  - [ ] Split `standardizeMode` / ephemeraWire per Phase 1 owner (Layer A vs `room.ephemeraWire.integration.test.ts`)
  - [ ] Remove or thin `index.test.ts` when empty
  - [ ] Add `testHelpers/` only if duplication across new files justifies it (see guidance above)

- [ ] Phase 3 - staleness pass
  - [ ] Rename misleading test titles and fixture keys (Example -> Situation)
  - [ ] Remove or relocate tests superseded by component/facet unit tests
  - [ ] Update [`standardize/AGENT.md`](../../../../../packages/mtw-wml/ts/standardize/AGENT.md) Getting Started: two-layer layout, drop `example.test.ts`, list `integration/` + `*.integration.test.ts` convention

- [ ] Phase 4 - finish
  - [ ] Full `npm test` in `packages/mtw-wml`
  - [ ] `npx tsc -p tsconfig.json --noEmit`
  - [ ] Delete or archive this task plan

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
| Phase 1 classification spreadsheet | Not started | Tag Layer A vs Layer B per test |
| First Layer A split | Not started | Suggest `diff method` or `subset method` (already grouped) |
| First Layer B split | Not started | Suggest situation-nesting grab-bag -> `room.integration.test.ts` |
| Grab-bag fully classified and moved | Not started | Largest risk |
| `room.test.ts` unit/integration split | Not started | Migrate `Lens output in schema` block |
| AGENT.md test pointers updated | Not started | |
| Task plan archived | Not started | |

## Work log

- **2026-05-19:** Created plan from static analysis of `index.test.ts` (~5,599 lines, 16 top-level `describe` blocks, ~1,929-line ungrouped `it` region).
- **2026-05-19:** Baseline: 217 tests passing in ~0.73s from `packages/mtw-wml/`.
- **2026-05-19:** Adopted two-layer integration model (asset-level `integration/` + component-adjacent `*.integration.test.ts`); updated placement rules and phases.
