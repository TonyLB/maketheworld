# Connections lambda - agent notes

## Session row key shape (`Meta::Session`) and DynamoDB trade-offs

Canonical session metadata lives in the `connections` DynamoDB table with **concentrated partition key**:

- **`ConnectionId`**: always `Meta::Session` (exported as `META_SESSION_PK` from [`packages/mtw-utilities/ts/dynamoDB/sessionMetaKeys.ts`](../../packages/mtw-utilities/ts/dynamoDB/sessionMetaKeys.ts)).
- **`DataCategory`**: `SESSION#${sessionId}` (use `sessionMetaSortKey(sessionId)` next to code that writes or reads the meta row).

Payload attributes on that item are unchanged (`connections`, `player`, `dropAfter`, etc.).

**Distinct from adjacency rows**: session-character edges stay under `ConnectionId='SESSION#${sessionId}'` with `DataCategory` character ids (`CHARACTER#...`). Only the **meta document** uses the concentrated PK above.

**Reads**: Prefer `getItem` / `optimisticUpdate` on the meta key with `ConsistentRead` where callers need an immediately consistent view. To **list** all active session meta rows, query the base table (`ConnectionId = Meta::Session`, `begins_with(DataCategory, 'SESSION#')`) with `ConsistentRead` when correctness-sensitive (see internal caches).

**Deploy / cutover**: Initiative decision D2 is clean-slate only. Before enabling a build that expects this shape, remove any legacy session-meta items that used the old orientation (`ConnectionId='SESSION#...'`, `DataCategory='Meta::Session'`). Rollback is revert the deploy and restore prior session behavior before reopening traffic.

**Deliberate trade-off**

- **Hot partitions**: Putting many session meta rows under one partition key increases write/read concentration on that partition compared to spreading each session across its own `SESSION#...` PK. That can surface as throttling or uneven utilization under extreme concurrent load.
- **Why we accept it**: Co-locating canonical session meta rows enables **primary-key reads with `ConsistentRead`** where correctness-sensitive paths need an immediately consistent view without relying on eventually consistent GSI queries.

This is an explicit engineering choice: **operational risk on one partition** in exchange for **predictable read semantics** on session meta. Mitigations are standard DynamoDB practice (capacity/burst behavior, observability on hot keys, rate shaping upstream), not a misunderstanding of partition limits.

When changing session storage, update this section so the trade-off stays visible to future contributors.

## Problem reports and finding subscriptions

**`Session Disconnect` (existing):** After a session is confirmed for drop via `checkSession` (Step Functions `dropConnection` path), the connections lambda removes session/character adjacency, then emits `source: mtw.connections` / `detail-type: Session Disconnect` with `detail: { sessionId }`. This emission is **intentionally decoupled** from Library/Map `Subscriptions` `SessionIds` bookkeeping (D4): it runs after adjacency removal and **before** the subscription-map updates succeed or fail.

**`Session Disconnect Problem`:** When Library/Map bookkeeping hits contention (`TransactionCanceledException`) or another failure, the lambda retries **three times** with progressive waits (100ms, 200ms, 400ms). If bookkeeping still fails, it emits `source: mtw.connections` / `detail-type: Session Disconnect Problem` with payload shaped per D3:

- `sessionId` (required)
- `player` (optional; omitted when unknown)
- `sourceOperation` (e.g. `checkSession` or `staleSessionFinding` on the EventBridge repair path)
- `attemptCount` (number of bookkeeping attempts in that batch)
- `dedupeKey` (`${sourceOperation}:${sessionId}:${ISO8601}` at start of bookkeeping retries)

Structured logs: `session-disconnect-bookkeeping-retry` (retryable failures before the last attempt) and `session-disconnect-bookkeeping-failed` (terminal bookkeeping failure before the problem report).

**Successful teardown:** After Library/Map bookkeeping succeeds, `tearDownStaleSession` deletes the `Meta::Session` row (`Meta::Session` / `SESSION#${sessionId}`) idempotently. On the normal `checkSession` path the meta row is usually already removed by the optimistic update before teardown runs; the delete is harmless when the item is absent.

**`Stale SessionId Finding` consumer:** EventBridge invokes the connections lambda on `source: mtw.diagnostics`, `detail-type: Stale SessionId Finding` with payload `{ player }` per D3 (see `template.yaml` under `ConnectionFunction.Events.StaleSessionFinding`). [`app.ts`](app.ts) routes to [`staleSessionFinding/index.ts`](staleSessionFinding/index.ts).

Repair behavior (connections-owned, D6):

- Enumerates session meta rows by querying `ConnectionId = Meta::Session`, `begins_with(DataCategory, 'SESSION#')` (paginated), filtered to the finding `player`.
- Re-evaluates staleness using predicates aligned with diagnostics ([`staleSessionFinding/classification.ts`](staleSessionFinding/classification.ts) must stay in sync with [`lambda/diagnostics/staleSessionSweep/classification.ts`](../diagnostics/staleSessionSweep/classification.ts)); skips rows that are no longer stale (replay / convergence).
- For each stale session, runs [`tearDownStaleSession`](staleSessionTeardown/index.ts) with `sourceOperation: 'staleSessionFinding'`. That path reuses the same adjacency removal, `Session Disconnect` emission (subscriptions lambda removes `STREAM#...` edges keyed on `SESSION#${sessionId}`), and Library/Map bookkeeping as `checkSession`-driven teardown.
- **D6 loop prevention:** On `staleSessionFinding`, bookkeeping failure logs `session-disconnect-bookkeeping-failed-suppressed` with `suppressedProblemReport: true` and **does not** emit `Session Disconnect Problem`, so repair does not feed the diagnostics/problem-report loop.

**Related:** Initiative progress in [`taskPlanning/lambda/diagnostics/AGENT.connectionsRefactor.planning.md`](../../taskPlanning/lambda/diagnostics/AGENT.connectionsRefactor.planning.md).
