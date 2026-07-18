# Object manipulation: iteration roadmap

**Status:** Standing index for a multi-iteration initiative, not a normal disposable task plan --- see [Lifecycle](#lifecycle) below. Split out 2026-07-18 from the original single planning doc (`AGENT.manipulationFrameAndRelational.planning.md`), which had grown to mix a finished deterministic vertical, an in-flight LLM-fallback build, and two not-yet-started future-iteration design threads in one file. Honestly-scoped "not built yet" stubs for later iterations were reading as failures because there was no visible boundary saying which iteration was actually active.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

Object manipulation parse (take / drop / relate) is being built as a sequence of iterations, each with its own definition of done. This doc is the index: it names the ladder, states what "done" means for each rung, and points at the plan that owns each one. A `NotYetImplemented` stub for a later iteration is expected and correct while an earlier iteration is still active --- that's the thing this doc exists to make legible.

## Iteration ladder

| # | Iteration | Definition of done | Status | Owning plan |
| --- | --- | --- | --- | --- |
| 1 | Deterministic vertical, non-tokenized parse | Membership + relational verticals compile and apply deterministically end-to-end (spans -> catalog resolve -> legality -> apply -> perception), no LLM fallback required on the golden path | **Pretty much done** --- remaining scope below | Graduated to durable docs; remaining scope tracked in this doc |
| 2 | Fallback LLMs on individual branches | All three fallback entry points (identity-only, plan-only, joint) have real implementations behind a calibrated confidence combiner, reachable from the deterministic path's failure branches | **Partially done** (steps 1-3 of 6) | [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) |
| 3 | Tokenized parse (in parallel with 2) | "Parse" (classify's `objectSpans` extraction + `frameExtract`, consolidated) emits a referent-substituted command skeleton; deterministic Plan-stage template matching can pattern-match it | **Named, not started** | [`AGENT.parseTokenization.planning.md`](AGENT.parseTokenization.planning.md) |
| 4 | Backtrack structure | A later stage (Identify/Plan/Synthesis) that can't make sense of an earlier stage's output emits a structured critique back to that stage instead of recapitulating its logic or failing silently; addressable resume points, bounded retry, and a cost/latency policy all exist | **Named, not started** | [`AGENT.backtrackChannel.planning.md`](AGENT.backtrackChannel.planning.md) |
| 5 | Individual backtrack upgrades, per branch | Each of iteration 4's addressable targets (the three BD-19 fallback entry points, Parse) gets a real backtrack-capable re-entry, one at a time, each unlocking a class of "I don't understand" errors into corrigible ones | **Not yet decomposed** | Will live in `AGENT.backtrackChannel.planning.md` once decomposed the way iteration 2 was (see its 6-step build sequence for the pattern), or split further if it grows past one plan |

**Why 3 and 2 run in parallel, not sequentially:** the fallback LLMs (iteration 2) operate on cases where deterministic parse/plan already failed --- they don't consume Parse's tokenized skeleton, so tokenizing Parse doesn't block or get blocked by finishing the fallback build.

**Why 4 doesn't strictly need 3 first:** BD-18's open sub-questions (addressable resume points, bounded retry, cost/latency) are generic to any stage, not specific to Parse. Iteration 3 gives Parse a fourth thing worth backtracking *to*; it's not a hard prerequisite for building the backtrack structure itself.

## Iteration 1, remaining

Deterministic-vertical work that's real and unbuilt, but doesn't belong in the iteration-2 doc (not LLM-fallback work) and isn't graduated (not done):

- [ ] **C2. Executor + compound kernel apply.** Compiler emits ordered plan; executor routes length-1 plans to existing single-step streams (Phase B path, shipped). Length-2+ composed plans (BD-8) need one positions ingress / compound coordinator --- kernel `transactWrite` bundling all `HostEffect[]` + `HostRelationalPatch[]` (BD-9), not sequential per-step streams with independent partial commit. On compound apply failure: Error to player, no partial fact streams. Perception: single composed outcome, not separate lines, unless product decides otherwise here.
  - **This is what the membership `cardinalityGate` (`cardinalityGate.ts`) is actually waiting on.** Today it rejects any 2+-span membership command *before* Identify runs, even though Identify already resolves N independent spans fine (confirmed while scoping iteration 2's identity-only fallback) --- the real gap is here, Plan-side composition, not Identify. When this lands, revisit whether the cardinality check should move to gate apply instead of Identify, or be removed entirely once N-object apply is real.
- [ ] **C3. Classifier / `MultipleCommands` policy.** Document when composite single-line commands compile vs. `MultipleCommands` Error. Tests: "pick up broom and go north" (likely reject); "toss pouch on floor" (compose if in scope). **The existing `cardinalityGate` is a pre-Plan-IR blanket stand-in for this policy** (reject any 2+-span command, no composition attempted) --- this is where that blanket rule gets replaced by a real compose-vs-reject decision.
- [ ] **C5. Re-examine the FT-1.3.1 legacy admissibility harness** (follow-on housekeeping, unrelated to composition). Decide whether `testing/legacyLexicalChannelGate.ts`, the `resolveLexicalChannelActive` override on `buildSpanCandidatePool`, and the legacy-vs-gate-off baseline arm in `compareAdmissibilityArms` still earn their keep, now that gate-off production (FT-1.3.1) has been live far longer than the legacy gate existed. Likely outcome if deleting: drop the frozen legacy gate module, simplify the harness to gate-off-only regression fixtures, remove the production injection hook. Keep if the identity-corpus ranking A/B is still catching unintended lexical/combine drift.
- **BD-16 (3) follow-on, explicitly deferred, not yet a scoped item:** `multiPresent`'s all-Error treatment only needs revisiting once/if a `Custom`-relation defer is ever allowed to resolve into a genuine multi-host co-location outcome --- no current work depends on it; noted here so it isn't lost.

## BD-N index

Every decision row this initiative has produced, and where it lives now. IDs are stable across the split --- a BD number never gets reused for something else.

| ID | Subject | Status |
| --- | --- | --- |
| BD-1 -- BD-13 | Phase A/B terminal shape, relation enum, frame extraction, target/host resolution, composition, multi-step atomicity, defer/Error litmus, classify intent split, `operationKind` ownership, multi-member `transferMembership` + carry | **Graduated** --- `enrich/objectManipulation/AGENT.md`, `AGENT.concepts.md`, `llm/AGENT.contract.md` |
| BD-14 | Ungrounded position planning primitive shape (`Referent`/`Change`/`Assertion`) | **Graduated** --- `AGENT.concepts.md` ("Referent language," "Change vs. Assertion"). Remaining gap (real `Assertion` emission needs a frame-extraction span) moved to iteration 3 |
| BD-15, BD-16 | Relational-patch host scope (`sameHost`), Synthesize's Expansion sub-role | **Graduated** --- `AGENT.concepts.md` ("Synthesize's three sub-roles"), `enrich/objectManipulation/AGENT.md` |
| BD-17 | Membership sandbox-wiring carry-relation rejection, interim | **Graduated + resolved** --- `enrich/objectManipulation/AGENT.md` ("Phase C sandbox"); superseded in production by the Pipeline A -> B migration |
| BD-18 | Synthesize -> Identify backtrack/correction channel, generalized to a Parse-inclusive Backtrack pattern | **Iteration 4** --- [`AGENT.backtrackChannel.planning.md`](AGENT.backtrackChannel.planning.md) |
| BD-19 | LLM joint `(identity, plan)` proposer's fallback shape + 6-step build sequence | **Iteration 2** --- [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) |
| BD-20 | Identify/Plan boundary refactor (unify around a per-span-list resolver; relocate membership's arity check) | **Graduated** --- `enrich/objectManipulation/AGENT.md` (module inventory), `AGENT.concepts.md` |
| BD-21 | Tokenized command skeleton for referent-aware Plan template matching | **Iteration 3** --- [`AGENT.parseTokenization.planning.md`](AGENT.parseTokenization.planning.md) |

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Identify which iteration your task belongs to using the ladder above, then open that iteration's owning plan --- this doc is the index, not where the work is tracked.
3. If you're not sure which iteration a change belongs to, check the BD-N index above for the closest-matching existing decision before starting new design work.
4. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md).

## Verification

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/ \
  dataSource/actions/parseCommand.test.ts \
  dataSource/positions/manipulation/
```

Each child plan repeats this baseline plus its own iteration-specific commands in its own Verification section.

## Lifecycle

This doc is **not** disposed when any single iteration finishes --- it's the standing index for as long as more than one iteration is either active or not-yet-started. Dispose (or fold into a durable `AGENT.md`) only once the whole ladder reaches steady-state and there's no longer a "which iteration are we on" question worth answering.
