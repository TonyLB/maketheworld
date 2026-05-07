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
  - `api.diagnostics` synthetic command envelopes (`StaleSessionSweep`, `RoomOccupancyDriftSweep`)
- [`dataSource/index.ts`](dataSource/index.ts) owns subscribed-event handling.

**Handling semantics:**

- `Session Disconnect Problem` intake consumes shared serializer/contracts from [`packages/mtw-interfaces/ts/eventBridge/connections`](../../packages/mtw-interfaces/ts/eventBridge/connections).
- Intake is tidy-failure: malformed/partial payloads are logged and dropped at ingress/deserialization boundaries without throwing.
- Within a single receive batch, repeated problem reports with the same `dedupeKey` are suppressed before triggering sweep evaluation.
- Diagnostics remains report-only: problem reports trigger `staleSessionSweep` evaluation and finding emission only; diagnostics does not perform connections-table repairs.
- Direct command return values now use message-bus `ReturnValue`/`Error` delivery plus app-boundary extraction (`returnValue/index.ts`) rather than direct `app.ts` returns, matching the `connections` pattern.

## Steady-state invariants

- **Report-only diagnostics role:** Diagnostics evaluates evidence and emits findings. It does not perform storage repairs in `connections` or `ephemera`.
- **Repair ownership boundaries:** `connections` repairs only `connections`-table state. `ephemera` repairs only `ephemera`-table state.
- **Lifecycle consistency model:** Character connection lifecycle is event-first and eventually consistent across lambdas. Short-lived divergence is acceptable; sweeps/findings are the convergence backstop.
- **Ordering assumptions:** Intake and evaluation do not rely on ordered delivery across problem-report families. Behavior must remain correct under out-of-order and parallel processing.
- **Malformed intake policy:** Invalid or partial inbound problem reports are logged and dropped without crashing handler execution.

## Room Occupancy Drift sweep (ephemera consistency diagnostics)

**Purpose:** Read-only sweep over room occupancy snapshots (`Meta::Room.activeCharacters[].SessionIds`) compared against authoritative membership (`connections` session/character adjacency + `Meta::Character.RoomId`). Emits descriptive findings only; no repairs.

**Entrypoints:**

- Direct invoke only: `type: RoomOccupancyDriftSweep`, optional `diagnosticRunId` and `nowMs` (for tests).
- No `mtw.diagnostics` EventBridge sweep trigger is wired for this slice; diagnostics remains a finding emitter.

**Finding contract:** `mtw.diagnostics` / `Room Occupancy Drift Finding` with payload `{ roomId }`, optional `diagnosticRunId` for sweep correlation. Emission uses `publishStreamEvent` + `DiagnosticsEventSerializer`.

**Evaluation:** The sweep compares sorted occupancy fingerprints per room (`characterId + SessionIds`) against authoritative adjacency-derived occupancy constrained by `Meta::Character.RoomId`. Rooms with mixed-valid/mixed-invalid entries still emit one finding. Cases where occupancy contains characters lacking a usable authoritative room are marked as `checkLocation` delegation candidates for downstream repair handling (still report-only in diagnostics).

**Downstream handling:** Ephemera consumes `mtw.diagnostics` / `Room Occupancy Drift Finding` and performs idempotent `ephemera`-table-only reconciliation for the targeted room (`lambda/ephemera/dataSource/selfHealing/roomOccupancyDriftFinding.ts`), including room cache refresh and `RoomUpdate` signaling.

## Player Misalignment sweep (player heal targeting diagnostics)

**Purpose:** Read-only sweep over assets-table player evidence to identify players that likely need `healPlayer` reconciliation. Emits findings only; diagnostics does not mutate assets state.

**Entrypoints:**

- Direct invoke only: `type: PlayerMisalignmentSweep`, optional `diagnosticRunId` and `nowMs` (for tests/operators).
- Routed through synthetic `api.diagnostics` ingress and diagnostics DataSource subscribed-event dispatch.

**Finding contract:** `mtw.diagnostics` / `Player Misalignment Finding` with payload `{ player }`, optional `diagnosticRunId` for sweep correlation. Emission uses `publishStreamEvent` + `DiagnosticsEventSerializer`.

**Evaluation:** The sweep enumerates assets-table evidence (no Cognito `ListUsers`): `Meta::Player` rows plus player references on `Meta::Asset`/`Meta::Character`. It flags players when player meta is missing, guest fields are missing, or coyote guest-name invariants are misaligned.

**Downstream handling:** Assets consumes `mtw.diagnostics` / `Player Misalignment Finding` and runs idempotent `healPlayer` in the owning domain.

## Related docs

- Assets heal authority and event flow: [`../assets/AGENT.event.md`](../assets/AGENT.event.md)
- Cognito signup publish flow (`mtw.cognito` / `New Player`): [`../cognitoEvent/AGENT.md`](../cognitoEvent/AGENT.md)
- Broader diagnostics schema notes: [`AGENT.schema.planning.md`](AGENT.schema.planning.md)
