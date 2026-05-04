# Coyote Game: narrative beats refactor (planning)

**Status:** Step **0** (schema + naming) and Step **1** (baseline + ongoing green tests) are complete. **Validation-failure behavior** and **intent field name `narrativeBeatsStructured`** remain locked (see **Delivery sequencing**).

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

Related initiative (broader trope pipeline): [`AGENT.tropeCenteredRefactor.planning.md`](AGENT.tropeCenteredRefactor.planning.md).

This file is disposable after the initiative completes; steady-state contracts belong in [`hypothesis/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) and `mtw-interfaces` docs.

## Purpose

Ship a **focused redesign** of the **narrative beats** hop (`narrativeBeats`): the LLM step that takes committed **`planSelect`** output and produces structured material plus **player-facing** hypothesis prose.

Goals:

1. **Separate internal reasoning from player-facing text** so the Hypothesis line and walkthrough read like imagined cartoon action, not a echo of plan-engineering vocabulary (`executionDetail`, rubric jargon, "delivery lane", and similar).
2. **Stop re-running full deconfliction** in hop 2 when **`planSelect`** already committed a winner; keep only what is needed to **narrate** or to **pin down residual underspec** implied by **`planIssues`**.
3. Preserve a **clear path** to richer **structured** beat ordering (scratchpad) and a later **free-text** user walkthrough, aligned with walk-through / grounding in the trope-centered roadmap ([`AGENT.tropeCenteredRefactor.planning.md`](AGENT.tropeCenteredRefactor.planning.md) step 4).

## Problem statement (current behavior)

Hop 2 prompt text in [`buildNarrativeBeatPrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts) frames the task as **completing the structured phase plan**, orders output as **JSON phase plan then `## Scene analysis` then fenced Hypothesis**, and requires **`deconflictionSummary`** plus obligations to resolve some **`planIssues`** codes in **phase planning**. Shared lines ([`narrativePromptShared.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativePromptShared.ts)) steer **`## Scene analysis`** toward planning and **tropeFunction**-driven ordering. Models often **mirror** that register in the Hypothesis.

Downstream today: the first **` ```json ` ** fence is validated as legacy **`CoyotePhasePlan`** ([`parseNarrativeBeatOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/sharedParsers/parseHypothesisModelOutput.ts) + [`validateCoyotePhasePlan`](../../../../../packages/mtw-interfaces/ts/coyotePhasePlan.ts)); optional **`phasePlan`** on the intent record feeds outcome prompting ([`formatPhasePlanForOutcomePrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/outcome/formatPhasePlanForOutcomePrompt.ts)). This initiative replaces that pairing with a **narrative-beats-shaped** validated payload and **naming** that matches the hop (`narrativeBeats`), not "phase plan."

## Delivery sequencing (practical order)

**Land the scratchpad + narrative stages slice first.** Intro text, strict output order, shared temporal/scene-analysis lines, and deconfliction framing in [`buildNarrativeBeatPrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts) all assume **what** the first **` ```json ` ** block is and **how** prose relates to it. Refactoring that copy without the new structure tends to fight the current **`CoyotePhasePlan`** contract; once the first fence is an internal **beat scratchpad** and the middle section is explicitly **cartoon narrative**, prompt and copy edits have a stable target.

### Structured output and naming (direction locked)

- **Canonical structured output** for hop 2 is a **new validated type** in **`mtw-interfaces`** (**`CoyoteNarrativeBeatsStructured`**; schema shape TBD under **Open questions**) representing the **final, cacheable, behind-the-scenes** narrative-beats payload---including scratchpad (or merged into one validated tree), not a bolt-on derivation of legacy **`CoyotePhasePlan`** as the long-term source of truth.
- **Durable intent row:** validated JSON is stored on **`CoyoteGameIntentRecord` as `narrativeBeatsStructured`** (replacing **`phasePlan`**), alongside **`walkthrough`** (middle-section prose) and **`intent`** (Hypothesis line). **`generatePlanOutcome`** continues to read the same **`get('intent')`** row; wire **`narrativeBeatsStructured`** (and **`walkthrough`**) into the outcome prompt builder the way **`phasePlan`** and **`walkthrough`** are today.
- **Rename as you go:** treat legacy **phase-plan** vocabulary elsewhere (pipeline draft state, parsers, harness, docs) as **narrative beats** where it refers to this hop or its structured product. Prefer the same prefix for pipeline siblings for traceability, for example **`phasePlanJson`** to **`narrativeBeatsStructuredJson`**, **`phasePlanValidationReason`** to **`narrativeBeatsStructuredValidationReason`**. Keep renames **mechanical and traceable** (compat shims or short dual-field window only if a release slice needs it).

### Validation failure (locked)

- If structured validation fails, preserve today's spirit: **prose-only** **`intent`** / **`walkthrough`** when the terminal prose parse succeeds, plus a **machine-readable** pipeline field **`narrativeBeatsStructuredValidationReason`** (same role as today's **`phasePlanValidationReason`**). No **`narrativeBeatsStructured`** on the intent record when validation fails. Same behavior as today's [`parseNarrativeBeatOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/sharedParsers/parseHypothesisModelOutput.ts) path when **`validateCoyotePhasePlan`** rejects all **` ```json ` ** candidates.

### Primary slice -- Scratchpad JSON + narrative stages + contract migration

- Replace the first fenced JSON with an internal **beat scratchpad** (flat beats, dependencies, **`linearizedSequence`**) as in the collaborator handoff, then **cartoon prose**, then fenced Hypothesis.
- **Requires a contract migration:** new validated type + intent record field, updates to **`parseNarrativeBeatOutput`**, outcome formatting (successor to **`formatPhasePlanForOutcomePrompt`**), harness structured JSON expectations, fixtures, and pipeline state keyed with **narrative beats** naming.

**Phase-0 decisions (locked for primary slice):**

- Type name locked: use **`CoyoteNarrativeBeatsStructured`** in **`mtw-interfaces`** for the validated object carried in **`narrativeBeatsStructured`**.
- Minimal v1 schema for **`CoyoteNarrativeBeatsStructured`**:
  - top-level **`beats`** array (non-empty)
  - each beat is:
    - **`beatId: string`** (stable per beat within the payload)
    - **`description: string`**
    - **`derivedFrom: string[]`** (stableKey list)
- Keep v1 intentionally lean (no required trope/phaseKind/dependency graph fields in this first contract slice).

### Optional follow-up -- Prompt-only tweaks (after structure exists)

- Small wording passes on hop-2-only strings once scratchpad + narrative stages are in place (for example tightening guardrails or heading copy) without another schema change.
- **Not** a substitute for the primary slice: prompt-only changes against the old **phase-plan-first** layout are **deprioritized** here because they do not fix the structural coupling the initiative targets.

## Parser and heading constraints

- Walkthrough trimming keys off the **`## Scene analysis`** heading ([`SCENE_ANALYSIS_HEADING`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/sharedParsers/parseHypothesisModelOutput.ts)). Renaming the section to **`## What happens`** (or similar) **requires** updating that regex (or dual acceptance) and any prompt lines that reference the old heading ([`VIRTUAL_SCENERY_AND_PREP_OBJECTS_LINES`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativePromptShared.ts)).
- **`INTERPRETATION_RULES_LINES`** pushes "Hypothesis: It looks like you are trying to ..."; desired style may be **more immediate** ("you are going to ..."). Decide whether hop 2 **overrides** those lines locally or adjusts shared copy (watch impact on other callers of `narrativePromptShared` if any).

## Anchor points in the repo

| Concern | Location |
| --- | --- |
| Narrative beat prompt | [`buildNarrativeBeatPrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts) |
| Narrative beat prompt tests | [`buildNarrativeBeatPrompt.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.test.ts) |
| Hop-2 parse (today: phase plan; target: narrative beats structured) | [`parseHypothesisModelOutput.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/sharedParsers/parseHypothesisModelOutput.ts), [`parseHypothesisModelOutput.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/sharedParsers/parseHypothesisModelOutput.test.ts) |
| Legacy phase plan types and validator (rename or supersede) | [`packages/mtw-interfaces/ts/coyotePhasePlan.ts`](../../../../../packages/mtw-interfaces/ts/coyotePhasePlan.ts) (and tests alongside); new narrative-beats module TBD alongside or instead of this file |
| Validation context for hop 2 | [`narrativeBeatValidationContext.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/narrativeBeatValidationContext.ts) |
| Pipeline orchestration | [`coyoteHypothesisPipeline.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts) |
| Hypothesis module doc | [`hypothesis/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) |
| Engine harness and fixtures | [`runCoyoteEngineTestHarness.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/runCoyoteEngineTestHarness.ts), [`coyoteEngineTestFixtures.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts) |
| Outcome prompt consumption of structured hop-2 output (today **`phasePlan`**) | [`buildPlanOutcomePrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/outcome/buildPlanOutcomePrompt.ts), [`formatPhasePlanForOutcomePrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/outcome/formatPhasePlanForOutcomePrompt.ts) |

## Progress

| Milestone | Status |
| --- | --- |
| Validation-failure: prose-only record + **`narrativeBeatsStructuredValidationReason`** | Locked |
| Intent **`narrativeBeatsStructured`** + pipeline **`narrativeBeatsStructuredJson`** (raw fence interior when valid) | Locked |
| Lock **`mtw-interfaces`** type name + validated **JSON schema** (open questions above) | Locked |
| Primary slice: interfaces + parser + outcome + harness + fixtures | Complete (2026-05-04) |
| Hop-2 prompt and shared-line alignment (depends on primary slice) | Not started |
| Durable doc updates (`hypothesis/AGENT.md` if contracts change) | Complete (2026-05-04) |
| Task plan retired (delete or archive) | Not started |

## Getting started

1. Skim task-plan conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read hypothesis pipeline overview: [`hypothesis/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md).
3. Read current hop-2 prompt and shared lines: [`buildNarrativeBeatPrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts), [`narrativePromptShared.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativePromptShared.ts).
4. Trace parse path: [`parseNarrativeBeatOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/sharedParsers/parseHypothesisModelOutput.ts) and today's **`validateCoyotePhasePlan`** in [`coyotePhasePlan.ts`](../../../../../packages/mtw-interfaces/ts/coyotePhasePlan.ts) (to be replaced or wrapped by a **narrative beats** validator as part of this task).
5. Read testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). If commands conflict with generic examples, follow that file (Jest, **`npm run test`**, cwd **`lambda/ephemera/`**).
6. Run one baseline verification command before edits (from **`lambda/ephemera/`**):

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/generators/sharedParsers/parseHypothesisModelOutput.test.ts
```

## Baseline capture (manual, before primary slice)

Redacted production-style hop-2 output illustrating **register bleed**: structured phase vocabulary (**delivery lane**, **terminal beat**, trope labels as headings) tracks through the **Scene analysis** section and into the fenced **Hypothesis:** line. Valid under today's **`CoyotePhasePlan`** + prompt contract; undesirable per **Success criteria** (cartoon play-by-play vs plan-engineering echo).

### First fence (Markdown lang json) -- structured register

```json
{
  "tropeSequence": ["Contraption", "Finishing Move"],
  "deconflictionSummary": "No conflicts resolved; plan issues list is empty.",
  "phases": [
    {
      "trope": "Contraption",
      "tropeBeat": "The Coyote has set up a rocket hardware delivery lane on the straightaway, ready to launch the Road Runner into the air.",
      "stableKeysUsed": ["rocket-0"],
      "virtualEntities": [
        {
          "label": "rocket delivery lane",
          "derivedFrom": ["rocket-0"],
          "phaseKind": "deployed"
        }
      ],
      "achievement": "The rocket hardware is in place and ready to activate."
    },
    {
      "trope": "Finishing Move",
      "tropeBeat": "The Coyote then appears on the straightaway, ready to chase after the Road Runner as the terminal beat of the trap.",
      "stableKeysUsed": ["affordance:coyote"],
      "virtualEntities": [],
      "achievement": "The Coyote is positioned for the final chase."
    }
  ]
}
```

### Scene analysis body (excerpt; section heading is `## Scene analysis` in the model output)

You have set up a rocket hardware delivery lane on the straightaway, aiming to launch the Road Runner into the air as the primary trap. The rocket is staged and aligned, ready to activate when the Road Runner passes by. Once the rocket fires, you will appear on the straightaway as the terminal pursuit affordance, ready to chase after the Road Runner as the final beat of the maneuver. The straightaway's open desert landscape gives the rocket a clear line of fire, and your positioning ensures you can capitalize on the chaos created by the rocket's explosion.

### Final Hypothesis fence (Markdown lang text; interior must be one line)

```text
Hypothesis: It looks like you are trying to use the straightaway rocket setup to launch the Road Runner into the air and then chase after him as the finishing move.
```

## Recommended order

Use **`[ ]`** for pending work and **`[X]`** for completed work. Mark nested bullets **`[X]`** as each sub-task finishes so partial progress is visible.

- [X] **0. Lock schema and naming:** Answer the **Open questions** in **Delivery sequencing** (validated tree shape, **`mtw-interfaces`** type name). Intent field **`narrativeBeatsStructured`** and pipeline **`narrativeBeatsStructuredJson`** / **`narrativeBeatsStructuredValidationReason`** are already **Locked** in **Delivery sequencing** and **Progress**; align **phase-plan** to **narrative beats** renames in the same slice where touch cost is low; update the **Progress** table.
  - [X] Validation-failure degraded path (prose-only + **`narrativeBeatsStructuredValidationReason`**) recorded under **Delivery sequencing** and **Progress**.
  - [X] Intent field **`narrativeBeatsStructured`** (with **`walkthrough`** for outcome) and pipeline JSON sibling naming recorded under **Delivery sequencing** and **Progress**.
  - [X] Type name locked: **`CoyoteNarrativeBeatsStructured`**.
  - [X] Validated schema fields/shape locked (minimal v1: `beats[]` with `beatId`, `description`, `derivedFrom`).
- [X] **1. Baseline tests:** Run the Getting started command; keep **`buildNarrativeBeatPrompt.test.ts`**, **`coyoteHypothesisPipeline.test.ts`**, and **`parseHypothesisModelOutput.test.ts`** green while the contract changes.
  - [X] Initial verification (2026-05-04): Getting started command plus the two sibling files in **Verification** all pass from **`lambda/ephemera/`**.
  - [X] Capture one example of current bad register (fixture or redacted log) for before/after comparison if useful (see **Baseline capture** above).
  - [X] User-confirmed full **`lambda/ephemera`** suite green (2026-05-04), satisfying the "keep green while changing contract" requirement at this stage.
- [X] **2. Primary slice (structure first):** Design validated JSON (scratchpad with **`beats`** / **`linearizedSequence`** or agreed variant); implement **narrative-beats** types and validator in **`mtw-interfaces`**, **`parseNarrativeBeatOutput`**, pipeline state, intent cache field, outcome formatter, harness, and golden fixtures; rename legacy **phase-plan** identifiers to **narrative beats** where they denote this hop or its structured output.
  - [X] Shipped v1 validator in `mtw-interfaces` with both `beats[]` and `linearizedSequence[]` required and cross-checked by `beatId`.
  - [X] Extend or replace **`parseNarrativeBeatOutput`** tests for new fences and failure modes.
  - [X] Confirm **`generatePlanOutcome`** still receives enough structured context from the new intent field.
- [ ] **3. Prompt and copy (after structure):** Rewrite **`NARRATIVE_BEAT_INTRO`**, output order, deconfliction framing, and narrative-stage instructions so they match scratchpad then cartoon prose then Hypothesis; adjust or locally override **`TEMPORAL_ORDERING_LINES`**, **`SCENE_ANALYSIS_AND_FENCED_HYPOTHESIS_LINES`**, **`VIRTUAL_SCENERY`**, and parser heading rules as needed (same change set as step 2 when possible, but **depends** on the first-fence contract being real).
  - [ ] Re-run narrative-beat-related Jest files touched by the diff.
- [X] **4. Documentation:** Update [`hypothesis/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) hop-3 description if the player-visible contract or JSON shape changes.
- [ ] **5. Close out:** Mark **Progress** rows done; run **Verification** commands; when the initiative ships, archive or delete this plan per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Verification

Run from **`lambda/ephemera/`** after substantive edits (expand the list if **`mtw-interfaces`** tests are in scope):

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/generators/sharedParsers/parseHypothesisModelOutput.test.ts
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.test.ts
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.test.ts
```

If **`packages/mtw-interfaces`** types or validators change, run that package's test script per its **`package.json`** (do not assume **`lambda/ephemera`** alone is sufficient).

## Success criteria (task-level)

- Hypothesis and narrative prose **read as cartoon play-by-play**, not as a restatement of plan-select engineering vocabulary; forbidden jargon list is indicative, not exhaustive.
- Hop 2 does **not** instruct the model to repeat **winner-level** deconfliction that **`planSelect`** already performed; any remaining obligation for **`planIssues`** is framed as **concrete timeline / narration** choices, not a second rubric pass.
- Parsers and **`CoyoteGameIntentRecord`** consumers remain **correct and tested** after the primary slice ships; validated structured hop-2 output is cached as **`narrativeBeatsStructured`** (with **`walkthrough`** and **`intent`**) for **outcome**.
