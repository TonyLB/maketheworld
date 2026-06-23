# Position manipulation (diegetic logic) --- planning

**Status:** Phase 4 positions apply shipped. **Next:** Phase 5 perception / transcript.

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
| **L11** | **In-room object labels at classify (compose-stack read).** Discriminate prompt context for **`get <noun>`** vs **`AcmeOrder`** uses a **thin label projection** parallel to **`movementExitLabels`**: character's current room from **`Positions.getMembershipContainers`**; object ids from **`Positions.getPositionGraph`** + **`extractObjectIdsFromPlayPositionGraph`**; display strings from merged component layers (**`ComponentAggregate`** + **`appendImprovisationToPerspective`** when in scope) -> **`shortName`** per id (**L5**, **D6**). Same read pattern as **`AffordanceRoomDeliverable`** object slice ([`affordanceRoomDeliverable.ts`](../../../../lambda/ephemera/internalCache/affordanceRoomDeliverable.ts)) and Coyote [`coyoteRoomObjectSnapshot.ts`](../../../../lambda/ephemera/dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot.ts). **Do not** denormalize object catalogs onto **`AffordanceCache`** rows. v1 scope: **any graph-placed object** in the room graph (**D6**). Phase 1 shipped improvisation-only projection; align with merged-layer reads at Phase 2. |
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

## Target pipeline

```text
command -> Parse Requested
       -> discriminate intent (ObjectManipulationIntent + raw object span(s))
       -> enrich (Bedrock: disposition atomic | complex + proposal from in-room context)
       -> [complex] terminal parse stub (OOC / Error) --- out of scope beyond stub
       -> [atomic] deterministic resolve/ground (object id, legality checks)
       -> streamEvent intent (**Object Take Hold** --- atomic **`takeHold`** only; **D4**)
       -> positions apply coordinator (graph + adjacency transact)
       -> streamEvent fact (**Object Moved** extended for non-room membership hosts --- **D8**)
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
- Cross-host apply: atomic **room -> character** graph transfer on pick up under **`positions/manipulation/membership/`** (reuse [`positionGraphMerge`](../../../../lambda/ephemera/dataSource/positions/membership/positionGraphMerge.ts) / adjacency patterns from room-only **`positions/membership/`**).
- Relational in-room **edges** (`On`, `In`, ...) on room graphs --- **complex manipulation**; out of scope for this plan (see [Explicit deferrals](#explicit-deferrals)).
- Perception **membership-style fan-in** for object manipulation transcript.

### Deferred (later iterations)

- **`Meta::Area`** / **`Meta::Object`** host graphs beyond what v1 pick-up requires.
- **Nested containment, scene discovery, and dynamic closures** --- design direction in [Future direction: nested containment and dynamic closures](#future-direction-nested-containment-and-dynamic-closures-post-vertical); does **not** block Phases 2--5 or the first **`takeHold`** vertical.
- Perspective-scoped play graph forks (asset-layer **`perspectiveKey`** as manipulation authority).
- **Additional atomic `operationKind`s** (`drop`, relational attach, ...) --- enrich schema is extensible (**D17**), but only **`takeHold`** is implemented through resolve, egress, and positions in this initiative; next membership mirror (e.g. **`drop`**) ships after the pick-up vertical is proven end-to-end.
- **Ambiguity conversation path** --- player disambiguation when object resolution is unclear (**D7**); v1 fails closed with OOC error.
- **Carrying capacity rules** --- no v1 **`one-object-per-hand`**, weight, or volume limits (**D16**); defer until a follow-on initiative.

---

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in the owning **`AGENT.contract.md`** / **`AGENT.implementation.md`** (and graduate operator prose into **`diegeticLogic/`** or positions concepts) and remove the row here.

Sorted by **Blocks phase** (see [Phase gate cadence](#phase-gate-cadence)). **Phase 1 gate:** **Decided** (**D3**, **D15**). **Phase 2 gate:** **Decided** (**D5**, **D6**, **D7**, **D14**, **D17**). **Phase 3 gate:** **Decided** (**D4**, **D13**). **Phase 4 gate:** **Decided** (**D16**, **D8**).

### Decided (cross-phase)

| ID | Decision | Blocks phase | Status |
| --- | --- | --- | --- |
| **D1** | **v1 graph semantics** | 2+ | **Decided:** character-hosted graph (**C**); pick up = room -> character transfer (**L8**, **L9**). Options **A** / **D** out of v1; **B** superseded. |
| **D2** | **First-slice `operationKind`:** enrich implements **`takeHold`** (pick up) only on the **atomic** path; classify accepts broader manipulation family; other atomic **`operationKind`**s or **`disposition: complex`** finalize to terminal parse (**L10**). | 2 | **Decided** |
| **D3** | **Classify contract:** **`ObjectManipulationIntent`** + raw **`objectSpans`** (JSON) / **`rawObjectSpans`** (TS intent); no slots at classify; **`movementObjectLabels`** prompt context; tie-breakers per **L12**; **`confidence`** same register as other intents. | 1 | **Decided** |
| **D15** | **Discriminate in-room object labels:** thin compose-stack projection (**L11**); thread into classify prompt as **`movementObjectLabels`**; **not** **`AffordanceCache`** denormalization. | 1 | **Decided** |
| **D5** | **Object resolution:** match player span to in-room object by **`shortName`** (normalized); synonyms and paraphrase acceptable at enrich/classify via LLM, but deterministic resolve grounds to a single **`OBJECT#`** by **`shortName`** match only --- not **`stableKey`**, not UI id in v1. | 2 | **Decided** |
| **D6** | **Which objects in v1:** any **graph-placed** object in the room **`positionGraph`**; derive **`shortName`** from merged component layers (authored participation stack + improvisation via **`ComponentAggregate`** / **`appendImprovisationToPerspective`**), not improvisation-only reads. | 2 | **Decided** |
| **D7** | **Ambiguity policy:** **fail closed** with OOC error when resolve cannot pick a unique object; no confidence-threshold best-guess in v1. Conversation / ask-player disambiguation deferred. | 2 | **Decided** |
| **D14** | **Code layout:** **`actions/enrich/objectManipulation/`** for enrich + resolve (dedicated module, not generic enrich router only). Positions apply under new **`positions/manipulation/`** tree: **`membership/`** for cross-host graph transfers (room <-> character, etc.); **`relationships/`** reserved for relational edge apply (deferred beyond v1 atomic pick-up). Reuse **`membership/`** primitives (e.g. **`positionGraphMerge`**) where appropriate --- do not fold manipulation coordinators into existing room-only **`positions/membership/`** apply entry points. | 2 | **Decided** |
| **D17** | **Enrich disposition schema:** thin vertical --- extensible **`operationKind`**, v1 implements **`takeHold`** only on the atomic path; **`disposition: complex`** stub vocabulary; finalize rules per [Enrich disposition schema (D17)](#enrich-disposition-schema-d17---decided). | 2 | **Decided** |
| **D4** | **Stream contract:** **`Object Take Hold`** on **`mtw.ephemera.actions`**; payload **`characterId`**, **`objectId`**, **`roomId`** (source room at egress), optional **`confidence`**. Mirrors **`Character Navigate`** grounded-id pattern; pairs with positions **`Object Moved`** fact family (**D8**). See [Actions egress intent (D4)](#actions-egress-intent-d4---decided). | 3 | **Decided** |
| **D13** | **Trusted ingress:** **parse-only** for v1 --- **`Parse Requested`** only; no **`Action Assessed`** manipulation branch until a trusted UI path is designed. | 3 | **Decided** |
| **D16** | **Fractal host `positionGraph` storage:** row shape parallel to **`Meta::Room`** on any eligible component meta; adjacency parallel to room-host reverse index; extend existing **`createPositionsCacheHandler`** / **`internalCache.Positions`** for forward graph + adjacency on eligible hosts; **no** v1 carrying limits. See [Host positionGraph storage (D16)](#host-positiongraph-storage-d16---decided). | 4 | **Decided** |
| **D8** | **Fact contract:** **extend** existing **`Object Moved`** for **non-room membership hosts** (v1: room -> character on **`takeHold`**); **do not** extend for **relational** edge changes yet. See [`Object Moved` fact (D8)](#object-moved-fact-d8---decided). | 4 | **Decided** |

### Open

| ID | Decision | Blocks phase | Gate | Status |
| --- | --- | --- | --- | --- |
| **D9** | **Perception pattern:** immediate `WorldMessage`, new fan-in cluster (intent + fact), or enrich-generated copy streamed separately? | 5 | Required | Open |
| **D10** | **Transcript beat shape:** single line vs leave/place-style multi-line beat; `CreatedTime` / `OrchestrateMessages` policy | 5 | Required | Open |
| **D11** | **LLM hop count:** classify-only + deterministic template copy vs classify + enrich + optional copy hop | 5 | Required | Open |
| **D12** | **Unknowns policy** for unstated spatial detail (withhold vs elaborate in copy only) --- see [`diegeticLogic/AGENT.unknowns.concepts.md`](../../../../lambda/ephemera/diegeticLogic/AGENT.unknowns.concepts.md) | 5 | Required | Open |

### Advisory (inform; not phase gate checklist)

| ID | Decision | Informs phase | Status |
| --- | --- | --- | --- |
| **A1** | **Operator spec** in [`diegeticLogic/`](../../../../lambda/ephemera/diegeticLogic/AGENT.md) (`AGENT.operators.concepts.md` or section) --- graduate prose as operators ship. | 2--6 | Not started |
| **A2** | **Pre-flight legality** in actions (character must be in room with object) vs positions-only rejection. | 4 | Open |
| **A3** | **D4 / D8 envelope sketch** at intent + fact level --- avoid rework before Phase 3 egress wiring. | 3--4 | Decided (**D4**, **D8**) |
| **A4** | **Nested containment + dynamic closures** --- graduate [future direction](#future-direction-nested-containment-and-dynamic-closures-post-vertical) into durable concepts when container-host / relational slices ship; v1 flat room nodes remain valid. | post-vertical | Documented |

---

## Open questions (design --- not yet decision rows)

Broader threads to resolve into **D*** / **A*** rows or durable concepts as they mature.

- Enrich/resolve object catalog: same merged-layer **`shortName`** projection as classify (**L11**, **D6**), plus id grounding map for **D5** resolve.
- Relationship to **`Objects Change`** API ingress --- shared apply path or separate?
- Failure copy: **`WorldOOCMessage`** vs in-world **`WorldMessage`** for "you can't do that" (including **complex** stub terminal)?
- **`drop`** / **`put X on Y`** at classify: enrich routes **`put X on Y`** and multi-object lines to **`disposition: complex`**; unrecognized or unimplemented atomic **`operationKind`**s (including **`drop`** in v1) -> terminal OOC per **D17**.
- Multi-object commands: **`MultipleCommands`** vs single enrich with multiple deltas --- if not **`MultipleCommands`**, treat as **complex** (out of scope beyond stub) unless decomposable to one atomic **`takeHold`**.
- Graduate [nested containment and dynamic closures](#future-direction-nested-containment-and-dynamic-closures-post-vertical) into **`diegeticLogic/`** concepts and positions **`AGENT.concepts.md`** when relational / container-host manipulation ships.

---

## Future direction: nested containment and dynamic closures (post-vertical)

**Status:** Design direction only --- **not** a Phase 2--5 gate. Documents how later slices can represent deeper structure **without** dual-authority containment or a monolithic room closure, so the first **`takeHold`** vertical (flat room object nodes per **D6**) does not paint the project into a corner.

Cross-links: fractal hosts in [`positions/AGENT.concepts.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#fractal-position-graphs-container-scale-and-edges); unknowns / elaborate vs assert in [`diegeticLogic/AGENT.unknowns.concepts.md`](../../../../lambda/ephemera/diegeticLogic/AGENT.unknowns.concepts.md).

### Problem (why this section exists)

v1 treats in-room objects as **top-level nodes** on **`Meta::Room.positionGraph`** (**D6**, [`roomObjectLabelsForCharacter.ts`](../../../../lambda/ephemera/dataSource/actions/roomObjectLabelsForCharacter.ts)). That is sufficient for **`takeHold`** on loose objects. Later we expect:

- **Nested portable containment** (candlestick **in** bookshelf **in** room) --- membership on the **container host**, not duplicated on the room.
- **Non-local extent** (thread managed at Area scope, **present** in a hallway via relational claims) --- mutation authority **not** the same as room membership.
- **Parse / enrich discovery** (`get candlestick`) over **deep or wide** trees without unbounded read-time graph walks or massive write-time room indexes.

### Authority invariants (do not violate in later slices)

| Invariant | Rule |
| --- | --- |
| **Single membership host** | Each **`OBJECT#`** has exactly one direct container at steady state (room, character inventory, or parent object host). **Forbidden:** same object as a room node **and** nested on a container host (bookcase-move / candlestick-in-two-rooms drift). |
| **Mutation authority** | One apply path judges and commits changes to an object (or coordinated transact for host + subtree). Mirrors characters today: managed at **`Meta::Character`**, **present** as a node on the room graph. |
| **Presence vs membership** | Multi-place **story** (thread through a labyrinth) uses **presence / relational** claims or **unknowns** --- not duplicate membership hosts. |
| **Closures are derived** | Scene **closures** are read optimizations only; **stored host `positionGraph` wins** (same register as graph vs adjacency **S2-5**). Apply never mutates through a closure row. |

### Canonical storage (target, not v1)

- **Room graph:** top-level scene anchors (characters, loose objects, container objects such as bookshelves) --- not every nested leaf.
- **Container host graph:** nested members on **`Meta::Object.positionGraph`** (and **`Meta::Character.positionGraph`** for inventory per **L9** / **D16**).
- **Adjacency:** direct host only per contained id (`POSITION#${immediateHost}`); eligible hosts include **`ROOM#`**, **`CHARACTER#`**, and later **`OBJECT#`** / **`AREA#`** per **D16** (extend parsers beyond room-only SK validation when character / object hosts ship).
- **Relational edges** (`On`, `In`, `Span`, ...): room- or host-scoped **among co-present members** or for area-managed extent --- **`positions/manipulation/relationships/`** (deferred).

### Dynamic closures (fetch optimization seam)

**Closure** --- per-host **derived** index of reachable **`OBJECT#`** ids for discoverability (parse **`movementObjectLabels`**, enrich catalog, affordance object slice), without redefining manipulation truth.

**Not every container is equal:** closure materialization is **tiered and dynamic**, not an all-or-nothing room flatten.

| Scene shape | Closure strategy | Read pattern (illustrative) |
| --- | --- | --- |
| **Shallow** (room, table, one candlestick) | **Room closure** lists terminal ids (full flatten under room) | One closure read -> labels |
| **Wide** (library, many bookshelves x many books) | **Room closure** lists **container boundaries** only; **per-shelf closure** lists book ids | Room closure + parallel shelf closures --- O(boundaries), not O(all leaves) on the room row |
| **Deep single branch** | Promote into ancestor closure when subtree size / depth is below a threshold; otherwise stop at a boundary host | Bounded hops; policy at apply or lazy rebuild |

Illustrative closure shape (names TBD at implementation):

```ts
type SceneClosure = {
  terminalObjectIds: EphemeraObjectId[]  // fully listed under this host
  containerIds: EphemeraObjectId[]       // fetch child closure next (boundary hosts)
}
```

**Materialization policy (TBD):** thresholds on child count / depth, explicit author "closure boundary" on a container, or lazy first-read build. **Write path:** patch or invalidate closures when host **`positionGraph`** or adjacency changes (book moves between shelves updates shelf closures; room closure unchanged).

**Rejected for this direction:** alternate **authoritative** encodings of the same containment fact (room edges **and** nested host membership for the same object); monolithic room closure of every leaf in a large library (write amplification on every in-shelf move).

### v1 compatibility (explicit non-regression)

The first vertical **does not** implement nested hosts, object **`getPositionGraph`**, extended adjacency hosts, or scene closures. It **may** assume:

- Objects targeted by **`takeHold`** are **top-level** room graph nodes (**D6**).
- Nested / relational lines route to **`disposition: complex`** (**L10**, **D17**).

Later work adds host graphs, closure maintenance, and expanded label projection **without** changing the v1 single-host pick-up contract for loose in-room objects.

### Graduation (when relational / container manipulation ships)

Move normative rules to **`diegeticLogic/AGENT.concepts.md`** (vocabulary: membership host, mutation authority, presence, closure boundary) and **`positions/AGENT.concepts.md`** / **`AGENT.contract.md`** (closure invalidation, adjacency host kinds). Remove or shorten this section per [task plan disposal](../../../AGENT.md).

---

## v1 graph semantics (D1 --- decided)

**Direction:** **C --- character-hosted inventory graph** at **`Meta::Character.positionGraph`**, with **global play truth** on meta rows (**L8**). First operation: **`takeHold`** --- atomic transfer of an **`Object`** node from **`Meta::Room.positionGraph`** to **`Meta::Character.positionGraph`** (**L9**).

| Option | Verdict |
| --- | --- |
| **A. Relational edges** | Deferred (slice 5+) unless a v1 verb forces it |
| **B. Room host only** (`targetRoomId` / `null`) | Insufficient for pick up --- superseded by **C** for v1 |
| **C. Character inventory graph** | **Selected** --- storage design **D16** (**decided**) |
| **D. Narrative-first** | Rejected for v1 |

---

## Host positionGraph storage (D16 --- decided)

**Direction:** **General fractal-host pattern** parallel to **`Meta::Room`** (**L8**). v1 lands **`Meta::Character.positionGraph`** for **`takeHold`** inventory; **`Meta::Object`**, **`Meta::Area`**, and other eligible hosts reuse the **same** row shape and read path when those slices ship --- not a one-off character schema.

### Forward meta row (parallel to room)

| Concern | Rule |
| --- | --- |
| **Row** | **`Meta::${ComponentTag}`** on the host component's ephemera id (same register as **`Meta::Room`**) |
| **`positionGraph` field** | Optional **`EphemeraPlayPositionGraph`** --- `{ nodes?, edges? }` --- identical type and node conventions as room hosts ([`EphemeraMetaRoom.positionGraph`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)) |
| **v1 nodes on character host** | **`Object`** membership nodes only (`{ tag: 'Object', universalKey }`) for held inventory |
| **Edges** | Absent or `[]` until relational / in-host edges ship (same deferral as room in-room edges) |

**Rejected:** a character-specific graph envelope or alternate node encoding; duplicating room graph types under a new name.

### Reverse adjacency (parallel to room)

| Concern | Rule |
| --- | --- |
| **Pattern** | Same adjacency index as today: PK = contained component (`OBJECT#`, `CHARACTER#`, ...); SK = **`POSITION#${hostEphemeraId}`** |
| **Host id** | **`hostEphemeraId`** is any eligible membership host --- v1 adds **`CHARACTER#...`** alongside existing **`ROOM#...`**; later **`OBJECT#`**, **`AREA#`** without a new index design |
| **Implementation** | Extend existing parsers / gateway reads (e.g. **`parsePositionAdjacencyDataCategory`**, **`getMembershipContainers`**) to accept non-room host ids --- not a parallel adjacency table |

### Gateway / cache handler

| Concern | Rule |
| --- | --- |
| **Handler** | Extend existing **`createPositionsCacheHandler`** / **`internalCache.Positions`** ([`packages/mtw-gateways/ts/ephemera/positions/`](../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md)) --- **do not** add a separate character-inventory handler |
| **`getPositionGraph(componentId)`** | Real Dynamo forward read for any eligible host meta row (replace character inventory **stub** with stored graph read, same code path as room after host-id dispatch) |
| **Memo** | Generalize forward **`set`** / **`invalidate`** cache keys beyond room-only where Phase 4 apply writes character (or other) host graphs |

Lambdas **must** register and call **`internalCache.Positions.get(...)`** per gateway rules --- not ad hoc **`Meta::Character`** Dynamo in apply or enrich paths (**L5**).

### Carrying limits (deferred)

| Policy | Verdict |
| --- | --- |
| **No v1 limits** | **Selected** --- no steady-state **`one-object-per-hand`**, weight, or volume caps in Phase 4 |
| Inventory size / encumbrance | **Deferred** --- follow-on initiative after pick-up vertical is proven |

---

## `Object Moved` fact (D8 --- decided)

**Direction:** **Extend** the existing **`Object Moved`** stream on **`mtw.ephemera.positions`** for **membership-host** changes that are not room-only --- **do not** introduce a separate cross-host fact type for v1 **`takeHold`**. **Relational** placement (in-room **`On`** / **`In`** edges, area extent, ...) is **not** in scope for this extension --- defer until **`positions/manipulation/relationships/`** and complex manipulation ship.

### Membership-host extension (Phase 4 --- yes)

| Concern | Rule |
| --- | --- |
| **Event type** | Keep **`type: 'Object Moved'`** (same header, same affordance-orchestration subscription path per **L6**) |
| **`froms` / `to`** | Generalize membership endpoints beyond **`EphemeraRoomId`** to eligible **host** ids --- v1 **`takeHold`**: **`froms: [ROOM#...]`**, **`to: CHARACTER#...`** (mirror graph-diff semantics of today's room-only fact) |
| **Builder** | Extend [`buildObjectMovedFact`](../../../../lambda/ephemera/dataSource/positions/membership/buildObjectMovedFact.ts) + [`publishedEvents.ts`](../../../../lambda/ephemera/dataSource/positions/publishedEvents.ts) guards + **`MembershipDiff`** --- not a parallel fact builder |
| **Consumers** | Existing **`Object Moved`** subscribers (affordance orchestration, cache invalidation bundles) remain valid; audit room-only assumptions in invalidation / **`RoomUpdate`** paths when **`to`** is a character host |

Illustrative v1 **`takeHold`** fact after room -> character apply:

```json
{
  "type": "Object Moved",
  "objectId": "OBJECT#Broom",
  "froms": ["ROOM#Cafe"],
  "to": "CHARACTER#Alpha",
  "beatAnchorTime": 1700000000000
}
```

### Relational changes (not yet)

| Concern | Verdict |
| --- | --- |
| In-host / cross-member **relational edges** (`put X on Y`, `On`, `In`, ...) | **Deferred** --- not **`Object Moved`** in Phase 4; complex manipulation + **`relationships/`** follow-on |
| New fact type for relational deltas | **Rejected for now** --- decide when relational apply ships |

**Rejected for v1:** a second positions fact type (e.g. **`Object Relational Changed`**) parallel to **`Object Moved`** for membership-only pick-up; overloading **`Object Moved`** with edge payloads before relational apply exists.

---

## Discriminate in-room object labels (D15 --- decided)

**Direction:** **L11** --- thin compose-stack projection for classify (and reuse for enrich context per **D6**).

| Step | Read |
| --- | --- |
| Current room | **`internalCache.Positions.getMembershipContainers(characterId)`** (same endpoint as [`getRoomExitTargetsForCharacter`](../../../../lambda/ephemera/dataSource/actions/roomExitTargetsForCharacter.ts)) |
| Object ids in room | **`internalCache.Positions.getPositionGraph(roomId)`** -> **`extractObjectIdsFromPlayPositionGraph`** |
| Display labels | Merged component layers per room perspective (**`ComponentAggregate`** + **`appendImprovisationToPerspective`** when objects in scope) -> **`shortName`** (normalize for prompt like exit labels). Phase 1 shipped improvisation-only reads; expand at Phase 2 per **D6**. |

**Implementation (Phase 1):** extend room context for parse (sibling to **`getRoomExitTargetsForCharacter`** or shared return shape); pass label list into **`buildIntentClassificationPrompt`** (prompt option parallel to **`movementExitLabels`**). Share **`objectReads`** deps with **`AffordanceRoomDeliverable`** where practical --- do **not** call full **`AffordanceRoomDeliverable.get`** on the parse path.

**Rejected:** persisting object label catalogs on **`AffordanceCache`** **`Affordance::${perspectiveKey}`** rows (staleness vs **`Object Moved`**; wrong authority boundary vs positions + improvisation bodies).

**v1 scope:** any graph-placed object in the room graph; **`shortName`** from merged component layers (**D6**).

---

## Object resolution (D5 --- decided)

**Direction:** deterministic resolve matches enrich/classify object span(s) to a unique in-room **`OBJECT#`** by **`shortName`** only (normalized, same register as **`movementObjectLabels`**).

| Approach | Verdict |
| --- | --- |
| **`shortName`** match (synonyms via LLM upstream) | **Selected** --- LLM may paraphrase at classify/enrich; resolve compares against catalog **`shortName`**s |
| **`stableKey`** | Rejected for v1 |
| LLM-proposed label + deterministic disambiguation without unique **`shortName`** | Rejected --- falls through to **D7** fail closed |
| Explicit id from UI | Deferred |

---

## In-room object scope (D6 --- decided)

**Direction:** **any graph-placed object** present in the room **`positionGraph`**, not improvisation **`OBJECT#`** only.

| Source | Rule |
| --- | --- |
| Object ids | **`Positions.getPositionGraph(roomId)`** -> **`extractObjectIdsFromPlayPositionGraph`** |
| **`shortName`** | Merged component layers: room perspective participation stack via **`internalCache.ComponentAggregate`**, with improvisation appended via **`appendImprovisationToPerspective`** when in scope (same register as **`AffordanceRoomDeliverable`** object slice) |

**Phase 1 note:** [`roomObjectLabelsForCharacter.ts`](../../../../lambda/ephemera/dataSource/actions/roomObjectLabelsForCharacter.ts) shipped improvisation-only reads; align classify + enrich catalogs with merged-layer reads when Phase 2 starts.

---

## Ambiguity policy (D7 --- decided)

**Direction:** **fail closed** --- when resolve cannot match a unique in-room object by **`shortName`**, terminal **`WorldOOCMessage`** (or equivalent OOC **`Error`**).

| Policy | Verdict |
| --- | --- |
| Fail closed with OOC error | **Selected** for v1 |
| Pick best match above confidence threshold | Rejected for v1 |
| Ask player (conversation path) | **Deferred** --- follow-on iteration after simple atomic manipulation ships |

---

## Code layout (D14 --- decided)

**Direction:**

| Area | Path |
| --- | --- |
| Enrich + resolve | **`actions/enrich/objectManipulation/`** |
| Positions apply | **`positions/manipulation/`** --- umbrella for player-driven object manipulation apply |

**`positions/manipulation/`** structure (draft):

| Submodule | Responsibility |
| --- | --- |
| **`membership/`** | Cross-host **membership** transfers --- v1 **`takeHold`** room -> character (and future room <-> character / inventory moves). Coordinator + tests live here. |
| **`relationships/`** | Relational **edge** apply (`On`, `In`, ... on room graphs) --- **deferred** (complex manipulation); stub or empty until follow-on plan. |

Existing **`positions/membership/`** remains **room-host-only** apply (`applyObjectRoomMembership`, spawn/place ingress). Manipulation coordinators **import** shared primitives (e.g. **`positionGraphMerge`**, fact builders) but **do not** extend those entry points for cross-host or relational semantics.

---

## Enrich disposition schema (D17 --- decided)

**Direction:** **thin vertical** --- lock enrich JSON + finalize rules so Phases 2--5 can prove the full lane stack for **one** atomic operator (**`takeHold`**). **`operationKind`** is **extensible**; additional operators (e.g. **`drop`**, relational attach) ship in later slices **after** pick-up works end-to-end (including **`Meta::Character.positionGraph`** --- **D16**).

### Strategy

| Choice | Verdict |
| --- | --- |
| One atomic operator, full vertical first (**`takeHold`**) | **Selected** |
| Define multiple atomics in enrich before any completes the vertical | Rejected for v1 |
| Relational attach (`put X on Y`) as v1 atomic | Rejected --- **`disposition: complex`** stub (**L10**, **D14** **`relationships/`** deferred) |

### Model JSON (enrich Bedrock response)

**Atomic (v1 implemented):**

```json
{
  "disposition": "atomic",
  "operationKind": "takeHold",
  "objectSpan": "broom"
}
```

**Complex (terminal stub in v1):**

```json
{
  "disposition": "complex",
  "complexityClass": "relationalPlacement",
  "summary": "put the vase on the table"
}
```

| Field | Rule |
| --- | --- |
| **`disposition`** | Required. Exactly **`atomic`** or **`complex`**. |
| **`operationKind`** | Required when **`disposition: atomic`**. String enum --- v1 **implements** only **`takeHold`**. Forbidden when **`disposition: complex`**. |
| **`objectSpan`** | Required when **`disposition: atomic`** and **`operationKind: takeHold`**. Single raw object string (articles stripped); enrich proposes, resolve grounds to **`OBJECT#`** by **`shortName`** (**D5**). No **`objectId`** from model in v1. |
| **`complexityClass`** | Required when **`disposition: complex`**. Stub vocabulary (finalize to terminal OOC only --- no stream, no positions): **`relationalPlacement`** (`put X on Y`, `tie A to B`, in-room edge claims), **`multiObject`** (multiple deltas in one line), **`unimplementedVerb`** (recognized manipulation family but no v1 atomic path --- e.g. **`drop`** until a later slice). Optional **`summary`** for operator/debug copy. |
| **Forbidden at enrich** | **`objectId`**, **`targetId`**, host routing ids, graph delta payloads --- resolve and downstream lanes own grounded ids (**D3**, **L12**). |

### Finalize rules (v1)

| Enrich outcome | Next step |
| --- | --- |
| **`disposition: complex`** | Terminal **`WorldOOCMessage`** / **`ParseCommandErrorResult`** --- **no** resolve, **no** stream, **no** positions (**L10**) |
| **`disposition: atomic`** + **`operationKind` !== `takeHold`** | Terminal OOC --- unimplemented atomic (e.g. **`drop`** until follow-on slice) |
| **`disposition: atomic`** + **`takeHold`** | Deterministic resolve: unique **`shortName`** match (**D5** / **D7**) -> grounded proposal -> Phases 3--5 egress / apply / perception |

### After resolve (internal, pre-egress)

Grounded atomic **`takeHold`** parse result (**`ParseCommandObjectManipulationResult`**) plus egress context from **`Parse Requested`** (**D4**):

```ts
// parse result (Phase 2)
{
  type: 'ObjectManipulation',
  operationKind: 'takeHold',
  objectId: EphemeraObjectId,
  confidence: ParseCommandConfidence,
}

// streamEvent update (Phase 3 --- D4)
{
  type: 'Object Take Hold',
  characterId: EphemeraCharacterId,
  objectId: EphemeraObjectId,
  roomId: EphemeraRoomId,  // character's current room at egress (source host)
  confidence?: number,
}
```

### Prompt policy (enrich)

- In-room object catalog in prompt (merged-layer **`shortName`**s per **D6**); same projection family as classify **`movementObjectLabels`**.
- **`takeHold`** paraphrases (`pick up`, `grab`, `get the <in-room noun>`) -> **`disposition: atomic`** + **`operationKind: takeHold`**.
- **`put X on Y`**, multi-object relational lines -> **`disposition: complex`** + **`complexityClass: relationalPlacement`**.
- **`drop`** / other membership verbs -> **`disposition: complex`** + **`complexityClass: unimplementedVerb`** (or enrich may emit atomic + non-**`takeHold`** **`operationKind`**; finalize still terminal OOC in v1).

### Follow-on slices (not v1)

| Operator | Kind | When |
| --- | --- | --- |
| **`drop`** | Membership atomic (character -> room) | After pick-up vertical proven; same **`positions/manipulation/membership/`**, new **`operationKind`** |
| Relational attach | Edge apply | After **`positions/manipulation/relationships/`** + complex-path plan |

---

## Actions egress intent (D4 --- decided)

**Direction:** v1 atomic **`takeHold`** intent streams as **`Object Take Hold`** on **`mtw.ephemera.actions`**, parallel to **`Character Navigate`** / **`Character Home`** (grounded ids post-parse; header **`type`** mirrors payload **`type`**; **`streamKey`** = **`characterId`**).

**Rejected for v1:** generic **`Object Manipulation Requested`** + **`operationKind`** on payload (deferred --- add when a second atomic operator ships and fan-in needs one leg); bare **`Take Hold`** without **`Object`** prefix (weaker pairing with **`Object Moved`** fact).

### Bus payload (`publishedEvents.ts` target)

```json
{
  "type": "Object Take Hold",
  "characterId": "CHARACTER#...",
  "objectId": "OBJECT#...",
  "roomId": "ROOM#...",
  "confidence": 0.92
}
```

| Field | Rule |
| --- | --- |
| **`type`** | Exactly **`Object Take Hold`**. |
| **`characterId`** | Actor performing pick-up. |
| **`objectId`** | Grounded target from resolve (**D5**). |
| **`roomId`** | Source room at egress (character's current room membership --- room host for **`takeHold`**). Positions apply uses this as **`fromHost`**; character inventory is implicit **`toHost`**. |
| **`confidence`** | Optional; include when emitting from **`Parse Requested`** parse path (same register as **`Acme Order`** / **`Look Command Requested`**). |

### Egress wiring (Phase 3)

- Emit only when parse result is **`ObjectManipulation`** with **`operationKind: takeHold`**.
- **`roomId`** from **`roomExitContext.fromRoomId`** (or catalog room) on **`Parse Requested`** --- do not re-read membership inside enrich.
- Subscriber: **`mtw.ephemera.positions`** execution ingress (Phase 4 apply coordinator).
- Perception fan-in intent leg (Phase 5 / **D9**): adapter alongside **`Character Navigate`** in [`membershipPresentationLegAdapters.ts`](../../../../lambda/ephemera/dataSource/perception/membershipPresentationLegAdapters.ts).

---

## Trusted ingress (D13 --- decided)

**Direction:** **parse-only** for v1 manipulation.

| Path | v1 |
| --- | --- |
| **`Parse Requested`** (typed command) | **Yes** --- classify -> enrich -> resolve -> egress |
| **`Action Assessed`** (trusted UI) | **No** --- defer until inventory / object UI design |

Mirror navigation eventually if a trusted pick-up UI ships; reuse **`Object Take Hold`** stream contract when added.

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

**Not at classify:** resolving whether **`objectSpans`** match a unique in-room object --- enrich + deterministic resolve per **D5** / **D7**.

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

- [X] **Phase 1 --- classifier (semantic intent)**
  - [X] **Gate:** **D3**, **D15** decided (**L11**, **L12**).
  - [X] Add **`ObjectManipulationIntent`** section to `buildIntentClassificationPrompt.ts` per **D3** / **L12** (primacy + examples, not verb whitelist).
  - [X] Thin in-room object label projection per **L11**; pass as **`movementObjectLabels`** into classify prompt.
  - [X] Wire `discriminateIntent/` guards and `baseClasses.ts` (**`ObjectManipulationIntent`**, **`rawObjectSpans`**, forbidden-field checks).
  - [X] **`index.ts` stub:** terminal **`WorldOOCMessage`** for recognized manipulation intent until later phases own full behavior.
  - [X] Tests: paraphrase fixtures (`pick up` / `grab` / `get the <in-room object>`), Acme vs manipulation collision cases, `Unimplemented` regression for out-of-family actions.

- [X] **Phase 2 --- enrich + resolve (atomic path + complex stub)**
  - [X] **Gate:** **D17** decided (**D2**, **D5**, **D6**, **D7**, **D14**, **L10**).
  - [X] `actions/enrich/objectManipulation/` per **D14**: prompt, JSON schema per **D17** (**`disposition`**, atomic proposal fields, **`complexityClass`** stub).
  - [X] Bedrock invoke + interpret/finalize: **`disposition: atomic`** -> resolve; **`disposition: complex`** -> terminal OOC/**`Error`** (no stream, no positions --- complex processing **out of scope**).
  - [X] Expand in-room object label projection to merged component layers (**D6**); align classify **`movementObjectLabels`** with enrich catalog.
  - [X] Deterministic **`shortName`** grounding per **D5** / **D7** (**atomic only**).
  - [X] Enrich-time terminal for unimplemented atomic **`operationKind`**s (drop / put-on until later slices --- **D2**).
  - [X] Tests with mocked Bedrock and room object fixtures (atomic **`takeHold`** success path; **`disposition: complex`** stub terminal; unimplemented **`operationKind`** on atomic path).

- [X] **Phase 3 --- actions egress (atomic intents only)**
  - [X] **Gate:** **D4**, **D13** decided (optional **A3** intent-leg sketch in [Actions egress intent (D4)](#actions-egress-intent-d4---decided)).
  - [X] `publishedEvents.ts` stream type + guards.
  - [X] `index.ts` handler branch; correlate `ReturnValue` when `requestId` present.
  - [X] Subscriber registration plan (positions execution ingress): guards + stub [`executeObjectTakeHold`](../../../../lambda/ephemera/dataSource/positions/manipulation/membership/executeObjectTakeHold.ts) wired in [`positions/index.ts`](../../../../lambda/ephemera/dataSource/positions/index.ts).

- [X] **Phase 4 --- positions apply**
  - [X] **Gate:** **D16**, **D8** decided (optional **A2** pre-flight legality).
  - [X] **`Meta::Character.positionGraph`** persistence + read path (**D16**).
  - [X] **`positions/manipulation/membership/`** cross-host coordinator: atomic room-remove + character-add on **`takeHold`** (**D14**).
  - [X] Contract updates in `positions/AGENT.contract.md` per **D8**.
  - [X] Cache memo per gateway rules (`internalCache.Positions`).

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
| Cross-phase decided (D1, D2, D3, D5, D6, D7, D14, D15, D17, D4, D13, D16, D8) | Done |
| In-room label read path (L11) | Decided (compose-stack projection) |
| Classify contract (L12, D3) | Decided (no slots; **`movementObjectLabels`**) |
| **Phase 1 gate** | Decided |
| Phase 1 classifier | Done |
| **Phase 2 gate** | Decided |
| Enrich disposition schema (D17) | Decided (thin **`takeHold`** vertical; extensible **`operationKind`**) |
| Phase 2 enrich + resolve (atomic + complex stub) | Done |
| **Phase 3 gate** | Decided (**D4**, **D13**) |
| Actions egress intent (**Object Take Hold**) | Decided |
| Trusted ingress (parse-only v1) | Decided (**D13**) |
| Phase 3 actions egress | Done |
| Positions stub ingress (`Object Take Hold` -> `executeObjectTakeHold`) | Done (Phase 4 apply shipped) |
| Host positionGraph storage (D16) | Decided (fractal-host pattern; extend Positions gateway; no carrying limits) |
| **`Meta::Character.positionGraph`** read + persist primitives (D16 slice 1) | Done |
| **`Object Moved` fact extension (D8)** | Done (types + cross-host apply) |
| **Phase 4 gate** | Decided (**D16**, **D8**) |
| Phase 4 positions apply | Done |
| Phase 5 gate (D9--D12) | Open |
| Phase 5 perception / transcript | Not started |
| Phase 6 graduation | Not started |
| Nested containment / dynamic closures (future direction) | Documented ([section](#future-direction-nested-containment-and-dynamic-closures-post-vertical); **A4**) |

---

## Verification

When implementation begins, extend this list per phase. Until then, baseline only:

From `lambda/ephemera/`:

```bash
npm run test -- --watchAll=false dataSource/positions/membership/applyObjectRoomMembership.test.ts dataSource/actions/parseCommand.test.ts
npm run build
```

Phase 1 (shipped):

```bash
npm run test -- --watchAll=false \
  dataSource/actions/discriminateIntent/intentClassification.test.ts \
  dataSource/actions/roomObjectLabelsForCharacter.test.ts \
  dataSource/actions/parseCommand.test.ts \
  dataSource/actions/index.test.ts \
  dataSource/positions/membership/applyObjectRoomMembership.test.ts
npm run build
```

Phase 2 (shipped):

```bash
npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/ \
  dataSource/actions/roomObjectLabelsForCharacter.test.ts \
  dataSource/actions/roomObjectCatalogForCharacter.test.ts \
  dataSource/actions/parseCommand.test.ts \
  dataSource/actions/index.test.ts \
  dataSource/actions/discriminateIntent/intentClassification.test.ts
npm run build
```

Phase 3 (shipped):

```bash
npm run test -- --watchAll=false \
  dataSource/actions/publishedEvents.test.ts \
  dataSource/actions/index.test.ts \
  dataSource/positions/subscribedEvents.test.ts \
  dataSource/positions/manipulation/membership/executeObjectTakeHold.test.ts \
  dataSource/positions/receivePaths.integration.test.ts
npm run build
```

Phase 4 slice 1 (D16 --- character `positionGraph` read + persist primitives):

```bash
npm run test -- --watchAll=false \
  ../../packages/mtw-interfaces/ts/ephemeraPositionAdjacency.test.ts \
  ../../packages/mtw-interfaces/ts/ephemeraMeta.test.ts \
  ../../packages/mtw-gateways/ts/ephemera/positions/index.test.ts \
  dataSource/positions/manipulation/membership/characterInventoryTransactItems.test.ts \
  dataSource/positions/membership/applyObjectRoomMembership.test.ts \
  dataSource/actions/parseCommand.test.ts
npm run build
```

Phase 4 slice 2 (cross-host `takeHold` apply):

```bash
npm run test -- --watchAll=false \
  dataSource/positions/manipulation/membership/ \
  dataSource/positions/publishedEvents.test.ts \
  dataSource/positions/receivePaths.integration.test.ts
npm run build
```

Future slices (indicative):

- `dataSource/actions/discriminateIntent/intentClassification.test.ts`
- `dataSource/actions/index.test.ts`
- New enrich module tests under `dataSource/actions/enrich/`
- `dataSource/positions/manipulation/` coordinator tests
- Perception emission tests (fan-in or publish helper)

Command authority: [`lambda/ephemera/AGENT.testing.md`](../../../../lambda/ephemera/AGENT.testing.md).
