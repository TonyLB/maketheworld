# mtw.ephemera.coyoteGame

**Status:** Bus-only, non-replayable `EphemeraDataSource`.

This package handles Coyote gameplay synthesis after object updates and explicit "Await RoadRunner" actions.

## Subscribes to

- `mtw.ephemera.objects` `Objects Changed` ([`../objects/events.ts`](../objects/events.ts))
- `mtw.ephemera.actions` `Await RoadRunner` ([`../actions/publishedEvents.ts`](../actions/publishedEvents.ts))

## Layout and key files

| Area | Path | Purpose |
| --- | --- | --- |
| DataSource entry | [`index.ts`](index.ts) | Event dispatch into the two ingress handlers |
| Handlers | [`handlers/`](handlers/) | Ingress behavior for hypothesis and outcome paths |
| Utilities | [`utilities/`](utilities/) | Snapshot loaders, room guards, render helpers, shared non-LLM helpers |
| Hypothesis pipeline | [`generators/pipelines/hypothesis/`](generators/pipelines/hypothesis/) | Multi-hop hypothesis generation pipeline |
| Outcome pipeline | [`generators/pipelines/outcome/`](generators/pipelines/outcome/) | Single-call outcome generation pipeline |
| Shared parsers | [`generators/sharedParsers/`](generators/sharedParsers/) | Cross-pipeline parser contracts (for example terminal hypothesis parse) |
| Test harness | [`generators/testHarness/`](generators/testHarness/) | Non-production Coyote engine harness and fixtures |
| Published payloads | [`publishedEvents.ts`](publishedEvents.ts) | Stream payload contracts |
| Subscribed envelope guard | [`subscribedEvents.ts`](subscribedEvents.ts) | Ingress envelope contract |

Pipeline-local docs:

- Hypothesis: [`generators/pipelines/hypothesis/AGENT.md`](generators/pipelines/hypothesis/AGENT.md)
- Outcome: [`generators/pipelines/outcome/AGENT.md`](generators/pipelines/outcome/AGENT.md)

## Objects Changed (hypothesis path)

[`handlers/handleObjectsChangedForHypothesis.ts`](handlers/handleObjectsChangedForHypothesis.ts):

1. Accepts only object-add events in Coyote demo rooms.
2. Sends placeholder `CoyoteGameHypothesisMessage` on `hypothesisLane:${messageId}`.
3. Flushes lane while remainder invalidates and reloads `internalCache.CoyoteGame.get('intent')`.
4. Publishes final hypothesis render tree and stream event payload.

Hypothesis generation chain:

- Entry: [`generators/pipelines/hypothesis/generateHypothesis.ts`](generators/pipelines/hypothesis/generateHypothesis.ts)
- Orchestration: [`generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts`](generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts)
- Terminal shared parse: [`generators/sharedParsers/parseHypothesisModelOutput.ts`](generators/sharedParsers/parseHypothesisModelOutput.ts)

Plan-selection to phase-plan handoff semantics are documented in
[`generators/pipelines/hypothesis/AGENT.md`](generators/pipelines/hypothesis/AGENT.md) under
the planSelect output contract (including optional structured `selectedCandidate`, residual `planIssues`, and legacy fallback), with parser/type authority in
[`generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts`](generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts).

## Gimmick (internal spine)

Each hypothesis **candidate** carries a short string **`gimmick`**: a light narrative spine the plan aligns around. It is **internal reasoning and handoff only** (not shown in the client, not classified before the candidate hop, and **not** a reason to rewrite Acme enrich or durable **`tropeAffinities`** on room objects).

Stable contracts (hop-level detail and parser authority: [`generators/pipelines/hypothesis/AGENT.md`](generators/pipelines/hypothesis/AGENT.md)):

- **Candidates:** required root **`gimmick`** on successful parse; no closed enum for archetype text (examples live in prompts only).
- **Plan-select input JSON:** **`schemaVersion: 4`** with per-candidate **`gimmick`**. Duplicate gimmick strings across candidates are **not** rejected at parse (soft uniqueness is prompt-only).
- **Handoff:** canonical **`gimmick`** for downstream hops comes from **combine** via **`parsePlanSelectionHandoff`** when the winner **`candidateId`** matches; model echo on **`selectedCandidate.gimmick`** is optional at parse and validated when present.
- **Combine:** carries **`gimmick`**; **no** deterministic gimmick-vs-**`stableKey`** member checks.
- **Dynamo `CoyoteGame#Intent`:** optional **`gimmick`** and sparse **`tropeSequence`** on read (legacy rows); both written from the plan-select winner on successful generation ([`../../internalCache/coyoteGame.ts`](../../internalCache/coyoteGame.ts), overview in [`../../internalCache/AGENT.md`](../../internalCache/AGENT.md)).
- **Outcome:** prompt bundle includes explicit **`gimmick`** and **`tropeSequence`** labels when present ([`generators/pipelines/outcome/AGENT.md`](generators/pipelines/outcome/AGENT.md), [`generators/pipelines/outcome/buildPlanOutcomePrompt.ts`](generators/pipelines/outcome/buildPlanOutcomePrompt.ts)).
- **Harness / fixtures:** refreeze inject bundles when the handoff shape changes so gimmick stays consistent across partial runs.
- **Missing or malformed `gimmick`:** degrade gracefully and continue from other handoff fields (exact step behavior is implementation-defined).

## Await RoadRunner (outcome path)

[`handlers/handleAwaitRoadRunnerForPlanOutcome.ts`](handlers/handleAwaitRoadRunnerForPlanOutcome.ts):

1. Targets active characters across all Coyote game rooms.
2. Sends `Outcome: Generating...` on `outcomeLane:${messageId}`.
3. Flushes lane while remainder invalidates and reloads `internalCache.CoyoteGame.get('outcome')`.
4. Publishes final world message and stream event payload.

Outcome generation chain (reads the same durable **intent** row as hypothesis, including optional **`gimmick`** and **`tropeSequence`** for prompt context only):

- Entry: [`generators/pipelines/outcome/generatePlanOutcome.ts`](generators/pipelines/outcome/generatePlanOutcome.ts)
- Prompt builder: [`generators/pipelines/outcome/buildPlanOutcomePrompt.ts`](generators/pipelines/outcome/buildPlanOutcomePrompt.ts)
- Narrative-beats / trope-sequence formatter: [`generators/pipelines/outcome/formatPhasePlanForOutcomePrompt.ts`](generators/pipelines/outcome/formatPhasePlanForOutcomePrompt.ts)

## Staged object snapshot

Snapshot and formatting helpers are centralized in [`utilities/coyoteRoomObjectSnapshot.ts`](utilities/coyoteRoomObjectSnapshot.ts), including:

- `loadCoyoteRoomObjectsByRoom`
- `formatCoyoteStagedObjectLine`
- `formatCoyoteStagedObjectsByRoom`

These are consumed by both hypothesis and outcome pipelines and by test harness paths.

`tropeAffinities[].environmentAffordances` and optional `tropeAffinities[].affordancesProvided` are threaded through staged object snapshot carriers when present, in parallel. Staged-object prompt formatting remains unchanged and does not render affordance text from either field; both exist so candidate combine and plan-select JSON can carry structured evidence toward later hops.

## Room id seam (canonical vs prompt labels)

Make The World uses canonical `EphemeraRoomId` values (for example `ROOM#VORTEX`) everywhere durable or structural. Coyote prompts use **seam labels** so geography reads correctly for the cartoon frame: the cliff-base highway is labeled **`CLIFFBASE`** in prompts while the canonical id remains **`ROOM#VORTEX`**.

**Authoritative code**

- Override map and seam helpers: [`generators/pipelines/hypothesis/coyoteHypothesisPromptShared.ts`](generators/pipelines/hypothesis/coyoteHypothesisPromptShared.ts) (`COYOTE_SEAM_ROOM_LABEL_OVERRIDES`, `seamRoomLabelFromEphemeraRoomId`, `normalizeSeamRoomLabelToken`).
- Staged snapshot `room` field (human label) and Markdown headings: [`utilities/coyoteRoomObjectSnapshot.ts`](utilities/coyoteRoomObjectSnapshot.ts) (via `seamRoomLabelFromEphemeraRoomId`). JSON snapshot rows still include canonical **`roomId`**.
- Combined clustering / plan-select JSON `room` strings: [`generators/pipelines/hypothesis/candidates/combineCandidateOutput.ts`](generators/pipelines/hypothesis/candidates/combineCandidateOutput.ts).
- Phase-plan topology allowlist for `derivedFrom`: [`generators/pipelines/hypothesis/narrativeBeats/narrativeBeatValidationContext.ts`](generators/pipelines/hypothesis/narrativeBeats/narrativeBeatValidationContext.ts) (uses `seamRoomLabelFromEphemeraRoomId` for rooms that have staged objects).

**One-way contract**

We intentionally do **not** resolve seam labels back to `EphemeraRoomId`. Pipeline parsing keys objects by `stableKey`; planSelect output `selectedCandidate.members[].room` is a free string; phase-plan `derivedFrom` tokens are validated against an allowlist, not mapped into room rows.

**If you add backward-reference later (label -> id), expect**

1. **Bijection or primary key** - overrides must not map two canonical ids to the same label without an explicit disambiguation rule.
2. **Legacy tokens** - models or fixtures may still say `VORTEX`; `normalizeSeamRoomLabelToken` maps legacy strip + new seam to one token for validators; a reverse map must accept the same set and reject unknowns.
3. **Hop-1 handoff** - [`generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts`](generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts) would need strict validation of `room` vs the snapshot-derived allowlist (today: type-only).
4. **Phase-plan** - [`packages/mtw-interfaces/ts/coyotePhasePlan.ts`](packages/mtw-interfaces/ts/coyotePhasePlan.ts) mixes snapshot `stableKey`s, reserved `setting`, and topology strings in `derivedFrom`; you must disambiguate labels from stable keys before resolving to ids.
5. **Tests / fixtures** - many literals; every boundary that should round-trip needs canonical-id assertions again.
6. **Scope** - overrides are global constants today; per-asset worlds would need scoped maps before reverse lookup is safe.

Product topology narrative (player-facing names) stays aligned in [`AGENT.CoyoteGame.md`](../../../../AGENT.CoyoteGame.md) under **Canonical Demo Topology**.

## Engine testing harness (dev)

Harness code is under [`generators/testHarness/`](generators/testHarness/):

- Runner: [`generators/testHarness/runCoyoteEngineTestHarness.ts`](generators/testHarness/runCoyoteEngineTestHarness.ts)
- Fixtures: [`generators/testHarness/coyoteEngineTestFixtures.ts`](generators/testHarness/coyoteEngineTestFixtures.ts)

Player-facing slash command (this harness only; not `/test affinities`): **`/test generation`**. Grammar (token order is fixed; phase aliases are case-insensitive):

| Input | Behavior |
| --- | --- |
| `/test generation` | Full hypothesis pipeline for every harness fixture. |
| `/test generation <fixtureIndex>` | Full pipeline for one fixture only (**1-based** index). |
| `/test generation <phaseAlias>` | **Partial** run: **`runUntil`** through that phase, all fixtures. |
| `/test generation <phaseAlias> <fixtureIndex>` | Partial **`runUntil`**, one fixture. |
| `/test generation <runKind> <phaseAlias>` | Partial run using explicit run kind (`runUntil` or `runOnly`) for all fixtures. |
| `/test generation <runKind> <phaseAlias> <fixtureIndex>` | Partial run using explicit run kind for one fixture. |

Phase aliases: **`candidates`** (legacy slash token **`clustering`** still accepted), **`planSelect`**, **`narrativeBeats`** (legacy slash token **`phasePlan`** still accepted; map to LLM hops on the hypothesis pipeline; see [`generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts`](generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts)). Invalid tails (unknown token, wrong order, index out of range) return a **`WorldOOCMessage`** with usage text.

**Slash vs harness API:** [`parseCoyoteEngineTestSlashTail`](../actions/discriminateIntent/parseCoyoteEngineTestSlash.ts) supports both shorthand partial invocations (`<phaseAlias> [fixtureIndex]` => `runUntil`) and explicit run-kind partial invocations (`<runKind> <phaseAlias> [fixtureIndex]` with `runKind` in `runUntil` | `runOnly`).

**Invocation and pipeline options**

- **`CoyoteEngineTestHarnessInvocation`** ([`runCoyoteEngineTestHarness.ts`](generators/testHarness/runCoyoteEngineTestHarness.ts)): **`mode: 'full'`** (optional single-fixture filter) or **`mode: 'partial'`** with **`testOnly`**, **`harnessRunKind`** (`runUntil` \| `runOnly`), optional **`fixtureIndex1Based`**. For **`runOnly`** on **`planSelect`** / **`narrativeBeats`**, the runner resolves inject bundles via **`buildHarnessPipelineOptions`** and **`resolveCoyoteHarnessStartAtInject`**.
- **`runCoyoteHypothesisPipeline(deps, options?)`** ([`coyoteHypothesisPipeline.ts`](generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts)): optional harness **`testOnly`**, **`harnessRunKind`**, **`injectState`**. Omit these for production full-pipeline runs. **`injectState`** is valid only for **`runOnly`** **`planSelect`** / **`narrativeBeats`** (handoff-shaped partial [`CoyoteHypothesisPipelineState`](generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts)). **`candidates`** **`runOnly`** uses fixture **`roomObjectsByRoom`** plus deterministic **`loadRoomObjects`**; do not pass inject bundles for that mode.
- Types and threading: [`generateHypothesis.ts`](generators/pipelines/hypothesis/generateHypothesis.ts) (**`CoyoteHypothesisPipelineHarnessOptions`**), [`coyoteHarnessInjectTypes.ts`](generators/pipelines/hypothesis/coyoteHarnessInjectTypes.ts).

**Fixtures and handoffs** ([`coyoteEngineTestFixtures.ts`](generators/testHarness/coyoteEngineTestFixtures.ts))

- Each **`CoyoteEngineTestFixture`** has **`roomObjectsByRoom`** and optional **`planSelectInject`** / **`narrativeBeatsInject`**. **`planSelectInject`** carries **`combined`** ([**`CombineCandidateOutputReturn`**](generators/pipelines/hypothesis/candidates/combineCandidateOutput.ts) from parse + combine) and **`roomObjectsByRoom`**. **`narrativeBeatsInject`** carries **`roomObjectsByRoom`** and **`planSelectOutput`** (with required **`selectedCandidate`** for narrative beats; no **`combined`**). Rows are **sparse**: only defined **(fixture, boundary)** pairs are required; missing bundles for a requested **`runOnly`** **`planSelect`** / **`narrativeBeats`** fail fast with a clear operator-facing error (no synthesized inputs).
- For `runOnly narrativeBeats`, fixture `planSelectOutput.planIssues` rows must use the structured contract (`code`, `summary`, optional `evidence`) and valid v1 allowlist codes defined in [`generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts`](generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts).

Activation path in `actions`:

- Deterministic guard + tail parse: [`../actions/discriminateIntent/deterministicChecks.ts`](../actions/discriminateIntent/deterministicChecks.ts), [`../actions/discriminateIntent/parseCoyoteEngineTestSlash.ts`](../actions/discriminateIntent/parseCoyoteEngineTestSlash.ts), [`../actions/discriminateIntent/coyoteEngineTestSlashCommand.ts`](../actions/discriminateIntent/coyoteEngineTestSlashCommand.ts)
- Parse command: [`../actions/parseCommand.ts`](../actions/parseCommand.ts); **`harnessInvocation`** on **`ParseCommandCoyoteEngineTestResult`**: [`../actions/baseClasses.ts`](../actions/baseClasses.ts)
- Harness execution gate: [`../actions/index.ts`](../actions/index.ts)

## Verification

From `lambda/ephemera/`:

```bash
npx jest dataSource/coyoteGame/ dataSource/actions/
```

During focused iteration:

```bash
npx jest dataSource/coyoteGame/
```

Harness and slash regression (narrow scope; extend paths when adding tests under these trees):

```bash
npm run test -- --runInBand dataSource/coyoteGame/generators/testHarness/ dataSource/actions/parseCommand.test.ts dataSource/actions/discriminateIntent/
```

See [`../../AGENT.testing.md`](../../AGENT.testing.md) for general Jest usage in this package (`npm run test`, watch mode, and file paths).

## Related docs

- **Trope vocabulary (six tropes: Scene Dressing + five causal, canonical order, Bait vs Misdirection rubrics):** [`AGENT.tropes.md`](AGENT.tropes.md)
- DataSource index: [`../AGENT.md`](../AGENT.md)
- LLM utilities and parser patterns: [`../../llm/AGENT.md`](../../llm/AGENT.md)
- LLM linear pipeline runner: [`../../llm/pipeline/AGENT.md`](../../llm/pipeline/AGENT.md)
- Product/demo context: [`../../../../AGENT.CoyoteGame.implementation.md`](../../../../AGENT.CoyoteGame.implementation.md)
