# Composition probe: the first harness

**Status (2026-11-23): written, then cut down the same day to the harness alone (the user); nothing built yet; step 0, the design pass, done; step 1, the loop with no LLM, next.** A sub-plan of the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5, opened by the user once `playByPlay` gave a working generator. An implementation plan over Prototypes: it builds the first harness that runs several chained LLM calls, and runs it once on two pieces as they are. When it is done, the [trial question plan](AGENT.trialQuestion.planning.md) resumes (the user).

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md), under the parent's pilot of [`AGENT.designVariant.proposed.md`](../../../../AGENT.designVariant.proposed.md): what it shows about a guess goes up to the parent's [seam ledger](AGENT.oracleLoop.planning.md#seam-ledger).

## The idea

**The shape (the user, 2026-11-23):** a probe that takes a starting input and runs several chained LLM prompts. It starts somewhere, takes what orchestration gives as the next step, goes there, and repeats until completion or a cut-off.

**The boundary (the user, 2026-11-23):** this plan doesn't work in the pieces' internals. Mine, from that: the probe is like the piece probe. It runs what pieces register with it, and never changes what a piece is asked, shows or accepts. A form fault ends the chain, and whatever a chain shows about a piece goes to that piece's own plan.

**The loop (mine, from the user's shape).** The probe holds a **state**: the action plan, the request being answered, and a log. It repeats:
1. **Choose:** `next(state)`, a pure function, gives a call (the piece and its request) or a reason to stop. The choice is the LLM's wherever its response makes one (a judge's request); `next` turns it into a call ([`next`'s rules](#nexts-rules)).
2. **Call:** the piece builds its inputs from the state and the request, renders through its own view, and makes one fresh call.
3. **Apply:** the piece's contract reads the reply, and the state takes the result.

It returns the trace, hop by hop.

**The seam (mine): what a piece provides to take part in a chain.** These live with the piece, as its view does:
- how its inputs are built from the state and a request;
- its contract;
- what its result does to the state.

**One run is a chain; what is possible isn't** (the user, 2026-11-23): it is more like a state machine. Mine, from that: a piece declares which requests it answers, and never what comes after it, so succession is `next`'s alone; and nothing in the state or the registration assumes a fixed order, or that a piece runs once (the judge runs three times in the first chain). The field isn't named for a chain.

A piece that joins later brings its own chains as tests, as it brings its cells now, and the probe needn't know what they are for.

**Mocks stand in for pieces that don't exist (the user, 2026-11-23), contract first:** designing a missing piece's contract is the first step to testing it. That contract is designed in the piece's own plan, and the probe mocks it once it exists. Mine, under that:
- **The result is mocked, not the reply.** The reply's form is settled by what Micro can write, so it waits for the piece's first drafts.
- **A mocked result is applied as a real one is,** through the piece's contract and merge.
- **A mock matches on the request and the state,** never on the hop number, since live chains vary.
- **A mock finds its step in the state,** such as the plan's first step. It can't name one by a path written ahead: a step restated in new words takes a path minted afresh, and a sub-step's path is made from what the live call wrote.
- **No match stops the run,** naming what was asked for.
- **A mocked hop is marked in the trace.** It says nothing about whether Micro could do it.

**What this is for.** What is proved so far is each generator alone, on plans built by hand. No piece has run on a plan another piece wrote, and no judging piece reads a plan. The trial question plan's pieces are to read and write it, and this harness is where they are tried together.

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) once, for durability and the content split.
2. Read the parent's [composition probe item](AGENT.oracleLoop.planning.md#recommended-order) and [the oracle as stages](AGENT.oracleLoop.planning.md#the-oracle-as-stages); then the trail's [An oracle piece answers with a verdict or a request](AGENT.oracleLoop.discussion.planning.md#an-oracle-piece-answers-with-a-verdict-or-a-request-2026-11-12), the direction this harness runs toward.
3. Read NR-3 in the non-rule cell plan's [Open decisions](AGENT.nonRuleCell.planning.md#open-decisions-implementation--plan-only): the request kinds the mocked judge uses.
4. Read calibration's [The action plan](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan), [Piece views](../../../../../lambda/ephemera/calibration/AGENT.md#piece-views), and [Piece probe](../../../../../lambda/ephemera/calibration/AGENT.md#piece-probe) with [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece).
5. The code, under [`lambda/ephemera/`](../../../../../lambda/ephemera/):
   - [`llm/stageContract.ts`](../../../../../lambda/ephemera/llm/stageContract.ts): a stage's typed parse, which each hop's result comes through;
   - [`calibration/oracleLoop/actionPlan.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/actionPlan.ts): the plan and `mergeStepChanges`;
   - [`calibration/imaginationPieces/`](../../../../../lambda/ephemera/calibration/imaginationPieces/): `playByPlayContract`, `consequencesContract`, and each piece's inputs;
   - [`calibration/pieceProbe/oraclePiece.ts`](../../../../../lambda/ephemera/calibration/pieceProbe/oraclePiece.ts) (a piece's registration), [`handlePieceProbe.ts`](../../../../../lambda/ephemera/calibration/pieceProbe/handlePieceProbe.ts), [`stageInput.ts`](../../../../../lambda/ephemera/calibration/pieceProbe/stageInput.ts) (golden and lifted values, the mocks' nearest precedent) and [`oracleLoop/runOracleProbe.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/runOracleProbe.ts) (`runProbeCalls`, with its injectable `invoke`).
6. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md); if commands conflict, follow it. From `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null` pass before any edit.

## What is known going in

| What | Standing | What it means here |
| --- | --- | --- |
| Loops, filters and joins are code's, one judgment per call (user, 2026-11-10) | Direction (user's call) | `next` is code, turning a response into a call |
| Every call is fresh (the trail, 2026-11-12) | Direction, agreed | A hop is a function of the state, not of an earlier call's reasoning |
| The first request kinds (NR-3; user, 2026-11-13): more detail of an action, or of its consequences, each with the step and what is missing | Settled | The mocked judge needs no new vocabulary |
| `playByPlay` draft 34a (`b9c18e42`): form 30 of 36. Every form failure is OC-1, 6 of 6 | Observed (batches 61, 61b) | An OC-1 chain ends at its first live hop |
| `consequences` draft 5: form 10 of 12, on plans with no sub-steps and no unchecked items | Observed (its batch 6) | It has never read an expanded plan: this is the first chain's question |
| The only case both pieces have a cell for is OC-1 | Read from the code | Any other case's chain needs inputs that no batch has run (CH-13) |
| `consequences` takes the target and a hand-listed `things`, and has no `missing` | Read from the code | Half of NR-3's second request has nowhere to go (CH-13). `playByPlay`'s `alsoShown` is hand-listed too |

## The first chain

Mine, in discussion (2026-11-23); it needs no new contract from any piece.

| Hop | Who | What |
| --- | --- | --- |
| 1 | Judge, mocked | Needs detail of the action: "how [teapot1] is held and moved" |
| 2 | `playByPlay`, live | Expands the step, or restates it |
| 3 | Judge, mocked | Needs detail of the consequences |
| 4 | `consequences`, live | Adds them |
| 5 | Judge, mocked | A verdict, and the chain stops |

**What it tests between live pieces:** whether `consequences` can read a plan that `playByPlay` really wrote. **What it doesn't test:** any judgment. Its verdict is a mock's.

## `next`'s rules

Agreed by the user (2026-11-23): what `next` does with the last response.

| Situation | What `next` does |
| --- | --- |
| The start of a chain: no response yet | Calls the judge |
| A judge made a request | Calls the piece that answers that kind of request |
| A generator answered (its result is a change to the plan, with no request in it) | Goes back to the judge, as a fresh call |
| A judge gave a verdict | Stops |
| A reply failed its form check | Stops |
| The request has no piece or mock to answer it | Stops, naming what was asked for |
| The cap is reached | Stops |

With one judge, the first and third rows are nearly forced. With several they aren't: after the plan changes, which judge goes next, and whether an earlier verdict still stands. This harness doesn't need that yet; the trial question plan's chains will raise it.

## The trace

Agreed by the user (2026-11-23). A hop's log is the piece probe's record of a call (the reply, and its form problems or its error), plus:

| Added | Why |
| --- | --- |
| The piece, the request it was given, and whether it was mocked | These take the place of the cell's id |
| The rendered text, and its hash | A cell's inputs are in the code, so a batch returns only their hash; a hop's are made during the run. The hash spots repeats given identical inputs |
| The plan after the hop, as data | The next hop's input, and what is lifted into a piece cell later. It isn't left to a replay of the replies, which would differ once a contract changes |

The run as a whole adds its starting case and its stop reason.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

0. [X] **The design pass, with the user** (text only, before any code). It settles the [open decisions](#open-decisions-implementation--plan-only) the build needs:
   - [X] **The state, [`next`'s rules](#nexts-rules) and the stop reasons** (CH-2; settled 2026-11-23). The table's walk is [the first chain](#the-first-chain)'s table; step 1's scripted chains test it.
   - [X] **The seam** (CH-11; settled 2026-11-23): where a piece's part is declared. Its type is written with step 1's build.
   - [X] **The judge's answer** as the state holds it, and its mock (CH-12; settled 2026-11-23).
   - [X] **The inputs a request doesn't give, and the cases** (CH-13; settled 2026-11-23).
   - [X] **What a hop's log holds,** so a miss is traced to its piece, its inputs or `next` ([the trace](#the-trace); settled 2026-11-23).
1. [ ] **The loop, with no LLM,** in code with tests, each part checked off as it lands. A new folder, `calibration/compositionProbe/`.
   - [ ] the state, and `next` with its rules, tested on hand-built states;
   - [ ] the seam, with `playByPlay`'s and `consequences`' parts declared;
   - [ ] the mocks: matching, finding the step, and the stop on no match;
   - [ ] the loop, with every call scripted from kept replies: a chain that ends in each stop reason, the cap included;
   - [ ] the trace.
2. [ ] **The probe:** a `CompositionProbe` event beside `PieceProbe`, taking cases, repeats, each piece's instructions and the mocks; its payload built by an npm script, as `assemble-draft` is; its call cap counted over whole chains. **Check first:** a chain's calls run one after another, each allowed 15 seconds (`PROBE_TIMEOUT_MS`), so the cap has to fit the deployed Lambda's own timeout, which isn't checked yet.
   - [ ] the pieces' renders and pinned hashes unchanged.
3. [ ] **The first run:** the first chain, the two pieces live and untuned, a few chains each on CH-13's cases. A rubric written before the run, reviewed by the user, with my bounds listed apart.
   - [ ] **The rubric reads per hop:** was the choice right; was the input what that piece should get; was the answer right given its input; and where the chain first goes wrong.
   - [ ] **The payload,** named by its full path. The user deploys and runs it.
   - [ ] **The read,** with the user. Any result is useful, every chain dying at its first live hop included.
4. [ ] **Hand back** ([When it finishes](#when-it-finishes)).

**Not in this plan:**
- drafting or tuning any prompt, or changing any piece's contract;
- the rule cell, and whether it is still needed: the trial question plan's [step 2.5](AGENT.trialQuestion.planning.md#recommended-order);
- the alternate method's contract and the mitigation's: the imagination plan's [step 4](AGENT.imagination.planning.md#recommended-order);
- writing a verdict into the plan;
- the method of tuning several prompts together (a [pilot finding](AGENT.oracleLoop.planning.md#pilot-findings)).

## Open decisions (implementation --- plan only)

Decisions made in order to build the harness. The leanings were mine; the user has agreed to each row below as written. CH-3 to CH-9 of the first draft left the plan with the cut (CH-3's wording is now the mock's), and the numbers aren't used again. CH-1 (is `next` pure code, or may an LLM choose?) is closed as not a decision (the user, 2026-11-23): an LLM's response is what `next` interprets in either case. A call whose whole job was routing would be one more piece whose response `next` interprets.

| ID | Question | Blocks | Settled by | Status |
| --- | --- | --- | --- | --- |
| CH-2 | The stop reasons, and the cap (IM-3). Mine: a verdict; a piece asked for that isn't supplied; a form fault; the cap. The cap's value waits on step 2's timeout check | Step 1 | The user | **Settled** (the user, 2026-11-23), the cap's value aside |
| CH-10 | Do the parent's Slices 5 and 6 fold in? Mine: Slice 5 (the loop by hand) does; Slice 6 keeps its tool-call check | None here | The user | **Settled** (the user, 2026-11-23) |
| CH-11 | Where a piece's part in a chain is declared. Mine: an optional field on its registration, beside `view`, so a piece with none can't be called in a chain; and the contract named there, since today a read piece registers only its `check` | Step 1 | The user | **Settled** (the user, 2026-11-23), remembering that the graph of possible runs isn't a chain but something like a state machine ([the seam](#the-idea)) |
| CH-12 | What the mocked judge answers. Mine: a typed value, either a verdict or one NR-3 request (the kind, the step's path, `missing`). It is the probe's stand-in, not a design of any judge's answer: the trial question plan's judges settle their own, and the type follows them | Step 1 | The user | **Settled** (the user, 2026-11-23) |
| CH-13 | What a request doesn't give: `consequences`' `things`, `playByPlay`'s `alsoShown`, and which cases run. Mine: the case carries both lists by hand, as the cells do, and the trace logs the unread `missing` as a finding for the imagination plan; the target is the step the judge names, unexpanded or not. Cases: OC-6 and OC-20, with their `playByPlay` inputs as the cells have them, and OC-1 left out | Step 1's scripted chains; step 3 | The user | **Settled** (the user, 2026-11-23) |

## How we work

- The design pass comes first, as text, and the user reviews it before any code.
- Each part is checked off as it lands, with tests and tsc clean.
- No prompt is changed. A draft is run as it was kept: `playByPlay` 34a, `consequences` 5.
- A rubric is written before the run. Payloads are named by full path; the user deploys and runs them, and commits.
- A lead or an idea of mine stays marked mine until the user takes it.

## Verification

From `lambda/ephemera/`: `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`, both clean, with every render pin unchanged. The first run: the trace, read hop by hop against its rubric.

## Progress

| Step | State |
| --- | --- |
| The design pass | **Done** (2026-11-23, the user): CH-2 and CH-10 to CH-13, `next`'s rules and the trace settled; the cap's value waits on step 2's timeout check |
| The loop, with no LLM | Not started |
| The probe | Not started |
| The first run | Not started |
| Hand back | Not started |

## When it finishes

- **The harness's rules** go into calibration's [`AGENT.md`](../../../../../lambda/ephemera/calibration/AGENT.md), beside Piece probe: the seam, the mocks and the trace.
- **Seam-ledger entries** in the parent for what each chain showed, and the subsystem map's loop row.
- **What the chains showed about a piece** goes to its plan: `playByPlay` and `consequences` to the [imagination plan](AGENT.imagination.planning.md), with IM-3 answered as far as the run answers it.
- **The [trial question plan](AGENT.trialQuestion.planning.md) resumes,** and the [non-rule cell plan](AGENT.nonRuleCell.planning.md)'s step 5 is told what it plugs into.
- **A sweep for inbound links and `CH-n` markers,** then this plan is deleted.
