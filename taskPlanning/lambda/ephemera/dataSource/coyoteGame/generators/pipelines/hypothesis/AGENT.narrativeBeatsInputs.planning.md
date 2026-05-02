# Narrative beats: winner-only inputs (planning)

**Status:** In progress. Design exploration for narrowing the phase-plan hop (`narrativeBeats`) to **structured committed-plan inputs** instead of the full combined candidate pool Markdown. **Locked:** **`selectedCandidate`** is **hard-required** (**decision 1**); **single committed plan** grounding (**decision 2**); committed-plan Markdown reading contract **inlined** in [`buildNarrativeBeatPrompt.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts) (**decision 3**); **`buildNarrativeBeatPrompt`** happy-path inputs are **`planSelectOutput`** + **`roomObjectsByRoom`** only (**decision 4**); harness inject **`CoyoteHarnessNarrativeBeatsInject`** (**decision 5**); narrative beat max output tokens stay **`BEDROCK_HYPOTHESIS_NARRATIVE_BEAT_MAX_TOKENS` = 2048** until production usage is assessed (**decision 6**); FM-backward / prep-showtime narrative guidance is **out of scope here** --- **separate task plan later** (**decision 7**). Next: **implement** prompt + plumbing + tests per **Recommended order**.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../../../../../taskPlanning/AGENT.md).

## Purpose

Record design intent for refactoring **what** the narrative beat hop consumes after plan-select: move from **`renderCombinedCandidateOutputForNarrativeBeat`** over **all** [`combineCandidateOutput`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/combineCandidateOutput.ts) candidates to a contract where **only** the enhanced **`selectedCandidate`** (plus residual handoff fields the prompt already uses) grounds phase-plan generation.

This file is task-scoped. When the refactor ships and lasting rules live in [`hypothesis/AGENT.md`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) (or adjacent module docs), archive or delete this plan per [`taskPlanning/AGENT.md`](../../../../../../../../taskPlanning/AGENT.md).

## Current state (baseline)

- [`buildNarrativeBeatPrompt.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts) builds **`CoyotePromptParts`** from **`roomObjectsByRoom`**, full **`combined`**, and **`planSelectOutput`**.
- The **dynamic suffix** includes **`renderCombinedCandidateOutputForNarrativeBeat`**: **`## Combined clustering`** with every **`### Candidate`**, while **`## Plan selection grounding`** already repeats **`paragraphSummary`**, **`planIssues`**, and (when present) structured **`selectedCandidate`** detail.
- [`narrativePromptShared.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativePromptShared.ts) (**`COMBINED_CLUSTERING_CONTRACT_LINES`**, etc.) is imported **only** by narrative beats today --- **not** by plan-select (plan-select uses its own prose in [`buildPlanSelectPrompt.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.ts)).
- Orchestration: [`coyoteHypothesisPipeline.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts) passes **`combined`** into **`buildNarrativeBeatPrompt`** after **`parsePlanSelectionHandoff`** (which may rehydrate **`selectedCandidate.outliers`** from combine when **`candidateId`** matches).

## Target direction (summary)

- **Primary input** for trope/member/outlier narrative grounding: **`planSelectOutput.selectedCandidate`** (same shape as one combined candidate row; parser types already align --- see [`parsePlanSelectOutput.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts)). **`buildNarrativeBeatPrompt`** accepts **`planSelectOutput`** + **`roomObjectsByRoom`** only on the happy path (**decision 4**); **`combined`** is not an argument.
- **Drop** rendering the **full candidate pool** into the narrative beat prompt (**no** legacy fallback at this hop --- **`selectedCandidate`** is **required**; see decision **1**).
- **Update** narrative beat prompt copy so the model is not instructed to expect a multi-candidate clustering tail; **how to read** the **`## Committed plan`** block is **inlined** in [`buildNarrativeBeatPrompt.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts) (**decision 3**), not via **`COMBINED_CLUSTERING_CONTRACT_LINES`**.
- **One** player-facing grounding block for the committed maneuver: **`paragraphSummary`**, residual **`planIssues`**, and **`selectedCandidate`** (trope members, execution lines, outliers) in a **single** **## Committed plan** (or equivalent heading) --- no separate **## Plan selection grounding** plus a second winner-only tail that repeats the same rows (**decision 2**).
- **Follow-on** (explicitly **not** this plan --- **decision 7**): stronger prose guidance for **Finishing Move as terminal beat**, **backward reasoning**, and **prep vs showtime** relative to Road Runner involvement --- capture in a **future** `taskPlanning` **`AGENT.*.planning.md`** (see also [`AGENT.tropeCenteredRefactor.planning.md`](../../../AGENT.tropeCenteredRefactor.planning.md) for related trope-centered context).

## Why this coheres with the rest of the pipeline

- Plan-select already chooses **one** committed reading; showing all candidates **works against** "do not survey multiple plans" and wastes tokens. Narrative beat output cap stays **2048** pending production token telemetry (**decision 6**); constant: **`BEDROCK_HYPOTHESIS_NARRATIVE_BEAT_MAX_TOKENS`** in [`invokeBedrockHypothesis.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/invokeBedrockHypothesis.ts).
- [`hypothesis/AGENT.md`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) already says narrative beats should **prioritize `selectedCandidate`** --- winner-only dynamic input is the strict reading of that rule.
- Terminal parse (**`parseNarrativeBeatOutput`**) validates phase-plan JSON against **snapshot + topology context**, not against the candidate pool --- **no parser dependency** on listing all candidates.

## Success criteria

- Narrative beat prompt **does not** embed the full combined pool; **`selectedCandidate`** is **always** present before **`hypothesisNarrativeBeatLlm`** (hard gate --- **decision 1**); **`buildNarrativeBeatPrompt`** is called with **`planSelectOutput`** + **`roomObjectsByRoom`** only (**decision 4**).
- Prompt instructions for reading the dynamic tail **match** single-winner semantics (**decision 3**: inlined in **`buildNarrativeBeatPrompt`**, not a shared **`COMBINED_CLUSTERING_CONTRACT_LINES`** import); **one** merged committed-plan Markdown surface (**decision 2**).
- Pipeline **aborts to stub** (or fails the narrative hop consistently with existing **`CoyoteHypothesisPipelineAbortError`** behavior) when **`selectedCandidate`** is absent after plan-select parse --- implemented and tested.
- Unit tests for [`buildNarrativeBeatPrompt`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.test.ts) (and any new renderer helper) updated; harness **`CoyoteHarnessNarrativeBeatsInject`** + fixtures updated (**decision 5**).
- **`BEDROCK_HYPOTHESIS_NARRATIVE_BEAT_MAX_TOKENS`** unchanged at **2048** unless raised later from production evidence (**decision 6**).

## Scope

### In scope

- Prompt builder API / inputs: **`BuildNarrativeBeatPromptInput`** (or equivalent) uses **`planSelectOutput`** + **`roomObjectsByRoom`** only --- **no** **`combined`** (**decision 4**); **`planSelectOutput.selectedCandidate`** is **mandatory** (**decision 1**).
- New or adapted Markdown renderer for **one** winner row inside the **single committed-plan** block (**decision 2**); reuse patterns from **`renderCombinedCandidateOutputForNarrativeBeat`** where possible.
- Drop **`COMBINED_CLUSTERING_CONTRACT_LINES`** usage from narrative beats; committed-plan **how to read** copy lives **inline** in [`buildNarrativeBeatPrompt.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts) (**decision 3**). Still sweep [`narrativePromptShared.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativePromptShared.ts) (**`VIRTUAL_SCENERY_AND_PREP_OBJECTS_LINES`**, etc.) for stale **`## Combined clustering`** references.
- Pipeline wiring: narrative beat step passes **`planSelectOutput`** + **`roomObjectsByRoom`** into **`buildNarrativeBeatPrompt`** (**decision 4**). **`combined`** may remain on pipeline **state** for earlier steps only (`seamCombineRender`, **`parsePlanSelectionHandoff`**). Harness **`runOnly`** **`phasePlan`** uses **`CoyoteHarnessNarrativeBeatsInject`** (**decision 5**).
- Documentation updates in [`hypothesis/AGENT.md`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) when behavior is canonical.

### Out of scope (unless this plan is updated)

- Changing **`validateCoyotePhasePlan`** or **`@tonylb/mtw-interfaces`** phase-plan schema (ordering already canonical --- see existing docs).
- Plan-select prompt changes (**optional** consolidation --- not implied by inlining narrative-beat committed-plan copy; plan-select does not import [`narrativePromptShared.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativePromptShared.ts) today).
- **FM-backward storytelling**, **prep vs showtime** staging, and related narrative-beat **copy** beyond winner-only inputs --- **separate task plan later** (**decision 7**).

## Decisions (resolved)

Design choices for **this** refactor; implementation should match these and [`hypothesis/AGENT.md`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) when updated.

1. **`selectedCandidate` required vs optional at narrative hop**  
   **`selectedCandidate`** is **hard-required** before **`hypothesisNarrativeBeatLlm`**. If [`parsePlanSelectOutput`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts) yields a handoff **without** **`selectedCandidate`**, orchestration **does not** invoke narrative beats (same family of outcome as other hypothesis pipeline aborts --- stub intent / no partial hypothesis). **Implementation detail:** enforce at **`parsePlanSelectionHandoff`** or an orchestration guard immediately before **`buildNarrativeBeatPrompt`**; optionally tighten the **parser** or plan-select contract later so the model cannot emit a valid handoff without **`selectedCandidate`**. **Decision:** **Hard-require** (no legacy Markdown fallback at narrative hop).

2. **Duplicate grounding: handoff block vs winner Markdown**  
   **Decision:** **Single committed plan** --- one Markdown section (recommended heading **`## Committed plan`**) that carries **`paragraphSummary`**, **`planIssues`**, and the structured **`selectedCandidate`** (including per-trope **`executionDetail`**, members, outliers). **Do not** keep **`formatPlanSelectOutputBlock`** as a separate **`## Plan selection grounding`** block **and** a second dynamic tail that re-lists the same winner; **replace** that split with this unified block in [`buildNarrativeBeatPrompt.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts) (refactor or supersede **`formatPlanSelectOutputBlock`** accordingly).

3. **Replacing `COMBINED_CLUSTERING_CONTRACT_LINES`**  
   **Fact:** The whole [`narrativePromptShared.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativePromptShared.ts) module is consumed **only** by [`buildNarrativeBeatPrompt.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts). **Plan-select** does **not** import it; candidate-shape and rubric language for plan-select lives in [`buildPlanSelectPrompt.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.ts). Refactoring the **clustering contract** for narrative beats therefore **does not** automatically change plan-select --- unless we **explicitly** dedupe or align copy across hops later.  
   **Still do:** Replace multi-candidate **`COMBINED_CLUSTERING_CONTRACT_LINES`** with **committed-plan** reading rules (**decision 2**); sweep other narrative-beats-only strings that reference **`## Combined clustering`** (**`VIRTUAL_SCENERY_AND_PREP_OBJECTS_LINES`**, fenced-json intro in **`buildNarrativeBeatPrompt`**).  
   **Decision:** **Inline** the replacement **how to read the committed-plan Markdown** copy **into** [`buildNarrativeBeatPrompt.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts) (local `const` lines alongside **`NARRATIVE_BEAT_INTRO`** / invariant assembly); **stop importing** **`COMBINED_CLUSTERING_CONTRACT_LINES`** for this hop. Optionally remove the **`COMBINED_CLUSTERING_CONTRACT_LINES`** export from [`narrativePromptShared.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativePromptShared.ts) once unused. Other imports from that file (**`INTERPRETATION_RULES_LINES`**, **`TEMPORAL_ORDERING_LINES`**, etc.) stay until separately revised.

4. **Pipeline state: keep `combined` in memory**  
   **`combined`** is still produced by **`seamCombineRender`** and consumed by plan-select input serialization and by **`parsePlanSelectionHandoff`** (outlier rehydration on **`selectedCandidate`** when **`candidateId`** matches). **Decision:** On the **happy path**, **`buildNarrativeBeatPrompt`** receives **`planSelectOutput`** and **`roomObjectsByRoom`** **only** --- **do not** pass **`combined`** into the narrative beat builder (no defensive fallback). Narrow **`BuildNarrativeBeatPromptInput`** accordingly; [`coyoteHypothesisPipeline.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts) **`hypothesisNarrativeBeatLlm`** step should call **`buildNarrativeBeatPrompt({ roomObjectsByRoom, planSelectOutput })`** after **`selectedCandidate`** is guaranteed present.

5. **Harness and fixtures**  
   **`runOnly` `phasePlan`** runs **`hypothesisNarrativeBeatLlm`** with injected pipeline state. **Decision:** Rename **`CoyoteHarnessPhasePlanInject`** to **`CoyoteHarnessNarrativeBeatsInject`**. **Adjust** the inject shape to **`{ roomObjectsByRoom, planSelectOutput }`** only --- **drop** **`combined`** (**same surface as decision 4**; narrative beat harness does not need the candidate pool). **`selectedCandidate`** remains **required** on **`planSelectOutput`** (**decision 1**); narrow at type level where practical. Implementation touchpoints: [`coyoteHarnessInjectTypes.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHarnessInjectTypes.ts); [`coyoteHypothesisPipeline.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts) (**`initialStateForRunOnly`**, **`assertRunOnlyInjectPhasePlan`** / **`validateCoyoteHypothesisHarnessOptions`** / **`runOnly`** **`phasePlan`** branch); [`coyoteEngineTestFixtures.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts) (re-exports, **`phasePlan`** fixture typings, **`FIXTURE_*_PHASE_PLAN_INJECT`** constants). Optionally rename local **`phasePlan`** harness identifiers to **`narrativeBeats`** where it improves clarity (non-blocking).

6. **Token budget**  
   **Decision:** Hold **`BEDROCK_HYPOTHESIS_NARRATIVE_BEAT_MAX_TOKENS`** at **2048** (current default for **`invokeBedrockHypothesisNarrativeBeat`** in [`invokeBedrockHypothesis.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/invokeBedrockHypothesis.ts)). **Do not** raise the cap as part of this refactor **until** a **data-driven** assessment of how many tokens the narrative beat hop **draws in production** (logging, metrics, or comparable traces). Harness **`usage`** may inform hypotheses but does not replace production evidence. Revisit max tokens only after that assessment (may still land at **2048**).

7. **Relationship to trope-centered / Finishing Move follow-ons**  
   Winner-only inputs **enable** clearer FM-last storytelling but **this plan does not** add FM-backward reasoning, prep/showtime staging, or similar narrative-beat copy. **Decision:** Track those as a **separate** `taskPlanning` task plan **later** (new `AGENT.<slug>.planning.md`; not additional sections in this file). Related background may overlap [`AGENT.tropeCenteredRefactor.planning.md`](../../../AGENT.tropeCenteredRefactor.planning.md).

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../../../../../taskPlanning/AGENT.md) (durability ladder, Recommended order checkbox convention).
2. Read hypothesis pipeline boundaries and handoff contracts: [`hypothesis/AGENT.md`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) (plan-select output; narrative hop expects **`selectedCandidate`** per this plan).
3. Read current builders: [`buildNarrativeBeatPrompt.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts), [`combineCandidateOutput.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/combineCandidateOutput.ts) (**`renderCombinedCandidateOutputForNarrativeBeat`**), [`narrativePromptShared.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativePromptShared.ts).
4. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../../../../lambda/ephemera/AGENT.testing.md). Commands below assume cwd **`lambda/ephemera`**.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [ ] Implement **`selectedCandidate`** gate + **`planSelectOutput`** / **`roomObjectsByRoom`**-only **`buildNarrativeBeatPrompt`** API (**decision 4**) + **single committed-plan** Markdown (**decision 2**); update [`coyoteHypothesisPipeline.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts) call site (stop passing **`combined`**).
- [ ] Inline committed-plan reading contract in [`buildNarrativeBeatPrompt.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts); remove **`COMBINED_CLUSTERING_CONTRACT_LINES`** import; sweep **`## Combined clustering`** references in [`narrativePromptShared.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativePromptShared.ts) + **`buildNarrativeBeatPrompt`** per decision **3**.
- [ ] Adjust [`buildNarrativeBeatPrompt.test.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.test.ts) and any combine tests that assert narrative-beat Markdown shape.
- [ ] Rename **`CoyoteHarnessPhasePlanInject`** to **`CoyoteHarnessNarrativeBeatsInject`**, strip **`combined`** from inject, wire **`runOnly`** **`phasePlan`** + fixtures (**decision 5**).
- [ ] Optional: capture harness **`usage`** as a baseline for comparing with future production token draws (**decision 6** --- cap stays **2048** regardless until assessed).
- [ ] Move lasting contributor-facing rules into [`hypothesis/AGENT.md`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md); trim duplication from this file.
- [ ] On completion: set **Status** to done, check boxes, then archive or delete this plan per [`taskPlanning/AGENT.md`](../../../../../../../../taskPlanning/AGENT.md).

## Verification

From **`lambda/ephemera/`** (if commands conflict, follow [`lambda/ephemera/AGENT.testing.md`](../../../../../../../../lambda/ephemera/AGENT.testing.md)):

**Baseline before edits:**

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/
```

**After broader pipeline touch:**

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/
```

## Progress

| Milestone | Notes |
| --- | --- |
| Task plan created | Winner-only direction; decisions/unknowns listed; scope vs FM/prep follow-on |
| Decisions resolved | **1**--**7** locked (FM/prep follow-on = separate plan later) |
| Implementation | Prompt + pipeline + tests |
| Durable docs updated | [`hypothesis/AGENT.md`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) or equivalent |
| Plan archived | Per [`taskPlanning/AGENT.md`](../../../../../../../../taskPlanning/AGENT.md) |
