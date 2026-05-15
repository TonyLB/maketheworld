# Ephemera: `mtw.ephemera.thinking` foundation (planning)

**Status:** In progress. **Shipped:** contracts, read gateways (including **`listThinkingSchedulesForJob`** + **`internalCache.ThinkingJobs`**), **`mtw.ephemera.thinking.results`** + **`mtw.ephemera.thinking.scheduling`** (bootstrap, schedule puts, job error, job rollup + **`Job Completed`** bus emit), Coyote hypothesis persistence (bootstrap, schedule pre-items, **`Thinking Result`** emit, schedule **`completed`** on segment success, job error on failure). Steady-state: [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md). **Next:** **Ephemera API**; **EventBridge** replay + **subscriptions**; archive.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

**Client-side companion plan:** [`taskPlanning/charcoal-client/AGENT.thinkingDashboard.planning.md`](../../../../charcoal-client/AGENT.thinkingDashboard.planning.md) (subscribe, dashboards, Redux). This server plan owns ordering blockers for that work.

## Purpose

Introduce **`mtw.ephemera.thinking`** as infrastructure for **durable thinking artifacts** (**thinking results**, and later schedule/work items) in the Ephemera Dynamo table using **prefixed keys** and **`workItemId` (UUID)** from day one, without painting the repo into a corner for **distributed scheduling** later.

Near-term value is **results-side**: persisted **thinking results** aligned with harness inject shapes, plus **hypothesis pipeline integration** so production runs emit inspectable artifacts. **Schedule-side** DataSource, replay, and EventBridge follow once contracts and persistence patterns are proven.

This file is task-scoped. When the initiative is done, **archive or remove** it; steady-state notes for this subsystem live in [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md).

## Scope and boundaries

### In scope

- **TypeScript contracts** for schedule and **thinking results:** both live under **`packages/mtw-interfaces/ts/eventBridge/ephemera/thinking/`** (or equivalent `eventBridge/ephemera/thinking` path in **`@tonylb/mtw-interfaces`**), for EventBridge-aligned shapes consumed by ephemera and client.
- **Thinking row read surfaces** in **`@tonylb/mtw-gateways`** (key builders, `Query` / `GetItem` composition, row normalization, optional **`InternalCache`** handler factories) per [**Read surfaces in mtw-gateways vs writes in ephemera**](#read-surfaces-in-mtw-gateways-vs-writes-in-ephemera) below. **Authoritative writes** (puts, deletes, idempotent finalize, enqueue/claim) stay in **`lambda/ephemera/dataSource/...`** modules owned by the relevant **`EphemeraDataSource`**; **`mtw-gateways`** does not own mutation paths.
- **Results persistence** in the Ephemera table (house style: clean `DataCategory` prefixes, UUID `workItemId`).
- **`internalCache`** integration where it reduces duplicate Dynamo reads and matches existing Ephemera patterns.
- **`mtw.ephemera.thinking`** family DataSources: **schedule** uses **`mtw.ephemera.thinking.scheduling`** (**`api.ephemera`** **`Put Thinking Schedule`** ingress); **results** use **`mtw.ephemera.thinking.results`** (CoyoteGame **`Thinking Result`**); richer dispatch / EventBridge replay can extend schedule without changing row keys.
- **Hypothesis pipeline migration (done):** mint `generationId`, pre-mint per-task `workItemId`s, **`Meta::Job`** / adjacency / **`Meta::Schedule`** / **`Meta::Result`** at persistence boundaries (see durable [`AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md) and hypothesis [`AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md)).
- **Ephemera API** (or equivalent) for **thinking results lookup** by `generationId`, `workItemId`, and/or `(generationId, segment)` as decided (`segment` = neutral routing key, e.g. `candidates` \| `planSelect` \| `narrativeBeats`).
- **Publish thinking schedule** as **replayable** with **EventBridge** when the server contract is ready (coordinates with client plan).

### Out of scope (unless explicitly pulled in later)

- **Run browser** full product UI beyond the dashboards described in the client plan.
- **Speculative work** promotion paths, **fan-out/fan-in** execution, and **worker claim pools** beyond schema hooks and documentation notes.
- Replacing **`CoyoteGame#Intent`** semantics or adding **`generationId` to Intent** in phase zero (explicit follow-on when needed; not part of this plan's checklist).
- **Finer-than-a-work-item** durable LLM checkpoints: persisting **streaming or partial** model output **while** a **`workItemId`** is still in flight (for example token deltas, incremental JSON, or extra **`DataCategory`** lines beyond **`Meta::Schedule`** / **`Meta::Result`** for that unit). **Not** out of scope: **one** **`Meta::Result`** per **`workItemId`** when **that** unit completes, nor **many** work items (and thus many result rows) per job --- that **is** the intended hop-level durability model.

### Read surfaces in mtw-gateways vs writes in ephemera

The repo uses **Gateway** in **`@tonylb/mtw-gateways`** as a defined term: **read-only** (and optional cache-shaped) helpers shared across lambdas, with **no** DataSource write logic in that package. See [`packages/mtw-gateways/AGENT.md`](../../../../../packages/mtw-gateways/AGENT.md) (**Purpose**, **How to add a gateway**, **Projection-read vs compute-only gateways**, **Wrapping gateways in InternalCache**).

For **`mtw.ephemera.thinking`**:

- Put **shared Dynamo read encoding and query helpers** (and tier-1 **`DeferredCache`** factories when they land) under **`packages/mtw-gateways/ts/...`** following that package's layout and **ownership table** updates. **Ephemera** constructs handlers and registers them on its **`InternalCache`**; pipeline and prompt code do not call **`ephemeraDB`** directly for thinking row shapes.
- Keep **all mutations** and **orchestration that writes schedule/result rows** in **`lambda/ephemera`** next to the owning **`EphemeraDataSource`** (or clearly owned ephemera modules). A **lambda-local facade** that only wraps **`ephemeraDB`** without extracting read/query/key rules into **`mtw-gateways`** is **not** sufficient for the **Results read gateway** / **Schedule read helpers** checkboxes below.

## Decisions (locked)

### Dynamo: job partition + task adjacency + task-owned payloads

Primary **job-wide** access (dispatcher, dashboards, debugging): **list work items for one job in a single `Query`** on **`JOB#${generationId}`**.

- **`EphemeraId` (job):** `JOB#${generationId}` (same id as the run's **generation** for the first consumer; if **job id** ever diverges from generation, document the mapping in durable `AGENT.md` and keep the `JOB#` prefix pattern).
- **Job metadata row:** same partition, sort key **`Meta::Job`** for run-level metadata (status, timestamps, optional denormalized summaries, pointers, etc.).
- **Job adjacency (membership):** same partition, one lightweight row per work item: **`DataCategory`:** `TASK#${workItemId}` (same string as the task partition id below). Associates the work item with the job; **payloads are not stored here**.
- **Task-owned rows:** partition **`EphemeraId`:** `TASK#${workItemId}`. **`DataCategory`** distinguishes line types, including **`Meta::Result`** (thinking result payload) and **`Meta::Schedule`** (schedule state). **Lifecycle:** schedule / membership may exist before a unit finishes; the **result** line appears under **`Meta::Result`** when work **finishes** (success or failure). Listing a job still uses **`Query`** on **`JOB#${generationId}`** with `begins_with(DataCategory, "TASK#")` for adjacency lines.

**Not** the primary pattern for this initiative: **`THINKING#${workItemId}`** as the hash key (that optimizes "one partition per task" but makes **job-wide listing** require a GSI). **Room-scoped** partitions are **out of scope** for current Coyote-global hypothesis work; a **future** scheduler that also drives **component-scoped** work (e.g. alongside **`renderCache`** generation) can reuse the same **`JOB#` / `TASK#` idea** with a different **`EphemeraId` namespace** (e.g. `ROOM#...` / `FEATURE#...`) without changing the mental model.

### Indexes

- **Primary:** **`EphemeraId` + `DataCategory`** on the Ephemera table is the main access path (job-scoped **`Query`** for adjacency, **`GetItem`** on **`TASK#${workItemId}`** + **`Meta::Result`** / **`Meta::Schedule`** for task-owned payloads).
- **Secondary:** use the existing **`DataCategoryIndex`** ([`template.yaml`](../../../../../template.yaml)) when a query pattern needs it. **No new GSI** is planned for MVP unless a concrete requirement appears (for example **`workItemId`-only** lookup without `generationId`).
- **Throughput:** all writes for one generation share the **`JOB#...`** partition; acceptable for expected Coyote **N**; revisit if fan-out or coordinator churn grows large.

### Contracts (`@tonylb/mtw-interfaces`)

- **Schedule- and results-facing** EventBridge-oriented types live under **`eventBridge/ephemera/thinking/`** inside **`@tonylb/mtw-interfaces`** (path may be mirrored as `packages/mtw-interfaces/ts/eventBridge/ephemera/thinking/`).

### Verbose data (MVP)

- **Retention:** **indefinite** for the first prototype (no TTL requirement to ship MVP).
- **`verbose`:** part of the **data organization** from the start; **everything defaults to verbose** --- do **not** block MVP on a slim non-verbose path. Tightening defaults, TTL, and PII posture for production is an explicit **follow-on** after the pipeline is useful.

### Scheduling DataSource stub

- A **stub** **`mtw.ephemera.thinking.scheduling`** `EphemeraDataSource` (registered `dataSourceKey`, minimal or empty `receiveEvents`) was **acceptable** during early sequencing; **MVP persistence** now uses **`api.ephemera`** **`Put Thinking Schedule`** (see durable **`AGENT.md`**).

### EventBridge and `subscriptions` lambda

- Turning on a **replayable** schedule feed **outside** today's "messages from ephemera" patterns touches **EventBridge rules / event shape** and may require **refactoring the `subscriptions` lambda** so it can consume incoming **`mtw.ephemera.*`** (or equivalent) events and bridge them to WebSocket clients. Plan template and lambda changes together; codebase ownership is unified, but the cross-lambda contract is still a deliberate integration slice.

### Results lookup API (client contract)

- **Ephemera API** for thinking results uses the **standard WebSocket envelope** for **client → ephemera** API calls (same as existing sending-API patterns); no separate REST/AppSync decision for MVP unless you add one later.

## Thinking results DataSource and internal bus

Handoff notes for **results spine** implementation: how **`JOB#` / `TASK#`** relates to work items, how **`EphemeraDataSource`** + **`messageBus`** connect Coyote to persistence, and how slices can land **before** Coyote emits production events.

### Job versus work item (clarification)

- One **job** is **`JOB#${generationId}`** (with **`Meta::Job`** and many **adjacency** lines). A single hypothesis run is expected to use **multiple** **`workItemId`** values (for example **one per LLM invocation / hop**), each with **`TASK#${workItemId}`** task partition rows.
- Language like "the **result** appears when work completes" means **per `workItemId`**: **`Meta::Result`** on **`TASK#${workItemId}`** when **that** unit finishes (success or failure), not a single completion artifact for the entire job.

### Bus envelopes: producer and consumer

- **`EphemeraDataSource.subscribe()`** listens to the **internal `messageBus`**. Inbound messages are **`StreamingEvent`** payloads; **`receiveEvents`** only sees envelopes that pass this DataSource's **`subscribedEventTypeGuard`**.
- **`header.dataSourceKey`** on an inbound envelope identifies the **publisher** (who called **`streamEvent`**), not the subscriber. For Coyote-driven thinking updates, the natural first publisher is **`mtw.ephemera.coyoteGame`** (today **`publisherStrategy: 'busOnly'`** in [`lambda/ephemera/dataSource/coyoteGame/index.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/index.ts)): emitted events are **internal bus** deliveries, separate from **EventBridge** / **`subscriptions`** until the schedule spine explicitly turns that on.
- **`header.type`** for completed-unit payloads should match the shared contract (for example **`Thinking Result`** in [`packages/mtw-interfaces/ts/eventBridge/ephemera/thinking/`](../../../../../packages/mtw-interfaces/ts/eventBridge/ephemera/thinking/) with **`ThinkingEventSerializer`**). **`ThinkingResultEvent`** varies by **`segment`** and **`verbose`**; treat that as **one** primary envelope family unless we intentionally split header types later.
- The **thinking results** DataSource uses its **own** **`dataSourceKey`** (distinct from CoyoteGame). It **does not** "own" Coyote's bus identity. The link is **explicit guard logic** (for example: publisher **`mtw.ephemera.coyoteGame`**, **`header.type`** **`Thinking Result`**, validated **`getContent`**).
- **Role split:** Coyote / hypothesis code **orchestrates** when hops run. The thinking-results DataSource is the **authoritative persistence owner** for **`Meta::Result`** rows (and **`internalCache.ThinkingResults`** invalidation per [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md)), not the owner of all LLM orchestration logic.

### Optional write triggers and slice ordering

- **Primary path (bus, shipped for Coyote hypothesis):** CoyoteGame emits **`Thinking Result`** **`streamEvent`** updates; **`mtw.ephemera.thinking.results`** subscribes and writes **`Meta::Result`** (see [`hypothesisThinkingPersistence.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/hypothesisThinkingPersistence.ts)).
- **Optional later path:** **`api.ephemera`** command-style ingress for results (analogous to **`Put Cache Record`** for **`mtw.ephemera.renderCache`**) if you need caller-driven persistence outside the bus; **not** required for hypothesis MVP.
- **Schedule + job rows (shipped):** **`mtw.ephemera.thinking.scheduling`** owns **`Meta::Schedule`**, **`Meta::Job`**, and adjacency via **`api.ephemera`**; Coyote posts schedule pre-items and job bootstrap at run start (durable **`AGENT.md`**).

### Relationship to scheduling DataSource

- **`mtw.ephemera.thinking.scheduling`** is **not** a prerequisite for **`Meta::Result`** persistence. Coyote hypothesis writes schedule pre-items and results in the **same invocation** where needed; EventBridge replay for schedule remains a separate slice.

## Schedule completion and job closure (planned)

Close the happy-path lifecycle gap: today **`Meta::Job`** stays **`running`** after all hops succeed, and **`Meta::Schedule`** rows remain **`scheduled`**.

### Behavior (target)

1. **`ThinkingScheduleStatus`** includes **`completed`** (in addition to **`scheduled`**, **`claimed`**, **`cancelled`**).
2. On each **`Put Thinking Schedule`** that persists a schedule update (especially **`completed`**), **`mtw.ephemera.thinking.scheduling`** loads **all** schedule rows for that **`generationId`** and checks whether every member work item is **`completed`** (per open decision above for **`cancelled`**).
3. If so, and **`Meta::Job`** is still an active status (**`running`** / **`pending`**), transition job to **`completed`** (new job status + persistence path).
4. On the **first** successful transition to **`completed`**, emit **`Job Completed`** for that job: payload includes **`generationId`**, **`completedAt`**, and an array of **schedule-shaped** work items (**`workItemId`**, **`segment`**, **`scheduleStatus`**, optional **`enqueuedAt`**) --- **no** **`Meta::Result`** / **`verbose`** fields.

### Read support (`@tonylb/mtw-gateways` + `internalCache`)

**Uncached gateway helper** (working name **`listThinkingSchedulesForJob`**), implemented in **`@tonylb/mtw-gateways`** and unit-tested in isolation:

- **`queryTaskRowsForJob`** for adjacency (`TASK#${workItemId}` lines on **`JOB#${generationId}`**).
- For each adjacency **`workItemId`**, **`GetItem`** **`TASK#` + `Meta::Schedule`** (reuse **`getTaskScheduleItem`** / **`thinkingScheduleFromEphemeraItem`**).
- Return **`ThinkingScheduleEvent[]`** (document whether bootstrap guarantees one schedule row per adjacency line; skip or fail on missing rows per implementation choice).

**Job-scoped read cache** (**`ThinkingJobReadCache`**, registered on ephemera as **`internalCache.ThinkingJobs`**), keyed by **`generationId`**:

- **`promiseFactory`** loads a snapshot (name TBD, e.g. **`ThinkingJobReadSnapshot`**) via **`getJobMetaItem`** + **`listThinkingSchedulesForJob`** (and derived **`workItemIds`** from adjacency). **MVP snapshot:** normalized **`Meta::Job`** fields + **`schedules[]`** only --- **not** full result rows or **`verbose`** (defer result-list-in-job-cache until Ephemera API needs it).
- **`get(generationId)`** is the **blessed read** for rollup, **`Job Completed`** payload assembly, and upcoming Ephemera API job views in the same invocation.
- **`invalidate(generationId)`** on any write that touches that job partition: **`persistThinkingSchedule`**, **`persistThinkingJobCreate`**, **`persistThinkingJobError`**, and job-complete persistence when it lands. Keep **`ThinkingSchedules.invalidate(workItemId)`** alongside schedule puts for single-row read-after-write.

Scheduling rollup and **`Job Completed`** assembly **must** call **`internalCache.ThinkingJobs.get(generationId)`** (not ad-hoc **`ephemeraDB`** and not uncached **`listThinkingSchedulesForJob`** in ephemera). Pipeline or API code that reads a **single** hop may still use **`internalCache.ThinkingSchedules`** / **`ThinkingResults`** by **`workItemId`**.

### Write / emit paths (ephemera)

| Piece | Owner |
| --- | --- |
| **`completed`** on **`Meta::Schedule`** | **`persistThinkingSchedule`** via existing **`Put Thinking Schedule`** |
| Rollup + **`Meta::Job` -> `completed`** | **`mtw.ephemera.thinking.scheduling`** (after schedule put + **`ThinkingJobs.invalidate`**; read snapshot via **`internalCache.ThinkingJobs.get`**; new module e.g. **`maybeCompleteThinkingJob`**) |
| **`Job Completed` bus envelope** | **`mtw.ephemera.thinking.scheduling`** **`streamEvent`** after first job transition to **`completed`**; payload built from the same job snapshot (**schedules** only, no results) |

Contracts: extend **`@tonylb/mtw-interfaces`** with **`ThinkingJobCompleteStatus`**, **`ThinkingJobCompletedEvent`** (internal + external serializer shape if EventBridge-bound), and **`THINKING_JOB_COMPLETED_HEADER_TYPE`**; add **`Put Thinking Job Complete`** on **`api.ephemera`** **or** keep job completion as scheduling-DS-internal only (prefer **`api.ephemera`** if other producers will complete jobs later).

### Coyote hypothesis (caller)

After each successful **`emitHypothesisThinkingResult`** for a segment, post **`sendPutThinkingSchedule`** with **`scheduleStatus: 'completed'`** (same **`thinkingResults:${generationId}`** lane or bootstrap lane per ordering --- document in durable **`AGENT.md`**). Failure path unchanged (**`Put Thinking Job Error`**); failed segments may leave schedule **`scheduled`** or move to **`cancelled`** (decide in implementation).

### Verification

- **`packages/mtw-interfaces`**: type guards for **`completed`** schedule status and job-completed payload.
- **`packages/mtw-gateways`**: **`listThinkingSchedulesForJob`** unit tests (mocked **`query` + `getItem`**); **`ThinkingJobReadCache`** unit tests (batched load + **`invalidate`**).
- **`lambda/ephemera`**: register **`internalCache.ThinkingJobs`**; scheduling persistence rollup tests using mocked job snapshot (all schedules **`completed`** -> job **`completed`** + one **`Job Completed`** emit; partial complete -> no transition; stale cache invalidated after schedule put).
- **Hypothesis:** pipeline test asserts **`Put Thinking Schedule`** with **`completed`** after each segment result.

## Open decisions and unknowns

Record new items here if something blocks implementation.

- **`cancelled` vs job completion:** When rolling up "all schedule items complete," does **`scheduleStatus: 'cancelled'`** count as terminal (job may complete) or block completion until explicit **`completed`**? Default proposal: only **`completed`** counts; **`cancelled`** is terminal for that work item but does **not** satisfy the "all items complete" predicate unless we add an explicit product rule.
- **Who sets `scheduleStatus: 'completed'`:** Proposal: Coyote (or any producer) posts **`Put Thinking Schedule`** with **`completed`** when that hop finishes (hypothesis: immediately after successful **`Thinking Result`** emit for the segment). Scheduling DataSource does **not** infer completion from **`Meta::Result`** alone (keeps result vs schedule ownership split).
- **`Job Completed` transport (MVP):** Internal bus envelope from **`mtw.ephemera.thinking.scheduling`** (after **`Meta::Job`** transitions to **`completed`**), with a dedicated header type (e.g. **`Job Completed`**) and payload listing schedule work items only (no **`verbose`** / result bodies). EventBridge / replay alignment can follow the schedule spine row 170 or a tight follow-on.
- **Idempotent job completion:** Use conditional **`Meta::Job`** update (**`jobStatus`** must be **`running`** or **`pending`** before **`completed`**) so only the **first** successful transition emits **`Job Completed`**; duplicate schedule updates after completion are no-ops for emit (repeated emit is acceptable if compare-and-set is hard --- prefer first-time only).

## Success criteria (server)

- Hypothesis runs persist **versioned thinking results** keyed by **`workItemId`**, with **`generationId`** and **`segment`** denormalized for query and harness alignment.
- **Idempotent writes** for the same `workItemId` on Lambda retry (finalize or conditional put strategy documented in code or `AGENT.md`).
- **Unit / integration tests** cover gateway + persistence + pipeline hooks per [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md).
- **Ephemera API** returns stable JSON for agreed lookup keys; documented in durable API or package doc when stable.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) (durability ladder, checkbox rules, verification pattern).
2. Read shared gateway norms: [`packages/mtw-gateways/AGENT.md`](../../../../../packages/mtw-gateways/AGENT.md) (at least **Purpose**, **How to add a gateway**, **Projection-read vs compute-only gateways**, **Wrapping gateways in InternalCache**). Initiative-specific split: [**Read surfaces in mtw-gateways vs writes in ephemera**](#read-surfaces-in-mtw-gateways-vs-writes-in-ephemera). For a task plan that already sequences **`mtw-gateways`** work closely, compare [`taskPlanning/lambda/assets/AGENT.componentAggregate.planning.md`](../../../assets/AGENT.componentAggregate.planning.md).
3. Read Coyote hypothesis pipeline context:
   - [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)
   - [`lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md)
4. Read in-process runner non-goals (orchestration stays separate): [`lambda/ephemera/llm/pipeline/AGENT.md`](../../../../../lambda/ephemera/llm/pipeline/AGENT.md).
5. Read **testing authority**: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). Command context: **`lambda/ephemera/`**, Jest, `npm run test` / `npm run test -- --watchAll=false`.
6. Inspect current intent durability (global key): [`lambda/ephemera/internalCache/coyoteGame.ts`](../../../../../lambda/ephemera/internalCache/coyoteGame.ts).
7. Coordinate with [`taskPlanning/charcoal-client/AGENT.thinkingDashboard.planning.md`](../../../../charcoal-client/AGENT.thinkingDashboard.planning.md) before changing any **public** subscription or API contract.

## Verification

Use commands from [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). From **`lambda/ephemera/`**:

- Baseline before edits (adjust path when thinking tests exist):
  - `npm run test -- --watchAll=false`
- After each slice:
  - `npm run test -- --watchAll=false` for touched trees (for example `dataSource/thinking`, `dataSource/coyoteGame`, `internalCache`).
- For **`@tonylb/mtw-interfaces`** contract edits: from **`packages/mtw-interfaces/`**, `npm run test -- --watchAll=false` and `npm run build`.
- For **`@tonylb/mtw-gateways`** edits: from **`packages/mtw-gateways/`**, `npm test` (see [`packages/mtw-gateways/AGENT.md`](../../../../../packages/mtw-gateways/AGENT.md) **Test runner**).

## Recommended order (server)

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] **Design notes** (short, link-heavy; avoid duplicating steady-state architecture)
  - [X] Add or link durable **`lambda/ephemera/dataSource/thinking/AGENT.md`** when the package exists (steady-state keys, gateway surface, query patterns; summarize **Decisions** including `JOB#` / `TASK#` / `Meta::Job`, schedule vs result **row types** and lifecycle, contracts path, verbose MVP, EventBridge + **subscriptions**).

- [X] **TypeScript contracts** in **`@tonylb/mtw-interfaces`** under **`eventBridge/ephemera/thinking/`** (schedule + thinking-result envelopes, `schemaVersion`, `generationId`, `workItemId`, `segment`, verbose-first shapes toward harness inject types)

- [ ] **Results spine (phase-zero priority)** *(open: Ephemera API lookup only)*
  - [X] Results **read gateway** in **`@tonylb/mtw-gateways`** (keys, query/`GetItem` helpers, row normalization; optional **`InternalCache`** handler factories). Ephemera **registers** handlers only. **No** scattered **`ephemeraDB`** calls from prompt files or ad-hoc lambda modules for those read shapes.
  - [X] Results **persistence** in ephemera (prefixed items in Ephemera table; idempotent finalize per `workItemId`; writes stay out of **`mtw-gateways`**).
  - [X] **`internalCache`** for thinking results (if needed for read-after-write and test injection; justify in PR if skipped).
  - [X] **Thinking results DataSource**: **`mtw.ephemera.thinking.results`** subscribes to **`Thinking Result`** from **`mtw.ephemera.coyoteGame`**; Coyote hypothesis emits at segment boundaries via [`hypothesisThinkingPersistence.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/hypothesisThinkingPersistence.ts) (see [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md)).
  - [X] **Hypothesis pipeline migration**: mint `generationId`, pre-mint per-task `workItemId`s, **`Put Thinking Job Create`**, schedule pre-items, **`Thinking Result`** bus emit (success and failure), **`Put Thinking Job Error`** on run failure. Durable docs: [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md) (**Hypothesis bootstrap**), [`hypothesis/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) (**Thinking writes and reads**); harness alignment per [`coyoteHarnessInjectTypes.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHarnessInjectTypes.ts).
  - [ ] **Ephemera API** for results lookup (keys and JSON contract; block client plan until minimal contract exists).

- [ ] **Schedule spine** *(open: schedule/job completion slice + EventBridge replay)*
  - [X] Schedule **read helpers** in **`@tonylb/mtw-gateways`** once schedule rows are encoded (same read/write split as results): treat **`JOB#${generationId}`** + **`DataCategory` `TASK#${workItemId}`** as **adjacency only**; read schedule payloads with **`GetItem`** on **`TASK#${workItemId}`** + **`Meta::Schedule`**; job metadata via **`getJobMetaItem`** (mirror the results gateway pattern). Mutations stay in **`mtw.ephemera.thinking.scheduling`** via **`api.ephemera`** (**`Put Thinking Schedule`**, **`Put Thinking Job Create`**, **`Put Thinking Job Error`**).
  - [X] **`mtw.ephemera.thinking.scheduling` DataSource**: **`api.ephemera`** ingress + persistence for **`Meta::Schedule`**, **`Meta::Job`**, and job adjacency (see [`lambda/ephemera/dataSource/thinking/scheduling/`](../../../../../lambda/ephemera/dataSource/thinking/scheduling/)).
  - [ ] **Schedule `completed` + job rollup** (see [Schedule completion and job closure](#schedule-completion-and-job-closure-planned)):
    - [X] **`@tonylb/mtw-interfaces`:** add **`completed`** to **`ThinkingScheduleStatus`**; add **`ThinkingJobCompletedEvent`** (+ header type / serializer hook for **`Job Completed`**); add **`completed`** to job status vocabulary on **`Meta::Job`** (and guards).
    - [X] **`@tonylb/mtw-gateways`:** **`listThinkingSchedulesForJob`** (adjacency **`Query`** + per-**`workItemId`** schedule **`GetItem`**); **`ThinkingJobReadCache`** + **`createThinkingJobReadCacheHandler`** (snapshot via **`getJobMetaItem`** + **`listThinkingSchedulesForJob`**); gateway tests.
    - [X] **`internalCache.ThinkingJobs`:** register on ephemera **`InternalCache`**; wire **`invalidate(generationId)`** on schedule + job persistence writers (alongside existing **`ThinkingSchedules.invalidate(workItemId)`** on schedule puts).
    - [X] **`persistThinkingSchedule`:** after schedule **`putItem`**, **`ThinkingJobs.invalidate(generationId)`** then job rollup via **`internalCache.ThinkingJobs.get`** (all schedules **`completed`** -> conditional **`Meta::Job`** **`completed`**).
    - [X] **`Job Completed` emit:** scheduling DataSource publishes once per job on first transition to **`completed`**; payload = schedule work items only (no results).
    - [X] **Coyote hypothesis:** after each successful segment **`Thinking Result`**, **`sendPutThinkingSchedule`** with **`scheduleStatus: 'completed'`**; tests.
  - [ ] **Publish** **`mtw.ephemera.thinking.scheduling`** as **replayable** + **EventBridge** (template, IAM, publisher strategy; unblock client subscribe; include **`Job Completed`** / schedule **`completed`** in wire contract when this lands).

- [ ] **Closeout**
  - [X] Move lasting subsystem description into **`lambda/ephemera/dataSource/thinking/AGENT.md`** (or adjacent).
  - [X] Update this document checkboxes and **Status** line; archive or delete this plan per [`taskPlanning/AGENT.md`](../../../../AGENT.md) when **Results spine** and **Schedule spine** parents are fully `[X]`.

## Progress

| Track | Notes |
| --- | --- |
| Contracts | Durable [`AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md); [`ephemera/thinking`](../../../../../packages/mtw-interfaces/ts/eventBridge/ephemera/thinking/) types + `ThinkingEventSerializer` + Jest. Schedule **`completed`**, **`ThinkingJobStatus`** / **`completed`**, **`ThinkingJobCompletedEvent`**, **`Job Completed`** serializer branch shipped. |
| Results persistence + pipeline | **`mtw.ephemera.thinking.results`** + read gateway + `internalCache.ThinkingResults`. Coyote: **`Thinking Result`** bus emit + failure finalizer via [`hypothesisThinkingPersistence.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/hypothesisThinkingPersistence.ts). |
| API | **Pending:** WebSocket results lookup (Recommended order, Results spine). |
| Schedule + EventBridge | **`mtw.ephemera.thinking.scheduling`** shipped for bootstrap + schedule puts + job error + rollup (**`maybeCompleteThinkingJob`**) + **`Job Completed`** bus emit. Contracts for schedule **`completed`** + **`Job Completed`** envelope shipped. **`listThinkingSchedulesForJob`** + **`internalCache.ThinkingJobs`** shipped. Coyote hypothesis posts schedule **`completed`** after each successful segment result. **Pending:** replayable publisher + **subscriptions** (row 227). |

## Related GitHub issues (optional index)

Map your issues to the **Recommended order** sections above (design scheduler/results, TS contracts, gateways, stubs, persistence, internalCaches, EventBridge, API). Keep issue titles in sync with checkbox slices so handoffs stay obvious.
