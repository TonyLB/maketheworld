# Diegetic logic --- implementation hub

Cross-lane index for **atomic position-manipulation** operators. Operator fiction and transcript obligations: [`AGENT.operators.concepts.md`](AGENT.operators.concepts.md). This file links lane playbooks --- it does not duplicate full pipeline prose.

**Reference vertical:** **`takeHold`** (pick up). **`drop`** (release to room) reuses the same four-lane skeleton with inverted host direction, held catalog at classify/enrich, and **`Object Drop`** egress. **Navigate** remains the membership fan-in reference for character moves.

---

## Four-lane pipeline (`takeHold`)

```text
Parse Requested
  -> ObjectManipulationIntent (classify; movementObjectLabels)
  -> enrich objectManipulation (cardinality gate -> identity -> membership -> complexity pre-gates)
  -> streamEvent intent (Object Take Hold)
  -> positions apply (room-remove + character-add)
  -> streamEvent fact (Object Moved; froms room, to character)
  -> perception fan-in (intent + fact -> WorldMessage template)
  -> affordance refresh (existing Object Moved path)
```

## Four-lane pipeline (`drop`)

```text
Parse Requested
  -> ObjectManipulationIntent (classify; movementObjectLabels = room + held)
  -> enrich objectManipulation (held-catalog identity -> membership -> complexity pre-gates)
  -> streamEvent intent (Object Drop)
  -> positions apply (character-remove + room-add)
  -> streamEvent fact (Object Moved; froms character, to room)
  -> perception fan-in (intent + fact -> WorldMessage template)
  -> affordance refresh (existing Object Moved path)
```

Later atomics reuse the **same intent family** at classify and enrich; they differ by **`operationKind`**, catalog source, stream intent type, apply coordinator, and transcript template.

---

## Lane playbooks

| Lane | Playbook | Shipped entry points |
| --- | --- | --- |
| **actions** | [Adding an atomic position-manipulation operator](../dataSource/actions/AGENT.implementation.md#adding-an-atomic-position-manipulation-operator) | [`enrich/objectManipulation/`](../dataSource/actions/enrich/objectManipulation/), [`publishedEvents.ts`](../dataSource/actions/publishedEvents.ts) |
| **positions** | [Adding a cross-host manipulation apply coordinator](../dataSource/positions/AGENT.implementation.md#adding-a-cross-host-manipulation-apply-coordinator) | [`executeObjectTakeHold.ts`](../dataSource/positions/manipulation/membership/executeObjectTakeHold.ts), [`executeObjectDrop.ts`](../dataSource/positions/manipulation/membership/executeObjectDrop.ts) |
| **perception** | [Adding manipulation transcript operators](../dataSource/perception/AGENT.md#adding-manipulation-transcript-operators) | [`objectManipulationPresentationFanIn.ts`](../dataSource/perception/objectManipulationPresentationFanIn.ts) |
| **diegeticLogic** | [`AGENT.operators.concepts.md`](AGENT.operators.concepts.md) | **`takeHold`** + **`drop`** fiction + unknowns withhold |

Normative contracts: [`../dataSource/positions/AGENT.contract.md`](../dataSource/positions/AGENT.contract.md) (**`Object Moved`**, **`Object Take Hold`**, **`Object Drop`** ingress).

---

## Follow-on operators

| Operator | Status | Host direction | Notes |
| --- | --- | --- | --- |
| **`takeHold`** | Shipped | room -> character | v1 reference vertical |
| **`drop`** | Shipped | character -> room | Symmetric delta; held-catalog at classify/enrich |
| Relational attach (`put X on Y`, nested hosts) | Out of scope | varies | Terminal **`Error`** / **`relationalPlacement`** at complexity stage; no stream in v1. Persist stub: [`manipulation/AGENT.implementation.md`](../dataSource/positions/manipulation/AGENT.implementation.md#future-host-local-relational-patch-m4-stub-slice-5) |

---

## Reference files (end-to-end)

Classify: [`buildIntentClassificationPrompt.ts`](../dataSource/actions/discriminateIntent/buildIntentClassificationPrompt.ts), [`roomObjectLabelsForCharacter.ts`](../dataSource/actions/roomObjectLabelsForCharacter.ts).

Enrich: [`roomObjectCatalogForCharacter.ts`](../dataSource/actions/roomObjectCatalogForCharacter.ts), [`heldInventoryCatalogForCharacter.ts`](../dataSource/actions/heldInventoryCatalogForCharacter.ts), [`enrich/objectManipulation/`](../dataSource/actions/enrich/objectManipulation/).

Apply: [`applyObjectTakeHold.ts`](../dataSource/positions/manipulation/membership/applyObjectTakeHold.ts), [`applyObjectDrop.ts`](../dataSource/positions/manipulation/membership/applyObjectDrop.ts), [`buildObjectMovedFact.ts`](../dataSource/positions/membership/buildObjectMovedFact.ts).

Transcript: [`objectManipulationPresentationLegAdapters.ts`](../dataSource/perception/objectManipulationPresentationLegAdapters.ts), [`publishObjectManipulationPresentation.ts`](../dataSource/perception/publishObjectManipulationPresentation.ts).

Cross-area links: [`AGENT.navigation.md`](AGENT.navigation.md).
