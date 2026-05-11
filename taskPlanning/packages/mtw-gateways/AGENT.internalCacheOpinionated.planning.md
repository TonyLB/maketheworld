# `mtw-gateways`: opinionated `InternalCache` migration - planning

**Status:** Not started. **Goal:** Shift [`packages/mtw-gateways`](../../../packages/mtw-gateways) from **structural loader contracts** (narrow `get(...)` ports, no `InternalCache` types in-package) to **first-class coupling** with [`packages/mtw-lambda-patterns`](../../../packages/mtw-lambda-patterns): gateways become **factories for cache-shaped read surfaces** that lambdas **register** on per-invocation `InternalCache`, with **underlying data dependencies** arriving only through the **same** `InternalCache`-consistent injection story (no parallel "thin wrapper" integration path for package consumers).

This document follows [`taskPlanning/AGENT.md`](../../AGENT.md) (durability, checklists, verification). **Dispose** after the migration ships and lasting norms live in [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) (and related lambda `internalCache` docs).

**Sibling initiative (in flight):** [`taskPlanning/lambda/assets/AGENT.componentAggregate.planning.md`](../../lambda/assets/AGENT.componentAggregate.planning.md) is **roughly halfway through Phase 1**: aggregate **types**, **`assemble.ts`**, **`InternalCache`-slice composition** (`createComponentAggregateGateway`, **`ComponentAggregateInternalCacheSlice`**), package unit tests, and the **`DeferredCache`** **handler** (**`ComponentAggregateMergedCache`** / **`createComponentAggregateCacheHandler`**) in **`mtw-gateways`** are landed; **golden/comparison tests**, **minimal** assets **`InternalCache`** registration of that handler, and **`fetchImportDefaults`** migration are **not**. Older text in that doc may still describe **lambda-owned** `DeferredCache` glue; **reconcile** it when executing the **Sibling task plan** checklist item here. **This migration supersedes** the old split (**contract-only in `mtw-gateways`**, all cache mechanics in lambdas). When this initiative progresses, **update** the component-aggregate plan's **InternalCache composition**, **Recommended order**, and **Progress** rows so they do not contradict the opinionated model (or add an explicit **Superseded by** pointer at the top of that doc).

---

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../AGENT.md) once (durability ladder, Recommended order checkbox rules, verification pattern).
2. Read current gateway norms and aggregate state:
   - [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) (especially **How to add a gateway**, **Projection-read vs compute-only**, **Consistency analyzers: contract vs composition**, **Wrapping gateways in InternalCache**).
   - [`taskPlanning/lambda/assets/AGENT.componentAggregate.planning.md`](../../lambda/assets/AGENT.componentAggregate.planning.md) (what is done vs pending; [**InternalCache composition (Phase 1)**](../../lambda/assets/AGENT.componentAggregate.planning.md#internalcache-composition-phase-1) will change).
3. Read [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/internalCache/AGENT.md) for `DeferredCache` / `InternalCache` mechanics this package will **depend on**.
4. **Command authority:** Gateway package tests and `tsc` per [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md): `cd packages/mtw-gateways && npm test`; from repo root, `npx tsc --build packages/mtw-gateways/tsconfig.ref.json` when touching references.
5. **Baseline (before edits):** Run the commands in **Verification** so a failing baseline is not mistaken for regression.

---

## Goal

**Opinion:** Shared read paths in `mtw-gateways` are **not** a neutral "Dynamo + DTO" layer with optional ad-hoc loaders. They are **common data-access paths expressed in the `InternalCache` pattern**: factories return (or describe) **components** you **drop onto** a lambda's `InternalCache`, and **computed** or **derived** gateways **must** receive underlying reads through **sibling cache entries** (or test doubles that **mimic** that shape), not a second parallel type system.

**Accept coupling:** Add a **runtime** dependency from `@tonylb/mtw-gateways` on `@tonylb/mtw-lambda-patterns` (exact import surface TBD during design: `DeferredCache`, registration helpers, types only, etc.). Verify the **dependency graph stays acyclic** (`mtw-lambda-patterns` must not import `mtw-gateways`).

**Trade explicitly documented in durable docs (not only here):** Callers that want "read Dynamo without mounting `InternalCache`" are **out of scope** for gateway factories; they keep **direct** `assetDB` / lambda-local code outside this package.

**Preserve non-negotiables from existing `AGENT.md`:** Read-only surfaces; no cross-lambda cache coherence; no DataSource writes in this package; authoritative writers stay in `lambda/.../dataSource`.

---

## Scope and sequencing notes

| Area | Migration intent (high level) |
| --- | --- |
| **Package dependency** | Declare `@tonylb/mtw-lambda-patterns` dependency; adjust `tsconfig` / workspace references as required. |
| **Durable docs** | Rewrite [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) sections that forbid `InternalCache` types or stress "structural loaders only"; replace with the opinionated default and any remaining exceptions (e.g. **pure** normalizers that stay importable without cache). |
| **Projection-read trees** (`assetMeta`, `verticals`) | Evolve factories (or add **parallel** `create...InternalCache` exports) so the **blessed** integration path registers `DeferredCache`-backed handlers; keep **pure** `keys` / `fetch` / row normalizers where lambdas still need them without full cache (document as **low-level** escape hatch if retained). |
| **Consistency analyzers** (`ImportVerticalConsistencyAnalyzer`) | Reconcile with opinionated model: either remain **pure** with explicit injection of cache-backed getters, or gain a **factory** that closes over `InternalCache` slices---pick one documented story to avoid two competing patterns. |
| **Aggregate** ([`ts/assets/components/aggregate`](../../../packages/mtw-gateways/ts/assets/components/aggregate)) | **`InternalCache`**-slice-first **`createComponentAggregateGateway`** + **`{ gateway }`** bundle; **`ComponentAggregateMergedCache`** / **`createComponentAggregateCacheHandler`** + **`aggregatePerspectiveCacheKey`** (done). **Next:** lambdas **register** the handler on **`InternalCache`** / **`clear`** / **`flush`**; then align [**component aggregate**](../../lambda/assets/AGENT.componentAggregate.planning.md) (golden tests, assets registration, `fetchImportDefaults`). |
| **Consumers** | Update assets / ephemera / diagnostics wiring and their `internalCache` AGENT files so they use the new factories; adjust tests (package + lambda) to use **cache-shaped** test harnesses where appropriate. |

**Deliberately deferred in this plan's body:** exact API shape (`register(internalCache: InternalCache, ...)` vs returning handler descriptors, naming, and whether **every** gateway gets one factory or split **pure** + **cache** exports). Record decisions in **Progress** or a short **Decision log** subsection as they land.

---

## Relationship to component aggregate initiative

- **Shipped in `mtw-gateways`:** `AggregatePerspective`, merge/result pure helpers, **`createComponentAggregateGateway`** + **`ComponentAggregateInternalCacheSlice`** + **`{ gateway }`** bundle, **`createAggregateGateway(deps)`** (**`AggregateGatewayDeps`**), **`ComponentAggregateMergedCache`** / **`createComponentAggregateCacheHandler`**, **`aggregatePerspectiveCacheKey`**, unit tests with **`InternalCache`**-shaped harnesses.
- **Still open (aggregate + assets):** minimal assets **`InternalCache`** registration + **`clear`/`flush`**, golden/comparison tests, `fetchImportDefaults` migration, Phase 2 DataSource.
- **Impact of this migration:** Remaining aggregate work should **assume** package-owned **`DeferredCache`** orchestration for the **cache-shaped** handler; lambdas **wire** handlers only. Sibling plan prose that forbade **`DeferredCache`** in **`mtw-gateways`** is **obsolete** (see **Sibling task plan** checklist item to scrub stragglers).

---

## Unknowns / risks

- **Dependency cycle:** Confirm `mtw-lambda-patterns` does not depend on `mtw-gateways`; if a cycle appears, split types or move a thin interface package.
- **Diagnostics / non-lambda callers:** May need **minimal** `InternalCache`-shaped test doubles or a documented **non-gateway** read path for tooling.
- **Ephemera vs assets cache keys:** Opinionated factories must still respect **different** cache identities per lambda (see existing ephemera vs assets table in gateway `AGENT.md`); one factory name does not imply one global cache key.
- **Churn:** Touching `ImportVerticalConsistencyAnalyzer` consumers and aggregate tests in one wave may be large; consider ordering: **dependency + AGENT rewrite + one vertical slice** before rewiring all consumers.

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested bullets the same way as you complete them.

- [X] **Design pass:** Choose the **canonical factory return type** (register function vs handler bundle), naming (`create...` vs `register...`), and whether **pure** exports remain alongside cache factories for `keys` / `fetch` / normalizers.
-     - **Decided:** Use a **handler bundle** (not a register function as the primary export).
-     - **Decided:** Name cache factories `create...`.
-     - **Decided:** Keep **pure** exports for inputs/outputs (keys, parsing, normalization, result DTOs), but **do not** export direct DynamoDB fetch helpers as part of the public surface. Dynamo access should be blackboxed inside the cache-backed handler.
- [X] **Dependency:** Add `@tonylb/mtw-lambda-patterns` to [`packages/mtw-gateways/package.json`](../../../packages/mtw-gateways/package.json); fix `tsconfig` / imports; confirm **no** circular dependency.
- [X] **Durable docs:** Update [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) to the opinionated model; remove or replace **contract vs composition** / **no InternalCache types** guidance that conflicts.
- [X] **Aggregate alignment:** Refactor [`packages/mtw-gateways/ts/assets/components/aggregate`](../../../packages/mtw-gateways/ts/assets/components/aggregate) to the new pattern; update [`packages/mtw-gateways/ts/assets/components/aggregate/index.test.ts`](../../../packages/mtw-gateways/ts/assets/components/aggregate/index.test.ts) (and related tests) to use **`InternalCache`**-shaped harnesses or approved doubles.
- [X] **Aggregate cache handler factory (`mtw-gateways`):** Extend [`packages/mtw-gateways/ts/assets/components/aggregate`](../../../packages/mtw-gateways/ts/assets/components/aggregate) so the **blessed** surface exports a **`DeferredCache`**-backed **cache-shaped handler** (or a small **factory** that returns one), built from **`ComponentAggregateInternalCacheSlice`** / sibling loaders, with **`clear`/`flush`/`invalidate`** semantics consistent with [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/internalCache/AGENT.md). **Goal:** lambdas do **not** re-implement aggregate `DeferredCache` orchestration. Add package tests for handler keys / batching / assembly delegation; update [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) when the API lands.
- [ ] **Sibling task plan:** Edit [`taskPlanning/lambda/assets/AGENT.componentAggregate.planning.md`](../../lambda/assets/AGENT.componentAggregate.planning.md) --- scrub remaining stale bullets (**Getting Started**, **Decision points**, grep for "no `DeferredCache`", old **`createAggregateGateway` only** wording) so they match the **handler factory** slice above; keep the **Architecture note** accurate. **Include** the split: **handler factory** lives in **`mtw-gateways`**; lambdas **construct + register** only.
- [ ] **Other gateways / analyzers:** Migrate or document `assetMeta`, `verticals`, and `ImportVerticalConsistencyAnalyzer` integration paths per the single blessed story.
- [ ] **Lambda consumers:** For aggregate (and other migrated gateways): **instantiate** the gateway-supplied **handler factory output** once per invocation, **assign** it on the lambda **`InternalCache`** singleton, and wire **`clear`/`flush`** (and invalidation hooks) per that lambda's playbook; run targeted lambda tests where handlers change. **Do not** hand-roll duplicate **`DeferredCache`** logic for aggregate assembly where the package factory exists.
- [ ] **Close out:** After merge, ensure **Verification** commands still pass; move any lasting process text out of this file; **delete or archive** this plan per [`taskPlanning/AGENT.md`](../../AGENT.md).

---

## Progress

| Milestone | Status |
| --- | --- |
| Design: factory API + pure vs cache export split | Done (handler bundle, `create...`, no exported Dynamo fetch) |
| `mtw-lambda-patterns` dependency + acyclic graph | Done (dependency added + package-level acyclic check) |
| `packages/mtw-gateways/AGENT.md` updated | Done |
| Aggregate module refactored + tests | Done |
| Aggregate `DeferredCache` handler factory in `mtw-gateways` | Done |
| Component aggregate task plan reconciled | Not started |
| `assetMeta` / `verticals` / consistency consumers updated | Not started |
| Lambda `internalCache` wiring + regression tests | Not started |

---

## Verification

Record **exact** cwd + commands as slices land. If commands conflict, follow [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md).

- [X] `cd packages/mtw-gateways && npm test`
- [X] From repo root: `npx tsc --build packages/mtw-gateways/tsconfig.ref.json`
- [ ] After lambda wiring changes: add per-lambda commands here (e.g. assets / ephemera targeted `npm test` patterns) per that lambda's development doc.

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../AGENT.md) | Task plan framework |
| [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) | Gateway package norms (to be revised) |
| [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/internalCache/AGENT.md) | `InternalCache` / `DeferredCache` mechanics |
| [`taskPlanning/lambda/assets/AGENT.componentAggregate.planning.md`](../../lambda/assets/AGENT.componentAggregate.planning.md) | In-flight aggregate initiative; trajectory changes with this migration |

---

## Notes

- Prefer **ASCII punctuation** in edits (project convention).
- Keep **pure** merge / query / normalization helpers **unit-testable** in `mtw-gateways` even when factories couple to `InternalCache`; avoid hiding business logic inside cache glue only.
