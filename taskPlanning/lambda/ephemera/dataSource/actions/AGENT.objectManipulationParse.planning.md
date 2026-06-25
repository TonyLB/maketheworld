# Object manipulation parse --- atomic vs complex (next iteration)

**Status:** In progress. **Next:** Phase 3 --- enrich refactor (split identity/complexity stages per **O2**).

Framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md). Parent / sibling initiative: [`../positions/manipulation/AGENT.manipulationModel.planning.md`](../positions/manipulation/AGENT.manipulationModel.planning.md) (graph-first manipulation kernel + intent adapters; **gates** positions Phase 2 spec and Phase 4b migrate).

**Delete criterion:** When enrich + parse wiring graduate into [`lambda/ephemera/dataSource/actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) and tests cover membership-aware atomic vs complex fall-through, slim or delete this plan.

---

## Purpose

Refine **`mtw.ephemera.actions`** object manipulation parse so **atomic vs complex** routing uses **membership topology**, not only a single enrich LLM hop plus deterministic catalog resolve.

**Problem (shipped v1):** [`enrich/objectManipulation/`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/) returns `disposition: atomic | complex` from one Bedrock call; [`resolveObjectSpanToObjectId`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/resolveObjectSpan.ts) matches spans against [`roomObjectCatalogForCharacter`](../../../../../lambda/ephemera/dataSource/actions/roomObjectCatalogForCharacter.ts) (room **forward graph**). Reverse membership (`internalCache.Positions.getMembershipContainers`) is **not** consulted before complexity classification --- multi-parent / cross-host drift can reach atomic egress incorrectly.

**Outcome:** Faster, more reliable **complex fall-through** when manipulation is not a simple single-parent atomic move; clearer **atomic eligibility** when it is. Atomic egress must call a **positions intent adapter** that routes through the **shared manipulation kernel** --- not a parse-local or per-verb persist fork.

**Non-goals:** Positions kernel implementation (see manipulation model plan Phases 4a--4c); relational edge persistence (slice 5+); full **`drop`** operator vertical (atomic egress / positions apply for drop remains a follow-on slice --- held inventory **catalog fetch** is in scope per **O5**).

---

## Downstream apply (cross-lane contract)

Parse classifies; positions persists. **One kernel path** for all membership transfer apply.

| Parse outcome | Positions path |
| --- | --- |
| **Atomic** | Terminal egress (e.g. **`Object Take Hold`**) -> per-operator coordinator -> **shared membership adapter** -> **manipulation kernel** |
| **Complex** | Terminal **`Error`** --- no stream, no positions |

**Membership observation by lane:**

| Lane | Role |
| --- | --- |
| **This plan (parse)** | **`getMembershipContainers(OBJECT#)`** for complexity pre-gates; **`getPositionGraph`** on sole container when edge-touch check needed (**O4**). Multi-present -> **`multiPresent`** complex (**O3**). |
| **Shared membership adapter** | **`getMembershipContainers`** to **plan** `froms`/`to` -> **`HostEffect[]`** for apply (see manipulation model plan **M1**). |
| **Manipulation kernel** | Applies supplied **`HostEffect[]`** only; does **not** plan transfers or call **`getMembershipContainers`**. |

Atomic egress ids must align with **bounded** kernel apply semantics (**M2**).

---

## Getting Started

1. [`taskPlanning/AGENT.md`](../../../../AGENT.md) --- durability ladder, open decisions, checkboxes.
2. [`lambda/ephemera/dataSource/actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) --- shipped **`ObjectManipulationIntent`** steady-state.
3. [`lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md) --- **`takeHold`** / deferred **`drop`**.
4. [`../positions/manipulation/AGENT.manipulationModel.planning.md`](../positions/manipulation/AGENT.manipulationModel.planning.md) --- shared adapter + kernel, apply modes, cross-lane dependency table.

**Code anchors:**

| Area | Path |
| --- | --- |
| Parse orchestration | [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) (`roomObjectCatalog` + `parseCommand`) |
| Classify | [`discriminateIntent/`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/) |
| Enrich | [`enrich/objectManipulation/`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/) |
| Catalog (room) | [`roomObjectCatalogForCharacter.ts`](../../../../../lambda/ephemera/dataSource/actions/roomObjectCatalogForCharacter.ts) |
| Catalog (held inventory) | new module (mirror room catalog pattern); parallel fetch per **O5** |
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
  -> classify (LLM): ObjectManipulationIntent + rawObjectSpans[]
  -> enrich (LLM): disposition atomic|complex + operationKind + objectSpan
  -> resolve (deterministic): single objectSpan -> OBJECT# via room catalog only
  -> terminal parse / egress (Object Take Hold) or Error (complex stub)
```

Complex disposition: terminal **`Error`** --- no stream, no positions ([`interpretAndFinalize.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/interpretAndFinalize.ts)).

---

## Target pipeline (Phase 1 design)

**Decided:** two **logical** stages after classify --- identity, then complexity --- with membership observation between them (**O2**). A stage is not synonymous with a Bedrock call; either stage may short-circuit deterministically.

**Parse Requested context (O5):** fetch **held inventory catalog** in parallel with **room object catalog** (extend [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) `Promise.all`). Held catalog is an **identity-stage** input in v1; classify prompt stays room-label-only until a follow-on slice.

```text
Parse Requested
  -> parallel: roomExitContext + roomObjectCatalog + heldInventoryCatalog
  -> classify (LLM)                               [ObjectManipulationIntent + rawObjectSpans[]]
  -> Cardinality gate (deterministic)             [rawObjectSpans.length > 1 -> complex multiObject]
  -> Identity (stage 1)                           [per-span groundings; O1]
       merged catalog resolve (room then held; dedupe by objectId)
       identity LLM on per-span NoMatch / AmbiguousMatch
  -> Unary collapse                                 [exactly one resolved grounding -> continue; else Error]
  -> Membership observation                       [getMembershipContainers(OBJECT#); positionGraph when O4 rule 2]
  -> Complexity / move assessment (stage 2)         [O4 pre-gates; then LLM if needed]
  -> Terminal parse + egress
```

**Bedrock budget (after classify):** 0--2 hops --- identity LLM only when deterministic per-span resolve fails; complexity LLM only when pre-gates do not decide. Eligible exact-name, single-span, single-host, edge-free **`takeHold`** may need **zero** post-classify Bedrock calls.

Detail: [**Pipeline step I/O**](#pipeline-step-io) below.

### Complexity stage pre-gates (**O4**)

Hybrid like identity (**O1**): evaluate rules in order; first decisive outcome wins; otherwise LLM fall-through for stage 2.

Inputs: single grounded **`objectId`** from unary collapse; `containers` from **`getMembershipContainers(objectId)`**; when needed, **`getPositionGraph`** on the sole container host.

| Order | Condition | Outcome (no Bedrock) |
| --- | --- | --- |
| 0 | `containers.length === 0` | **Error** --- fail closed (no membership host for object) |
| 1 | `containers.length > 1` | **complex** --- `complexityClass: multiPresent` (**O3**) |
| 2 | `containers.length === 1` and **no** exit edges on that host's `positionGraph` touch the target object | **atomic** --- `operationKind: takeHold` (v1 unary operator slice) |
| 3 | otherwise | **LLM fall-through** --- relational / edge-implied complexity |

**Edge touch (rule 2):** any exit edge on the sole host `positionGraph` references the grounded `OBJECT#` as an endpoint (implement via `PlayPositionGraph` `nodes` / `edges` in Phase 2 helper).

**Within one `Parse Requested` invocation:** repeat `getMembershipContainers` or `getPositionGraph` for the same id is a **`DeferredCache` hit** after the first read.

---

## Pipeline step I/O

Normative inputs/outputs per step for implementation. **Phase 1 assumptions** (documented defaults --- not separate open decisions):

| Assumption | Default |
| --- | --- |
| Two-catalog identity | Merge room then held entries; dedupe by `objectId`; each entry tagged `catalogScope: room \| held` for identity LLM |
| Classify + held labels | v1 unchanged --- `movementObjectLabels` / room labels only; held catalog not in classify prompt |
| Identity LLM contract | **Separate** stage-1 hop (not stage-2 enrich JSON); **may** return `objectId`; fail closed on ambiguity |
| `containers.length === 0` | Terminal **Error** (pre-gate rule 0) |
| Held-only grounding | Identity may resolve; **`takeHold`** atomic egress still v1 room pick-up --- held-target lines remain **Error** / **`unimplementedVerb`** until **`drop`** slice |
| **`multiObject` vs `multiPresent`** | **`multiObject`**: multiple `rawObjectSpans` or multiple grounded targets in one command. **`multiPresent`**: one object, multiple membership hosts |

### Step table

| Step | Inputs | Outputs | Bedrock? |
| --- | --- | --- | --- |
| **Parse Requested context** | `characterId` | `roomExitContext`, `roomObjectCatalog`, `heldInventoryCatalog` | No |
| **Classify** | `command`, `roomObjectLabels` | `ObjectManipulationIntent`, `rawObjectSpans[]`, `confidence` | Yes (existing) |
| **Cardinality gate** | `rawObjectSpans.length` | if `> 1`: terminal **complex** / `multiObject`; else continue | No |
| **Identity (stage 1)** | `rawObjectSpans[]`, merged catalogs | `spanGroundings[]`: per span `resolved` + `objectId` + `catalogScope`, or `noMatch` / `ambiguous`; identity LLM on failed spans per **O1** | Per-span, only on deterministic failure |
| **Unary collapse** | `spanGroundings[]` | exactly one `resolved` -> `objectId`; zero or >1 resolved -> **Error**; any unresolved span after LLM -> **Error** | No |
| **Membership observation** | `objectId` | `containers[]`; sole-host `positionGraph` when pre-gate rule 2 needs edge check | No (cache-backed) |
| **Complexity (stage 2)** | `objectId`, `containers`, `positionGraph`, `command` | `atomic` + `operationKind` or `complex` + `complexityClass` per **O4** | Only on pre-gate rule 3 |
| **Terminal parse** | stage outputs | `ParseCommandObjectManipulationResult` or `ParseCommandErrorResult` | No |
| **Egress** | terminal parse, `roomExitContext.fromRoomId` | **`Object Take Hold`** stream (unary `objectId`) or OOC **Error**; complex: no stream | No |

### Cross-lane atomic egress (**M2**)

When terminal parse is **atomic** `takeHold`:

- Egress **`Object Take Hold`** carries trusted `characterId`, `objectId`, ingress `roomId` (from `roomExitContext.fromRoomId`).
- Positions **`takeHold`** apply uses **bounded** mode (**M2**): shared membership adapter scrubs **only** the trusted ingress `roomId` when the object is on that room --- not end-state scrub of all prior hosts.
- Parse must route **`multiPresent`** and relational complexity to terminal **Error** before egress so bounded apply never receives ambiguous multi-host targets.

---

## Open decisions (implementation --- plan only)

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| **O1** | **Hybrid identity (stage 1):** deterministic catalog resolve first ([`resolveObjectSpanToObjectId`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/resolveObjectSpan.ts) exact normalized `shortName` match); on **`NoMatch`** or **`AmbiguousMatch`**, LLM-assisted span-to-id against catalog --- fail closed if still ambiguous | Phase 2--3 | **Decided** |
| **O2** | **Split logical stages:** always identity then membership observation then complexity --- not a single fused enrich hop. Each stage may complete without Bedrock (identity via **O1** deterministic path; complexity via **O4** pre-gates). Worst case 0--2 Bedrock hops after classify | Phase 3 | **Decided** |
| **O3** | New **`complexityClass: multiPresent`** for multi-present targets --- object listed on **more than one** membership host `positionGraph` (`containers.length > 1`); distinct from **`multiObject`** (multiple objects / deltas in one command line) | Phase 2 gates | **Decided** |
| **O4** | **Hybrid complexity (stage 2):** deterministic pre-gates first, LLM when undecided. Rules: (0) `containers.length === 0` -> **Error**; (1) `containers.length > 1` -> complex / **`multiPresent`**; (2) `containers.length === 1` and no `positionGraph` edges touch target -> atomic `takeHold`; (3) else LLM | Phase 2 | **Decided** |
| **O5** | **Held inventory catalog in this plan:** fetch in parallel with room catalog on **`Parse Requested`**; thread into identity stage (deterministic resolve + LLM fallback). Does **not** ship **`drop`** atomic egress / positions apply --- that remains a follow-on operator slice | Phase 4 | **Decided** |

When a row ships, update [`AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) and remove the row here.

---

## Graduation map

| Content | Destination |
| --- | --- |
| Steady-state parse/enrich sequence | [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) --- `ObjectManipulationIntent` section |
| Atomic eligibility / complex classes | [`diegeticLogic/AGENT.operators.concepts.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md) if fiction-relevant |
| Apply-mode implications; adapter/kernel contract | [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) via manipulation model plan **M2**; module paths via **M5** / **M8** after Phase 4a |

---

## Progress

| Phase | Description | Status |
| --- | --- | --- |
| 1 | Pipeline design + step I/O (**O1**--**O5**; **M2** cross-lane note) | Done |
| 2 | Membership observation + deterministic pre-gates per **O4**; **`multiPresent`** stub per **O3** | Done |
| 3 | Enrich refactor (split stages per **O2**); identity LLM per **O1**; prompts + interpret/finalize | Not started |
| 4 | `parseCommand` / `index.ts` wiring; egress unchanged unless new fields needed | Not started |
| 5 | Tests + graduate actions implementation doc | Not started |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested bullets `[X]` as each sub-task finishes.

- [X] **Phase 1 --- Design**
  - [X] Document target pipeline steps and inputs/outputs per step ([Pipeline step I/O](#pipeline-step-io))
  - [X] Decide **O1** (hybrid identity: deterministic catalog first, LLM on NoMatch / AmbiguousMatch)
  - [X] Decide **O2** (split logical stages; Bedrock optional per stage --- see Target pipeline)
  - [X] Decide **O3** (`complexityClass: multiPresent` for multi-host membership; not `multiObject`)
  - [X] Decide **O4** (hybrid complexity pre-gates; four rules --- see Target pipeline)
  - [X] Decide **O5** (held inventory catalog parallel fetch; identity-stage context only; **`drop`** apply deferred)
  - [X] Align with manipulation model plan: atomic egress -> coordinator -> shared adapter -> kernel; **bounded** apply semantics (**M2** --- [Cross-lane atomic egress](#cross-lane-atomic-egress-m2))
- [X] **Phase 2 --- Membership observation + pre-gates**
  - [X] Cardinality gate: `rawObjectSpans.length > 1` -> terminal complex **`multiObject`** (no Bedrock)
  - [X] Add helper: grounded `OBJECT#` -> `containers` via `getMembershipContainers`; sole-host `positionGraph` + edge-touch predicate for pre-gate rule 2
  - [X] Implement complexity pre-gates (**O4**): rule 0 -> Error; rule 1 -> **`multiPresent`**; rule 2 -> atomic `takeHold`; rule 3 -> defer to stage-2 LLM
  - [X] Register **`multiPresent`** in enrich guards + terminal Error copy (**O3**); unit tests (multi-present -> complex, edge-free single-host -> atomic, zero containers -> Error)
  - **Bridge wiring (Phase 2):** cardinality pre-Bedrock + post-resolve pre-gate rules 0--1 in [`enrich/objectManipulation/index.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/index.ts). Full pre-LLM ordering ships Phase 3.
- [ ] **Phase 3 --- Enrich refactor (split stages per O2)**
  - [ ] Identity: per-span groundings via merged catalog; unary collapse; identity-stage LLM (**O1**) with separate JSON contract (`objectId` allowed)
  - [ ] Update [`buildPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/buildPrompt.ts) --- identity vs complexity prompt shapes; membership context on complexity stage only
  - [ ] Refactor [`interpretAndFinalize.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/interpretAndFinalize.ts) for stage-2 complexity only (post-membership)
  - [ ] Preserve v1 **`takeHold`** atomic path for eligible single-span, in-room, single-host, edge-free objects
- [ ] **Phase 4 --- Parse wiring**
  - [ ] Add held inventory catalog module (character `positionGraph` + perspective merge; mirror room catalog entry shape + `catalogScope`)
  - [ ] Extend [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) `Promise.all`: room catalog + held inventory catalog (**O5**)
  - [ ] Thread catalogs through [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) -> identity merged catalog (**O1**)
  - [ ] Thread membership observation through object-manipulation orchestration ([`enrich/objectManipulation/index.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/index.ts) or successor module)
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
rg -n "getMembershipContainers|multiPresent|complexityClass" \
  lambda/ephemera/dataSource/actions/enrich/objectManipulation/
```

---

## Links

| Doc | Role |
| --- | --- |
| [`../positions/manipulation/AGENT.manipulationModel.planning.md`](../positions/manipulation/AGENT.manipulationModel.planning.md) | Shared adapter + kernel; upstream/downstream gates |
| [`diegeticLogic/AGENT.implementation.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.implementation.md) | Four-lane operator hub |
| [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) | **`Object Take Hold`** ingress |
