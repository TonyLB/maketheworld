# Diagnostics lambda

## Stale Session sweep (connections consistency)

**Purpose:** Sweep over the `connections` table for `Meta::Session` rows that should have completed disconnect cleanup (per initiative decision D4/D6). Emits descriptive findings only for stale sessions -- no session/adjacency repairs -- but see the pointer-maintenance note below.

**Entrypoints:**

- Direct invoke: `type: StaleSessionSweep`, optional `diagnosticRunId` and `nowMs` (for tests). This command is normalized to synthetic `api.diagnostics` ingress and handled through diagnostics DataSource subscribed-event dispatch.

**Thresholds:** See `STALE_BUFFER_MS` in [`staleSessionSweep/classification.ts`](staleSessionSweep/classification.ts) (slack after `dropAfter` before classifying a session meta row as stale; suppresses false positives during normal `dropConnection` / Step Functions timing).

**Finding contract:** `mtw.diagnostics` / `Stale SessionId Finding` with payload shape defined in [`packages/mtw-interfaces/ts/eventBridge/diagnostics`](../../packages/mtw-interfaces/ts/eventBridge/diagnostics) (`player` required on the wire; optional `diagnosticRunId` for sweep correlation). Emission uses the same `publishStreamEvent` + `DiagnosticsEventSerializer` path as other diagnostics producers.

**Evaluation:** For each stale candidate session (non-empty `player` on the meta row), the sweep also queries stream subscription rows (`STREAM#` on `DataCategoryIndex`) and session-character adjacency (`SESSION#${sessionId}` / `CHARACTER#...`) so operators have correlated evidence; findings remain aggregated **per player**.

**Pagination implementation note:** Session-meta enumeration now uses shared `connectionDB.query`/`withQuery` pagination (`{ items, nextToken?, nextPage? }`) rather than direct AWS SDK `QueryCommand` loops, so diagnostics and connections stale-session paths share token handling and page-size guardrails.

**Pointer maintenance (session reverse-index):** every sweep run also maintains the `PLAYER#${player}` / `SESSION#${sessionId}` reverse-index pointer rows described in [`lambda/connections/AGENT.md`](../connections/AGENT.md) -- unconditionally, not just for stale sessions. It backfills a pointer for any currently-existing meta row that has a `player` but no pointer, and prunes pointer rows whose session meta row is gone. Pruning requires enumerating the pointer rows, which the connections table's key shape doesn't support directly (no scan, no player-prefix GSI), so the sweep enumerates the player roster via `assetDB`'s `DataCategoryIndex` / `Meta::Player` -- the same pattern [`playerMisalignmentSweep`](playerMisalignmentSweep/index.ts) uses -- then queries each player's pointer partition in `connectionDB`. This is the one place `staleSessionSweep` writes/deletes rather than only reads.

## Connections problem-report intake (DataSource lane)

**Purpose:** Receive `mtw.connections` session disconnect problem reports through one diagnostics DataSource subscription/deserialization lane and trigger report-only diagnostics evaluation (D6).

**Intake boundary:**

- [`ingress.ts`](ingress.ts) routes EventBridge ingress onto diagnostics message-bus streaming envelopes.
- [`dataSource/subscribedEvents.ts`](dataSource/subscribedEvents.ts) owns subscribed header/envelope guards for:
  - `mtw.connections` / `Session Disconnect Problem`
  - `mtw.ephemera.objects` / `Spawn Compensation Problem`
  - `mtw.players` / `Stale Session Problem` (`DiagnosticsPlayersProblemHeader` / `isPlayersProblemHeader` / `isPlayersProblemEnvelope`)
  - `api.diagnostics` synthetic command envelopes (`StaleSessionSweep`, `RoomOccupancyDriftSweep`, `PlayerMisalignmentSweep`, `ComponentVerticalMisalignmentSweep`, `RenderCacheDriftSweep`, `OrphanedImprovisedObjectSweep`)
- [`dataSource/index.ts`](dataSource/index.ts) owns subscribed-event handling.

**Handling semantics:**

- `Session Disconnect Problem` intake consumes shared serializer/contracts from [`packages/mtw-interfaces/ts/eventBridge/connections`](../../packages/mtw-interfaces/ts/eventBridge/connections).
- `Spawn Compensation Problem` intake consumes shared serializer/contracts from [`packages/mtw-interfaces/ts/eventBridge/ephemera/objects`](../../packages/mtw-interfaces/ts/eventBridge/ephemera/objects/index.ts); same tidy-failure, invocation dedupe, and report-only sweep trigger semantics as connections problem reports.
- `Stale Session Problem` intake consumes shared serializer/contracts from [`packages/mtw-interfaces/ts/eventBridge/players`](../../packages/mtw-interfaces/ts/eventBridge/players/index.ts). Producer: [`connect.ts`](../authentication/connect.ts) in `lambda/authentication` detects (via [`staleSessionDetection.ts`](../authentication/staleSessionDetection.ts), which resolves the connecting player's reverse-index pointers) and reports its own problem at connect time -- connections-table stale-session detection used to require the whole-table sweep, which is why it could only run on a schedule; the reverse index lets the connecting player's own connect path recognize the problem instead. Diagnostics does not subscribe to the healthy-path `Player Connected` event for this.
  - Evaluation routes to `evaluateStaleSessionsForPlayer` in [`staleSessionSweep/index.ts`](staleSessionSweep/index.ts): a player-scoped counterpart to `staleSessionSweep()` that resolves only the reported player's reverse-index pointers (one `connectionDB.query` + batch-`getItems`, `ConsistentRead`) and emits the same `Stale SessionId Finding` contract if that player has a currently-stale session. It does **not** perform the pointer backfill/prune maintenance described in the "Pointer maintenance" note below -- that stays exclusively with the full `staleSessionSweep()` run.
- Intake is tidy-failure: malformed/partial payloads are logged and dropped at ingress/deserialization boundaries without throwing.
- Within one lambda invocation, repeated problem reports with the same `dedupeKey` are suppressed before triggering sweep evaluation (invocation-wide `tryClaim` in [`dataSource/intakeDeduper.ts`](dataSource/intakeDeduper.ts); reset on `messageBus.clear()` at handler entry). Applies to `Session Disconnect Problem`, `Spawn Compensation Problem`, and `Stale Session Problem`.
- Diagnostics remains report-only: problem reports trigger sweep evaluation and finding emission only; diagnostics does not perform storage repairs.
- Bus ingress uses `publish`; boundary drain uses `flushAndSettle()`; direct command return values use ReturnValue/Error `publish` plus [`createBoundaryResponseCollector`](../../packages/mtw-lambda-patterns/ts/messageBus/boundaryResponseCollector.ts) (via [`returnValue/collector.ts`](returnValue/collector.ts)) and [`returnValue/index.ts`](returnValue/index.ts) assembly at the app boundary.

## Steady-state invariants

- **Report-only diagnostics role:** Diagnostics evaluates evidence and emits findings. It does not perform storage repairs in `connections` or `ephemera`.
- **Repair ownership boundaries:** `connections` repairs only `connections`-table state. `ephemera` repairs only `ephemera`-table state.
- **Lifecycle consistency model:** Character connection lifecycle is event-first and eventually consistent across lambdas. Short-lived divergence is acceptable; sweeps/findings are the convergence backstop.
- **Ordering assumptions:** Intake and evaluation do not rely on ordered delivery across problem-report families. Behavior must remain correct under out-of-order and parallel processing.
- **Malformed intake policy:** Invalid or partial inbound problem reports are logged and dropped without crashing handler execution.

## Room Occupancy Drift sweep (ephemera consistency diagnostics)

**Purpose:** Read-only, graph-forward sweep over `Meta::Room.ludicGraph` character nodes compared against connections session/character adjacency and membership adjacency reverse index (`POSITION#${roomId}` rows). Emits descriptive findings only; no repairs.

**Entrypoints:**

- Direct invoke only: `type: RoomOccupancyDriftSweep`, optional `diagnosticRunId` and `nowMs` (for tests).
- No `mtw.diagnostics` EventBridge sweep trigger is wired for this slice; diagnostics remains a finding emitter.

**Finding contract:** `mtw.diagnostics` / `Room Occupancy Drift Finding` with payload `{ roomId }`, optional `diagnosticRunId` for sweep correlation. Emission uses `publishStreamEvent` + `DiagnosticsEventSerializer`.

**Evaluation:** For each `Meta::Room` row, enumerate character nodes from stored `ludicGraph`. Per character on the graph, flag drift when (a) no live sessions (ghost on graph), or (b) sessions present but membership adjacency does not include this `roomId` (adjacency lag). Does **not** use `Meta::Room.activeCharacters` or `Meta::Character.RoomId`. **Explicit gap:** stale adjacency pointing at a room when the character is absent from that room's `ludicGraph` is not detected (room-forward scan only). Implementation: [`roomOccupancyDriftSweep/`](roomOccupancyDriftSweep/).

**Downstream handling:** Ephemera **`mtw.ephemera.positions`** consumes `mtw.diagnostics` / `Room Occupancy Drift Finding` via [`repairRoomOccupancyDrift`](../../lambda/ephemera/dataSource/positions/membership/repairRoomOccupancyDrift.ts) (graph-forward repair; sessions gate; adjacency sync). Parent **`mtw.ephemera`** no longer subscribes to this finding type.

## Orphaned improvised object sweep (existence-without-placement diagnostics)

**Purpose:** Read-only sweep for improvisational **`OBJECT#`** ids with both `(OBJECT#, ASSET#IMPROVISATION)` pair and `Meta::Object` rows present but no positions-lane placement (empty `getMembershipContainers` and no **`Object`** node on any host `ludicGraph`). Emits descriptive findings only; no repairs in diagnostics.

**Trigger context:** S1 spawn double-failure --- placement fails after existence create, then compensation delete also fails --- emits **`Spawn Compensation Problem`** on **`mtw.ephemera.objects`** ([`spawnOneImprovisationObject`](../ephemera/dataSource/objects/spawnImprovisationObjectsBatch.ts) via [`streamSpawnCompensationProblem`](../ephemera/dataSource/objects/problemReports.ts); emission contract in [`objects/AGENT.md`](../ephemera/dataSource/objects/AGENT.md)). Normative S1 + existence-without-placement rules: [`positions/AGENT.contract.md`](../ephemera/dataSource/positions/AGENT.contract.md) **Object room membership**.

**Entrypoints:**

- Problem report intake: `mtw.ephemera.objects` / **`Spawn Compensation Problem`** triggers targeted sweep with `objectIds: [objectId]` from the payload.
- Direct invoke: `{ type: 'OrphanedImprovisedObjectSweep', objectIds?: string[], optional diagnosticRunId, optional nowMs }`. Omit **`objectIds`** for full-scan ops backstop (enumerates all `ASSET#IMPROVISATION` pair rows via `DataCategoryIndex`).

**Finding contract:** `mtw.diagnostics` / **`Orphaned Improvised Object Finding`** with payload `{ objectId, diagnosticRunId, timestamp }`. Emission uses `publishStreamEvent` + `DiagnosticsEventSerializer`.

**Evaluation (orphan litmus):** pair row present **and** `Meta::Object` present **and** no **`Object`** node on any `Meta::Room`, `Meta::Character`, **or `Meta::Object`** `ludicGraph` **and** `internalCache.Positions.getMembershipContainers(objectId)` returns empty. **Not orphan:** adjacency lag only (graph node present, containers empty) --- owned by [`repairObjectPlacementDrift`](../ephemera/dataSource/positions/membership/repairObjectPlacementDrift.ts). Implementation: [`orphanedImprovisedObjectSweep/`](orphanedImprovisedObjectSweep/).

**`Meta::Object` graphs are part of the litmus, and must stay so (2026-09-03).** An object hosted On/In/PartOf another object lives in that host's own shard, not in any room or character graph (CC3/PV1-1) --- so scanning only Room and Character made every legitimately nested object (a cup on a table) read as orphaned. Findings route to `persistDeleteImprovisationObject` with no further guard, so that omission was live data loss, not a reporting gap. A host graph's own root node is excluded from the held set: an object listing itself says nothing about whether anything holds *it*.

**Downstream handling:** Ephemera **`mtw.ephemera.objects`** consumes `mtw.diagnostics` / **`Orphaned Improvised Object Finding`** via [`handleOrphanedImprovisedObjectFinding`](../ephemera/dataSource/objects/handleOrphanedImprovisedObjectFinding.ts) -> [`persistDeleteImprovisationObject`](../ephemera/dataSource/objects/persistImprovisationObject.ts) (delete-only repair; Coyote Game v1). Diagnostics remains report-only; repair ownership is objects-lane. Contract: [`objects/AGENT.md`](../ephemera/dataSource/objects/AGENT.md) **Diagnostics repair**.

**Verification:**

```bash
cd lambda/diagnostics
npm run test -- --watchAll=false \
  orphanedImprovisedObjectSweep/ \
  dataSource/index.test.ts \
  app.test.ts
```

| File | Policies |
| --- | --- |
| [`orphanedImprovisedObjectSweep/classification.test.ts`](orphanedImprovisedObjectSweep/classification.test.ts) | Orphan litmus (pair + meta + empty containers; adjacency lag excluded) |
| [`orphanedImprovisedObjectSweep/index.test.ts`](orphanedImprovisedObjectSweep/index.test.ts) | Sweep emission, targeted vs full scan, finding payload |
| [`dataSource/index.test.ts`](dataSource/index.test.ts) | **`Spawn Compensation Problem`** intake, dedupe, malformed drop |
| [`app.test.ts`](app.test.ts) | End-to-end diagnostics handler wiring |

**Wiring greps (repo root):**

```bash
rg -n "Spawn Compensation Problem|mtw.ephemera.objects" lambda/diagnostics/dataSource/
rg -n "Orphaned Improvised Object Finding" lambda/diagnostics/ packages/mtw-interfaces/ts/eventBridge/diagnostics/
```

Objects-lane repair and problem-report emission: [`objects/AGENT.md`](../ephemera/dataSource/objects/AGENT.md) **Verification**.

## Player Misalignment sweep (player heal targeting diagnostics)

**Purpose:** Read-only sweep over assets-table player evidence to identify players that likely need `healPlayer` reconciliation. Emits findings only; diagnostics does not mutate assets state.

**Entrypoints:**

- Direct invoke only: `type: PlayerMisalignmentSweep`, optional `diagnosticRunId` and `nowMs` (for tests/operators).
- Routed through synthetic `api.diagnostics` ingress and diagnostics DataSource subscribed-event dispatch.

**Finding contract:** `mtw.diagnostics` / `Player Misalignment Finding` with payload `{ player }`, optional `diagnosticRunId` for sweep correlation. Emission uses `publishStreamEvent` + `DiagnosticsEventSerializer`.

**Evaluation:** The sweep enumerates assets-table evidence (no Cognito `ListUsers`): `Meta::Player` rows plus player references on `Meta::Asset`/`Meta::Character`. It flags players when player meta is missing, guest fields are missing, or coyote guest-name invariants are misaligned.

**Downstream handling:** Assets consumes `mtw.diagnostics` / `Player Misalignment Finding` and runs idempotent `healPlayer` in the owning domain.

## Component vertical misalignment sweep (import vertical diagnostics)

**Purpose:** Read-only check for one asset: authoritative component `_from` hops (derived with the same **`mtw-gateways`** salvage rules as **`syncImportVerticalPartition`**) against existing **`Meta::Import::...`** rows for every **`universalKey`** found under that asset. Partition comparison uses **`ImportVerticalConsistencyAnalyzer`** ([`componentVerticalMisalignmentSweep/index.ts`](componentVerticalMisalignmentSweep/index.ts)) with module-local [**`exhaustivePartitionLoader`**](componentVerticalMisalignmentSweep/exhaustivePartitionLoader.ts) (`exhaustiveScanCache` subpath) and tier-1 **`internalCache.ComponentVerticals`**. Tier-1 **`internalCache.ComponentData`** is pair-addressed for any bounded blueprint reads (same as assets/ephemera); the sweep does **not** use it for partition enumerate. Enumerating universal keys for the asset still uses **`assetDB`** **`DataCategoryIndex`** on the asset id. Emits **`Component Vertical Misaligned Finding`** when any partition differs; **`mtw.assets.components.verticals`** consumes the finding and runs **`healComponentVertical`**.

**Vs assets projector:** Same analyzer **`deps`** shape as **`syncImportVerticalPartition`** and per-invocation **`internalCache.clear()`** at handler entry ([`app.ts`](app.ts)); assets additionally carries aggregate and unrelated caches. See **Blessed wiring sites for `ImportVerticalConsistencyAnalyzer`** in [`packages/mtw-gateways/AGENT.md`](../../packages/mtw-gateways/AGENT.md).

**Entrypoints:**

- Direct invoke: `{ type: 'ComponentVerticalMisalignmentSweep', assetId, optional diagnosticRunId, optional nowMs }`, normalized through **`ingress.ts`** and synthetic **`api.diagnostics`** (**[`dataSource/index.ts`](dataSource/index.ts)**).
- DataSource **`api.diagnostics`** message (**[`apiDiagnostics.ts`](dataSource/apiDiagnostics.ts)** payload union).

**Classification helpers:** Per-partition statuses **`aligned`** / **`missing`** / **`orphan`** / **`stale`** are computed inside **`ImportVerticalConsistencyAnalyzer.check()`** ([`packages/mtw-gateways/ts/assets/components/verticals/consistency/index.ts`](../../packages/mtw-gateways/ts/assets/components/verticals/consistency/index.ts)) and surfaced via **`getClassification()`**. The asset-level rollup that decides what (if anything) to emit on the wire lives next to this sweep ([`componentVerticalMisalignmentSweep/classification.ts`](componentVerticalMisalignmentSweep/classification.ts)).

**Finding contract:** `mtw.diagnostics` **`Component Vertical Misaligned Finding`**; internal + serializer shapes in **`@tonylb/mtw-interfaces/ts/eventBridge/diagnostics`**. **`status`** is **`missing`**, **`orphan`**, or **`stale`** (combined replace vs insert/delete semantics).

## Render Cache Drift sweep (authored catalog consistency)

**Purpose:** Read-only sweep comparing blueprint authored slices (**`internalCache.ComponentExamples.get`**) to version-gated materialized **`CACHE#`** rows for existing **`Cache::${perspectiveKey}`** catalog rows on caller-supplied rooms. Emits findings only; diagnostics does not mutate ephemera.

**Entrypoints:**

- Direct invoke: `{ type: 'RenderCacheDriftSweep', roomIds, optional diagnosticRunId, optional nowMs }`, normalized through **`ingress.ts`** and synthetic **`api.diagnostics`** (**[`dataSource/index.ts`](dataSource/index.ts)**).
- **`roomIds: []`** (or all invalid ids) is a no-op: no Dynamo reads, no findings.
- No scheduled/cron trigger in v1; operators must pass an explicit room list until a later discovery slice.

**Example invoke:**

```json
{
  "type": "RenderCacheDriftSweep",
  "roomIds": ["ROOM#..."],
  "diagnosticRunId": "optional-correlation-id"
}
```

**Finding contract:** `mtw.diagnostics` / **`Ephemera RenderCache Finding`** with **`targetCatalogs`** (`{ ephemeraId, perspectiveKey }[]`) and **`status`** (`missing` | `corrupted`) only. Sweep **`roomIds`** are not included on the finding wire. Up to two findings per sweep (one per status bucket). Emission uses `publishStreamEvent` + `DiagnosticsEventSerializer`.

**Evaluation:** For each **`ROOM#...`**, enumerate existing catalog rows via **`internalCache.RenderCache.getCatalogRows`**, load materialized rows once per room via **`getCacheRows`**, classify drift with package **`classifyAuthoredCatalogDrift`**. Implementation: [`renderCacheDriftSweep/index.ts`](renderCacheDriftSweep/index.ts).

**Downstream handling:** **`mtw.ephemera.renderCache`** consumes **`Ephemera RenderCache Finding`** and performs lazy catalog invalidation only (**[`handleRenderCacheFinding.ts`](../ephemera/dataSource/renderCache/handleRenderCacheFinding.ts)**); hydrate runs on the next orchestration resolve, not on finding receipt.

## Ludic Graph Stale Structure sweep (`ludicGraph` structural staleness diagnostics)

**Purpose:** Read-only sweep over every `Meta::Room`/`Meta::Character`/`Meta::Object`/`Meta::Feature`/`Meta::Area` row that can carry a `ludicGraph` field (the five host kinds `EphemeraMembershipHostId` admits). Flags a row iff its stored `ludicGraph` fails the shipped shape guard (`isEphemeraLudicGraphFieldPayload`, `@tonylb/mtw-interfaces/ts/ephemeraMeta`) --- the sweep is a **caller** of that guard, not a second theory of staleness, so the two can never drift apart (LP4i). Currently reachable only via concepts clause 3's root-in-nodes gap: every graph's designated root must be present in its own node list, and the guard checks it. Emits findings only; diagnostics does not repair.

**Entrypoints:**

- Direct invoke: `{ type: 'LudicGraphStaleStructureSweep', optional diagnosticRunId, optional nowMs }`, normalized through `ingress.ts` and synthetic `api.diagnostics` ([`dataSource/index.ts`](dataSource/index.ts)).
- No `mtw.diagnostics` EventBridge trigger and no scheduled/cron trigger in v1; a full-table scan across five `DataCategoryIndex` queries, operator-invoked.

**Finding contract:** `mtw.diagnostics` / `Ludic Graph Stale Structure Finding` with payload `{ ephemeraId: EphemeraMembershipHostId }`, optional `diagnosticRunId` for sweep correlation. Emission uses `publishStreamEvent` + `DiagnosticsEventSerializer`. Implementation: [`ludicGraphStaleStructureSweep/`](ludicGraphStaleStructureSweep/).

**Evaluation:** Scans all five host-kind `DataCategory`s, classifies each row's stored `ludicGraph` (absent is not stale --- "not yet written," not "written and wrong") via [`classification.ts`](ludicGraphStaleStructureSweep/classification.ts)'s `isLudicGraphStructurallyStale`, and emits one finding per stale row, sorted by `EphemeraId`.

**Downstream handling:** `EphemeraFunction`'s `template.yaml` `Events:` block carries a `CloudWatchEvent` rule on `mtw.diagnostics` / `Ludic Graph Stale Structure Finding` (added 2026-08-20, fixing a gap where the sweep's own `ingress.ts` case was also missing until the same day --- neither the sweep's direct-invoke trigger nor its finding's delivery worked before then). Ephemera **`mtw.ephemera.positions`** consumes it via [`healLudicGraphStructure`](../ephemera/dataSource/positions/ludicGraph/healLudicGraphStructure.ts) (idempotent repair, scoped to defaulting `rootId`/the root's own node, and `ports` --- LP4d, LD-17's interim posture (b) --- see that file's own doc comment for the exact healable set and what remains outside it). The consumer always commits (`dryRun: false`); dry-run mode exists for manual/operator invocation, not for the finding-triggered path.

## Ludic Graph Port Mismatch sweep (`ludicGraph` port-vs-edge disagreement diagnostics)

**Purpose:** Read-only sweep for LP6a/LD-18. A `ludicGraph` port denormalizes two **exterior** facts interior-side --- the referring edge's `kind` and its `Custom` label --- and nothing keeps those copies honest across a shard boundary. Compares each stored port against the edge held by the host the port itself **names**, and reports one finding per disagreeing port.

**Separate from the stale-structure sweep on purpose:** that one is honest because it is a single-row **caller** of the shipped shape guard; a mismatch cannot be judged from one row, so folding it in would give it the second theory of staleness its design refuses. This sweep follows `roomOccupancyDriftSweep`'s cross-record shape instead.

**Entrypoints:**

- Direct invoke: `{ type: 'LudicGraphPortMismatchSweep', optional diagnosticRunId, optional nowMs }`, normalized through `ingress.ts` and synthetic `api.diagnostics` ([`dataSource/index.ts`](dataSource/index.ts)).
- No `mtw.diagnostics` EventBridge trigger and no scheduled/cron trigger; operator-invoked, like its sibling.

**Finding contract:** `mtw.diagnostics` / `Ludic Graph Port Mismatch Finding` with payload `{ ephemeraId: EphemeraMembershipHostId, portId: string }` --- the **port** is the subject, not the row, since a mismatch is one crossing being wrong. Optional `diagnosticRunId` for sweep correlation. Emission uses `publishStreamEvent` + `DiagnosticsEventSerializer` and an inline `EventBridgeClient`. Implementation: [`ludicGraphPortMismatchSweep/`](ludicGraphPortMismatchSweep/).

**Evaluation:** Scans the same five host-kind `DataCategory`s and indexes the rows by `EphemeraId`, so **one scan supplies both sides of every comparison** --- a port names its referrer, and the referrer is already in hand. No per-port fetch and no reverse index. The comparison itself lives in the shared package ([`classifyLudicGraphPortMismatch`](../../packages/mtw-gateways/ts/ephemera/positions/classifyLudicGraphPortMismatch.ts)) because the ephemera-side self-heal rechecks with the same function. A mismatch requires the matching exterior edges to be **unanimous** and to disagree with the port; a fan disagreeing with itself is reported but carries no correction. **Not findings, deliberately:** no matching edge, an absent or shape-stale referrer graph, or an edge naming the same owner but a different port.

**Downstream handling:** `EphemeraFunction`'s `template.yaml` `Events:` block carries the detail-type on its `mtw.diagnostics` rule; ephemera `mtw.ephemera.positions` repairs via [`healLudicGraphPortMismatch.ts`](../ephemera/dataSource/positions/ludicGraph/healLudicGraphPortMismatch.ts), which re-reads both rows and re-classifies before writing.

## Related docs

- Diagnostics **`internalCache`** slice (sweep read handlers): [`internalCache/AGENT.md`](internalCache/AGENT.md)
- Objects lane problem-report emission: [`../ephemera/dataSource/objects/AGENT.md`](../ephemera/dataSource/objects/AGENT.md)
- Positions S1 + orphan vs adjacency lag: [`../ephemera/dataSource/positions/AGENT.contract.md`](../ephemera/dataSource/positions/AGENT.contract.md) **Object room membership**
- Assets heal authority and event flow: [`../assets/AGENT.event.md`](../assets/AGENT.event.md)
- Cognito signup publish flow (`mtw.cognito` / `New Player`): [`../cognitoEvent/AGENT.md`](../cognitoEvent/AGENT.md)
- `ludicGraph` structural staleness self-heal and its scope: [`../ephemera/dataSource/positions/ludicGraph/AGENT.md`](../ephemera/dataSource/positions/ludicGraph/AGENT.md)
- Broader diagnostics schema notes: [`AGENT.schema.planning.md`](AGENT.schema.planning.md)
