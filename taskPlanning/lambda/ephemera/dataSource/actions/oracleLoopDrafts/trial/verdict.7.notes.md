# The verdict, draft 7: the ordinary as the default

For [the non-rule cell plan](../../AGENT.nonRuleCell.planning.md#recommended-order)'s step 3, the trial's stage 3. The design is the plan's [Verdict draft 7: the ordinary as the default](../../AGENT.nonRuleCell.planning.md#verdict-draft-7-the-ordinary-as-the-default), accepted by the user 2026-11-16, built on draft 5. The diagnosis and the rule are the user's: what the scene doesn't say tends to default to common sense, not to what would have been mentioned if it were true. The rule's first half is the user's wording ("is expected to have some ordinary value"). The placement and the second half are mine.

## The change

One sentence is added to the end of **Reading the scene**:

> Things are as such things ordinarily are, except where the scene says otherwise: a detail the scene leaves out is expected to have some ordinary value, and a claim that something departs from the ordinary needs the scene to say so.

**Unchanged:** everything else in draft 5:
- the tags;
- draft 4's skepticism sentences in the reading section;
- the disagreement sentence and the verdict rule;
- the render (draft 5's pins), the cells, the grade, and the cap of 400.

Draft 6's step-skepticism is not carried.

## How it is probed

One payload, all 11 cells, `repeats: 1`, `options: {"stage": "verdict", "upstream": "lifted"}`: 11 calls on Micro, with instructions `2ee9cf85` (3009 chars). The response is saved to a file. No deploy is needed.

## Rubric (written before the batch)

The baseline is batch 13's 6 of 10, from draft 5, the base. h5 and h10 are read apart. OC-9 is tallied, not graded.

- **The settling clause, appealing to the ordinary:** does it say what such things ordinarily are, such as "a table doesn't ordinarily fit inside a cup"? On which cells, and for which side?
- **The size cells** (OC-11, OC-3, OC-18): `argument` expected, since the rebuttal's claim departs from the ordinary. OC-11 has been wrong in every batch.
- **The guards:** still right? Count which rest on the ordinary (a small tea table is liftable, a teapot pours) as well as on the line.
- **OC-9:** is the range read as open (some trestles liftable, some not)? Or is it settled for one side, and on what?
- **The absence move** (TR-P20): is any clause still settling by "the scene doesn't specify"?
- **The scene-attribution:** is the rebuttal's claim still given as what the scene says (OC-11, h7)?
- **h7, h5 and h10:** read, not expected to move. These are a stated line contradicted and dodges, not defaults.
- **The verdict follows the sentence.**
- **Form:**
  - malformed replies;
  - length, against batch 13's 324 to 662 chars;
  - cut-offs at 400;
  - prose after the block.

## Results (2026-11-16, batch 15)

The response is at `scratchpad/trial-verdict-7-results.json` (11 calls, 0 errors), with instructions `2ee9cf85` and inputs hashes as draft 5's pins.

**The tally:** 5 right, 5 wrong, 0 malformed, OC-9 ungraded. `rebuttal` was the answer in 10 of 11. Every answer is as in batches 11 and 12: OC-3 alone is `argument`.

**The rule in the text: none.**
- No clause says what such things ordinarily are, or weighs a departure from the ordinary.
- OC-9 still settles by absence ("which the scene says is unspecified").
- **The quote is given as the settlement:** "which the scene says is that the table is a small round tea table" (OC-11, OC-1, OC-20). OC-18 gives the rebuttal's claim as the scene's: "which the scene says is that the cup is large enough to accommodate the table".

**What decides, across batches 11 to 15** (55 calls, drafts 3 to 7): **the source the settling clause names.**

| The clause names | → rebuttal | → argument |
| --- | --- | --- |
| "the scene says" | 42 | 1 |
| "common sense says" | 6 | 4 |
| "the steps say" | 2 | 0 |

On the size cells, "the scene says" gave `rebuttal` 9 of 10 times, and "common sense says" gave `argument` 4 of 5 times. The clause picks "the scene says" wherever the rebuttal quoted the scene. Once that slot is filled, the only scene text that bears on the point is the rebuttal's quoted line, and the answer follows. OC-3's right answers in batches 11 to 15 all came with "common sense says".

**Form:**
- 0 malformed;
- 331 to 645 chars;
- no cut-offs;
- the first form 11 of 11.

**Reading** (mine), at x1:
- **The rule was read past,** the third addition to a reading section to be read past (drafts 4, 5 and 7: batches 12, 13 and 15). Only changes to the Task's step have moved the replies (drafts 2, 3 and 6).
- **The settling clause's source slot is the lever.** "The scene says" is listed first in the template, and it is the rebuttal's own source. Choosing it settles the point for the rebuttal. The user's rule asks the clause to start from the ordinary and turn to the scene only for a stated departure, which is the reverse order. That rule, put into the step, is a candidate.
