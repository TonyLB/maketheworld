# Position manipulation (diegetic logic) --- planning

**Status:** Design-only. No implementation slices started. **Next:** Phase 1 classifier implementation (**D3**, **D15**, **L11**, **L12** decided).

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../AGENT.md).

Durable concepts (not this file): [`lambda/ephemera/diegeticLogic/`](../../../../lambda/ephemera/diegeticLogic/AGENT.md).

Related parse framework (separate initiative): [`taskPlanning/lambda/ephemera/dataSource/actions/AGENT.actionParse.plan.md`](../dataSource/actions/AGENT.actionParse.plan.md).

---

## Purpose

End-to-end vertical slice: player **natural-language commands** that perform **simple atomic** object manipulation (v1: **`takeHold`** / pick-up) via `positionGraph` (and related indices), with results reflected in **affordances** and the **narrative transcript**. Enrich may recognize **complex** manipulation structure; processing that branch is **out of scope** here (see [Explicit deferrals](#explicit-deferrals)).

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
| **L10** | **Enrich disposition fork.** Manipulation enrich returns **`disposition: atomic`** (**`operationKind`** + proposal fields) or **`disposition: complex`** (**`complexityClass`** + optional summary). Only **atomic** proposals proceed through resolve, egress, and positions apply. **Complex** finalizes to a terminal parse outcome in v1 (enrich-time **`Error`** or equivalent OOC) --- **not** a stream event and **not** positions ingress. In-depth complex processing is **out of scope** for this plan; extend this plan or open a follow-on task plan after simple manipulation ships. |
| **L11** | **In-room object labels at classify (compose-stack read).** Discriminate prompt context for **`get <noun>`** vs **`AcmeOrder`** uses a **thin label projection** parallel to **`movementExitLabels`**: character's current room from **`Positions.getMembershipContainers`**; object ids from **`Positions.getPositionGraph`** + **`extractObjectIdsFromPlayPositionGraph`**; display strings from **`ImprovisationComponentData`** **`shortName`** per id (**L5**). Same read pattern as **`AffordanceRoomDeliverable`** object slice ([`affordanceRoomDeliverable.ts`](../../../../lambda/ephemera/internalCache/affordanceRoomDeliverable.ts)) and Coyote [`coyoteRoomObjectSnapshot.ts`](../../../../lambda/ephemera/dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot.ts). **Do not** denormalize object catalogs onto **`AffordanceCache`** rows. v1 labels: improvisation **`OBJECT#`** only unless **D6** expands scope. |
| **L12** | **Classify contract (no slots).** Discriminate returns **`ObjectManipulationIntent`** only: semantic intent + optional **raw object span strings** (mirror **`AcmeOrder`** / **`AcmeOrderIntent`**). **No** verb frames, **`operationKind`**, **`OBJECT#`** ids, or relational slots at classify --- those belong in enrich / resolve (**L7**, **D3**). Prompt context: **`movementObjectLabels`** (**L11**). **`get <noun>`** when **`<noun>`** is in **`movementObjectLabels`** beats **`AcmeOrder`**; explicit Acme re-order via **`order <noun>`** (or equivalent order verbs). **`confidence`** same register as other intents (required on payload; no downstream threshold logic in v1). |

---

## Parse pipeline: classify vs enrich

Matches existing **`AcmeOrderIntent`** -> **`enrichAcmeOrder`** split ([`parseCommand.ts`](../../../../lambda/ephemera/dataSource/actions/parseCommand.ts), [`enrich/AGENT.md`](../../../../lambda/ephemera/dataSource/actions/enrich/AGENT.md)).

| Stage | Question | Output (draft) |
| --- | --- | --- |
| **Discriminate** | Is the line **primarily** about manipulating a scene object (vs move, look, Acme order, ...)? | **`ObjectManipulationIntent`** + optional **raw object span(s)** (ungrounded strings, like **`AcmeOrder`** `orders`) |
| **Enrich** | Atomic operation and targets, or structurally complex? | **`disposition: atomic`** + **`operationKind`** + proposal fields, **or** **`disposition: complex`** + **`complexityClass`** (terminal stub in v1 --- **L10**) |
| **Resolve (deterministic)** | Legality, disambiguation, id match (**atomic only**) | Terminal parse result or **`Error`** |
| **Egress** | Intent for downstream lanes (**atomic only**) | Stream event -> positions -> perception |

**Not at classify:** enumerated verb lists (`grab`, `seize`, ...), fine **`operationKind`** taxonomy, or graph mutation proposals.

**Collision handling (prompt tie-breakers, not grammar):** e.g. in-room **`get the broom`** -> **`ObjectManipulationIntent`** when **`broom`** is in **`movementObjectLabels`** (**L12**); **`get rocket skates`** (not in room) -> **`AcmeOrder`**; explicit **`order <noun>`** for Acme when player wants a second copy of an in-room item; **`take the south door`** -> **`NavigationIntent`**; targeted examine -> look family (**D3**).

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
       -> enrich (Bedrock: disposition atomic | complex + proposal from in-room context)
       -> [complex] terminal parse stub (OOC / Error) --- out of scope beyond stub
       -> [atomic] deterministic resolve/ground (object id, legality checks)
       -> streamEvent intent (e.g. Object Manipulation Requested) --- atomic only
       -> positions apply coordinator (graph + adjacency transact)
       -> streamEvent fact (Object Moved extended and/or cross-host fact --- D8)
       -> perception emission (WorldMessage and/or fan-in cluster)
       -> affordance refresh (existing path)
```

Reference vertical: **character navigate** --- [`executeCharacterNavigate`](../../../../lambda/ephemera/dataSource/positions/navigate/executeCharacterNavigate.ts), [`membershipPresentationFanIn`](../../../../lambda/ephemera/dataSource/perception/membershipPresentationFanIn.ts).

---

## Scope boundaries

### In scope (this initiative)

- Diegetic operator design for **player-driven simple atomic** manipulation (classify: broad intent family; enrich: v1 **`takeHold`** / pick-up on the **atomic** path; **complex** disposition stub terminal only --- **L10**).
- **Fractal host graphs:** storage and apply for **`positionGraph`** on non-room hosts (v1: **`Meta::Character`** for held objects; Area / Object hosts deferred unless needed).
- Actions: new intent(s), enrich pipeline(s), stream contract, handler wiring.
- Positions: apply coordinator(s) for agreed graph mutations; contract updates.
- Perception: transcript copy for manipulation (minimal or fan-in --- TBD).
- Tests and durable doc graduation per [`diegeticLogic/AGENT.md` graduation rule](../../../../lambda/ephemera/diegeticLogic/AGENT.md#graduation-rule).

### Explicit deferrals

- **Complex manipulation processing** --- enrich **`disposition: complex`** (relational placement, multi-object deltas, contradictory spatial claims, second enrich hop, diegetic consistency algebra). This plan **recognizes** complex via enrich schema (**L10**) and **stubs** a terminal player outcome only. Full handling ships in a **follow-on task plan** (or a later revision of this plan) after simple atomic manipulation is working. Do not block Phases 3--5 on complex-path design.
- **`AffordanceCache` object-catalog denormalization** --- labels stay on improvisation/component reads; classify uses thin projection only (**L11**).
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
| Affordance compose object **`shortName`** slice | [`internalCache/affordanceRoomDeliverable.ts`](../../../../lambda/ephemera/internalCache/affordanceRoomDeliverable.ts), Coyote [`coyoteRoomObjectSnapshot.ts`](../../../../lambda/ephemera/dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot.ts) --- pattern for **D15** / **L11** |
| Affordance refresh on move | [`affordanceOrchestration`](../../../../lambda/ephemera/dataSource/affordanceOrchestration/index.ts) subscribes to **`Object Moved`** |

### Not shipped (this initiative must address)

- **`Meta::Character.positionGraph`** (and gateway/cache read path) for held objects.
- Cross-host apply: atomic **room -> character** graph transfer on pick up (extend [`positionGraphMerge`](../../../../lambda/ephemera/dataSource/positions/membership/positionGraphMerge.ts) / adjacency patterns).
- Relational in-room **edges** (`On`, `In`, ...) on room graphs --- **complex manipulation**; out of scope for this plan (see [Explicit deferrals](#explicit-deferrals)).
- Perception **membership-style fan-in** for object manipulation transcript.

### Deferred (later iterations)

- **`Meta::Area`** / **`Meta::Object`** host graphs beyond what v1 pick-up requires.
- Perspective-scoped play graph forks (asset-layer **`perspectiveKey`** as manipulation authority).

---

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in the owning **`AGENT.contract.md`** / **`AGENT.implementation.md`** (and graduate operator prose into **`diegeticLogic/`** or positions concepts) and remove the row here.

Sorted by **Blocks phase** (see [Phase gate cadence](#phase-gate-cadence)). **Phase 1 gate:** **Decided** (**D3**, **D15**). **Next queue:** Phase 1 implementation, then Phase 2 gates (**D5**, **D6**, **D7**, **D14**, **D17**).

### Decided (cross-phase)

| ID | Decision | Blocks phase | Status |
| --- | --- | --- | --- |
| **D1** | **v1 graph semantics** | 2+ | **Decided:** character-hosted graph (**C**); pick up = room -> character transfer (**L8**, **L9**). Options **A** / **D** out of v1; **B** superseded. |
| **D2** | **First-slice `operationKind`:** enrich implements **`takeHold`** (pick up) only on the **atomic** path; classify accepts broader manipulation family; other atomic **`operationKind`**s or **`disposition: complex`** finalize to terminal parse (**L10**). | 2 | **Decided** |
| **D3** | **Classify contract:** **`ObjectManipulationIntent`** + raw **`objectSpans`** (JSON) / **`rawObjectSpans`** (TS intent); no slots at classify; **`movementObjectLabels`** prompt context; tie-breakers per **L12**; **`confidence`** same register as other intents. | 1 | **Decided** |
| **D15** | **Discriminate in-room object labels:** thin compose-stack projection (**L11**); thread into classify prompt as **`movementObjectLabels`**; **not** **`AffordanceCache`** denormalization. | 1 | **Decided** |

### Open

| ID | Decision | Blocks phase | Gate | Status |
| --- | --- | --- | --- | --- |
| **D5** | **Object resolution:** match by `shortName` only, `stableKey`, LLM-proposed label + deterministic disambiguation, or explicit id from UI later? | 2 | Required | Open |
| **D6** | **Which objects in v1:** improvisation `OBJECT#` only, or any graph-placed object? | 2 | Required | Open |
| **D7** | **Ambiguity policy:** fail closed with OOC error, pick best match above confidence threshold, or ask player (conversation path)? | 2 | Required | Open |
| **D14** | **Code layout:** `actions/enrich/objectManipulation/` vs generic enrich router; `positions/manipulation/` vs extend `membership/` | 2 | Required | Open |
| **D17** | **Enrich disposition schema:** JSON field names for **`disposition`** (`atomic` \| `complex`), atomic proposal shape (**`operationKind`** + spans/ids), stub **`complexityClass`** vocabulary, finalize rules (atomic -> resolve; complex -> terminal OOC/**`Error`** --- no stream, no positions). | 2 | Required | Open |
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

- Should enrich reuse the same thin object-label projection as classify (**L11**), or a richer catalog? (feeds **D6**)
- Relationship to **`Objects Change`** API ingress --- shared apply path or separate?
- Failure copy: **`WorldOOCMessage`** vs in-world **`WorldMessage`** for "you can't do that" (including **complex** stub terminal)?
- Classify accepts **`drop`** / **`put X on Y`** paraphrases while enrich v1 only implements take-hold on the atomic path --- likely **`disposition: complex`** or enrich-time **`Error`** per **D2** / **L10**; confirm at Phase 2 gate (**D17**).
- Multi-object commands: **`MultipleCommands`** vs single enrich with multiple deltas --- if not **`MultipleCommands`**, treat as **complex** (out of scope beyond stub) unless decomposable to one atomic **`takeHold`**.

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

## Discriminate in-room object labels (D15 --- decided)

**Direction:** **L11** --- thin compose-stack projection for classify (and reuse for enrich context per **D6**).

| Step | Read |
| --- | --- |
| Current room | **`internalCache.Positions.getMembershipContainers(characterId)`** (same endpoint as [`getRoomExitTargetsForCharacter`](../../../../lambda/ephemera/dataSource/actions/roomExitTargetsForCharacter.ts)) |
| Object ids in room | **`internalCache.Positions.getPositionGraph(roomId)`** -> **`extractObjectIdsFromPlayPositionGraph`** |
| Display labels | **`internalCache.ImprovisationComponentData.get(objectId, IMPROVISATION_ASSET_ID)`** -> **`shortName`** (normalize for prompt like exit labels) |

**Implementation (Phase 1):** extend room context for parse (sibling to **`getRoomExitTargetsForCharacter`** or shared return shape); pass label list into **`buildIntentClassificationPrompt`** (prompt option parallel to **`movementExitLabels`**). Share **`objectReads`** deps with **`AffordanceRoomDeliverable`** where practical --- do **not** call full **`AffordanceRoomDeliverable.get`** on the parse path.

**Rejected:** persisting object label catalogs on **`AffordanceCache`** **`Affordance::${perspectiveKey}`** rows (staleness vs **`Object Moved`**; wrong authority boundary vs positions + improvisation bodies).

**v1 scope:** improvisation **`OBJECT#`** **`shortName`**s only unless **D6** expands to authored graph-placed objects (**ComponentAggregate** path).

---

## Classify contract (D3 --- decided)

**Direction:** **L12** --- mirror existing intent-discrimination patterns (**`AcmeOrder`** / **`NavigationIntent`**); **no** slot extraction or grounding at classify.

### Model JSON (discriminate Bedrock response)

```json
{ "type": "ObjectManipulationIntent", "objectSpans": ["<raw span>", ...], "confidence": <number> }
```

| Field | Rule |
| --- | --- |
| **`type`** | Exactly **`ObjectManipulationIntent`**. |
| **`objectSpans`** | Non-empty array of **raw** strings when the line names object(s); strip leading articles; trim whitespace. **Unvalidated** extractions only (like **`AcmeOrder`** **`orders`**) --- no **`OBJECT#`**, no **`operationKind`**, no relational frames. May be a single span for **`pick up the broom`**. Omit slot grammar (`$1` / `$2`, "tie A to B" structure) --- enrich owns that. |
| **`confidence`** | Required number; same validation register as other intents (**`isParseCommand*`** guards). No v1 downstream threshold behavior. |

### TypeScript intent (after interpret)

Mirror **`AcmeOrderIntent`**: discriminant **`ObjectManipulationIntent`** with **`rawObjectSpans: string[]`** (mapped from JSON **`objectSpans`**). Intent-only --- **`parseCommand`** does not enrich manipulation in Phase 1 (stub terminal in **`index.ts`**).

**Forbidden at classify** (reject with **`Error`** if present): **`operationKind`**, **`disposition`**, **`objectId`** / **`targetId`**, room-id routing fields, graph proposal fields.

### Prompt context

- Option **`movementObjectLabels`** on **`buildIntentClassificationPrompt`** (parallel to **`movementExitLabels`**) --- populated from **L11** / **D15**.
- Section in prompt: when to choose **`ObjectManipulationIntent`** vs neighbors; paraphrase examples, not verb whitelist (**L7**).

### Tie-breakers (prompt policy)

| Situation | Prefer |
| --- | --- |
| **`get <noun>`** and **`<noun>`** matches an entry in **`movementObjectLabels`** | **`ObjectManipulationIntent`** over **`AcmeOrder`** |
| **`get <noun>`** and **`<noun>`** is **not** in room labels (e.g. **`get rocket skates`**) | **`AcmeOrder`** |
| Player wants Acme delivery of something already in the room | **`order <noun>`** (or other explicit order verbs) -> **`AcmeOrder`** |
| **`take the south door`** / exit movement | **`NavigationIntent`** (unchanged) |
| Targeted examine | Look family (unchanged) |

**Not at classify:** resolving whether **`objectSpans`** match a unique in-room object --- **D5** / **D7** at enrich + resolve.

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
  - [X] **Gate:** **D3**, **D15** decided (**L11**, **L12**).
  - [ ] Add **`ObjectManipulationIntent`** section to `buildIntentClassificationPrompt.ts` per **D3** / **L12** (primacy + examples, not verb whitelist).
  - [ ] Thin in-room object label projection per **L11**; pass as **`movementObjectLabels`** into classify prompt.
  - [ ] Wire `discriminateIntent/` guards and `baseClasses.ts` (**`ObjectManipulationIntent`**, **`rawObjectSpans`**, forbidden-field checks).
  - [ ] **`index.ts` stub:** terminal **`WorldOOCMessage`** for recognized manipulation intent until later phases own full behavior.
  - [ ] Tests: paraphrase fixtures (`pick up` / `grab` / `get the <in-room object>`), Acme vs manipulation collision cases, `Unimplemented` regression for out-of-family actions.

- [ ] **Phase 2 --- enrich + resolve (atomic path + complex stub)**
  - [ ] **Gate:** **D5**, **D6**, **D7**, **D14**, **D17** decided (**D2**, **L10** already decided).
  - [ ] `actions/enrich/objectManipulation/` (or chosen layout per **D14**): prompt, JSON schema per **D17** (**`disposition`**, atomic proposal fields, **`complexityClass`** stub).
  - [ ] Bedrock invoke + interpret/finalize: **`disposition: atomic`** -> resolve; **`disposition: complex`** -> terminal OOC/**`Error`** (no stream, no positions --- complex processing **out of scope**).
  - [ ] Deterministic grounding per **D5** / **D6** / **D7** (**atomic only**).
  - [ ] Enrich-time terminal for unimplemented atomic **`operationKind`**s (drop / put-on until later slices --- **D2**).
  - [ ] Tests with mocked Bedrock and room object fixtures (atomic **`takeHold`** success path; **`disposition: complex`** stub terminal; unimplemented **`operationKind`** on atomic path).

- [ ] **Phase 3 --- actions egress (atomic intents only)**
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
| Lane split agreement (L1--L12) | Done |
| Cross-phase decided (D1, D2, D3, D15) | Done |
| In-room label read path (L11) | Decided (compose-stack projection) |
| Classify contract (L12, D3) | Decided (no slots; **`movementObjectLabels`**) |
| **Phase 1 gate** | Decided |
| Phase 1 classifier | Not started |
| Phase 2 gate (D5, D6, D7, D14, D17) | Open |
| Enrich disposition direction (L10) | Decided (complex out of scope beyond stub) |
| Phase 2 enrich + resolve (atomic + complex stub) | Not started |
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
