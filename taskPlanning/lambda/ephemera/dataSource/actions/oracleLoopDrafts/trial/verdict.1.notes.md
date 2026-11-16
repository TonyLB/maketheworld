# The verdict, draft 1: which is right about the question

For [the non-rule cell plan](../../AGENT.nonRuleCell.planning.md#recommended-order)'s step 3, the trial's stage 3. The design is the plan's [Slice B's design: the verdict and the stage contract](../../AGENT.nonRuleCell.planning.md#slice-bs-design-the-verdict-and-the-stage-contract), accepted by the user 2026-11-16 as a first iteration: something that can reasonably decide between the two. What the pipeline then suggests as an improvement, from the combinations of arguments, rebuttals and judgments, is later tuning (the user). The triad is the user's; the wording is mine.

## The change

The first draft of a new stage:
- **Role** (new): judging between an argument against a player's plan and its rebuttal, with what follows listed, as the rebuttal's Role lists its inputs.
- **Reading the scene and Reading the steps:** word for word from rebuttal draft 5, the securing sentence included.
- **Task** (new): one or two sentences on what the scene and the steps say about the argument's question, quoting the lines that bear on it, then `{"answer": "argument" | "rebuttal"}` in a trailing block.
  - The description comes before the verdict, as the rule cell's did (RC-L5): Micro decides, then justifies.
  - Each input is used by a step (TR-P7): the question by the description, the argument and the rebuttal by the decision.
- **The render:** the rebuttal's, with `The rebuttal: <sentence>` on the line straight after the argument.
- **The grade** (code), through the stage's contract: the block parses, and `answer` is one of the two.
- **The cap:** 400 tokens.

## How it is probed

- **Payload:** one payload, all 11 cells, `repeats: 1`, `options: {"stage": "verdict", "upstream": "lifted"}`, 11 calls, Micro, instructions `983a8bc6` (1366 chars).
- **The pairs:** each cell's lifted rebuttal is from rebuttal batch 8, shown with the golden argument it answered (the pairing rule). It is repeat 1 everywhere except OC-3, which uses repeat 2.
- **Results:** the response is saved to a file.
- **Deploy check:** the response's `stage` is `verdict`. The probe needs a deploy, since the stage is new.

## Rubric (written before the batch)

The expected answers are mine, from the trial proposal. Each cell's look-for is in the tally. h5 and h10 are read apart. OC-9 is tallied, not graded.

- **The tally,** out of 10 graded:
  - `argument` expected: the size cells (OC-11, OC-18, OC-3), h7 and h5;
  - `rebuttal` expected: the guards (OC-1, OC-2, OC-20, OC-6) and h10.
- **The separation:**
  - does the judge pick the argument on all three size cells, where each rebuttal's claim is visibly false?
  - does it pick the rebuttal on the four guards, where each rebuttal's claim is true from a quoted line?
  - a split along those lines is the triad's bet paying off.
- **Anchoring:**
  - does the reply side with the nearest text, the rebuttal, everywhere? A size cell answered `rebuttal`, with a description that echoes "small enough to fit", is the sign.
  - count the replies whose description repeats the rebuttal's claim, against those that state the scene's lines in their own right.
- **The description:**
  - is it a description of the scene's lines, or the verdict stated first and justified after (RC-P2's pattern)?
  - which lines does it quote, and are they the deciding ones (on the size cells "a small round tea table" with its size, on h7 the slide line)?
- **h7 (TR-P14):**
  - does the description quote the slide line, which the rebuttal evades?
  - does the judge read the rebuttal's "still on [table1]" as false against it?
- **OC-2:** is the rebuttal's drift (the saucer first, a scene line labelled "the steps say") held against it?
- **h5 and h10, apart:**
  - h5: what the description says the tip does to a loose teapot;
  - h10: whether step 1 (the saucer taken) is noticed by either side, or by the judge.
- **OC-9:** which it picks, and whether "does not specify any weight restrictions" is taken as a rebuttal.
- **Form:**
  - malformed replies;
  - the length of the description;
  - cut-offs at 400;
  - prose after the block.

## Results (2026-11-16, batch 9)

The response is at `scratchpad/trial-verdict-1-results.json` (11 calls, 0 errors), with instructions `983a8bc6` and stage `verdict`. The inputs hashes are pinned in `renderPins.test.ts`.

**The tally:** 6 right, 4 wrong, 0 malformed, and OC-9 ungraded. Across the 11 calls, the answers are `rebuttal` 8 and `argument` 3.

| Cell | Expected | Answer | Reading |
| --- | --- | --- | --- |
| OC-1, OC-20 | rebuttal | rebuttal | right; "a small round tea table" is taken as liftable by one person |
| OC-6 | rebuttal | rebuttal | right; "the teapot contains tea", poured directly |
| OC-2 | rebuttal | rebuttal | right, but on the rebuttal's drift ("indirectly by first picking up the saucer"); the mislabelled line isn't held against it |
| OC-18 | argument | argument | right; the description brings in common sense: "not feasible given typical sizes of cups and tables" |
| OC-11, OC-3 | argument | **rebuttal** | wrong; "small round" is accepted as "small enough to fit inside the cup", with no size weighed against a cup |
| h7 | argument | argument | right; **the description states the slide line** ("would cause [saucer1] and [cup1] to slide off the table onto the floor") against the rebuttal's "still on [table1]" (TR-P14, judge side) |
| h5 | argument | **rebuttal** | wrong; it accepts the rebuttal's dodge, "tipping the table is unnecessary" |
| h10 | rebuttal | **argument** | wrong; the description says both that the tip makes the cup fall and that "the rebuttal correctly points out" the tip is unnecessary. Step 1, the saucer taken, is seen by neither side nor the judge |
| OC-9 | open | rebuttal | "does not specify any weight restrictions" is taken as a rebuttal of a long oak trestle's weight |

**The description:**
- **It restates the inputs, 11 of 11** (TR-P15): "The scene establishes … The player's request is … The question is … The argument states … while the rebuttal argues …". It summarizes the four inputs in order, ending on the rebuttal. That makes it a summary of the two sides, not a reading of the scene about the question.
- It never says which side holds, and the answer appears in the block with no reasoning before it.
- Of the replies, 2 quote a line exactly (OC-20, OC-11); the rest paraphrase.

**Anchoring:** every description ends on the rebuttal's claim, as the render does. `rebuttal` is the answer in 8 of 11, and the 3 `argument` answers each have a world fact in the description that the rebuttal doesn't give: OC-18's typical sizes, h7's slide line, h10's falling cup. **The judge accepts a rebuttal's inference from a quoted line** whenever its description holds no fact that contradicts it (TR-P16): OC-11 and OC-3's "small, so it fits", h5's "unnecessary", OC-9's "no weight restriction".

**Form:**
- 0 malformed;
- 350 to 565 chars;
- no cut-offs at 400;
- no prose after the block.

**Reading** (mine), at x1 and exploratory:
- **Where it holds:** where the scene's line truly answers the question (the four guards), the judge sides with the rebuttal, 4 of 4.
- **Where it fails:** where the rebuttal's claim is false only by common sense (the size cells), it fails 2 of 3. It succeeds on the one cell whose description brought common sense in.
- **The mechanism:** the Task asks what "the scene and the steps say", which is TR-P4's "source as standard" again, from the judge's side. The scene never says a table can't fit in a cup, so a description held to the scene can't contradict the rebuttal. The size cells need common sense to be a source the description may state. OC-18 shows that when it does, the verdict follows.
- **h7 shows the separation can work on a consequence line** when the description reaches it.
- **h5 and h10** are where the judge, like the rebuttal, takes "tipping is unnecessary" as an answer. That is a plan-level dodge the question's wording doesn't rule out.
