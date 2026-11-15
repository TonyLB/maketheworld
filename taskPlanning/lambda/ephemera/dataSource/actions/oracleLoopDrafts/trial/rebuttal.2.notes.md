# The rebuttal, draft 2: notes and reading rubric

For [the non-rule cell plan](../../AGENT.nonRuleCell.planning.md#recommended-order)'s step 3, the trial's stage 2. The design is the plan's [Rebuttal draft 2: claim, evidence, kind](../../AGENT.nonRuleCell.planning.md#rebuttal-draft-2-claim-evidence-kind), accepted by the user 2026-11-15. It is aimed at **TR-P4**, uniform rebuttals.

## The change

The chain is the user's: read, find the most refutable claim, classify. Two changes, a stated exception: the chain, and the kinds redefined against the quote.
- **Task, replaced** (wording mine). In four parts:
  1. quote the argument's claim that is easiest to refute;
  2. quote the scene or step line that bears on it, or say "none";
  3. give the kind, by how the line relates to the claim: `wrong` when the line says otherwise, `invented` when no line bears on it, `not established` when the claim turns on a detail the scene could have given;
  4. the rebuttal, in a sentence.

  The block is `{"claim", "evidence", "kind", "rebuttal"}`, in that order.
- **The check gains two quotes:** `claim` inside the argument, and `evidence` `none` or inside one scene or step line. The lines come from the render (`evidenceLines`). Matching ignores punctuation and case. The read-piece check now receives the rendered text, a probe change for this.
- **Unchanged:** Role, the Reading sections, the cells and lifted arguments, the render, the cap of 400.

## How it is probed

One payload, all 11 cells, `repeats: 1`, 11 calls, Micro, instructions `ef45cf9c` (1785 chars). The response is saved to a file. **Deploy check:** the inputs hashes match batch 3's. The check changed, so it needs a deploy.

## Rubric (written before the batch)

h5 and h10 are read apart, as in batch 3.
- **Weak arguments, the main measure (OC-1, OC-2, OC-20, OC-6):** is the rebuttal strong now? A quoted contradicting line and `wrong`. OC-1 and OC-20 should quote "a small round tea table". OC-2's line is "You are holding nothing", and does the rebuttal see that empty hands are what lifting needs? OC-6's is the teapot holding the tea. Batch 3 had OC-6 alone right on its premise.
- **Sound arguments (OC-11, OC-18, OC-3, h7):** is the rebuttal visibly weak? `evidence: "none"`, or a quote that doesn't bear on the claim. A rebuttal of the size that quotes "small round tea table" bears on the table but not on the cup, so read it closely. h7: does it quote the slide line, and does it then give `wrong`? That would contradict the line, a misreading.
- **The claim chosen:** the argument's actual weak point (OC-1: "too large and heavy"), or its framing?
- **The kinds:** the spread, against batch 3's 9 `not established`. Does each kind fit its evidence by the draft's definitions?
- **The quote checks:** how many pass; the misses, and whether a miss is a paraphrase or an invention.
- **OC-9:** the kind and the evidence ("a long oak trestle").
- **Length:** against batch 3's 314 to 488 chars. The four parts may lengthen the prose.
- **Form:** check failures besides the quotes; cut-off replies.

## Results (2026-11-15, batch 4)

11 calls, `repeats: 1`, Micro, instructions `ef45cf9c` (1785 chars). **The deploy check passed:** every inputs hash matches batch 3's (h7 `ae2137a9`). **Form:** 10 of 11 pass. h7 fails because it quotes the slide line *with* its `(consequence)` label, exactly as the prompt shows it. That's a check fault (mine): the label is in the prompt. **Kinds:** `invented` 8, `wrong` 3, `not established` 0. Lengths are 757 to 1175 chars, about twice batch 3's. The prose is the four parts as headings, each holding only its answer.

| Cell | Claim | Evidence | Kind | Rebuttal | Read |
| --- | --- | --- | --- | --- | --- |
| OC-11 | the whole argument | "… [table1] Table (a small round tea table)." | wrong | "a small round tea table, implying it could fit inside the cup" | Sound argument; a rebuttal that *looks* strong and is nonsense |
| OC-18 | the whole argument | the same line | wrong | "not established … thus the claim is incorrect" | As OC-11 |
| OC-3 | the whole argument | none | invented | "the game's rules may allow for unconventional placements" | Sound argument; visibly weak rebuttal |
| OC-1 | the whole argument | none | invented | "The scene does not provide any information about the weight or size" | **Weak argument; weak rebuttal.** It misses the line OC-11 found |
| OC-2 | the whole argument | "You are holding nothing." | invented | "pick up the saucer first" | The right line quoted, then a workaround |
| OC-20 | the whole argument | none | invented | as OC-1 | As OC-1 |
| OC-6 | the whole argument | none | invented | "the scene does not establish any such limitation" | Right in content, no evidence |
| OC-9 | the whole argument | none | invented | weight not given | |
| h7 | the whole argument | the slide line, with its label | wrong | "The scene does not establish that tipping … would immediately cause the cup to fall off" | **Quotes the line, then contradicts it** |
| h5, h10 (apart) | the whole argument | none | invented | not supported | The same move |

**Against the rubric:**
- **Weak arguments, the main measure:** none rebutted with a contradicting quote and `wrong`. OC-1 and OC-20 give `none`, though the scene has "a small round tea table". OC-2 quotes the right line and then offers a workaround.
- **Sound arguments:** OC-3 is visibly weak. **OC-11 and OC-18 are the reverse of what we want**: they quote "small round tea table" and say `wrong`, the strongest-looking rebuttals in the batch, for arguments that are sound. h7 quotes the slide and says it isn't established.
- **The claim chosen:** the whole argument, 11 of 11. The "easiest to refute" step does nothing.
- **The kinds:** `invented` is now the universal move (8 of 11), as the user said it technically could be.
- **The quote checks:** 10 of 11 pass. The one miss is the check's fault.

**What it shows:**
- **The chain took as form, not as reasoning.** Each part is a heading holding its answer, with no reading in between. The claim is the whole argument, and the evidence is found or not almost at random. OC-11 found the table's description and OC-1, on the same scene, did not.
- **The structural tell is inverted.** The plan expected `evidence: "none"` to mark a sound argument's rebuttal. Instead it marks the weak arguments' rebuttals (OC-1, OC-20), and the sound size arguments got quoted evidence and `wrong`. A judge reading the structure would be misled.
- **Two drafts, one pattern:** the rebuttal finds a universal move and uses it (`not established`, then `invented`). It doesn't tell sound arguments from weak ones.
