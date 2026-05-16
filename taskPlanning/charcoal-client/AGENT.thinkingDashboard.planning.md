# charcoal-client: Thinking dashboards and subscriptions (planning)

**Status:** In progress. **Client subscribe** to **`Job Completed`** and **completed jobs dashboard** are wired. **Server Ephemera API** **`fetchThinkingResult`** (by **`workItemId`**) is shipped; **unblocked:** Redux **`thinkingResults`** slice and results sub-panel. **EventBridge** **`Job Completed`** on streamKey **`global`** is shipped; per-hop **`Thinking Schedule`** stream deferred.

Task-planning conventions: [`taskPlanning/AGENT.md`](../AGENT.md).

**Server steady-state docs:** [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../lambda/ephemera/dataSource/thinking/AGENT.md) (Dynamo keys, read/write split, EventBridge, **`fetchThinkingResult`** API).

## Purpose

Add **client-side** capabilities to **observe** thinking schedule activity and **inspect** thinking phase results: subscription to replayable schedule events (once the server publishes them), a **schedule-oriented dashboard**, a **Redux slice** for fetched results, and a **dashboard sub-panel** for results detail.

This file is task-scoped. When the initiative is done, **archive or remove** it; lasting UI patterns stay in [`charcoal-client/AGENT.md`](../../charcoal-client/AGENT.md) or feature-local docs as appropriate.

## Scope and boundaries

### In scope

- **Subscribe** to **`Job Completed`** from **`mtw.ephemera.thinking.scheduling`** over **WebSocket** (subscriptions lambda + EventBridge), using existing **Redux DataSource** patterns. Per-hop **`Thinking Schedule`** timeline is a **server follow-on** --- MVP UI is **completed jobs**, not in-flight progress.
- **Completed thinking jobs dashboard** (first operator-facing surface: list of terminal jobs from **`Job Completed`**; optional link to results detail).
- **Redux slice** (or agreed client state module) for **thinking results** fetched via the Ephemera API.
- **Dashboard sub-panel** for **thinking results** (detail view keyed by `generationId`, `workItemId`, and/or phase per API).

### Out of scope (unless explicitly added)

- **Authoring** of thinking rows from the client (server-owned).
- **Full run browser** product (may remain a thin dashboard until a later initiative).
- **Server** implementation details (owned by the companion plan).

## Decisions (locked for this phase)

1. **Subscription transport:** **WebSocket**, via the existing **`subscriptions` lambda** pattern that bridges **EventBridge**-published (replayable) DataSource updates into **WebSocket**-delivered events for client-side **Redux DataSource** wiring. **MVP:** subscribe to **`Job Completed` only** from `mtw.ephemera.thinking.scheduling`. **Follow-on:** **`Thinking Schedule`** hop updates for timelines / in-flight UX.
2. **Payload / types:** Schedule- and results-facing envelopes align with types under **`@tonylb/mtw-interfaces`** in **`eventBridge/ephemera/thinking/`** (shared contracts; client imports from there rather than duplicating shapes).
3. **Authorization:** **None** for this phase (dashboards and subscription wiring do not add AuthZ gates).
4. **Feature flags:** **None** for this phase (no flag-gated rollout for this UI slice).
5. **Redux layout:** New slice folders under `charcoal-client/src/slices/`, named **`thinkingJobs`** or **`thinkingCompletedJobs`** (subscription-driven **`Job Completed`** state; rename if **`Thinking Schedule`** stream lands later) and **`thinkingResults`** (API-fetched results), alongside existing ephemera-related slices (for example [`slices/ephemera/`](../../charcoal-client/src/slices/ephemera/), [`slices/dataSource/`](../../charcoal-client/src/slices/dataSource/)).

## Open decisions

- **MUI / layout:** Completed jobs dashboard uses a **workbench-style overlay** (Drawer desktop / Dialog mobile), opened from Command **`/dashboard`** (no URL route in MVP).

## Success criteria (client)

- Connected clients can **subscribe** to **`Job Completed`** without errors when the server publishes them.
- **Completed jobs dashboard** renders a useful minimal view (for example recent successful runs with `generationId` and segment list).
- **Results** sub-panel loads data from the **Ephemera API** and displays core fields (phase, status, timestamps, optional verbose toggles if API exposes them).
- **Tests**: Vitest + RTL per [`charcoal-client/AGENT.testing.md`](../../charcoal-client/AGENT.testing.md); meaningful coverage for slice reducers and primary UI paths.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../AGENT.md).
2. Read **testing commands for this package**: [`taskPlanning/charcoal-client/AGENT.development.md`](./AGENT.development.md) (points to [`charcoal-client/AGENT.testing.md`](../../charcoal-client/AGENT.testing.md)). **Do not** assume Jest flags; client uses Vitest.
3. Read [`charcoal-client/AGENT.md`](../../charcoal-client/AGENT.md) for architecture context (where ephemera / play subscriptions live).
4. Read **server contracts and API**: [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../lambda/ephemera/dataSource/thinking/AGENT.md) and `@tonylb/mtw-interfaces/ts/ephemera` (**`fetchThinkingResult`**).
5. Confirm **API and subscription contracts** with server PRs before building final UI shapes.

## Verification

Run from **`charcoal-client/`** (see [`AGENT.development.md`](./AGENT.development.md)):

- Baseline before edits:
  - `npm run test:single`
- After each slice (examples; adjust paths when files exist):
  - `npm run test:single -- src/slices/thinkingJobs/<file>.test.ts`
  - `npm run test:single -- src/slices/thinkingResults/<file>.test.ts`
  - `npm run test:single -- src/components/<dashboardPath>`

## Recommended order (client)

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] **Prerequisites (server-owned)**
  - [X] **`@tonylb/mtw-interfaces`** types under **`eventBridge/ephemera/thinking/`** for **`Job Completed`**, **`Thinking Schedule`** (wire shape; stream deferred), and thinking-result payloads (API response shapes TBD server-side).
  - [X] **Ephemera API** for thinking results lookup: **`fetchThinkingResult`** + **`messageType: 'ThinkingResult'`** (`ThinkingResultEvent`); use **`workItemId`** from **`Job Completed.schedules[]`** per segment.
  - [X] **EventBridge + replayable** **`Job Completed`** publisher for `mtw.ephemera.thinking.scheduling` (streamKey **`global`**; **`Thinking Schedule`** stream not required for MVP).

- [ ] **Redux slice for thinking results**
  - [ ] Actions/thunks for API fetch by agreed keys (`generationId`, `workItemId`, phase).
  - [ ] State shape, loading/error, and tests.

- [X] **Client-side subscribe to `Job Completed`**
  - [X] Wire subscription through the **subscriptions lambda** WebSocket path (EventBridge to client), consistent with existing DataSource Redux patterns.
  - [X] Tests for reducer or handler paths affected by incoming events.

- [X] **Completed thinking jobs dashboard**
  - [X] Panel entry point (Command **`/dashboard`**; `UI.thinkingDashboard` + `ThinkingDashboardContainer` in AppLayout).
  - [X] Minimal list of completed jobs (`generationId`, `completedAt`, segment summary from **`schedules[]`**).

- [ ] **`Thinking Schedule` timeline (deferred)**
  - [ ] After server emits per-hop **`Thinking Schedule`**, extend subscribe + UI for in-flight/progress views.

- [ ] **Dashboard sub-panel for thinking results**
  - [ ] Integrate slice + API into dashboard layout.
  - [ ] Optional: link from schedule row to results detail when IDs align.

- [ ] **Closeout**
  - [X] Document operator entry points in [`charcoal-client/AGENT.md`](../../charcoal-client/AGENT.md) or feature README if appropriate.
  - [ ] Update this document checkboxes and **Status** line; archive or delete per [`taskPlanning/AGENT.md`](../AGENT.md).

## Progress

| Area | Notes |
| --- | --- |
| Redux (results) | |
| Subscribe (`Job Completed`) | **`thinkingJobs`** slice; `mtw.ephemera.thinking.scheduling` / `global`; mtw-interfaces guard + aggregator |
| Completed jobs dashboard | Command **`/dashboard`**; [`ThinkingDashboard`](../../charcoal-client/src/components/ThinkingDashboard/); `thinkingJobs` / `getCompletedThinkingJobsNewestFirst` |
| Results sub-panel | |
| Schedule timeline | **Deferred** until server **`Thinking Schedule`** stream |

## Coordination with server (shipped contracts)

| Client step | Server surface |
| --- | --- |
| Subscribe (`Job Completed`) | Replayable + EventBridge on `mtw.ephemera.thinking.scheduling` / **`global`**; subscriptions WebSocket bridge |
| Completed jobs dashboard | **`Job Completed`** replay (no separate list API for MVP) |
| Schedule timeline (deferred) | Per-hop **`Thinking Schedule`** stream (not emitted yet) |
| Results slice / panel | **`fetchThinkingResult`** (`@tonylb/mtw-interfaces/ts/ephemera`); **`workItemId`** from **`Job Completed.schedules[]`** |

See [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../lambda/ephemera/dataSource/thinking/AGENT.md) for steady-state server behavior.
