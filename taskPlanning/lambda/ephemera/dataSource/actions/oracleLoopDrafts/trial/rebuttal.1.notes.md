# The rebuttal, draft 1: notes and reading rubric

For [the non-rule cell plan](../../AGENT.nonRuleCell.planning.md#recommended-order)'s step 3. This is stage 2 of [the trial proposal](../../AGENT.nonRuleCell.planning.md#the-trial-proposal-argue-against-rebut-judge): the `trialRebuttal` read piece. The order was agreed with the user 2026-11-14: the triad first, on cells the consequences gap doesn't touch, then consequences.

## Why

The case against now finds the real blocker wherever the scene has one (the size 3 of 3, h7's slide), and it gives weak or nonsense arguments where there is none ([against.1.notes.md](against.1.notes.md#results-2026-11-14-batch-2-the-securing-omitted)). The rebuttal has to dispose of the weak ones and not invent its way past the sound ones.

## The piece and the draft

- **Cells:** the non-rule cell's eleven, each with an argument lifted word for word from `trialAgainst` (batch 2, the securing omitted; OC-9 from batch 1, which has no securing). A one-off check matched each against the result files.
- **Render:** the non-rule cell's with the securing omitted (the scene the argument was made in). Then a section of its own: `The argument against the plan, turning on the step "<step>": <argument>`. The scene comes first as the first lever against anchoring.
- **Check:** the block parses, `kind` is one of `invented`, `not established` or `wrong`, and `rebuttal` is non-empty. No options. `maxTokens` 400.
- **[`rebuttal.1.txt`](rebuttal.1.txt):**
  - **Role:** new: "You answer an argument against a player's plan".
  - **The two Reading sections:** word for word from the non-rule cell's draft 3.
  - **Task:** new: "Rebut the argument concisely: say what is wrong with it, from the scene and the steps." The three kinds are defined by what the scene and the steps say: "invented" when it rests on something they don't say, "not established" when it assumes details they leave open, "wrong" when they say otherwise. There is no option to concede.
- **"From the scene and the steps"** points the rebuttal at the premise in the scene, not at the argument's own framing (anchoring, the proposal's risk 2).

## How it is probed

One payload, all 11 cells, `repeats: 1`, 11 calls, Micro, instructions `f44fab8a` (1436 chars). The response is saved to a file. A new piece, so it needs a deploy.

## Rubric (written before the batch)

Each cell's `lookFor` is in [`trialRebuttal.ts`](../../../../../../../lambda/ephemera/calibration/oraclePieces/trialRebuttal.ts). **h5 and h10 are read apart from the tallies** (consequences-dependent: TR-P3, NR-P5).
- **Sound arguments, the over-refuting test (OC-11, OC-18, OC-3, h7):** nothing true refutes them, so what does the rebuttal claim? Count it as an invented smallness or another invented fact; "not established" (sizes not given); a misreading (h7: the cup could still be reached); or a hedge that concedes in substance. These are what the judge must see through.
- **Weak arguments (OC-1, OC-2, OC-20, OC-6):** is the rebuttal right, and is it on the **premise**? OC-1 and OC-20: the scene says "a small round tea table". OC-2: empty hands are what lifting needs. OC-6: a teapot is what tea is poured from. Is the kind `wrong`? A rebuttal that argues the **weight** ("it isn't that heavy") or reaches for something else counts as anchoring.
- **OC-9 (open):** the kind. Does "not established" come with the player's strength or the trestle's weight? That is the skill-or-chance signal.
- **h10, apart:** does it catch that step 1 took the saucer and cup?
- **h5, apart:** with a loose teapot, does it over-refute?
- **The kinds overall:** the spread, and whether a kind fits its rebuttal.
- **Focus and length:** against the case against's 190 to 407 chars. Any concession in all but name?
- **Form:** check failures; cut-off replies.

## Results (2026-11-14, batch 3)

11 calls, `repeats: 1`, Micro, instructions `f44fab8a` (1436 chars). **Form:** 11 of 11 pass. Lengths are 314 to 488 chars. **Kinds:** `not established` 9, `invented` 1 (OC-3), `wrong` 1 (OC-6).

| Cell | Kind | Rebuttal | Read |
| --- | --- | --- | --- |
| OC-11 | not established | "The scene does not specify the size of the cup or table" | Over-refutes: common sense made unknown |
| OC-18 | not established | the sizes and structure "not provided" | Over-refutes |
| OC-3 | invented | "do not specify the sizes … the assumption … is unfounded" | Over-refutes, under another kind |
| OC-1 | not established | "The scene does not provide details about the table's size or weight" | The weight disputed, the premise missed: the scene says "a small round tea table" |
| OC-2 | not established | "pick up the saucer containing the cup, then remove the cup from it" | A workaround, not the refutation (empty hands are what lifting needs) |
| OC-20 | not established | as OC-1 | As OC-1 |
| OC-6 | wrong | "The teapot can directly pour its contents into the cup" | **Right, on the premise** |
| OC-9 | not established | the size and weight "not provided … only its description" | No strength or difficulty raised |
| h7 | not established | "not established that tipping the table would cause them to fall" | **Contradicts its input:** the consequence line states the slide |
| h5 (apart) | not established | the teapot falling "not established" | The same move |
| h10 (apart) | not established | items falling "not established" | Step 1's taking of the saucer not caught |

**Against the rubric:**
- **Over-refuting:** the sound arguments are refuted 4 of 4 (the size 3, h7), by declaring common sense or a stated line unknown.
- **Weak arguments:** right in outcome on OC-1, OC-20 and OC-6. On the premise only on OC-6. OC-1 and OC-20 dispute the weight as unknown and miss "small". OC-2 offers a workaround.
- **OC-9:** no skill-or-chance signal.
- **The kinds:** `not established` is the universal move. Its rebuttals of sound and weak arguments look alike.
- **Focus and length:** held, about 300 to 500 chars. No concession.

**What it shows:**
- **The rebuttal's bias is a universal refutation**, not concession: "the scene doesn't say" fits every argument. As the user predicted, Micro pursues it relentlessly. So the middle call doesn't tell the sound arguments from the weak ones, and a judge would be left judging the argument alone.
- **The cause is the draft's definition** (mine): "not established" is "assumes details they leave open". Common sense is never stated, so it is always open.
- **Reframed by the user (2026-11-15):** on the size cells and h7, a weak rebuttal is the right output. Where the argument is sound, the best rebuttal is weak, and that is the judge's signal. The fault is the uniformity: OC-1's and OC-20's rebuttals are no stronger than OC-11's, though the scene gives them a strong one. And the kinds aren't exclusive: whatever the scene contradicts, it also doesn't say.
