# Position manipulation (diegetic logic) --- planning

**Status:** Design-only. No implementation slices started. **Next:** lock **Phase 1 gates** (**D3**, **D15**); then Phase 1 classifier implementation.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../AGENT.md).

Durable concepts (not this file): [`lambda/ephemera/diegeticLogic/`](../../../../lambda/ephemera/diegeticLogic/AGENT.md).

Related parse framework (separate initiative): [`taskPlanning/lambda/ephemera/dataSource/actions/AGENT.actionParse.plan.md`](../dataSource/actions/AGENT.actionParse.plan.md).

---

## Purpose

End-to-end vertical slice: player **natural-language commands** that **manipulate objects in play** via `positionGraph` (and related indices), with results reflected in **affordances** and the **narrative transcript**.

This plan tracks **process, open forks, and ordering**. Steady-state architecture graduates into [`diegeticLogic/`](../../../../lambda/ephemera/diegeticLogic/AGENT.md), [`dataSource/positions/`](../../../../lambda/ephemera/dataSource/positions/AGENT.md), [`dataSource/actions/`](../../../../lambda/ephemera/dataSource/actions/AGENT.md), and [`dataSource/perception/`](../../../../lambda/ephemera/dataSource/perception/AGENT.md) --- then **delete or archive** this file.

---

## Locked (agreed direction)

| ID | Decision |
| --- | --- |
| **L1** | **Four-lane split:** classify + enrich in **`mtw.ephemera.actions`**; graph persistence in **`mtw.ephemera.positions`** only; player-visible copy in **`mtw.ephemera.perception`**; operator semantics designed in **`diegeticLogic/`** (docs, not runtime code). |
| **L2** | **Enrich proposes, positions commits.** LLM output is a validated **manipulation proposal**; no direct Dynamo writes from enrich. |
| **L3** | **Intent / fact / presentation** shape (mirror navigate): actions streams **intent**; positions emits **fact** (extend or reuse **`Object Moved`**); perception owns **transcript** obligations ([`AGENT.narrativeTranscript.concepts.md`](../../../../lambda/ephemera/AGENT.narrativeTranscript.concepts.md)). |
| **L4** | **Classifier extension**, not a parallel ingress: manipulation today lands in **`Unimplemented`** ([`buildIntentClassificationPrompt.ts`](../../../../lambda/ephemera/dataSource/actions/discriminateIntent/buildIntentClassificationPrompt.ts)); new work adds a recognized **semantic intent** for that family. |
| **L5** | **Read context via gateways/cache**, not ad hoc Dynamo in enrich (room objects, graph topology, object meta --- same discipline as other ephemera lanes). |
| **L6** | **Affordance refresh** on placement change is largely **already wired** (`Object Moved` -> affordance orchestration); this initiative must still plan **transcript** emission (currently deferred for objects). |
| **L7** | **Semantic intent at classify, not a verb whitelist.** Discriminate asks which recognized intent fits (same register as **`NavigationIntent`**, **`LookRoom`**, **`AcmeOrder`**). Examples in the prompt illustrate paraphrase; they are not an exhaustive synonym list. **`operationKind`** and graph deltas belong in **enrich**, not classify. |
| **L8** | **Play graphs at component Meta, not perspectiveKey.** For early positioning iterations, **`positionGraph`** is an **ephemeral play layer** stored on component **meta** rows (**`Meta::Room`**, **`Meta::Area`**, **`Meta::Character`**, **`Meta::Object`**, ...) --- not on asset-layer **`perspectiveKey`** slices. Manipulation operators read and write **global play truth** (same register as today's room membership graphs). Perspective-filtered **presentation** remains downstream. |
| **L9** | **Pick up = atomic host transfer.** For movement, **pick up** removes the object from the **room** host graph and adds it to the **character** host graph in one apply --- not a separate "in plain sight" fiction with unchanged storage. **`Meta::Character.positionGraph`** (and read/apply paths) are **not shipped**; designing and landing that storage is **in scope** for this initiative. |

---

## Parse pipeline: classify vs enrich

Matches existing **`AcmeOrderIntent`** -> **`enrichAcmeOrder`** split ([`parseCommand.ts`](../../../../lambda/ephemera/dataSource/actions/parseCommand.ts), [`enrich/AGENT.md`](../../../../lambda/ephemera/dataSource/actions/enrich/AGENT.md)).

| Stage | Question | Output (draft) |
| --- | --- | --- |
| **Discriminate** | Is the line **primarily** about manipulating a scene object (vs move, look, Acme order, ...)? | **`ObjectManipulationIntent`** + optional **raw object span(s)** (ungrounded strings, like **`AcmeOrder`** `orders`) |
| **Enrich** | What **operation** and grounded targets? | **`operationKind`**, resolved **`objectId`**, manipulation **proposal** JSON |
| **Resolve (deterministic)** | Legality, disambiguation, id match | Terminal parse result or **`Error`** |
| **Egress** | Intent for downstream lanes | Stream event -> positions -> perception |

**Not at classify:** enumerated verb lists (`grab`, `seize`, ...), fine **`operationKind`** taxonomy, or graph mutation proposals.

**Collision handling (prompt tie-breakers, not grammar):** e.g. **`get rocket skates`** -> **`AcmeOrder`**; in-room **`get the broom`** -> manipulation when object reads as present; **`take the south door`** -> **`NavigationIntent`**; targeted examine -> look family. Requires **in-room object catalog** in discriminate context (parallel to **`movementExitLabels`**) --- **D15** (Phase 1 gate).

---

## Phase gate cadence

Open decisions are tagged with the **earliest phase they block**. Work proceeds in this rhythm:

1. **Before starting Phase N:** every **Required** row with **Blocks phase = N** is **Decided** and recorded (here or in **Locked**).
2. **Phase N implementation:** code + tests for that lane seam; may include a **stub** terminal (e.g. **`WorldOOCMessage`**) until a later phase owns full behavior.
3. **Before starting Phase N+1:** repeat for the next phase's gate set.

**Gate** column: **Required** rows must be decided before that phase starts. **Advisory** rows inform design but do not block the phase checklist --- resolve them before the phase they most affect, or at graduation.

Phases map to lane seams: **1** classify, **2** enrich + resolve, **3** actions egress, **4** positions apply, **5** perception / transcript, **6** graduation.

---

## Target pipeline (draft)

Names are placeholders until stream contracts lock.

```text
command -> Parse Requested
       -> discriminate intent (ObjectManipulationIntent + raw object span(s))
       -> enrich (Bedrock: operationKind + proposal JSON from in-room context)
       -> deterministic resolve/ground (object id, legality checks)
       -> streamEvent intent (e.g. Object Manipulation Requested)
       -> positions apply coordinator (graph + adjacency transact)
       -> streamEvent fact (Object Moved extended and/or cross-host fact --- D8)
       -> perception emission (WorldMessage and/or fan-in cluster)
       -> affordance refresh (existing path)
```

Reference vertical: **character navigate** --- [`executeCharacterNavigate`](../../../../lambda/ephemera/dataSource/positions/navigate/executeCharacterNavigate.ts), [`membershipPresentationFanIn`](../../../../lambda/ephemera/dataSource/perception/membershipPresentationFanIn.ts).

---

## Scope boundaries

### In scope (this initiative)

- Diegetic operator design for **player-driven** object manipulation (classify: broad intent family; enrich: v1 **`takeHold`** / pick-up).
- **Fractal host graphs:** storage and apply for **`positionGraph`** on non-room hosts (v1: **`Meta::Character`** for held objects; Area / Object hosts deferred unless needed).
- Actions: new intent(s), enrich pipeline(s), stream contract, handler wiring.
- Positions: apply coordinator(s) for agreed graph mutations; contract updates.
- Perception: transcript copy for manipulation (minimal or fan-in --- TBD).
- Tests and durable doc graduation per [`diegeticLogic/AGENT.md` graduation rule](../../../../lambda/ephemera/diegeticLogic/AGENT.md#graduation-rule).

### Explicit deferrals

- **Client UI** for object manipulation (typed command only until otherwise decided).
- **Authored** (non-improvisation) object manipulation unless explicitly pulled into v1.
- **Coyote-specific** manipulation rules (separate from general play verbs).
- **`objects` lane** spawn/delete --- only if a verb **creates** or **destroys** existence; pure relocation stays positions.

### Already shipped (reuse, do not re-own)

| Concern | Location |
| --- | --- |
| Room-level object **nodes** + adjacency | [`applyObjectRoomMembership`](../../../../lambda/ephemera/dataSource/positions/membership/applyObjectRoomMembership.ts) --- **room host only** today |
| **`Object Moved`** fact | [`buildObjectMovedFact`](../../../../lambda/ephemera/dataSource/positions/membership/buildObjectMovedFact.ts), [`positions/AGENT.contract.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) |
| Spawn + place (Acme / API) | [`spawnAndPlaceImprovisationObject`](../../../../lambda/ephemera/dataSource/objects/spawnAndPlaceImprovisationObject.ts) |
| Affordance refresh on move | [`affordanceOrchestration`](../../../../lambda/ephemera/dataSource/affordanceOrchestration/index.ts) subscribes to **`Object Moved`** |

### Not shipped (this initiative must address)

- **`Meta::Character.positionGraph`** (and gateway/cache read path) for held objects.
- Cross-host apply: atomic **room -> character** graph transfer on pick up (extend [`positionGraphMerge`](../../../../lambda/ephemera/dataSource/positions/membership/positionGraphMerge.ts) / adjacency patterns).
- Relational in-room **edges** (`On`, `In`, ...) on room graphs --- slice 5+ per [`positions/AGENT.concepts.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md); defer unless a v1 verb requires them.
- Perception **membership-style fan-in** for object manipulation transcript.

### Deferred (later iterations)

- **`Meta::Area`** / **`Meta::Object`** host graphs beyond what v1 pick-up requires.
- Perspective-scoped play graph forks (asset-layer **`perspectiveKey`** as manipulation authority).

---

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in the owning **`AGENT.contract.md`** / **`AGENT.implementation.md`** (and graduate operator prose into **`diegeticLogic/`** or positions concepts) and remove the row here.

Sorted by **Blocks phase** (see [Phase gate cadence](#phase-gate-cadence)). **Next queue:** all Open **Required** rows where **Blocks phase = 1** (**D3**, **D15**).

### Decided (cross-phase)

| ID | Decision | Blocks phase | Status |
| --- | --- | --- | --- |
| **D1** | **v1 graph semantics** | 2+ | **Decided:** character-hosted graph (**C**); pick up = room -> character transfer (**L8**, **L9**). Options **A** / **D** out of v1; **B** superseded. |
| **D2** | **First-slice `operationKind`:** enrich implements **`takeHold`** (pick up) only; classify accepts broader manipulation family; drop / put-on return enrich-time **`Error`** or pass-through until later slices. | 2 | **Decided** |

### Open

| ID | Decision | Blocks phase | Gate | Status |
| --- | --- | --- | --- | --- |
| **D3** | **Classify contract:** confirm **`ObjectManipulationIntent`** + raw object span array field name/shape; tie-breaker rules vs Acme / Nav / Look; confidence thresholds. | 1 | Required | Open |
| **D15** | **Discriminate context:** inject in-room object labels (like **`movementExitLabels`**) to disambiguate manipulation vs Acme **`get`**. | 1 | Required | Open |
| **D5** | **Object resolution:** match by `shortName` only, `stableKey`, LLM-proposed label + deterministic disambiguation, or explicit id from UI later? | 2 | Required | Open |
| **D6** | **Which objects in v1:** improvisation `OBJECT#` only, or any graph-placed object? | 2 | Required | Open |
| **D7** | **Ambiguity policy:** fail closed with OOC error, pick best match above confidence threshold, or ask player (conversation path)? | 2 | Required | Open |
| **D14** | **Code layout:** `actions/enrich/objectManipulation/` vs generic enrich router; `positions/manipulation/` vs extend `membership/` | 2 | Required | Open |
| **D4** | **Stream contract name and payload** for actions egress (intent leg for perception fan-in?). | 3 | Required | Open |
| **D13** | **Trusted `Action Assessed` path** for manipulation (UI click) in v1 or parse-only? | 3 | Required | Open |
| **D16** | **`Meta::Character.positionGraph` storage:** row shape on **`Meta::Character`**, object **adjacency** when host is **`CHARACTER#`** (extend reverse index?), gateway/cache handler scope, steady-state one-object-per-hand rules. | 4 | Required | Open |
| **D8** | **Extend `Object Moved` fact** vs new fact type for relational / non-room-host changes? | 4 | Required | Open |
| **D9** | **Perception pattern:** immediate `WorldMessage`, new fan-in cluster (intent + fact), or enrich-generated copy streamed separately? | 5 | Required | Open |
| **D10** | **Transcript beat shape:** single line vs leave/place-style multi-line beat; `CreatedTime` / `OrchestrateMessages` policy | 5 | Required | Open |
| **D11** | **LLM hop count:** classify-only + deterministic template copy vs classify + enrich + optional copy hop | 5 | Required | Open |
| **D12** | **Unknowns policy** for unstated spatial detail (withhold vs elaborate in copy only) --- see [`diegeticLogic/AGENT.unknowns.concepts.md`](../../../../lambda/ephemera/diegeticLogic/AGENT.unknowns.concepts.md) | 5 | Required | Open |

### Advisory (inform; not phase gate checklist)

| ID | Decision | Informs phase | Status |
| --- | --- | --- | --- |
| **A1** | **Operator spec** in [`diegeticLogic/`](../../../../lambda/ephemera/diegeticLogic/AGENT.md) (`AGENT.operators.concepts.md` or section) --- graduate prose as operators ship. | 2--6 | Not started |
| **A2** | **Pre-flight legality** in actions (character must be in room with object) vs positions-only rejection. | 4 | Open |
| **A3** | **D4 / D8 envelope sketch** at intent + fact level --- avoid rework before Phase 3 egress wiring. | 3--4 | Open |

---

## Open questions (design --- not yet decision rows)

Broader threads to resolve into **D*** / **A*** rows or durable concepts as they mature.

- Should enrich see **full affordance WML** or a trimmed **object catalog** projection? (feeds **D6** / **D15**)
- Relationship to **`Objects Change`** API ingress --- shared apply path or separate?
- Multi-object commands: **`MultipleCommands`** vs single enrich with multiple deltas?
- Failure copy: **`WorldOOCMessage`** vs in-world **`WorldMessage`** for "you can't do that"?
- Classify accepts **`drop`** / **`put X on Y`** paraphrases while enrich v1 only implements take-hold --- covered by **D2** (enrich-time **`Error`**); confirm at Phase 2 gate.
- Tie-breaker ordering when manipulation and **`AcmeOrder`** both seem plausible on **`get <noun>`** --- covered by **D3** + **D15** at Phase 1 gate.

---

## v1 graph semantics (D1 --- decided)

**Direction:** **C --- character-hosted inventory graph** at **`Meta::Character.positionGraph`**, with **global play truth** on meta rows (**L8**). First operation: **`takeHold`** --- atomic transfer of an **`Object`** node from **`Meta::Room.positionGraph`** to **`Meta::Character.positionGraph`** (**L9**).

| Option | Verdict |
| --- | --- |
| **A. Relational edges** | Deferred (slice 5+) unless a v1 verb forces it |
| **B. Room host only** (`targetRoomId` / `null`) | Insufficient for pick up --- superseded by **C** for v1 |
| **C. Character inventory graph** | **Selected** --- storage design is **D16** |
| **D. Narrative-first** | Rejected for v1 |

---

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../AGENT.md) (durability ladder, open decisions litmus tests).
2. Read diegetic charter: [`lambda/ephemera/diegeticLogic/AGENT.md`](../../../../lambda/ephemera/diegeticLogic/AGENT.md), [`AGENT.concepts.md`](../../../../lambda/ephemera/diegeticLogic/AGENT.concepts.md).
3. Read positions today: [`dataSource/positions/AGENT.concepts.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) (graph roles, object nodes, deferred edges).
4. Read navigate reference pipeline: [`actions/AGENT.md`](../../../../lambda/ephemera/dataSource/actions/AGENT.md) (movement split), [`perception/AGENT.md`](../../../../lambda/ephemera/dataSource/perception/AGENT.md) (membership fan-in).
5. Read parse implementation guide: [`actions/AGENT.implementation.md`](../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md); Acme enrich pattern: [`actions/enrich/AGENT.md`](../../../../lambda/ephemera/dataSource/actions/enrich/AGENT.md).
6. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../lambda/ephemera/AGENT.testing.md) (Jest from `lambda/ephemera/`).
7. Baseline before edits (from `lambda/ephemera/`):

```bash
npm run test -- --watchAll=false dataSource/positions/membership/applyObjectRoomMembership.test.ts dataSource/actions/parseCommand.test.ts
npm run build
```

---

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines `[X]` as each sub-step finishes. Each phase begins with its **gate**: all **Required** open decisions for that phase must be **Decided** before implementation work under that phase starts.

- [ ] **Phase 1 --- classifier (semantic intent)**
  - [ ] **Gate:** **D3**, **D15** decided and recorded (classify contract + in-room object catalog in discriminate context).
  - [ ] Add **`ObjectManipulationIntent`** section to `buildIntentClassificationPrompt.ts` (primacy + examples, not synonym enumeration).
  - [ ] Thread in-room object catalog into discriminate deps (**D15**).
  - [ ] Wire `discriminateIntent/` guards and `baseClasses.ts` (raw object span array).
  - [ ] **`index.ts` stub:** terminal **`WorldOOCMessage`** for recognized manipulation intent until later phases own full behavior.
  - [ ] Tests: paraphrase fixtures (`pick up` / `grab` / `get the <in-room object>`), Acme vs manipulation collision cases, `Unimplemented` regression for out-of-family actions.

- [ ] **Phase 2 --- enrich + resolve**
  - [ ] **Gate:** **D5**, **D6**, **D7**, **D14** decided (**D2** already decided).
  - [ ] `actions/enrich/objectManipulation/` (or chosen layout per **D14**): prompt, JSON schema (**`operationKind`** + proposal), Bedrock invoke.
  - [ ] Deterministic grounding per **D5** / **D6** / **D7**.
  - [ ] Enrich-time terminal for unimplemented **`operationKind`**s (drop / put-on until later slices --- **D2**).
  - [ ] Tests with mocked Bedrock and room object fixtures.

- [ ] **Phase 3 --- actions egress**
  - [ ] **Gate:** **D4**, **D13** decided (optional **A3** envelope sketch).
  - [ ] `publishedEvents.ts` stream type + guards.
  - [ ] `index.ts` handler branch; correlate `ReturnValue` when `requestId` present.
  - [ ] Subscriber registration plan (positions execution ingress).

- [ ] **Phase 4 --- positions apply**
  - [ ] **Gate:** **D16**, **D8** decided (optional **A2** pre-flight legality).
  - [ ] **`Meta::Character.positionGraph`** persistence + read path (**D16**).
  - [ ] Cross-host coordinator: atomic room-remove + character-add on **`takeHold`**.
  - [ ] Contract updates in `positions/AGENT.contract.md` per **D8**.
  - [ ] Cache memo per gateway rules (`internalCache.Positions`).

- [ ] **Phase 5 --- perception / transcript**
  - [ ] **Gate:** **D9**, **D10**, **D11**, **D12** decided.
  - [ ] Emission plan (copy templates or fan-in spec per **D9**).
  - [ ] `PublishMessage` / `CreatedTime` policy per **D10**.
  - [ ] Integration test: command -> fact -> transcript row shape.

- [ ] **Phase 6 --- graduation**
  - [ ] Move normative rules out of this plan; update positions / actions / perception AGENT siblings.
  - [ ] Graduate operator prose (**A1**) into [`diegeticLogic/`](../../../../lambda/ephemera/diegeticLogic/AGENT.md) as needed.
  - [ ] Archive or delete this planning file.

---

## Progress

| Milestone | Status |
| --- | --- |
| `diegeticLogic/` doc stub | Done |
| Lane split agreement (L1--L9) | Done |
| Cross-phase decided (D1, D2) | Done |
| **Phase 1 gate** (D3, D15) | Open |
| Phase 1 classifier | Not started |
| Phase 2 gate (D5, D6, D7, D14) | Open |
| Phase 2 enrich + resolve | Not started |
| Phase 3 gate (D4, D13) | Open |
| Phase 3 actions egress | Not started |
| Phase 4 gate (D16, D8) | Open |
| Phase 4 positions apply | Not started |
| Phase 5 gate (D9--D12) | Open |
| Phase 5 perception / transcript | Not started |
| Phase 6 graduation | Not started |

---

## Verification

When implementation begins, extend this list per phase. Until then, baseline only:

From `lambda/ephemera/`:

```bash
npm run test -- --watchAll=false dataSource/positions/membership/applyObjectRoomMembership.test.ts dataSource/actions/parseCommand.test.ts
npm run build
```

Future slices (indicative):

- `dataSource/actions/discriminateIntent/intentClassification.test.ts`
- `dataSource/actions/index.test.ts`
- New enrich module tests under `dataSource/actions/enrich/`
- Positions manipulation coordinator tests
- Perception emission tests (fan-in or publish helper)

Command authority: [`lambda/ephemera/AGENT.testing.md`](../../../../lambda/ephemera/AGENT.testing.md).
