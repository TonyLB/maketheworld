# `internalCache.RenderCache` write-through alignment plan

**Status:** Refactor landed; verify in CI and retire this plan when the slice is accepted.  
**Next step:** Archive or delete this task plan after merge (see [`taskPlanning/AGENT.md`](../../../../../AGENT.md)).

## Purpose

Align `lambda/ephemera/internalCache/renderCache.ts` with the internalCache write-through style used by `ExamplesData`: deferred read-through loading, deterministic in-process write updates, and explicit cache lifecycle methods. The goal is consistency and correctness, not framework extraction.

## Scope and non-goals

- **In scope**
  - Refactor `RenderCacheData` internals toward `DeferredCache`-backed read-through behavior.
  - Preserve existing domain API surface (`get`, `set`, `deleteCacheRecords`, `getExactMatch`, `clear`), unless a deliberate, documented API change is approved.
  - Add or adjust tests to encode the runtime contract.
- **Out of scope**
  - Creating a new shared base class/mixin for write-through semantics.
  - Broad dataSource or stream contract changes outside `internalCache.RenderCache`.
  - Architectural consolidation across all lambda internal caches.

## Getting started

1. **Read task-planning rules first**
   - Review [`taskPlanning/AGENT.md`](../../../../../AGENT.md).
   - Why: this file must stay process-oriented, include progress/verification, and be disposable after the task ships.

2. **Read internalCache pattern references**
   - [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../../../../../../packages/mtw-lambda-patterns/ts/internalCache/AGENT.md)
   - [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.implementation.md`](../../../../../../packages/mtw-lambda-patterns/ts/internalCache/AGENT.implementation.md)
   - Why: these define the intended DeferredCache-based norms we are aligning to.

3. **Read local ephemera cache references**
   - [`lambda/ephemera/internalCache/AGENT.md`](../../../../../../lambda/ephemera/internalCache/AGENT.md)
   - [`lambda/ephemera/internalCache/examples.AGENT.md`](../../../../../../lambda/ephemera/internalCache/examples.AGENT.md)
   - [`lambda/ephemera/internalCache/examples.ts`](../../../../../../lambda/ephemera/internalCache/examples.ts)
   - Why: `ExamplesData` is the nearest in-repo expression of required write-through behavior.

4. **Read the code being changed**
   - [`lambda/ephemera/internalCache/renderCache.ts`](../../../../../../lambda/ephemera/internalCache/renderCache.ts)
   - [`lambda/ephemera/internalCache/index.ts`](../../../../../../lambda/ephemera/internalCache/index.ts)
   - Why: confirm current behavior, constructor wiring, and lifecycle integration.

5. **Read upstream data-domain boundary**
   - [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../../../lambda/ephemera/dataSource/renderCache/AGENT.md)
   - [`lambda/ephemera/dataSource/renderCache/queryCacheRecordsForComponent.ts`](../../../../../../lambda/ephemera/dataSource/renderCache/queryCacheRecordsForComponent.ts)
   - Why: keep the injected read boundary intact while refactoring cache internals.

6. **Review current tests and add contract expectations before/with refactor**
   - [`lambda/ephemera/internalCache/renderCache.test.ts`](../../../../../../lambda/ephemera/internalCache/renderCache.test.ts)
   - Why: runtime contract should be encoded in tests, not only prose.

7. **Use ephemera test commands from area docs**
   - [`lambda/ephemera/AGENT.testing.md`](../../../../../../lambda/ephemera/AGENT.testing.md)
   - Why: this package uses Jest with `npm run test ...` conventions.

## Decisions to lock during implementation

- [X] `set()` before first `get(componentId)`: make this an authoritative write entrypoint (accept writes before first `get` by initializing cache state as needed).
  - Use `ExamplesData` (`lambda/ephemera/internalCache/examples.ts`) as the in-repo precedent for successful authoritative write behavior.
  - Preserve `RenderCacheData` domain semantics while adopting this contract.
- [X] `flush()` support: add for lifecycle consistency.
- [X] `invalidate(componentId)`: include now for lifecycle consistency.
- [X] Concurrency contract: overlapping `get(componentId)` calls must dedupe to one query.
  - Implement via `DeferredCache` keying on `componentId`.
  - Verify with a focused test asserting one query invocation under concurrent `get` calls.

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines as `[X]` as each sub-step completes.

- [X] Baseline and contract capture
- [X] Add/adjust tests that express target behavior:
  - [X] deduped concurrent `get(componentId)` (active in `renderCache.test.ts`)
  - [X] read-through + post-read write-through mutation visibility
  - [X] `set`/`deleteCacheRecords` semantics for missing and loaded component rows (`set`-before-`get` authoritative)
  - [X] `getExactMatch` behavior unchanged across refactor
- [X] Refactor `RenderCacheData` internals toward DeferredCache-backed loading while preserving public API
- [X] Integrate lifecycle behavior
  - [X] decide and implement `flush()` and/or `invalidate()` behavior
  - [X] update `InternalCache.flush()` if `RenderCache` has async pending work to drain
- [X] Run focused tests and fix regressions
- [X] Post-refactor test cleanup
  - [X] unskip target-contract tests once implementation behavior lands
  - [X] collapse transitional contract buckets in `renderCache.test.ts` (rename/merge `currentContract` and `targetContractAuthoritativeWrite` into one active contract section)
- [X] Update docs as needed
  - [X] update `lambda/ephemera/internalCache/AGENT.md` if behavior expectations changed
  - [X] keep this task plan progress/checklist current

## Verification

Run from `lambda/ephemera/` unless documented otherwise.

- Contract-focused test file:
  - `npm run test internalCache/renderCache.test.ts -- --watchAll=false`
- Optional nearby regression checks:
  - `npm run test internalCache/componentRender.test.ts -- --watchAll=false`
  - `npm run test internalCache/examples.test.ts -- --watchAll=false`
- Quick static checks for callsite/API drift:
  - `rg "RenderCache\\.(get|set|getExactMatch|deleteCacheRecords|clear|flush|invalidate)" lambda/ephemera`

## Test activation strategy (progressive activation)

- During the "Add/adjust tests" phase, land target-contract tests early even when implementation is not complete.
- Keep behavior-delta cases (`set` on missing component row, strict concurrent dedupe if currently failing) as `it.skip` or `it.todo` with a short reason string (for example: `until authoritative write refactor lands`).
- Keep regression guards that already match current behavior active (especially `getExactMatch` and existing post-read mutation semantics).
- Unskip/activate target-contract tests as part of the refactor step so CI transitions from "documented intent" to "enforced behavior" without losing visibility.
- After activation, remove transitional structure debt in the same phase: merge/rename temporary contract buckets so test organization reflects steady-state behavior instead of migration staging.

## Baseline and contract capture (2026-04-08)

- Baseline command run from `lambda/ephemera/`:
  - `npm run test -- internalCache/renderCache.test.ts --watchAll=false`
- Result: pass (`1` suite, `12` tests).
- Contract encoded in tests after refactor:
  - `get(componentId)` memoizes per component, dedupes overlapping loads, returns stable array reference within invocation.
  - `set` before first `get(componentId)` is authoritative (initializes cache state; primed rows skip Dynamo until `invalidate`/`clear`).
  - `set` updates or appends by `cacheId` when valid; invalid `cacheId` prefix is a no-op.
  - `set` without `cacheId` matches by mark-state equality, otherwise appends with generated `CACHE#...`.
  - `getExactMatch` preserves perspective + mark-state filtering semantics and memoized read behavior.

## Progress

| Milestone | Status |
| --- | --- |
| Plan created with scope, order, and verification | Done |
| Behavior decisions finalized | Done |
| Contract tests aligned with target semantics | Done |
| Refactor implemented | Done |
| Verification green | Done (focused Jest: `renderCache`, `componentRender`, `examples`) |
| Task completed and plan retired/archived | Pending human archive/delete after merge |

Progress note: `renderCache.test.ts` uses a single `contract` describe block; authoritative `set` before first `get` and overlapping-`get` dedupe are active tests.

