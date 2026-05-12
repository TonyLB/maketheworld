# Coyote Game: gimmick-centered candidate refactor (planning)

**Status:** G0 contract decisions locked (see **Decisions**). Next step is implementation slices (G1 onward). [`AGENT.tuneLLMPipeline.planning.md`](AGENT.tuneLLMPipeline.planning.md) is **dormant**; this initiative **takes precedence** for Coyote pipeline edits (including `schemaVersion` and harness refreeze) until this plan is completed.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

Redesign **candidate generation forward** so each hypothesis **candidate** is anchored by an overarching **gimmick**: a causal spine the Coyote plan aligns around, with **trope assignments** (and staged objects) supporting that spine rather than reading as five loosely coupled beats.

**Practical centers of gravity** (soft-prompted; not necessarily enforced as a hard enum in types):

| Label (working) | Intent |
| --- | --- |
| **Delivered damage** | Clever delivery of harm to Road Runner (explosives, anvils, chained Rube hazards, etc.). |
| **High speed chase** | Coyote or surrogate competes on velocity / pursuit geometry. |
| **Unexpected approach** | Entry vector surprises (catapult, tunnel up, balloon drop, etc.). |
| **Trap** | Road Runner is expected to run into, through, or collide with a hazard. |

**Free-form spine:** models should be able to describe gimmicks outside this set; the four rows exist to **cluster attention** in prompts and evaluation, not to cap imagination. Each candidate carries a **short `gimmick` string** (often just a few words): a light anchor so the pool explores different directions; **detail is filled in progressively** by later hops, not front-loaded into the gimmick field.

**Internal only:** gimmick is a **reasoning and seam handoff** artifact for the Coyote **LLM hypothesis pipeline** (and downstream hops that consume the same in-process handoff). It is **not** a client concern, **not** something we classify or infer before the candidate hop, and **not** a reason to change Acme enrich or durable `tropeAffinities` on room objects.

This plan is **task-scoped**. When the initiative completes, move lasting contracts into [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) (or phase-local `AGENT.md` files) and archive or delete this document per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Relationship to other initiatives

- **Trope-centered refactor / tuning:** [`AGENT.tropeCenteredRefactor.planning.md`](AGENT.tropeCenteredRefactor.planning.md) and [`AGENT.tuneLLMPipeline.planning.md`](AGENT.tuneLLMPipeline.planning.md) established trope-first seams and hop tuning. The gimmick refactor is **orthogonal**: it adds a **per-candidate narrative spine** that tropes **orbit**, not a replacement for `CoyoteTrope` keys or combine validation rules.
- **Coordination:** any simultaneous change to candidate JSON or plan-select `schemaVersion` should be **serialized** across plans so fixtures and parsers do not fight (prefer one initiative owns the version bump per release slice). While [`AGENT.tuneLLMPipeline.planning.md`](AGENT.tuneLLMPipeline.planning.md) is **dormant**, this gimmick plan **owns** those bumps for Coyote until it completes.

## Scope and boundaries

### In scope

- **Candidate JSON contract** and [`parseCandidateOutput`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/parseCandidateOutput.ts): required string **`gimmick`**, validation, unknown-key policy.
- **Combine** ([`combineCandidateOutput.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/combineCandidateOutput.ts)): carry **`gimmick`** through enriched candidate views; **no** deterministic gimmick-vs-members checks (not reliably judgeable; see **Decisions**).
- **Plan-select input serialization** and **plan-select output** ([`buildPlanSelectPrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.ts), [`parsePlanSelectOutput.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts)): compare gimmick-diverse candidates; **`selectedCandidate`** **mirrors** the winning candidate's **`gimmick`** string (required handoff to narrative beats and persistence).
- **Narrative beat hop** ([`buildNarrativeBeatPrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts), [`coyoteHypothesisPipeline.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts)): committed gimmick + tropes -> terminal parse ([`parseHypothesisModelOutput.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/sharedParsers/parseHypothesisModelOutput.ts)).
- **Prompts** for all post-candidate phases: rubric language, backward-from-goal guidance **woven** into existing structures; candidate hop uses **strong example gimmicks** plus explicit permission to reuse those phrasings or use novel short strings.
- **Harness and fixtures** ([`coyoteEngineTestFixtures.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts), inject bundles): each fixture candidate should declare a gimmick; partial-run injects updated when handoff shape changes.
- **Outcome pipeline** ([`buildPlanOutcomePrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/outcome/buildPlanOutcomePrompt.ts)): pass persisted **`gimmick`** explicitly with the rest of the outcome handoff material (internal only; see **Decisions**).

### Non-goals (locked)

These are **not** part of this initiative, now or later under this plan:

- **Client UI** for gimmick display, editing, or selection.
- **Pre-pipeline gimmick classification** --- no deterministic or separate-model step that labels staged objects or rooms with a gimmick before the candidate-generation hop.
- **Acme enrich or `tropeAffinities` persistence** rewrites driven by gimmick (gimmick stays inside hypothesis/outcome prompt assembly and parse/combine handoffs).

### Out of scope for first design lock

- Final polish of **internal prompt** copy for archetype examples and permission wording (can iterate without blocking schema work).

### Deferred to post-implementation tuning

- **Candidate count / rotation** (fixed N vs model-chosen; mapping slots to archetype examples): revisit after gimmick behavior is visible end-to-end across the pipeline ([`AGENT.tuneLLMPipeline.planning.md`](AGENT.tuneLLMPipeline.planning.md) may own follow-on passes).

## Design intent (stable)

1. **One gimmick per candidate** in the pool so plan-select compares **qualitatively different causal funnels**, not only trope permutations on the same spine.
2. **Backward assembly:** prompts should ask models to reason from **intended cartoon outcome** (Road Runner interaction) **backward** to object and trope placement; the **`gimmick`** string is a **short orienting tag**, not a full specification (details accrue in later phases).
3. **Handoff continuity:** the winning **`gimmick`** string survives **`selectedCandidate`** (mirrored from the chosen candidate) so hop-2 does not re-derive the spine from tropes alone.

## Anchor points in the repo (implementation map)

| Stage | Primary files |
| --- | --- |
| Candidates prompt | [`buildCandidatePrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/buildCandidatePrompt.ts), [`serializeStagedObjectsForCandidatePrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/serializeStagedObjectsForCandidatePrompt.ts) |
| Candidate parse | [`parseCandidateOutput.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/parseCandidateOutput.ts) |
| Combine | [`combineCandidateOutput.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/combineCandidateOutput.ts) |
| Plan select | [`buildPlanSelectPrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.ts), [`parsePlanSelectOutput.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts) |
| Narrative beats | [`buildNarrativeBeatPrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts) |
| Orchestration | [`coyoteHypothesisPipeline.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts) |
| Bedrock caps | [`invokeBedrockHypothesis.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/invokeBedrockHypothesis.ts) |
| Intent cache / Dynamo | [`internalCache/coyoteGame.ts`](../../../../../../lambda/ephemera/internalCache/coyoteGame.ts) |
| Outcome | [`generatePlanOutcome.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/outcome/generatePlanOutcome.ts), [`buildPlanOutcomePrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/outcome/buildPlanOutcomePrompt.ts) |
| Interfaces (if shared types) | [`packages/mtw-interfaces/ts`](../../../../../../packages/mtw-interfaces/ts) (search for coyote plan / narrative types as decisions land) |

## Decisions

Locked items use `[X]` and a **Resolution** line. **Coordination** (precedence vs other Coyote task plans) is at the end of this section.

### Schema and parsing

- [X] **Gimmick field (candidate root):** single string **`gimmick`** (typically a few words), intentionally light so the pipeline can elaborate later; not a separate label/summary or nested object.
  - **Resolution:** JSON per candidate includes required string **`gimmick`** alongside existing candidate shape; validate non-empty string with reasonable max length only as needed for safety.
- [X] **Archetype examples vs parser:** no closed enum in types for v1; prompts use **strong free-text examples** (the four centers of gravity) plus an explicit **permission structure**: the model may reuse those exact phrasings when they fit and is **not forbidden** from novel short strings when they fit better.
  - **Resolution:** archetype flavor lives in **prompt copy only**; parser accepts any qualifying **`gimmick`** string.
- [X] **Uniqueness across candidates:** parser does **not** reject duplicate normalized gimmick strings; **soft uniqueness** via prompt pressure only.
  - **Resolution:** no duplicate-detection in `parseCandidateOutput`.
- [X] **Plan-select `schemaVersion`:** bump plan-select **input** JSON when **`gimmick`** appears on each serialized candidate; migrate [`serializePlanSelectCandidateInput`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/combineCandidateOutput.ts) and consumers (grep `schemaVersion` in plan-select path).
  - **Resolution:** agreed; implement bump + fixture/harness updates in the same slice as serializer change.
- [X] **`selectedCandidate.gimmick`:** **`selectedCandidate`** must **mirror** the winning candidate's **`gimmick`** string (same field name and shape as hop-1 candidates).
  - **Resolution:** plan-select parser requires **`gimmick`** on **`selectedCandidate`**; narrative beats consume it explicitly (not via **`paragraphSummary`** alone).

### Combine and validation

- [X] **Deterministic gimmick checks in combine:** none --- we cannot reliably judge whether **`stableKey`** members "tie to" the gimmick string.
  - **Resolution:** no gimmick-vs-member validation in application logic.
- [X] **Outliers vs gimmick:** outliers stay **as today** (combine-derived list, existing contracts); **orthogonal** to **`gimmick`** (no extra outlier narrative slot on gimmick).
  - **Resolution:** do not add gimmick-specific outlier fields.

### Prompts and reasoning

- [X] **Candidate count / archetype rotation:** defer until after gimmick is implemented and observed end-to-end; tune then (possibly under [`AGENT.tuneLLMPipeline.planning.md`](AGENT.tuneLLMPipeline.planning.md)).
  - **Resolution:** not blocking first implementation; see **Deferred to post-implementation tuning**.
- [X] **Backward-from-goal and trope legality:** weave into **existing** phase instructions as **guidance and context** that helps start mechanistic reasoning --- not a hard constraint block, and not a standalone generation seed apart from the rest of the programmed pipeline; anchor Road Runner / genre rules per [`AGENT.tropes.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md) in that same woven style.
  - **Resolution:** no new dedicated Markdown section per hop solely for gimmick; integrate into current prompt structures.

### Persistence and outcome

- [X] **Dynamo `CoyoteGame#Intent` row:** persist chosen gimmick as property **`gimmick`** (internal-only; never client surfaces; see **Non-goals**).
  - **Resolution:** extend intent row read/write and [`CoyoteGameIntentRecord`](../../../../../../lambda/ephemera/internalCache/coyoteGame.ts) with **`gimmick?: string`** on read (absent on legacy rows); write **`gimmick`** from plan-select winner on successful generation.
- [X] **Outcome prompt:** pass **`gimmick`** **explicitly** alongside the other outcome inputs (staged objects, hypothesis line, structured beats, walkthrough as today).
  - **Resolution:** wire through from persisted intent (or in-memory handoff in same invocation) into [`buildPlanOutcomePrompt`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/outcome/buildPlanOutcomePrompt.ts); do not rely on inferring gimmick from **`hypothesisLine`** alone.

### Testing and rollout

- [X] **Harness / fixtures:** **one** coordinated refreeze of `planSelectInject` and narrative inject fixtures when the handoff shape changes; gimmick is stable per fixture across phases (same string carried forward).
  - **Resolution:** single refreeze slice acceptable because gimmick does not morph phase-to-phase for a given fixture path.
- [X] **Parse / handoff failure on gimmick:** gimmick is **guidance-first**; if **`gimmick`** is missing or malformed at a boundary, **degrade gracefully** and continue reasoning from trope assignments and other handoff data (no mandate to hard-stub the entire hypothesis run for gimmick alone).
  - **Resolution:** prefer fallbacks that let downstream hops judge from remaining structured fields; exact step-level behavior is implementation detail (log + continue vs strip field).

### Coordination

- [X] **[`AGENT.tuneLLMPipeline.planning.md`](AGENT.tuneLLMPipeline.planning.md)** (Coyote hop tuning) is **dormant**. Until this gimmick refactor plan is **completed**, this initiative **takes precedence** for overlapping touchpoints (`schemaVersion`, harness and inject fixtures, prompt churn in the hypothesis and outcome paths). If tuning resumes later, reconcile any duplicate edits then (for example follow-on passes under the tuning plan after gimmick ships).

### Locked contract summary (for implementers)

| Topic | Choice |
| --- | --- |
| Candidate JSON | Required string **`gimmick`** (short; few words typical) |
| Parser enums | None for gimmick archetype |
| Duplicate gimmicks | Allowed at parse; prompt discourages |
| Plan-select input | **`schemaVersion`** bump; include **`gimmick`** per candidate |
| `selectedCandidate` | Must include **`gimmick`** mirroring winner |
| Combine | Carry **`gimmick`**; no gimmick-vs-member checks |
| Outliers | Unchanged; no gimmick-specific slots |
| Prompts | Strong examples + permission to reuse or innovate; woven guidance; see **Deferred to post-implementation tuning** for count/rotation |
| Dynamo intent | Property **`gimmick`** on write from winner; optional on read for legacy rows |
| Outcome | Explicit **`gimmick`** in prompt bundle |
| Harness | Single refreeze when seam changes |
| Gimmick parse/handoff failure | Graceful degradation using other handoff data |

## Getting started

1. Skim task-plan conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read Coyote package index and pipeline overview: [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md).
3. Read hypothesis pipeline phase doc: [`lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md).
4. Read trope rubric (constraints on beats, not a substitute for gimmick): [`lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md).
5. Read testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../../lambda/ephemera/AGENT.testing.md). If examples conflict elsewhere, follow that file for Jest usage and cwd (`lambda/ephemera/`).
6. Confirm script entry: [`lambda/ephemera/package.json`](../../../../../../lambda/ephemera/package.json).

**Baseline verification (before edits, from `lambda/ephemera/`):**

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/
```

## Progress

| Phase | Description | State |
| --- | --- | --- |
| G0 | Lock decisions in **Decisions** (schema, prompts, persistence, harness, failure posture) | **Locked** |
| G1 | Types + candidate parse/combine + serializers | **Done** |
| G2 | Plan-select parse + prompt + fixture freeze for incoming plan-select | **Done** |
| G3 | Narrative beat prompt + terminal behavior checks | Not started |
| G4 | Outcome + optional Dynamo fields + end-to-end harness | Not started |
| G5 | Durable doc updates; archive this plan | Not started |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] Phase G0 - contract and decision lock
  - [X] Resolve gimmick JSON shape and prompt archetype handling (see **Decisions**).
  - [X] Lock `schemaVersion` bump for plan-select input and **`selectedCandidate.gimmick`** mirror rule.
  - [X] Lock Dynamo intent **`gimmick`** property and explicit outcome handoff.
  - [X] Precedence: [`AGENT.tuneLLMPipeline.planning.md`](AGENT.tuneLLMPipeline.planning.md) is **dormant**; this plan **owns** Coyote `schemaVersion` / harness refreeze until completed (see **Coordination**).

- [X] Phase G1 - candidates seam (parse, combine, prompts)
  - [X] Update [`buildCandidatePrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/buildCandidatePrompt.ts) for short **`gimmick`** string, strong examples, and permission-to-reuse-or-innovate wording.
  - [X] Extend [`parseCandidateOutput.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/parseCandidateOutput.ts) and colocated tests.
  - [X] Extend [`combineCandidateOutput.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/combineCandidateOutput.ts) and rendering helpers that feed plan-select.
  - [X] Add or update unit tests under `candidates/*.test.ts`.

- [X] Phase G2 - plan select (input/output, prompts)
  - [X] Bump or extend plan-select input serialization (`schemaVersion` as locked in G0). (**Done in G1:** input JSON is **`schemaVersion: 4`** with per-candidate **`gimmick`**.)
  - [X] Update [`buildPlanSelectPrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.ts) for gimmick-aware rubric and comparison.
  - [X] Update [`parsePlanSelectOutput.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts) for optional **`selectedCandidate.gimmick`** (validated when present); canonical **`gimmick`** from combine in **`parsePlanSelectionHandoff`**.
  - [X] Refresh harness inject fixtures in **one** coordinated refreeze (per **Decisions**).

- [ ] Phase G3 - narrative beats
  - [ ] Update [`buildNarrativeBeatPrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts) to consume committed gimmick + tropes.
  - [ ] Confirm [`coyoteHypothesisPipeline.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts) behavior when **`gimmick`** is missing post-parse (graceful degradation per **Decisions**, not necessarily full-run stub).
  - [ ] Revisit token caps in [`invokeBedrockHypothesis.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/invokeBedrockHypothesis.ts) if gimmick sections materially grow prompts.

- [ ] Phase G4 - outcome and persistence
  - [ ] Extend [`internalCache/coyoteGame.ts`](../../../../../../lambda/ephemera/internalCache/coyoteGame.ts) with Dynamo **`gimmick`** on intent row (types, normalize, `putItem` / projection lists per **Decisions**).
  - [ ] Update [`buildPlanOutcomePrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/outcome/buildPlanOutcomePrompt.ts) / [`formatPhasePlanForOutcomePrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/outcome/formatPhasePlanForOutcomePrompt.ts) as needed.
  - [ ] Run targeted outcome tests and full `dataSource/coyoteGame/` suite per **Verification**.

- [ ] Phase G5 - documentation and cleanup
  - [ ] Update [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) and [`generators/pipelines/hypothesis/AGENT.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) with gimmick contracts (minimal delta, link here until done).
  - [ ] Archive or delete this planning file per team process.

## Verification

Run from **`lambda/ephemera/`** unless otherwise noted.

**Focused (iterate during implementation):**

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/
```

**Broader Coyote + actions seams (pre-merge):**

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/ dataSource/actions/discriminateIntent/
```

**Harness regression (when fixtures or slash paths change):**

```bash
npm run test -- --runInBand dataSource/coyoteGame/generators/testHarness/ dataSource/actions/parseCommand.test.ts dataSource/actions/discriminateIntent/
```

Command authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../../lambda/ephemera/AGENT.testing.md).

## Notes

- **Plan-select seam:** Plan-select **input** JSON uses **`schemaVersion: 4`**. **`PlanSelectCombinedCandidate.gimmick`** remains optional on the **parsed model** `selectedCandidate` (graceful degradation); **`parsePlanSelectionHandoff`** sets **`gimmick: matched.gimmick`** from combine when the winner **`candidateId`** matches. Stage-one parse always yields a non-empty internal **`gimmick`** (model string trimmed/truncated, else derived from **`executionSummary`**).
- **Seam room labels** ([`coyoteHypothesisPromptShared.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPromptShared.ts)) remain authoritative for geography strings in JSON; gimmick copy should not introduce a second room vocabulary.
- **Synthetic `stableKey` affordance rows** ([`generators/pipelines/hypothesis/AGENT.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md)) remain valid; trope rows carry mechanistic detail while **`gimmick`** stays a short tag.
