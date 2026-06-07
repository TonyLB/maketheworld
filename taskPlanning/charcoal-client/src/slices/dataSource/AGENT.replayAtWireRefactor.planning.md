# replayAt wire refactor and consolidation (charcoal-client + mtw-lambda-patterns)

**Status:** Not started. **Deploy strategy:** **B (atomic)** --- client and backend land together; header-only ingress, no `update.replayAt` reads. **Next step:** Phase 1 --- coordinated backend + client implementation in one PR.

This plan is task-scoped. Archive or delete after the refactor ships and lasting contract notes move into durable docs.

**Framework:** [`taskPlanning/AGENT.md`](../../../../AGENT.md)

**Area development notes:** [`taskPlanning/charcoal-client/AGENT.development.md`](../../../AGENT.development.md)

**Discovered during:** Client dataSource slice consistency work (2026-06); subscribe-reload ledger sequencing (R1--R5) already shipped. This initiative addresses **where `replayAt` lives on the wire**, not merge/prune semantics (those already match backend `resolveReplayCursorTimestamp`).

**Related (separate initiative):** [`AGENT.extendedHeaderRequestIdFix.planning.md`](../AGENT.extendedHeaderRequestIdFix.planning.md) --- same class of wire-shape drift (`extendedHeader` nested vs flat). Consider a shared "normalize extended header fields" util or coordinated backend flattening.

---

## Purpose

Consolidate **`replayAt`** handling so subscribe-time Snapshot replay uses **one** coherent wire contract across backend storage, SNS/WebSocket delivery, and client ingress --- while keeping client ledger semantics (`RecentEventEnvelope.replayAt`, `replayCursor = replayAt ?? createdAt`) unchanged.

**Non-goal:** Accepting `replayAt` in arbitrary envelope locations. We implement the **canonical contract only** --- no transitional multi-source reads.

---

## Wire contract (single source of truth)

| Location | `replayAt` allowed? |
| --- | --- |
| Snapshot **`header`** (extended header field; merged or nested per transport) | **Yes --- only canonical wire location** |
| Snapshot **`update` / domain content** | **No** |
| Client **`RecentEventEnvelope.replayAt`** | **Yes --- normalized ingress metadata** (lifted from header at boundary; not a second wire location) |

**Strategy B (chosen):** Deploy client and backend together in one coordinated land. Implement header-only extraction on the client and header-only delivery on the backend in the **same PR**. Do not add `update.replayAt` fallbacks.

**Ingress normalization:** If feedback passthrough delivers nested `extendedHeader.replayAt`, normalize once at the client boundary (`header.replayAt ?? extendedHeader.replayAt`). That is transport shaping, not a second authoring location --- producers still set `replayAt` on the envelope header.

---

## Problem statement

### Semantic model (already coherent on backend)

Replayable snapshots carry two client-relevant timestamps ([`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)):

| Field | Role |
| --- | --- |
| **`createdAt`** | When the snapshot envelope was produced. On wire = **`header.timestamp`**. |
| **`replayAt`** | Replay watermark: strict lower bound for events after represented snapshot state. May be **older than** `createdAt` (historical sidecar). |
| **`expiresAt`** | Server-side cache TTL only --- not used in client merge logic. |

```text
replayCursor = replayAt ?? createdAt
```

Client parity today: `resolveReplayCursor` in [`reducers.ts`](../../../../../charcoal-client/src/slices/dataSource/reducers.ts) uses `replayAt ?? timestamp` where `timestamp` is wire `header.timestamp`.

### Physical placement (incoherent today)

`replayAt` appears in different locations depending on boundary:

| Layer | Where `replayAt` lives today |
| --- | --- |
| `snapshotContentGenerator` return | Mixed with domain fields; framework strips to metadata ([`index.ts`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts) `generateSnapshot`) |
| Internal `SnapshotType` | Sibling metadata alongside domain payload |
| Dynamo `Meta::Snapshot` | **`snapshotHeader.replayAt`** (canonical storage) |
| Subscribe replay wire (`deliverReplayData`) | **`update.replayAt`** --- header has base four only |
| Client ingress (`streamEventPubSub`) | Reads **`update.replayAt` only**; lifts to `StreamEventDeserializedPayload.replayAt` |
| Client ledger (`RecentEventEnvelope`) | Sibling of `header` / `content` / `timestamp` (good internal shape) |

**Canonical wire target** (aligned with Dynamo + header-authoritative envelope model in [`AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md)):

- **`replayAt` on extended header** (same rule as `RequestIds`, `replayAt` on `snapshotHeader` in `storeSnapshotToStore`).
- Domain **`update`** contains only serializer output (e.g. `{ wml: { sidecarUrl } }`), never envelope metadata.

**Current subscribe replay path:** Feedback lambda forwards SNS body as-is ([`lambda/feedback/app.ts`](../../../../../lambda/feedback/app.ts)); `deliverReplayData` strips `createdAt` and `expiresAt` but leaves `replayAt` in `update` ([`index.ts`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts) ~600--610).

### Client impact

- Correctness for WML sidecar OOO reload **depends on** extracting `replayAt` before deserialize; today that works only when it is in `update`.
- If backend moves `replayAt` to header (or SNS `extendedHeader`) without client fallback, authoritative Snapshot rebase may use wrong `replayCursor` (prune too much or too little).
- Legacy type [`SnapshotUpdateWithSidecar`](../../../../../charcoal-client/src/slices/dataSource/baseClasses.ts) lists `createdAt` / `expiresAt` in content shape but not `replayAt` --- stale partial mirror.

---

## Scope

**In scope:**

- **Backend:** Fix `deliverReplayData` to put `replayAt` on snapshot `CoreExternalFormat.header`; strip metadata from `update` before wire send.
- **Client:** Replace `replayAtFromSnapshotUpdate` with header-only `extractReplayAtFromSnapshotHeader`; **never** read `update.replayAt`.
- **Shared contract:** Document `replayAt` as extended header field in formatTransform / patterns AGENT (minimal durable edits).
- **Tests:** Canonical wire-shape matrix only; R1--R5 reducer regressions unchanged; backend `deliverReplayData` tests.
- **Cleanup:** Annotate or trim `SnapshotUpdateWithSidecar` legacy fields.
- **Deploy:** Single coordinated land (Strategy B) --- both packages in one PR.

**Out of scope:**

- Changing ledger merge/prune algorithm (already correct).
- WML-specific merge modes or Workbench provisional UI gating ([`wmlDataSource/AGENT.md`](../../../../../charcoal-client/src/slices/wmlDataSource/AGENT.md) OQ7).
- Auth sidecar / dual-`replayAt` subscribe contract ([`lambda/wml/dataSource/AGENT.md`](../../../../../lambda/wml/dataSource/AGENT.md) future work).
- Feedback lambda flattening all `extendedHeader` fields to top-level WebSocket (may coordinate with RequestIds plan).

---

## Getting Started

1. **Task planning conventions:** [`taskPlanning/AGENT.md`](../../../../AGENT.md)
2. **Snapshot metadata semantics:** [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md) (**Snapshot metadata: `createdAt` and `replayAt`**)
3. **Envelope / wire rules:** [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (**Header/Content Envelope Model**, **Division of responsibility**)
4. **Client ledger model:** [`charcoal-client/src/slices/dataSource/AGENT.md`](../../../../../charcoal-client/src/slices/dataSource/AGENT.md) (**Event ledger model**, **Replay cursor**)
5. **Client ingress:** [`streamEventPubSub/index.ts`](../../../../../charcoal-client/src/slices/dataSource/streamEventPubSub/index.ts), [`streamEventPubSub/AGENT.md`](../../../../../charcoal-client/src/slices/dataSource/streamEventPubSub/AGENT.md)

**Test command authority:** [`taskPlanning/charcoal-client/AGENT.development.md`](../../../AGENT.development.md). Run from `charcoal-client/` unless noted.

**Baseline (before edits):**

```bash
cd charcoal-client
npm run test:single -- src/slices/dataSource/reducers.test.ts
npm run test:single -- src/slices/dataSource/streamEventPubSub/index.test.ts
```

```bash
cd packages/mtw-lambda-patterns
npm test -- ts/dataSource/index.test.ts
npm test -- ts/dataSource/formatTransform.test.ts
```

---

## Progress

| Phase | Description | Status |
| --- | --- | --- |
| 0 | Discovery + deploy strategy (Strategy B) | Done |
| 1 | Coordinated implementation (backend `deliverReplayData` + client header-only ingress + tests) | Not started |
| 2 | Durable doc updates + legacy type cleanup | Not started |
| 3 | Optional: shared `resolveReplayCursorTimestamp` export | Not started |
| 4 | Manual subscribe-reload smoke (sidecar OOO) | Not started |
| 5 | Archive task plan | Not started |

---

## Target end state

```text
Subscribe Snapshot on wire (CoreExternalFormat):
  header: { dataSourceKey, streamKey, timestamp (= createdAt), type: 'Snapshot', replayAt? }
  update:   { domain fields only --- no replayAt, createdAt, expiresAt }

Client streamEventPubSub (steady state):
  extract replayAt from header ONLY (one normalization for nested extendedHeader if transport requires)
  -> StreamEventDeserializedPayload.replayAt
  deserialize update -> content (domain only)
  NO read from update.replayAt

Client ledger:
  RecentEventEnvelope { header, content, timestamp, replayAt? }
  replayCursor = replayAt ?? timestamp
```

Internal client ledger shape **does not change** --- only wire ingress normalization and backend send path.

---

## Recommended approach

### Phase 1 --- Coordinated implementation (single PR)

**Backend** --- [`packages/mtw-lambda-patterns/ts/dataSource/index.ts`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts) `deliverReplayData`:

1. Destructure snapshot: `{ createdAt, replayAt, expiresAt, type, ...domainPayload }`.
2. Build header with `replayAt` when present (mirror `storeSnapshotToStore`).
3. Put only domain payload in `update` (no `replayAt`, `createdAt`, `expiresAt`).
4. Extend `index.test.ts`: assert `replayAt` on header, absent from `update`.

Optional: add `formatTransform.test.ts` snapshot fixture for `replayAt` as extended header field.

**Client** --- [`streamEventPubSub/index.ts`](../../../../../charcoal-client/src/slices/dataSource/streamEventPubSub/index.ts):

1. Add `extractReplayAtFromSnapshotHeader(header)` --- Snapshot events only.
2. Read `header.replayAt`; if absent, normalize nested `(header as any).extendedHeader?.replayAt` (feedback transport only).
3. **Do not** read `update.replayAt`. Remove `replayAtFromSnapshotUpdate`.
4. Extract before deserialize; lift to `StreamEventDeserializedPayload.replayAt` (ledger unchanged).

**Tests:** Wire-shape matrix below; R1--R5 reducer tests unchanged.

**Deploy:** Land client static assets and lambda/patterns package together so no production window serves mismatched wire shapes.

### Phase 2 --- Documentation and cleanup

- Add **Snapshot metadata on wire** note to [`charcoal-client/src/slices/dataSource/AGENT.implementation.md`](../../../../../charcoal-client/src/slices/dataSource/AGENT.implementation.md).
- Cross-link or extend patterns wire contract for `replayAt`.
- Mark [`SnapshotUpdateWithSidecar`](../../../../../charcoal-client/src/slices/dataSource/baseClasses.ts) `@deprecated` or trim unused fields if grep shows no callers.

### Phase 3 --- Shared helper (optional)

Export `resolveReplayCursorTimestamp` from a client-safe module so [`reducers.ts`](../../../../../charcoal-client/src/slices/dataSource/reducers.ts) can import instead of duplicating.

---

## Wire-shape test matrix

| Case | Wire shape | Expected `replayAt` |
| --- | --- | --- |
| B | `header.replayAt = 150` | `150` |
| C | Nested transport: `extendedHeader.replayAt = 150` (normalized at ingress) | `150` |
| E | Non-Snapshot with `update.replayAt` | `undefined` (not read from update) |
| F | Snapshot, no `replayAt` on header | `undefined` (reducer uses `timestamp`) |

---

## Recommended order

Mark pending work `[ ]` and completed work `[X]` (including nested bullets as you finish them).

- [X] **Kickoff --- Deploy strategy**
  - [X] Strategy B (atomic) --- coordinated client + backend land
- [ ] **Phase 1 --- Coordinated implementation (one PR)**
  - [ ] Backend: `deliverReplayData` puts `replayAt` on header; domain-only `update`
  - [ ] Backend: tests in `packages/mtw-lambda-patterns/ts/dataSource/index.test.ts`
  - [ ] Client: `extractReplayAtFromSnapshotHeader`; remove `replayAtFromSnapshotUpdate`
  - [ ] Client: wire-shape tests in `streamEventPubSub/index.test.ts`
  - [ ] Confirm R1--R5 reducer tests pass; run full verification (below)
  - [ ] Deploy client + backend together
- [ ] **Phase 2 --- Docs and cleanup**
  - [ ] Update `dataSource/AGENT.implementation.md` ingress section
  - [ ] Cross-link patterns wire contract for `replayAt`
  - [ ] Annotate or trim `SnapshotUpdateWithSidecar` legacy fields
- [ ] **Phase 3 --- Shared helper (optional)**
  - [ ] Extract `resolveReplayCursorTimestamp` to client-safe module
  - [ ] Replace duplicate in `reducers.ts`
- [ ] **Phase 4 --- Close**
  - [ ] Manual subscribe-reload smoke (see **Verification**)
  - [ ] Grep gate passes
  - [ ] Update **Progress** table and status line
  - [ ] Archive or delete this task plan

---

## Verification

**Automated (client):**

```bash
cd charcoal-client
npm run test:single -- src/slices/dataSource/streamEventPubSub/index.test.ts
npm run test:single -- src/slices/dataSource/reducers.test.ts
npm run test:single -- src/slices/wmlDataSource/index.test.ts
```

**Automated (backend / patterns):**

```bash
cd packages/mtw-lambda-patterns
npm test -- ts/dataSource/index.test.ts
npm test -- ts/dataSource/formatTransform.test.ts
```

**Manual (subscribe reload / sidecar OOO):**

1. Subscribe to an asset with existing edit history; hard-reload browser.
2. Network: Snapshot StreamEvent --- confirm `replayAt` on header (or `extendedHeader`), **not** in `update`.
3. Redux: authoritative Snapshot row in `recentEvents` has `replayAt` matching sidecar watermark when `createdAt` differs.
4. `materializedView` after sidecar rebase includes replay Content Updates with `timestamp > replayAt` (R1/R2 behavior).

**Grep gate (required before archive):**

```bash
# Client must never read replayAt from update payload:
rg 'update\.replayAt|replayAtFromSnapshotUpdate' charcoal-client/src/slices/dataSource

# deliverReplayData must put replayAt on header, not leak into update (inspect manually + tests):
rg 'deliverReplayData' packages/mtw-lambda-patterns/ts/dataSource/index.ts
```

---

## Open questions / unknowns

1. **Feedback vs subscriptions WebSocket shape:** Subscribe replay uses SNS feedback passthrough (may carry nested `extendedHeader`). Capture one production Snapshot from Network tab during subscribe and add as golden fixture for case C.

2. **Shared util with RequestIds plan:** Should `extractReplayAtFromSnapshotHeader` and `extractRequestIdsFromStreamingHeader` live in the same module (e.g. `envelopeMetadata.ts`)? **Tradeoff:** patterns package is shared but client must not import lambda `index.ts`.

3. **`type` in update after metadata strip:** Does domain `update` still need `type: 'Snapshot'`, or is `eventType` / `header.type` sufficient? **Action:** grep before stripping in `deliverReplayData`.

4. **Non-WML replayable DataSources:** `mtw.ephemera.thinking.scheduling` uses generator-returned `replayAt`. Confirm no client slice consumes it today; same ingress helper applies if added later.

5. **Legacy Dynamo snapshots:** Rows without `snapshotHeader.replayAt` rely on `createdAt` fallback --- unchanged.

6. **Nested `extendedHeader` long-term:** Is client normalization of `extendedHeader.replayAt` permanent (feedback passthrough), or should feedback flatten before WebSocket send (coordinate with RequestIds plan)?

7. **Phase 3 necessity:** Is duplicating `resolveReplayCursor` in client acceptable long-term? Defer until Phase 1 lands.

---

## Coordination notes

- **Land order:** Single coordinated deploy (Strategy B). One PR touching `packages/mtw-lambda-patterns` and `charcoal-client`; deploy lambdas and client static assets together.
- **Definition of done:** Grep gate passes; durable docs describe **one** wire location; no `update.replayAt` reads on client.
- **Do not regress:** R1--R5 tests in [`reducers.test.ts`](../../../../../charcoal-client/src/slices/dataSource/reducers.test.ts) are the subscribe-reload correctness gate.
- **Coordination with RequestIds fix:** If both touch `streamEventPubSub` or extended-header normalization, merge or sequence to avoid conflicts.

---

## GitHub Issue draft (optional)

**Title:** Consolidate snapshot `replayAt` on extended header (wire + client ingress)

**Summary:**

- Backend stores `replayAt` on `snapshotHeader` but subscribe replay sends it in `update`.
- **Strategy B:** atomic fix --- header on wire, header-only client ingress, coordinated deploy.
- Plan: [`taskPlanning/charcoal-client/src/slices/dataSource/AGENT.replayAtWireRefactor.planning.md`](AGENT.replayAtWireRefactor.planning.md)

**Labels:** `charcoal-client`, `mtw-lambda-patterns`, `refactor` (adjust to house style)
