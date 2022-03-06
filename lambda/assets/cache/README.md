
---
---

# cache Assets
This function accepts an asset Id, reads and aggregates all the information in that
asset from the Assets table and the state of other (imported) Assets in the Ephemera,
and then caches all that information into the Ephemera table.

---

## Needs Addressed

---

- Ephemera needs to be initialized when an asset is first cached
- Ephemera needs to be updated with minimum necessary changes when asset is updated

---

## Usage

---

```js
    await cache(assetId, { check: false, recursive: true, forceCache: false })
```

---
---

## Behaviors

### Expected Asset Format
Asset data is passed in standard normal form (add link when documentation complete) with added *EphemeraId* items from a scopeMap (either global or local).

### Output

[**mergeEntries**](./README.mergeEntries.md) adds several types of adjaceny list data to the Ephemera table

**pushEphemera** adds a Meta::Asset record for the particular Asset being cached

**updateDependencies** side-effects the Meta::Asset records of other imported assets, as needed
