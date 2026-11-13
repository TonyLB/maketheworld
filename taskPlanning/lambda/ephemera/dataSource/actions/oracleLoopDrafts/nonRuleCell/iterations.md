# Non-rule cell drafts: problems, proposals and what was tried

Owned by the [oracle loop plan](../../AGENT.oracleLoop.planning.md), like the [rule cell's](../ruleCell/iterations.md), so it carries across episodes of tuning this piece. The first episode is the [non-rule cell plan](../../AGENT.nonRuleCell.planning.md). Each draft has its own directory entries: `N.txt` holds the instructions, and `N.notes.md` holds the change, the rubric written before the batch, and the results.
- **Problems** say what is wrong, where it shows, and what "solved" means.
- A **Library** entry is one change, so one entry is one draft, or one batch for a probe that changes no prompt.
- The **Ledger** has one line per batch, with the detail in the draft's `.notes.md`.

A batch is graded by its tally, and its cells are graded given their inputs. The piece's own grade gives each answer as a canonical string: `allows`, `blocks <step>/<cause>`, or `needs detail of <of> <step>`, with steps counted from 1. `reason` and `missing` are read by hand against each cell's `lookFor`.

**IDs:** `NR-Pn` and `NR-Ln` (mine), apart from the plan's open decisions (NR-1 to NR-9).

## Problems

| ID | Problem | Shows on | Solved when | Status |
| --- | --- | --- | --- | --- |
| NR-P6 | **A reluctance to allow:** `allows` is read as failing to find the blocker, since the stop is the only structured endpoint and the walk is defined by its halting condition. When nothing real blocks, a blocker or a request is invented. NR-P1 to NR-P5 are its symptoms (the user's diagnosis, 2026-11-13). It isn't token economy: the single-step cells have no early exit and were blocked 9 of 9 | Batch 1: 2 `allows` in 33, both on OC-2 | The guards and h10 `allows` 3 of 3, with the size cells still `blocks` | Open; NR-L4 (draft 2) didn't move it (still 2 `allows` in 33); NR-L5 next |
| NR-P1 | Securing used as a blocker, against draft 1's "judged separately". The glue on the teapot is also misread as the table's ("glued to the floor", "glued to the table surface") | Batch 1: OC-1, OC-20 and OC-6 0 of 9; OC-30/h10 2 of 3; it also appears in 4 of 6 size-cell replies and 2 of 3 on h5 | OC-1, OC-20 and OC-6 `allows` 3 of 3, and no reason cites securing | Open; 11 of batch 1's 19 wrong |
| NR-P2 | An invented precondition: picking up a cup on a saucer needs the saucer picked up first | Batch 1: OC-2 r3 | OC-2 3 of 3 | Open; one call in 3 |
| NR-P3 | A method step judged as unwise or "not feasible in this context", not as physically impossible: tipping a small table blocked because it would upset the things on it | Batch 1: OC-30/h5 3 of 3, h10 r3 | h5 and h10 no longer block the tip | Open |
| NR-P4 | `needs detail` of the action asked of a plain method step ("how is the table tipped: angle, force?"), and, by the first-step rule, winning over a right reading of a later step | Batch 1: OC-30/h7 3 of 3 | h7 reaches step 3 | Open |
| NR-P5 | The state not carried forward: things an earlier step moved are judged where they started | Batch 1: OC-30/h10 r3 (the cup "would fall off" after the saucer, carrying it, was picked up) | h10 `allows` 3 of 3 | Open; one clear case, masked by NR-P1 elsewhere |

## Library

| ID | Try | For | Source | Status |
| --- | --- | --- | --- | --- |
| NR-L1 | The per-step shape (NR-8): one call per step, which judges whether that step blocks itself, and if not whether it makes a later step impossible. Code joins the calls | The one-pass walk failing over a longer sequence (NR-4's risk) | The user, 2026-11-13 (the fallback) | Untried; not one change to a draft, so it may be its own piece |
| NR-L2 | The roles' wording: the render's labels (`intended`, `method`, `consequence`) and the draft's gloss of them | Roles misread | Mine, from draft 1 | Untried |
| NR-L3 | `reason` asked for as the brief for what follows: for a method, what an alternate method must get around; for a consequence, what a mitigation must prevent; for an intended step, the floor's sentence (NR-2) | Reasons that don't brief the next ask | The plan's NR-2; held back from draft 1 | Untried |
| NR-L4 | The outcomes framed by what they indicate. Works: straightforward to imagine and to describe coherently. Blocked: straightforward to imagine what keeps it from happening; if it happened anyway, the description stops making sense. Needs detail: information that should be available isn't given yet. Each step's finding is given in the walk, and draft 1's hunt checklist is dropped | NR-P6 | The user's framing, 2026-11-13; wording mine | Draft 2 ([notes](2.notes.md)): **no change** in batch 2. Adopted in form ("Finding: It works"), but a "works" finding is stated as an absence ("nothing prevents"), never as an outcome. Not kept |
| NR-L5 | **The non-branching walk:** a result for every step, even after an impossible one, with what a blocked step would establish if it happened anyway; code applies the first-non-pass rule. A contract change (NR-4's block and the grade), not a draft alone | NR-P6's source (the stop as the only structured endpoint); NR-P4's h7 case | User, 2026-11-13 | Next, draft 3, in the plan's step 3 (drafts in isolation), to land with NR-L6. Open: what state a needs-detail step leaves |
| NR-L6 | **Consequences attached to their step:** consequence lines under the step that causes them, each quotable, in place of consequence steps, as `consequences` returns them. A render and cell-data change, amending the step layout and NR-4's canonical string; only h7's data changes | A per-step check asking for consequences that the next step gives | User, 2026-11-13 | Next, draft 3, in the plan's step 3 (drafts in isolation), with NR-L5 |

## Ledger

| Batch | Tried | Cells x calls | Result | Kept |
| --- | --- | --- | --- | --- |
| 1 | Draft 1, the baseline ([notes](1.notes.md)), in two payloads: 1a, the single-step cells, and 1b, the OC-30 hops | 11 cells x3, Micro, 33 (24 + 9) | 11 right, 19 wrong, 0 malformed, 3 ungraded. The size cells 9 of 9; the guards 2 of 12 (NR-P1, NR-P2); the OC-30 hops 0 of 9 (NR-P1, NR-P3, NR-P4, NR-P5). Every quote matched exactly | Baseline |
| 2 | Draft 2, the outcomes framed by what they indicate (NR-L4) ([notes](2.notes.md#results-2026-11-13-batch-2)) | 11 cells x3, Micro, 33 (24 + 9) | 11 right, 19 wrong, 0 malformed, 3 ungraded: batch 1's answers, except h7 now blocks on an invented "glued to the floor". "Works" findings state an absence, never an outcome. Glue in 20 of 33 replies | **No.** Draft 1 stays the base |
