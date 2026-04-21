# Coyote hypothesis: phase sequencing and structured plan-phase

**Status:** In progress -- **Option A is locked** (two Bedrock hops after combine). Next actionable step is **implement Option A end-to-end** (fenced artifacts + parsers + validation) and tune token budgets from harness runs. **Out of scope for this task plan:** data-driven migration toward **Option B** or **Option C** (see **Pipeline topology** below and **Recommended order**).

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
| Handoff (hop 1 to hop 2) | **Decided:** no `selectedPlanId`; pass **paragraph summary** + **rubric issues** (see **Decided** below). **Still open:** JSON shaping, fence contract, optional full rubric for harness/debug |
| Phase-plan JSON schema + validators | **Decided:** stable refs (**stableKey** + seam room labels); see **Decided: stable references (phase-plan JSON)**. **Open:** full field list and validators |
| Rubric representation | **Decided:** automation / hop 2 grounding; **three dimensions**; **criterion-first matrix then selection** (**Decided: rubric prompting pattern**). **Open:** aggregation **weights**, safety as dimension vs hard filter |
| Persistence + harness diagnostics | **Decided:** durable **phase-plan JSON** + **walkthrough**; **no** durable **Scene analysis**; extend harness with **`selectionBody`** + **`phasePlanJson`** (**Decided: Coyote engine harness**). **Open:** `CoyoteGameIntentRecord` field shapes / wiring |
| Implementation + durable `AGENT.md` updates | Not started |

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
| **Plan selection** | Brief scene analysis + exactly **N** one-line plan sketches + **criterion-first rubric matrix** (coverage / completeness / coherence) + **explicit selection** of one plan (**Decided: rubric prompting pattern**). No persisted candidate list outside this pipeline. **Handoff to hop 2:** (1) **paragraph summary** of the chosen plan, (2) **issues surfaced by the rubric** -- for example staged objects **without** a clear role in that plan, or **gaps** (missing pieces or goals) that require something **synthesized** or **scavenged / constructed** from what **is** on hand. Optional fenced **json** for those two fields only if parsing prefers it. |
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

## Decided: phase-plan schema evolution

We **do not** need a migration story or backward compatibility guarantees for successive JSON shapes **in development**: execution prompts are cleared often, and rolling out a breaking phase-plan schema can pair with **wiping the single extant development database** when required. Prefer a **clean cut** over maintaining legacy readers. Reserve optional **`schemaVersion`** only if production persistence later demands it (not assumed here).

## Decided: stable references (phase-plan JSON)

**Locked.** Each phase-plan phase must reference staged objects by **`stableKey`**, and room placement must use labels **consistent with** [`coyoteSeamRoomMappingLines`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteHypothesisPromptShared.ts) / seam room conventions -- **not** free-text names only. Validators should reject unknown keys and **stableKeys** absent from the staged snapshot (see illustrative sketch below).

## Decided: durable persistence vs harness

- **`## Scene analysis`:** **Do not** treat as something that must live **durably** on **`CoyoteGame`** (or equivalent intent cache). Hop output may still include it for immediate player UX while generating; the **engine harness** should retain / surface it for **evaluation messages** and quality comparison alongside **`selectionBody`** / **`phasePlanJson`** (**Decided: Coyote engine harness**) -- harness/diagnostic scope only, not a migration-sensitive snapshot contract.
- **Phase-plan JSON** (validated structure for the **chosen** plan) **and** the **walkthrough** (player-facing prose aligned to that plan -- companion to the durable **`Hypothesis:`** player line) **should** be **saved** for downstream prompts (execution comedy, alignment with [`generatePlanOutcome`](../../../../../lambda/ephemera/dataSource/coyoteGame/generatePlanOutcome.ts)), consistent with **Purpose** above.

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

**Still open:** relative **weights** across the three when **aggregating** the matrix into a winner, and whether **safety / Road Runner framing** is scored as a dimension or enforced only as **prompt hard rules** (Coyote hypothesis already discourages failure-comedy language elsewhere).

## Decided: rubric prompting pattern (hop 1)

**Locked.** Hop 1 evaluates candidates with a **two-phase** assistant shape (still one LLM call unless we split later):

1. **Criterion-first matrix** -- One row per candidate plan sketch, one column per rubric dimension (**coverage**, **completeness**, **coherence** from **Decided: rubric dimensions**). Each cell holds **short, evidence-grounded prose** (reference **`stableKey`** / cluster membership where relevant), not opaque letter grades -- the grid is for **comparison**, not calibrated A--F blobs.
2. **Selection second** -- After the matrix is complete: **either** a strict **ordinal rank** (1 = best, **no ties** unless the prompt defines a tie-break procedure) **or** a single **`chosenPlanIndex`** / explicit **winner label** matching the rows, plus **one sentence** naming the decisive dimension if the race was close.

Symbolic scores (letters, 1--5, etc.) are **optional** inside cells only if anchors help the model; the **canonical** discriminant is **structured comparison then an explicit winner**, which aligns reliably with LLM behavior.

Handoff **paragraph summary** + **rubric issues** (**Decided: handoff**) still follows this block and reflects the **chosen** plan only.

## Decided: Coyote engine harness (extended diagnostics)

**Locked.**

- **[`runCoyoteEngineTestHarness`](../../../../../lambda/ephemera/dataSource/coyoteGame/runCoyoteEngineTestHarness.ts)** **will be extended** to surface intermediate pipeline artifacts for tuning and regression comparison (hypothesis harness only), parallel to staged **`usageStage1`** / **`stageOneBody`** today.
- **Intermediate body names** agreed for the new hops (add more alongside if the pipeline grows): **`selectionBody`** -- hop 1 assistant output (matrix + selection + summary/issues handoff as emitted); **`phasePlanJson`** -- validated or raw **phase-plan JSON** produced in hop 2 **before** or alongside prose fences, as diagnostics require.
- Include **`## Scene analysis`** (hop 2) in harness-published evaluation output when useful for comparison; not required on **`CoyoteGame`** (**Decided: durable persistence vs harness**).
- Publication format (concat in one **`WorldOOCMessage`**, extra lines, JSON labels) remains an **implementation** detail; the **obligation** is that harness readers can inspect those artifacts without replaying Bedrock.

## Unknowns: handoff formats

Still to lock before or during implementation:

- **Optional observability:** Whether hop 2 or the **engine harness** should ever attach the **full** rubric text for debugging or quality review (**unlikely** in production payloads).
- **JSON schema for phase plan:** Minimum fields (see below). **Compatibility:** follow **Decided: phase-plan schema evolution** -- no obligation to migrate old payloads in dev. **Stable references** are **decided** under **Decided: stable references (phase-plan JSON)**.
- **Final player contract:** Keep the machine slice: **`Hypothesis:`** inside a **final** ` ```text ` fence ([`parseHypothesisModelOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts)). **Persistence** intent is **decided** under **Decided: durable persistence vs harness** -- extend [`CoyoteGameIntentRecord`](../../../../../lambda/ephemera/internalCache/coyoteGame.ts) (or adjacent cache) for **phase-plan JSON** + **walkthrough**; **sceneAnalysis** on intent is **not** a durable requirement (may drop from stored record or remain optional if convenient for rendering only).

### Phase plan JSON (illustrative sketch, not approved)

Illustrative only -- replace after design review:

- **`phases`**: ordered array.
- Per phase: **`stableKeysUsed`**, **`virtualEntities`** (each with **`label`**, **`derivedFrom`** stableKeys or topology refs, **`phaseKind`**: gathered | synthesized | deployed), **`achievement`** (what becomes true after this phase).
- Optional: **`prepVsBeat`** tagging per phase to align with **prep** / **creation** semantics ([`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)).

Validation should reject unknown keys, reject **stableKeys** not present in the staged snapshot for that run, and reject phases that contradict **## Outliers** membership rules.

## Unknowns: synthesized (virtual) objects

Coyote prompts already allow **virtual scenery** and prep-invented props with strict rules ([`buildHypothesisStageTwoPrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts) **Virtual scenery and prep-invented props**). For structured phase plans:

- Require every **synthetic** or **gathered virtual** entity to list **grounds** (which **stableKeys** + which topology cue), or explicitly mark **`inferredFromPlan`** with a maximum count.
- Decide whether **execution** prompts may introduce **new** virtual props not listed in the cached phase plan (likely **no** for comedic continuity).

## Unknowns: rubric grading

Open design questions:

- **Evaluation shape:** **Decided** -- **criterion-first matrix**, then **selection** (**Decided: rubric prompting pattern (hop 1)** above).
- **Dimensions:** **Decided** -- see **Decided: rubric dimensions (initial set)** above.
- **Automation / hop grounding:** **Decided** -- see **Decided: rubric automation and hop 2 grounding** above.
- **Aggregation:** Relative **weights** when turning the matrix into one winner if not left entirely to prose in the selection step.

## Other open questions

- **Persistence (implementation):** Exact fields on **`CoyoteGame`** / [`CoyoteGameIntentRecord`](../../../../../lambda/ephemera/internalCache/coyoteGame.ts) for **phase-plan JSON** + **walkthrough** strings vs separate keys -- **strategy** is **decided** under **Decided: durable persistence vs harness**; wire-up TBD.
- **Failure policy:** Keep **stub intent only** on any structured validation failure ([`CoyoteHypothesisPipelineAbortError`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteHypothesisPipeline.ts)), or allow degraded player text without JSON.
- **Lambda budget:** Extra sequential Bedrock calls vs [`EphemeraFunction` timeout](../../../../../template.yaml); tune [`BEDROCK_HYPOTHESIS_TIMEOUT_MS`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.ts) per hop.
- **Alignment with plan outcome:** [`AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) **Plan outcome consistency** -- execution and outcome prompts should not contradict the cached phase plan.

## Material decisions to confirm early

- **Per-invoke maxTokens:** Existing clustering seam keeps [`BEDROCK_HYPOTHESIS_STAGE_ONE_MAX_TOKENS`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.ts) (**512**). Each **new** Option A Bedrock hop defaults to [`BEDROCK_HYPOTHESIS_NEW_HOP_DEFAULT_MAX_TOKENS`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.ts) (**2048**) until harness data suggests otherwise.
- Number of candidate plan lines (**three** vs parameterized N).
- Within **Option A**, hop 2 keeps **phase-plan JSON** and player fences in **one** invoke (splitting hop 2 further is **Option B** -- out of scope here).
- Whether **`reasoningContent` / extended thinking** moves to a specific hop only ([`invokeBedrockConverseText`](../../../../../lambda/ephemera/llm/invokeBedrockConverseText.ts)).
- **Production-only (if needed):** whether persisted phase-plan JSON ever requires **`schemaVersion`** or dual readers -- **not** a dev priority given **Decided: phase-plan schema evolution**.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. This section has no nested checklist bullets; each line is a single actionable step.

- [ ] Implement **Option A** end-to-end (prompts, hop-2 multi-fence parse, validation); tune token budget per hop from harness results (reliability metrics inform **tuning**, not a topology change -- **Option B/C** remain out of scope).
- [ ] Lock **handoff serialization** (optional fenced **json** for summary + issues; harness-only full rubric?) and final fence contract for **`Hypothesis:`** -- core handoff shape is **decided** under **Decided: handoff**.
- [ ] Draft **phase plan JSON** schema + validation rules (stableKeys, outliers, virtual entities).
- [ ] Decide rubric **aggregation weights** (if any) and **safety** as scored dimension vs hard filter -- matrix + selection pattern is **decided** under **Decided: rubric prompting pattern (hop 1)** and **Decided: rubric dimensions (initial set)**.
- [ ] Wire **CoyoteGame** / cache fields for **phase-plan JSON** + **walkthrough** per **Decided: durable persistence vs harness**; implement **Decided: Coyote engine harness** (**`selectionBody`**, **`phasePlanJson`**, **Scene analysis** in evaluation output when useful).
- [ ] Implement pipeline steps + parsers (feature code); update durable [`AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) when behavior is stable.
- [ ] Delete or archive this task plan after the initiative completes.

## Verification

- Build/typecheck: from [`lambda/ephemera`](../../../../../lambda/ephemera), run `npm run build` after implementation.
- Tests: targeted Jest for coyote hypothesis pipeline and parsers, for example `npm run test -- --runInBand dataSource/coyoteGame/ llm/pipeline/` (adjust paths to match what you touched).
- Manual or harness runs: compare hypothesis quality and **latency** before raising production timeouts.
