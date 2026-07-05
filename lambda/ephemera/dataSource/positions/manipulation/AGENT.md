# Positions manipulation

Graph-first **membership transfer** and **host-local relational patch** persist for `mtw.ephemera.positions`: membership routes through a shared adapter -> **`applyHostEffects`** kernel; relational routes through **`applyHostRelationalPatch`**. Per-operator coordinators own fact/cache/bus bundles.

**Status:** Membership transfer and host-local relational patch shipped. See [**AGENT.implementation.md**](AGENT.implementation.md).

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
Per-operator ingress  ->  shared membership adapter  ->  applyHostEffects (kernel)  ->  coordinator fact bundle
```

See [**AGENT.implementation.md --- Target layering**](AGENT.implementation.md#target-layering) for `HostEffect`, apply modes, and `RoomStack` bundling on navigate.
