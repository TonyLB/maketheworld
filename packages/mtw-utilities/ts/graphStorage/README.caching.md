---
---

# Graph Caching

---

*When a successful graph fetch is completed, it will be possible to calculate whether the cache of*
*any node that has been examined needs to be updated with new data. Cache is updated as follows:*

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
---