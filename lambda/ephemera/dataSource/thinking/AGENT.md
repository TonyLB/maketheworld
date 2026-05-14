# Ephemera: `mtw.ephemera.thinking` (steady-state notes)

Subsystem for **durable thinking artifacts**: **schedule** rows (work queued / claimable) and **thinking results** (completed work, success or failure), stored in the Ephemera Dynamo table and (later) surfaced via **EventBridge** and the **Ephemera API**.

**Task plan (process, ordering, verification):** [`taskPlanning/lambda/ephemera/dataSource/thinking/AGENT.thinking.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/thinking/AGENT.thinking.planning.md)

**Client companion (subscribe, dashboards):** [`taskPlanning/charcoal-client/AGENT.thinkingDashboard.planning.md`](../../../../taskPlanning/charcoal-client/AGENT.thinkingDashboard.planning.md)

## Dynamo keys and row lifecycle (locked)

- **`EphemeraId`:** `JOB#${generationId}` (UUID string; same as the run **generation** for the first consumer).
- **Job metadata:** one row per job with sort key **`Meta::Job`**.
- **Per work item:** rows under the same partition with **`DataCategory`** that distinguishes **schedule** vs **thinking result** (exact suffix grammar lives in implementation code, e.g. `TASK#${workItemId}#Schedule` and `TASK#${workItemId}#Result` or another consistent pair).
- **Lifecycle:** a **schedule** line exists when the item is enqueued / claimable; a **thinking result** line appears when that unit **finishes** (success or failure), not necessarily at schedule time. A task may have **only** a schedule row for part of its life. Listing a job uses `begins_with(DataCategory, "TASK#")` (or a tighter prefix) as implemented.

Indexes and lookup patterns beyond this summary: see the task plan **Decisions** and [`template.yaml`](../../../../template.yaml) (`DataCategoryIndex`).

## Shared TypeScript contracts (EventBridge-oriented)

Import from **`@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking`** (schedule and thinking-result envelopes, `schemaVersion`, correlation ids, `segment`, type guards, serializer).

Do **not** duplicate those shapes in lambda or client; extend the package when the wire contract evolves.

## Verbose MVP and idempotency

- **Verbose:** MVP defaults to **verbose** artifacts; tightening defaults and retention is a follow-on (see task plan).
- **Idempotent writes:** finalize or conditional-put strategy for the same `workItemId` on Lambda retry will be documented in implementation code or this file when the **results spine** lands.

## Harness alignment (lambda-owned types)

**Segment** values in contracts align with routing keys such as **`candidates`**, **`planSelect`**, **`narrativeBeats`**. Verbose result payloads are **`unknown`** at the shared contract boundary; server code aligns them with harness inject shapes in [`../coyoteGame/generators/pipelines/hypothesis/coyoteHarnessInjectTypes.ts`](../coyoteGame/generators/pipelines/hypothesis/coyoteHarnessInjectTypes.ts) and related fixtures.

## EventBridge and `subscriptions`

Publishing a **replayable** schedule feed and bridging **`mtw.ephemera.*`** events to WebSocket clients may require **EventBridge** rules and **`subscriptions` lambda** work together with ephemera. That integration is a **separate slice** from contracts-only work; see the task plan **Schedule spine** and **Decisions**.

## Related docs

- Coyote data source: [`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md)
- Hypothesis pipeline: [`../coyoteGame/generators/pipelines/hypothesis/AGENT.md`](../coyoteGame/generators/pipelines/hypothesis/AGENT.md)
- In-process runner (orchestration stays separate): [`../../llm/pipeline/AGENT.md`](../../llm/pipeline/AGENT.md)
- Ephemera testing: [`../../AGENT.testing.md`](../../AGENT.testing.md)

## Implementation status

**Gateways, DataSources, persistence, and API** are tracked in the task plan (**Results spine**, **Schedule spine**). This `AGENT.md` is the durable anchor for keys, lifecycle, and links; avoid duplicating full architecture here.
