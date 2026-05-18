# Coyote Game: Scene Dressing trope (planning)

**Status:** SS0 complete --- contract locked. Next step: Phase SS1 (`mtw-interfaces`: **`Scene Dressing`** first in **`CANONICAL_TROPE_ORDER`**).

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

Add a sixth Coyote trope, **`Scene Dressing`**, so **Acme Order Enrich** can tag **associative** (non-causal) props in **`tropeAffinities`**, **`decisionFocus`** can surface archetype signal to candidate gen, and the hypothesis pipeline can cluster and assign those props without leaving the trope-first regime.

**Motivating failure (handoff):** Enrich today only reads **causal affordances**. Staging skateboard + helmet + goggles yields weak hostile fits on helmet/goggles, three thin single-prop candidates, and no high-speed chase spine where helmet/goggles are **scene dressing** around the skateboard anchor.

Steady-state vocabulary after implementation: [`lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md).

## Semantics (else-chat handoff)

### Problem: two prop registers

Looney Tunes plans use:

1. **Causal props** --- mechanical roles (anvil, birdseed, rocket sled).
2. **Associative props** --- narrative/thematic signal without causal contribution (safety gear, lab coat, aviator jacket). The Coyote's helmet does not save him; it signals **what kind of scene** is being staged.

Without associative signal, enrich invents weak causal readings, **`decisionFocus`** under-ranks dressing props, and candidate gen cannot cluster on an obvious archetype spine.

### Fix

**`Scene Dressing`** is explicitly **non-functional** --- no causal role --- but makes association **machine-readable** inside **`tropeAffinities`** (same `{ trope, aptness, narrowing }` shape as causal tropes).

### Narrowing contract (enrich time)

- **`narrowing`** names the **aesthetic or material category**, not an effect or mechanism.
- Stay **broad categorical** (right grain): `"racing gear"`, `"protective equipment"`, `"scientific apparatus"`, `"adventurous clothing"`.
- **Do not** name scenario/archetype on the item (wrong grain): not `"aviation"` or `"high-speed chase"` --- archetype emerges from **clusters at candidate gen**, not premature enrich commitment.

### Enrichment prompt (locked copy)

Add to the trope vocabulary section in [`buildPrompt.ts`](../../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/buildPrompt.ts) (short, positive, examples do the work; no negative guardrails):

> **Scene Dressing** (narrative association): this item completes a visual or thematic scene without contributing a causal mechanism. Narrowing names the aesthetic or material category: e.g. `"racing gear"`, `"protective equipment"`, `"scientific apparatus"`, `"adventurous clothing"`.

**POV rule:** The Coyote-perspective **`narrowing` POV rule** applies only to **causal** tropes. Prefer reframing the existing POV paragraph to say so explicitly rather than a one-off Scene Dressing exemption.

**Affordances:** Scene Dressing rows should **not** carry **`environmentAffordances`** or **`affordancesProvided`** (non-functional trope; no completion-by-environment beat).

### Downstream behavior (locked)

| Consumer | Change |
| --- | --- |
| **`decisionFocus`** ([`serializeStagedObjectsForCandidatePrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/serializeStagedObjectsForCandidatePrompt.ts)) | Props with **only** Scene Dressing fits (no non-Scene-Dressing causal fits) are **strong expander** signal --- archetype without constraining causal slot. Props with **both** Scene Dressing and causal fits supply archetype hint **and** functional placement. |
| **Candidate gen** ([`buildCandidatePrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/buildCandidatePrompt.ts)) | Treat a cluster of Scene Dressing items with **matching or compatible** narrowings as evidence of a **plan archetype spine**, even when those items lack strong causal affinities. |
| **Plan select** | **No prompt/rubric changes required** --- Scene Dressing members appear in **`tropeAssignments`** / **`outliers`** like other tropes; existing rubric suffices. |
| **Narrative beats / outcome** | Plumbing only unless handoff testing shows gaps; no special materialization rules. |

## Background (current pipeline)

### Acme Order Enrich (upstream)

When a player issues an Acme order, **`parseCommand`** runs **`enrichAcmeOrder`** for **`AcmeOrderIntent`**. Bedrock prompt: [`buildPrompt.ts`](../../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/buildPrompt.ts). Types/normalize: [`coyotePlanAffinities.ts`](../../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts).

Valid lines emit **`tropeAffinities`** (1-3 fits). Published **`Acme Order`** persists to **`Meta::Room.objects`**; Coyote snapshots expose affinities to hypothesis hops ([`coyoteRoomObjectSnapshot.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot.ts)).

### Hypothesis pipeline (downstream)

**`Objects Changed`** -> **`candidates`** -> **`planSelect`** -> **`narrativeBeats`**. Trope keys and render order use **`CANONICAL_TROPE_ORDER`** ([`coyotePhasePlan.ts`](../../../../../../packages/mtw-interfaces/ts/coyotePhasePlan.ts)). Target order: `Scene Dressing` -> `Contraption` -> `Bait` -> `Misdirection` -> `Disadvantage` -> `Finishing Move`.

### Related prior work

[`AGENT.tropeCenteredRefactor.planning.md`](AGENT.tropeCenteredRefactor.planning.md), [`AGENT.tuneLLMPipeline.planning.md`](AGENT.tuneLLMPipeline.planning.md) --- trope-first migration is done; this is a **narrow sixth-trope extension**.

## Scope and boundaries

### In scope

- **`CoyoteTrope`** + **`isCoyoteTrope`** + **`CANONICAL_TROPE_ORDER`** (**`Scene Dressing`** first).
- Acme enrich: allowlist, Scene Dressing vocabulary block, causal-only POV rule, no affordance arrays on Scene Dressing.
- **`decisionFocus`** expander logic for Scene-Dressing-only and mixed props (deterministic, tested).
- Candidate prompt: Scene Dressing vocabulary + clustering guidance for compatible narrowings.
- Parse/combine/plan-select/narrative **plumbing** (sixth trope key in allowlists and iteration order).
- Harness fixture for skateboard + helmet + goggles (or equivalent) proving chase-spine clustering.

### Out of scope (unless plan is updated)

- Plan-select rubric / Finishing Move guarantee changes (handoff: none required).
- Client UI.
- Broad LLM tuning pass (optional follow-on in [`AGENT.tuneLLMPipeline.planning.md`](AGENT.tuneLLMPipeline.planning.md)).

### Contract lock (SS0)

| Topic | Decision |
| --- | --- |
| **`CANONICAL_TROPE_ORDER`** | **`Scene Dressing`** first, then existing five tropes unchanged. |
| **Phase-plan `tropeSequence`** | Include **`Scene Dressing`** in order like other tropes (evaluate in practice during SS5). |
| **Plan-select `schemaVersion`** | **No bump** --- remain **4**; shape stays trope-keyed object. |

## Open questions

Mark `[X]` when decided in code/docs.

- [X] **Wire literal:** **`Scene Dressing`** (exact string, title case, space).
- [X] **Semantic definition:** non-functional narrative association; categorical **`narrowing`**; archetype at cluster time not enrich time.
- [X] **Enrich POV / affordances:** POV for causal tropes only; no **`environmentAffordances`** / **`affordancesProvided`** on Scene Dressing.
- [X] **Plan-select:** no dedicated changes.
- [X] **`decisionFocus`:** Scene-Dressing-only -> expander; mixed -> expander + causal hints (see table above).
- [X] **Candidate gen:** cluster compatible Scene Dressing narrowings for archetype spine.
- [X] **`CANONICAL_TROPE_ORDER` position:** **`Scene Dressing`** first (before **`Contraption`**).
- [X] **Phase-plan / outcome:** include Scene Dressing in **`tropeSequence`** like other tropes.
- [X] **Plan-select `schemaVersion`:** no bump (stay **4**).

## Anchor points (touchpoint inventory)

| Layer | Primary files |
| --- | --- |
| **Types / order** | [`coyotePlanAffinities.ts`](../../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts), [`coyotePhasePlan.ts`](../../../../../../packages/mtw-interfaces/ts/coyotePhasePlan.ts) |
| **Acme enrich** | [`buildPrompt.ts`](../../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/buildPrompt.ts), [`interpretAndFinalize.ts`](../../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/interpretAndFinalize.ts) |
| **`decisionFocus`** | [`serializeStagedObjectsForCandidatePrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/serializeStagedObjectsForCandidatePrompt.ts), [`.test.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/serializeStagedObjectsForCandidatePrompt.test.ts) |
| **Hypothesis candidates** | [`buildCandidatePrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/buildCandidatePrompt.ts), [`parseCandidateOutput.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/parseCandidateOutput.ts), [`combineCandidateOutput.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/combineCandidateOutput.ts) |
| **Plan select / narrative** | [`buildPlanSelectPrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.ts) (allowlist strings only), [`buildNarrativeBeatPrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts) |
| **Harness** | [`coyoteEngineTestFixtures.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts), [`acmeOrderAffinitiesHarnessPhrases.ts`](../../../../../../lambda/ephemera/dataSource/actions/acmeOrderAffinitiesHarnessPhrases.ts) |

## Getting started

1. [`taskPlanning/AGENT.md`](../../../../AGENT.md) --- task-plan conventions.
2. This file **Semantics** and **Locked decisions**.
3. Current five-trope doc: [`AGENT.tropes.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md).
4. Hypothesis pipeline: [`generators/pipelines/hypothesis/AGENT.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md).
5. Read **`decisionFocus`** implementation: [`serializeStagedObjectsForCandidatePrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/serializeStagedObjectsForCandidatePrompt.ts).
6. Testing: [`lambda/ephemera/AGENT.testing.md`](../../../../../../lambda/ephemera/AGENT.testing.md).

Baseline:

```bash
cd packages/mtw-interfaces && npm run test -- --watchAll=false ts/coyotePlanAffinities.test.ts
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/serializeStagedObjectsForCandidatePrompt.test.ts
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/actions/enrich/acmeOrder/index.test.ts
```

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] Phase SS0 - design handoff and contract lock
  - [X] Receive Scene Dressing semantics (else-chat handoff recorded in **Semantics** above).
  - [X] Lock enrich prompt copy, narrowing grain, POV/affordance rules, downstream **`decisionFocus`** / candidate-gen / plan-select scope.
  - [X] Lock **`CANONICAL_TROPE_ORDER`:** **`Scene Dressing`** first, before **`Contraption`**.
  - [X] Lock phase-plan: include Scene Dressing in **`tropeSequence`** like other tropes.
  - [X] Lock plan-select **`schemaVersion`:** no bump (stay **4**).

- [ ] Phase SS1 - types and canonical order (`mtw-interfaces`)
  - [ ] Add **`Scene Dressing`** to **`CoyoteTrope`** and **`isCoyoteTrope`**.
  - [ ] Set **`CANONICAL_TROPE_ORDER`** to `Scene Dressing` -> `Contraption` -> `Bait` -> `Misdirection` -> `Disadvantage` -> `Finishing Move`.
  - [ ] Extend role allowlists on **`EnvironmentAffordanceRef`** / **`AffordanceProvidedRef`** only if causal tropes still need them (Scene Dressing should not appear in **`roles`** arrays per handoff).
  - [ ] Update **`coyotePhasePlan`** tests for six-trope **`tropeSequence`** ordering.

- [ ] Phase SS2 - Acme Order Enrich
  - [ ] Add Scene Dressing vocabulary block (locked copy in **Semantics**).
  - [ ] Reframe **`narrowing` POV rule** to causal tropes only.
  - [ ] Discourage **`environmentAffordances`** / **`affordancesProvided`** on Scene Dressing rows in prompt.
  - [ ] Add harness phrase(s): skateboard + helmet + goggles (expect Scene Dressing on gear, causal fit on board).
  - [ ] Tests: **`coyotePlanAffinities.test.ts`**, **`enrich/acmeOrder/index.test.ts`**.

- [ ] Phase SS3 - persistence and snapshots
  - [ ] Bus/object validation accepts Scene Dressing on **`tropeAffinities`**.
  - [ ] **`formatCoyoteObjectAffinitySuffix`** renders six-trope lines unchanged (no special casing required unless UX copy desired later).

- [ ] Phase SS4 - hypothesis pipeline (meaningful work)
  - [ ] **`decisionFocus`:** Scene-Dressing-only props -> **`expanderStableKeys`**; document mixed-prop behavior in tests.
  - [ ] **`buildCandidatePrompt`:** Scene Dressing vocabulary + cluster-by-compatible-narrowing guidance; few-shot optional.
  - [ ] Parse/combine/plan-select/narrative: sixth key in trope allowlists and **`TROPE_ORDER`** iteration (mechanical).
  - [ ] **Plan select:** verify allowlist strings only; no rubric edits per handoff.
  - [ ] Fixture: dressing cluster -> chase archetype candidate (not three thin single-prop rows).

- [ ] Phase SS5 - phase-plan and outcome
  - [ ] **`validateCoyotePhasePlan`:** six-trope **`tropeSequence`** including Scene Dressing at index 0 when present.
  - [ ] Outcome formatters: six-trope order labels when present in intent.

- [ ] Phase SS6 - conceptual docs and closeout
  - [ ] **`AGENT.tropes.md`:** sixth trope section (associative vs causal registers); update sequence combinatorics count.
  - [ ] **`AGENT.tropes.implementation.md`:** Scene Dressing narrowing grain (categorical not scenario).
  - [ ] Hypothesis **`AGENT.md`:** six tropes in rubric pointer.
  - [ ] Verification + archive plan per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Verification

**Interfaces (`packages/mtw-interfaces/`):**

```bash
npm run test -- --watchAll=false ts/coyotePlanAffinities.test.ts
npm run test -- --watchAll=false ts/coyotePhasePlan.test.ts
```

**Acme + decisionFocus + candidates (`lambda/ephemera/`):**

```bash
npm run test -- --watchAll=false dataSource/actions/enrich/acmeOrder/index.test.ts
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/serializeStagedObjectsForCandidatePrompt.test.ts
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/parseCandidateOutput.test.ts
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/buildCandidatePrompt.test.ts
```

**Harness (after fixture):**

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/generators/testHarness/runCoyoteEngineTestHarness.test.ts
```

## Progress

| Milestone | Status |
| --- | --- |
| SS0 Design handoff | Complete |
| SS1 Types / canonical order | Not started |
| SS2 Acme enrich | Not started |
| SS3 Persistence / snapshots | Not started |
| SS4 Hypothesis pipeline | Not started |
| SS5 Phase-plan / outcome | Not started |
| SS6 Docs / closeout | Not started |

## Locked decisions

- **Wire literal:** `Scene Dressing`.
- **Role:** non-functional narrative association; not a causal beat mechanism.
- **`narrowing`:** aesthetic/material **category** only; archetype/scenario names deferred to candidate gen clustering.
- **Enrich prompt:** use locked vocabulary bullet in **Semantics**; causal-only POV rule; no affordance arrays on Scene Dressing.
- **`decisionFocus`:** Scene-Dressing-only -> strong **expander**; mixed Scene Dressing + causal -> expander plus functional placement signal.
- **Candidate gen:** compatible Scene Dressing narrowings across props -> archetype spine evidence.
- **Plan select:** no dedicated prompt/rubric/materialization changes; **`schemaVersion`** stays **4**.
- **`CANONICAL_TROPE_ORDER`:** `Scene Dressing` -> `Contraption` -> `Bait` -> `Misdirection` -> `Disadvantage` -> `Finishing Move`.
- **Phase-plan `tropeSequence`:** include Scene Dressing as a beat when the selected plan uses it (same rules as other tropes).
