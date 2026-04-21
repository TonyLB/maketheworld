# Coyote hypothesis: phase sequencing and structured plan-phase

**Status:** In progress -- **Option A is locked** (two Bedrock hops after combine). End-to-end wiring for prompts, parsers, and **`phasePlan`** validation has shipped (**Recommended order** line **281**). Next actionable steps: **intent row + harness polish** (**line 282**), token tuning from **`runCoyoteEngineTestHarness`** metrics, then durable **`AGENT.md`**. **Out of scope for this task plan:** data-driven migration toward **Option B** or **Option C** (see **Pipeline topology** below and **Recommended order**).

Skim **[`taskPlanning/AGENT.md`](../../../AGENT.md)** once before editing this file so task-vs-durable doc split, checkbox conventions, and retirement expectations stay clear. **Canonical path:** this document (`AGENT.phaseSequencing.plan.md`) is the only task-plan file for this initiative.

## Purpose

Explore splitting **Coyote hypothesis plan-phase** work beyond today's single **Stage Two** pass: move from one long assistant message (`## Scene analysis` + fenced `Hypothesis:` line; see [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)) toward a **structured** chain that can include:

- Short scene grounding
- A **small menu** of competing high-level plans
- Explicit comparison (rubric) and **selection**
- A **canonical phase plan** (machine-checkable against staged objects and clustering)
- A **player-facing** prose walkthrough aligned to that phase plan
- **Persistence** of structured artifacts for a later prompt that narrates **execution** (comedic outcome), without inventing a second incompatible plan

When contracts stabilize, migrate steady-state documentation into [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) and [`lambda/ephemera/llm/pipeline/AGENT.md`](../../../../../lambda/ephemera/llm/pipeline/AGENT.md), then **remove or archive** this plan per [`taskPlanning/AGENT.md`](../../../AGENT.md) **When the task finishes**.

## Progress

| Area | State |
| --- | --- |
| Step grouping (A / B / C) | **Decided:** **Option A** only for this initiative. **Out of scope:** revisiting **Option B** or **Option C** based on harness metrics -- handle in a separate task plan if needed |
| Handoff (hop 1 to hop 2) | **Decided:** no `selectedPlanId`; **fenced JSON** for **paragraph summary** + **rubric issues** (**Decided: hop 1 handoff serialization**). **Locked in code:** [`coyoteHop1Handoff.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteHop1Handoff.ts) + [`markdownCodeFences.ts`](../../../../../lambda/ephemera/llm/markdownCodeFences.ts) — **`CoyoteHop1Handoff`**, last **` ```json `** fence, keys **`paragraphSummary`** / **`rubricIssues`**. **Still open:** optional full rubric for harness/debug |
| Phase-plan JSON schema + validators | **Decided:** stable refs + **approved v1 document shape** + **virtual grounding** via reserved **`SETTING`** (**Decided: reserved stable key SETTING (virtual grounding)**) + **outliers guidance / guardrails** (**Decided: outliers in clustering vs phase plan**). **Encoded:** [`coyotePhasePlan.ts`](../../../../../packages/mtw-interfaces/ts/coyotePhasePlan.ts) (`validateCoyotePhasePlan`, **`SETTING`** placement, snapshot / topology rules, optional caps); tests [`coyotePhasePlan.test.ts`](../../../../../packages/mtw-interfaces/ts/coyotePhasePlan.test.ts). **Hop 2 wired:** [`parseHypothesisPhasePlanHopOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts) + [`buildCoyotePhasePlanValidationContext`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteHypothesisPhasePlanContext.ts) + [`coyoteHypothesisPipeline.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteHypothesisPipeline.ts) |
| Rubric representation | **Decided:** automation / hop 2 grounding; **three dimensions**; **criterion-first matrix then selection** (**Decided: rubric prompting pattern**); **Road Runner canon / safety outside hop 1 rubric** (**Decided: Road Runner outcome-only (not in rubric)**); **first implementation:** **equal weight** across dimensions (**Decided: rubric aggregation (first implementation)**) |
| Persistence + harness diagnostics | **Decided:** durable **nested `phasePlan`**, **`walkthrough`** separate from **`intent`**; **no** **`sceneAnalysis`** on the persisted intent row (**Decided: intent record shape**); harness extensions (**Decided: Coyote engine harness**). **Partial:** [`CoyoteGameIntentRecord`](../../../../../lambda/ephemera/internalCache/coyoteGame.ts) carries **`phasePlan`** / **`walkthrough`** + Dynamo **`putItem`**; harness publishes **`usagePlanSelection`** / **`usagePhasePlanHop`** ([`runCoyoteEngineTestHarness`](../../../../../lambda/ephemera/dataSource/coyoteGame/runCoyoteEngineTestHarness.ts)); pipeline exposes **`selectionBody`** / **`phasePlanJson`** on **`GenerateHypothesisPipelineResult`**. **Open:** drop **`sceneAnalysis`** from durable projection only; concat **`selectionBody`** / **`phasePlanJson`** into harness output (**line 282**) |
| Implementation + durable `AGENT.md` updates | Option A pipeline shipped; **`AGENT.md`** migration **open** (**line 283**) |

## Getting Started

Follow the **[Getting Started pattern for complex tasks](../../../../../AGENT.md#getting-started-pattern-for-complex-tasks)** in root [`AGENT.md`](../../../../../AGENT.md): foundations, this document, integration points, code reference, testing, next task.

1. **Understand project foundations**
   - **Why**: Task plans are process-only; steady-state behavior belongs in code-adjacent `AGENT.md`.
   - **Read**: **[`taskPlanning/AGENT.md`](../../../AGENT.md)** (durability ladder, checkbox rules, verification). Root [`AGENT.md`](../../../../../AGENT.md) if you need repo-wide doc conventions.

2. **Read this document**
   - **Why**: Unknowns evolve; **Progress**, **Recommended order**, and **Verification** are the quick status surfaces. **Pipeline topology is fixed** at Option A for this initiative (Option B/C are reference-only here).
   - **Focus**: **Purpose**, **Candidate groupings** (Option A committed; B/C optional skim), **Unknowns**, **Material decisions to confirm early**.

3. **Understand core integration points**
   - **Why**: Phase sequencing extends the hypothesis path after clustering combine, not Stage One clustering.
   - **Primary files**: [`coyoteHypothesisPipeline.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteHypothesisPipeline.ts), [`generateHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.ts), [`invokeBedrockHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.ts); runner patterns in [`lambda/ephemera/llm/pipeline/AGENT.md`](../../../../../lambda/ephemera/llm/pipeline/AGENT.md).
   - **Product contract**: [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) (Stage Two body, clustering vs plan-phase, caching, timeouts).

4. **Review implemented code**
   - **Why**: New steps are additional `defineLlmStep` / orchestration segments on the same pipeline pattern.
   - **Focus**: Stage Two prompt assembly [`buildHypothesisStageTwoPrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts), parse [`parseHypothesisModelOutput.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts), combine [`combineHypothesisClusters.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/combineHypothesisClusters.ts).

5. **Check testing patterns**
   - **Why**: Ephemera uses Jest from `lambda/ephemera`.
   - **Commands**: See **Verification** (build + targeted Jest). Add `AGENT.development.md` under `taskPlanning/lambda/ephemera/` later if this subtree gains non-obvious tooling notes; until then use **Verification** as the source of truth.

6. **Identify next task**
   - **Why**: Ordered work lives in **Recommended order** below.
   - **Focus**: First unchecked line; update checkboxes when a slice ships.

7. **Run tests before starting implementation**
   - **Why**: Establish baseline before edits.
   - **Commands**: **Verification** section.

## Relationship to current pipeline

Today (steady state):

1. **Stage One** -- clustering seam (which staged objects belong together); validated and combined into **combined clustering Markdown**.
2. **Orchestration** -- parse seam, [`combineHypothesisClusters`](../../../../../lambda/ephemera/dataSource/coyoteGame/combineHypothesisClusters.ts), [`renderCombinedHypothesisForStageTwo`](../../../../../lambda/ephemera/dataSource/coyoteGame/combineHypothesisClusters.ts).
3. **Stage Two** -- single LLM call: interpretation, topology, temporal ordering (prep vs creation), virtual scenery rules, **`## Scene analysis`** + final fenced **`Hypothesis:`** line; [`parseHypothesisModelOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts).

Hypothesis wiring uses the linear runner in [`coyoteHypothesisPipeline.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteHypothesisPipeline.ts).

**Design boundary (unchanged intent):** Stage One remains **clustering**, not beat sequencing; **plan-phase** responsibilities stay downstream of the seam ([`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) **Clustering and combine**).

## Candidate groupings of LLM steps

**Pipeline topology for this initiative:** **Option A** is **locked** (two hops after combine). **Option B** and **Option C** remain documented below as **reference context** only; pursuing or comparing them is **out of scope** for this task plan.

### Option A -- Two LLM hops after combine (committed)

| Hop | Contents (idea) |
| --- | --- |
| **Plan selection** | Brief scene analysis + exactly **N** one-line plan sketches + **criterion-first rubric matrix** (coverage / completeness / coherence) + **explicit selection** of one plan (**Decided: rubric prompting pattern**). No persisted candidate list outside this pipeline. **Handoff to hop 2:** after matrix + selection, a **fenced `json`** block carrying **paragraph summary** + **rubric issues** (**Decided: hop 1 handoff serialization**) -- same semantic content as **Decided: handoff (hop 1 to hop 2)**. |
| **Phase plan + surface** | Input: combined clustering Markdown + topology mapping + hop-1 **paragraph summary** + **rubric issues** (not the full rubric table unless we deliberately carry it). Output: trailing fenced **json** (**phasePlan**) then **`## Scene analysis`** (optional trim) + fenced **`Hypothesis:`** line **or** Hypothesis-only if scene analysis moves entirely into hop 1. |

**Pros:** Matches "suggest + grade + pick" then "commit structure + player text". **Cons:** Hop 2 must not drift from hop 1; validate **phasePlan** against snapshot and clusters.

### Option B -- Three LLM hops after combine (reference only; out of scope)

| Hop | Contents (idea) |
| --- | --- |
| **Alternatives + rubric** | Scene analysis (short) + three plan titles + **criterion-first matrix** + **selection** (same pattern as **Decided: rubric prompting pattern**). |
| **Phase plan JSON only** | Input: combined clustering + **picked plan summary**. Output: **only** fenced **json** (phase plan schema). Easier to validate and repair. |
| **Walkthrough / Hypothesis** | Input: validated **phasePlan** JSON + clustering (read-only). Output: player **`## Scene analysis`** (may be abbreviated if hop 1 already grounded) + fenced **`Hypothesis:`**. |

**Pros:** Strong separation of **machine contract** (JSON) from **prose**; smaller prompts per step. **Cons:** Latency, cost, more failure points (unless stub policy stays all-or-nothing).

### Option C -- One megaprompt with multiple fenced tails (reference only; out of scope)

Single call requesting Markdown + **json** phase plan + **text** Hypothesis fence (multiple trailing fences in one assistant message).

**Pros:** One Bedrock invocation. **Cons:** Harder validation, higher inconsistency risk between sections; parsing story is more fragile than dedicated steps.

### Pipeline topology (locked for this task plan)

**Option A** is the **committed** shape: two Bedrock hops after combine. Hop 2 emits **fenced multi-artifact** output (for example trailing **json** for **phasePlan** plus **`## Scene analysis`** and the final **`Hypothesis:`** ` ```text ` fence). Harness runs still inform **parser hardening**, **prompt tightening**, and **per-hop token budgets** -- not a fork to a different topology.

**Out of scope:** using metrics to justify **Option B** (extra hop isolating phase-plan JSON) or **Option C** (single megaprompt). Document outcomes in **`AGENT.md`** or a **future** task plan if revisiting cost/latency tradeoffs later.

## Decided: handoff (hop 1 to hop 2)

These choices are **set for Option A** unless implementation proves otherwise:

- **No `selectedPlanId`** when candidate plans are **not** persisted outside the pipeline prompt -- the winning plan is implicit once hop 1 commits.
- **Do pass forward to hop 2:** (1) a **paragraph summary** of the chosen plan, and (2) **issues surfaced by the rubric** -- e.g. staged objects that still lack a clear role in that plan, or missing goals/pieces that require **synthesis** or **scavenging** from staged props and topology.

## Decided: hop 1 handoff serialization

- Hop 1 ends with a **fenced JSON** payload (after rubric matrix + selection) that carries **paragraph summary** and **rubric issues** for hop 2 parsing.
- **Canonical contract (code):** [`coyoteHop1Handoff.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteHop1Handoff.ts) — fence language **`json`** (parser uses the **last** **` ```json `** block; fence enumeration [`markdownCodeFences.ts`](../../../../../lambda/ephemera/llm/markdownCodeFences.ts) **`findAllFenceBlocks`**); required keys **`paragraphSummary`** (string) and **`rubricIssues`** (string array only); **`parseHop1HandoffFromSelectionBody`** for parsing hop-1 **`selectionBody`** when wired.

## Decided: phase-plan schema evolution

We **do not** need a migration story or backward compatibility guarantees for successive JSON shapes **in development**: execution prompts are cleared often, and rolling out a breaking phase-plan schema can pair with **wiping the single extant development database** when required. Prefer a **clean cut** over maintaining legacy readers. Reserve optional **`schemaVersion`** only if production persistence later demands it (not assumed here).

## Decided: stable references (phase-plan JSON)

**Locked.** Each phase-plan phase must reference staged objects by **`stableKey`**, and room placement must use labels **consistent with** [`coyoteSeamRoomMappingLines`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteHypothesisPromptShared.ts) / seam room conventions -- **not** free-text names only. Validators should reject unknown keys and **stableKeys** absent from the staged **snapshot** for that run, **except** the reserved virtual-grounding token **`SETTING`** where **Decided: reserved stable key SETTING (virtual grounding)** allows it. (Do **not** treat **`SETTING`** as a real staged object in **`stableKeysUsed`**. **Decided: outliers in clustering vs phase plan** covers how real snapshot keys that are clustering outliers may appear in **`phasePlan`**.)

## Decided: phase-plan document shape (v1 approved)

**Approved v1** for the nested **`phasePlan`** object (and for hop 2 fenced JSON before prose fences):

- **`phases`**: ordered array.
- Per phase: **`stableKeysUsed`**, **`virtualEntities`** (each with **`label`**, **`derivedFrom`** stableKeys or topology refs -- **virtual** **`derivedFrom`** stable-key list **may include** reserved **`SETTING`** per **Decided: reserved stable key SETTING (virtual grounding)** -- **`phaseKind`**: gathered | synthesized | deployed), **`achievement`** (what becomes true after this phase).
- Optional per phase: **`prepVsBeat`** tagging to align with **prep** / **creation** semantics ([`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)).

**Validators (required behavior, implement in code):** reject unknown keys; reject **stableKeys** not present in the staged snapshot for that run (**except** reserved **`SETTING`** only where **Decided: reserved stable key SETTING (virtual grounding)** permits); reject **`SETTING`** in **`stableKeysUsed`** or anywhere it would stand in for a real staged row; apply **Decided: outliers in clustering vs phase plan** for how outlier keys participate in **`phasePlan`** (do **not** treat outlier **`stableKey`**s as invalid merely because they appear under **`## Outliers`**). Virtual / execution policy vs cached plan: **Decided: execution virtual props**.

## Decided: outliers in clustering vs phase plan (guidance + guardrails)

**What an outlier is:** Stage One assigns each staged **`stableKey`** to **either** a named **`###` cluster** (shared thematic / functional maneuver grouping) **or** the **`## Outliers`** list when it does **not** sit in any such group ([`combineHypothesisClusters`](../../../../../lambda/ephemera/dataSource/coyoteGame/combineHypothesisClusters.ts), [`AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) **Clustering and combine**). Outliers are **not** "non-participants" in the cartoon plan -- they are normal staged objects whose **clustering** placement is "with nothing else" for Stage One purposes.

**Prompting (hop 2 / rubric / prose):** Treat **`## Combined clustering`** and **`## Outliers`** as **ground truth for grouping**: do **not** describe or imply that an object listed only under **`## Outliers`** belongs **inside** a named **`###` cluster** it was not assigned to. **Do** allow outliers to matter in the maneuver, appear in **`stableKeysUsed`**, and interact with clustered props when topology and roles support it -- same as any other snapshot key. Instructions should avoid language that frames outliers as **forbidden** or **second-class** for planning; the distinction is **membership in Stage One clusters**, not eligibility for beats.

**Validators:** **`phasePlan`** validation is keyed off the **staged snapshot** (plus **`SETTING`** rules). If a **`stableKey`** is on the snapshot, it is **eligible** to appear in **`stableKeysUsed`** **regardless** of whether Stage One listed it under **`## Outliers`**. Do **not** add rules that reject plans solely because they reference outlier keys. If a future schema adds **explicit cluster membership** per object, validators may then flag **contradictions** between that structure and combined clustering; **v1** does not require inventing such fields for outlier checking.

**Thought experiment (not adopted):** Representing outliers as a **reserved-name cluster** (single partition shape, every object under some **`###`**) was discussed as a way to reduce **register shift** between cluster lists and **`## Outliers`**. **Decision:** do **not** implement unless harness or product evidence later shows clear upside -- the **cons** (models over-generalizing **cluster** as **shared maneuver**) are plausible, and **pros** did not justify a Stage One / combine seam change **here**.

## Decided: reserved stable key SETTING (virtual grounding)

**Instead of** an open-ended **`inferredFromPlan`** escape hatch (anything the narrative might imply), **v1** uses a **single reserved stable-key-shaped token:**

- The reserved literal **`SETTING`** (normalized **`stableKey`** spelling: **`setting`**, per **`stableKey`** charset in [`coyotePlanAffinities.ts`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)) is legal **only** when grounding **`virtualEntities`** in **`derivedFrom`** (alongside real **`stableKey`**s from the snapshot and topology cues as needed). It denotes **cartoon-setting stock affordances** not represented by a specific staged row -- for example desert **boulders**, **cactus**, generic **Acme** labeling / crate texture, and similar world furniture the player expects in-frame even when not listed as staged props.

**Semantics:** **`setting`** / **`SETTING`** (same token) means *grounded in the shared setting read*, not *free invention*. Specificity stays in **`label`** (and **`phaseKind`**).

**Execution:** Still **Decided: execution virtual props** -- execution must not introduce virtuals absent from **`phasePlan`**; this token does not loosen that rule; it only constrains **how** a listed virtual may cite grounds when no snapshot key applies.

**Code (interfaces + collision prevention):** Canonical constant **`COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY`** (`'setting'`) lives in [`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts). Acme deterministic **`stableKey`** finalization must **not** assign that key to staged catalog lines: [`finalizeStableKeysDeterministic`](../../../../../lambda/ephemera/dataSource/actions/finalizeStableKeysDeterministic.ts) remaps a proposal of **`setting`** to **`acme-setting`** so **`Meta::Room.objects`** never collides with the phase-plan reserved token (see tests in [`finalizeStableKeysDeterministic.test.ts`](../../../../../lambda/ephemera/dataSource/actions/finalizeStableKeysDeterministic.test.ts)).

**Implementation (optional knobs, not redesign):** per-phase or per-plan **caps** on virtuals whose **only** stable-key ground is **`setting`**, or stricter rules for **`synthesized`** vs **`gathered`**, can be tuned in code without changing this decision.

## Decided: durable persistence vs harness

- **`## Scene analysis`:** **Not** persisted on **[`CoyoteGameIntentRecord`](../../../../../lambda/ephemera/internalCache/coyoteGame.ts)** (**Decided: intent record shape**). Hop 2 may still emit it for immediate UX; the **engine harness** retains / surfaces it for evaluation alongside **`selectionBody`** / **`phasePlanJson`** (**Decided: Coyote engine harness**).
- **Phase plan** (nested structured object matching **Decided: phase-plan document shape**) **and** **`walkthrough`** (separate field) **and** durable **`intent`** (the **`Hypothesis:`** line contract) are **saved** for downstream prompts (execution comedy, alignment with [`generatePlanOutcome`](../../../../../lambda/ephemera/dataSource/coyoteGame/generatePlanOutcome.ts)), consistent with **Purpose** above.

## Decided: intent record shape (`CoyoteGameIntentRecord`)

- **`phasePlan`:** nested object types matching the approved phase-plan document shape (not an opaque string blob on the wire to Dynamo if the row uses map types; TypeScript models should mirror the schema).
- **`walkthrough`:** its **own** field, separate from **`intent`** (Hypothesis line) and from **`phasePlan`**.
- **`sceneAnalysis`:** **removed** from durable persistence on this record (no optional carry-over for rendering); treat hop 2 scene analysis as **transient + harness-only** unless a later product decision revives it.
- **`intent`:** continues to mean the durable player **Hypothesis** line per existing parsing contract unless renamed during implementation.

## Decided: execution virtual props

**For now:** execution (and outcome) prompts **must not** introduce **new** virtual props that are **absent** from the **cached phase plan**. Revisit if that proves **too tight** for humor; until then validators and prompts should assume **closed-world** virtuals relative to persisted **`phasePlan`**.

## Decided: structured validation failure

On phase-plan (or related structured) validation failure, **prefer degraded prose** when hop output still yields usable player text (e.g. **`Hypothesis:`** and/or **walkthrough**) even without a valid **`phasePlan`**. This is **not** stub-only-or-nothing: persisted records may exist **with** or **without** a valid nested **`phasePlan`**. **Execution and outcome codepaths** must branch on presence and validity of **`phasePlan`** (and any partial fields) rather than assuming a single happy-path shape -- document that contract in durable **`AGENT.md`** when behavior ships.

## Decided: rubric automation and hop 2 grounding

**Locked.**

- Hop 1 **selects** exactly one candidate plan (via rubric scores, ranking, or equivalent); that choice **does not** need to surface as a **`selectedPlanId`** when nothing outside the pipeline indexes candidate rows by id (**Decided: handoff (hop 1 to hop 2)** above).
- Hop 2 is **grounded** on hop 1's **paragraph summary** + **rubric issues**, not on opaque labels carried from hop 1.
- **phasePlan** JSON validation is **against combined clustering + staged snapshot** (**Decided: stable references (phase-plan JSON)** above); it does **not** depend on matching plan sketch ordinals or display names.

## Decided: rubric dimensions (initial set)

**Start with three dimensions only:**

- **coverage** -- how much each staged prop / affordance can **contribute** to the plan.
- **completeness** -- how much everything **needed** by the plan is already present or **constructable** from staged props and topology (including synthesis / scavenging implied by the plan).
- **coherence** -- how well implied actions **reinforce** each other toward one maneuver.

**Evolution:** Add further rubric dimensions **only** if probes show output that is weak in some **discernible** way that an extra axis would address; do not expand the rubric preemptively.

## Decided: rubric aggregation (first implementation)

**Locked for v1.** Hop 1 prompts must **not** emphasize one rubric dimension over the others when moving from matrix to winner: treat **coverage**, **completeness**, and **coherence** as **equally important** (no numeric weights, no prompt language that ranks axes). Selection stays the holistic **comparison then explicit winner** flow (**Decided: rubric prompting pattern (hop 1)**).

**Later (optional):** uneven weights or tie-break hierarchy only if harness shows a **discernible** bias worth correcting.

## Decided: Road Runner outcome-only (not in rubric)

**Locked for Option A.** **Road Runner** inviolability and **setback-on-the-Coyote** canon --- the hard constraints in [`buildPlanOutcomePrompt`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildPlanOutcomePrompt.ts) (**plan outcome**) --- stay **only** on the **outcome** path. **Do not** add a rubric column, tie-breaker, or implicit preference in hop 1 for plans where the Road Runner is **safer** or the trap **less villainously effective on paper**: player intent pulls toward elaborate Coyote schemes; hop 1 should compare sketches on **coverage**, **completeness**, and **coherence** only (**Decided: rubric dimensions**). Resolving canon in the player's favor is **plan outcome**'s job: take a well-thought-out antagonist plan and narrate how it **foils itself** in execution while respecting outcome prompts.

Hypothesis-stage tone rules (earnest **`Hypothesis:`**, no preview of failure comedy) remain separate prompt guidance --- not a fourth rubric axis.

## Decided: rubric prompting pattern (hop 1)

**Locked.** Hop 1 evaluates candidates with a **two-phase** assistant shape (still one LLM call unless we split later):

1. **Criterion-first matrix** -- One row per candidate plan sketch, one column per rubric dimension (**coverage**, **completeness**, **coherence** from **Decided: rubric dimensions**). Each cell holds **short, evidence-grounded prose** (reference **`stableKey`** / cluster membership where relevant), not opaque letter grades -- the grid is for **comparison**, not calibrated A--F blobs. When comparing rows to pick a winner, treat the three dimensions as **equally important** (**Decided: rubric aggregation (first implementation)**).
2. **Selection second** -- After the matrix is complete: **either** a strict **ordinal rank** (1 = best, **no ties** unless the prompt defines a tie-break procedure) **or** a single **`chosenPlanIndex`** / explicit **winner label** matching the rows, plus **one sentence** naming the decisive dimension if the race was close.

Symbolic scores (letters, 1--5, etc.) are **optional** inside cells only if anchors help the model; the **canonical** discriminant is **structured comparison then an explicit winner**, which aligns reliably with LLM behavior.

After selection, emit handoff as **fenced JSON** (**Decided: hop 1 handoff serialization**) with **paragraph summary** + **rubric issues** (**Decided: handoff**) reflecting the **chosen** plan only.

## Decided: Coyote engine harness (extended diagnostics)

**Locked.**

- **[`runCoyoteEngineTestHarness`](../../../../../lambda/ephemera/dataSource/coyoteGame/runCoyoteEngineTestHarness.ts)** **will be extended** to surface intermediate pipeline artifacts for tuning and regression comparison (hypothesis harness only), parallel to staged **`usageStage1`** / **`stageOneBody`** today.
- **Intermediate body names** agreed for the new hops (add more alongside if the pipeline grows): **`selectionBody`** -- hop 1 assistant output (matrix + selection + summary/issues handoff as emitted); **`phasePlanJson`** -- validated or raw **phase-plan JSON** produced in hop 2 **before** or alongside prose fences, as diagnostics require.
- Include **`## Scene analysis`** (hop 2) in harness-published evaluation output when useful for comparison; **not** on the durable intent row (**Decided: intent record shape**).
- Publication format (concat in one **`WorldOOCMessage`**, extra lines, JSON labels) remains an **implementation** detail; the **obligation** is that harness readers can inspect those artifacts without replaying Bedrock.

## Unknowns: handoff formats

Still to lock during implementation (prompt + parser detail):

- **Optional observability:** Whether hop 2 or the **engine harness** should ever attach the **full** rubric text for debugging or quality review (**unlikely** in production payloads).
- **Hop 1 handoff JSON:** **Locked** -- [`coyoteHop1Handoff.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteHop1Handoff.ts) (`CoyoteHop1Handoff`, `parseHop1HandoffFromSelectionBody`).
- **Final player contract:** Keep **`Hypothesis:`** inside a **final** ` ```text ` fence ([`parseHypothesisModelOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts)). Durable row fields: **Decided: intent record shape**; degraded persistence: **Decided: structured validation failure**.

## Unknowns: synthesized (virtual) objects

Coyote prompts already allow **virtual scenery** and prep-invented props with strict rules ([`buildHypothesisStageTwoPrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts) **Virtual scenery and prep-invented props**). **Grounding policy for phase-plan virtuals is decided:** reserved **`SETTING`** (**Decided: reserved stable key SETTING (virtual grounding)**) instead of **`inferredFromPlan`**. **Still open during implementation:** optional **caps** (e.g. max virtuals per phase with **only** **`SETTING`** as stable-key ground) and whether **`phaseKind`** affects strictness -- tune in validators without revisiting the **`SETTING`** decision. **Execution** inventing props off-plan: **Decided: execution virtual props** (**no** for now).

## Unknowns: rubric grading

**v1** rubric shape, dimensions, Road Runner scope, and **equal-weight** aggregation are **decided**; only **optional** future unequal weighting is open. Checklist for the task plan:

- **Evaluation shape:** **Decided** -- **criterion-first matrix**, then **selection** (**Decided: rubric prompting pattern (hop 1)** above).
- **Dimensions:** **Decided** -- see **Decided: rubric dimensions (initial set)** above.
- **Road Runner canon / safety in rubric:** **Decided** -- **outcome-only**; see **Decided: Road Runner outcome-only (not in rubric)**.
- **Automation / hop grounding:** **Decided** -- see **Decided: rubric automation and hop 2 grounding** above.
- **Aggregation:** **Decided** for first implementation -- **equal weight** across the three dimensions (**Decided: rubric aggregation (first implementation)**). Uneven weights remain a future tuning lever if needed.

## Other open questions

- **Persistence (implementation):** Wire [`CoyoteGameIntentRecord`](../../../../../lambda/ephemera/internalCache/coyoteGame.ts) + Dynamo projection to **Decided: intent record shape** (drop **`sceneAnalysis`** from the durable row); normalize / migrate any readers that assumed optional scene analysis on intent.
- **Lambda budget:** Extra sequential Bedrock calls vs [`EphemeraFunction` timeout](../../../../../template.yaml); tune [`BEDROCK_HYPOTHESIS_TIMEOUT_MS`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.ts) per hop.
- **Alignment with plan outcome:** [`AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) **Plan outcome consistency** -- when **`phasePlan`** is present and valid, execution and outcome prompts must not contradict it; when **`phasePlan`** is **missing** or invalid (**Decided: structured validation failure**), prompts must degrade gracefully and must not assume a full structured plan.

## Material decisions to confirm early

- **Per-invoke maxTokens:** Existing clustering seam keeps [`BEDROCK_HYPOTHESIS_STAGE_ONE_MAX_TOKENS`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.ts) (**512**). Each **new** Option A Bedrock hop defaults to [`BEDROCK_HYPOTHESIS_NEW_HOP_DEFAULT_MAX_TOKENS`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.ts) (**2048**) until harness data suggests otherwise.
- Number of candidate plan lines (**three** vs parameterized N).
- Within **Option A**, hop 2 keeps **phase-plan JSON** and player fences in **one** invoke (splitting hop 2 further is **Option B** -- out of scope here).
- Whether **`reasoningContent` / extended thinking** moves to a specific hop only ([`invokeBedrockConverseText`](../../../../../lambda/ephemera/llm/invokeBedrockConverseText.ts)).
- **Production-only (if needed):** whether persisted phase-plan JSON ever requires **`schemaVersion`** or dual readers -- **not** a dev priority given **Decided: phase-plan schema evolution**.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. This section has no nested checklist bullets; each line is a single actionable step.

**Dependency order:** lock hop-1 handoff **JSON** field names and fence tags, **`Hypothesis:`** fence contract, **`phasePlan`** types + virtual-entity validator rules (including **`SETTING`**; optional caps in code), and hop 1 **rubric** instructions (**equal-weight** dimensions per **Decided: rubric aggregation (first implementation)**; **Road Runner** canon **outcome-only** per **Decided: Road Runner outcome-only (not in rubric)**) at a **design + type level** before treating the Option A implementation line as build-complete.

- [X] Finalize hop-1 handoff **JSON property names** + fence tag; final **`Hypothesis:`** fence contract -- **encoded:** [`coyoteHop1Handoff.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteHop1Handoff.ts) (`CoyoteHop1Handoff`, `COYOTE_HOP1_HANDOFF_JSON_KEYS`, `parseHop1HandoffFromSelectionBody`); shared fences [`markdownCodeFences.ts`](../../../../../lambda/ephemera/llm/markdownCodeFences.ts); hop-2 multi-fence Hypothesis regression in [`parseHypothesisModelOutput.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.test.ts).
- [X] Encode **`phasePlan`** TypeScript types + validators (snapshot **`stableKey`** refs, **`SETTING`** rules per **Decided: reserved stable key SETTING (virtual grounding)**; outlier **`stableKey`** handling per **Decided: outliers in clustering vs phase plan**); optional **caps** / **`phaseKind`** strictness per **Unknowns: synthesized (virtual) objects** -- **encoded:** [`coyotePhasePlan.ts`](../../../../../packages/mtw-interfaces/ts/coyotePhasePlan.ts); [`coyotePhasePlan.test.ts`](../../../../../packages/mtw-interfaces/ts/coyotePhasePlan.test.ts).
- [X] **Road Runner** canon / safety **outside hop 1 rubric** (**Decided: Road Runner outcome-only (not in rubric)**) -- enforced on **plan outcome** only ([`buildPlanOutcomePrompt`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildPlanOutcomePrompt.ts)).
- [X] Rubric **aggregation:** **equal weight** across **coverage** / **completeness** / **coherence** for first implementation (**Decided: rubric aggregation (first implementation)**) -- matrix + selection pattern under **Decided: rubric prompting pattern (hop 1)** and **Decided: rubric dimensions (initial set)**.
- [X] Implement **Option A** end-to-end (prompts, hop-1 **fenced JSON** handoff parse, hop-2 multi-fence parse, **phasePlan** validation wired to the contracts above); tune token budget per hop from harness results (reliability metrics inform **tuning**, not a topology change -- **Option B/C** remain out of scope). **Encoded:** [`buildHypothesisPlanSelectionPromptParts.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisPlanSelectionPromptParts.ts); [`buildHypothesisPhasePlanHopPromptParts.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisPhasePlanHopPromptParts.ts); [`coyoteHypothesisPipeline.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteHypothesisPipeline.ts); [`invokeBedrockHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.ts) (**`BEDROCK_HYPOTHESIS_PLAN_SELECTION_MAX_TOKENS`**, **`BEDROCK_HYPOTHESIS_PHASE_PLAN_HOP_MAX_TOKENS`**); tuning: compare **`usagePlanSelection`** / **`usagePhasePlanHop`** after [`runCoyoteEngineTestHarness`](../../../../../lambda/ephemera/dataSource/coyoteGame/runCoyoteEngineTestHarness.ts).
- [ ] Wire **CoyoteGame** / [`CoyoteGameIntentRecord`](../../../../../lambda/ephemera/internalCache/coyoteGame.ts) to **Decided: intent record shape** (nested **`phasePlan`**, **`walkthrough`**, drop **`sceneAnalysis`**); persist per **Decided: structured validation failure** where applicable; implement **Decided: Coyote engine harness** (**`selectionBody`**, **`phasePlanJson`**, **Scene analysis** in evaluation output when useful).
- [ ] Update durable [`AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) when Option A behavior is stable.
- [ ] Delete or archive this task plan after the initiative completes.

## Verification

- Build/typecheck: from [`lambda/ephemera`](../../../../../lambda/ephemera), run `npm run build` after implementation.
- Tests: targeted Jest for coyote hypothesis pipeline and parsers, for example `npm run test -- --runInBand dataSource/coyoteGame/ llm/pipeline/` (adjust paths to match what you touched). Option A additions include **`buildHypothesisPlanSelectionPromptParts.test.ts`**, **`buildHypothesisPhasePlanHopPromptParts.test.ts`**, **`coyoteHypothesisPhasePlanContext.test.ts`** under **`dataSource/coyoteGame/`**.
- Manual or harness runs: compare hypothesis quality and **latency** before raising production timeouts.
