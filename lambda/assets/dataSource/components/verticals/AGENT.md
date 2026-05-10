# Component import vertical index (`mtw.assets.components.verticals`)

## Role

Non-replayable [`AssetsDataSource`](../../abstract.ts) **[`index.ts`](./index.ts)** subscribes to **`mtw.assets`** component lifecycle events and maintains **derived** DynamoDB rows that describe each **cross-asset import hop** for a **universal component identity** (`ROOM#...`, `FEATURE#...`, etc.). Authoritative component bodies remain on cache / primary component rows written by **`cacheAsset`**; this source **only** owns **`Meta::Import::...`** items under each universal-key partition.

## Dynamo schema (v1)

Single-table assets store ([`assetDB`](../../../../../packages/mtw-utilities/ts/dynamoDB/index.ts)); keys match existing conventions (`AssetId`, `DataCategory`).

| Attribute | Value |
| --- | --- |
| **`AssetId` (partition key)** | Universal component id: `component.universalKey` (e.g. `ROOM#VORTEX`). |
| **`DataCategory` (sort key)** | `Meta::Import::${parentStripped}::${childStripped}` where **`parentStripped`** / **`childStripped`** are asset identifiers **with the `ASSET#` prefix removed**. Encoding matches [task planning](../../../../../taskPlanning/lambda/assets/AGENT.componentVertical.planning.md#sort-key-and-datacategory-for-metaimport). |

**Semantics:** For universal identity **U**, in **child** asset **C**, if the component imports from parent asset **P** (`StandardComponent._from === 'ASSET#...'` pointing at **P**), there is at most one hop row for the pair **(U, C)**: sort key **`Meta::Import::${P_stripped}::${C_stripped}`**.

**Optional attributes:** v1 may store **keys only**; denormalized stubs (e.g. `shortName`) are reserved for later milestones.

## Read access patterns

- **Vertical envelope (primary):** `Query` on **`AssetId = U`** with **`begins_with(DataCategory, 'Meta::Import::')`** to load all import-meta hops for that identity in one round trip (optionally narrow by parent prefix: `begins_with(DataCategory, 'Meta::Import::${parentStripped}::')`).

- **Reverse lookups** (“everything that depends on asset X” globally): **not** supported in v1; no reverse GSI is introduced with this DataSource. Follow-on if product needs global dependency walks.

### Assets lambda cache (`internalCache.ComponentVerticals`)

On the assets lambda, **[`internalCache.ComponentVerticals`](../../../internalCache/componentVerticals.ts)** caches **`queryImportVerticalMeta`** (from `@tonylb/mtw-gateways/ts/assets/components/verticals`) keyed by universal component id. **[`syncImportVerticalPartition`](./syncImportVerticalPartition.ts)** (invoked by **`projectImportVerticalHop`** and **[`healComponentVertical`](./healComponentVertical.ts)**) calls **`internalCache.ComponentVerticals.invalidate`** after mutating **`Meta::Import::...`** rows so later reads in the same invocation refetch. Any tooling that writes hops **without** going through **`syncImportVerticalPartition`** must invalidate the same key.

Broader **`internalCache`** composition (including a **future** shared universal-key partition fetch shared with **`ComponentData`**) is documented in [`lambda/assets/internalCache/AGENT.md`](../../../internalCache/AGENT.md).

## Write ownership

Only **`mtw.assets.components.verticals`** writes or deletes **`Meta::Import::...`** rows. **`cacheAsset`** does not maintain these items; overlap would indicate a bug.

### Relationship to `cacheAsset`

Authoritative per-asset component bodies and row deletes are performed by **[`cacheAsset`](../../caching/cacheAsset.ts)** (diff vs workspace, then `putItem` / `deleteItem` on component rows). **`cacheAsset`** then streams **`Component Updated`**, **`Component Republished`**, and **`Component Removed`** on **`mtw.assets`**. This DataSource **only** consumes those envelopes via **[`index.ts`](./index.ts)**; it does not read S3 or re-derive the whole asset. **`cacheAsset` must never** write or delete **`Meta::Import::...`** items---that would violate single-writer ownership.

### Import-diff (future optimization)

**Today:** each subscribed **`Component Updated`**, **`Component Republished`**, or **`Component Removed`** event triggers **[`projectImportVerticalHop`](./projectImportVerticalHop.ts)**, which calls **[`syncImportVerticalPartition`](./syncImportVerticalPartition.ts)** for **`component.universalKey`**. **`syncImportVerticalPartition`** wires **`ImportVerticalConsistencyAnalyzer`** with **`internalCache.ComponentData`** (authoritative **`get`**) and **`queryImportVerticalMeta`** for the **`Meta::Import::...`** projection, runs **`check`**, then applies **`putItem`** / **`deleteItem`** from analyzer findings (**`categoriesToAdd`** / **`metaRowsToDelete`**). Authoritative reads come from the same partition **`Query`** path as **`ComponentData`**, not from the event payload alone. Diagnostics **`componentVerticalMisalignmentSweep`** uses the same analyzer with **`assetDB`**-backed adapters plus **`authoritativeComponentDataFromUniversalPartitionRows`** for parity.

**Future:** optional **import-diff** optimization---skip **`syncImportVerticalPartition`** when import signals (**`_from`**, **`universalKey`**, child **`streamKey`**) are unchanged across noisy updates---may use richer comparison or events; see [task planning](../../../../../taskPlanning/lambda/assets/AGENT.componentVertical.planning.md#datasource-and-code-layout-for-mtwassetscomponentsverticals) (import diff detection).

### Idempotency

Reconciliation targets the **full** **`Meta::Import::...`** envelope per universal key; duplicate or replayed deliveries converge to the same final rows.

### Decache and removal semantics

**Removal:** When a component is **removed from the asset**, **`cacheAsset`** deletes the Dynamo component row **`(AssetId = universalKey, DataCategory = assetUUID)`** and emits **`Component Removed`**. The next **`syncImportVerticalPartition`** run **Query**s authoritative rows without that line; the derived hop set no longer includes that child, so the corresponding **`Meta::Import::...`** row is **deleted** in the reconciliation diff.

**"Decache"** in this context means **authoritative Dynamo row removal plus the removal event**. Read-side **`internalCache.ComponentVerticals`** invalidation is tied to **`projectImportVerticalHop`** on the assets lambda (see **Assets lambda cache** above), not to generic **`ComponentData`** invalidation.

## Maintenance rules (projector)

On **`Component Updated`**, **`Component Republished`**, or **`Component Removed`** from **`mtw.assets`**:

1. Require **`component.universalKey`** and a valid **`streamKey`** (child asset context on the envelope).
2. Run **`syncImportVerticalPartition(universalKey)`** (see **Import-diff** above).

## Imperative heal (`HealComponentVertical`)

**[`healComponentVertical`](./healComponentVertical.ts)** **`Query`**s **`DataCategoryIndex`** for all component rows in an asset, collects **`universalKey`** values (optional filter), and runs **`syncImportVerticalPartition`** for each. Exposed as synthetic **`api.assets`** **`HealComponentVertical`** (request **`assetId`**, optional **`componentUniversalKeys`**); direct invokes mirror **`HealPlayer`** via [`lambda/assets/app.ts`](../../../app.ts) and return **`ReturnValue`** through the **`mtw.assets`** DataSource handler.

## Event subscription

Subscribes to **`mtw.assets`**:

- `Component Updated`
- `Component Republished`
- `Component Removed`

Also subscribes to **`mtw.diagnostics`** when EventBridge carries **`Component Vertical Misaligned Finding`**: **`receiveEvents`** calls **`healComponentVertical`** for the finding **`assetId`**, matching the **`api.assets` / `HealComponentVertical`** imperative path idempotently without forking salvage rules.

See **[`subscribedEvents.ts`](./subscribedEvents.ts)**.

## Cycles (imports)

Cross-asset cycles can appear after **`wml`** commits edits **`assets`** did not reject; see [**Cycles (imports)** in task planning](../../../../../taskPlanning/lambda/assets/AGENT.componentVertical.planning.md#cycles-imports).

**Proper fix:** Prevent cycles at **`wml`** acceptance when enough cross-asset graph is visible---deferred work in [`lambda/wml/AGENT.importCycles.future.md`](../../../../wml/AGENT.importCycles.future.md).

**Index-only last resort (`assets`):** If authoritative **`_from`** imply a **directed cycle**, **`Meta::Import`** projection may **omit one hop** deterministically (e.g. drop the hop with **minimum parent** asset id under string sort of stripped `ASSET#` ids, tie-break on **child**) so the stored vertical envelope stays **acyclic** for bounded **`Query`**. That hop **may not match** **`_from`** until authoring fixes imports; this DataSource does **not** edit component rows. Shared **`mtw-gateways`** helpers, **`projectImportVerticalHop`**, and heal must use the **same** rule. Cycle detection should reuse **`@tonylb/mtw-utilities`** **`Graph`** / **`topologicalSort`** (SCCs) rather than new graph logic; see task planning **Still open** and **`packages/mtw-gateways/AGENT.md`** (**Shared helpers**).

## Related documentation

- Assets event mesh overview: [`../../../AGENT.event.md`](../../../AGENT.event.md)
- Planning initiative: [`../../../../../taskPlanning/lambda/assets/AGENT.componentVertical.planning.md`](../../../../../taskPlanning/lambda/assets/AGENT.componentVertical.planning.md)
- Read-only **`Meta::Import`** gateway (shared types and `Query` helpers): **[`readModel.ts`](./readModel.ts)** re-exports [`@tonylb/mtw-gateways/ts/assets/components/verticals`](../../../../../packages/mtw-gateways/ts/assets/components/verticals/index.ts).
