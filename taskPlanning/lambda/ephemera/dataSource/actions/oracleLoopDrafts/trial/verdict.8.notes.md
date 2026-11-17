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

## Batch 21: 8b by system delivery (trialQuestion step 0.5)

**The change:** one, the delivery. Draft 8b (`951f57f4`, unchanged) goes as system instructions with the verdict's system part (the scene, the request and the steps). The user message is the user part: the question, then the two tags. The text and its order are batch 16b's; only the messages differ.

**How it is probed:**
- **Payload:** one, all 11 cells, `repeats: 1`, `options: {"stage": "verdict", "upstream": "lifted"}`, `delivery: "system"`, so 11 calls on Micro.
- **Results:** saved to one file.
- **Deploy:** done (the user, 2026-11-17).

**Rubric (written before the batch).** Batch 16b is the baseline: 4 of 10, `rebuttal` 11 of 11, only the guards right. The inputs hashes should equal 16b's, and the response's `delivery` should be `system`.
- **The tally against 16b, cell by cell.** At x1, a difference of one or two cells is within the wobble.
- **The settling clause's source** (TR-P21): is "the scene says" still followed by the rebuttal's line? Does any reply settle from the system text's scene over the rebuttal's quote, or from common sense?
- **The size cells,** above all OC-11 (`argument` expected), and OC-3, right in batches 11 to 15 and lost in 16.
- **The guards:** still right?
- **The system text as material:** does any reply treat it as something to report on (the Role, the steps, "the instructions say") rather than reason from?
- **Form:** malformed replies, length, cut-offs at 400, prose after the block.
- **The keep rule** (the user, 2026-11-17): the option is kept unless it moves the verdict strongly in the wrong direction.

**Results (2026-11-17, batch 21).** The response is at `scratchpad/trial-verdict-8b-system-results.json`: `delivery: "system"`, instructions `951f57f4`, 11 calls, 0 errors. Every inputs hash equals 16b's.

**The tally: 4 right, 6 wrong, 0 malformed, OC-9 ungraded, as 16b.** Ten cells answer as in 16b. The one change is OC-9, from `rebuttal` to `argument`. Only the guards are right; OC-11, OC-3 and OC-18 stay wrong.

**The settling clause's source:** "the scene says" in 10 of 11. On the size cells, the scene text cited is the scene's own "a small round tea table", the same words the rebuttal quotes. So these cells can't tell trust in the scene from trust in the rebuttal: the source-trust question step 0.5 asked isn't separable on them.

**What fails is the reasoning, not the source:**
- **Size (OC-11, OC-3, OC-18):** "small" is read as absolute, not small for a table. Common sense returns as a source in OC-3 and OC-18, but misapplied: "small objects can fit inside smaller containers" (OC-3), "a small round tea table can fit into a cup of ordinary size" (OC-18). No reply compares the two sizes.
- **h5, h7, h10:** the verdict accepts rebuttals that answer another question. In h5 and h10 the rebuttal says tipping isn't needed to pour, but tipping is the plan's step and the question is what it causes. In h7 it answers with the cup's place before the steps, read as "the state left by the steps". Nothing checks whether the rebuttal answers the question.
- **OC-9:** the first reply to bring in the ordinary on its own: "an oak trestle is typically too heavy for one person to lift". It reverses 16b's backwards use of the ordinary-default rule. One ungraded call at x1.

**The system text as material:** no reply reports on it (no Role, no "the instructions say").

**Form:** 0 malformed; 376 to 854 chars; no cut-offs; nothing after the block. OC-9 adds one paragraph of evaluation before it.

**The keep rule, the user's call (2026-11-17): kept.** Nothing moved strongly in the wrong direction, and the one change went the sensible way. In the user's words, the main thing is that the tool is now available, even if later tuning shows it isn't the right tool for some particular case. The verdict keeps its divide as it stands: the scene, the request and the steps in the system part, the question and the two sides in the user part.

**For step 1's review** (mine): the size failure is a missing comparison (small for what?), and the h-cells fail because nothing checks that the rebuttal answers the question asked. Both point the same way as the ruling's design: a question with no persuasive text beside it.

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
