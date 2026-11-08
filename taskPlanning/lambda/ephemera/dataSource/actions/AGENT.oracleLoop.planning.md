# Oracle loop: a comparative oracle and an improvisation engine

**Status (2026-11-08):** design stage, opened 2026-11-07 from the retired judgeFailures plan. **Code is in scope** at the fixture builder, Slice 1 of [Recommended order](#recommended-order), ordinary built code with its own tests, and at the oracle harness, Slice 3, probe tooling built as a Prototype, its obligations stated before any code. Slice 0's [corpus](AGENT.oracleLoop.corpus.planning.md) is done, rewritten by function under JF-18 and read by the user. Slice 1's fixture builder is done (2026-11-08): `buildScene` builds `teaTable` and `teaTableCupOnFloor` as their hand-written graphs, and the tavern's hammer dial registers `tavernHammerOnFloor`. Next: Slice 2, the oracle input types. The built judge prompt (v45) is unchanged and stays as it is ([`calibration/AGENT.md`](../../../../../lambda/ephemera/calibration/AGENT.md#the-built-judge-prompt-v45)).

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md), in its design-stage variant, [`AGENT.designVariant.md`](../../../../AGENT.designVariant.md). Companion files: the [proposal record](AGENT.oracleLoop.proposals.planning.md), the [evidence corpus](AGENT.oracleLoop.corpus.planning.md) and the [reasoning trail](AGENT.oracleLoop.discussion.planning.md). Decision rows keep the `JF-n` IDs they had in judgeFailures, since IDs are stable and moved prose cites them.

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) and [`AGENT.designVariant.md`](../../../../AGENT.designVariant.md) once: this plan graduates resolved rows into a Settled register and licenses code by tier.
2. Read the [design body](#the-design) below, the corpus's [How a case is written](AGENT.oracleLoop.corpus.planning.md#how-a-case-is-written), then the [proposal record](AGENT.oracleLoop.proposals.planning.md). Its [live and superseded table](AGENT.oracleLoop.proposals.planning.md#live-and-superseded) says which sections are live. [A comparative oracle](AGENT.oracleLoop.proposals.planning.md#a-comparative-oracle) is the direction. [Where the labels would land](AGENT.oracleLoop.proposals.planning.md#where-the-labels-would-land) is retained but likely superseded, and [Testing it](AGENT.oracleLoop.proposals.planning.md#testing-it) is superseded.
3. Read the built prompt and how Micro reads prompts: [The built judge prompt (v45)](../../../../../lambda/ephemera/calibration/AGENT.md#the-built-judge-prompt-v45) and [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro). The built form is [`frameJudge.ts`](../../../../../lambda/ephemera/dataSource/actions/sceneProse/frame/frameJudge.ts) and `judgeRulesLines` in [`sceneRules.ts`](../../../../../lambda/ephemera/dataSource/actions/sceneProse/sceneRules.ts).
4. Read the [Judge probe](../../../../../lambda/ephemera/calibration/AGENT.md#judge-probe) subsection: the `JudgeProbe` event, the `instructions` and `sceneText` overrides, and `proposedOutcome`.
5. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md); if commands conflict, follow it. Baseline, from `lambda/ephemera/`: `npm run test -- --watchAll=false </dev/null`, last 4474 passed, 9 skipped, and `npx tsc --noEmit </dev/null`, no output.

## What is inherited as settled

Premises carried from the judgePrompt and judgeFailures plans. The full text of each is in the [reasoning trail](AGENT.oracleLoop.discussion.planning.md#settled), and the user's notes are [there too](AGENT.oracleLoop.discussion.planning.md#the-users-notes). Where this plan reopens one, it does so explicitly.

| Premise | Consequence here |
| --- | --- |
| **Fiction is not a simulation** (notes 15 to 17): fiction establishes relations, not positions; people check a scene against physics and abstract back; reasoning is lazy, reconsidering only the facts an action touches | Kept. The oracle judges candidates in this register |
| **Open world** (JP-9): what is unstated is not established as present or absent; details become established when newly relevant; plausible improvisation is wanted, convenient improvisation is not; silence can be evidence | Kept. The stretch formula builds on it |
| **"You" is the player** (JP-3), **"text adventure" not named** (JP-7), **the `SECURED` passage stays out** (JP-5), **no further text on the lazy view** (JP-11) **or on transitory facts** (JP-12) | Kept, as rules for the scene render and prompt text |
| **Rule wording** (JP-1, M28 to M30): a rule states an invariant under a handle and gets a verdict | Kept. The scene's `Rules` section is unchanged |
| **Module boundaries** (JP-8): `Reading the scene`, `Reading player intent` and `Improvising` are reusable modules | Kept. An oracle draft reuses them |
| **A little dumb, never recalcitrant** (note 19) | Kept. It bounds the method dial: elaborating a player's own method is never limited (JF-16) |
| **A direct attempt on a rule** (JP-14, note 29): a plan aimed at the obstacle names it in `Revises`, not `Obstacle` | Kept. It is the shape of a found out |
| **Grade by what an error costs** (JP-13's fault tolerance): a wrong `simple` has no recovery | Kept, in a new form: wrongly calling an invalid candidate better has no recovery, wrongly calling it worse costs a turn |
| **Improvised details go to `contingent`, sure or unsure** (JP-13) | Reopened if `contingent` means the player named the piece (JF-7) |
| **Five labels plus `confusing`** (JP-6), **one-word `Answer` routed by code** (JP-15) | Reopened: the oracle's product is a verdict and a direction, routed on structured lines (JF-5) |
| **`impossible` as a mismatch of shared reality** (JP-10), with `Role`'s (b) and (c), and `impossible`'s priority in `Answer` (v41) | Reopened by JF-5. Its touchstone, respect for player ingenuity, survives and is what the method dial protects |
| **The replacement rule** (JF-1), and table in cup as a protected pass expecting `impossible` | Applies to the built v45 only ([calibration](../../../../../lambda/ephemera/calibration/AGENT.md#the-built-judge-prompt-v45)). Nothing here replaces the built prompt until the loop is wired in. What it protects in place of table in cup's `impossible` is JF-5's |
| **The Coyote refinement** (user, 2026-09-24): physically impossible attempts are "still rejected" | My reading is that it survives: the motorcycle still doesn't go on the shoebox, and the refusal reads differently and can be answered. To confirm |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

0. [X] **Slice 0: The corpus.** Rewritten by function under JF-18: the measured cases classified as oracle, engine or loop cases, and the to-write list written in the same shape, each with a one-line limit on v45 and no solutions. No new v45 baselines.
   - [X] Measured cases rewritten, to-write cases written (2026-11-07)
   - [X] The user's read (2026-11-08): OC-16's lid and OC-22's hearth established, OC-21's split, the scene wordings, the rubrics and OC-10's hammer fix agreed; no sorting errors or missing cases
1. [X] **Slice 1: Fixture builder.** Scene variants from one description, through the instruction set production uses for authored placement, so that a corpus case names its configuration instead of a hand-copied fixture (user's proposal; the population route is mine, agreed 2026-11-08). The hand-written core holds the hosts and their names; each configuration places things from nothing with `rootStep` and `containmentPopulationSteps`, adds relations as `establishRelation` steps, and is applied by `applyStepSequenceCore`, all synchronous, so a built variant is an ordinary `SceneFixture` at module load and every reader of `graphs` is unchanged. Dials are choices of where a thing is first placed, not moves from a default, so two dials touching one host compose through the kernel. Not the move planner: its graph walks await `getGraph`, which in production reads the internal cache. Ordinary built code, not a Prototype: the fixtures are production code with their own tests. The existing hand-written fixtures stay as they are, since they pin the fold independently of population.
   - [X] `containmentPopulationSteps` takes an optional `hostingKind`, defaulting to `defaultHostingKind`'s (`settleMembership.ts`), the kind a move's arrival gives, and throws on one `admissibleHostingKinds` doesn't allow for the host and member, the default included (user). Its one caller, `populateContainmentAtCache`, keeps the default. `authoredHostingKind` is deleted: it gave an Object under a Character `In`, which the pairing rule refuses, and the user chose `defaultHostingKind`'s `Held` (2026-11-08; [trail](AGENT.oracleLoop.discussion.planning.md#population-takes-a-kind-2026-11-08))
   - [X] Check that population places a thing into a character's hand with `Held`. It does, once the actor holds a Base: population names the parent's `PRESENCE#Base` only, by contract, and the hand-written fixtures' actors hold one binding called `inRoom`, so population into them writes nothing. A character holds exactly one binding, so the builder's core writes the actor's one binding as Base, pointed at the room's Base. Held placement needs no step of its own; unit tests apply both shapes (2026-11-08; [trail](AGENT.oracleLoop.discussion.planning.md#held-placement-needs-a-base-2026-11-08))
   - [X] The builder supplies its own binding IDs, since a second binding gets `uuidv4()` and a fixture must build the same each time. A host's first binding is Base by rule; a second one gets a descriptive name, not an invented UUID (user, 2026-11-08). Done: `containmentPopulationSteps` takes `{ hostingKind, bindingName }`, and the builder throws on a further binding with no name. Edge IDs were already the caller's (`assignEdgeId`), so the builder supplies those as production's tie does (2026-11-08)
   - [X] The builder, with names and glosses as a plain override, so that a theme variant (OC-12, OC-13, OC-24 and OC-25) is a names change only. First, the two fixtures' hand-written graphs are renamed to what population writes: each non-room host's first binding becomes `Base` (the table's `onFloor`, the actor's `inRoom`), and the pointers and covers naming it follow (user, 2026-11-08; [trail](AGENT.oracleLoop.discussion.planning.md#hand-written-bindings-renamed-to-base-2026-11-08)). Acceptance: `teaTable` and `teaTableCupOnFloor` built through it come out identical to those renamed graphs. To check when building, mine: whether the comparison is sensitive to node order, and whether the kernel fills the parent's cover when a child binding is added. The other fixtures' renaming is cleanup left to a later slice (user, 2026-11-08). Done as `buildScene` (`sceneFixtures/buildScene.ts`); both build as the renamed graphs, node order included. The checks: the kernel fills covers, in placement order; the order is sensitive, so the renamed graphs put each binding ahead of the members, as population writes it. The rename also dropped the `Justifies` edge's `e3`, an ID production's tie never writes, and `hostGraph` stores no `edges` key on a graph given none. Goldens unchanged (2026-11-08; [trail](AGENT.oracleLoop.discussion.planning.md#fixture-builder-built-2026-11-08))
   - [X] The `tavern` hammer as the first dial, held or on the floor, with the floor variant registered by name for OC-10 and JF-11's example. On the floor, not on the table, as first written: with the hammer already on the table, putting it there does nothing (user, 2026-11-08). Done: `tavernDescription({ hammer })`, with `tavernHammerOnFloor` registered, its goldens and a one-request judge set. The held variant builds to `tavern`'s answers (2026-11-08)
2. [ ] **Slice 2: Oracle input types, no code.** What passes into the oracle is the interface between the two phases, so it is designed before the harness builds it (user's question, agreed).
   - [ ] Requirement half: sweep the corpus's oracle parts for every input they use. A first pass: scene and request; the answer-to-beat, empty or a finished answer; candidates, as steps each supplied by the player or the system, with their stretches and what they reuse and add, the template's `proposal` being one source; known issues; what has been tried and why it lost; the frontier with each repair; the method dial, exposition drive and charity budget; a fact's role; earlier turns.
   - [ ] Read where the loop will join the pipeline (CA-6 and the [command attempt phase](AGENT.commandAttemptPhase.planning.md)'s outcome types), so the types are shaped by that place without being wired into it. Findings go on that plan.
   - [ ] Representation half: a type sketch, mine, for the user's approval. Prototype tier, not locked. A field resting on an open row (JF-12 earlier turns, JF-15 the dials, JF-16 provenance, JF-17 a fact's role) takes the simplest form that holds the corpus's cases and is marked with its row; no row is settled first. Known issues, what has been tried and the frontier are what an earlier turn produced, so the sketch says what has to come out of a turn and leaves its wording to the drafts.
3. [ ] **Slice 3: Oracle harness.** Probe tooling, built as a Prototype. Before any code, state the tier's three obligations: classified as a Prototype; a dependency tag, so the rollback set stays known; and a rollback trigger: a draft having to say something about its inputs that the slots can't hold, and falling back to `sceneText` to say it.
   - [ ] Fixture cases keyed by corpus case ID, each a request plus its oracle inputs, in Slice 2's types, since one request carries several cases (OC-6 and OC-30) and one request runs on several scenes (OC-12, OC-13, OC-20 on `teaTable`'s).
   - [ ] The scenes and requests the corpus marks as needing a fixture, as builder configurations where Slice 1's dials reach (OC-19's held hammer at the tea table), hand-written where they don't yet (OC-20's chain to a wall needs a wall created).
   - [ ] A probe field that renders the inputs after `End of scene.`, with a default framing a draft can override, as `proposedOutcome`'s `framing` and `explanation` are, so that wording stays in the drafts.
   - [ ] A read-only mode: the existing form check against the instructions' numbered steps, and no label grade, which means nothing for an oracle draft.
4. [ ] **Slice 4: Oracle drafts.** Draft 1 is a fresh `instructions` text: the reusable modules (`Reading the scene`, `Relations and frames`, `Reading player intent`, `Improvising`) word for word, with a new `Role` and `Task` for the comparative oracle (mine). Draft 1 is the baseline, and one change per draft from there. Its first batch also answers whether Micro reads a candidate at all, which the proposal block left in doubt; if Micro can't, Nova 2 Lite comes in here. Cases: the corpus's oracle cases, with OC-6 and OC-30 (pour), OC-11 (table in cup on the floor), OC-7 (wipe), OC-5 (teapot), OC-12 and OC-13 (the dungeon and doll-house), and OC-1 as a guard first.
   - [ ] Graded by reading until the drafts settle their verdict and direction lines.
   - [ ] Then a comparative grading mode over those lines.
5. [ ] **Slice 5: The loop by hand.** The user or I play the engine, following the oracle's directions over a few turns, to test whether directions are usable before any engine exists. The corpus's loop cases (OC-30, OC-31) are its first material.
6. [ ] **Slice 6: An engine stub, its fixtures and a multi-turn probe,** starting with a check of Micro's tool calls, since everything else in the loop depends on it. The engine's inputs get fixture cases here, from the corpus's engine parts, under the same Prototype obligations as the harness. A turn limit, and an exit where the default wins.
7. [ ] **Slice 7: Handoff.** Where the loop joins the pipeline (CA-6 and Slice 4 of the [command attempt phase](AGENT.commandAttemptPhase.planning.md)), the durable docs, and the scene projection plan's Slice 6.

## The design

The user's reframing (2026-11-07): the oracle answers a different question. Given the scene, the answer-to-beat (possibly empty), the open questions, conflicts and challenges known to it, and a proposed new answer, it asks whether the new answer is better, whether there is an untested idea for doing better than the answer-to-beat, and if so how the improvisation engine should be prompted for further candidates. The oracle and the engine are two phases of one thing, not two engines pursuing different aspects of the goal (user). The full design and its history are in the [proposal record](AGENT.oracleLoop.proposals.planning.md#a-comparative-oracle).

The vocabulary the rows argue in:

- **Answer-to-beat:** the best finished product so far, what returns if the loop stops now. It starts as the floor, "I don't see how".
- **Candidate, or completion:** the request plus whatever has to be true for it, saying what it reuses and what it adds, and who supplied each step.
- **Frontier:** one or two candidates that lost as products but have a repair worth a turn. Potential never displaces the answer-to-beat.
- **Direction:** what the oracle writes when it has an idea. It goes to the player (what and how questions, readings) or to the engine (improvisations, worlds).
- **Stretch:** what a candidate needs that isn't established, the cost in the [formula](AGENT.oracleLoop.proposals.planning.md#judging-an-improvisation). Exposition value and challenge are what a stretch is worth.
- **Method dial:** how much of the how the system may supply, separate from the charity budget over facts (JF-15). A fact's role, challenge or texture, sets where it bites (JF-17).
- **Found out, granted out:** a found out is the player's own method over established facts, and earns credit. A granted out is a favourable stretch from the system.
- **Elaborating, substituting:** filling in the steps of the player's own method, which is unbudgeted, against supplying a method the player didn't bring, which the dial limits (JF-16).

## Open decisions (design --- plan only)

Decisions made in order to design. Resolved rows graduate to the [Settled register](#settled-register) below.

| ID | Question | Constrained by | Status |
| --- | --- | --- | --- |
| JF-2 | Does the oracle need a way to say "possible, and hard", the user's `challenging` ([Question 1](AGENT.oracleLoop.proposals.planning.md#question-1-a-feat-the-labels-cannot-name)), and until then what does the `tavern` trestle expect? Under JP-14 the skill question isn't the judge's, which would have it wait for real rules and skills, with the trestle `simple` until then (mine). That would drop the user's own proposal, so it is the user's call | JP-14; OC-9 | Open |
| JF-5 | Is there no separate `impossible`: one "I don't see how", the floor, with the most useful sentence available, in place of `obstructed`, `impossible` and `confusing` ([How it got here](AGENT.oracleLoop.proposals.planning.md#how-it-got-here))? If so, what the reopened premises in the [inherited table](#what-is-inherited-as-settled) become. The comparative oracle makes the label less central, since its product is a verdict and a direction | JP-6, JP-10, JP-15 | Open |
| JF-6 | Deduced vs. improvised. Does "grounded" mean established and improvised items, or only "specific, singular, established" ones (the user's alternative)? Mine: the line between deduced (a teapot's lid) and improvised (a parlour's cloth) may be pass one at its strongest, a stated detail that presupposes the thing. The user's test for a presupposed part, from OC-16's lid (2026-11-08): it counts as established if its absence would justify a specific call-out. Takes in `Improvising`'s roof ([still open](AGENT.oracleLoop.proposals.planning.md#still-open-from-the-v29-to-v45-drafts)). The user's two axes, two passes, fusion of themes, narrative value, the formula and the rest are under [Judging an improvisation](AGENT.oracleLoop.proposals.planning.md#judging-an-improvisation) | JP-9, JP-13 | Open |
| JF-7 | Does `contingent` mean the player named the piece ("requested", in the user's first cut)? Then "light the candle" with no match mentioned is tool unclear. It departs from JP-13 and from `Improvising`'s "you suggest it". My question, unanswered | JP-13 | Open |
| JF-8 | Who answers the fourth axis, what logic at this level can persist: Micro, code from a matched template and a legal dry run, or Micro by [trying](AGENT.oracleLoop.proposals.planning.md#finding-out-by-trying) (the user's alternative)? The loop leans to trying, with the template as the cheapest first candidate | JF-14 | Open |
| JF-10 | Does "how much do I understand?" need degrees short of complete, or is it effectively yes or no (mine)? | | Open |
| JF-11 | What makes a step "necessary" in plan incomplete? "Put `[hammer1]` on `[table1]`" also leaves out picking it up, and rightly stays `simple`, in `tavernHammerOnFloor`, the tavern with the hammer on the floor (Slice 1; the base fixture has it held, OC-10). My candidate: a missing step is one an established fact demands and nothing in the request acts on. Bears on JF-16's elaborating | OC-10 | Open |
| JF-12 | Does a request go back through the oracle once its piece is established, or once the player answers a follow-up? The answer-to-beat and its known issues are the memory between turns, which may answer this (mine) | JF-14 | Open |
| JF-13 | Does charity go in `Reading player intent`, and how is it limited, so that it stays generous about what the player means and not about what is established (mine)? | JP-9 | Open |
| JF-15 | One dial or two: a [method dial](AGENT.oracleLoop.proposals.planning.md#a-comparative-oracle) separate from the charity budget (mine), or one input for how much the system may do for the player? | | Open |
| JF-16 | Is the line between elaborating a player's method and substituting one right, with a repair the system adds to the player's method counted as elaborating (mine)? | Note 19; JF-11 | Open |
| JF-17 | Is a fact's role, challenge or texture, inferred from the scene's themes, authored, or both (mine)? | | Open |

### Settled register

| ID | Question | Verdict | Settled | Detail |
| --- | --- | --- | --- | --- |
| **JF-14** | Is the comparative oracle the direction, and where does it live? | The comparative oracle (user) is the direction, inside a loop with an improvisation engine, in this plan; the judgeFailures plan retired. JF-5, JF-8 and JF-12 stay open here | 2026-11-07 | [A comparative oracle](AGENT.oracleLoop.proposals.planning.md#a-comparative-oracle) |
| **JF-18** | Is the oracle measured against v45, across the seam between one judge and a loop? | No: the seam is crossed now. v45 is a source of cases, reusable modules and wording findings, not a metric baseline, since its labels can't carry to a verdict-and-direction product and nothing in production reads it. The corpus keeps the measured cases' scenes and requests, classified and rewritten as oracle, engine and loop cases in one file, each with a one-line limit on v45; no new v45 baselines are taken. The oracle's draft 1 is written fresh from the reusable modules and is the baseline for one change per draft. The user's framing and two-corpus proposal; one file and the loop cases mine, agreed | 2026-11-07 | [Crossing the seam now](AGENT.oracleLoop.discussion.planning.md#crossing-the-seam-now-jf-18-2026-11-07) |
| **JF-9** | Does the attempt loop get its own plan? | Yes, this one, covering improvising by the same bounded trial. A check of Micro's tool calls is the engine phase's first step | 2026-11-07 | [Finding out by trying](AGENT.oracleLoop.proposals.planning.md#finding-out-by-trying) |

## How we work

- Rules for writing a draft for Nova Micro are in [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro): one change per draft, positive rules, examples outside the fixtures' domains, and the rest.
- Each draft is a file in `oracleLoopDrafts/`, beside this plan, created with the first draft and numbered from 1. It is probed through the `instructions` and `sceneText` overrides. Code changes only at the fixture builder, the oracle harness and the engine stub.
- The user runs each probe and pastes the result. Keep batches small: the smallest call count that answers the question, at most 12 per invoke.
- Each change is attributed. Anything not from the user is labelled "mine" until accepted.

## Relationship to other plans

- [Scene projection](AGENT.sceneProjection.planning.md): its Slice 6 renders the scene this oracle reads, and its triage sub-row was handed back from judgeFailures on 2026-11-07.
- [Command attempt phase](AGENT.commandAttemptPhase.planning.md): CA-6 and Slice 4 are where an oracle joins the pipeline. Its placement notes predate the comparative oracle.

## Verification

- A draft: the probe, read reply by reply. No test commands.
- The fixture builder, the oracle harness and the engine stub, from `lambda/ephemera/`: `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`, with the built judge prompt unchanged: a flag-off `JudgeProbe` still reports instructions hash `22e97265`, since no test pins v45's bytes.
- Links: every relative link and anchor across this plan and its companions resolves.

## Progress

New trail entries go in the [reasoning trail](AGENT.oracleLoop.discussion.planning.md), not in this table.

| Slice | State |
| --- | --- |
| Opened from judgeFailures | Done 2026-11-07: design, premises, corpus of measured cases and decision rows moved |
| Slice 0: Corpus | Rewritten by function 2026-11-07 (JF-18), OC-1 to OC-31; the user's read done 2026-11-08. Done |
| Slice 1: Fixture builder | Done 2026-11-08: population's `hostingKind` and `bindingName`, `Held` placement (the actor's one binding is Base), `buildScene` building `teaTable` and `teaTableCupOnFloor` as their renamed graphs, and `tavernHammerOnFloor` |
| Slice 2: Oracle input types | Not started |
| Slice 3: Oracle harness | Not started |
| Slice 4: Oracle drafts | Not started |
| Slices 5-6: The loop and the engine | Not started |
| Slice 7: Handoff | Not started |

## Lifecycle

When the initiative finishes, follow the variant's [When the initiative finishes](../../../../AGENT.designVariant.md#when-the-initiative-finishes): the Settled register is the disposal checklist, method findings are harvested first, and the corpus is asked whether it graduates somewhere durable. Then delete this plan, its companions and `oracleLoopDrafts/`.
