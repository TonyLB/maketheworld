# replayAt refactor plan for DataSource snapshots

Status: in progress. Next step: finalize contract shape for replayable snapshots and land framework-first scaffolding with compatibility aliases.

## Scope and intent

This task introduces an explicit replay watermark field (`replayAt`) for replayable DataSources so replay lower-bound logic no longer depends on `createdAt` semantics. Keep this plan process-focused and move lasting architecture notes into package docs when implementation stabilizes.

Before editing, skim:
- [taskPlanning/AGENT.md](../../../../AGENT.md)
- [Root AGENT Getting Started pattern](../../../../../AGENT.md#getting-started-pattern-for-complex-tasks)

## Why this task exists

Current framework behavior can conflate two meanings:
- `createdAt`: when snapshot metadata was generated/cached
- replay watermark: the authoritative state time used as `sinceTimestamp` for replay

For replayable sources that may serve a historical snapshot object while generating a fresh envelope, this can skip replay events and produce stale materialized state on subscribe/reload.

## Non-goals

- No broad redesign of client event ordering. Client continues to order by envelope header timestamps.
- No mandatory rewrite of all DataSources in one PR.
- No immediate removal of `createdAt`; keep compatibility during migration.

## Progress

| Workstream | Status | Notes |
| --- | --- | --- |
| Contract design (`replayAt`) | In progress | Shape agreed conceptually; exact type layering pending |
| Framework implementation | Not started | `initializeSubscription` and snapshot generation/store/load path |
| WML adoption | Not started | `generateWmlSnapshotContent` should provide replay watermark |
| Compatibility + migration | Not started | Alias and fallback behavior for existing snapshots |
| Tests and diagnostics | Not started | Unit/integration updates and targeted instrumentation |
| Follow-up documentation | Not started | Update durable docs, then retire this plan when complete |

## Recommended order

Use `[ ]` for pending items and `[X]` for completed items. If a step has nested bullets, mark each nested line `[X]` when done so partial progress stays visible.

- [X] 1) Lock contract and compatibility behavior
  - [X] Define replay snapshot metadata shape in `packages/mtw-lambda-patterns/ts/dataSource`
  - [X] Decide canonical replay field name (`replayAt` preferred) and fallback precedence
  - [X] Document temporary compatibility rule: replay cursor resolution order (new field first, legacy fallback second)
- [X] 2) Land framework changes in `mtw-lambda-patterns`
  - [X] Update snapshot generation path to carry replay watermark separately from generation timestamp
  - [X] Update replay query lower-bound in `initializeSubscription` to use replay watermark
  - [X] Update snapshot store/load and serializer boundaries so replay watermark persists across cache/store round trips
  - [X] Keep `createdAt` behavior stable for non-replayable and legacy readers
- [ ] 3) Adopt in `mtw.wml`
  - [ ] Update `lambda/wml/dataSource/snapshotContent.ts` to return authoritative replay watermark with sidecar payload
  - [ ] Ensure watermark reflects represented snapshot state (not envelope generation time)
  - [ ] Verify `createSnapshotFirst` and existing manifest fallback behavior still operate correctly
- [ ] 4) Update tests
  - [ ] Add/adjust framework tests in `packages/mtw-lambda-patterns/ts/dataSource/index.test.ts`
  - [ ] Add/adjust WML snapshot tests in `lambda/wml/dataSource/snapshotContent.test.ts`
  - [ ] Add regression test: historical snapshot + replay emits complete current state after subscribe
- [ ] 5) Add focused diagnostics for rollout confidence
  - [ ] Log snapshot replay metadata at subscribe (`createdAt`, `replayAt`, stream key, replay event count)
  - [ ] Log replay window bounds and latest replayed timestamp
  - [ ] Keep logs scoped/sampled to avoid noisy production output
- [ ] 6) Migration and cleanup
  - [ ] Confirm all replayable DataSources compile with compatibility defaults
  - [ ] Update durable docs in package-level `AGENT.md` files where semantics changed
  - [ ] Remove this task-plan when shipped and documented

## Getting started for implementation sessions

1. Read framework files first:
   - `packages/mtw-lambda-patterns/ts/dataSource/index.ts`
   - `packages/mtw-lambda-patterns/ts/dataSource/baseClasses.ts`
2. Read WML integration next:
   - `lambda/wml/dataSource/mtw-wml.ts`
   - `lambda/wml/dataSource/snapshotContent.ts`
3. Read client consumption only for validation assumptions:
   - `charcoal-client/src/slices/dataSource/reducers.ts`
   - `charcoal-client/src/slices/dataSource/streamEventPubSub/index.ts`
4. Confirm test baseline before edits, then run targeted suites after each phase.

## Verification

Prefer targeted tests per phase, then broader checks near merge:

- Framework tests:
  - `packages/mtw-lambda-patterns/ts/dataSource/index.test.ts`
- WML snapshot tests:
  - `lambda/wml/dataSource/snapshotContent.test.ts`
- WML DataSource behavior tests:
  - `lambda/wml/dataSource/mtw-wml.test.ts`

Suggested validation assertions for this task:
- Replay cursor uses `replayAt` when present.
- Legacy snapshots without `replayAt` still replay correctly via fallback.
- Sidecar snapshot reuse does not skip events between represented snapshot state and current head.

## Design decisions (locked for implementation)

- `replayAt` is part of the shared snapshot metadata shape for consistency, including non-replayable DataSource snapshot typing. For non-replayable paths this is effectively a no-op field.
- Temporary compatibility rule is now explicit in framework code/tests: resolve replay cursor as `replayAt ?? createdAt` until all legacy snapshots are migrated.
- Replay query semantics are strict lower-bound replay without consumer dedupe complexity: replay events strictly after the snapshot watermark (`replayAt`) and avoid inclusive overlap contracts.
- Keep dual fields indefinitely unless future evidence says otherwise:
  - `createdAt` remains generation/cache metadata and stays available across DataSources.
  - `replayAt` is the authoritative replay cursor for replayable subscribe/replay flows.

## Implementation watchpoints

- Treat "non-replayable `replayAt` is a no-op" as a working hypothesis to validate during implementation, not an invariant to defend.
- If implementation evidence shows meaningful non-replayable semantics or coupling, record the finding in this plan and adjust the contract deliberately rather than refactoring evidence away.

## Exit criteria

- Replayable DataSource contract supports explicit replay watermark.
- `initializeSubscription` replay lower-bound no longer depends on ambiguous `createdAt`.
- `mtw.wml` provides authoritative replay watermark from snapshot representation.
- Regression tests cover the stale-snapshot + skipped-replay failure mode.
- Durable docs updated; this task-plan is archived or removed.
