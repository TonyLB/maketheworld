# The ruling, draft 1: the judge answers the question alone

For [the trial question plan](../../AGENT.trialQuestion.planning.md#recommended-order)'s step 1. The framing is the user's (2026-11-16): an adversarial question framing the specific judgment may let free judgment work. The probe, the stage and this rubric are mine. The design and the expected answers (QS-1) were reviewed by the user on 2026-11-17.

## The prompt

[`ruling.1.txt`](ruling.1.txt), 1019 chars:
- **Role:** answer one question about a player's plan, with step 0's stance as its frame, word for word;
- **Reading the steps:** verdict 8b's, word for word;
- **Task:** reading.1e's, with "and the steps" added: one or two sentences on what the scene and the steps establish about the question, then `{"answer": "yes" | "no"}`.

**The render** (`renderTrialRuling`):
- the scene, in the explicit render with the securing omitted;
- the player's request and the steps, as the non-rule cell renders them;
- `The question: …`, the golden question, last.

Nothing argued is shown: no argument, no rebuttal, no tags. The cap is 400.

**What differs from the verdict** (batches 9 to 21):
- the explicit render in place of the judge render and Reading the scene;
- no argued text;
- the answer is to the question, not which side argued better.

So this batch is a new stage, not one change on a draft. Step 0 measured the render apart (8 of 8, then 4 of 4 on the confirms).

## How it is probed

- **Payload:** `{"piece": "trial", "options": {"stage": "ruling", "upstream": "golden"}}`, 11 cells x1 on Micro, user delivery. This is batch 22.
- **Deploy:** needed first, since the stage is new code.
- **Results:** saved to a file and read with `jq`.
- **Then x3** on the cells the first batch got right, the size cells and the guards at least, only if the first batch separates them.

## Rubric (written before the batch)

**Baselines:**
- **The verdict:** 4 to 6 of 10 over eight drafts. The guards were right in every batch, and OC-11 and h5 were wrong in every batch.
- **What Micro got right with no persuasive text in view:**
  - the non-rule cell's size cells, 9 of 9 (batch 1);
  - the case against's size answers, 3 of 3.

**The bar at the checkpoint** (mine, provisional): the size cells and the guards right at x3. Those are OC-11, OC-18, OC-3, OC-1, OC-2, OC-20 and OC-6.

**Per cell:** the expected answer, then what a right description uses, then the miss to read for.

- **OC-11** (the cup on the floor): *Is [table1] too large to fit inside [cup1]?* **yes.** The description should compare the two sizes. The miss is TR-P16's: "small round tea table", so small enough.
- **OC-18** (hammered in): **yes.** The same size, and hammering changes nothing. The miss is reading hammering as making it fit.
- **OC-3** (the cup on the table): **yes.** The same size; the cup sitting on the table is beside the point. Batch 21 had "small objects can fit inside smaller containers".
- **OC-1:** *Is [table1] too large and heavy to be picked up by a single person?* **no.** An ordinary small round tea table is light enough. The miss is "the scene doesn't give its weight" read as yes.
- **OC-20** (the chain omitted): **no**, as OC-1.
- **OC-2:** *Does holding nothing keep the player from lifting [cup1] directly?* **no.** Empty hands are what picking up needs. The question's wording leans toward yes ("holding nothing … keep from"), so read whether the description takes the premise apart or adopts it.
- **OC-6:** *Must [tea2] be transferred to another container before it can be poured into [cup1]?* **no.** A teapot is what tea is poured from.
- **h5** (tip, then pour, the glue omitted): *Is [teapot1] still where it can pour into [cup1]?* **no**, in the scene shown, where [teapot1] is loose.
  - **Read apart from the tallies.** The expected answer holds only with the glue omitted.
  - Read what the description says the tip does to the teapot: tipped off, or merely tilted.
  - A yes that pictures the tip as a gentle tilt is a reading of "tip", not a failure to read the scene.
- **h7** (the slide line): *Is [cup1] still where [teapot1] can pour into it?* **no.** The consequence line puts [saucer1] and [cup1] on the floor. The miss is TR-P14's: the cup still on the table, the line unread. Read whether the description uses the slide line.
- **h10** (the saucer picked up first): the same question, **yes.**
  - Step 1 has taken [saucer1], with [cup1] on it, off the table, so the tip doesn't move the cup. Read whether the description uses step 1 ("the state left by the steps before it").
  - The miss is "tipping the table makes the cup fall".
  - **Read apart from the tallies:** the loose teapot, which the tip may move, is outside the question.
- **OC-9** (the oak trestle): open and ungraded. Read whether the kind of table ("a long oak trestle") is used for its weight.

**Beyond the tally, in every reply:**
- **The polarity:** the questions mix yes and no (4 yes, 6 no among the graded). A tally that leans one way, such as yes on the guards or no on the size cells, is a bias, not a judgment.
- **Whether the description supports the answer** (carried from step 0, where none of R-9's four did). Count descriptions that state the deciding fact, those that are silent on it, and those that contradict their answer.
- **The settling source:** the scene's lines (the per-object default, "as an ordinary … is", or a carry line), the steps (a consequence line, or a step's state), or common sense. Is the default quoted to settle a point it shouldn't decide (OC-11's "small")?
- **Open read as no:** the stance's "what it leaves out is open" taken as "unknown", above all on OC-1 and OC-20.
- **The carry lines read as events:** "when [table1] moves" read as if it had moved (h5, h7, h10).
- **Form:** malformed replies, length, cut-offs at 400, and text after the block.

## The decision it serves

Whether to go on to step 2, at the checkpoint with the user:
- **If the bar is met:** the question carries the judgment. Step 2 then tests whether the case against can write one.
- **If not:** the framing doesn't rescue free judgment on Micro. The finding goes up, and verdict drafting resumes in the parent.

## Results

### Batch 22 (2026-11-17), 11 cells x1

The response is at `scratchpad/trial-ruling-1-results.json`: instructions `5c0b828b` (1018 chars), user delivery, 11 calls, 0 errors, 0 malformed.

**The tally: 9 right, 1 wrong, OC-9 ungraded.** Every size cell and every guard is right, the split no verdict batch reached (best 6 of 10, with OC-11 and h5 wrong in every batch).

| Cell | Expected | Answer | What the description settles on |
| --- | --- | --- | --- |
| OC-11 | yes | yes | common sense, comparing: "a small round tea table is generally larger than a cup" |
| OC-18 | yes | yes | the comparison: "significantly larger and structurally different", with the default line's "an ordinary cup" |
| OC-3 | yes | yes | common sense, comparing: "a small round tea table is larger than an ordinary cup" |
| OC-1 | no | no | absence: the steps "do not specify any difficulty"; nothing about what such a table weighs |
| OC-2 | no | no | the plan as straightforward; the premise isn't taken apart, and isn't adopted either |
| OC-20 | no | no | common sense: "typically implies it is lightweight and easily manageable for a single person" |
| OC-6 | no | no | the teapot holds the tea; it never says a teapot is what tea is poured from |
| h5 | no | no | the tip "would likely cause the teapot to move out of position relative to the cup" |
| h7 | no | no | the slide line, used: "the saucer and cup … slide off onto the floor" |
| h10 | yes | **no** | "tips the table, which could potentially move the cup away"; step 1 unused |
| OC-9 | open | no | "a substantial piece of furniture", then "the player believes it is possible to do so" |

**Against the rubric:**
- **The size cells compare two sizes,** which no verdict reply did (batch 21: "small" read as absolute). The settling source is common sense ("generally", "reasonable to infer"), not a quoted scene line. TR-P16's "small, so small enough" doesn't appear.
- **The slide line is read** (h7), where the verdict read past it in every batch (TR-P14).
- **h10, the one miss, is the rubric's named one:** the tip is taken to move the cup, and step 1 (the saucer picked up first) goes unused. "Each step happens in the state left by the steps before it" was read past here.
- **The polarity:** 3 yes and 8 no. The 3 yes are the 3 size cells, all right; the guards' no's are all right. Nothing shows a lean, at x1.
- **Whether descriptions support their answers:** 6 of 10 graded state the deciding fact (OC-11, OC-18, OC-3, OC-20, h5, h7). OC-1, OC-2 and OC-6 are right with a description that doesn't state it. Step 0's caveat holds, more weakly.
- **The plan as evidence (mine, new):**
  - OC-1 settles from the steps not naming any difficulty;
  - OC-9 sees "a substantial piece of furniture", then answers from "the player believes it is possible to do so".
  - The player's request is read as evidence that the plan can happen. On the guards that lands right; on OC-9 it overrides the reply's own reading of the trestle. Both are x1.
- **Open read as no:** not seen. No reply answers from "the scene doesn't say" toward the blocking answer.
- **The carry lines read as events:** not seen.
- **Form:** 0 malformed; 228 to 416 chars; no cut-offs; nothing after the block.

**Next, by the design:** the confirm, x3, split at the cap of 24 calls. OC-9 stays out.
- **23a:** the seven cells the bar reads, 21 calls.
- **23b, optional:** h5, h7 and h10, 9 calls (mine), to see whether h5 and h7 hold and whether h10's miss is stable.

### Batch 23a (2026-11-17), the confirm: the seven cells the bar reads, x3

The response is at `scratchpad/trial-ruling-1-confirm-a-results.json`: instructions `5c0b828b`, user delivery, 21 calls, 0 errors. Every inputs hash equals batch 22's.

**The tally: 21 of 21, 0 malformed.** With batch 22, that's 28 of 28 over the size cells and the guards. **The checkpoint's bar is met.**

**Whether the descriptions support their answers:**
- **The size cells, 9 of 9:** every reply compares the two sizes, settled from common sense ("Given the typical sizes of such objects …"). The per-object default's "an ordinary cup" is quoted for the cup in 9 of 9, the use it was written for. OC-11's three replies are identical.
- **The guards, 4 of 12** state the deciding fact:
  - OC-1 r1 and r2 ("an ordinary small round tea table", the default line);
  - OC-20 r3;
  - OC-6 r3 ("The teapot is designed to pour its contents directly into another container").
- **The other 8 settle from absence,** "nothing says it can't", toward the answer that lets the plan go ahead:
  - OC-1 r3 and OC-6 r1 and r2: "no information … that would suggest";
  - OC-2, all three: the steps are "straightforward";
  - OC-20 r1 and r2 contradict their answer: "there is no information provided about the size or weight of the table … we cannot determine", then `no`. The render gives "a small round tea table"; these two don't use it.

**Reading** (mine):
- **The size result holds:** a blocking answer reached from a comparison, every time.
- **The guards are right by tally,** but two thirds of them rest on absence. Each guard's expected answer is the one that lets the plan go ahead, so "nothing in the scene stops it" lands right whatever the judgment. This is batch 22's "the plan as evidence" in its general form: where the scene doesn't block, the judge lets the plan through.
- **Step 0's R-3 is the counter-evidence:** "Could one person pick up [table1]?", with yes as the plan-allowing answer, was 4 of 4 in the explicit arm, settled from the default. A guard whose plan-allowing answer is yes would separate judgment from the absence default. That is QS-2's ground: which answer of a question blocks.
- **What this means for step 2:** the absence default errs toward letting a plan through. On the size cells it didn't fire, because common sense blocked. A case-against question that common sense doesn't settle would get the plan-allowing answer from absence alone.
