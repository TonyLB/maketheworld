# Object manipulation: backtrack channel (iteration 4)

**Status:** Named, not started. Split out 2026-07-18 from `AGENT.manipulationFrameAndRelational.planning.md` as part of the iteration-roadmap restructuring --- see [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md) for the full ladder and why this is a separate plan.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

A later pipeline stage (Identify, Plan, or Synthesis) sometimes can't make sense of what an earlier stage produced --- not just "the identity is ambiguous" (already handled by Consult/Abstain), but a genuine structural or grounding fault. The general answer, named but not built, is **Backtrack**: the later stage emits a structured critique back to the stage that produced the fault, rather than either (a) silently guessing, or (b) reimplementing that earlier stage's own logic to route around it. This is the general fault-recovery pattern for the whole pipeline, not specific to any one stage boundary --- it currently has four named addressable targets: the three BD-19 fallback entry points (identity-only, plan-only, joint) and Parse (iteration 3's tokenized-skeleton hop).

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) and [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md) (this iteration's place in the ladder).
2. Read the Backtrack fault-recovery pattern reference: [`llm/AGENT.concepts.md`](../../../../../lambda/ephemera/llm/AGENT.concepts.md).
3. Read the Grounding/Expansion/Validation vocabulary this channel sits alongside: [`actions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md) ("Synthesize's three sub-roles").
4. Read the terminal-failure result types this channel would need a third outcome on: `GroundReferentResult`/`GroundChangeResult` (`synthesize/groundReferent.ts`/`groundChange.ts`), `ExpandTransferMembershipResult` (`synthesize/expandTransferMembership.ts`).
5. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md).
6. Baseline:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/synthesize/ \
  dataSource/positions/positionGraph/expandValidate/
```

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement this iteration. When a decision ships, record it in the relevant durable doc and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| BD-18 | **Synthesize -> Identify backtrack/correction channel --- named future direction, not yet scoped (2026-07-14).** First written down 2026-07-13 as one paragraph under "Assertion failure modes" in the original planning doc's Phase C design debt, before the Grounding/Expansion/Validation names and the Pipeline A/B framing existed --- promoted to its own row (2026-07-14) so it surfaces on future scans instead of staying buried in prose. **The gap:** none of Grounding's (`groundReferent.ts`/`groundChange.ts`, `ok: false`) or Expansion's (`expandTransferMembership.ts`, `verdict: 'error'`) terminal-failure outcomes can currently ask Identify to reconsider a candidate given what Synthesize found (e.g. "widen the search to this other host, given the relation Plan is asking for") --- every failure is hard-terminal or (for `defer`) escalates to an LLM validator, never loops back upstream. The richer alternative --- **Backtrack** the assertion/grounding failure into Identify as a correction/ranking signal (per the Backtrack fault-recovery pattern in [`llm/AGENT.concepts.md`](../../../../../lambda/ephemera/llm/AGENT.concepts.md)) --- is named but **deliberately not built**: Identify returns top-N candidates today independent of any downstream assertion, so a candidate that loses on pure lexical/semantic match could in principle win a re-ranked retry that weights what Synthesize learned. Does **not** violate Identify/Plan independence --- only Synthesize (already holding both stages' output) would ever mediate a backtrack. **Action for now, not a build commitment:** keep the terminal-failure result types (`GroundReferentResult`, `GroundChangeResult`, `ExpandTransferMembershipResult`, and whatever `Assertion` evaluation eventually returns) **open to a third outcome** rather than letting call sites harden around just today's two shapes (success / terminal-fail) --- flagged in code comments at each of those three result types. **Extended (2026-07-15), discovered from the opposite end --- persistence, not Synthesize.** The persistence kernel needs the identical third-outcome channel, one layer further out: `applyTransferSet.ts` already reruns `boundaryEdgeOutcomes` live against freshly-fetched graphs inside `applyObjectSetTransfer.ts`'s `MultiKeyUpdate` reducer, and it can rediscover a genuine `defer` there --- e.g. a `Custom`-kind relation satisfied at selection time but violated by commit time because a concurrent write moved one of the objects in between. Today, `applyObjectSetTransfer.ts` throws on anything other than `legal`, collapsing `illegal` and `defer` into one generic transaction-abort. **This is confirmed to be the right generalization, but explicitly not yet built --- and today's collapse-to-failure is an interim stand-in, not a considered permanent answer.** The reducer/kernel should emit a typed fact about *what specifically* was found stale rather than deciding what to do about it --- deciding to re-enter a stage is the orchestrator's job, preserving the same layer separation `expandValidate/` was built to protect (the kernel must not itself import Synthesize/Identify/LLM logic). Concretely still undesigned: (1) an addressable notion of *pipeline stage* a backtrack outcome can name as its resume point --- nothing today re-enters a stage after it finishes, everything runs once; (2) a bounded-retry / cycle-detection rule, since backtrack-and-retry is an optimistic-concurrency loop that a human reissuing a failed command today accidentally bounds, and automating it removes that natural backstop; (3) a cost/latency call --- an automatic backtrack that re-invokes an LLM spends Bedrock latency/cost on the *original* command rather than only on a player-initiated retry, a product tradeoff as much as an engineering one; (4) context-threading discipline, so a backtrack carries the specific invalidating fact rather than triggering a blind full re-run. **Until this is built, every commit-time `defer`/staleness discovery fails the command outright and asks the player to reissue it --- a real, working, but deliberately temporary answer.** **Concrete grounding added (2026-07-17):** open item (1) now has a real anchor --- iteration 2's BD-19 (1) committed the LLM proposer to three distinct fallback entry points (identity-only / plan-only / joint), so a future backtrack could plausibly target "redo the identity-only fallback with this new constraint," not just an undifferentiated whole-pipeline retry. **Generalized (2026-07-18): the backtrack channel isn't specific to Synthesize -> Identify --- it's the general answer to "how does a later stage tolerate an earlier stage's fault without recapitulating that stage's own logic."** Concretely raised for **Parse** (iteration 3's consolidation of classify's `objectSpans` extraction + `frameExtract`): once Parse produces a tokenized command skeleton, it will sometimes get the structure wrong (e.g. `["get bag", {referent: 1, span: "from"}, "table"]` --- a verb/referent run-on, a referent placeholder over a preposition, a stray unlabeled trailing token). **Explicitly rejected as the answer:** trying to deterministically verify or repair Parse's output downstream by re-deriving structure from the raw command string --- concluded a "fool's errand" for LLM-emitted spans specifically (see iteration 3's BD-21), since the codebase has no constrained decoding anywhere in its Bedrock invocation path, and the cases where a span isn't literally faithful to the command are disproportionately the cases where the model did something valuable (typo correction, paraphrase) --- gating on string fidelity would penalize good behavior, not catch bad behavior. **The sound answer is this same Backtrack pattern:** a later stage that cannot make sense of Parse's skeleton emits a structured critique back to Parse rather than either silently guessing or reimplementing tokenization itself --- e.g. "'get bag' is not any recognizable verb on its own," "'from' doesn't match any object," "'table' is an unknown modifier" --- and Parse re-attempts with that advisory as added context. **This is a concrete, worked design for open item (4), context-threading discipline** --- a structured critique payload, not a blind full re-run. **Still open, and now more urgent, not less, since Parse becomes a fourth addressable backtrack target alongside BD-19's three fallback entry points:** items (1) addressable pipeline-stage resume points, (2) bounded-retry/cycle-detection, and (3) the cost/latency tradeoff --- none of these are resolved by generalizing the pattern's scope; broadening it just means more of the pipeline will eventually depend on them being solved. | Synthesize-stage compiler (Grounding/Expansion result shapes); persistence kernel (`applyTransferSet`, future `sameHost` commit-time recheck); iteration 2 (BD-19 fallback entry points); iteration 3 (BD-21, Parse-stage tokenized skeleton, fourth backtrack target) | **Named, not scoped** |

## Recommended order

Use `[ ]` for pending and `[X]` for complete.

- [ ] Design an addressable notion of *pipeline stage* a backtrack outcome can name as its resume point (open item 1) --- the prerequisite every other item below depends on.
- [ ] Design a bounded-retry / cycle-detection rule (open item 2).
- [ ] Decide the cost/latency policy for an automatic Bedrock-spending backtrack on the original command (open item 3).
- [ ] Implement the context-threading / structured-critique payload shape (open item 4) --- the corrective-advisory design above is a worked example, not yet code.
- [ ] Open the terminal-failure result types (`GroundReferentResult`, `GroundChangeResult`, `ExpandTransferMembershipResult`) to a third outcome, per the "Action for now" note above.
- [ ] Wire a first real backtrack target once iteration 2 or iteration 3 has a stage worth targeting --- likely BD-19's identity-only fallback (simplest, already real) or Parse (once iteration 3 ships), whichever is closer to done first. **Concrete prerequisite identified (2026-07-18):** `identityOnlyFallback.ts`'s `IdentityOnlyFallbackInput` type (`enrich/objectManipulation/fallback/identityOnlyFallback.ts`) has no field for a corrective advisory today --- a real backtrack into this fallback needs to hand it something like "the identity you picked failed Synthesize's `sameHost` check," per the corrective-advisory design above, and nothing populates or reads such a field yet. Add it (and thread it into `buildIdentityOnlyFallbackPrompt.ts`) as part of wiring this target, not before --- don't add an unused field ahead of the shape this item's own open questions (1)-(4) haven't settled yet.
- [ ] Once the structure exists and one target is wired, decompose iteration 5 (individual backtrack upgrades, per branch) into its own build sequence, the way BD-19's fallback build was decomposed --- not attempted in this plan yet.

## Verification

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/synthesize/ \
  dataSource/positions/positionGraph/expandValidate/
```

## Progress

| Milestone | Status |
| --- | --- |
| BD-18 named | Done (2026-07-14) |
| Generalized to a Parse-inclusive pattern; corrective-advisory design recorded | Done (2026-07-18) |
| Split out from the original single planning doc | Done (2026-07-18) |
| Addressable resume points, bounded retry, cost/latency policy | Not started |
| First real backtrack target wired | Not started |
