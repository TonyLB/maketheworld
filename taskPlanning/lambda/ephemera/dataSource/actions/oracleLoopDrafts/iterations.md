# Oracle drafts: problems, proposals and what was tried

Owned by the [oracle loop plan](../AGENT.oracleLoop.planning.md), like the drafts beside it, so it carries across episodes of oracle tuning. An episode's plan (today [oracle drafts](../AGENT.oracleDrafts.planning.md)) pulls from the library and writes to the ledger. A trial of this shape for exploratory steps (2026-11-09; the user's proposal, the forms mine).

- **Problems** say what is wrong, where it shows, and what "solved" means. A problem is solved when its cases give the right end result and the guards still do. A draft that turns up a new problem adds a row.
- **Library** entries are one change each, so one entry is one draft (or, for a probe, one batch that changes no prompt). Add ideas freely, with their source; don't argue an entry before trying it.
- **Ledger:** one line per batch. The detail is in the draft's `.notes.md`. A finding about one of the oracle loop plan's guesses also goes to its [seam ledger](../AGENT.oracleLoop.planning.md#seam-ledger).

## Problems

| ID | Problem | Shows on | Solved when | Status |
| --- | --- | --- | --- | --- |
| PR-1 | Pour gets a false `better`: the glue rule is read as about the table's frame moving, never about the teapot tipping, and `Rules` gives `No consequence` | OC-6, Micro and Lite (draft 1) | OC-6 `not better`, naming the glue against the teapot's tipping, 3 of 3 on Micro; OC-1 still `better` | Open: 2 of 3 with draft 2 (batch 3) |
| PR-2 | Size gets a false `better` on Micro: "fits: yes", once citing "small round tea table". Lite is right, and v45 on Micro caught size on OC-3, so the cause (Micro, or `Picture` asking how a thing moves and not whether it fits) is open | OC-11, Micro only (draft 1) | OC-11 `not better` on size, 3 of 3 on Micro; OC-1 still `better` | Open |
| PR-3 | Replies spread each step over several numbered lines where the draft asks for one line each. The form check accepts it, so it matters only to a parse of the lines (the episode's comparative grading) | OC-1, OC-6, Micro (draft 1, through the harness) | Every reply in a batch writes each step on one line | Open, low: matters at comparative grading |
| PR-4 | An attempt on a rule is read as an obstacle: prying the teapot off gives the glue `Conflict`, and the player's own method is refused | OC-19, Micro (L-1), 0 of 3 | OC-19 `better`, the glue as what the method changes, 3 of 3; OC-6 and OC-1 as they stand | Solved on OC-19 by draft 2, 3 of 3 (batch 3); held open by OC-1 slipping to 2 of 3 (PR-9) |
| PR-5 | A finished "no" answer is judged as the action: `Moves` becomes "the player wants to pour", and the reply judges the pour, not whether the answer beats the floor | OC-30/1, Micro (L-1), 1 of 3 | OC-30/1 `better` 3 of 3, judging A as an answer | Open |
| PR-6 | Tipping a frame moves nothing on it: no reply notices the saucer and cup sliding off the tipped table | OC-30/2 0 of 3, and OC-13 (L-1) | (user) OC-30/2 and OC-13/1: not better, the potential marked (it gets past the glue), and an improvement moving `[saucer1]` off first, 3 of 3 each; OC-1 still `better` | Open |
| PR-7 | The fact's role isn't read: the dungeon and the doll-house get the same reasoning, word for word | OC-12 0 of 3, OC-13 3 of 3 (L-1) | (user) The same tipping candidate judged differently: OC-12 not better with no potential, since it is a method the system supplied on a challenge, and the direction to the player; OC-13/1 not better with its potential marked and the saucer improvement; 3 of 3 each. Touches JF-15 and JF-17 | Open |
| PR-8 | With no `After:`, `Changes` makes relations up from the step's words (the teapot into the cup, the table "wiped") | OC-7, OC-12, OC-13, OC-19, OC-30 (L-1) | No made-up relation in a batch over hand-written candidates | Open, low: what it feeds (`Picture`) is under PR-1 and PR-6. Unchanged by draft 2 |
| PR-9 | `Rules` answers the branches against the request or the move's words, not against `Picture`: lifting the table with the teapot on it read as moving them apart, a teapot `Picture` tilts read as moving with the table. `together` and `changes first` are answered loosely where `apart` decides the verdict | OC-1 1 of 3, OC-6 1 of 3 (draft 2) | OC-1 3 of 3 and OC-6 3 of 3 together, with each branch's answer matching what `Picture` said moves | Open |

## Library

| ID | Try | For | Source | Status |
| --- | --- | --- | --- | --- |
| L-1 | Run draft 1 unchanged on the cases it hasn't met (OC-5, OC-7, OC-12, OC-13, OC-19, OC-20, OC-30), a probe, to find the problems not yet known before tuning the known ones | All | Mine | Done 2026-11-09: PR-4 to PR-8 ([results](1.notes.md#results-2026-11-09)) |
| L-2 | The rule as a test of a method (user's framing, 2026-11-09): the scene's rule worded as keeps (moved together, or the fact changed first) and breaks (moved apart beyond what the relation allows while the fact holds), with `rules: "violation"`; and the `Rules` step asking the three branches as yes/no given `Picture`, then `breaks` or `keeps` | PR-1, PR-4 | Seam ledger, 2026-11-09; the user's four outcomes | Done 2026-11-09, draft 2 ([results](2.notes.md#results-2026-11-09)): OC-6 2/3, OC-19 3/3, OC-30/2's rule 3/3, OC-1 2/3. The base for the next draft |
| L-2b | Fallback for L-2: drop the v45 rule's "When [table1]'s frame moves, [teapot1] travels along with [table1]", the sentence replies quote as their reason for `No consequence` | PR-1 | Mine, from L-1 | Untried |
| L-3 | `Picture`: say what happens to a thing a move takes something out of (a container emptied has to tip or open), as well as to the thing that moves | PR-1 | Draft 1 notes: no `Picture` tipped the teapot on Lite, and Micro's 2 of 3 that did still got `No consequence` | Untried |
| L-4 | `Picture`: ask whether each moving thing fits where it goes, as a sentence of its own after how it moves, since the `fits` test reads `Picture` and `Picture` asks only how | PR-2 | Draft 1 notes | Untried |
| L-5 | Override `framing.templateExplanation` with a sentence that doesn't say the move was checked, in case "checked against how the game records this place" reads as "it fits". A framing change, no new draft | PR-2 | Mine | Untried |
| L-6 | `Task`: show the reply's form as eight lines, one per step name, in place of "Write one line for each of these steps" | PR-3 | Mine | Untried |
| L-7 | `Relations and frames`: a worked example of tipping, outside the fixtures' domains (a tray tilted, what rests loose on it slides), next to the crate, whose "do not move relative to the crate" holds for lifting and may be read for tipping. It changes a reusable module (JP-8, a guess) | PR-6, perhaps PR-1 | Mine, from L-1 | Untried |
| L-8 | `Task`: a step before `Moves` that says what the candidate is, steps or a finished answer, and for a finished answer judges the answer against the best so far | PR-5 | Mine, from L-1 | Untried |
| L-9 | `Rules`: a candidate whose step acts on the fact behind a rule says so (the rule is what it changes), the shape v45's `Revises` had for a direct attempt (JP-14) | PR-4 | Inherited premise JP-14 | Untried; a fallback if L-2's "changes first" branch doesn't carry the pry |
| L-10 | `Changes`: with no `After:`, write "not shown" | PR-8 | Mine, from L-1 | Untried |
| L-11 | `Task`: a step asking whether the scene's description makes the fact behind a rule a challenge or texture, before `Improve` (a test of JF-17's inference, the field absent) | PR-7 | Proposal record, a fact's role (mine) | Untried |
| L-12 | `Task`: a step marking a candidate's potential, what it gets past even though it doesn't work, before `Improve`, so a frontier candidate reads apart from a worse one | PR-6, PR-7 | User, 2026-11-09 | Untried |
| L-13 | `Improve`: read the improvement requests off a broken rule's two keeping branches: move the two things together, or change the fact first, keyed by the rule's handle. The method dial filters them | PR-7, and the oracle-to-engine direction | User, 2026-11-09 (a broken rule's neighbours are its repairs) | Untried |
| L-14 | `Rules`: before the three questions, write what `Picture` says each of the rule's two things does ("[teapot1]: tilts", "[table1]: stays"), then answer the branches from those two lines | PR-9, and L-13's need for sound keeping branches | Mine, from draft 2 | Untried |

## Ledger

| Batch | Tried | Cases x calls | Result | Kept |
| --- | --- | --- | --- | --- |
| 1 | Draft 1, the baseline (oracle loop Slice 2.5) | OC-1, OC-6, OC-11 x3, Micro and Lite, 18 | Reads the candidate's moves. OC-1 right; PR-1 found on both; PR-2 found on Micro | Baseline |
| 1h | Draft 1 through the harness (Slice 3) | OC-1, OC-6 x3, Micro, 6 | As batch 1; PR-3 noted | Baseline |
| 2 | L-1, draft 1 on the cases it hadn't met | 9 cases x3, Micro, 27 | Right: OC-5 3/3, OC-7 3/3, OC-20 2/3, OC-30/1 1/3. Wrong: OC-12 0/3, OC-19 0/3, OC-30/2 0/3. OC-13 gave `better` 3/3, right by the end result then written, wrong (0/3) by OC-13/1's, since no reply marks the slide. PR-4 to PR-8 found | Baseline |
| 3 | L-2, draft 2: the rule as a test of a method, and `Rules` asking its branches | OC-1, OC-6, OC-19, OC-30/2 x3, Micro, 12 | OC-6 2/3 (from 0/3), OC-19 3/3 (from 0/3), OC-30/2's rule 3/3, its end result 0/3 as expected. OC-1 slipped to 2/3. PR-9 found | Draft 2 as the base |
