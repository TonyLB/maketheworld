# Diegetic logic --- cross-area navigation

Links for how diegetic logic relates to shipped ephemera lanes and authoring. Local entry: [`AGENT.md`](AGENT.md).

---

## Ephemera (runtime)

| Doc / path | Role |
| --- | --- |
| [`../AGENT.concepts.md`](../AGENT.concepts.md) | Cross-cutting concepts index |
| [`AGENT.implementation.md`](AGENT.implementation.md) | Four-lane hub + follow-on operators |
| [`AGENT.operators.concepts.md`](AGENT.operators.concepts.md) | Operator fiction (`takeHold`, `drop`) |
| [`../dataSource/positions/AGENT.md`](../dataSource/positions/AGENT.md) | Play manipulation truth (`mtw.ephemera.positions`) |
| [`../dataSource/positions/AGENT.concepts.md`](../dataSource/positions/AGENT.concepts.md) | Graph roles, membership, fractal graphs |
| [`../dataSource/positions/AGENT.implementation.md`](../dataSource/positions/AGENT.implementation.md) | Cross-host apply coordinator playbook |
| [`../dataSource/actions/AGENT.md`](../dataSource/actions/AGENT.md) | Command parse, intent streams |
| [`../dataSource/actions/AGENT.implementation.md`](../dataSource/actions/AGENT.implementation.md) | Atomic manipulation operator playbook |
| [`../dataSource/perception/AGENT.md`](../dataSource/perception/AGENT.md) | Audience bridge, fan-in, `PublishMessage` |
| [`../dataSource/objects/AGENT.md`](../dataSource/objects/AGENT.md) | Improvisation existence vs positions placement |
| [`../AGENT.narrativeTranscript.concepts.md`](../AGENT.narrativeTranscript.concepts.md) | Fictional transcript ordering |
| [`../AGENT.multiChannel.concepts.md`](../AGENT.multiChannel.concepts.md) | Room-render vs affordances composition |

---

## WML / assets (authored)

| Doc | Role |
| --- | --- |
| [`../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md`](../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) | Area `positionGraph` Exit edges |
| [`../../../packages/mtw-wml/ts/standardize/components/AGENT.md`](../../../packages/mtw-wml/ts/standardize/components/AGENT.md) | `StandardPositionGraph`, Area / Room components |

---

## Shipped: object manipulation (`takeHold`, `drop`)

**Pick up (`takeHold`):** **`ObjectManipulationIntent`** classify -> [`roomObjectCatalogForCharacter.ts`](../dataSource/actions/roomObjectCatalogForCharacter.ts) -> [`enrich/objectManipulation/`](../dataSource/actions/enrich/objectManipulation/) -> **`Object Take Hold`** -> [`applyObjectTakeHold`](../dataSource/positions/manipulation/membership/applyObjectTakeHold.ts) -> [`objectManipulationPresentationFanIn.ts`](../dataSource/perception/objectManipulationPresentationFanIn.ts) -> single-line **`WorldMessage`**.

**Drop (`drop`):** **`ObjectManipulationIntent`** classify (room + held labels) -> [`heldInventoryCatalogForCharacter.ts`](../dataSource/actions/heldInventoryCatalogForCharacter.ts) -> [`enrich/objectManipulation/`](../dataSource/actions/enrich/objectManipulation/) -> **`Object Drop`** -> [`applyObjectDrop`](../dataSource/positions/manipulation/membership/applyObjectDrop.ts) -> [`objectManipulationPresentationFanIn.ts`](../dataSource/perception/objectManipulationPresentationFanIn.ts) -> single-line **`WorldMessage`**.

**v1 operators:** **`takeHold`** --- atomic room-remove + character-add; **`drop`** --- atomic character-remove + room-add. See [`AGENT.operators.concepts.md`](AGENT.operators.concepts.md).
