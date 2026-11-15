# The rebuttal, draft 5: one sentence, incoming argues, but

For [the non-rule cell plan](../../AGENT.nonRuleCell.planning.md#recommended-order)'s step 3, the trial's stage 2. The design is the plan's [Rebuttal draft 5: one sentence, incoming argues, but](../../AGENT.nonRuleCell.planning.md#rebuttal-draft-5-one-sentence-incoming-argues-but), accepted by the user 2026-11-15. The shape is the user's:
- a ruthlessly concise "Incoming argues '…'";
- a pivot straight to a source that something else is so;
- a branch listing the only facts the scene establishes about the thing, for a premise the scene never gives;
- relevance left out of this draft, to see whether the structure changes how the rebuttal weighs the incoming argument against the evidence.

## The change

- **Task, replaced** (wording mine, quoted in the plan): one sentence, as strongly as it can, in one of four forms after the pivot: the scene says, the steps say, common sense indicates, or the only facts about a handle. Reply with the block only, `{"rebuttal": "<the sentence>"}`.
- **The check** (mine):
  - the sentence parses (`parseRebuttal`);
  - a scene or steps source quotes a rendered line;
  - the facts branch names a handle in the scene, and each fact quotes a line naming it;
  - TR-P11's quote tolerance is added (section prefixes, both role-label spellings, multi-row Graph quotes).

  `evidence`, `answerWrong`, `kind` and `questionIrrelevant` are gone.
- **A new shape,** not one change to draft 4, as draft 4 was to draft 3. Compared on the same golden cells against batch 6's measures.
- **Unchanged:** Role and the Reading sections, the cells, the golden questions and arguments, the render, the cap of 600 tokens.

## How it is probed

One payload, all 11 cells, `repeats: 1`, `options: {"upstream": "golden"}`, 11 calls, Micro, instructions `496ff2d9` (1658 chars). The response is saved to a file. **Deploy check:** the inputs hashes match batch 6's. The check changed, so it needs a deploy.

## Rubric (written before the batch)

h5 and h10 are read apart.
- **The branch split per cell,** against batch 3's `not established` 9 of 11. Does the facts branch become the universal move?
- **The summary:** one premise or the whole argument (TR-P6)? A strawman? Is the argument restated anywhere past the summary, in prose outside the block or in the claim?
- **Weak arguments:**
  - OC-1 and OC-20: "a small round tea table", through either branch;
  - OC-2: "You are holding nothing." used as what picking up needs;
  - OC-6: a teapot as what tea is poured from, from the scene or common sense.
- **Sound arguments** (the size cells, h7): is the forced rebuttal visibly false? That is the tell. A size cell given the facts branch with "a small round tea table" looks like a rebuttal and isn't one (batch 4's inverted tell): count it, by cell. h7: is the slide line among the facts about [cup1], and what does the sentence do with it?
- **The facts branch's completeness,** a measure, not a gate: the rendered lines naming the handle that the list leaves out, and whether what's left out is the inconvenient line.
- **World or support** on branch 1 claims. The `the scene says` branch should quote a contradicting line.
- **Quote checks; form; length** against batch 6's 1233 to 2302 chars; **prose outside the block; cut-offs** at 600.

## Results (2026-11-15, batch 7)

The response is at `scratchpad/trialRebuttal-5-results.json`. 11 calls, 0 errors.

**Form: 0 of 11.**
- **Every reply drops the summary** and opens "But the scene says …" (TR-P12). Each reply is the block only, as asked: 149 to 404 chars, against batch 6's 1233 to 2302.
- **Read past the opening, by hand,** about 7 of 11 would pass. Three would still fail:
  - OC-6 joins two sources ("the scene says '…', and the steps say '…'");
  - h5 invents scene text ("… on which the teapot and cup are stable"), a real misquote;
  - h10 quotes the whole Fiction block, five sentences as one quote.
- OC-2 labels a scene line "the steps say".

**Shape.** Every reply is `But the scene says '<line>', which implies / indicating <claim>`. The trailing clause isn't in the template. Micro added it, and it is where the claim goes: a quoted line, then a claim about the world from it. The branches:
- the scene says: 9;
- the steps say: 1 (OC-2, misattributed);
- the two joined: 1 (OC-6);
- **common sense and the facts branch: 0 each.** The "not established" move is gone entirely: batch 3 had 9 of 11.

**There is no restatement anywhere.** The argument isn't summarized, quoted or paraphrased in any reply.

**World or support: world claims in 11 of 11** (batch 6: 2).

**Weak arguments:**
- **OC-1 and OC-20:** "a small round tea table … implies … small enough to be picked up by a single person". The lookFor, from the line.
- **OC-6:** the teapot's tea line, "the tea can be directly poured from the teapot into the cup". The lookFor.
- **OC-2:** "You are holding nothing", read as not preventing the lift. But the claim drifts to "picking up the saucer and then the cup", so it is partial.

**Sound arguments: visibly false, the tell.**
- **OC-11 and OC-18:** "indicating that the cup is large enough to accommodate the table". The two replies are word for word the same: same fixture, temperature as set.
- **OC-3:** "[table1] is small enough to fit inside [cup1]".

Each one quotes a true line and draws a claim from it that is plainly false. That is batch 4's inverted tell, now inverted the right way: a judge can see the stretch.

**h7:** quotes "In [cup1] there is [tea1] Tea" and claims [cup1] "remains intact and accessible". The slide line isn't mentioned. This is a weak rebuttal of a sound argument by evasion: the line chosen doesn't bear on the question. Mine: it is a fair tell, but a judge needs the slide line in view to see it.

**OC-9** (open): "a trestle table, often designed to be moved by one person". World knowledge offered under "the scene says". It is a stretch, readable as one.

**h5 and h10, read apart:**
- h5's fabricated quote is caught by the check.
- h10 argues that "tipping the table is not necessary to pour tea". That is a claim about the plan, a relevance-like move, made unprompted.

**Reading** (mine). With no restatement at all, the rebuttal argues from a quoted line to a world claim on every cell. Weak arguments get true claims, and sound ones get visibly false ones. This is the separation the triad needs, for the first time. It is one batch at `repeats: 1`, so exploratory.

The test the user designed isn't the one that ran. The summary was dropped, so this batch tests evidence-first with no restatement, not a bounded restatement. Whether the summary adds or costs anything is open. The facts and common-sense branches went unused, and this cell set has no invented-premise cell (the glue guards) to call for the facts branch.
