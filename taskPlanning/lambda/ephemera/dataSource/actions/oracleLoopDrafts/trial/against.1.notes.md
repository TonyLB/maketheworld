# The case against, draft 1: notes and reading rubric

For [the non-rule cell plan](../../AGENT.nonRuleCell.planning.md#recommended-order)'s step 3, the first stage of [the trial proposal](../../AGENT.nonRuleCell.planning.md#the-trial-proposal-argue-against-rebut-judge), accepted by the user 2026-11-14. The `trialAgainst` read piece.

## Why

The hypothesis is the user's: handing Micro a bias lets it produce more focused results in fewer tokens. Every unguided draft has carried the bias anyway, at 1500 or more tokens. This piece states the bias as the job: the single best argument that the plan can't happen. The rebuttal and the judgment come later, in their own calls, designed after reading this batch.

## The draft

- **Role (new):** "You make the case against a player's plan …: the strongest reason it can't happen as written."
- **Reading the scene, Reading the steps:** word for word from the non-rule cell's [`3.txt`](../nonRuleCell/3.txt), the securing sentence included.
- **Task (new):** "the single best argument …: the one reason, from the scene and the steps, that does the most to show it can't. Name the step it turns on. Be brief." Then `{"step": …, "argument": …}`.
- **"From the scene and the steps"** (mine) is a positive grounding, aimed at the inventions of earlier batches (the table glued to the floor, the player's strength).
- **The cap:** `maxTokens` 400.

## How it is probed

One payload, all 11 cells, `repeats: 1`, 11 calls, Micro, instructions `d08a3fa7` (1310 chars). The response is saved to a file. **Deploy check:** the inputs hashes match the earlier batches (h7 `af8996af`). A new piece, so it needs a deploy.

## Rubric (written before the batch)

- **The hypothesis, focus and length:** reply lengths and tokens against the non-rule cell's batch 5 (1860 to 4178 chars) and `stepConsiderations` batch 2 (1236 to 2337). Does the reply stay brief, with one argument rather than a list? Any reply cut off at 400 tokens?
- **Per cell, against its `lookFor`** (in [`trialAgainst.ts`](../../../../../../../lambda/ephemera/calibration/oraclePieces/trialAgainst.ts)):
  - **the size cells (OC-11, OC-18, OC-3):** is the argument the size? This is the case where the bias is right, so it must find it;
  - **h7:** the slide line, the cup on the floor and no longer under the spout, turning on the pour;
  - **h5:** the tip's unstated effect on the loose saucer and cup, or something else;
  - **the guards (OC-1, OC-2, OC-20, OC-6) and h10:** no true blocker. Which argument does it pick: the glue or chain (expected), something invented (the floor glue, strength), or a misreading? These are what the rebuttal will have to answer;
  - **OC-9:** the trestle's weight.
- **Grounding:** does each argument rest on the scene's facts, or on invented ones? Count the inventions.
- **The step named:** is it the step the argument actually turns on, especially on the hops (h5 and h7: the tip or the pour)?
- **Form:** check failures; prose beyond "a sentence or two"; several arguments where one was asked.

## Results (2026-11-14, batch 1)

11 calls, `repeats: 1`, Micro, instructions `d08a3fa7` (1310 chars). **The deploy check passed** (every inputs hash as before). **Form:** 11 of 11 pass.

**Lengths: 260 to 353 chars per reply,** one sentence of prose and the block. That is about a fifth of `stepConsiderations` batch 2 (1236 to 2337) and a tenth of the non-rule cell's batch 5 (1860 to 4178). One argument in every reply. None cut off.

| Cell | Step named | Argument | Read |
| --- | --- | --- | --- |
| OC-11 | the step | the teapot glued to the table "preventing the table from being moved" | **The size missed** |
| OC-18 | the step | the glue: "moving the table would disturb the glued teapot" | **The size missed** |
| OC-3 | the step | the glue "preventing the table from being moved" | **The size missed** |
| OC-1 | the step | the glue, "preventing the table from being lifted" | The glue, as expected |
| OC-2 | the step | the glue "prevents any movement of the saucer" | The glue, spread to the saucer |
| OC-20 | the step | the chain to the wall | The chain, as expected |
| OC-6 | the step | the glue, "preventing it from being lifted to pour" | The glue, as expected |
| OC-9 | the step | "too large and heavy to be picked up by a single person" | **The weight, as expected** |
| h5 | the tip | "Tipping the table would detach the glued teapot" | The glue, with invented physics. The loose saucer and cup unmentioned |
| h7 | the tip | the glue "making it impossible to pour" | **The slide line ignored**, and the step named is the tip, though the argument is about the pour |
| h10 | the tip | "Tipping the table would break the teapot's attachment" | The glue |

**Against the rubric:**
- **The hypothesis holds for focus and length:** one brief argument per reply, at about a tenth of the non-rule cell's tokens, every time.
- **But the securing is the argument wherever the scene has it: 10 of 11** (the glue in 9, the chain in 1). OC-9, the only fixture without one, gets the weight. The size cells, where the bias is right, lose the size to the glue in 3 of 3. "Whether a step pulls apart things that are glued … is judged separately" didn't move it.
- **Grounding:** every argument rests on a scene fact, so there's no invention of facts: no floor glue, no player strength. The inventions are of physics: the glue stopping movement, and tipping detaching or breaking it.
- **The step named:** right on the single-step cells. On the hops it is always the tip, even where the argument is about the pour (h7).
- **h7's consequence line,** read rightly by `stepConsiderations` in both its batches, is passed over for the glue.

**What it shows:**
- **A stated bias gives focus,** as the user predicted: the replies are short, single and on the job.
- **"The best argument" is the most salient fact against, not the strongest.** The glue sentence wins over the size, which takes a step of common sense, and over a consequence line, which is the plan's own. For the trial this is decisive. On the size cells the rebuttal would answer the glue, rightly ("a glued teapot moves with the table"), and the judge would then allow a table into a cup. The prosecutor has to find the size for the triad to work.
- **This is the securing problem again, now in its plainest form** (the plan's "Held: the securing"). Across every piece and draft, the securing is what Micro reaches for first.

## Batch 2: the same draft, with the securing omitted (rubric written before the batch)

**Why** (the user, 2026-11-14): leaving the securing out of what this piece sees is the plan's held option (b). It is more defensible now than before, because the rule cell, a special-purpose piece, judges the scene *with* the securing, and is instructed to focus on it. The case against can then be tested on the scene without it. This is a diagnostic: with the glue gone, does the best argument find the size, the slide and the loose cup?

**The change:** the render only, through the piece's new option `securing: 'omitted'` (`withoutSecuring` drops each tie and bare `SecuredTo`; the other relations stay). The instructions are unchanged, `d08a3fa7`. The inputs hashes change on the ten cells with a securing, and that change is the intended difference. OC-9 has no securing, so it renders the same either way and is not called.

**How it is probed:** one payload, the ten cells with a securing, `repeats: 1`, 10 calls. The response is saved to a file. This is a code change, so it needs a deploy.

**Rubric:**
- **The size cells (OC-11, OC-18, OC-3):** is the argument the size? This is the main measure.
- **h7:** the slide line, the cup on the floor, no longer under the spout. Is the step named the pour?
- **h5:** the tip's unstated effect on the loose saucer and cup, or something else.
- **The guards (OC-1, OC-2, OC-20, OC-6) and h10:** with no securing, what does the best argument become? Count it as one of three things: an invented fact (the old floor glue, the player's strength); invented physics; or a weak but real point, such as the table's size to lift, or the missing tilt for OC-6. These are what the rebuttal will answer.
- **Focus and length:** do batch 1's brevity and single argument hold?
- **The securing's shadow:** does any reply still mention gluing, chaining or fastening, though none is in the scene?

## Results (2026-11-14, batch 2, the securing omitted)

10 calls, `repeats: 1`, Micro, instructions `d08a3fa7`, options `{"securing": "omitted"}`. The inputs hashes are new on all ten, as intended (h7 `75731acb`). **Form:** 10 of 10 pass. Lengths are 190 to 407 chars.

| Cell | Step named | Argument | Read |
| --- | --- | --- | --- |
| OC-11 | the step | "The table is too large to fit inside the cup." | **The size** |
| OC-18 | the step | "too large and structurally unsuited to fit into the cup" | **The size** |
| OC-3 | the step | "The table is too large to fit inside the cup." | **The size** |
| OC-1 | the step | "too large and heavy to be picked up by a single person" | Weak, and against the scene: it is "a small round tea table" |
| OC-2 | the step | "the player is not holding anything to lift the cup directly" | Nonsense: empty hands are what lifting needs |
| OC-20 | the step | "too large and heavy …" | As OC-1 |
| OC-6 | the step | the tea "cannot be directly poured … without first being transferred to a container" | Nonsense |
| h5 | the tip | "Tipping the table would cause the teapot to fall off and spill" | **Right for the scene it was shown**: with no glue, the teapot is loose. Wrong for the real scene, where it tilts with the table. The loose saucer and cup unmentioned |
| h7 | the tip | "the first step would cause the cup to fall off the table, making it impossible to pour tea into it" | **The slide line, rightly.** It names the tip, the cause, where the corpus's answer is the pour blocked by the tip (TR-P2) |
| h10 | the tip | "the saucer, cup, and tea to fall off" | The saucer picked up in step 1 isn't carried forward (NR-P5). Shown no glue, so no teapot either |

**Against the rubric:**
- **The size cells: 3 of 3 the size** (batch 1: 0 of 3).
- **h7: the slide, rightly.** The step named is its cause.
- **h5 and h10:** the omission costs the pours. The glue is also what makes the teapot tilt with the table, and the pours depend on that. Without it, h5's argument is sound in the scene it was shown.
- **The guards and h10:** two weak arguments that contradict the scene (OC-1, OC-20: a small table "too heavy"), and two nonsense (OC-2, OC-6). None is a real blocker. Each should be easy for a rebuttal to refute as "wrong".
- **Focus and length:** held, one argument each, about 200 to 400 chars.
- **The securing's shadow:** none. No reply mentions gluing, chaining or fastening.

**What it shows:**
- **The diagnostic answers yes.** With the securing gone, the case against finds the real blocker wherever there is one: the size 3 of 3, and the slide on h7. Where there is none, it produces visibly weak arguments, which is what the triad wants the rebuttal to face.
- **The omission has one cost, and it is known:** the pours need the teapot to move with the table (TR-P3). That is the job of the plan's intended consequences (NR-L10: "[teapot1] tilts with [table1]" as an intended line under the tip), or of option (a), the rules' consequence in the scene. It is a hop-cell question for composition, not a reason to put the glue back.

