# Positions manipulation

Graph-first **membership transfer** persist for `mtw.ephemera.positions`: a shared membership adapter plans `froms`/`to` into **`HostEffect[]`**, a manipulation kernel validates and transacts on affected hosts only, and per-operator coordinators own fact/cache/bus bundles. Operator ingress stays membership-shaped; **`HostEffect[]`** is the adapter -> kernel contract.

**Status:** Phase 2 spec complete. Expedient persist paths in [`membership/`](../membership/) and [`manipulation/membership/`](membership/) remain authoritative until Phase 4b migration. Task plan: [`taskPlanning/.../AGENT.manipulationModel.planning.md`](../../../../../taskPlanning/lambda/ephemera/dataSource/positions/manipulation/AGENT.manipulationModel.planning.md).

## Documentation

| Doc | Role |
| --- | --- |
| [**AGENT.implementation.md**](AGENT.implementation.md) | Kernel + shared adapter spec, compose rules, migration map, code paths |
| [`../AGENT.contract.md`](../AGENT.contract.md) | Shipped normative rules (parent positions package) |
| [`../AGENT.concepts.md`](../AGENT.concepts.md) | Mental models: membership, eviction ladder, graph roles |
| [`../../actions/AGENT.implementation.md`](../../actions/AGENT.implementation.md) | Object manipulation parse steady-state; atomic operator egress playbook |
| [`../../diegeticLogic/AGENT.operators.concepts.md`](../../diegeticLogic/AGENT.operators.concepts.md) | Shipped operator fiction (`takeHold`, etc.) |

## Layering (steady state)

```text
Per-operator ingress  ->  shared membership adapter  ->  applyHostEffects (kernel)  ->  coordinator fact bundle
```

See [**AGENT.implementation.md --- Target layering**](AGENT.implementation.md#target-layering) for `HostEffect`, apply modes, and `RoomStack` bundling on navigate.
