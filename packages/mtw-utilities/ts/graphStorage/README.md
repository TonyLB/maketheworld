---
---

# Graph Layer

The Graph layer stores a directed graph with table items (Asset or Ephemera, respectively)
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

## Graph Storage

---

*Any graph is stored as a set of Nodes and a set of Edges.*

#### GraphNode

*A Node is a record in the database that indicates that a given resource (Ephemera or Asset) is*
*participating in the GraphStorage system. It tracks no individual information about the resource*
*itself (that will all be tracked under the resource's other keys), just the two caching records*
*to speed up tree traversal.*

```ts
type GraphEdgeTargetEncoded = `${PrimaryKey}::${contextString}` | PrimaryKey
type GraphEdgeEncoded = `${PrimaryKey}::${GraphEdgeTargetEncoded}`
type GraphNodeCache = {
    PrimaryId: PrimaryKey;   // Either: 'EphemeraId: EphemeraKey' or 'AssetId: AssetKey' as needed
    DataCategory: 'Graph::Forward' | 'Graph::Back';
    edgeSet: GraphEdgeTargetEncoded[];
    cache?: GraphEdgeEncoded[];
    cachedAt?: number;       // Epoch Time
    invalidatedAt?: number;  // Epoch Time
    updatedAt?: number;      // Epoch Time
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
    DataCategory: 'Graph::Forward',
    edgeSet: ['COMPUTED#B', 'COMPUTED#C'],
    cache: ['VARIABLE#A::COMPUTED#B', 'VARIABLE#A::COMPUTED#C', 'VARIABLE#B::COMPUTED#D', 'VARIABLE#B::COMPUTED#E', 'VARIABLE#C::COMPUTED#F', 'VARIABLE#C::COMPUTED#G'],
    updatedAt: 9900,
    invalidatedAt: 9900,
    cachedAt: 10000
}
```

...likewise, a backward graph cache from Node D would look like this:

```ts
{
    EphemeraId: 'COMPUTED#A',
    DataCategory: 'Graph::Backward',
    edgeSet: ['COMPUTED#B::'],
    cache: ['COMPUTED#D::COMPUTED#B', 'COMPUTED#B::VARIABLE#A'],
    updateAt: 9900,
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
    DataCategory: `Graph::${GraphEdgeTarget}`;
}
```

Whenever an edge is added, it must be added to the edge-sets of both nodes with an atomic transaction.
Likewise when an edge is removed. If these additions or deletions change the set of direct connections
(i.e., no similar edge exists with a different context) then the GraphNodeCache must have its invalidated
property set to the current EpochTime.

---

### Filter and Restrict

---

The Graph class utility provides two ways to select a sub-graph from an existing graph:
- The **filter** method views the entire graph simultaneously, selecting nodes or edges based upon their
individual qualities.  So you could filter for a sub-graph including only certain nodes (and only the
edges between them).  But you could not effectively filter for only nodes that exist in certain relationships
to each other.
- The **restrict** method is more computationally expensive per node, but selects nodes and edges
using a graph-walk algorithm. So you can restrict a sub-graph to contain only elements that can be reached
from a certain set of root nodes by following edges of a specific context ... and edges later in the graph
that have that context (but cannot be reached exclusively through such edges) would be excluded:  They would
match a filter condition, but are not in the right relationship with other items in the graph to succeed
in a restrict condition.

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
* Whether the sub-node's **invalidatedAt** occurred after the root node's **cachedAt** (and therefore whether
the information beneath that point may differ from the root node's cache)
* Whether the sub-node's **invalidatedAt** occurred after the sub-node's **cachedAt** (and therefore whether
the information in the sub-node's cache is fresh)

With the complete edge-set for all nodes fetched speculatively, the process can double-check the correctness
of the cache:

* First, any edges that point to nodes that *aren't* included in the cache will indicate places where a
further fetch is needed (either because one or more nodes have been invalidated since the root cache was formed,
or because the cache only captured a sub-graph of a particularly large node-set). These further fetches are
performed recursively in the same sequence as the original fetch (check sub-node for valid cache, if cache
available batch-read cache, otherwise batch-read direct edge-set).
* Once there are no *missing* nodes, the node and edge-set is a possible superset of the result set:  The edge
set can be reconstructed, and any nodes that aren't part of a graph-walk can be excluded from the results.

#### Graph Caching

*When a successful fetch is completed, it will be possible to calculate whether the cache needs to be*
*updated with new data. Cache is updated as described in [Graph Caching](./README.caching.md)*

---

### Updates

*When a new edge is added, the following process is executed:*

* Fetch the GraphNodeCache edge-set in the appropriate direction for source and target node (forward for source, backward
for target)
* For each of the edge-sets, if the other end of the edge is not yet represented (with some context) in the edge-set then
the record will be marked for invalidation. If the edge to be added already exists then no update to that edge-set (or
invalidation) will be needed. If the edge exists, but only with a different context, then the edge-set needs update,
but not the **invalidatedAt** property.
* Execute a transaction that (a) adds the GraphEdge record, and (b) executes GraphNodeCache updates as needed

No direct update needs to be made to the GraphNodeCache cache value: It will be refreshed as part of the next fetch
to be executed.

#### Transaction Grouping

*When processing a set of edge updates, multiple edge-updates are likely to share a single node. It is inefficient to*
*process these in separate transactions, as they would interfere with each other and cause massive retries. Instead,*
*updateGraphStore executes grouped transactions, updating a sub-graph and all its nodes and edges simultaneously.*

* First, connected components of the update graph (a bi-directional graph with an edge for each edge update (add or
delete)) are labelled and separated. Any individual component beneath the threshold can be committed in a single
transaction, independent of others, without fear of interference.

*Since transactions have a threshold of number of operations (currently 100), it is possible to receive a component*
*so large that it cannot be committed in a single transaction. To commit such an update:*

* Use a modified Karger-Stein algorithm to iterate randomly toward a "minimum" cut of the component graph into sub-components
beneath the threshold. A true minimum is not needed, obviously, the goal is simply to reduce the complexity of processing
the subsequent update of the min-cut itself to a reasonable amount: Anything much under the total threshold will do.
* Commit the updates of the sub-components independently
* After all sub-component updates are complete, process the update of the edge-set of the cut. Nodes along the border of
the cut will be updated twice (once in their sub-component, and again as part of processing the cut)

---
---