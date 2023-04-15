---
---

# Graph Layer

The Graph layer stores a (?) directed graph with table items (Asset or Ephemera, respectively)
as its nodes. This facilitates storing and querying the relationships between items, and (especially)
querying on extended paths (a feature reached by looking at another feature which is in turn visible
within a room).

Because the graph is universally directed, each node has two distinct sub-graphs that can be derived
from it: An Ancestry graph that is derived by recursively following all links in the direction From-To,
and a Descent graph that is derived by recursively following all links in the reverse direction To-From.
Ancestry information is useful for deriving the entire behavior of an asset (including everything it
inherits). Descent information is useful for updating and rerendering assets in response to a change in an
asset from which they inherit, for updating computed items that depend upon variable values, and for
aggregating information for an entire tree of containers.

Graph relationships are stored for anything that can depend upon another item, or be depended upon in turn:
- Assets
- Variables (can only have Assets as Ancestors, and most anything as Descendants)
- Computed
- Room (can have state variables as Ancestors, and Maps as Descendants)
- Feature (can only have other Features as Descendants, can include cyclic loops)
- Map (can only have Ancestors)

![MTW Graphs](images/mtwGraphs.jpg)

---

## Needs Addressed

- Needs to start from an Asset that needs to be cached, and know what ancestors need to be cached
*first* (and in what order) to make it valid
- Needs to start from a variable that has been changed (e.g. by an action) and cascade forward
those changes to any Computed fields, as well as deliver rerenders of any impacted Rooms and Maps.
- Needs to be able to maintain the interconnected tree consistently as new dependent items are
added, removed, or their connections updated

---

## Tree Storage (Current)

---

*Any tree is stored as a set of Nodes, each with zero or more Edges.  An Edge is a connection*
*between the source node (that it's defined on) and a target node ... optionally with a name*
*remapping key assigned to the operation.*

*For ***internally stored*** trees, we also have to account for the possibility of incomplete*
*information (i.e. the instance of the app knows some truths but not all).  Therefore there is*
*an optional 'completeness' property on the nodes, for internal use only.*

*Each edge also keeps a list of assets that have registered the connection ... when the last*
*is decached, the edge is removed. Edges are considered the "same" edge (for purposes of*
*aggregating the assets list) if (a) they have the same EphemeraId, and (b) they either both*
*have no key, or both have the same key.*

```ts
export type DependencyEdge = {
    EphemeraId: string;
    assets: string[];
    key?: string;
}

export type DependencyNode = {
    EphemeraId: string; // Each EphemeraId must begin with a legal tag:  VARIABLE, COMPUTED, FEATURE, ROOM or MAP
    connections: DependencyEdge[];
    completeness?: string;
}
```

---

## Ancestry

*Each relevant record will have an Ancestry field which stores a list of DependencyNodes for all*
*nodes in the ancestry tree starting with the record itself and stretching back to everything*
*that it depends upon or imports.*

***Example***

```ts
    const CathedralAncestry = [
        {
            EphemeraId: 'ROOM#Cathedral',
            connections: [
                { 
                    EphemeraId: 'COMPUTED#lightsOn',
                    assets: ['base']
                }
            ]
        },
        {
            EphemeraId: 'COMPUTED#lightsOn',
            connections: [
                {
                    EphemeraId: 'VARIABLE#power',
                    key: 'powerOn',
                    assets: ['base']
                },
                {
                    EphemeraId: 'VARIABLE#switchOn',
                    assets: ['base']
                }
            ]
        },
        {
            EphemeraId: 'VARIABLE#power',
            connections: []
        },
        {
            EphemeraId: 'VARIABLE#switchOn',
            connections: []
        }
    ]
```

This indicates that the room object for *Cathedral* depends (for its state as defined in base) upon the
computed value *lightsOn*, which in turn depends (again in base) upon the variables *power* (renamed in
the Compute dependency as 'powerOn') and *switchOn*.

---

## Descent

*Each **Meta::Asset** record will have a Descent field which stores a tree that indicates the dependency relationships*
*starting at that asset and stretching forward to descendant importing assets.*

***Example***

```ts
    const PowerDescent = [
        {
            EphemeraId: 'VARIABLE#power',
            connections: [{
                EphemeraId: 'COMPUTED#lightsOn',
                key: 'powerOn',
                assets: ['base']
            }]
        },
        {
            EphemeraId: 'COMPUTED#lightsOn',
            connections: [
                {
                    EphemeraId: 'ROOM#Cathedral',
                    assets: ['base']
                },
                {
                    EphemeraId: 'ROOM#Graveyard',
                    assets: ['halloween']
                }
            ]
        },
        {
            EphemeraId: 'ROOM#Cathedral',
            connections: []
        },
        {
            EphemeraId: 'ROOM#Graveyard',
            connections: []
        }
    ]
```

This indicates the mathematical inverse of the Ancestry map, above:  This is a map of the descendants of the *power*
Variable, indicating that it is referenced by the *lightsOn* Compute (renaming it during that reference to 'powerOn').
The *lightsOn* Compute is referenced by the *Cathedral* room in the base asset, and is referenced separately by the
*Graveyard* room in the halloween asset.

---

## Tree Storage (New)

---

*Any tree is stored as a set of Nodes and a set of Edges.  An Edge is a connection*
*between the source node (that it's defined on) and a target node ... optionally with a name*
*remapping key assigned to the operation, and context information about the nature of the*
*edge. Two nodes may have multiple similarly-directed edges between them, if those edges have*
*different context information.*

*A tree is stored in the database partitioned by its Nodes: Each node contains two edge-set*
*properties, which contain a non-sorted set (childEdges) of the edges for which the node is*
*a source, and another non-sorted set (parentEdges) of the edges for which the node is a target.*

```ts
type DependencyEdge = {
    source: EphemeraKey;
    target: EphemeraKey;
    context: string;
}
type DependencyAncestorKey = `${EphemeraKey}::${DependencyContext}`
type DependencyDescendantKey = `${EphemeraKey}::${DependencyContext}`
const unpackAncestorEdge = (baseNode: DependencyNode, edgeKey: DependencyAncestorKey): DependencyEdge => {
    return {
        target: baseNode.EphemeraId,
        source: edgeKey.split('::')[0],
        context: edgeKey.split('::')[1]
    }
}
const unpackDescendantEdge = (baseNode: DependencyNode, edgeKey: DependencyDescendantKey): DependencyEdge => {
    return {
        source: baseNode.EphemeraId,
        target: edgeKey.split('::')[0],
        context: edgeKey.split('::')[1]
    }
}

type DependencyNode = {
    EphemeraId: EphemeraKey;
    childEdges: DependencyAncestorKey[];
    parentEdges: DependencyDescendantKey[];
}
```

Whenever an edge is added, it must be added to both nodes with an atomic transaction. Likewise when an edge is
removed.

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