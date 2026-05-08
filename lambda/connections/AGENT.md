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

**Ingress boundary (`mtw.connections` DataSource):**

- [`app.ts`](app.ts) is now a thin ingress shim that delegates all routing to [`dataSource/index.ts`](dataSource/index.ts).
- [`dataSource/index.ts`](dataSource/index.ts) now instantiates a concrete `mtw.connections` `DataSource` (`new DataSource(...)`) and calls `.subscribe()` for subscribed-event intake wiring.
- `connections` now uses a shared lambda-level bus ([`messageBus/index.ts`](messageBus/index.ts)) for both ingress adapters and DataSource subscription handling; `app.ts` clears the bus per invocation.
- Non-EventBridge ingress is normalized into canonical internal `api.connections` envelopes via [`dataSource/apiConnections.ts`](dataSource/apiConnections.ts) and enqueued onto that shared bus:
  - API Gateway/WebSocket: `$disconnect`, `/validateInvitation`, `/signIn`, `/signUp`, `/accessToken`
  - direct invoke control messages: `dropConnection`, `checkSession`, `generateInvitation`
- EventBridge finding intake (`source: mtw.diagnostics`, `detail-type: Stale SessionId Finding`) is adapted into streaming envelopes and sent onto the same shared bus, then routed through DataSource subscription wiring plus subscribed-event guards in [`dataSource/subscribedEvents.ts`](dataSource/subscribedEvents.ts).
- API/direct-invoke responses now follow the established lambda pattern: API handlers emit bus `ReturnValue`/`Error` messages and ingress returns through [`returnValue/extractReturnValue`](returnValue/index.ts) after `messageBus.flush()`. The interim request-id promise correlation map (`pendingResponses`) was removed.
- Guard ownership split follows newer ephemera conventions:
  - [`dataSource/apiConnections.ts`](dataSource/apiConnections.ts): synthetic `api.connections` contracts/guards/helpers.
  - [`dataSource/subscribedEvents.ts`](dataSource/subscribedEvents.ts): external subscribed-source guards (`mtw.diagnostics`).
- Canonical connections EventBridge contracts now live in [`packages/mtw-interfaces/ts/eventBridge/connections`](../../packages/mtw-interfaces/ts/eventBridge/connections) (`mtw.connections`, including `Character Registered`). Character presence transitions (`Character Connected`, `Character Disconnected`) are defined under [`packages/mtw-interfaces/ts/eventBridge/connections/characters`](../../packages/mtw-interfaces/ts/eventBridge/connections/characters) for `mtw.connections.characters`. Delivery semantics for the presence lane (at least once, duplicate-tolerant consumers) are documented in [`packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md`](../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md#connections-character-presence-delivery-semantics).

**`Session Disconnect` (existing):** After a session is confirmed for drop via `checkSession` (Step Functions `dropConnection` path), the connections lambda removes session/character adjacency, emits `source: mtw.connections` / `detail-type: Session Disconnect` with `detail: { sessionId }`, then deletes the canonical `Meta::Session` row idempotently.

**Publish cutover note:** `tearDownStaleSession` now emits `Session Disconnect` through `mtw.connections` DataSource `streamEvent` when invoked from the app/DataSource lane. A legacy direct EventBridge fallback remains only for non-DataSource invocation contexts.

**PR8 cutover note:** `Map / Subscriptions` bookkeeping has been removed from teardown paths. Connections no longer reads or writes `ConnectionId='Map', DataCategory='Subscriptions'` during `checkSession` or `Stale SessionId Finding` remediation.

**`Stale SessionId Finding` consumer:** EventBridge invokes the connections lambda on `source: mtw.diagnostics`, `detail-type: Stale SessionId Finding` with payload `{ player }` per D3 (see `template.yaml` under `ConnectionFunction.Events.StaleSessionFinding`). `app.ts` delegates ingress handling to the `mtw.connections` DataSource boundary, and that lane routes to [`staleSessionFinding/index.ts`](staleSessionFinding/index.ts).

Repair behavior (connections-owned, D6):

- Enumerates session meta rows by querying `ConnectionId = Meta::Session`, `begins_with(DataCategory, 'SESSION#')` (paginated), filtered to the finding `player`.
- Query pagination now uses the shared `connectionDB.query`/`withQuery` opt-in envelope (`{ items, nextToken?, nextPage? }`) so stale-session scans avoid direct AWS SDK pagination loops and share utility guardrails/token handling.
- Re-evaluates staleness using predicates aligned with diagnostics ([`staleSessionFinding/classification.ts`](staleSessionFinding/classification.ts) must stay in sync with [`lambda/diagnostics/staleSessionSweep/classification.ts`](../diagnostics/staleSessionSweep/classification.ts)); skips rows that are no longer stale (replay / convergence).
- For each stale session, runs [`tearDownStaleSession`](staleSessionTeardown/index.ts) with `sourceOperation: 'staleSessionFinding'`. That path reuses the same adjacency removal and `Session Disconnect` emission as `checkSession`-driven teardown.

Cross-lambda ownership and intake invariants are documented in [`lambda/diagnostics/AGENT.md`](../diagnostics/AGENT.md#steady-state-invariants).
