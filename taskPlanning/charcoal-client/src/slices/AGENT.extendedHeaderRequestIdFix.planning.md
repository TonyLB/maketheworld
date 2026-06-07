# extendedHeader RequestIds client fix (charcoal-client)

**Status:** Phase 2 shipped (feedback lambda replay alignment). **Next step:** Phase 4 manual smoke on save confirm; investigate separately if empty `confirmedRequestIds` persists on live path. WML subscribe merge fix shipped 2026-06-06.

This plan is task-scoped. Archive or delete after verification and any lasting contract notes move into durable docs.

**Framework:** [`taskPlanning/AGENT.md`](../../../AGENT.md)

**Area development notes:** [`taskPlanning/charcoal-client/AGENT.development.md`](../../AGENT.development.md)

**Discovered during:** Phase 2 manual smoke test of WML timing investigation (2026-06-05). Not root cause of thin `materializedView` on reload.

---

## Purpose

Ensure **RequestId correlation** on `mtw.wml` StreamEvents works for subscribe **replay** delivery (and clarify live vs replay wire contracts).

---

## Re-assessment (2026-06-07)

### Original hypothesis

Network tab showed Content Update with nested `extendedHeader.RequestIds`; Redux had `recentEvents[].header.extendedHeader.RequestIds` and empty `confirmedRequestIds`. Hypothesis: client ignores nested ids.

### Corrected understanding

Two WebSocket delivery paths exist:

| Path | Producer chain | Wire shape for extended fields |
| --- | --- | --- |
| **Live** | WML `streamEvent` -> EventBridge -> subscriptions lambda -> `toWebSocketFormat` | Flat top-level `RequestIds` (canonical) |
| **Replay** | `deliverReplayData` -> SNS (`toSNSFeedbackFormat`) -> feedback lambda -> WebSocket | Was nested `extendedHeader` (SNS passthrough bug) |

- **`toWebSocketFormat` never emits nested `extendedHeader`** --- it flattens extended header fields to the message top level.
- Client code reading flat `header.RequestIds` is **correct** for the live path (verified by subscriptions WML round-trip test).
- Nested `extendedHeader` on the wire came from **feedback lambda passthrough** of SNS Feedback format, not from canonical WebSocket serialization.
- Original Network-tab evidence may have been a **replayed** Content Update during subscribe, not the live save confirm. Empty `confirmedRequestIds` on save may have a **different root cause** if live messages already carry flat `RequestIds`.

### Fix shipped (Phase 2)

[`lambda/feedback/app.ts`](../../../../lambda/feedback/app.ts): StreamEvent branch runs `fromSNSFeedbackFormat` -> `toWebSocketFormat` before WebSocket send (same pattern as subscriptions lambda). Replay delivery now matches live flat WebSocket contract.

Client: removed nested `extendedHeader` fallback in `extractReplayAtFromSnapshotHeader` (no longer needed after feedback fix).

---

## Problem statement (historical)

**Observed wire shape** (failure repro, Network tab --- likely replay path):

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

**Root cause:** Feedback lambda forwarded SNS Feedback body without deserializing to CoreExternalFormat and re-serializing via `toWebSocketFormat`.

---

## Scope (as implemented)

**In scope (done):**

- Feedback lambda StreamEvent alignment: SNS -> CoreExternalFormat -> flat WebSocket.
- Unit tests in [`lambda/feedback/app.test.ts`](../../../../lambda/feedback/app.test.ts).
- Client `streamEventPubSub` replayAt simplification + ingress test for flat `RequestIds`.
- Durable docs: feedback AGENT, streamEventPubSub AGENT, mtw-lambda-patterns AGENT.implementation.

**Out of scope / deferred:**

- Client-side nested `extendedHeader` one-offs in `requestIdTracking` (not needed after feedback fix).
- Live save confirm investigation if symptom persists (separate from replay wire shape).

---

## Getting Started

1. **Task planning conventions:** [`taskPlanning/AGENT.md`](../../../AGENT.md)
2. **Format transform / wire shapes:** [`packages/mtw-lambda-patterns/ts/dataSource/formatTransform.ts`](../../../../packages/mtw-lambda-patterns/ts/dataSource/formatTransform.ts), [`AGENT.implementation.md`](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md)
3. **Feedback lambda:** [`lambda/feedback/AGENT.md`](../../../../lambda/feedback/AGENT.md)
4. **Client ingress:** [`streamEventPubSub/AGENT.md`](../../../../charcoal-client/src/slices/dataSource/streamEventPubSub/AGENT.md)

**Test command authority:** [`taskPlanning/charcoal-client/AGENT.development.md`](../../AGENT.development.md).

---

## Progress

| Phase | Description | Status |
| --- | --- | --- |
| 0 | Discovery (WML timing Phase 2) | Done |
| 1 | GitHub Issue logged (no link in plan) | Done |
| 2 | Re-assess + feedback lambda replay alignment | Done |
| 3 | Contract docs (live vs replay wire) | Done |
| 4 | Archive task plan | Not started |

---

## Recommended order

Mark pending work `[ ]` and completed work `[X]` (including nested bullets as you finish them).

- [X] **Phase 1 --- Track**
  - [X] Create GitHub Issue
  - [X] Link Issue --- declined (repo-scoped)
- [X] **Phase 2 --- Fix**
  - [X] Re-assess live vs replay wire paths
  - [X] Feedback lambda: `fromSNSFeedbackFormat` -> `toWebSocketFormat` for StreamEvent
  - [X] Add feedback lambda tests
  - [X] Simplify client replayAt ingress; add flat RequestIds wire test
  - [X] Run verification suites
- [X] **Phase 3 --- Contract**
  - [X] Update durable docs (feedback, streamEventPubSub, formatTransform AGENT)
- [ ] **Phase 4 --- Close**
  - [ ] Manual smoke: save edit -> live Content Update has flat `RequestIds`; pending clears
  - [ ] Archive or delete this task plan

---

## Verification

**Automated:**

```bash
cd lambda/feedback && npm test

cd charcoal-client
npm run test:single -- src/slices/dataSource/reducers.test.ts
npm run test:single -- src/slices/personalAssets/pendingHygiene.test.ts
npm run test:single -- src/slices/wmlDataSource/index.test.ts
npm run test:single -- src/slices/dataSource/streamEventPubSub/index.test.ts
```

**Manual:**

1. Subscribe to an asset (replay batch may arrive first --- distinguish from live save).
2. Save an edit; find **live** Content Update in Network (timestamp after send).
3. Confirm flat top-level `RequestIds` (not nested `extendedHeader`).
4. Redux: `confirmedRequestIds` and pending hygiene behave as designed.

---

## Coordination notes

- Deploy feedback lambda before or with client; replay wire shape changes on feedback deploy.
- If save confirm still fails with flat `RequestIds`, investigate WML producer / processEnvelope separately (not this replay wire fix).
