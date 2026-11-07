# Oracle loop: a comparative oracle and an improvisation engine

**Status (2026-11-07):** design stage, opened today from the retired judgeFailures plan. **No code is in scope** until the Prototype phase of [Recommended order](#recommended-order), and the probes before it run on the existing `JudgeProbe` overrides. Next: Phase 0, writing the [corpus](AGENT.oracleLoop.corpus.planning.md). The built judge prompt (v45) is unchanged and stays as it is ([`calibration/AGENT.md`](../../../../../lambda/ephemera/calibration/AGENT.md#the-built-judge-prompt-v45)).

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md), in its design-stage variant, [`AGENT.designVariant.md`](../../../../AGENT.designVariant.md). Companion files: the [proposal record](AGENT.oracleLoop.proposals.planning.md), the [evidence corpus](AGENT.oracleLoop.corpus.planning.md) and the [reasoning trail](AGENT.oracleLoop.discussion.planning.md). Decision rows keep the `JF-n` IDs they had in judgeFailures, since IDs are stable and moved prose cites them.

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) and [`AGENT.designVariant.md`](../../../../AGENT.designVariant.md) once: this plan graduates resolved rows into a Settled register and licenses code by tier.
2. Read the [design body](#the-design) below, then the [proposal record](AGENT.oracleLoop.proposals.planning.md). Its [live and superseded table](AGENT.oracleLoop.proposals.planning.md#live-and-superseded) says which sections are live. [A comparative oracle](AGENT.oracleLoop.proposals.planning.md#a-comparative-oracle) is the direction. [Where the labels would land](AGENT.oracleLoop.proposals.planning.md#where-the-labels-would-land) is retained but likely superseded, and [Testing it](AGENT.oracleLoop.proposals.planning.md#testing-it) is superseded.
3. Read the built prompt and how Micro reads prompts: [The built judge prompt (v45)](../../../../../lambda/ephemera/calibration/AGENT.md#the-built-judge-prompt-v45) and [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro). The built form is [`frameJudge.ts`](../../../../../lambda/ephemera/dataSource/actions/sceneProse/frame/frameJudge.ts) and `judgeRulesLines` in [`sceneRules.ts`](../../../../../lambda/ephemera/dataSource/actions/sceneProse/sceneRules.ts).
4. Read the [Judge probe](../../../../../lambda/ephemera/calibration/AGENT.md#judge-probe) subsection: the `JudgeProbe` event, the `instructions` and `sceneText` overrides, and `proposedOutcome`.
5. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md); if commands conflict, follow it. Baseline, from `lambda/ephemera/`: `npm run test -- --watchAll=false </dev/null`, last 4451 passed, 9 skipped, and `npx tsc --noEmit </dev/null`, no output.

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

0. [ ] **Phase 0: the corpus.** Write the [cases to write](AGENT.oracleLoop.corpus.planning.md#cases-to-write-phase-0) against today's model, saying which limit each hits, with no solutions. The measured cases are already there.
1. [ ] **Does Micro read a proposal at all?** The existing `proposedOutcome` probe on pour (does it notice the missing tilt?) and `teaTableCupOnFloor`'s table in cup (the size), about 6 calls, no code. Slice 2's first run showed no reply using the block. If Micro can't, Nova 2 Lite comes in here.
2. [ ] **One step of the comparative oracle, as drafts, no code.** The `sceneText` override is free text beyond naming every handle the request does, so the answer-to-beat, its known issues, what has been tried and the candidate go after `End of scene.`, with the instructions constant. One change per draft. Cases from the corpus: pour (finished answer against tip-the-table), table in cup on the floor, wipe, teapot, and the table as a guard. Graded by reading.
3. [ ] **Prototype: build the inputs and the grader.** State the tier's three obligations before any code: classified as a Prototype, a dependency tag, a rollback trigger. Then a fixture shape for the inputs (with per-step provenance on candidates), a comparative grading mode, a probe field, and the dungeon and doll-house scenes for the method dial.
4. [ ] **The loop by hand.** The user or I play the engine, following the oracle's directions over a few turns, to test whether directions are usable before any engine exists.
5. [ ] **An engine stub and a multi-turn probe,** starting with a check of Micro's tool calls, since everything else in the loop depends on it. A turn limit, and an exit where the default wins.
6. [ ] **Handoff.** Where the loop joins the pipeline (CA-6 and Slice 4 of the [command attempt phase](AGENT.commandAttemptPhase.planning.md)), the durable docs, and the scene projection plan's Slice 6.

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
| JF-6 | Deduced vs. improvised. Does "grounded" mean established and improvised items, or only "specific, singular, established" ones (the user's alternative)? Mine: the line between deduced (a teapot's lid) and improvised (a parlour's cloth) may be pass one at its strongest, a stated detail that presupposes the thing. Takes in `Improvising`'s roof ([still open](AGENT.oracleLoop.proposals.planning.md#still-open-from-the-v29-to-v45-drafts)). The user's two axes, two passes, fusion of themes, narrative value, the formula and the rest are under [Judging an improvisation](AGENT.oracleLoop.proposals.planning.md#judging-an-improvisation) | JP-9, JP-13 | Open |
| JF-7 | Does `contingent` mean the player named the piece ("requested", in the user's first cut)? Then "light the candle" with no match mentioned is tool unclear. It departs from JP-13 and from `Improvising`'s "you suggest it". My question, unanswered | JP-13 | Open |
| JF-8 | Who answers the fourth axis, what logic at this level can persist: Micro, code from a matched template and a legal dry run, or Micro by [trying](AGENT.oracleLoop.proposals.planning.md#finding-out-by-trying) (the user's alternative)? The loop leans to trying, with the template as the cheapest first candidate | JF-14 | Open |
| JF-10 | Does "how much do I understand?" need degrees short of complete, or is it effectively yes or no (mine)? | | Open |
| JF-11 | What makes a step "necessary" in plan incomplete? "Put `[hammer1]` on `[table1]`" also leaves out picking it up, and rightly stays `simple`. My candidate: a missing step is one an established fact demands and nothing in the request acts on. Bears on JF-16's elaborating | OC-10 | Open |
| JF-12 | Does a request go back through the oracle once its piece is established, or once the player answers a follow-up? The answer-to-beat and its known issues are the memory between turns, which may answer this (mine) | JF-14 | Open |
| JF-13 | Does charity go in `Reading player intent`, and how is it limited, so that it stays generous about what the player means and not about what is established (mine)? | JP-9 | Open |
| JF-15 | One dial or two: a [method dial](AGENT.oracleLoop.proposals.planning.md#a-comparative-oracle) separate from the charity budget (mine), or one input for how much the system may do for the player? | | Open |
| JF-16 | Is the line between elaborating a player's method and substituting one right, with a repair the system adds to the player's method counted as elaborating (mine)? | Note 19; JF-11 | Open |
| JF-17 | Is a fact's role, challenge or texture, inferred from the scene's themes, authored, or both (mine)? | | Open |

### Settled register

| ID | Question | Verdict | Settled | Detail |
| --- | --- | --- | --- | --- |
| **JF-14** | Is the comparative oracle the direction, and where does it live? | The comparative oracle (user) is the direction, inside a loop with an improvisation engine, in this plan; the judgeFailures plan retired. JF-5, JF-8 and JF-12 stay open here | 2026-11-07 | [A comparative oracle](AGENT.oracleLoop.proposals.planning.md#a-comparative-oracle) |
| **JF-9** | Does the attempt loop get its own plan? | Yes, this one, covering improvising by the same bounded trial. A check of Micro's tool calls is the engine phase's first step | 2026-11-07 | [Finding out by trying](AGENT.oracleLoop.proposals.planning.md#finding-out-by-trying) |

## How we work

- Rules for writing a draft for Nova Micro are in [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro): one change per draft, positive rules, examples outside the fixtures' domains, and the rest.
- Each draft is a file in `oracleLoopDrafts/`, beside this plan, created with the first draft and numbered from 1. It is probed through the `instructions` and `sceneText` overrides. Code changes only at the Prototype phase.
- The user runs each probe and pastes the result. Keep batches small: the smallest call count that answers the question, at most 12 per invoke.
- Each change is attributed. Anything not from the user is labelled "mine" until accepted.

## Relationship to other plans

- [Scene projection](AGENT.sceneProjection.planning.md): its Slice 6 renders the scene this oracle reads, and its triage sub-row was handed back from judgeFailures on 2026-11-07.
- [Command attempt phase](AGENT.commandAttemptPhase.planning.md): CA-6 and Slice 4 are where an oracle joins the pipeline. Its placement notes predate the comparative oracle.

## Verification

- A draft: the probe, read reply by reply. No test commands.
- The Prototype phase, from `lambda/ephemera/`: `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`, with the built judge prompt unchanged: a flag-off `JudgeProbe` still reports instructions hash `22e97265`, since no test pins v45's bytes.
- Links: every relative link and anchor across this plan and its companions resolves.

## Progress

New trail entries go in the [reasoning trail](AGENT.oracleLoop.discussion.planning.md), not in this table.

| Phase | State |
| --- | --- |
| Opened from judgeFailures | Done 2026-11-07: design, premises, corpus of measured cases and decision rows moved |
| 0. Corpus | Measured cases in; cases to write not started |
| 1-2. Probes | Not started |
| 3. Prototype | Not started |
| 4-5. The loop | Not started |
| 6. Handoff | Not started |

## Lifecycle

When the initiative finishes, follow the variant's [When the initiative finishes](../../../../AGENT.designVariant.md#when-the-initiative-finishes): the Settled register is the disposal checklist, method findings are harvested first, and the corpus is asked whether it graduates somewhere durable. Then delete this plan, its companions and `oracleLoopDrafts/`.
