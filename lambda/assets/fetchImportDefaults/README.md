---
---

# FetchImports

The FetchImports API outlet provides a vertical slice of data about *particular objects* as they are represented across
multiple (inherited) Assets.

---

## Needs Addressed

---

- As a content creator: When I extend Room A, I need a good view of what Room A looks like at the point from which I
am extending it. That requires knowing "What are the properties of Room A in the asset I'm importing from, as well as
the asset *that* asset imported Room A from, and so on back to its origin."
- As a content creator: When I choose to extend Room A in the game-space, I am seeing a layering of different assets.
I need to be able to choose which *layer/asset* I am extending from.

---

## Inputs

---

```ts
type ImportFromAssetArgument = {
    assetId: `ASSET#${string}`;
    keys: string[];
}

type FetchImportsArgument = {
    type: 'FetchImports';
    importsFromAsset: ImportFromAssetArgument[];
}
```

---

## Outputs

---

The outlet returns a SchemaTag elements for each key requested, in each Asset or imported Asset.
It must **also** return "stub" elements for items that are referred to by the main elements (and therefore
need to exist on some level), but which were not, themselves, requested.  Example: If you get import
values for Room A, which has an exit to Room B, then you need at least a stub to represent Room B and
record the bare minimum information (i.e. its *name*).

```ts
type FetchImportOutputByAsset = {
    assetId: `ASSET#${string}`;
    schemaByKey: Record<string, SchemaTag[]>;
    stubsByKey: Record<string, SchemaTag[]>;
}

type FetchImportOutput = {
    messageType: `FetchImports`;
    importsByAsset: FetchImportOutputByAsset[];
}
```

---