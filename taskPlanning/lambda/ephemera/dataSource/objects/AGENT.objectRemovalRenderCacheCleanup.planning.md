# Object removal leaves orphaned render-cache rows

**Status:** Shipped 2026-08-03. Single-slice bug fix, found while smoke-testing Coyote `AwaitRoadrunner` after [`AGENT.objectCharacterRenderHosts.planning.md`](../actions/AGENT.objectCharacterRenderHosts.planning.md) shipped (that iteration is complete and closed; this is a new, unrelated gap it exposed, not a reopening of it). This file is a deletion candidate per [`taskPlanning/AGENT.md`](../../../../AGENT.md#when-the-task-finishes) once confirmed durable.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

When an improvisation `OBJECT#` is destroyed (Coyote `AwaitRoadrunner` clear, room-scoped `remove`, or orphan-finding repair), its render-cache rows in the ephemera table are never deleted. The object is gone from the position graph and from `(OBJECT#, ASSET#IMPROVISATION)`/`Meta::Object`/`EMBEDDING#IMPROMPTU`, but its `CACHE#...` rows, `Cache::${perspectiveKey}` catalog row(s), and any `Link::${host}::Cache::${perspectiveKey}` adjacency rows under the relevant `SITUATION#` partition all persist indefinitely as orphans.

**Root cause:** `persistDeleteImprovisationObject` ([`persistImprovisationObject.ts:321`](../../../../../lambda/ephemera/dataSource/objects/persistImprovisationObject.ts#L321)) only issues the three `Delete` items `deleteTransactItemsForObject` builds --- pair, `Meta::Object`, `EMBEDDING#IMPROMPTU` ([persistImprovisationObject.ts:113-132](../../../../../lambda/ephemera/dataSource/objects/persistImprovisationObject.ts#L113-L132)). This is a documented normative decision in [`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md#normative-decisions-summary) ("Delete transact: Always 3 unconditional Delete items") --- render-cache rows were never in scope for it, because Object had no real render-cache footprint until [`AGENT.objectCharacterRenderHosts.planning.md`](../actions/AGENT.objectCharacterRenderHosts.planning.md) gave it one. The doc is accurate to what was built; it just describes a contract that predates Object becoming a render-cache host.

Separately, the render-cache `Delete Cache Records` command (`sendDeleteCacheRecords`, [`apiEphemera.ts:229`](../../../../../lambda/ephemera/dataSource/apiEphemera.ts#L229)) --- the mechanism that exists precisely to remove `CACHE#` rows --- has **no production callers** at all today (confirmed by grep across `lambda/ephemera`); it's only exercised by its own DataSource-side handler in tests. This is not a second bug, just confirmation that host-level render-cache teardown has never been wired for any host kind, Object included.

**Three call sites converge on the same root function**, so fixing `persistDeleteImprovisationObject` once closes the gap everywhere:
- [`clearCoyoteGameImprovisationObjects.ts`](../../../../../lambda/ephemera/dataSource/objects/clearCoyoteGameImprovisationObjects.ts) --- Coyote `AwaitRoadrunner` bulk clear (the case that surfaced this).
- [`applyObjectsChange.ts`](../../../../../lambda/ephemera/dataSource/objects/applyObjectsChange.ts) --- room-scoped `Objects Change` `remove`.
- [`handleOrphanedImprovisedObjectFinding.ts`](../../../../../lambda/ephemera/dataSource/objects/handleOrphanedImprovisedObjectFinding.ts) --- diagnostics orphan-finding repair.

## Design decisions (confirmed through conversation, 2026-08-03)

- **Fix at the choke point, not the call sites.** All three callers already funnel through `persistDeleteImprovisationObject`; the render-cache cleanup belongs inside it (or in a helper it calls), not duplicated three times.
- **Route the actual Dynamo delete through `mtw.ephemera.renderCache`, not a direct `deleteCacheRecord` call from `objects/`.** [`renderCache/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderCache/AGENT.md) states plainly: "Orchestration and policy must not call Dynamo or cache persistence helpers directly. Route writes through `mtw.ephemera.renderCache`." `objects/` already bypasses this for its *own* rows (pair/meta/embedding, which it owns), but render-cache rows belong to a different DataSource. Use `sendDeleteCacheRecords` on the message bus, the existing (currently unused) command built for exactly this.
- **Enumerating which rows to delete is a read, not a write** --- querying `CACHE#`/`Cache::` rows for a componentId (`queryCacheRowsForComponent`/`queryCatalogRowsForComponent` in `mtw-gateways`) is fine to call from `objects/` directly, same as any other read; only the delete needs to go through the DataSource.

## Open decisions (implementation --- plan only)

None open --- all three decided through conversation 2026-08-03.

- **OD-1, Decided: generalize into `Delete Cache Records`.** Adjacency (`Link::${host}::Cache::${perspectiveKey}`) cleanup lands *inside* the `Delete Cache Records` handler in [`renderCache/index.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts), mirroring [`hydrateAuthoredCatalogDiff.ts`](../../../../../lambda/ephemera/dataSource/renderCache/hydrateAuthoredCatalogDiff.ts)'s existing per-row `situationId` -> `deleteAdjacencyForRemovedSlice` pattern. Any future caller of `Delete Cache Records` inherits correct adjacency cleanup, not just this one.
- **OD-2, Decided: keep the command's wire shape unchanged; handler re-derives `situationId`.** `DeleteCacheRecordsCommand` stays `{ componentId, dataCategories: string[] }`. The handler re-queries the component's rows (`queryCacheRowsForComponent`) before deleting, filters to the rows matching `cmd.dataCategories`, and reads `situationId` off each match --- same source of truth `hydrateAuthoredCatalogDiff.ts` already reads from, no new field on the command for one caller's convenience.
- **OD-3, Decided: decoupled, non-atomic cleanup; no compensating-failure story.** Object-row delete (`transactWrite`) stays authoritative and unchanged. Render-cache cleanup dispatches as a separate, best-effort follow-up call in the same function, tolerant of retry (`deleteCacheRecord` is already idempotent). No S1-style compensation needed: a stray cache row is inert (never re-attached to a live object), unlike a stray placement.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read [`renderCache/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderCache/AGENT.md) --- especially the **Authored cache (invalidate + hydrate)** section, the persistence-primitives table, and the "Orchestration and policy must not call Dynamo..." rule.
3. Read [`hydrateAuthoredCatalogDiff.ts`](../../../../../lambda/ephemera/dataSource/renderCache/hydrateAuthoredCatalogDiff.ts) --- the existing model for "delete a `CACHE#` row and its adjacency link together," which OD-1 proposes generalizing.
4. Read [`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md) --- especially **Normative decisions (summary)**'s "Delete transact" row (the doc this fix will need to amend) and the **Diagnostics repair (orphan finding)** section (a second call site that must also benefit).
5. Read [`persistImprovisationObject.ts`](../../../../../lambda/ephemera/dataSource/objects/persistImprovisationObject.ts)'s `persistDeleteImprovisationObject`/`deleteTransactItemsForObject`, and its three callers listed in Purpose above.
6. Read [`fetch.ts`](../../../../../packages/mtw-gateways/ts/ephemera/renderCache/fetch.ts) (`queryCacheRowsForComponent`, `queryCatalogRowsForComponent`) and [`situationAdjacency.ts`](../../../../../lambda/ephemera/dataSource/renderCache/situationAdjacency.ts) (`deleteAdjacencyForRemovedSlice`).
7. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md).
8. Baseline (should pass before edits):

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/objects/ dataSource/renderCache/
```

## Recommended order

Use `[ ]` for pending and `[X]` for complete; mark nested lines as each sub-step lands. All steps below shipped 2026-08-03.

- [X] **Step 1. Read-only enumeration helper.** Added [`queryAllRenderCacheDataCategoriesForComponent.ts`](../../../../../lambda/ephemera/dataSource/renderCache/queryAllRenderCacheDataCategoriesForComponent.ts), wrapping `mtw-gateways`' `queryCacheRowsForComponent` + `queryCatalogRowsForComponent` to return every `CACHE#`/`Cache::` `DataCategory` for a componentId.
- [X] **Step 2. Generalize adjacency cleanup into `Delete Cache Records`.** Added [`cleanupSituationAdjacencyForDeletedRecords.ts`](../../../../../lambda/ephemera/dataSource/renderCache/cleanupSituationAdjacencyForDeletedRecords.ts) and wired it into [`renderCache/index.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts)'s `Delete Cache Records` branch, ahead of the row deletes. Per OD-2, it re-queries via `internalCache.RenderCache.getCacheRows`/`getCatalogRows` (not raw Dynamo) rather than widening the command, restricts to rows matching `cmd.dataCategories`, and takes the Cartesian product of the resulting situationIds x perspectiveKeys --- correct for full-host teardown (today's only real caller); noted as a documented limitation for a hypothetical future partial-delete caller spanning multiple perspectives in one call, since `CACHE#` rows don't carry `perspectiveKey` directly.
- [X] **Step 3. Wire `persistDeleteImprovisationObject`.** After the existing 3-item `transactWrite` succeeds, calls Step 1's helper and, when non-empty, dispatches `sendDeleteCacheRecords` (message bus) via new `messageBus`/`queryRenderCacheDataCategories` deps on `PersistImprovisationObjectDependencies` (both default to the real implementations, so the three call sites needed no changes). Per OD-3, wrapped in its own try/catch --- a cleanup failure is `console.error`-logged but does not fail the object delete.
- [X] **Step 4. Tests.**
  - [X] Unit test for Step 1's enumeration helper ([`queryAllRenderCacheDataCategoriesForComponent.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/queryAllRenderCacheDataCategoriesForComponent.test.ts)): both prefixes returned, empty when host never hydrated.
  - [X] Unit test for Step 2's generalized adjacency cleanup ([`cleanupSituationAdjacencyForDeletedRecords.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/cleanupSituationAdjacencyForDeletedRecords.test.ts)), plus an assertion added to the existing `Delete Cache Records` test in [`index.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.test.ts) confirming it's invoked with the right args.
  - [X] **Deviation from the original plan:** a true Dynamo-row-level payoff test (seed real rows, delete, assert zero remain) was not built --- this repo has no in-memory/dynalite Dynamo harness anywhere (`grep` for one came up empty); every existing test in this area, including `hydrateAuthoredCatalogDiff.test.ts`, mocks at the module boundary instead. Built the equivalent at that same level: three new tests in [`persistImprovisationObject.test.ts`](../../../../../lambda/ephemera/dataSource/objects/persistImprovisationObject.test.ts) assert the exact `Delete Cache Records` command dispatched (componentId + dataCategories) when render-cache rows exist, that nothing dispatches when they don't, and that a query failure is swallowed without failing the delete. Building real Dynamo-row-level integration infra was judged out of scope for this bug fix.
- [X] **Step 5. Update durable docs.**
  - [X] [`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md) --- amended the "Delete transact" invariant and added a "Delete render-cache cleanup" normative-decisions row, a new **Render-cache cleanup (on delete)** subsection, and touched-up "Coyote bulk clear" / "Diagnostics repair" prose to note render-cache rows are cleaned up alongside the three existing `Delete` items.
  - [X] [`renderCache/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderCache/AGENT.md) --- documented the generalized adjacency cleanup on `Delete Cache Records` and its first production caller, plus the two new modules in the file-list intro and Package test table.
  - [X] This plan's own **Recommended order** checkboxes and **Progress** table, and its **Open decisions** table --- this edit.

## Verification

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/objects/ dataSource/renderCache/
cd lambda/ephemera && npx tsc --noEmit
```

Plus end-to-end: spawn a Coyote improvisation object, `look` at it (materializes `CACHE#`/`Cache::` rows), trigger `AwaitRoadrunner`, then confirm via a direct table read (or a diagnostics query) that no `CACHE#`/`Cache::`/`Link::` rows remain for that object's id.

## Progress

| Milestone | Status |
| --- | --- |
| Scope + design confirmed through conversation | Done (2026-08-03) |
| Step 1 (enumeration helper) | Done (2026-08-03) |
| Step 2 (generalized adjacency cleanup) | Done (2026-08-03) |
| Step 3 (wire `persistDeleteImprovisationObject`) | Done (2026-08-03) |
| Step 4 (tests) | Done (2026-08-03), with one noted deviation (unit-level payoff test, not Dynamo-row-level integration) |
| Step 5 (durable docs) | Done (2026-08-03) |
