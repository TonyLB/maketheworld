# The verdict, draft 2: the exchange as the object

For [the non-rule cell plan](../../AGENT.nonRuleCell.planning.md#recommended-order)'s step 3, the trial's stage 3. The design is the plan's [Verdict draft 2: the exchange as the object](../../AGENT.nonRuleCell.planning.md#verdict-draft-2-the-exchange-as-the-object), accepted by the user 2026-11-16. The direction is the user's: strictly compare which of the argument and the rebuttal succeeded, rather than judge the scene freely. The scene's reading instructions stay unchanged until after this draft. The wording is mine.

## The change

One change, the exchange as the object of judgment, carried in three places that only work together:
- **Role, replaced:** the judge weighs an exchange, an argument that the plan can't happen as written and a rebuttal of it.
- **Reading the argument and the rebuttal, new** (after Reading the steps): the rebuttal quotes a line or appeals to common sense and says what follows. It succeeds when that follows from its source and answers the argument's claim. Otherwise the argument stands.
- **Task, replaced:** "which argued better" (the user's original framing). The description takes the rebuttal's reply in three parts: its source, whether its claim follows from that source, and whether it answers the argument's claim.

**Unchanged:**
- Reading the scene and Reading the steps (the user);
- the render, so the inputs hashes are batch 9's, pinned;
- the lifted pairs, the grade and the cap of 400.

**h10 re-expected as `argument`** (mine). The rebuttal argues that the tip is unnecessary, which answers something other than the argument's claim, and it never uses step 1. Rescored this way, batch 9 is 7 of 10.

## How it is probed

- One payload, all 11 cells, `repeats: 1`, `options: {"stage": "verdict", "upstream": "lifted"}`, so 11 calls on Micro.
- The instructions are `9b6b6397` (1961 chars).
- The response is saved to a file.
- **Deploy check:** the inputs hashes match batch 9's. A deploy is needed, since h10's expected answer is in the cells.

## Rubric (written before the batch)

The tally runs against batch 9 rescored, 7 of 10. h5 and h10 are read apart, and OC-9 is tallied, not graded.
- **The tally and the answers' spread,** against batch 9's `rebuttal` 8 of 11.
- **The size cells** (OC-11, OC-18, OC-3): does the description say the rebuttal's "small enough to fit" (or "the cup is large enough") doesn't follow from "a small round tea table"? Is the verdict `argument`?
- **The guards** (OC-1, OC-20, OC-6, OC-2): does the follows test pass the true rebuttals? The mirror fault is a strict "follows" turning down a true one, such as "small, so one person can lift it".
  - On OC-2: is the drift (the saucer first) read as answering the claim?
- **h7:** does "answers the argument's claim" catch the evasion? The rebuttal quotes [cup1]'s tea and claims it is still on [table1], without the slide line.
- **h5 and h10:** is the dodge ("tipping is unnecessary") read as answering something other than the claim?
- **OC-9:** does "doesn't specify any weight restrictions" follow?
- **The description's form:**
  - does it take up the rebuttal's reply as told, or still summarize all the inputs (TR-P15)?
  - does it name the verdict first and fit the tests to it (RC-P2's pattern)?
  - count the replies that give each of the three parts: the source, follows, answers.
- **Form:**
  - malformed replies;
  - the length, against batch 9's 350 to 565 chars;
  - cut-offs at 400;
  - prose after the block.

## Results (2026-11-16, batch 10)

The response is at `scratchpad/trial-verdict-2-results.json` (11 calls, 0 errors), with instructions `9b6b6397` and stage `verdict`. The inputs hashes match batch 9's.

**Deploy check:** the response grades h10 against `rebuttal`, the old expected answer. The deployed cells predate the re-expectation, though the prompt and renders are as built. h10 is rescored by hand below.

**The tally,** h10 rescored:
- 5 right and 5 wrong, against batch 9 rescored at 7 of 10;
- 0 malformed;
- OC-9 ungraded;
- the answers: `rebuttal` 10 of 11, `argument` only on OC-18.

| Cell | Expected | Answer | The description's tests |
| --- | --- | --- | --- |
| OC-1, OC-20, OC-6 | rebuttal | rebuttal | right: "follows from the description and answers the argument's claim" |
| OC-2 | rebuttal | rebuttal | right, taking the drift (the saucer first) as answering the claim |
| OC-18 | argument | argument | right: "doesn't logically follow", the one test answered no (as in batch 9, the cell whose rebuttal claims "the cup is large enough") |
| OC-11, OC-3 | argument | **rebuttal** | "small round … implies it can fit inside the cup. It follows from the scene description" |
| h7 | argument | **rebuttal** (batch 9: right) | the rebuttal's own inference is given as its quote: "quotes the scene stating '[cup1] remains intact and on [saucer1], which is still on [table1]'"; the slide line never appears |
| h5 | argument | **rebuttal** | "follows … that the teapot is in a stable position", and the dodge "directly addresses the argument's claim" |
| h10 | argument (rescored) | **rebuttal** | "correctly follows … that tipping the table is unnecessary"; "answers the argument's claim by showing that the plan can proceed without tipping" |
| OC-9 | open | rebuttal | "does not specify any weight restrictions … This follows" |

**The description:**
- **It takes up the rebuttal's reply, 11 of 11:** the source, then follows, then answers, in the Task's order. The restatement of every input is gone (TR-P15 fixed in form).
- **The verdict follows the description's tests, 11 of 11.** The one "doesn't follow" (OC-18) gave `argument`; every "follows" gave `rebuttal`. The decision now sits in a stated place, and the failure shows there.
- **"Follows" is affirmed in 10 of 11,** usually in the rebuttal's own words: "which implies" becomes "this follows". **"Answers the argument's claim" is affirmed in 11 of 11,** read as "is about the same subject": h5's and h10's dodges pass.
- **The scene is no longer read** past the rebuttal's quote. On h7 the description loses the slide line it found in batch 9, and quotes the rebuttal's inference as if it were the scene's line.

**Form:**
- 0 malformed;
- 232 to 449 chars, against batch 9's 350 to 565;
- no cut-offs;
- no prose after the block.

**Reading** (mine), at x1 and exploratory:
- **The judgment moved where it was aimed.** The judge now weighs the exchange, not the scene, and its verdict is the outcome of its stated tests.
- **The tests are filled by echo.** "Does what it says follow from what it quotes?" is answered from the rebuttal's own "which implies", the nearest text that asserts exactly that (the extractive-line pattern, L-29 and PR-10). On h7 the quote and the inference are merged into one quoted line.
- **The two tests never look away from the rebuttal.** Neither "follows" nor "answers" is measured against anything outside it: the quoted line on its own, the argument's claim in its own words, or the step that decides it. So the separation that draft 1 got from the scene, on h7, is lost.
