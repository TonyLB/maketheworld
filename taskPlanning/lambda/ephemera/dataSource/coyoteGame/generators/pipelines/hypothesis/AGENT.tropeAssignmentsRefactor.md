# Hypothesis candidates: `tropeAssignments` record refactor

**Status:** Not started. Replace stage-one **array** `tropeAssignments` with a **sparse record keyed by trope** so each candidate admits **at most one beat per trope** (narrowing expressivity is intentional).

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../../../AGENT.md).

Area testing authority (if commands conflict with generic examples, follow this file): [`lambda/ephemera/AGENT.testing.md`](../../../../../../../../lambda/ephemera/AGENT.testing.md).

## Purpose

Ship a **stage-one JSON contract change**: model output shape becomes something like:

```json
"tropeAssignments": {
  "Contraption": { "executionDetail": "...", "members": [...] },
  "Finishing Move": { "executionDetail": "...", "members": [...] }
}
```

instead of an ordered array of `{ "trope", "executionDetail", "members" }`.

**Intended invariant:** keys are **`CoyoteTrope`** literals only; **no duplicate tropes** within a candidate by construction.

**Explicit tradeoff:** candidates cannot express **two independent beats for the same trope** (e.g. two Contraptions). That restriction is desired.

Steady-state parser contracts and pipeline architecture belong in [`hypothesis/AGENT.md`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) after merge; this file is disposable when the task completes.

## Decision locks (do not improvise)

Implementers must follow these; they remove rollout and serialization ambiguity called out in task-plan review.

1. **Hard cutover.** Stage-one output accepts **`tropeAssignments` only as a record** (sparse object keyed by trope string). **Do not** accept the legacy **array** shape in `parseCandidateOutput`, even temporarily. Update every fixture, harness literal, and prompt example to the new shape in the same change.

2. **Non-empty assignments.** Each candidate must have **`tropeAssignments`** as a non-array object with **at least one** trope key after validation (same spirit as today's non-empty `tropeAssignments` array). **Reject** `{}` and reject **arrays** at `tropeAssignments`.

3. **`normalizedJson` key order.** When building **`normalizedJson`** for parse success, emit each candidate's **`tropeAssignments`** record with trope keys in **canonical trope order** (`Contraption` -> `Distraction` -> `Disadvantage` -> `Finishing Move`), omitting absent tropes. Leave optional **`notes`** handling unchanged unless existing tests dictate otherwise.

4. **Field names.** Keep **`executionDetail`** on each trope value (do not rename to `detail` in this task unless you explicitly reopen scope).

5. **`outliers` unchanged.** Candidate-level optional **`outliers`** remains stable-key scaffolding only; authoritative outliers still come from **combine**. Parser rules for outliers stay aligned with current strict schema unless a test proves otherwise.

6. **Durable docs.** Updating [`hypothesis/AGENT.md`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) is **recommended** when the stage-one contract changes (brief bullets); skipping doc updates requires a PR comment or follow-up issue.

## Scope

### In scope

- **Stage-one prompt** contract text and few-shot in [`buildCandidatePrompt.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/buildCandidatePrompt.ts).
- **Stage-one parse + types** in [`parseCandidateOutput.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/parseCandidateOutput.ts): validate record keys as tropes, validate each value has **`executionDetail`**, **`members`** with **`stableKey`** + **`tropeFunction`**, strict unknown-key rejection (**see [Decision locks](#decision-locks-do-not-improvise)**).
- **Normalize to existing combined shape** in [`combineCandidateOutput.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/combineCandidateOutput.ts): expand record to **`CombinedTropeAssignment[]`** (or **`ParsedCandidate`** internal array) in **canonical trope order** so downstream **plan-select JSON** and **`serializePlanSelectCandidateInput`** stay unchanged for this slice unless you expand scope.
- **Tests:** [`parseCandidateOutput.test.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/parseCandidateOutput.test.ts), [`combineCandidateOutput.test.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/combineCandidateOutput.test.ts), [`buildCandidatePrompt.test.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/buildCandidatePrompt.test.ts), [`coyoteHypothesisPipeline.test.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.test.ts), [`generateHypothesis.test.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/generateHypothesis.test.ts).
- **Harness fixtures** with embedded stage-one bodies: [`coyoteEngineTestFixtures.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts) and any other literals grep finds.

### Out of scope (unless you revise this plan)

- **`selectedCandidate.tropeAssignments`** in **plan-select handoff JSON** ([`parsePlanSelectOutput.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts)) --- remains an **array** contract today; changing hop-2 output is a separate migration.
- **Affinity-forward staged snapshot** ([`serializeStagedObjectsForCandidatePrompt.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/serializeStagedObjectsForCandidatePrompt.ts)) --- unrelated to outgoing candidate schema except prompt cross-references.

## Design notes (implementation hints)

- **Sparse record:** only include trope keys present in that candidate; do **not** require all four tropes with empty members.
- **Coverage rules:** preserve existing multiset logic --- union of **`members`** across **present** tropes vs staged snapshot; **`combineCandidateOutput`** continues to derive outliers.
- **`normalizedJson`:** follow **[Decision locks](#decision-locks-do-not-improvise)** item 3 (canonical key order per candidate record).

## Progress

| Phase | Description | Status |
| --- | --- | --- |
| 1 | Prompt + few-shot + contract lines (`buildCandidatePrompt`) | Not started |
| 2 | Parser types + validation (`parseCandidateOutput`) + tests | Not started |
| 3 | Combine normalization + tests (`combineCandidateOutput`) | Not started |
| 4 | Pipeline/harness/fixture string updates + grep sweep | Not started |
| 5 | Verification commands + optional durable doc touch (`hypothesis/AGENT.md`) | Not started |

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as you finish them.

- [ ] Read task-planning norms and this file's Purpose/Scope ([`taskPlanning/AGENT.md`](../../../../../../AGENT.md)).
- [ ] Skim current contracts: [`parseCandidateOutput.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/parseCandidateOutput.ts), [`combineCandidateOutput.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/combineCandidateOutput.ts), [`buildCandidatePrompt.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/buildCandidatePrompt.ts).
- [ ] Update **`buildCandidatePrompt`** stage-one JSON contract and few-shot examples for record-shaped **`tropeAssignments`**.
- [ ] Refactor **`parseCandidateOutput`** to parse and validate the record; update **`ParsedCandidate`** / internal types; implement **`normalizedJson`** per **[Decision locks](#decision-locks-do-not-improvise)** (hard cutover, non-empty record, canonical trope key order).
- [ ] Implement **`combineCandidateOutput`** input from parsed record (iterate tropes in **`TROPE_ORDER`**); preserve outlier derivation and duplicate **`stableKey`** checks.
- [ ] Update unit tests in **`candidates/`** and pipeline tests; refresh **`coyoteEngineTestFixtures`** and any grep-discovered stage-one JSON literals.
- [ ] Run verification commands (from **`lambda/ephemera/`**, authority [`AGENT.testing.md`](../../../../../../../../lambda/ephemera/AGENT.testing.md)):
  - [ ] `npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/`
  - [ ] `npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.test.ts dataSource/coyoteGame/generators/pipelines/hypothesis/generateHypothesis.test.ts`
  - [ ] Optional broader slice: `npm run test -- --watchAll=false dataSource/coyoteGame/generators/testHarness/`
- [ ] Update [`hypothesis/AGENT.md`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) with brief stage-one contract bullets (**recommended**, see **[Decision locks](#decision-locks-do-not-improvise)** item 6); **archive or delete** this task plan when done ([`taskPlanning/AGENT.md` When the task finishes](../../../../../../AGENT.md#when-the-task-finishes)).

## Verification

Baseline before edits (should pass on a clean tree):

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/
```

After implementation, rerun the **Recommended order** verification bullets and fix failures until green.

Useful grep sweeps during implementation:

```bash
rg "tropeAssignments" lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis --glob '*.ts'
rg "tropeAssignments" lambda/ephemera/dataSource/coyoteGame/generators/testHarness --glob '*.ts'
```

## Getting started

1. Read **[Decision locks](#decision-locks-do-not-improvise)** above before coding.
2. Skim [`taskPlanning/AGENT.md`](../../../../../../AGENT.md) (durability, Recommended order checkbox rules).
3. Read [`lambda/ephemera/AGENT.testing.md`](../../../../../../../../lambda/ephemera/AGENT.testing.md) for Jest command authority (`npm run test`, cwd **`lambda/ephemera/`**).
4. Trace stage-one flow: [`coyoteHypothesisPipeline.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts) (`hypothesisCandidatesLlm` -> `seamCombineRender`).
5. Confirm **`CoyoteTrope`** allowlist: [`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts) (`isCoyoteTrope`).
6. Run baseline verification command above before editing.
