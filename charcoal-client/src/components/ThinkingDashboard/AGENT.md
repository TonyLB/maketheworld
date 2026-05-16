# Thinking jobs dashboard

Operator-facing overlay for **completed** thinking runs (`Job Completed` on `mtw.ephemera.thinking.scheduling`, streamKey **`global`**).

## Entry

From play, in **Command** mode, type **`/dashboard`** (leading slash required). Dispatches `openThinkingDashboard()`; the browser URL does not change.

**Return to Story** dispatches `closeThinkingDashboard()` and restores the play view underneath.

## Data

- Completed jobs: [`slices/thinkingJobs`](../../slices/thinkingJobs/index.ts) (`getCompletedThinkingJobsNewestFirst`, `getIsThinkingJobsSubscribed`)
- Thinking results (per hop): [`slices/thinkingResults`](../../slices/thinkingResults/index.ts) (`requestThinkingResult`, `getThinkingResult`, `getThinkingResultFetchState`)
- UI open state + detail selection: [`slices/UI/thinkingDashboard`](../../slices/UI/thinkingDashboard/index.ts) (`openThinkingResultDetail`, `clearThinkingResultSelection`)
- Mounted from [`AppLayout`](../AppLayout/index.tsx) as a sibling to `WorkbenchContainer`

## Results drill-down

Each completed job lists **segment rows** from `schedules[]` (`segment` + `workItemId`). Clicking a segment opens the **Thinking result** detail view (same overlay; **Back** returns to the job list). Fetches use Ephemera **`fetchThinkingResult`** keyed by `workItemId`.

## Out of scope (this component)

- Per-hop **`Thinking Schedule`** timeline (server stream deferred)
- Bookmarkable URL route for the dashboard
