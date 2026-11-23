# Composition probe: the first harness

**Status (2026-11-23): written, nothing built; step 0, the design pass, next.** A sub-plan of the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5, opened by the user once `playByPlay` gave a working generator. An implementation plan over Prototypes: it builds the first harness that runs several chained LLM calls, and runs it once on the pieces as they are.

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md), under the parent's pilot of [`AGENT.designVariant.proposed.md`](../../../../AGENT.designVariant.proposed.md): what it shows about a guess goes up to the parent's [seam ledger](AGENT.oracleLoop.planning.md#seam-ledger).

## The idea

**The shape (the user, 2026-11-23):** a probe that takes a starting input and runs several chained LLM prompts. It starts somewhere, takes what orchestration gives as the next step, goes there, and repeats until completion or a cut-off.

**The loop (mine, from that shape).** The probe holds a **state**: the action plan, the verdicts so far, the methods tried, and a log. It repeats:
1. **Choose:** `next(state)`, a pure function, gives a call (the piece, its target, what it is asked) or a reason to stop.
2. **Call:** the piece renders through its own view, and makes one fresh call.
3. **Apply:** the piece's contract reads the reply, and the state takes the result.

It returns the trace, hop by hop.

**Mocks stand in for pieces that don't exist (the user, 2026-11-23), contract first:** designing a missing piece's change-language contract is the first step to testing it. So a missing piece is built in this order: its contract; a mock that answers through it and is merged as a real reply would be; a chain run through it; and later, in another plan, its prompt.

Mine, under that:
- **The change is designed and mocked, not the reply.** `playByPlay` has two layers: the reply the model writes, and the change code makes of it (`replyChanges`). The reply's form is settled by what Micro can write, so it waits for the piece's first drafts.
- **A mock matches on the request** (the case, the piece asked for, what it was asked), never on the hop number, since live chains vary.
- **No match stops the run,** naming what was asked for.
- **A mocked hop is marked in the trace.** It says nothing about whether Micro could do it, and an end result reached through one is only as good as the mock.

**What this is for.** `playByPlay` writes unchecked consequences and rule claims, and no piece checks them. Standing, staleness and the checker's mirror all assume a checker. No judging piece reads a generated plan, so how one should is unknown (IM-5). What is proved so far is generation, not the exchange between generating and judging.

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) once, for durability and the content split.
2. Read the parent's [composition probe item](AGENT.oracleLoop.planning.md#recommended-order), [the oracle as stages](AGENT.oracleLoop.planning.md#the-oracle-as-stages) and the [subsystem map](AGENT.oracleLoop.planning.md#subsystem-map); then the trail's [An oracle piece answers with a verdict or a request](AGENT.oracleLoop.discussion.planning.md#an-oracle-piece-answers-with-a-verdict-or-a-request-2026-11-12), the direction this harness runs toward.
3. Read OC-1, OC-6, OC-20 and OC-30 (its **As hops** list) in the [corpus](AGENT.oracleLoop.corpus.planning.md).
4. Read calibration's [The action plan](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan), [Piece views](../../../../../lambda/ephemera/calibration/AGENT.md#piece-views), [Piece probe](../../../../../lambda/ephemera/calibration/AGENT.md#piece-probe) with [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece), and [Scene renders](../../../../../lambda/ephemera/calibration/AGENT.md#scene-renders).
5. The code, under [`lambda/ephemera/`](../../../../../lambda/ephemera/):
   - [`llm/stageContract.ts`](../../../../../lambda/ephemera/llm/stageContract.ts): a stage's typed parse, which each hop's result comes through;
   - [`calibration/oracleLoop/actionPlan.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/actionPlan.ts): the plan, `AUTHORITY`, the change language and `mergeStepChanges`;
   - [`calibration/imaginationPieces/`](../../../../../lambda/ephemera/calibration/imaginationPieces/): `playByPlayContract`, `consequencesContract`, and each piece's inputs;
   - [`calibration/oraclePieces/ruleCell.ts`](../../../../../lambda/ephemera/calibration/oraclePieces/ruleCell.ts): its inputs are hand-written motions for a rule's two ends;
   - [`calibration/pieceProbe/handlePieceProbe.ts`](../../../../../lambda/ephemera/calibration/pieceProbe/handlePieceProbe.ts), [`pieceProbe/stageInput.ts`](../../../../../lambda/ephemera/calibration/pieceProbe/stageInput.ts) (golden and lifted values, the mocks' nearest precedent) and [`oracleLoop/runOracleProbe.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/runOracleProbe.ts) (`runProbeCalls`, with its injectable `invoke`).
6. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md); if commands conflict, follow it. From `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null` pass before any edit.

## What is known going in

| What | Standing | What it means here |
| --- | --- | --- |
| Loops, filters and joins are code's, one judgment per call (user, 2026-11-10) | Direction (user's call) | `next` is code, unless CH-1 says otherwise |
| Every call is fresh (the trail, 2026-11-12) | Direction, agreed | A hop is a function of the state, not of an earlier call's reasoning |
| `playByPlay` draft 34a (`b9c18e42`): form 30 of 36. Every form failure is OC-1, 6 of 6, on invented rule handles | Observed (batches 61, 61b) | Untouched, OC-1's chain ends at its first hop (CH-5) |
| `consequences` draft 5: form 10 of 12 | Observed (its batch 6) | Expect faults there too |
| The rule cell, draft 3: 46 of 48 on hand-written motions | Observed | Not yet run on generated ones |
| `consequences`' view states a securing as "cannot be moved apart until they are freed" | Read from the code | **A predicted failure:** on OC-6, asked what the teapot does, it may write that the teapot stays. The rule cell then answers `allows`, rightly for its inputs and wrongly for the case, as its cell `OC-6/stays` does |
| Only `nonRuleCell` can answer with a request, and it has no passing exit | Observed (its batches 1 to 5) | The first form has no piece that asks for detail. Every choice is code's, from gaps and verdicts in the state |
| No non-rule judge is in the chain | By scope | **A run in which no rule blocks is not an approval.** OC-6's tipped table passes the rule cell while the cup slides off. The stop is named for what it shows |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

0. [ ] **The design pass, with the user** (text only, before any code). It settles the [open decisions](#open-decisions-implementation--plan-only) the build needs:
   - [ ] **The state, `next`'s rules and the stop reasons** (CH-1, CH-2), written out as a table of what `next` sees and what it chooses, and walked by hand over OC-1, OC-6 and OC-20.
   - [ ] **What `playByPlay` is asked,** and who words it (CH-3).
   - [ ] **The adapter:** where the rule cell's actions and motions come from (CH-4, IM-5).
   - [ ] **Form faults** (CH-5).
   - [ ] **The alternate method's change contract** (CH-6), with the mitigation sketched beside it and not built.
   - [ ] **What a hop's log holds,** so a miss is traced to its piece, its inputs, the adapter or `next`.
1. [ ] **The loop, with no LLM,** in code with tests, each part checked off as it lands. A new folder, `calibration/compositionProbe/`.
   - [ ] the state, and `next` with its rules, tested on hand-built states;
   - [ ] the adapter from a plan to the rule cell's inputs, tested on plans built by hand and on replies kept from earlier batches;
   - [ ] the loop, with every call scripted: a chain that ends in each stop reason, the cap included;
   - [ ] the trace.
2. [ ] **The alternate method's contract and its mock:**
   - [ ] the change, its checks and its merge, in `actionPlan.ts`, every existing merge test unchanged;
   - [ ] the mock: OC-6's alternate ("tip [table1] ..."), matched on its request, through the merge;
   - [ ] a scripted chain through it: OC-6 blocked, the method swapped, the rule cell asked again.
3. [ ] **The probe:** a `CompositionProbe` event beside `PieceProbe`, taking cases, repeats, each piece's instructions and which hops may be mocked; its payload built by an npm script, as `assemble-draft` is; its call cap counted over whole chains. **Check first:** a chain's calls run one after another, each allowed 15 seconds (`PROBE_TIMEOUT_MS`), so the cap has to fit the deployed Lambda's own timeout, which isn't checked yet.
   - [ ] the pieces' renders and pinned hashes unchanged.
4. [ ] **The first run:** OC-1, OC-6 and OC-20, the pieces live and untuned, a few chains each. A rubric written before the run, reviewed by the user, with my bounds listed apart.
   - [ ] **The rubric reads per hop:** was the choice right; was the input what that piece should get; was the answer right given its input; and where the chain first goes wrong.
   - [ ] **Expected ends** (mine, for review): OC-1, no rule blocks; OC-20, the chain blocks, then an alternate method is asked for and none is supplied; OC-6, the glue blocks, the mocked method is taken, and then no rule blocks.
   - [ ] **The payload,** named by its full path. The user deploys and runs it.
   - [ ] **The read,** with the user. Any result is useful, every chain dying at its second hop included.
5. [ ] **Hand back** ([When it finishes](#when-it-finishes)). What comes next is the user's choice, on what the run shows.

**Not in this plan:** drafting or tuning any prompt; the alternate method as a piece; the mitigation; the non-rule cell in the chain; the rest of OC-30's chain; writing a verdict into the plan; the method of tuning several prompts together (a [pilot finding](AGENT.oracleLoop.planning.md#pilot-findings)).

## An imagined run

OC-6, "pour [tea2] from [teapot1] into [cup1]". Imagined (mine), to be replaced by a real trace. The second hop differs from the sketch in discussion, which asked `consequences` about both ends: under CH-4's leaning it is asked only about the end the method doesn't name.

| Hop | What `next` sees | Call | Result |
| --- | --- | --- | --- |
| 1 | A step with no method | `playByPlay` | Grip, lift, tilt |
| 2 | The glue bears on the plan's things, and [table1] has no motion | `consequences`, on [table1] | It stays |
| 3 | The rule's inputs are complete | Rule cell | `blocks` |
| 4 | A rule blocks our own method | Alternate method, mocked | Sub-steps swapped; the old method joins the tried list |
| 5 | The new method's [teapot1] has no motion | `consequences`, on [teapot1] | It tips with the table |
| 6 | The rule's inputs are complete | Rule cell | `allows` |
| 7 | Every rule asked about, none blocks | Stop: **no rule blocks** | Not an approval: the cup has slid off, and nothing in the chain asks about it |

## Open decisions (implementation --- plan only)

Decisions made in order to build the harness. The leanings are mine, and none is settled until the user says so.

| ID | Question | Blocks | Settled by | Status |
| --- | --- | --- | --- | --- |
| CH-1 | Is `next` pure code, or may an LLM choose? Mine: pure code, by the user's loops-in-code rule, and testable with no LLM. A judge's request, once a judge can ask, becomes one more thing `next` reads | Step 1 | The user | Open; leaning code |
| CH-2 | The stop reasons, and the cap (IM-3). Mine: no rule blocks; a piece asked for that isn't supplied; a form fault; the cap. The cap's value waits on step 3's timeout check | Step 1 | The user | Open |
| CH-3 | Who words `playByPlay`'s `missing`. It is a detail of the method (the user, 2026-11-19), and OC-1b shows how much its wording moves. In discussion I leaned to a code template from the start. Mine now: the first run takes each case's opening request as its cell has it ("how [table1] is held and lifted"), so the run tests the chaining and not a new wording; a template is the next form's | Step 1 | The user | Open |
| CH-4 | The adapter (IM-5): where the rule cell's actions and the two ends' motions come from. Mine: each sub-step is an action; an end a sub-step names takes its motion from that sub-step; an end the method doesn't name is `consequences`' to describe, and code never assumes it stays (OC-1's teapot would be left behind, a false `blocks`). To weigh: a sub-step is what the actor does ("lift [teapot1] off [table1]"), where the cell's motions are what the thing does; and `consequences` may be asked about the parent step or each sub-step | Step 1 | The user; the run | Open |
| CH-5 | An invented rule handle: today it refuses the whole reply. Mine: in this probe only, drop the invented rule entry and log it, with the piece probe's contract unchanged. Any other fault ends the chain | Step 1 | The user | Open; leaning drop |
| CH-6 | The alternate method's change contract. Mine, as a start: it swaps a step's sub-steps, keeping the step and its intent; the old sub-steps and their items leave the plan; the rejected method and its reason join the loop's tried list; verdicts on the old method stop counting. **Open within it:** who has authority (a sub-step is confirmed only from `playByPlay`: share that authority, or start unchecked with something to check them); whether one sub-step is enough, where an expansion needs two; how the swap meets "expanded at most once" and "an expanded step isn't revised" | Step 2 | The user | Open |
| CH-7 | The mitigation, sketched only: a sub-step inserted before another ("pick up [saucer1]", before the tip). It should call into question what follows it, which would carry the stale mark to later siblings as well as children. Perhaps one family with CH-6: edits to a step's ordered sub-steps | None here | Its own build | Sketch |
| CH-8 | Which rules `next` asks about. Mine: every rule with an end among the plan's handles, by code; `playByPlay`'s own rule claims are logged beside the verdicts, as evidence on the booked stance check, and don't choose | Step 1 | The user | Open |
| CH-9 | Where a verdict lives. Mine: in the loop's state, beside the plan. Writing it in (the rule cell's `replace`) is a later form's | Step 1 | The user | Open; leaning beside |
| CH-10 | Do the parent's Slices 5 and 6 fold in? Mine: Slice 5 (the loop by hand) does; Slice 6 keeps its tool-call check | None here | The user | Open |

## How we work

- The design pass comes first, as text, and the user reviews it before any code.
- Each part is checked off as it lands, with tests and tsc clean.
- No prompt is changed. A draft is run as it was kept: `playByPlay` 34a, `consequences` 5, the rule cell 3.
- A rubric is written before the run. Payloads are named by full path; the user deploys and runs them, and commits.
- A lead or an idea of mine stays marked mine until the user takes it.

## Verification

From `lambda/ephemera/`: `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`, both clean, with every render pin unchanged. The first run: the trace, read hop by hop against its rubric.

## Progress

| Step | State |
| --- | --- |
| The design pass | Not started |
| The loop, with no LLM | Not started |
| The alternate method's contract and its mock | Not started |
| The probe | Not started |
| The first run | Not started |
| Hand back | Not started |

## When it finishes

- **The harness's rules** go into calibration's [`AGENT.md`](../../../../../lambda/ephemera/calibration/AGENT.md), beside Piece probe; the alternate method's change into The action plan.
- **Seam-ledger entries** in the parent for what each chain showed, and the subsystem map's loop row.
- **IM-3 and IM-5** answered on the [imagination plan](AGENT.imagination.planning.md), as far as the run answers them; the [non-rule cell plan](AGENT.nonRuleCell.planning.md)'s step 5 told what it plugs into.
- **A sweep for inbound links and `CH-n` markers,** then this plan is deleted.
