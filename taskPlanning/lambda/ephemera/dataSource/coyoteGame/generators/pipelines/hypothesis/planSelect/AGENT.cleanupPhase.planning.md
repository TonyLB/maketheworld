# Plan-select: cleanup-first internal phase (planning)

**Status:** In progress. Next step is to draft **Q3b** general promotion rules (intent-signal `planIssues` codes only) and Phase 1 / Phase 2 prompt copy for [`buildPlanSelectPrompt.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.ts). **Q3a** Finishing Move guarantee is recorded under **Open questions** below.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../../../../../../taskPlanning/AGENT.md).

## Purpose

Retarget plan-selection **Phase 1** (see `PLAN_SELECTION_INTERNAL_PHASES_*` in [`buildPlanSelectPrompt.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.ts)) from a **candidate audit** into **cleanup**: produce a **materialized candidate set** --- one fully materialized candidate JSON **per** input candidate, **same shape** as input `candidates[]` entries, with affordance-backed members **promoted into their trope slots** (including `affordance:*` synthetic rows where appropriate). **Phase 2** scores that materialized set so the rubric compares each option at its **best achievable** form, not only its skeletal form.

This file is task-scoped. Archive or remove it when the prompt revision is shipped and any lasting rules live in [`hypothesis/AGENT.md`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) or the plan-select prompt module.

## Scope and boundaries

### In scope

- Prompt-only changes to internal phase ordering and Phase 1 instructions (multi-candidate and single-candidate variants).
- Phase 1 internal scaffolding: a **materialized candidate set** (not an audit-with-annotations mini-schema as the primary artifact).
- **No** new TypeScript wire types: internal structures exist only inside the single plan-select prompt. Parser and trailing handoff JSON contracts stay as today unless a separate initiative changes them.
- Clear prose for **promotion rules** (see Q3): **Finishing Move guarantee** (Q3a) first, then **general promotion** for intent-signal codes (Q3b). Underspecification codes are **out of scope** for promotion (pass through to handoff).

### Out of scope (unless this plan is explicitly updated)

- Parser or `@tonylb/mtw-interfaces` changes to consume Phase 1 internal JSON as a pipeline artifact (Phase 1 output stays inside the model prompt unless explicitly extended later).
- Changing which keys appear in the **downstream** trailing handoff: materialized `affordance:*` rows remain **handoff-only** on **`selectedCandidate`** in wire output (see **Constraint reminder**).
- Phase-plan, outcome, or cache/UI changes except follow-on notes if evaluation proves we should echo affordances downstream later.

### Constraint reminder

**Two separate questions** --- do not conflate them:

1. **Internal Phase 1 scaffolding.** Materialized `affordance:*` rows on **every** candidate in the **materialized candidate set** are **permitted and intended**: Phase 1 closes resolvable gaps so Phase 2 judges candidates on promoted, affordance-backed forms. This does **not** require new TypeScript wire types; it lives entirely in prompt instructions.

2. **Downstream wire output.** Materialized `affordance:*` rows on non-winner candidates are **not** emitted to application parsers today; they remain **handoff-only** on **`selectedCandidate`** in the consumed JSON. Extending the external wire format so winners-only vs full-list emission changes is a **separate** contract decision. The constraint in (2) governs **external** consumption, not whether Phase 1 may reason with a full internal materialized set.

## Success criteria

- Phase 1 instructions require emitting a **materialized candidate set**: same top-level shape as input `candidates[]` rows, with promotion of affordance-backed members into trope slots; Phase 2 rubric judgment explicitly scores **this** set (not the raw input block alone).
- The **chosen Finishing Move** (after cleanup) is **load-bearing** for Phase 2: **coverage**, **completeness**, and **coherence** are read as how well the rest of the candidate **supports that finishing move**. Rubric prose **names the finishing move explicitly** as the starting point for each candidate (see Q3a).
- Phase 2 still yields exactly one rubric sentence per candidate and stays grounded in staged evidence plus promotion rules.
- Single-candidate path matches (cleanup produces one materialized candidate before downstream phases).
- Regression tests for [`buildPlanSelectPrompt.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.test.ts) updated; optional harness spot-check if fixtures assert prompt substrings.

## Open questions (narrow these before locking copy)

Work through the list in **Recommended order**; capture decisions inline or in PR description.

1. **Naming and mental model.** **Resolved:** Use **"cleanup"** --- Phase 1 closes resolvable gaps before scoring; Phase 2 judges candidates on their **best achievable** form, not their skeletal form.

2. **Internal artifact shape.** **Resolved:** Phase 1 produces **one fully materialized candidate JSON per input candidate** --- same shape as input `candidates[]` entries, with affordance-backed members promoted into their trope slots. This **materialized candidate set** is what Phase 2 scores. Not an audit-with-annotations as the primary deliverable.

3. **Promotion rules.** Split into **(a)** Finishing Move guarantee --- **resolved** --- and **(b)** general promotion for intent-signal issues --- **still to draft** in prompt prose.

   **(a) Finishing Move guarantee (required cleanup sub-step, not a general promotion case).**

   - Cleanup **must** ensure the materialized candidate has a **Finishing Move** trope slot **adequately filled** before Phase 2 runs. Treat this as **spot and address**, not as raising a parallel plan issue: a **named sub-step** inside Phase 1, not a distinct wire `planIssues` code.
   - If the slot is not yet adequate, Phase 1 may use a lightweight internal hook only: **`MISSING_FINISHING_MOVE`** --- meaning 'cleanup still owes a finishing mechanism.' It **never appears in the wire handoff** because cleanup **always resolves** it before Phase 2. This is **control-flow scaffolding** for prompt ordering only --- **not** a sixth `planIssues` code and not a parallel taxonomy (avoid over-instrumenting with evidence arrays or extra enums).
   - **Resolution priority** (first match wins; stop when Finishing Move is adequately filled):

     1. A **staged prop** already fills **Finishing Move** --- no extra materialization; internal hook does not fire.
     2. **`affordancesProvided`** on any staged **member** or **outlier** clearly indicates a finishing mechanism --- materialize from that evidence (strongest staged intent: player ordered these props).
     3. **Candidate context** implies **Coyote-as-payload** (for example safety gear, `executionSummary` framing self-launch) --- materialize **`affordance:coyote`**.
     4. A **Contraption** member's own **`environmentAffordances`** lists **`Finishing Move`** in **roles** --- materialize from those env refs.
     5. **Guaranteed fallback:** **`affordance:coyote`**.

   - **Disambiguation (steps 2-4):** Read **player intent** from the **whole staged prop set** and candidate text. This is **not** choosing between competing structural readings of the skeleton --- the trope skeleton already fixes plan shape. Cleanup picks the **affordance-level** finishing slot that best matches what the player was going for. **`affordancesProvided` on staged props outranks** passive **`environmentAffordances`** on the contraption (explicit player ordering beats ambient env possibility).
   - **Phase 2 anchor:** The **chosen Finishing Move** after materialization anchors rubric judgment. Different candidates may end up with **different** finishing move materializations depending on skeleton plus staged props (for example **Contraption**-only vs **Contraption** plus **Misdirection**).

   **(b) General promotion (remaining Q3 work --- draft after (a) is copied into prompt).**

   - **Intent-signal** `planIssues` codes only: **`OUTLIER_PROP_UNACCOUNTED`**, **`TROPE_FUNCTION_MISMATCH`**, **`STRUCTURAL_CONTRADICTION`** --- when affordance evidence is sufficient to **close** a gap vs **annotate only**, and when to leave the issue for the residual handoff.
   - **Underspecification** codes **`DIRECTION_AMBIGUOUS`** and **`ROLE_CONFLICT`**: **not** resolvable by promotion inside cleanup; they **pass through** to the wire handoff unchanged (residual obligations for phase-plan).
   - Carry forward where needed: explicit **`stableKey`** citation; **outliers** as fuel vs hole; **conflicts** between affordance evidence and **`tropeFunction`** / **`executionSummary`**.

4. **Materialized rows and handoff.** Phase 1 **internally** gives every candidate a fully materialized form including `affordance:*` where promotion rules allow. The **wire** handoff still attaches synthetic rows only on **`selectedCandidate`** per current contracts. Confirm prompt text keeps that distinction obvious for the model.

5. **Single-candidate path.** Should Phase 1 mirror multi-candidate cleanup **before** `intentConflicts` / residual issues, or merge cleanup + issue audit into one object with ordered sections?

6. **Length / verbosity guardrails.** Caps on bullets per candidate to control tokens?

7. **Evaluation.** Subjective eval on fixture corpus only, or add one fixture that asserts Phase 1 section keywords / structure in transcript (if internal JSON is surfaced for tests)?

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../../../../../../taskPlanning/AGENT.md) (durability ladder, Recommended order checkbox convention).
2. Read hypothesis pipeline boundaries and affordance notes: [`hypothesis/AGENT.md`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) (especially materialized affordance rows and `affordancesProvided` gap sentence).
3. Read current internal phases: [`buildPlanSelectPrompt.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.ts) (`PLAN_SELECTION_INTERNAL_PHASES_MULTI_CANDIDATE`, `PLAN_SELECTION_INTERNAL_PHASES_SINGLE_CANDIDATE`).
4. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../../../../../lambda/ephemera/AGENT.testing.md). Commands below assume cwd **`lambda/ephemera`**.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] **Q1 - Naming:** Adopt **cleanup** as the Phase 1 label (closes resolvable gaps before scoring; Phase 2 judges best achievable form).
- [X] **Q2 - Phase 1 artifact:** **Materialized candidate set** --- one fully materialized candidate JSON per input row (same shape as input `candidates[]` entries); affordance-backed members promoted into trope slots; **Phase 2 scores this set**. Internal-only; no new TS wire types.
- [X] **Q3a - Finishing Move guarantee:** Required cleanup sub-step; internal **`MISSING_FINISHING_MOVE`** hook only (always resolved before Phase 2; never wire); resolution priority 1-5; Phase 2 rubric anchored on chosen finishing move; **`affordancesProvided`** outranks passive env on contraption for FM disambiguation.
- [ ] Draft **Q3b - General promotion** for intent-signal codes only; underspec codes pass through (**Open question** 3).
- [ ] Draft multi-candidate Phase 1 + Phase 2 prompt sections (materialized set emission; rubric judges materialized rows).
- [ ] Align **Q4** (internal full materialization vs wire handoff-only on `selectedCandidate`) in explicit prompt guardrails.
- [ ] Draft single-candidate Phase 1 to match (**Q5**).
- [ ] Apply **Q6** verbosity guardrails.
- [ ] Renumber or adjust Phase 3-4 prose if internal phases shifted (keep "only downstream-consumed artifact is the final trailing handoff `json` fence" invariant).
- [ ] Update [`buildPlanSelectPrompt.test.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.test.ts) expectations for new subsection titles / keywords.
- [ ] Optional: run harness or corpus spot-check (**Q7**).
- [ ] If any behavior is canonical for contributors long-term, add a short pointer in [`hypothesis/AGENT.md`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) and trim duplication from this file.
- [ ] On completion: set **Status** to done, check all boxes, then archive or delete this plan per [`taskPlanning/AGENT.md`](../../../../../../../../../taskPlanning/AGENT.md).

## Verification

From **`lambda/ephemera/`** (if commands conflict, follow [`lambda/ephemera/AGENT.testing.md`](../../../../../../../../../lambda/ephemera/AGENT.testing.md)):

**Baseline before edits:**

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.test.ts
```

**After prompt edits:**

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/
```

## Progress

| Milestone | Notes |
| --- | --- |
| Task plan created | Cleanup-first goal; no TS wire changes for internals; open questions listed |
| Q1 / Q2 resolved | Cleanup naming; materialized candidate set as Phase 1 internal artifact; constraint split internal vs wire |
| Q3a Finishing Move locked | FM guarantee sub-step; resolution priority; Phase 2 anchor; internal hook naming |
| Q3b promotion + prompt drafted | |
| Tests / verification green | |
