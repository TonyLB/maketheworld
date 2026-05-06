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

**`Session Disconnect` (existing):** After a session is confirmed for drop via `checkSession` (Step Functions `dropConnection` path), the connections lambda removes session/character adjacency, emits `source: mtw.connections` / `detail-type: Session Disconnect` with `detail: { sessionId }`, then deletes the canonical `Meta::Session` row idempotently.

**PR8 cutover note:** `Map / Subscriptions` bookkeeping has been removed from teardown paths. Connections no longer reads or writes `ConnectionId='Map', DataCategory='Subscriptions'` during `checkSession` or `Stale SessionId Finding` remediation.

**`Stale SessionId Finding` consumer:** EventBridge invokes the connections lambda on `source: mtw.diagnostics`, `detail-type: Stale SessionId Finding` with payload `{ player }` per D3 (see `template.yaml` under `ConnectionFunction.Events.StaleSessionFinding`). [`app.ts`](app.ts) routes to [`staleSessionFinding/index.ts`](staleSessionFinding/index.ts).

Repair behavior (connections-owned, D6):

- Enumerates session meta rows by querying `ConnectionId = Meta::Session`, `begins_with(DataCategory, 'SESSION#')` (paginated), filtered to the finding `player`.
- Re-evaluates staleness using predicates aligned with diagnostics ([`staleSessionFinding/classification.ts`](staleSessionFinding/classification.ts) must stay in sync with [`lambda/diagnostics/staleSessionSweep/classification.ts`](../diagnostics/staleSessionSweep/classification.ts)); skips rows that are no longer stale (replay / convergence).
- For each stale session, runs [`tearDownStaleSession`](staleSessionTeardown/index.ts) with `sourceOperation: 'staleSessionFinding'`. That path reuses the same adjacency removal and `Session Disconnect` emission as `checkSession`-driven teardown.

**Related:** Initiative progress in [`taskPlanning/lambda/diagnostics/AGENT.connectionsRefactor.planning.md`](../../taskPlanning/lambda/diagnostics/AGENT.connectionsRefactor.planning.md).
