# Thinking jobs dashboard

Operator-facing overlay for **completed** thinking runs (`Job Completed` on `mtw.ephemera.thinking.scheduling`, streamKey **`global`**).

## Entry

From play, in **Command** mode, type **`/dashboard`** (leading slash required). Dispatches `openThinkingDashboard()`; the browser URL does not change.

**Return to Story** dispatches `closeThinkingDashboard()` and restores the play view underneath.

## Data

- Redux: [`slices/thinkingJobs`](../../slices/thinkingJobs/index.ts) (`getCompletedThinkingJobsNewestFirst`, `getIsThinkingJobsSubscribed`)
- UI open state: [`slices/UI/thinkingDashboard`](../../slices/UI/thinkingDashboard/index.ts)
- Mounted from [`AppLayout`](../AppLayout/index.tsx) as a sibling to `WorkbenchContainer`

## Out of scope (this component)

- Per-hop **`Thinking Schedule`** timeline (server stream deferred)
- Thinking **results** detail (needs Ephemera API + `thinkingResults` slice)
- Bookmarkable URL route for the dashboard
