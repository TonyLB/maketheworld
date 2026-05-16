# Actions: Acme Order Enrich thinking instrumentation (planning)

**Status:** Phase A1 done. Next step: Phase A2 (`acmeOrderThinkingPersistence` module + tests).

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

Instrument **Acme Order Enrich** with the same durable **thinking** artifacts used by the Coyote hypothesis pipeline: schedule rows, per-hop results (`verbose`), job bootstrap, rollup to **`Job Completed`**, and client drill-down via **`/dashboard`** + **`fetchThinkingResult`**.

This enables operators to debug and tune enrich prompts, JSON handoff, and normalization without relying on ephemeral harness OOC output alone.

## Locked scope (this initiative)

| Decision | Choice |
| --- | --- |
| Segments | **Single segment:** `acmeOrderEnrich` (enrich Bedrock + interpret/finalize only) |
| Intent discrimination | **Out of scope** (instrument later if needed) |
| Orchestration owner | **`enrichAcmeOrder`** owns bootstrap / emit / finalize when `messageBus` is provided; `parseCommandCore` only passes deps (no duplicate lifecycle) |
| When to create a job | Whenever **`enrichAcmeOrder`** runs with `messageBus` (production **`AcmeOrderIntent`** path and affinities harness **`enrichOnly`** / full parse) |
| `verbose` occupancy | **Full `occupiedStableKeys` list** (not count-only) |
| Harness `enrichOnly` | **In scope:** pass `messageBus` into **`enrichAcmeOrder`** so `/test affinities` creates dashboard jobs (desirable for tuning) |

## Out of scope (follow-ons)

- Intent-classification (`discriminateIntent`) thinking jobs
- **`Job Failed`** EventBridge stream or dashboard listing of failed jobs (MVP gap shared with hypothesis; failed runs persist `Meta::Job` **`failed`** but do not appear in completed-jobs subscription)
- Per-hop **`Thinking Schedule`** live stream (contracts exist; publisher deferred globally)
- Migrating parse/enrich onto `runPipeline`
- Job-type / source metadata on `Meta::Job` (dashboard will mix hypothesis and Acme jobs by `generationId` + `segment` until a filter follow-on)

## Success criteria

- After a successful **`AcmeOrderIntent`** parse that completes enrich, Dynamo has **`Meta::Job`** + adjacency + **`Meta::Schedule`** **`completed`** + **`Meta::Result`** for segment **`acmeOrderEnrich`**, and **`mtw.ephemera.thinking.scheduling`** emits **`Job Completed`** on streamKey **`global`**.
- **`/dashboard`** shows the job with one segment row **`acmeOrderEnrich`**; clicking it loads **`verbose`** via **`fetchThinkingResult`** (command context, full **`occupiedStableKeys`**, invoke summary, raw body, reasoning markdown, normalized lines, finalize outcome).
- Enrich failures (placement cap, invoke failure, JSON parse failure, finalize edge cases) mark the job **`failed`** and persist an **`ok: false`** result when the enrich hop ran far enough to attach diagnostics (cap block: still bootstrap + failure result + job error with clear **`errorCode`**).
- Unit tests cover bootstrap, success emit, and failure finalize without requiring live Bedrock or Dynamo (messageBus lane mocks, same style as hypothesis thinking tests).
- Steady-state behavior is documented in [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md) and [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md) when the task completes (not duplicated here).

## Architecture (task-specific deltas only)

Reuse the shipped thinking stack documented in [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md). Hypothesis reference implementation: [`hypothesisThinkingPersistence.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/hypothesisThinkingPersistence.ts).

| Layer | Hypothesis today | Acme enrich (this task) |
| --- | --- | --- |
| Orchestration | `runCoyoteHypothesisPipeline` + `hypothesisThinkingPersistence` | **`enrichAcmeOrder`** + **`acmeOrderThinkingPersistence`** (`parseCommandCore` passes `messageBus` + context only) |
| Segments | `candidates`, `planSelect`, `narrativeBeats` | **`acmeOrderEnrich`** only |
| `Thinking Result` publisher | `mtw.ephemera.coyoteGame` | **`mtw.ephemera.actions`** |
| Bus consumer | `mtw.ephemera.thinking.results` (Coyote header guard) | **`mtw.ephemera.thinking.results`** accepts Coyote + **actions** publisher ([`thinking/results/subscribedEvents.ts`](../../../../../lambda/ephemera/dataSource/thinking/results/subscribedEvents.ts)) |
| `messageBus` | Pipeline deps + dedicated lanes (`thinkingBootstrap:*`, `thinkingResults:${generationId}`) | Thread via **`ParseCommandDeps`** from [`actions/index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) |

### `verbose` shape (locked)

Align with what the affinities harness already surfaces; store on **`Meta::Result`** for dashboard JSON:

- `command` (trimmed), `intentRawOrders`, **`occupiedStableKeys`** (full list)
- `intentConfidence` (from discriminate intent)
- Invoke summary: `success`, `bodyLength`, `usage`, `errorMessage`
- `enrichRawBody`, `enrichReasoningMarkdown` (when present)
- Normalized `enrichResponse` or parse/finalize diagnostics
- Terminal `resultType` (`AcmeOrder` vs `Error`) and high-level line counts / trope-failure hints

### Failure `errorCode` mapping (draft)

| Condition | Suggested `errorCode` |
| --- | --- |
| Placement cap (>20 objects) | `acme_enrich_placed_objects_cap` |
| Bedrock invoke failed | `acme_enrich_invoke_failed` |
| Body parse / normalize failed | `acme_enrich_parse_failed` |
| Other | `acme_enrich_finalize_failed` or `acme_enrich_unknown` |

## Progress

| Phase | Description | Status |
| --- | --- | --- |
| A1 | Contracts: `ThinkingSegment`, results ingress | Done |
| A2 | `acmeOrderThinkingPersistence` module + tests | Not started |
| A3 | Wire `parseCommand` / `enrichAcmeOrder` + `messageBus` | Not started |
| A4 | Integration tests + manual verification | Not started |
| A5 | Durable docs + closeout | Not started |

## Getting started

1. Skim task-plan conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read thinking steady-state (keys, lifecycle, hypothesis bootstrap): [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md).
3. Read actions + enrich boundaries: [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md), [`lambda/ephemera/dataSource/actions/enrich/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/AGENT.md).
4. Read hypothesis persistence pattern (bootstrap / emit / finalize): [`hypothesisThinkingPersistence.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/hypothesisThinkingPersistence.ts) and [`hypothesisThinkingPersistence.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/hypothesisThinkingPersistence.test.ts).
5. Read enrich implementation: [`enrich/acmeOrder/index.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/index.ts), [`interpretAndFinalize.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/interpretAndFinalize.ts).
6. Read client dashboard (no code changes required for MVP unless segment display needs polish): [`charcoal-client/src/components/ThinkingDashboard/AGENT.md`](../../../../../charcoal-client/src/components/ThinkingDashboard/AGENT.md).
7. **Testing authority:** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). Run commands from **`lambda/ephemera/`** with Jest (`npm run test -- --watchAll=false <path>`). If examples conflict elsewhere, follow that file.
8. Baseline before edits (from `lambda/ephemera/`):

```bash
npm run test -- --watchAll=false dataSource/thinking/results/index.test.ts
npm run test -- --watchAll=false dataSource/actions/parseCommand.test.ts
```

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] Phase A1 - contracts and results ingress
  - [X] Add **`acmeOrderEnrich`** to `ThinkingSegment` in [`packages/mtw-interfaces/ts/eventBridge/ephemera/thinking/index.ts`](../../../../../packages/mtw-interfaces/ts/eventBridge/ephemera/thinking/index.ts); update `isThinkingSegment` and package tests.
  - [X] Extend [`thinking/results/subscribedEvents.ts`](../../../../../lambda/ephemera/dataSource/thinking/results/subscribedEvents.ts) to accept **`Thinking Result`** from **`mtw.ephemera.actions`** (multi-publisher guard or parallel guard; keep CoyoteGame path unchanged).
  - [X] Update [`thinking/results/index.test.ts`](../../../../../lambda/ephemera/dataSource/thinking/results/index.test.ts) (and interfaces tests if needed) for the new publisher key.

- [ ] Phase A2 - persistence module
  - [ ] Add [`enrich/acmeOrder/acmeOrderThinkingPersistence.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/acmeOrderThinkingPersistence.ts) (or `actions/acmeOrderThinkingPersistence.ts` if enrich should not import messageBus types from a sibling cycle --- avoid `enrich` importing `parseCommand`).
  - [ ] Implement: `mintAcmeOrderThinkingIds`, `bootstrapAcmeOrderThinkingAtRunStart` (one work item, segment `acmeOrderEnrich`), `emitAcmeOrderThinkingResult` (bus + schedule `completed` + `flush`), `finalizeAcmeOrderThinkingOnFailure` (`ok: false` result + `Put Thinking Job Error` + `flush`), `sendActionsThinkingResult` (publisher `mtw.ephemera.actions`).
  - [ ] Colocated unit tests mirroring hypothesis patterns (lane ids, flush ordering, cap failure path).

- [ ] Phase A3 - orchestration wiring
  - [ ] Add optional `messageBus: Pick<MessageBus, 'send' | 'flush'>` to **`ParseCommandDeps`** and **`EnrichAcmeOrder` deps**; pass from [`actions/index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) on **`Parse Requested`**.
  - [ ] Centralize lifecycle in **`enrichAcmeOrder`**: bootstrap at entry when `messageBus` present, emit on success, finalize on failure (including placement cap before Bedrock).
  - [ ] **`parseCommandCore`**: pass `messageBus`, `intentConfidence`, and enrich input into **`enrichAcmeOrder`** only; no bootstrap/emit/finalize in parse layer.
  - [ ] **`runAcmeOrderAffinitiesHarness`**: pass `messageBus` into **`enrichAcmeOrder`** for **`enrichOnly`** and full-parse paths so harness runs appear in **`/dashboard`**.
  - [ ] Do not attach reasoning markdown to **`AcmeOrder`** bus payload (unchanged product contract); thinking **`verbose`** holds operator diagnostics (full **`occupiedStableKeys`** list).

- [ ] Phase A4 - verification
  - [ ] Extend [`parseCommand.test.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.test.ts) (and/or new `acmeOrderThinkingPersistence.test.ts`) with messageBus mocks asserting Put Thinking Job Create, Thinking Result, Put Thinking Schedule, Put Thinking Job Error call order.
  - [ ] Run targeted suites from `lambda/ephemera/`:

```bash
npm run test -- --watchAll=false dataSource/actions/enrich/acmeOrder/acmeOrderThinkingPersistence.test.ts
npm run test -- --watchAll=false dataSource/actions/parseCommand.test.ts
npm run test -- --watchAll=false dataSource/thinking/results/index.test.ts
npm run test -- --watchAll=false packages/mtw-interfaces/ts/eventBridge/ephemera/thinking/index.test.ts
```

  - [ ] Manual smoke (deployed or local stack): issue an Acme order command, open **`/dashboard`**, confirm **`acmeOrderEnrich`** segment and **`verbose`** drill-down.

- [ ] Phase A5 - closeout
  - [ ] Add **Acme order enrich thinking** subsection to [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md) (bootstrap hook, segment, publisher key, failure notes).
  - [ ] Add pointer under **Thinking writes** in [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md) or [`enrich/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/AGENT.md).
  - [ ] Mark all **Recommended order** checkboxes `[X]`, set **Status** to done, archive or delete this plan per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Verification (acceptance)

From `lambda/ephemera/`:

```bash
npm run test -- --watchAll=false dataSource/actions/enrich/acmeOrder/
npm run test -- --watchAll=false dataSource/thinking/
```

Operator checklist:

1. `order <catalog phrase>` in play (Coyote room, under placement cap).
2. **`/dashboard`**: new completed job, segment **`acmeOrderEnrich`**, result shows command + model body + normalized lines.
3. Force a failure (e.g. cap or invalid fixture) and confirm job does not stay **`running`** in Dynamo (dashboard may still hide failed jobs until **`Job Failed`** follow-on).

## Coordination notes

- **No charcoal-client changes required for MVP** if `ThinkingSegment` label `acmeOrderEnrich` is acceptable in the segment list; optional follow-on: human-readable labels or job source filter.
- **Volume:** every Acme order (and each affinities harness enrich invocation with `messageBus`) creates a job row on the global stream; acceptable for tuning; revisit filtering if the dashboard becomes noisy.
- **Shared module vs fork:** avoid copying hypothesis helpers wholesale; extract shared lane/flush helpers only if duplication becomes painful in review.

## Locked implementation decisions (formerly open questions)

- [X] **Lifecycle owner:** **`enrichAcmeOrder`** when `messageBus` is provided (not `parseCommandCore`).
- [X] **`verbose`:** include the **full `occupiedStableKeys` list**.
- [X] **Affinities harness:** pass `messageBus` into **`enrichAcmeOrder`** for **`enrichOnly`** runs (jobs during `/test affinities` are desirable).
