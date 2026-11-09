# Oracle drafts: the comparative oracle's prompt, drafted on the harness

**Status (2026-11-09): opened from the oracle loop plan's Slice 4.** An implementation plan with one Prototype in it: the oracle's prompt, drafted one change at a time on the `OracleProbe`. Draft 1 is the baseline, already run (Slice 2.5 and Slice 3 of the parent). **Next: the drafting loop's first pull,** from [`oracleLoopDrafts/iterations.md`](oracleLoopDrafts/iterations.md).

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md), as an implementation plan. Its parent is the [oracle loop plan](AGENT.oracleLoop.planning.md), an orchestration plan piloting the [proposed design variant](../../../../AGENT.designVariant.proposed.md). The parent holds the subsystem map, the guesses, the design rows, the seam ledger, and the drafts themselves, since later episodes of oracle tuning (after work on the engine) start from them. This plan holds one episode of drafting: its order and its state. What a draft shows about a guess or a design row goes **up** to the parent, as a seam-ledger entry or as evidence on the row. It does not stay here.

## Getting Started

1. Read the parent's [Status](AGENT.oracleLoop.planning.md), its [subsystem map and seam ledger](AGENT.oracleLoop.planning.md#subsystem-map) and its [design vocabulary](AGENT.oracleLoop.planning.md#the-design). The oracle and the engine are **imagined**, and the ledger's newest entries are where this plan starts.
2. Read [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro) and the [Oracle probe](../../../../../lambda/ephemera/calibration/AGENT.md#oracle-probe): the event, `framing`, `show`, and the form-only check.
3. Read [`oracleLoopDrafts/iterations.md`](oracleLoopDrafts/iterations.md), the problems, library and ledger, then the latest draft and its notes (draft 1: [`1.txt`](oracleLoopDrafts/1.txt), [notes](oracleLoopDrafts/1.notes.md)).
4. Read the corpus's [How a case is written](AGENT.oracleLoop.corpus.planning.md#how-a-case-is-written). A case tests its end result. The intermediate steps are guesses a draft may revise, and an end result that is mine is revised only by the user. The cases in the harness are listed in [`oracleCases.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/oracleCases.ts).
5. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md); if commands conflict, follow it. A draft needs no test commands. A change to the harness does: from `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null`, last 4512 passed, 9 skipped, and `npx tsc --noEmit </dev/null`, no output.

## What is inherited as settled

The parent's [inherited premises](AGENT.oracleLoop.planning.md#what-is-inherited-as-settled) hold here, with their standings. Of the parent's guesses, this plan rests on these:

| Guess | Standing (parent) | What a draft can show |
| --- | --- | --- |
| Candidate to oracle: steps rendered after `End of scene.` | Observed for move lines (Micro and Lite, Slice 2.5; Micro through the harness, Slice 3). A guess for reuses and improvisations | Whether a draft reads `Reuses:` and `Improvises:` lines (OC-7, OC-30) |
| Scene render to oracle: v45's render | Observed for v45; a guess for the oracle | A draft misreading the render where the inputs are clear |
| Module boundaries (JP-8): the four reusable modules, word for word | Guess | A change inside a module that a draft needs |
| Slice 2's output sketch, `OracleRoundOutput` | Guess, never read by a consumer | What the settled verdict and direction lines turn out to carry |

**Future subsystems that touch this work:** the improvisation engine and the loop, both imagined on the parent's map. A direction line has no consumer until the parent's Slice 5, where a person plays the engine by hand. Until then, nothing a direction line lacks is a gap for this plan to fill; it is forward demand.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

1. [X] **Draft 1, the baseline.** A fresh `Role` and `Task` around v45's four modules (mine). Run in the parent's Slice 2.5 (18 calls, Micro and Lite) and again through the harness in its Slice 3 (6 calls, Micro). It reads a candidate's moves. Its end results: OC-1 right; OC-6 a false `better` on both models; OC-11 a false `better` on Micro only ([notes](oracleLoopDrafts/1.notes.md))
2. [ ] **The drafting loop, graded by reading, until the verdict and direction lines settle.** A Prototype, looping over [`oracleLoopDrafts/iterations.md`](oracleLoopDrafts/iterations.md): its problems, its library of changes to try, and its one-line ledger. **Each pass:** pull one library entry, by what it could most change and how cheaply (a probe that finds unknown problems before tuning the known ones), write the draft or the batch, read it against the problems' "solved when", log one ledger line, and add whatever problems or ideas it turned up. **Exits** (user's three, the fourth mine):
   - (a) the library is empty of entries worth a draft;
   - (b) the problems are solved, and the verdict and direction lines are stable across the cases, so step 3 can parse them;
   - (c) a batch shows that something needs a new approach, such as a guess on the parent's map failing: a seam-ledger entry in the parent, and the episode stops there;
   - (d) a checkpoint with the user every three batches, which stops nothing by itself: carry on, take (a) or (c), or change what is pulled next.

   **Rests on** the guesses above. **Consumer:** the model, on the harness, read reply by reply against each case's end result. **Revision triggers,** tested as written:
   - A draft has to say something about its inputs that the harness's slots can't hold, and goes back to `JudgeProbe` with `sceneText` to say it. That revises the input types (the parent's Slice 3 trigger, carried here). Not true now.
   - A settled reply carries something `OracleRoundOutput` has no field for, or leaves a field it has unused in every case. That revises the output sketch. Not true now: draft 1's `Improve` is one improvement request, which the sketch holds, though with no destination.

   **Cases:** OC-1 as a guard first, then OC-6 and OC-30 (pour), OC-11 (size), OC-7 (wipe), OC-5 (teapot), OC-12 and OC-13 (the dungeon and the doll-house), with OC-19 and OC-20 in the harness as well. A case not in the harness is written into it by the draft that first asks it.
   - [ ] The loop, seeded 2026-11-09 with PR-1 to PR-3 and L-1 to L-6
3. [ ] **A comparative grading mode over the settled lines.** Harness code, a Prototype: code reads the verdict and direction lines that the drafts settled on, so a batch can be tallied before it is read. It waits on step 2, since the lines are what it parses.
4. [ ] **Hand back to the parent.** Each finding as a seam-ledger entry. Evidence for the design rows (JF-5, JF-7, JF-11, JF-13, JF-16, JF-17, and JF-6's stretch) noted on each row. The guesses a consumer now reads, listed for the map. The parent's Slice 4 row checked.

## Open decisions (implementation --- plan only)

None yet. The design questions stay in the parent's [Open decisions](AGENT.oracleLoop.planning.md#open-decisions-design--plan-only). A draft's evidence on one is reported there, not settled here.

## How we work

- Drafts are written, numbered and probed by the parent's [rules for drafts](AGENT.oracleLoop.planning.md#how-we-work): files in the parent's [`oracleLoopDrafts/`](oracleLoopDrafts/), numbered on from the last draft of any episode, each with a `.notes.md`, probed through `OracleProbe` with payloads I write. The user runs each batch and pastes the result. Keep batches small: the smallest call count that answers the question, at most 12 per invoke.
- Each change is attributed. Anything not from the user is labelled "mine" until accepted.
- A batch that shows something about a guess writes a seam-ledger entry in the parent.

## Verification

- A draft: the probe, read reply by reply against each case's end result. No test commands.
- A harness change: from `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`. The built judge is unchanged: a flag-off `JudgeProbe` still reports instructions hash `22e97265`.
- Links: every relative link and anchor in this plan and the parent resolves.

## Progress

| Step | State |
| --- | --- |
| Draft 1 | Done 2026-11-09: the baseline, run twice |
| The drafting loop | Running: L-1 and L-2 (draft 2) pulled, batch 3 is checkpoint (d); nine problems, fourteen library entries |
| Comparative grading | Not started |
| Hand back | Not started |

## When it finishes

What the drafts showed about writing for Micro goes to [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro). The settled draft is where the parent's later slices start. Then the parent's Slice 4 row is checked and this plan is deleted. The drafts stay with the parent, where the next episode of oracle tuning starts from the last one.
