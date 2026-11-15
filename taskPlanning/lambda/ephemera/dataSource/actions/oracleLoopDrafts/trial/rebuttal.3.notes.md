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

## Results

Not yet run.
