# Rule cell drafts: problems, proposals and what was tried

Owned by the [oracle loop plan](../../AGENT.oracleLoop.planning.md), like the one-prompt drafts' [`iterations.md`](../iterations.md), so it carries across episodes of tuning this piece. The first episode was the piece probe sub-plan of the oracle loop plan's Slice 4.5 (retired 2026-11-10), which settled on draft 3 at its exit (a), with nothing left worth a draft. A piece's drafts get a directory of their own, with their own numbering (user). The forms are the flat file's:
- **Problems** say what is wrong, where it shows, and what "solved" means.
- A **Library** entry is one change, so one entry is one draft, or one batch for a probe that changes no prompt.
- The **Ledger** has one line per batch, with the detail in the draft's `.notes.md`.

A batch is graded by its tally, and its cells are graded given their inputs.

**IDs:**
- Rows carried from the flat file's [disposition](../iterations.md#disposition-at-slice-4s-exit-2026-11-10) keep their IDs (PR-n, L-n), restated for the cell.
- New rows are `RC-Pn` and `RC-Ln` (mine), so they don't collide with the flat file.

## Problems

| ID | Problem | Shows on | Solved when | Status |
| --- | --- | --- | --- | --- |
| PR-9 | Relative motion read from the action's words, not its lines. In the one prompt, lifting the table with the teapot on it read as moving them apart | `OC-1` | `OC-1` `allows` 3 of 3, with `OC-6/tilted` still `blocks` 3 of 3 | Solved by draft 3 (RC-L6) in batch 4: `OC-1` 3 of 3, its descriptions from the lines; batch 5 2 of 3, the miss with a right description (RC-P4). Draft 1 had 5 of 6 over two batches, from the action's words |
| PR-11 | Lines that say each thing moves, read as the two moving relative to each other: tipping the table read as both together and apart | `OC-30/2/tipped`, `OC-30/2/together` | Both `allows` 3 of 3, with `OC-6/tilted` still `blocks` | Solved by draft 3 in batch 4: both 3 of 3, graded |
| RC-P1 | The verdict joined onto the reasoning's last line ("… allows. Answer: allows"), which `pieceAnswer` grades `malformed`, though the answer is right | 6 of 21 in draft 1: OC-30/2/tipped 3, OC-30/2/together 2, OC-6/stays 1 | No malformed replies over a batch | Solved by draft 3 in batch 4 (0 malformed), with RC-L5's block. Before that: 6 of 21 and 8 of 24 in draft 1's batches, all of them right answers, `blocks` too (OC-20, batch 2) |
| RC-P2 | The verdict decided in the reply's first clause ("No, …"), and the reason bent to fit it, against the lines | Draft 2: 22 of 24 decide first; OC-30/2/slides 0/3, OC-20 0/3, OC-6/tilted 1/3, OC-30/2/together 1/3 | Every cell as in draft 1 in substance, with the reply describing before it decides | Solved by draft 3 (RC-L6) in batch 4: 0 of 24 open with a verdict |
| RC-P3 | The slide read as moving together: "slides across the table along with it, … relative to each other but still together" | Draft 3: OC-30/2/slides 2 of 3 | `OC-30/2/slides` 3 of 3 | Solved by RC-L9 (cell data) in batch 5: 3 of 3 |
| RC-P4 | A right description with a verdict that doesn't follow from it: OC-1/3 describes the teapot rising with the table, then writes `blocks`, and its explanation after the block argues that glue holds the teapot still (PR-9's old misreading) | Draft 3, batch 5: OC-1 2 of 3 | OC-1 3 of 3 | Open: one call in 48 over draft 3 |

## Library

| ID | Try | For | Source | Status |
| --- | --- | --- | --- | --- |
| L-15 | Before the question, ask one yes/no for each of the rule's two things, given its line: "does it move relative to the room?" Then moving together is both yes, and apart is one yes. No example values | PR-9, PR-11 | Flat file, mine, from draft 3 | Untried |
| L-29 | Ground the reasoning in the lines: a fixed form that doesn't read as text to copy, since the one prompt copied the rule's clause as its reason 4 of 12 | Copying | Flat file, mine, from draft 9 | Untried |
| L-2b | Drop v45's "travels along with" sentence from the rule | PR-1 | Flat file, mine | **Carried out by the render:** with `sceneRules: false`, the cell shows no v45 rule sentence |
| L-34 | The rule text without its voiding sentence | Vocabulary | Flat file, mine, from draft 12 | **Carried out by the render:** the rule in parts shows only the fact and the enforcing rubric |
| RC-L2 | The verdict's form spelled out in the draft, for example "a last line of its own" | RC-P1 | Mine, from draft 1 | Superseded by RC-L5 |
| RC-L3 | The grade reads an `Answer:` that ends the reply's last line as well as one that starts a line: a probe change, not a draft | RC-P1 | Mine, from draft 1 | Superseded by RC-L5 |
| RC-L5 | The verdict as a trailing fenced `json` block, `{"answer": …}`, after prose reasoning, graded through `splitMarkdownReasoningAndJson`, the house shape (`llm/AGENT.md`). A draft change and a grade change, with the `Answer:` line kept as the grade's fallback | RC-P1; later pieces' multi-field answers | User, 2026-11-10; the details mine | The grade built 2026-11-10 and kept. Draft 2 ([notes](2.notes.md)), batch 3: form solved, judgment regressed (RC-P2), not kept |
| RC-L6 | Draft 2 with its reasoning asked for as a description, before any verdict: "First, in one or two sentences, say what the lines say about how the two things move relative to each other. Then end with …" so the prose isn't an answer to a yes/no question | RC-P2, RC-P1; PR-9 (the lines, not the action's words) | Mine, from draft 2; agreed by the user, 2026-11-10 | Draft 3 ([notes](3.notes.md)), batch 4: 23 of 24, kept |
| RC-L7 | Draft 2 with the question put as a statement to judge, not a yes/no question, so there is no "No," to open with | RC-P2 | Mine, from draft 2 | Not needed: RC-L6 solved RC-P2 |
| RC-L8 | Tool-call answers: the probe calls with a Bedrock `toolConfig` whose schema declares `answer` as an enum, in place of the fenced block. It is a probe (runner) change, not a draft, and it fires the piece probe's revision trigger. To check first: whether Nova Micro supports a forced tool choice, whether Bedrock enforces the schema for Nova or only passes it on, and whether forcing the call drops the prose, which would move the reasoning into a field whose order isn't guaranteed (RC-P2's risk). Nothing in the codebase uses `toolConfig` yet | The answer's form, more firmly than RC-L5; the parent's Slice 6 check of Micro's tool calls | User, 2026-11-10; the questions mine | **Booked for Slice 6** (user): investigate, and perhaps prototype as an experiment there, on the rule cell as the simplest case. It is not part of this plan's loop |
| RC-L9 | Cell data, not a draft: `OC-30/2/slides`'s teapot line "slides across [table1] as it tips", with "it" written out ("as [table1] tips"), since "it" can be read as the teapot. This changes the cell's inputs hash | RC-P3 | Mine, from draft 3 | Applied 2026-11-10: the inputs hash goes from `b9a47c74` to `add14926`, and the other cells are unchanged. Batch 5 (draft 3 again): slides 3 of 3 |
| RC-L4 | The reasoning points at the lines: "from what the lines under each action say each thing does" | PR-9 (`OC-30/2/slides` read its lines 3 of 3 in batch 2, so it is no longer needed for that) | Mine, from draft 1 | Untried |
| RC-L1 | `show: 'none'`: the same draft with no scene, a probe batch with no prompt change | Replies that draw on the scene over the lines (rubric (c)) | Mine, from step 2's comparison option | Untried; for when (c) recurs |

## Ledger

| Batch | Tried | Cells x calls | Result | Kept |
| --- | --- | --- | --- | --- |
| 1 | Draft 1, the baseline ([notes](1.notes.md)) | 8 cells (7 called) x3, Micro, 21 | 14 right, 1 wrong, 6 malformed. All 6 malformed are right answers on the reasoning's line (RC-P1), so 20 of 21 in substance. OC-1 2 of 3 (PR-9). Every blocking cell 3 of 3 | Baseline |
| | **Cell added** (2026-11-10): `OC-30/2/slides` (expected `blocks`), the tip with the teapot sliding, testing whether the glue-as-reason on OC-30/2/tipped reads the lines | | Runs from the next batch on; 8 called cells x3 is 24, the cap. Its inputs hash is `b9a47c74`; the other cells' hashes are unchanged | |
| 2 | Draft 1 again, with `OC-30/2/slides` added ([notes](1.notes.md#batch-2-2026-11-10-with-oc-302slides)) | 9 cells (8 called) x3, Micro, 24 | 16 right, 0 wrong, 8 malformed. All 8 are right answers written inline, so 24 of 24 in substance. `OC-30/2/slides` blocks 3 of 3, citing its line. OC-1 3 of 3 | Baseline, unchanged |
| 3 | Draft 2, the verdict as a fenced `json` block (RC-L5) ([notes](2.notes.md#results-2026-11-10-batch-3)) | 9 cells (8 called) x3, Micro, 24 | 14 right, 10 wrong, 0 malformed. The form is solved, but 22 of 24 decide in their first clause (RC-P2): OC-30/2/slides 0/3, OC-20 0/3, OC-6/tilted 1/3, OC-30/2/together 1/3 | **No.** Draft 1 stays the base; the grade change stays |
| 4 | Draft 3, the reasoning as a description of the lines, then the block (RC-L6) ([notes](3.notes.md#results-2026-11-10-batch-4)) | 9 cells (8 called) x3, Micro, 24 | 23 right, 1 wrong, 0 malformed. RC-P1, RC-P2, PR-9 and PR-11 solved. OC-30/2/slides 2 of 3 (RC-P3) | **Yes**, the base |
| 5 | Draft 3 again, after RC-L9's cell wording ([notes](3.notes.md#batch-5-draft-3-again-after-rc-l9)) | 9 cells (8 called) x3, Micro, 24 | 23 right, 1 wrong, 0 malformed. Slides 3 of 3 (RC-P3 solved); OC-1 2 of 3, a right description with a `blocks` verdict (RC-P4). Draft 3 over two batches: 46 of 48 | The base, unchanged |
