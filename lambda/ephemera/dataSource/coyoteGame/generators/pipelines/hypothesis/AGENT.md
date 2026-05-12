# Coyote hypothesis pipeline

This folder owns the multi-hop hypothesis generation flow for `mtw.ephemera.coyoteGame`.

Parent docs:

- Package overview: [`../../../AGENT.md`](../../../AGENT.md)
- LLM pipeline framework: [`../../../../../llm/pipeline/AGENT.md`](../../../../../llm/pipeline/AGENT.md)

## Pipeline architecture

Production runs a **linear sequence** orchestrated in [`coyoteHypothesisPipeline.ts`](coyoteHypothesisPipeline.ts): load room context, run three LLM phases (`candidates`, `planSelect`, `narrativeBeats`) with deterministic steps between them, then parse into cache-facing intent. Read this section for **what each phase is for**; exact step names, state fields, and parsers live in that source file.

### Conceptual flow

1. **Candidates**  
   The model proposes a **candidate pool** of trope-style readings (seams) from what changed in the room. Application code then **parses and combines** that output with staged room objects: validation, clustering, and rendering so later hops see a **single enriched view** of the possibilities, not just the raw transcript.

2. **Plan selection**  
   That combined pool is presented for **rubric-style comparison** so the model can weigh readings and settle on one coherent direction. Code **extracts a structured handoff**: a short summary of the committed reading, **residual** plan issues that still bind the story, and a **structured winning candidate** (`selectedCandidate`) supplemented with deterministic detail (for example tying outliers back to room objects) so the next hop stays grounded. The plan-select JSON parser may still tolerate a handoff **without** `selectedCandidate` at parse time; **orchestration** nonetheless **requires** `selectedCandidate` before the narrative beat LLM. If it is missing after plan-select, the run **aborts** to stub and does **not** call `buildNarrativeBeatPrompt`.

3. **Narrative beat**  
   The chosen framing and constraints feed the **final hop**, which turns them into a **`Hypothesis:`** line the player can read and optional structured narrative-beats / walkthrough material. Hop-2 Markdown walkthrough uses **`## Cartoon play-by-play`**; the shared terminal parser ([`parseHypothesisModelOutput`](../../sharedParsers/parseHypothesisModelOutput.ts)) uses that heading for walkthrough section trim rules. **`CoyoteGame` intent** loads from Dynamo in [`internalCache/coyoteGame.ts`](../../../../../internalCache/coyoteGame.ts) and rewrites a legacy first-line **`## Scene analysis`** to the canonical heading so publish filtering stays consistent. Parsers map model text into a **`CoyoteGameIntentRecord`** (`intent`, optional `walkthrough`, optional `narrativeBeatsStructured`, optional internal **`gimmick`** merged after plan-select) the cache and UI use.

**In one sentence:** propose a trope **candidate pool**, **enrich it deterministically**, **compare against a rubric and select a reading**, then **materialize** that choice into player-parseable hypothesis output (and optional structured follow-through).

Harness modes (`runUntil` / `runOnly`) slice this sequence or inject mid-pipeline state for tests (`selectHarnessSteps`, `initialStateForRunOnly` in the same file).

## Scope

The hypothesis pipeline is the production path for `Objects Changed` events in Coyote rooms:

1. **Candidates:** propose a trope assignment pool from staged objects, then merge it with room state into one enriched candidate view.
2. **Plan selection:** compare that pool under a rubric, choose a reading, and pass a structured handoff (summary, residual issues, structured winner `selectedCandidate`). The narrative beat hop runs only when `selectedCandidate` is present after parse (see [`coyoteHypothesisPipeline.ts`](coyoteHypothesisPipeline.ts)).
3. **Narrative beat:** render the committed reading into a `Hypothesis:` line and optional structured narrative-beats / walkthrough for the player and cache.

This folder contains pipeline-local prompts, orchestration, parsing, and Bedrock wrappers for that flow.

## Layout

- `candidates/`: first-hop (**`candidates`** phase) prompt, parse, and combine modules.
- `planSelect/`: plan-selection prompt and planSelect output contract/parser.
- `narrativeBeats/`: narrative-beat prompt/context modules (formerly phasePlan/stageTwo naming).
- Parent `hypothesis/`: orchestration, entrypoints, Bedrock wrapper, and shared prompt/harness types.

## Key files

- [`generateHypothesis.ts`](generateHypothesis.ts): entrypoint used by production and harness code.
- [`coyoteHypothesisPipeline.ts`](coyoteHypothesisPipeline.ts): ordered orchestration over the linear runner.
- [`invokeBedrockHypothesis.ts`](invokeBedrockHypothesis.ts): stage-specific Bedrock invoke wrappers and token limits (candidates hop defaults to **Nova Micro**; later hops use **Nova 2 Lite** unless overridden).
- [`candidates/buildCandidatePrompt.ts`](candidates/buildCandidatePrompt.ts): stage-one prompt parts.
- [`candidates/parseCandidateOutput.ts`](candidates/parseCandidateOutput.ts): stage-one seam parsing and validation.
- [`candidates/combineCandidateOutput.ts`](candidates/combineCandidateOutput.ts): combine and render candidate output for later hops.
- [`planSelect/buildPlanSelectPrompt.ts`](planSelect/buildPlanSelectPrompt.ts): plan-selection prompt builder.
- [`planSelect/parsePlanSelectOutput.ts`](planSelect/parsePlanSelectOutput.ts): extracts planSelect output contract.
- [`narrativeBeats/buildNarrativeBeatPrompt.ts`](narrativeBeats/buildNarrativeBeatPrompt.ts): narrative-beat prompt builder.

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

**`normalizedJson`.** On successful parse, each candidate includes **`gimmick`** (short spine string),
**`candidateId`**, **`executionSummary`**, and a `tropeAssignments` object emitted with trope keys in **canonical order**
(`Contraption`, then `Bait`, then `Misdirection`, then `Disadvantage`, then `Finishing Move`), omitting absent tropes.
Root object order stays **`candidates`** then optional **`notes`**.

**Combine.** Parsed records flow through combine as a **`Partial<Record<CoyoteTrope, CombinedTropeAssignment>>`**
keyed by trope; rendering helpers (`renderCombinedCandidateOutputForNarrativeBeat`,
`serializePlanSelectCandidateInput`) iterate the canonical trope order so plan-select JSON and
Markdown renders stay stable. Plan-select input JSON is **`schemaVersion: 4`** with per-candidate **`gimmick`**
and `tropeAssignments` as a non-array object keyed by trope.

**Boundary vs plan-select.** Plan-selection handoff JSON uses the **same** record shape as plan-select input candidates:
`selectedCandidate` includes optional **`gimmick`** (echo for reasoning alignment). Parser validates **`gimmick`** when present (trim + length cap; [`candidates/parseCandidateOutput.ts`](candidates/parseCandidateOutput.ts) **`truncateCoyoteGimmickEcho`**); omission does not fail parse. Canonical **`gimmick`** for downstream hops is set in **`parsePlanSelectionHandoff`** ([`coyoteHypothesisPipeline.ts`](coyoteHypothesisPipeline.ts)) from the combine row matching **`selectedCandidate.candidateId`** (mirror from staged combine, not model output alone).
`selectedCandidate.tropeAssignments` is a non-array object keyed by trope. Array-shaped
`tropeAssignments` is rejected by [`planSelect/parsePlanSelectOutput.ts`](planSelect/parsePlanSelectOutput.ts)
(hard cutover, matching the candidate-output parser).

**Boundary vs staged snapshot.** Affinity-forward serialization for the prompt
([`candidates/serializeStagedObjectsForCandidatePrompt.ts`](candidates/serializeStagedObjectsForCandidatePrompt.ts))
is **input** to stage one only; it does not define the candidate JSON emit shape.

**`affordancesProvided` (optional).** When present on trope affinity rows, values are validated in `@tonylb/mtw-interfaces` (see [`coyotePlanAffinities.ts`](../../../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)). [`candidates/combineCandidateOutput.ts`](candidates/combineCandidateOutput.ts) aggregates them onto plan-select input JSON for **members and outliers** alongside `environmentAffordances`. [`planSelect/buildPlanSelectPrompt.ts`](planSelect/buildPlanSelectPrompt.ts) and [`planSelect/parsePlanSelectOutput.ts`](planSelect/parsePlanSelectOutput.ts) treat the field as optional structured evidence on handoff rows. There is no required consumption in narrative-beats hop or outcome in the current architecture; extending winners or narrative-beats structured output with explicit affordance objects is a follow-on slice.

### Materialized affordance rows (synthetic `stableKey`)

Plan-select may **materialize** chosen affordances as first-class `tropeAssignments` member rows (for example under **`Finishing Move`**) using synthetic **`stableKey`** values so later hops do not infer finishing beats only from embedded affordance arrays on props.

- **Identity.** Synthetic keys use the **`affordance:`** prefix (for example `affordance:coyote`). When multiple affordance rows of the same kind appear in one handoff, add numeric suffixes (for example `affordance:boulder1`, `affordance:boulder2`). These keys are **not** staged-room-object identities: they do **not** resolve through room-object caches and carry meaning **only** inside the handoff JSON they travel with.
- **Grounding (`room`)** (v1). **`room`** on a synthetic affordance member should match the **seam label** of the staged member or outlier row the affordance was chosen from.
- **Member JSON shape.** Synthetic rows use the **same** member object shape as staged-backed rows validated by [`planSelect/parsePlanSelectOutput.ts`](planSelect/parsePlanSelectOutput.ts): required **`stableKey`**, **`shortName`**, **`room`**, **`tropeFunction`**; optional **`environmentAffordances`** / **`affordancesProvided`** with the same validation as other members. Synthetic rows still supply human-readable **`shortName`** and role text in **`tropeFunction`**; those fields are required strings even when **`stableKey`** is synthetic.
- **Optional materialization.** A valid handoff may include **no** synthetic affordance rows when the selected reading does not need them. There is **no** plan-select handoff **`schemaVersion`** bump for this contract.

**Authority.** Parser validation: [`planSelect/parsePlanSelectOutput.ts`](planSelect/parsePlanSelectOutput.ts). Prompt guidance for when and how to materialize: [`planSelect/buildPlanSelectPrompt.ts`](planSelect/buildPlanSelectPrompt.ts).

**Regression tests.** Colocated under `candidates/*.test.ts`, pipeline tests in this folder, and
[`../../testHarness/`](../../testHarness/). Run Jest from `lambda/ephemera` per [`AGENT.testing.md`](../../../../../AGENT.testing.md).

**Harness example.** Coyote engine fixture-01 (`FIXTURE_01_NARRATIVE_BEATS_HANDOFF`) injects narrative-beat `planSelectOutput` with `selectedCandidate` that includes a **Finishing Move** member using **`affordance:coyote`**, exercised by [`coyoteEngineTestFixtures.test.ts`](../../testHarness/coyoteEngineTestFixtures.test.ts). Definition: [`coyoteEngineTestFixtures.ts`](../../testHarness/coyoteEngineTestFixtures.ts).

**Narrative beat harness (`runOnly` `narrativeBeats`).** Injected pipeline state uses **`CoyoteHarnessNarrativeBeatsInject`**: **`{ planSelectOutput, roomObjectsByRoom }`** only (no **`combined`**). `selectedCandidate` is required on `planSelectOutput` for this path. Types: [`coyoteHarnessInjectTypes.ts`](coyoteHarnessInjectTypes.ts); orchestration and validation: [`coyoteHypothesisPipeline.ts`](coyoteHypothesisPipeline.ts).

- Terminal parse of model output into cache-facing intent fields is shared and lives in [`../../sharedParsers/parseHypothesisModelOutput.ts`](../../sharedParsers/parseHypothesisModelOutput.ts), not in this folder.
- Cross-cutting staged-object helpers and render-tree constants are under [`../../../utilities/`](../../../utilities/).
- Harness code lives under [`../../testHarness/`](../../testHarness/) and imports this pipeline rather than duplicating it.

## Hop-1 handoff (`planIssues`) contract

Authority for plan-selection to narrative-beat handoff shape is [`planSelect/parsePlanSelectOutput.ts`](planSelect/parsePlanSelectOutput.ts).

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

### `selectedCandidate` (structured winner)

- Hop-1 JSON may include optional `selectedCandidate` at parse time: the structured winning candidate, shaped like plan-select input candidates (mirror input shape in v1; sequencing hints are omitted in v1). Optional **`gimmick`** on the model payload is validated when present; orchestration overwrites with combine **`gimmick`** when **`candidateId`** matches (**`parsePlanSelectionHandoff`**).
- `selectedCandidate.tropeAssignments` is a **non-array object keyed by trope** (`Contraption`, `Bait`, `Misdirection`, `Disadvantage`, `Finishing Move`); each value carries `executionDetail` and `members`. Array-shaped `tropeAssignments` is rejected at parse time.
- **Pipeline:** [`hypothesis/coyoteHypothesisPipeline.ts`](coyoteHypothesisPipeline.ts) **requires** `selectedCandidate` after plan-select parse before invoking the narrative beat hop. If the parsed handoff lacks it, the run **aborts** to stub (same family as other hypothesis aborts); legacy-only JSON without `selectedCandidate` does **not** reach [`narrativeBeats/buildNarrativeBeatPrompt.ts`](narrativeBeats/buildNarrativeBeatPrompt.ts).

### Plan-selection hop (single invocation)

- Production still uses **one** Bedrock call for plan-selection; internal multi-phase reasoning is expressed **inside** that prompt (explicit phase order and markdown sections), not as separate pipeline steps.
- Prompt authority: [`planSelect/buildPlanSelectPrompt.ts`](planSelect/buildPlanSelectPrompt.ts). The **trailing** fenced JSON handoff block (the last `json` code fence in the model output) is the artifact consumed by the planSelect output parser for downstream use.

### Narrative beat consumption

- [`narrativeBeats/buildNarrativeBeatPrompt.ts`](narrativeBeats/buildNarrativeBeatPrompt.ts) accepts **`planSelectOutput`** with mandatory **`selectedCandidate`** plus **`roomObjectsByRoom`** only. The narrative beat prompt **does not** embed the full **combined** candidate pool. **Combined** output still exists **upstream** (for example plan-select input serialization and the **`parsePlanSelectionHandoff`** step in [`coyoteHypothesisPipeline.ts`](coyoteHypothesisPipeline.ts), including canonical **`gimmick`** and outlier rehydration when **`selectedCandidate.candidateId`** matches a combine row); it is simply **not** passed into `buildNarrativeBeatPrompt` as a whole pool. When **`candidateId`** does not match any combine row, orchestration logs and continues with the parsed winner only (no canonical **`gimmick`** merge); the prompt then uses a **no gimmick tag** fallback line and **`executionSummary`** + **`tropeAssignments`** as spine cues.
- Dynamic Markdown uses a single **`## Committed plan`** block (summary, residual issues, structured winner). When present, **`gimmick`** is printed under the selected candidate as a short spine tag; when absent or blank after handoff, the committed plan includes explicit fallback wording instead of inventing a gimmick string. Instructions for **how to read** that block are **inline** in `buildNarrativeBeatPrompt.ts` (local string constants next to prompt assembly), not a shared multi-candidate clustering contract.
- Default narrative beat max output tokens: **`BEDROCK_HYPOTHESIS_NARRATIVE_BEAT_MAX_TOKENS` = 2048** in [`invokeBedrockHypothesis.ts`](invokeBedrockHypothesis.ts). Change the cap only with explicit justification (for example harness **`usageNarrativeBeat`** and manual load review). G3 left this equal to the default after review (gimmick text is prompt-input-only).

**Follow-on narrative copy (not required here).** Stronger model-facing guidance for **Finishing Move as terminal beat**, **backward reasoning**, and **prep vs showtime** relative to Road Runner involvement belongs in a **future** `taskPlanning` task plan, not this pipeline doc. Related trope-centered context: [`AGENT.tropeCenteredRefactor.planning.md`](../../../../../../../taskPlanning/lambda/ephemera/dataSource/coyoteGame/AGENT.tropeCenteredRefactor.planning.md).

### Residual `planIssues`

- The final handoff lists **only unresolved** issues: rows that were resolved during plan-selection reasoning are **not** included in emitted `planIssues`.

Stage responsibilities:

- Plan-selection identifies issues and resolves what it can; **emitted** `planIssues` are residual obligations only. Intent-signal rows count as negative winner evidence while they remain open.
- Underspecification rows are deconfliction obligations, not automatic disqualifiers.
- The narrative beat LLM treats the chosen summary, residual `planIssues`, and **`selectedCandidate`** as authoritative constraints and resolves or escalates accordingly. That hop runs only after orchestration has confirmed `selectedCandidate` is present (see **`selectedCandidate` (structured winner)** above).

## Tests

- Unit tests are colocated next to each phase module under `candidates/`, `planSelect/`, and `narrativeBeats/`.
- Harness-focused tests remain under [`../../testHarness/`](../../testHarness/).
