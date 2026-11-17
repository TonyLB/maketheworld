# The verdict, draft 8: evaluation at the task site, with and without "skeptically"

For [the non-rule cell plan](../../AGENT.nonRuleCell.planning.md#recommended-order)'s step 3, the trial's stage 3. The design is the plan's [Verdict draft 8: evaluation at the task site, as a pair](../../AGENT.nonRuleCell.planning.md#verdict-draft-8-evaluation-at-the-task-site-as-a-pair), accepted by the user 2026-11-16 and built on draft 7.

**The question is the user's:** has anything shown that an attitude, applied directly at the task site, would be read past? Nothing has.
- Drafts 4, 5 and 7 put a stance in a reading section, beside a Task with no evaluating step for it to modify.
- Draft 6 put an explanatory sentence at the task site. It had an effect, in the wrong direction.

**The wording is the user's** ("Evaluate the validity of the claim by using the 'Read the scene' instructions to skeptically consider this claim in the context of the larger scene"). Fitted to the template, it becomes the sentence below. The pair is mine: it separates the stance from the operation.

## The change

One sentence is added to the Task, after the first form's template, attached to its last part. This is where draft 6's sentence sat.

- **8a:**
  > For the last part, what is actually so about that point, evaluate the validity of each side's claim by using the Reading the scene instructions above to skeptically consider that claim in the context of the larger scene.
- **8b:** the same, without "skeptically".

**Two departures from the user's wording, mine:**
- **"each side's claim",** not "the claim": a claim of one side only is how draft 6's skepticism fell unevenly (TR-P20).
- **"the Reading the scene instructions above",** naming the section by its label, at a literal place.

**What each payload tests:**
- **8b against batch 15 (draft 7):** an evaluating operation at the task site, which drafts 3 to 7 lacked, tied to Reading the scene and its ordinary-default rule.
- **8a against 8b:** the manner word "skeptically" at the task site, the one thing they differ in.

**Unchanged:** everything else in draft 7, including:
- the ordinary-default rule in Reading the scene;
- the tags;
- draft 4's sentences in the reading section;
- the template and the verdict rule;
- the render, the cells, the grade, and the cap of 400.

## How it is probed

- **Payloads:** two in one batch, 16a (8a, `7bd80012`, 3230 chars) and 16b (8b, `951f57f4`, 3218 chars).
- **Each payload:** all 11 cells, `repeats: 1`, `options: {"stage": "verdict", "upstream": "lifted"}`, so 11 calls on Micro.
- **Results:** saved to two files.
- **Deploy:** none needed.

## Rubric (written before the batch)

Batch 15 (draft 7) is the baseline: 5 of 10, `rebuttal` 10 of 11. h5 and h10 are read apart. OC-9 is tallied, not graded.

- **The tally, per payload, and 8a against 8b cell by cell.** At x1, a difference of one or two cells is within the wobble that OC-18 and OC-3 have shown.
- **The settling clause's source** (TR-P21): "the scene says" against "common sense says" against the steps, per payload. Does evaluation move it off the rebuttal's source?
- **Evaluation in the text:**
  - does the reply weigh either side's claim (valid, invalid, holds, doesn't)?
  - does it use Reading the scene, such as what such things ordinarily are, or a departure from the ordinary?
- **Skepticism in the text (8a):** any doubt of a side, and of which side. Does it fall on the side that quotes nothing, as in batch 14 (TR-P20)?
- **The size cells,** above all OC-11: `argument` expected.
- **The guards:** still right?
- **h7:** the slide line. **h5 and h10:** the crux.
- **The verdict follows the sentence.**
- **Form:**
  - malformed replies;
  - length;
  - cut-offs at 400;
  - prose after the block.

## Results (2026-11-16, batch 16)

The responses are at `scratchpad/trial-verdict-8a-results.json` (`7bd80012`) and `-8b-results.json` (`951f57f4`), 11 calls each, 0 errors. The inputs hashes are as draft 5's pins.

**The tally, both payloads: 4 right, 6 wrong, 0 malformed, OC-9 ungraded, `rebuttal` 11 of 11.**
- **8a and 8b give the same answer on every cell.**
- Only the guards are right. OC-3, right in batches 11 to 15, is lost.

**"Skeptically" at the task site:**
- **No effect seen.** The answers are identical, and no 8a reply doubts either side.
- **The words of evaluation** ("valid", "more consistent", "reasonable") appear in 1 reply of 8a and 3 of 8b.

**The settling clause's source: "the scene says" in 22 of 22.**
- That is up from 43 of 55 in batches 11 to 15. "Common sense says" is gone as the settling source; batches 11 to 15 had it 10 times, and it gave OC-3 every right answer.
- The new sentence names the scene ("using the Reading the scene instructions above … in the context of the larger scene"), and the clause takes the scene as its source. The only scene text on the point is still the rebuttal's quoted line.
- On OC-20 (both payloads), common sense is added after the scene: "and common sense says small round tea tables are typically manageable", rightly.

**Where evaluation appears, it judges consistency with the rebuttal's line:**
- OC-11, both payloads: "The scene explicitly describes the table as 'a small round tea table,' which implies that it is small enough to fit inside the cup. Therefore, the rebuttal's claim is valid / more consistent with the scene's description".
- OC-1 (8b): likewise.
- **OC-9 (8b) reverses the ordinary-default rule:** "Without specific details about its weight, it is reasonable to assume that it could be lifted by a single person, especially given the lack of any explicit indication to the contrary".
- h7 (8a): "which the scene says is not explicitly addressed but common sense and the graph imply the cup remains on the table". The slide line is still unread.

**Form:**
- 0 malformed;
- 347 to 764 chars;
- no cut-offs;
- the first form 22 of 22.
- Some replies add a paragraph of evaluation after the sentence: 2 in 8a, 3 in 8b.

**Reading** (mine), at x1:
- **The evaluating sentence ran,** but as a check of consistency with the scene, and the only scene text on the point is the rebuttal's line. "Validity" was read as "consistent with what the scene says". Pointing at Reading the scene drew the source to the scene, the rebuttal's source, and pushed common sense out (TR-P21).
- **"Skeptically" at the task site: no detectable influence** on this template. The caveat is that the step still ends in a slot asking for a source and what it says, so the stance had no operation of its own to shape.
- **The ordinary-default rule was used once, reversed** (OC-9, 8b): nothing says it can't be lifted, so it can be.
