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

## Maintenance rules (projector)

On **`Component Updated`**, **`Component Republished`**, or **`Component Removed`** from **`mtw.assets`**:

1. Require **`component.universalKey`** and a valid **`streamKey`** (child asset context).
2. **Remove** any existing hop rows for **(universalKey, child)** by querying import-meta rows under that partition and deleting those whose sort key ends with **`::${childStripped}`** (there is at most one such hop when imports are well-formed).
3. If the event is **not** **`Component Removed`** and **`_from`** is set, **put** the hop row for the current parent/child pair.

**Import-diff / noisy updates:** finer-grained skip logic may be added later; v1 may rewrite after delete for correctness.

## Event subscription

Subscribes to **`mtw.assets`**:

- `Component Updated`
- `Component Republished`
- `Component Removed`

See **[`subscribedEvents.ts`](./subscribedEvents.ts)**.

## Related documentation

- Assets event mesh overview: [`../../../AGENT.event.md`](../../../AGENT.event.md)
- Planning initiative: [`../../../../../taskPlanning/lambda/assets/AGENT.componentVertical.planning.md`](../../../../../taskPlanning/lambda/assets/AGENT.componentVertical.planning.md)
