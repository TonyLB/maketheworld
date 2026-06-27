# Diagnostics lambda

## Stale Session sweep (connections consistency)

**Purpose:** Read-only sweep over the `connections` table for `Meta::Session` rows that should have completed disconnect cleanup (per initiative decision D4/D6). Emits descriptive findings only; no repairs.

**Entrypoints:**

- Direct invoke: `type: StaleSessionSweep`, optional `diagnosticRunId` and `nowMs` (for tests). This command is normalized to synthetic `api.diagnostics` ingress and handled through diagnostics DataSource subscribed-event dispatch.

**Thresholds:** See `STALE_BUFFER_MS` in [`staleSessionSweep/classification.ts`](staleSessionSweep/classification.ts) (slack after `dropAfter` before classifying a session meta row as stale; suppresses false positives during normal `dropConnection` / Step Functions timing).

**Finding contract:** `mtw.diagnostics` / `Stale SessionId Finding` with payload shape defined in [`packages/mtw-interfaces/ts/eventBridge/diagnostics`](../../packages/mtw-interfaces/ts/eventBridge/diagnostics) (`player` required on the wire; optional `diagnosticRunId` for sweep correlation). Emission uses the same `publishStreamEvent` + `DiagnosticsEventSerializer` path as other diagnostics producers.

**Evaluation:** For each stale candidate session (non-empty `player` on the meta row), the sweep also queries stream subscription rows (`STREAM#` on `DataCategoryIndex`) and session-character adjacency (`SESSION#${sessionId}` / `CHARACTER#...`) so operators have correlated evidence; findings remain aggregated **per player**.

**Pagination implementation note:** Session-meta enumeration now uses shared `connectionDB.query`/`withQuery` pagination (`{ items, nextToken?, nextPage? }`) rather than direct AWS SDK `QueryCommand` loops, so diagnostics and connections stale-session paths share token handling and page-size guardrails.

## Connections problem-report intake (DataSource lane)

**Purpose:** Receive `mtw.connections` session disconnect problem reports through one diagnostics DataSource subscription/deserialization lane and trigger report-only diagnostics evaluation (D6).

**Intake boundary:**

- [`ingress.ts`](ingress.ts) routes EventBridge ingress onto diagnostics message-bus streaming envelopes.
- [`dataSource/subscribedEvents.ts`](dataSource/subscribedEvents.ts) owns subscribed header/envelope guards for:
  - `mtw.connections` / `Session Disconnect Problem`
  - `mtw.ephemera.objects` / `Spawn Compensation Problem`
  - `api.diagnostics` synthetic command envelopes (`StaleSessionSweep`, `RoomOccupancyDriftSweep`, `PlayerMisalignmentSweep`, `ComponentVerticalMisalignmentSweep`, `RenderCacheDriftSweep`, `OrphanedImprovisedObjectSweep`)
- [`dataSource/index.ts`](dataSource/index.ts) owns subscribed-event handling.

**Handling semantics:**

- `Session Disconnect Problem` intake consumes shared serializer/contracts from [`packages/mtw-interfaces/ts/eventBridge/connections`](../../packages/mtw-interfaces/ts/eventBridge/connections).
- `Spawn Compensation Problem` intake consumes shared serializer/contracts from [`packages/mtw-interfaces/ts/eventBridge/ephemera/objects`](../../packages/mtw-interfaces/ts/eventBridge/ephemera/objects/index.ts); same tidy-failure, invocation dedupe, and report-only sweep trigger semantics as connections problem reports.
- Intake is tidy-failure: malformed/partial payloads are logged and dropped at ingress/deserialization boundaries without throwing.
- Within one lambda invocation, repeated problem reports with the same `dedupeKey` are suppressed before triggering sweep evaluation (invocation-wide `tryClaim` in [`dataSource/intakeDeduper.ts`](dataSource/intakeDeduper.ts); reset on `messageBus.clear()` at handler entry). Applies to both `Session Disconnect Problem` and `Spawn Compensation Problem`.
- Diagnostics remains report-only: problem reports trigger sweep evaluation and finding emission only; diagnostics does not perform storage repairs.
- Bus ingress uses `publish`; boundary drain uses `flushAndSettle()`; direct command return values use ReturnValue/Error `publish` plus [`createBoundaryResponseCollector`](../../packages/mtw-lambda-patterns/ts/messageBus/boundaryResponseCollector.ts) (via [`returnValue/collector.ts`](returnValue/collector.ts)) and [`returnValue/index.ts`](returnValue/index.ts) assembly at the app boundary.

## Steady-state invariants

- **Report-only diagnostics role:** Diagnostics evaluates evidence and emits findings. It does not perform storage repairs in `connections` or `ephemera`.
- **Repair ownership boundaries:** `connections` repairs only `connections`-table state. `ephemera` repairs only `ephemera`-table state.
- **Lifecycle consistency model:** Character connection lifecycle is event-first and eventually consistent across lambdas. Short-lived divergence is acceptable; sweeps/findings are the convergence backstop.
- **Ordering assumptions:** Intake and evaluation do not rely on ordered delivery across problem-report families. Behavior must remain correct under out-of-order and parallel processing.
- **Malformed intake policy:** Invalid or partial inbound problem reports are logged and dropped without crashing handler execution.

## Room Occupancy Drift sweep (ephemera consistency diagnostics)

**Purpose:** Read-only, graph-forward sweep over `Meta::Room.positionGraph` character nodes compared against connections session/character adjacency and membership adjacency reverse index (`POSITION#${roomId}` rows). Emits descriptive findings only; no repairs.

**Entrypoints:**

- Direct invoke only: `type: RoomOccupancyDriftSweep`, optional `diagnosticRunId` and `nowMs` (for tests).
- No `mtw.diagnostics` EventBridge sweep trigger is wired for this slice; diagnostics remains a finding emitter.

**Finding contract:** `mtw.diagnostics` / `Room Occupancy Drift Finding` with payload `{ roomId }`, optional `diagnosticRunId` for sweep correlation. Emission uses `publishStreamEvent` + `DiagnosticsEventSerializer`.

**Evaluation:** For each `Meta::Room` row, enumerate character nodes from stored `positionGraph`. Per character on the graph, flag drift when (a) no live sessions (ghost on graph), or (b) sessions present but membership adjacency does not include this `roomId` (adjacency lag). Does **not** use `Meta::Room.activeCharacters` or `Meta::Character.RoomId`. **Explicit gap:** stale adjacency pointing at a room when the character is absent from that room's `positionGraph` is not detected (room-forward scan only). Implementation: [`roomOccupancyDriftSweep/`](roomOccupancyDriftSweep/).

**Downstream handling:** Ephemera **`mtw.ephemera.positions`** consumes `mtw.diagnostics` / `Room Occupancy Drift Finding` via [`repairRoomOccupancyDrift`](../../lambda/ephemera/dataSource/positions/membership/repairRoomOccupancyDrift.ts) (graph-forward repair; sessions gate; adjacency sync). Parent **`mtw.ephemera`** no longer subscribes to this finding type.

## Orphaned improvised object sweep (existence-without-placement diagnostics)

**Purpose:** Read-only sweep for improvisational **`OBJECT#`** ids with both `(OBJECT#, ASSET#IMPROVISATION)` pair and `Meta::Object` rows present but no positions-lane placement (empty `getMembershipContainers` and no **`Object`** node on any host `positionGraph`). Emits descriptive findings only; no repairs in diagnostics.

**Trigger context:** S1 spawn double-failure --- placement fails after existence create, then compensation delete also fails --- emits **`Spawn Compensation Problem`** on **`mtw.ephemera.objects`** ([`spawnOneImprovisationObject`](../ephemera/dataSource/objects/spawnImprovisationObjectsBatch.ts) via [`streamSpawnCompensationProblem`](../ephemera/dataSource/objects/problemReports.ts); emission contract in [`objects/AGENT.md`](../ephemera/dataSource/objects/AGENT.md)). Normative S1 + existence-without-placement rules: [`positions/AGENT.contract.md`](../ephemera/dataSource/positions/AGENT.contract.md) **Object room membership**.

**Entrypoints:**

- Problem report intake: `mtw.ephemera.objects` / **`Spawn Compensation Problem`** triggers targeted sweep with `objectIds: [objectId]` from the payload.
- Direct invoke: `{ type: 'OrphanedImprovisedObjectSweep', objectIds?: string[], optional diagnosticRunId, optional nowMs }`. Omit **`objectIds`** for full-scan ops backstop (enumerates all `ASSET#IMPROVISATION` pair rows via `DataCategoryIndex`).

**Finding contract:** `mtw.diagnostics` / **`Orphaned Improvised Object Finding`** with payload `{ objectId, diagnosticRunId, timestamp }`. Emission uses `publishStreamEvent` + `DiagnosticsEventSerializer`.

**Evaluation (orphan litmus):** pair row present **and** `Meta::Object` present **and** no **`Object`** node on any `Meta::Room` or `Meta::Character` `positionGraph` **and** `internalCache.Positions.getMembershipContainers(objectId)` returns empty. **Not orphan:** adjacency lag only (graph node present, containers empty) --- owned by [`repairObjectPlacementDrift`](../ephemera/dataSource/positions/membership/repairObjectPlacementDrift.ts). Implementation: [`orphanedImprovisedObjectSweep/`](orphanedImprovisedObjectSweep/).

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

## Related docs

- Diagnostics **`internalCache`** slice (sweep read handlers): [`internalCache/AGENT.md`](internalCache/AGENT.md)
- Objects lane problem-report emission: [`../ephemera/dataSource/objects/AGENT.md`](../ephemera/dataSource/objects/AGENT.md)
- Positions S1 + orphan vs adjacency lag: [`../ephemera/dataSource/positions/AGENT.contract.md`](../ephemera/dataSource/positions/AGENT.contract.md) **Object room membership**
- Assets heal authority and event flow: [`../assets/AGENT.event.md`](../assets/AGENT.event.md)
- Cognito signup publish flow (`mtw.cognito` / `New Player`): [`../cognitoEvent/AGENT.md`](../cognitoEvent/AGENT.md)
- Broader diagnostics schema notes: [`AGENT.schema.planning.md`](AGENT.schema.planning.md)
