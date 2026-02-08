# Apply Edit -> Subscription -> PendingEdits Pipeline Bug

**Status**: PLANNING  
**Related**: Optimistic updates in client; RequestId threading; [AGENT.event.md](./AGENT.event.md)

---

## Scope

This bug spans multiple packages. Primary fix lives in this lambda; other touchpoints:

| Location | Role |
|----------|------|
| **lambda/wml/dataSource/mtw-wml.ts** | Pass `RequestIds` (from payload.RequestId or `[]` if absent) into `streamEvent` for Content Update and Merge Conflict (root cause) |
| **packages/mtw-interfaces** (eventBridge/wml, subscriptions) | Add `RequestIds: string[]` to WML event types and serializer (flows in Detail via update); update `WMLSubscriptionClientMessage` to top-level `RequestIds?: string[]` only |
| **lambda/subscriptions/handlerFramework/index.ts** | Fix **Content Update and Merge Conflict** transforms: use `event.update.wml` (Content Update), set top-level `RequestIds` on client message from `event.update.RequestIds` |
| **charcoal-client** (reducers, index.api.ts) | In `receiveWMLEvent`, clear pendingEdits by `event.RequestIds?.includes(meta.key)`; update any Merge Conflict handling that keys off request id to use `event.RequestIds` |

Client (`charcoal-client/src/slices/personalAssets/`) already sends RequestId with applyEdit and stores pendingEdits by requestId; it will be updated to clear by `event.RequestIds` (array). The subscription message type `WMLSubscriptionClientMessage` is defined in **mtw-interfaces** (ts/subscriptions.ts); the client consumes that contract.

**Design decisions:**
- **Use `RequestIds: string[]`** (not a single `RequestId`) so one streamed event can represent multiple satisfied requests later. Today we send a one-element array. On the subscription message type use **only** `RequestIds?: string[]` (replace `RequestId`; no dual support).
- **Where RequestIds lives:** RequestIds is part of the serialized update payload (WML serializer adds it). So it flows in EventBridge Detail via the update and appears as **`event.update.RequestIds`** after `fromEventBridgeFormat`. No change to `CoreExternalFormat` or formatTransform types is required.
- **Missing `payload.RequestId`:** When applyEdit payload has no or empty RequestId, WML dataSource sends **`RequestIds: []`**.
- **Absent or empty `RequestIds` on message:** Client treats absent or empty as "clear no pending edits" (safe; `event.RequestIds?.includes(meta.key)` does not clear any).

---

## Intended Pipeline

1. Client generates `requestId`, sends `applyEdit` with `RequestId: requestId`, then pushes to `pendingEdits` with `meta.key = requestId`.
2. WML lambda receives applyEdit, caches RequestId, processes edit, and streams Content Update (or Merge Conflict) with `RequestIds: payload.RequestId != null ? [payload.RequestId] : []` so those ids are carried in the serialized update to EventBridge and then to subscribers.
3. Subscriptions lambda receives the event, builds a client message that includes `RequestIds` and the WML payload, and sends it to the client.
4. Client `receiveWMLEvent` uses `event.RequestIds` to clear any pending edit whose `meta.key` is in the array and (on Content Update) updates `base`.

Thread: **client RequestId -> backend -> EventBridge (RequestIds[]) -> subscription message (RequestIds[]) -> client clears pendingEdits by RequestIds.includes(meta.key).**

---

## Where RequestIds must (and must not) live

**Chunk-and-manifest (S3) WML storage does not need RequestIds.** The bug fix only requires `RequestIds: string[]` in the **event payload** we pass to `streamEvent` and publish to EventBridge.

| Layer | Needs RequestIds? | Why |
|-------|-------------------|-----|
| **Live event payload** (what we pass to `streamEvent`) | **Yes** | So EventBridge -> subscriptions -> client can carry it and the client can clear matching pending edits. |
| **DataSource event store** (DynamoDB, only when replayable) | **Yes** (if we add it to the update) | Same payload is stored; replayed "events-since" would then include RequestIds. mtw.wml is non-replayable, so no DynamoDB event store for WML. |
| **Chunk-and-manifest (S3) WML storage** | **No** | Not used for subscription delivery. Content only; no event stream is read from chunks for "events-since." |

**mtw.wml is non-replayable** (`replayable: false`). Subscribers only get **live** EventBridge events; there is no "closest-snapshot + events-since" path for WML. So we do not need to persist RequestIds in chunk/manifest for subscription delivery. The "snapshot" in subscription replay (for other, replayable data sources) comes from the DataSource's snapshot/event store, not from S3 chunks. Clients that receive replayed "events-since" are catching up and did not send those edits, so they do not need to reconcile by RequestIds; only the **live** event in response to the client's own applyEdit needs to carry RequestIds for pending-edit clearance.

---

## Bug 1: RequestId never reaches streamed event (root cause)

**Where**: `lambda/wml/dataSource/mtw-wml.ts`, `receiveEvents` handler.

After a successful applyEdit we call:

```ts
await streamEvent({
    update: { type: 'Content Update', schema: result.schema },
    streamKey: AssetId
})
```

**Problem**: `payload.RequestId` is available in the same handler but is not passed. Same for the Merge Conflict branch: no RequestIds in the update.

The DataSource base class builds `coreFormat` only from `dataSourceKey`, `streamKey`, `timestamp`, and the serialized `update`; it does not read RequestId from internalCache. So EventBridge events are published without RequestIds, and the subscription message received by the client always has no ids. Pending edits are never cleared.

**Fix**: Include `RequestIds: payload.RequestId != null ? [payload.RequestId] : []` in the update when calling `streamEvent` for Content Update and Merge Conflict. Extend internal/external WML event types and `WMLEventSerializer` so `RequestIds: string[]` is part of the serialized payload. It will then appear in EventBridge Detail (via the serialized update's rest) and in `event.update.RequestIds` after `fromEventBridgeFormat`. No change to `CoreExternalFormat` or formatTransform is required.

---

## Bug 2: Subscription transform uses wrong field for WML (Content Update)

**Where**: `lambda/subscriptions/handlerFramework/index.ts`, **Content Update** transform (Merge Conflict transform has no wml field but needs the same RequestIds fix).

The Content Update transform does:

```ts
update: {
    type: 'Content Update',
    RequestId: event.RequestId,
    wml: event.schema
}
```

**Problem**: `CoreExternalFormat` has no `schema`. After `fromEventBridgeFormat`, the WML string is in `event.update.wml` and RequestIds is in `event.update.RequestIds`. So the client receives `wml: undefined`.

**Fix**: Use `wml: event.update.wml` and pass `RequestIds: event.update.RequestIds ?? []`. Apply the same top-level RequestIds fix to the **Merge Conflict** transform (use `event.update.RequestIds ?? []`).

---

## Bug 3: Top-level RequestIds on client message

**Where**: Both Content Update and Merge Conflict transforms in `lambda/subscriptions/handlerFramework/index.ts`.

**Problem**: `WMLSubscriptionClientMessage` (mtw-interfaces) has optional top-level `RequestId`. The client reducer clears pendingEdits using `event.RequestId`. The transforms only set RequestId inside `update`, not on the top-level message.

**Fix**: Add top-level `RequestIds: event.update.RequestIds ?? []` to the returned StreamEvent message for **both** Content Update and Merge Conflict. In mtw-interfaces, update `WMLSubscriptionClientMessage` to have **only** `RequestIds?: string[]` (replace `RequestId`). In client `receiveWMLEvent`, clear pendingEdits with filter: keep only those whose `meta.key` is not in `event.RequestIds` (i.e. `!event.RequestIds?.includes(meta.key)`; absent or empty RequestIds clears none).

---

## What is already working

- Client: generates requestId, sends it with applyEdit, stores in pendingEdits as `meta.key`; reducer will be updated to clear by `event.RequestIds?.includes(meta.key)`.
- WML lambda app: receives and caches RequestId, passes it in the internal Apply Edit envelope to the dataSource.
- applyEdit business logic and chunk storage: unchanged; RequestId is simply not forwarded into the streamed event.
- EventBridge/formatTransform: RequestIds lives in the serialized update payload, so it appears in Detail via the update and in `event.update.RequestIds`; no formatTransform type change needed.
- Subscriptions: match and publish; both transforms will be updated to read `event.update.RequestIds` and set top-level `RequestIds` on the client message.

---

## Recommended order of work

1. **mtw-interfaces**: Add `RequestIds: string[]` to WML external (and internal) Content Update and Merge Conflict event types; update `WMLEventSerializer` to include RequestIds in serialized output. Update `WMLSubscriptionClientMessage` (ts/subscriptions.ts) to have top-level `RequestIds?: string[]` only (replace `RequestId`).
2. **lambda/wml/dataSource/mtw-wml.ts**: When calling `streamEvent` for Content Update and Merge Conflict, pass `RequestIds: payload.RequestId != null ? [payload.RequestId] : []` in the update so it is serialized and published.
3. **lambda/subscriptions/handlerFramework/index.ts**: For **Content Update** transform: use `event.update.wml` for the WML string and set top-level `RequestIds: event.update.RequestIds ?? []`. For **Merge Conflict** transform: set top-level `RequestIds: event.update.RequestIds ?? []`.
4. **charcoal-client**: In `receiveWMLEvent` reducer, clear pendingEdits by `event.RequestIds?.includes(meta.key)` (filter: keep only those not in the array). Update any Merge Conflict handling that still keys off `event.RequestId` (e.g. in index.api.ts) to use `event.RequestIds`.

After 1–4, the pipeline will carry RequestIds end-to-end and the client will receive a valid Content Update and clear the corresponding pending edit(s).

---

## Testing

- **mtw-interfaces**: Serializer (and subscription message types): assert event payload and message shape include `RequestIds`; optional backward behavior if needed.
- **lambda/wml/dataSource/mtw-wml.ts**: Unit tests that after successful applyEdit (and after Merge Conflict), the payload passed to `streamEvent` includes `RequestIds: [payload.RequestId]` or `RequestIds: []` when RequestId is absent.
- **lambda/subscriptions/handlerFramework/index.ts**: Transform tests that Content Update and Merge Conflict outputs have top-level `RequestIds` and (Content Update) `wml` from `event.update.wml`.
- **charcoal-client**: Reducer tests that `receiveWMLEvent` clears the correct pending edits when `event.RequestIds` is present and clears none when absent or empty.

---

## Related docs

- [AGENT.event.md](./AGENT.event.md) – WML event flow (notes "Add requestId tracking through event chains" as outstanding)
- [lambda/subscriptions/AGENT.md](../subscriptions/AGENT.md) – subscription handler patterns
- [lambda/feedback/AGENT.md](../feedback/AGENT.md) – SNS/RequestId delivery
