# Positions manipulation

Graph-first **membership transfer** and **host-local relational patch** persist for `mtw.ephemera.positions`. Every route --- navigate/connect/disconnect, object place/spawn/destroy/edit/drift-repair, take-hold/drop, establish/dissolve --- expresses its mutation as an ordered step sequence and commits through one kernel entrypoint, **`kernel/commitStepSequence.ts`**. Per-operator coordinators own ingress shape and the fact/cache/bus bundle.

Step sequences are planned either by the shared membership adapter (`adapters/`, for the routes with fixed room-host targets) or by the Synthesize executor re-run at execute time (for the player commands that need live grounding). The kernel's own design rationale lives in `kernel/`'s doc comments and in `enrich/objectManipulation/synthesize/`'s.

## Two kernels over one step list

`kernel/` holds **two** kernels that filter the same `KernelStep[]`: the **mutation** kernel runs inside the transaction (`commitStepSequence`), and the **presentation** kernel runs after it commits (`presentStepSequence`, with a describe branch and a narrate branch). Call sites do not build either list by hand --- they emit an abstract op and `kernel/compile/` expands it.

**Captured rosters are load-bearing, not diagnostics.** A `capture` step snapshots one host's occupants mid-walk, and that snapshot **is** the audience the narration is delivered to --- not a debug record of it, and not an optimization over reading the roster later. Reading "capture channel" as instrumentation and pruning it as dead weight breaks narration outright: the audience for "Tess left" has to be who was standing in the room *at that beat*, and after the commit she is no longer in that room's graph to be found.

## Documentation

| Doc | Role |
| --- | --- |
| [**AGENT.implementation.md**](AGENT.implementation.md) | Kernel + shared adapter spec, compose rules, per-route ingress map, code paths |
| [`../AGENT.contract.md`](../AGENT.contract.md) | Shipped normative rules (parent positions package) |
| [`../AGENT.concepts.md`](../AGENT.concepts.md) | Mental models: membership, eviction ladder, graph roles |
| [`../../actions/AGENT.implementation.md`](../../actions/AGENT.implementation.md) | Object manipulation parse steady-state; atomic operator egress playbook |
| [`../../../diegeticLogic/AGENT.operators.concepts.md`](../../../diegeticLogic/AGENT.operators.concepts.md) | Shipped operator fiction (`takeHold`, `drop`, `establishRelation`, `dissolveRelation`) |

## Layering

```text
Per-operator ingress  ->  shared membership adapter  ->  commitStepSequence (kernel)  ->  coordinator fact bundle
```

See [**AGENT.implementation.md --- Target layering**](AGENT.implementation.md#target-layering) for `KernelStep`, apply modes, and `RoomStack` bundling on navigate.
