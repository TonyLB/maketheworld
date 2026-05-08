# WML DataSource (lambda) - agent notes

## Scope

This directory holds the **`mtw.wml`** DataSource wiring for the WML lambda: snapshot content generation, subscription handling, and coordination with S3 storage. Pattern-level behavior (snapshots, `replayAt`, replay) lives in [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md) and [`AGENT.implementation.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md).

## Constraint: content vs auth snapshots and a single joined snapshot

WML assets use **two independent S3 manifest trees**:

- **Content:** `{uuid}.wml/` (materialized view, chunks, snapshots)
- **Auth:** `{uuid}.auth.wml/` (parallel layout)

Each tree is snapshotted by **`createManualSnapshot`** in isolation. That call uses **`Date.now()`** per invocation to mint the snapshot object and manifest row (see [`../s3Storage/manifest/orchestration.ts`](../s3Storage/manifest/orchestration.ts)). Two successive calls (content then auth) therefore produce **two mint times**, not one shared instant.

**Implication:** There is **no single timestamp** that is simultaneously "the moment both sidecars represent" unless you define a synthetic rule (for example `max` of the two mint times, with documented gap semantics) or you change storage so both artifacts share one atomic cut (not how the system works today).

Therefore a **single** subscribe-time snapshot envelope **cannot honestly** expose one `replayAt` that claims to be the exact watermark for **both** a content presigned URL and an auth presigned URL unless those URLs point at snapshots that share that cut. Today [`snapshotContent.ts`](./snapshotContent.ts) presigns **content** only via [`../s3Storage/snapshotPresign.ts`](../s3Storage/snapshotPresign.ts); auth is not bundled in that payload.

Current subscribe contract for content: `replayAt` is sourced from the manifest mint time of the exact content snapshot row whose `s3Key` is presigned (`snapshotTimestamp`), not from presign call wall-clock time. This keeps one `replayAt` aligned to one returned sidecar URL. The Dynamo query lower bound for deciding whether to mint a fresh sidecar now prefers stored `Meta::Snapshot.snapshotHeader.replayAt` with fallback to `snapshotHeader.timestamp`.

**Future work:** If downstream subscribers need auth delivery with the same rigor as content, prefer **explicit** contracts: two descriptors (each URL + its own `replayAt`), or a **separate** subscription stream / data source for auth, rather than implying one joined snapshot without reconciling the two mint times. Task planning: [`taskPlanning/packages/mtw-lambda-patterns/ts/dataSource/AGENT.replayAtAuthorityPlumbing.planning.md`](../../../taskPlanning/packages/mtw-lambda-patterns/ts/dataSource/AGENT.replayAtAuthorityPlumbing.planning.md).

## Related files

| File | Role |
| --- | --- |
| [`mtw-wml.ts`](./mtw-wml.ts) | DataSource instance, `Snapshot Created` path (dual `createManualSnapshot`, single `streamEvent`) |
| [`snapshotContent.ts`](./snapshotContent.ts) | `generateWmlSnapshotContent` - Dynamo query + presign orchestration |
| [`abstract.ts`](./abstract.ts) | WML-specific `DataSource` subclass defaults |
