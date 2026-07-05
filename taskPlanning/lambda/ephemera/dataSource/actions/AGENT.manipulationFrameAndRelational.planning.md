# Object manipulation parse --- Phases B--D (frame, establishRelation, plan IR)

**Status:** Phase B in progress --- B2 shipped (relation normalizer). BD-1--BD-11 locked (2026-07-04); next step: B2.5 split classify intents (`ObjectMembershipIntent` + `ObjectRelateIntent`), then B3 grounding + legality.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

Prerequisite (shipped): Phase A membership compiler --- [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md#objectmanipulationintent-steady-state-shipped---membership-aware-classify--enrich--egress) (**`verbClass`**, **`compileMembershipAtomic`**, merged-catalog identity); B1 adds relational route + frame extract at enrich entry. Module inventory: [`actions/enrich/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/AGENT.md).

## Purpose

Ship generic **`establishRelation`** --- one relational operator parameterized by relation kind (not per-preposition operators like **`placeOn`**). Player language ("on", "under", "leaning against", "tied around") becomes a **manipulation frame** (subject, target, relation), compiled deterministically into positions **host-local relational patches** and perception transcript.

Phases B--D evolve parse from coarse intent classification toward **split manipulation intents at classify (BD-11) + frame extraction + deterministic plan compilation + execution**, without requiring full LLM-authored multi-step plans on day one.

Retire this plan when relational vertical + plan IR steady-state docs land; git retains history.

## Phase map

| Phase | Focus | Outcome |
| --- | --- | --- |
| **A** (shipped) | Membership atomics | **`verbClass`**, **`compileMembershipAtomic`** (compiler v0), legacy deletion, preposition guard |
| **B** | **`establishRelation`** vertical | Frame slots, relation normalization, stream/apply/presentation |
| **C** | Plan IR + composition | Deterministic compiler; optional multi-step (e.g. drop + relate) |
| **D** | Advanced planning (optional) | LLM plan generation only where compiler cannot derive steps |

## Target architecture (steady-state sketch)

```text
discriminateIntent (ObjectMembershipIntent + verbClass acquire | release OR ObjectRelateIntent; replaces ObjectManipulationIntent umbrella)
  -> parseCommand routes by intent type (interim: enrich relationalRoute preposition guard until B2.5)
  -> membership enrich OR frame extract LLM hop -> manipulation frame (subject / target / relationSpan)
  -> plan compiler (deterministic: resolve spans, normalize relation, legality)
  -> plan executor -> stream event(s) -> positions -> perception
```

**Classify contract (Phase A interim + B2.5):** Replace the undifferentiated **`ObjectManipulationIntent`** umbrella with two classify outcomes (**BD-11**):

| Intent | Topology | Classify fields | Enrich path |
| --- | --- | --- | --- |
| **`ObjectMembershipIntent`** | Node / membership host --- which **`positionGraph`** hosts the object | **`objectSpans`**, **`verbClass`** (`acquire` \| `release`) | **`compileMembershipAtomic`** |
| **`ObjectRelateIntent`** | Edge / in-host relation between objects on a host graph | **`objectSpans`** only (no **`verbClass`**) | frame extract -> normalizer -> relational compiler |

Classify **must** own the membership vs relational distinction semantically (not enrich preposition regex once B2.5 ships). **`verbClass`** remains membership **language** direction only --- unchanged from Phase A, scoped to **`ObjectMembershipIntent`**. Frame extraction stays a dedicated enrich hop (**BD-4**).

**Plan IR (Phase C)** --- primitives are validated, not model-invented:

| Primitive | Role |
| --- | --- |
| `resolveComponent` | Map free-text span -> trusted `EphemeraId` via catalog |
| `transferMembership` | **`takeHold`** / **`drop`** (existing membership kernel path) |
| `establishRelation` | Add edge on host `positionGraph` (slice 5+ kernel) |
| `dissolveRelation` | Remove edge on host `positionGraph` (BD-7; slice 5+ kernel) |
| `look` / others | Reuse existing affordance streams where composition needs them |

Phase B may compile to a **length-1 plan** internally without exposing a general executor API.

## Relation representation (preferred direction --- hybrid)

Product preference (from planning discussion): work deterministically with a **small closed enum** for common prepositions, reserve **`in`** for future **positionGraph nesting** (container hosts), and use **custom free-text** for long-tail relation phrases.

| Bucket | Examples | Persist / compile |
| --- | --- | --- |
| **Enum: surface relations** | `On`, `Under`, `Against` (BD-2 locked) | Canonical **`relationKind`** on edge |
| **Deferred: containment** | `in`, `inside` | Not **`establishRelation`** v1; routes to future nesting operator |
| **Custom** | `tied to`, `leaning against`, `wrapped around` | **`relationKind: Custom`** + **`relationLabel`** (player/normalized text) |

Enum members and custom persist shape: [`positions/AGENT.contract.md` --- Host-local relational patch](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#host-local-relational-patch-phase-b-planning-contract) (BD-2, BD-3).

## Scope

### Phase B --- in scope

- **Manipulation frame** schema: role-tagged spans (`subject`, `target`), **`relationSpan`**. **`ObjectRelateIntent`** at classify (**BD-11**) replaces preposition-regex as primary enrich entry signal once B2.5 ships; interim B1--B2 routing via [`relationalRoute.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/relationalRoute.ts).
- Frame extraction hop (**dedicated enrich prompt**, BD-4 --- not shared complexity LLM) + JSON validation; replaces Phase A relational preposition guard for supported frames.
- **Relation normalizer**: map **`relationSpan`** -> **`relationKind`** (enum | `Custom`) + optional **`relationLabel`**.
- Terminal parse + egress: new top-level result variant (BD-1) --- e.g. **`ParseCommandEstablishRelationResult`** (`type: 'EstablishRelation'`) with subject/target ids, **`relationKind`**, optional **`relationLabel`**, and **`operationKind: 'establishRelation' | 'dissolveRelation'`** (BD-7). Membership atomics keep **`ObjectManipulation`** + **`takeHold` | `drop`** unchanged.
- Promote **`relationalPlacement`** from terminal-only Error to grounded success path when frame validates.
- Positions: implement **`applyHostRelationalPatch`** per stub in [`manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md#future-host-local-relational-patch-m4-stub-slice-5).
- Perception: transcript template (withhold unstated geometry per [`diegeticLogic/AGENT.unknowns.concepts.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.unknowns.concepts.md)).
- Four-lane doc updates: [`diegeticLogic/AGENT.operators.concepts.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md), positions contract, actions implementation.

### Phase C --- in scope

- Explicit **Plan IR** types + deterministic **compiler** (frame + catalogs + membership -> ordered steps).
- **Composition rules (BD-8):** when single command implies membership change + relation (e.g. held object + "put X on Y"), compiler auto-inserts **`drop`** before **`establishRelation`** --- no require explicit drop language.
- **`MultipleCommands`** policy: reject vs allow bounded multi-step from one line.
- **Multi-step failure (BD-9):** composed plans (**drop** + **`establishRelation`**, etc.) apply **atomically** --- positions kernel bundles membership **`HostEffect[]`** + relational patches in **one** `transactWrite` (same family as graph+adjacency bundling in **`applyHostEffects`**). **Not** sequential per-step streams with first-step commit; **not** RoomStack-style fail-tolerant tail.

### Phase D --- optional / deferrable

- **Defer vs hard Error (BD-10):** compiler **`defer`** only when non-trivial **existing in-host relational edges** on subject and/or target block a deterministic registry plan (interaction complexity --- analog to Phase A **`deferToComplexityLlm`**). **Phases B--C:** that bucket terminalizes as **hard Error** (complexity-style stub); Phase D plan LLM is the escalation path. See **BD-10** detail below.
- LLM emits step list when compiler returns **`defer`** (constrained to registry primitives; validate + atomic apply per BD-9).
- Reuse [`llm/pipeline/`](../../../../../lambda/ephemera/llm/pipeline/AGENT.md) if multi-hop frame+plan needs orchestration.

### Out of scope (unless plan updated)

- Full **`in`** / nested container host vertical (separate operator initiative).
- Client UI for relation editing.
- Retaining **`ObjectManipulationIntent`** as the classify umbrella (superseded by **`ObjectMembershipIntent`** + **`ObjectRelateIntent`** per **BD-11**).
- Arbitrary graph writes beyond registered primitives.

## Background (durable docs --- link, do not duplicate)

| Topic | Doc |
| --- | --- |
| Relational persist stub | [`positions/manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md) |
| Positions concepts (edges, host-local patch) | [`positions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) |
| Operator lane split | [`diegeticLogic/AGENT.implementation.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.implementation.md) |
| Unknowns / withhold | [`diegeticLogic/AGENT.unknowns.concepts.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.unknowns.concepts.md) |
| Current relational Error stub | [`enrich/objectManipulation/complexityClasses.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/complexityClasses.ts) |

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read Phase A steady-state in [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md#objectmanipulationintent-steady-state-shipped---membership-aware-classify--enrich--egress) (membership compiler shipped).
3. Read positions relational stub: [`manipulation/AGENT.implementation.md` --- Future: host-local relational patch](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md#future-host-local-relational-patch-m4-stub-slice-5).
4. Trace relational enrich path: [`enrich/objectManipulation/index.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/index.ts) (interim **`relationalRoute`** -> frame extract; B2.5 routes **`ObjectRelateIntent`** at parse ingress), [`frameExtract/runFrameExtractStage.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/frameExtract/runFrameExtractStage.ts). Membership defer still uses complexity LLM in [`buildPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/buildPrompt.ts).
5. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md).
6. Baseline (includes positions manipulation tests when Phase B touches apply):

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/ \
  dataSource/actions/parseCommand.test.ts \
  dataSource/positions/manipulation/
```

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement Phases B--D. When a decision ships, record it in **`AGENT.contract.md`** / **`AGENT.implementation.md`** / operator concepts and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| BD-1 | **Terminal parse shape** --- **new top-level result variant** (e.g. **`ParseCommandEstablishRelationResult`**, `type: 'EstablishRelation'`), **not** extending **`ParseCommandObjectManipulationResult.operationKind`**. Membership atomics stay on **`ObjectManipulation`** + **`takeHold` | `drop`**. | Phase B contract | Decided |
| BD-2 | **Hybrid relation enum** --- v1 members: **`On`**, **`Under`**, **`Against`**. **`In`** / **`inside`** excluded; route to future nesting operator with defer message (not **`establishRelation`**). | Normalizer + persist **`edge.kind`** | Decided |
| BD-3 | **Custom relation storage** --- persist **`relationKind: Custom`** + **`relationLabel`** on edge (not presentation-only). | Persist + transcript | Decided |
| BD-4 | **Frame extraction placement** --- **dedicated enrich hop** (new module under enrich); **not** shared complexity LLM. Relational formation is distinct from cross-graph membership movement. Primary relational **routing** moves to classify **`ObjectRelateIntent`** (**BD-11**); frame extract remains enrich-side. | Prompt layout + Bedrock budget | Decided (revised 2026-07-04) |
| BD-5 | **Target resolution** --- v1: **room object catalog only** for subject + target resolve. **Extend** to features/surfaces and nested **`positionGraph`** hierarchy targets when nested-host target matching ships (follow-on; not Phase B). Non-object targets ("floor", "wall") out of scope v1. | Frame extract + resolve | Decided |
| BD-6 | **Host selection** --- v1: always actor's **current room** **`positionGraph`** (`roomExitContext.fromRoomId`). | Positions ingress | Decided |
| BD-7 | **Inverse operator** --- include **`dissolveRelation`** in v1 (remove edge on host graph); pair with **`establishRelation`**. | Phase B scope | Decided |
| BD-8 | **Composition (Phase C)** --- compiler **auto-inserts** **`drop`** before **`establishRelation`** when subject is held (no require explicit "drop then put" language). | Compiler | Decided |
| BD-9 | **Multi-step failure** --- **atomic all-or-nothing** via positions **kernel bundling**: one compound apply / single `transactWrite` spanning membership **`HostEffect[]`** + relational **`HostRelationalPatch[]`** on affected hosts (mirror graph+adjacency in **`applyHostEffects`**). **Not** sequential stream-per-step with first-step commit; **not** RoomStack fail-tolerant tail. On apply failure: no partial graph change, player **Error**. | Executor + positions kernel (Phase C) | Decided |
| BD-10 | **LLM plan generation (Phase D)** --- **`defer`** when compiler cannot derive a deterministic registry plan because **non-trivial existing in-host relational topology** on subject and/or target interacts with the proposed patch (conflicting edges, replace/coexist/dissolve-first ambiguity). **Hard Error** (all phases): grounding/catalog failure, **`in`**/nesting (BD-2), **`MultipleCommands`**, nodes not on host graph, **`dissolveRelation`** with no matching edge, plan-LLM invoke/parse/validation failure. **B--C interim:** defer bucket -> terminal **Error** stub (no plan LLM yet). **Deterministic allow:** idempotent duplicate edge (exact edge already present). | Phase D entry; B3 legality; C1 compiler | Decided |
| BD-11 | **Split manipulation classify intents** --- replace undifferentiated **`ObjectManipulationIntent`** with **`ObjectMembershipIntent`** (object moves between membership hosts --- which **`positionGraph`** node hosts the object; **`objectSpans`** + **`verbClass`** `acquire` \| `release`; compiled via **`takeHold`** / **`drop`**) and **`ObjectRelateIntent`** (in-host edge between objects on a host graph --- **`objectSpans`** only, no **`verbClass`**; compiled via **`establishRelation`** / **`dissolveRelation`**). Classify owns semantic membership vs relational distinction via intent **`type`**, not a sub-field. **`parseCommand`** branches on intent type; enrich **`ObjectRelateIntent`** -> frame extract path, **`ObjectMembershipIntent`** -> **`compileMembershipAtomic`**. Retire **`relationalRoute`** preposition regex as primary gate after B2.5 parity tests (may keep as interim fallback one release). Remove **`ObjectManipulationIntent`** from classify prompt and parser when B2.5 ships. | B2.5 classify; B3+ parse/enrich entry | Decided (revised 2026-07-04) |

### BD-10: defer vs hard Error (litmus)

| Outcome | When | Phases B--C | Phase D |
| --- | --- | --- | --- |
| **Success (deterministic plan)** | Clean host topology; compiler emits length-1 or BD-8 length-2 plan | Apply (atomic per BD-9) | Same |
| **`defer`** | Existing relational edges on subject/target require interaction reasoning (not covered by deterministic legality rules) | **Error** stub --- "rules don't cover this complexity" | Plan LLM hop -> validate registry steps -> atomic apply |
| **Hard Error** | Structural/policy (see BD-10 row) | Error | Error (no plan LLM) |

**Primary defer case (only expected defer driver for relational vertical):** pre-existing **surface/custom** edges on subject or target on the room host when establishing or changing a relation --- e.g. already **`On`** table, player says **`Under`** table; subject **`Against`** wall plus new target relation; may need **`dissolveRelation`** + **`establishRelation`** plan the compiler cannot derive without interaction assessment.

**Not defer:** frame extraction (Phase B dedicated hop); B2 paraphrase->enum LLM; membership exit-edge touch (Phase A **`deferToComplexityLlm`** path for atomics only). Split classify intents (**BD-11** / B2.5) is structural routing, not defer.

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines as you finish each sub-step.

### Phase B --- establishRelation vertical

- [X] **B0. Decision lock**
  - [X] Close BD-1 -- BD-10 in **Open decisions** (2026-07-04); BD-11 added (2026-07-04).
  - [X] Capture enum list and edge persist shape in positions contract draft (BD-2, BD-3) --- [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#host-local-relational-patch-phase-b-planning-contract).

- [X] **B1. Frame schema + extraction**
  - [X] Define **`ManipulationFrame`** types (subject/target/relation spans; role tags) in actions enrich layer.
  - [X] Add frame extraction prompt + interpreter (new module under [`enrich/objectManipulation/frameExtract/`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/frameExtract/)).
  - [X] Wire: relational route (preposition guard successor / multi-span) -> frame extract -> compiler stub; membership lines still use **`verbClass`** acquire/release path from Phase A.
  - [X] Tests: fixture commands ("put broom on table", "lean rope against anvil", "tie cord around crate").

- [X] **B2. Relation normalizer**
  - [X] Deterministic map: common prepositions -> enum; **`in`** -> explicit defer/nesting message; else **`Custom`** + label.
  - [X] Optional small LLM hop for paraphrase -> enum only if deterministic map insufficient (BD-2 locked enum; defer LLM unless map gaps found in B2 tests).
  - [X] Tests: enum paths, custom paths, excluded **`in`**.

- [ ] **B2.5. Split manipulation classify intents (BD-11)**
  - [ ] Add **`ObjectMembershipIntent`** and **`ObjectRelateIntent`** to classify JSON, parser, guards, and **`IntentClassificationResult`** union in [`baseClasses.ts`](../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts); remove **`ObjectManipulationIntent`** when parity tests pass.
  - [ ] Update [`buildIntentClassificationPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/buildIntentClassificationPrompt.ts): Section A2 **`ObjectMembershipIntent`** (membership host transfer; **`verbClass`** required); Section A2b **`ObjectRelateIntent`** (in-host edge change; semantic relational examples without fixed preposition list; no **`verbClass`**). Shared tie-breakers vs AcmeOrder / NavigationIntent for manipulation family.
  - [ ] Update deterministic fast path ([`deterministicChecks.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts)): synthesize **`ObjectMembershipIntent`** for minimal take/drop/get (not **`ObjectRelateIntent`**).
  - [ ] Wire [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts): **`ObjectMembershipIntent`** -> **`enrichObjectManipulation`** membership path; **`ObjectRelateIntent`** -> relational frame-extract path. Demote [`relationalRoute.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/relationalRoute.ts) from primary gate after parity tests.
  - [ ] Tests: **`ObjectMembershipIntent`** lines (`pick up broom`); **`ObjectRelateIntent`** with and without listed prepositions; reject **`verbClass`** on **`ObjectRelateIntent`**; parseCommand E2E with mocked classify intent type.
  - [ ] Durable docs: classify contract in [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md); enrich sequence in [`enrich/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/AGENT.md).

- [ ] **B3. Grounding + legality**
  - [ ] Resolve subject + target against catalogs; host selection per BD-6.
  - [ ] Legality (BD-10): both nodes on host graph; **idempotent** duplicate edge -> allow/no-op; **conflicting** or non-trivial existing relational topology on subject/target -> **Error** stub in B--C (compiler **`defer`** bucket until Phase D).
  - [ ] Replace interim **`relationalRoute`** / **`relationalPlacement`** terminal Error stubs for supported frames with grounded terminal parse (requires B2.5 **`ObjectRelateIntent`** routing for production path).

- [ ] **B4. Positions persist + ingress**
  - [ ] Implement **`applyHostRelationalPatch`** + **`HostRelationalPatch`** types per stub.
  - [ ] Stream contract + guard (e.g. **`Object Establish Relation`**) in [`publishedEvents.ts`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts).
  - [ ] Coordinator under [`manipulation/relational/`](../../../../../lambda/ephemera/dataSource/positions/manipulation/relational/) (create tree).
  - [ ] Tests: apply, idempotency, reject invalid patch.

- [ ] **B5. Actions egress + perception**
  - [ ] [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) publish stream on grounded relational parse.
  - [ ] Perception fan-in: intent + fact -> **`WorldMessage`** (withhold geometry; assert relation per unknowns).
  - [ ] End-to-end tests: parse -> stream -> apply -> transcript.

- [ ] **B6. Durable docs**
  - [ ] [`diegeticLogic/AGENT.operators.concepts.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md) --- **`establishRelation`** section.
  - [ ] [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) --- promote planning contract to shipped when Phase B ingress lands; ingress stream rows + fact bundle TBD at B4.
  - [ ] [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) --- replace relational stub prose.

### Phase C --- Plan IR and composition

- [ ] **C1. Plan IR types + registry**
  - [ ] Define **`ParsePlanStep`** union and primitive registry (resolve, transferMembership, establishRelation).
  - [ ] Deterministic **compiler** from **`ManipulationFrame`** + context -> plan (usually length 1; sometimes 2+) or **`defer`** / **Error** per BD-10.

- [ ] **C2. Executor + compound kernel apply**
  - [ ] Compiler emits ordered plan; executor routes **length-1** plans to existing single-step streams (Phase B path).
  - [ ] **Length-2+** composed plans (BD-8): **one** positions ingress / compound coordinator --- kernel **`transactWrite`** bundles all **`HostEffect[]`** + **`HostRelationalPatch[]`** (BD-9); **must not** emit sequential **`Object Drop`** then **`Object Establish Relation`** with independent partial commit.
  - [ ] On compound apply failure: return **Error** to player; no membership-changed or relational fact streams.
  - [ ] Perception/transcript: single composed outcome when compound apply succeeds (not separate drop + relate lines unless product decides otherwise at C2).

- [ ] **C3. Classifier / MultipleCommands policy**
  - [ ] Document when composite single-line commands compile vs **`MultipleCommands`** Error.
  - [ ] Tests: "pick up broom and go north" (likely reject); "toss pouch on floor" (compose if in scope).

- [ ] **C4. Refactor enrich entry**
  - [ ] Generalize **`compileMembershipAtomic`** (Phase A) into full plan compiler; **`ObjectMembershipIntent`** and **`ObjectRelateIntent`** frames route through shared compiler surface (**BD-11**).
  - [ ] Deprecate ad-hoc stage graph where compiler subsumes it; remove **`relationalRoute`** preposition gate when B2.5 intent routing is steady-state.

### Phase D --- LLM plan generation (optional)

- [X] **D1. Defer criteria**
  - [X] Lock BD-10: **`defer`** = non-trivial existing in-host relational edges on subject/target; B--C -> Error stub.

- [ ] **D2. Plan LLM hop**
  - [ ] Constrained JSON: steps must be valid primitives from registry only.
  - [ ] Validate + execute or Error; no silent fallback to wrong operation.

- [ ] **D3. Pipeline integration**
  - [ ] Evaluate [`llm/pipeline/`](../../../../../lambda/ephemera/llm/pipeline/AGENT.md) vs inline enrich orchestration.

## Verification

**Phase B** (from **`lambda/ephemera/`**):

```bash
npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/ \
  dataSource/actions/parseCommand.test.ts \
  dataSource/actions/index.test.ts \
  dataSource/positions/manipulation/ \
  dataSource/perception/objectManipulationPresentationFanIn.test.ts

npm run build
```

**Phase C** adds compiler/executor unit tests under `dataSource/actions/enrich/` (exact path TBD at C1).

**Manual scenarios (post-B):**

- "put the broom on the table" -> relation edge on room host; transcript asserts relation, not exact placement geometry.
- "put the broom on the table" (already on table, same edge) -> idempotent allow/no-op (BD-10).
- "put the broom under the table" (already on table) -> **Error** stub in B--C; plan LLM candidate in Phase D (BD-10).
- "lean the ladder against the wall" -> **`Custom`** or enum **`Against`** (BD-2).
- "put the coin in the jar" -> nesting defer message, not **`establishRelation`** (**`In`** excluded per BD-2).
- Held object + surface relation -> composed plan: auto **`drop`** then **`establishRelation`** in **one atomic apply** (BD-8 + BD-9, Phase C); failure leaves object held.
- "take the rope off the crate" -> **`dissolveRelation`** on room host (BD-7).

## Progress

| Milestone | Status |
| --- | --- |
| Phases B--D task plan | Done |
| Phase A prerequisite | Not started (see companion plan) |
| BD-1--BD-11 open decisions locked | Done (2026-07-04) |
| B0 decision lock + positions contract draft (BD-2, BD-3) | Done (2026-07-04) |
| B1 frame schema + extraction (stub terminal Error until B3) | Done (2026-07-04) |
| B2 relation normalizer (deterministic map; nesting defer; no LLM hop) | Done (2026-07-04) |
| B2.5 split classify intents (BD-11; ObjectMembershipIntent + ObjectRelateIntent) | Not started |
| Phase B establishRelation vertical | In progress (B2.5 next, then B3) |
| Phase C Plan IR | Not started |
| Phase D LLM plans | Not started |

## Coordination notes

- **Phase A** landed **`verbClass`** (`acquire` | `release`), merged-catalog identity, and the relational preposition guard before relational frame work. Classify still emits **`ObjectManipulationIntent`** until B2.5 ships.
- **B2.5 (BD-11):** split **`ObjectMembershipIntent`** / **`ObjectRelateIntent`** replaces **`ObjectManipulationIntent`** at classify; **`parseCommand`** routes by intent **`type`**. Interim B1--B2 **`relationalRoute`** preposition regex remains until B2.5 parity tests pass. **`verbClass`** applies only to **`ObjectMembershipIntent`** --- not a third value on a shared type.
- Phase B **replaces** the Phase A preposition guard with frame extract + **`establishRelation`**; split classify intents (**B2.5**) replace regex-as-primary-router.
- Positions **M4** kernel work (edge mutations) is on the critical path for Phase B; actions parse can proceed with mocked apply until ingress contract is frozen.
- **`in`** / nesting is an explicit **deferral** --- document player-facing copy when frame extract or relation normalizer detects containment language.
