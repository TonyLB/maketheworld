# Shareable cached gateways (`packages/mtw-gateways`) - planning

**Status:** In progress (Phase A complete: package scaffolded, `AGENT.md` authored). **In scope:** Define a **maintainability-focused** package layout for **read-only, shareable gateway code** (query helpers, key builders, optional `DeferredCache` factories) used by **multiple lambdas** that read the same Dynamo projections; prototype with **component asset meta** reads. **Out of scope:** Cross-lambda synchronization of `internalCache` instances (explicitly non-goal). **Next:** Extract Component Asset Meta read logic into the package and refactor [`lambda/ephemera/internalCache/componentAssetMeta.ts`](../../../lambda/ephemera/internalCache/componentAssetMeta.ts) to consume it.

This document follows [`taskPlanning/AGENT.md`](../../AGENT.md) (durability, what belongs here vs package docs). **Dispose** after the initiative ships and lasting guidance lives under [`packages/mtw-gateways/`](../../../packages/mtw-gateways/) (or adjacent `AGENT.md` files).

---

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../AGENT.md) once for task-plan conventions (checkboxes, verification, recommended order intro line).
2. Read **existing gateway behavior** to extract (prototype):
   - [`lambda/ephemera/internalCache/componentAssetMeta.ts`](../../../lambda/ephemera/internalCache/componentAssetMeta.ts)
   - [`lambda/ephemera/internalCache/componentAssetMeta.AGENT.md`](../../../lambda/ephemera/internalCache/componentAssetMeta.AGENT.md)
   - **Sibling pattern (assets lambda, not identical API):** [`lambda/assets/internalCache/componentData.ts`](../../../lambda/assets/internalCache/componentData.ts) --- see [Relationship to assets ComponentData](#relationship-to-assets-componentdata-document-in-package).
3. Read **internal cache patterns** (shared infrastructure, not lambda-specific):
   - [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/internalCache/AGENT.md)
4. Read **cross-lambda read context** (ephemera already reads `assetDB`):
   - [`lambda/ephemera/internalCache/AGENT.md`](../../../lambda/ephemera/internalCache/AGENT.md) (overview + integration notes)
5. Read **authoritative assets / verticals** for ownership boundaries (writers stay in assets lambda; gateways are read helpers only):
   - [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md)
6. **Command authority:** When this plan adds tests under `packages/mtw-gateways`, follow the repo root or package test conventions once the package exists; record **exact** cwd and runner in **Verification** below. If commands conflict, prefer any future [`packages/mtw-gateways/AGENT.development.md`](../../../packages/mtw-gateways/AGENT.development.md) once added.
7. **Baseline (before package edits):** N/A until `packages/mtw-gateways` is scaffolded; then add one baseline test command that should pass before refactors.

---

## Goal

Introduce **`packages/mtw-gateways`** (name TBD but used here for planning) as the **shared home for read-side code** that multiple lambdas import when they need **on-demand, read-only** access to materialized data in Dynamo (same tables the owning DataSources write).

**Problem addressed:** a **maintainability** gap, not a functional one. Each lambda keeps its own **`internalCache` singleton** per invocation (by design). Today, **duplicated query logic** and **key conventions** risk drifting when a second lambda (e.g. ephemera) reads the same projection the assets lambda maintains (e.g. `mtw.assets.components.verticals`). Centralizing **read helpers and types** makes gateways a **deliberate abstraction** without pretending caches are shared across processes.

**Explicit non-goals:**

- **No** cross-lambda cache coherence or RPC between lambdas for reads.
- **No** moving DataSource **write** paths into this package (ownership stays with the authoritative lambda / DataSource).
- **No** replacing durable **package / area** `AGENT.md` docs; this task plan links out and defers steady-state architecture there.

---

## Proposed package shape

High-level layout (illustrative; adjust names during implementation):

```text
packages/mtw-gateways/
  package.json
  tsconfig.json
  AGENT.md                          # ownership matrix + how to add a gateway
  assets/
    components/
      assetMeta/                    # prototype: ComponentAssetMeta read helpers
        index.ts                    # or split queries vs cache factory
        ...
```

**Contents that belong here:**

- **Pure read helpers:** Dynamo query/`GetItem`/`BatchGetItem` compositions, stable projection types.
- **Key / prefix builders:** e.g. align with [`Meta::Import::...`](../../../lambda/assets/dataSource/components/verticals/AGENT.md) encoding when a read path is shared.
- **Optional factory:** `createComponentAssetMetaGateway(deps)` returning an object with `get`, `getAcrossAssets`, etc., where **deps** inject `assetDB` (or a narrow interface) so each lambda wires once.

**Contents that stay in each lambda:**

- **`InternalCache` class** construction, **`clear()`** / **`flush()`** orchestration, and **which** gateway instances are exposed on the singleton.

**Navigability (reduce co-location confusion):**

- **`packages/mtw-gateways/AGENT.md`:** For each gateway, document **authoritative writer** (`dataSourceKey` + path under `lambda/...`).
- **Optional re-export barrels** next to the owning DataSource (e.g. `lambda/assets/.../readModel.ts` re-exporting from `@tonylb/mtw-gateways/...`) so grep from the DataSource folder still finds the read surface.

---

## Prototype: Component Asset Meta

**Candidate first extraction:** logic currently embodied in ephemera [`ComponentAssetMetaData`](../../../lambda/ephemera/internalCache/componentAssetMeta.ts) (class name may remain in lambda as a thin wrapper).

**Rationale:** It is already a **read-through cache over `assetDB`**, used heavily by ephemera rendering and merge paths; assets lambda or future readers may reuse the same **query and cache-key conventions** without copying files.

**Prototype success criteria:**

- [ ] New package builds and tests pass in isolation.
- [ ] Ephemera **`internalCache`** uses the shared module for the core fetch/key behavior (lambda keeps **`ComponentAssetMetaData`** name if desired as a thin adapter).
- [ ] **No behavior change** in production paths (tests lock this down).
- [ ] `packages/mtw-gateways/AGENT.md` lists **writers / readers** for the prototype **and** includes the ephemera-vs-assets component-read note described under [Relationship to assets ComponentData](#relationship-to-assets-componentdata-document-in-package).

**Follow-on gateways (not required for prototype closure):**

- **Import vertical / `Meta::Import::...`** reads: shared query helpers next to [`importVerticalKeys.ts`](../../../lambda/assets/dataSource/components/verticals/importVerticalKeys.ts) conventions once ephemera or another lambda needs on-demand vertical lookups.

### Relationship to assets ComponentData (document in package)

The assets lambda does **not** define a class named `ComponentAssetMeta`. It already has **[`ComponentData`](../../../lambda/assets/internalCache/componentData.ts)** on **`internalCache`**, which reads the **same underlying `assetDB` rows** (universal component id as partition, NDJSON lines keyed by asset) but with a **different access pattern** than ephemera **`ComponentAssetMeta`**:

| | **Ephemera `ComponentAssetMeta`** | **Assets `ComponentData`** |
| --- | --- | --- |
| **Primary use** | Merge / render paths over an **explicit asset stack**; per **`assetId::EphemeraId`** cache keys; **`getItems`** for chosen assets; **`getAcrossAllAssets`** via **`Meta::Room`** (etc.) **`cached`** lists | Authoring-side **enumerate all assets** that contain a component: **`query`** the full partition, build **`byAssets`** |
| **Overlap** | Same Dynamo component projections; both end up running **`standardComponentFactory`** on row shapes | Same |

Pulling ephemera **`ComponentAssetMeta`** into **`mtw-gateways`** will likely **surface follow-on work** (optional, not blocking the prototype):

- **Shared low-level helpers** (row normalization, batch key construction) used by **both** readers without merging their **cache strategies** in v1.
- **Deliberate non-goal for first ship:** replacing **`ComponentData`** with the ephemera gateway wrapper or collapsing the two into one cache entry --- document why they differ so future contributors do not "dedupe" them blindly.

**Deliverable for this prototype:** The **`packages/mtw-gateways/AGENT.md`** written during implementation must include a short **"Component asset reads: ephemera vs assets"** note (or equivalent section title) capturing the above distinction and linking to **`componentAssetMeta`** and **`componentData`**. That satisfies **lasting** documentation per [`taskPlanning/AGENT.md`](../../AGENT.md); this task plan does not duplicate the full text once the package doc exists.

---

## Progress

| Phase | Description | Status |
| --- | --- | --- |
| A | Scaffold `packages/mtw-gateways`, tooling, `AGENT.md` | Done |
| B | Extract Component Asset Meta read logic; ephemera wires shared gateway | Not started |
| C | Verification commands documented; checkboxes updated | In progress (Phase A baseline recorded; Phase B verification pending) |

---

## Recommended order

Use `[ ]` for pending work and `[X]` for completed work. Mark nested lines `[X]` as you complete them. Session work is done when tests pass **and** matching lines here are updated.

- [X] Add **`packages/mtw-gateways`** package scaffold (package.json, tsconfig, test runner aligned with monorepo).
- [X] Author **`packages/mtw-gateways/AGENT.md`**: purpose, non-goals, ownership table pattern, link to this task plan until closed, plus **ephemera vs assets component-read** nuance per [Relationship to assets ComponentData](#relationship-to-assets-componentdata-document-in-package).
- [ ] Create **`assets/components/assetMeta/`** (or agreed path) and move **pure** read/query + optional **`DeferredCache` factory** from ephemera `componentAssetMeta` implementation.
- [ ] Refactor **`lambda/ephemera/internalCache/componentAssetMeta.ts`** to consume the shared module; keep **per-invocation** `internalCache` wiring unchanged from callers' perspective.
- [ ] Add or extend **unit tests** in the package for key helpers and query shaping; keep ephemera integration tests passing.
- [ ] Optional: **re-export** entry under `lambda/ephemera/internalCache/` or assets for discoverability (document in package `AGENT.md`).
- [ ] Fill **Verification** below with exact commands used; run them after changes.
- [ ] Update **Progress** table and mark this plan **[done]** in **Status** when shipped; migrate lasting notes to package `AGENT.md` and **dispose** this file per [`taskPlanning/AGENT.md`](../../AGENT.md).

---

## Verification

Commands recorded as the package is built up. Update each entry the first time it is run for real, and re-run when the relevant phase changes.

### Phase A (scaffold + `AGENT.md`)

Package conventions copied from [`packages/mtw-sessions`](../../../packages/mtw-sessions/) (Jest 28 + ts-jest ESM preset, composite TS project ref). Empty package; no tests yet.

- **Repo-root project graph build:** `cd <repo root> && npx tsc --build` --- exits **0**; the new `packages/mtw-gateways/tsconfig.ref.json` reference is wired into the root [`tsconfig.json`](../../../tsconfig.json) and produces `packages/mtw-gateways/dist/index.{js,d.ts,*.map}`.
- **Per-package build (alternate):** `cd <repo root> && npx tsc --build packages/mtw-gateways/tsconfig.ref.json` --- exits **0**.
- **Per-package Jest:** `cd packages/mtw-gateways && npm test` --- exits **1** with the expected `No tests found, exiting with code 1` message. This is the documented baseline for the empty package; **Phase B** replaces this with a passing run when the first test lands. (We did not add `--passWithNoTests`, to keep parity with sibling packages and to make Phase B's first green run an explicit signal.)

### Phase B (Component Asset Meta extraction; ephemera wires shared gateway)

Pending. To be filled in when Phase B runs. Expected commands:

- **Package unit tests:** `cd packages/mtw-gateways && npm test` --- expected to pass once gateway tests are added.
- **Ephemera regression:** `cd lambda/ephemera && npm test -- --testPathPattern internalCache/componentAssetMeta` (confirm exact pattern and runner against [`lambda/ephemera/package.json`](../../../lambda/ephemera/package.json) when the slice runs).

---

## When the task finishes

1. Move **lasting** gateway conventions into [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) (including the **ephemera vs assets** component-read distinction); update [`lambda/ephemera/internalCache/componentAssetMeta.AGENT.md`](../../../lambda/ephemera/internalCache/componentAssetMeta.AGENT.md) to point at shared types/helpers where appropriate. Optionally add a one-line pointer from [`lambda/assets/internalCache/componentData.ts`](../../../lambda/assets/internalCache/componentData.ts) header comment or nearest assets `AGENT.md` if that improves discoverability.
2. Archive or delete this planning file per [`taskPlanning/AGENT.md`](../../AGENT.md).
