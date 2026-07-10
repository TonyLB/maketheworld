# Object manipulation parse --- Phases B--D (frame, establishRelation, plan IR)

**Status:** Phase B complete (B6 durable docs shipped). **Fault-tolerant gateway Done (FT-4.3, 2026-07-10)** --- Gateway exit complete; planning file retired (git retains history). **Phase C unblocked** (ready for C1). Phase C design debt from that gateway is consolidated below (**Phase C design debt**). **Sibling plan split out (2026-07-10):** [`AGENT.planCompilerSandbox.planning.md`](AGENT.planCompilerSandbox.planning.md) now owns the in-memory dry-run sandbox design + build checklist --- a blocking prerequisite for C1 compound-plan legality.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

Prerequisite (shipped): Phase A membership compiler --- [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md#object-manipulation-classify--enrich-steady-state-shipped---b25-split-intents) (**`verbClass`**, **`compileMembershipAtomic`**, merged-catalog identity); Phase B relational vertical shipped (frame extract, normalizer, compiler, egress, positions apply, perception). Module inventory: [`actions/enrich/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/AGENT.md).

## Purpose

Ship generic **`establishRelation`** --- one relational operator parameterized by relation kind (not per-preposition operators like **`placeOn`**). Player language ("on", "under", "leaning against", "tied around") becomes a **manipulation frame** (subject, target, relation), compiled deterministically into positions **host-local relational patches** and perception transcript.

Phases B--D evolve parse from coarse intent classification toward **split manipulation intents at classify (BD-11) + frame extraction + deterministic plan compilation + execution**, without requiring full LLM-authored multi-step plans on day one.

Retire this plan when Phase C--D steady-state docs land (Phase B durable docs shipped in B6); git retains history.

## Phase map

| Phase | Focus | Outcome |
| --- | --- | --- |
| **A** (shipped) | Membership atomics | **`verbClass`**, **`compileMembershipAtomic`** (compiler v0), legacy deletion, preposition guard |
| **B** | **`establishRelation`** vertical | Frame slots, relation normalization, stream/apply/presentation |
| **C** | Plan IR + composition | Deterministic compiler; optional multi-step (e.g. drop + relate) |
| **D** | Advanced planning (optional) | LLM plan generation only where compiler cannot derive steps |

## Target architecture (steady-state sketch)

```text
discriminateIntent (ObjectMembershipIntent + verbClass acquire | release OR ObjectRelateIntent)
  -> parseCommand routes by intent type (enrichRoute from classify)
  -> membership enrich OR frame extract LLM hop -> manipulation frame (subject / target / relationSpan + operationKind)
  -> plan compiler (deterministic: resolve spans, normalize relation, legality)
  -> plan executor -> stream event(s) -> positions -> perception
```

**Classify contract (Phase A interim + B2.5):** Replace the undifferentiated **`ObjectManipulationIntent`** umbrella with two classify outcomes (**BD-11**):

| Intent | Topology | Classify fields | Enrich path |
| --- | --- | --- | --- |
| **`ObjectMembershipIntent`** | Node / membership host --- which **`positionGraph`** hosts the object | **`objectSpans`**, **`verbClass`** (`acquire` \| `release`) | **`compileMembershipAtomic`** |
| **`ObjectRelateIntent`** | Edge / in-host relation between objects on a host graph | **`objectSpans`** only (no **`verbClass`**) | frame extract -> normalizer -> relational compiler |

Classify **must** own the membership vs relational distinction semantically (not enrich preposition regex once B2.5 ships). **`verbClass`** remains membership **language** direction only --- unchanged from Phase A, scoped to **`ObjectMembershipIntent`**. Frame extraction stays a dedicated enrich hop (**BD-4**) and owns relational **operator direction** via **`operationKind`** (**BD-12**).

**Classify vs enrich ownership (relational):**

| Field | Lane | Meaning |
| --- | --- | --- |
| Intent **`type`** (`ObjectRelateIntent`) | Classify | Membership vs in-host relational topology |
| **`operationKind`** (`establishRelation` \| `dissolveRelation`) | Frame extract LLM (**BD-12**) | Relational **operator** choice from player language |
| **`relationKind`** / **`relationLabel`** | Deterministic normalizer (B2) | Map LLM **`relationSpan`** to closed enum or **`Custom`** |
| Grounded ids, host, legality | Compiler | Catalog resolve, graph observation, BD-10 rules only |

**Plan IR (Phase C)** --- primitives are validated, not model-invented:

| Primitive | Role |
| --- | --- |
| ~~`resolveComponent`~~ | **Retired as a runtime primitive (FT-5, 2026-07-08).** Span grounding folds into the joint `(identity, plan)` hop (FT-2 (e)); the surviving deterministic per-span work is the **selector verdict** (`SpanCandidatePool` -> `SpanResolutionOutcome`) + an **existence/presence guard**, both facets of the compiler tail, not an executable step |
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

Enum members and custom persist shape: [`positions/AGENT.contract.md` --- Host-local relational patch](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#host-local-relational-patch-phase-b-shipped-b4) (BD-2, BD-3).

## Scope

### Phase B --- in scope

- **Manipulation frame** schema: role-tagged spans (`subject`, `target`), **`relationSpan`**, and **`operationKind`** (`establishRelation` \| `dissolveRelation`, **BD-12**). **`ObjectRelateIntent`** at classify (**BD-11**) replaces preposition-regex as primary enrich entry signal once B2.5 ships; interim B1--B2 routing via [`relationalRoute.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/relationalRoute.ts).
- Frame extraction hop (**dedicated enrich prompt**, BD-4 --- not shared complexity LLM) + JSON validation; emits **`operationKind`** alongside spans (**BD-12**); replaces Phase A relational preposition guard for supported frames. B1 shipped span-only extract; B3 extends the hop before relational compiler work.
- **Relation normalizer**: map **`relationSpan`** -> **`relationKind`** (enum | `Custom`) + optional **`relationLabel`**.
- Terminal parse + egress: new top-level result variant (BD-1) --- e.g. **`ParseCommandEstablishRelationResult`** (`type: 'EstablishRelation'`) with subject/target ids, **`relationKind`**, optional **`relationLabel`**, and **`operationKind: 'establishRelation' | 'dissolveRelation'`** (BD-7). Membership atomics keep **`ObjectManipulation`** + **`takeHold` | `drop`** unchanged.
- Promote **`relationalPlacement`** from terminal-only Error to grounded success path when frame validates.
- Positions: **`applyHostRelationalPatch`** shipped --- [`manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md#host-local-relational-patch-phase-b-shipped-b4).
- Perception: transcript template (withhold unstated geometry per [`diegeticLogic/AGENT.unknowns.concepts.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.unknowns.concepts.md)).
- Four-lane doc updates: [`diegeticLogic/AGENT.operators.concepts.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md), positions contract, actions implementation.

### Phase C --- in scope

- Explicit **Plan IR** types + deterministic **compiler** (frame + catalogs + membership -> ordered steps).
- **Composition rules (BD-8):** when single command implies membership change + relation (e.g. held object + "put X on Y"), compiler auto-inserts **`drop`** before **`establishRelation`** --- no require explicit drop language.
- **`MultipleCommands`** policy: reject vs allow bounded multi-step from one line.
- **Multi-step failure (BD-9):** composed plans (**drop** + **`establishRelation`**, etc.) apply **atomically** --- positions kernel bundles membership **`HostEffect[]`** + relational patches in **one** `transactWrite` (same family as graph+adjacency bundling in **`applyHostEffects`**). **Not** sequential per-step streams with first-step commit; **not** RoomStack-style fail-tolerant tail.
- **Compiler shape (from fault-tolerant gateway, 2026-07-08):** the C1/C2 compiler is a **candidate proposer** (deterministic fast-pass *or* LLM fallback) feeding a **shared deterministic validator** that runs a **pure dry-run legality evaluation over an in-memory sandbox** (no persist) and returns `verdict + decidable + resultPreview`. Selection is a deterministic **legality-gated + confidence** rubric (enum -> fast-approve; **`Custom`** / unmodeled -> LLM validator = BD-10 `defer`) that **auto-resolves** the winner or **Consults** ("commit" reserved for persist + publish). Span grounding is the deterministic **tail** of the joint `(identity, plan)` hop; **`resolveComponent` is retired as a standalone Plan IR primitive** --- the surviving per-span work is the selector verdict + an existence/presence guard. **New Phase C prerequisites:** (a) an **in-memory sandbox** capability for compound (BD-9) legality; (b) **deterministic interaction-under-transfer semantics per enum relation** (e.g. `On` dissolves on pickup; `Under` may block / compose) --- the modeled core that lets `get X off Y` fast-approve, whose absence for `Custom` routes legality to the LLM validator. Golden path (known verb + exact label + all-enum blast radius) stays **zero Bedrock** via staged fast-path composition. **Design, open decisions, and build checklist for the sandbox itself now live in a sibling plan:** [`AGENT.planCompilerSandbox.planning.md`](AGENT.planCompilerSandbox.planning.md).

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
3. Read positions relational implementation: [`manipulation/AGENT.implementation.md` --- Host-local relational patch](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md#host-local-relational-patch-phase-b-shipped-b4).
4. Trace relational enrich path: [`enrich/objectManipulation/index.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/index.ts) (interim **`relationalRoute`** -> frame extract; B2.5 routes **`ObjectRelateIntent`** at parse ingress), [`frameExtract/runFrameExtractStage.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/frameExtract/runFrameExtractStage.ts). Membership defer still uses complexity LLM in [`buildPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/buildPrompt.ts). **Note:** both the **frame extract** and **complexity LLM** hops are slated to **retire** as distinct LLM steps under Phase C (**C4**) --- see **Phase C design debt** (**Legacy hop retirement**).
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
| BD-4 | **Frame extraction placement** --- **dedicated enrich hop** (new module under enrich); **not** shared complexity LLM. Relational formation is distinct from cross-graph membership movement. Primary relational **routing** moves to classify **`ObjectRelateIntent`** (**BD-11**); frame extract remains enrich-side and emits relational **`operationKind`** per **BD-12**. | Prompt layout + Bedrock budget | Decided (revised 2026-07-05) |
| BD-5 | **Target resolution** --- v1: **room object catalog only** for subject + target resolve. **Extend** to features/surfaces and nested **`positionGraph`** hierarchy targets when nested-host target matching ships (follow-on; not Phase B). Non-object targets ("floor", "wall") out of scope v1. | Frame extract + resolve | Decided |
| BD-6 | **Host selection** --- v1: always actor's **current room** **`positionGraph`** (`roomExitContext.fromRoomId`). | Positions ingress | Decided |
| BD-7 | **Inverse operator** --- include **`dissolveRelation`** in v1 (remove edge on host graph); pair with **`establishRelation`**. Frame extract classifies establish vs dissolve via **`operationKind`** (**BD-12**). | Phase B scope | Decided (revised 2026-07-05) |
| BD-8 | **Composition (Phase C)** --- compiler **auto-inserts** **`drop`** before **`establishRelation`** when subject is held (no require explicit "drop then put" language). | Compiler | Decided |
| BD-9 | **Multi-step failure** --- **atomic all-or-nothing** via positions **kernel bundling**: one compound apply / single `transactWrite` spanning membership **`HostEffect[]`** + relational **`HostRelationalPatch[]`** on affected hosts (mirror graph+adjacency in **`applyHostEffects`**). **Not** sequential stream-per-step with first-step commit; **not** RoomStack fail-tolerant tail. On apply failure: no partial graph change, player **Error**. | Executor + positions kernel (Phase C) | Decided |
| BD-10 | **LLM plan generation (Phase D)** --- **`defer`** when compiler cannot derive a deterministic registry plan because **non-trivial existing in-host relational topology** on subject and/or target interacts with the proposed patch (conflicting edges, replace/coexist/dissolve-first ambiguity). **Hard Error** (all phases): grounding/catalog failure, **`in`**/nesting (BD-2), **`MultipleCommands`**, nodes not on host graph, **`dissolveRelation`** with no matching edge, plan-LLM invoke/parse/validation failure. **B--C interim:** defer bucket -> terminal **Error** stub (no plan LLM yet). **Deterministic allow:** idempotent duplicate edge (exact edge already present). | Phase D entry; B3 legality; C1 compiler | Decided |
| BD-11 | **Split manipulation classify intents** --- replace undifferentiated **`ObjectManipulationIntent`** with **`ObjectMembershipIntent`** (object moves between membership hosts --- which **`positionGraph`** node hosts the object; **`objectSpans`** + **`verbClass`** `acquire` \| `release`; compiled via **`takeHold`** / **`drop`**) and **`ObjectRelateIntent`** (in-host edge between objects on a host graph --- **`objectSpans`** only, no **`verbClass`**; compiled via **`establishRelation`** / **`dissolveRelation`**). Classify owns semantic membership vs relational distinction via intent **`type`**, not a sub-field. **`parseCommand`** branches on intent type; enrich **`ObjectRelateIntent`** -> frame extract path, **`ObjectMembershipIntent`** -> **`compileMembershipAtomic`**. Retire **`relationalRoute`** preposition regex as primary gate after B2.5 parity tests (may keep as interim fallback one release). Remove **`ObjectManipulationIntent`** from classify prompt and parser when B2.5 ships. **Superseded in part by FT-7 (2026-07-08):** Phase C **reunifies** membership + relational into **one manipulation-family intent type** with an optional `{ subTopology?, verbClass?, confidence }` hint bundle --- the **top-level committed `type` split / `enrichRoute` fork is retired** (it was a trusted-output construct; a committed sub-topology route is the premature commitment fault tolerance removes). **Surviving from BD-11:** the manipulation family is classify-owned and **`verbClass`** stays membership language direction (`acquire` \| `release`). Only the first-class-type / committed-routing role is walked back. See **Phase C design debt** (**Classify reunify / FT-7**); lands with **C4**. | B2.5 classify; B3+ parse/enrich entry | Decided (revised 2026-07-04); routing role superseded by FT-7 (2026-07-08) |
| BD-12 | **Relational `operationKind` ownership** --- frame extract LLM (**BD-4**) emits required **`operationKind`**: `establishRelation` \| `dissolveRelation` (**BD-7**). Forbidden at classify (same as membership **`operationKind`**). Relational compiler **validates** and applies legality; **must not** infer operator choice from phrase buckets, prefix stripping, or command regex. Membership **`operationKind`** fast path remains graph-driven (**`complexityPreGates`**), not language-driven. | B3 frame extract + compiler | Decided (2026-07-05) |

### Deterministic enrich boundary (BD-12)

Graduated to [`llm/AGENT.contract.md`](../../../../../lambda/ephemera/llm/AGENT.contract.md) (**Deterministic enrich boundary**) and [`llm/AGENT.concepts.md`](../../../../../lambda/ephemera/llm/AGENT.concepts.md) (design seams, field ownership, fast-path closure). Output trust models (trusted-output vs fault-tolerant) are documented separately in the same concepts file.

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
  - [X] Capture enum list and edge persist shape in positions contract draft (BD-2, BD-3) --- [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#host-local-relational-patch-phase-b-shipped-b4).

- [X] **B1. Frame schema + extraction**
  - [X] Define **`ManipulationFrame`** types (subject/target/relation spans; role tags) in actions enrich layer.
  - [X] Add frame extraction prompt + interpreter (new module under [`enrich/objectManipulation/frameExtract/`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/frameExtract/)).
  - [X] Wire: relational route (preposition guard successor / multi-span) -> frame extract -> compiler stub; membership lines still use **`verbClass`** acquire/release path from Phase A.
  - [X] Tests: fixture commands ("put broom on table", "lean rope against anvil", "tie cord around crate").

- [X] **B2. Relation normalizer**
  - [X] Deterministic map: common prepositions -> enum; **`in`** -> explicit defer/nesting message; else **`Custom`** + label.
  - [X] Optional small LLM hop for paraphrase -> enum only if deterministic map insufficient (BD-2 locked enum; defer LLM unless map gaps found in B2 tests).
  - [X] Tests: enum paths, custom paths, excluded **`in`**.

- [X] **B2.5. Split manipulation classify intents (BD-11)**
  - [X] Add **`ObjectMembershipIntent`** and **`ObjectRelateIntent`** to classify JSON, parser, guards, and **`IntentClassificationResult`** union in [`baseClasses.ts`](../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts); remove **`ObjectManipulationIntent`** when parity tests pass.
  - [X] Update [`buildIntentClassificationPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/buildIntentClassificationPrompt.ts): Section A2 **`ObjectMembershipIntent`** (membership host transfer; **`verbClass`** required); Section A2b **`ObjectRelateIntent`** (in-host edge change; semantic relational examples without fixed preposition list; no **`verbClass`**). Shared tie-breakers vs AcmeOrder / NavigationIntent for manipulation family.
  - [X] Update deterministic fast path ([`deterministicChecks.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts)): synthesize **`ObjectMembershipIntent`** for minimal take/drop/get (not **`ObjectRelateIntent`**).
  - [X] Wire [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts): **`ObjectMembershipIntent`** -> **`enrichObjectManipulation`** membership path; **`ObjectRelateIntent`** -> relational frame-extract path. Demote [`relationalRoute.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/relationalRoute.ts) from primary gate after parity tests.
  - [X] Tests: **`ObjectMembershipIntent`** lines (`pick up broom`); **`ObjectRelateIntent`** with and without listed prepositions; reject **`verbClass`** on **`ObjectRelateIntent`**; parseCommand E2E with mocked classify intent type.
  - [X] Durable docs: classify contract in [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md); enrich sequence in [`enrich/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/AGENT.md).

- [X] **B3. Grounding + legality**
  - [X] **Frame extract extension (BD-12):** add required **`operationKind`** (`establishRelation` \| `dissolveRelation`) to frame extract prompt, interpreter, and **`ManipulationFrame`**; remove **`operationKind`** from frame-extract forbidden fields. Tests: establish fixtures (B1) plus dissolve ("take rope off crate", "remove cord from crate").
  - [X] Resolve subject + target against catalogs; host selection per BD-6.
  - [X] Relational compiler: pass through frame **`operationKind`**; run B2 **`normalizeRelationSpan`** on **`relationSpan`** only (no prefix stripping or dissolve phrase buckets).
  - [X] Legality (BD-10): both nodes on host graph; **idempotent** duplicate edge -> allow/no-op; **conflicting** or non-trivial existing relational topology on subject/target -> **Error** stub in B--C (compiler **`defer`** bucket until Phase D).
  - [X] Replace interim **`relationalRoute`** / **`relationalPlacement`** terminal Error stubs for supported frames with grounded terminal parse (requires B2.5 **`ObjectRelateIntent`** routing for production path).

- [X] **B4. Positions persist + ingress**
  - [X] Implement **`applyHostRelationalPatch`** + **`HostRelationalPatch`** types per stub.
  - [X] Stream contract + guard (**`Object Establish Relation`** / **`Object Dissolve Relation`**) in [`publishedEvents.ts`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts).
  - [X] Coordinator under [`manipulation/relational/`](../../../../../lambda/ephemera/dataSource/positions/manipulation/relational/) (create tree).
  - [X] Tests: apply, idempotency, reject invalid patch.

- [X] **B5. Actions egress + perception**
  - [X] [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) publish stream on grounded relational parse.
  - [X] Perception fan-in: intent + fact -> **`WorldMessage`** (withhold geometry; assert relation per unknowns).
  - [X] End-to-end tests: parse -> stream -> apply -> transcript.

- [X] **B6. Durable docs**
  - [X] [`diegeticLogic/AGENT.operators.concepts.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md) --- **`establishRelation`** + **`dissolveRelation`** sections; refresh membership classify refs; replace out-of-scope stub.
  - [X] [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) --- promote planning contract to shipped; ingress subsections + relational-changed bundle.
  - [X] [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) --- replace relational stub prose; add relational operator playbook.

### Phase C --- Plan IR and composition

**Prerequisite:** Fault-tolerant Gateway exit **complete (FT-4.3, 2026-07-10)** --- span resolution artifacts, FT-1--FT-5 decided/shipped, Abstain/Consult contract. The Plan IR **span-grounding tail** (selector verdict + existence/presence guard; `resolveComponent` retired as a standalone primitive) should consume provisional **`SpanCandidatePool`** handoffs, not trusted-output-only identity output. **C1 may begin.** Forward-looking design debt from that gateway is consolidated in **Phase C design debt** below (planning file deleted; git retains history).

- [ ] **C1. Plan IR types + registry**
  - [ ] Define **`ParsePlanStep`** union and runtime primitive registry (transferMembership, establishRelation, dissolveRelation). **`resolveComponent` is not a runtime primitive**; grounding is the selector verdict + existence/presence guard in the compiler tail, not an executable step.
  - [ ] Deterministic **compiler** from **`ManipulationFrame`** + context -> plan (usually length 1; sometimes 2+) or **`defer`** / **Error** per BD-10.
  - [ ] **LLM joint `(identity, plan)` proposer** (deferred from FT-3.2): open-language fallback when closed-world fast-path fails; emits N ranked tuples for FT-5 selection; owns semantic grey-band Abstain/Consult beyond numeric floors. See **Phase C design debt** (**Legacy hop retirement**) and the sibling sandbox plan (**Instruction compiler + validator**, [`AGENT.planCompilerSandbox.planning.md`](AGENT.planCompilerSandbox.planning.md)).
  - [ ] **Dry-run sandbox** (blocking prerequisite): consume [`AGENT.planCompilerSandbox.planning.md`](AGENT.planCompilerSandbox.planning.md) --- the compiler's legality validation for compound (BD-9) plans depends on that sandbox existing before C1 can select/auto-resolve a compound candidate.

- [ ] **C2. Executor + compound kernel apply**
  - [ ] Compiler emits ordered plan; executor routes **length-1** plans to existing single-step streams (Phase B path).
  - [ ] **Length-2+** composed plans (BD-8): **one** positions ingress / compound coordinator --- kernel **`transactWrite`** bundles all **`HostEffect[]`** + **`HostRelationalPatch[]`** (BD-9); **must not** emit sequential **`Object Drop`** then **`Object Establish Relation`** with independent partial commit.
  - [ ] On compound apply failure: return **Error** to player; no membership-changed or relational fact streams.
  - [ ] Perception/transcript: single composed outcome when compound apply succeeds (not separate drop + relate lines unless product decides otherwise at C2).

- [ ] **C3. Classifier / MultipleCommands policy**
  - [ ] Document when composite single-line commands compile vs **`MultipleCommands`** Error.
  - [ ] Tests: "pick up broom and go north" (likely reject); "toss pouch on floor" (compose if in scope).

- [ ] **C4. Refactor enrich entry** (shape set by FT-7 --- two-level classify / reunified family type)
  - [ ] Generalize **`compileMembershipAtomic`** (Phase A) into full plan compiler; the **reunified manipulation-family intent** (FT-7; membership + relational under one `type` with a provisional sub-topology hint) routes through the **single shared entry** into the FT-6 orchestrator --- **no `enrichRoute` fork** (the split-type route retired with BD-11's routing role).
  - [ ] Deprecate ad-hoc stage graph where compiler subsumes it; **retire complexity LLM + frame extract as distinct hops** (deferred from FT-3.2); remove **`relationalRoute`** preposition gate when B2.5 intent routing is steady-state. Sub-topology + **`verbClass`** arrive as **provisional hints** (evidence for the joint hop), not committed routes; **`confidence === 1.0`** marks a closed-world (deterministic template) hint that drives the zero-Bedrock fast-path. See **Phase C design debt** (**Classify reunify / FT-7**, **Legacy hop retirement**).

- [ ] **C5. Re-examine FT-1.3.1 legacy admissibility harness (follow-on housekeeping)**
  - [ ] Decide whether [`testing/legacyLexicalChannelGate`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/testing/legacyLexicalChannelGate.ts), the **`resolveLexicalChannelActive`** override on [`buildSpanCandidatePool`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/buildSpanCandidatePool.ts) / calibration runners, and the **legacy vs gate-off** baseline arm in [`compareAdmissibilityArms`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/testing/compareAdmissibilityArms.ts) still earn their keep.
  - [ ] **Timing rationale:** gate-off production (FT-1.3.1) will have been live far longer than the legacy gate existed (~18h); by Phase C steady-state, FT-5 selector + compound compiler should have exercised short-span pool paths in a production-shaped context.
  - [ ] **Likely outcome if deleting:** drop frozen legacy gate module; simplify harness to gate-off-only regression fixtures (spurious diverse-catalog length-1 below `T_JOINT_ABS`, shorthand cases allowed high); remove production injection hook unless another A/B baseline still needs it. Update [`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md) + [`calibration/AGENT.md`](../../../../../lambda/ephemera/calibration/AGENT.md).
  - [ ] **Keep if:** identity-corpus ranking A/B still catches unintended lexical/combine drift, or calibration snapshots depend on the dual-arm comparison.

## Phase C design debt (consolidated from fault-tolerant gateway, 2026-07-10)

Plan-only forward-looking decisions absorbed when the fault-tolerant gateway plan was retired. Shipped enrich behavior lives in durable docs ([`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md), [`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md), [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md)). Graduate rows into those docs when C1/C4 ship.

### Instruction compiler + validator (C1/C2)

**Split out (2026-07-10) into a sibling plan:** [`AGENT.planCompilerSandbox.planning.md`](AGENT.planCompilerSandbox.planning.md) --- design debt, open decisions (SB-1--SB-4), and a build checklist (S1--S6) for the in-memory dry-run sandbox this compiler/validator depends on. That plan owns the sandbox itself (state shape, compound simulation, interaction-under-transfer rule table, `resultPreview` shape).

**What stays here (compiler/selector shell, not the sandbox):**

- **Propose-N, then deterministic legality-gated selection (not iterative backtrack).** The joint hop emits **N ranked `(identity, plan)` candidates** in one generation; a deterministic **selector** evaluates all N (via the sandbox) and picks-or-Consults. Selection is a **testable pure function** of `(candidates, current-state)`.
- **Legality gates, confidence ranks --- lexicographic.** Partition by legality (`clean-legal` > `defer` > `illegal`); rank **within legal survivors** by absolute calibrated confidence. Confidence never buys back illegality.
- **Selection may decline.** Below FT-5 floor or thin margin over runner-up -> **Consult/Abstain**, not argmax. Runner-up **legal** candidates are the Consult menu.
- **Keep proposer/validator split** even when both are deterministic on the golden path --- the validator (sandbox) is the **single shared legality authority** the LLM proposer must also pass.

### Span resolution I/O + selector (C1 tail)

**Two types (locked):** [`SpanCandidatePool`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/spanResolution.ts) (input evidence: `candidates[]` + per-candidate `locus`) and `SpanResolutionOutcome` (selector verdict: `resolved` | `consult` | `error`). No `status` on the input; emptiness is `candidates.length === 0`.

**`locus`:** discriminated union `room` | `heldByActor` | `heldByOtherCharacter` | `withinObject` --- deterministic graph/catalog evidence only; never licenses `operationKind` invention (BD-12). v1 production = room/held; `withinObject` is a future re-entrant supplement (not C1-blocking).

**Selector is two phases (one selection point):**

1. **Selection (cross-tuple):** legality partition + `T_JOINT_*` floor + margin over runner-up -> auto-resolve one tuple or Consult/Abstain.
2. **Existence/presence guard (per span on chosen tuple):** referential integrity only --- not a re-litigation of semantics.

**`resolveComponent` is not a Plan IR runtime primitive** --- grounding is this selector tail. Floor magnitude follows recoverability: illegal-if-wrong -> large discount (auto-resolve on modest confidence); legal-but-wrong -> hold floor + Consult.

**"Commit"** is reserved for persist + publish; the FT-5 act is **auto-resolve / select**.

### Legacy hop retirement (C1 proposer + C4)

**Complexity LLM --- retire as a distinct hop (C4).** Deterministic half -> dry-run sandbox legality; semantic residue (`Custom` / unmodeled) -> shared LLM validator (BD-10 `defer`). Membership `operationKind` becomes deterministic fallout once identity + host are pinned (`verbClass` is evidence only).

**Frame extract --- retire as always-on LLM hop (C4); work splits:**

- **Down (net-new deterministic fast-path):** closed-grammar relational frames (`put` / `place` / `lean` / `take off` + known prepositions) --- relation phrase is enum lookup, `operationKind` from verb template, roles from `V NP prep NP`. Does not exist today; build as relational analog of membership fast path.
- **Up (general joint hop, C1):** open relational language -> joint `(identity, plan)` proposer owns role decomposition + operator selection + identity jointly.
- Downstream **normalizer** + **legality** unchanged.

**No narrow-scope "tier-2" LLM** between template and general proposer. Untemplated-simple-language is a **classify** concern.

**Owner map (Abstain / Consult / defer):**

| Concern | Owner |
| --- | --- |
| Abstain / Consult | Proposer / joint hop (FT-5 gate for commit-vs-Consult) |
| Defer -> Error | Shared dry-run validator (BD-10) |
| Relational `operationKind` (BD-12) | Proposer (template / joint hop) --- **never** the deterministic compiler |

**FT-3.2 shipped on deterministic path only** (Consult/Abstain wire). Accepted interim until C1/C4: numeric-only grey-band; complexity LLM + frame extract still live production hops.

### Classify reunify / FT-7 (C4)

**Two-level classify:** trusted-output at the **family** level only (manipulation vs navigation vs speech vs Acme). Intra-manipulation sub-fields (`subTopology`, `verbClass`) become **provisional hints** consumed as evidence by the joint hop --- not committed routing.

**Reunified manipulation-family intent type** with optional `{ subTopology?, verbClass?, confidence }` --- supersedes BD-11's top-level `ObjectMembershipIntent` / `ObjectRelateIntent` **routing** role (family + `verbClass`-as-membership-direction semantics survive). **No `enrichRoute` fork** --- one shared entry into the FT-6 orchestrator (= concrete content of C4).

**Hint trust:** `confidence === 1.0` is a reserved closed-world sentinel (deterministic producers only; LLM clamped `< 1.0`); seam fast-path fires on strict equality, never a threshold. Hint confidence may weight joint-hop evidence; must **not** blend as a naive addend into the FT-5 absolute floor.

**Family-level wrong commit** stays trusted-output terminal (Abstain; no cross-family re-route this iteration).

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
- "take the rope off the crate" -> frame extract **`operationKind: dissolveRelation`** (BD-12); legality requires matching edge on room host (BD-7, BD-10).

## Progress

| Milestone | Status |
| --- | --- |
| Phases B--D task plan | Done |
| Phase A prerequisite | Not started (see companion plan) |
| BD-1--BD-11 open decisions locked | Done (2026-07-04) |
| BD-12 relational operationKind via frame extract | Done (2026-07-05 decision; 2026-07-05 implementation) |
| B0 decision lock + positions contract draft (BD-2, BD-3) | Done (2026-07-04) |
| B1 frame schema + extraction | Done (2026-07-04) |
| B2 relation normalizer (deterministic map; nesting defer; no LLM hop) | Done (2026-07-04) |
| B2.5 split classify intents (BD-11; ObjectMembershipIntent + ObjectRelateIntent) | Done (2026-07-04) |
| B3 grounding + legality | Done (2026-07-05) |
| B4 positions persist + ingress | Done (2026-07-05) |
| B5 actions egress + perception | Done (2026-07-05) |
| B6 durable docs (four-lane steady-state) | Done (2026-07-05) |
| Phase B establishRelation vertical | Done |
| Fault-tolerant gateway | **Done (FT-4.3, 2026-07-10)** --- Gateway exit complete; planning file retired; design debt consolidated in **Phase C design debt** |
| Phase C Plan IR | **Ready / Not started** (unblocked; begin at C1) |
| Phase C plan-compiler sandbox (sibling plan) | **Not started** --- see [`AGENT.planCompilerSandbox.planning.md`](AGENT.planCompilerSandbox.planning.md); blocking prerequisite for C1 compound legality |
| Phase C5 legacy admissibility harness review | Not started (follow-on after C4) |
| Phase D LLM plans | Not started |

## Coordination notes

- **Phase A** landed **`verbClass`** (`acquire` | `release`), merged-catalog identity, and the relational preposition guard before relational frame work. Classify emits **`ObjectMembershipIntent`** or **`ObjectRelateIntent`** (B2.5 shipped).
- **B2.5 (BD-11):** split **`ObjectMembershipIntent`** / **`ObjectRelateIntent`** replaces **`ObjectManipulationIntent`** at classify; **`parseCommand`** routes by intent **`type`** via **`enrichRoute`**. **`relationalRoute`** preposition regex removed as primary enrich gate (module retained for unit tests). **`verbClass`** applies only to **`ObjectMembershipIntent`** --- not a third value on a shared type. **FT-7 / C4** walks back the committed-routing role of this split (see **Phase C design debt**).
- Phase B shipped frame extract + **`establishRelation`** / **`dissolveRelation`** end-to-end; durable docs in B6 ([`diegeticLogic/AGENT.operators.concepts.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md), [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#host-local-relational-patch-phase-b-shipped-b4), [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md)).
- **`in`** / nesting is an explicit **deferral** --- player-facing copy when frame extract or relation normalizer detects containment language ([`AGENT.operators.concepts.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md) **Still out of scope**).
- **BD-12 (2026-07-05):** B1 frame extract shipped span-only; forbidding **`operationKind`** at classify *and* frame extract left no owner and invited phrase-bucket compiler hacks. **`operationKind`** (`establishRelation` \| `dissolveRelation`) is now owned by the frame extract LLM (no extra Bedrock hop). Compiler stays deterministic for grounding + legality only. Under C4, BD-12 ownership moves to the **proposer / joint hop** (see **Phase C design debt**). General seam rules graduated to [`llm/AGENT.contract.md`](../../../../../lambda/ephemera/llm/AGENT.contract.md) and [`llm/AGENT.concepts.md`](../../../../../lambda/ephemera/llm/AGENT.concepts.md).
- **Fault-tolerant gateway (retired 2026-07-10):** Gateway exit complete (FT-4.3). Production path emits `SpanCandidatePool` + FT-5 selector on membership and relational; Consult/Abstain first-class. Planning file deleted; Phase C design debt consolidated in this document. Durable trust posture: [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md).
- **FT-1.3.1 admissibility gate retired (2026-07-09):** short-span admissibility gate retired; lexical always on for non-empty spans. FT-5 auto-resolve consumes `T_JOINT_*` on normalized joint relevance. Constants: [`thresholds.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts). Legacy harness baseline retained; **C5** re-examines deletion after Phase C steady-state.
- **FT-1.4 leading-article normalization (2026-07-09):** classify-only QoL --- [`peelLeadingArticleWhenTail`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/peelLeadingArticleWhenTail.ts).
