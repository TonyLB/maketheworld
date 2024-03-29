---
---

# Content Layer


---

## Needs Addressed

- Needs to quickly fetch data for an individual component (however it is named and
renamed in various assets) across many active assets, in order to quickly present a given
character's view of that component
- Needs to be able to fetch all information needed to render a component, organized
by the conditionals that could change whether each piece of information is (or isn't) relevant
at the moment

---

## Asset Meta-Record

*For each asset, a record will be stored to represent the top level of the Asset itself*

### *Key Data*

- EphemeraId: `ASSET#${AssetKey}`
- DataCategory: 'Meta::Asset'
- address: AssetWorkspaceAddress

---

## <Component\> meta-records

*For any tag in the component types (Room, Feature), a record will be stored for the given EphemeraID, over*
*all cached assets.  This record will track which assets have information for that given component item,*
*to speed rendering.  The record should be removed when the last per-asset record for that item is decached.*

### *Key Data*

- EphemeraId: The global ID used to identify this component
- DataCategory: 'Meta::Room' or 'Meta::Feature'
- cached: A non-empty set of AssetIDs
- activeCharacters ('Meta::Room' items only):  A list of characters currently being played who are present
in the room

---

## <Component\> per-asset records

---

*For any tag in the component types (Room, Feature), a record will be stored in an adjacency list associated with*
*the Asset (by placing the Asset's AssetId in the DataCategory field of the component record)*

### *Key Data*

- EphemeraId: The global ID used to identify this component
- DataCategory
- scopedId:  The key used internally within this asset to refer to this component
- appearances

```ts
export type EphemeraCondition = {
    dependencies: string[];
    if: string;
}

export type EphemeraFeatureAppearance = {
    conditions: EphemeraCondition[];
    name: string;
    render: ComponentRenderItem[];
}

export type EphemeraFeature = {
    EphemeraId: string;
    key: string;
    tag: 'Feature';
    appearances: EphemeraFeatureAppearance[];
}

export type EphemeraExit = {
    name: string;
    to: string;
}

export type EphemeraRoomAppearance = {
    conditions: EphemeraCondition[];
    name: string;
    render: ComponentRenderItem[];
    exits: EphemeraExit[];
}

export type EphemeraRoom = {
    EphemeraId: string;
    key: string;
    tag: 'Room';
    appearances: EphemeraRoomAppearance[];
}

export type EphemeraMapRoom = {
    EphemeraId: string;
    x: number;
    y: number;
}

export type EphemeraMapAppearance = {
    conditions: EphemeraCondition[];
    fileURL: string;
    name: string;
    rooms: Record<string, EphemeraMapRoom>;
}

export type EphemeraMap = {
    EphemeraId: string;
    key: string;
    tag: 'Map';
    appearances: EphemeraMapAppearance[];
}

export type EphemeraItem = EphemeraFeature | EphemeraRoom | EphemeraMap
```

---
---