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

## Write ownership

Only **`mtw.assets.components.verticals`** writes or deletes **`Meta::Import::...`** rows. **`cacheAsset`** does not maintain these items; overlap would indicate a bug.

### Relationship to `cacheAsset`

Authoritative per-asset component bodies and row deletes are performed by **[`cacheAsset`](../../caching/cacheAsset.ts)** (diff vs workspace, then `putItem` / `deleteItem` on component rows). **`cacheAsset`** then streams **`Component Updated`**, **`Component Republished`**, and **`Component Removed`** on **`mtw.assets`**. This DataSource **only** consumes those envelopes via **[`index.ts`](./index.ts)**; it does not read S3 or re-derive the whole asset. **`cacheAsset` must never** write or delete **`Meta::Import::...`** items---that would violate single-writer ownership.

### Import-diff (current behavior vs future optimization)

**Today:** for each subscribed **`Component Updated`**, **`Component Republished`**, or **`Component Removed`** event, **[`projectImportVerticalHop`](./projectImportVerticalHop.ts)** runs the full maintenance sequence (query partition, delete hop rows for the child, conditional put). That is correct even when unrelated component fields changed.

**Future:** optional **import-diff** optimization---skip projection when import signals (**`_from`**, **`universalKey`**, child **`streamKey`**) are unchanged across noisy updates---may use richer comparison or events; see [task planning](../../../../../taskPlanning/lambda/assets/AGENT.componentVertical.planning.md#datasource-and-code-layout-for-mtwassetscomponentsverticals) (import diff detection).

### Idempotency

For each handled event, the projector **deletes** existing **`Meta::Import::...`** rows for **(universalKey, child)** then **conditionally puts** the hop for the current **`_from`**. Duplicate or replayed deliveries converge to the same final rows: deletes are idempotent, and the put targets a deterministic **`DataCategory`**.

### Decache and removal semantics

**Removal:** When a component is **removed from the asset**, **`cacheAsset`** deletes the Dynamo component row **`(AssetId = universalKey, DataCategory = assetUUID)`** and emits **`Component Removed`**. The projector runs with **`Component Removed`** and **only deletes** hop rows for that child under the universal-key partition; it **does not** insert a new hop.

**"Decache"** in this context means **authoritative Dynamo row removal plus the removal event**, not cache singleton invalidation inside this DataSource (this module does not own **`InternalCache`**).

## Maintenance rules (projector)

On **`Component Updated`**, **`Component Republished`**, or **`Component Removed`** from **`mtw.assets`**:

1. Require **`component.universalKey`** and a valid **`streamKey`** (child asset context).
2. **Remove** any existing hop rows for **(universalKey, child)** by querying import-meta rows under that partition and deleting those whose sort key ends with **`::${childStripped}`** (there is at most one such hop when imports are well-formed).
3. If the event is **not** **`Component Removed`** and **`_from`** is set, **put** the hop row for the current parent/child pair.

See **Import-diff** above for skip-on-unchanged-import follow-up.

## Event subscription

Subscribes to **`mtw.assets`**:

- `Component Updated`
- `Component Republished`
- `Component Removed`

See **[`subscribedEvents.ts`](./subscribedEvents.ts)**.

## Related documentation

- Assets event mesh overview: [`../../../AGENT.event.md`](../../../AGENT.event.md)
- Planning initiative: [`../../../../../taskPlanning/lambda/assets/AGENT.componentVertical.planning.md`](../../../../../taskPlanning/lambda/assets/AGENT.componentVertical.planning.md)
- Read-only **`Meta::Import`** gateway (shared types and `Query` helpers): **[`readModel.ts`](./readModel.ts)** re-exports [`@tonylb/mtw-gateways/ts/assets/components/verticals`](../../../../../packages/mtw-gateways/ts/assets/components/verticals/index.ts).
