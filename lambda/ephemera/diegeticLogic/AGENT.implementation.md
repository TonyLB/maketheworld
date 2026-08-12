# Diegetic logic --- implementation hub

Cross-lane index for **atomic position-manipulation** operators (membership transfer and in-host relational edges). Operator fiction and transcript obligations: [`AGENT.operators.concepts.md`](AGENT.operators.concepts.md). This file links lane playbooks --- it does not duplicate full pipeline prose.

**Reference verticals:** **`takeHold`** (pick up) for membership transfer; **`establishRelation`** for in-host relational edges. **`drop`** reuses the membership skeleton with inverted host direction. **Navigate** remains the membership fan-in reference for character moves.

---

## Four-lane pipeline (`takeHold`)

```text
Parse Requested
  -> ObjectMembershipIntent (classify; movementObjectLabels)
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
  -> ObjectMembershipIntent (classify; movementObjectLabels = room + held)
  -> enrich objectManipulation (held-catalog identity -> membership -> complexity pre-gates)
  -> streamEvent intent (Object Drop)
  -> positions apply (character-remove + room-add)
  -> streamEvent fact (Object Moved; froms character, to room)
  -> perception fan-in (intent + fact -> WorldMessage template)
  -> affordance refresh (existing Object Moved path)
```

Later atomics reuse the **same classify intent families** (`ObjectMembershipIntent` or **`ObjectRelateIntent`**) and enrich paths; they differ by **`operationKind`**, catalog source, stream intent type, apply coordinator, and transcript template.

## Four-lane pipeline (`establishRelation`)

```text
Parse Requested
  -> ObjectRelateIntent (classify; movementObjectLabels)
  -> enrich objectManipulation (frame extract -> normalizeRelationSpan -> compileRelational)
  -> streamEvent intent (Object Establish Relation)
  -> positions apply (host-local edge add via applyHostRelationalPatch)
  -> streamEvent fact (Object Relation Changed; operation establish)
  -> perception fan-in (intent + fact -> WorldMessage template)
  -> affordance refresh (RoomUpdate on host room)
```

---

## Lane playbooks

| Lane | Playbook | Shipped entry points |
| --- | --- | --- |
| **actions** | [Adding an atomic position-manipulation operator](../dataSource/actions/AGENT.implementation.md#adding-an-atomic-position-manipulation-operator) (membership); [Adding a host-local relational operator](../dataSource/actions/AGENT.implementation.md#adding-a-host-local-relational-operator) (relational) | [`enrich/objectManipulation/`](../dataSource/actions/enrich/objectManipulation/), [`publishedEvents.ts`](../dataSource/actions/publishedEvents.ts) |
| **positions** | [Adding a cross-host manipulation apply coordinator](../dataSource/positions/AGENT.implementation.md#adding-a-cross-host-manipulation-apply-coordinator) (membership); [`manipulation/relational/`](../dataSource/positions/manipulation/relational/) (relational) | [`orchestrateObjectMove.ts`](../dataSource/positions/manipulation/membership/orchestrateObjectMove.ts) (both `takeHold` and `drop` --- one entry point taking a host pair), [`executeObjectEstablishRelation.ts`](../dataSource/positions/manipulation/relational/executeObjectEstablishRelation.ts), [`executeObjectDissolveRelation.ts`](../dataSource/positions/manipulation/relational/executeObjectDissolveRelation.ts) |
| **perception** | [Adding manipulation transcript operators](../dataSource/perception/AGENT.md#adding-manipulation-transcript-operators) | [`objectManipulationPresentationFanIn.ts`](../dataSource/perception/objectManipulationPresentationFanIn.ts) |
| **diegeticLogic** | [`AGENT.operators.concepts.md`](AGENT.operators.concepts.md) | **`takeHold`**, **`drop`**, **`establishRelation`**, **`dissolveRelation`** fiction + unknowns withhold |

Normative contracts: [`../dataSource/positions/AGENT.contract.md`](../dataSource/positions/AGENT.contract.md) (**`Object Moved`**, **`Object Take Hold`**, **`Object Drop`**, **`Object Establish Relation`**, **`Object Dissolve Relation`**, **`Object Relation Changed`** ingress).

---

## Follow-on operators

| Operator | Status | Host direction | Notes |
| --- | --- | --- | --- |
| **`takeHold`** | Shipped | room -> character | v1 reference vertical |
| **`drop`** | Shipped | character -> room | Symmetric delta; held-catalog at classify/enrich |
| Relational attach (`establishRelation` / `dissolveRelation`) | Shipped (Phase B) | in-host edge on room **`ludicGraph`** | Parse -> actions stream -> positions apply -> perception fan-in; operator fiction in [`AGENT.operators.concepts.md`](AGENT.operators.concepts.md) |

---

## Reference files (end-to-end)

Classify: [`buildIntentClassificationPrompt.ts`](../dataSource/actions/discriminateIntent/buildIntentClassificationPrompt.ts), [`roomObjectLabelsForCharacter.ts`](../dataSource/actions/roomObjectLabelsForCharacter.ts).

Enrich: [`roomObjectCatalogForCharacter.ts`](../dataSource/actions/roomObjectCatalogForCharacter.ts), [`heldInventoryCatalogForCharacter.ts`](../dataSource/actions/heldInventoryCatalogForCharacter.ts), [`enrich/objectManipulation/`](../dataSource/actions/enrich/objectManipulation/).

Apply: [`executeObjectMove.ts`](../dataSource/positions/manipulation/membership/executeObjectMove.ts) (both move directions), [`applyObjectRelationalChange.ts`](../dataSource/positions/manipulation/relational/applyObjectRelationalChange.ts), [`buildObjectMovedFact.ts`](../dataSource/positions/membership/buildObjectMovedFact.ts).

Transcript: [`objectManipulationPresentationLegAdapters.ts`](../dataSource/perception/objectManipulationPresentationLegAdapters.ts), [`publishObjectManipulationPresentation.ts`](../dataSource/perception/publishObjectManipulationPresentation.ts).

Cross-area links: [`AGENT.navigation.md`](AGENT.navigation.md).
