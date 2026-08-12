# Attention history: what `ludicCache` remembers, and for how long

**Status: in progress --- Phase 0 (corpus) opened 2026-08-12, no cases worked yet. Next step: work [A1--A9](AGENT.attentionHistory.corpus.planning.md) and let them decide the retention question, not the other way round.**

**Sub-plan of [`AGENT.abstractionLayers.planning.md`](AGENT.abstractionLayers.planning.md)**, split out 2026-08-12. It owns the **semantics of attention** --- what a surfacing event records, what keeps a referent live, and what lets it go. The parent keeps `ludicCache`'s place in the design, the axes frame, and everything about `ludicGraph`.

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../../../AGENT.md).

---

## Getting Started

1. **Read [`taskPlanning/AGENT.md`](../../../../AGENT.md) once** for the durability ladder and the content split. This plan is **plan-only**: nothing here has graduated, and none of it licenses code.
2. **Read [Proposal P6](AGENT.abstractionLayers.planning.md#proposal-p6-ludiccache-as-the-attention-scoped-reference-structure) in the parent plan.** Its five clauses are this plan's premises, not its subject matter. If you find yourself re-arguing whether the cache returns handles, you are in the wrong document.
3. **Read [Apprehension is two jobs, not one](AGENT.abstractionLayers.planning.md#apprehension-is-two-jobs-not-one-2026-08-12).** Attention serves **reference-location** only. Description caches nothing, and a case that turns on what a room's prose says is a description case and does not belong in this corpus.
4. **Then read [the corpus](AGENT.attentionHistory.corpus.planning.md).** It is the evidence base, not an appendix; the open rows below are worded the way they are because of it.
5. **Code orientation, for when this eventually graduates:** the lane is [`lambda/ephemera/dataSource/positions/`](../../../../../lambda/ephemera/dataSource/positions/AGENT.md) and the existing per-request memo is `internalCache/ludicGraphCache.ts`. **That class is deliberately *not* the construct designed here** --- see its note in [`internalCache/AGENT.md`](../../../../../lambda/ephemera/internalCache/AGENT.md).
6. **Test commands, for the same eventual purpose:** from `lambda/ephemera`, run `npm run test` (**not** `npm test`). **`npx tsc --noEmit` is not sufficient** --- `*.integration.test.ts` files sit outside the tsconfig include and mock by module *path*, so a rename can pass typecheck and still break the suite.

**Baseline before any future edit:** `cd lambda/ephemera && npm run test` should pass unchanged. Nothing in this plan should change it yet.

## Why this is a separate plan

**Not size --- discrimination.** The parent's [C-series corpus](AGENT.abstractionLayers.corpus.planning.md) is tagged against [the five axes](AGENT.abstractionLayers.planning.md#the-five-axes-what-the-graphs-flexibility-is-in-service-to) to settle *representation of structure*. Attention cases test **how salience responds to play over time**, which is a different question with different discriminators. Cases built to grade one will grade the other badly, and mixing two grading schemes into one case series is how a tally stops meaning anything.

**The methodological reason, and it is the parent plan's own:**

> *What must the model be able to express?* is answerable from the fiction with confidence. *What is the representation?* is not, and depends on the first. **A row asking both makes the answerable half unreachable.**

**PC-1, PC-2 and PC-3 are all representation rows, and they were opened with no requirement half in hand.** This plan exists to supply the requirement half first. It is the same conflation [AB-4](AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only) was caught in, one construct over.

## What is inherited as settled, and must not be re-argued here

| Inherited | From | Consequence for this plan |
| --- | --- | --- |
| The cache serves **reference-location** only; description is a read rule and caches nothing | [P6 clause 1](AGENT.abstractionLayers.planning.md#the-five-clauses) | A case about what the prose *says* is out of scope |
| Depth is **attention-scoped**, not exhaustive | P6 clause 2 | This plan decides what "surfaced" means; that it governs depth is settled |
| A hit returns **a handle, not a subgraph** | P6 clause 3 | Reachability stays the graph's job. Attention never decides whether a thing can be acted on |
| **A miss falls through**; a miss is never an answer of *no* | P6 clause 4 | **The correctness burden here is low** --- see below |
| The cache is **derived, authoritative over nothing** | P6 clause 5 | Attention state is not truth about the world |
| Attention is **room-scoped**, because what licenses reference is what the room was *told* | [P6 scope section](AGENT.abstractionLayers.planning.md#it-settles-the-scope-question-the-stored-attention-form-leaves-open) | Arrival timing is still open (**AH-6**); the scoping principle is not |
| The **ingress port list** is reference-location data and stays in the cache | [Which axes want the ingress list](AGENT.abstractionLayers.planning.md#which-axes-want-the-ingress-list-and-why-pq-1-does-not-reverse-2026-08-12) | It is this plan's first real consumer, and A3 tests it |

### The one inherited clause that most changes how this plan should be read

**Because a miss falls through to the graph walk, errors in the attention record degrade to *slow*, never to *wrong*.** The record may be lossy, approximate, aggressively pruned, rebuilt imperfectly, or dropped entirely, and the worst outcome is a slower path.

**That is a much weaker correctness burden than truth, and it should be spent rather than hoarded.** Designs that would be unacceptable for `ludicGraph` --- lossy compaction, heuristic pruning, approximate decay --- are legitimate candidates here. **The failure this plan must actually protect against is the opposite one:** demoting a referent a player still holds in their head, which produces *"you don't see any switch"* about something the room was just told about. That is a narrative-integrity violation of the kind [the fault-tolerant-medium section](AGENT.abstractionLayers.planning.md#fiction-is-a-fault-tolerant-medium--and-what-that-does-not-excuse-2026-08-09) treats as non-negotiable, and **no latency argument buys it back.**

## The retention axis: the space this plan is choosing within

**Two candidate representations surfaced in the opening conversation, and they are endpoints rather than options.** Recording both, plus the shape of what lies between, so the corpus is graded against a spectrum instead of a fork.

| | Records | Self-prunes? | Can represent | Cannot represent |
| --- | --- | --- | --- | --- |
| **Full transcript** | absolutely everything said | **No** --- must bound aggressively to scale | any question about the path taken | --- |
| **Record set** | **only end outcomes** --- `{ address -> salience }`, idempotent upsert | **Yes**, naturally | current state and recency | anything that depends on *how* the state was reached |

**The transcript end is the one this plan started anchored on**, and the anchor was unexamined: append-only immutability is a property of the `messages` table, not of attention. **Two facts pull hard away from it.** Most messages have **no bearing** on referents at all, so a backward scan is mostly waste; and attention operations **aggregate** --- pushing and pulling a lever is not meaningfully different from pushing it twice --- which means the natural write is an **idempotent upsert**, not an append.

**The record-set end is equally suspect for the mirror reason:** it can only answer questions that care about end outcomes, and [A4](AGENT.attentionHistory.corpus.planning.md#a4-is-there-a-screwdriver--no) and [A8](AGENT.attentionHistory.corpus.planning.md#a8-the-lever-pushed-once-and-the-lever-that-is-the-whole-scene) are both about to ask whether that is enough.

**The middle is unmapped and is probably where the answer lives** --- event-typed digests, per-scene summaries, decaying salience with counts, or a record set with a bounded tail of path. **Do not collapse this to a this-or-that implementation decision before Phase 0 runs.** That is the whole reason this plan exists.

**One structural note that survives whichever end wins:** the hot fetch is *given room H and the token "switch", what are the candidate addresses?* --- **one keyed read of `attention(H)`**, not a scan. Any candidate that cannot serve that shape in one read is disqualified on latency before the corpus is consulted.

## Phase 0 corpus

**Lives in [`AGENT.attentionHistory.corpus.planning.md`](AGENT.attentionHistory.corpus.planning.md)**, a sibling file on the parent's own precedent. Nine seed cases, **A1--A9**, none worked yet.

**A new series rather than more C-numbers**, decided deliberately: the C-series is axis-tagged for a different job. A-cases cross-reference into C7, C16 and C17 where they touch, and do not renumber them.

## Open decisions (design --- plan only)

**IDs are stable and never reused.** Rows here are the parent's **PC** series re-based and widened; the mapping is recorded so the parent's rows can retire cleanly rather than drift.

| ID | Question | Inherits | Status |
| --- | --- | --- | --- |
| **AH-1** | **Where on the retention axis does attention sit?** The master representation row, and **deliberately blocked on Phase 0** --- it must not be answered before A1--A9 are worked. Endpoints are recorded above; the middle is unmapped | PC-2 | **Blocked (by design)** |
| **AH-2** | **What confers salience?** System-emitted perception events certainly. Mutation events probably. **Player speech with no system event behind it is the hard one** ([A6](AGENT.attentionHistory.corpus.planning.md#a6-a-says-theres-a-switch-in-there)) --- it is reincorporation in its purest form and the mechanism has no obvious hook | PC-2 | Open |
| **AH-3** | **How deep does one surfacing reach?** Looking into a box promotes its contents; does it promote the contents *of* the contents? **P6 clause 2 is silent, and this may be the sharpest gap in it** ([A3](AGENT.attentionHistory.corpus.planning.md#a3-the-box-inside-the-box)) | new | Open |
| **AH-4** | **Does salience decay with elapsed time, with successive actions, or both?** And does re-surfacing **refresh** or **accumulate**? ([A8](AGENT.attentionHistory.corpus.planning.md#a8-the-lever-pushed-once-and-the-lever-that-is-the-whole-scene)) | new | Open |
| **AH-5** | **Do negative and newly-minted facts take salience?** *"Is there a screwdriver?" --- "No."* If the minted absence is not recorded, the second ask can mint a **different** answer ([A4](AGENT.attentionHistory.corpus.planning.md#a4-is-there-a-screwdriver--no)). Touches [P5](AGENT.abstractionLayers.planning.md#proposal-p5-improvisational-licence-as-a-first-class-graph-item) directly | new | Open |
| **AH-6** | **What resets a window, in a room that never empties?** The parent's PC-1 verbatim. **Room-empties is a valid boundary where it fires**; what is missing is a second way to move a window's start. Candidates: per-character windows layered over the shared one, oldest-first degradation (**suspect** --- oldest and no-longer-salient are not the same thing), or a heat-based reset borrowing [P4's narrative heat](AGENT.abstractionLayers.planning.md#narrative-heat-the-optimization-that-is-probably-not-only-an-optimization). **A decaying record set may shrink this row rather than answer it** ([A9](AGENT.attentionHistory.corpus.planning.md#a9-the-busy-hub)) | **PC-1** | Open |
| **AH-7** | **Does traversal on the *reasoning* path confer salience?** An LLM opening a bag to answer a question almost certainly must **not** promote for the player --- different consumer, and it leaks detail nobody in the fiction learned. Stated as near-certain so that [A7](AGENT.attentionHistory.corpus.planning.md#a7-the-llm-opens-the-bag) can falsify it rather than assume it | new | Open, leaning **no** |
| **AH-8** | **Are matchable *names* denormalized into entries, or resolved per address?** One read versus a denormalization that must invalidate on rename. Names live in the asset/WML layer. Downstream of AH-1 | new | Open |

**Not inherited: PC-3** (*is the cache persisted or rebuilt per request*) **stays in the parent** --- it is about `ludicCache`'s storage rather than attention's semantics. It depends on AH-1 and should not be settled before it.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as each is done.

- [ ] **Phase 0. Work the corpus.** Nine seed cases, in the corpus file.
  - [ ] A1--A2 (persistence and reset)
  - [ ] A3 (depth of promotion) --- **run early**; AH-3 blocks the most other rows
  - [ ] A4 (negative and minted facts)
  - [ ] A5--A7 (who and how salience is conferred)
  - [ ] A8--A9 (decay shape, and the busy hub)
  - [ ] Fill the retention-axis tally as cases land; **do not fill it up front** --- it is the corpus's output, not its premise
- [ ] **Phase 1. Answer the requirement rows** --- AH-2 through AH-7 --- from the worked cases only.
- [ ] **Phase 2. Then AH-1**, the retention question, and only then. Re-check AH-8 against the answer.
- [ ] **Phase 3. Feed back to the parent.** Close or re-base PC-1/PC-2, re-check PC-3, and confirm P6 clause 2's depth wording against AH-3's answer.
- [ ] **Phase 4. Graduate or retire.** Move durable rules to [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md), vocabulary to [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md), then delete this plan and its corpus per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Verification

**This plan is design-only and has no build step.** Verification is that the corpus discriminates:

1. **Every case names a player-visible difference.** A case where two candidate designs produce the same observable play is not corpus --- see [the falsification rule](AGENT.attentionHistory.corpus.planning.md#what-counts-as-a-case-here-and-how-it-differs-from-the-c-series).
2. **No row in the AH table is answered without a case behind it.**
3. **When code eventually lands:** `cd lambda/ephemera && npm run test` (**not** `npm test`), and never `npx tsc --noEmit` alone --- integration tests sit outside the tsconfig include and mock by module path.

## Progress

| Milestone | Status |
| --- | --- |
| Plan and corpus split out of the parent; scope, inherited premises and retention axis recorded | **Done (2026-08-12).** From conversation. **The reason for splitting is discrimination, not size:** the C-series grades representation-of-structure against the five axes; attention grades how salience responds to play, and one case series cannot carry both tallies. **The methodological finding, which is the parent plan's own rule turned on itself:** PC-1/2/3 are representation rows opened with no requirement half in hand --- the AB-4 conflation one construct over. **Two endpoints recorded rather than one fork:** full transcript (records everything, must bound aggressively) and record set (records end outcomes only, self-prunes, cannot represent path-dependent state); **the middle is unmapped and is probably where the answer lives** |
| Nine seed cases stated (A1--A9) | **Done (2026-08-12).** Stated and scoped; **none worked** |
| Phase 0 --- work A1--A9 | Not started |
| Phase 1 --- requirement rows AH-2..AH-7 | Not started |
| Phase 2 --- AH-1, the retention question | Not started; **blocked on Phase 0 by design** |
| Phase 3 --- feed back to parent (PC rows, P6 clause 2) | Not started |
| Phase 4 --- graduate or retire | Not started |

## Lifecycle

**Retire this plan and its corpus when Phase 4 completes**, per [`taskPlanning/AGENT.md`](../../../../AGENT.md): move durable rules into the code-adjacent docs, then delete both files. Git retains the trace, exactly as it did for the `ludicGraph` rename sub-plan.

**Do not let this outlive its answers.** The parent plan records that a distinction can grow back after being locked; a corpus left in place after its findings have graduated is one of the ways that happens.
