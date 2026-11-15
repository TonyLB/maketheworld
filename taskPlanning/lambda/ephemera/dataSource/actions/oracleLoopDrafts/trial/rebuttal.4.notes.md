# The rebuttal, draft 4: evidence, then both attacks

For [the non-rule cell plan](../../AGENT.nonRuleCell.planning.md#recommended-order)'s step 3, the trial's stage 2. The design is the plan's [Rebuttal draft 4: evidence, then both attacks](../../AGENT.nonRuleCell.planning.md#rebuttal-draft-4-evidence-then-both-attacks), accepted by the user 2026-11-15. The shape is the user's: the question attacked first, evidence before the attack, relevance as a separate attack after it, and both attacks made as strongly as possible every time, biased rather than honest.

## The change

- **Task, replaced** (wording mine, quoted in the plan). Four parts:
  1. quote the lines bearing on the question, or "none";
  2. argue as strongly as possible, from those lines, that the argument's answer is wrong;
  3. give the kind of what was argued;
  4. argue as strongly as possible that the question doesn't bear on whether the plan can happen.

  The block is `{"evidence": [...], "answerWrong", "kind", "questionIrrelevant"}`.
- **The check:**
  - `evidence` is a non-empty list, `["none"]` or each item a quoted scene or step line;
  - `answerWrong` and `questionIrrelevant` are non-empty;
  - `kind` is one of three.

  The `claim` and `rebuttal` fields are gone. The cap is 600 tokens.
- **Two changes, a stated exception:** the attack on the answer with evidence first, and the relevance attack. The relevance attack is generated last, so the answer-side measures stay comparable to batch 5.
- **Unchanged:** Role and the Reading sections (draft 3's), the cells, the golden questions and arguments, the render.

## How it is probed

One payload, all 11 cells, `repeats: 1`, `options: {"upstream": "golden"}`, 11 calls, Micro, instructions `07fa3552` (1936 chars). The response is saved to a file. **Deploy check:** the inputs hashes match batch 5's. The check changed, so it needs a deploy.

## Rubric (written before the batch)

h5 and h10 are read apart.
- **The main measure, `answerWrong` sorted by hand as a world claim or a support claim.** A world claim is about the things ("a small round tea table is light enough for one person"). A support claim is about the argument ("the scene does not specify"). Batches 4 and 5: about 3 of 11.
- **Weak arguments:** does `evidence` hold "a small round tea table" (OC-1, OC-20), "You are holding nothing." (OC-2), "In [teapot1] there is [tea2] Tea." (OC-6)? Does `answerWrong` argue from it, with `kind` `wrong`?
- **Sound arguments (the size cells, h7):** is `answerWrong` visibly forced, with no concession? h7: does `evidence` hold the slide line, and what does the attack do with it, given that the line puts [cup1] on the floor?
- **Evidence before the attack:** does the attack draw on the quoted lines, ignore them, or contradict them?
- **`questionIrrelevant`, expected forced on every cell:** every question in this set bears on the plan. Count any that are persuasive, false strong attacks, and say what they claim. Note any that misread the task: arguing against the answer again, or conceding relevance.
- **The kinds' spread** against batch 5's `invented` 8. **Quote checks; length** against batch 5's 594 to 1209 chars; cut-offs at 600; **form.**

## Results (2026-11-15, batch 6)

Response at `scratchpad/trialRebuttal-4-results.json`. 11 calls, 0 errors, form 5 of 11. Each reply writes the four parts as prose, then repeats them in the block: 1233 to 2302 chars, against batch 5's 594 to 1209.

**Form, 6 failures.** OC-11 was cut off at 600 tokens, inside `questionIrrelevant`. The other five are quotes the check refuses, though they are lines as rendered, with the render's own furniture:
- a `Fiction:` or `Graph:` section prefix (h5, h10);
- a `consequence :` or `intended :` role label in a new spelling (h7);
- a quote spanning the Graph's header and rows (OC-18);
- an elided row, `Contents of the Tavern:... - [table1] ...` (OC-9).

All but the elision are check tolerance (mine, as TR-P5 was).

**Evidence: gathered, not argued from.** Real lines in 10 of 11. OC-20 holds "a small round tea table" and "You are holding nothing.", OC-2 holds "You are holding nothing.", OC-6 the teapot's tea, and h7 the slide line. OC-1 says `none`, missing the table line. Only OC-20's attack argues from its lines ("described as a small round tea table, which implies it is not too large and heavy"). h7 quotes the slide line, then calls the cup's fall "not established in the scene", against its own evidence.

**`answerWrong`, the main measure. World claims: 2 of 11** (OC-20; OC-9, "the table's size does not imply it is too heavy"). Batches 4 and 5 had about 3.
- **5 restate the argument's own answer** (TR-P8): OC-18, OC-3, OC-1 and OC-6 word for word or nearly, with OC-2 "the argument ... is incorrect". The field name `answerWrong` is filled as "the wrong answer".
- The rest are support claims: OC-11 "without any supporting evidence"; h7, h5 and h10 "not established in the scene".
- **The prose holds better attacks than the block.** OC-11's prose: "a small round tea table suggests it could fit within the cup", a world claim, lost in the block. h7's prose: "the cup could still be within a reachable distance", a world claim, which the block reduces to support.

**`kind`: `invented` 11 of 11** (batch 5: 8). The prose shows why (TR-P9). Every reply classifies **the argument**, not its own attack: "The argument is 'invented' because the scene does not provide...". OC-20 argues from a contradicting line and still says `invented`. The kind no longer tracks the attack at all.

**Sound arguments** (the size cells, h7). There is no concession anywhere. The size cells' attacks are forced: OC-11 and OC-18 offer smallness, or "metaphorical" use. h7 is forced but wrong about its own evidence, as above.

**Weak arguments.** OC-20 is the one clean win: the quote, and a world claim from it, though tagged `invented`. OC-1: `none`, and a restatement. OC-2: the quote, and an inverted reading ("holding nothing does not prevent"), close to the lookFor but not in the block. OC-6: the right line, and the right point in prose ("the teapot itself is a suitable container"), with the block restating the argument.

**`questionIrrelevant`: none persuasive, as expected. 6 of 11 collapse into the answer attack** (TR-P10): "irrelevant because the scene does not establish..." (OC-3, OC-2, OC-6, OC-9, OC-20, h10). The rest make a relevance move of a kind:
- "metaphorical or symbolic" (OC-11, OC-18);
- "depends on game mechanics" (h7);
- "doesn't affect the ability in the game world" (OC-1);
- "could reposition the teapot after the tip" (h5). This is the closest to a real one, and it adds a step.

**h5 and h10, read apart.** Both are support claims ("not established"). h10 doesn't take up its golden answer's state error (the saucer carries the cup off). It argues instead that a tip needn't spill anything, which is TR-P3's shadow.

**Reading** (mine). Evidence-first took: lines are on the table in 10 of 11, against batch 5's thin quoting. The attacks don't use them. Three new mechanisms sit between the lines and the block, and two are slot-name misreads: `answerWrong` filled as the answer, and `kind` read as the argument's kind. The third is the relevance attack falling back on the answer attack's move. The prose-then-block doubling costs a cut-off and loses the prose's better attacks.
