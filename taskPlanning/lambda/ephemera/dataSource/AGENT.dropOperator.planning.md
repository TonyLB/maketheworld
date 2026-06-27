# Atomic `drop` operator (cross-lane)

**Status:** In progress. **Next:** Phase 2 positions durable docs (graduate deferred clauses).

**Delete criterion:** When **`drop`** is shipped end-to-end (parse egress, positions apply, perception transcript), durable docs are graduated, and verification passes --- delete this plan (git retains history).

Framework: [`taskPlanning/AGENT.md`](../../../AGENT.md). Steady-state architecture and lane playbooks live in package `AGENT*.md` files --- link, do not duplicate.

---

## Purpose

Ship the **`drop`** atomic position-manipulation operator: character inventory -> current room membership graph, symmetric to shipped **`takeHold`**.

Reuse the four-lane playbook established for **`takeHold`**:

| Lane | Playbook |
| --- | --- |
| Hub | [`lambda/ephemera/diegeticLogic/AGENT.implementation.md`](../../../../lambda/ephemera/diegeticLogic/AGENT.implementation.md) |
| **actions** | [Adding an atomic position-manipulation operator](../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md#adding-an-atomic-position-manipulation-operator) |
| **positions** | [Adding a cross-host manipulation apply coordinator](../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md#adding-a-cross-host-manipulation-apply-coordinator) |
| **perception** | [Adding manipulation transcript operators](../../../../lambda/ephemera/dataSource/perception/AGENT.md#adding-manipulation-transcript-operators) |
| **diegeticLogic** | [`AGENT.operators.concepts.md`](../../../../lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md) (`drop` section) |

**Upstream (graduated):** Manipulation kernel + shared adapter ([`manipulation/AGENT.implementation.md`](../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md) --- Phase 4c **Done** 2026-06-26). **`takeHold`** is the reference vertical for code and tests.

**Non-goals (this plan):** Relational placement (`put X on Y`, nested hosts); multi-object coordinated deltas; client UI affordance work beyond existing parse ingress; slice 5+ relational kernel.

---

## Getting Started

Read in order before editing code. Command authority: [`lambda/ephemera/AGENT.testing.md`](../../../../lambda/ephemera/AGENT.testing.md) (Jest from `lambda/ephemera`, `npm run test`).

1. **Task plan framework**
   - **Why:** Process vs durable doc split; checkbox and open-decision conventions.
   - **Read:** [`taskPlanning/AGENT.md`](../../../AGENT.md).

2. **Cross-lane hub + reference vertical**
   - **Why:** End-to-end pipeline and which lane owns each step.
   - **Read:** [`diegeticLogic/AGENT.implementation.md`](../../../../lambda/ephemera/diegeticLogic/AGENT.implementation.md), [`diegeticLogic/AGENT.operators.concepts.md`](../../../../lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md) (`takeHold` shipped, `drop` deferred).

3. **Persist + adapter spec (deferred `drop` detail)**
   - **Why:** Bounded apply modes, file names, anti-patterns (`update*PositionGraphs` fork).
   - **Read:** [`manipulation/AGENT.implementation.md`](../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md) Section B deferred **`drop`**; [`positions/AGENT.contract.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) cross-host bundle (deferred `drop`).

4. **Reference implementation (`takeHold`)**
   - **Why:** Mirror files for adapter, coordinator, ingress, egress, fan-in.
   - **Positions:** [`applyObjectTakeHold.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/membership/applyObjectTakeHold.ts), [`planObjectTakeHoldTransfer.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/adapters/planObjectTakeHoldTransfer.ts), [`computeTakeHoldDiff.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/adapters/computeTakeHoldDiff.ts), [`executeObjectTakeHold.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/membership/executeObjectTakeHold.ts).
   - **Actions:** [`enrich/objectManipulation/`](../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/), [`publishedEvents.ts`](../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts), [`index.ts`](../../../../lambda/ephemera/dataSource/actions/index.ts) (`Object Take Hold` egress).
   - **Perception:** [`objectManipulationPresentationFanIn.ts`](../../../../lambda/ephemera/dataSource/perception/objectManipulationPresentationFanIn.ts), [`publishObjectManipulationPresentation.ts`](../../../../lambda/ephemera/dataSource/perception/publishObjectManipulationPresentation.ts).

5. **Already scaffolded for `drop`**
   - **Why:** Avoid re-deriving parse ingress work.
   - **Read:** [`heldInventoryCatalogForCharacter.ts`](../../../../lambda/ephemera/dataSource/actions/heldInventoryCatalogForCharacter.ts) (parallel fetch on **`Parse Requested`**); held-only grounding -> **`unimplementedVerb`** until this plan ships.

6. **Identify next task**
   - **Why:** Progress lives in **Recommended order** below.
   - **Focus:** Phase 2 (graduate deferred `drop` clauses in durable docs). Phase 1 positions persist shipped 2026-06-27.

7. **Baseline verification (before edits)**

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/positions/manipulation/adapters/computeTakeHoldDiff.test.ts \
  dataSource/positions/manipulation/membership/applyObjectTakeHold.test.ts \
  dataSource/positions/manipulation/applyHostEffects.test.ts \
  dataSource/actions/enrich/objectManipulation/index.test.ts
```

---

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| **D1** | Extend classify **`movementObjectLabels`** with held-inventory labels (union with in-room labels). **No new parse fetch** --- derive labels from **`heldInventoryCatalog`** already parallel-fetched on **`Parse Requested`**; move context upstream into classify rather than adding pipeline work. | Phase 3 (classify prompt) | **Decided** |
| **D2** | **`drop`** identity resolves against **held inventory catalog only**. A character can only drop what they hold; span grounding to an in-room-only object (not in inventory) is **user error** at this stage --- not merged-catalog disambiguation. | Phase 3 (enrich identity) | **Decided** |
| **D4** | Transcript: **`${Player} drops ${Object}`**; same unknowns withhold as pick-up; reuse/adapt [`resolveTakeHoldPresentationLabels.ts`](../../../../lambda/ephemera/dataSource/perception/resolveTakeHoldPresentationLabels.ts) | Phase 4 (perception) | **Decided** |
| **D5** | Complexity pre-gate: sole host is actor **`CHARACTER#`**, no edge-touch on character **`positionGraph`** -> atomic **`operationKind: drop`** without LLM (mirror room-host **`takeHold`**) | Phase 3 | **Decided** |

**Decided 2026-06-27.** Remove rows from this table when corresponding rules ship in `AGENT.contract.md` / `AGENT.implementation.md`.

---

## Target end state (summary)

```text
Parse Requested
  -> ObjectManipulationIntent (classify; movementObjectLabels = room + held, from existing parallel fetch)
  -> enrich objectManipulation (held-catalog identity only for drop; room-only span -> Error)
  -> complexity pre-gates (sole character host, no edge-touch -> atomic drop)
  -> streamEvent intent (Object Drop)
  -> positions apply (character-remove + room-add via adapter + kernel)
  -> streamEvent fact (Object Moved; froms character, to room)
  -> perception fan-in (intent + fact -> WorldMessage template per D4)
  -> affordance refresh (destination room via existing Object Moved path)
```

**Persist invariant:** `applyObjectDrop` -> `planObjectDropTransfer` -> `applyHostEffects` only --- **no** `updateDropPositionGraphs` or any `update*PositionGraphs` fork.

**Bounded apply (symmetric inverse of `takeHold`):**

| Host | Mode | Behavior |
| --- | --- | --- |
| **Character** (source) | bounded | Remove from **only** trusted ingress `characterId` when object is on that character |
| **Room** (destination) | bounded | Add at trusted ingress `roomId` when object is not already on that room; **do not** end-state scrub other room hosts |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as each sub-step finishes.

- [X] **Phase 0 --- Open decisions**
  - [X] Decide D1 (classify held labels --- extend `movementObjectLabels` from existing `heldInventoryCatalog` fetch)
  - [X] Decide D2 (enrich catalog scope --- held inventory only; in-room-only span is user error)
  - [X] Decide D3 (`Object Drop` stream contract)
  - [X] Decide D4 (transcript template + label resolver)
  - [X] Decide D5 (complexity pre-gate for held sole-host atomic `drop`)

- [X] **Phase 1 --- Positions persist (adapter + coordinator + ingress)**
  - [X] Add [`computeDropDiff.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/adapters/computeDropDiff.ts) + unit tests (mirror [`computeTakeHoldDiff.test.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/adapters/computeTakeHoldDiff.test.ts))
  - [X] Add [`planObjectDropTransfer.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/adapters/planObjectDropTransfer.ts) + tests (reuse or generalize [`hostEffectsFromDiffs.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/adapters/hostEffectsFromDiffs.ts))
  - [X] Add [`applyObjectDrop.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/membership/applyObjectDrop.ts) + unit tests (mirror [`applyObjectTakeHold.test.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/membership/applyObjectTakeHold.test.ts))
  - [X] Add [`executeObjectDrop.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/membership/executeObjectDrop.ts) + unit tests
  - [X] Register **`Object Drop`** guard in [`subscribedEvents.ts`](../../../../lambda/ephemera/dataSource/positions/subscribedEvents.ts); route in [`positions/index.ts`](../../../../lambda/ephemera/dataSource/positions/index.ts)
  - [X] Add routing test in [`receivePaths.integration.test.ts`](../../../../lambda/ephemera/dataSource/positions/receivePaths.integration.test.ts) (`Object Drop` describe block)
  - [X] Ingress prerequisite: **`ObjectDropPublishedPayload`** + guard in [`publishedEvents.ts`](../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts) (actions egress wiring remains Phase 3)

- [ ] **Phase 2 --- Positions durable docs (graduate deferred clauses)**
  - [ ] Promote deferred `drop` bundle in [`positions/AGENT.contract.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) from future tense to normative (mirror `takeHold` section)
  - [ ] Update [`positions/AGENT.implementation.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) per-operator table (`drop` shipped)
  - [ ] Update [`manipulation/AGENT.implementation.md`](../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md) Section B/E (remove deferred markers where code exists)

- [ ] **Phase 3 --- Actions parse + egress**
  - [ ] Extend **`operationKind`** union + guards in [`baseClasses.ts`](../../../../lambda/ephemera/dataSource/actions/baseClasses.ts)
  - [ ] Extend complexity pre-gates for held sole-host atomic **`drop`** ([`complexityPreGates.ts`](../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/complexityPreGates.ts))
  - [ ] Extend enrich prompts + finalize ([`buildPrompt.ts`](../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/buildPrompt.ts), [`interpretAndFinalize.ts`](../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/interpretAndFinalize.ts))
  - [ ] Extend **`movementObjectLabels`** with held labels derived from existing **`heldInventoryCatalog`** (D1; mirror [`roomObjectLabelsForCharacter.ts`](../../../../lambda/ephemera/dataSource/actions/roomObjectLabelsForCharacter.ts))
  - [ ] Identity resolve for **`drop`**: **held catalog only** (D2); in-room-only grounding -> terminal **`Error`** (not merged resolve)
  - [ ] Unblock held-only identity path for eligible **`drop`** (replace **`unimplementedVerb`** stub)
  - [ ] Add **`Object Drop`** to [`publishedEvents.ts`](../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts); wire **`Parse Requested`** branch in [`actions/index.ts`](../../../../lambda/ephemera/dataSource/actions/index.ts)
  - [ ] Tests: [`enrich/objectManipulation/*.test.ts`](../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/), [`parseCommand.test.ts`](../../../../lambda/ephemera/dataSource/actions/parseCommand.test.ts), [`index.test.ts`](../../../../lambda/ephemera/dataSource/actions/index.test.ts)

- [ ] **Phase 4 --- Perception transcript**
  - [ ] Extend [`objectManipulationPresentationLegAdapters.ts`](../../../../lambda/ephemera/dataSource/perception/objectManipulationPresentationLegAdapters.ts) for **`Object Drop`** intent leg
  - [ ] Extend [`objectManipulationPresentationFanIn.ts`](../../../../lambda/ephemera/dataSource/perception/objectManipulationPresentationFanIn.ts) endpoint checks (intent `characterId` in fact `froms`, fact `to` = intent `roomId`)
  - [ ] Add drop template + label resolution per D4 in [`publishObjectManipulationPresentation.ts`](../../../../lambda/ephemera/dataSource/perception/publishObjectManipulationPresentation.ts)
  - [ ] Register envelopes in [`perception/subscribedEvents.ts`](../../../../lambda/ephemera/dataSource/perception/subscribedEvents.ts); route in [`perception/index.ts`](../../../../lambda/ephemera/dataSource/perception/index.ts)
  - [ ] Tests: [`objectManipulationPresentationFanIn.test.ts`](../../../../lambda/ephemera/dataSource/perception/objectManipulationPresentationFanIn.test.ts), [`objectManipulationPresentationLegAdapters.test.ts`](../../../../lambda/ephemera/dataSource/perception/objectManipulationPresentationLegAdapters.test.ts)

- [ ] **Phase 5 --- Diegetic logic + cleanup**
  - [ ] Graduate [`AGENT.operators.concepts.md`](../../../../lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md) `drop` section from deferred to shipped
  - [ ] Update [`diegeticLogic/AGENT.implementation.md`](../../../../lambda/ephemera/diegeticLogic/AGENT.implementation.md) follow-on operators table
  - [ ] Run full verification (below); delete this task plan

---

## Verification

Run from `lambda/ephemera`. If commands conflict, follow [`AGENT.testing.md`](../../../../lambda/ephemera/AGENT.testing.md).

### After Phase 1 (positions)

```bash
npm run test -- --watchAll=false \
  dataSource/positions/manipulation/adapters/ \
  dataSource/positions/manipulation/membership/applyObjectDrop.test.ts \
  dataSource/positions/manipulation/membership/executeObjectDrop.test.ts \
  dataSource/positions/receivePaths.integration.test.ts
```

**No parallel persist paths:**

```bash
rg -n "updateDropPositionGraphs|updateTakeHoldPositionGraphs|updateObjectPositionGraphs|updatePositionGraphs" \
  lambda/ephemera/dataSource/positions/
```

Goal: empty (or only historical comments in docs).

### After Phase 3 (actions)

```bash
npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/ \
  dataSource/actions/parseCommand.test.ts \
  dataSource/actions/index.test.ts
```

### After Phase 4 (perception)

```bash
npm run test -- --watchAll=false \
  dataSource/perception/objectManipulationPresentationFanIn.test.ts \
  dataSource/perception/objectManipulationPresentationLegAdapters.test.ts \
  dataSource/perception/index.test.ts
```

### End-to-end (Phase 5)

```bash
npm run test -- --watchAll=false \
  dataSource/positions/manipulation/ \
  dataSource/positions/membership/ \
  dataSource/actions/enrich/objectManipulation/ \
  dataSource/actions/parseCommand.test.ts \
  dataSource/actions/index.test.ts \
  dataSource/perception/objectManipulationPresentationFanIn.test.ts \
  dataSource/perception/objectManipulationPresentationLegAdapters.test.ts

npm run build
```

---

## Progress

| Phase | Status |
| --- | --- |
| Phase 0 --- Open decisions | **Done** (2026-06-27) |
| Phase 1 --- Positions persist | **Done** (2026-06-27) |
| Phase 2 --- Positions durable docs | Not started |
| Phase 3 --- Actions parse + egress | Not started |
| Phase 4 --- Perception transcript | Not started |
| Phase 5 --- Diegetic logic + cleanup | Not started |

---

## Links (durable docs --- do not duplicate here)

| Doc | Role |
| --- | --- |
| [`actions/AGENT.implementation.md`](../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) | Atomic operator playbook + `ObjectManipulationIntent` steady-state |
| [`positions/AGENT.contract.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) | `Object Moved`, ingress contracts |
| [`positions/manipulation/AGENT.implementation.md`](../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md) | Kernel + adapter spec |
| [`perception/AGENT.md`](../../../../lambda/ephemera/dataSource/perception/AGENT.md) | Manipulation fan-in steady-state |
| [`lambda/ephemera/AGENT.testing.md`](../../../../lambda/ephemera/AGENT.testing.md) | Jest commands and DI patterns |
