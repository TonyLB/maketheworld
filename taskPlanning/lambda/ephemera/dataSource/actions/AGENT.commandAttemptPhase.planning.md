# Command attempt phase

**Status:** Not started, opened 2026-09-24. Next: slice 0 (the prose format), which starts from CA-1.

This plan is task-scoped and follows [`taskPlanning/AGENT.md`](../../../../AGENT.md). It is an implementation plan, not the design variant, because the open questions are few and each one belongs to a slice.

## Why

Every command family compiles straight from Plan to an outcome: "put the paper in the basket" becomes `move OBJECT#... In OBJECT#...`. Nothing in the pipeline keeps the player's *attempt* as something later code could still reason about. That is harmless in the Coyote Game, because outcomes there are dictated by genre. But if "adjudication is trivial" shapes the design, it hardens into debt: the pipeline would have no place to put adjudication later without reworking every prompt and test.

The result language is also the wrong input for adjudication. "Throw the crumpled paper at the waste-basket" shares its *intended* outcome with "put the paper in the basket" and its *manner* with "throw a knife at a dodging monkey". Only a description of the attempt keeps both resemblances. Deciding what happens needs the method, the referents and what they are like; a `move` records only a result.

This came out of scoping iteration 2's failing corpus (2026-09-23). Iteration 2's plan now points here rather than restating it.

## Target shape

Parse -> Identify || Plan (**attempt**) -> expand required actions and their **challenges** -> **Adjudicate** (only if any challenge) -> outcome -> Synthesize -> Validation / dry-run veto -> kernel -> present.

- **An attempt is a list of actions, and each action holds a desired result plus the challenges that make it non-trivial** (RPG framing, 2026-09-24). Most actions have no challenge, and an attempt with none is simply done ("okay, you do the thing"), with no adjudication. Example: "take the plank" when the plank leans `Against` a wall. Expansion reads the graph, adds a second action ("dissolve `Against`"), and by definition that dissolve has no challenge. Two challenge-free actions means nothing to adjudicate. This already matches the graph's own table: [`interactionUnderTransfer.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/expandValidate/interactionUnderTransfer.ts) answers each relation kind × moved end with `dissolve` (an added action with no challenge) or `defer` (an added action with a challenge: `Under` when its subject moves, every `Custom` relation).
- **Impossibility is a challenge verdict, not a separate check.** Its verdict is *impossible*, which is not a low-odds *failed*: no dice hit the table for lifting a planet. One list with a verdict per challenge also lets impossibility eliminate one reading and keep another (corpus row 5).
- **Challenges come from two sources.** *Graph* challenges (the `defer` cells above; lock state, if it ever exists) are found deterministically. *World-knowledge* challenges (the boulder's weight, the shoebox's size) are invisible to deterministic code, so "no challenges" on the fast path means "none *detected*". In Coyote preparation a challenge always succeeds, so an undetected one only costs narration its manner ("painstakingly"). An undetected impossibility is the one that changes the outcome (CA-6).
- **The attempt's prose is for an LLM, not a frame, and is built only when an LLM will read it:** to judge a challenge, or as a fallback's prompt input (iteration 2, layer 2). Neither happens on the fast path. It holds the player's words, each object phrase tied to its grounded referent and that referent's description, and situation context. It has no role vocabulary (acted-on / goal / instrument) and no property schema ("aerodynamic"). Slots like those are case frames, which a symbolic reasoner needs and an LLM does not, and they would repeat the frame-extract stage retired 2026-07-20. The LLM infers whatever properties matter from the descriptions.
- **Structure goes only where deterministic code reads it:**
  - each action's optional *desired result* (Plan's ungrounded primitive);
  - each action's *challenges*, since "are there any?" is what lets the fast path skip Adjudicate;
  - the adjudicated *outcome*, in the existing `PositionKernelOp` + peer-edge language.
- **Actions are added from three places.** Expansion adds the relation dissolves the graph requires (above). Parse can add actions the player's words name. A backtrack exchange (iteration 4) can add actions the player agrees to: "take the entire coil of rope" intends both an untie and a get (corpus row 6), and the untie's challenge is what the exchange surfaces.
- **The attempt carries a result.** It starts as undetermined, and adjudication records a verdict per challenge (met / impossible, and later failed) through a deterministic update (CA-2).
- **Adjudicate runs before Synthesize, but after expansion.** *Which* relations must break is an input: it is where graph challenges come from. *What* happens once the attempt succeeds (carry closure, the final edge set) is still a consequence, and stays in Synthesize. **Validation stays after Adjudicate,** so an adjudicated outcome still has to be legal. The dry-run veto remains the final refusal.

## Scope

This plan is **layers 0-1** of the [adjudication layers](AGENT.objectManipulationIterations.planning.md#adjudication-layers-2026-09-24):
- layer 0 is the attempt, expansion and the seam (slices 0-2);
- layer 1 is adjudicating one attempt against one candidate: slice 3's trivial verdict (every graph challenge met), and slice 4, which exists only if CA-6 picks a feasibility verdict.

When a design question in a slice here turns out to belong to layers 2-5, record it with that layer's owner named there, and don't absorb it here.

## Premises checked against code (2026-09-24)

- **Every player command is a preparation-phase command, so no phase source is needed** (CA-5, resolved 2026-09-24). Execution is one command, `wait`, which publishes `Await RoadRunner`. Two handlers consume it in the same pass: `handleAwaitRoadRunnerForPlanOutcome` runs the single-call outcome pipeline in [`coyoteGame/generators/pipelines/outcome/`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/outcome/AGENT.md) over staged objects and the cached intent, and `handleAwaitRoadRunnerClearObjects` resets the staged objects. No player input happens in between. "Execution always fails in a specific way" is therefore the outcome pipeline's job: it adjudicates the *contraption*, not a player attempt, and is outside this plan. If execution ever takes player input, a phase source becomes a game-design change at that point.
- **Narration only follows a committed mutation.** Per [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#narration-is-presented-only-for-a-committed-mutation), a failed commit narrates nothing. Audiences are captured mid-commit, and the copy is assembled at flush from ingredients (`characterName`, `objectShortName`) that carry no manner. A failed attempt that still gets narrated would change that contract, not just use it.
- **Parse results cross a bus boundary.** `actions` publishes payloads such as `Object Take Hold` ([`publishedEvents.ts`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts)), and `positions` consumes them in `orchestrateObjectMove`. Wherever Adjudicate runs, the attempt has to ride on that payload or be rebuilt on the far side (CA-3).
- **Descriptions are not in the catalog.** Catalog and `ludicCache` nodes carry `shortName` and an embedding. Descriptions live in the render cache (iteration 10's `DEFAULT` situation prose).

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| CA-1 | **Prose format.** Framing settled 2026-09-24 (see [Target shape](#target-shape)): the structured part is a list of actions, each a desired result plus challenges, and the prose is built only when an LLM will read it (a challenge to judge, or a fallback), so its cost is off the fast path. **Context is a section built by a scope function, not fixed by the format** (2026-09-24). The right context changes across layers, so the format holds a context section and a scope function fills it. Context splits into *breadth* (which nodes and edges appear: cheap, from `ludicCache`'s room walk, `enumerateLudicCacheShards`) and *depth* (descriptions: one render-cache read each). Depth is the [reasoning gloss](../positions/ludicCache/AGENT.reasoningGloss.planning.md), not render prose (a poor fit for reasoning). It sits on the `ludicCache` node at no I/O cost, so room-wide depth costs only prompt tokens, and "referents only" is the scope function's choice about prompt size rather than a cost limit. Later scopes (e.g. following relations across rooms) swap the function, not the format; see layer 5 in the [adjudication layers](AGENT.objectManipulationIterations.planning.md#adjudication-layers-2026-09-24). **First-iteration leaning (2026-09-24), six sections in order:** (1) the player's words, verbatim; (2) referents: each phrase tied to its id and short name, plus its gloss when one exists (optional: absence is valid, and the prose falls back to the short name); (3) current state, marked as overriding the gloss (empty until a state axis exists, but the heading is always present so the convention is fixed); (4) room context from the first scope function: the whole room's structure from `ludicCache` (short names, edges in words), with glosses for the referents only; (5) actions: each one's desired result and its challenges, rendered from the structured attempt; (6) one delimited result section (CA-2). **The format does not wait for the gloss plan;** only the first LLM *reader* does (slice 4, or iteration 2's fallbacks), since nothing in slices 0-3 reads the prose. **Still open:** how a challenge is worded. A graph challenge fits the format ("the rope is tied to the post; that tie must be undone"), but whether a `Custom` edge's label carries enough to phrase it is unchecked, and world-knowledge wording depends on CA-6's detector. Slice 0's hand-written examples, drawn from iteration 2's step-0 corpus rather than invented, confirm or amend this leaning. | 0 | Open (first-iteration leaning recorded; slice 0 confirms or amends) |
| CA-2 | **Deterministic result update.** How code marks the attempt as succeeded or failed without touching the player's words. Leaning: the prose has one delimited result section, written by a pure renderer from the structured outcome (`pending` / `succeeded` + outcome / `failed` + how). The structured outcome is now a verdict per challenge (met / impossible, and later failed), with the attempt's result derived from them. The structured outcome stays authoritative, and the prose is always re-derived from it, never edited as a string. | 0 | Open |
| CA-3 | **Where Adjudicate runs:** on the `actions` side before publish, or on the `positions` side inside `orchestrate*`. `positions` holds `ludicCache` and the dry run; `actions` holds the skeleton and the player's words. It decides what the published payload carries. The relation table doesn't favour either side (checked 2026-09-24): `interactionUnderTransfer.ts` is a `positions/ludicGraph/` module, but both sides call its `boundaryEdgeOutcomes`. `actions` calls it in Synthesize's `isolatedFromRelations` step ([`executor.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/synthesize/executor.ts)), which also runs inside the Plan-stage legality dry run (`sandboxMembershipDryRun`); `positions` calls it again at commit (`planObjectMoveTransfer`). | 2 | Open |
| CA-7 | **Expansion and Synthesize share one classification.** Expansion (see [Target shape](#target-shape)) needs the same relation outcomes that Synthesize's `isolatedFromRelations` step computes today. Running both at the same point in the pipeline would be two mechanisms doing one job, so expansion should lift that classification out of Synthesize, and Synthesize should consume expansion's result. The `positions` commit recheck stays: it runs against a later snapshot, so it is a safety check, not a duplicate. Open: how Synthesize consumes the result (a pre-classified input to the executor, or the executor reading the attempt), and how a *met* verdict reaches the commit recheck, which today would still defer (this rides on CA-3's payload question). Starting point: Synthesize's defer already carries `decidable` (`Under` true, `Custom` false), which is already a split between challenge types. | 2 | Open |
| CA-4 | **Does narration run off the updated attempt instead of the kernel's ingredients?** For: manner lives only in the attempt ("tosses the paper at the basket"), and a failed attempt still needs narration. Against: the contract gates narration on commit and binds audience positionally; deterministic copy costs nothing and an LLM line per command costs latency. Leaning: split responsibilities. The kernel keeps commit gating and the captured audience. The copy comes from the attempt's result section, deterministically where a template exists (take/drop/give today), and an LLM renders it only where none does. Failure narration needs a contract amendment: a narrate path with no committed mutation and a live-roster audience. Coordinate with [`AGENT.relationalNarration.planning.md`](../../AGENT.relationalNarration.planning.md), which is not started and would otherwise build more kernel-ingredient narration. | 5 | Open |
| CA-6 | **Coyote preparation rejects the physically impossible** (genre rule, 2026-09-24): a challenge succeeds ("get gigantic boulder"), an impossibility does not ("put motorcycle on shoebox"). Impossibility comes in two kinds. *State* impossibility can be read off the graph, and the dry run already rejects it (FT-2.2's legality pruning; corpus row 10 would be this kind if lock state existed, and none does). *World-knowledge* impossibility needs descriptions, and no size or weight data exists. CA-6 is about the second kind only. In the challenge framing (see [Target shape](#target-shape)), impossibility is a challenge whose verdict is *impossible*, and the world-knowledge kind is a challenge the fast path cannot detect, so this check is really a *detector* for world-knowledge challenges. With no phase to switch on (CA-5 resolved, see premises), this check is all slice 4 would contain; without it, the Coyote evaluator is slice 3's "every detected challenge is met". Options: slice 4 is one narrow LLM feasibility check; or slice 4 is dropped, and impossibility waits for the first LLM adjudicator. Related later work, not this plan's: an impossible reading should eliminate a candidate from an *outcome* pool (row 5's `On` versus shoebox `Under` motorcycle), not just refuse the command. | 4 | Open |

## Recommended order

Mark pending work `[ ]` and completed work `[X]`, including nested lines, as each one is done.

0. [ ] **Design the prose format and the result update** (CA-1, CA-2).
   - [ ] Pick 5-8 commands from iteration 2's step-0 corpus: at least one take (row 2), one relational command (rows 3, 5), one "throw at" (row 8), and one non-position command that should decline (row 9).
   - [ ] For each, hand-write the actions and their challenges. For those with a challenge, also hand-write the prose, before and after its result update.
   - [ ] Write each prose with short names only first, and mark where the judgment can't be made. Any row marked is the trigger for the [reasoning gloss](../positions/ludicCache/AGENT.reasoningGloss.planning.md) plan's slice 6 (improvised glosses); rows 10 and 11 are the likely first.
   - [ ] Record the format in this plan's CA-1/CA-2 rows. It graduates to `actions/AGENT.concepts.md` (vocabulary) when slice 1 ships.
1. [ ] **Attempt type and pure renderers.**
   - [ ] Add a `CommandAttempt` type holding the player's words, grounded referents (each with an *optional* gloss), and a list of actions, each with its optional desired result, its challenges, and a verdict per challenge (`pending` / met / impossible). Its exact shape comes from CA-1.
   - [ ] Add `renderAttemptProse` and `recordAttemptResult`, both pure.
   - [ ] Add unit tests pinning the slice-0 examples verbatim (the fixture is the spec), with fixtures both with and without a gloss.
   - [ ] **Obligation:** this slice settles where the attempt vocabulary (the format; state-overrides-the-gloss; the prose convention) lives (`actions/AGENT.concepts.md` per the graduation note above, or elsewhere if that changes). Once settled, return to [`AGENT.reasoningGloss.planning.md`](../positions/ludicCache/AGENT.reasoningGloss.planning.md) --- its "When done" section names this slice explicitly and is otherwise fully shipped (slice 6 done, authoring-UI issue filed as ISS8187, 2026-09-25) --- graduate its Design section there and to `mtw-wml`'s component docs, then delete that plan file.
2. [ ] **Make room in the pipeline** (CA-3, CA-7). This slice changes no behaviour.
   - [ ] Build the attempt where Identify and Plan results meet, for the object-manipulation families only (rehost, membership, relational).
   - [ ] Add the expansion step: it adds the relation dissolves the graph requires, with their graph challenges, as the one place this classification runs before Adjudicate. Synthesize consumes its result instead of classifying again (CA-7).
   - [ ] Add an `adjudicate` seam whose stub keeps today's behaviour: an attempt with no challenges succeeds with its desired result; any challenge maps to today's defer. Corpus row 6 (the rope tied to a post) still silently fails at the end of this slice, on purpose.
   - [ ] Existing route tests stay green, and one test asserts the attempt reaches the seam with its actions and challenges.
3. [ ] **Coyote meets graph challenges.** This slice changes behaviour. Every player command is a preparation command, and in preparation every challenge is met.
   - [ ] The stub now records *met* for every graph challenge, so row 6's rope is untied and taken.
   - [ ] The met verdict has to reach both places that would still defer: the Plan-stage legality dry run, which today treats a candidate with a `Custom` edge as defer, and the `positions` commit recheck (CA-7).
   - [ ] Payoff test for row 6 through the real route, ending at the committed graph (the rope held, the `Custom` edge gone).
4. [ ] **Coyote impossibility check** (CA-6). Exists only if CA-6 picks the LLM check; otherwise drop this slice, since slice 3 already is the Coyote evaluator. This is the first LLM reader of the attempt prose, so it starts only after [`AGENT.reasoningGloss.planning.md`](../positions/ludicCache/AGENT.reasoningGloss.planning.md)'s slice 5 puts glosses on the cache node.
   - [ ] Behind the seam, an attempt judged impossible fails via `recordAttemptResult`, with no mutation; everything else succeeds with its desired result.
   - [ ] Add unit tests for both outcomes, and a payoff test through `orchestrateObjectMove` for each.
5. [ ] **Narration from the attempt** (CA-4). Scope this slice only after CA-4 is decided; it may reduce to "no".

**Downstream:** iteration 2's steps 1 and 3 in [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md#resuming-iteration-2-2026-09-23) consume the attempt as their prompt input. Start them after slice 2, not before, and, as LLM readers of the prose, after the reasoning gloss plan's slice 5.

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

- Slices 1-4: the baseline command above, plus any new test files the slice adds.
- Slice 2 in particular: diff no snapshot or narration assertion. A slice that changes no behaviour and still needs test edits has changed behaviour.
- Slices 3 and 4: payoff tests end at the published narration or the committed graph, not at the attempt value. Slice 3 is the first slice expected to change an existing test's outcome (any test pinning row 6's silent failure).
