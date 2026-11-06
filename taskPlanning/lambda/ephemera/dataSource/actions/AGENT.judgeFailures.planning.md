# Judge prompt: known failures beyond the v28 baseline

**Status (2026-11-06):** [v41](judgeFailureDrafts/v41.txt) is the draft to beat: it fixes Failures 1 and 2 against v28 on `teaTable`, with no new wrong `simple`. v28 is still what's built. The rebuild waits on [v43](judgeFailureDrafts/v43.txt), which decides what gets built, and on `tavern`, which no draft since v28 has run. See [Recommended order](#recommended-order). The judgePrompt plan has handed back into this one.

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md). This is a small, ephemeral plan: delete it and [`judgeFailureDrafts/`](judgeFailureDrafts/) when the failures below are fixed or knowingly left, and their lasting findings have moved to the [scene projection plan](AGENT.sceneProjection.planning.md). If it gets too crowded, spin sub-plans off in response (user, 2026-11-05).

## Goal

Improve the triage judge's prompt in steps from a baseline that already works better than what came before it. A plan now retired rewrote the prompt and measured it: [v28](judgeFailureDrafts/v28.txt) freed the table in `teaTable`, the failure that plan was opened for, without losing a pass. It is still what's built. [v41](judgeFailureDrafts/v41.txt) is now the draft to beat (user, 2026-11-06), not yet built. No draft has to solve everything.

The failures share one prompt and interact, so they share this plan: an edit for one can move another, and every candidate is measured against the same requests.

## Getting Started

1. Read the draft to beat as a whole, [v41](judgeFailureDrafts/v41.txt), then [how the fix was found](#how-the-fix-was-found-v29-to-v38). What's built is still [v28](judgeFailureDrafts/v28.txt), in [`frameJudge.ts`](../../../../../lambda/ephemera/dataSource/actions/sceneProse/frame/frameJudge.ts) and `judgeRulesLines` in [`sceneRules.ts`](../../../../../lambda/ephemera/dataSource/actions/sceneProse/sceneRules.ts).
2. Read [Carried from the judgePrompt plan](#carried-from-the-judgeprompt-plan): M28 to M30 for how v28 came about and which of its wording is whose, and [Settled](#settled) for decisions a fix must not undo.
3. Read the Judge probe subsection of [`calibration/AGENT.md`](../../../../../lambda/ephemera/calibration/AGENT.md): the `JudgeProbe` event, and how `instructions` and `sceneText` probe a draft without a build.
4. Baseline, from `lambda/ephemera/`: `npm run test -- --watchAll=false </dev/null`, last 4413 passed, 9 skipped, and `npx tsc --noEmit </dev/null`. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md).

## How we work

- Each candidate is a file in `judgeFailureDrafts/`, numbered on from v28, and is probed through the `instructions` and `sceneText` overrides. Code changes only at a rebuild, as in [Recommended order](#recommended-order).
- The user runs each probe and pastes the result. Keep batches small: the smallest call count that answers the question, at most 12 per invoke.
- One change per draft. v42 made three at once and regressed, and couldn't say which one did it. Text anywhere in the prompt can change earlier lines of the reply, so no edit is safe unprobed, a clean-up included.
- Rules are in positive terms, with no "do not" qualifying a positive instruction. Pronouns are written out as nouns where the referent could be misread, and "moving along with" is only ever how the telling reads, never movement relative to a frame (M30).
- Each change is attributed. Anything not from the user is labelled "mine" until accepted.
- Examples in the prompt stay out of the fixtures' domains, because earlier batches showed such examples leaking into answers.

## When a candidate replaces the baseline

Mine, accepted by the user (2026-11-06, was JF-1). A candidate replaces the draft to beat when it:

- fixes at least one known failure,
- causes no new wrong `simple`, and
- loses no pass on the table, the cup or the table in the cup, where a label the fixture tolerates is a border and not a lost pass.

Grade by what an error costs (was JP-13, under [Settled](#settled)): a wrong `simple` has no recovery, and a repeated false refusal is a failure. Other disagreement among the labels is tolerated. Two repeats show only strong effects, so read the replies as well as the tally.

## Draft to beat: v41 on Nova Micro

2026-11-06, 18 calls on `teaTable`: 13 pass, 3 border, 2 failure, counting `complex` on the table as a border, which the fixture will tolerate after the rebuild. The two failures are pour's known wrong `simple` and one truncated reply on pry. Reply by reply [under Failure 1](#failure-1-a-named-object-the-scene-does-not-establish). `tavern` has not been run, and `Recap` is still in the draft.

## Baseline: v28 on Nova Micro

2026-11-05, 2 repeats each, 16 calls: 10 pass, 2 border, 4 failure, with 3 wrong `simple` from 2 distinct causes. Probed through the overrides; the built prompt is byte-identical to that text.

| Request | Expected | Result | Standing |
| --- | --- | --- | --- |
| Pick up `[table1]` | `simple` | `simple` ×2 | Pass |
| Pick up `[cup1]` | `simple` | `simple` ×2 | Pass |
| `[table1]` in `[cup1]` | `impossible` | `impossible` ×2 | Pass |
| Slide `[saucer1]` across `[table1]` | `simple` | `simple` ×2 | Pass |
| Pick up `[teapot1]` | `obstructed` | `obstructed`, `impossible` | [Failure 2](#failure-2-a-conflict-that-ends-in-impossible) |
| Pour from `[teapot1]` | `obstructed` | `obstructed`, `simple` | [Failure 3](#failure-3-an-action-never-pictured) |
| Wipe `[table1]` with a cloth | `contingent` | `simple` ×2 | [Failure 1](#failure-1-a-named-object-the-scene-does-not-establish) |
| Pry `[teapot1]` off with a screwdriver | `contingent` | `obstructed` ×2 | Border, see [Watching](#watching) |

`tavern`, on the deployed build (instructions hash `9818c9c2`), 2 repeats each, 8 calls: 7 pass, 1 failure, no wrong `simple`. On v24 the same set scored 6 pass, 2 failure.

| Request | Expected | v24 | v28 | Standing |
| --- | --- | --- | --- | --- |
| Pick up `[table1]` (a long oak trestle) | `simple` | `impossible` ×2 | `impossible`, `simple` | [Question 1](#question-1-a-feat-the-labels-cannot-name) |
| Pick up `[cup1]` | `simple` | `simple` ×2 | `simple` ×2 | Pass |
| Pick up `[candle1]` | `simple` | `simple` ×2 | `simple` ×2 | Pass |
| Put `[hammer1]` on `[table1]` | `simple` | `simple` ×2 | `simple` ×2 | Pass |

Frame language appears unprompted by any rule here: `tavern` has no `Rules` section, and four of the eight replies say a thing moves from one frame to another. That bears on the user's hypothesis under [Supporting work](#supporting-work), since no rule sentence was there to repeat. The Picture sentence still asks for it, so it shows the language is usable and not that it freed the table.

## The failures

The approaches are mine unless marked, and none is agreed. They are starting points, in the order I would try them.

### Failure 1: a named object the scene does not establish

Wipe with a cloth is `simple` with `Needs: nothing`, and has been on every draft run on it (v24, v26, v28). One reply's Picture even mentions the cloth. Micro does catch the screwdriver in the pry request, so it can do this. A wrong `simple`.

#### How the fix was found, v29 to v38

Wipe on Micro, 2026-11-06, condensed from reply-by-reply notes. The wording is in each draft. "Cloth" counts replies where `Needs` named it.

| Draft | Change, and whose | Cloth | `contingent` | Read |
| --- | --- | --- | --- | --- |
| [v29](judgeFailureDrafts/v29.txt) | `Needs` as required for the clearest path, labelled `Item`/`Class` and `Player-specified`/`Improvised` (user) | 1 of 2 | 0 | `Answer` ignored the need |
| [v30](judgeFailureDrafts/v30.txt) | `Specific`/`Class`, for details as well as things (user); `Answer` reads `Needs` (mine) | 0 of 3 | 0 | Losing "thing" lost the cloth (user's read) |
| [v31](judgeFailureDrafts/v31.txt) | `Item`/`Class`/`Detail` (user) | 2 of 4 | 0 | `Picture` flagging the cloth decides `Needs` |
| [v32](judgeFailureDrafts/v32.txt) | `Picture` checks whether things are established first (user) | 0 of 4 | 0 | Only the handled thing got checked: "named by handles" echoed |
| [v33](judgeFailureDrafts/v33.txt) | Handles show establishment (user's wording); "List everything" (mine) | 1 of 4 | 0 | "Everything" swept the whole scene |
| [v34](judgeFailureDrafts/v34.txt) | `Mentions` as its own first step, pointed at the last line (the user's hypothesis, my form) | 4 of 4 | 1 | Tight step at a literal place worked |
| [v35](judgeFailureDrafts/v35.txt), [v36](judgeFailureDrafts/v36.txt) | `Mentioned` for `Player-specified`; `Answer` as a switch (user) | Not probed | | |
| [v37](judgeFailureDrafts/v37.txt) | `confusing` fall-through (user) | 4 of 4 | 0 | The word came first, then its justification |
| [v38](judgeFailureDrafts/v38.txt) | `Tests` before `Answer`, copying earlier lines (mine); labels on tests, `Rules` called back (user) | 4 of 4 | 0 | Copies skipped; verdict, then a reason made to fit it |

What carries:

- **Tight steps at a literal place work on Micro, and prose definitions don't.** `Mentions` beat every rewording of `Picture`.
- **Micro decides, then justifies, so the verdict goes last (the user's read, v38).** `contingent: no ("Needs" says "nothing")` sat directly under `Needs: cloth`. This is why `Tests` is a rubric of bare `label: yes` lines.
- **"Copy from your earlier line" is not an operation Micro accepts in that framing (user).** "Given what Needs said" is what works.
- **A rubric isn't a switch (user).** Every question gets answered, and priority lives in `Answer`. So the order questions are asked in is free to tune, separately from priority (user, v41).
- **`contingent: yes` with `simple: yes` is correct output (user, v40).** Wiping is simple if the cloth is there.
- **Words get echoed.** "Named by handles" in the prompt shaped what counted as a thing, as `"Needs" says "nothing"` shaped reasons. `Reading the scene` now says "Some things are named by handles in square brackets, to show that they are established in the scene" (the user's wording).
- **A handle shows a thing is established, and no handle shows nothing (user).** A teapot's lid may be established by the teapot with no graph node, so a request about it is not `contingent`: `simple` if the outcome needs no node, `complex` if it needs one (mine, on the user's question). To watch: the `Graph` bullet's "one row for each thing" could also suggest that things mean handled things.

Still open from these drafts:

- **Departs from [Settled](#settled):** under JP-13 and `Improvising`, how sure the judge is makes no difference and a suggestion goes to `contingent`. Here a plausible improvised `Class` goes to `obstructed`. My reading is that this doesn't reopen JP-13's point, since `Class` is about having nothing specific to suggest and not about sureness. Fits note 29: a `Class` need with nothing specified is a player with no plan yet. No fixture measures it yet ([Supporting work](#supporting-work)).
- **`Improvising` (mine):** it offers a farmhouse's roof as a detail to suggest, which a deduction from "farmhouse" could equally establish, the same shape as the teapot's lid. Settle before any rebuild that keeps the deduction sentence.
- **The "End of scene." marker** closes `sceneText` in every draft since v34 (mine, the user agreed). It goes in the scene renderer at the rebuild. A renamed or fenced `Request:` line would need a deploy.
- **`Mentioned`/`Improvised`:** no test reads it, and it has flipped with no change to its own wording (`Improvised` 4 of 4 on v37, `Mentioned` 4 of 4 on v38). A candidate for removal, as its own change.

#### v39 onward

**[v39](judgeFailureDrafts/v39.txt) (2026-11-06):** `Tests` becomes a rubric, every question answered, and no longer a switch, the user's design. The form is the user's: `Given what Obstacle said: Does it name something? If so, then say "obstructed: yes", otherwise say "obstructed: no".` The decision comes at the end of each line, and the line stops asking for a copy, since v38's "copy" was skipped 4 of 4. Earlier unprobed versions with `<copy "Obstacle">` placeholders (mine) and "skip to Answer" were dropped. Mine: `Answer` gives the first label that says "yes", so order now lives there, with `confusing` if none does; one question per condition, so `obstructed` takes three lines, numbered `obstructed (1)` to `(3)` (the user's numbering) so that a mixed yes and no under one label can't read as one item; no example lines, which would have shown a copy. To read for: `contingent: yes` against what `Needs` said, and `Answer` taking the first "yes" where `simple` also says "yes". Probe wipe, 4 repeats, 4 calls.

**v39 on Nova Micro (2026-11-06, wipe, 4 repeats):** 3 pass, 1 border (`obstructed`, tolerated), 0 wrong `simple`, the first draft to fix Failure 1 on this request. `contingent: yes` on the rubric 4 of 4, and `Answer` took the first "yes" 4 of 4, including the 2 replies that also wrote `simple: yes`. The order in `Answer` is what decides those. Replies wrote only the bare `label: yes` lines, with no questions or reasons, so no justifying. The border reply wrote `obstructed (3): yes` for a cloth, a need that a parlour could plausibly meet. `Answer` usually repeats the rubric's form (`contingent: yes.`, `"obstructed (3): yes"`): the grader reads the label from the first word, but the sentence then starts with "yes" or the number, to tidy if v39 replaces the baseline. v39 has not been run on any other request.

**[v40](judgeFailureDrafts/v40.txt) (2026-11-06):** v39 with `and did Needs say "nothing"` removed from the `simple` test, the user's change. Wiping with a cloth is simple if the cloth is there, so `contingent: yes` with `simple: yes` is correct output, and the order in `Answer` is what chooses between them. The `simple` test now asks only about the action and recording it. `confusing` is left for a reply where nothing says "yes". Next: table, cup and table in cup, 3 repeats, 9 calls, the requests the replacement rule protects, to watch for an invented need or a stray `Obstacle` now deciding the label, and for "n/a" on table in cup.

**v40 on Nova Micro (2026-11-06, table, cup and table in cup, 3 repeats):** table `simple` 3 of 3 and cup `simple` 3 of 3, with `Needs: nothing` and every rubric line above `simple` saying "no", so no invented need and no stray `Obstacle`. Table had 2 `obstructed` on v29 and v30. Table in cup: 0 pass, 2 `obstructed` (tolerated), 1 `complex` (failure), no wrong `simple`. No reply wrote "n/a" on the next four lines, so `impossible: no` 3 of 3: the dependency flagged at v38 is real. One wrote a stray "n/a" at the end of `Picture` and carried on. The knowledge is there but has no slot: `Answer` says "physical and spatial constraints" and "making it impossible" under other labels, and `Picture` never says it won't fit. All three invent a role for the glued teapot. `complex: yes` on 3 of 3, reached as the answer on the one with no `Obstacle`. `Mentions` leaked its example here, `rag not established` 3 of 3, and listed the rule's handle as a thing, on this request only; it did not reach `Needs`. One table reply wrote out the questions as well as the results, and answered them correctly.

**[v41](judgeFailureDrafts/v41.txt) (2026-11-06):** three changes on table in cup. The order questions get asked is separated from the priority between answers, the user's design: `impossible` is asked last, so it has the other tests in context (`complex: yes`, `simple: no` on table in cup, `simple: yes` on table and cup, `obstructed: yes` on teapot), and `Answer` gives it priority explicitly. Mine: the two-step wording in `Answer`, and "Given what Picture said" replacing my "n/a" test, which never fired. A recap of the reasoning for diagnosis, the user's idea, sits after the `Answer` line. The user proposed one on each test line, followed by the answer; I moved it, and the user agreed, because v38's reasons were made to fit the verdict and a reason on one line is in context for the next, where v39's and v40's bare lines are what worked. Being post hoc, a recap shows what Micro says about a verdict, not what caused it. Probe table in cup and teapot, 3 repeats, 6 calls. If that looks good, recheck table and cup, since `impossible` now wins whenever it fires. To read for: `impossible: yes` on table in cup and `no` on teapot, and `Answer` keeping to the priority.

**v41 on Nova Micro (2026-11-06, table in cup and teapot, 3 repeats):** 6 pass of 6. Table in cup `impossible` 3 of 3 and teapot `obstructed` 3 of 3 with `impossible: no`, so Failure 2 did not appear on teapot. `Answer` kept the priority 3 of 3, past `complex: yes` and in one reply `obstructed (2): yes`. The result can't be credited to order alone: `Picture` itself now says "not physically possible given the sizes" 3 of 3, before any test, so naming `Picture` in a later question changed what `Picture` writes. No side-by-side, since it wouldn't change the decision. The `rag` leak did not recur. Leftovers of the old "n/a" instruction: stray "n/a" ending `Picture` on 2 teapot replies, and `Obstacle: n/a` on 2 table in cup replies, all harmless so far. `Recap` came on the `Answer` line in all 6, so the grader counts it as part of the sentence: one `avoids` flag is false ("cut" in "execution"), and the other is a real named fix in the sentence ("without detaching it first"). It mostly restates the questions, with some use (`simple: no because the action cannot be completed`). `complex: yes` on 2 teapot replies is correct (the user): if it weren't obstructed, the change would be representationally complex. Next: table, cup, pour, pry, wipe and saucer, 2 repeats, 12 calls, to apply the replacement rule. If v41 is a candidate, three cleanups to decide before replacing: the `Recap` (dev only, per the user), the unused "n/a" instruction, and `Answer` repeating `label: yes` into its sentence; each changes the prompt and needs its own check.

**v41 on Nova Micro (2026-11-06, the other six requests, 2 repeats):** 7 pass, 2 border, 3 failure, 1 wrong `simple`. With the 6 above, against v28:

| Request | v28 | v41 | Read |
| --- | --- | --- | --- |
| Pick up `[table1]` | `simple` ×2 | `simple`, `complex` | Lost pass under the rule as written. The `complex` reply cites the teapot moving with the table |
| Pick up `[cup1]` | `simple` ×2 | `simple` ×2 | Holds |
| `[table1]` in `[cup1]` | `impossible` ×2 | `impossible` ×3 | Holds |
| Slide `[saucer1]` | `simple` ×2 | `simple` ×2 | Holds |
| Pick up `[teapot1]` | `obstructed`, `impossible` | `obstructed` ×3 | Failure 2 not seen |
| Pour from `[teapot1]` | `obstructed`, `simple` | `contingent`, `simple` | Failure 3, the same wrong `simple`, not a new one. The `contingent` comes from `tea not established`, though the scene has `[tea2]` in the teapot |
| Wipe with a cloth | `simple` ×2 | `contingent` ×2 | Failure 1 fixed, with v39 |
| Pry with a screwdriver | `obstructed` ×2 | `obstructed`, no label | Known border. The other reply wrote out every test question and hit the probe's 512 token limit before `Answer`, the first truncation |

Pry still names the glue under `Obstacle` where note 29 wants "nothing", and `obstructed (2)` then outranks `contingent`. Echoing the questions has now appeared on 2 replies. `Recap` contradicted its own tests once (`obstructed (3)`), and showed why the table reply said `complex`.

**[v42](judgeFailureDrafts/v42.txt) (2026-11-06):** meant as the candidate to replace v28. v41 without `Recap` and without the unused "n/a" instruction in `Picture`, and with "For each, write only the label and its answer" in `Tests`, against the echo that truncated pry (mine, the user agreed). Probe all eight once, then table in cup and pry twice, 12 calls, since removing "n/a" touches the first and the echo the second. Until the fixture change deploys, the tally grades `complex` on table a failure, to read as a border. If it holds, `tavern` runs too (4 requests, 2 repeats, 8 calls, with its own scene text), since it is part of the v28 baseline and `impossible` now wins whenever it fires.

**v42 on Nova Micro (2026-11-06, all eight once):** 4 pass, 1 border, 3 failure, all 3 wrong `simple`. Table, cup, table in cup and slide held, pry `obstructed`. Teapot `simple` is new against v28, and wipe `simple` is back, with `Needs` naming the cloth and `contingent: no`; pour `simple` is known. So v42 does not replace v28. Across the replies, `Picture` shrank to one sentence on 7 of 8, restating the request with no motion or frame, where v41 wrote two or more on all 18. The teapot reply shows the chain: `Picture` says the teapot is glued and never that it would leave the table, `Rules` restates the rule with `No consequence` and no sentence on what the action does to it, `Obstacle` and `Needs` say "nothing", every test says "no", and the answer reads the rule as a permission ("the rule allows it to stay fixed... so picking it up is straightforward"). The rubric passed that on faithfully, the risk flagged at v36: the fault is upstream. v42 made three changes at once, against the one-at-a-time rule (mine). My guess at the cause: "write only" spreading terseness up the reply. Removing `Recap`, which asked for reasons, could do the same.

**v42 on Nova Micro (2026-11-06, table in cup and pry, 2 repeats):** table in cup `impossible` 2 of 2, 3 of 3 on v42, so removing "n/a" did not cost it. One of those replies has a one-sentence `Picture` that never says the table won't fit, `Obstacle: Nothing`, and still `complex: yes`, `simple: no`, `impossible: yes`. That weakens my v41 reading that `Picture` carried the result, and leaves asking `impossible` late as the likelier cause, though not proved. Pry `obstructed` 2 of 2, 3 of 3 on v42: the known border, no echo and no truncation. `contingent: yes` on 2 of those 3, with `obstructed` outranking it, which fits note 22. `Picture` was one sentence on all 4 here, 11 of 12 across v42. No echo on any of the 12. The rubric misread `Needs` on 2 replies, `obstructed (3): yes`, one of them with `Needs: nothing`, without changing the label.

**[v43](judgeFailureDrafts/v43.txt) (2026-11-06):** v42 without "write only", to separate those causes. Probe teapot, pour and wipe, 3 repeats, 9 calls. Pour is there for the user's question of whether terseness is removing a tilt: on v41 and v42 no reply had one to remove. v41's longer `Picture` traces the tea ("from inside the teapot to the cup") and v42's drops that sentence, and neither moves the teapot, as on v28. If `Picture` recovers, "write only" was the cause, and the echo needs another answer, such as a higher token limit. If it stays terse, `Recap` is the likelier cause, with "n/a" less likely but not ruled out for terseness, which would change the development flag's premise: the recap would be doing work, not only reporting. 

To go in with the rebuild, if a candidate replaces v28: the `teaTable` table's `tolerate: ['complex']`, `confusing` in `JUDGE_LABELS`, and the development flag. The flag (the user's idea; the shape is mine, not yet confirmed): the recap sentence becomes its own constant, off by default, and a `development: true` on the `JudgeProbe` event appends it to whatever instructions the probe uses, built or draft, so it switches per probe with no deploy and no second copy of a draft. A result with the flag on is for diagnosis, not scoring, since prompt text elsewhere has been seen to change earlier lines, and its longer reply may hit the 512 token limit, which the flag could raise.


### Failure 2: a `Conflict` that ends in `impossible`

Both teapot replies reach `Conflict` and name the glue, then one takes `impossible`, reciting that label's definition. The rule verdict is right and the step to the label is not. The word `Conflict` was meant to help and did only in part. On v27, with `Contradiction`, both replies went to `impossible`.

1. Tie `impossible` to the step that should have found it: ""impossible": what you pictured in the Picture step shows that the player is picturing this place, or how the world works, differently from how it is."
2. If that fails, say in `Answer` which label a rule in conflict leads to. This is more direct, and it may read as a lookup and not a judgment.

### Failure 3: an action never pictured

Accepted for now (user, 2026-11-05): getting the table was worth having without this. Neither reply considers the teapot tilting. One reaches `obstructed` with no rule verdict, by saying the teapot can't move independently. The other says "Pouring tea from the teapot does not affect this rule", which is `No consequence` and a wrong `simple`. This is the hard one and may become its own plan. Freeing is not the only way to pour, since a player could tip the table, so the judge names the obstacle and no fix.

1. Have Picture say how the action physically happens, which things have to do what, so the tilt is on the page before Rules.
2. Add a worked example of an action on a secured thing that stays in its frame, such as pouring oil from the bolted lamp. It would sit close to the test, so a pass could be copying.
3. Use short fill-in slots in Picture, such as `Moved:` and `How:`, if Micro keeps restating the request.
4. Accept it, and rely on a later check by a more capable system. That is a design question for CA-6, and it needs the user.

The next experiment (2026-11-06): `Picture` answers in the wrong register, the user's read. Most lines restate the request ("The player wants to...") or give a before and after in frames ("from inside the teapot to outside it"). A tilt lives between those two states, so this register has no place for it. No pour reply on v41 or v42 has one, and a longer `Picture` only traces the tea. Fiction-action turned up only where the request names a tool (the screwdriver, the cloth). The step itself asks for frames, and the worked examples all read "goes from X to Y". To try, mine, not agreed: `Tell this moment as it would happen in the story, in a sentence or two: what you do, what you do it with, and what each thing does as a result.`, with the frame sentence out of `Picture` and the `Relations and frames` section left alone. To watch: teapot's `Conflict`, which v41 reached through the before-and-after; a story line deciding the matter before `Rules`; invented objects; and table, since frame language is what freed it.

## Questions the failures raised

### Question 1: a feat the labels cannot name

The user's reading (2026-11-05) of picking up the long oak trestle: neither `obstructed` nor `impossible`, but something like `challenging`, which leans on rules adjudication. It is theoretically possible and perhaps beyond a given character's strength. In the Coyote Game that means automatic success, which doesn't undermine the fact that it is a challenge based on abilities. So this may be a gap in the labels and not a fault in the prompt, and the fixture's `simple` may be wrong as well. See JF-2.

Expect overuse (user, 2026-11-05): asking for a hard skill check is a trap beginning game-masters fall into all the time, because it is easier than telling a friend "No, that won't work." So the likely damage is to `impossible` and `obstructed`, not only to `simple`, and any draft with the label is judged on that. To try (mine, not agreed): a positive test that the only thing that could stop the action is the character's own ability, with nothing established in the way; the label placed after `impossible`, `obstructed` and `contingent`; and every existing request as a guard, with only the trestle expecting the label.

## Supporting work

None of this is an obligation. Each is here for the decision it serves.

- **A second `contingent` request,** such as wiping `[saucer1]` with a napkin. Wipe is the only case of an otherwise simple action that depends on an unestablished object, so fixing it alone could be learning one case. Add it when a Failure 1 candidate passes.
- **A part of an established thing,** such as lifting a teapot's lid, expecting `simple` and tolerating `contingent` and `complex`. It guards against a `Needs` check that treats everything without a handle as unestablished, which wipe alone can't show. Add it with the requests below (mine).
- **A `Class` request,** which [v29](judgeFailureDrafts/v29.txt) and [v30](judgeFailureDrafts/v30.txt) make necessary: no fixture exercises `Class` going to `obstructed`, so that half of the change is unmeasured until one does. Requests live in code with no probe override, so it needs a deploy. Add it with the second `contingent` request (mine).
- **Stems in the `avoids` word lists.** "removing" and "ungluing" went unflagged on teapot replies that prescribe a fix, since the check matches exact substrings (`unglue`, `remove`). It is a reading aid and changes no verdict. Fix it when it next costs a misread.
- **v28 without the rule's second sentence,** on table and teapot, 4 calls. The user's hypothesis is that frame language let Micro grasp the concept. The table replies could equally be repeating "travels along with". It decides whether the frames section and examples earn their characters, and how far the result carries to scenes without that rule. Run it before trimming the prompt or reusing the frames module elsewhere.
- **Nova 2 Lite on the baseline,** 6 calls, if a failure seems to resist wording. It separates what the prompt doesn't get across from what Micro can't do.

## Watching

Not failures, but worth reading for in each run.

- **Pry:** `obstructed` is tolerated. Both replies have `Needs` and `Revises` right per [note 29](#the-users-notes), and only `Obstacle` names the glue when it should say "nothing".
- **`Revises` is unreliable:** "nothing" on the table when the table's relation changes, and on one reply "the glue is no longer true". It routes nothing today, and it would matter to anything that reads it.
- **Picture forcing a move:** "The table moves from being stationary to being wiped". The sentence "If a thing moves, say which" may be pushing this. The fixture has no request where nothing moves, such as lighting a candle.
- **Rules not naming the thing:** Micro consults the teapot rule on the cup. Harmless so far.
- **`n/a` skipped:** neither table-in-cup reply writes it, and both still get the label.
- **Invented rules:** one `tavern` table reply wrote `table-heavy: The table is too heavy to be picked up easily. Conflict.` in a scene with no rules. A Rules step can invite a rule where there is none.
- **Genre and the `impossible` line (user, 2026-11-05):** whether more ability could reach an end state gets fuzzy with magic or genre. Under Coyote Game rules, where all challenges succeed, the Coyote arguably can stuff a trestle table into a teacup ("You smash and fold the table improbably into the teacup"). Not game-breaking at this point, but something to keep thinking about if `challenging` arrives.
- **Unprobed rule wordings:** the pair and not-shown forms in `judgeRulesLines` (mine). No fixture exercises them, and a securing that crosses frames, such as a teapot on a table chained to the wall, is where lifting the table really is blocked.

## Carried from the judgePrompt plan

That plan rewrote the prompt and was retired on 2026-11-06, once v28 was built and measured. These are the parts a fix here depends on, moved as they stood. Slice numbers below are that plan's: 3 built the prompt and 4 measured it. Drafts v1 to v27, and the earlier rows of the table, are in git history.

### The user's notes

1. Sections get specifiers, such as `Role:`.
2. What the data is and what the role should do are separate, in this order: `Role`, `Reading the scene`, `Task`.
3. `Reading the scene` and `Reading player intent` are reusable modules, tuned more broadly than one task. `Reading player intent` is likely global to the system. `Reading the scene` can vary somewhat with the render format.
4. `Reading player intent` carries the expectation that moving an object moves everything on or in it, and that moving a container away from its contents is considered only when the player specifies it or context makes it obvious ("yank the saucer out from under the cup" is a move of the saucer and of the cup's containment on the saucer).
5. `Reading the scene` explains the two registers, and headers make them obvious.
6. The graph representation is probably better wrapped in a Markdown code fence.
7. `Task` says how to use Rules. `Reading the scene` says what they mean, fictionally.
8. Rules is a section the earlier instructions anticipate, with no ad-hoc instructions of its own.
9. Anything after the question must be an explicit callback to the task instructions. It may not be needed: instructions up front, data and input last.
10. The two registers are a fictional description and a graph representation. v1 lost that distinction, so the sections are renamed and `Reading the scene` reinforces it (on v1).
11. Rules is a non-exhaustive list of fictional constraints derived from the graph: a rule's presence constrains explicitly, and its absence defers to the logic of the scene (on v2, reworded on v3).
12. Four labels, with `incomplete` and `impossible` as in JP-10: the reality is agreed and in the way, against the request suggesting the reality is not agreed. v5 uses the label wording I offered, which the user accepted as a direction (2026-11-04).
13. `Role`'s goal is the next step in communication: completing the request, aligning player understanding, or bouncing the question back as a puzzle (on v5).
14. The labels are four distinct categories, not a spectrum, so they have no inherent order; `Task` lists them in the order of `Role`'s next steps (on v6).
15. Fiction is not a simulation (2026-11-05). A simulation gives positions and derives relations from them. Fiction establishes the relations and leaves positions undefined, because they don't matter. Pulling the rug out establishes nothing about where the rug is; it revises the fact that the crate is on the rug.
16. People reason about fiction with a twist of register (2026-11-05): they briefly imagine a scene framed by what is established, check it against real-world physics, then abstract back to what is established. Sliding a cup across a table is thought about as motion when judging whether it can be done, yet it establishes no new fact: the cup goes from an unspecified spot on the table to an unspecified spot on the table.
17. Reasoning about fiction is lazy, not exhaustive (2026-11-05). Exhaustive reasoning concludes that the teapot comes with the table; lazy reasoning declines to modify the fact that the teapot is on the table. A secret door in a bookshelf does not have to imagine fifty books moving: the books remain as established. "It's a sort of compression." The working question is "If I move this table, which of these established facts need to be reconsidered?" A pyramid of wine-glasses stacked precariously on the table jumps out, and the glued teapot gets to be ignored.
18. `Reading player intent` and the rule's "defaults to moving" are the old voice, and should describe fictional inertia instead (on v8).
19. It is permissible for the LLM to be a little dumb, so long as it is not recalcitrant (2026-11-05). Users understand that they sometimes said too little for a system to parse their intent, but they get rightly frustrated when the system resists a legitimate intent.
20. Be skeptical of negative instructions that modify positive instructions: LLMs don't seem to deal well with that structure, so state the test positively (2026-11-05, on the chasm sentence).
21. Rules state the constraint plainly, as a rule, in a context that has already explained that rules can be dissolved through action (2026-11-05, on JP-1). "Cannot leave ... until freed" was awkward because it embedded the puzzle-solving mindset, that rules are meant to be bent or broken, in the rule itself.
22. `contingent`, `incomplete` and `complex` may be independent gates, of which we recognize only the first to fire (2026-11-05): an attempt to pry the teapot off with a screwdriver could be all three.
23. The one-word judgment is used for deterministic routing, and any more capable LLM that gets deferred to receives the whole output, including `Needs` and `Revises` (2026-11-05). This was the user's condition for the gates direction.
24. `Reading the scene` aligns with established against unestablished, not present against absent (2026-11-05, on v18). The prompt does not affirm that an unstated thing is neither present nor absent, only that it is not established as either. `Fiction` describes what has been established, since what the place "really is" can change through minting. `Graph` "adds no facts of its own but can help disambiguate the language of the fiction section" (the user's wording).
25. The `Fiction` part is tiny, with the details of established against exhaustive added later as clarifications and exceptions. Migrate them earlier, into `Fiction`, so they frame the later sections immediately (2026-11-05, on v19).
26. Don't tie the scene render to player perception (2026-11-05, on v20). "Reasoning is grounded in this established fiction" replaces "This is the story you are reasoning about" (the user's wording).
27. The lazy view does not need calling out against the graph in the prompt: building lazy-change expectations into `Fiction` and then listing the graph is enough to draw the parallels functionally (2026-11-05, closing JP-11).
28. `incomplete` is renamed `obstructed` from v24 (my suggestion, the user agreed, 2026-11-05). Earlier notes and rows keep the old name where they record what was said at the time.
29. JP-14 may be mixing two types of challenge (2026-11-05): can you do this thing you attempt, against do you even have a plan for the attempt? In the Coyote Game, "Wire the cloud-machine to the tesla coil to make a lightning-storm generator" is an insanely difficult skill challenge that the genre says the Coyote passes without issue, and "Catch the Road-Runner" is a challenge where plan after plan fails to be the right plan.

### Changes that were mine, not from the notes

| # | Change | Why | Status |
| --- | --- | --- | --- |
| M26 | Slice 3: the rule sentences for a pair of things neither of which hosts the other (`[a] and [b] cannot be moved apart. They can still be moved together.`) and for a securing to something not shown (`[a] cannot leave what it is secured to.`), derived from the agreed hosted sentence. The hosted sentence says "is in" instead of "is on" where the child is hosted In (v24 only shows On). `TRIAGE_LABELS` stays at three as the control; the five labels are `JUDGE_LABELS`. The judge prompt is the `judge` answer format with the `judge` scene format, and `attemptQuestion` takes a `'judge'` style for the `Request` wording | v24 fixes only the hosted-On sentence; the rest are needed for the code to cover every scene, and are untested by any probe | Not yet seen by the user |
| M27 | Slice 4 tooling and requests: a `JudgeProbe` event, separate from `SceneReasoningProbe`, that asks a fixture's named request set (`judgeSets.judge`, on `teaTable` and `tavern`) and grades each reply in code: the label is the verdict (`pass`, `border` if the request lists it in `tolerate`, else `failure`; a wrong `simple` always a failure), the form is checked, and `mentions`/`avoids` word lists only flag a reply for reading. It returns a tally per request and every reply. Optional `instructions` and `sceneText` strings replace the judge's text and the rendered scene for one invoke (a draft; together, all but the `Request` line), the form is checked against the steps the instructions number, and every result echoes a hash of each text used. The `teaTable` set adds eight requests beyond the plan's list: `wipe [table1] with a cloth` (the `contingent` case) and `slide [saucer1] across [table1]` (the border case); the `tavern` set is four requests that should be `simple`. The `tolerate` lists, the `mentions`/`avoids` words and the two added requests are mine. The `teaTable` description and two rubrics no longer say freeing is the only way past the glue | The plan asked for criteria agreed before a run, and grading by what an error costs (JP-13). The cap stays at 12 calls per invoke, so eight requests allow one repeat each, or `only` picks some for more repeats | Not yet seen by the user |
| M28 | v25 and v26, after the first Nova Micro run of v24 read the glue as blocking `pick up [table1]`. The user's design (2026-11-05): Rules are invariant consequences that may be interpreted as obstacles; each rule has a handle (`teapot-secured-to-table`); each relevant rule gets a verdict of `No consequence`, `Contradiction` or `Consequence: ...`; rule text is written around the positive invariant; a separate `Rules` step sits before `Obstacle`, which keeps facts that are not rules. Mine: the wording of every change; the rule sentence `[teapot1] stays glued to [table1], wherever [table1] is.` in place of the user's longer example and of the M18 sentence; moving rule consultation out of `Picture`, so the picture is formed before the rules are read; `Contradiction` applying only when the request offers no way of changing the facts behind the rule, so a plan (note 29) reads as a `Consequence`; `Obstacle` naming the fact behind a contradicted rule; `obstructed` listing a contradicted rule | v24 frames Rules as constraints and asks for what stands in the way, and Micro read the glue rule as a blocker. v25 changed only the description and is superseded by v26. Neither was the agreed text when written; v24 was | Not yet seen by the user |
| M29 | v27. The user's design (2026-11-05): a hierarchy of movable reference frames, tied to containment, in the established-fiction register (containment says which frame a thing occupies; relations and positional language are frame-local), with the movement reasoning in the `SecuredTo` rule and not in `Contradiction`, and with movement language applying only to actions that move something (lighting a candle moves nothing). My wording: the `Fictional reference frames` section and its train example, its placement before `Reading player intent`, the Picture sentence "If a thing moves, say which, and the frame it moves within or into", and the rule `[teapot1] keeps its place in [table1]'s frame, whatever happens to [table1]'s place in its own frame.` "Separated by semicolons" is gone from the Rules step, having leaked into replies twice. Open: the rule no longer says "glued" (Fiction and Graph still do), a securing that crosses frames (a teapot chained to the wall) needs its own rule wording, and the fixture has no request where nothing moves | Replaces "Moving a thing changes where that thing is", which treats a thing's position as independent of what it stands in relation to and contradicts the Fiction bullet. Moving the table now needs no second motion for the teapot. None of v25, v26 or v27 became the agreed text | Run on Nova Micro 2026-11-05 (table, teapot, pour, 2 repeats each): 0 of 6. Table `impossible` and `obstructed`, teapot `impossible` twice, pour `simple` twice (wrong). Every Picture line restated the request and named no moved thing or frame, and every Revises line on table and teapot said nothing, so the frame language was recited and not used. The rule verdict did start to vary by request (`Consequence` on pour) |
| M30 | [v28](judgeFailureDrafts/v28.txt), after the user's read-through of v27. The user's design (2026-11-05): relations and frames traced through worked examples set aside from the scene, each with its relation change, its frame change and how the telling reads (things travel along with their container and do not move relative to it); relations holding as established until the action requires otherwise; `Conflict` in place of `Contradiction`; a sentence of reasoning before each rule verdict; the `SecuredTo` rule's "stays fixed relative to [table1]'s frame"; no "stand" for relations and no pronoun reaching across a sentence. My wording: the `Relations and frames` definition, the labels `Relations`/`Frames`/`In the telling`, the lamp-bolted-to-a-crate case in both directions, the rule's second sentence ("When [table1]'s frame moves, [teapot1] travels along with [table1]", in place of the user's "implies no restriction", kept as the fallback), and "occupies" so that "[table1]'s frame" always means the frame the table provides | "Moving a thing" and the frame section of v27 gave no account of how a relation and a frame connect, and Micro's replies recited them. The lamp examples are close to the teapot, so a right table verdict could be copying; pour is the nearest case they leave unspelled. The user made v28 the draft to beat on 2026-11-05, and the code builds it | Run on Nova Micro 2026-11-05 (table, teapot, pour, 2 repeats each): 4 of 6. Table `simple` twice, the first time Micro has got it; teapot `obstructed` and `impossible`, both on a `Conflict` verdict; pour `obstructed` and `simple` (wrong, `No consequence`). Several changes went in together, so which one fixed the table is unknown; the table replies repeat the rule's second sentence. The other five, 2 repeats each: cup `simple` ×2, table in cup `impossible` ×2, slide `simple` ×2 (passes); pry `obstructed` ×2 (border); wipe `simple` ×2 (wrong, `Needs: nothing` both times). All eight requests: 10 pass, 2 border, 4 failure of 16, with 3 wrong `simple` (wipe ×2, pour ×1) |

### Settled

Decisions a fix must not undo without saying so. A "was JP-n" label resolves any older reference.

- **The replacement rule (was JF-1):** it stands, as [When a candidate replaces the baseline](#when-a-candidate-replaces-the-baseline) now words it. A label the fixture tolerates is a border, not a lost pass. The `teaTable` table tolerates `complex` (user, 2026-11-06), since that division waits for the planner and `complex` fails safe, as the `tavern` table already does.
- **Two uses of "you" (was JP-3):** a sentence in `Reading the scene`: 'In the scene, "you" is the player'. The render stays as it is.
- **The user's `SECURED` passage (was JP-5):** it stays out. Its removal was mine, and this is its explicit decision. A code comment in `sceneRules.ts` records that it made things worse, and the rule and the inertia framing now cover its job. It is the first thing to try if the table refusal survives Slice 4.
- **"Text adventure" (was JP-7):** not named. The genre may suggest things are fixed in place, which could feed the table refusal. The text-adventure reading stays a requirement of the behaviour, and `game master` stays.
- **Lazy view and the graph (was JP-11):** no further prompt text (note 27). `Fiction` is the framing that replaced the old `LADDER` steps and the "what goes with what" wording of `PRECEDENCE`.
- **Transitory against established (was JP-12):** no further text. Only what the action depends on can change the label: `Needs` ("could not work without") and `Revises` ("established facts") leave a detail the action merely produces, such as a slick of moisture, to the narration. The full judgment of what is worth recording is for the future.
- **Rule wording (was JP-1), replaced by M28 to M30:** a rule states an invariant under a handle, and the judge gives each relevant rule a verdict. The hosted rule reads `[teapot1] stays fixed relative to [table1]'s frame. When [table1]'s frame moves, [teapot1] travels along with [table1].` (user's first sentence; second mine, with the user's "implies no restriction" as the fallback). A player can still set out to change the facts behind a rule. The rule never says "glued"; the `Rules` bullet's "facts behind it" is the only join.
- **Open world (was JP-9):** what is unstated is not established as either present or absent. Details get established because they are newly relevant, not because they newly occurred. Plausible improvisation is wanted, and improvisation for convenience is not. Silence can count as evidence: a bridge over a yawning chasm "would have been mentioned if it were there", so it leaves `contingent` for `incomplete`.
- **Improvised details (was JP-13):** the `contingent` label, with sure and unsure suggestions going to the same place. Whether to mint is decided by a more capable engine, which is for CA-6; a new established fact reaching the graph leaves a note there too. Fault tolerance: most border errors recover, through another turn or the engine's second look. A wrong `simple` has no recovery, and a wrong `impossible` recovers only if the player has something to add, so it does not excuse the table refusal.
- **Independent gates (was JP-15):** `Answer` is one word, the first gate that fires, with the obstacle before `Needs`, and code routes on that word alone. `contingent`'s and `incomplete`'s sentences stay for the first probe. `complex` stays a judgment, since `Revises` alone can't decide it. For CA-6: a deferred LLM gets the whole output as a first pass's notes, not as established facts, and its prompt has to say so, or a wrong `Needs` could anchor it.
- **The judgment schema (was JP-6):** five labels for this iteration. Calculating likely consequences nobody referred to, such as a precarious pyramid of wine-glasses on the table, is a known weak point, deferred to a future iteration as its focus (user, 2026-11-05). So Slice 4 does not grade it, and my reading of it as `complex` was not adopted. `JUDGE_LABELS` in code has the five; `TRIAGE_LABELS` keeps three as the control (M26).
- **`obstructed`, and `impossible` (was JP-10, under the name `incomplete`):** the touchstone is respect for player ingenuity (user, from GMing indie RPGs): going from "It's an adamantium door... No man. Didn't you listen?" to "Well, I don't know. Can you? What do you want to try?". It differs from `Consult`, which asks the player to clarify and sets no puzzle. Freeing is not the only way past an obstacle (tipping the table to pour), so the judge names the obstacle and no way past it. The tone of the invitation is the whole system's, not this check's. `impossible` is a mismatch of shared reality, not "stop trying": "I don't think you and I have the same idea of the size of shoeboxes or motorcycles." For CA-6: an `obstructed` entry will at some point go to an LLM that decides how to present the possibilities to the player, and which will sometimes describe it as impossible if the player has no clue a path exists, so the judge need not draw that line. `obstructed` still says "getting past it is up to the player" as a placeholder (JP-14).
- **Module boundaries (was JP-8):** `Reading the scene`, `Reading player intent` and `Improvising` become modules, and `Task` belongs to the judge (mine, the user agreed).
- **Reasoning and answer order (was JP-2):** the lines are `Picture`, `Rules`, `Obstacle`, `Needs`, `Revises (if it happens)` and `Answer` (`Rules` added by M28). To watch in Slice 4: the model may recite the structure, or decide first. Slice 3: the scorer stops reading the last line alone, reads `Answer:` plus a sentence, and gets the label with code alone, since routing depends on that word (the user agreed).
- **A direct attempt on a rule (was JP-14):** note 29 settles it (my reading, the user agreed). `obstructed` means the player has no plan yet: "pick up the teapot", "catch the Road-Runner", and "up to the player" is correct for it. A request with a plan makes the obstacle its target, so the fact appears in `Revises`, not `Obstacle`: "pry it off with a screwdriver" reads `Obstacle: nothing`, `Needs: a screwdriver`, `Revises: glued to the table`, and answers `contingent`. Whether the attempt works is a skill question, and whether it was the right plan is an outcome question. Neither is the judge's, and today the game's genre answers them. To watch in Slice 4: a model that still names the target as the obstacle answers `obstructed`, a recoverable error; "pry it off" is graded only as not `simple`. Thin plans ("with a feather") are a tolerated border. To revisit when non-genre-resolved challenges arrive, with real rules and skills (user, 2026-11-05).

### Size

Nova Micro (user, 2026-11-05, not checked here): a 128k token context window, and manual cache points, which must not be set on a chunk under 1k tokens. An instruction block over 1k tokens before the variable scene can be cached once and read from cache afterwards, which is sometimes worth padding the instructions to reach, hopefully profitably.

So the size that matters is the instructions alone, and the pressure has a floor as well as a ceiling. v23's instructions are about 4,800 characters, roughly 1,150 to 1,200 tokens by rule of thumb (mine, not a real count), and the scene and request about 180 more. That margin is thin, and cutting `contingent`'s and `incomplete`'s sentences would use some of it. v28's instructions are 7,619 characters, about 1,900 tokens by the same rule of thumb, well over the floor.

For Slice 3 (mine): keep the instructions byte-identical across calls, with the cache point between them and the scene; v23's hold nothing variable. Get the real count from Bedrock before relying on it. Still to check: how long a cached block lives, which decides whether a low-traffic game gets any hits, and the price of cache writes against reads. If padding is ever needed, a worked example of the five lines could earn its place, as `Task`'s structure is an open soft spot, though examples can leak into answers.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| JF-2 | Does the judge get a `challenging` label (the user's proposal, [Question 1](#question-1-a-feat-the-labels-cannot-name)), and until then what does the fixture expect of the `tavern` table? It reopens the five labels of JP-6, and meets JP-14, under which the skill question is not the judge's: the label would say a skill question exists and leave the answer to the rules. | No slice | Open |

## Progress

| Slice | State |
| --- | --- |
| 1. Failure 1 | Fix found in v41, the draft to beat. Rebuild pending, after v43 and `tavern` |
| 2. Failure 2 | Not seen on v41, teapot `obstructed` 3 of 3, and the rule check is in `Tests`. Not closed: three replies, and v42 shows it is fragile |
| 3. Failure 3 | Accepted for now, next experiment recorded under [Failure 3](#failure-3-an-action-never-pictured) |
| 4. Hand back | Not started |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`.

1. [ ] **Slice 1: Failure 1.** v41 is the fix. Remaining, in order:
   1. Probe [v43](judgeFailureDrafts/v43.txt) on teapot, pour and wipe, 9 calls. It decides what gets built: if it holds, `Recap` can go behind the development flag and v43 runs the full set; if it stays terse, `Recap` may be doing work, and v41 is built with it in and a higher token limit.
   2. Run the winner on the remaining `teaTable` requests as needed, and on `tavern`, 8 calls, with its own scene text.
   3. Rebuild `frameJudge.ts` and the golden tests, with the rest listed [under Failure 1](#v39-onward), then redeploy. Verify as in [Verification](#verification), and mark this done.
2. [ ] **Slice 2: Failure 2.** On whatever Slice 1 leaves as the baseline. Teapot needs enough repeats there to close this or to reopen it, with table in cup alongside. If an edit is still needed, apply the replacement rule and rebuild as in Slice 1.
3. [ ] **Slice 3: Failure 3.** After Slices 1 and 2, since its edits touch the same steps, starting with the fiction-register `Picture`. It can stay open if the user leaves it.
4. [ ] **Hand back:** record the standing of each failure on the scene projection plan's Slice 6 row, move what lasts from [Carried from the judgePrompt plan](#carried-from-the-judgeprompt-plan), repoint the links in `calibration/AGENT.md` and the pointer in `frameJudge.ts`, then delete this plan and its drafts.

## Verification

- A draft: the probe, read reply by reply. No test commands.
- A candidate that replaces the baseline, from `lambda/ephemera/`: `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`, with the composed `teaTable` prompt checked byte for byte against the draft.
