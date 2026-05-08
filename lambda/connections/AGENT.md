# Connections lambda - agent notes

## Session row key shape (`Meta::Session`) and DynamoDB trade-offs

Canonical session metadata lives in the `connections` DynamoDB table with **concentrated partition key**:

- **`ConnectionId`**: always `Meta::Session` (exported as `META_SESSION_PK` from [`packages/mtw-utilities/ts/dynamoDB/sessionMetaKeys.ts`](../../packages/mtw-utilities/ts/dynamoDB/sessionMetaKeys.ts)).
- **`DataCategory`**: `SESSION#${sessionId}` (use `sessionMetaSortKey(sessionId)` next to code that writes or reads the meta row).

Payload attributes on that item are unchanged (`connections`, `player`, `dropAfter`, etc.).

**Distinct from adjacency rows**: session-character edges stay under `ConnectionId='SESSION#${sessionId}'` with `DataCategory` character ids (`CHARACTER#...`). Only the **meta document** uses the concentrated PK above.

**Reads**: Prefer `getItem` / `optimisticUpdate` on the meta key with `ConsistentRead` where callers need an immediately consistent view. To **list** all active session meta rows, query the base table (`ConnectionId = Meta::Session`, `begins_with(DataCategory, 'SESSION#')`) with `ConsistentRead` when correctness-sensitive (see internal caches).

**Storage compatibility note**: This area assumes canonical session meta rows use `ConnectionId='Meta::Session'` with `DataCategory='SESSION#${sessionId}'`. Legacy rows in the inverse orientation (`ConnectionId='SESSION#...'`, `DataCategory='Meta::Session'`) are not compatible with this read/write path and must not coexist in the same runtime.

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
  - API Gateway/WebSocket: `service: connections`, `message: registercharacter` (registration ingress authority)
  - direct invoke control messages: `dropConnection`, `checkSession`, `generateInvitation`
- EventBridge finding intake (`source: mtw.diagnostics`, `detail-type: Stale SessionId Finding`) is adapted into streaming envelopes and sent onto the same shared bus, then routed through DataSource subscription wiring plus subscribed-event guards in [`dataSource/subscribedEvents.ts`](dataSource/subscribedEvents.ts).
- API/direct-invoke responses now follow the established lambda pattern: API handlers emit bus `ReturnValue`/`Error` messages and ingress returns through [`returnValue/extractReturnValue`](returnValue/index.ts) after `messageBus.flush()`. The interim request-id promise correlation map (`pendingResponses`) was removed.
- Guard ownership split follows newer ephemera conventions:
  - [`dataSource/apiConnections.ts`](dataSource/apiConnections.ts): synthetic `api.connections` contracts/guards/helpers.
  - [`dataSource/subscribedEvents.ts`](dataSource/subscribedEvents.ts): external subscribed-source guards (`mtw.diagnostics`).
- Canonical connections EventBridge contracts now live in [`packages/mtw-interfaces/ts/eventBridge/connections`](../../packages/mtw-interfaces/ts/eventBridge/connections) (`mtw.connections`, including `Character Registered`). Character presence transitions (`Character Connected`, `Character Disconnected`) are defined under [`packages/mtw-interfaces/ts/eventBridge/connections/characters`](../../packages/mtw-interfaces/ts/eventBridge/connections/characters) for `mtw.connections.characters`. Delivery semantics for the presence lane (at least once, duplicate-tolerant consumers) are documented in [`packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md`](../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md#connections-character-presence-delivery-semantics).

**`Session Disconnect` (existing):** After a session is confirmed for drop via `checkSession` (Step Functions `dropConnection` path), the connections lambda removes session/character adjacency, emits `source: mtw.connections` / `detail-type: Session Disconnect` with `detail: { sessionId, characterIds }` (where `characterIds` is the teardown-time candidate character set for the derived `mtw.connections.characters` lane), then deletes the canonical `Meta::Session` row idempotently.

**`Character Registered` ownership:** `registercharacter` ingress routes through `connections` (`service: connections`) and applies authoritative adjacency/session mutation in [`registerCharacter/index.ts`](registerCharacter/index.ts) before emitting `Character Registered` on `mtw.connections` with stream key `CHARACTER#...`. Derived presence transitions (`Character Connected`) are emitted on `mtw.connections.characters`.

**Registration steady state:** no registration bridge remains in `ephemera`. Authoritative ingress is `service: connections` only, through [`ingress.ts`](ingress.ts) and [`registerCharacter/index.ts`](registerCharacter/index.ts).

**`mtw.connections.characters` producer invariants:**

- Subscribed lifecycle inputs are `Character Registered` and `Session Disconnect` (from `mtw.connections`).
- Presence emits are boundary-driven by character aggregate session count: connect boundary (`0 -> 1`) emits `Character Connected`; disconnect boundary (`1 -> 0`) emits `Character Disconnected`.
- Boundary checks decide emission, but adjacency/session mutation still proceeds on registration/teardown paths even when an emit is suppressed.
- The producer intentionally does not add cross-writer locking to eliminate same-window duplicate emits; at-least-once delivery with duplicate-tolerant consumers is the contract.

**`Session Disconnect` publishing path:** `tearDownStaleSession` emits `Session Disconnect` through the `mtw.connections` DataSource `streamEvent` path when invoked from the app/DataSource lane (including `characterIds`), so the derived presence lane can decide `Character Connected` / `Character Disconnected` transitions without teardown reordering. A direct EventBridge fallback exists only for non-DataSource invocation contexts.

**Presence consumer note:** `connections` is producer-only for the character presence lane; the consumer/projection owner is **`mtw.ephemera.positions`** in `lambda/ephemera/dataSource/positions/`. That lane subscribes to `Character Connected` / `Character Disconnected`, drives `Meta::Room.activeCharacters` updates, and gates arrival/departure messaging on actual projection change. See [`lambda/ephemera/AGENT.md`](../ephemera/AGENT.md) for the consumer-side contract.

**Operational guardrails (registration ingress):**

- Keep EventBridge subscription wiring for `mtw.connections.characters` -> `EphemeraFunction` enabled so presence projections continue to apply in `ephemera`.
- Avoid dual-ingress behavior: clients/services must send `registercharacter` only to `service: connections` (never `service: ephemera`).
- Registration ingress health check: query ephemera lambda logs for registration payload signatures (`message\":\"registercharacter\"`) over a representative window and expect zero matches.

**Map subscription bookkeeping:** `Map / Subscriptions` bookkeeping is removed from teardown paths. Connections does not read or write `ConnectionId='Map', DataCategory='Subscriptions'` during `checkSession` or `Stale SessionId Finding` remediation.

**`Stale SessionId Finding` consumer:** EventBridge invokes the connections lambda on `source: mtw.diagnostics`, `detail-type: Stale SessionId Finding` with payload `{ player }` per D3 (see `template.yaml` under `ConnectionFunction.Events.StaleSessionFinding`). `app.ts` delegates ingress handling to the `mtw.connections` DataSource boundary, and that lane routes to [`staleSessionFinding/index.ts`](staleSessionFinding/index.ts).

Repair behavior (connections-owned, D6):

- Enumerates session meta rows by querying `ConnectionId = Meta::Session`, `begins_with(DataCategory, 'SESSION#')` (paginated), filtered to the finding `player`.
- Query pagination now uses the shared `connectionDB.query`/`withQuery` opt-in envelope (`{ items, nextToken?, nextPage? }`) so stale-session scans avoid direct AWS SDK pagination loops and share utility guardrails/token handling.
- Re-evaluates staleness using predicates aligned with diagnostics ([`staleSessionFinding/classification.ts`](staleSessionFinding/classification.ts) must stay in sync with [`lambda/diagnostics/staleSessionSweep/classification.ts`](../diagnostics/staleSessionSweep/classification.ts)); skips rows that are no longer stale (replay / convergence).
- For each stale session, runs [`tearDownStaleSession`](staleSessionTeardown/index.ts) with `sourceOperation: 'staleSessionFinding'`. That path reuses the same adjacency removal and `Session Disconnect` emission as `checkSession`-driven teardown.

Cross-lambda ownership and intake invariants are documented in [`lambda/diagnostics/AGENT.md`](../diagnostics/AGENT.md#steady-state-invariants).
