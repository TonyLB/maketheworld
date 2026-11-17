# The case against, draft 3: the question asked about the state at its step

For [the trial question plan](../../AGENT.trialQuestion.planning.md#recommended-order)'s step 2, after batches 26 and 27 ([draft 2's notes](against.2.notes.md)). The change is mine, and the user called it sensible (2026-11-17).

## The change

[`against.3.txt`](against.3.txt) (1466 chars, plus a final newline) is draft 2 with one sentence added to the Task, after the blocking answer: "Ask about the state at the step it turns on, as left by the steps before it."

**Why** (mine): in batch 26, all three hops asked whether something *is* so before the plan runs ("Is [teapot1] securely positioned on [table1]?"). They should ask whether it is *still* so at the step that needs it. The scene leaves the first kind open, so batch 27 settled it from absence, both ways (h5 and h7). The plan's consequence lines and the scene's carry lines answer the second kind. Read past so far: h7's slide line, and the carry line the tip moves.

**Not changed:** Reading the steps' fastening sentence, which may be why the hops asked about *securing*. It's the next candidate if they still drift to the glue.

## How it is probed

- **Batch 28:** the payload is draft 2's with the new text (`trial-against-3-payload.json`), 11 cells x1. No deploy is needed, since no code changed. The inputs hashes should equal batch 26's.
- **Then, only if the stop rule passes:** lift, and rerun the ruling on the lifted questions (as batch 27).

## Rubric (written before the batch)

- **The hops, the point of the change:**
  - **h7:** does the question ask whether [cup1] is still where it can be poured into at the pour, after the slide line? Does the argument use the slide line?
  - **h5:** does the question ask about the state after the tip, whether [teapot1] or [cup1] is still in line for the pour, rather than a fact before it?
  - **h10:** which thing it asks about. A question about the cup, after step 1, is answered in the plan's favour. One about the loose teapot after the tip is sound in the scene shown (read apart).
  - **Still the glue?** If a hop asks about securing again, that points to the fastening sentence.
- **The size cells (no regression):** still the size, and does the wording carry the scene's "small" in ("small enough", batch 27's OC-11 miss)?
- **The guards:** has the sentence turned the stability questions into state questions ("after picking up …")? Read whether common sense still settles them.
- **Unchanged from draft 2's rubric:** the polarity mix (11 of 11 `no` before), whether `blocking` follows, grounding, the step named, and form, including whether any reply writes the prose the Task asks for.

**The stop rule** (agreed with the user, 2026-11-17): **at least 2 of the 3 hops ask about the state at the step they turn on.**
- **If it passes:** lift, rerun the ruling, and grade against batch 27's 7 of 10 and the golden questions' 9.
- **If not:** step 2 stops where it stands. The case against gives questions, a tuning tool in its own right. The hops go up as needing clearer state from upstream, and the next attempt is the play-by-play and consequences revision.

## Results

### Batch 28 (2026-11-17), 11 cells x1

The response is at `scratchpad/trial-against-3-results.json`: instructions `28075768` (1467 chars), 11 calls, 0 errors. **The inputs hashes equal batch 26's.** **Form: 10 of 11.** h7 quoted its step with its role label, `"(intended) [teapot1] pours [tea2] into [cup1]"`, which the match refuses.

| Cell | Question | Blocking | Follows? | Read |
| --- | --- | --- | --- | --- |
| OC-11 | Can [table1] fit inside [cup1]? | no | yes | the size; "small" is gone from the wording |
| OC-18 | Can [table1] be physically moved without spilling its contents? | no | yes | **the size lost:** spilling |
| OC-3 | Can [table1] be placed inside [cup1] without spilling [tea1]? | no | yes | the size, with spilling added |
| OC-1 | Is [table1] Table stable and balanced on the floor? | no | yes | as batch 26 |
| OC-2 | Is [cup1] on a stable surface … without tipping over? | no | yes | as batch 26 |
| OC-20 | Is [table1] stable enough to be picked up without tipping over [saucer1] and [cup1]? | yes | **no** | stability; reversed |
| OC-6 | Can [teapot1] be lifted without spilling [tea2] out of it? | yes | **no** | spilling; reversed |
| h5 | Can [teapot1] be tipped without spilling [tea2] out of it? | yes | **no** | the tip's effect, as a capability; reversed |
| h7 | Can [teapot1] pour [tea2] into [cup1] after [cup1] has slid off [table1]? | no | yes | **the state at the pour, from the slide line** |
| h10 | Can [saucer1] be picked up without spilling [tea1] from [cup1]? | yes | **no** | step 1's effect, as a capability; reversed |
| OC-9 | Can the table be lifted without any objects on it? | no | yes | the argument invents glue ("they are glued to it") |

**The stop rule: 1 of 3 hops, so it fails, by my reading.**
- **h7 asks the state at its step,** from the slide line, which is what the change was for.
- **h5 is the borderline one, and the call is yours.** It asks about the tip's effect, but as a capability of the teapot ("can it be tipped without spilling"), not as where things stand at the pour. Its `blocking` is also reversed. I don't count it.
- **h10 asks about step 1's effect,** in the same capability form.
- **No hop asks about the securing.**

**Beyond the hops:**
- **"Can X … without spilling / tipping" became the common form,** in 7 of 11 cells. The sentence pulled the questions toward side effects rather than toward state.
- **The size cells regressed:** OC-18 lost the size, and OC-3 added spilling. OC-11's wording improved.
- **The polarity mix moved,** 4 yes against 7 no (11 no before). **But every yes is reversed:** "Can X without spilling?" answered yes means the plan goes ahead, not that it's blocked. So the answer that blocks follows in 7 of 11, down from 11 of 11. QS-2's field is doing its job: it shows this.
- **Grounding:** OC-9's argument invents glue, which the Tavern doesn't have. That's another hint (mine) that the fastening sentence does work in this prompt.
- **Form:** only h7 writes the prose before its block. 182 to 441 chars.

**By the rule agreed before the batch, nothing is lifted.** Batch 26's arguments stay as the lifted ones.
