# The rebuttal, draft 3: the question supplied (the separating test)

For [the non-rule cell plan](../../AGENT.nonRuleCell.planning.md#recommended-order)'s step 3, the trial's stage 2. The design is the plan's [Rebuttal draft 3: the question supplied](../../AGENT.nonRuleCell.planning.md#rebuttal-draft-3-the-question-supplied-the-separating-test), accepted by the user 2026-11-15 with two amendments: the hops' questions anchored on the step that fails, and golden and lifted sources. It follows [the diagnosis](../../AGENT.nonRuleCell.planning.md#the-rebuttals-failure-diagnosed-2026-11-15): the rebuttal gets the answer without the question (the user's mechanism).

## The change

- **The question supplied:** each cell's argument carries the question it answers.
  - **The single-step cells:** the argument's premise, as a yes-or-no question in its own words ("Is [table1] too large and heavy to be picked up by a single person?").
  - **The hops:** the state at the step that fails: "By the time of "[teapot1] pours [tea2] into [cup1]", is [cup1] still where [teapot1] can pour into it?"

  The render gives it a line before the argument: `The question the argument answers: …`.
- **[`rebuttal.3.txt`](rebuttal.3.txt):** draft 2 word for word, except that Role's list of what follows gains "with the question it answers".
- **Golden and lifted sources** (`stageInput.ts`): this batch runs `upstream: golden`. The golden arguments are the lifted ones adopted verbatim, as interim goldens. A `lifted` payload is refused, since `trialAgainst` gives no question yet.
- **TR-P5 fixed:** an evidence quote with the prompt's marker or role label passes.

**Unchanged:** the arguments (so the only difference from batch 4 is the question), the scene, the kinds, the chain, the cap of 400.

## How it is probed

One payload, all 11 cells, `repeats: 1`, `options: {"upstream": "golden"}`, 11 calls, Micro, instructions `a2b2cbad` (1815 chars). The response is saved to a file. The inputs hashes change on every cell, as intended. The render and the check changed, so it needs a deploy.

## Rubric (written before the batch)

h5 and h10 are read apart, as before.
- **The main measure: world claim or support claim,** each rebuttal sorted by hand.
  - **A world claim** is about the things: "[table1] is a small round tea table, light enough for one person".
  - **A support claim** is about the argument: "the scene does not specify".

  Baseline, batch 4: about 3 of 11 world claims (OC-11's "could fit", OC-2's workaround, OC-6). If the rebuttals become world claims, the question is the lever. If they stay support claims, the prompt-level causes are doing real work as well.
- **Weak arguments:** does the rebuttal answer the question from the scene? OC-1 and OC-20: "No: [table1] is a small round tea table". OC-2: "No: picking up is what empty hands do". OC-6: "No: a teapot pours".
- **Sound arguments:** does it answer "no" weakly, or concede in substance? The question in the argument's words may lead it to agree, a new failure to watch. h7: does it say where [cup1] is (on the floor, from the slide line)?
- **The claim field:** the question, a part of the argument, or the whole argument (TR-P6, 11 of 11 in batch 4)?
- **The kinds:** the spread, against batch 4's `invented` 8.
- **Quote checks** (with TR-P5's fix), **length** against batch 4's 757 to 1175 chars, **form**.

## Results (2026-11-15, batch 5)

11 calls, `repeats: 1`, `upstream: golden`, Micro, instructions `a2b2cbad` (1815 chars). **Form:** 11 of 11 pass. **Kinds:** `invented` 8, `wrong` 3 (OC-2, OC-6, h7), the same spread as batch 4. Lengths are 594 to 1209 chars.

**The question was never used: 0 of 11 replies mention it.** The prose is draft 2's four parts as headings, and none of them is about the question. The claim is the whole argument in 11 of 11.

| Cell | Evidence | Kind | Rebuttal | Level |
| --- | --- | --- | --- | --- |
| OC-11 | none | invented | "does not provide any details about the sizes … but logically, a small round tea table cannot fit inside a cup" | **World, and concedes** |
| OC-18 | none | invented | "no information … indicating the size or structural suitability" | Support |
| OC-3 | none | invented | "The size of the table relative to the cup is not established" | Support |
| OC-1 | none | invented | "does not provide any information about the size or weight of the table" | Support |
| OC-2 | "You are holding nothing." | wrong | "lift the cup indirectly by first picking up the saucer" | World (the workaround, as in batches 3 and 4) |
| OC-20 | none | invented | as OC-1 | Support |
| OC-6 | "In [teapot1] there is [tea2] Tea." | wrong | "The teapot already contains a container that can be used to pour" | World, garbled |
| OC-9 | none | invented | weight "not established" | Support |
| h7 | "tip [table1]" | wrong | "does not specify that tipping … would cause the saucer and cup to fall off immediately, only that they would slide off" | Support: a quibble over words, "fall" against "slide" |
| h5, h10 (apart) | none | invented | "does not provide …", "does not specify …" | Support |

**Against the rubric:**
- **The main measure:** 3 of 11 world claims (OC-11, OC-2, OC-6), the same as batch 4. One of them concedes.
- **Weak arguments:** none answers the question from the scene. OC-1 and OC-20 still miss "small round tea table".
- **Sound arguments:** OC-11 concedes in substance, which is the new risk, seen once. h7 reads the slide line and quibbles over its wording.
- **The claim field:** the whole argument, 11 of 11 (TR-P6).

**What it shows:**
- **The test didn't test the mechanism** (mine, a design fault). The question was supplied as an input, but no step of the Task uses it. Micro followed the Task's four parts to the letter, and an input the procedure doesn't name was ignored. The same thing happened with the securing sentence in every non-rule cell draft, and with draft 1's "from the scene and the steps". So this batch says nothing about whether the question helps. It says only that **an input with no task step is invisible.**
- **That is a finding about Micro in its own right:** it carries out the Task's procedure literally. What the Role or Reading sections mention, without a step that acts on it, doesn't enter the reasoning.
- **h7's quibble is the support audit at its finest grain:** it found the line and audited its wording ("slide", not "fall").
