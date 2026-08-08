# Session reverse index and connect-time stale cleanup

**Status:** Phases 0-2 done. Next step: Phase 3 (retire the scan in `queryMetaSessionRowsForPlayer`).

**Goal:** Give the connections table a player-keyed reverse index over session meta rows, migrate the
five existing `player -> sessions` readers onto it, and use it to add a connect-time stale-session
cleanup trigger.

**Framework:** skim [`taskPlanning/AGENT.md`](../../AGENT.md) once for durability rules and the
content split between this plan and durable `AGENT*.md` docs.

## Why

Two problems, one data-model fix.

1. **Stale sessions have no cleanup trigger.** A botched disconnect can leave a `Meta::Session` row
   with `connections: []` and no client that will ever reconnect. The teardown machinery already
   exists ([`staleSessionTeardown`](../../../lambda/connections/staleSessionTeardown/index.ts),
   [`classification.ts`](../../../lambda/connections/staleSessionFinding/classification.ts)), but the
   only thing that invokes it outside the Step Functions drop path is
   [`staleSessionSweep`](../../../lambda/diagnostics/staleSessionSweep/index.ts), which today has
   **no scheduled trigger** -- it fires only as a side effect of an incoming
   `Session Disconnect Problem` event.
2. **`player -> sessions` is a full partition scan, five times over.** Every call site queries the
   whole concentrated `Meta::Session` partition with `ConsistentRead: true` and filters by player in
   application code:
   - [`lambda/ephemera/internalCache/playerSessions.ts`](../../../lambda/ephemera/internalCache/playerSessions.ts)
   - [`lambda/subscriptions/internalCache/playerSessions.ts`](../../../lambda/subscriptions/internalCache/playerSessions.ts)
   - [`lambda/assets/internalCache/playerSessions.ts`](../../../lambda/assets/internalCache/playerSessions.ts)
   - ~~`lambda/assets/selfHealing/globalValues.ts`~~ -- removed in Phase 2 rather than migrated: its
     `healConnections` scanned **all** sessions to build a global `{ sessionId: player }` map for a
     `Global`/`Sessions` item that nothing read (confirmed via repo-wide search before removal), so it
     never fit the single-player read shape the other three caches do.
   - [`queryMetaSessionRowsForPlayer`](../../../lambda/connections/staleSessionFinding/queryMetaSessionsForPlayer.ts)

   The three `playerSessions` caches build a whole-table `SessionsByPlayer` map to answer a
   single-player question, so most lambda invocations in the system pay a consistent scan of one
   partition. That is the hot-partition trade-off documented in
   [`lambda/connections/AGENT.md`](../../../lambda/connections/AGENT.md) being realized on the read
   path.

**Why a base-table reverse index and not a GSI:** every reader above depends on `ConsistentRead`, and
DynamoDB cannot serve consistent reads from a GSI. An LSI is also unavailable (it would have to share
the table hash key `ConnectionId` and be declared at table creation). A base-table pointer row is
consistently readable and needs **no table-schema change and no index backfill wait** (the index
itself touches no infra; Phase 4 adds one unrelated EventBridge rule).

## Pointer row shape

```
ConnectionId  = 'PLAYER#${player}'
DataCategory  = 'SESSION#${sessionId}'
(no payload attributes)
```

The `PLAYER#` prefix is currently unused in the connections keyspace. The row is a **pure pointer**:
it carries no `connections` / `dropAfter` / mutable state. That is what makes the write idempotent --
re-`Put`ting it on every connect is a no-op rewrite, so the pointer never has to be kept in sync with
the meta row and a missing pointer self-heals on the player's next connect. Staleness is judged by
following pointers to the meta rows with `getItem` + `ConsistentRead`.

Because the write is idempotent, it does **not** need to detect session creation versus join -- but it
does need the D6 guard so a hijack attempt cannot mint a cross-player pointer.

Per decision D3 below, pointers are **purely transactional with the sweep as the only reaper** -- no
TTL on this iteration.

## Getting Started

Read first, in order:

1. [`lambda/connections/AGENT.md`](../../../lambda/connections/AGENT.md) -- session row key shape and
   the deliberate concentrated-PK trade-off. **This file must be updated when this task ships**; its
   trade-off section closes with an explicit instruction to do so.
2. [`packages/mtw-utilities/ts/dynamoDB/sessionMetaKeys.ts`](../../../packages/mtw-utilities/ts/dynamoDB/sessionMetaKeys.ts)
   -- where the new pointer-key helpers go.
3. [`lambda/connections/staleSessionFinding/classification.ts`](../../../lambda/connections/staleSessionFinding/classification.ts)
   -- `STALE_BUFFER_MS` and `isStaleSessionMetaRow`. Note the header comment: this file **must stay in
   sync** with [`lambda/diagnostics/staleSessionSweep/classification.ts`](../../../lambda/diagnostics/staleSessionSweep/classification.ts).
4. [`stepFunctions/dropConnection.asl.yaml`](../../../stepFunctions/dropConnection.asl.yaml) -- the
   existing `Wait 5s -> checkSession` grace path that Phase 4 must not duplicate or race.

**Test commands.** Every affected package uses Jest via `npm test` run from the package directory.
There is no `AGENT.testing.md` or `AGENT.development.md` for these areas; if a package-level doc is
added later, it takes authority over this list.

```
cd lambda/connections   && npm test
cd lambda/ephemera      && npm test
cd lambda/subscriptions && npm test
cd lambda/assets        && npm test
cd lambda/diagnostics   && npm test
cd packages/mtw-utilities && npm test
```

**Baseline before editing:** `cd lambda/connections && npm test` should pass.

**Caveat -- typecheck is not sufficient in ephemera.** `lambda/ephemera`'s `*.integration.test.ts`
files sit outside `tsconfig`, so `tsc` will not catch breakage there. Run the **full** package suite
after any rename or signature change, and grep for module **paths** (not just symbol names) when
retiring a helper.

## Progress

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Pointer key helpers in `mtw-utilities` | Done |
| 1 | Dual-write pointers at create / teardown / chaos | Done |
| 2 | Migrate the three cache readers onto the pointer index; remove the dead `globalValues.ts` scan | Done |
| 3 | Retire the scan in `queryMetaSessionRowsForPlayer` | Not started |
| 4 | Connect-time stale cleanup trigger | Not started |
| 5 | Durable doc updates | Not started |

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Where a step has nested bullets, mark each nested
line `[X]` as it is done so partial progress stays visible.

- [X] **Phase 0 -- key helpers.** Add `playerSessionsPK(player)` and pointer sort-key helpers beside
      `META_SESSION_PK` in [`sessionMetaKeys.ts`](../../../packages/mtw-utilities/ts/dynamoDB/sessionMetaKeys.ts);
      export from [`dynamoDB/index.ts`](../../../packages/mtw-utilities/ts/dynamoDB/index.ts) and the
      [`__mocks__`](../../../packages/mtw-utilities/ts/dynamoDB/__mocks__/index.ts) barrel (both
      currently re-export the session-meta helpers; the mock must stay in step or dependent suites
      break).
  - [X] Reuse `sessionMetaSortKey` for the pointer sort key rather than defining a second `SESSION#`
        formatter.
  - [X] Unit tests for round-tripping player and sessionId out of the pointer key.
- [X] **Phase 1 -- dual-write.** Write the pointer wherever a session meta row is created, delete it
      wherever one is removed. Readers still scan; nothing depends on pointers yet.
  - [X] [`lambda/authentication/connect.ts`](../../../lambda/authentication/connect.ts): moved the
        existing `optimisticUpdate` into a `connectionDB.transactWrite` as an `Update` item, adding
        the pointer `Put` to the same transaction (D1). The `Meta::Connection` `putItem` stays a
        separate call outside the transaction (decided: it's connectionId bookkeeping unrelated to
        session ownership, and previously wrote unconditionally even on a hijack attempt -- keeping it
        separate preserves that behavior).
    - [X] Control flow reworked: the `updateReducer` throws a `SessionHijackError` on a player
          mismatch; `connect()` catches it and maps to 403. The `authenticated` boolean is gone -- a
          non-throwing transaction is authenticated.
    - [X] Hijack rejection throws from the reducer (D6) rather than leaving the draft untouched, so the
          pointer `Put` never executes alongside a rejected `Update`. Also fixes D7 (reducer now checks
          the player mismatch **before** mutating `connections`, with a dedicated test asserting
          `connections` is untouched on a thrown hijack).
  - [X] [`staleSessionTeardown/index.ts`](../../../lambda/connections/staleSessionTeardown/index.ts):
        deletes the pointer alongside the `Meta::Session` `deleteItem`, reusing the `player` already
        passed in via `TearDownStaleSessionContext` (both call sites already fetch it through
        `getSessionPlayerForTeardown` before teardown). Guarded on non-empty `player`.
  - [X] [`lambda/chaos/addGhostSession/index.ts`](../../../lambda/chaos/addGhostSession/index.ts):
        both the with-character and bare branches now set a synthetic player (`` `chaos:${sessionId}` ``,
        per D2) on the meta row and add a matching pointer `Put` to their `transactWrite` calls.
  - [X] [`staleSessionSweep`](../../../lambda/diagnostics/staleSessionSweep/index.ts): backfills a
        pointer for every meta row that has a player but no pointer, and prunes pointer rows whose
        session meta row is gone. Pruning enumerates the player roster via `assetDB`'s
        `DataCategoryIndex` / `Meta::Player` (same pattern as `playerMisalignmentSweep`), since the
        connections table has no scan and no player-prefix GSI to enumerate pointer rows directly.
- [X] **Phase 2 -- migrate readers.** One package per commit; full suite per package.
  - [X] `lambda/subscriptions` `playerSessions` cache.
  - [X] `lambda/ephemera` `playerSessions` cache (**full suite, not `tsc`** -- see caveat above).
  - [X] `lambda/assets` `playerSessions` cache.
  - [X] `lambda/assets/selfHealing/globalValues.ts` -- removed the dead `healConnections` write
        (nothing read `Global`/`Sessions`) rather than migrating it; also dropped the now-meaningless
        `connections` field from `DiagnosticsHealGlobalValuesContent` in
        [`packages/mtw-interfaces/ts/eventBridge/diagnostics/index.ts`](../../../packages/mtw-interfaces/ts/eventBridge/diagnostics/index.ts)
        and its deserializer/round-trip test.
  - [X] Each migrated cache queries `ConnectionId = 'PLAYER#${player}'` for that player only. Since the
        pointer's `DataCategory` reuses `sessionMetaSortKey`, `sessionIdFromMetaSortKey` on the pointer
        row itself is the whole answer for these three caches -- no follow-up `getItem` on the meta row
        needed. No longer builds a whole-table `SessionsByPlayer` map. `clear()` / cache-shape contract
        (`get(player): Promise<string[] | undefined>`) unchanged per call site; added
        `playerSessions.test.ts` unit tests for all three caches (none existed before).
- [ ] **Phase 3 -- retire the scan.** Rewrite
      [`queryMetaSessionRowsForPlayer`](../../../lambda/connections/staleSessionFinding/queryMetaSessionsForPlayer.ts)
      to resolve pointers and `getItem` the meta rows, dropping the paginated `begins_with` scan and
      the in-app player filter. Keep the `MetaSessionRow` return shape so
      [`staleSessionFinding/index.ts`](../../../lambda/connections/staleSessionFinding/index.ts) is
      unchanged.
  - [ ] Leave the **whole-table** sweeps alone: `staleSessionSweep` and
        [`roomOccupancyDriftSweep`](../../../lambda/diagnostics/roomOccupancyDriftSweep/index.ts)
        legitimately want all rows. With D1 atomic, they are no longer needed to close a connect-path
        race, but stay as the reaper for dangling pointers (D3) and for meta rows created outside the
        transactional path (pre-existing sessions, chaos fixtures per D2).
- [ ] **Phase 4 -- connect-time detection and report.** `connect.ts` identifies stale sessions for the
      connecting player via the index and emits a problem report; diagnostics evaluates and emits
      findings; the existing
      [`staleSessionFinding`](../../../lambda/connections/staleSessionFinding/index.ts) consumer reaps
      (D4). Teardown itself is unchanged.
  - [ ] **Contract:** add `Stale Session Problem` to
        [`packages/mtw-interfaces/ts/eventBridge/players`](../../../packages/mtw-interfaces/ts/eventBridge/players/index.ts),
        mirroring `ConnectionsSessionDisconnectProblemEvent`'s report fields (`sessionId`, `player`,
        `sourceOperation`, `attemptCount`, `dedupeKey`, `timestamp`) so diagnostics' existing
        dedupe-on-`dedupeKey` intake works unchanged.
  - [ ] **Detect in `connect.ts`:** query the player's pointer partition, follow to meta rows, apply
        `isStaleSessionMetaRow`. Run it alongside the existing work (the connect path already awaits a
        transaction) so it adds no serial latency, and make failure non-fatal -- a detection error must
        never fail an otherwise-valid connect.
  - [ ] **Emit in the existing batch:** `connect.ts` already calls `eventBridgeClient.send([...])` with
        an array for `Player Connected`; add the report to that same call rather than a second PutEvents.
  - [ ] Reuse `isStaleSessionMetaRow` / `STALE_BUFFER_MS` -- do **not** treat `connections: []` as
        sufficient. Zero connections is a legitimate transient state inside the ~4s `dropAfter` plus
        ~5s Step Functions wait. Report only past the buffer, so healthy disconnects never generate reports.
  - [ ] Exclude the session being connected to.
  - [ ] **Diagnostics side:** add the `mtw.players` / `Stale Session Problem` guard in
        [`diagnostics/dataSource/subscribedEvents.ts`](../../../lambda/diagnostics/dataSource/subscribedEvents.ts)
        and route it in [`dataSource/index.ts`](../../../lambda/diagnostics/dataSource/index.ts),
        following the two existing problem-report branches. Scope evaluation to the reported player --
        do **not** call the full `staleSessionSweep()`.
  - [ ] Add a `CloudWatchEvent` rule on `DiagnosticsFunction` for `source: mtw.players`,
        `detail-type: Stale Session Problem` (template.yaml, near the existing rules at ~1737-1764).
        Only infra change in the plan.
  - [ ] Payoff test: a session left stale by a failed disconnect is reaped by that player's next
        connect, and a session inside its grace window is **not**.
- [ ] **Phase 5 -- durable docs.** Update
      [`lambda/connections/AGENT.md`](../../../lambda/connections/AGENT.md): document the pointer row
      in the session key-shape section and revise the concentrated-PK trade-off to reflect that
      per-player reads no longer hit the `Meta::Session` partition. Remove resolved rows from **Open
      decisions** below, then delete this plan.

## Open decisions (implementation -- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package
`AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` /
`AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| D4 | **`connect.ts` detects and reports its own problem.** It runs the per-player indexed stale check itself and, on a hit, emits a new problem report on its own source (`mtw.players` / `Stale Session Problem`, named to parallel the existing `Session Disconnect Problem` and `Spawn Compensation Problem`). Diagnostics subscribes to that **problem**, runs scoped evaluation, and emits `Stale SessionId Finding`; connections reaps. Each site stays responsible for recognizing and reporting its own trouble, and diagnostics' subscribed lane stays problems-and-commands only. Note the reverse index is what makes this possible: identifying the problem used to require the O(all sessions) scan, which is why the question had to be handed to a sweep. Rejected: diagnostics subscribing to `Player Connected` -- that is a healthy lifecycle event, and per [`lambda/diagnostics/AGENT.md`](../../../lambda/diagnostics/AGENT.md) the subscribed lane is problem reports plus `api.diagnostics` commands, so it would put diagnostics on the happy path. Also rejected: emitting `Session Disconnect Problem` from authentication (source impersonation -- that contract belongs to `mtw.connections`), and emitting `Stale SessionId Finding` directly (would make connections both producer and consumer of its own findings). | Phase 4 | Decided |
| D5 | **Keep the memo**, re-keyed per player. An in-memory memo is far cheaper than even the cheapest DynamoDB read, and its real value is that callers stop having to reason about the cost of repeated lookups at all -- it is dynamic-programming support, not a bandwidth optimization. Implementation note: today `SessionsByPlayer` is a **single** Promise holding a whole-table map; post-migration it becomes a `Record<player, Promise<sessions>>` filled on demand, one query per distinct player per invocation. The `clear()` contract is unchanged. | Phase 2 | Decided |

## Verification

Per phase, from the affected package directory:

```
cd packages/mtw-utilities  && npm test    # Phase 0
cd lambda/connections      && npm test    # Phases 1, 3
cd lambda/authentication   && npm test    # Phases 1, 4 (transactWrite rework; detect + report)
cd lambda/diagnostics      && npm test    # Phases 1, 3, 4
cd lambda/subscriptions    && npm test    # Phase 2
cd lambda/ephemera         && npm test    # Phase 2 -- full suite, tsc is not sufficient
cd lambda/assets           && npm test    # Phase 2
cd packages/mtw-interfaces && npm test    # Phase 4 (Stale Session Problem contract)
```

Greps that should come back clean when Phase 3 lands (no reader still scanning the meta partition
to answer a per-player question):

```
grep -rn "SessionsByPlayer" --include="*.ts" lambda/ | grep -v node_modules
grep -rn "begins_with(DataCategory, :prefix)" --include="*.ts" lambda/ | grep -v node_modules
```

Expect surviving hits **only** in `lambda/diagnostics` (`staleSessionSweep`,
`roomOccupancyDriftSweep`), which scan all sessions by design.

Classification parity check. The two files carry **different header comments by design**, so a plain
`diff` is not a useful signal -- compare the rule and the buffer instead:

```
grep -n "STALE_BUFFER_MS = " lambda/connections/staleSessionFinding/classification.ts \
                            lambda/diagnostics/staleSessionSweep/classification.ts

diff <(sed -n '/export const hasActiveConnections/,$p' lambda/connections/staleSessionFinding/classification.ts) \
     <(sed -n '/export const hasActiveConnections/,$p' lambda/diagnostics/staleSessionSweep/classification.ts)
```

Both `STALE_BUFFER_MS` values must match and the predicate bodies must be identical. Phase 4 changes
neither file -- it only calls `isStaleSessionMetaRow` -- so any drift here means something else moved.
