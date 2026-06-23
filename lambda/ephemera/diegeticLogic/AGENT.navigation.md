# Diegetic logic --- cross-area navigation

Links for how diegetic logic relates to shipped ephemera lanes and authoring. Local entry: [`AGENT.md`](AGENT.md).

---

## Ephemera (runtime)

| Doc / path | Role |
| --- | --- |
| [`../AGENT.concepts.md`](../AGENT.concepts.md) | Cross-cutting concepts index |
| [`../dataSource/positions/AGENT.md`](../dataSource/positions/AGENT.md) | Play manipulation truth (`mtw.ephemera.positions`) |
| [`../dataSource/positions/AGENT.concepts.md`](../dataSource/positions/AGENT.concepts.md) | Graph roles, membership, fractal graphs |
| [`../dataSource/actions/AGENT.md`](../dataSource/actions/AGENT.md) | Command parse, intent streams |
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

## When operators ship

Expect implementation to land primarily under [`../dataSource/positions/`](../dataSource/positions/) (graph mutations), with ingress in [`../dataSource/actions/`](../dataSource/actions/) and presentation specs in [`../dataSource/perception/`](../dataSource/perception/). Update this file as concrete paths appear.

**Shipped (Phase 1--3):** object-manipulation **classify + enrich + resolve + egress** in [`../dataSource/actions/`](../dataSource/actions/) --- **`ObjectManipulationIntent`** classify, [`roomObjectCatalogForCharacter.ts`](../dataSource/actions/roomObjectCatalogForCharacter.ts) (merged-layer catalog), [`enrich/objectManipulation/`](../dataSource/actions/enrich/objectManipulation/) (D17 Bedrock enrich; atomic **`takeHold`** -> grounded **`ObjectManipulation`** -> **`Object Take Hold`** stream); see [`AGENT.implementation.md`](../dataSource/actions/AGENT.implementation.md). **v1 operator:** **`takeHold`** --- pick up removes object from room host graph (positions apply Phase 4). **Positions stub ingress:** [`executeObjectTakeHold`](../dataSource/positions/manipulation/membership/executeObjectTakeHold.ts) wired from **`Object Take Hold`** (no-op until Phase 4). Transcript: Phase 5.
