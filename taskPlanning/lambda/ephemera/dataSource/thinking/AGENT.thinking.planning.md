# Ephemera: `mtw.ephemera.thinking` foundation (planning)

**Status:** In progress. **Dynamo keys, per-task row shape, contracts home, verbose MVP, stub scheduling DS, index strategy, and API envelope (below) are locked.** **Design notes** and **TypeScript contracts** have landed (see [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md) and [`packages/mtw-interfaces/ts/eventBridge/ephemera/thinking/`](../../../../../packages/mtw-interfaces/ts/eventBridge/ephemera/thinking/)). Next implementation slice: **results spine**, then schedule/EventBridge + **subscriptions** wiring.

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
- **`mtw.ephemera.thinking`** family DataSources: **schedule** uses **`mtw.ephemera.thinking.scheduling`** (stub then persistence); **results** path as designed; schedule may remain minimal until dispatch exists.
- **Hypothesis pipeline migration:** mint `generationId`, pre-mint per-task `workItemId`s, write **thinking results** at persistence boundaries (see **Decisions** and refinements from design discussion).
- **Ephemera API** (or equivalent) for **thinking results lookup** by `generationId`, `workItemId`, and/or `(generationId, segment)` as decided (`segment` = neutral routing key, e.g. `candidates` \| `planSelect` \| `narrativeBeats`).
- **Publish thinking schedule** as **replayable** with **EventBridge** when the server contract is ready (coordinates with client plan).

### Out of scope (unless explicitly pulled in later)

- **Run browser** full product UI beyond the dashboards described in the client plan.
- **Speculative work** promotion paths, **fan-out/fan-in** execution, and **worker claim pools** beyond schema hooks and documentation notes.
- Replacing **`CoyoteGame#Intent`** semantics or adding **`generationId` to Intent** in phase zero (explicit follow-on when needed; not part of this plan's checklist).

### Read surfaces in mtw-gateways vs writes in ephemera

The repo uses **Gateway** in **`@tonylb/mtw-gateways`** as a defined term: **read-only** (and optional cache-shaped) helpers shared across lambdas, with **no** DataSource write logic in that package. See [`packages/mtw-gateways/AGENT.md`](../../../../../packages/mtw-gateways/AGENT.md) (**Purpose**, **How to add a gateway**, **Projection-read vs compute-only gateways**, **Wrapping gateways in InternalCache**).

For **`mtw.ephemera.thinking`**:

- Put **shared Dynamo read encoding and query helpers** (and tier-1 **`DeferredCache`** factories when they land) under **`packages/mtw-gateways/ts/...`** following that package's layout and **ownership table** updates. **Ephemera** constructs handlers and registers them on its **`InternalCache`**; pipeline and prompt code do not call **`ephemeraDB`** directly for thinking row shapes.
- Keep **all mutations** and **orchestration that writes schedule/result rows** in **`lambda/ephemera`** next to the owning **`EphemeraDataSource`** (or clearly owned ephemera modules). A **lambda-local facade** that only wraps **`ephemeraDB`** without extracting read/query/key rules into **`mtw-gateways`** is **not** sufficient for the **Results read gateway** / **Schedule read helpers** checkboxes below.

## Decisions (locked)

### Dynamo: job partition + task adjacency

Primary access is **by run / generation** (dispatcher, dashboards, debugging): **list everything for one job in a single `Query`**.

- **`EphemeraId`:** `JOB#${generationId}` (same id as the run's **generation** for the first consumer; if **job id** ever diverges from generation, document the mapping in durable `AGENT.md` and keep the `JOB#` prefix pattern).
- **Job metadata row:** same partition, a single well-known sort key **`Meta::Job`** for run-level metadata (status, timestamps, optional denormalized summaries, pointers, etc.).
- **Per-work-item rows:** same partition, **separate `DataCategory` values** for **schedule** vs **thinking result** (exact suffix grammar in code, e.g. `TASK#${workItemId}#Schedule` and `TASK#${workItemId}#Result` or another consistent pair). **Lifecycle:** the **schedule** line exists when the item is enqueued / claimable; the **thinking result** line appears when work **finishes** (success or failure), not at schedule time --- so a task may have **only** the schedule row for part of its life. Listing a job still uses `begins_with(DataCategory, "TASK#")` or tighter prefixes as needed.

**Not** the primary pattern for this initiative: **`THINKING#${workItemId}`** as the hash key (that optimizes "one partition per task" but makes **job-wide listing** require a GSI). **Room-scoped** partitions are **out of scope** for current Coyote-global hypothesis work; a **future** scheduler that also drives **component-scoped** work (e.g. alongside **`renderCache`** generation) can reuse the same **`JOB#` / `TASK#` idea** with a different **`EphemeraId` namespace** (e.g. `ROOM#...` / `FEATURE#...`) without changing the mental model.

### Indexes

- **Primary:** **`EphemeraId` + `DataCategory`** on the Ephemera table is the main access path (job-scoped `Query`, exact `GetItem` on schedule/result lines).
- **Secondary:** use the existing **`DataCategoryIndex`** ([`template.yaml`](../../../../../template.yaml)) when a query pattern needs it. **No new GSI** is planned for MVP unless a concrete requirement appears (for example **`workItemId`-only** lookup without `generationId`).
- **Throughput:** all writes for one generation share the **`JOB#...`** partition; acceptable for expected Coyote **N**; revisit if fan-out or coordinator churn grows large.

### Contracts (`@tonylb/mtw-interfaces`)

- **Schedule- and results-facing** EventBridge-oriented types live under **`eventBridge/ephemera/thinking/`** inside **`@tonylb/mtw-interfaces`** (path may be mirrored as `packages/mtw-interfaces/ts/eventBridge/ephemera/thinking/`).

### Verbose data (MVP)

- **Retention:** **indefinite** for the first prototype (no TTL requirement to ship MVP).
- **`verbose`:** part of the **data organization** from the start; **everything defaults to verbose** --- do **not** block MVP on a slim non-verbose path. Tightening defaults, TTL, and PII posture for production is an explicit **follow-on** after the pipeline is useful.

### Scheduling DataSource stub

- A **stub** **`mtw.ephemera.thinking.scheduling`** `EphemeraDataSource` (registered `dataSourceKey`, minimal or empty `receiveEvents`) is **acceptable** for as long as needed; expect it to be short-lived in practice while implementation steps land.

### EventBridge and `subscriptions` lambda

- Turning on a **replayable** schedule feed **outside** today’s “messages from ephemera” patterns touches **EventBridge rules / event shape** and may require **refactoring the `subscriptions` lambda** so it can consume incoming **`mtw.ephemera.*`** (or equivalent) events and bridge them to WebSocket clients. Plan template and lambda changes together; codebase ownership is unified, but the cross-lambda contract is still a deliberate integration slice.

### Results lookup API (client contract)

- **Ephemera API** for thinking results uses the **standard WebSocket envelope** for **client → ephemera** API calls (same as existing sending-API patterns); no separate REST/AppSync decision for MVP unless you add one later.

## Open decisions and unknowns

Record new items here if something blocks implementation.

- (None for now --- reopen this section when a new fork appears.)

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

- [ ] **Results spine (phase-zero priority)**
  - [ ] Results **read gateway** in **`@tonylb/mtw-gateways`** (keys, query/`GetItem` helpers, row normalization; optional **`InternalCache`** handler factories). Ephemera **registers** handlers only. **No** scattered **`ephemeraDB`** calls from prompt files or ad-hoc lambda modules for those read shapes.
  - [ ] Results **persistence** in ephemera (prefixed items in Ephemera table; idempotent finalize per `workItemId`; writes stay out of **`mtw-gateways`**).
  - [ ] **`internalCache`** for thinking results (if needed for read-after-write and test injection; justify in PR if skipped).
  - [ ] **Thinking results DataSource**: stub registration, then persistence integration if results publish on bus later; otherwise document why DS is deferred.
  - [ ] **Hypothesis pipeline migration** (`generateHypothesis` / `coyoteHypothesisPipeline`): mint `generationId`, pre-mint per-task `workItemId`s, persist rows under **`JOB#${generationId}`** per **Decisions** (`TASK#...` / `Meta::Job`): **schedule** row when a unit is scheduled; **thinking result** row when that unit **completes** (in sync MVP, result may land in the same invocation as schedule, or schedule may be elided until dispatch exists --- document in `AGENT.md`). **Verbose defaults on** for MVP; align payload shapes with [`coyoteHarnessInjectTypes.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHarnessInjectTypes.ts) / fixtures direction.
  - [ ] **Ephemera API** for results lookup (keys and JSON contract; block client plan until minimal contract exists).

- [ ] **Schedule spine**
  - [ ] Schedule **read helpers** in **`@tonylb/mtw-gateways`** once schedule rows are encoded (same read/write split as results). **Enqueue / claim** mutations stay in the scheduling **`EphemeraDataSource`** (may no-op internally at first).
  - [ ] **`mtw.ephemera.thinking.scheduling` DataSource**: stub, then persistence for work items when the schema is ready.
  - [ ] **Publish** **`mtw.ephemera.thinking.scheduling`** as **replayable** + **EventBridge** (template, IAM, publisher strategy; unblock client subscribe).

- [ ] **Closeout**
  - [ ] Move lasting subsystem description into **`lambda/ephemera/dataSource/thinking/AGENT.md`** (or adjacent).
  - [ ] Update this document checkboxes and **Status** line; archive or delete this plan per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Progress

| Track | Notes |
| --- | --- |
| Contracts | Durable [`AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md); [`ephemera/thinking`](../../../../../packages/mtw-interfaces/ts/eventBridge/ephemera/thinking/) types + `ThinkingEventSerializer` + Jest |
| Results persistence + pipeline | |
| API | |
| Schedule + EventBridge | |

## Related GitHub issues (optional index)

Map your issues to the **Recommended order** sections above (design scheduler/results, TS contracts, gateways, stubs, persistence, internalCaches, EventBridge, API). Keep issue titles in sync with checkbox slices so handoffs stay obvious.
