# Command attempt phase

**Status:** Not started, opened 2026-09-24. Next: slice 0 (the prose format), which starts from CA-1.

This plan is task-scoped and follows [`taskPlanning/AGENT.md`](../../../../AGENT.md). It is an implementation plan, not the design variant, because the open questions are few and each one belongs to a slice.

## Why

Every command family compiles straight from Plan to an outcome: "put the paper in the basket" becomes `move OBJECT#... In OBJECT#...`. Nothing in the pipeline keeps the player's *attempt* as something later code could still reason about. That is harmless in the Coyote Game, because outcomes there are dictated by genre. But if "adjudication is trivial" shapes the design, it hardens into debt: the pipeline would have no place to put adjudication later without reworking every prompt and test.

The result language is also the wrong input for adjudication. "Throw the crumpled paper at the waste-basket" shares its *intended* outcome with "put the paper in the basket" and its *manner* with "throw a knife at a dodging monkey". Only a description of the attempt keeps both resemblances. Deciding what happens needs the method, the referents and what they are like; a `move` records only a result.

This came out of scoping iteration 2's failing corpus (2026-09-23). Iteration 2's plan now points here rather than restating it.

## Target shape

Parse -> Identify || Plan (**attempt**) -> **Adjudicate** -> outcome -> Synthesize -> Validation / dry-run veto -> kernel -> present.

- **The attempt is prose for an LLM, not a frame.** It holds the player's words, each object phrase tied to its grounded referent and that referent's description, and situation context. It has no role vocabulary (acted-on / goal / instrument) and no property schema ("aerodynamic"). Slots like those are case frames, which a symbolic reasoner needs and an LLM does not, and they would repeat the frame-extract stage retired 2026-07-20. The LLM infers whatever properties matter from the descriptions.
- **Structure goes only where deterministic code reads it:**
  - the optional *intended effect* (Plan's ungrounded primitive), which lets the fast path skip the LLM;
  - the adjudicated *outcome*, in the existing `PositionKernelOp` + peer-edge language.
- **One command can hold several intended attempts.** "Take the entire coil of rope" intends both an untie and a get. An added attempt can come from Parse, from Adjudicate, or (most likely) from a backtrack exchange (iteration 4). So the attempt is a list, even though today it always holds one. An added untie is an intended attempt, not a dissolution decided in Adjudicate, which keeps "dissolutions are consequences" intact. (Corpus row 6.)
- **The attempt carries a result.** It starts as undetermined, and adjudication records success or failure through a deterministic update (CA-2).
- **Adjudicate runs before Synthesize,** because carry closure and dissolved edges are consequences of what happened, not inputs to deciding it. **Validation stays after it,** so an adjudicated outcome still has to be legal. The dry-run veto remains the final refusal.

## Scope

This plan is **layers 0-1** of the [adjudication layers](AGENT.objectManipulationIterations.planning.md#adjudication-layers-2026-09-24):
- layer 0 is the attempt plus the seam (slices 0-2);
- layer 1 is adjudicating one attempt against one candidate (slice 3, with CA-6 deciding the feasibility verdict).

When a design question in a slice here turns out to belong to layers 2-5, record it with that layer's owner named there, and don't absorb it here.

## Premises checked against code (2026-09-24)

- **No game phase is stored anywhere.** Execution is one command, `wait` (`AwaitRoadRunner`), which runs the single-call outcome pipeline in [`coyoteGame/generators/pipelines/outcome/`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/outcome/AGENT.md) over staged objects and the cached intent. No player manipulation command runs during execution. The Coyote evaluator's failure branch therefore has no live trigger until a phase source exists (CA-5).
- **Narration only follows a committed mutation.** Per [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#narration-is-presented-only-for-a-committed-mutation), a failed commit narrates nothing. Audiences are captured mid-commit, and the copy is assembled at flush from ingredients (`characterName`, `objectShortName`) that carry no manner. A failed attempt that still gets narrated would change that contract, not just use it.
- **Parse results cross a bus boundary.** `actions` publishes payloads such as `Object Take Hold` ([`publishedEvents.ts`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts)), and `positions` consumes them in `orchestrateObjectMove`. Wherever Adjudicate runs, the attempt has to ride on that payload or be rebuilt on the far side (CA-3).
- **Descriptions are not in the catalog.** Catalog and `ludicCache` nodes carry `shortName` and an embedding. Descriptions live in the render cache (iteration 10's `DEFAULT` situation prose).

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| CA-1 | **Prose format.** What goes into an attempt: the player's words verbatim; each referent's short name, id and description; the phase; how much `ludicCache` context (the whole room, or only the referents' shard neighbourhood). Also where descriptions come from at build time (render cache read, and its cost on the fast path). Design it against 5-8 worked commands drawn from iteration 2's step-0 corpus, not invented ones. | 0 | Open |
| CA-2 | **Deterministic result update.** How code marks the attempt as succeeded or failed without touching the player's words. Leaning: the prose has one delimited result section, written by a pure renderer from the structured outcome (`pending` / `succeeded` + outcome / `failed` + how). The structured outcome stays authoritative, and the prose is always re-derived from it, never edited as a string. | 0 | Open |
| CA-3 | **Where Adjudicate runs:** on the `actions` side before publish, or on the `positions` side inside `orchestrate*`. `positions` holds `ludicCache` and the dry run; `actions` holds the skeleton and the player's words. It decides what the published payload carries. | 2 | Open |
| CA-4 | **Does narration run off the updated attempt instead of the kernel's ingredients?** For: manner lives only in the attempt ("tosses the paper at the basket"), and a failed attempt still needs narration. Against: the contract gates narration on commit and binds audience positionally; deterministic copy costs nothing and an LLM line per command costs latency. Leaning: split responsibilities. The kernel keeps commit gating and the captured audience. The copy comes from the attempt's result section, deterministically where a template exists (take/drop/give today), and an LLM renders it only where none does. Failure narration needs a contract amendment: a narrate path with no committed mutation and a live-roster audience. Coordinate with [`AGENT.relationalNarration.planning.md`](../../AGENT.relationalNarration.planning.md), which is not started and would otherwise build more kernel-ingredient narration. | 4 | Open |
| CA-5 | **Coyote phase source.** No phase is stored today (see premises). Options: derive the phase from game state (for example, "after `wait` and before reset"), store it explicitly, or ship success-only with the failure branch reached only in tests until execution-phase commands exist. This is a game-design call. | 3 | Open |
| CA-6 | **Coyote preparation rejects the physically impossible** (genre rule, 2026-09-24): a challenge succeeds ("get gigantic boulder"), an impossibility does not ("put motorcycle on shoebox"). Judging impossibility needs descriptions and world knowledge, and no size or weight data exists, so it can't be the deterministic phase switch slice 3 was scoped as. Options: slice 3 ships the phase switch only, and impossibility waits for the first LLM adjudicator; or slice 3 includes one narrow LLM feasibility check. Related later work, not this plan's: an impossible reading should eliminate a candidate from an *outcome* pool (row 5's `On` versus shoebox `Under` motorcycle), not just refuse the command. | 3 | Open |

## Recommended order

Mark pending work `[ ]` and completed work `[X]`, including nested lines, as each one is done.

0. [ ] **Design the prose format and the result update** (CA-1, CA-2).
   - [ ] Pick 5-8 commands from iteration 2's step-0 corpus: at least one take, one relational command, one "throw at", and one non-position command that should decline.
   - [ ] Hand-write the attempt prose for each, before and after its result update.
   - [ ] Record the format in this plan's CA-1/CA-2 rows. It graduates to `actions/AGENT.concepts.md` (vocabulary) when slice 1 ships.
1. [ ] **Attempt type and pure renderers.**
   - [ ] Add a `CommandAttempt` type holding the player's words, grounded referents, the optional intended effect, and the result (`pending` / `succeeded` / `failed`). A command holds a list of these; nothing produces more than one yet.
   - [ ] Add `renderAttemptProse` and `recordAttemptResult`, both pure.
   - [ ] Add unit tests pinning the slice-0 examples verbatim (the fixture is the spec).
2. [ ] **Make room in the pipeline** (CA-3). This slice changes no behaviour.
   - [ ] Build the attempt where Identify and Plan results meet, for the object-manipulation families only (rehost, membership, relational).
   - [ ] Add an `adjudicate` seam whose only implementation marks the attempt as succeeded with its intended effect. Synthesize then runs on the outcome exactly as it does today.
   - [ ] Existing route tests stay green, and one test asserts the attempt reaches the seam with its prose rendered.
3. [ ] **Coyote genre evaluator** (CA-5, CA-6).
   - [ ] Add a phase switch behind the seam. In preparation, the attempt succeeds with its intended effect (unless CA-6 adds an impossibility check), recorded via `recordAttemptResult`. In execution, it fails in an engine-authored way (also via `recordAttemptResult`), with no mutation.
   - [ ] Add unit tests for both branches. Add a payoff test through `orchestrateObjectMove` for the success branch, and for the failure branch if CA-5 gives it a live trigger.
4. [ ] **Narration from the attempt** (CA-4). Scope this slice only after CA-4 is decided; it may reduce to "no".

**Downstream:** iteration 2's steps 1 and 3 in [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md#resuming-iteration-2-2026-09-23) consume the attempt as their prompt input. Start them after slice 2, not before.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read [`actions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md) (Parse / Identify / Plan / Synthesize) and [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) (tier discipline; Narration and presentation).
3. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). If commands conflict, follow that file. Integration tests (`*.integration.test.ts`) sit outside `tsconfig`, so run the suite, not just `tsc`.
4. Baseline, which should pass before any edit (from `lambda/ephemera`):

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/ \
  dataSource/positions/manipulation/
```

## Verification

- Slices 1-3: the baseline command above, plus any new test files the slice adds.
- Slice 2 in particular: diff no snapshot or narration assertion. A slice that changes no behaviour and still needs test edits has changed behaviour.
- Slice 3's payoff test ends at the published narration or the committed graph, not at the attempt value.
