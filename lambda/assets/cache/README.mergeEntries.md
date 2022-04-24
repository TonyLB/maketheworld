
---
---

# mergeEntries
This function accepts an assetId and normalForm for a scopeMapped asset, and renders
the changes to turn the current Ephemera state into the correct state for that
asset.

---

## Needs Addressed

---

- Ephemera needs to be initialized when an asset is first cached
- Ephemera needs to be updated with minimum necessary changes when asset is updated

---

## Usage

---

```js
    await mergeEntries(assetId, normalForm)
```

---
---

## Behaviors

### Expected Asset Format
Asset data is passed in standard normal form (add link when documentation complete) with added *EphemeraId* items from a scopeMap (either global or local).

### Output

**mergeEntries** adds several types of records to the *Ephemera* table.  All are examples of adjacency-list entries,
which associate the scoped Item ID (in the EphemeraId field) with a given asset key (in the DataCategory field),
then add information specific to that item *in that asset*.

Each data item has the following fields:

- ***key***: The original key of the item, within its Asset definition.  So where a Room might have an EphemeraId of `ROOM#a123-b456-c789-d012`, its key could be `welcomeRoom`.
- ***tag***:  The tag specifies the type of the item (e.g. 'Room', or 'Feature', or 'Map')

Each data item also has an `appearances` variable which holds relevant data on the instances of the item appearing
in the asset definition.  These are stored in the order they appear in the asset file, and should be applied over
each other in that same order.

***Global Appearance Types***

```ts
    type AppearanceCondition = {
        if: string;             // Code to be evaluated to determine whether this Appearance is active
        dependencies: string[]; // A list of variables whose values are used in this code
    }

    type DescriptionFeatureLink = {
        key: string;
        tag: 'Link';
        targetTag: 'Feature';
        text: string;
        to: string;
        toFeatureId: string;
    }

    type DescriptionActionLink = {
        key: string;
        tag: 'Link';
        targetTag: 'Action';
        text: string;
        to: string;
        toAssetId: string;
        toAction: string;
    }

    type DescriptionString = {
        tag: 'String';
        value: string;
    }

    type DescriptionRenderItem = DescriptionString | DescriptionFeatureLink | DescriptionActionLink
```

***Room Appearance Format***

```ts
    type RoomAppearance = {
        conditions: AppearanceCondition[];
        render?: DescriptionRenderItem[];
        name?: string;
        features?: {
            name: string;
            EphemeraId: string;
        }[];
        exits?: {
            name: string;
            to: string;
        }[];
    }
```

***Feature Appearance Format***

```ts
    type FeatureAppearance = {
        conditions: AppearanceCondition[];
        render?: DescriptionRenderItem[];
        name?: string;
    }
```

***Map Appearance Format***

```ts
    type MapRoomLocation = {
        EphemeraId: string;
        x: number;
        y: number;
    }

    type MapAppearance = {
        conditions: AppearanceCondition;
        rooms: Record<string, MapRoomLocation>;
    }
```

---
---

***Expected Ephemera DB Contents, before or after***

| EphemeraId | DataCategory | appearances |
| --- | --- | --- |
| ROOM#VORTEX | ASSET#BASE | { ... RoomAppearance[] ... } |
| ROOM#VORTEX | ASSET#LibraryStuff | { ... more RoomAppearance[] ... } |
| ROOM#Library | ASSET#LibraryStuff | { ... RoomAppearance[] ... } |
| FEATURE#Bookshelves | ASSET#LibraryStuff | { ... FeatureAppearance[] ... } |
| MAP#Central | ASSET#BASE | { ... MapAppearance[] ... }