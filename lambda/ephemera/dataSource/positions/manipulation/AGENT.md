# Positions manipulation

Graph-first **membership transfer** and **host-local relational patch** persist for `mtw.ephemera.positions`: every route (navigate/connect/disconnect, object place/spawn/destroy/edit, take-hold/drop, establish/dissolve) now goes through a shared adapter -> **`kernel/commitStepSequence.ts`** (`applyHostEffects`/`applyHostRelationalPatch` retired 2026-07-23). Per-operator coordinators own fact/cache/bus bundles.

**Status:** Membership transfer and host-local relational patch shipped. See [**AGENT.implementation.md**](AGENT.implementation.md). **All routes migrated onto one general kernel entrypoint (`kernel/commitStepSequence.ts`) as of 2026-07-23** (take-hold/drop/establish/dissolve, then object-lifecycle, then character navigate/connect/disconnect last) --- see the implementation doc's status note; the executor/kernel's own design rationale lives in `kernel/`'s and `enrich/objectManipulation/synthesize/`'s doc comments, and the migration's decision history is preserved in git (the task plan that tracked it, `AGENT.synthesizeStepSequencing.planning.md`, is retired).

## Documentation

| Doc | Role |
| --- | --- |
| [**AGENT.implementation.md**](AGENT.implementation.md) | Kernel + shared adapter spec, compose rules, migration map, code paths |
| [`../AGENT.contract.md`](../AGENT.contract.md) | Shipped normative rules (parent positions package) |
| [`../AGENT.concepts.md`](../AGENT.concepts.md) | Mental models: membership, eviction ladder, graph roles |
| [`../../actions/AGENT.implementation.md`](../../actions/AGENT.implementation.md) | Object manipulation parse steady-state; atomic operator egress playbook |
| [`../../diegeticLogic/AGENT.operators.concepts.md`](../../diegeticLogic/AGENT.operators.concepts.md) | Shipped operator fiction (`takeHold`, `drop`, `establishRelation`, `dissolveRelation`) |

## Layering (steady state)

```text
Per-operator ingress  ->  shared membership adapter  ->  commitStepSequence (kernel)  ->  coordinator fact bundle
```

See [**AGENT.implementation.md --- Target layering**](AGENT.implementation.md#target-layering) for `KernelStep`, apply modes, and `RoomStack` bundling on navigate.
