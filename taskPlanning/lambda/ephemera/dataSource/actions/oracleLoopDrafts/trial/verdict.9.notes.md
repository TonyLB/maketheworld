# The verdict, draft 9: draft 8b on the explicit render

For [the trial question plan](../../AGENT.trialQuestion.planning.md#recommended-order)'s step 1.5, retest B. The test is the user's (2026-11-17), and the design was reviewed by the user the same day. **The question:** were the verdict's misses the render's? If so, verdict drafting is live again for step 3.

## The change

There is one unit of change against 8b ([`verdict.8b.txt`](verdict.8b.txt)), the unit step 0 measured as one arm:
- **the explicit render** in place of the judge render, the securing omitted as before (`options.scene: 'explicit'`);
- **Reading the scene dropped;**
- **step 0's stance in the Role,** word for word, after its first sentence.

**One wording change is forced** (mine): 8b's Task said "by using the Reading the scene instructions above to consider that claim", and that section is gone. It now reads "by considering that claim in the context of the larger scene".

**Unchanged:**
- Reading the steps;
- Reading the argument and the rebuttal;
- the template and the verdict rule;
- the lifted pairs;
- the tags;
- the question line;
- the cap of 400;
- user delivery.

Every lifted rebuttal's quotes are Fiction sentences, which the explicit render keeps word for word, so they are still on the page (pinned by a test).

[`verdict.9.txt`](verdict.9.txt) is 2838 chars.

## How it is probed

- **Payload:** batch 24, `{"stage": "verdict", "upstream": "lifted", "scene": "explicit"}`, 11 cells x1 on Micro.
- **Deploy first:** the `scene` option is new code.
- **Results:** saved to a file and read with `jq`.

## Rubric (written before the batch)

**Baselines:**
- **16b** (8b on the judge render) and **21** (the same by system delivery): 4 of 10 each, only the guards right, `rebuttal` 11 of 11 in 16b.
- **The ruling** (batches 22 and 23a), the same scene with nothing argued: the size cells and the guards 28 of 28.

**What decides it:**
- **The size cells (OC-11, OC-18, OC-3) and h5:** wrong in every verdict batch. If they turn right, the render was the bottleneck. If they stay wrong while the ruling had them right on the same scene, the anchoring on the rebuttal is real (QS-3).

**Per cell:**
- **OC-11, OC-18, OC-3** (`argument`): does the settling clause compare the sizes, as the ruling's replies did ("Given the typical sizes of such objects…")? Or does it take the rebuttal's "small enough to fit" from its quote of "a small round tea table"? Does the per-object default ("as an ordinary small round tea table is", "as an ordinary cup is") appear as the source?
- **OC-1, OC-20, OC-6, OC-2** (`rebuttal`): still right? From what?
- **h5** (`argument`): the rebuttal dodges ("not requiring tipping"). Does the reply see that it answers another question?
- **h7** (`argument`): is the slide line used, as the ruling's reply did?
- **h10** (`argument`, read apart): the exchange reading.
- **OC-9:** ungraded.

**Beyond the tally:**
- **The settling clause's source** (TR-P21): "the scene says" followed by the rebuttal's quoted line, against the per-thing lines ("The things:") or common sense.
- **The new lines as material:** does any reply quote a carry line or a default line? Is a carry line read as an event?
- **The stance:** is "what it leaves out is open" used to doubt a side?
- **Form:** malformed replies, length, cut-offs at 400, prose after the block.

## Results (2026-11-17, batch 24)

The response is at `scratchpad/trial-verdict-9-results.json`: instructions `ff1d8042` (2837 chars), options `{upstream: lifted, scene: explicit}`, 11 calls, 0 errors, 0 malformed.

**The tally: 4 right, 6 wrong, OC-9 ungraded, `rebuttal` 11 of 11: every answer as 16b's.** Only the guards are right. The size cells and h5 stay wrong, though the ruling had them right on the same scene (28 of 28 with h5 at x1).

**The settling clause adopts the rebuttal's inference as the scene's:**
- **OC-11:** "which the scene says is a small round tea table, which is small enough to fit inside a cup".
- **OC-3:** adds "common sense says small things can fit inside cups".
- **OC-18:** "the cup is not described as being too small to fit it, implying it can": absence, toward the rebuttal.
- **h7:** takes the rebuttal's invented quote, "'[cup1] remains intact and on [saucer1]'", as what "the scene says". The slide line goes unused.
- **h5:** "the teapot is already on the table". The rebuttal's dodge is accepted.
- **h10:** the first verdict reply to use an explicit line. It quotes the carry line ("when the table moves, what is on it moves with it, unless the motion slides or tips it off"), concludes the scene "does not specify", and gives `rebuttal`.
- **OC-9:** "the scene does not specify" weight, so "the rebuttal correctly points out the lack".

**The per-object default** ("as an ordinary … is") is quoted in no reply; the ruling quoted "an ordinary cup" in 9 of 9 size replies.

**Form:** 0 malformed; 357 to 892 chars; no cut-offs. h10 and OC-9 add a paragraph of evaluation.

**Reading** (mine):
- **The render wasn't the verdict's bottleneck; the argued text is.** The same scene, the same question and the same Micro give the size comparison every time with nothing argued in view (the ruling), and never with the rebuttal beside it.
- **The rebuttal's claim is restated as the scene's,** even an invented quote (h7). That is TR-P21 with the explicit render under it.
- **What it shows is narrow:** with this packaging and this prompt, argued text in view overrides the judge's own common sense, and the explicit render alone doesn't change that.

**The user's correction (2026-11-17), which governs the reading above:** we haven't found how to deliver and frame arguments so that a judge is informed by them and still draws its own conclusions. We've reached two poles, the arguments ignored and the arguments accepted wholesale, and nothing between. That isn't evidence it can't be done. Weighing an argument as one fallible input is the holy grail of debate-based judgment, and reaching it would change how the loops needed grow with complexity. **Set aside, not rejected:** we level up the judgment pieces, then come back to it (QS-3).
