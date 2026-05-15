# Coyote hypothesis: thinking row migration (planning)

**Status:** In progress. **Parent initiative:** [`taskPlanning/lambda/ephemera/dataSource/thinking/AGENT.thinking.planning.md`](../thinking/AGENT.thinking.planning.md) (this file owns the **Hypothesis pipeline migration** slice only).

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

**Steady-state keys and write paths:** [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md). **Hypothesis pipeline context:** [`lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md).

This file is task-scoped. When the migration is done, **archive or remove** it per [`taskPlanning/AGENT.md`](../../../../AGENT.md); update [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md) with any lasting behavior notes.

## Purpose

Land **Coyote hypothesis** integration with **`mtw.ephemera.thinking`** so each run has a **`generationId`**, pre-minted **`workItemId`**s, durable **`JOB#${generationId}`** rows (**`Meta::Job`**, adjacency **`TASK#${workItemId}`**), **`Meta::Schedule`** where enqueueing matters, and **`Meta::Result`** when each hop completes---without repeated ad-hoc swings at the single oversized checkbox in the parent plan.

Near-term outcome: production and harness runs emit **inspectable** schedule and result artifacts aligned with [`coyoteHarnessInjectTypes.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHarnessInjectTypes.ts) / fixtures direction (**verbose defaults on**).

## GitHub issue map (draft titles)

Use this table to keep issue titles aligned with **Recommended order** checkboxes.

| Draft issue title | Plan section |
| --- | --- |
| Load-bearing Coyote Game thinking result payloads | [Thinking Result payloads](#1-load-bearing-coyote-game-thinking-result-payloads) |
| Add Job Create API events to thinking schedule | [Job create + scheduling authority](#2-job-create-api-events-and-scheduling-data-source-authority) |
| Add Job Error event to thinking schedule | [Job error vs step failure](#3-job-error-event-and-relationship-to-meta-result) |
| Publish schedule pre-items on hypothesis generation start | [Schedule pre-items at run start](#4-publish-schedule-pre-items-on-hypothesis-generation-start) |
| Publish thinking-results on hypothesis generation steps | [Thinking Result bus emits](#5-publish-thinking-results-on-hypothesis-generation-steps) |

## Scope and boundaries

### In scope

- **Identity:** mint **`generationId`** for each hypothesis run; pre-mint one **`workItemId`** per durable unit (for example per LLM hop: **`candidates`**, **`planSelect`**, **`narrativeBeats`**) before work starts, stable across Lambda retries.
- **Job partition writes:** **`JOB#${generationId}`** + **`Meta::Job`** (run-level metadata: status, timestamps, optional summaries). **Adjacency** rows on the same partition: **`DataCategory` `TASK#${workItemId}`** (membership only; payloads stay on task partitions).
- **Schedule:** **`Meta::Schedule`** on **`TASK#${workItemId}`** via existing **`api.ephemera`** **`Put Thinking Schedule`** path (**`sendPutThinkingSchedule`**); **pre-items** (queued / scheduled) when a unit starts, per parent **Decisions** lifecycle.
- **Results:** **`Meta::Result`** via **`mtw.ephemera.thinking.results`** subscriber to internal **`Thinking Result`** from **`mtw.ephemera.coyoteGame`** (**load-bearing** `getContent` for persistence and harness alignment).
- **Job-level error signaling:** contract and **`api.ephemera`** (or internal bus) path for **run-level** failure distinct from per-step **`Meta::Result`** (see below).

### Out of scope (unless pulled in explicitly)

- **EventBridge replay** and **`subscriptions`** WebSocket bridging for schedule (parent plan **Schedule spine**).
- **Ephemera API** for client results lookup (separate parent checkbox; coordinate before changing **public** contract per [`taskPlanning/charcoal-client/AGENT.thinkingDashboard.planning.md`](../../../../charcoal-client/AGENT.thinkingDashboard.planning.md)).
- Replacing **`CoyoteGame#Intent`** or adding **`generationId`** to Intent (parent plan **Out of scope** unless reopened).

## Decisions (this migration)

### Authority: job rows live under the scheduling DataSource

**Extend [`mtw.ephemera.thinking.scheduling`](../../../../../lambda/ephemera/dataSource/thinking/scheduling/)** so its **authoritative write domain** includes not only **`Meta::Schedule`** but also **job bootstrap**: **`Meta::Job`** and **job adjacency** rows on **`JOB#${generationId}`**, using the same **`api.ephemera`** ingress style as **`Put Thinking Schedule`** (new header types / commands as needed). Rationale: one DataSource owns **all Dynamo mutations** that establish and update **job-scoped thinking worklist state** before EventBridge splits read models; avoid scattering **`putItem`** for **`JOB#`** across Coyote handlers.

Coyote hypothesis code **orchestrates** when to send commands; it does not become the authoritative writer for **`JOB#`** rows.

### 1) Load-bearing Coyote Game thinking result payloads

**`Thinking Result`** envelopes from **`mtw.ephemera.coyoteGame`** must carry enough structured **`getContent`** (ids, **`segment`**, **`verbose`**, success/failure, timestamps, error fields, hop-appropriate payload) for **`mtw.ephemera.thinking.results`** to persist **`ThinkingResultEvent`**-shaped **`Meta::Result`** rows without reaching back into Coyote-only types. Extend **`@tonylb/mtw-interfaces`** contracts when the wire shape evolves; keep lambda alignment with harness inject direction.

### 2) Job create API events and scheduling Data Source authority

Add **`api.ephemera`** (or agreed internal) **commands** consumed by **`mtw.ephemera.thinking.scheduling`** that create or upsert:

- **`JOB#${generationId}`** + **`Meta::Job`**, and
- **Adjacency** lines **`JOB#${generationId}`** + **`DataCategory` `TASK#${workItemId}`** for each pre-minted work item (overwrite-safe membership, per durable [`AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md)).

**Naming:** Prefer issue/PR text that says **`api.ephemera`** / **`Put Thinking ...`** family rather than "EventBridge thinking schedule," which is a **later** slice.

### 3) Job error event and relationship to `Meta::Result`

**Two different semantics:**

- **Per-step failure:** **`TASK#${workItemId}`** + **`Meta::Result`** with **`ok: false`** (and error metadata) for **that** `workItemId` when the hop fails or aborts; idempotent finalize rules already documented in [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md).
- **Job-level error:** update **`Meta::Job`** (and/or a dedicated **job error** command/event) so dashboards and future subscribers can see **the whole run failed** without inferring only from partial results.

**Call-site note:** A single failure path in **`coyoteHypothesisPipeline`** (or equivalent) will often **perform both**: write or finalize the failing step's **`Meta::Result`**, **and** mark the job row (or emit job error) so the run is not left "open" when any critical step fails. Same **try/catch** or abort handler may invoke both writers; the issues stay separate because the **rows and contracts** differ.

### 4) Publish schedule pre-items on hypothesis generation start

When **`generateHypothesis` / `coyoteHypothesisPipeline`** begins (or when each hop is **scheduled**), post **`Put Thinking Schedule`** (or follow-on commands) so **`Meta::Schedule`** exists **before** completion where MVP needs visibility. Depends on **minted ids** and **job create** (issues 2 and identity work) so every pre-item references a stable **`workItemId`** and **`generationId`**.

### 5) Publish thinking results on hypothesis generation steps

On each hop completion (success or failure), **`streamEvent`** **`Thinking Result`** from **`mtw.ephemera.coyoteGame`** so **`mtw.ephemera.thinking.results`** persists **`Meta::Result`**. Tightly coupled with **(1)** payload work; can land as two PRs (types/tests first, pipeline emit second) if that reduces review risk.

## Open decisions and unknowns

Record blocking forks here as they appear (for example exact **`Meta::Job`** field set, whether job create is one command or split, ordering with **`messageBus.flush()`**).

- **api.ephemera** internal header strings for job bootstrap and run failure: **`Put Thinking Job Create`**, **`Put Thinking Job Error`** (see [`lambda/ephemera/AGENT.event.md`](../../../../../lambda/ephemera/AGENT.event.md)).

## Success criteria

- A full hypothesis run leaves a **queryable job partition** (**`Meta::Job`** + adjacency) and, for each hop, durable **`Meta::Schedule`** (when enabled for MVP) and **`Meta::Result`** with **verbose-first** payloads consistent with harness direction.
- **Lambda retry safety:** idempotent result finalize per **`workItemId`**; job and adjacency writes documented for overwrite / idempotency expectations.
- **Jest** coverage for new **`api.ephemera`** guards, scheduling **`receiveEvents`**, and pipeline integration or harness-level tests per [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md).

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) (durability ladder, checkbox rules, **Recommended order** intro line).
2. Read [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md) (keys, **`Put Thinking Schedule`** ingress, **`Thinking Result`** bus path, idempotency).
3. Read [`lambda/ephemera/AGENT.event.md`](../../../../../lambda/ephemera/AGENT.event.md) for **`api.ephemera`** event naming patterns.
4. Read [`lambda/ephemera/dataSource/apiEphemera.ts`](../../../../../lambda/ephemera/dataSource/apiEphemera.ts) and [`localApiEvents.ts`](../../../../../lambda/ephemera/dataSource/localApiEvents.ts) for how **`sendPutThinkingSchedule`** posts envelopes.
5. Read hypothesis orchestration: [`coyoteHypothesisPipeline.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts), [`generateHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/generateHypothesis.ts).
6. **Testing authority:** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). Command context: **`lambda/ephemera/`**, Jest, `npm run test` / `npm run test -- --watchAll=false`. If commands conflict, follow **`AGENT.testing.md`**.

## Verification

From **`lambda/ephemera/`**:

- Baseline before edits: `npm run test -- --watchAll=false`
- After each slice: `npm run test -- --watchAll=false` for touched trees (for example `dataSource/thinking/scheduling`, `dataSource/thinking/results`, `dataSource/apiEphemera.ts`, `dataSource/coyoteGame/generators/pipelines/hypothesis`, `dataSource/localApiEvents.ts`).
- For **`@tonylb/mtw-interfaces`** contract edits: from **`packages/mtw-interfaces/`**, `npm run test -- --watchAll=false` and `npm run build`.

## Recommended order (server)

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] **Contracts and `api.ephemera` surface for job bootstrap and job error**
  - [X] Extend **`@tonylb/mtw-interfaces`** (and **`localApiEvents` / header guards**) for **Job Create** (or equivalent name): payload covers **`generationId`**, initial **`Meta::Job`** fields, and the list of **`workItemId`**s (or enough to write adjacency).
  - [X] Add **Job Error** (or equivalent): payload updates **`Meta::Job`** for run-level failure without replacing per-step **`Meta::Result`** semantics.
  - [X] Wire **`send...`** helpers in [`apiEphemera.ts`](../../../../../lambda/ephemera/dataSource/apiEphemera.ts) parallel to **`sendPutThinkingSchedule`**.

- [X] **Scheduling Data Source: authoritative writes for `Meta::Job` and adjacency**
  - [X] Subscribe to new **`api.ephemera`** envelope types; implement persistence modules (prefer colocated under [`scheduling/`](../../../../../lambda/ephemera/dataSource/thinking/scheduling/) or sibling files owned by the same DataSource).
  - [X] **`internalCache`** invalidation strategy for job-scoped reads if new read paths are added (otherwise document "query Dynamo via gateway only" for MVP).

- [ ] **Hypothesis pipeline: mint ids and call job create at run start**
  - [ ] Mint **`generationId`** and per-hop **`workItemId`**s; invoke **Job Create** once before hops (or at first durable boundary---document choice in [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md) if non-obvious).

- [ ] **Schedule pre-items**
  - [ ] **`sendPutThinkingSchedule`** (or batch) for each hop when scheduled / at start, aligned with **`ThinkingScheduleEvent`** and existing **`persistThinkingSchedule`**.

- [ ] **Load-bearing `Thinking Result` payloads + bus emit per hop**
  - [ ] Ensure **`getContent`** satisfies persistence and harness alignment; add or extend Jest for serializer/guard paths as needed.
  - [ ] Emit from CoyoteGame at step boundaries; verify **`mtw.ephemera.thinking.results`** writes **`Meta::Result`**.

- [ ] **Unified failure handling**
  - [ ] On per-step failure: finalize **`Meta::Result`** for that **`workItemId`** with **`ok: false`** where applicable.
  - [ ] In the same control-flow sites where the run cannot continue: invoke **Job Error** / **`Meta::Job`** update so the **job** reflects failure (see [Job error vs step failure](#3-job-error-event-and-relationship-to-meta-result)).

- [ ] **Closeout for this plan**
  - [ ] Update [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md) (**Implementation status**, job write path, new commands).
  - [ ] Mark the parent plan **Hypothesis pipeline migration** checkbox and trim this file or archive per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Progress

| Track | Notes |
| --- | --- |
| Contracts + `api.ephemera` | Done: **`Put Thinking Job Create`** / **`Put Thinking Job Error`** types and send helpers |
| Scheduling DS writes | Done: **`mtw.ephemera.thinking.scheduling`** subscribes to job commands; **`persistThinkingJobCreate`** / **`persistThinkingJobError`**; tests; no job **`internalCache`** (gateway / Dynamo reads documented in **`thinking/AGENT.md`**) |
| Pipeline | `generateHypothesis` / `coyoteHypothesisPipeline`: ids, sends, failure paths |
| Results emit | CoyoteGame **`Thinking Result`**, payload + persistence E2E in lambda tests if feasible |

## Related GitHub issues (optional index)

Keep issue titles in sync with the [GitHub issue map](#github-issue-map-draft-titles) table and **Recommended order** sections above.
