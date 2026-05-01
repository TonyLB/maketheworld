# Coyote hypothesis pipeline

This folder owns the multi-hop hypothesis generation flow for `mtw.ephemera.coyoteGame`.

Parent docs:

- Package overview: [`../../../AGENT.md`](../../../AGENT.md)
- LLM pipeline framework: [`../../../../../llm/pipeline/AGENT.md`](../../../../../llm/pipeline/AGENT.md)

## Pipeline architecture

Production runs a **linear sequence** orchestrated in [`coyoteHypothesisPipeline.ts`](coyoteHypothesisPipeline.ts): load room context, run three LLM phases (`candidates`, `planSelect`, `phasePlan`) with deterministic steps between them, then parse into cache-facing intent. Read this section for **what each phase is for**; exact step names, state fields, and parsers live in that source file.

### Conceptual flow

1. **Candidates**  
   The model proposes a **candidate pool** of trope-style readings (seams) from what changed in the room. Application code then **parses and combines** that output with staged room objects: validation, clustering, and rendering so later hops see a **single enriched view** of the possibilities, not just the raw transcript.

2. **Plan selection**  
   That combined pool is presented for **rubric-style comparison** so the model can weigh readings and settle on one coherent direction. Code **extracts a structured handoff**: a short summary of the committed reading, **residual** plan issues that still bind the story, and optionally a **structured winning candidate** supplemented with deterministic detail (for example tying outliers back to room objects) so the next hop stays grounded.

3. **Narrative beat (phase plan)**  
   The chosen framing and constraints feed the **final hop**, which turns them into a **`Hypothesis:`** line the player can read and optional structured plan / walkthrough material. A shared terminal parser ([`parseHypothesisModelOutput`](../../sharedParsers/parseHypothesisModelOutput.ts)) maps model text into a **`CoyoteGameIntentRecord`** the cache and UI use.

**In one sentence:** propose a trope **candidate pool**, **enrich it deterministically**, **compare against a rubric and select a reading**, then **materialize** that choice into player-parseable hypothesis output (and optional structured follow-through).

Harness modes (`runUntil` / `runOnly`) slice this sequence or inject mid-pipeline state for tests (`selectHarnessSteps`, `initialStateForRunOnly` in the same file).

## Scope

The hypothesis pipeline is the production path for `Objects Changed` events in Coyote rooms:

1. **Candidates:** propose a trope assignment pool from staged objects, then merge it with room state into one enriched candidate view.
2. **Plan selection:** compare that pool under a rubric, choose a reading, and pass a structured handoff (summary, residual issues, optional winner).
3. **Narrative beat:** render the committed reading into a `Hypothesis:` line and optional structured plan/walkthrough for the player and cache.

This folder contains pipeline-local prompts, orchestration, parsing, and Bedrock wrappers for that flow.

## Layout

- `candidates/`: first-hop (**`candidates`** phase) prompt, parse, and combine modules.
- `planSelect/`: plan-selection prompt and planSelect output contract/parser.
- `narrativeBeats/`: phase-plan prompt/context modules (formerly phasePlan/stageTwo naming).
- Parent `hypothesis/`: orchestration, entrypoints, Bedrock wrapper, and shared prompt/harness types.

## Key files

- [`generateHypothesis.ts`](generateHypothesis.ts): entrypoint used by production and harness code.
- [`coyoteHypothesisPipeline.ts`](coyoteHypothesisPipeline.ts): ordered orchestration over the linear runner.
- [`invokeBedrockHypothesis.ts`](invokeBedrockHypothesis.ts): stage-specific Bedrock invoke wrappers and token limits.
- [`candidates/buildCandidatePrompt.ts`](candidates/buildCandidatePrompt.ts): stage-one prompt parts.
- [`candidates/parseCandidateOutput.ts`](candidates/parseCandidateOutput.ts): stage-one seam parsing and validation.
- [`candidates/combineCandidateOutput.ts`](candidates/combineCandidateOutput.ts): combine and render candidate output for later hops.
- [`planSelect/buildPlanSelectPrompt.ts`](planSelect/buildPlanSelectPrompt.ts): plan-selection prompt builder.
- [`planSelect/parsePlanSelectOutput.ts`](planSelect/parsePlanSelectOutput.ts): extracts planSelect output contract.
- [`narrativeBeats/buildNarrativeBeatPrompt.ts`](narrativeBeats/buildNarrativeBeatPrompt.ts): phase-plan prompt builder.

## Contracts and boundaries

### Trope rubric (conceptual)

Prompt and parser **keys** are **`CoyoteTrope`** literals in canonical order (`Contraption`, `Bait`, `Misdirection`, `Disadvantage`, `Finishing Move`). For **unawareness**, **first Road-Runner-facing** beats, and **Bait vs Misdirection vs Disadvantage** (voluntary lure vs perceptual misread vs imposed condition), use the shared conceptual spec in [`../../../AGENT.tropes.md`](../../../AGENT.tropes.md) --- do not duplicate the full rubric here.

### Stage-one candidate seam (`tropeAssignments`)

Authority: [`candidates/buildCandidatePrompt.ts`](candidates/buildCandidatePrompt.ts) (prompt),
[`candidates/parseCandidateOutput.ts`](candidates/parseCandidateOutput.ts) (parse),
[`candidates/combineCandidateOutput.ts`](candidates/combineCandidateOutput.ts) (hydrate + derive outliers).

**Shape.** Each candidate must include `tropeAssignments` as a **non-array object** with **at least one**
trope key. Keys must be `CoyoteTrope` literals only (`Contraption`, `Bait`, `Misdirection`, `Disadvantage`,
`Finishing Move`); see [`isCoyoteTrope`](../../../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)
in `@tonylb/mtw-interfaces`. Sparse records omit unused tropes; do **not** require all five tropes or
empty member lists. Each trope value is `{ "executionDetail": string, "members": [...] }` only (keep
the **`executionDetail`** name).

Example:

```json
"tropeAssignments": {
  "Contraption": { "executionDetail": "...", "members": [{ "stableKey": "...", "tropeFunction": "..." }] },
  "Finishing Move": { "executionDetail": "...", "members": [...] }
}
```

**Expressivity.** One key per trope per candidate enforces **at most one beat per trope** (no duplicate
trope keys). The model cannot emit two independent beats for the same trope (for example two
`Contraption` rows); that narrowing is intentional.

**Parser posture (hard cutover).** `parseCandidateOutput` accepts **only** the record shape above.
Legacy array-shaped `tropeAssignments` and empty `{}` are rejected. Per-trope values allow only
`executionDetail` and `members`; each member allows only `stableKey` and `tropeFunction`, with
strict unknown-key rejection at root, candidate, trope value, member, and optional outlier rows.

**Optional `outliers`.** Candidate-level `outliers` remains **stableKey-only** scaffolding for the
model; authoritative outliers are still **derived in combine** from staged multiset minus assigned
members.

**`normalizedJson`.** On successful parse, each candidate's `tropeAssignments` object is emitted
with trope keys in **canonical order** (`Contraption`, then `Bait`, then `Misdirection`, then `Disadvantage`, then
`Finishing Move`), omitting absent tropes. Root object order stays **`candidates`** then optional
**`notes`**.

**Combine.** Parsed records flow through combine as a **`Partial<Record<CoyoteTrope, CombinedTropeAssignment>>`**
keyed by trope; rendering helpers (`renderCombinedCandidateOutputForNarrativeBeat`,
`serializePlanSelectCandidateInput`) iterate the canonical trope order so plan-select JSON and
Markdown renders stay stable. Plan-select input JSON is **`schemaVersion: 3`** with
`tropeAssignments` as a non-array object keyed by trope.

**Boundary vs plan-select.** Plan-selection handoff JSON uses the **same** record shape:
`selectedCandidate.tropeAssignments` is a non-array object keyed by trope. Array-shaped
`tropeAssignments` is rejected by [`planSelect/parsePlanSelectOutput.ts`](planSelect/parsePlanSelectOutput.ts)
(hard cutover, matching the candidate-output parser).

**Boundary vs staged snapshot.** Affinity-forward serialization for the prompt
([`candidates/serializeStagedObjectsForCandidatePrompt.ts`](candidates/serializeStagedObjectsForCandidatePrompt.ts))
is **input** to stage one only; it does not define the candidate JSON emit shape.

**`affordancesProvided` (optional).** When present on trope affinity rows, values are validated in `@tonylb/mtw-interfaces` (see [`coyotePlanAffinities.ts`](../../../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)). [`candidates/combineCandidateOutput.ts`](candidates/combineCandidateOutput.ts) aggregates them onto plan-select input JSON for **members and outliers** alongside `environmentAffordances`. [`planSelect/buildPlanSelectPrompt.ts`](planSelect/buildPlanSelectPrompt.ts) and [`planSelect/parsePlanSelectOutput.ts`](planSelect/parsePlanSelectOutput.ts) treat the field as optional structured evidence on handoff rows. There is no required consumption in phase-plan or outcome in the current architecture; extending winners or phase-plan with explicit affordance objects is a follow-on slice.

**Regression tests.** Colocated under `candidates/*.test.ts`, pipeline tests in this folder, and
[`../../testHarness/`](../../testHarness/). Run Jest from `lambda/ephemera` per [`AGENT.testing.md`](../../../../../AGENT.testing.md).

- Terminal parse of model output into cache-facing intent fields is shared and lives in [`../../sharedParsers/parseHypothesisModelOutput.ts`](../../sharedParsers/parseHypothesisModelOutput.ts), not in this folder.
- Cross-cutting staged-object helpers and render-tree constants are under [`../../../utilities/`](../../../utilities/).
- Harness code lives under [`../../testHarness/`](../../testHarness/) and imports this pipeline rather than duplicating it.

## Hop-1 handoff (`planIssues`) contract

Authority for plan-selection to phase-plan handoff shape is [`planSelect/parsePlanSelectOutput.ts`](planSelect/parsePlanSelectOutput.ts).

- Required JSON keys are `paragraphSummary` and `planIssues`.
- `planIssues` rows are structured objects with required `code` and `summary`, plus optional `evidence: string[]`.
- Allowed `code` values are:
  - Intent-signal: `OUTLIER_PROP_UNACCOUNTED`, `TROPE_FUNCTION_MISMATCH`, `STRUCTURAL_CONTRADICTION`
  - Underspecification: `DIRECTION_AMBIGUOUS`, `ROLE_CONFLICT`
- Classification is deterministic in application logic (`isIntentSignalPlanIssueCode`, `isUnderspecificationPlanIssueCode`), not model-emitted.

Parser safety posture:

- Reject unknown codes and malformed rows with row-scoped reasons (`planIssues[index] ...`).
- Require well-typed `paragraphSummary`, `planIssues`, `code`, and `summary`.
- Keep extra keys tolerant in v1 as long as required keys remain present and valid.
- Unknown top-level keys on the parsed JSON object may be tolerated at parse time; downstream consumption uses a **narrowed** authoritative handoff object produced by [`planSelect/parsePlanSelectOutput.ts`](planSelect/parsePlanSelectOutput.ts) (non-authoritative keys are dropped deterministically).

### Optional `selectedCandidate` (structured winner)

- Hop-1 JSON may include optional `selectedCandidate`: the structured winning candidate, shaped like plan-select input candidates (mirror input shape in v1; sequencing hints are omitted in v1).
- `selectedCandidate.tropeAssignments` is a **non-array object keyed by trope** (`Contraption`, `Bait`, `Misdirection`, `Disadvantage`, `Finishing Move`); each value carries `executionDetail` and `members`. Array-shaped `tropeAssignments` is rejected at parse time.
- Legacy-only handoff (`paragraphSummary` plus `planIssues` without `selectedCandidate`) remains valid during rollout.

### Plan-selection hop (single invocation)

- Production still uses **one** Bedrock call for plan-selection; internal multi-phase reasoning is expressed **inside** that prompt (explicit phase order and markdown sections), not as separate pipeline steps.
- Prompt authority: [`planSelect/buildPlanSelectPrompt.ts`](planSelect/buildPlanSelectPrompt.ts). The **trailing** fenced JSON handoff block (the last `json` code fence in the model output) is the artifact consumed by the planSelect output parser for downstream use.

### Phase-plan consumption

- [`narrativeBeats/buildNarrativeBeatPrompt.ts`](narrativeBeats/buildNarrativeBeatPrompt.ts) should **prioritize** `selectedCandidate` for grounding when present.
- When `selectedCandidate` is absent, phase-plan falls back to `paragraphSummary` and `planIssues` (best-effort bridge for legacy outputs and fixtures).

### Residual `planIssues`

- The final handoff lists **only unresolved** issues: rows that were resolved during plan-selection reasoning are **not** included in emitted `planIssues`.

Stage responsibilities:

- Plan-selection identifies issues and resolves what it can; **emitted** `planIssues` are residual obligations only. Intent-signal rows count as negative winner evidence while they remain open.
- Underspecification rows are deconfliction obligations, not automatic disqualifiers.
- Phase-plan treats the chosen summary, residual `planIssues`, and (when present) `selectedCandidate` as authoritative constraints and resolves or escalates accordingly.

## Tests

- Unit tests are colocated next to each phase module under `candidates/`, `planSelect/`, and `narrativeBeats/`.
- Harness-focused tests remain under [`../../testHarness/`](../../testHarness/).
