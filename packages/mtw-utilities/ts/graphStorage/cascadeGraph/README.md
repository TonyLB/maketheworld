---
---

# Cascade Graph

A Cascade Graph is a graph-encoded representation of a cascading data pipeline ... one which conceptually
operates on successive generations of nodes to transform and side-effect them, then uses the results of
that to inform the processing of the next generation (i.e., children know the results of their parents).

## Template

A Cascade Graph's pipelines are defined by the template passed to it.  Nodes and Edges in the pipeline can
have data associated with them, but they should not prepopulate the working data that will be set as
part of the run itself.

## Working Data

A working graph is in the same topology as the template, but each node has additional data that is side-effected
by the process as it proceeds.

## preProcess

The first stage of a cascade is an asynchronous preProcess function run on each node **individually**.
Failure of a preProcess is unrecoverable (so it should handle its own exceptions), since there is no
orchestration for the Cascade Graph system to do in retrying such a function.

## aggregate (optional)

The second stage of the cascade is an asynchronous aggregate function that runs on subGraphs of the
working set (split according to a *threshold* function) and operates on many nodes simultaneously.
Failure of an aggregate function can be retried by Cascade Graph:  A failed graph has the *retry*
function executed upon its nodes, and then is started again from a fresh copy of template at the
preProcess step (with limits and exponential backoff).

---
---