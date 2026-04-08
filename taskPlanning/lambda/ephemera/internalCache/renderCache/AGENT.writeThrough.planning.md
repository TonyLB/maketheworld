# `internalCache.RenderCache` write-through alignment plan

**Status:** In progress.  
**Next step:** Finalize behavior decisions, then refactor `RenderCacheData` to align with `ExamplesData`-style write-through semantics without introducing a shared abstraction.

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

- [ ] Baseline and contract capture
- [ ] Add/adjust tests that express target behavior:
  - [ ] deduped concurrent `get(componentId)`
  - [ ] read-through + post-read write-through mutation visibility
  - [ ] `set`/`deleteCacheRecords` semantics for missing and loaded component rows
  - [ ] `getExactMatch` behavior unchanged across refactor
- [ ] Refactor `RenderCacheData` internals toward DeferredCache-backed loading while preserving public API
- [ ] Integrate lifecycle behavior
  - [ ] decide and implement `flush()` and/or `invalidate()` behavior
  - [ ] update `InternalCache.flush()` if `RenderCache` has async pending work to drain
- [ ] Run focused tests and fix regressions
- [ ] Update docs as needed
  - [ ] update `lambda/ephemera/internalCache/AGENT.md` if behavior expectations changed
  - [ ] keep this task plan progress/checklist current

## Verification

Run from `lambda/ephemera/` unless documented otherwise.

- Contract-focused test file:
  - `npm run test internalCache/renderCache.test.ts -- --watchAll=false`
- Optional nearby regression checks:
  - `npm run test internalCache/componentRender.test.ts -- --watchAll=false`
  - `npm run test internalCache/examples.test.ts -- --watchAll=false`
- Quick static checks for callsite/API drift:
  - `rg "RenderCache\\.(get|set|getExactMatch|deleteCacheRecords|clear|flush|invalidate)" lambda/ephemera`

## Progress

| Milestone | Status |
| --- | --- |
| Plan created with scope, order, and verification | Done |
| Behavior decisions finalized | Not started |
| Contract tests aligned with target semantics | Not started |
| Refactor implemented | Not started |
| Verification green | Not started |
| Task completed and plan retired/archived | Not started |

