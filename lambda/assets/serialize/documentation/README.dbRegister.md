---
---

# dbRegister

The dbRegister command accepts the details of a parsed asset, and enters them into
the Asset DynamoDB table

---

## Needs Addressed

---

- Assets need to be stored in the Asset DynamoDB table for low-latency processing
- Must be able to add an Asset fresh, in an empty database
- Must be able to add an Asset as an update, where values already exist


---

## Usage


```ts
    await dbRegister({
        fileName: 'Player/Test/Assets/ImportTest.wml',
        translateFile: 'Player/Test/Assets/ImportTest.translate.json',
        scopeMap: {
            VORTEX: 'ROOM#VORTEX',
            Bookshelves: 'FEATURE#Bookshelves',
            downtownMap: 'MAP#Central'
        },
        assets // NormalForm of assets having been passed through ScopeMap.translateNormalForm
    })
```

---

## Behaviors

---

### Expected Asset DB Contents, before or after

*Meta::Asset record*

| AssetId | DataCategory | fileName | translateFile | name | zone | defaultExits | defaultNames |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ASSET#ImportTest | Meta::Asset | Player/Test/Assets/ImportTest.wml | Player/Test/Assets/ImportTest.translate.json | ImportTest | Personal | [{ name: 'welcome', from: 'VORTEX', to: 'layerAWelcomeRoom' }] | { Welcome: 'Welcome', ... } |

*Item records*

| AssetId | DataCategory | scopedId | defaultAppearances |
| --- | --- | --- | --- |
| ROOM#VORTEX | ASSET#ImportTest | VORTEX | [{ render: [': test addition'], exits: [{ name: 'welcome', to: 'layerAWelcomeRoom' }] }]
| FEATURE#Bookshelves | ASSET#ImportTest | Bookshelves | [{ name: 'Bookshelves' }]
| MAP#Central | ASSET#ImportTest | downtownMap | [{ rooms: { VORTEX: { x: 0, y: 0 } }, exits: [{ name: 'vortex', from: 'welcome', to: 'VORTEX' }] }]

---

### Meta::Asset record data types

***defaultExits***

List all exits defined in the asset, that are not conditioned on any expression

```ts
    type DefaultExit = {
        name: string;
        to: string;
        from: string;
    }

    type DefaultExits = DefaultExit[]
```

***defaultNames***

Lists names for all rooms in the asset, where the room appearance in which the name is
defined is not conditioned on any expression

```ts
    type DefaultName = string

    type DefaultNames = Record<string, DefaultName>
```

---

### Merge Function

The merge function will change the existing data to match the data passed to it:

- If an entry exists in the current database, but not the incoming data, the function will remove that entry
- If an entry exists in both the current database and the incoming data, with different values, the function will update that entry
- If no entry exists in the current database, but one exists in the incoming data, the function will add that entry

---

### Importing Default values from ancestors

During registry of an asset, the values for **defaultAppearance** of any imported Maps should be fetched from the imported asset.
Similarly, **defaultNames** and **defaultExits** should be imported for each import-ancestor of that asset.  That information
is enough to create a picture, for each map in the asset, of what changes (rooms, and their names ... exits between rooms already
counted in the map) are introduced in *this particular layer* (as opposed to being inherited).  Those new map elements should
be denormalized into the **defaultAppearance** of the map in the asset being registered (to provide a base for other assets to
import *this* one, and add yet more layers).
