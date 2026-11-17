# The verdict, draft 3: the point of disagreement

For [the non-rule cell plan](../../AGENT.nonRuleCell.planning.md#recommended-order)'s step 3, the trial's stage 3. The design is the plan's [Verdict draft 3: the point of disagreement](../../AGENT.nonRuleCell.planning.md#verdict-draft-3-the-point-of-disagreement), accepted by the user 2026-11-16 ("let's give it a try"). The aim is the user's: synthesis, a view of the argument and the rebuttal in context with each other, where batch 10 attended narrowly to the rebuttal (TR-P17). The sentence form, its branches and the wording are mine.

## The change

**Task, its description step replaced.** In place of draft 2's three tests on the rebuttal's reply, the description is one sentence in one of two forms:
1. **They disagree on a point:** "On the question, the argument says '…'; the rebuttal says '…'; so they disagree about …, which the scene says / the steps say / common sense says is …".
2. **The rebuttal answers a different question:** "On the question, the argument says '…'; the rebuttal answers a different question: '…'".

The verdict is tied to the sentence:
- `argument` when what is actually so agrees with the argument, or when the rebuttal answers a different question;
- `rebuttal` when what is actually so agrees with the rebuttal.

**Why this shape:**
- **Relational, like the rule cell's description** ("how the two things move relative to each other", 46 of 48), not an assessment of one input.
- **A fixed sentence with a turn,** like rebuttal draft 5, in place of slots and headings that get filled literally (TR-P8, NR-P9).
- **Anchored on the question,** the one input outside both texts.
- The scene is read again, but only at the point in dispute.

**Unchanged:**
- the Role, Reading the scene, Reading the steps, and Reading the argument and the rebuttal;
- the render (batch 9's inputs hashes);
- the lifted pairs, the expected answers (h10 `argument`), the grade and the cap of 400.

## How it is probed

- One payload, all 11 cells, `repeats: 1`, `options: {"stage": "verdict", "upstream": "lifted"}`, so 11 calls on Micro.
- The instructions are `3aa3cc78` (2434 chars).
- The response is saved to a file.
- **Deploy check:** the response's h10 `expected` is `argument`. Batch 10's deploy missed that change; if it is still missing, h10 is rescored by hand.

## Rubric (written before the batch)

The tally runs against batch 10's 5 of 10 and batch 9 rescored at 7. h5 and h10 are read apart, and OC-9 is tallied, not graded.
- **The sentence, per cell:** which form? Is it one sentence, in the form?
- **The argument's half and the rebuttal's half:**
  - does each give that side's answer to the question?
  - is the rebuttal's half copied in its own framing ("small enough to fit")?
- **The disagreement:** is the point named one point, the real crux, and stated neutrally?
- **The settling clause:**
  - does it ever disagree with the rebuttal?
  - which source does it name, and is that source the rebuttal's own source repeated?
- **The size cells:** does common sense settle that a small round tea table doesn't fit inside a cup?
- **The guards:** does the settling clause agree with the rebuttal, from its line ("a small round tea table", one person can lift it)?
- **h7:** do the steps settle where [cup1] is at the pour, from the slide line?
- **h5 and h10:** does the second form catch the dodge ("tipping is unnecessary")?
- **OC-9:** what settles a long oak trestle's weight?
- **The verdict follows the sentence:** does each block's answer match the rule the sentence sets?
- **Form:**
  - malformed replies;
  - the length, against batch 10's 232 to 449 chars;
  - cut-offs at 400;
  - prose after the block.

## Results (2026-11-16, batch 11)

The response is at `scratchpad/trial-verdict-3-results.json` (11 calls, 0 errors), with instructions `3aa3cc78` and stage `verdict`. The inputs hashes match batch 9's. **Deploy check:** h10's `expected` is `argument`, so this deploy carried the change.

**The tally:**
- 5 right and 5 wrong, against batch 10's 5 and batch 9 rescored at 7;
- 0 malformed;
- OC-9 ungraded;
- the answers: `rebuttal` 10 of 11, `argument` only on OC-3.

| Cell | Expected | Answer | The disagreement, and what settles it |
| --- | --- | --- | --- |
| OC-1, OC-20, OC-6, OC-2 | rebuttal | rebuttal | right; the settling clause agrees with the rebuttal from its line |
| OC-3 | argument | argument | right: "which common sense says is not true because a small round tea table cannot realistically fit inside a cup". This is **the one settling clause, of 11, that disagrees with the rebuttal** |
| OC-11 | argument | **rebuttal** | "whether the table is too large to fit inside the cup, which the scene says is a small round tea table, which is small enough to fit inside the cup". The crux is right, and the rebuttal's inference is given as the scene's |
| OC-18 | argument | **rebuttal** (batches 9 and 10: right) | "whether the cup can fit the table, which common sense says is possible given the description" |
| h7 | argument | **rebuttal** | "whether the cup falls off the table", the right crux, "which the scene says is not the case as [cup1] remains on [saucer1]". This is the rebuttal's inference again, and the slide line is never read |
| h5, h10 | argument | **rebuttal** | "whether tipping the table is necessary": the crux is taken from the rebuttal's topic, which the argument never claimed. The second form isn't used |
| OC-9 | open | rebuttal | "which common sense says is not necessarily true" |

**The sentence:**
- **The first form in 11 of 11; the second form never used,** including on h5 and h10, where the judge reframes the disagreement onto the rebuttal's topic.
- **The argument's half is the argument's own text, 11 of 11.**
- **The rebuttal's half is the rebuttal's whole sentence copied in 7 of 11,** "But the scene says '…', which implies …" included, and paraphrased in 4.
- **The crux is named well when the argument frames it:** OC-11, OC-3, h7, OC-20, OC-1. On h5 and h10 the rebuttal frames it.
- **The settling clause continues the rebuttal's half in 10 of 11** (TR-P18):
  - it names the rebuttal's own source ("the scene says", 8) and restates its inference as what that source says;
  - only OC-3's settling clause brings a fact of its own;
  - common sense is named 3 times (OC-18, OC-3, OC-9), and settles against the rebuttal only on OC-3.
- **The verdict follows the sentence, 11 of 11.**

**Form:**
- 0 malformed;
- 383 to 687 chars, longer since the rebuttal is copied;
- no cut-offs;
- no prose after the block.

**Across batches 9 to 11** (one call per cell each; h10 at its current expected answer):

| Cells | Batch 9 | Batch 10 | Batch 11 |
| --- | --- | --- | --- |
| the guards | right | right | right |
| OC-11, h5 | wrong | wrong | wrong |
| OC-18 | right | right | wrong |
| OC-3 | wrong | wrong | right |
| h7 | right | wrong | wrong |
| h10 | right | wrong | wrong |

`rebuttal` was the answer in 8, 10 and 10 of 11.

**Reading** (mine), at x1:
- **The synthesis took in form,** and the crux is often the right one: OC-11's "too large to fit" and h7's "falls off the table" are the points the cells turn on.
- **But the settling clause is filled from the nearest text,** the rebuttal's half placed just before it, usually copied whole, ending in "which implies …" (TR-P18). This is the extractive-line pattern again (L-29, PR-10, TR-P17), now inside the synthesis.
- **The template's order puts the rebuttal nearest the clause that decides.**
- **The second form went unused,** and h5 and h10's crux was taken from the rebuttal's frame.
