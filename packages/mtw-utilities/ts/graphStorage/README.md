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

### Source of Truth storage

*Any tree is stored as a set of Nodes and a set of Edges.*

#### GraphNode

*A Node is a record in the database that indicates that a given resource (Ephemera or Asset) is*
*participating in the GraphStorage system. It tracks no individual information about the resource*
*itself (that will all be tracked under the resource's other keys), just the two caching records*
*to speed up tree traversal.*

```ts
type GraphNodeCache = {
    PrimaryId: PrimaryKey;   // Either: 'EphemeraId: EphemeraKey' or 'AssetId: AssetKey' as needed
    DataCategory: 'GRAPH::Forward' | 'GRAPH::Back';
    edgeSet: `${PrimaryKey}::${contextString}`[];
    cache?: PrimaryKey[];
    cachedAt?: number;       // Epoch Time
    invalidatedAt?: number;  // Epoch Time
}
```

Example:

Suppose a genuine source of truth in the Ephemera table that has the following structure (with no context on edges),
where node A is a Variable, and all others are Computed:
    - Node A has children B and C,
    - Node B has children D and E,
    - Node C has children F and G

If Node A has had its Forward GraphNodeCache invalidated at 9900 Epoch Time, and cached at 10000, it
would look like this:

```ts
{
    EphemeraId: 'VARIABLE#A',
    DataCategory: 'GRAPH::Forward',
    edgeSet: ['COMPUTED#B::', 'COMPUTED#C::'],
    cache: ['COMPUTED#B', 'COMPUTED#C', 'COMPUTED#D', 'COMPUTED#E', 'COMPUTED#F', 'COMPUTED#G'],
    invalidatedAt: 9900,
    cachedAt: 10000
}
```

...likewise, a backward graph cache from Node D would look like this:

```ts
{
    EphemeraId: 'COMPUTED#A',
    DataCategory: 'GRAPH::Backward',
    edgeSet: ['COMPUTED#B::'],
    cache: ['COMPUTED#B', 'VARIABLE#A'],
    invalidatedAt: 9900,
    cachedAt: 10000
}
```

#### GraphEdge

*An Edge is a connection between the source node (that it's defined on) and a target node, with*
*context information about the nature of the edge. Two nodes may have multiple similarly-directed*
*edges between them, if those edges have different context information.*

```ts
type GraphEdge = {
    PrimaryId: PrimaryKey;
    DataCategory: `GRAPH::${PrimaryKey}::${contextString}`;
}
```

Whenever an edge is added, it must be added to the edge-sets of both nodes with an atomic transaction.
Likewise when an edge is removed. If these additions or deletions change the set of direct connections
(i.e., no similar edge exists with a different context) then the GraphNodeCache must have its invalidated
property set to the current EpochTime.

---

### Graph Fetching

*Fetching parses the Graph from the point of view of a given Node (termed the Root node) and direction (Forward or Backward),*
*returning a directed, possibly cyclic, sub-Graph. The return value of a fetch is a set of nodes and either*
*(a) the target and context information only for each edge, or (b) all information for each edge.*

#### Uncached recursive fetching

*When a root node has no cache record in the given direction, the system must revert*
*to recursive fetching. This is a slow one-time construction of a tree (since it can have an unbounded*
*number of back-and-forths between the process and the DB): The root node's edge-set is used to*
*execute a one-level batchGet for all directly connected Edges and their nodes. Then a fetch is called*
*recursively on each of those nodes as well.*

#### Cached speculative fetching

*When a root node has a cache record in the given direction, and the **cachedAt** value for the root node*
*is more recent than the **invalidatedAt** value, that cache record is used to speculatively fetch data*
*for all nodes in the cache. After that initial batchGet, GraphStorage will know the following*
*about the nodes from the cache:*

* The edge-set of each node
* The cache of each sub-node
* Whether the node's **invalidatedAt** occurred after the node's **cachedAt** (and therefore)

With the complete edge-set for all nodes fetched speculatively, the process can double-check the correctness
of the cache:

* First, any edges that point to nodes that *aren't* included in the cache will indicate places where a
further fetch is needed (either because one or more nodes have been invalidated since the root cache was formed,
or because the cache only captured a sub-graph of a particularly large node-set). These further fetches are
performed recursively (hopefully by accessing another valid cache somewhere in the branch being considered).
* Once there are no *missing* nodes, the node and edge-set is a possible superset of the result set:  The edge
set can be reconstructed, and any nodes that aren't part of a graph-walk can be excluded from the results.

#### Tree Caching

*When a successful fetch is completed, it will be possible to calculate whether the cache needs to be*
*updated with new data. Cache is updated as follows:*

* The graph results are walked breadth-first (modified Dijkstra algorithm) until either (a) the whole sub-graph
has been walked, or (b) the number of distinct nodes has passed the threshold of what the system is comfortable
batchGetting at once (current limits are no more than 16MB total, and no more than 100 items, but those limits
increase from time to time). The last full level of breadth-first scanning before the threshold is cached.
* If the limited graph results are not identical to the cache then this node is a candidate for a cache update.
* The cache is replaced with the new limited set of nodes, conditioned on both the **invalidatedAt** and **cachedAt**
values not having changed since the fetch started. If either of those values have changed, the cache is not
updated in this cycle. **cachedAt** is updated to the epoch time as part of this update.

Example:

Suppose a genuine source of truth that has the following structure:
    - Node A has children B and C,
    - Node B has children D and E,
    - Node C has children F and G

Suppose further that the threshold for nodes in the cache is five, and NodeA has a forward cache with the following nodes:
['A', 'B', 'D', 'E']

Walking the fetched edge-set would return 'A' in the first level, 'B' and 'C' in the second, and 'D', 'E', 'F', and 'G' in
the third. Two levels of the graph contain three nodes, while three levels contain seven (greater than the treshold), so
only two will be cached. The two-level cache nodes are ['A', 'B', 'C'], which is not the same set as ['A', 'B', 'D', 'E'],
so this is a candidate for cache update.

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