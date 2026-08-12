# WML materialized-view resync (`.ndjson` from `.wml`)

**Status:** In progress. Phases 1–4 (event type, routing, handler, downstream-chain verification) done 2026-08-11; next is Phase 5 (graduate durable docs, delete this plan). Designed 2026-08-11 in conversation, out of a gap found while executing [`AGENT.ludicGraphRename.planning.md`](../ephemera/dataSource/positions/AGENT.ludicGraphRename.planning.md)'s Phase 4.5 (OD-10). This plan follows [`taskPlanning/AGENT.md`](../../AGENT.md); skim it once for durability and content-split conventions before editing this file.

## Why this exists (do not re-argue in this plan)

While tracing the ludicGraph rename's Phase 4.5 (manual reseed after rename), we found that `lambda/assets/dataSource/caching/cacheAsset.ts`'s `fileAsset` is **not** a fresh parse of an asset's `.wml` source text --- it is `ReadOnlyAssetWorkspace.loadJSON()` reading a **pre-serialized `.ndjson` cache** from S3 (`packages/mtw-asset-workspace/ts/readOnly.ts:199-220`), written by `pushJSON()` in `lambda/wml/s3Storage/AssetWorkspace.ts` the last time the asset was actually edited/saved. If that cache predates a rename (or any other change to `StandardComponent.toJSON()`/`fromJSON()` shapes), it silently carries the stale field name forever --- `cacheAsset`'s diff compares two sides that both round-trip through the same stale cache and finds nothing to fix.

We also found the existing self-repair pipeline (`lambda/wml/s3Storage/AGENT.selfRepair.md`) does **not** cover this case: its "Materialized View Missing" scenario only fires when `.ndjson`/`.wml` are **absent** from S3 (`workspace.status.s3Missing === true`, set exclusively by whether `.ndjson` exists --- see `pipeline.ts:140-142`, `readOnly.ts:199-220`). A **present-but-stale** `.ndjson` with a current `.wml` is never detected or repaired by anything live. `AssetWorkspace.loadWML()`/`loadWMLFrom()`/`setWML()` (`lambda/wml/s3Storage/AssetWorkspace.ts:79-133`) already contain the logic that *would* fix this --- parse `.wml` fresh, mark the derived JSON dirty --- but have **zero call sites** anywhere in `lambda/`. This plan wires that dead code up into a real, manually-triggerable repair.

This gap is also independently on the roadmap: [`lambda/wml/s3Storage/AGENT.development.md`](../../../lambda/wml/s3Storage/AGENT.development.md#wml-lambda-self-diagnostics) already lists "WML Lambda Self-Diagnostics" (listen for diagnostics events, validate/repair, emit findings) as a medium-priority future item. This plan is a scoped-down first slice of that: one finding type, one manual trigger, no periodic sweep yet (see [Open decisions](#open-decisions-implementation--plan-only), OD-2).

## Getting Started

1. **Durable docs to read first:** [`lambda/wml/s3Storage/AGENT.selfRepair.md`](../../../lambda/wml/s3Storage/AGENT.selfRepair.md) (the existing repair-scenario framework this plan extends without modifying) and [`lambda/wml/AGENT.event.md`](../../../lambda/wml/AGENT.event.md) (event wiring conventions for this lambda) if it exists --- confirm its content matches `app.ts`'s live event-dispatch code before trusting it, since this area has drifted from docs before.
2. **Testing authority:** `lambda/wml`'s own `package.json` `test` script is plain `jest` (confirmed 2026-08-11) --- run `cd lambda/wml && npm test` from that directory. Also `cd packages/mtw-interfaces && npm test` for the new event type, and `cd lambda/assets && npm run test -- --watchAll=false` (per [`lambda/assets/AGENT.testing.md`](../../../lambda/assets/AGENT.testing.md) if present, else confirm its own `package.json`) since the `Content Update` consumer side lives there.
3. **Baseline (should pass before any edits):**
   ```bash
   cd lambda/wml && npm test
   cd packages/mtw-interfaces && npm test
   cd lambda/assets && npm run test -- --watchAll=false
   ```
4. **Hazard:** `AssetWorkspace.loadWML()`/`setWML()` are currently dead code (zero callers) --- wiring them up for the first time may surface latent bugs never exercised in production. Treat this phase's own test-writing as adversarial (feed it a `.wml` that would previously never have reached `setWML`), not just a happy-path smoke test.

---

## Design (settled in conversation 2026-08-11, not re-litigated here)

**New EventBridge diagnostic finding**, mirroring the existing `Cache Consistency Finding` pattern (`packages/mtw-interfaces/ts/eventBridge/diagnostics/index.ts:26-32`) rather than reusing it --- a distinct type because it names a different layer (`.ndjson` vs `.wml`, not DynamoDB vs asset cache):

```ts
export type DiagnosticsWMLMaterializedViewFindingEvent = {
    type: 'WML Materialized View Finding'
    assetId: string
    diagnosticRunId: string
    timestamp: string
}
```

No `status` field --- unlike `Cache Consistency Finding` (`'stale' | 'missing'`, itself unused by its own handler's branching, see `lambda/assets/dataSource/index.ts:136-152`), this finding always means the same thing and always triggers the same unconditional action.

**Routing:** add `WML Materialized View Finding` to the `WMLFunction`'s `Diagnostics` `CloudWatchEvent` detail-type list in `template.yaml` (currently only `S3 Structure Finding`, `template.yaml:1689-1697`). Source stays `mtw.diagnostics`, same bus (`${TablePrefix}-bus`).

**Handler:** new `processWMLMaterializedViewFinding` in `lambda/wml/dataSource/mtw-wml.ts`, dispatched from the existing `isDiagnosticsEnvelope(event)` branch (`mtw-wml.ts:379-381`) alongside `processS3StructureFinding` (`mtw-wml.ts:317-341`), same shape:
1. `AssetWorkspace.fromUUID(assetId, { preferDynamo: false, allowS3Fallback: true })` --- confirmed usable outside player/auth context, already proven by the `promoteToCanon` call path (`lambda/wml/app.ts:154,165`).
2. `await workspace.loadWML()` (`AssetWorkspace.ts:79-96`) --- parses `.wml` fresh into a new `StandardForm`, via `setWML()` (`:63-66`). This is the dead code being wired up; verify its current behavior against a live asset before trusting it blindly (see Getting Started hazard note).
3. `await workspace.pushJSON()` (`AssetWorkspace.ts:139-170`) --- writes the freshly-parsed content to `.ndjson`. No `pushWML()` needed; `.wml` content is unchanged, only its derived cache was stale.
4. **Must** then publish a `Content Update` event via `streamEvent`, matching `processApplyEdit`'s call (`mtw-wml.ts:142-148`) --- `header: { type: 'Content Update' }`, `update: { schema: <freshly-parsed StandardForm> }`. **This step is not optional and is easy to silently skip**: `appendChunk`/`pushJSON` themselves never publish anything (verified 2026-08-11, no EventBridge/messageBus references in `s3Storage/index.ts`); the publish is a separate, explicit step normally done by the DataSource layer after a successful edit. Skipping it means `.ndjson` gets fixed in S3 but `lambda/assets`/DynamoDB never hears about it and stays stale --- silent, not an error.
5. No manifest event appended --- content isn't changing, only its derived cache, matching Scenario 2's reconstruction precedent (`repairEvents: []` when nothing new happened, per `AGENT.selfRepair.md`). Log via `console.log` per this pipeline's existing observability convention (`AGENT.selfRepair.md`'s "All repair actions are logged with clear context").

**Manual trigger**, once built:
```bash
aws events put-events --entries '[{
  "EventBusName": "mtw-bus", "Source": "mtw.diagnostics",
  "DetailType": "WML Materialized View Finding",
  "Detail": "{\"assetId\":\"ASSET#primitives\",\"diagnosticRunId\":\"manual-1\",\"timestamp\":\"2026-08-11T00:00:00.000Z\"}"
}]'
```
`assetId` accepts the full `ASSET#`-prefixed form (normalize the same way `handleCacheConsistencyFinding` does, via `AssetKey()`, if the handler needs to tolerate a bare id too).

---

## Open decisions (implementation --- plan only)

Plan-only: decisions being made in order to execute this feature. Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in the relevant durable doc and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **OD-1** | Does `assetId` in the new event need normalization (`AssetKey()`) inside the handler, or is it always published in canonical `ASSET#`-prefixed form by whoever triggers it? | Phase 3 | **Decided 2026-08-11 (Phase 3 execution): normalize defensively.** `processWMLMaterializedViewFinding` calls `AssetKey(payload.assetId)` before `isSchemaAssetUUID` validation and `AssetWorkspace.fromUUID`, matching `handleCacheConsistencyFinding`'s pattern; `AssetKey()` is idempotent on an already-`ASSET#`-prefixed value, so this is safe either way. Confirmed via test (bare `'test-asset'` normalizes to `'ASSET#test-asset'`). |
| **OD-2** | Is a periodic/automatic sweep (detecting `.ndjson`/`.wml` drift across all assets and emitting findings) in scope for this slice, or deferred? | Phase 1 start | **Decided 2026-08-11 (user confirmed): deferred.** This plan builds the manual-trigger primitive only, matching `lambda/wml/s3Storage/AGENT.development.md`'s "WML Lambda Self-Diagnostics" roadmap item without committing to its detection half yet. A future plan can add the sweep as a separate initiative once the manual primitive has been exercised in practice. |
| **OD-3** | Should the new finding type reuse `Cache Consistency Finding`'s shape/name, or be distinct? | Phase 1 | **Decided 2026-08-11: distinct type, `WML Materialized View Finding`.** Reusing the name would conflate two different layers of staleness (DynamoDB-vs-asset-cache, and `.ndjson`-vs-`.wml`) under one name --- exactly the kind of naming lie the ludicGraph rename plan spent its effort removing. See [Design](#design-settled-in-conversation-2026-08-11-not-re-litigated-here). |
| **OD-4** | Does the handler need to guard against re-triggering on an asset whose `.ndjson` is already fresh (i.e. is `loadWML()` + `pushJSON()` safe/idempotent to run redundantly)? | Phase 3 | **Decided 2026-08-11 (Phase 3 execution): yes, safe --- confirmed by an explicit idempotency test** (`mtw-wml.test.ts`'s "should be idempotent when run twice against the same asset") rather than assumed. Separately, Phase 3 surfaced and fixed a real hazard here: `AssetWorkspace.fromUUID` does **not** preload `.standard` from the existing `.ndjson`, and `pushJSON()` falls back to an **empty** `StandardForm` when `.standard` is unset --- so if `loadWML()` fails (`.wml` missing/inaccessible, `status.wml = 'Error'`), an unconditional `pushJSON()` would have overwritten a healthy `.ndjson` with empty content. The handler now checks `workspace.standard` truthiness after `loadWML()` and skips `pushJSON()`/`streamEvent` entirely on load failure. |

---

## Recommended order

Use `[ ]` for pending and `[X]` for complete; mark nested lines `[X]` as each sub-step finishes.

- [X] **Phase 1. Add the event type.** `packages/mtw-interfaces/ts/eventBridge/diagnostics/index.ts`: add `DiagnosticsWMLMaterializedViewFindingEvent` (per [Design](#design-settled-in-conversation-2026-08-11-not-re-litigated-here)), fold it into whatever union type aggregates diagnostics events for serialization (check how `DiagnosticsCacheConsistencyFindingEvent` is threaded through the file's serializer/deserializer, roughly lines 349-357 and 443-457 per prior tracing --- re-verify against live code, not this note, before editing), and add/adjust type guards analogous to `isDiagnosticsCacheConsistencyFindingEvent` if that pattern exists.
  - [X] `cd packages/mtw-interfaces && npm test`
- [X] **Phase 2. Wire routing.** `template.yaml`'s `WMLFunction` `Diagnostics` `CloudWatchEvent` block (`~1689-1698`): added `WML Materialized View Finding` to the `detail-type` list. **OD-1** turned out not to be resolvable here --- the `Pattern` block only matches envelope `source`/`detail-type`, not `Detail.assetId` --- re-scoped to block Phase 3 instead. Confirmed the pre-Phase-3 dispatcher (`lambda/wml/dataSource/mtw-wml.ts:379-381`, `:322`) safely no-ops on this new detail-type until a handler exists, so wiring routing ahead of the handler is not a hazard.
- [X] **Phase 3. Implement the handler.** `lambda/wml/dataSource/mtw-wml.ts`: added `processWMLMaterializedViewFinding`, dispatched from the `isDiagnosticsEnvelope` branch alongside (not replacing) `processS3StructureFinding` --- both run unconditionally on every diagnostics envelope, each no-oping via its own type guard when the payload doesn't match. Implements the 5-step body from [Design](#design-settled-in-conversation-2026-08-11-not-re-litigated-here) --- `AssetWorkspace.fromUUID` -> `loadWML()` -> `pushJSON()` -> `streamEvent({ header: { type: 'Content Update' } })` --- with one deviation from the original 5-step sketch: `pushJSON()`/`streamEvent` are now gated on `workspace.standard` being set after `loadWML()`, not called unconditionally (see **OD-4** resolution above for why). Resolved **OD-1** and **OD-4** with explicit tests, not assumptions. `lambda/wml/dataSource/subscribedEvents.ts` needed **no change** --- confirmed its catch-all `isDiagnosticsHeader` (`subscribedEvents.ts:55-56`) already matches any `type` on `dataSourceKey: 'mtw.diagnostics'`.
  - [X] `cd lambda/wml && npm test` (281/281 passing, up from 276 baseline)
- [X] **Phase 4. Verify the downstream chain end to end.** Confirmed no cross-lambda test harness (real `PutEventsCommand` -> real Lambda invocation) exists anywhere in this repo --- the only `*.integration.test.ts` precedent (`lambda/ephemera/dataSource/*.integration.test.ts`) is single-process (real internal `messageBus`/DataSource wiring, leaf I/O mocked). Built the proportionate equivalent for this boundary instead: [`lambda/assets/dataSource/contentUpdate.integration.test.ts`](../../../lambda/assets/dataSource/contentUpdate.integration.test.ts) round-trips a `Content Update` payload through the **real** `WMLEventSerializer` (serialize then deserialize, the same serializer `lambda/assets/app.ts` instantiates) into the **real, unmocked** `assetsDataSource.receiveEvents` -> `handleContentUpdate` -> `cacheAsset`, with only S3 (`ReadOnlyAssetWorkspace`) and DynamoDB (`assetDB`) mocked at the leaves (reusing `cacheAsset.test.ts`'s established mock pattern). One test proves a stale-vs-fresh diff produces the correct DynamoDB write and downstream `Asset Cached` event; a second proves idempotency (matching content -> no writes), mirroring OD-4's concern at the consumer side. The genuinely cross-process leg (real EventBridge, real Lambda invocation) stays the documented manual [manual trigger](#design-settled-in-conversation-2026-08-11-not-re-litigated-here) command --- not run in this slice. Durable doc updated: [`lambda/wml/AGENT.event.md`](../../../lambda/wml/AGENT.event.md)'s "Integration Testing Needs" list now points to the new test and is explicit about what remains unverified (`applyEdit`'s own `Content Update` leg, and the real cross-process leg).
  - [X] `cd lambda/assets && npm run test -- --watchAll=false` (28/28 suites, 186/186 tests passing, including the 2 new integration tests; no regressions)
  - [X] `cd lambda/wml && npm test` (281/281, baseline unchanged) and `cd packages/mtw-interfaces && npm test` (610/610, baseline unchanged)
- [ ] **Phase 5. Graduate and delete this plan.** Per `taskPlanning/AGENT.md`'s deletion litmus test, this plan's durable content belongs in: `lambda/wml/s3Storage/AGENT.selfRepair.md` (add this as a named scenario, e.g. "Scenario 4: Materialized View Present but Stale"), `lambda/wml/AGENT.event.md` (or wherever this lambda documents its event surface) for the new finding type and handler, and `lambda/wml/s3Storage/AGENT.development.md`'s "WML Lambda Self-Diagnostics" section (mark this slice done, note the sweep half is still open per OD-2). Once those are written, delete this file and remove the dependency line it added to [`AGENT.ludicGraphRename.planning.md`](../ephemera/dataSource/positions/AGENT.ludicGraphRename.planning.md)'s Phase 4.5 (replace with a pointer to `AGENT.selfRepair.md`'s new scenario instead).

---

## Verification

```bash
cd packages/mtw-interfaces && npm test
cd lambda/wml && npm test
cd lambda/assets && npm run test -- --watchAll=false
```

Manual, once deployed (see the [manual trigger](#design-settled-in-conversation-2026-08-11-not-re-litigated-here) command): publish the event for a known asset with a deliberately-stale `.ndjson`, then confirm (a) the S3 `.ndjson` object was rewritten with current field names, and (b) the asset's `assetDB` rows in DynamoDB were updated to match, without manually also triggering a `Cache Consistency Finding` event --- the whole point of chaining the `Content Update` publish is that one event does both repairs.
