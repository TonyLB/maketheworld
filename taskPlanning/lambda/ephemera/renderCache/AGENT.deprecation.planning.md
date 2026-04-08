# Ephemera `renderCache/` colocation and deprecation

**Status:** In progress (domain types, mark helpers, and **merged AGENT** live under [`dataSource/renderCache/`](../../../../lambda/ephemera/dataSource/renderCache/); next: remove remaining `lambda/ephemera/renderCache/` content or leave redirect-only).

This task plan supports **colocating** Ephemera render-cache **domain types** and **mark-state helpers** under [`lambda/ephemera/dataSource/renderCache/`](../../../../lambda/ephemera/dataSource/renderCache/), then **deprecating** the standalone [`lambda/ephemera/renderCache/`](../../../../lambda/ephemera/renderCache/) package as a place for TypeScript modules. Mark helpers live in [`utils/markState.ts`](../../../../lambda/ephemera/dataSource/renderCache/utils/markState.ts) (types from sibling [`baseClasses.ts`](../../../../lambda/ephemera/dataSource/renderCache/baseClasses.ts)). Canonical prose **merged** into [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../lambda/ephemera/dataSource/renderCache/AGENT.md); [`lambda/ephemera/renderCache/AGENT.md`](../../../../lambda/ephemera/renderCache/AGENT.md) is a **redirect stub**. **delete this file** when the initiative is complete (see [`taskPlanning/AGENT.md`](../../../AGENT.md) durability ladder).

---

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../AGENT.md) once for task-plan conventions (what belongs here vs in package `AGENT.md` files).
2. Read [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../lambda/ephemera/dataSource/renderCache/AGENT.md) for **`mtw.ephemera.renderCache`**, Dynamo schema, `internalCache.RenderCache`, boundary invariants, and pass-through.
3. Optional: [`lambda/ephemera/renderCache/AGENT.md`](../../../../lambda/ephemera/renderCache/AGENT.md) redirects to the DataSource doc (bookmark compatibility).
4. Optional contract context: [`taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md`](../dataSource/AGENT.passThrough.contract.planning.md).

---

## Goal

- **Single home** for cache-record types, mark helpers, and DataSource-owned persistence modules under `lambda/ephemera/dataSource/renderCache/`, consistent with other ephemera DataSources that own their data shape at the adapter layer.
- **No import ping-pong:** nothing under `dataSource/renderCache/` imports **up** to `lambda/ephemera/renderCache/` for types or mark helpers (done). Callers import [`utils/markState.ts`](../../../../lambda/ephemera/dataSource/renderCache/utils/markState.ts) from explicit paths; the deprecated `lambda/ephemera/renderCache/markStateUtils*.ts` files are removed.

---

## Constraints and merge notes

- **`baseClasses` merged (done):** [`lambda/ephemera/dataSource/renderCache/baseClasses.ts`](../../../../lambda/ephemera/dataSource/renderCache/baseClasses.ts) holds **domain / Dynamo** record types and **outbound** bus payload types in one file (domain section first).
- **Mark-state helpers (done):** [`lambda/ephemera/dataSource/renderCache/utils/markState.ts`](../../../../lambda/ephemera/dataSource/renderCache/utils/markState.ts) (`normalizeMarkState`, `markStatesEqual`); tests in [`markState.test.ts`](../../../../lambda/ephemera/dataSource/renderCache/utils/markState.test.ts). Imports sibling [`baseClasses`](../../../../lambda/ephemera/dataSource/renderCache/baseClasses.ts) for `EphemeraCacheMarkState`.
- **Documentation (done):** Domain narrative from [`lambda/ephemera/renderCache/AGENT.md`](../../../../lambda/ephemera/renderCache/AGENT.md) **folded** into [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../lambda/ephemera/dataSource/renderCache/AGENT.md); the old path is a **redirect stub**. Cross-links updated (orchestration, caching plan, perception vertical index, assets, internalCache examples).
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
- [X] **Fold documentation:** merged [`lambda/ephemera/renderCache/AGENT.md`](../../../../lambda/ephemera/renderCache/AGENT.md) into [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../lambda/ephemera/dataSource/renderCache/AGENT.md); [`lambda/ephemera/renderCache/AGENT.md`](../../../../lambda/ephemera/renderCache/AGENT.md) is a redirect stub. Cross-links updated (planning docs, vertical index, orchestration docs, assets, internalCache examples).
- [ ] **Remove the deprecated package directory** (or leave only a minimal pointer file if required for links---prefer updating links and deleting). Ensure no remaining `from '.../lambda/ephemera/renderCache'` imports except any intentional stub.
- [ ] **Update Recommended order checkboxes** in this document to match reality; then **archive or delete** this task plan per [`taskPlanning/AGENT.md`](../../../AGENT.md).

---

## Verification

- **Compile / tests:** From [`lambda/ephemera/`](../../../../lambda/ephemera/): `npm test` (Jest). Run after each major step or at least before merge.
- **Grep hygiene (adjust patterns after renames):**
  - No imports of the **removed** file path `lambda/ephemera/renderCache/baseClasses.ts` in `.ts` sources.
  - No `renderCache/markStateUtils` or `markStateUtils.ts` imports in `.ts` sources; helpers live under `dataSource/renderCache/utils/markState`.
- **Docs:** Grep for stale `lambda/ephemera/renderCache/baseClasses` links in markdown after each step. Prefer [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../lambda/ephemera/dataSource/renderCache/AGENT.md) over the redirect stub for new links.

---

## Progress

| Milestone | Status |
| --- | --- |
| Task plan created | Done |
| Barrel removed; explicit imports | Done |
| Domain `baseClasses` colocated; outbound merge resolved | Done |
| Mark-state helpers colocated under DataSource (`utils/markState`) | Done |
| `AGENT.md` merged; links updated | Done |
| `lambda/ephemera/renderCache/` TS removed / directory cleaned | Not started |
| Tests green; task plan closed | Not started |

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../AGENT.md) | Task planning framework |
| [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../lambda/ephemera/dataSource/renderCache/AGENT.md) | **`mtw.ephemera.renderCache`**; canonical Dynamo schema, `internalCache`, pass-through, orchestration (merged domain + DataSource doc) |
| [`lambda/ephemera/dataSource/renderCache/utils/markState.ts`](../../../../lambda/ephemera/dataSource/renderCache/utils/markState.ts) | Mark-state normalization and equality (`normalizeMarkState`, `markStatesEqual`) |
| [`lambda/ephemera/renderCache/AGENT.md`](../../../../lambda/ephemera/renderCache/AGENT.md) | Redirect stub to the DataSource `AGENT.md` |
| [`taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md`](../dataSource/AGENT.passThrough.contract.planning.md) | Pass-through contract (optional) |
