# Triage: the first screen on a command

**Status (2026-11-24): step 1, the corpus and its bar, is done; step 2, the platform's extensions, is built. Next is step 3, triage's contract, guard and piece. Rewritten the same day to build triage wholly on the target platform ([below](#the-second-piece-on-the-platform)).** A sub-plan of the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5. It runs before the [trial question plan](AGENT.trialQuestion.planning.md)'s step 2.5 (the user, 2026-11-24).

**The idea, the user's** (2026-11-24): a triage prompt, separate from the judge. It gets just the player's command and the scene, runs only ever as the first screen, and quickly branches:
- **"No, here is why";**
- **"Yes, here are the handles";**
- **"Defer to more complicated judgment, here are the handles".**

The handles are the things the player **named**, grounded: "pour tea into cup" becomes "pour [tea2] into [cup1]". The judge, by contrast, runs in the loop, on handles, a case against and perhaps evidence, and asks "do we have enough to decide?"

**Why it comes first:** it is the archetypal start of the pipeline (the user). Mine, agreed:
- its inputs aren't manufactured: a command and a scene;
- it decides which cases reach the judge, so step 2.5's cells can be drawn from what it defers;
- its "defer" is the next stage's real input;
- it sits outside the loop, so the piece probe runs it with no mocks.

**It is also the second piece built wholly on the platform,** after `playByPlay` (the user, 2026-11-24): see below.

**What it doesn't do:** say whether Micro can ask for a consult well. That stays step 2.5's, whose middle-of-the-loop cells are still made by hand.

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md), an implementation plan under the parent's pilot of the [proposed design variant](../../../../AGENT.designVariant.proposed.md). The piece is a **Prototype** whose consumer is its reader and, after it, step 2.5's cells. What it shows goes **up** to the parent's [seam ledger](AGENT.oracleLoop.planning.md#seam-ledger).

## The second piece on the platform

**The concern, the user's** (2026-11-24): the target is a scene render and an action plan, read through a viewpoint. With one thing on a target pattern and varied legacy code beside it, recommendations pick from both. With two or three things on it, migrating the rest is plain. So triage is built wholly on it, as a chance to pin it down. What follows is mine, agreed the same day.

**The platform and a piece's settings are different things.** The platform is the structure: inputs through a view, the plan, the change language, standing, the merge. A setting is one piece's value on one of its axes (`playByPlay`'s `conditions`, `consequences`' sub-scene), chosen for that piece's job and never copied without its own reason.

| | Triage on the platform |
| --- | --- |
| Input | A plan whose one step is the player's raw command, built by code, and the scene, both through triage's view |
| Grounding | A restatement of that step (`says`, `intent`) |
| Proposals | The step record, merged with author `triage`. It is no kind's authority, so what it writes is unchecked |
| A bad block | Refused whole, as for every piece |
| Verdict | `kind`, and `reason` on "No", beside the merge |
| Scene | The explicit render; each axis a declared view setting ([settings](#triages-settings)) |

**Where the platform falls short, it is extended** (step 2), not worked around here:
- **E1. An answered piece that merges. Built 2026-11-24.** `merges` was a read piece's field, and the registry's checks skipped answered pieces. Now both kinds share it, and a grade gives the merged plan beside its answer ([Piece probe](../../../../../lambda/ephemera/calibration/AGENT.md#piece-probe)). Every judge will need it.
- **E2. A restatement that answers no request. Built 2026-11-24.** `PlanRestate` required `answered`, and `playByPlay`'s reply reader required `missing`. Both are optional, and the step record's reader is shared ([`stepRecord.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/stepRecord.ts)).
- **E3. What an unchecked thing may stop, and what a proposal may change. Built 2026-11-24.** Locks were set by arrival and not by standing: a step was expanded once, an expanded step wasn't revised, a step took one `execution` possibility, a restatement ignored the standing of what it revised, and a detail proposed on a confirmed item minted a copy. The rule, agreed with the user: an unchecked item never refuses a change, and only its authority alters a confirmed one ([What standing protects](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan)). It followed that the raw command is built as an unchecked step.
- **E4, held: a securing wording for pieces that ask "can it?"** The better form may be the securing axis as a choice of rule parts, as the rule cell's `ruleParts` is, with today's values as named sets; built only if a draft shows the existing ones fall short ([TI-7](#open-decisions-implementation--plan-only)).

**Departures from the platform:** each needs a reason and the user's decision, and is written here before it is built. Legacy pieces are read for evidence, never for form.

| Departure | Reason | Decided |
| --- | --- | --- |
| None | | |

### Triage's settings

| Axis | Setting | Reason |
| --- | --- | --- |
| Plan kinds read | `step` and `intent` at `all`, nothing else | Its plan holds nothing else; a piece that restates reads the intent at `all` (the checker's mirror) |
| Scene shown | `whole` | Grounding has to happen before there are handles to take a sub-scene of |
| Render | `explicit` | The direction for every piece (the user, 2026-11-18) |
| Securing | `conditions`, **for the first draft** | **Picked for convenience, not a long-term requirement** (the user, 2026-11-24): an existing value that has the parts triage needs, built for `playByPlay`'s job. Nothing may cite it as a precedent, and any draft may change it ([TI-7](#open-decisions-implementation--plan-only)) |
| Scene's own Rules section | Off | It is v45's wording |
| Merge | author `triage`, `restates`, adds `consequence`, with `rules`, and `steps` ([what standing protects](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan)); no possibilities in the first draft (the user, 2026-11-24) | |

## Getting Started

1. Read the parent's [Triage item](AGENT.oracleLoop.planning.md#recommended-order) (Slice 4.5), then step 2.5 of the [trial question plan](AGENT.trialQuestion.planning.md#recommended-order), which follows this plan.
2. Read the prior art:
   - the triage of 2026-11-04, the "judge's answer format" row of the [scene projection plan](AGENT.sceneProjection.planning.md)'s Slice 6;
   - where it was to sit in the pipeline, [CA-6](AGENT.commandAttemptPhase.planning.md);
   - what it grew into, [the built judge prompt (v45)](../../../../../lambda/ephemera/calibration/AGENT.md#the-built-judge-prompt-v45).
3. Read calibration's [The action plan](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan), [Piece views](../../../../../lambda/ephemera/calibration/AGENT.md#piece-views), [Scene renders](../../../../../lambda/ephemera/calibration/AGENT.md#scene-renders), [Piece probe](../../../../../lambda/ephemera/calibration/AGENT.md#piece-probe) and [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro). The first three are the platform.
4. Read the code it builds on:
   - [`imaginationPieces/playByPlay.ts`](../../../../../lambda/ephemera/calibration/imaginationPieces/playByPlay.ts), the piece on the platform: its view and contract. Its settings are its own;
   - [`oracleLoop/stepRecord.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/stepRecord.ts), the step record's reader and merge, which triage's contract calls with `kind` and `reason` taken off first;
   - [`oracleLoop/actionPlan.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/actionPlan.ts): `planOf`, `viewPlan`, `mergeStepChanges`, `AUTHORITY`, `MergeOptions`;
   - [`pieceProbe/oraclePiece.ts`](../../../../../lambda/ephemera/calibration/pieceProbe/oraclePiece.ts): what a piece registers, an answered piece's `grade`, a cell's `expected` and `lookFor`;
   - the registry's checks, [`pieceViews.test.ts`](../../../../../lambda/ephemera/calibration/pieceProbe/pieceViews.test.ts) and [`platform.test.ts`](../../../../../lambda/ephemera/calibration/pieceProbe/platform.test.ts), [the holdouts](../../../../../lambda/ephemera/calibration/AGENT.md#the-platforms-holdouts) list's;
   - [`sceneProse/sceneRules.ts`](../../../../../lambda/ephemera/dataSource/actions/sceneProse/sceneRules.ts): `securingWords` and `hostsOf`, which the guard needs;
   - [`sceneModel.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/sceneModel.ts) and the [scene fixtures](../../../../../lambda/ephemera/dataSource/positions/ludicCache/sceneFixtures/).
   - **For evidence only:** [`sceneReading.ts`](../../../../../lambda/ephemera/calibration/oraclePieces/sceneReading.ts) and the trial's stages.
5. Read the [corpus](AGENT.oracleLoop.corpus.planning.md)'s cases that step 1 cites, for their expected outcomes.
6. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md); if commands conflict, follow it. From `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`. Both pass before any edit.

## What is inherited as settled

| Premise | Consequence here | Whose |
| --- | --- | --- |
| Triage and the judge are separate prompts | No consult and no round state here. Its plan is the command's one step, built by code | The user's, 2026-11-24 |
| It is built on the platform | Above; a departure is listed and decided | The user's, 2026-11-24 |
| The handles are the things the player named | Triage grounds names, as the step restated. It needn't notice unnamed things, though it may propose consequences for them | The user's, 2026-11-24 |
| It asks for no follow-on | "Defer" is its follow-on | Mine, agreed 2026-11-24 |
| Code guards its "yes" | Where a securing touches the attempt, "yes" becomes "defer". A needless defer costs only calls | Mine, agreed 2026-11-24. The neighbours clause ([TI-2](#open-decisions-implementation--plan-only)) came after |
| Hiding the securing (mine, agreed earlier the same day) | **Reopened by the user:** it was carried over from `trialAgainst`, whose reason doesn't hold here. [TI-7](#open-decisions-implementation--plan-only) | Reopened, 2026-11-24 |
| Code gathers the neighbours from the named handles | The guard reads them | Mine, agreed 2026-11-24 |
| Errors don't cost the same (JP-13, the parent's [settled premises](AGENT.oracleLoop.planning.md#what-is-inherited-as-settled)) | A wrong "yes" has no recovery. A wrong "no" is recalcitrance (note 19). A needless defer costs calls | Principle, the user's; its use here mine |
| Micro is the target | No Lite arm unless the user asks | The user's |
| The explicit render | The scene, with no reading guide | The user's, 2026-11-17 and 18 |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

1. [X] **The corpus, for the user's review,** before any contract or prompt work. The draft is [below](#the-corpus), all mine.
   - [X] The user's read of each expected branch and grounding (2026-11-24: "looks good"). T-13, T-14, T-16, T-20 and T-24 settled at the branch proposed; T-15 and T-21, each proposed with two, kept open (tallied, not graded)
   - [X] The scenes checked against the explicit render, which throws on a join or a spread thing: all five render under `conditions`, and hold every grounded handle (2026-11-24, a local script)
   - [X] The bar ([below](#the-bar)) agreed (the user, 2026-11-24)
2. [X] **The platform's extensions,** in the platform, before any triage code, each tested with no LLM call and every other piece's render pins unchanged.
   - [X] **E1: an answered piece that merges.** `merges` shared by both kinds of piece; a grade that gives the answer and the merged plan; the mirror and hidden-refusal checks run over answered pieces too
      - No answered piece merges yet, so a toy one shows that the checks see it. **For step 3:** the checks run over cells whose inputs hold a `plan` and a `target`, and a merging piece with none now fails, so triage's cells hold the plan code builds from the command, not the command alone (mine)
   - [X] **E2: a restatement with no request answered.** `answered` optional on `PlanRestate`; the step record's reader shared by `playByPlay` and triage, `missing` optional in it
      - `playByPlay`'s refusal of the retired `atomic` stayed in its contract; step 3 retires it
   - [X] **E3: what an unchecked thing may stop** ([what standing protects](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan)), in the platform: sub-steps from a piece that isn't their authority, the `execution` possibility, a restatement that reads standing, and details on a confirmed item. The invariant checked over the registry; tests for the two cases run on 2026-11-24
      - **The choices building it needed** (mine; the user approved them with the slice's plan, 2026-11-24): a proposal that would change a confirmed slot refuses the block; a proposal calls only proposals into question; a sub-step given again in its own words is kept, with its claims; unchecked sub-steps stay, stale, when their step is revised without them; the step's authority confirms an unchecked step by restating it as written; a missing intent is added by anyone and revises nothing; a `thing` is filled in on an unchecked consequence; a new possibility overwrites an unchecked one; a change closed by something hidden is refused before the call
      - **What moved:** no kept batch's merges (60 to 63, and the composition run, read again through `read-plans` and `read-chains`), and no render pin. Two merge rules of `playByPlay`'s: the missing intent, and the filled-in `thing`
      - **Found, not fixed:** a block can't change a sub-step of a step it expands (refused, since the sub-step may leave); no piece does
   - [X] **`triage` as a `PlanAuthor`,** the authority for no kind
   - [X] **The holdouts list** ([the platform's holdouts](../../../../../lambda/ephemera/calibration/AGENT.md#the-platforms-holdouts))**:** the registered pieces not yet on the platform, by what each lacks (the explicit render, a plan read, the change language without `concern`), which takes in the list the explicit render had of its own. A test over the registry fails on a piece missing from it and on a listed piece that has moved, so it only shrinks. `sceneReading`, a probe of the render with nothing to plan, is exempt by name. `playByPlay` has no entry
   - [X] Calibration `AGENT.md` updated as each part lands
3. [ ] **Triage's contract, guard and piece, in code,** shaped by where they will join and not wired in.
   - [ ] **Retire `atomic` from `playByPlay`'s contract** (the user, 2026-11-24): its own message goes, and the key is refused as any unknown key is, so the contract hands its reply straight to `mergeStepRecord`. A confirmed step with no sub-steps replaces it, answering the questions in its `alreadyAnswers`. A different question may still break that step down, which is a strength of the plan for collaboration and not an edge case. With it: the two tests of the retired key, and calibration's "Refused" line
   - [ ] **The contract** ([TI-1](#open-decisions-implementation--plan-only)): the step record with `kind`, and `reason` on "No"; merged by the platform. Code reads the handles out of the restated `says` and refuses one the scene doesn't have
   - [ ] **The guard:** pure, over the full scene (with its securing) and the named handles. It turns a "Yes" into a "Defer" with the same plan. Tested on every corpus row, with no LLM call; both forms of [TI-2](#open-decisions-implementation--plan-only) tabled there, and the form chosen with the user
   - [ ] **The piece:** `triage`, registered, its view, its cells, and a grade that keeps branch and grounding apart. The view's comment, and its calibration entry, say that `conditions` is a first setting picked for convenience. No entry on the holdouts list
4. [ ] **Draft 1,** in `oracleLoopDrafts/triage/`, its rubric written first.
   - [ ] The draft and rubric, reviewed
   - [ ] Batch 1, every cell once, as two arms from the same base: the whole record (1a), and `says` and the verdict alone (1b), to measure what the outlet protects
   - [ ] The read: each failure's mechanism, branch and grounding apart; whether a wrong "No" took a securing as permanent, for want of the voiding part; and [whether it is going better than v45](#is-it-going-better-than-v45)
5. [ ] **Drafts 2 on,** one change each, every draft its own line here. **A checkpoint with the user after draft 5**: go on, split grounding from branching, or stop.
6. [ ] **The confirm:** the kept draft at three repeats, against the bar.
7. [ ] **Hand back** ([When it finishes](#when-it-finishes)): what triage defers becomes the list step 2.5's cells are drawn from.
   - [ ] **What the second piece showed:** what fitted the platform, what had to be extended, and what moving the next piece off the holdouts list takes

## The corpus

Mine, reviewed by the user (2026-11-24), from the oracle loop's cases where one is cited, with the request in a player's raw words. **Grounded** is the step restated; on a "No" it is tallied and not barred. **Shown** is the branch that is right given what triage is shown. The securing is shown ([TI-7](#open-decisions-implementation--plan-only)). **After the guard** is the outcome in the pipeline, worked out by hand from the fixtures until the guard is built; where the two forms of TI-2 differ, both are given. **Open** marks a row with two branches, tallied and not graded.

| Row | Scene | Command | Grounded | Shown | After the guard | Why, and from |
| --- | --- | --- | --- | --- | --- | --- |
| T-1 | `teaTable` | pick up the cup | pick up [cup1] | yes | yes | OC-2 |
| T-2 | `teaTable` | pick up the table | pick up [table1] | yes | A defer, B yes | OC-1; the needless defer |
| T-3 | `teaTable` | slide the saucer across the table | slide [saucer1] across [table1] | yes | A defer, B yes | OC-4 |
| T-4 | `teaTable` | put the cup on the table | put [cup1] on [table1] | yes | A defer, B yes | A near miss of T-5 |
| T-5 | `teaTable` | put the table in the cup | put [table1] in [cup1] | no | no | OC-3: the size, not that the cup is on the table |
| T-6 | `teaTableCupOnFloor` | put the table in the cup | put [table1] in [cup1] | no | no | OC-11 |
| T-7 | `teaTableCupOnFloor` | hammer the table into the cup | hammer [table1] into [cup1] | no | no | OC-18: the size; the absent hammer is beside the point |
| T-8 | `tavern` | put the table in the cup | put [table1] in [cup1] | no | no | The long trestle, so one "no" outside the parlour |
| T-9 | `teaTable` | pick up the teapot | pick up [teapot1] | defer | defer | OC-5: its "no" is the judge's |
| T-10 | `teaTable` | pour tea into the cup | pour [tea2] into [cup1] | defer | defer, only through [tea2]'s host | The user's example; OC-6 |
| T-11 | `teaTable` | pour tea from the teapot | pour [tea2] from [teapot1] | defer | defer | OC-6 |
| T-12 | `teaTableChained` | pick up the table | pick up [table1] | defer | defer | OC-20 |
| T-13 | `teaTable` | pry the teapot off the table with a screwdriver | pry [teapot1] off [table1] with a screwdriver | defer | defer | OC-8: an unestablished tool stays in the player's words |
| T-14 | `teaTable` | wipe the table with a cloth | wipe [table1] with a cloth | defer | defer | OC-7, OC-15. Whether an improvised tool is fine is a price, which triage doesn't set |
| T-15 | `teaTable` | wipe the table with the cloth I'm holding | wipe [table1] with the cloth I'm holding | **open:** defer, or no | defer, or no | OC-17: the scene states the player holds nothing |
| T-16 | `teaTable` | tip the table | tip [table1] | defer | defer | A plain act, and what is on it slides |
| T-17 | `tavern` | pick up the cup | pick up [cup1] | yes | yes | OC-10 |
| T-18 | `tavern` | pick up the candle | pick up [candle1] | yes | yes | OC-10 |
| T-19 | `tavern` | put the hammer on the table | put [hammer1] on [table1] | yes | yes | OC-10, held |
| T-20 | `tavern` | pick up the table | pick up [table1] | defer | defer | OC-9 (JF-2): a feat |
| T-21 | `tavern` | light the candle | light [candle1] | **open:** yes, or defer | as shown | OC-22: the hearth in the room's gloss |
| T-22 | `tavern` | trim the wick of the candle with something sharp | trim the wick of [candle1] with something sharp | defer | defer | OC-21 |
| T-23 | `twoCups` | pick up the china cup | pick up [cup2] | yes | yes | The gloss settles which |
| T-24 | `twoCups` | pick up the cup | pick up the cup | defer, ungrounded | defer | OC-32's kind: two readings, and a guess is a wrong "yes" |

**Left out, until the user says otherwise:** gibberish and questions (OC-23, OC-26, OC-27), which production classifies before a command reaches here (unchecked for this path); and things the scene doesn't have at all ("pick up the sword"), since what is unstated isn't absent.

**What the corpus is short of** (mine): defers whose reason is neither a securing nor an improvised thing. T-16 and T-20 are the only two. T-9 to T-12 are triage's own too, now the securing is shown.

## The bar

Mine, agreed by the user as written (2026-11-24). Graded at three repeats on the rows with a settled branch:
- **no wrong "yes"** after the guard, and none before it where the reason isn't a securing;
- **no wrong "no"**, and every "no" for a true reason (read by hand: a right "no" for a wrong reason is what the player would read);
- **grounding right in every "yes" and "defer"**, read apart from the branch;
- **needless defers at most one in four** of the rows whose shown branch is "yes" or "no". Without a limit, always deferring would pass;
- **at least one right defer** that is triage's own, before the guard.

**Two clauses read with the securing shown** (the user, 2026-11-24): the last was "that isn't the guard's", written for a triage that couldn't see the glue; and the needless-defer limit covers 12 rows, not 16, since T-9 to T-12 are "Defer" as shown.

## Risks

- **It becomes another v45** (agreed as a risk by the user, 2026-11-24). The bar is uneven on purpose, and the checkpoint after draft 5 is a decision with the user, not a verdict on five drafts. **The user's hope:** v45's lessons plus what came later, the explicit render above all, give better leverage. It is to be evaluated as the drafts go: [Is it going better than v45?](#is-it-going-better-than-v45)
- **Micro never defers.** In the 2026-11-04 triage's first batch `complex` fired 0 of 12, and the teapot came back `impossible`. With the securing hidden the glue's defers would be the guard's alone; shown, Micro may call the teapot "No" again ([TI-2](#open-decisions-implementation--plan-only)'s "No" clause).
- **Two judgments in one call,** grounding and branching, where the oracle's drafts found one per call is what Micro can do. The first draft asks for grounding first, and the two are graded apart. If one spoils the other, they split.
- **Absence drains toward "nothing stops it"** on the explicit render (the ruling's guards), which here is a wrong "yes".
- **The reply looks like `playByPlay`'s,** plus a verdict, so Micro may spend the call on the method. The record's slots beyond `says` are optional, and arm 1b shows what they cost.

### Is it going better than v45?

The hope is the user's. This reading of it and the signs are mine, proposed.

| Leverage | What has been measured | What it leaves open here |
| --- | --- | --- |
| The explicit render | Scene-reading questions 8 of 8, against the guide's 6 of 8, and 4 of 4 on both confirmed questions (batches 17 to 20). The ruling on it, 9 of 10 (batch 22), then 21 of 21 on its bar's cells (batch 23a), sizes compared 9 of 9 | **The ruling was handed the question that decides.** Triage has to think of it: on questions `against` wrote, the ruling got 7 of 10 (batch 27). The render didn't help the verdict, whose every answer was as before (batch 24). Its ordinary default settled stability questions toward "allows" (batch 26), so it may **work against "defer"**, and toward a wrong "yes" |
| The guard | v45's 2 wrong `simple`s on `teaTable` (of 21) both name the glued [teapot1] | The guard is code, so what it catches is no evidence about the prompt |
| Three branches, and thoughts given a place in the step record | The problems list in the play-by-play: OC-6 from 0 to 3 of 3 (its draft 8), the thoughts back in the method without it (drafts 9 and 18). v45 had six labels and eight lines | Not measured for a judgment. Grounding and branching still share a call |
| [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro) | Observed one lesson at a time | Each draft's notes name the lessons it leans on, so a failed one is noticed |

**At each read,** the draft's notes answer:
- **Did the render do the work?** For each branch, whether the reply's reason comes from a thing's own line, from common sense, or from neither. Right branches with reasons from neither are luck.
- **Is "defer" ever chosen,** before the guard? 0 of 12 was the 2026-11-04 triage's first sign.
- **Is it accreting?** v45's pattern in this plan's terms: a draft that adds a line or a test for one row, or fixes one row and loses another that had passed. One is ordinary. Two drafts running is raised with the user then, without waiting for the checkpoint.

**At the checkpoint after draft 5,** these answers are set out draft by draft, beside the tally.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next step(s). Not copied into package `AGENT.concepts.md`. All mine unless marked.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| TI-1 | **The reply:** the step record (`says`, `intent`?, `steps`?, `consequences`?) with `kind: 'No' \| 'Yes' \| 'Defer'`, and `reason` on "No". A union on `kind`, with what each kind needs (the user's, 2026-11-24). The record in every branch, so that the thoughts that would distort `says` have somewhere to go (the user's: proposals as plan changes, on every branch). Superseded on the way, mine: a bare `command`, `concerns`, a cut-down `Proposals`, proposals refused apart from the answer. **Mine:** a reply missing its own kind's field is malformed, and `reason` on another kind is dropped | Step 3 | **Direction** (2026-11-24) |
| TI-2 | **How far the guard reaches.** The user's example never names the glued teapot, so the named things alone aren't enough. **A:** the named things and their direct hosts, either end of any securing. **B:** as A, but where one end hosts the other, only the hosted end counts, since moving a host can't move its child relative to it (CA-6); a pair with neither hosting the other counts at both ends. Contents whose securing leaves what is moved would also need counting, and no fixture has one. Mine: B. **"No" too?** Mine: where a securing touches the attempt, a "No" also becomes "Defer", against the 2026-11-04 triage's `impossible` teapot. Under B, T-5 to T-8 stay "No"; under A, T-5 to T-7 would defer | Step 3 | Open; decided on the table step 3 makes |
| TI-3 | **A name that fits two things or none.** Left in the player's words, with "Defer"? (T-13 to T-15, T-24.) Improvised handles in a plan are [booked on the parent](AGENT.oracleLoop.planning.md#recommended-order) for their own agent and plan kind, so triage files none | Step 1 | **Settled** for T-13, T-14 and T-24 by the corpus (2026-11-24); T-15 stays open |
| TI-4 | **What "No" says,** as JF-5 leaves it: one floor, whose sentence the player can answer. Triage's reason as it stands, or reworded elsewhere | Step 4 | Open |
| TI-5 | **The first action plan:** the command as the plan's one step, built by code and restated by triage | | **Settled** by the platform (2026-11-24): it is triage's input, and its reply merged |
| TI-6 | **The outlet's contents:** possibilities left out of the first draft, as `playByPlay`'s record has no slot for them (the user, 2026-11-24). **`rules` on consequences are asked for** (2026-11-24), the securing being shown with its handles. They are an outlet, to keep the main result (`says` and `kind`) clean, and are read that way: an overfilled slot isn't a failure, and the reply's violations are unchecked proposals for the rule cell. **To watch, mine:** earlier outlets protected a method; none has protected a verdict, and a violation written before `kind` might push it to "No". **Measured:** words in `says` that are neither a handle nor the player's, checked by code; and arm 1b | Step 4 | **Direction** (the user, 2026-11-24) |
| TI-7 | **The view's initial securing** (the user's framing, 2026-11-24: triage has a tunable view of its inputs, so the question is only how it is first set). A draft may change it, as one change. Two things move with it: whether the reply may offer `rules` (the reply side asks only for what the view supports), and the branch right on T-9 to T-12, so hiding the securing later would reopen those rows. The user's objection to hiding it, 2026-11-24. I had carried the omission over from `trialAgainst`, which missed the size in 3 of 3 size cells with it shown and found it in 3 of 3 with it omitted. That piece is asked for what blocks, so the strongest block crowds out the rest, and there the rule cell judged the securing in its own call (the user, 2026-11-14, TR-L2); nothing but the guard stands in for it here. **Mine: show it,** so the proposals don't rest on a scene with its glue missing, and T-9 to T-12 become triage's own. **The wording is open** (E4): `shown` gives no rule handles, and on the chain says "cannot be moved apart", near a verdict; `conditions` gives handles and a test, but was built for a piece "asked what an action brings about, never whether it can" (the user's diagnosis, 2026-11-19), and on the chain says "Short of that, [table1] can be moved as usual", which pulls T-12 toward "Yes". On the glue `shown` states no "cannot", and `conditions` adds only the tag and the test. **Where each value came from** (the user's concern about anchoring, 2026-11-24): `conditions` was added for `playByPlay` alone (2026-11-19, for the concession cell's methods bent round the chain, batches 41 and 42); `shown`'s pair wording, `actionRule`, was a temporary branch for the judge's 2026-11-04 batches; `omitted` was for `trialAgainst`. None is neutral, so the choice is made from triage's job, by the user's rule that each piece shows only the parts of a rule it uses (2026-11-10): the **fact**; the **handle**, to name a violation; the **test** of violation; the **carry**, for its proposals. Open, the **voiding** part, which no value shows in a scene, and which T-13's pry may need. `conditions` is those four, plus, on an unhosted pair, "Short of that, [x] can be moved as usual". **The initial setting is `conditions`, for convenience** (the user, 2026-11-24). **Flagged for the reads** (the user): the voiding part is never the difference between "Defer" and "Yes", but could be between "No" and "Defer" ("not impossible, because the condition could be voided"). So each wrong "No" on a touched securing (T-9 to T-13) is read for whether the reply treated the securing as permanent. T-12 is read for the "as usual" line too. A third wording, for pieces that ask "can it?" (the handle and the test, without the "as usual" line), only if a draft shows it's needed | Step 3 | **Direction**: the framing and the initial value (the user, 2026-11-24). The bar's two clauses read with the user the same day |
| TI-9 | **The standing of a grounded step.** On the platform, a step's authority is `playByPlay`, so triage's restatement is unchecked until `playByPlay` restates it. Mine: leave it so, since it is the platform's answer, and the judge's view decides what it reads | Step 3 | Open. `playByPlay` confirming an unchecked step by restating it as written is built (E3, 2026-11-24) |
| TI-10 | **What a revision does to `alreadyAnswers`** (found 2026-11-24; booked as open by the user). A step answering "how it is held", revised from "lift it" to "drag it", still lists that answer, unmarked, where its other children are made unchecked and stale. The list is the trial judge's evidence for not asking again, so a stale entry could suppress a question whose answer has gone. No test or doc covers it | None in this plan | Open |

## How we work

- The parent's [How we work](AGENT.oracleLoop.planning.md#how-we-work) holds. The user deploys and runs each batch, at most 24 calls a payload; I write the payload and give its full path, and results go to a file read with `jq`.
- One repeat to explore, three to confirm. One change per draft, with a rubric written before each batch, and every reply read.
- Drafts and notes live in `oracleLoopDrafts/triage/`, as `N.txt` and `N.notes.md`, with an `iterations.md`. Problems are `TI-P`, library entries `TI-L`.
- A cell's expected branch, grounding and look-for are mine until the user has reviewed them, and only the user revises them after that.
- No bare `TI-n` in code or tests. The user commits.

## Verification

- **Each build:** from `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`, no output. Every other piece's render pins unchanged.
- **The extensions:** tested with no LLM call; the holdouts test fails when a piece is added off the platform or left listed after moving.
- **The guard:** its tests run every corpus row with no LLM call.
- **A batch:** its form check, its tally, then every reply against its rubric.
- **Links:** every relative link and anchor in this plan and the parent resolves.

## Progress

| Step | State |
| --- | --- |
| 1. The corpus | Done 2026-11-24: rows and bar reviewed by the user, scenes checked |
| 2. The platform's extensions | Built 2026-11-24: E1, E2, E3, the `triage` author and the holdouts list. No prompt changed, and no kept batch's merge or render pin moved |
| 3. The contract, the guard and the piece | Not started |
| 4. Draft 1 | Not started |
| 5. Drafts 2 on | Not started |
| 6. The confirm | Not started |
| 7. Hand back | Not started |

## When it finishes

- **The trial question plan's step 2.5** gets the list of what triage defers, with their plans as triage merged them, to draw its cells from.
- **The extensions and the holdouts list** are documented in calibration as they land (step 2); the list's remaining entries are the parent's, under its item on the judging pieces reading the plan.
- **The piece and the guard,** if kept, go in calibration's [Piece probe](../../../../../lambda/ephemera/calibration/AGENT.md#piece-probe) docs, and what the drafts showed about Micro goes to [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro).
- **TI-10,** if still open, goes to the parent plan, as a question about the action plan.
- **The parent's** Triage item is checked, with a seam-ledger entry; CA-6 gets a note if its placement changes.
- **A sweep for inbound links,** then this plan is deleted.
