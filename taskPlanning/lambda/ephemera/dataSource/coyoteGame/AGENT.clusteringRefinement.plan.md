# Coyote hypothesis Stage One: clustering and plan-structure refinement

**Status:** Planning. **Implementation sequencing:** Prefer finishing **[`AGENT.generativeAffinities.plan.md`](../actions/AGENT.generativeAffinities.plan.md)** (Acme enrich affinity extension) **before** seam/parser/combine/Stage Two work here. **Next (after generative affinities):** lock **`intendedRole`** / **`priorAssembly`** in **types** + seam, degraded-path rules, combine wire format + Stage Two scope; harness + combine-layer scaffolding.

This document is task-scoped; retire it after the initiative ships and move lasting behavior notes into [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) (see [`taskPlanning/AGENT.md`](../../../../AGENT.md)).

**Prerequisite (foundational):** Acme **`stableKey`** is shipped --- steady-state contract [**`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md)** and **[`EphemeraMetaRoomObject`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)** (**`stableKey`** required, non-empty after trim on validated rows). Staged objects use **`stableKey`** for seam/combine correlation; **`uuid`** remains the object id wire form but is no longer the primary clustering correlation key for new combine code.

**Sequencing:** **[`AGENT.generativeAffinities.plan.md`](../actions/AGENT.generativeAffinities.plan.md)** extends **`CoyoteAffinityPossibility`** at Acme enrich (**`priorAssembly`** / generative roles on **`Meta::Room`**). **Land that track before or in lockstep with** tearing out the legacy seam --- so **`intendedRole`** stays **selection among persisted rows**, not seam-only **`priorAssembly`** long term.

## Purpose

Hypothesis generation already runs **two Bedrock round-trips** with a validated Markdown **seam** between them (steady-state: [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)). **Stage One** still spends prompt and token budget on **per-object coarse affinity** (`coyoteOperated` / `roadRunnerTrap` / `ambiguous`) and **[`ACTOR_AFFINITIES_LINES`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageOnePrompt.ts)** heuristics.

Meanwhile **plan-role affinities** are produced at **Acme Order** parse time, stored durably on **[`Meta::Room.objects`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)**, and rendered into **[`formatCoyoteStagedObjectsByRoom`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteRoomObjectSnapshot.ts)** for both hypothesis stages ([`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md) **Coyote Acme orders**).

**Goal:** Refocus Stage One on **functional/thematic clustering** --- **which objects belong in the same maneuver** --- without asking the seam LLM to re-derive Acme **plan-role** facts. **Temporal ordering, assembly phases, beat sequencing, and inferred intermediate props** are **not** Stage One responsibilities; they live in **combine + downstream plan-phase narrative** (Stage Two hypothesis today; plan outcome / future work as scoped). Reduce redundant coarse **`Affinity:`** / **`ACTOR_AFFINITIES_LINES`** mapping and introduce a **deterministic combine layer** after Stage One so hydrated output sits **next to** persisted **`CoyoteAffinityPossibility`** data from **`Meta::Room`**.

**Scope:** This initiative targets the **golden path** only --- snapshots where staged objects have usable **plan-role `affinities`** from Acme enrich (see [`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md)). Deliberate harness or integration coverage for **degraded** inputs (`affinitiesFailed`, legacy omitted **`affinities`**, or other resilience scenarios) is **out of scope** here; see [`AGENT.md` **Engine testing harness**](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) for a durable note on future coverage.

## Success criteria (draft)

- Stage One prompt + **[`parseHypothesisStageOneOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisStageOneOutput.ts)** evolve **in lockstep** with **[`buildHypothesisStageTwoPrompt`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts)** if the seam contract changes (no orphan version field; same policy as [`AGENT.md` **Hypothesis pipeline**](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)).
- Engine harness fixtures supply full **[`EphemeraMetaRoomObject`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)** shapes with **golden-path `affinities`** so seam + combine behavior is observable against realistic enriched snapshots ([`runCoyoteEngineTestHarness`](../../../../../lambda/ephemera/dataSource/coyoteGame/runCoyoteEngineTestHarness.ts), [`coyoteEngineTestFixtures`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteEngineTestFixtures.ts)).
- Combine layer (name TBD) attaches **snapshot `CoyoteAffinityPossibility` rows** and **`priorAssembly`** handling to **cluster membership** for Stage Two consumption; behavior and wire format are unit-tested.
- External player contract unchanged unless intentionally expanded: **[`CoyoteGameIntentRecord`](../../../../../lambda/ephemera/internalCache/coyoteGame.ts)** (`intent`, optional `sceneAnalysis`) and stub policy ([`generateHypothesis`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.ts)).

## Constraints and non-goals

- **Non-goal:** Rewriting Stage Two narrative rules beyond what falls out from an improved seam + combine output (Stage Two tone work may already exist separately).
- **Non-goal:** Changing Acme enrich **inside this initiative** --- except coordinated with **[`AGENT.generativeAffinities.plan.md`](../actions/AGENT.generativeAffinities.plan.md)** (**enrich-first** sequencing). **`affinities`** remain inputs from **`Meta::Room`** for clustering prompts.
- **Non-goal:** Expanding Dynamo persistence for raw seam text in production (debug path remains harness / tests per [`AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)).
- **Non-goal (this initiative):** Dedicated engine-harness or Jest fixtures whose **purpose** is resilience when affinity enrichment **failed** (`affinitiesFailed`), **legacy** rows with omitted **`affinities`**, or other **degraded snapshot** shapes. Runtime and prompts must still **tolerate** those rows (see **Constraint**); we are not investing in automated coverage of those paths for this task-plan.
- **Constraint:** Production remains able to represent legacy staged objects **without** `affinities` or with **`affinitiesFailed`**; clustering and hypotheses must not **require** rich plan roles to parse or stub correctly. Golden-path refinement in this plan does not relax that constraint.

## Unknowns and decisions

**Does recent design discussion close the old bullets?** Mostly **yes on direction**, **no on specifics**: we can treat the former open questions as **answered at intent level** (slim seam + hydration + richer snapshot inputs) and replace them with the **narrower decisions** below. Spike or prototype may revise the intent.

### Direction settled for now (implement unless a spike contradicts)

- **Clustering phase scope:** Group objects **only** along **functional / thematic** lines --- **objects that work together toward a common goal**. **Not** responsible for **temporal ordering**, **phase sequencing**, **inferring what assembly produces** (e.g. synthetic **rocket-harness** props), or **splitting** a single functional cluster because steps happen in order. Those are **plan-phase** responsibilities (downstream prompts: Stage Two hypothesis as implemented today; [`generatePlanOutcome`](../../../../../lambda/ephemera/dataSource/coyoteGame/generatePlanOutcome.ts) and future refinements as separately scoped).
- **Seam contract:** Move away from **`## Objects`** per-object **`Function:`** / **`Affinity:`** (and **`ACTOR_AFFINITIES_LINES`** teaching re-derivation), and away from forward-looking cluster **Summary** sentences under **`## Clusters`**. Prefer **cluster-first output**: membership references plus **minimal** per-member **`intendedRole`** (see **Resolved**). Optional **`## Notes`** stays **only** for phase-neutral spatial/factual observations; forbid forward-looking plan narrative there.
- **`intendedRole` (resolved semantics for golden path):** For each member, emit **either** (a) a **selection** identifying **one** **[`CoyoteAffinityPossibility`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)** already present on that object's enriched **`affinities`** list (same vocabulary Acme Step B writes: structural roles **`terminal` / `trigger` / `delivery` / `autonomous_agent`**, or **`entity_modification`** with **`target`** / **`mode`**), **or** (b) an extra sentinel **`priorAssembly`** --- **not** an Acme-enriched row --- meaning **this object needs construction or rigging before the functional cluster can execute**, **without** splitting the cluster along a temporal boundary (e.g. rocket + rope stay one **propulsion** cluster; rope gets **`priorAssembly`** so plan-phase derives an assembly step). Combine/hydration maps **`priorAssembly`** + snapshot rows into downstream text; exact wire encoding is **Still open**.
- **Assembly is per-object, not cluster type:** Drop the idea of an **assembly** cluster **taxon**. **Assembly / prep** is signaled **per member** via **`intendedRole` == `priorAssembly`** (and plan-phase pulls those items into an explicit assembly narrative **outside** clustering). The legacy cluster bullet **Coyote role** (`participant` / `trapSetter` / `ambiguous`) is **superseded in intent** by **per-member `intendedRole`** plus combine; whether any slim cluster-level label survives for parsing is **Still open** (likely **drop** or replace with non-narrative labels only).
- **Snapshot as Stage One input:** Include **`stableKey`** in the clustering prompt (today [`formatCoyoteStagedObjectsByRoom`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteRoomObjectSnapshot.ts) does not echo it). Prefer **plan roles without aptness** for Stage One inputs (today lines include aptness via [`formatCoyoteAffinityPossibility`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteRoomObjectSnapshot.ts)); Stage Two may still use richer formatting if needed.
- **Combine / hydration:** A **deterministic step after Stage One** resolves **`stableKey`** + **`intendedRole`** into **embedded records** for downstream consumption (hydrate **`shortName`**, **`affinities`**, resolve **`priorAssembly`** semantics). Same conceptual step as **Combine layer** in **Success criteria**; wire format remains **Still open**.
- **Member references (hybrid, chosen direction):** Prefer **`stableKey` + `intendedRole`** per cluster member when the snapshot row can be correlated by **`stableKey`** --- **token-efficient** on the golden path and **deterministic hydration** fills known fields. When **`stableKey`** is missing or unusable, seam may carry a **structured inline full record** **plus `intendedRole`** so combine can **pass through** without a failed lookup. Parser: **discriminated union** (keyed vs inline); multiset / duplicate rules in **Still open**.

### Resolved (recent design integration)

| Topic | Resolution |
| --- | --- |
| **`intendedRole` anchor** | **Selection** among existing **`CoyoteAffinityPossibility`** rows on the object **plus** one extra seam value **`priorAssembly`** (see above). **Not** the legacy coarse seam tokens **`coyoteOperated` / `roadRunnerTrap` / `ambiguous`** unless we explicitly bridge them (prefer **no**). |
| **Clustering vs plan-phase** | **Clustering** = functional co-membership only. **Plan-phase** (Stage Two + later) = temporal ordering, explicit assembly phases, inferred intermediates, chronology across beats --- **not** Stage One's job. |
| **`priorAssembly` role** | Bridge object needing **prep/rigging** without **temporal splitting** of an otherwise unified cluster. |

### Still open (follow-ups from the above)

1. **`priorAssembly` in the type system:** **`priorAssembly`** is **not** produced by Acme enrich today (**Non-goal:** avoid changing **`mergeAcmeOrderEnrich`** unless required). Decide: **seam-only token** validated in **`parseHypothesisStageOneOutput`** + expanded by combine **vs** eventual persisted shape. If seam-only, how combine represents it to Stage Two (Markdown line, structured block, DTO).
2. **Wire encoding for `intendedRole`:** How the seam cites **one** **`CoyoteAffinityPossibility`** --- **index** into a deterministic sort of **`affinities`** **vs** minimal structured echo **vs** stable string key --- such that **parse + combine** round-trip **uniquely** (including **`entity_modification`** tuple fields).
3. **Degraded snapshots (`affinities` missing / `affinitiesFailed`):** Selection among possibilities **requires** candidates. Rules for **`intendedRole`** when the list is empty: omit, allow **`priorAssembly`** only, force **inline full record** branch, or **stub hypothesis** --- must satisfy **Constraint** (parse + stub, no hard dependency on rich roles).
4. **Disambiguation vs structural roles:** Keep prompts clear that **`priorAssembly`** is **prep before the maneuver**, not duplicate semantics of **`terminal` / `delivery` / `trigger`** (Acme **[`buildParseAcmeOrderEnrichPrompt`](../../../../../lambda/ephemera/dataSource/actions/buildParseAcmeOrderEnrichPrompt.ts)** vocabulary); avoid double-assigning **first** / **ordering** to clustering.
5. **Plan-phase scope in *this* initiative:** Stage Two [**`buildHypothesisStageTwoPrompt`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts)** must consume combine output; confirm how much of **assembly phases / inferred props / full chronology** lands **here** **vs** explicitly **later** (align with **Non-goal:** limited Stage Two rewrite).
6. **Keyed vs inline follow-through:** Minimal **inline full record** field set (subset of **`EphemeraMetaRoomObject`**); validation vs snapshot (**`uuid`** match?); precedence and **no** double-count of the same object.
7. **Cluster heading surface:** Whether **any** **`### Cluster`** bullets remain besides **Members** (e.g. non-narrative **`label`** only) after dropping **`Summary`** and the legacy **Coyote role** bullet.
8. **Combine layer wire format and Stage Two placement:** Markdown augmentation vs structured DTO + template; Stage Two sees **combined-only** vs **seam + snapshot + combined**; Bedrock cache / length.


## Getting started

Follow the ordered **categories** below (see [Getting Started pattern for complex tasks](../../../../../AGENT.md#getting-started-pattern-for-complex-tasks) in root [`AGENT.md`](../../../../../AGENT.md)). Keep **Why** / **Focus** so the next reader knows what to skim vs study.

1. **Understand task-plan conventions**
   - **Why:** Know what belongs here vs durable [`AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md); see [`taskPlanning/AGENT.md`](../../../../AGENT.md).

2. **Read steady-state Coyote hypothesis docs**
   - **Why:** This initiative **extends** the shipped two-call pipeline; do not re-derive wiring.
   - **Focus:** [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) (hypothesis path, staged snapshot, **Hypothesis pipeline**, harness). Affinity types: [`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts).

3. **Read Stage One / Stage Two / parser entry points**
   - **Why:** Seam edits require coordinated parser and both prompt builders.
   - **Focus:** [`buildHypothesisStageOnePrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageOnePrompt.ts), [`parseHypothesisStageOneOutput.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisStageOneOutput.ts), [`buildHypothesisStageTwoPrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts), [`generateHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.ts).

4. **Objects + Acme path (affinity provenance)**
   - **Why:** Snapshot rows are the authoritative affinity source for prompts.
   - **Focus:** [`lambda/ephemera/dataSource/objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md); [`publishedEvents.ts`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts) **`AcmeOrderPublishedOrder`**; [`coyoteRoomObjectSnapshot.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteRoomObjectSnapshot.ts).

5. **Testing**
   - **Why:** Ephemera uses Jest from `lambda/ephemera`; see [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md).
   - **Commands:** **Verification** below.

6. **Identify next task**
   - **Why:** Progress lives in **Recommended order**.
   - **Focus:** First unchecked line.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Apply checkboxes to each actionable line and nested bullets as they complete.

- [ ] **Design note:** Close **Still open** in **Unknowns and decisions** (`priorAssembly` typing, **`intendedRole`** wire encoding, degraded **`affinities`** rules, Stage Two vs later plan-phase scope, keyed-vs-inline, cluster headings, combine + Stage Two layout). **`intendedRole`** / clustering scope / **`priorAssembly`** intent are **Resolved** there; **Member references** hybrid unchanged (**Direction settled**). Capture final calls in this section or a short comment in [`generateHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.ts) if needed for maintainers.
- [ ] **Harness fixtures (golden path):** Extend [`coyoteEngineTestFixtures.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteEngineTestFixtures.ts) (and any normalization helpers) so fixtures supply full **`EphemeraMetaRoomObject`** rows with realistic **`affinities`** (enriched-order shape); keep room ordering aligned with [`defaultCoyoteGameData.gameRooms`](../../../../../lambda/ephemera/internalCache/coyoteGame.ts). Do not add failure-mode fixtures in this initiative (see **Non-goal** above).
- [ ] **Combine layer:** Implement post-Stage-One step that joins validated seam + [`CoyoteRoomObjectsByRoom`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteRoomObjectSnapshot.ts) affinities into a single artifact for Stage Two (exact shape TBD); unit tests with fixed seam + snapshot inputs.
- [ ] **Stage One prompt + parser:** Trim or replace **[`ACTOR_AFFINITIES_LINES`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageOnePrompt.ts)** and redundant object-level affinity work; steer copy toward clustering, spatial/causal plan structure, and using snapshot plan-role lines as ground truth; update **[`parseHypothesisStageOneOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisStageOneOutput.ts)** and [`parseHypothesisStageOneOutput.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisStageOneOutput.test.ts) to match.
- [ ] **Stage Two prompt:** Consume combined output; adjust [`buildHypothesisStageTwoPrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts) + tests so Stage Two instructions match the new seam/combine semantics.
- [ ] **Orchestration:** Wire combine step in [`generateHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.ts) / [`generateHypothesisWithStageResults`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.ts); preserve stub-only failure behavior.
- [ ] **Harness + integration tests:** Update [`runCoyoteEngineTestHarness`](../../../../../lambda/ephemera/dataSource/coyoteGame/runCoyoteEngineTestHarness.ts) / [`generateHypothesis.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.test.ts) as needed for new fields or metrics.
- [ ] **Durable docs:** Refresh [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) for seam/combine steady state; keep this plan's **Purpose** high-level only.

## Verification

- `cd lambda/ephemera && npx jest dataSource/coyoteGame/`
- After touching actions or objects: extend with `dataSource/actions/` or `dataSource/objects/` as appropriate.

## References

- Steady-state hypothesis + harness: [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)
- Runtime objects + Acme merge: [`lambda/ephemera/dataSource/objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md)
- Product context: [`AGENT.CoyoteGame.implementation.md`](../../../../../AGENT.CoyoteGame.implementation.md) (repo root)
