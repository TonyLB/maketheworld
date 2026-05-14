# charcoal-client: Thinking dashboards and subscriptions (planning)

**Status:** Not started. **Blocked** on server deliverables: **TypeScript contracts** for subscription payloads and **Ephemera API** (or equivalent) for thinking results lookup. See server plan for ordering.

Task-planning conventions: [`taskPlanning/AGENT.md`](../AGENT.md).

**Server-side companion plan:** [`taskPlanning/lambda/ephemera/dataSource/thinking/AGENT.thinking.planning.md`](../lambda/ephemera/dataSource/thinking/AGENT.thinking.planning.md) (contracts, persistence, pipeline migration, EventBridge, API).

## Purpose

Add **client-side** capabilities to **observe** thinking schedule activity and **inspect** thinking phase results: subscription to replayable schedule events (once the server publishes them), a **schedule-oriented dashboard**, a **Redux slice** for fetched results, and a **dashboard sub-panel** for results detail.

This file is task-scoped. When the initiative is done, **archive or remove** it; lasting UI patterns stay in [`charcoal-client/AGENT.md`](../../charcoal-client/AGENT.md) or feature-local docs as appropriate.

## Scope and boundaries

### In scope

- **Subscribe** to thinking schedule updates over **WebSocket**, using the same **subscriptions lambda** bridge from **EventBridge**-published DataSource events into **Redux DataSource** patterns as today (see **Decisions** below).
- **Thinking schedule dashboard** (first operator-facing surface: list or timeline of schedule events / generations as defined by server contract).
- **Redux slice** (or agreed client state module) for **thinking results** fetched via the Ephemera API.
- **Dashboard sub-panel** for **thinking results** (detail view keyed by `generationId`, `workItemId`, and/or phase per API).

### Out of scope (unless explicitly added)

- **Authoring** of thinking rows from the client (server-owned).
- **Full run browser** product (may remain a thin dashboard until a later initiative).
- **Server** implementation details (owned by the companion plan).

## Decisions (locked for this phase)

1. **Subscription transport:** **WebSocket**, via the existing **`subscriptions` lambda** pattern that bridges **EventBridge**-published (replayable) DataSource updates into **WebSocket**-delivered events for client-side **Redux DataSource** wiring. Follow the same integration style as other ephemera DataSources, once `mtw.ephemera.thinking.scheduling` publishes on that path.
2. **Payload / types:** Schedule- and results-facing envelopes align with types under **`@tonylb/mtw-interfaces`** in **`eventBridge/ephemera/thinking/`** (shared contracts; client imports from there rather than duplicating shapes).
3. **Authorization:** **None** for this phase (dashboards and subscription wiring do not add AuthZ gates).
4. **Feature flags:** **None** for this phase (no flag-gated rollout for this UI slice).
5. **Redux layout:** New slice folders under `charcoal-client/src/slices/`, named **`thinkingSchedule`** (subscription-driven schedule state) and **`thinkingResults`** (API-fetched results), alongside existing ephemera-related slices (for example [`slices/ephemera/`](../../charcoal-client/src/slices/ephemera/), [`slices/dataSource/`](../../charcoal-client/src/slices/dataSource/)).

## Open decisions

- **MUI / layout:** Reuse existing dashboard shells vs new route; coordinate with design if any.

## Success criteria (client)

- Connected clients can **subscribe** (or equivalent) to thinking schedule events without errors when the server publishes them.
- **Schedule dashboard** renders a useful minimal view for at least one agreed query (for example latest generation or filtered list).
- **Results** sub-panel loads data from the **Ephemera API** and displays core fields (phase, status, timestamps, optional verbose toggles if API exposes them).
- **Tests**: Vitest + RTL per [`charcoal-client/AGENT.testing.md`](../../charcoal-client/AGENT.testing.md); meaningful coverage for slice reducers and primary UI paths.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../AGENT.md).
2. Read **testing commands for this package**: [`taskPlanning/charcoal-client/AGENT.development.md`](./AGENT.development.md) (points to [`charcoal-client/AGENT.testing.md`](../../charcoal-client/AGENT.testing.md)). **Do not** assume Jest flags; client uses Vitest.
3. Read [`charcoal-client/AGENT.md`](../../charcoal-client/AGENT.md) for architecture context (where ephemera / play subscriptions live).
4. Read the **server companion plan** for blocker order: [`../lambda/ephemera/dataSource/thinking/AGENT.thinking.planning.md`](../lambda/ephemera/dataSource/thinking/AGENT.thinking.planning.md).
5. Confirm **API and subscription contracts** with server PRs before building final UI shapes.

## Verification

Run from **`charcoal-client/`** (see [`AGENT.development.md`](./AGENT.development.md)):

- Baseline before edits:
  - `npm run test:single`
- After each slice (examples; adjust paths when files exist):
  - `npm run test:single -- src/slices/thinkingSchedule/<file>.test.ts`
  - `npm run test:single -- src/slices/thinkingResults/<file>.test.ts`
  - `npm run test:single -- src/components/<dashboardPath>`

## Recommended order (client)

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [ ] **Prerequisites (server-owned; track in companion plan)**
  - [ ] **`@tonylb/mtw-interfaces`** types under **`eventBridge/ephemera/thinking/`** for **`mtw.ephemera.thinking.scheduling`** and thinking-result payloads (and API response shapes as defined server-side) consumable from the client.
  - [ ] **Ephemera API** for thinking results lookup (stable path and JSON).
  - [ ] **EventBridge + replayable** schedule publisher live for `mtw.ephemera.thinking.scheduling` so the subscriptions bridge delivers WebSocket events.

- [ ] **Redux slice for thinking results**
  - [ ] Actions/thunks for API fetch by agreed keys (`generationId`, `workItemId`, phase).
  - [ ] State shape, loading/error, and tests.

- [ ] **Client-side subscribe to thinking schedule**
  - [ ] Wire subscription through the **subscriptions lambda** WebSocket path (EventBridge to client), consistent with existing DataSource Redux patterns.
  - [ ] Tests for reducer or handler paths affected by incoming events.

- [ ] **Thinking schedule dashboard**
  - [ ] Route or panel entry point.
  - [ ] Minimal list or timeline per contract.

- [ ] **Dashboard sub-panel for thinking results**
  - [ ] Integrate slice + API into dashboard layout.
  - [ ] Optional: link from schedule row to results detail when IDs align.

- [ ] **Closeout**
  - [ ] Document operator entry points in [`charcoal-client/AGENT.md`](../../charcoal-client/AGENT.md) or feature README if appropriate.
  - [ ] Update this document checkboxes and **Status** line; archive or delete per [`taskPlanning/AGENT.md`](../AGENT.md).

## Progress

| Area | Notes |
| --- | --- |
| Redux (results) | |
| Subscribe (schedule) | |
| Schedule dashboard | |
| Results sub-panel | |

## Coordination with server plan

| Client step | Server dependency |
| --- | --- |
| Subscribe | Replayable + EventBridge for `mtw.ephemera.thinking.scheduling`; **`@tonylb/mtw-interfaces`** `eventBridge/ephemera/thinking/` types; subscriptions lambda WebSocket bridge |
| Schedule dashboard | Same + optional list API if not embedded in stream |
| Results slice / panel | Ephemera API (WebSocket envelope per existing client → ephemera pattern) + response types from **`eventBridge/ephemera/thinking/`** |

Keep this table updated if contracts move between PRs.
