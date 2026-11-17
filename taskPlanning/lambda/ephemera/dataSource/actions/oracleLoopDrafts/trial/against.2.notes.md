# The case against, draft 2: the question and the answer that blocks

For [the trial question plan](../../AGENT.trialQuestion.planning.md#recommended-order)'s step 2. The job, giving the question, is the user's. The answer that blocks is QS-2, the user's (2026-11-17): it is given, so a rebuttal can later attack the inference itself. The explicit render with the securing omitted is the user's too. The draft and this rubric are mine. The design was reviewed by the user on 2026-11-17.

## The prompt

[`against.2.txt`](against.2.txt), 1389 chars (instructions `dffffeb2`, the payload's text with its final newline):
- **Role:** draft 1's, with step 0's stance after its first sentence, word for word;
- **Reading the scene:** dropped, as in every explicit-render draft;
- **Reading the steps:** draft 1's, word for word ("judged separately" for fastening);
- **Task (new):**
  - find the one yes-or-no question whose answer does the most to show the plan can't happen as written, and the answer that would make it impossible;
  - name the step, and say why that answer makes that step impossible;
  - the block `{"question", "blocking", "step", "argument"}`, in that order.

**The render:** the non-rule cell's, with the explicit scene and the securing omitted. That is the ruling's scene, followed by the request and the steps, with no question line.

**What differs from draft 1** (batch 2, the securing omitted): the render, the stance, the dropped section and the new contract. Like the ruling, this is a new contract, not one change on a draft. Batch 2 is its baseline only for what each argument picks.

## How it is probed

- **Batch 26:** `{"piece": "trial", "options": {"stage": "against", "securing": "omitted", "scene": "explicit"}}`, 11 cells x1 on Micro, user delivery.
- **Deploy first,** since the contract and the option are new.
- **Batch 27,** after this one is read: the replies are lifted into the trial's records. The rule is the trial's: repeat 1, or the first reply that passes the parse, with no choosing by quality. Then the ruling runs on them, `upstream: 'lifted'`, 11 cells x1, graded by outcome.

## Rubric (written before the batch)

**Per cell:** the question I expect to be the deciding one, then the miss to read for. "Allows" and "blocks" are the expected outcomes batch 27 grades.

- **OC-11, OC-3** (the cup on the floor, the cup on the table; blocks): the size, e.g. "Can [table1] fit inside [cup1]?", with `no` blocking. On OC-3, a miss is the cup being on the table.
- **OC-18** (hammered in; blocks): the size. A miss is a question about hammering, such as whether the cup breaks.
- **OC-1, OC-20** (allows; the chain is omitted on OC-20): no true blocker. I expect the weight: "Is [table1] too heavy for one person?" Read whether common sense settles it from the default line ("an ordinary small round tea table"). A question that nothing settles, such as the player's strength, is 23a's warning: the judge would allow it from absence alone.
- **OC-2** (allows): no true blocker. Which question is picked, and is its premise in the scene?
- **OC-6** (allows): no true blocker. Which question is picked, e.g. whether a teapot pours?
- **h5** (tip, then pour; blocks in the scene shown): what the tip does to the loose [teapot1], or to [saucer1] and [cup1]. The question should turn on the pour's state.
  - **Read apart from the tallies:** the expected outcome holds only with the glue omitted.
- **h7** (the slide line; blocks): whether [cup1] is still where it can be poured into, after the slide line puts it on the floor. The miss is a question the slide line answers in the plan's favour, or one that never names it.
- **h10** (the saucer picked up first; allows): no true blocker for the cup.
  - **Read apart:** with the glue omitted, the tip may move the loose [teapot1]. A question about the teapot is then sound in the scene shown, so batch 27's "allows" is wrong for it. Read which thing the question is about.
- **OC-9** (the trestle): open and ungraded. Is the question the trestle's weight for one person?

**Beyond the cells, in every reply:**
- **Deciding or salient:** is the question the one the plan turns on, or the most noticeable thing in the scene?
- **Whether `blocking` follows:** is the stated answer the one that makes the step impossible? A reversed polarity (`yes` where "can it fit?" needs `no`) is the failure that QS-2's field exists to expose.
- **The polarity mix:** count the questions whose blocking answer is yes against those where it is no. Does the case against always phrase a question one way?
- **Settled by common sense or by absence:** would the scene plus ordinary knowledge settle the question, or would only "the scene doesn't say" answer it?
- **Grounding:** are the question's things in the scene, or invented (draft 1 invented a glued floor and the player's strength)?
- **The step named:** is it the one the question turns on, especially on the hops (the tip or the pour)?
- **Form:** form-check failures, lengths, cut-offs at 400, prose beyond a sentence or two, more than one question.

**The bar** (mine, provisional, for batch 27): the lifted questions' outcomes within one of the golden ones (batch 22, 9 of 10), at x1. A confirm at x3 follows only if it's met.

## The decision it serves

Whether the case against can carry the judgment's question, at step 2's checkpoint with the user:
- **If batch 27 holds the bar:** the trial's first and last stages compose. Step 3, the rebuttal as the relevance attack, is designed next.
- **If not:** what batch 26 shows of the questions says where it breaks: the question picked, its polarity, or what settles it.

## Results

### Batch 26 (2026-11-17), 11 cells x1

The response is at `scratchpad/trial-against-2-results.json`: instructions `dffffeb2` (1390 chars), user delivery, 11 calls, 0 errors. **Form: 11 of 11 pass.** The inputs hashes are new (the explicit render); they are now pinned in `renderPins.test.ts`, and the pin matches the deployed batch.

| Cell | Question | Blocking | Step | Read |
| --- | --- | --- | --- | --- |
| OC-11 | Is [table1] small enough to fit inside [cup1]? | no | put … in | the size; deciding |
| OC-18 | Can [table1] physically fit into [cup1]? | no | hammer … into | the size; deciding, hammering not in it |
| OC-3 | Is [table1] small enough to fit inside [cup1]? | no | put … in | the size; deciding, the cup on the table not in it |
| OC-1 | Is [table1] Table stable and balanced on the floor? | no | pick up | a precondition the scene doesn't raise |
| OC-2 | Is [cup1] on a stable surface that allows it to be picked up without any obstruction? | no | pick up | the same kind |
| OC-20 | Is the table [table1] lightweight enough to be easily lifted by a single person? | no | pick up | the weight, as expected |
| OC-6 | Is [teapot1] currently in a stable position on [table1]? | no | pour | the same kind as OC-1 |
| h5 | Is [teapot1] securely positioned on [table1]? | no | `"tip [table1]"` (its own quotes) | the securing, which is omitted |
| h7 | Is [teapot1] securely positioned on [table1]? | no | tip | the same; the slide line unused |
| h10 | Is [teapot1] securely positioned on [table1]? | no | tip | the same; about the teapot (read apart) |
| OC-9 | Can the table be lifted without any objects on it? | no | pick up | grounded: [saucer1] and [candle1] are on it |

**Against the rubric:**
- **The size cells, 3 of 3:** the deciding question each time, with `blocking` following.
- **Whether `blocking` follows:** in all 11. **The polarity mix is 11 of 11 no.** Every question asks whether a precondition the plan needs holds ("Is X small enough", "Is X stable"). So the case against never phrases a question so that yes blocks.
- **The guards:** OC-20 picks the weight. OC-1, OC-2 and OC-6 each ask whether something is stable, a precondition the scene never raises. These are weak arguments but honest questions, and the ordinary default answers each one yes (the plan-allowing answer). So they are settled by common sense, not by absence alone.
- **The hops, 0 of 3 deciding:**
  - all three ask the same question, whether [teapot1] is securely positioned: the securing, which this render omits;
  - h7's slide line goes unused;
  - **mine, a candidate mechanism:** Reading the steps still says "Whether a step pulls apart things that are glued, chained or otherwise fastened together is judged separately". That is the only fastening text in the prompt, and it may be what raises the question.
  - **What batch 27 turns on there:** whether the judge reads "securely positioned" as fastened (no, so blocks) or as sitting steadily (yes, so allows). Blocks is right for h5 and h7; h10 is read apart.
- **Grounding:** no inventions. OC-9's objects are in the scene.
- **The step:** right on every cell. h5 quotes it with its own quotation marks, which the match accepts. It is recorded as given.
- **Form beyond the check:** 194 to 301 chars. **No reply has the sentence or two of prose** the Task asks for: every one is the block alone. Draft 1's replies had it.

**Lifted** into `trialCases.ts` (repeat 1 on every cell, every reply parsing). Each golden note now records the batch it was adopted from. Batch 27 runs the ruling on these questions.

### Batch 27 (2026-11-17), the ruling on the lifted questions, 11 cells x1

The response is at `scratchpad/trial-ruling-1-lifted-results.json`: the ruling's `ruling.1.txt` (instructions `5c0b828b`, as batches 22 and 23a), `upstream: 'lifted'`, user delivery, 11 calls, 0 errors, 0 malformed.

**The tally: 7 right, 3 wrong, OC-9 ungraded.** The golden questions scored 9 of 10 (batch 22). **The bar (within one) is not met.**

| Cell | Expected | Answer | Outcome | What settles it |
| --- | --- | --- | --- | --- |
| OC-11 | blocks | yes | **allows** | "small" read as smaller than a cup, TR-P16's miss |
| OC-18 | blocks | no | blocks | the comparison |
| OC-3 | blocks | no | blocks | the comparison ("the typical sizes") |
| OC-1 | allows | yes | allows | the default line: "a typical small round tea table … stable" |
| OC-2 | allows | yes | allows | absence: "no mentioned obstructions or instability" |
| OC-20 | allows | yes | allows | common sense: "reasonable to infer … lightweight" |
| OC-6 | allows | yes | allows | absence: "does not provide any information about its stability" |
| h5 | blocks | yes | **allows** | absence: "no indications that it is not securely positioned" |
| h7 | blocks | no | blocks | absence the other way: "we cannot determine"; the slide line read, set aside as not about the teapot |
| h10 | allows | no | **blocks** | absence: "the steps do not explicitly state" (read apart: the question is the teapot's) |
| OC-9 | open | yes | allows | absence: "does not specify the weight" |

**Reading** (mine):
- **Where the question was the deciding one, the ruling mostly held.** The size cells were 2 of 3, and OC-20 was right.
- **OC-11's miss is the question's own wording.** "Is [table1] small enough to fit inside [cup1]?" carries the scene's "small" into the question. The golden "too large to fit" was right 4 of 4 on the same scene. OC-3 got the same wording right, so this is x1, but it is the miss TR-P16 named. **The question's words can bring the misreading back.**
- **Where the question wasn't the deciding one, absence answered it, in both directions.**
  - h5 and h7 ask the same question on nearly the same scene. The replies reason alike ("no indication that it is not securely positioned") and answer opposite ways. h7's right outcome isn't a judgment, and neither is h5's wrong one.
  - The stability guards land right because "nothing says it isn't" toward yes is the plan-allowing answer: 23a's warning, now seen through lifted questions.
- **So the weak link is the case against's choice of question on the hops,** not the ruling. In 3 of 3 hops it asked after the omitted securing, a question the scene can't settle.

