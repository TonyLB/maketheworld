# Object manipulation parse --- Phase A (verb frame + membership atomics)

**Status:** In progress. Slices 1--2 shipped (`verbClass` classify contract + `MembershipManipulationFrame`). Next step: **`compileMembershipAtomic`** enrich refactor (slice 3).

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

Follow-on initiative (relational + plan IR): [`AGENT.manipulationFrameAndRelational.planning.md`](./AGENT.manipulationFrameAndRelational.planning.md).

## Purpose

Fix the **takeHold / drop** parse path without waiting for generic relational operators. Today the classifier returns **`ObjectManipulationIntent`** + **`rawObjectSpans`** only; a brittle regex (**[`inferManipulationVerb.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/inferManipulationVerb.ts)**) chooses room vs held catalog for identity, while membership pre-gates derive **`operationKind`** from ground truth afterward. That split misroutes paraphrases (e.g. "toss the pouch" when the pouch is held-only) and will compound as operators grow.

Phase A lands a **language frame slot at classify** (`verbClass`) and a **membership-driven compiler** at enrich for v1 membership atomics only. It **clears verb-gated identity** and establishes the frame hook Phase B extends --- it does **not** build Plan IR, **`ManipulationFrame`** role slots, or **`establishRelation`** (see [Phase A boundary](#phase-a-boundary-not-plan-ir)).

Retire this plan when Phase A ships and durable docs are updated; git retains history.

## Phase A boundary (not Plan IR)

Phase A is a **surgical fix** plus one architectural seam, not a down payment on the full compiler in [Phases B--D](./AGENT.manipulationFrameAndRelational.planning.md).

| Phase A ships | Phase A does not ship |
| --- | --- |
| **`verbClass`** at classify (`acquire` \| `release`) | Plan IR types, primitive registry, multi-step executor |
| **`compileMembershipAtomic`** orchestrator (compiler v0 for membership atomics) | **`establishRelation`**, frame extract hop, relation normalizer |
| Merged-catalog identity; membership -> **`operationKind`** | Role-tagged spans, **`relationSpan`** |
| Agreement gate (language vs ground truth) | Replacing complexity LLM for all relational cases |
| Tactical **`on`** / **`under`** guard (Phase B throwaway) | General preposition / relation routing at classify |

Implementers: **`enrichObjectManipulation`** should thin to "route guard -> **`compileMembershipAtomic`** -> complexity fall-through"; avoid adding more linear stages without folding them into the compiler.

## Scope

### In scope

- Classifier emits **`verbClass`**: **`acquire` | `release` only** on **`ObjectManipulationIntent`** (membership language direction, **not** `operationKind`). No **`relational`** or **`unknown`** at classify --- relational routing is Phase B ([companion plan](./AGENT.manipulationFrameAndRelational.planning.md)).
- Classify prompt Section A2: membership-neutral wording (room **and** held); examples for acquire/release paraphrases only.
- Identity stage uses **merged catalog** ([`mergeObjectManipulationCatalogs`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/catalogMerge.ts)) --- remove verb-gated catalog scoping.
- **Relational preposition guard** (deterministic enrich): **`on`** and **`under`** in the command short-circuit to existing **`relationalPlacement`** Error before agreement / atomic short-circuit (extend when Phase B hybrid enum adds shortcut prepositions; replaced by frame extract in Phase B).
- **Verb--membership agreement gate** after identity + pre-gates: **`release` + room host** -> existing **`notCarryingObject`**; **`acquire` + actor character host** -> new **already holding** error (fail closed, not noop).
- **Confidence (PA-4):** classify confidence on success; **`min(classify, agreementDowngrade)`** on agreement-failure **`Error`**.
- **`compileMembershipAtomic`** --- single enrich orchestrator for the membership-atomic happy path (Phase C compiler v0); owns preposition guard entry, merged identity, pre-gates, agreement gate, and terminal **`ObjectManipulation`** / agreement **`Error`**.
- Deterministic fast paths (PA-5): bare **`take`**, **`drop`**, **`get <object>`** --- **Bedrock classify skip only**; must call **`compileMembershipAtomic`** (or shared enrich entry), not a parallel **`operationKind`** path.
- **Legacy deletion** (same PR as compiler landing):
  - [`inferManipulationVerb.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/inferManipulationVerb.ts) + tests
  - **`inRoomOnlyDropError`** and both call sites in [`enrich/objectManipulation/index.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/index.ts) (superseded by merged catalog + agreement gate)
  - Verb-gated **`catalogWithScope(room|held)`** for identity search (keep **`catalogScope`** tags on merged entries only)
- Types, guards, interpreter, tests, and steady-state notes in actions **`AGENT.implementation.md`** / diegetic operator docs.

### Out of scope (Phase B--D plan)

- **`establishRelation`** egress, positions **`applyHostRelationalPatch`**, relational transcript.
- Role-tagged spans (`subject` / `target`), **`relationSpan`**, relation-kind normalization.
- Plan IR, multi-step composition (`drop` then `establishRelation`), LLM plan generation.
- Splitting top-level classify intents (`TakeHoldIntent`, `DropIntent`, ...).

## Background (durable docs --- link, do not duplicate)

| Topic | Doc |
| --- | --- |
| Operator fiction + lane split | [`diegeticLogic/AGENT.operators.concepts.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md) |
| Parse classify / enrich playbook | [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) (**ObjectManipulationIntent steady-state**) |
| Enrich module inventory | [`actions/enrich/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/AGENT.md) |
| Positions membership apply | [`positions/manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md) |

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) (durability, checkboxes, open decisions).
2. Read **Purpose** and **Open decisions** in this file; skim [`AGENT.manipulationFrameAndRelational.planning.md`](./AGENT.manipulationFrameAndRelational.planning.md) so Phase A boundaries stay clear.
3. Trace the current pipeline: [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) -> [`discriminateIntent/`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/) -> [`enrich/objectManipulation/index.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/index.ts).
4. Read membership pre-gates: [`complexityPreGates.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/complexityPreGates.ts) (sole-host **`takeHold`** / **`drop`**).
5. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). Commands run from **`lambda/ephemera/`** with Jest (`npm run test -- --watchAll=false ...`).
6. Baseline before edits:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/ \
  dataSource/actions/discriminateIntent/intentClassification.test.ts \
  dataSource/actions/parseCommand.test.ts \
  dataSource/actions/index.test.ts
```

## Design summary (Phase A target behavior)

```text
Parse Requested
  -> [optional] deterministic fast path (PA-5): skip Bedrock classify only
  -> classify: ObjectManipulationIntent + rawObjectSpans + verbClass (acquire | release)
  -> enrichObjectManipulation
       -> compileMembershipAtomic (guard, identity, pre-gates, agreement)
       -> or complexity LLM fall-through (unchanged defer path)
  -> terminal ObjectManipulation (takeHold | drop) or Error
  -> egress unchanged (Object Take Hold | Object Drop)
```

**`compileMembershipAtomic` internal order:**

1. Relational preposition guard (**`on`**, **`under`**) -> **`relationalPlacement`** Error
2. Merged-catalog identity -> unary collapse -> membership observe -> pre-gates -> proposed **`operationKind`**
3. Agreement gate (**`verbClass`** vs **`operationKind`**) -> success or PA-2 **`Error`** with PA-4 confidence downgrade

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement Phase A. When a decision ships, record it in **`AGENT.contract.md`** / **`AGENT.implementation.md`** and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| PA-1 | **`verbClass` enum** --- **`acquire` \| `release` only** at classify (no `relational`, no `unknown`; relational is Phase B frame extract) | Classify JSON + guards | Shipped (slices 1--2) |
| PA-2 | **Agreement policy** --- `release` + room sole host -> existing **`notCarryingObject`**; `acquire` + actor character sole host -> new **already holding** error (fail closed) | Agreement gate + tests | Decided |
| PA-3 | **Relational preposition guard** --- **`on`** and **`under`** only (word-boundary match); extend when Phase B hybrid **`relationKind`** enum adds shortcut prepositions | Enrich guard + tests | Decided |
| PA-4 | **Confidence** --- on agreement success use classify confidence; on agreement failure use **`min(classify, agreementDowngrade)`** on terminal Error (and any early terminal path that carries confidence) | Terminal parse shape | Decided |
| PA-5 | **Deterministic fast paths** --- bare **`take`** / **`drop`** / **`get <object>`** skip Bedrock classify only; **must** invoke **`compileMembershipAtomic`** (no duplicate membership/pre-gate logic in [`deterministicChecks.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts)) | Fast paths + compiler | Decided |
| PA-6 | **`compileMembershipAtomic`** --- extract membership-atomic orchestrator from [`enrich/objectManipulation/index.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/index.ts); index thins to guard routing + compiler + complexity defer | Enrich refactor | Decided |

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines as you finish each sub-step. **Deletion before new ingress:** land **`compileMembershipAtomic`** and legacy removal (step 3) before deterministic fast paths (step 4).

- [X] **1. Contract and types**
  - [X] Extend **`ParseCommandObjectManipulationIntentResult`** with **`verbClass`** in [`baseClasses.ts`](../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts); update intent guard in [`discriminateIntent/baseClasses.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/baseClasses.ts).
  - [X] Add minimal **`MembershipManipulationFrame`** (or extend enrich input): `{ command, rawObjectSpans, verbClass, ...catalogs, characterId }` --- frame slot for Phase B, no role tags yet.
  - [X] Document: classify emits language frame only; **`operationKind`** remains compiler-owned.

- [X] **2. Classify prompt + interpreter**
  - [X] Update Section A2 in [`buildIntentClassificationPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/buildIntentClassificationPrompt.ts): membership-neutral object context; required **`verbClass`** in JSON; forbidden **`operationKind`**.
  - [X] Parse and validate **`verbClass`** in [`intentClassification.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/intentClassification.ts).
  - [X] Extend [`intentClassification.test.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/intentClassification.test.ts) (acquire/release only, malformed, forbidden fields).

- [ ] **3. Enrich refactor: compiler, deletion, guard (PA-6)**
  - [ ] Extract **`compileMembershipAtomic`** (new module under [`enrich/objectManipulation/`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/)): preposition guard -> merged-catalog identity -> unary collapse -> membership observe -> pre-gates -> agreement gate.
  - [ ] Add relational preposition guard inside compiler: word-boundary **`on`** and **`under`** only -> **`relationalPlacement`** Error (PA-3).
  - [ ] Identity resolves against **`mergeObjectManipulationCatalogs(room, held)`** only --- no verb-gated catalog.
  - [ ] Add agreement module: PA-2 copy mapping; PA-4 **`min`** confidence downgrade on agreement failure.
  - [ ] Add **`alreadyHoldingObject`** to [`resolveObjectSpan.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/resolveObjectSpan.ts) error messages.
  - [ ] **Delete legacy:** [`inferManipulationVerb.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/inferManipulationVerb.ts) + tests; **`inRoomOnlyDropError`** + both call sites in [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/index.ts).
  - [ ] Thin [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/index.ts): cardinality -> **`compileMembershipAtomic`** OR complexity LLM defer (unchanged tail).
  - [ ] Unit tests on **`compileMembershipAtomic`**: held-only + release paraphrase; room + acquire; agreement failures; **`on`**/**`under`** guard; confidence downgrade; confirm **`inRoomOnlyDropError`** paths gone.

- [ ] **4. Deterministic fast paths (PA-5) --- after step 3**
  - [ ] Add bare **`take`**, **`drop`**, **`get <object>`** in [`deterministicChecks.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts): synthesize **`MembershipManipulationFrame`** with inferred **`verbClass`**, call shared enrich/compiler --- **do not** duplicate pre-gates or membership reads in deterministicChecks.
  - [ ] Tests: fast path hits same outcomes as mocked classify + enrich for equivalent commands.

- [ ] **5. End-to-end and handler**
  - [ ] Thread **`verbClass`** through [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) enrich input.
  - [ ] Confirm [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) egress unchanged for grounded **`ObjectManipulation`**.
  - [ ] Extend [`parseCommand.test.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.test.ts) and [`index.test.ts`](../../../../../lambda/ephemera/dataSource/actions/index.test.ts) for mocked classify + enrich paths.

- [ ] **6. Durable doc updates + plan retirement prep**
  - [ ] Update [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md): **`compileMembershipAtomic`**, remove verb inference / **`inRoomOnlyDropError`**; document preposition guard + agreement gate.
  - [ ] Update [`diegeticLogic/AGENT.operators.concepts.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md) classify row for **`takeHold`** / **`drop`**.
  - [ ] Update [`actions/enrich/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/AGENT.md) sequence diagram.
  - [ ] Mark all checkboxes `[X]`; set **Status** to done; delete this plan when merged (optional: leave a one-line pointer in Phase B plan that Phase A shipped).

## Verification

From **`lambda/ephemera/`**:

```bash
npm run test -- --watchAll=false \
  dataSource/actions/discriminateIntent/intentClassification.test.ts \
  dataSource/actions/enrich/objectManipulation/ \
  dataSource/actions/parseCommand.test.ts \
  dataSource/actions/index.test.ts

npm run build
```

**Manual / fixture checks (mocked Bedrock):**

- "grab the broom" (room) -> **`takeHold`**
- "toss the pouch" (held-only) -> **`drop`**
- "drop the broom" (in room only) -> **`notCarryingObject`**
- "pick up the broom" (already held) -> **already holding** error
- "put the broom on the table" -> **`relationalPlacement`** Error via **`on`** guard (Phase B replaces with **`establishRelation`**)
- "stash it under the bench" -> **`relationalPlacement`** Error via **`under`** guard

## Progress

| Milestone | Status |
| --- | --- |
| Phase A task plan | Done |
| PA-1 through PA-6 open decisions | Decided |
| Types + classify **`verbClass`** | Done (slices 1--2) |
| **`compileMembershipAtomic`** (PA-6) | Not started |
| Legacy deletion (`inferManipulationVerb`, **`inRoomOnlyDropError`**) | Not started |
| Deterministic fast paths via compiler (PA-5) | Not started |
| Durable doc updates | Not started |
