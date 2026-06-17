# Improvisation component data read surfaces (`ts/ephemera/improvisation`)

ephemeraDB pair-addressed read handler for improvisational object merge bodies on **`(OBJECT#, ASSET#IMPROVISATION)`**. Play meta (**`Meta::Object`**) is **`internalCache.ObjectEphemeraMeta`** (lambda-local), not this handler.

**Authoritative writer:** [`lambda/ephemera/dataSource/objects/`](../../../../lambda/ephemera/dataSource/objects/) improvisation persistence modules.

**Package index:** [`packages/mtw-gateways/AGENT.md`](../../AGENT.md).

## Primary vs secondary

| Surface | Use |
| --- | --- |
| **Primary** | **`createImprovisationComponentDataCacheHandler(ephemeraDB)`** / **`ImprovisationComponentDataCache`** --- register on Ephemera **`internalCache.ImprovisationComponentData`**. |
| **Secondary** | **`fetchImprovisationComponentsForAssets`** in [`fetch.ts`](fetch.ts) --- package tests, tooling. **Do not** wire new lambda steady-state reads to raw **`fetch`** when **`internalCache.ImprovisationComponentData`** is available. |

Deep import: `@tonylb/mtw-gateways/ts/ephemera/improvisation`.

## Storage schema

| Field | Shape |
| --- | --- |
| **`EphemeraId`** | `OBJECT#...` (`ComponentUUID`) |
| **`DataCategory`** | `ASSET#IMPROVISATION` (`IMPROVISATION_ASSET_ID`) |
| Merge body | `ComponentPairPersistedFields` / `StandardObject` JSON (`shortName` only in v1) |

Normalization reuses **`standardComponentPairFromAssetDbGetItemsRow`** from [`componentData/fetch.ts`](../../assets/components/componentData/fetch.ts). **Table routing** for aggregate merge (assetDB vs ephemeraDB by `assetId`) is an ephemera **`internalCache`** composite **`ComponentData`** concern (Phase 3), not this module.

## Handler API ([`factory.ts`](factory.ts))

- **`get(universalKey, assetId)`** --- single pair read (asserts `assetId === ASSET#IMPROVISATION`).
- **`getPairs`**, **`getAcrossAssets`** --- batch reads; same cache-key shape as **`ComponentDataCache`**.
- **Memo `set`** / **`invalidate`** --- patch in-memory state only; **no Dynamo write-through**.

After local Dynamo writes in **`mtw.ephemera.objects`** improvisation coordinators, call memo **`set`** or **`invalidate`** on the same **`internalCache.ImprovisationComponentData`** instance.

## Related

- Task plan: [`taskPlanning/lambda/ephemera/AGENT.improvisationalFirstClassObjects.planning.md`](../../../../taskPlanning/lambda/ephemera/AGENT.improvisationalFirstClassObjects.planning.md)
- Object play meta cache: [`lambda/ephemera/internalCache/objectEphemeraMeta.AGENT.md`](../../../../lambda/ephemera/internalCache/objectEphemeraMeta.AGENT.md)
