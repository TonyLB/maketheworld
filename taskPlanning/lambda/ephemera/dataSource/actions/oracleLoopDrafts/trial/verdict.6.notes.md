# The verdict, draft 6: skepticism in the decision

For [the non-rule cell plan](../../AGENT.nonRuleCell.planning.md#recommended-order)'s step 3, the trial's stage 3. The design is the plan's [Verdict draft 6: skepticism in the decision](../../AGENT.nonRuleCell.planning.md#verdict-draft-6-skepticism-in-the-decision), on draft 5. The direction is the user's (2026-11-16): first just move the skepticism into the decision, and see whether Micro can apply judgment with only that instruction. The placement and the wording are mine.

## The change

Draft 4's two skepticism sentences move **out of Reading the argument and the rebuttal** and **into the Task**. They sit straight after the first form's template, attached to its last part, the settling clause:

> For the last part, what is actually so about that point, take neither side's word for it: both were told to argue their position as strongly as they can, whatever is actually so, so each states its claims with the same confidence whether they are true or not, and a quoted line shows only what that line says, while what a side draws from it may or may not follow.

The wording is draft 4's, except for the lead-in ("For the last part, …, take neither side's word for it") that ties it to the clause that decides. TR-P7's pattern is that an instruction no step uses gets read past (batches 12 and 13), and this gives the instruction a step.

**Unchanged:**
- the tags and the Role (draft 5);
- the disagreement sentence and the verdict rule (draft 3);
- the rest of the reading section;
- the render (draft 5's pins), the cells, the grade, and the cap of 400.

## How it is probed

- One payload, all 11 cells, `repeats: 1`, `options: {"stage": "verdict", "upstream": "lifted"}`: 11 calls on Micro.
- The instructions are `673fe7c2` (2860 chars).
- The response is saved to a file.
- No deploy is needed: only the prompt changed, and the cells and render are as deployed for batch 13.

## Rubric (written before the batch)

The baseline is batch 13's 6 of 10. h5 and h10 are read apart. OC-9 is tallied, not graded.

- **The settling clause,** the main measure: how many disagree with the rebuttal (batches 11 to 13: 1, 1, 2)? Does any rest on what the quoted line shows on its own, as OC-18's did in batch 13 ("without specifying their relative sizes in a way that would definitively support the claim")?
- **The scene-attribution:** does any clause still give the rebuttal's claim as what the scene says (OC-11, h7 in batch 13)?
- **The size cells:** OC-11 has been wrong in every batch. Does "a small round tea table" now show only that the table is small?
- **The guards, the mirror fault:** still right 4 of 4? A guard's clause that doubts what its line plainly shows is the fault.
- **h7:** the slide line. **h5 and h10:** the crux, and the second form.
- **The skepticism in the text:** any "neither side", "takes … at its word", or doubt of either side, and on which cells.
- **The verdict follows the sentence.**
- **Form:**
  - malformed replies;
  - the length, against batch 13's 324 to 662 chars;
  - cut-offs at 400;
  - prose after the block.

## Results (2026-11-16, batch 14)

The response is at `scratchpad/trial-verdict-6-results.json` (11 calls, 0 errors), with instructions `673fe7c2`, stage `verdict`, and inputs hashes as draft 5's pins.

**The tally:** 4 right, 6 wrong, 0 malformed, OC-9 ungraded. **`rebuttal` was the answer in 11 of 11.** OC-3 and OC-18, right in batch 13, are lost. Only the guards are right.

**The settling clause sides with the rebuttal in 11 of 11.** No reply doubts either side or takes up "neither side's word". On the cells where it isn't the rebuttal's own inference repeated (OC-11, OC-3, OC-20, h7, as before), the skepticism shows up only as **absence used against the argument**:
- OC-18: "which the scene says is a small round tea table and does not specify any size limitations";
- OC-9: "which the scene says is unspecified";
- OC-1: "which common sense says is not necessarily true because the scene describes it as a small round tea table".

**The crux sharpened on two hops but was still settled for the rebuttal:**
- h5: "whether tipping the table would cause the teapot to fall off". The crux is right for the first time, but it was settled by the dodge ("not necessary for the teapot to pour").
- h7: "whether [cup1] remains on the table after tipping the table". The crux is right, settled by the rebuttal's inference given as the scene's.

**Form:**
- 0 malformed;
- 384 to 698 chars;
- no cut-offs;
- the first form 11 of 11, the second never.

**Reading** (mine), at x1:
- **The skepticism in the step was read as "the scene doesn't establish it".** The argument's claims are common sense with no quote, while the rebuttal's always carry one. So "a quoted line shows only what that line says" weighs against the argument, never against the rebuttal.
- **The asymmetry:** the instruction is symmetric in words, but the inputs aren't symmetric in form. The rebuttal's "not established" audit (TR-P4) has become the judge's own move. It is the "desperate" reasoning the user named ("the fiction doesn't determine what relative size the table and cup are"), now on the judge's side.
- **Draft 6 falls through.** By the user's order, the next step is the discussion of labelling each side separately (TR-L15).
