# Coyote Game: split Distraction into Bait and Misdirection (planning)

**Status:** **D2 complete** (Acme enrich + actions harness updated for `Bait` / `Misdirection`). Next step is **Phase D3** (hypothesis pipeline) per **Recommended order**.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

Replace the overloaded **`Distraction`** trope with two genre-aligned tropes:

- **Bait** --- influences the Road Runner to **go to** or **stay in** a particular place or path (appetitive lure, desirable object, voluntary routing).
- **Misdirection** --- interferes with the Road Runner's ability to **accurately see or control** where they are going (illusion of terrain, obscured vision, misleading optics, loss of traction-as-control when framed as misread rather than purely persistent impairment), such that motion can be steered into peril.

This task plan is **disposable** after the initiative ships; steady-state trope definitions belong in [`lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md) and types belong in [`packages/mtw-interfaces`](../../../../../../packages/mtw-interfaces).

## Why now

Conceptual doc and prompts already strain **`Distraction`** across voluntary lure beats and trompe-l'oeil / perception beats (see **Distraction versus reality edits** in `AGENT.tropes.md`). Acme enrich already applies a **volition-dependent** test that partially maps to **Bait** vs non-lure routing. Formalizing two tropes should reduce misclassification and tuning churn across Acme enrich, hypothesis clustering/plan-select/phase-plan, and outcome prompting.

## Scope and boundaries

### In scope

- **`CoyoteTrope` union** and **`isCoyoteTrope`** in [`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts).
- **Canonical trope order** and **`tropeSequence`** validation in [`packages/mtw-interfaces/ts/coyotePhasePlan.ts`](../../../../../../packages/mtw-interfaces/ts/coyotePhasePlan.ts) (including error strings that enumerate tropes).
- **Acme order enrich** prompt and harness: [`lambda/ephemera/dataSource/actions/enrich/acmeOrder/buildPrompt.ts`](../../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/buildPrompt.ts), [`acmeOrderAffinitiesHarnessPhrases.ts`](../../../../../../lambda/ephemera/dataSource/actions/acmeOrderAffinitiesHarnessPhrases.ts), [`baseClasses.ts`](../../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts) harness types if they pin trope literals.
- **Hypothesis pipeline** parsers, combiners, prompts, tests: `TROPE_ORDER` and trope literals under [`generators/pipelines/hypothesis/`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/) (candidates, planSelect, narrative beats, tests, fixtures).
- **Outcome pipeline** formatters that echo `tropeSequence` / phase labels (pass-through text today; still verify after union grows).
- **Conceptual and package docs** that list the **five** tropes: [`AGENT.tropes.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md), [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md), [`generators/pipelines/hypothesis/AGENT.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md).
- **Tests and fixtures** referencing `Distraction` across `mtw-interfaces`, ephemera actions, coyoteGame generators, and [`handleApiObjectsChange.test.ts`](../../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.test.ts) if still trope-tagged.

### Out of scope unless explicitly added

- Product UI for displaying trope names (follow separately if user-visible strings need copy review).
- Non-Coyote uses of the word "distraction" in unrelated features.
- Retraining or wholesale creative rewrites of every LLM hop beyond what is needed to teach **Bait** / **Misdirection** and update validators.

### Resolved: production persistence

- **No production migration required for legacy `Distraction` strings.** Persisted objects in production have been removed; the database holds **underlying scene data only**. Implementation can still ship **repo + tests** updates without a batch rewrite or dual-read window for stored **`tropeSequence`** / **`tropeAffinities`** (none present in prod state described above).

## Decisions (locked)

Implementation should follow these outcomes (record any drift in PR discussion).

1. **Literal trope strings** --- **Locked:** **`Bait`**, **`Misdirection`**, matching Title Case and **`Finishing Move`** spacing. No alternate labels (`Lure`, `Decoy`) unless product overrides later.

2. **Canonical order** --- **Locked:** `Contraption` -> `Bait` -> `Misdirection` -> `Disadvantage` -> `Finishing Move`.

3. **Co-occurrence rule** --- **Locked:** A plan **may** include **both** **Bait** and **Misdirection**; when both appear they follow **canonical order** (Bait then Misdirection).

4. **Maximum plan length** --- **Locked:** At most **one phase per trope type**; up to **five** phases when every trope slot is filled.

5. **`Distraction` deprecation** --- **Locked:** Remove **`Distraction`** from the union entirely (**hard cut**, no parser shim or alias).

6. **Rubric: Bait vs Misdirection vs Disadvantage** --- **Locked (core axis):**
   - **Bait** --- the Road Runner **chooses** something suboptimal (voluntary routing, appetite, curiosity).
   - **Misdirection** --- he **cannot know and control** his actions optimally (illusion, obscured vision, misleading optics, misread terrain; steering/control failure as **knowledge/perception** failure, not raw ability stats).
   - **Disadvantage** --- an imposed effect on **abilities** that operates **independent of choice or knowledge** (sticky feet, trapped in a net, ongoing impairment).

7. **Rubric: Misdirection vs Disadvantage (examples)** --- **Locked:** **Oil slick** can legitimately tag **Disadvantage** when the plan assumes the Road Runner **stops or is mobility-trapped** due to loss of friction; tag **Misdirection** when the plan assumes **continued motion without adequate control** leads to peril. **Fake tunnel** (and similar pure-illusion terrain reads) is **Misdirection**-first, not a dual mandatory fit with Disadvantage.

8. **Rubric: Misdirection vs Contraption** --- **Locked:** A **painted tunnel on the wall** (the gag prop / illusion surface) is **Misdirection**, not Contraption. **Contraption** is limited to **setup machinery or capability** deployed for other purposes (example: a **fake-tunnel painting robot** is **Contraption**; the painted illusion it produces is **Misdirection**). **Finishing Move** attachment stays as today for terminal payloads (clarify in `AGENT.tropes.md` while editing).

9. **Environment affordances vs `affordancesProvided`** --- **Locked:** The constrained **`EnvironmentAffordanceObject`** list is **not** expected to need **Bait** or **Misdirection** roles in practice. **`affordancesProvided`** may still attach derived objects with **Bait** / **Misdirection** (example: **Contraption** line **Automatic Birthday-cake Oven** with `affordancesProvided: [{ object: 'birthday cake', roles: ['Bait'] }]`). Harness copy can stay focused on Contraption / Finishing Move / Disadvantage for fixed environment rows unless a concrete counterexample appears.

10. **Harness and spreadsheet tuning** --- **Locked:** Current tuning run can **absorb** this structural change subjectively; no separate baseline reset or version-bump ceremony required.

## Open questions (resolved)

All items below are closed for this initiative.

- [X] **Persistence and migration** --- **Resolved:** production cleared of persisted objects; DB is scene data only. No prod batch rewrite of `Distraction` required for this initiative. (Revisit only if new persistence lands before this ships.)

- [X] **Downstream consumers outside this repo** --- **Resolved:** none; everything consuming Coyote trope enums lives **in this repo**.

- [X] **Fixture governance** --- **Resolved:** **single PR**, stepping through D1-D6 in one working session (no multi-branch handoff).

- [X] **Naming in prompts** --- **Resolved:** spell out **Bait** vs **Misdirection** vs **Disadvantage** in prompt **instructions** (the rubric copy). On **first appearance** of **Bait** and **Misdirection** in each major prompt surface, add **parenthetical reinforcement** (e.g. **Bait** (voluntary lure)) alongside those definitions, not as a substitute for them.

- [X] **Tuning baselines** --- **Resolved:** absorb during current tuning run (**Decision 10**); no extra process.

## Current anchor points (search-oriented)

Use these as starting grep anchors when executing; paths may drift slightly.

| Concern | Location |
| --- | --- |
| Trope union + guards | [`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts) |
| Phase plan order validation | [`packages/mtw-interfaces/ts/coyotePhasePlan.ts`](../../../../../../packages/mtw-interfaces/ts/coyotePhasePlan.ts) |
| Acme enrich trope rules | [`lambda/ephemera/dataSource/actions/enrich/acmeOrder/buildPrompt.ts`](../../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/buildPrompt.ts) |
| Acme harness fixtures | [`lambda/ephemera/dataSource/actions/acmeOrderAffinitiesHarnessPhrases.ts`](../../../../../../lambda/ephemera/dataSource/actions/acmeOrderAffinitiesHarnessPhrases.ts) |
| Hypothesis `TROPE_ORDER` | [`parseCandidateOutput.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/parseCandidateOutput.ts), [`parsePlanSelectOutput.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts), [`combineCandidateOutput.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/combineCandidateOutput.ts), [`buildCandidatePrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/buildCandidatePrompt.ts), [`buildPlanSelectPrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.ts), [`buildNarrativeBeatPrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts) |
| Engine harness fixtures | [`coyoteEngineTestFixtures.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts) |
| Conceptual tropes | [`AGENT.tropes.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md) |

## Getting started

1. Skim task-plan conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read current trope vocabulary: [`lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md) (focus **Distraction** and **Distraction versus reality edits**).
3. Read related refactor context if helpful: [`taskPlanning/lambda/ephemera/dataSource/coyoteGame/AGENT.tropeCenteredRefactor.planning.md`](AGENT.tropeCenteredRefactor.planning.md).
4. Read testing authority before running commands: [`lambda/ephemera/AGENT.testing.md`](../../../../../../lambda/ephemera/AGENT.testing.md). If instructions conflict elsewhere, follow that file for lambda-level Jest usage.
5. Confirm scripts from [`lambda/ephemera/package.json`](../../../../../../lambda/ephemera/package.json) and root [`package.json`](../../../../../../package.json).
6. Baseline verification before edits (interfaces package owns **`coyotePhasePlan`** tests). From **`packages/mtw-interfaces/`**:

   `npm run test -- --watchAll=false ts/coyotePhasePlan.test.ts`

   For lambda-level regression baseline after interface changes, follow **`lambda/ephemera/AGENT.testing.md`** (example pattern: `npm run test -- --watchAll=false dataSource/actions/publishedEvents.test.ts` from **`lambda/ephemera/`**). Adjust **Verification** below once the standard CI slice for this initiative is confirmed green.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] Phase D0 - lock decisions and migration story
  - [X] Resolve every item under **Decisions (locked)** with written outcomes.
  - [X] Complete **Open questions** inventory (see **Open questions (resolved)**).
  - [X] Update **Verification** commands with exact cwd + scripts after D1 spike if paths differ.

- [X] Phase D1 - interfaces and validation (`mtw-interfaces`)
  - [X] Extend **`CoyoteTrope`** and **`isCoyoteTrope`**; remove **`Distraction`** (**hard cut**, no shim).
  - [X] Update **`CANONICAL_TROPE_ORDER`** and validation copy in **`validateCoyotePhasePlan`**.
  - [X] Update **`coyotePhasePlan.test.ts`** and **`coyotePlanAffinities.test.ts`** (and any package tests referencing Distraction).

- [X] Phase D2 - Acme enrich and actions harness
  - [X] Rewrite trope allowlists and mechanism tests in **`buildPrompt.ts`** (replace single Distraction block with Bait + Misdirection rubrics; preserve honey-trap / dual-fit logic with new names).
  - [X] Update **`acmeOrderAffinitiesHarnessPhrases.ts`** expected lines and **`likelyErrors`**; run harness tests.
  - [X] Touch **`baseClasses.ts`** / publish validation only if trope literals are duplicated there.

- [ ] Phase D3 - hypothesis pipeline (prompts, parsers, combine, narrative beats)
  - [ ] Update all **`TROPE_ORDER`** arrays and prompt copy.
  - [ ] Adjust parsers strictness if trope keys change (unknown key policy unchanged unless decided otherwise).
  - [ ] Update **`combineCandidateOutput`** and plan-select / candidate tests.

- [ ] Phase D4 - outcome pipeline and formatters
  - [ ] Verify **`formatPhasePlanForOutcomePrompt`** and **`buildPlanOutcomePrompt`** for trope list examples and any hard-coded **five-trope** assumptions.

- [ ] Phase D5 - fixtures, integration tests, docs
  - [ ] Update **`coyoteEngineTestFixtures`**, **`runCoyoteEngineTestHarness`**, hypothesis pipeline tests, **`handleApiObjectsChange.test.ts`** as needed.
  - [ ] Revise **`AGENT.tropes.md`**, coyoteGame **`AGENT.md`**, hypothesis **`AGENT.md`**: five tropes, ordering, constraints (unawareness / first Road-Runner-facing beat) split between Bait and Misdirection.

- [ ] Phase D6 - verification sweep and closeout
  - [ ] Run full **Verification** suite; fix stragglers via grep for `Distraction` in Coyote-trope contexts.
  - [ ] Update [**Recommended order**](#recommended-order) checkboxes to `[X]`.
  - [ ] Archive or delete this plan per [`taskPlanning/AGENT.md`](../../../../AGENT.md) after merge; move lasting rubric text to **`AGENT.tropes.md`**.

## Verification

Run after implementation; commands assume repo root or adjust per **`lambda/ephemera/AGENT.testing.md`**.

**Search for remaining Distraction (Coyote scope):**

- `rg "Distraction" packages/mtw-interfaces/ts lambda/ephemera/dataSource/actions/enrich/acmeOrder lambda/ephemera/dataSource/coyoteGame lambda/ephemera/dataSource/objects`

**Package / slice tests (non-exhaustive; expand if CI surfaces gaps):**

- From `lambda/ephemera/`: targeted Jest for coyote hypothesis + actions as listed in **`AGENT.testing.md`** after interfaces land.
- `packages/mtw-interfaces`: full package tests once union changes.

**Confirmed commands (D1)** --- cwd **`packages/mtw-interfaces/`** (paths match **Getting started**; no drift):

- `npm run test -- --watchAll=false ts/coyotePhasePlan.test.ts`
- `npm run test -- --watchAll=false ts/coyotePlanAffinities.test.ts`
- `npm run test -- --watchAll=false` (full package; 376 tests at time of D1)

**Confirmed commands (D2)** --- cwd **`lambda/ephemera/`**:

- `npm run test -- --watchAll=false dataSource/actions/enrich/acmeOrder/buildPrompt.test.ts` (6 / 6 pass)
- `rg "Distraction" lambda/ephemera/dataSource/actions` (empty after D2; from repo root)

**Known D3-blocked tests (transient).** D1's hard cut of **`Distraction`** narrowed **`CoyoteTrope`** in **`mtw-interfaces`**, so any lambda test whose import graph reaches the hypothesis pipeline now fails ts-jest type-check on stale **`'Distraction'`** literals (e.g. **`buildNarrativeBeatPrompt.ts`** `TROPE_ORDER`). These tests are expected to fail until **Phase D3** sweeps the hypothesis pipeline:

- `npm run test -- --watchAll=false dataSource/actions/actionHandlers/runAcmeOrderAffinitiesHarness.test.ts`
- `npm run test -- --watchAll=false dataSource/actions/enrich/acmeOrder/index.test.ts`

Both are local-edit-clean (zero **`Distraction`** references in the actions tree); they only fail because their import graph transitively pulls in the hypothesis pipeline. Re-run them as part of D3 verification.

Re-record exact passing commands in this section after the first green CI run so future agents do not guess cwd.

## Progress

| Phase | State | Notes |
| --- | --- | --- |
| D0 | Done | **Decisions (locked)**; **Open questions (resolved)**; prod persistence cleared; optional: record exact **Verification** commands after first green run |
| D1 | Done | **`CoyoteTrope`**: `Bait` + `Misdirection`; **`Distraction`** removed. **`CANONICAL_TROPE_ORDER`** and **`validateCoyotePhasePlan`** copy updated. Package tests green; **`rg "Distraction" packages/mtw-interfaces/ts`** is empty. Lambda / ephemera still reference **`Distraction`** until D2-D5. |
| D2 | Done | Acme enrich prompt rewritten for **`Bait`** + **`Misdirection`** rubrics (Decisions 6-8 with first-appearance parentheticals); harness fixtures (`clean-002-birdseed-lure`, `borderline-001-paint-kit`) and **`likelyErrors`** retargeted; **`baseClasses.ts`** **`AcmeOrderAffinitiesHarnessExpectedTrope`** tightened to **`CoyoteTrope`** / **`CoyoteTropeAptness`**. **`rg "Distraction" lambda/ephemera/dataSource/actions`** is empty; **`buildPrompt.test.ts`** green. Hypothesis-pipeline-touching lambda tests (`runAcmeOrderAffinitiesHarness.test.ts`, `dataSource/actions/enrich/acmeOrder/index.test.ts`) remain ts-jest-blocked on stale **`'Distraction'`** literals in **`buildNarrativeBeatPrompt.ts`** etc. until D3. |
