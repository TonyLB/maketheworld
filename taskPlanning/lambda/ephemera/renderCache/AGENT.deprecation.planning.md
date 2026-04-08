# Ephemera `renderCache/` colocation and deprecation

**Status:** In progress (domain types and mark-state helpers live under [`dataSource/renderCache/`](../../../../lambda/ephemera/dataSource/renderCache/); next: merge `AGENT.md`, remove `lambda/ephemera/renderCache/` TS).

This task plan supports **colocating** Ephemera render-cache **domain types** and **mark-state helpers** under [`lambda/ephemera/dataSource/renderCache/`](../../../../lambda/ephemera/dataSource/renderCache/), then **deprecating** the standalone [`lambda/ephemera/renderCache/`](../../../../lambda/ephemera/renderCache/) package as a place for TypeScript modules. Mark helpers live in [`utils/markState.ts`](../../../../lambda/ephemera/dataSource/renderCache/utils/markState.ts) (types from sibling [`baseClasses.ts`](../../../../lambda/ephemera/dataSource/renderCache/baseClasses.ts)). Steady-state documentation should live next to the DataSource after merge; **delete this file** when the initiative is complete (see [`taskPlanning/AGENT.md`](../../../AGENT.md) durability ladder).

---

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../AGENT.md) once for task-plan conventions (what belongs here vs in package `AGENT.md` files).
2. Read [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../lambda/ephemera/dataSource/renderCache/AGENT.md) for current **`mtw.ephemera.renderCache`** responsibilities, boundary invariants, and links to domain prose.
3. Read [`lambda/ephemera/renderCache/AGENT.md`](../../../../lambda/ephemera/renderCache/AGENT.md) for schema and pipeline narrative that will be **folded** into the DataSource doc (not duplicated long-term in this plan).
4. Optional contract context: [`taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md`](../dataSource/AGENT.passThrough.contract.planning.md).

---

## Goal

- **Single home** for cache-record types, mark helpers, and DataSource-owned persistence modules under `lambda/ephemera/dataSource/renderCache/`, consistent with other ephemera DataSources that own their data shape at the adapter layer.
- **No import ping-pong:** nothing under `dataSource/renderCache/` imports **up** to `lambda/ephemera/renderCache/` for types or mark helpers (done). Callers import [`utils/markState.ts`](../../../../lambda/ephemera/dataSource/renderCache/utils/markState.ts) from explicit paths; the deprecated `lambda/ephemera/renderCache/markStateUtils*.ts` files are removed.

---

## Constraints and merge notes

- **`baseClasses` merged (done):** [`lambda/ephemera/dataSource/renderCache/baseClasses.ts`](../../../../lambda/ephemera/dataSource/renderCache/baseClasses.ts) holds **domain / Dynamo** record types and **outbound** bus payload types in one file (domain section first).
- **Mark-state helpers (done):** [`lambda/ephemera/dataSource/renderCache/utils/markState.ts`](../../../../lambda/ephemera/dataSource/renderCache/utils/markState.ts) (`normalizeMarkState`, `markStatesEqual`); tests in [`markState.test.ts`](../../../../lambda/ephemera/dataSource/renderCache/utils/markState.test.ts). Imports sibling [`baseClasses`](../../../../lambda/ephemera/dataSource/renderCache/baseClasses.ts) for `EphemeraCacheMarkState`.
- **Barrel (removed):** The former `lambda/ephemera/renderCache/index.ts` re-exported DataSource primitives and types; it was deleted so callers use explicit `dataSource/renderCache/*` paths.

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Nested bullets use the same rule; mark nested lines `[X]` as you complete them so partial progress is visible.

- [X] **Remove the barrel** and fix imports that used the package root: [`lambda/ephemera/dataSource/componentExamples.ts`](../../../../lambda/ephemera/dataSource/componentExamples.ts), [`lambda/ephemera/internalUtils/perspectiveId.ts`](../../../../lambda/ephemera/internalUtils/perspectiveId.ts), [`lambda/ephemera/dataSource/componentExamples.test.ts`](../../../../lambda/ephemera/dataSource/componentExamples.test.ts). Deleted [`lambda/ephemera/renderCache/index.ts`](../../../../lambda/ephemera/renderCache/index.ts) (no longer present).
- [X] **Fold domain types into `dataSource/renderCache/`**
  - [X] Merged domain and outbound `baseClasses` in [`lambda/ephemera/dataSource/renderCache/baseClasses.ts`](../../../../lambda/ephemera/dataSource/renderCache/baseClasses.ts); removed upward imports from `../../renderCache/baseClasses`.
  - [X] Repointed TypeScript imports to `./renderCache/baseClasses`, `../renderCache/baseClasses`, or `../dataSource/renderCache/baseClasses` as appropriate.
  - [X] Deleted [`lambda/ephemera/renderCache/baseClasses.ts`](../../../../lambda/ephemera/renderCache/baseClasses.ts).
- [X] **Move mark-state helpers** to [`lambda/ephemera/dataSource/renderCache/utils/markState.ts`](../../../../lambda/ephemera/dataSource/renderCache/utils/markState.ts) and [`markState.test.ts`](../../../../lambda/ephemera/dataSource/renderCache/utils/markState.test.ts); removed `lambda/ephemera/renderCache/markStateUtils.ts` and `markStateUtils.test.ts`. Imports use sibling `baseClasses`.
- [ ] **Fold documentation:** merge [`lambda/ephemera/renderCache/AGENT.md`](../../../../lambda/ephemera/renderCache/AGENT.md) into [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../lambda/ephemera/dataSource/renderCache/AGENT.md); fix cross-links across the repo (planning docs, vertical index, orchestration docs) that still point at `renderCache/AGENT.md` for domain content.
- [ ] **Remove the deprecated package directory** (or leave only a minimal pointer file if required for links---prefer updating links and deleting). Ensure no remaining `from '.../lambda/ephemera/renderCache'` imports except any intentional stub.
- [ ] **Update Recommended order checkboxes** in this document to match reality; then **archive or delete** this task plan per [`taskPlanning/AGENT.md`](../../../AGENT.md).

---

## Verification

- **Compile / tests:** From [`lambda/ephemera/`](../../../../lambda/ephemera/): `npm test` (Jest). Run after each major step or at least before merge.
- **Grep hygiene (adjust patterns after renames):**
  - No imports of the **removed** file path `lambda/ephemera/renderCache/baseClasses.ts` in `.ts` sources.
  - No `renderCache/markStateUtils` or `markStateUtils.ts` imports in `.ts` sources; helpers live under `dataSource/renderCache/utils/markState`.
- **Docs:** Grep for stale `lambda/ephemera/renderCache/baseClasses` links in markdown after each step.

---

## Progress

| Milestone | Status |
| --- | --- |
| Task plan created | Done |
| Barrel removed; explicit imports | Done |
| Domain `baseClasses` colocated; outbound merge resolved | Done |
| Mark-state helpers colocated under DataSource (`utils/markState`) | Done |
| `AGENT.md` merged; links updated | Not started |
| `lambda/ephemera/renderCache/` TS removed / directory cleaned | Not started |
| Tests green; task plan closed | Not started |

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../AGENT.md) | Task planning framework |
| [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../lambda/ephemera/dataSource/renderCache/AGENT.md) | **`mtw.ephemera.renderCache`** (target home for merged docs) |
| [`lambda/ephemera/dataSource/renderCache/utils/markState.ts`](../../../../lambda/ephemera/dataSource/renderCache/utils/markState.ts) | Mark-state normalization and equality (`normalizeMarkState`, `markStatesEqual`) |
| [`lambda/ephemera/renderCache/AGENT.md`](../../../../lambda/ephemera/renderCache/AGENT.md) | Domain reference (source for merge until deleted) |
| [`taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md`](../dataSource/AGENT.passThrough.contract.planning.md) | Pass-through contract (optional) |
