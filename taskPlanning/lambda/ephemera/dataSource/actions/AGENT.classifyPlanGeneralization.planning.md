# Classify narrows, Plan generalizes: deterministic-first command/question routing (iteration 7)

**Status:** **Steady state, 2026-07-24.** Sub-iterations 1 and 2 shipped 2026-07-20 and are fully graduated to durable docs (see below) --- nothing left to track here for the shipped architecture itself. Two independent backlog items remain open, neither urgent, neither blocking the other: `WorldQuestion`'s LLM fallback (Sub-iteration 3, indefinitely deferred --- no second question type exists yet to design against) and CPG-6 (relational `DeterministicTemplate` wiring, a pure latency/cost optimization with no correctness dependency). This doc was trimmed on 2026-07-24 once its shipped-work narrative was confirmed fully present in `actions/AGENT.concepts.md`/`AGENT.implementation.md`; full history of the design conversation and the shipped slices lives in git history for this file (was ~130 lines before the trim).

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md). Ladder position: [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md), iteration 7.

## What shipped (durable record, not here)

The five-layer architecture (`DeterministicTemplate` matching -> narrowed `classify` -> per-branch `parse` -> genuinely-split command-plan/question-plan `Plan` -> `Identify`, deliberately not yet generalized) is documented in:

- [`actions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md) --- "Three conceptual jobs" (Plan generalizes, Identify/Synthesize stay object-manipulation-scoped, CPG-5's rationale) and "`DeterministicTemplate` (shipped 2026-07-20)".
- [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) --- classify's narrowed contract, `classifySkeletonFamily`, `matchNavigationParaphrase.ts`, `matchAcmeOrderFamily.ts`, the `DeterministicTemplate` module map, and the full `Command`-branch pipeline sequence.
- [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md) --- iteration 7's ladder row and the BD-22/BD-26 rows.

If you need the design conversation itself (the rejected single-hop-merge proposal, the staged rollout reasoning, the `LookRoom`-paraphrase review correction) --- it's in this file's git history, not duplicated here.

## Open backlog (independent items, neither urgent)

- [ ] **`WorldQuestion` LLM fallback (Sub-iteration 3).** Differentiate `PredictHypothesis`-shaped requests from other question types (today, every `WorldQuestion` is routed straight to `PredictHypothesis` handling --- an accepted, live regression). No concrete second question type exists yet to design this against; **do not start speculatively** --- wait for a real second case. Also covers CPG-2's still-open `WorldQuestion` half (its own `parse`-stage segmentation, never built).
- [ ] **CPG-6: wire relational `DeterministicTemplate` entries into the live path.** Templates are built and tested (`deterministicTemplate/`'s relational registry) but have zero production call sites --- `parseCommand.ts`'s relational branch still runs classify + Parse unconditionally. Wiring requires threading the template's synthesized skeleton into the same downstream enrich pipeline Parse's output goes into (`classifySkeletonFamily` -> membership/relational enrich) --- a distinct, nontrivial change with its own test surface. Purely a Bedrock cost/latency win on recognized phrasings; nothing depends on it for correctness.
- **CPG-5 is not tracked here anymore.** Revived 2026-07-24 as its own initiative --- see [`AGENT.perceptionKernel.planning.md`](AGENT.perceptionKernel.planning.md) (iteration 9), Phase 2.

## Verification

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/discriminateIntent/ \
  dataSource/actions/parseCommand.test.ts \
  dataSource/actions/enrich/objectManipulation/
cd lambda/ephemera && npx tsc --noEmit
```
