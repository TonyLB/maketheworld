# DataSource Delegation & Sidecar Planning

**Status**: PLANNING  
**Scope**: Generic DataSource framework (mtw-lambda-patterns) and delegated backends (e.g. WML manifest/chunks).  
**Related**: `documentation/dataSources/index.md`, `packages/mtw-lambda-patterns/ts/dataSource/index.ts`, `lambda/wml/s3Storage/*`, `lambda/wml/dataSource/*`

---

## Unified model: mirror + aggregator + snapshot source

**All DataSources** mirror snapshots and streaming events in DynamoDB (i.e. each DataSource stores its own published events and snapshots to Dynamo for replay; we do not store events received from other sources). When updating state (e.g. replay, subscription init with existing state), we take the most recent snapshot from Dynamo and apply the DataSource's aggregator to merge in events. The delegated system never overrides aggregation for those updates.

**Delegation applies only to snapshot creation.** When we need a *new* snapshot (e.g. for initialize subscription), where does it come from?

- **Self-contained**: `snapshotContentGenerator` recapitulates from our Dynamo mirror (our view of the aggregation).
- **Delegated**: A configured adapter asks the external system (e.g. WML manifest+chunk) for its current state. We do not pull from Dynamo for this; the delegate provides the snapshot. How we deliver it (inline vs sidecar URL) is orthogonal—whichever system creates the snapshot chooses transport.

Both systems stay synchronized by subscribing to the same event stream. Any divergence is periodically reset when the delegated system publishes new snapshots.

**Sidecar** is a transport concern: how we deliver the snapshot body (inline vs URL). It is not tied to delegation. Self-contained DataSources can use sidecars (e.g. large inline payload written to S3 for transport); delegated DataSources can deliver inline. The snapshot creator (self-contained or delegated) decides.

**Sidecar descriptor: "identical but newer"** — When the underlying snapshot is unchanged, the snapshot creator (using sidecar delivery) can reuse the same S3 object but return a *new* descriptor (fresh presigned URL, new `createdAt`/`expiresAt`). That extends the presigned access window for clients without redundant S3 writes. No need to avoid creating a new descriptor when content is unchanged; the fresh descriptor is desirable.

---

## Where WML is today

WML delegates snapshot creation. The current implementation (`getSidecarSnapshotDescriptor`) asks the manifest+chunk system for the best snapshot. Today it chooses:
- Snapshot file when there are no chunks after it.
- Materialized view (`uuid.wml`) when there are chunks after the latest snapshot.

**Concern:** When we trust the materialized view, we assume it reflects all manifest changes. If it does not (or we consider it stale), we may serve incorrect state. The question is whether to prefer reconstruction from manifest in those cases.

**Note:** WML does not yet mirror to Dynamo. Once it does, replay/update will work like every other DataSource: snapshot from Dynamo + aggregator over events. Delegation only affects *new* snapshot creation.

---

## What we did (completed)

### Header + getContent

- DataSource events use a **header** (always-inline: `type`, `dataSourceKey`, `streamKey`, `timestamp`, optional domain flags) plus **getContent** (lazy access to payload). No `content` property on the contract.
- Lambda gates (assets, WML, ephemera) build `{ header, getContent }` for the messageBus. `subscribedEventTypeGuard` and filters use header only; `receiveEvents` calls `await event.getContent()` when it needs the payload.
- Client DataSource slices use `ClientStreamingHeader` and `ClientStreamingEnvelope`; reducers branch on header and obtain payload via the envelope's lazy resolution.
- Payload access is centralized: inline external deserializes on demand; sidecarred content fetches -> parses -> deserializes; same-process messageBus returns as-is. Routing never calls getContent.

### Sidecar at snapshot/event level

- External shape can express "body here" vs "body at URI" per snapshot or per event. When sidecarred, `getContent` does fetch -> interpret -> deserialize; the pipeline stays sidecar-agnostic.
- Existing typeguards (e.g. `isWMLMaterializedView`, `isWMLContentEventExternal`) validate parsed sidecar bodies. No new DataSource parameters needed; document convention for snapshot-body vs event-payload guards when they differ.

---

## Open Questions

1. **Snapshot freshness for WML**  
   **Resolved: when chunks exist after the latest snapshot, we cannot trust the materialized view.** The materialized view is mutable; it can update at any time. A presigned URL to it is potentially invalid the moment after we send it. By contrast, an immutable snapshot object (reconstructed from manifest, written to S3, then presigned) guarantees correctness: the client always gets a coherent, fixed snapshot.

2. **Delegated snapshot contract**  
   **Resolved: `snapshotContentGenerator` is the single delegation point.** No separate architectural pattern is needed. Delegation is simply a different *implementation* of `snapshotContentGenerator`: self-contained sources read from the Dynamo mirror; delegated sources (e.g. WML) call into the external system (manifest/chunk) and return the domain-shaped payload (inline `{ wml: string }` or sidecar `{ wml: { sidecarUrl } }`). The serializer and client handle WML → StandardForm and sidecar resolution. Do not add `snapshotSidecarUrlGenerator`—that wrongly conflates delegation with sidecars.

3. **WML snapshot shape and Dynamo mirror**  
   An mtw.wml snapshot has more than just WML: metadata (e.g. Zone) is inline; the heavy payload is WML text that we want to deserialize into `StandardForm` internally. Snapshots should use WML as the wire-format (inline or sidecar), with `StandardForm` as the in-memory shape. Open questions: (a) What is the exact snapshot structure (inline metadata + WML content or WML sidecar descriptor)? (b) How does the Dynamo mirror represent that—inline metadata + stored WML (or S3 reference) for the WML portion? (c) When do we call the delegated system vs read from Dynamo for subscription init, given that both paths ultimately need to provide WML for `StandardForm` construction?

---

## Next Steps

1. **Write a short companion doc in `mtw-lambda-patterns`** describing the unified model (mirror + aggregator + snapshot source) and the delegation point (snapshot creation only).
2. **Add WML Dynamo mirror**  
   Mirror WML snapshots (and events) to Dynamo so replay/update uses the same path as every other DataSource. For WML, the Dynamo mirror should store WML text (plus snapshot metadata) as the canonical snapshot body; internal replay paths deserialize from WML into `StandardForm`. `StandardFormData` remains a client/Redux concern rather than a Dynamo storage requirement.
3. **Refine WML delegated snapshot creation**  
   Implement `snapshotContentGenerator` for WML that calls the manifest/chunk system (e.g. `getSidecarSnapshotDescriptor` or future `getDelegatedSnapshot`) and returns domain-shaped payload `{ wml: string }` or `{ wml: { sidecarUrl } }`. Reconstruct from manifest when chunks exist (never trust materialized view in that case).
4. **Refactor WML snapshot representation (representation + client plumbing)**  
   Change the WML DataSource snapshot payload to use `StandardForm` as the internal in-memory shape (rather than `StandardFormData`), with wire-format snapshots as WML strings (inline or via sidecar) and `StandardFormData` as the immutable client/storage representation. Ensure deserialization / `getContent` translates snapshot content (inline or sidecar-fetched) into `StandardForm` for manipulation by aggregators and downstream code, and that clients convert `StandardForm` back to `StandardFormData` when writing to Redux or other storage.  
   **Status**: Representation and client-side plumbing implemented (snapshot wire format is WML; internal operations use `StandardForm`; Redux stores `StandardFormData`).  
5. **Adopt snapshot representation in delegated snapshot generator and mirror**  
   Update the WML delegated snapshot generator and (future) Dynamo mirror to actually produce and store snapshots in this representation: WML text as the wire payload (inline or sidecar), deserialized into `StandardForm` for aggregation and replay. Where structured JSON is needed (e.g. client Redux state), convert `StandardForm` to `StandardFormData` at the client boundary; do not require Dynamo to store `StandardFormData` for WML snapshots.

