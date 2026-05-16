# Thinking jobs dashboard

Operator-facing overlay for **completed** thinking runs (`Job Completed` on `mtw.ephemera.thinking.scheduling`, streamKey **`global`**) and **per-hop result** inspection via the Ephemera API.

**Server contracts (keys, API, EventBridge):** [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../lambda/ephemera/dataSource/thinking/AGENT.md). Shared wire types: `@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking`.

## Entry

From play, in **Command** mode, type **`/dashboard`** (leading slash required). Dispatches `openThinkingDashboard()` from [`MessagePanel`](../Message/MessagePanel.tsx); the browser URL does not change.

**Return to Story** dispatches `closeThinkingDashboard()` and restores the play view underneath.

## Components

| File | Role |
| --- | --- |
| `ThinkingDashboardContainer.tsx` | Drawer (desktop) / full-screen Dialog (mobile); list vs detail body |
| `CompletedJobsList.tsx` / `CompletedJobRow.tsx` | Completed jobs and clickable segment rows |
| `ThinkingResultDetail.tsx` | Result fields + collapsible `verbose` JSON |

## Data

- **Completed jobs (subscription):** [`slices/thinkingJobs`](../../slices/thinkingJobs/index.ts) -- DataSource slice; `getCompletedThinkingJobsNewestFirst`, `getIsThinkingJobsSubscribed`. Subscribed at store init (`subscribeToThinkingJobs`). See [`slices/dataSource/AGENT.md`](../../slices/dataSource/AGENT.md).
- **Thinking results (on-demand fetch):** [`slices/thinkingResults`](../../slices/thinkingResults/index.ts) -- `multipleSSM` keyed by `workItemId`; `requestThinkingResult(workItemId)` runs `addItem` + `setIntent(['READY'])` + `heartbeat`; fetch via `fetchThinkingResult` in [`index.api.ts`](../../slices/thinkingResults/index.api.ts). Iterated in [`useSSM.ts`](../../components/useSSM.ts).
- **UI overlay state:** [`slices/UI/thinkingDashboard`](../../slices/UI/thinkingDashboard/index.ts) -- `open` / `selectedWorkItemId`; `openThinkingResultDetail`, `clearThinkingResultSelection`.
- **Mount:** [`AppLayout`](../AppLayout/index.tsx) sibling to `WorkbenchContainer`.

## Results drill-down

Each completed job lists **segment rows** from `schedules[]` (`segment` + `workItemId`). Clicking a segment calls `openThinkingResultDetail(workItemId)` and swaps the panel to **Thinking result** (**Back** clears selection). Fetches use **`fetchThinkingResult`** keyed by `workItemId` (from `Job Completed.schedules[]`).

## Testing

Vitest + RTL per [`charcoal-client/AGENT.testing.md`](../../../AGENT.testing.md). Examples:

```bash
npm run test:single -- src/slices/thinkingJobs/index.test.ts
npm run test:single -- src/slices/thinkingResults/index.test.ts
npm run test:single -- src/slices/UI/thinkingDashboard/index.test.ts
npm run test:single -- src/components/ThinkingDashboard/index.test.tsx
```

## Follow-on (not in MVP)

- Per-hop **`Thinking Schedule`** timeline when the server emits that stream (types exist; ephemera publisher deferred). See server **EventBridge and subscriptions** in [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../lambda/ephemera/dataSource/thinking/AGENT.md).
- Bookmarkable URL route for the dashboard.
