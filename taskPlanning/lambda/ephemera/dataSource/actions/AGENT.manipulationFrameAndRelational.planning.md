# Object manipulation parse --- Phases B--D (frame, establishRelation, plan IR)

**Status:** Planning only --- blocked on Phase A shipping (or explicit parallel agreement). Next step: lock relation representation (hybrid enum + custom) and frame-extraction hop design.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

Prerequisite / companion: [`AGENT.manipulationParsePhaseA.planning.md`](./AGENT.manipulationParsePhaseA.planning.md) (**`verbClass`**, **`compileMembershipAtomic`**, merged-catalog identity, legacy verb-inference deletion, relational preposition guard).

## Purpose

Ship generic **`establishRelation`** --- one relational operator parameterized by relation kind (not per-preposition operators like **`placeOn`**). Player language ("on", "under", "leaning against", "tied around") becomes a **manipulation frame** (subject, target, relation), compiled deterministically into positions **host-local relational patches** and perception transcript.

Phases B--D evolve parse from "single intent classification" toward **frame extraction + deterministic plan compilation + execution**, without requiring full LLM-authored multi-step plans on day one.

Retire this plan when relational vertical + plan IR steady-state docs land; git retains history.

## Phase map

| Phase | Focus | Outcome |
| --- | --- | --- |
| **A** (separate plan) | Membership atomics | **`verbClass`**, **`compileMembershipAtomic`** (compiler v0), legacy deletion, preposition guard |
| **B** | **`establishRelation`** vertical | Frame slots, relation normalization, stream/apply/presentation |
| **C** | Plan IR + composition | Deterministic compiler; optional multi-step (e.g. drop + relate) |
| **D** | Advanced planning (optional) | LLM plan generation only where compiler cannot derive steps |

## Target architecture (steady-state sketch)

```text
discriminateIntent (short intent list; verbClass acquire | release for membership lines)
  -> relational route (preposition guard or multi-span -> frame extract LLM hop)
  -> manipulation frame (subject / target / relationSpan)
  -> plan compiler (deterministic: resolve spans, normalize relation, legality)
  -> plan executor -> stream event(s) -> positions -> perception
```

**Classify contract (Phase A, unchanged in Phase B):** **`verbClass`** stays **`acquire` | `release`** for membership atomics. Relational commands do **not** add a third classify value; Phase B routes them via enrich (replace Phase A preposition guard with frame extraction).

**Plan IR (Phase C)** --- primitives are validated, not model-invented:

| Primitive | Role |
| --- | --- |
| `resolveComponent` | Map free-text span -> trusted `EphemeraId` via catalog |
| `transferMembership` | **`takeHold`** / **`drop`** (existing membership kernel path) |
| `establishRelation` | Add edge on host `positionGraph` (slice 5+ kernel) |
| `look` / others | Reuse existing affordance streams where composition needs them |

Phase B may compile to a **length-1 plan** internally without exposing a general executor API.

## Relation representation (preferred direction --- hybrid)

Product preference (from planning discussion): work deterministically with a **small closed enum** for common prepositions, reserve **`in`** for future **positionGraph nesting** (container hosts), and use **custom free-text** for long-tail relation phrases.

| Bucket | Examples | Persist / compile |
| --- | --- | --- |
| **Enum: surface relations** | `on`, `under`, `against` (TBD exact set) | Canonical **`relationKind`** on edge; Phase A guard uses **`on`** + **`under`** only --- extend guard when enum members ship |
| **Deferred: containment** | `in`, `inside` | Not **`establishRelation`** v1; routes to future nesting operator |
| **Custom** | `tied to`, `leaning against`, `wrapped around` | **`relationKind: Custom`** + **`relationLabel`** (player/normalized text) |

Lock exact enum members and presentation obligations in **Open decisions** before Phase B implementation.

## Scope

### Phase B --- in scope

- **Manipulation frame** schema: role-tagged spans (`subject`, `target`), **`relationSpan`** (no **`verbClass=relational`** at classify --- relational entry is enrich-side frame extract).
- Frame extraction hop (recommended: **dedicated enrich prompt**, not bloated main classifier) + JSON validation; replaces Phase A relational preposition guard for supported frames.
- **Relation normalizer**: map **`relationSpan`** -> **`relationKind`** (enum | `Custom`) + optional **`relationLabel`**.
- Terminal parse + egress: **`establishRelation`** (or **`ObjectManipulation`** variant with **`operationKind: 'establishRelation'`** --- lock in PA/B contract).
- Promote **`relationalPlacement`** from terminal-only Error to grounded success path when frame validates.
- Positions: implement **`applyHostRelationalPatch`** per stub in [`manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md#future-host-local-relational-patch-m4-stub-slice-5).
- Perception: transcript template (withhold unstated geometry per [`diegeticLogic/AGENT.unknowns.concepts.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.unknowns.concepts.md)).
- Four-lane doc updates: [`diegeticLogic/AGENT.operators.concepts.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md), positions contract, actions implementation.

### Phase C --- in scope

- Explicit **Plan IR** types + deterministic **compiler** (frame + catalogs + membership -> ordered steps).
- **Composition rules**: when single command implies membership change + relation (e.g. held object + "put X on Y").
- **`MultipleCommands`** policy: reject vs allow bounded multi-step from one line.
- Executor invokes existing stream contracts per step; define failure partial-commit behavior.

### Phase D --- optional / deferrable

- LLM emits step list when compiler returns **defer** (analogous to complexity LLM today).
- Reuse [`llm/pipeline/`](../../../../../lambda/ephemera/llm/pipeline/AGENT.md) if multi-hop frame+plan needs orchestration.

### Out of scope (unless plan updated)

- Full **`in`** / nested container host vertical (separate operator initiative).
- Client UI for relation editing.
- Removing **`ObjectManipulationIntent`** top-level classify bucket (keep short intent list).
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
2. Confirm Phase A status in [`AGENT.manipulationParsePhaseA.planning.md`](./AGENT.manipulationParsePhaseA.planning.md).
3. Read positions relational stub: [`manipulation/AGENT.implementation.md` --- Future: host-local relational patch](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md#future-host-local-relational-patch-m4-stub-slice-5).
4. Trace current relational rejection path: [`enrich/objectManipulation/index.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/index.ts), [`buildPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/buildPrompt.ts) (complexity LLM).
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
| BD-1 | **Terminal parse shape** --- extend **`ParseCommandObjectManipulationResult.operationKind`** with **`establishRelation`** + relation fields vs new top-level result variant | Phase B contract | Open |
| BD-2 | **Hybrid relation enum** --- lock v1 enum members (`On`, `Under`, ...); confirm **`In`** excluded and routed to future nesting | Normalizer + persist **`edge.kind`** | Open |
| BD-3 | **Custom relation storage** --- `Custom` + `relationLabel` on edge vs presentation-only label with generic kind | Persist + transcript | Open |
| BD-4 | **Frame extraction placement** --- dedicated enrich hop (decided: **not** expanded classify JSON; **`verbClass`** remains acquire/release only) vs shared complexity LLM | Prompt layout + Bedrock budget | Open |
| BD-5 | **Target resolution** --- room object catalog only vs include features/surfaces; handle non-object targets ("floor", "wall") | Frame extract + resolve | Open |
| BD-6 | **Host selection** --- v1 always actor's current room **`positionGraph`** vs derive from membership of subject/target | Positions ingress | Open |
| BD-7 | **Inverse operator** --- **`dissolveRelation`** / `remove` in v1 vs establish-only | Phase B scope | Open |
| BD-8 | **Composition (Phase C)** --- auto-insert **`drop`** before **`establishRelation`** when subject is held vs require explicit language | Compiler | Open |
| BD-9 | **Multi-step failure** --- atomic all-or-nothing vs first-step commit | Executor + bus semantics | Open |
| BD-10 | **LLM plan generation (Phase D)** --- criteria for defer vs hard Error | Phase D entry | Open |

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines as you finish each sub-step.

### Phase B --- establishRelation vertical

- [ ] **B0. Decision lock**
  - [ ] Close BD-1 -- BD-7 (minimum) in **Open decisions**; capture enum list and edge persist shape in positions contract draft.

- [ ] **B1. Frame schema + extraction**
  - [ ] Define **`ManipulationFrame`** types (subject/target/relation spans; role tags) in actions enrich layer.
  - [ ] Add frame extraction prompt + interpreter (new module under [`enrich/objectManipulation/`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/) or sibling `enrich/manipulationFrame/`).
  - [ ] Wire: relational route (preposition guard successor / multi-span) -> frame extract -> compiler stub; membership lines still use **`verbClass`** acquire/release path from Phase A.
  - [ ] Tests: fixture commands ("put broom on table", "lean rope against anvil", "tie cord around crate").

- [ ] **B2. Relation normalizer**
  - [ ] Deterministic map: common prepositions -> enum; **`in`** -> explicit defer/nesting message; else **`Custom`** + label.
  - [ ] Optional small LLM hop for paraphrase -> enum only if deterministic map insufficient (decide in BD-2).
  - [ ] Tests: enum paths, custom paths, excluded **`in`**.

- [ ] **B3. Grounding + legality**
  - [ ] Resolve subject + target against catalogs; host selection per BD-6.
  - [ ] Legality: both nodes on host graph; no duplicate conflicting edge (TBD); membership implications documented.
  - [ ] Replace Phase A relational preposition guard and **`relationalPlacement`** terminal Error for supported frames with grounded terminal parse.

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
  - [ ] [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) ingress + edge kind rules.
  - [ ] [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) --- replace relational stub prose.

### Phase C --- Plan IR and composition

- [ ] **C1. Plan IR types + registry**
  - [ ] Define **`ParsePlanStep`** union and primitive registry (resolve, transferMembership, establishRelation).
  - [ ] Deterministic **compiler** from **`ManipulationFrame`** + context -> plan (usually length 1; sometimes 2+).

- [ ] **C2. Executor**
  - [ ] Run plan steps in order; map each step to existing stream/events.
  - [ ] Implement BD-8 composition rules (held + surface relation).
  - [ ] Implement BD-9 failure semantics.

- [ ] **C3. Classifier / MultipleCommands policy**
  - [ ] Document when composite single-line commands compile vs **`MultipleCommands`** Error.
  - [ ] Tests: "pick up broom and go north" (likely reject); "toss pouch on floor" (compose if in scope).

- [ ] **C4. Refactor enrich entry**
  - [ ] Generalize **`compileMembershipAtomic`** (Phase A) into full plan compiler; route membership atomics and relational frames through it.
  - [ ] Deprecate ad-hoc stage graph where compiler subsumes it.

### Phase D --- LLM plan generation (optional)

- [ ] **D1. Defer criteria**
  - [ ] Define when compiler returns **defer** (BD-10).

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
- "lean the ladder against the wall" -> **`Custom`** or enum **`Against`** per BD-2.
- "put the coin in the jar" -> nesting defer message, not **`establishRelation`** ( **`in`** excluded).
- Held object + surface relation -> composed plan per BD-8 (Phase C).

## Progress

| Milestone | Status |
| --- | --- |
| Phases B--D task plan | Done |
| Phase A prerequisite | Not started (see companion plan) |
| BD open decisions locked | Not started |
| Phase B establishRelation vertical | Not started |
| Phase C Plan IR | Not started |
| Phase D LLM plans | Not started |

## Coordination notes

- **Phase A** should land first so **`verbClass`** (`acquire` | `release`), merged-catalog identity, and the relational preposition guard are stable before relational frame work.
- Phase B **replaces** the Phase A preposition guard with frame extract + **`establishRelation`**; do not add **`relational`** to classify **`verbClass`**.
- Positions **M4** kernel work (edge mutations) is on the critical path for Phase B; actions parse can proceed with mocked apply until ingress contract is frozen.
- **`in`** / nesting is an explicit **deferral** --- document player-facing copy when frame extract or relation normalizer detects containment language.
