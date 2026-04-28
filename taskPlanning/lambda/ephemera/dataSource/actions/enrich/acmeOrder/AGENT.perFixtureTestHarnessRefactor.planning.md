# Acme Order: per-fixture test harness refactor (planning)

**Status:** Draft in progress. Next step is to lock slash-command invocation shape for single-fixture Acme harness runs before implementation.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../../../AGENT.md).

## Purpose

Capture a task-scoped plan to add granular single-fixture execution to the Acme Order affinities harness, parallel to the fixture-targeted harness behavior already available in Coyote hypothesis generation.

Primary goals:

- Keep existing `/test affinities` behavior working for all fixtures by default.
- Add deterministic slash-tail parsing and harness invocation wiring so one fixture can be run in isolation.
- Preserve current manual-review output format while making fixture targeting explicit and testable.

## Scope and boundaries

### In scope for this task

- Extend Acme harness invocation contract and slash parsing for fixture selection.
- Refactor harness runner to support all-fixtures and single-fixture paths.
- Add or normalize fixture source for Acme harness phrases (stable indexing and metadata-friendly shape).
- Update parse-command and deterministic-intent tests for the new slash UX.
- Keep existing harness text output and enrich-only behavior intact unless explicitly changed in this task.

### Out of scope for this task

- Prompt quality tuning for trope affinities (covered by trope-centered refactor Phase 2.5).
- Hypothesis pipeline harness behavior changes.
- Changes to non-harness gameplay command parsing.

## Current anchor points in the repo

| Concern | Location |
| --- | --- |
| Acme harness runner | [`lambda/ephemera/dataSource/actions/actionHandlers/runAcmeOrderAffinitiesHarness.ts`](../../../../../../../../lambda/ephemera/dataSource/actions/actionHandlers/runAcmeOrderAffinitiesHarness.ts) |
| Acme harness phrase corpus | [`lambda/ephemera/dataSource/actions/acmeOrderAffinitiesHarnessPhrases.ts`](../../../../../../../../lambda/ephemera/dataSource/actions/acmeOrderAffinitiesHarnessPhrases.ts) |
| Acme slash-prefix check | [`lambda/ephemera/dataSource/actions/discriminateIntent/coyoteAffinitiesTestSlashCommand.ts`](../../../../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/coyoteAffinitiesTestSlashCommand.ts) |
| Deterministic slash handling | [`lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts`](../../../../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts) |
| Parse entrypoint + enrich wiring | [`lambda/ephemera/dataSource/actions/parseCommand.ts`](../../../../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) |
| Parse result contracts | [`lambda/ephemera/dataSource/actions/baseClasses.ts`](../../../../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts) |
| Existing harness tests | [`lambda/ephemera/dataSource/actions/actionHandlers/runAcmeOrderAffinitiesHarness.test.ts`](../../../../../../../../lambda/ephemera/dataSource/actions/actionHandlers/runAcmeOrderAffinitiesHarness.test.ts), [`lambda/ephemera/dataSource/actions/parseCommand.test.ts`](../../../../../../../../lambda/ephemera/dataSource/actions/parseCommand.test.ts), [`lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.test.ts`](../../../../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.test.ts) |
| Coyote fixture-targeted reference design | [`lambda/ephemera/dataSource/coyoteGame/generators/testHarness/runCoyoteEngineTestHarness.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/runCoyoteEngineTestHarness.ts), [`lambda/ephemera/dataSource/actions/discriminateIntent/parseCoyoteEngineTestSlash.ts`](../../../../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/parseCoyoteEngineTestSlash.ts) |

## Getting started

1. Skim task-plan conventions: [`taskPlanning/AGENT.md`](../../../../../../AGENT.md).
2. Read testing authority first: [`lambda/ephemera/AGENT.testing.md`](../../../../../../../../lambda/ephemera/AGENT.testing.md). If command examples conflict elsewhere, follow this file for Jest usage in `lambda/ephemera/`.
3. Confirm command context in package scripts: [`lambda/ephemera/package.json`](../../../../../../../../lambda/ephemera/package.json) and repo root [`package.json`](../../../../../../../../package.json). For local Jest runs in `lambda/ephemera`, use `npm test` (alias: `npm run test`), and pass extra Jest args after `--` (for example `npm test -- --watchAll=false` or `npm test -- -t "affinities"`). From repo root, use `npm --prefix lambda/ephemera test -- ...`.
4. Read Acme harness runner + phrase corpus: [`runAcmeOrderAffinitiesHarness.ts`](../../../../../../../../lambda/ephemera/dataSource/actions/actionHandlers/runAcmeOrderAffinitiesHarness.ts), [`acmeOrderAffinitiesHarnessPhrases.ts`](../../../../../../../../lambda/ephemera/dataSource/actions/acmeOrderAffinitiesHarnessPhrases.ts).
5. Read slash command path for affinities: [`coyoteAffinitiesTestSlashCommand.ts`](../../../../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/coyoteAffinitiesTestSlashCommand.ts), [`deterministicChecks.ts`](../../../../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts), [`parseCommand.ts`](../../../../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts), [`baseClasses.ts`](../../../../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts).
6. Read reference implementation of single-fixture harness invocation in Coyote generation: [`runCoyoteEngineTestHarness.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/runCoyoteEngineTestHarness.ts), [`parseCoyoteEngineTestSlash.ts`](../../../../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/parseCoyoteEngineTestSlash.ts).
7. Run one baseline command before edits:
   - from `lambda/ephemera/`: `npm test -- --watchAll=false dataSource/actions/actionHandlers/runAcmeOrderAffinitiesHarness.test.ts`
   - from repo root: `npm --prefix lambda/ephemera test -- --watchAll=false dataSource/actions/actionHandlers/runAcmeOrderAffinitiesHarness.test.ts`

## Design direction (draft)

- Keep slash prefix stable: `/test affinities`.
- Add optional fixture index tail for deterministic single-fixture runs (1-based), while default remains full corpus.
- Favor explicit parse helper (parallel to `parseCoyoteEngineTestSlashTail`) over ad-hoc parsing in `deterministicChecks.ts`.
- Keep harness output deterministic and backwards compatible for all-fixtures mode, with minimal additions for single-fixture headers.
- Preserve `enrichOnly` mode behavior and make fixture selection orthogonal to it.

Locked invocation decision for Phase 0:

- Use Option B in `baseClasses.ts`: add `harnessInvocation?: CoyoteAffinitiesHarnessInvocation` to `ParseCommandCoyoteAffinitiesTestResult`, where the initial invocation shape is `{ mode: 'full'; fixtureIndex1Based?: number }`.

Locked slash UX grammar decision for Phase 0:

- `/test affinities` with no tail runs the full Acme affinities fixture corpus.
- `/test affinities <n>` runs one fixture, where `<n>` is a 1-based positive integer index into the locked fixture list.
- Invalid tails (non-integer token, out-of-range integer, or extra args) return deterministic `ParseCommandResult` `{ type: 'Error', errorMessage }` from slash-tail parsing.

Locked fixture source decision for Phase 0:

- Migrate from `readonly string[]` phrases to structured fixtures and keep stable array order as the canonical 1-based slash index mapping.
- Initial fixture shape: `{ id: string; phrase: string; label?: string }`.
- Harness command remains derived as `order ${fixture.phrase}`, preserving current behavior while enabling stable ids and optional operator-friendly labels.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] Phase 0 - lock invocation and fixture contract
  - [X] Decide Acme harness invocation type shape in `baseClasses.ts` (single-fixture selector and future-safe extension point).
  - [X] Decide slash UX grammar for `/test affinities` tail (no arg = full run; integer arg = one fixture).
  - [X] Decide fixture source shape (reuse phrase array vs migrate to structured fixture objects) and lock indexing rules.

- [X] Phase 1 - parse-command deterministic routing
  - [X] Implement slash-tail parser for affinities command and wire into `deterministicChecks.ts`.
  - [X] Return parse-time error payload for malformed fixture selector (parity with generation harness behavior).
  - [X] Add/adjust unit tests for valid and invalid slash-tail forms.

- [X] Phase 2 - harness runner per-fixture execution
  - [X] Extend `runAcmeOrderAffinitiesHarness` deps/invocation to accept optional single-fixture filter.
  - [X] Refactor fixture selection logic so full-run and single-fixture paths share the same execution/rendering flow.
  - [X] Preserve current `enrichOnly` and parse-with-reasoning branches under both selection modes.
  - [X] Add runner tests for all-fixtures default, valid single-fixture run, and out-of-range fixture index handling.

- [X] Phase 3 - action wiring and regression coverage
  - [X] Wire invocation through actions ingress (`index.ts` and action handler dispatch) so slash parsing reaches harness execution.
  - [X] Expand integration-style tests (`index.test.ts` and/or `parseCommand.test.ts`) to cover end-to-end fixture targeting.
  - [X] Verify no regressions in existing `/test affinities` no-arg behavior.

- [ ] Phase 4 - polish and task-plan updates
  - [ ] Add concise operator-facing notes (slash usage examples) in appropriate code comments/docs.
  - [ ] Update this task plan checklist and add locked implementation notes for landed slash grammar and fixture contract.

## Verification

Run from `lambda/ephemera/` unless noted otherwise.

```bash
npm run test -- --watchAll=false dataSource/actions/actionHandlers/runAcmeOrderAffinitiesHarness.test.ts
npm run test -- --watchAll=false dataSource/actions/discriminateIntent/deterministicChecks.test.ts
npm run test -- --watchAll=false dataSource/actions/parseCommand.test.ts
npm run test -- --watchAll=false dataSource/actions/index.test.ts
```

## Progress

| Milestone | Status |
| --- | --- |
| Task plan drafted with scope and file map | Done |
| Invocation contract + slash grammar + fixture source locked | Done |
| Deterministic parser + tests landed | Done |
| Harness per-fixture execution landed | Done |
| End-to-end action wiring + regressions green | Done |
| Checklist updated and plan retired | Not started |

Phase 2 implementation note:

- `runAcmeOrderAffinitiesHarness` now accepts optional `harnessInvocation` and validates `fixtureIndex1Based` in-runner with deterministic operator-facing error text: `Coyote affinities test harness: fixture index must be an integer from 1 to <max> (received <value>).`

Phase 3 implementation note:

- Actions ingress (`index.ts`) now forwards optional `harnessInvocation` from `ParseCommandCoyoteAffinitiesTestResult` into `runAcmeOrderAffinitiesHarness`, and `index.test.ts` now verifies both fixture-targeted forwarding (`/test affinities 3`) and no-arg default invocation behavior (`/test affinities`).
