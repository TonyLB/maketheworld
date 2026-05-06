# Diagnostics lambda

## Stale Session sweep (connections consistency)

**Purpose:** Read-only sweep over the `connections` table for `Meta::Session` rows that should have completed disconnect cleanup (per initiative decision D4/D6). Emits descriptive findings only; no repairs.

**Entrypoints:**

- EventBridge: `source: mtw.diagnostics`, `detail-type: Stale Session Sweep`, optional `detail.diagnosticRunId` (string).
- Direct invoke: `type: StaleSessionSweep`, optional `diagnosticRunId` and `nowMs` (for tests).

**Thresholds:** See `STALE_BUFFER_MS` in [`staleSessionSweep/classification.ts`](staleSessionSweep/classification.ts) (slack after `dropAfter` before classifying a session meta row as stale; suppresses false positives during normal `dropConnection` / Step Functions timing).

**Finding contract:** `mtw.diagnostics` / `Stale SessionId Finding` with payload shape defined in [`packages/mtw-interfaces/ts/eventBridge/diagnostics`](../../packages/mtw-interfaces/ts/eventBridge/diagnostics) (`player` required on the wire; optional `diagnosticRunId` for sweep correlation). Emission uses the same `publishStreamEvent` + `DiagnosticsEventSerializer` path as other diagnostics producers.

**Evaluation:** For each stale candidate session (non-empty `player` on the meta row), the sweep also queries stream subscription rows (`STREAM#` on `DataCategoryIndex`) and session-character adjacency (`SESSION#${sessionId}` / `CHARACTER#...`) so operators have correlated evidence; findings remain aggregated **per player**.

**Pagination implementation note:** Session-meta enumeration now uses shared `connectionDB.query`/`withQuery` pagination (`{ items, nextToken?, nextPage? }`) rather than direct AWS SDK `QueryCommand` loops, so diagnostics and connections stale-session paths share token handling and page-size guardrails.

## Connections problem-report intake (DataSource lane)

**Purpose:** Receive `mtw.connections` problem reports through one diagnostics DataSource subscription/deserialization lane and trigger report-only diagnostics evaluation (D6).

**Intake boundary:**

- [`ingress.ts`](ingress.ts) routes EventBridge ingress onto diagnostics message-bus streaming envelopes.
- [`dataSource/subscribedEvents.ts`](dataSource/subscribedEvents.ts) owns subscribed header/envelope guards for:
  - `mtw.connections` / `Session Disconnect Problem`
  - `mtw.diagnostics` / `Stale Session Sweep`
- [`dataSource/index.ts`](dataSource/index.ts) owns subscribed-event handling.

**Handling semantics:**

- `Session Disconnect Problem` intake consumes shared serializer/contracts from [`packages/mtw-interfaces/ts/eventBridge/connections`](../../packages/mtw-interfaces/ts/eventBridge/connections).
- Intake is tidy-failure: malformed/partial payloads are logged and dropped at ingress/deserialization boundaries without throwing.
- Within a single receive batch, repeated problem reports with the same `dedupeKey` are suppressed before triggering sweep evaluation.
- Diagnostics remains report-only: problem reports trigger `staleSessionSweep` evaluation and finding emission only; diagnostics does not perform connections-table repairs.

## Room Occupancy Drift sweep (ephemera consistency diagnostics)

**Purpose:** Read-only sweep over room occupancy snapshots (`Meta::Room.activeCharacters[].SessionIds`) compared against authoritative membership (`connections` session/character adjacency + `Meta::Character.RoomId`). Emits descriptive findings only; no repairs.

**Entrypoints:**

- Direct invoke only: `type: RoomOccupancyDriftSweep`, optional `diagnosticRunId` and `nowMs` (for tests).
- No `mtw.diagnostics` EventBridge sweep trigger is wired for this slice; diagnostics remains a finding emitter.

**Finding contract:** `mtw.diagnostics` / `Room Occupancy Drift Finding` with payload `{ roomId }`, optional `diagnosticRunId` for sweep correlation. Emission uses `publishStreamEvent` + `DiagnosticsEventSerializer`.

**Evaluation:** The sweep compares sorted occupancy fingerprints per room (`characterId + SessionIds`) against authoritative adjacency-derived occupancy constrained by `Meta::Character.RoomId`. Rooms with mixed-valid/mixed-invalid entries still emit one finding. Cases where occupancy contains characters lacking a usable authoritative room are marked as `checkLocation` delegation candidates for downstream repair handling (still report-only in diagnostics).

**Downstream handling:** Ephemera consumes `mtw.diagnostics` / `Room Occupancy Drift Finding` and performs idempotent `ephemera`-table-only reconciliation for the targeted room (`lambda/ephemera/dataSource/selfHealing/roomOccupancyDriftFinding.ts`), including room cache refresh and `RoomUpdate` signaling.

## Related docs

- Task initiative: [`taskPlanning/lambda/diagnostics/AGENT.connectionsRefactor.planning.md`](../../taskPlanning/lambda/diagnostics/AGENT.connectionsRefactor.planning.md)
- Broader diagnostics schema notes: [`AGENT.schema.planning.md`](AGENT.schema.planning.md)
