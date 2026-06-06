# extendedHeader RequestIds client fix (charcoal-client)

**Status:** Deferred. **Next step:** Log GitHub Issue from this plan; implement when scheduled. WML subscribe merge fix shipped 2026-06-06.

This plan is task-scoped. Archive or delete after the fix ships and any lasting contract notes move into durable docs.

**Framework:** [`taskPlanning/AGENT.md`](../../../AGENT.md)

**Area development notes:** [`taskPlanning/charcoal-client/AGENT.development.md`](../../AGENT.development.md)

**Discovered during:** Phase 2 manual smoke test of WML timing investigation (2026-06-05). Not root cause of thin `materializedView` on reload.

---

## Purpose

Restore **RequestId correlation** on `mtw.wml` StreamEvents when the WebSocket message carries `RequestIds` under **`extendedHeader`**, so confirmed-id tracking and `pendingHygieneCheck` behave as designed.

---

## Problem statement

**Observed wire shape** (failure repro, Network tab):

```json
{
  "messageType": "StreamEvent",
  "eventType": "Content Update",
  "dataSourceKey": "mtw.wml",
  "streamKey": "ASSET#...",
  "timestamp": 1780693328753,
  "update": { "wml": "..." },
  "extendedHeader": { "RequestIds": ["09cb6763-..."] }
}
```

**Canonical WebSocket shape** per [`formatTransform`](../../../../packages/mtw-lambda-patterns/ts/dataSource/formatTransform.ts) / [`formatTransform.test.ts`](../../../../packages/mtw-lambda-patterns/ts/dataSource/formatTransform.test.ts): `RequestIds` **top-level** on the message; `fromWebSocketFormat` merges into `header.RequestIds`.

**Client today** reads only `header.RequestIds` / `header.RequestId`:

| Consumer | File | Impact when ids nested |
| --- | --- | --- |
| Confirmed id storage | [`requestIdTracking.ts`](../../../../charcoal-client/src/slices/dataSource/requestIdTracking.ts) `extractConfirmedIdsFromHeader` | `confirmedRequestIds` stays `[]` |
| Stream update | [`reducers.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.ts) `buildStreamUpdate` | Same |
| Pending hygiene | [`personalAssets/index.ts`](../../../../charcoal-client/src/slices/personalAssets/index.ts) `pendingHygieneCheck` | `headerIds` empty; pending rows not cleared by stream confirm |

**Redux evidence:** `recentEvents[].header.extendedHeader.RequestIds` populated; `confirmedRequestIds: []`.

**Tests:** mocks use flat `header.RequestIds` ([`pendingHygiene.test.ts`](../../../../charcoal-client/src/slices/personalAssets/pendingHygiene.test.ts), dataSource index tests) --- CI can pass while production wire differs.

---

## Symptoms / risks (not WML timing bug)

- **Saving indicator** may stick (`pendingEdits` not cleared on Content Update confirm).
- **Duplicate overlay** in `getLocalStandardForm` (pending + base) --- the race personalAssets optimistic flow was built to avoid.
- **Merge Conflict toast** may not correlate (`pendingHygieneCheck` uses `headerIds`).
- **Misleading debugging** when investigating stream confirm (empty `confirmedRequestIds`).

---

## Scope

**In scope:**

- Client normalization: single helper to read RequestIds from header (flat + `extendedHeader` nested).
- Wire all consumers: `requestIdTracking`, any direct `header.RequestIds` reads on WML envelopes.
- Tests with **nested** `extendedHeader.RequestIds` shape (parity with production Network).
- Document expected WS shape in [`dataSource/AGENT.implementation.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.implementation.md) or [`wmlDataSource/AGENT.md`](../../../../charcoal-client/src/slices/wmlDataSource/AGENT.md) if contract is clarified.

**Out of scope (investigate separately if needed):**

- Whether feedback/subscription pipeline should **flatten** `extendedHeader` to top-level `RequestIds` before send (backend/contract fix).

---

## Getting Started

1. **Task planning conventions:** [`taskPlanning/AGENT.md`](../../../AGENT.md)
2. **Format transform / wire shapes:** [`packages/mtw-lambda-patterns/ts/dataSource/formatTransform.ts`](../../../../packages/mtw-lambda-patterns/ts/dataSource/formatTransform.ts), [`AGENT.implementation.md`](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (**extendedHeader** sections)
3. **WML header contract:** [`packages/mtw-interfaces/ts/eventBridge/wml/index.ts`](../../../../packages/mtw-interfaces/ts/eventBridge/wml/index.ts) (RequestIds envelope-level)
4. **personalAssets pending hygiene:** [`personalAssets/AGENT.md`](../../../../charcoal-client/src/slices/personalAssets/AGENT.md)

**Test command authority:** [`taskPlanning/charcoal-client/AGENT.development.md`](../../AGENT.development.md). Run from `charcoal-client/`.

**Baseline (before edits):**

```bash
cd charcoal-client
npm run test:single -- src/slices/dataSource/reducers.test.ts
npm run test:single -- src/slices/personalAssets/pendingHygiene.test.ts
npm run test:single -- src/slices/wmlDataSource/index.test.ts
```

---

## Progress

| Phase | Description | Status |
| --- | --- | --- |
| 0 | Discovery (WML timing Phase 2) | Done |
| 1 | GitHub Issue logged | Not started |
| 2 | Implement header normalization + tests | Not started |
| 3 | Optional: trace WS producer; align flatten vs nested | Not started |
| 4 | Archive task plan | Not started |

---

## Recommended approach (draft)

Mark pending work `[ ]` and completed work `[X]` (including nested bullets as you finish them).

### Option A --- Client normalize (preferred first)

1. Add `extractRequestIdsFromStreamingHeader(header)` in [`requestIdTracking.ts`](../../../../charcoal-client/src/slices/dataSource/requestIdTracking.ts) (or shared util):
   - Read `header.RequestIds` / `header.RequestId` (existing).
   - If empty, read `(header as any).extendedHeader?.RequestIds` (array) and `extendedHeader?.RequestId` (singular).
2. Use helper in `extractConfirmedIdsFromHeader`, `pendingHygieneCheck`.
3. Add tests: nested `extendedHeader` on envelope; assert `confirmedRequestIds` and hygiene clear pending.

### Option B --- Wire producer alignment

1. Find StreamEvent path to browser (feedback lambda / subscription service).
2. If producer sends nested `extendedHeader` but `toWebSocketFormat` specifies flat merge, fix producer to match contract.
3. Keep Option A as defense-in-depth.

---

## Recommended order

Mark pending work `[ ]` and completed work `[X]` (including nested bullets as you finish them).

- [ ] **Phase 1 --- Track**
  - [ ] Create GitHub Issue (title suggestion: "Client ignores extendedHeader.RequestIds on mtw.wml StreamEvents")
  - [ ] Link Issue in this plan **Progress** / status line
- [ ] **Phase 2 --- Fix**
  - [ ] Implement `extractRequestIdsFromStreamingHeader` (or extend existing extractors)
  - [ ] Update `requestIdTracking`, `pendingHygieneCheck`
  - [ ] Add tests with nested `extendedHeader.RequestIds` wire shape
  - [ ] Run baseline tests (see **Verification**)
- [ ] **Phase 3 --- Contract (optional)**
  - [ ] Trace WS producer; decide flatten vs document nested as allowed
  - [ ] Update durable doc if contract changes
- [ ] **Phase 4 --- Close**
  - [ ] Manual smoke: save edit -> Content Update clears pending / `confirmedRequestIds` populated
  - [ ] Archive or delete this task plan

---

## Verification

**Automated:**

```bash
cd charcoal-client
npm run test:single -- src/slices/dataSource/reducers.test.ts
npm run test:single -- src/slices/dataSource/requestIdTracking.test.ts
npm run test:single -- src/slices/personalAssets/pendingHygiene.test.ts
npm run test:single -- src/slices/wmlDataSource/index.test.ts
```

(Add `requestIdTracking.test.ts` if helper is new and untested.)

**Manual:**

1. Save an edit on a subscribed asset.
2. On Content Update in Network, confirm `extendedHeader.RequestIds` (or flat `RequestIds` after producer fix).
3. Redux: `wmlDataSource.subscribedStreams[<assetId>].confirmedRequestIds` includes client `requestId`.
4. `pendingEdits` for that asset clears; saving indicator drops.

---

## GitHub Issue draft (for logging)

**Title:** Client ignores `extendedHeader.RequestIds` on mtw.wml StreamEvents

**Summary:**

- WebSocket Content Updates carry `extendedHeader.RequestIds`; client reads only `header.RequestIds`.
- `confirmedRequestIds` empty; `pendingHygieneCheck` does not clear pending on stream confirm.
- Discovered during WML timing investigation; separate from reload merge bug.
- Plan: [`taskPlanning/charcoal-client/src/slices/AGENT.extendedHeaderRequestIdFix.planning.md`](AGENT.extendedHeaderRequestIdFix.planning.md)

**Labels:** `charcoal-client`, `bug` (adjust to house style)

---

## Coordination notes

- If both RequestId fix and other WML work land in same PR, keep commits/review slices separate.
- Dynamo/EventBridge formats intentionally use `extendedHeader`; WebSocket docs say extended fields merge at top level --- clarify which rule applies to live WS messages.
