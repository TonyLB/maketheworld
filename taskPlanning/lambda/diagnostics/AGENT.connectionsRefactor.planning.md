# Connections consistency refactor plan

Status: in progress. Next step: align contracts and baseline checks for PR1 (`Remove Global / Sessions`).

## Purpose

Plan and sequence the connections/diagnostics/ephemera refactor work needed to reduce disconnect race failures and improve self-healing. This document is intentionally task-scoped and follows [`taskPlanning/AGENT.md`](../../AGENT.md).

## Scope and PR boundaries

This initiative is structured into seven PRs:

1. Remove `Global / Sessions`
2. Refactor `Meta::Session` storage to concentrated PK (for instant consistent-read)
3. Add Stale Session sweep to diagnostics lambda
4. Add Stale Session handling in connections lambda
5. Add Room Occupancy Drift sweep to diagnostics lambda
6. Add Room Occupancy Drift Finding to ephemera lambda
7. Remove `Library / Sessions`

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
   - [`lambda/assets/selfHealing/globalValues.ts`](../../../lambda/assets/selfHealing/globalValues.ts)

## Design assumptions to preserve

- Findings remain descriptive (not imperative): e.g. `Stale SessionId Finding`, `Room Occupancy Drift Finding`.
- Producers emit problem reports; diagnostics evaluates and emits findings.
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
  - [X] Whether `Library / Sessions` removal is independent or bundled
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

- [ ] PR1 - Remove `Global / Sessions`
  - [ ] Inventory all reads/writes to `ConnectionId='Global', DataCategory='Sessions'`.
  - [ ] Remove correctness dependencies on this record in connections hot paths.
  - [ ] Update caches/helpers that currently invert `sessions` map (replace with session-row based reads or remove dead paths).
  - [ ] Add/adjust tests to prove connect/disconnect still works without global map writes.
  - [ ] Confirm `subscriptions` and publish fanout paths are unaffected.

- [ ] PR2 - Refactor `Meta::Session` storage to concentrated PK
  - [ ] Implement concentrated-PK key orientation for canonical session rows (`ConnectionId='Meta::Session'`, `DataCategory='SESSION#...'`) with unchanged payload shape.
  - [ ] Migrate writers (`connect`, `dropConnection`, `checkSession`, related caches).
  - [ ] Update query callsites to primary-index query patterns with `ConsistentRead` where needed.
  - [ ] Remove legacy-shape readers/writers (no dual-read/dual-write or backfill path in clean-slate cutover).
  - [ ] Validate post-cutover smoke checks against canonical-only session behavior.

- [ ] PR3 - Add Stale Session sweep to diagnostics lambda
  - [ ] Implement diagnostics sweep that evaluates:
    - [ ] session rows without active connections beyond grace window
    - [ ] stream subscriptions referencing stale session IDs
    - [ ] session/character adjacency inconsistencies
  - [ ] Emit `Stale SessionId Finding` payload `{ player }` (optional `diagnosticRunId` on diagnostics sweeps).
  - [ ] Add tests for false-positive suppression and repeated-run idempotency.

- [ ] PR4 - Add Stale Session handling in connections lambda
  - [ ] Implement `Session Disconnect Problem` emission points for cleanup conflicts/failures.
  - [ ] Ensure problem reports are emitted outside recursive cleanup internals.
  - [ ] Decouple `Session Disconnect` emission from contested bookkeeping writes.
  - [ ] Add bounded retry (3 attempts, progressive waits) + structured logging for cleanup conflict paths.
  - [ ] Add tests covering refresh race (disconnect old / connect new overlap).

- [ ] PR5 - Add Room Occupancy Drift sweep to diagnostics lambda
  - [ ] Implement occupancy drift sweep using locked invariants (`SessionIds` canonical; adjacency + `Meta::Character.RoomId` authoritative).
  - [ ] Delegate ambiguous/invalid location cases to `checkLocation`.
  - [ ] Emit `Room Occupancy Drift Finding` payload `{ roomId }` (optional `diagnosticRunId` on diagnostics sweeps).
  - [ ] Add tests for mixed-valid/mixed-invalid room states.

- [ ] PR6 - Add Room Occupancy Drift Finding handling to ephemera lambda
  - [ ] Wire ephemera intake for `mtw.diagnostics` room-occupancy finding events.
  - [ ] Implement corrective reconciliation for affected room records (derived room occupancy reconciled to authoritative adjacency + `Meta::Character.RoomId`).
  - [ ] Ensure cache invalidation/update contract after reconciliation (`RoomCharacterList`, `ComponentEphemeraMeta`, `ComponentStackMerge`) and room update signaling.
  - [ ] Add tests for idempotent replays and partial-repair scenarios.

- [ ] PR7 - Remove `Library / Sessions`
  - [ ] Remove remaining read paths for `ConnectionId='Library', DataCategory='Subscriptions'`.
  - [ ] Remove cleanup writes against legacy `Library / Subscriptions` record.
  - [ ] Update docs/comments describing this record as active behavior.
  - [ ] Add regression tests confirming no subscription behavior depends on legacy record.

## Progress

| PR | Scope | Status | Notes |
| --- | --- | --- | --- |
| 1 | Remove `Global / Sessions` | Not started | Highest leverage for contention reduction |
| 2 | Refactor `Meta::Session` storage | Not started | Depends on PR1 behavior decoupling |
| 3 | Diagnostics stale-session sweep | Not started | Contract-first with finding schema |
| 4 | Connections stale-session handling | Not started | Problem-report producer behavior |
| 5 | Diagnostics occupancy-drift sweep | Not started | Parallel with PR6 contract prep |
| 6 | Ephemera occupancy-drift handling | Not started | Consumes PR5 finding |
| 7 | Remove `Library / Sessions` | Not started | Cleanup/legacy removal pass |

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
| D7 | Locked | With clean-slate pre-cutover cleanup, remove legacy compatibility paths immediately (no telemetry soak period required for compatibility code). `Library / Sessions` legacy removal can proceed directly in-scope for this initiative without staged dual-path support. Final gate is successful post-deploy smoke checks and updated docs/tests reflecting only canonical behavior. |
| D8 | Locked | Adopt event-first eventual-consistency model for character connection lifecycle. Connections remains authoritative for `connections`-table state and emits lifecycle events (`Character Connected` / `Character Disconnected`) instead of relying on direct cross-table adjacency mutation as steady-state architecture. Ephemera consumes lifecycle events and converges room/character presence asynchronously, accepting short-lived ghost presence as an intentional tradeoff. `checkLocation` and diagnostics drift sweeps remain convergence/repair backstops. |

## Verification strategy by phase

Use commands from each lambda/package-specific test documentation where present. For every PR:

- Run targeted unit tests for changed lambdas.
- Run at least one integration path covering disconnect -> session cleanup -> subscription cleanup.
- Validate no new lints/typescript errors in touched files.

Minimum checks per PR (adapt paths as needed):

- `lambda/connections` tests for connect/disconnect/checkSession behavior
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
- Ephemera can reconcile room occupancy drift findings idempotently.
- `Library / Sessions` legacy record and references removed.
