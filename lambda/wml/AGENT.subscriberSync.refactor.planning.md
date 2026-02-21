# Subscriber Sync Refactor: WML DataSource as Single Source of Truth

**Status**: PLANNING (backend generic sidecar: implemented; front-end sidecar handling: implemented; WML dataSource slice: implemented)  
**Scope**: Client (charcoal-client) and backend (generalized sidecar snapshot support; mtw.wml snapshot on subscribe).  
**Related**: [AGENT.event.md](./AGENT.event.md), RequestIds pipeline, optimistic updates in personalAssets

---

## Recent changes (environment-agnostic serializer)

As of the environment-agnostic serializer refactor (see `packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md` "Serialization resolution architecture"):

- **Sidecar resolution lives in the serializer**, configured with a `DataSourceEnvironment` (browser fetch on client, Node fetch on backend). The slice no longer has or uses a separate `resolveSidecarSnapshot` callback.
- **The slice always passes raw `content` and `header`** to `eventSerializer.deserialize({ content, header })`. The serializer routes on `header.type` and performs fetch and resolution for snapshots when it sees a sidecar descriptor.
- **WML snapshots must be domain-shaped**: `{ wml: string }` or `{ wml: { sidecarUrl: string } }`. Full-content sidecar (`{ sidecarUrl: string }`) is **no longer supported** on the client; the backend (or future delegation) should send domain-shaped payloads when using sidecars.
- The WML slice constructs `new WMLDataSourceEventSerializer(createBrowserDataSourceEnvironment())`; resolution is handled inside the serializer.

---

## Goals

1. **Single source of truth for backend WML**: Use the client-side dataSource pattern as the only handler for incoming mtw.wml Content Update (and Merge Conflict) events. The WML dataSource slice owns "what the client believes the backend looks like" for each subscribed asset.
2. **Simplify personalAssets**: personalAssets stops applying incoming content. It "subscribes lightly" to the same events only to read `RequestIds` and clear `pendingEdits` in the same React re-render that updates the backend view.
3. **Prepare for differential streaming**: When we later stream deltas instead of full WML, only the WML dataSource aggregator changes; personalAssets is unchanged.

---

## Current State

| Concern | Owner | Behavior |
|--------|--------|----------|
| Backend view for open asset | personalAssets | `base` stored in slice; updated by `receiveWMLEvent` on Content Update (replace with incoming WML). |
| Applying incoming content | personalAssets reducer | Content Update → replace `state.base` with parsed `event.update.wml`. |
| Optimistic edits | personalAssets | `edit`, `pendingEdits`, applyEdit flow. |
| Clearing pendingEdits when backend confirms | personalAssets | `receiveWMLEvent` filters `pendingEdits` by `event.RequestIds`. |
| Subscribe/unsubscribe to mtw.wml | personalAssets | In fetchAction/clearAction; single LifeLinePubSub subscription for current asset. |

Problems: "How to apply incoming changes" (replace vs merge, full vs delta) lives in personalAssets alongside optimistic UI. Any future change (e.g. differential events) would touch the same slice that handles pendingEdits and edit state.

---

## Target Architecture

### WML dataSource slice (new)

- **Role**: Single handler for mtw.wml StreamEvents. Owns canonical backend view per subscribed asset.
- **Subscribe**: When user opens an asset for authoring, the WML dataSource subscribes to that asset's stream (same as today; subscription can be triggered from personalAssets lifecycle or from a shared "open asset" flow).
- **Receive**: Content Update → aggregator applies update to `materializedView` (today: replace with full WML; later: merge delta). Merge Conflict → record or surface for toast; no view update.
- **State**: `subscribedStreams[assetId] = { materializedView, recentEvents }`. `materializedView` is StandardFormData (or equivalent) so it can be used as "base" by personalAssets.
- **LifeLine**: One LifeLinePubSub subscription (in INITIALIZE), filters `dataSourceKey === 'mtw.wml'`, dispatches `processRawEnvelope` for all StreamEvents (Snapshot, Content Update, Merge Conflict); routing uses `header.type`.

### personalAssets (refactor)

- **Stops**: Applying incoming WML to `base`; storing `base` (or treats it as derived).
- **Keeps**: Optimistic state (`edit`, `pendingEdits`), applyEdit flow, Merge Conflict toast logic.
- **Adds**: Listens to same mtw.wml events only for `RequestIds`: dispatches `clearPendingEditsByRequestIds({ assetKey, RequestIds })` so pendingEdits are cleared in the same tick as the dataSource update.
- **Derives**: "Base" for the open asset from the WML dataSource slice via selector, e.g. `getWMLBase(state, assetId)` → `state.wmlDataSource?.subscribedStreams[assetId]?.materializedView`.

### Same re-render

- One StreamEvent arrives (Content Update with RequestIds).
- WML dataSource subscription runs → `dispatch(processRawEvent(...))` → reducer updates `subscribedStreams[streamKey].materializedView`.
- personalAssets subscription runs (same payload) → `dispatch(clearPendingEditsByRequestIds({ assetKey: streamKey, RequestIds }))` → reducer filters `pendingEdits`.
- Both run in same tick → one re-render; components reading base from dataSource and pendingEdits from personalAssets see consistent state.

---

## Initial state: S3 sidecar snapshots (decided)

We use **generalized sidecar snapshot delivery** so initial state is not in the WebSocket payload:

- **Backend**: For dataSources that support it, the snapshot step is "generate or locate S3 object, return a pre-authorized (presigned) URL." The StreamEvent carries that URL (and optional small metadata), not the full snapshot body. Same benefits as the current ad hoc personalAssets fetch (large content in S3, small event, auth via presigned URL), but in the dataSource framework.
- **Frontend**: When the client dataSource receives a Snapshot event, it passes the raw `content` to the serializer. The WML serializer (configured with a browser `DataSourceEnvironment`) performs sidecar resolution internally when it sees a domain-shaped descriptor (e.g. `{ wml: { sidecarUrl: string } }`). One code path handles both inline payloads and per-field sidecars; full-content `{ sidecarUrl }` is no longer supported.
- **mtw.wml**: Add "Initialize Subscription - mtw.wml." On subscribe, the backend delivers one Snapshot event with a sidecar URL for that asset's current content. The client WML dataSource fetches the URL and applies the result as initial materializedView; thereafter only Content Update / Merge Conflict events apply. No separate `message: 'fetch'` flow for opening an asset; the dataSource subscription provides initial state via sidecar Snapshot.

---

## Backend work (sidecar + mtw.wml)

- **Generalized sidecar snapshot contract**: For WML, snapshots use **domain-shaped payloads**: `{ wml: string }` (inline) or `{ wml: { sidecarUrl: string } }` (per-field sidecar). The client slice passes raw `content` to the serializer; the serializer fetches when it sees a sidecar descriptor. Full-content `{ sidecarUrl }` is not supported. DataSources that use sidecar implement "generate or locate S3 object; return presigned URL" and wrap it in the domain shape.
- **WML snapshotContentGenerator (planned/partial)**: The base DataSource already uses `snapshotContentGenerator` as the single plug point for snapshot creation. No separate `snapshotSidecarUrlGenerator` is needed; that wrongly conflates delegation with sidecars. WML should pass `snapshotContentGenerator` that calls `getSidecarSnapshotDescriptor` (or equivalent) and returns a **domain-shaped** payload (e.g. `{ wml: { sidecarUrl } }`). The client serializer resolves sidecars when it sees that shape. See `AGENT.implementation.md` (Serialization resolution architecture, Snapshot envelope conventions).
- **Subscriptions (implemented)**: Add mtw.wml to replayable (or "snapshot-on-subscribe") list so that when client subscribes to mtw.wml, the subscriptions lambda emits "Initialize Subscription - mtw.wml" (same as contentHeaders). EventBridge rule routes that to the WML lambda.
- **Who produces the URL for mtw.wml**: WML lambda (decided). It has access to the asset's S3 layout: materialized view and `snapshots/` directory (see `lambda/wml/s3Storage/snapshots/` and materialized view). The lambda can locate or generate the appropriate object (e.g. current materialized view or latest snapshot) and issue a presigned GET URL for the sidecar.
- **Content Update**: Backend now sends delta (edit WML) plus RequestIds; WML dataSource aggregator must merge the delta onto the current materialized view instead of replacing it.

---

## Questions this raises (to be addressed)

1. **Snapshot event shape (contract)**  
   - **Decided**: WML uses **domain-shaped** snapshot payloads: `{ wml: string }` (inline) or `{ wml: { sidecarUrl: string } }` (per-field sidecar). The slice passes raw `content` to the serializer; the serializer resolves sidecars internally when configured with a `DataSourceEnvironment`. Full-content `{ sidecarUrl }` is not supported.

2. **Who generates the presigned URL for mtw.wml?**  
   - **Decided**: Option A — WML lambda handles "Initialize Subscription - mtw.wml" and returns a Snapshot event with sidecarUrl. This centralizes control over WML storage in the WML lambda.  
   - The WML storage layout (materialized-view + chunk structure) already supports snapshots: under each asset prefix we have a materialized view (e.g. `{uuid}.wml`) and a `snapshots/` directory (e.g. `{prefix}snapshots/{timestamp}.wml`). Either the current materialized view or the latest snapshot in that directory can serve as the S3 object to presign for the sidecar. The WML lambda already has access to this layout via its s3Storage layer (AssetWorkspace, snapshots, etc.), so it can generate or locate the object and issue a presigned GET URL.

3. **Frontend: sidecar snapshot handling**  
   - The slice passes raw `content` and `header` to `eventSerializer.deserialize({ content, header })`. The WML serializer (configured with `createBrowserDataSourceEnvironment()`) routes on `header.type` and performs fetch and resolution for snapshots when it sees a domain-shaped descriptor (e.g. `{ wml: { sidecarUrl } }`). No separate `resolveSidecarSnapshot` callback.  
   - **Ordering by timestamp**: The snapshot is delivered with a timestamp (in the StreamEvent envelope, as today). The client dataSource already orders by timestamp: it ignores events with timestamp before the snapshot, applies the snapshot as the baseline, then applies events with timestamp after the snapshot in order.

4. **Deprecate or keep legacy `message: 'fetch'`?**  
   - After sidecar Snapshot is in place, personalAssets no longer calls getFetchURL + fetch for initial load; the WML dataSource gets initial state from the Snapshot event. We can deprecate the fetch API for asset WML or keep it for non-subscription use cases (e.g. one-off load without subscribing). Decision: document and, if unused, remove later.

5. **Replayable vs "snapshot-on-subscribe"**  
   - mtw.wml today is non-replayable. With sidecar Snapshot on subscribe, we are not adding full "replay from store"; we are adding "one snapshot when you subscribe." Naming: either add mtw.wml to a "snapshot-on-subscribe" list in subscriptions (separate from replayable) or treat it as replayable with a single snapshot. Implementation is the same: subscriptions sends Initialize Subscription; one handler returns Snapshot with sidecarUrl.

### Resolving the questions

We address these in implementation order. As decisions are made, record them here.

| # | Question | Status | Resolution |
|---|----------|--------|------------|
| 1 | Snapshot event shape (inline vs sidecarUrl) | Resolved | Domain-shaped: `{ wml: string }` or `{ wml: { sidecarUrl } }`; publisher chooses. Full-content `{ sidecarUrl }` not supported. |
| 2 | Who generates presigned URL for mtw.wml | Resolved | WML lambda. Storage already has materialized view + `snapshots/` dir; use one as sidecar source and presign. |
| 3 | Frontend: where and how to fetch sidecarUrl | Resolved | Slice passes raw `content` to the serializer; WML serializer (with `createBrowserDataSourceEnvironment()`) performs fetch and resolution internally when it sees domain-shaped payload (e.g. `{ wml: { sidecarUrl } }`). No `resolveSidecarSnapshot`. See charcoal-client src/slices/dataSource. |
| 4 | Deprecate or keep legacy `message: 'fetch'` | Open | |
| 5 | Replayable vs snapshot-on-subscribe naming | Open | |

---

## Client Work Items

### 1. WML dataSource slice (Done)

- **Location**: `charcoal-client/src/slices/wmlDataSource/` (implemented).
- **Create**:
  - WML aggregator: `createEmpty()` returns empty StandardFormData; `applyUpdate(current, event)` for Content Update merges the incoming StandardForm delta onto the current materialized view; Merge Conflict leaves view unchanged (or optional event for toast).
  - WML event serializer: WML-specific dataSource serializer (Content Update with `wml`, Merge Conflict with `error`) that maps subscription message shape to internal WML content events for the aggregator, and identity-deserializes resolved snapshots (StandardFormData).
  - Slice via `createDataSourceSlice` with `dataSourceKey: 'mtw.wml'`, same pattern as contentHeaders/library/player. Event serializer is `WMLDataSourceEventSerializer(createBrowserDataSourceEnvironment())`; the serializer performs sidecar resolution internally (no `resolveSidecarSnapshot`).
- **Snapshot**: Initial state comes from Snapshot event on subscribe (domain-shaped payload, e.g. `{ wml: { sidecarUrl } }`). The serializer fetches and deserializes when it sees a sidecar descriptor.

### 2. personalAssets refactor

- **receiveWMLEvent**: Remove Content Update branch that updates `base`. Keep only: guard for `dataSourceKey === 'mtw.wml'`, then clear `pendingEdits` by `event.RequestIds` for both Content Update and Merge Conflict. Rename or split to `clearPendingEditsByRequestIds` (payload: `{ assetKey, RequestIds }`) so the reducer only mutates `pendingEdits`.
- **Remove**: `base` from personalAssets public state; derive base from dataSource everywhere.
- **Selectors**: Add `getBase(state, assetId)` that reads from WML dataSource slice (`subscribedStreams[assetId]?.materializedView`). Use it wherever current code reads `state.personalAssets.base` for the open asset.
- **fetchAction (open asset)**: No longer calls getFetchURL + fetch for WML body. Instead: (1) Subscribe to mtw.wml via WML dataSource slice (subscribeToStreams([id])). Backend sends Snapshot with sidecarUrl; client dataSource fetches URL and applies as initial materializedView. (2) personalAssets sets edit/pendingEdits/initial UI state; register LifeLine subscription for mtw.wml that only dispatches `clearPendingEditsByRequestIds` and toast logic. (3) Base comes from dataSource after Snapshot is applied. If we need a fetch URL for other reasons (e.g. properties), we can keep getFetchURL for metadata only or fold into a single "open asset" flow that gets URL only when sidecar is not used.
- **clearAction**: Unsubscribe from mtw.wml (via dataSource unsubscribe for that streamKey). Unsubscribe personalAssets LifeLine listener. Clear personalAssets edit state.

### 3. Who subscribes to mtw.wml

- **Option A**: WML dataSource owns subscribe/unsubscribe. When personalAssets fetchAction runs, it dispatches "subscribe to [id]" on the WML dataSource slice (e.g. subscribeToStreams([id])); dataSource sends the WebSocket subscribe. When clearAction runs, unsubscribeFromStreams([id]). personalAssets does not send subscribe/unsubscribe itself.
- **Option B**: personalAssets continues to send subscribe/unsubscribe so backend has one subscription; WML dataSource only listens and updates state (no subscribe call from dataSource). That would require dataSource to still get events—so we'd need the dataSource to be subscribed to LifeLine for mtw.wml and to have a stream entry for that asset. So we'd still need to "add" the stream to the dataSource (e.g. subscribeToStreams) so it has a place to put materializedView; the actual WebSocket subscribe could come from personalAssets or from dataSource. Cleanest: dataSource owns subscribe/unsubscribe so one place owns "we are subscribed to this stream."
- **Recommendation**: WML dataSource owns subscribe/unsubscribe. personalAssets "open asset" action calls wmlDataSource.subscribeToStreams([id]); initial state comes from Snapshot (sidecar). clearAction calls wmlDataSource.unsubscribeFromStreams([id]).

### 4. Store and lifecycle

- Register WML dataSource slice in store (e.g. `wmlDataSource: wmlDataSourceSlice.reducer`).
- Ensure WML dataSource INITIALIZE runs (e.g. from same SSM or app bootstrap that runs contentHeaders so LifeLine subscription is active). personalAssets "open asset" runs after CONNECTED; WML dataSource must be ready to accept subscribe; initial view comes from Snapshot (sidecar) after subscribe.

### 5. Merge Conflict toast

- Today: personalAssets index (or index.api) checks `event.RequestIds` and pendingEdits to show "Merge conflict prevented saving your changes." After refactor: **chosen approach (1)** – personalAssets keeps a lightweight listener that receives the full mtw.wml event and runs existing toast logic + clearPendingEditsByRequestIds. One listener in personalAssets for mtw.wml; no dataSource-dispatched "Merge Conflict" action. Revisit only if we get a good reason to do something more elaborate.

---

## File-Level Summary

| Area | File(s) | Change |
|------|---------|--------|
| Backend (contract) | mtw-interfaces or lambda patterns | Snapshot event shape: domain-shaped payload (e.g. `{ wml: { sidecarUrl } }`); serializer resolves. |
| Backend (WML snapshotContentGenerator) | lambda/wml/dataSource/mtw-wml.ts | **Done.** WML passes `snapshotContentGenerator` that returns domain-shaped payloads (e.g. `{ wml: { sidecarUrl } }`). See AGENT.implementation.md (Snapshot envelope conventions). |
| Backend (subscriptions) | lambda/subscriptions/app.ts | Add mtw.wml to snapshot-on-subscribe list; emit Initialize Subscription - mtw.wml. |
| Backend (URL producer) | TBD (WML lambda or assets lambda) | Handle Initialize Subscription - mtw.wml; generate/locate S3 object; return Snapshot with domain-shaped payload (e.g. `{ wml: { sidecarUrl } }`). |
| Backend (EventBridge) | Config | Rule: Initialize Subscription - mtw.wml → target lambda (per question 2). |
| charcoal-client (dataSource) | dataSource slice index.ts | **Done.** Slice passes raw `content` to serializer; serializer (configured with `DataSourceEnvironment`) performs fetch and resolution. No `resolveSidecarSnapshot`. Timestamp ordering preserved. |
| charcoal-client | `src/slices/wmlDataSource/index.ts` (new) | **Done.** Slice with aggregator, `WMLDataSourceEventSerializer(createBrowserDataSourceEnvironment())`, createDataSourceSlice for mtw.wml; supports Snapshot (domain-shaped, inline or per-field sidecar) and Content Update / Merge Conflict. |
| charcoal-client | `src/slices/wmlDataSource/selectors.ts` (new, optional) | **Done.** Selector for getWMLBase(state, assetId). |
| charcoal-client | `src/store/index.ts` | **Done.** Register wmlDataSource reducer; ensure INITIALIZE. |
| charcoal-client | `src/slices/personalAssets/reducers.ts` | receiveWMLEvent: only clear pendingEdits by RequestIds; remove base update. Optionally rename to clearPendingEditsByRequestIds. |
| charcoal-client | `src/slices/personalAssets/selectors.ts` (or baseClasses) | getBase(assetId) derives from wmlDataSource.subscribedStreams[assetId].materializedView. |
| charcoal-client | `src/slices/personalAssets/index.api.ts` | fetchAction: stop getFetchURL + fetch for WML; trigger wmlDataSource.subscribeToStreams([id]); keep lightweight LifeLine subscription for RequestIds + toast. clearAction: dataSource unsubscribe. |
| charcoal-client | `src/slices/personalAssets/index.ts` | Wire clearPendingEditsByRequestIds; ensure components use derived base selector. |
| charcoal-client | Tests | personalAssets: reducer tests for clearPendingEditsByRequestIds only; no base update tests. wmlDataSource: aggregator/serializer and slice tests; sidecar Snapshot fetch path. |

---

## Testing

- **WML dataSource**: Unit tests for aggregator (apply Content Update merges delta into view; Merge Conflict no change) and dataSource serializer, plus slice tests (including sidecar Snapshot resolution). Optional: integration with LifeLine and subscribe.
- **personalAssets**: Reducer tests for clearPendingEditsByRequestIds (clear by RequestIds; leave others; no base change). Remove or adjust tests that asserted base update in receiveWMLEvent.
- **Selectors**: getBase(assetId) returns dataSource view when present.
- **E2E / manual**: Open asset, apply edit, receive Content Update → base from dataSource updates, pendingEdits cleared for that RequestId, same re-render.

---

## Optional Follow-Ups

- **Differential Content Update**: **Done.** Backend sends delta (edit WML) in Content Update; WML dataSource aggregator must apply (merge) delta; personalAssets unchanged.
- **Deprecate legacy fetch API**: Once all "open asset" flows use subscribe + sidecar Snapshot, remove or deprecate `message: 'fetch'` and getFetchURL for WML if unused.

---

## Order of Work

1. **Decide open questions**: Snapshot event shape (sidecarUrl); who produces URL for mtw.wml; deprecate fetch or keep for metadata.
2. **Backend – WML snapshotContentGenerator**: **Done.** WML passes `snapshotContentGenerator` that returns domain-shaped payloads (e.g. `{ wml: { sidecarUrl } }`). See AGENT.implementation.md (Snapshot envelope conventions).
3. **Backend – URL producer for mtw.wml**: **Done.** Handler for "Initialize Subscription - mtw.wml" in WML lambda generates presigned URL for asset content and sends Snapshot with sidecarUrl to client (via existing feedback/delivery path).
4. **Backend – subscriptions**: **Done.** mtw.wml is in the snapshot-on-subscribe (replayable) list; subscriptions lambda emits "Initialize Subscription - mtw.wml" and EventBridge rule routes it to the WML lambda.
5. **Frontend – sidecar snapshot handling**: **Done.** Slice passes raw `content` to serializer; WML serializer (with browser env) performs fetch and resolution for domain-shaped payloads (e.g. `{ wml: { sidecarUrl } }`). Timestamp-based ordering unchanged.
6. **Frontend – WML dataSource slice**: **Done.** Add slice (aggregator, serializer, createDataSourceSlice); handle Snapshot (sidecar or inline) and Content Update / Merge Conflict; store registration and INITIALIZE.
7. **Frontend – personalAssets**: Derive base from dataSource; refactor receiveWMLEvent to only clearPendingEditsByRequestIds; open-asset flow triggers subscribe (no fetch for WML body); clearAction unsubscribes.
8. **Tests and cleanup**: WML dataSource tests (implemented); personalAssets reducer tests; optional deprecation of getFetchURL for WML.
