# The verdict, draft 4: skepticism stated

For [the non-rule cell plan](../../AGENT.nonRuleCell.planning.md#recommended-order)'s step 3, the trial's stage 3. The design is the plan's [Verdict draft 4: skepticism stated](../../AGENT.nonRuleCell.planning.md#verdict-draft-4-skepticism-stated), accepted by the user 2026-11-16, built on draft 3.

The diagnosis and the idea are the user's:
- **Form over validity:** the rebuttal always has the confident form of a valid counter-argument, and the judge reads that form ("my inputs contain a valid counter-argument") and looks no further.
- **The idea:** prompt Micro to be skeptical, saying plainly that an input will say something that may not be true, rather than tweaking format, which is always a little fragile.

The wording is mine.

## The change

Two sentences are added at the end of **Reading the argument and the rebuttal**:

> Both were written by sides told to argue their position as strongly as they can, whatever is actually so, so each states its claims with the same confidence whether they are true or not. A quoted line shows only what that line says; what a side draws from it may or may not follow.

These sentences are:
- **a fact about the inputs,** the triad's own design, so the judge gets the reason to doubt and not only an instruction to;
- **symmetric,** applying to both sides;
- **in positive terms,** with no "do not".

**Unchanged:**
- everything else in draft 3, including the disagreement sentence;
- the render, the lifted pairs, the expected answers, the grade, and the cap of 400.

## How it is probed

- One payload, all 11 cells, `repeats: 1`, `options: {"stage": "verdict", "upstream": "lifted"}`: 11 calls, Micro.
- The instructions are `7857151e` (2716 chars).
- The response is saved to a file.
- No deploy is needed: the prompt is in the payload, and the cells are unchanged since batch 11.

## Rubric (written before the batch)

The baseline is batch 11's 5 of 10 (`rebuttal` 10 of 11). h5 and h10 are read apart. OC-9 is tallied, not graded.

- **The settling clause,** the main measure: how many disagree with the rebuttal (batch 11: 1 of 11, OC-3)? Where they do, what do they rest on: the quoted line read on its own, common sense, or the steps?
- **The size cells:** does the clause say a small round tea table doesn't fit inside a cup? Does "the cup is large enough" (OC-18) still pass?
- **The guards, the mirror fault:** does skepticism turn down the true rebuttals? They have been right 3 of 3 batches. Count any guard whose clause doubts "a small round tea table" as liftable, or the teapot as what tea is poured from.
- **h7:** does the clause read the slide line, now that the rebuttal's "remains on [saucer1]" is marked as something that may not follow?
- **h5 and h10:** is the second form used at all, and is the crux still taken from the rebuttal's topic?
- **The skepticism in the text:**
  - does the reply say anything doubting either side, and of which side;
  - is the argument doubted as well, since the sentences apply to both?
- **The rebuttal's half:** still copied whole (batch 11: 7 of 11)?
- **The verdict follows the sentence.**
- **Form:**
  - malformed replies;
  - length, against batch 11's 383 to 687 chars;
  - cut-offs at 400;
  - prose after the block.

## Results (2026-11-16, batch 12)

The response is at `scratchpad/trial-verdict-4-results.json` (11 calls, 0 errors), with instructions `7857151e`, stage `verdict`, and inputs hashes as batch 9's.

**The tally:** 5 right, 5 wrong, 0 malformed, OC-9 ungraded. `rebuttal` was the answer in 10 of 11. **Every cell's answer is the same as in batch 11:** OC-3 is the one `argument`, and the guards are right.

**The skepticism, in the text: none.**
- No reply doubts either side, and none mentions confidence, persuasion or what a line shows.
- **The settling clause disagrees with the rebuttal 1 of 11,** OC-3 again ("common sense says is that the table is too large to fit inside the cup"), as in batch 11.
- **It attributes the rebuttal's claim to the scene,** the very move the added sentence describes: OC-18's "which the scene says is true about the cup being large enough to accommodate the table", OC-11's "which the scene says is that the table is small enough to fit", and h7's "which the scene says is true that the cup remains intact and on the saucer".

**What changed:** the rebuttal's half is copied whole in 3 of 11 (batch 11: 7). It is given as the bare claim more often, without its quote: h7's "the cup remains intact and on the saucer", OC-20's "[table1] is manageable to pick up". The verdicts are unchanged, so this is shorter, not more skeptical.

**Unchanged:**
- the first form 11 of 11, and the second never used;
- h5 and h10's crux, still "whether tipping the table is necessary";
- h7's slide line, still never read;
- the verdict follows the sentence, 11 of 11.

**Form:** 0 malformed; 331 to 666 chars; no cut-offs.

**Reading** (mine), at x1:
- **The two sentences were read past.** The answers didn't move on any cell, and nothing in the text shows them.
- **Where they sit:** they are in a reading section, and the Task's sentence has no step that uses them. The settling clause asks only for a source to be named ("which the scene says is …"), not for what that source's line shows. So the claim can be put in the scene's mouth without breaking the form.
- **TR-P7's pattern, for an instruction:** an input that no step names is ignored (the rebuttal's question in batch 5). This is the same for a statement that no step names.
