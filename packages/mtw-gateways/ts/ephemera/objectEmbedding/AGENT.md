# Object embedding read surfaces (`ts/ephemera/objectEmbedding`)

ephemeraDB read handler for semantic embedding adjacency on **`(OBJECT#, EMBEDDING#IMPROMPTU)`** (v1 impromptu scope). Handler name is scope-neutral for future authored-object embedding rows.

**Authoritative writer:** [`lambda/ephemera/dataSource/objects/`](../../../../lambda/ephemera/dataSource/objects/) improvisation persistence coordinators (spawn/update transact **`Put`**; delete transact **`Delete`**).

**Package index:** [`packages/mtw-gateways/AGENT.md`](../../AGENT.md).

## Primary vs secondary

| Surface | Use |
| --- | --- |
| **Primary** | **`createObjectEmbeddingCacheHandler(ephemeraDB)`** / **`ObjectEmbeddingCacheHandler`** --- register on Ephemera **`internalCache.ObjectEmbedding`**. |
| **Secondary** | **`fetchObjectEmbeddingsImpromptu`** in [`fetch.ts`](fetch.ts) --- package tests, tooling. **Do not** wire new lambda steady-state reads to raw **`fetch`** when **`internalCache.ObjectEmbedding`** is available. |

Deep import: `@tonylb/mtw-gateways/ts/ephemera/objectEmbedding`.

## Storage schema

| Field | Shape |
| --- | --- |
| **`EphemeraId`** | `OBJECT#...` (`EphemeraObjectId`) |
| **`DataCategory`** | `EMBEDDING#IMPROMPTU` |
| **`embedding`** | `SemanticEmbeddingDynamoRecord` (256d int8-v1) |

Type authority: [`ephemeraEmbedding.ts`](../../../../packages/mtw-interfaces/ts/ephemeraEmbedding.ts). Value serde: [`semanticEmbedding/AGENT.implementation.md`](../../../../packages/mtw-lambda-patterns/ts/semanticEmbedding/AGENT.implementation.md).

## Handler API ([`factory.ts`](factory.ts))

- **`get(objectIds[])`** --- batch read; missing or invalid rows return **`undefined`** for that id (not an error).
- **Memo `set`** / **`invalidate`** --- patch in-memory state only; **no Dynamo write-through**.

After local Dynamo writes in **`mtw.ephemera.objects`** improvisation coordinators, call memo **`set`** or **`invalidate`** on the same **`internalCache.ObjectEmbedding`** instance via [`invalidateImprovisationObjectCaches.ts`](../../../../lambda/ephemera/dataSource/objects/invalidateImprovisationObjectCaches.ts).

## Related

- Objects lane embedding write path: [`lambda/ephemera/dataSource/objects/embedding/`](../../../../lambda/ephemera/dataSource/objects/embedding/)
- Improvisation pair rows (adjacent on same PK): [`ts/ephemera/improvisation/AGENT.md`](../improvisation/AGENT.md)
- Identity embedding fast path (consumer): [`lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/`](../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/)
