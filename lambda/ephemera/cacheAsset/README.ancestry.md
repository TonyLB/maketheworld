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

```ts
export type DependencyNode = {
    tag: 'Asset' | 'Variable' | 'Computed' | 'Room' | 'Feature' | 'Map'
    key: string; // The key name by which children nodes know this parent
    EphemeraId: string;
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
        key: 'TownSquare',
        EphemeraId: 'ASSET#TownSquare',
        connections: [{
            tag: 'Asset',
            key: 'City',
            EphemeraId: 'ASSET#City',
            connections: []
        }]
    },
    {
        tag: 'Asset',
        key: 'UnderCroft',
        EphemeraId: 'ASSET#UnderCroft',
        connections: [{
            tag: 'Asset',
            key: 'Sewer',
            EphemeraId: 'ASSET#Sewer',
            connections: [{
                tag: 'Asset',
                key: 'City',
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
        key: 'TownSquare',
        EphemeraId: 'ASSET#TownSquare',
        connections: [{
            tag: 'Asset',
            key: 'Cathedral',
            EphemeraId: 'ASSET#Cathedral',
            connections: []
        }]
    },
    {
        tag: 'Asset',
        key: 'Sewer',
        EphemeraId: 'ASSET#Sewer',
        connections: [{
            tag: 'Asset',
            key: 'UnderCroft',
            EphemeraId: 'ASSET#UnderCroft',
            connections: [{
                tag: 'Asset',
                key: 'Cathedral',
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