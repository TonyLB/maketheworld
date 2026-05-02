# Plan-select: cleanup-first internal phase (planning)

**Status:** In progress. [`buildPlanSelectPrompt.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.ts) implements internal **Phases 1-4** for both paths (**cleanup** then **rubric judgment**, then **winner merge**, then **handoff**), including Q3a/Q3b promotion prose and the internal-vs-wire distinction. Remaining optional items: harness/corpus pass; contributor pointer in [`hypothesis/AGENT.md`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) if warranted; then archive or delete this file per [`taskPlanning/AGENT.md`](../../../../../../../../../taskPlanning/AGENT.md). Historical promotion policy detail stays under **Open questions** below where noted.

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
- Single-candidate path matches multi-candidate structure: one input candidate still runs **Phase 1** cleanup then **Phase 2** judgment (singleton materialized set), not a special merged schema.
- Regression tests for [`buildPlanSelectPrompt.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.test.ts) updated; optional harness spot-check if fixtures assert prompt substrings.

## Open questions (narrow these before locking copy)

Work through the list in **Recommended order**; capture decisions inline or in PR description.

1. **Naming and mental model.** **Resolved:** Use **"cleanup"** --- Phase 1 closes resolvable gaps before scoring; Phase 2 judges candidates on their **best achievable** form, not their skeletal form.

2. **Internal artifact shape.** **Resolved:** Phase 1 produces **one fully materialized candidate JSON per input candidate** --- same shape as input `candidates[]` entries, with affordance-backed members promoted into their trope slots. This **materialized candidate set** is what Phase 2 scores. Not an audit-with-annotations as the primary deliverable.

3. **Promotion rules.** Split into **(a)** Finishing Move guarantee --- **resolved** --- and **(b)** general promotion for intent-signal issues --- **resolved** (`OUTLIER_PROP_UNACCOUNTED`, **`TROPE_FUNCTION_MISMATCH`**, **`STRUCTURAL_CONTRADICTION`** below); **prompt prose still to draft**.

   **(a) Finishing Move guarantee (required cleanup sub-step, not a general promotion case).**

   - Cleanup **must** ensure **`tropeAssignments` includes `Finishing Move`** with **at least one** `members` row (staged prop or synthetic **`affordance:*`**) before Phase 2 runs. **Implicit completion via other tropes or prose alone is invalid.** Treat this as **spot and address**, not as raising a parallel plan issue: a **named sub-step** inside Phase 1, not a distinct wire `planIssues` code. Prompt prose **carves out** FM materialization from the older "optional / only when they clarify" handoff language --- FM rows required by this sub-step are **mandatory**.
   - Cleanup **may add** a **`Finishing Move`** trope key when Stage One input omitted it. If the slot is not yet filled, Phase 1 may use a lightweight internal hook only: **`MISSING_FINISHING_MOVE`** --- meaning 'cleanup still owes a **Finishing Move** block with **>= 1** member.' It **never appears in the wire handoff** because cleanup **always resolves** it before Phase 2. This is **control-flow scaffolding** for prompt ordering only --- **not** a sixth `planIssues` code and not a parallel taxonomy (avoid over-instrumenting with evidence arrays or extra enums).
   - **Resolution priority** (first match wins; stop when **`tropeAssignments.Finishing Move.members`** is non-empty):

     1. Input already has **`Finishing Move`** with **>= 1** staged **member** --- no extra materialization unless Sub-step B edits text; internal hook does not fire.
     2. **`affordancesProvided`** on any staged **member** or **outlier** clearly indicates a finishing mechanism --- materialize into **`Finishing Move.members`** from that evidence (strongest staged intent: player ordered these props).
     3. **Candidate context** implies **Coyote-as-payload** (for example safety gear, `executionSummary` framing self-launch) --- materialize **`affordance:coyote`** under **`Finishing Move.members`**.
     4. A **Contraption** member's own **`environmentAffordances`** lists **`Finishing Move`** in **roles** --- materialize from those env refs into **`Finishing Move.members`**.
     5. **Guaranteed fallback:** **`affordance:coyote`** under **`Finishing Move.members`**.

   - **Disambiguation (steps 2-4):** Read **player intent** from the **whole staged prop set** and candidate text. This is **not** choosing between competing structural readings of the skeleton --- the trope skeleton already fixes plan shape. Cleanup picks the **affordance-level** finishing slot that best matches what the player was going for. **`affordancesProvided` on staged props outranks** passive **`environmentAffordances`** on the contraption (explicit player ordering beats ambient env possibility).
   - **Phase 2 anchor:** The **chosen Finishing Move** after materialization anchors rubric judgment. Different candidates may end up with **different** finishing move materializations depending on skeleton plus staged props (for example **Contraption**-only vs **Contraption** plus **Misdirection**).

   **(b) General promotion (Q3b --- decisions recorded; prompt prose still to draft).**

   - **Underspecification** codes **`DIRECTION_AMBIGUOUS`** and **`ROLE_CONFLICT`**: **not** resolvable by promotion inside cleanup; they **pass through** to the wire handoff unchanged (residual obligations for phase-plan).

   **`OUTLIER_PROP_UNACCOUNTED` --- promotion rule (bounded, context-driven, pass-through fallback).** **Resolved** before drafting prompt copy.

   - This code **may** still appear in rubric reasoning and the wire **`planIssues`** after cleanup --- that is acceptable. Use a **bounded** cleanup pass: try retroactive slot assignment when context supports it; if **no** fix is legible, **pass the issue through unchanged**. Do **not** over-invest; rubric and downstream phases continue to handle **residual** outliers.
   - **Correctable case:** Original **misclassification** --- enrich-time **`tropeAffinities`** were assigned **without** skeleton context. Cleanup asks whether the candidate's committed trope structure plus **`executionSummary`** makes a **better** trope slot assignment **legible**. If **yes**, **promote** the outlier into that slot (move **`stableKey`** from **`outliers`** into **`tropeAssignments[*].members`** with matching **`tropeFunction`**). If **no** clear slot is legible, **do not** force a promotion.
   - **Promotion bar:** **Low** relative to other intent-signal codes. Cleanup is **not** re-classifying from scratch and **not** resolving a hard conflict --- it completes an assignment enrich left **underspecified**. Candidate context making the right slot obvious is **enough**.
   - **Canonical example:** Coil of copper wire tagged **Disadvantage**-only at enrich, listed as an **outlier** on a candidate whose skeleton is otherwise electrical apparatus (**Contraption**-heavy, arcs, storm-cloud pills, **`executionSummary`** implying conduction). Candidate context makes **Contraption** the obvious slot --- **promote** the wire there.

   **Validation note (before locking `OUTLIER` prompt copy):** [`parsePlanSelectOutput.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts) validates **`selectedCandidate`** **structurally** only (Coyote trope keys, member/outlier rows, **`stableKey`** / **`shortName`** / **`room`** / **`tropeFunction`**, optional affordance fields, materialized **`affordance:*`** syntax). It does **not** enforce that a staged object's enrich-time **`tropeAffinities`** row matches the trope bucket where that **`stableKey`** appears. Moving a prop from **`outliers`** into a trope row that enrich did **not** foreground for that object is **not** rejected at parse. Phase-plan JSON validators (`@tonylb/mtw-interfaces`, **`coyotePhasePlan`**) care about **`stableKeysUsed`** vs the **room snapshot** (plus well-formed **`affordance:*`** tokens), not trope affinity lineage from Acme enrich. **Implication:** no parser change is **required** for cleanup-driven promotion; optional prompt prose may still state that promotion is **context-driven** and may **extend** apparent trope use beyond first-pass **`tropeAffinities`** when the candidate makes that reading legible.

   **`TROPE_FUNCTION_MISMATCH` --- promotion rule (bounded string alignment; pass-through fallback; defer depth to winner handoff).** **Resolved** before drafting prompt copy.

   - Same **effort class** as **`OUTLIER_PROP_UNACCOUNTED`**: **one bounded fix attempt**, then **pass through** if cleanup cannot honestly resolve the tension. The code **may** remain in rubric reasoning and wire **`planIssues`** after cleanup --- that is acceptable.
   - **Correctable case (primary):** **`tropeFunction`** is **wrong copy** for the role the skeleton **already** assigns --- placement is coherent (**`stableKey`** stays in the same trope **`members`** row), but the line disagrees with **`executionSummary`** / **`executionDetail`** / how the candidate actually uses the prop. **Fix:** rewrite **`tropeFunction`** (and only touch **`executionDetail`** on that trope when needed for the same beat). That is **annotation alignment**, not re-classification.
   - **Not fixable in this pass:** **I do not see how this object fits** --- placement vs summary cannot be reconciled by honest relabeling alone. Do **not** force a **tropeFunction** patch that **pretends** a use the candidate does not support. **Pass through** **`TROPE_FUNCTION_MISMATCH`** or treat as **placement / structure** ( **`OUTLIER`** promotion rules, **`STRUCTURAL_CONTRADICTION`**, etc.) per facts --- cleanup does not merge those investigations here.
   - **Separation from OUTLIER:** **`OUTLIER`** addresses **where** the prop sits in the graph (outlier vs trope row). **`TROPE_FUNCTION_MISMATCH`** addresses **whether the member line matches** the graph **you already kept**. Do **not** use **`TROPE_FUNCTION_MISMATCH`** cleanup to **move** **`stableKey`** between tropes; use OUTLIER / structural rules for moves.
   - **Later pass:** If **`TROPE_FUNCTION_MISMATCH`** still applies at **`selectedCandidate`** / wire handoff, **invest more** there --- refining **`tropeFunction`** / narrative alignment for the **winning** payload is the right place for deeper effort. Cleanup stays **light** at this phase.

   **`STRUCTURAL_CONTRADICTION` --- promotion rule (plurality-as-overbuilding sub-type only; bounded; pass-through for all other sub-types).** **Resolved** before drafting prompt copy.

   - **`STRUCTURAL_CONTRADICTION`** is a **broad** bucket. Cleanup addresses **exactly one** recognizable sub-type cheaply; **all other** sub-types **pass through** to the rubric as **residual negative evidence** (same bounded-pass discipline as **`OUTLIER_PROP_UNACCOUNTED`** and **`TROPE_FUNCTION_MISMATCH`**: **one** recognition attempt; if this sub-type is not clearly present, **do not** force a fix).

   - **Resolvable sub-type: plurality without commitment.** The skeleton has **multiple props competing for the same trope role** without the plan committing to **which** one fires. The surface tension reads like "these cannot all be X" --- in Looney Tunes genre terms that is **not** a contradiction; it is **optimism**. Cleanup resolves by **embracing plurality** and rewriting that trope's **`executionDetail`** so the competition reads as **intentional overbuilding** (not picking a single winner prop). Example per-trope framings (adapt wording to the candidate; keep genre tone):

     - **Finishing Move:** "A gauntlet of attacks"
     - **Misdirection:** "An obstacle course of dangers"
     - **Bait:** "An over-the-top spectacle of temptations"
     - **Contraption:** "A Rube Goldberg overengineered mess of optimistic causality"
     - **Disadvantage:** "A piling on of layered obstruction"

   - **Optimism signal (required for this fix --- not neutral relabeling):** The plurality reframe must **raise optimism** in **`executionDetail`** tone: Coyote-side planning treats **more** moving parts as **more** individual brilliance, not as engineering failure-probability accumulation. Plurality **offsets** implausibility when reading player intent --- it is **not** an extra penalty multiplier.

   - **Phase 2 rubric consequence:** After a plurality reframe, treat the candidate's **coherence as strengthened** on its own terms, not merely neutralized. The prompt already evaluates from the **Coyote's** perspective --- **do not** re-penalize plurality that cleanup has already framed as **deliberate overbuilding**.

   - **Not fixable by this rule --- pass through:** Any **`STRUCTURAL_CONTRADICTION`** that **cannot** be resolved by embracing plurality. **Canonical non-resolvable cases** (illustrative): topology contradicts implied Road Runner movement; **`tropeFunction`** vs **`executionSummary`** flatly clash in a way no **`executionDetail`** rewrite honestly bridges; genuine spatial or causal impossibility that requires **committing** to one structural interpretation over another. Leave **`STRUCTURAL_CONTRADICTION`** in **`planIssues`** / rubric weighting as residual intent-signal evidence.

4. **Materialized rows and handoff.** **Resolved.**

   - **No separate surface to other phases:** Cleanup's **materialized candidate set** (per-input-candidate materialization, including `affordance:*` on **every** option where rules say so) exists **only inside the plan-select prompt / single model invocation**. It is **not** emitted as its own structured artifact for orchestration, parsers, or downstream hops. Later phases continue to see **only** what they already consume from plan-select (notably the trailing handoff JSON). Same decision as **Out of scope** --- no Phase 1 JSON as a pipeline artifact unless a future initiative adds it.
   - **Wire handoff unchanged:** Application parsers still receive materialized `affordance:*` **member** rows **only** on **`selectedCandidate`** in the trailing fence, per current contracts. Non-winners do not need synthetic rows in wire output.
   - **Prompt obligation:** Instructions must make the model keep the distinction clear in its own reasoning --- internal materialization for rubric comparison vs **final** handoff keys --- without implying that internal structures are emitted as a separate artifact beyond this hop's trailing fence.

5. **Single-candidate path.** **Resolved (correction):** **Single candidate** means the model receives **one** candidate in `candidates[]` to evaluate --- **not** the wire **`selectedCandidate`** (winner handoff). That branch should use the **same** internal structure as multi-candidate: **Phase 1** cleanup (materialized candidate set; here a **singleton**) then **Phase 2** rubric judgment on that materialized form, per `PLAN_SELECTION_INTERNAL_PHASES_*`. Do **not** merge cleanup with intent-conflict / residual-issue reasoning into one combined internal object to avoid "two phases"; keep Phase 1 vs Phase 2 as separate sequential internal phases, analogous to the multi-candidate prompt.

6. **Length / verbosity guardrails.** **Resolved.**

   - **Prompt-level broad caps (yes):** Add **soft** limits in instructions so internal mini-schemas do not explode --- for example a **maximum** number of bullet lines per candidate in the materialized-set or audit sections, or a one-sentence cap for per-candidate sub-fields where prose can bloat. Keep rules **broad** (order-of-magnitude guardrails), not a detailed character budget; the goal is predictable token use without choking legitimate cleanup output.
   - **Plan-select output token ceiling (code):** **`BEDROCK_HYPOTHESIS_PLAN_SELECTION_MAX_TOKENS`** is **4096** (dedicated constant, not the default 2048) in [`invokeBedrockHypothesis.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/invokeBedrockHypothesis.ts); [`invokeBedrockHypothesis.test.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/invokeBedrockHypothesis.test.ts) asserts `invokeBedrockHypothesisPlanSelection` uses it by default --- headroom for internal materialized candidates, rubric output, and large **`selectedCandidate`** JSON. **1024** stays for **candidates** only. Narrative beat remains **2048** unless changed deliberately.
   - **After the bump:** Tune from harness **`usagePlanSelection`** in [`runCoyoteEngineTestHarness`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/runCoyoteEngineTestHarness.ts); **raise** plan-selection max further only if needed, and re-check Lambda timeout vs the three-hop pipeline (hypothesis **`AGENT.md`**).

7. **Evaluation.** **Resolved:** Keep **subjective** evaluation (fixture corpus, rubric judgment, how outputs read) for this cleanup initiative. **Do not** add new automated assertions on model transcript shape (internal phase keywords, surfaced internal JSON) as part of this task --- that would be unscientific **accretion** of one-off tests. A **deliberate sweep** of rigorous prompt-engineering metrics (if any) is a **separate** future effort, not built up case by case here.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../../../../../../taskPlanning/AGENT.md) (durability ladder, Recommended order checkbox convention).
2. Read hypothesis pipeline boundaries and affordance notes: [`hypothesis/AGENT.md`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) (especially materialized affordance rows and `affordancesProvided` gap sentence).
3. Read current internal phases: [`buildPlanSelectPrompt.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.ts) (`PLAN_SELECTION_INTERNAL_PHASES_MULTI_CANDIDATE`, `PLAN_SELECTION_INTERNAL_PHASES_SINGLE_CANDIDATE`).
4. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../../../../../lambda/ephemera/AGENT.testing.md). Commands below assume cwd **`lambda/ephemera`**.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] **Q1 - Naming:** Adopt **cleanup** as the Phase 1 label (closes resolvable gaps before scoring; Phase 2 judges best achievable form).
- [X] **Q2 - Phase 1 artifact:** **Materialized candidate set** --- one fully materialized candidate JSON per input row (same shape as input `candidates[]` entries); affordance-backed members promoted into trope slots; **Phase 2 scores this set**. Internal-only; no new TS wire types.
- [X] **Q3a - Finishing Move guarantee:** Required **`Finishing Move`** trope block with **>= 1** member; internal **`MISSING_FINISHING_MOVE`** hook only; FM carve-out from optional handoff copy; may add trope key when input omitted it; resolution priority 1-5; Phase 2 anchored on chosen finishing move; **`affordancesProvided`** outranks passive env on contraption for FM disambiguation.
- [X] **Q3b partial - `OUTLIER_PROP_UNACCOUNTED`:** Bounded cleanup with pass-through fallback; misclassification + candidate-context legibility; low promotion bar; coil-wire canonical example; parser does not enforce enrich **`tropeAffinities`** vs trope row (**Open question** 3).
- [X] **Q3b partial - `TROPE_FUNCTION_MISMATCH`:** Bounded **`tropeFunction`** rewrite when placement already coherent; pass-through if no honest relabel; separate from OUTLIER moves; deeper work deferred to **`selectedCandidate`** / handoff if still open (**Open question** 3).
- [X] **Q3b - `STRUCTURAL_CONTRADICTION`:** Plurality-without-commitment / overbuilding only; per-trope **`executionDetail`** framings; optimism signal; Phase 2 must not re-penalize resolved plurality; all other structural contradictions pass through (**Open question** 3).
- [X] Draft **multi-candidate** Phase 1 + Phase 2 prompt updates in [`buildPlanSelectPrompt.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.ts): materialized candidate set, internal cleanup phases per Q3a/Q3b, rubric alignment (FM anchor; plurality reframe strengthens coherence; no double penalty); embed **Q4** resolved rules (internals stay in prompt; wire `selectedCandidate` only); embed **Q6** broad internal caps; **implement Q6 token bump** (plan-select **4096** + test) in [`invokeBedrockHypothesis.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/invokeBedrockHypothesis.ts) (**Open questions** 3, 4, and 6).
- [X] **Q4 - Materialized rows / handoff:** Phase 1 internals not surfaced outside single plan-select invocation; wire unchanged (`affordance:*` on **`selectedCandidate`** only); prompt makes internal vs handoff distinction explicit (**Open question** 4).
- [X] **Q5 - Single-candidate path:** Align with multi-candidate **Phase 1** then **Phase 2** (singleton materialized set); not a merged cleanup-plus-issues schema (**Open question** 5).
- [X] Draft **single-candidate** Phase 1 + Phase 2 prompt updates aligned with multi-candidate structure (**Open question** 5).
- [X] **Q6 - Length / verbosity:** Broad prompt caps (multi-candidate Phase 1); plan-select max output **4096** in [`invokeBedrockHypothesis.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/invokeBedrockHypothesis.ts) + [`invokeBedrockHypothesis.test.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/invokeBedrockHypothesis.test.ts); tune with **`usage`** if needed (**Open question** 6).
- [X] Renumber or adjust Phase 3-4 prose if internal phases shifted (keep "only downstream-consumed artifact is the final trailing handoff `json` fence" invariant). **Satisfied without extra edits:** single-candidate was aligned to the same Phase 3-4 headings and handoff copy as multi; both `PLAN_SELECTION_INTERNAL_PHASES_*` blocks keep the trailing-fence-only invariant.
- [X] Update [`buildPlanSelectPrompt.test.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.test.ts) expectations for new subsection titles / keywords.
- [X] **Q7 - Evaluation:** Subjective eval only for this slice; no transcript keyword accretion; rigorous measurement = future deliberate sweep (**Open question** 7).
- [ ] Optional: informal harness or corpus pass when tuning (subjective, not a gate).
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
| Q3b partial OUTLIER locked | Bounded promotion; pass-through; enrich vs skeleton; validation note |
| Q3b partial TROPE locked | String-alignment attempt; pass-through; defer depth to winner handoff |
| Q3b STRUCTURAL locked | Plurality overbuilding only; optimism; Phase 2 coherence consequence; pass-through rest |
| Q4 handoff boundary locked | Internals prompt-only; no pipeline artifact; wire selectedCandidate-only for synthetic rows |
| Q5 single-candidate locked | Same Phase 1 / Phase 2 split as multi-candidate; one-row input = singleton materialized set |
| Q6 verbosity locked | Broad prompt caps; **4096 plan-select** + default-maxTokens test shipped |
| Q7 eval approach locked | Subjective; no accreted transcript tests; rigor = later sweep |
| Q3 prompt copy + Phase 1/2 drafted | Multi-candidate + **single-candidate** cleanup + rubric prose in `buildPlanSelectPrompt` (four internal phases; singleton `materializedCandidates`) |
| Phase 3-4 internal prose | Multi/single share winner-merge + handoff sections; no renumber pass needed; downstream artifact remains sole trailing `json` fence |
| Multi slice verification | `planSelect/` + `invokeBedrockHypothesis.test.ts` green |
| Q3a FM structural hardening | `Finishing Move` trope key with >= 1 member required; no "defensible equivalent" escape; FM materialization carves out of optional/clarify handoff language; may add **Finishing Move** key when input omits it |
