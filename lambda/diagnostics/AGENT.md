# Diagnostics lambda

## Stale Session sweep (connections consistency)

**Purpose:** Read-only sweep over the `connections` table for `Meta::Session` rows that should have completed disconnect cleanup (per initiative decision D4/D6). Emits descriptive findings only; no repairs.

**Entrypoints:**

- EventBridge: `source: mtw.diagnostics`, `detail-type: Stale Session Sweep`, optional `detail.diagnosticRunId` (string).
- Direct invoke: `type: StaleSessionSweep`, optional `diagnosticRunId` and `nowMs` (for tests).

**Thresholds:** See `STALE_BUFFER_MS` in [`staleSessionSweep/classification.ts`](staleSessionSweep/classification.ts) (slack after `dropAfter` before classifying a session meta row as stale; suppresses false positives during normal `dropConnection` / Step Functions timing).

**Finding contract:** `mtw.diagnostics` / `Stale SessionId Finding` with payload shape defined in [`packages/mtw-interfaces/ts/eventBridge/diagnostics`](../../packages/mtw-interfaces/ts/eventBridge/diagnostics) (`player` required on the wire; optional `diagnosticRunId` for sweep correlation). Emission uses the same `publishStreamEvent` + `DiagnosticsEventSerializer` path as other diagnostics producers.

**Evaluation:** For each stale candidate session (non-empty `player` on the meta row), the sweep also queries stream subscription rows (`STREAM#` on `DataCategoryIndex`) and session-character adjacency (`SESSION#${sessionId}` / `CHARACTER#...`) so operators have correlated evidence; findings remain aggregated **per player**.

## Related docs

- Task initiative: [`taskPlanning/lambda/diagnostics/AGENT.connectionsRefactor.planning.md`](../../taskPlanning/lambda/diagnostics/AGENT.connectionsRefactor.planning.md)
- Broader diagnostics schema notes: [`AGENT.schema.planning.md`](AGENT.schema.planning.md)
