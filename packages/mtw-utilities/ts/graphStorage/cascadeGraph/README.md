---
---

# Cascade Graph

A Cascade Graph is a graph-encoded representation of a cascading data pipeline that changes graph-connected
data in a cascade process.

In concept, this means that the Cascade Graph does the following:
    - Accepts a template telling it how the topology and meta-data of the data
    - Looks at the current state of data node by node and cache it
    - Operate on the nodes in topological sort order, creating a new value from:
        - The result values of any parent nodes
        - The existing value of the current node
    - Cascade that new value forward into the process of child nodes
    - Write changes *through* the cache into the underlying persistent layer

## Template

A Cascade Graph's pipelines are defined by the template passed to it.  Nodes and Edges in the pipeline can
have data associated with them, but they should not prepopulate the working data that will be set as
part of the run itself.

## Working Data

A working graph is in the same topology as the template, but each node has additional data that is side-effected
by the process as it proceeds.

## fetch

The first stage of a cascade is to fetch data on enough starting nodes to begin processing.  The Cascade Graph
has a *fetch* function which takes a list of node keys and returns a list of NodeFetchData records, one for each
key.

## process

The next stage of a cascade is an asynchronous process function run on each node **individually**.
Failure of a process is unrecoverable (so it should handle its own exceptions), since there is no
orchestration for the Cascade Graph system to do in retrying such a function.

If writes back to the persistence layer should happen at each individual node, than persistence
can be addressed at this stage.

## aggregate (optional)

The optional final stage of the cascade is an asynchronous aggregate function that runs on subGraphs of the
working set (split according to a *threshold* function) and operates on many nodes simultaneously.
Failure of an aggregate function can be retried by Cascade Graph:  A failed graph has the *retry*
function executed upon its nodes, and then is started again from a fresh copy of sub-template at the
fetch step (with limits and exponential backoff).

If writes back to the persistence layer can be profitably grouped (so as to prevent delays due to needing
to re-check data that was just written in a previous stage) then it should be done in this stage.

---
---