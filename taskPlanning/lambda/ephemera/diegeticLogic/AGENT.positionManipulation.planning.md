# Position manipulation (diegetic logic) --- planning

**Status:** Design-only. No implementation slices started. **Next:** lock **D16** (character `positionGraph` storage) and **D3** classify contract; then Phase 0 operator spec in `diegeticLogic/`.

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

**Collision handling (prompt tie-breakers, not grammar):** e.g. **`get rocket skates`** -> **`AcmeOrder`**; in-room **`get the broom`** -> manipulation when object reads as present; **`take the south door`** -> **`NavigationIntent`**; targeted examine -> look family. May need **in-room object catalog** in discriminate context (parallel to **`movementExitLabels`**) --- see **D15**.

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

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| **D1** | **v1 graph semantics** | All implementation | **Decided:** character-hosted graph (**C**); pick up = room -> character transfer (**L8**, **L9**). Options **A** / **D** out of v1; **B** superseded. |
| **D2** | **First-slice `operationKind`:** enrich implements **`takeHold`** (pick up) only; classify accepts broader manipulation family; drop / put-on return enrich-time **`Error`** or pass-through until later slices. | Enrich prompt, positions apply | **Decided** |
| **D3** | **Classify contract:** confirm **`ObjectManipulationIntent`** + raw object span array field name/shape; tie-breaker rules vs Acme / Nav / Look; confidence thresholds. | `discriminateIntent/`, `baseClasses.ts` | Open |
| **D4** | **Stream contract name and payload** for actions egress (intent leg for perception fan-in?). | actions + downstream subscribers | Open |
| **D5** | **Object resolution:** match by `shortName` only, `stableKey`, LLM-proposed label + deterministic disambiguation, or explicit id from UI later? | Enrich + resolve step | Open |
| **D6** | **Which objects in v1:** improvisation `OBJECT#` only, or any graph-placed object? | Enrich context assembly | Open |
| **D7** | **Ambiguity policy:** fail closed with OOC error, pick best match above confidence threshold, or ask player (conversation path)? | actions + client | Open |
| **D8** | **Extend `Object Moved` fact** vs new fact type for relational / non-room-host changes? | positions + perception adapters | Open |
| **D9** | **Perception pattern:** immediate `WorldMessage`, new fan-in cluster (intent + fact), or enrich-generated copy streamed separately? | perception | Open |
| **D10** | **Transcript beat shape:** single line vs leave/place-style multi-line beat; `CreatedTime` / `OrchestrateMessages` policy | perception + [`AGENT.narrativeTranscript.concepts.md`](../../../../lambda/ephemera/AGENT.narrativeTranscript.concepts.md) | Open |
| **D11** | **LLM hop count:** classify-only + deterministic template copy vs classify + enrich + optional copy hop | actions + perception | Open |
| **D12** | **Unknowns policy** for unstated spatial detail (withhold vs elaborate in copy only) --- see [`diegeticLogic/AGENT.unknowns.concepts.md`](../../../../lambda/ephemera/diegeticLogic/AGENT.unknowns.concepts.md) | enrich + perception | Open |
| **D13** | **Trusted `Action Assessed` path** for manipulation (UI click) in v1 or parse-only? | actions ingress | Open |
| **D14** | **Code layout:** `actions/enrich/objectManipulation/` vs generic enrich router; `positions/manipulation/` vs extend `membership/` | Implementation | Open |
| **D15** | **Discriminate context:** inject in-room object labels (like **`movementExitLabels`**) to disambiguate manipulation vs Acme **`get`**? | Classifier prompt + `parseCommand` deps | Open |
| **D16** | **`Meta::Character.positionGraph` storage:** row shape on **`Meta::Character`**, object **adjacency** when host is **`CHARACTER#`** (extend reverse index?), gateway/cache handler scope, steady-state one-object-per-hand rules. | Phase 4 positions apply | Open |

---

## Open questions (design --- not yet decision rows)

Broader threads to resolve into **D*** rows or durable concepts as they mature.

- Do we need **pre-flight legality** in actions (character must be in room with object) vs positions-only rejection?
- Should enrich see **full affordance WML** or a trimmed **object catalog** projection?
- Relationship to **`Objects Change`** API ingress --- shared apply path or separate?
- Multi-object commands: **`MultipleCommands`** vs single enrich with multiple deltas?
- Failure copy: **`WorldOOCMessage`** vs in-world **`WorldMessage`** for "you can't do that"?
- Classify accepts **`drop`** / **`put X on Y`** paraphrases while enrich v1 only implements take-hold --- terminal **`Unimplemented`** vs enrich-time **`Error`**?
- Tie-breaker ordering when manipulation and **`AcmeOrder`** both seem plausible on **`get <noun>`**.

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

Use `[ ]` for pending and `[X]` for complete. Mark nested lines `[X]` as each sub-step finishes.

- [ ] **Phase 0 --- design lock (diegeticLogic + this plan)**
  - [X] Resolve **D1** and **D2** (character host graph + **`takeHold`**); recorded in **Locked** and v1 semantics section.
  - [ ] Resolve **D16** (`Meta::Character.positionGraph` + adjacency).
  - [ ] Lock **D3** classify JSON shape and tie-breakers (intent + raw spans; no verb whitelist).
  - [ ] Draft operator spec in [`diegeticLogic/`](../../../../lambda/ephemera/diegeticLogic/AGENT.md) (new `AGENT.operators.concepts.md` or section --- durable, not plan-only).
  - [ ] Sketch stream payload (**D4**) and fact shape (**D8**) at envelope level.
  - [ ] Resolve **D9** / **D10** at least enough for perception slice sizing.

- [ ] **Phase 1 --- classifier (semantic intent)**
  - [ ] Add **`ObjectManipulationIntent`** section to `buildIntentClassificationPrompt.ts` (primacy + examples, not synonym enumeration).
  - [ ] Optional **D15**: thread in-room object catalog into discriminate deps.
  - [ ] Wire `discriminateIntent/` guards and `baseClasses.ts` (raw object span array).
  - [ ] Tests: paraphrase fixtures (`pick up` / `grab` / `get the <in-room object>`), Acme vs manipulation collision cases, `Unimplemented` regression for out-of-family actions.

- [ ] **Phase 2 --- enrich + resolve**
  - [ ] `actions/enrich/objectManipulation/` (or chosen layout): prompt, JSON schema (**`operationKind`** + proposal), Bedrock invoke.
  - [ ] Deterministic grounding (**D5**, **D6**, **D7**).
  - [ ] Tests with mocked Bedrock and room object fixtures.

- [ ] **Phase 3 --- actions egress**
  - [ ] `publishedEvents.ts` stream type + guards.
  - [ ] `index.ts` handler branch; correlate `ReturnValue` when `requestId` present.
  - [ ] Subscriber registration plan (positions execution ingress).

- [ ] **Phase 4 --- positions apply**
  - [ ] **`Meta::Character.positionGraph`** persistence + read path (**D16**).
  - [ ] Cross-host coordinator: atomic room-remove + character-add on **`takeHold`**.
  - [ ] Contract updates in `positions/AGENT.contract.md` (extend **`Object Moved`** or new fact --- **D8**).
  - [ ] Cache memo per gateway rules (`internalCache.Positions`).

- [ ] **Phase 5 --- perception / transcript**
  - [ ] Emission plan (copy templates or fan-in spec).
  - [ ] `PublishMessage` / `CreatedTime` policy.
  - [ ] Integration test: command -> fact -> transcript row shape.

- [ ] **Phase 6 --- graduation**
  - [ ] Move normative rules out of this plan; update positions / actions / perception AGENT siblings.
  - [ ] Archive or delete this planning file.

---

## Progress

| Milestone | Status |
| --- | --- |
| `diegeticLogic/` doc stub | Done |
| Lane split agreement (L1--L9) | Done |
| v1 graph semantics (D1) | Decided (character host) |
| First-slice operationKind (D2) | Decided (`takeHold`) |
| Character graph storage (D16) | Open |
| Classify intent contract (D3) | Open |
| Classifier slice | Not started |
| Enrich slice | Not started |
| Positions apply | Not started |
| Perception transcript | Not started |

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
