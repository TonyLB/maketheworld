# Connections consistency refactor plan

Status: in progress. Core PR1-PR7 complete; next step: lock spin-off decisions and sequence PR8-PR11.

## Purpose

Plan and sequence the connections/diagnostics/ephemera refactor work needed to reduce disconnect race failures and improve self-healing. This document is intentionally task-scoped and follows [`taskPlanning/AGENT.md`](../../AGENT.md).

## Scope and PR boundaries

The original initiative shipped in seven PRs, followed by four spin-off PRs:

1. Remove `Global / Sessions`
2. Refactor `Meta::Session` storage to concentrated PK (for instant consistent-read)
3. Add Stale Session sweep to diagnostics lambda
4. Add stale session handling in connections lambda (problem reports + `Stale SessionId Finding` repair)
5. Add Room Occupancy Drift sweep to diagnostics lambda
6. Add Room Occupancy Drift Finding to ephemera lambda
7. Remove `Library / Subscriptions`
8. Remove `Map / Subscriptions`
9. Add pagination controls to utilities `withQuery` mixin
10. Refactor connections with DataSource pattern
11. Refactor diagnostics to receive problem reports with DataSource pattern

## Getting started

1. Review planning conventions in [`taskPlanning/AGENT.md`](../../AGENT.md).
2. Review current connections cleanup flow in:
   - [`lambda/connections/app.ts`](../../../lambda/connections/app.ts)
   - [`lambda/connections/disconnect/index.ts`](../../../lambda/connections/disconnect/index.ts)
   - [`lambda/dbStream/app.ts`](../../../lambda/dbStream/app.ts)
   - [`stepFunctions/dropConnection.asl.yaml`](../../../stepFunctions/dropConnection.asl.yaml)
3. Review current subscription cleanup and fanout dependencies in:
   - [`lambda/subscriptions/app.ts`](../../../lambda/subscriptions/app.ts)
   - [`lambda/subscriptions/handlerFramework/baseClasses.ts`](../../../lambda/subscriptions/handlerFramework/baseClasses.ts)
4. Review occupancy writers/readers in ephemera:
   - [`lambda/ephemera/moveCharacter/index.ts`](../../../lambda/ephemera/moveCharacter/index.ts)
   - [`lambda/ephemera/disconnectMessage/index.ts`](../../../lambda/ephemera/disconnectMessage/index.ts)
   - [`lambda/ephemera/internalCache/roomCharacterLists.ts`](../../../lambda/ephemera/internalCache/roomCharacterLists.ts)
5. Review diagnostics entrypoints currently wired:
   - [`lambda/diagnostics/app.ts`](../../../lambda/diagnostics/app.ts)
   - [`lambda/diagnostics/AGENT.md`](../../../lambda/diagnostics/AGENT.md)
   - [`lambda/assets/selfHealing/globalValues.ts`](../../../lambda/assets/selfHealing/globalValues.ts)

## Design assumptions to preserve

- Findings remain descriptive (not imperative): e.g. `Stale SessionId Finding`, `Room Occupancy Drift Finding`.
- Producers emit problem reports; diagnostics evaluates and emits findings.
- PR4 covers both sides of stale-session work in connections: emitting `Session Disconnect Problem` when cleanup contends, and consuming `Stale SessionId Finding` to run **connections-table-only** idempotent repair (D6); diagnostics itself never mutates storage.
- Cleanup paths remain idempotent and safe under refresh races (disconnect/connect overlap).
- Refactors should not require downtime or a one-shot migration cutover unless explicitly planned.

## Open decisions (lock before implementation)

Pending decisions use `[ ]` and locked decisions use `[X]`. Add the final decision text to `Decision log` immediately after marking a decision `[X]`.

- [X] D1 - `Meta::Session` concentrated-PK data model
  - [X] Final key shape (`ConnectionId`/`DataCategory` orientation and prefixes)
  - [X] Required attributes on canonical session rows
  - [X] Attribute naming normalization (`connections`, `player`, timestamps, optional fields)

- [X] D2 - Session migration and cutover strategy
  - [X] Dual-write vs dual-read-only transition
  - [X] Backfill execution method (batch job vs lazy migration)
  - [X] Cutover readiness criteria and rollback trigger
  - [X] Compatibility-shim removal criteria

- [X] D3 - Problem-report and finding contracts
  - [X] Problem report event name and payload schema
  - [X] `Stale SessionId Finding` payload schema
  - [X] `Room Occupancy Drift Finding` payload schema
  - [X] Shared metadata (`diagnosticRunId`, source operation, attempt counts, dedupe key)

- [X] D4 - Stale-session policy thresholds
  - [X] Grace window before stale classification
  - [X] Retry budget before emitting problem report
  - [X] Escalation thresholds from problem reports to findings
  - [X] Conditions under which `Session Disconnect` must still emit

- [X] D5 - Room occupancy canonical model
  - [X] Canonical occupancy field shape (`SessionIds` vs `ConnectionIds`)
  - [X] Source-of-truth precedence when occupancy disagrees with adjacency
  - [X] Reconciliation policy for ambiguous conflicts
  - [X] Cache invalidation/update contract after reconciliation

- [X] D6 - Repair ownership boundaries
  - [X] What diagnostics does vs what it only reports
  - [X] What connections repairs vs what ephemera repairs
  - [X] Loop prevention and idempotency guarantees across lambdas

- [X] D7 - Legacy cleanup timing
  - [X] Whether `Library / Subscriptions` removal is independent or bundled
  - [X] Telemetry soak period before deleting compatibility paths
  - [X] Final removal gate for legacy docs/tests/helpers

- [X] D8 - Character connection lifecycle ownership model
  - [X] Evaluate whether `atomicallyRemoveCharacterAdjacency` remains a direct connections-owned write path
  - [X] Evaluate `Character Disconnected` event from connections (producer contract + consumer ownership)
  - [X] Evaluate `Character Connected` event from connections and/or ephemera registration path ownership
  - [X] Decide interplay with ephemera-side registration flow (`checkLocation`, presence updates, and room occupancy coherence)
  - [X] Decide final split: direct writes, event-first, or hybrid transition model

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark each nested line as progress is made; when all nested lines are complete, mark the parent line `[X]`.

- [X] PR1 - Remove `Global / Sessions`
  - [X] Inventory all reads/writes to `ConnectionId='Global', DataCategory='Sessions'`.
    - [X] Confirm direct writers in `lambda/authentication/connect.ts`, `lambda/connections/app.ts`, and `lambda/assets/selfHealing/globalValues.ts`.
    - [X] Confirm direct/indirect readers in `lambda/ephemera/internalCache/global.ts`, `lambda/ephemera/internalCache/playerSessions.ts`, `lambda/subscriptions/internalCache/playerSessions.ts`, and `lambda/assets/internalCache/playerSessions.ts`.
    - [X] Capture whether each usage is hot-path critical, cache-only, or diagnostics/self-healing only.
  - [X] Remove correctness dependencies on this record in connections hot paths.
    - [X] Remove `Global / Sessions` write from auth connect path in `lambda/authentication/connect.ts` while preserving `Meta::Connection` and `Meta::Session` writes.
    - [X] Remove `Global / Sessions` write from delayed drop flow in `lambda/connections/app.ts` while preserving `Session Disconnect` emission and `Map/Library` subscription cleanup behavior.
    - [X] Preserve idempotency and contention handling semantics around `dropConnection`/`checkSession` and Step Functions flow in `stepFunctions/dropConnection.asl.yaml`.
  - [X] Update caches/helpers that currently invert `sessions` map (replace with session-row based reads or remove dead paths).
    - [X] Replace ephemera `Global.get('sessions')` dependency (currently used by global fanout) with session-row based lookup via `DataCategoryIndex` query on `Meta::Session` in `lambda/ephemera/internalCache/global.ts` and related consumers.
    - [X] Remove or migrate `CachePlayerSessions` readers that invert `Global / Sessions` maps in subscriptions/assets/ephemera internal caches.
    - [X] Keep temporary compatibility only where required for this PR; otherwise delete dead code paths.
  - [X] Add/adjust tests to prove connect/disconnect still works without global map writes.
    - [X] Add/update auth/connect tests to verify no `Global / Sessions` write is required for successful session creation.
    - [X] Add/update connections tests around `checkSession` to verify session drop, adjacency cleanup, and `Session Disconnect` emission without `Global / Sessions` mutation.
    - [X] Add/update ephemera cache/fanout tests to verify `GLOBAL` targeting still resolves active sessions without `Global / Sessions`.
  - [X] Confirm `subscriptions` and publish fanout paths are unaffected.
    - [X] Verify `lambda/subscriptions/app.ts` `Session Disconnect` cleanup remains keyed on `SESSION#...` stream rows, not `Global / Sessions`.
    - [X] Verify `lambda/subscriptions/handlerFramework/baseClasses.ts` publish fanout continues to resolve via `SessionConnections` (`Meta::Session` -> `connections`).
    - [X] Run targeted subscriptions tests to guard against accidental `Global / Sessions` coupling.
  - [X] Update durable documents after implementation lands.
    - [X] Update relevant area docs (`lambda/*/AGENT.md` and/or task docs) to reflect that runtime correctness no longer depends on `Global / Sessions`.
    - [X] Update this planning file checkboxes and progress notes last, after verification commands pass.

- [X] PR2 - Refactor `Meta::Session` storage to concentrated PK
  - [X] Implement concentrated-PK key orientation for canonical session rows (`ConnectionId='Meta::Session'`, `DataCategory='SESSION#...'`) with unchanged payload shape.
  - [X] Migrate writers (`connect`, `dropConnection`, `checkSession`, related caches).
  - [X] Update query callsites to primary-index query patterns with `ConsistentRead` where needed.
  - [X] Remove legacy-shape readers/writers (no dual-read/dual-write or backfill path in clean-slate cutover).
  - [X] Validate post-cutover smoke checks against canonical-only session behavior.
  - [X] Document deliberate DynamoDB trade-off for concentrated `Meta::Session` PK: hot-partition pressure vs instant `ConsistentRead` session lookups (we choose the latter knowingly).
    - [X] Add durable documentation (see [`lambda/connections/AGENT.md`](../../../lambda/connections/AGENT.md)); keep this task plan as a pointer only.

- [X] PR3 - Add Stale Session sweep to diagnostics lambda
  - [X] Implement diagnostics sweep that evaluates:
    - [X] session rows without active connections beyond grace window
    - [X] stream subscriptions referencing stale session IDs
    - [X] session/character adjacency inconsistencies
  - [X] Emit `Stale SessionId Finding` payload `{ player }` (optional `diagnosticRunId` on diagnostics sweeps).
  - [X] Add tests for false-positive suppression and repeated-run idempotency.

- [X] PR4 - Stale session handling in connections lambda (problem reports + `Stale SessionId Finding` repair)
  - [X] **Problem reports (`mtw.connections` producer):** Implement `Session Disconnect Problem` emission points for cleanup conflicts/failures.
  - [X] **Problem reports:** Ensure problem reports are emitted outside recursive cleanup internals.
  - [X] **Problem reports:** Decouple `Session Disconnect` emission from contested bookkeeping writes.
  - [X] **Problem reports:** Add bounded retry (3 attempts, progressive waits) + structured logging for cleanup conflict paths.
  - [X] **Problem reports:** Add tests covering refresh race (disconnect old / connect new overlap).
  - [X] **Finding-driven repair:** Wire connections lambda to consume `mtw.diagnostics` / `Stale SessionId Finding` (EventBridge subscription + handler path; mirror the PR6 pattern where ephemera consumes occupancy drift findings).
  - [X] **Finding-driven repair:** Implement idempotent reconciliation limited to **`connections` table** state for the affected player (D6 ownership). The finding payload is `{ player }` only (D3): resolve affected sessions/rows via `Meta::Session` / existing keyed lookups, then reuse or factor cleanup primitives (`checkSession`-equivalent drops, `STREAM#` subscription edges, session-character adjacency under `SESSION#...`) without crossing into ephemera-owned repairs.
  - [X] **Finding-driven repair:** Observe D6 loop prevention: finding handlers must not emit `Session Disconnect Problem` on the same remediation path; any escalation signal must be a distinct higher-severity diagnostic contract if needed.
  - [X] **Finding-driven repair:** Add tests for replay idempotency and for “repair does not recreate problem-report noise” alongside producer-path tests.
  - [X] Update durable docs after implementation: extend [`lambda/connections/AGENT.md`](../../../lambda/connections/AGENT.md) with problem-report vs finding-repair responsibilities and EventBridge wiring notes.

- [X] PR5 - Add Room Occupancy Drift sweep to diagnostics lambda
  - [X] Implement occupancy drift sweep using locked invariants (`SessionIds` canonical; adjacency + `Meta::Character.RoomId` authoritative).
  - [X] Delegate ambiguous/invalid location cases to `checkLocation` (diagnostics marks candidates for downstream repair handling; no direct repair writes in diagnostics).
  - [X] Emit `Room Occupancy Drift Finding` payload `{ roomId }` (optional `diagnosticRunId` on diagnostics sweeps).
  - [X] Add tests for mixed-valid/mixed-invalid room states.

- [X] PR6 - Add Room Occupancy Drift Finding handling to ephemera lambda
  - [X] Wire ephemera intake for `mtw.diagnostics` room-occupancy finding events.
  - [X] Implement corrective reconciliation for affected room records (derived room occupancy reconciled to authoritative adjacency + `Meta::Character.RoomId`).
  - [X] Ensure cache invalidation/update contract after reconciliation (`RoomCharacterList`, `ComponentEphemeraMeta`, `ComponentStackMerge`) and room update signaling.
  - [X] Add tests for idempotent replays and partial-repair scenarios.

- [X] PR7 - Remove `Library / Subscriptions`
  - [X] Remove remaining read paths for `ConnectionId='Library', DataCategory='Subscriptions'`.
  - [X] Remove cleanup writes against legacy `Library / Subscriptions` record.
  - [X] Update docs/comments describing this record as active behavior.
  - [X] Add regression tests confirming no subscription behavior depends on legacy record.

## Progress

| PR | Scope | Status | Notes |
| --- | --- | --- | --- |
| 1 | Remove `Global / Sessions` | Complete | Hot-path writes removed; fanout/session-cache readers moved to `Meta::Session` queries |
| 2 | Refactor `Meta::Session` storage | Complete | Concentrated PK (`Meta::Session` / `SESSION#...`); `connectionDB.query` supports base-table `ConsistentRead`; helpers in `mtw-utilities/sessionMetaKeys` |
| 3 | Diagnostics stale-session sweep | Complete | Sweep + `Stale SessionId Finding`; see [`lambda/diagnostics/AGENT.md`](../../../lambda/diagnostics/AGENT.md) |
| 4 | Connections stale-session handling | Complete | Problem reports + finding-driven repair ([`lambda/connections/staleSessionFinding`](../../../lambda/connections/staleSessionFinding/index.ts), [`staleSessionTeardown`](../../../lambda/connections/staleSessionTeardown/index.ts)); see [`lambda/connections/AGENT.md`](../../../lambda/connections/AGENT.md) |
| 5 | Diagnostics occupancy-drift sweep | Complete | Direct-invoke sweep implemented; emits `Room Occupancy Drift Finding`; mixed-valid/mixed-invalid coverage added in diagnostics tests |
| 6 | Ephemera occupancy-drift handling | Complete | Ephemera now consumes `Room Occupancy Drift Finding` via DataSource deserializer lane and runs idempotent room self-healing in `dataSource/selfHealing/roomOccupancyDriftFinding.ts` with cache invalidation + `RoomUpdate` signaling |
| 7 | Remove `Library / Subscriptions` | Complete | See PR7 verification below; dead `librarySubscriptions` cache key removed; `Map / Subscriptions` removal deferred to PR8 |

### PR3 verification (completed)

- `cd lambda/diagnostics && npm test`
- `cd packages/mtw-interfaces && npm test -- --testPathPattern=eventBridge/diagnostics`

### PR4 verification (slice 1)

- `cd lambda/connections && npm test`
- `cd lambda/diagnostics && npm test` (sanity; no direct code change in this slice)

### PR4 verification (slice 2)

- `cd lambda/connections && npm test`
- `cd lambda/diagnostics && npm test` (sanity after classification parity in connections)

### PR5 verification (completed)

- `npm --prefix "/Users/anthonylower-basch/Code/maketheworld/lambda/diagnostics" test`
- `npm --prefix "/Users/anthonylower-basch/Code/maketheworld/packages/mtw-interfaces" test -- --testPathPattern=eventBridge/diagnostics`

### PR6 verification (completed)

- `npm --prefix "/Users/anthonylower-basch/Code/maketheworld/lambda/ephemera" test`
- `npm --prefix "/Users/anthonylower-basch/Code/maketheworld/lambda/diagnostics" test -- --testPathPattern=roomOccupancyDriftSweep`
- `npm --prefix "/Users/anthonylower-basch/Code/maketheworld/packages/mtw-interfaces" test -- --testPathPattern=eventBridge/diagnostics`

### PR7 verification (completed)

- `npm --prefix "/Users/anthonylower-basch/Code/maketheworld/lambda/connections" test`
- `npm --prefix "/Users/anthonylower-basch/Code/maketheworld/lambda/assets" test`
- `rg -n "ConnectionId: 'Library'" lambda packages --glob '!**/*.test.ts'` (expect no matches; `app.test.ts` keeps a negative regression assertion on that key)

### PR8 verification (completed)

- `npm --prefix "/Users/anthonylower-basch/Code/maketheworld/lambda/connections" test`
- `npm --prefix "/Users/anthonylower-basch/Code/maketheworld/lambda/ephemera" test`
- `npm --prefix "/Users/anthonylower-basch/Code/maketheworld/lambda/subscriptions" test`
- `rg -n "ConnectionId:\s*'Map'|DataCategory:\s*'Subscriptions'|mapSubscriptions" lambda --glob '!**/*.test.ts'` (expect no matches)

### PR9 verification (completed)

- `npm --prefix "/Users/anthonylower-basch/Code/maketheworld/packages/mtw-utilities" test -- --testPathPattern=dynamoDB/mixins/query`
- `npm --prefix "/Users/anthonylower-basch/Code/maketheworld/lambda/connections" test -- --testPathPattern=staleSessionFinding`
- `npm --prefix "/Users/anthonylower-basch/Code/maketheworld/lambda/diagnostics" test -- --testPathPattern=staleSessionSweep`

### PR10 verification (completed)

- `npm --prefix "/Users/anthonylower-basch/Code/maketheworld/lambda/connections" test`
- `npm --prefix "/Users/anthonylower-basch/Code/maketheworld/lambda/connections" test -- --testPathPattern=app`
- `npm --prefix "/Users/anthonylower-basch/Code/maketheworld/lambda/connections" test -- --testPathPattern=staleSessionFinding`
- `npm --prefix "/Users/anthonylower-basch/Code/maketheworld/lambda/connections" test -- --testPathPattern=staleSessionTeardown`
- `npm --prefix "/Users/anthonylower-basch/Code/maketheworld/lambda/diagnostics" test -- --testPathPattern=staleSessionSweep` (sanity: finding producer/consumer contract unchanged)

## Decision log

Record each locked decision here in order. Keep entries concise and implementation-oriented.

| ID | Status | Decision |
| --- | --- | --- |
| D1 | Locked | Keep canonical session payload shape unchanged from current `SESSION#... / Meta::Session` rows, but flip key orientation to concentrated PK (`ConnectionId='Meta::Session'`, `DataCategory='SESSION#...'`). No payload contract changes in this decision; key-orientation update only. |
| D2 | Locked | Use clean-slate cutover: manually clean the connections table before rollout so there are no legacy session records to migrate. Do not implement dual-write, dual-read, or backfill logic. Read/write only the new concentrated-PK `Meta::Session` shape after deploy. Rollback trigger: if post-deploy smoke checks fail, revert code and restore known-good session behavior before reopening traffic. |
| D3 | Locked | Problem report emitted from `mtw.connections` with `detail-type: Session Disconnect Problem` and payload `{ sessionId, player }` (player may be empty/omitted if unavailable). Problem reports carry operational metadata `{ sourceOperation, attemptCount, dedupeKey }` for suppression/escalation. Findings stay minimal and descriptive: `Stale SessionId Finding` payload `{ player }`, `Room Occupancy Drift Finding` payload `{ roomId }`, with optional `diagnosticRunId` on diagnostics-emitted findings/sweeps only. |
| D4 | Locked | Keep existing disconnect grace behavior (~4s `dropAfter` with 5s Step Functions wait before `checkSession`) as stale-classification timing baseline. Use retry budget of 3 attempts with progressive waits before emitting `Session Disconnect Problem`. Do not require a separate connections-side escalation threshold; each problem report triggers diagnostics evaluation, and diagnostics determines whether a finding exists. Emit `Session Disconnect` whenever session drop is confirmed (`shouldDrop` true), even if contested bookkeeping writes fail. |
| D5 | Locked | Canonical room occupancy field is `SessionIds`. In drift conflicts, session/character adjacency is authoritative, with `Meta::Character.RoomId` authoritative for room membership. Ambiguous/invalid location cases delegate to `checkLocation` for legal relocation resolution (including fallback behavior) rather than ad hoc occupancy guesses. Post-reconciliation contract: refresh/invalidate room-related ephemera caches (`RoomCharacterList`, `ComponentEphemeraMeta`, `ComponentStackMerge`) and emit room update signaling for affected room state. |
| D6 | Locked | Diagnostics is report-only: it emits findings and does not perform data repairs. Repair ownership is table/domain bounded: connections repairs only `connections` table state; ephemera repairs only `ephemera` table state. Loop prevention rule: healing paths must not emit same-path problem reports; if healing emits any problem signal, it must be escalation-only to a distinct higher-severity diagnostic path with a different remediation path. All repair handlers must be idempotent under replay. |
| D7 | Locked | With clean-slate pre-cutover cleanup, remove legacy compatibility paths immediately (no telemetry soak period required for compatibility code). `Library / Subscriptions` legacy removal can proceed directly in-scope for this initiative without staged dual-path support. Final gate is successful post-deploy smoke checks and updated docs/tests reflecting only canonical behavior. |
| D8 | Locked | Adopt event-first eventual-consistency model for character connection lifecycle. Connections remains authoritative for `connections`-table state and emits lifecycle events (`Character Connected` / `Character Disconnected`) instead of relying on direct cross-table adjacency mutation as steady-state architecture. Ephemera consumes lifecycle events and converges room/character presence asynchronously, accepting short-lived ghost presence as an intentional tradeoff. `checkLocation` and diagnostics drift sweeps remain convergence/repair backstops. |
| D9 | Locked | For PR8, replace legacy map-subscription behavior with a temporary `mtw.ephemera.maps` DataSource stub that returns syntactically valid empty snapshots on subscribe. Treat map publishing/perception integration as intentionally deferred (temporary functionality gap accepted). |
| D10 | Locked | Use one-shot cutover for PR8: sever runtime dependency on `Map / Subscriptions` and old imperative fanout path immediately, keep client-facing subscribe/unsubscribe request/ack semantics stable, and do not run a compatibility dual-path window. |
| D11 | Locked | During stub window, map-update hot-path performance constraints are out of scope (`N/A` beyond "no regression outside maps"). Define replacement latency/read-amplification budgets in deferred map subscription refactor planning. |
| D12 | Locked | Cleanup ownership in PR8: remove `Map / Subscriptions` coupling from connections/ephemera hot paths now, archive orphaned imperative map-subscription code for reference, and defer canonical ownership/fanout redesign to [`taskPlanning/lambda/ephemera/AGENT.mapSubscriptionRefactor.planning.md`](../ephemera/AGENT.mapSubscriptionRefactor.planning.md). |
| D13 | Locked | `withQuery` pagination API uses an overloaded opt-in contract: default calls keep returning `Promise<T[]>` (full result compatibility), while `pagination`-opted calls return a page envelope with `items`, optional `nextToken`, and optional `nextPage()` callback that resolves to the same envelope shape. |
| D14 | Locked | Preserve default callsite compatibility: `withQuery` remains full-result `Promise<T[]>` unless callers explicitly opt into pagination. No existing non-paginated query consumers should require code changes for this PR. |
| D15 | Locked | Standardize on opaque pagination tokens at the utility boundary: callers pass/receive `nextToken` strings, while `withQuery` internally encodes/decodes DynamoDB `LastEvaluatedKey` state (no raw `ExclusiveStartKey` contract at callsites). |
| D16 | Locked | Enforce page-size guardrails in `withQuery`: apply a conservative default page size for paginated calls, clamp caller-provided limits to a max, and allow override only through an explicit internal policy hook (not ad hoc per-call bypasses). |
| D17 | Locked | PR10 uses an app-level DataSource boundary in `lambda/connections/app.ts` (ingress normalization + routing/dispatch), while keeping teardown/repair internals on existing module boundaries for parity and risk control. Deep internal compositional rewrite is explicitly deferred to follow-up work and should reuse the normalized ingress contract established in PR10. |
| D18 | Locked | Normalize non-EventBridge ingress in connections to a canonical internal StreamingEvent envelope under `api.connections` (WebSocket/API Gateway + direct invoke/legacy message paths adapt at ingress), then route through one app-level dispatch path. Keep EventBridge ingestion on its native envelope, mapped via a dedicated adapter into the same internal dispatch contract. |
| D19 | Locked | Use a clean one-shot swap for PR10 (no strangler dual-route and no runtime feature flag): replace app-level ingress/dispatch wiring in one cut while preserving external contracts. Safety checks are test-first parity coverage across all ingress families (`$disconnect`, auth HTTP paths, direct-invoke control messages, EventBridge finding intake) plus post-deploy smoke verification of disconnect/session teardown and finding-triggered repair behavior. |
| D20 | Locked | Test migration for PR10 is parity-first and minimal-change: keep existing `lambda/connections/app.test.ts` suites as primary regression harness, add focused ingress-normalization/adapter tests for `api.connections` mapping across ingress families, and introduce only lightweight shared fixtures/helpers needed to avoid duplicated event-shape setup. Defer broader test-architecture refactor to follow-up work aligned with any future deep internal composition changes. |
| D21 | Locked | Schema ownership is interfaces-first with staged adoption: PR10 establishes `mtw.connections` EventBridge/DataSource contracts and serializer in `packages/mtw-interfaces/ts/eventBridge/connections`, and PR11 migrates diagnostics intake to standard DataSource subscription/deserialization against that shared serializer. Diagnostics-local code may keep thin transport adapters but does not define canonical problem-report schemas. |
| D22 | Locked | Place dedupe in the diagnostics DataSource intake layer before downstream sweep/finding handlers run. Handlers receive already-deduped canonical report envelopes and remain focused on evaluation/emission logic. |
| D23 | Locked | No cross-source ordering guarantee is required for PR11. Different problem-report types may be processed independently/in parallel; diagnostics behavior should be correct under eventual consistency without relying on ordered delivery between report families. |
| D24 | Locked | Malformed/partial problem reports are handled as tidy non-throw failures in intake: validate, log structured diagnostics, and drop/skip invalid events without crashing handler execution. Advanced retry/escalation policy is explicitly deferred follow-up work. |

## Spin-off follow-up planning (post PR7)

These items are intentionally blocked on explicit decisions before implementation starts. Pending decisions use `[ ]`; move to `[X]` and add final wording to the decision log (or a follow-up decision subsection) before coding.

### Candidate PR8 - Remove `Map / Subscriptions`

- Goal: eliminate remaining correctness dependencies on the `ConnectionId='Map', DataCategory='Subscriptions'` aggregate row.
- Known current usage (from PR7 context):
  - Connections teardown bookkeeping currently removes session IDs from Map subscriptions.
  - Ephemera map subscription/fanout paths still read/write Map subscriptions.
  - Disconnect/cleanup paths across lambdas assume this aggregate exists.
- PR8 implementation inventory (completed):
  - Writers removed: `lambda/connections/disconnect/index.ts`, `lambda/connections/staleSessionTeardown/index.ts`, `lambda/ephemera/mapSubscription/index.ts`, `lambda/ephemera/disconnectMessage/index.ts`
  - Readers/fanout paths severed: `lambda/ephemera/internalCache/global.ts`, `lambda/ephemera/mapUpdate/index.ts`, `lambda/ephemera/ephemeraUpdate/index.ts`
  - Regression coverage updated: `lambda/connections/app.test.ts`, `lambda/connections/disconnect/index.test.ts`, `lambda/connections/staleSessionTeardown/index.test.ts`, `lambda/ephemera/mapSubscription/index.test.ts`
- Locked decisions:
  - [X] D9 - Canonical temporary behavior after removing aggregate row is a `mtw.ephemera.maps` stub DataSource that publishes syntactically valid empty snapshots; map publishing functionality is intentionally deferred.
  - [X] D10 - One-shot cutover (no compatibility read window): remove runtime coupling to `Map / Subscriptions` while preserving subscribe/unsubscribe request/ack semantics.
  - [X] D11 - Replacement hot-path performance targets are deferred until full map/perception redesign; PR8 acceptance is correctness/isolation, not map-publish performance.
  - [X] D12 - Archive old imperative map-subscription code as deferred reference and track full ownership redesign in [`taskPlanning/lambda/ephemera/AGENT.mapSubscriptionRefactor.planning.md`](../ephemera/AGENT.mapSubscriptionRefactor.planning.md).

### Candidate PR9 - Add pagination controls to utilities `withQuery` mixin

- Goal: support explicit page size / pagination token controls in shared query helper(s) to avoid one-shot scans in high-cardinality reads.
- Expected blast radius: `packages/mtw-utilities` query consumers across lambdas (connections, diagnostics, ephemera, assets, subscriptions).
- Decisions/unknowns to lock:
  - [X] D13 - Pagination API shape in `withQuery`: overloaded opt-in contract where default calls return `Promise<T[]>`, and paginated calls return `{ items, nextToken?, nextPage? }` with `nextPage()` returning the same page-envelope shape.
  - [X] D14 - Default behavior compatibility: preserve current full-result `Promise<T[]>` behavior unless pagination is explicitly opted in.
  - [X] D15 - Token contract standardization: expose opaque `nextToken` strings and keep raw DynamoDB pagination keys internal to `withQuery`.
  - [X] D16 - Max page-size guardrails and caller override policy: clamp requested limits to utility-level defaults/max bounds, with explicit internal-only override path.

### Candidate PR10 - Refactor connections with DataSource pattern

- Goal: align connections lambda event ingestion/dispatch with the DataSource pattern used in newer areas for consistency and testability.
- Scope candidate: app entrypoint routing + event normalization + message handlers while preserving existing contracts (`Session Disconnect`, problem reports, stale-session finding handling).
- Decisions/unknowns to lock:
  - [X] D17 - Target DataSource boundary in connections: create one `mtw.connections` DataSource boundary for PR10 (shallow app-level ingress normalization + dispatch). Do not split connections into multiple internal DataSources in this PR; teardown/repair internals remain on current module boundaries and deeper compositional rewrite is deferred.
  - [X] D18 - Event envelope normalization strategy: use canonical `api.connections` internal envelopes for non-EventBridge ingress, with adapters at ingress and unified app-level dispatch; map EventBridge events through a dedicated adapter to the same dispatch contract. Transport normalization happens once at ingress: do not add bypass routes that manually handle EventBridge findings outside the DataSource subscription/deserialization path, and do not synthesize internal events after bespoke handling.
  - [X] D19 - Rollout strategy: clean one-shot swap (no strangler route/feature flag) with ingress-parity test coverage and post-deploy smoke checks.
  - [X] D20 - Test migration strategy: parity-first/minimal change (retain `app.test.ts` as primary harness, add focused adapter tests, and only lightweight fixture extraction).

### Candidate PR11 - Refactor diagnostics to receive problem reports with DataSource pattern

- Goal: move diagnostics intake (especially problem-report ingestion) onto DataSource pattern for shared deserialization, dedupe hooks, and clearer contracts.
- Scope candidate: diagnostics app entrypoint + report/finding dispatch; maintain report-only repair ownership boundary (D6).
- Decisions/unknowns to lock:
  - [X] D21 - Problem-report intake schema ownership: interfaces-first (`mtw-interfaces` owns canonical `mtw.connections` serializer/contracts; diagnostics consumes via DataSource subscription with only thin local adapters).
  - [X] D22 - Dedupe placement: in DataSource intake before downstream sweep/finding handlers.
  - [X] D23 - Cross-source ordering/consistency: no ordering guarantees; report families may process independently/in parallel.
  - [X] D24 - Malformed/partial payload semantics: tidy non-throw intake failure with structured logging and drop/skip; advanced retry/escalation deferred.

## Recommended order (spin-off PRs)

Pending work uses `[ ]` and completed work uses `[X]`. Mark each nested line as progress is made; when all nested lines are complete, mark the parent line `[X]`.

- [X] PR8 - Remove `Map / Subscriptions`
  - [X] Lock D9-D12 before implementation.
  - [X] Create deferred follow-up plan doc [`taskPlanning/lambda/ephemera/AGENT.mapSubscriptionRefactor.planning.md`](../ephemera/AGENT.mapSubscriptionRefactor.planning.md) using `taskPlanning/AGENT.md` conventions.
  - [X] Inventory all read/write paths to `ConnectionId='Map', DataCategory='Subscriptions'`.
  - [X] Implement temporary `mtw.ephemera.maps` stub DataSource (empty snapshot-on-subscribe contract, syntactically valid payload).
  - [X] Preserve subscribe/unsubscribe request/ack correlation semantics expected by client state machines.
  - [X] Sever runtime fanout dependency on imperative map-subscription paths (intentional temporary map-publishing gap).
  - [X] Remove legacy cleanup writes and compatibility reads.
  - [X] Add regression tests for disconnect cleanup plus explicit "stub-window" map behavior (subscribe/unsubscribe ack succeeds; map updates intentionally absent).
  - [X] Update durable docs after implementation lands.

- [X] PR9 - Add pagination controls to utilities `withQuery` mixin
  - [X] Lock D13-D16 before implementation.
  - [X] Extend utilities API with pagination primitives and type-safe return contract.
  - [X] Add utility-level unit tests for token round-trip, limits, and compatibility defaults.
  - [X] Migrate at least one high-cardinality caller as proving ground.
  - [X] Document usage guidance in durable docs.

- [X] PR10 - Refactor connections with DataSource pattern
  - [X] Lock D17-D20 before implementation.
  - [X] Introduce one `mtw.connections` DataSource module under [`lambda/connections/dataSource`](../../../lambda/connections/dataSource) and wire [`lambda/connections/app.ts`](../../../lambda/connections/app.ts) to route ingress through it (single shallow DataSource boundary only; no multi-DataSource internal decomposition), with adapters for:
    - [X] API Gateway/WebSocket (`$disconnect`, HTTP auth endpoints).
    - [X] direct invoke control messages (`dropConnection`, `checkSession`, `generateInvitation`).
    - [X] EventBridge `mtw.diagnostics` / `Stale SessionId Finding`.
  - [X] Establish canonical internal `api.connections` envelope contract for non-EventBridge ingress (D18) and route all normalized envelopes through the single `mtw.connections` DataSource dispatch path.
  - [X] Consume `mtw.diagnostics` / `Stale SessionId Finding` through the same DataSource subscription/deserialization lane as other inbound events (serializer + subscribed event guard), rather than a bespoke `app.ts` EventBridge branch.
  - [X] Preserve handler contracts and behavior parity during route migration:
    - [X] `disconnect(connectionId)` behavior unchanged.
    - [X] auth/invitation endpoint response shapes unchanged.
    - [X] `dropConnection` and `checkSession` semantics unchanged (including `dropAfter` timing + `shouldDrop` gating).
    - [X] finding intake still delegates to `handleStaleSessionFinding`.
    - [X] remove direct `event.source/event['detail-type']` finding bypass from `app.ts`; the canonical path is transport adapter -> envelope -> DataSource subscription handler.
  - [X] Preserve retry/escalation semantics and loop-prevention guarantees by ensuring refactor does not alter:
    - [X] `tearDownStaleSession(..., { sourceOperation })` call paths.
    - [X] problem-report suppression rules on finding remediation paths (D6).
    - [X] Step Functions `dropConnection` flow compatibility.
  - [X] Update/port tests to DataSource-oriented coverage (D20):
    - [X] keep [`lambda/connections/app.test.ts`](../../../lambda/connections/app.test.ts) as primary parity harness.
    - [X] add focused adapter/normalization tests for each ingress family.
    - [X] extract only lightweight shared fixtures to reduce duplicated event-shape setup.
  - [X] Update durable docs after implementation lands.
    - [X] Extend [`lambda/connections/AGENT.md`](../../../lambda/connections/AGENT.md) with the new ingress/dispatch DataSource boundary and adapter map.
    - [X] Update this planning doc checkboxes/progress/verification last, after tests pass.

- [ ] PR11 - Refactor diagnostics to receive problem reports with DataSource pattern
  - [X] Lock D21-D24 before implementation.
  - [ ] Establish producer-side `mtw.connections` DataSource baseline first (pre-intake dependency):
    - [ ] Introduce an instantiated `mtw.connections` DataSource (`new DataSource(...)` + `.subscribe()`) for app-level publishing/subscription wiring, replacing the current adapter-only module shape.
    - [ ] Define canonical `mtw.connections` problem-report serializer/contracts in [`packages/mtw-interfaces/ts/eventBridge/connections`](../../../packages/mtw-interfaces/ts/eventBridge/connections) and wire connections to use them.
    - [ ] Move connections problem-report emission paths to DataSource `streamEvent` publishing without changing existing operational semantics.
  - [ ] Introduce DataSource intake for diagnostics problem reports/findings triggers.
    - [ ] Consume the shared `mtw.connections` serializer/contracts from interfaces (no diagnostics-local canonical schema duplication).
    - [ ] Keep thin diagnostics transport adapters only; route canonical envelopes through one diagnostics DataSource subscription/deserialization lane.
  - [ ] Preserve D6 ownership boundaries and existing finding contracts.
  - [ ] Add replay/idempotency and malformed-payload handling tests.
  - [ ] Update durable docs after implementation lands.

## Progress (spin-off PRs)

| PR | Scope | Status | Notes |
| --- | --- | --- | --- |
| 8 | Remove `Map / Subscriptions` | Complete | Removed runtime `Map / Subscriptions` coupling from connections + ephemera paths; subscribe/unsubscribe acks now return empty stub snapshots; map publish fanout intentionally absent pending deferred redesign plan |
| 9 | Add pagination controls to utilities `withQuery` mixin | Complete | `withQuery` now supports opt-in pagination envelope with opaque token handling + guardrails; stale-session proving-ground migrations landed in both `connections` and `diagnostics` paths |
| 10 | Refactor connections with DataSource pattern | Complete | Added shallow `mtw.connections` ingress boundary in `lambda/connections/dataSource`; `app.ts` now delegates through canonical `api.connections` normalization and subscribed-event guard intake for diagnostics finding handling |
| 11 | Refactor diagnostics to receive problem reports with DataSource pattern | Not started | Starts with producer-side `mtw.connections` DataSource + interfaces contract wiring, then rolls into diagnostics intake migration |

## Verification strategy by phase

Use commands from each lambda/package-specific test documentation where present. For every PR:

- Run targeted unit tests for changed lambdas.
- Run at least one integration path covering disconnect -> session cleanup -> subscription cleanup.
- Validate no new lints/typescript errors in touched files.

Minimum checks per PR (adapt paths as needed):

- `lambda/connections` tests for connect/disconnect/checkSession behavior, problem reports, and (PR4) `Stale SessionId Finding` repair paths
- `lambda/subscriptions` tests for stream cleanup and publish routing
- `lambda/diagnostics` tests for finding emission and dedupe behavior
- `lambda/ephemera` tests for room occupancy reconciliation (for PR6)

## Risks and mitigations

- Risk: transient breakage during key-shape migration for sessions.
  - Mitigation: dual-read/dual-write transition with explicit cutover checkpoint.
- Risk: diagnostics event loops.
  - Mitigation: strict producer/diagnostics role split and event-source guards.
- Risk: noisy findings on transient contention.
  - Mitigation: problem reports first, diagnostics thresholds before finding emission.
- Risk: occupancy model drift due to mixed `SessionIds`/`ConnectionIds` shapes.
  - Mitigation: normalize shape contract before or during PR5/PR6, with compatibility reads during transition.

## Done criteria for this initiative

- `Global / Sessions` removed from correctness-critical paths.
- Session cleanup no longer depends on high-contention global map writes.
- Diagnostics emits reliable `Stale SessionId Finding` and `Room Occupancy Drift Finding`.
- Connections emits structured problem reports on cleanup contention/failure.
- Connections applies idempotent `connections`-table reconciliation in response to `Stale SessionId Finding` (repair ownership per D6; no diagnostics-side writes).
- Ephemera can reconcile room occupancy drift findings idempotently.
- `Library / Subscriptions` legacy record and references removed.
