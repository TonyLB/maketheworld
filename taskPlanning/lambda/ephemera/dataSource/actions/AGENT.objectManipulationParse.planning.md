# Object manipulation parse --- atomic vs complex (next iteration)

**Status:** Not started. **Next:** Phase 1 --- pipeline design and open decisions; baseline tests green.

Framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md). Parent / sibling initiative: [`../positions/manipulation/AGENT.manipulationModel.planning.md`](../positions/manipulation/AGENT.manipulationModel.planning.md) (graph-first manipulation kernel + intent adapters; **gates** positions Phase 2 spec and Phase 4b migrate).

**Delete criterion:** When enrich + parse wiring graduate into [`lambda/ephemera/dataSource/actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) and tests cover membership-aware atomic vs complex fall-through, slim or delete this plan.

---

## Purpose

Refine **`mtw.ephemera.actions`** object manipulation parse so **atomic vs complex** routing uses **membership topology**, not only a single enrich LLM hop plus deterministic catalog resolve.

**Problem (shipped v1):** [`enrich/objectManipulation/`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/) returns `disposition: atomic | complex` from one Bedrock call; [`resolveObjectSpanToObjectId`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/resolveObjectSpan.ts) matches spans against [`roomObjectCatalogForCharacter`](../../../../../lambda/ephemera/dataSource/actions/roomObjectCatalogForCharacter.ts) (room **forward graph**). Reverse membership (`internalCache.Positions.getMembershipContainers`) is **not** consulted before complexity classification --- multi-parent / cross-host drift can reach atomic egress incorrectly.

**Outcome:** Faster, more reliable **complex fall-through** when manipulation is not a simple single-parent atomic move; clearer **atomic eligibility** when it is. Atomic egress must call a **positions intent adapter** that routes through the **shared manipulation kernel** --- not a parse-local or per-verb persist fork.

**Non-goals:** Positions kernel implementation (see manipulation model plan Phases 4a--4c); relational edge persistence (slice 5+); full **`drop`** vertical (inventory catalog may be a follow-on slice here or separate).

---

## Downstream apply (cross-lane contract)

Parse classifies; positions persists. **One kernel path** for all membership transfer apply.

| Parse outcome | Positions path |
| --- | --- |
| **Atomic** | Terminal egress (e.g. **`Object Take Hold`**) -> operator adapter (`applyObjectTakeHold`) -> **manipulation kernel** |
| **Complex** | Terminal **`Error`** --- no stream, no positions |

**Two uses of membership (do not conflate with kernel planning):**

| Lane | Role |
| --- | --- |
| **This plan (parse)** | **`getMembershipContainers`** for **eligibility / complexity** (multi-parent -> complex). Adjacency-shaped read is appropriate. |
| **Manipulation kernel** | **Graph-reconciled priors** for apply planning (**M1** in manipulation model plan). Parse does not implement kernel planning. |

Atomic egress ids must align with **bounded** kernel apply semantics (**M2**).

---

## Getting Started

1. [`taskPlanning/AGENT.md`](../../../../AGENT.md) --- durability ladder, open decisions, checkboxes.
2. [`lambda/ephemera/dataSource/actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) --- shipped **`ObjectManipulationIntent`** steady-state.
3. [`lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md) --- **`takeHold`** / deferred **`drop`**.
4. [`../positions/manipulation/AGENT.manipulationModel.planning.md`](../positions/manipulation/AGENT.manipulationModel.planning.md) --- kernel + intent adapters, apply modes, cross-lane dependency table.

**Code anchors:**

| Area | Path |
| --- | --- |
| Parse orchestration | [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) (`roomObjectCatalog` + `parseCommand`) |
| Classify | [`discriminateIntent/`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/) |
| Enrich | [`enrich/objectManipulation/`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/) |
| Catalog | [`roomObjectCatalogForCharacter.ts`](../../../../../lambda/ephemera/dataSource/actions/roomObjectCatalogForCharacter.ts) |
| Membership read | `internalCache.Positions.getMembershipContainers` ([`packages/mtw-gateways/ts/ephemera/positions/factory.ts`](../../../../../packages/mtw-gateways/ts/ephemera/positions/factory.ts)) |

**Baseline tests (before edits):**

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/ \
  dataSource/actions/roomObjectCatalogForCharacter.test.ts \
  dataSource/actions/parseCommand.test.ts \
  dataSource/actions/index.test.ts
```

---

## Shipped pipeline (as-is)

```text
Parse Requested
  -> parallel: roomExitContext + roomObjectCatalog
  -> classify (LLM): ObjectManipulationIntent + objectSpans
  -> enrich (LLM): disposition atomic|complex + operationKind + objectSpan
  -> resolve (deterministic): span -> OBJECT# via catalog
  -> terminal parse / egress (Object Take Hold) or Error (complex stub)
```

Complex disposition: terminal **`Error`** --- no stream, no positions ([`interpretAndFinalize.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/interpretAndFinalize.ts)).

---

## Target pipeline (to design in Phase 1)

```text
Classify (intent + raw objectSpans)              [keep / extend]
  -> Identity                                    [refine: span -> OBJECT# candidates]
       roomObjectCatalog (+ future held inventory)
  -> Membership observation                      [new: parallel getMembershipContainers per candidate]
  -> Complexity / move assessment                [refine enrich: LLM + deterministic pre-gates]
       atomic vs complex; atomic may emit operationKind + grounded move
  -> Terminal parse + egress                     [extend types/guards as needed]
```

**Within one `Parse Requested` invocation:** repeat `getMembershipContainers` for the same `OBJECT#` is a **`DeferredCache` hit** after the first read.

---

## Open decisions (implementation --- plan only)

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| **O1** | Identity phase: **deterministic-first** (catalog resolve before LLM) vs **LLM-assisted** span-to-id vs hybrid | Phase 2--3 | Open |
| **O2** | Enrich shape: **one** Bedrock hop (membership-enriched prompt) vs **two** hops (identity then complexity) | Phase 3 | Open |
| **O3** | New **`complexityClass`** for multi-parent hosts (e.g. `multiParent`) vs fold into `multiObject` | Phase 2 gates | Open |
| **O4** | Deterministic pre-gate rules (e.g. `containers.length > 1` -> complex without LLM) --- which host shapes trigger | Phase 2 | Open |
| **O5** | Held inventory catalog scope in this plan vs defer to **`drop`** slice | Phase 4+ | Open |

When a row ships, update [`AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) and remove the row here.

---

## Graduation map

| Content | Destination |
| --- | --- |
| Steady-state parse/enrich sequence | [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) --- `ObjectManipulationIntent` section |
| Atomic eligibility / complex classes | [`diegeticLogic/AGENT.operators.concepts.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md) if fiction-relevant |
| Apply-mode implications; kernel adapter contract | [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) via manipulation model plan **M2**; kernel module path via **M5** after Phase 4a |

---

## Progress

| Phase | Description | Status |
| --- | --- | --- |
| 1 | Pipeline design; decide **O1**--**O3** | Not started |
| 2 | Membership observation + deterministic pre-gates (**O4**) | Not started |
| 3 | Enrich refactor (**O2**); prompts + interpret/finalize | Not started |
| 4 | `parseCommand` / `index.ts` wiring; egress unchanged unless new fields needed | Not started |
| 5 | Tests + graduate actions implementation doc | Not started |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested bullets `[X]` as each sub-task finishes.

- [ ] **Phase 1 --- Design**
  - [ ] Document target pipeline steps and inputs/outputs per step
  - [ ] Decide **O1**, **O2**, **O3**; record in Open decisions or mark Decided
  - [ ] Align with manipulation model plan: atomic egress -> operator adapter -> kernel; **bounded** apply semantics (**M2**)
- [ ] **Phase 2 --- Membership observation + pre-gates**
  - [ ] Add helper: given span-matched catalog entries, parallel `getMembershipContainers`
  - [ ] Implement deterministic pre-gates (**O4**); unit tests (multi-parent -> complex)
  - [ ] Add **`complexityClass`** if **O3** requires (stub terminal Error path)
- [ ] **Phase 3 --- Enrich refactor**
  - [ ] Update [`buildPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/buildPrompt.ts) with membership context shape
  - [ ] Refactor [`interpretAndFinalize.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/interpretAndFinalize.ts) for new pipeline order
  - [ ] Preserve v1 **`takeHold`** atomic path behavior for eligible single-parent in-room objects
- [ ] **Phase 4 --- Parse wiring**
  - [ ] Thread membership observation through [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) / [`enrich/objectManipulation/index.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/index.ts)
  - [ ] Confirm complex still produces no stream / no positions
- [ ] **Phase 5 --- Graduate**
  - [ ] Extend [`AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md)
  - [ ] Notify manipulation model plan: ungate Phase **4b** migrate when Phase 2--3 criteria met (Phase **4a** kernel scaffold may proceed earlier)
  - [ ] Slim or delete this file

---

## Verification

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/ \
  dataSource/actions/parseCommand.test.ts \
  dataSource/actions/index.test.ts
```

**After Phase 2 (pre-gates):**

```bash
rg -n "getMembershipContainers|multiParent|complexityClass" \
  lambda/ephemera/dataSource/actions/enrich/objectManipulation/
```

---

## Links

| Doc | Role |
| --- | --- |
| [`../positions/manipulation/AGENT.manipulationModel.planning.md`](../positions/manipulation/AGENT.manipulationModel.planning.md) | Graph-first kernel + intent adapters; upstream/downstream gates |
| [`diegeticLogic/AGENT.implementation.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.implementation.md) | Four-lane operator hub |
| [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) | **`Object Take Hold`** ingress |
