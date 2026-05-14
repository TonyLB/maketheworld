# Ephemera: `mtw.ephemera.thinking` (steady-state notes)

Subsystem for **durable thinking artifacts**: **schedule** rows (work queued / claimable) and **thinking results** (completed work, success or failure), stored in the Ephemera Dynamo table and (later) surfaced via **EventBridge** and the **Ephemera API**.

**Task plan (process, ordering, verification):** [`taskPlanning/lambda/ephemera/dataSource/thinking/AGENT.thinking.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/thinking/AGENT.thinking.planning.md)

**Client companion (subscribe, dashboards):** [`taskPlanning/charcoal-client/AGENT.thinkingDashboard.planning.md`](../../../../taskPlanning/charcoal-client/AGENT.thinkingDashboard.planning.md)

## Dynamo keys and row lifecycle (locked)

- **Job partition** **`EphemeraId`:** `JOB#${generationId}` (UUID string; same as the run **generation** for the first consumer).
- **Job metadata:** one row per job on that partition with sort key **`Meta::Job`**.
- **Job adjacency (membership):** for each work item, a lightweight row **`JOB#${generationId}`** + **`DataCategory`:** `TASK#${workItemId}` (same string as the task partition id below). Associates the work item with the job; **schedule and result bodies** live on **`TASK#${workItemId}`** (**`Meta::Schedule`**, **`Meta::Result`**), not on this adjacency row.
- **Task partition** **`EphemeraId`:** `TASK#${workItemId}`. Holds task-owned rows addressed by **`DataCategory`**, including **`Meta::Result`** (thinking result payload) and **`Meta::Schedule`** (schedule state when implemented).
- **Lifecycle:** schedule and membership may exist before a unit finishes; the **result** row appears under **`TASK#${workItemId}`** + **`Meta::Result`** when work completes (success or failure). Listing a job's work items still uses **`Query`** on **`JOB#${generationId}`** with `begins_with(DataCategory, "TASK#")` for adjacency lines.

Indexes and lookup patterns beyond this summary: see the task plan **Decisions** and [`template.yaml`](../../../../template.yaml) (`DataCategoryIndex`).

## Read surfaces vs authoritative writes

- **`@tonylb/mtw-gateways`:** shared **read** helpers under **`@tonylb/mtw-gateways/ts/ephemera/thinking`**: key builders (`JOB#`, `TASK#`, `Meta::Job`, `Meta::Result`, `Meta::Schedule`), **`Query`** on the job partition for **adjacency only** (never treat those rows as schedule or result payloads), **`GetItem`** on **`TASK#${workItemId}`** + **`Meta::Result`** for results and **`GetItem`** on **`TASK#${workItemId}`** + **`Meta::Schedule`** for schedule, normalization to **`ThinkingResultEvent`** / **`ThinkingScheduleEvent`**, **`createThinkingResultReadCacheHandler(ephemeraDB)`** (**`ThinkingResultReadCache`**) and **`createThinkingScheduleReadCacheHandler(ephemeraDB)`** (**`ThinkingScheduleReadCache`**); each cache key is **`workItemId`** only. Follow [`packages/mtw-gateways/AGENT.md`](../../../../packages/mtw-gateways/AGENT.md) and the package **ownership table**. Ephemera registers **`internalCache.ThinkingResults`** and **`internalCache.ThinkingSchedules`**; pipeline code should prefer those or the package **`fetch`** helpers over raw **`ephemeraDB`** for these row shapes.
    - **Physical row (thinking result):** on **`TASK#${workItemId}`** + **`Meta::Result`**, persisted items carry **`ThinkingResultEvent`** fields at the **top level** (`schemaVersion`, `generationId`, `workItemId`, `segment`, `ok`, `completedAt`, optional `errorCode`, `errorMessage`, `verbose`) alongside `EphemeraId` and `DataCategory`. Keys are stripped before validation. The persistence slice must match this shape.
    - **Physical row (schedule):** on **`TASK#${workItemId}`** + **`Meta::Schedule`**, persisted items carry **`ThinkingScheduleEvent`** fields at the **top level** (`schemaVersion`, `generationId`, `workItemId`, `segment`, `scheduleStatus`, optional `enqueuedAt`) alongside `EphemeraId` and `DataCategory`. Keys are stripped before validation. The scheduling **`EphemeraDataSource`** (or persistence module it owns) must match this shape; after writes, call **`internalCache.ThinkingSchedules.invalidate(workItemId)`** when reads in the same invocation must see fresh data.
- **`lambda/ephemera/dataSource/thinking` (and related ephemera modules):** **`EphemeraDataSource`** code and other ephemera-owned paths perform **writes** (puts, conditional finalize, enqueue/claim) and orchestration. Thinking **result** writes live in [`results/persistThinkingResult.ts`](results/persistThinkingResult.ts). **`mtw-gateways`** does not own mutation paths (see package **Non-goals**).

Task plan split and checklists: [`taskPlanning/lambda/ephemera/dataSource/thinking/AGENT.thinking.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/thinking/AGENT.thinking.planning.md) (**Read surfaces in mtw-gateways vs writes in ephemera**).

## Shared TypeScript contracts (EventBridge-oriented)

Import from **`@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking`** (schedule and thinking-result envelopes, `schemaVersion`, correlation ids, `segment`, type guards, serializer).

Do **not** duplicate those shapes in lambda or client; extend the package when the wire contract evolves.

## Verbose MVP and idempotency

- **Verbose:** MVP defaults to **verbose** artifacts; tightening defaults and retention is a follow-on (see task plan).
- **Idempotent writes:** **`Meta::Result`** uses **`ephemeraDB.nonCollidingPutItem`** (conditional **`attribute_not_exists(DataCategory)`** on the task partition sort key). **First successful write wins** for a given **`workItemId`**; duplicate finalize attempts are treated as **`alreadyFinalized`** (Lambda retry-safe). **`asyncSuppressExceptions`** on the Dynamo client can swallow other failures as a false return value; callers do not distinguish duplicate vs error for MVP. **Job adjacency** rows (**`JOB#${generationId}`** + **`DataCategory` `TASK#${workItemId}`**) use overwrite-safe **`putItem`** so membership stays aligned with finalize.
- **Write path:** [`results/persistThinkingResult.ts`](results/persistThinkingResult.ts) and **`mtw.ephemera.thinking.results`** in [`results/index.ts`](results/index.ts). After a new result insert, **`internalCache.ThinkingResults.invalidate(workItemId)`** runs for read-after-write.
- **Bus ingress:** the results DataSource subscribes to internal **`Thinking Result`** envelopes whose **`header.dataSourceKey`** is **`mtw.ephemera.coyoteGame`** (publisher), per the task plan. **`mtw.ephemera.coyoteGame`** does **not** yet **`streamEvent`** that header type in production; the subscriber and persistence are covered by unit tests until the hypothesis pipeline emits those events.

## Harness alignment (lambda-owned types)

**Segment** values in contracts align with routing keys such as **`candidates`**, **`planSelect`**, **`narrativeBeats`**. Verbose result payloads are **`unknown`** at the shared contract boundary; server code aligns them with harness inject shapes in [`../coyoteGame/generators/pipelines/hypothesis/coyoteHarnessInjectTypes.ts`](../coyoteGame/generators/pipelines/hypothesis/coyoteHarnessInjectTypes.ts) and related fixtures.

## EventBridge and `subscriptions`

Publishing a **replayable** schedule feed and bridging **`mtw.ephemera.*`** events to WebSocket clients may require **EventBridge** rules and **`subscriptions` lambda** work together with ephemera. That integration is a **separate slice** from contracts-only work; see the task plan **Schedule spine** and **Decisions**.

## Related docs

- Shared read gateways: [`packages/mtw-gateways/AGENT.md`](../../../../packages/mtw-gateways/AGENT.md)
- Coyote data source: [`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md)
- Hypothesis pipeline: [`../coyoteGame/generators/pipelines/hypothesis/AGENT.md`](../coyoteGame/generators/pipelines/hypothesis/AGENT.md)
- In-process runner (orchestration stays separate): [`../../llm/pipeline/AGENT.md`](../../llm/pipeline/AGENT.md)
- Ephemera testing: [`../../AGENT.testing.md`](../../AGENT.testing.md)

## Implementation status

**Read gateway:** shipped in **`@tonylb/mtw-gateways/ts/ephemera/thinking`** (see package **`AGENT.md`** ownership row): results and **schedule** read helpers plus ephemera **`internalCache.ThinkingResults`** and **`internalCache.ThinkingSchedules`**. **Thinking result persistence** and **`mtw.ephemera.thinking.results`** (subscribe-only, bus ingress from CoyoteGame publisher) ship under [`results/`](results/); **`Meta::Job`**, schedule writes, **API**, and **EventBridge** remain in the task plan. This `AGENT.md` is the durable anchor for keys, lifecycle, and links; avoid duplicating full architecture here.
