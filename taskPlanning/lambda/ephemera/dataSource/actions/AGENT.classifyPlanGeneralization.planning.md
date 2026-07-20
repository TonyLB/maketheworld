# Classify narrows, Plan generalizes: deterministic-first command/question routing (iteration 7)

**Status:** **Named and designed through conversation, 2026-07-20 --- not yet decomposed into concrete build steps, deliberately (per explicit user instruction: document the design fully before entering Plan Mode).** Split out from [`AGENT.parseTokenization.planning.md`](AGENT.parseTokenization.planning.md), where this started as BD-26 ("merge classify and Parse into a single LLM hop," driven by observed production latency) --- that framing was proposed by Claude, rejected by the user as premature improvisation, and replaced through direct conversation with the design below, which is substantially larger in scope: it resolves BD-22 (Parse/Plan/Identify generalizing beyond object manipulation) rather than staying object-manipulation-scoped. See that doc's History for the full record of the rejected proposal and why.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md). Ladder position: [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md), iteration 7 (added alongside this doc).

## Purpose

Today, `classify` (`discriminateIntent`) conflates two genuinely different jobs in one 13-section LLM decision tree: (1) is this line even a legitimate, single, in-world engagement --- not noise, not a prompt-injection attempt, not multiple bundled commands --- and if so, is it a **command** (an action) or a **world question** (a question about world state); and (2), given that, *which specific* command family or question type is it. Job (2) is redundant with what a properly generalized `Plan` stage should own (BD-22's still-open question, named 2026-07-18, never resolved) --- `matchRelationalTemplate.ts` already proves this pattern works for the relational family specifically. This initiative narrows `classify` to job (1) only, and generalizes `Plan` (and, following it, `Identify`) to own job (2) across every family, not just object manipulation.

**Originally motivated by observed production latency** on object-manipulation commands (two sequential Bedrock round-trips: `classify` then `Parse`, today). **Important correction, reached through conversation:** this design does **not** cut that round-trip count --- when the deterministic layer misses, `classify` and `parse` remain two separate calls, deliberately (see Design decisions). The latency win instead comes from (a) a generalized deterministic pre-check catching more traffic before any LLM runs at all, and (b) `classify`'s own prompt shrinking from 13 sections to 5 possible outcomes, reducing per-call generation cost even on the same model tier. Both `classify`'s and `Parse`'s Bedrock invoke wrappers are already on `NovaMicro` (confirmed by reading `invokeBedrockParseCommand.ts`/`invokeBedrockObjectManipulationParse.ts` --- `novaModel.ts` only defines `NovaMicro`/`Nova2Lite`, and both hops already default to the former), so there is no model-tier downgrade left as an additional lever.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) and [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md) (this iteration's place in the ladder).
2. Read [`AGENT.parseTokenization.planning.md`](AGENT.parseTokenization.planning.md)'s BD-22 row (Parse/Plan/Identify cross-family generalization, named but never resolved) and its History entry on BD-26's rejected single-hop-merge proposal --- this doc is the resolution of both.
3. Read today's classify (`discriminateIntent/buildIntentClassificationPrompt.ts`, `discriminateIntent/intentClassification.ts`, `discriminateIntent/deterministicChecks.ts`) and the existing relational-family Plan matcher (`enrich/objectManipulation/plan/matchRelationalTemplate.ts`) --- the latter is the concrete precedent for what a generalized Plan dispatcher should look like for every other family.
4. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md).
5. Baseline:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/discriminateIntent/ \
  dataSource/actions/parseCommand.test.ts \
  dataSource/actions/enrich/objectManipulation/
```

## Design decisions (confirmed through conversation, 2026-07-20)

### Architecture: five layers, replacing today's two-stage classify-then-Parse

1. **`DeterministicTemplate` matching layer (new).** Generalizes today's flat `deterministicChecks.ts`. Matches either a **raw command string** or a **token sequence** against known templates; on a hit, returns **both** an intent classification **and** a synthesized `ParseSkeleton` (even trivial --- e.g. a single `text` token for `"look"`), at zero Bedrock cost. Must carry the same context `ParseCommandInput` already does, not just bare command text --- some matches are context-dependent (Navigation's exit matching needs live `roomExits`; membership's `get <noun>` branch needs live `roomObjectLabels` to gate acquire vs. `AcmeOrder`, exactly as `deterministicChecks.ts` does today).
2. **`classify`, narrowed remit.** Runs only when layer 1 misses. Decides exactly **five** outcomes: `MultipleCommands`, `PromptInjectionAttempt`, `Unknown`, `Command`, `WorldQuestion`. Does **not** decide which specific command family or question type --- that moved to Plan (layer 4).
3. **`parse`, per-branch, not assumed shared.** Command and WorldQuestion each get their own segmentation treatment. **Explicitly not assumed to be the same job** --- commands are imperative/verb-noun-phrase shaped; world questions are interrogative and may need different span/text handling (rejected an earlier draft of this design that assumed one shared `parse` step for both, on direct user correction).
4. **`plan`, generalized and genuinely split by branch --- this is BD-22's resolution:**
   - **Command-plan:** deterministic dispatch off the skeleton across *every* command family (Navigation, Home, AwaitRoadRunner, LookRoom, Help, AcmeOrder, `ObjectMembershipIntent`, `ObjectRelateIntent`), not just object manipulation. `matchRelationalTemplate.ts` is the existing proof of pattern. Command-shaped input that matches no known template becomes `Unimplemented`.
   - **Question-plan:** deterministic (and eventually LLM-fallback --- sub-iteration 3) dispatch among known question types. Only `PredictHypothesis` is real today; everything else is `Unimplemented`.
   - **Structurally separate, not two registries under one dispatcher --- this was a real correction, not a stylistic choice.** The downstream consumer differs entirely: a matched command needs Synthesize's Grounding/Expansion/Validation to produce a world-mutating instruction; a matched question needs to produce an *answer*, which isn't the same kind of terminal action and has no existing machinery at all. An earlier draft of this design proposed trying both registries against one skeleton and letting whichever matched win (cheap, since deterministic matching has no LLM cost) --- rejected specifically for the case where *neither* matches and an LLM fallback is needed: **a single fallback prompt asking to resolve "which command primitive, or failing that, which question type, and if a question, how do I even answer it" would degrade both jobs**, per direct user correction. Deterministic-layer sharing is fine; LLM-fallback sharing is not.
5. **`Identify`, generalized (real new-build work, not refactoring).** Span/id resolution for objects/characters is already domain-general. Navigation's exit-label resolution (`exitResolution.ts`'s `resolveExitLabelToTargetId`) and Acme's product-catalog resolution are today separate, bespoke mechanisms living outside `Identify` entirely. Folding them into one `Identify` concept is part of what "generalizing the Identify/Plan/Synthesis cluster" (sub-iteration 2) means --- these don't already share an abstraction the way BD-22 initially hoped; building it is real work.

### Confirmed scope boundaries

- **The single-hop merge (classify + Parse combined into one LLM call) is explicitly rejected**, not deferred. Claude's original BD-26 proposal assumed it would be faster; the user was not convinced it actually would be, given output-token cost likely offsets any round-trip savings, and preferred not to build complexity on an untested assumption. Two separate, narrower calls it is.
- **Membership does not get a full native Plan matcher** (mirroring `matchRelationalTemplate.ts`) as part of this initiative --- stays on Step 2a's flat `rawObjectSpans` adapter (`enrich/objectManipulation/parse/objectSpansFromSkeleton.ts` -> `compileMembershipAtomic.ts`), per explicit scope confirmation.
- **But a smaller gap this creates must still be closed in Sub-iteration 1:** today, `classify` itself decides `ObjectMembershipIntent` vs. `ObjectRelateIntent` (the membership/relational split). Once `classify`'s remit shrinks to generic `Command`, nothing decides that split before dispatch --- relational already has `matchRelationalTemplate.ts` to derive it from the skeleton; membership does not. This needs a small, real piece of logic (not a full native matcher) --- most likely adapting `deterministicChecks.ts`'s existing acquire/release verb-classification regex to run over skeleton `text` runs instead of raw command text, mirroring how `matchRelationalTemplate.ts` already derives `operationKind` from verb text. Named explicitly here so it isn't discovered mid-build and mistaken for the native-matcher work that was deliberately scoped out.

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Three sub-iterations, confirmed with the user 2026-07-20 as a deliberate staged rollout accepting temporary regressions --- appropriate here specifically because this codebase is single-dev-instance with no external consumers (see the `Pre-rollout status` note in durable memory), so a known regression window is cheap to accept and fix forward, rather than something to avoid via a slower, fully-atomic rollout.

- [ ] **Sub-iteration 1: land the routing skeleton, accepting known regressions.**
  - [ ] Refactor `classify` to the five-outcome remit (`MultipleCommands`/`PromptInjectionAttempt`/`Unknown`/`Command`/`WorldQuestion`) described above.
  - [ ] Route `WorldQuestion` directly to today's `PredictHypothesis` handling. **Accepted regression:** a genuinely different world question (e.g. "are the king's guards close enough to stop me from slapping him?") will get answered as if it were a Coyote-plan-prediction request, not flagged `Unimplemented`, until sub-iteration 3 lands.
  - [ ] Route `Command` to object manipulation's existing dispatch. **Accepted regression:** non-object-manipulation commands that classify used to handle directly (e.g. "peruse the room," a `LookRoom`-shaped paraphrase) will start failing where they previously succeeded, until sub-iteration 2 lands.
  - [ ] Close the membership-vs-relational dispatch gap (see Confirmed scope boundaries above) --- this is load-bearing for Sub-iteration 1 to actually work, not optional cleanup.
  - [ ] Decide and build (or confirm shared) `parse`'s segmentation approach for the `Command` branch specifically (the only branch that needs to actually work end-to-end in this sub-iteration).
- [ ] **Sub-iteration 2: generalize the Identify/Plan/Synthesis command-handling cluster, close the Command regression.**
  - [ ] Move the Identify/Plan/Synthesis cluster to a family-agnostic level, keeping object manipulation's current implementation as one concrete instance of the generalized shape (not rewritten).
  - [ ] Add real command-plan dispatch entries for the other command families (`LookRoom`, `Help`, `AcmeOrder`, `NavigationIntent`, `HomeIntent`, `AwaitRoadRunner`) so `Command`-routed input for these regains the coverage lost in Sub-iteration 1.
  - [ ] **Open design question, named not resolved:** `AcmeOrder` may need its own successive LLM run after intent is settled --- consistent with (not a new concern versus) its existing Synthesize-stage enrich call (`enrichAcmeOrder`'s trope/catalog affinity resolution) --- needs an explicit answer for how that fits the generalized dispatch shape before this family's entry is built.
- [ ] **Sub-iteration 3 (probably deferred): a real WorldQuestion-plan LLM fallback.** Differentiates `PredictHypothesis`-shaped requests from other question types, reporting `Unimplemented` on the rest instead of Sub-iteration 1's blanket `PredictHypothesis` routing. No concrete second question type exists yet to design this against --- named so the Sub-iteration 1 regression it closes is tracked, not started.

## Open decisions (implementation --- plan only)

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| CPG-1 | Exact `DeterministicTemplate` type shape --- must match either a raw string or a `ParseToken` sequence, and carry context beyond bare command text (room exits, room object labels) for the matchers that need it. | Sub-iteration 1 | Named 2026-07-20, not designed |
| CPG-2 | Whether `parse`'s segmentation logic is genuinely shared or genuinely separate between the `Command` and `WorldQuestion` branches --- explicitly flagged as uncertain by the user, not assumed either way. | Sub-iteration 1 (Command branch only needs an answer now); Sub-iteration 3 (WorldQuestion branch) | Named 2026-07-20, not designed --- only Command branch is load-bearing yet |
| CPG-3 | Membership-vs-relational dispatch mechanism once `classify` stops deciding it --- likely an adaptation of `deterministicChecks.ts`'s acquire/release regex to skeleton `text` runs, not a full native Plan matcher (that stays out of scope, see Confirmed scope boundaries). | Sub-iteration 1 | Named 2026-07-20, not designed |
| CPG-4 | `AcmeOrder`'s successive-LLM-run question --- does its existing `enrichAcmeOrder` trope/catalog affinity call fit as-is under the generalized command-plan dispatch shape, or does the shape need a hook for "primitive matched, now run a further LLM stage before Synthesize"? | Sub-iteration 2 | Named 2026-07-20, not designed |
| CPG-5 | Full `Identify` generalization --- folding Navigation's `resolveExitLabelToTargetId` and Acme's product-catalog resolution into one `Identify` concept alongside object/character span resolution. | Sub-iteration 2 | Named 2026-07-20, not designed |

## Relationship to existing decision rows

- **Supersedes BD-26's original framing** (single-hop classify+Parse merge) in [`AGENT.parseTokenization.planning.md`](AGENT.parseTokenization.planning.md) --- that framing was proposed by Claude and rejected by the user 2026-07-20; see that doc's History for the full record, kept there for provenance rather than duplicated here.
- **Substantially resolves BD-22** (same doc) --- the "should Plan/Identify generalize beyond object manipulation" question is now answered yes, with this doc owning the actual implementation. BD-22's row should be updated to point here once this doc's design is stable (not yet done, since this doc itself is brand new).
- **Interacts with BD-18 / iteration 4 (Backtrack channel, [`AGENT.backtrackChannel.planning.md`](AGENT.backtrackChannel.planning.md)).** Backtrack is fully unbuilt today (no live re-entry mechanism exists for any stage), so this redesign breaks nothing real --- but once Backtrack is designed, its addressable "Parse" target becomes whichever `parse` stage(s) this doc builds, not a single unified one (per CPG-2).
- **Interacts with iteration 2's BD-19** (plan-only/joint LLM fallback, [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md)), currently paused pending a stable skeleton. This doc's generalized command-plan is a superset of what those fallbacks needed --- whether they fold into this initiative's own build or stay a separate later step is not yet decided.

## Verification

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/discriminateIntent/ \
  dataSource/actions/parseCommand.test.ts \
  dataSource/actions/enrich/objectManipulation/
cd lambda/ephemera && npx tsc --noEmit
```

## History

**2026-07-20: BD-26 proposed as a single-hop merge, rejected.** Claude's initial proposal (motivated by the same latency observation) was to fold Parse's token emission directly into classify's response as a sibling field, decided in one simultaneous LLM judgment, and wrote a complete implementation plan on that basis without confirming the design with the user first. Rejected: "you were just improvising pretty much all of the design work... I'd rather be involved in the decisions, especially in a codebase this complex." Full record, including the secondary unilateral decision (bundling Bedrock prompt-caching restructuring into the same slice) that compounded the problem, lives in `AGENT.parseTokenization.planning.md`'s History, not duplicated here.

**2026-07-20: revised through direct conversation to the design in this doc**, in stages: (1) segmentation-then-classification sequencing within one LLM call ("New Parse"), (2) corrected again into a `DeterministicTemplate`-first, LLM-fallback-only-on-miss shape once the user clarified the actual mechanism, (3) `classify`'s remit narrowed further by recognizing that "is this a command or a world question" is itself a judgment classify should make (surfaced by the `PredictHypothesis`-vs-"are the king's guards close enough" tension --- both are grammatically questions, but only one is currently supported, which classify alone can't resolve without either keeping some intent-specific knowledge or deferring the distinction downstream), (4) resolved by making `WorldQuestion` a full sibling category to `Command`, each with its own `parse`+`plan` pair rather than shared machinery, specifically because Plan's downstream consumer (Synthesize vs. answer-generation) and any eventual LLM-fallback tier both diverge too much to share, and (5) staged into the three sub-iterations in Recommended order, deliberately accepting temporary regressions given this codebase's single-dev-instance, no-external-consumer status.
