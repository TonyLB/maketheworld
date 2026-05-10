# MTW Gateways (`@tonylb/mtw-gateways`)

## Purpose

`mtw-gateways` is the shared home for **read-only** gateway code that **multiple lambdas** import when they need on-demand access to materialized data in DynamoDB rows that are written and owned by **another** lambda's DataSource.

A "gateway" here is the small, deliberate surface that bridges:

- **Authoritative writer** (a `lambda/<owner>/dataSource/...` projection that maintains the rows; for example [`lambda/assets/dataSource/components/verticals/`](../../lambda/assets/dataSource/components/verticals/AGENT.md) for `Meta::Import::...` rows).
- **Reader lambdas** (any number; for example ephemera reading the same rows during render / merge).

What lives in this package:

- **Pure read helpers**: `Query` / `GetItem` / `BatchGetItem` compositions, stable projection types, and DynamoDB row normalization.
- **Key and prefix builders**: shared `AssetId` / `DataCategory` constructors so reader and writer agree on encoding (for example, mirroring the `Meta::Import::${parentStripped}::${childStripped}` encoding documented under [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../lambda/assets/dataSource/components/verticals/AGENT.md)).
- **Optional gateway factories**: `createXGateway(deps)` returning an object (`get`, `getAcrossAssets`, etc.) where `deps` inject the data-store interface (e.g. `assetDB`) so each lambda wires the gateway into its own per-invocation `InternalCache` once.

What stays out (see **Non-goals** below): cache singletons, `clear()` / `flush()` orchestration, and **any** write paths.

## Non-goals

- **No cross-lambda cache coherence.** Each lambda keeps its own per-invocation `InternalCache` singleton. Reading via a shared gateway does not synchronize state across lambdas; if two lambdas need consistent values they coordinate via events, not via this package.
- **No DataSource write logic.** All mutating helpers (puts, deletes, projection maintenance) stay in the authoritative `lambda/<owner>/dataSource/...` location. A gateway is a **read alias only**; if you find yourself writing here, the code belongs in the owner.
- **No `DeferredCache` redefinition.** `mtw-gateways` **composes** with the `DeferredCache` and surrounding patterns in [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../mtw-lambda-patterns/ts/internalCache/AGENT.md); it does not fork or replace them.
- **No replacement for area `AGENT.md` files.** Gateway docs in this package describe the **gateway surface**. Steady-state architecture for the underlying projection still lives next to the writer (e.g. assets verticals `AGENT.md`).

## Ownership table

Each gateway in this package must have a row here. Add a row when a new gateway lands; update it whenever a reader is added or the writer moves.

| Gateway | Authoritative writer | Readers | Notes |
| --- | --- | --- | --- |
| **Component Asset Meta** | [`lambda/assets/dataSource/caching/`](../../lambda/assets/dataSource/caching/) ([`cacheAsset`](../../lambda/assets/dataSource/caching/cacheAsset.ts) maintains universal-key component rows in `assetDB`). | [`lambda/ephemera/internalCache/componentAssetMeta.ts`](../../lambda/ephemera/internalCache/componentAssetMeta.ts) imports [`ts/assets/components/assetMeta`](ts/assets/components/assetMeta/index.ts). | Pure helpers and injected `assetDB` reads; ephemera keeps `ComponentAssetMetaData` + `DeferredCache`. Deep import: `@tonylb/mtw-gateways/ts/assets/components/assetMeta`. |
| **Component import vertical (`Meta::Import`)** | [`lambda/assets/dataSource/components/verticals/`](../../lambda/assets/dataSource/components/verticals/) (`mtw.assets.components.verticals`). | TBD (e.g. [`AGENT.componentAggregate.planning.md`](../../taskPlanning/lambda/assets/AGENT.componentAggregate.planning.md) assembly, diagnostics). | Key builders, `Query` envelope, normalized hop types. Deep import: `@tonylb/mtw-gateways/ts/assets/components/verticals`. Discoverability: [`readModel.ts`](../../lambda/assets/dataSource/components/verticals/readModel.ts). |

**Ownership rules:**

1. The **Authoritative writer** column must point at a `lambda/<owner>/dataSource/...` directory (or a specific file inside it). If it points anywhere else, that is a bug or this package owns code it should not.
2. Readers may include lambdas (`lambda/<reader>/...`) or other packages that compose a gateway into a richer surface. Each reader should also have a re-export barrel or import line that grep-finds back to the gateway.
3. **Discoverability:** writers are encouraged to expose a thin re-export barrel next to their DataSource (for example `lambda/assets/dataSource/components/verticals/readModel.ts`) so engineers grepping from the writer's directory find the read surface immediately.

## How to add a gateway

1. **Place pure helpers** under `ts/<area>/<name>/` (for example `ts/assets/components/assetMeta/`). Co-locate types, key builders, query helpers, and an optional `createXGateway(deps)` factory.
2. **Per-gateway `index.ts`** is the public surface. Export key builders, projection types, and the factory. Top-level [`ts/index.ts`](ts/index.ts) re-exports nothing by default; **consumers use deep imports** (`@tonylb/mtw-gateways/ts/<area>/<name>`), matching how `@tonylb/mtw-base` and `@tonylb/mtw-lambda-patterns` are consumed today.
3. **Inject the data store.** The factory receives the narrow store interface it needs (typically `assetDB` or a slice of it). Do not import singletons from consumer lambdas.
4. **No mutation.** All writes stay in the owning DataSource. The gateway may surface validators or normalizers shared between read and write paths, but the act of writing must remain in the owner.
5. **Update the ownership table** in this file in the same change that adds the gateway.
6. **Document the reader's wiring** in the reader's `internalCache/AGENT.md` (or equivalent) rather than duplicating it here. This file describes the gateway; the reader's docs describe its `InternalCache` instance.
7. **Tests** for the gateway live in this package and exercise the helpers in isolation (mock the data store). Integration tests stay in the consuming lambda.

## Component asset reads: ephemera vs assets

Ephemera and the assets lambda both read the **same** DynamoDB component rows (universal component id partition, NDJSON-ish lines keyed by asset), but with **different access patterns**. The **Component Asset Meta** gateway ([`ts/assets/components/assetMeta`](ts/assets/components/assetMeta/index.ts)) is the shared low-level surface for ephemera's read path; assets **`ComponentData`** may adopt additional shared helpers later without merging cache strategies. The gateway must **not** collapse the two consumers into a single cache identity in v1; document the distinction so future contributors do not "dedupe" them blindly.

| | **Ephemera `ComponentAssetMeta`** | **Assets `ComponentData`** |
| --- | --- | --- |
| **Source** | [`lambda/ephemera/internalCache/componentAssetMeta.ts`](../../lambda/ephemera/internalCache/componentAssetMeta.ts) | [`lambda/assets/internalCache/componentData.ts`](../../lambda/assets/internalCache/componentData.ts) |
| **Primary use** | Merge / render paths over an **explicit asset stack** | Authoring-side enumerate **all** assets that contain a component |
| **Cache key** | `${assetId}::${EphemeraId}` (per-asset entry) | `${EphemeraId}` (one entry, `byAssets` array) |
| **Fetch shape** | `assetDB.getItems` over chosen `(EphemeraId, assetId)` keys; `getAcrossAllAssets` first reads `Meta::Room` (etc.) `cached` to discover the asset list, then batches | `assetDB.query` on the universal-id partition; filters NDJSON lines via `isStandardNDJSONLine` |
| **Default value** | Synthesizes `defaultComponentFromTag` + `standardComponentFactory` for misses | Empty `byAssets` array for misses |

**Overlap (gateway-eligible):** both consumers run [`standardComponentFactory`](../mtw-wml/ts/standardize/componentFactory.ts) over the same row shape, both use [`assetDB`](../mtw-utilities/ts/dynamoDB/index.ts), and both share the universal-key partition convention. Row normalization, batch key construction, and projection types are the natural first set of shared helpers.

**Deliberate non-goal for v1 of the gateway:** replacing `ComponentData` with the ephemera wrapper, or collapsing the two callers into a single cache entry. The cache strategies differ for good reasons (per-asset render keys vs whole-component authoring views); shared helpers are valuable, shared cache identity is not.

## Test runner

Tests use Jest + `ts-jest` with the ESM preset (`ts-jest/presets/js-with-ts-esm`), matching [`packages/mtw-sessions`](../mtw-sessions/jest.config.js) and [`packages/mtw-base`](../mtw-base/jest.config.js). Run from the package root:

```sh
npm test
```

Run from the repo root for a workspace-aware build check:

```sh
npx tsc --build packages/mtw-gateways/tsconfig.ref.json
```

Add real tests alongside each gateway under `ts/<area>/<name>/index.test.ts`.

### Consumer regression (ephemera)

After changing shared helpers under [`ts/assets/components/assetMeta`](ts/assets/components/assetMeta/index.ts), run ephemera's `ComponentAssetMeta` integration tests:

```sh
cd lambda/ephemera && npm test -- --testPathPattern componentAssetMeta
```

## Cross-references

- [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../mtw-lambda-patterns/ts/internalCache/AGENT.md) - the `DeferredCache` and `InternalCache` patterns this package composes with.
- [`lambda/ephemera/internalCache/componentAssetMeta.AGENT.md`](../../lambda/ephemera/internalCache/componentAssetMeta.AGENT.md) - prototype reader's current shape.
- [`lambda/assets/internalCache/componentData.ts`](../../lambda/assets/internalCache/componentData.ts) - sibling reader on the assets lambda.
- [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../lambda/assets/dataSource/components/verticals/AGENT.md) - authoritative writer for **`Meta::Import::...`**; shared read helpers in [`ts/assets/components/verticals`](ts/assets/components/verticals/index.ts).
