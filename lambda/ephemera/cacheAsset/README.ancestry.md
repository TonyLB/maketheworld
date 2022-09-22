---
---

# Ancestry Layer

The Ancestry layer stores quick-fetch denormalizations for Ancestry and Descent, which maintain the
entire DAG of dependency connection, going "backward" from a given node to ancestors that it depends
upon, references, and imports, and "forward" from the node to descendants that (in turn) import it.

Ancestry information is useful for deriving the entire behavior of an asset (including everything it
inherits).

Descent information is useful for updating and rerendering assets in response to a change in an
asset from which they inherit, or for updating computed items that depend upon variable values.

Descent is stored for anything that can depend upon another item, or be depended upon in turn:
- Assets
- Variables (can only have Descendants)
- Computed
- Room (can have state variables as Ancestors, and Maps as Descendants)
- Feature (can only have Ancestors)
- Map (can only have Ancestors)

---

## Needs Addressed

- Needs to start from an Asset that needs to be cached, and know what ancestors need to be cached
*first* (and in what order) to make it valid
- Needs to start from a variable that has been changed (e.g. by an action) and cascade forward
those changes to any Computed fields, as well as deliver rerenders of any impacted Rooms and Maps.
- Needs to be able to maintain the interconnected tree consistently as new dependent items are
added, removed, or their connections updated

---

## Tree Storage

---

*Any tree is stored as a recursively nested map:  A key indicates a node, and its value is a nested map of*
*children.  A leaf node is represented by a key with an empty map as its value.*

*For assets, only the bare connection tree is stored, with no meta data about origin of connections*

```ts
export type DependencyNonAssetNode = {
    tag: 'Asset'
    EphemeraId: string;
    connections: DependencyNode[];
}
```

*For non-asset items (i.e. for items whose dependencies are defined ***within*** assets), each dependency*
*node also keeps a list of assets that have registered the connection ... when the last is decached, the*
*dependency link is removed.*

```ts
export type DependencyNonAssetNode = {
    tag: 'Asset' | 'Variable' | 'Computed' | 'Room' | 'Feature' | 'Map'
    key: string; // The key name by which children nodes know this parent
    EphemeraId: string;
    assets: string[];
    connections: DependencyNode[];
}
```

---

## Ancestry

*Each relevant record will have an Ancestry field which stores a list of DependencyNodes indicating the import relationships*
*starting at that item and stretching backward to things it depends upon.*

***Example***

```ts
    const CathedralAncestry = [{
        tag: 'Asset',
        EphemeraId: 'ASSET#TownSquare',
        connections: [{
            tag: 'Asset',
            EphemeraId: 'ASSET#City',
            connections: []
        }]
    },
    {
        tag: 'Asset',
        EphemeraId: 'ASSET#UnderCroft',
        connections: [{
            tag: 'Asset',
            EphemeraId: 'ASSET#Sewer',
            connections: [{
                tag: 'Asset',
                EphemeraId: 'ASSET#City',
                connections: []
            }]
        }]
    }]
```

This indicates that the importing Asset (e.g. Cathedral) imports both the TownSquare and Undercroft Assets.  The
TownSquare imports City.  The Undercroft imports Sewer, which in turn *also* imports the City asset.

---

## Descent

*Each **Meta::Asset** record will have a Descent field which stores a tree that indicates the dependency relationships*
*starting at that asset and stretching forward to descendant importing assets.*

***Example***

```ts
    const CityDescent = [{
        tag: 'Asset',
        EphemeraId: 'ASSET#TownSquare',
        connections: [{
            tag: 'Asset',
            EphemeraId: 'ASSET#Cathedral',
            connections: []
        }]
    },
    {
        tag: 'Asset',
        EphemeraId: 'ASSET#Sewer',
        connections: [{
            tag: 'Asset',
            EphemeraId: 'ASSET#UnderCroft',
            connections: [{
                tag: 'Asset',
                EphemeraId: 'ASSET#Cathedral',
                connections: []
            }]
        }]
    }]
```

This indicates the mathematical inverse of the Ancestry map, above:  This is a map of the descendants of the City
asset, indicating that it is imported by TownSquare and Sewer.  The TownSquare is imported by Cathedral.  The Sewer
is imported by Undercroft, which in turn is *also* imported by Cathedral.

---

## Non-Asset Dependencies

Non-Asset dependencies are more complicated, because (a) each edge can include a different local key for code to
refer to a value, and (b) different assets can have different edges between the same two nodes:

```ts
    const Variable = {
        Ancestry: [],
        Descent: [{
            tag: 'Room',
            key: 'lightSwitch',
            EphemeraId: 'ROOM#ABC',
            assets: ['Base'],
            connections: [{
                tag: 'Map',
                EphemeraId: 'MAP#DEF',
                assets: ['Base', 'Layer']
                connections: []
            }]
        },
        {
            tag: 'Room',
            key: 'lightsOn',
            EphemeraId: 'ROOM#ABC',
            assets: ['Layer'],
            connections: [{
                tag: 'Map',
                EphemeraId: 'MAP#DEF',
                assets: ['Base', 'Layer']
                connections: []
            }]
        }]
    }

    const Room = {
        Ancestry: [{
            tag: 'Variable',
            key: 'lightSwitch',
            EphemeraId: 'VARIABLE#XYZ',
            assets: ['Base'],
            connections: []
        },
        {
            tag: 'Variable',
            key: 'lightsOn',
            EphemeraId: 'VARIABLE#XYZ',
            assets: ['Layer'],
            connections: []
        }],
        Descent: [{
            tag: 'Map',
            EphemeraId: 'MAP#DEF',
            assets: ['Base', 'Layer'],
            connections: []
        }]
    }
```

In the above example, we have three nodes:  A variable that represents the position of a light
switch, a Room that renders differently depending upon that position, and a Map that depends upon
the name and exits of that Room.  In the Base Asset, the variable is imported into the local
namespace with key 'lightSwitch', and the room has some conditional dependencies upon it under
that name.  In the Layer asset, the variable is imported into the local namespace with key 'lightsOn',
and the room has *further* conditional dependencies upon that same (underlying) variable under
a different alias.

Edges are considered the "same" edge (for purposes of aggregating the assets list) if (a) they have
the same EphemeraId, and (b) they either both have no key, or both have the same key.

---

## Updates

*Whenever an item which either (a) is depended upon, (b) depends upon other assets, or (c) both is updated in a way that*
*changes its imports, it must cascade changes in both trees.  The Descent trees of any Ancestors must be updated*
*recursively and likewise the Ancestry tree of any Descendants*

Starting from a changed target-node:
- Update the Descent value of each of its previous or new immediate ancestors (which may change), changing the record that corresponds to
that ancestor's recognition of the target-node, by either (a) removing the record or (b) updating the record to correspond
to the new Descent value of the target-node
- Recurse on Descent update for each updated ancestor
- Update the Ancestry value of each of its immediate descendants (which will not change), changing the record that corresponds to
that descendants's recognition of the target-node, by updating the record to correspond to the new Ancestry value of the target-node
- Recurse on Ancestry update for each updated descendant

---
---