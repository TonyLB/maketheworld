# Ephemera `renderCache/` colocation and deprecation

**Status:** Not started.

This task plan supports **colocating** Ephemera render-cache **domain types** and **mark-state helpers** under [`lambda/ephemera/dataSource/renderCache/`](../../../../lambda/ephemera/dataSource/renderCache/), then **deprecating** the standalone [`lambda/ephemera/renderCache/`](../../../../lambda/ephemera/renderCache/) package as a place for TypeScript modules (barrel, `baseClasses`, `markStateUtils`). Steady-state documentation should live next to the DataSource after merge; **delete this file** when the initiative is complete (see [`taskPlanning/AGENT.md`](../../../AGENT.md) durability ladder).

---

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../AGENT.md) once for task-plan conventions (what belongs here vs in package `AGENT.md` files).
2. Read [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../lambda/ephemera/dataSource/renderCache/AGENT.md) for current **`mtw.ephemera.renderCache`** responsibilities, boundary invariants, and links to domain prose.
3. Read [`lambda/ephemera/renderCache/AGENT.md`](../../../../lambda/ephemera/renderCache/AGENT.md) for schema and pipeline narrative that will be **folded** into the DataSource doc (not duplicated long-term in this plan).
4. Optional contract context: [`taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md`](../dataSource/AGENT.passThrough.contract.planning.md).

---

## Goal

- **Single home** for cache-record types, mark helpers, and DataSource-owned persistence modules under `lambda/ephemera/dataSource/renderCache/`, consistent with other ephemera DataSources that own their data shape at the adapter layer.
- **No import ping-pong:** after the move, nothing under `dataSource/renderCache/` should import **up** to `lambda/ephemera/renderCache/` for types or helpers.

---

## Constraints and merge notes

- **`baseClasses` collision:** [`lambda/ephemera/dataSource/renderCache/baseClasses.ts`](../../../../lambda/ephemera/dataSource/renderCache/baseClasses.ts) already holds **outbound** bus payload types and guards; [`lambda/ephemera/renderCache/baseClasses.ts`](../../../../lambda/ephemera/renderCache/baseClasses.ts) holds **domain / Dynamo** record types. Resolve by **merging** into one module with clear sections, or by **splitting** into two files in the same folder (e.g. `cacheRecordTypes.ts` + rename current outbound file). Pick one approach and use it consistently in imports.
- **`markStateUtils` depends on domain types** via `./baseClasses`. **Move or merge domain `baseClasses` before** moving `markStateUtils` so helpers can import from a **sibling** path under `dataSource/renderCache/` (avoid `utils/` importing back to `lambda/ephemera/renderCache/`).
- **Barrel:** [`lambda/ephemera/renderCache/index.ts`](../../../../lambda/ephemera/renderCache/index.ts) re-exports DataSource primitives and types; removing it first eliminates inverted dependencies and forces explicit import paths (stable intermediate).

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Nested bullets use the same rule; mark nested lines `[X]` as you complete them so partial progress is visible.

- [ ] **Remove the barrel** [`lambda/ephemera/renderCache/index.ts`](../../../../lambda/ephemera/renderCache/index.ts) and fix all imports that used the package root (e.g. [`lambda/ephemera/dataSource/componentExamples.ts`](../../../../lambda/ephemera/dataSource/componentExamples.ts), [`lambda/ephemera/internalUtils/perspectiveId.ts`](../../../../lambda/ephemera/internalUtils/perspectiveId.ts), tests). Point callers at explicit modules: `dataSource/renderCache` primitives vs `renderCache/baseClasses` vs `renderCache/markStateUtils` until those move.
- [ ] **Fold domain types into `dataSource/renderCache/`**
  - [ ] Merge or split per **Constraints and merge notes** above; remove upward imports from `dataSource/renderCache/baseClasses.ts` that reference `../../renderCache/baseClasses`.
  - [ ] Repoint **all** TypeScript imports from `.../renderCache/baseClasses` to the new module path(s).
  - [ ] Delete [`lambda/ephemera/renderCache/baseClasses.ts`](../../../../lambda/ephemera/renderCache/baseClasses.ts) when nothing references it.
- [ ] **Move mark-state helpers** [`lambda/ephemera/renderCache/markStateUtils.ts`](../../../../lambda/ephemera/renderCache/markStateUtils.ts) (and [`markStateUtils.test.ts`](../../../../lambda/ephemera/renderCache/markStateUtils.test.ts)) to e.g. `lambda/ephemera/dataSource/renderCache/utils/markState.ts` (path is indicative). Update imports to sibling `baseClasses` / `cacheRecordTypes` as appropriate.
- [ ] **Fold documentation:** merge [`lambda/ephemera/renderCache/AGENT.md`](../../../../lambda/ephemera/renderCache/AGENT.md) into [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../lambda/ephemera/dataSource/renderCache/AGENT.md); fix cross-links across the repo (planning docs, vertical index, orchestration docs) that still point at `renderCache/AGENT.md` for domain content.
- [ ] **Remove the deprecated package directory** (or leave only a minimal pointer file if required for links---prefer updating links and deleting). Ensure no remaining `from '.../lambda/ephemera/renderCache'` imports except any intentional stub.
- [ ] **Update Recommended order checkboxes** in this document to match reality; then **archive or delete** this task plan per [`taskPlanning/AGENT.md`](../../../AGENT.md).

---

## Verification

- **Compile / tests:** From [`lambda/ephemera/`](../../../../lambda/ephemera/): `npm test` (Jest). Run after each major step or at least before merge.
- **Grep hygiene (adjust patterns after renames):**
  - No imports from `renderCache/baseClasses` or `renderCache/markStateUtils` once files are removed: e.g. `rg "renderCache/baseClasses" lambda/ephemera` should return nothing (or only historical docs until updated).
  - After barrel removal, no imports of the old package root (`from '../renderCache'` or `from './renderCache'` as a folder index) where the barrel used to live; use `rg "renderCache/index"`, `rg "from '\\.\\./renderCache'"`, or similar and fix stragglers.
- **Docs:** Grep for `lambda/ephemera/renderCache/AGENT` and `renderCache/AGENT.md` in `taskPlanning/` and `lambda/ephemera/` to update pointers to the DataSource `AGENT.md`.

---

## Progress

| Milestone | Status |
| --- | --- |
| Task plan created | Done |
| Barrel removed; explicit imports | Not started |
| Domain `baseClasses` colocated; outbound merge resolved | Not started |
| `markStateUtils` colocated under DataSource | Not started |
| `AGENT.md` merged; links updated | Not started |
| `lambda/ephemera/renderCache/` TS removed / directory cleaned | Not started |
| Tests green; task plan closed | Not started |

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../AGENT.md) | Task planning framework |
| [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../lambda/ephemera/dataSource/renderCache/AGENT.md) | **`mtw.ephemera.renderCache`** (target home for merged docs) |
| [`lambda/ephemera/renderCache/AGENT.md`](../../../../lambda/ephemera/renderCache/AGENT.md) | Domain reference (source for merge until deleted) |
| [`taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md`](../dataSource/AGENT.passThrough.contract.planning.md) | Pass-through contract (optional) |
