# The verdict, draft 5: the two voices tagged

For [the non-rule cell plan](../../AGENT.nonRuleCell.planning.md#recommended-order)'s step 3, the trial's stage 3. The design is the plan's [Verdict draft 5: the two voices tagged](../../AGENT.nonRuleCell.planning.md#verdict-draft-5-the-two-voices-tagged), accepted by the user 2026-11-16 and built on draft 4. The idea and the tag names are the user's: mark the argument and the rebuttal as two different and opposing voices, since Nova Micro is trained on internal XML-style tags and may respond to them strongly (the user's understanding from research). The placement and wording are mine.

## The change

One change in two parts, which work only together:
- **The render** (the verdict's only):
  - the scene and the question come as before;
  - then `<argues-plan-cannot-happen>` around the argument line, and `<argues-plan-can-happen>` around the rebuttal line;
  - the lines inside the tags are as before, and the question stays outside both.
- **Role:** its list of inputs names the tags: "the argument, in `<argues-plan-cannot-happen>`, and the rebuttal, in `<argues-plan-can-happen>`".

**Unchanged:**
- draft 4's skepticism sentences, and draft 3's disagreement sentence and verdict rule;
- the cells and expected answers, the grade, and the cap of 400;
- the rebuttal stage's renders, held byte for byte by their pins.

## How it is probed

- One payload, all 11 cells, `repeats: 1`, `options: {"stage": "verdict", "upstream": "lifted"}`, so 11 calls, Micro.
- The instructions are `c08e0bd4` (2777 chars).
- The response is saved to a file.
- **A deploy is needed, since the render changes.**
- **Deploy check:** the inputs hashes are the draft 5 pins in `renderPins.test.ts`, every one moved from batches 9 to 12: OC-11 `8ebd4108`, OC-1 `4537a28b`, h7 `aff63480`.

## Rubric (written before the batch)

The baseline is batch 12's 5 of 10, with every answer as batch 11's. h5 and h10 are read apart. OC-9 is tallied, not graded.

- **The settling clause,** the main measure: how many disagree with the rebuttal (batches 11 and 12: 1 of 11, OC-3)? What do they rest on?
- **The scene-attribution:** does any clause still give the rebuttal's claim as what the scene says? Batch 12 did on OC-18, OC-11 and h7.
- **The size cells** (OC-11, OC-18, OC-3): does common sense settle against the rebuttal?
- **The guards:** still right, 4 of 4? Count any true rebuttal turned down because it is marked as a voice with a stake.
- **h7:** the slide line.
- **h5 and h10:**
  - the crux (batches 11 and 12: "whether tipping the table is necessary");
  - whether the second form is ever used.
- **Plan or crux:** does the settling clause speak of the plan ("the plan can happen") instead of the disputed point? The tag names are about the plan.
- **The tags in the reply:**
  - echoed, or not;
  - whether either side is named as a voice ("the side arguing …"), and whether the skepticism sentences now show.
- **The rebuttal's half:** copied whole (batch 12: 3 of 11)?
- **The verdict follows the sentence.**
- **Form:**
  - malformed replies;
  - length, against batch 12's 331 to 666 chars;
  - cut-offs at 400;
  - prose after the block.

## Results (2026-11-16, batch 13)

The response is at `scratchpad/trial-verdict-5-results.json` (11 calls, 0 errors), with instructions `c08e0bd4` and stage `verdict`. **Deploy check passed:** the inputs hashes are draft 5's pins (OC-11 `8ebd4108`, h7 `aff63480`, and every other cell).

**The tally:** 6 right, 4 wrong, 0 malformed, OC-9 ungraded. `rebuttal` was the answer in 9 of 11. **One answer moved from batch 12: OC-18, to `argument`, right.** Every other answer is as in batches 11 and 12.

**OC-18's settling clause** is the first in batches 10 to 13 to weigh whether the rebuttal's source supports its claim: "which the scene says is not necessarily so because it only describes the cup and table without specifying their relative sizes in a way that would definitively support the claim that the cup can accommodate the table". That is draft 4's "a quoted line shows only what that line says", acted on. OC-18 was also right in batches 9 and 10, by a different route ("typical sizes"), so at x1 this can't be told from the cell's earlier wobble.

**The settling clause against the rebuttal: 2 of 11** (OC-18, OC-3), against 1 in batches 11 and 12. OC-3's clause is "which common sense says is true".

**The scene-attribution persists:**
- OC-11: "which the scene says is that the table is a small round tea table, which is small enough to fit inside the cup";
- h7: "which the scene says is true that the cup remains on the saucer on the table";
- OC-1 and OC-20 likewise, rightly on those cells.

**The tags and the voices:**
- No reply echoes a tag, names a side as a voice, or mentions persuasion or confidence.
- The settling clauses speak of the crux, not the plan, so the risk from the tag names didn't show.

**Unchanged:**
- the first form 11 of 11, the second never;
- h5 and h10's crux, "whether tipping the table is necessary";
- h7's slide line, never read;
- the rebuttal copied whole 3 of 11;
- the verdict follows the sentence 11 of 11.

**Form:** 0 malformed; 324 to 662 chars; no cut-offs.

**Across batches 9 to 13** (x1 each, h10 at its current expected answer): `rebuttal` 8, 10, 10, 10, 9 of 11.

| Cells | b9 | b10 | b11 | b12 | b13 |
| --- | --- | --- | --- | --- | --- |
| The guards (4) | right | right | right | right | right |
| OC-11, h5 | wrong | wrong | wrong | wrong | wrong |
| OC-18 | right | right | wrong | wrong | right |
| OC-3 | wrong | wrong | right | right | right |
| h7 | right | wrong | wrong | wrong | wrong |
| h10 | right | wrong | wrong | wrong | wrong |

**Reading** (mine), at x1:
- **The tags were mostly read past, as draft 4's sentences were.** The one moved answer, OC-18, came with reasoning that looks like draft 4's skepticism acting for the first time. It may be the tags giving the sentences a referent, or the cell's wobble; one call can't tell.
- **The settling clause still takes the rebuttal's inference as what its source says,** wherever it doesn't bring a fact of its own (TR-P18, TR-P19).
- **h5, h10 and h7 haven't moved since batch 10** under any framing: the dodge's crux, and the slide line never read.
