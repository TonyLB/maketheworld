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

## The attention ledger as an instruction set (2026-08-12)

**Proposed from conversation, and adopted as this plan's working frame.** Alongside the position-mutation and player-notification instructions the compilers and kernels already emit, add a set of **attention-ledger instructions** --- an op that adds an item to attention history, and later ops for aggregating, overwriting, merging and splitting. **The `ludicCache` is then the *result* of applying the ledger to `ludicGraph`**, rather than a structure derived directly from narration.

### The strongest thing about it is that it is not new

**This lane already has exactly this architecture**, and adopting it is joining a pattern rather than inventing a layer. From [`manipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.md):

> `kernel/` holds **two** kernels that filter the same `KernelStep[]`: the **mutation** kernel runs inside the transaction (`commitStepSequence`), and the **presentation** kernel runs after it commits (`presentStepSequence`, with a describe branch and a narrate branch). Call sites do not build either list by hand --- they emit an abstract op and `kernel/compile/` expands it.

**So attention is a third filter over the same step list**, and `PositionKernelOp` (`kernel/compile/positionKernelOp.ts`) is already a discriminated union with one member, `move`, built to be extended.

**It belongs on the presentation side, and specifically on the narrate branch.** Narrate is what the room was *told*; describe is the lossy job that [caches nothing](AGENT.abstractionLayers.planning.md#apprehension-is-two-jobs-not-one-2026-08-12). **That is P6's room-scoped principle already existing in shipped code** rather than as a design commitment this plan has to defend.

### It settles transactional fate before the question is asked

**Attention must never share transactional fate with position mutation** --- a failed attention write rolling back a structural mutation would be absurd. It never needs to, because [errors here degrade to *slow*, never to *wrong*](#the-one-inherited-clause-that-most-changes-how-this-plan-should-be-read).

**`presentStepSequence` already runs after commit**, so the seam is pre-built and attention lands outside the transaction by construction. **Skew is acceptable and expected:** a structural change may commit with its attention write lagging or lost, and the consequence is one slower reference resolution.

### The `capture` finding, which is worth more than the proposal

Same doc, on a mechanism built for narration:

> **Captured rosters are load-bearing, not diagnostics.** A `capture` step snapshots one host's occupants mid-walk, and that snapshot **is** the audience the narration is delivered to... the audience for "Tess left" has to be who was standing in the room *at that beat*.

**That is [A5](AGENT.attentionHistory.corpus.planning.md#a5-the-second-character-arriving-after)'s problem, already solved in shipped code.** *B arrives after A opened the chest* is an audience-at-that-beat question, and `capture` is working machinery for exactly that. **A5 shrinks from a design question to a capture-semantics question** --- does an attention promotion attach to the captured roster or to the host? --- and must be re-read against `capture` before anyone works it.

### The three seams, and what each rests on

**The decoupling is real rather than wishful, and the reason is that two of the three contracts are already locked.**

| Seam | Contract that must hold | Status |
| --- | --- | --- |
| abstraction-fractal <-> ledger | stable **addresses / handles** | **Already locked** --- [locked-frame clause 2](AGENT.abstractionLayers.planning.md#locked-frame-parts-and-ports-2026-08-06) plus [P6 clause 3](AGENT.abstractionLayers.planning.md#the-five-clauses) |
| ledger <-> `ludicCache` | **the algebraic laws** the fold obeys, **plus a salience ordering** --- *not* the output shape | **Re-based 2026-08-12** by [the algebraic contract](#the-algebraic-contract-2026-08-12). What must be agreed before the channels run apart is **AH-10a** (the laws), which is answerable now; **AH-10b** (the carrier type) is downstream of AH-9 and allowed to churn |
| ledger <-> mutation kernel | attention steps are **footprint-exempt** (see below) | Must be stated, not discovered |

**The ledger does not need the fractal *settled*, only *addressable*.** That is why three development channels can proceed independently: fractal, ledger, and cache.

**And the cache does not need the ledger's primitives *settled*, only *lawful* --- added 2026-08-12.** The decoupling of the second seam is **partial and deliberately so**: an iteration that extends or refactors the attention-ledger primitives may well change the code that **applies** them to `ludicCache`, but not the fact that they are applied, reordered and compacted under fixed algebraic rules. **The blast radius of a primitive-set change is one interpreter layer.** Untouched behind it: every compile site emitting abstract ops, every storage decision, and the cache's external behaviour ([clause 3](AGENT.abstractionLayers.planning.md#the-five-clauses)'s handle-not-subgraph and clause 4's miss-falls-through). **That is weaker than a frozen type signature and strong enough to iterate on**, which is the trade this seam is making knowingly.

### What this does to AH-1, and it is the largest consequence

**The retention axis was posed as a schema choice --- one you commit to and later migrate out of.** Under an instruction set it stops being that. **Compaction becomes policy expressed as instructions** (`Aggregate`, `Merge`, `Split`) rather than a storage format, so a naive first iteration can simply never compact, and compaction arrives later **without migrating anything**.

> **The retention axis is a dial, not a fork.**

**That is a materially better position than the one this plan was created to resolve**, and it arrived from the instruction framing rather than from the corpus. **It does not retire AH-1 or Phase 0** --- the corpus still has to say what attention *should* do, and A4 and A8 still test whether end-outcome records suffice. What it removes is the pressure to answer AH-1 *first* and the cost of answering it wrong.

**The cost of starting naive, stated so it is chosen:** with no aggregation ops, the ledger grows unboundedly. Acceptable at playtest volume, and it makes [A9](AGENT.attentionHistory.corpus.planning.md#a9-the-busy-hub) an early measurement rather than a late surprise.

### One constraint and one caution

**Constraint --- footprint exemption must be explicit.** If attention steps join `KernelStep[]`, `computeStepSequenceFootprint` will want to count them, which puts attention on the mutation critical path through the back door and re-prices the very thing P6 kept off it. **`computeStepSequenceFootprint` runs once, up front, and `MultiKeyUpdate` cannot be re-entered** --- the constraint that, per the parent plan, "has killed or re-priced more proposals here than apprehension has." State the exemption up front or meet it later as a latency regression.

**Caution --- do not build the planner before the naive version earns it.** The correctness burden here is low; an instruction set plus aggregation planner is a great deal of machinery for something that could begin as an upsert map. **The process precedent already exists:** elect iteration 1 as a **Prototype** with a named rollback trigger, exactly as [PL-1 iteration 1](AGENT.abstractionLayers.planning.md#pl-1-iteration-1-brute-force-relevance-classified-as-a-prototype-2026-08-09) was, under [the graduation tiers](AGENT.abstractionLayers.planning.md#graduation-tiers-when-a-decision-licenses-code-2026-08-11). No new machinery is needed to sanction a naive first cut.

## The algebraic contract (2026-08-12)

**Proposed from conversation, and adopted as the ledger <-> `ludicCache` contract.** Ledger entries must be applicable to `ludicCache` under algebraic laws: **commutative**, **associative**, with an **identity**. In practice: *"push lever, look at table, pull lever"* must land the cache in the same state as *"pull lever, pull lever, look at table."*

> **The contract is the laws, not the type. What must stay stable is that entries fold into cache state commutatively and associatively --- never what an entry is made of.**

**That distinction is the whole point of this section**, and getting it wrong was a real wrong turn in the conversation that produced it. A commutative monoid can be over *any* carrier set. Scalar addition is one **model** of these laws; a richer carrier --- composite ops, promotions carrying depth, merges of cache-nodes --- satisfies them equally well. **Deriving a concrete output shape from the algebra is a category error**, and it is what made AH-10 look like it blocked more than it does.

### The property worth more than compaction

Compaction is the visible payoff: commutativity makes the ledger a **multiset, not a sequence**, which is what licenses *"two actions worth of pull lever"* and the whole compaction-of-noisy-streams argument. **The less visible payoff is larger.** Emission runs on Lambda-concurrent stream work with **no ordering guarantee**. Under a commutative fold, out-of-order delivery yields the same cache --- so the ledger never has to buy sequencing, and a hazard nobody had priced stops existing.

**Closure is only required over *realizable* sequences.** *"Look into the inner box"* before *"open the outer box"* is not a reordering the algebra must survive, because the play-spine cannot emit it. That is a much smaller burden than closure over all syntactically possible orders, and it is checkable against the corpus rather than provable in the abstract.

### Positive entries commute; negative entries do not

**The one clean line through what is allowed in the ledger:**

> **A positive attention entry is a claim about the observer. A negative attention entry is a claim about the world. Only the second kind fails to commute.**

*"The lever was attended"* is not falsifiable by `ludicGraph` and therefore commutes with anything, including mutation. *"There is no screwdriver here"* does not commute with the mutation that places one.

**This is a second, independent witness for the answer [clause 4](#the-one-inherited-clause-that-most-changes-how-this-plan-should-be-read) already implies.** A wrong cached *positive* yields a handle that must still ground against the graph --- it degrades to **slow**. A wrong cached *negative* yields a fast *"no"* about something that exists, which is the narrative-integrity violation this plan calls non-negotiable. **Correctness and algebra land on the same answer**, which is worth more than either argument alone. See **AH-5**.

### Decay is a property of the element, not an operator

**The obvious objection is that decay is non-commutative by nature.** It is, *if it is an operation applied to the ledger*. So do not make it one:

- an entry carries weight `w` and a timestamp `t`
- salience at read time is `sum of w_i * f(now - t_i)`

**Decay then is not in the algebra at all**, and cannot break it. The fold stays a sum.

**And with an exponential `f`, compaction stays exact:**

```text
w1*e^(-L(t-t1)) + w2*e^(-L(t-t2))  =  e^(-Lt) * ( w1*e^(L*t1) + w2*e^(L*t2) )
```

So an entry stored canonically as `W = w * e^(L*t)` against a fixed epoch folds by **plain addition**, collapsing n entries into one number with **no loss** --- not an approximation. Read-time salience is `W * e^(-L*now)`; the epoch is rebased periodically so the exponent does not run away, which is arithmetic hygiene rather than semantics.

**The strong form, because it constrains the fiction:** exponential is essentially the **only** decay law that is free. Linear decay, step functions and drop-after-N all either break commutativity or force retention of every entry to know what to subtract. **The algebra does not merely tolerate decay --- it picks the decay law**, which is a constraint arriving from a direction the corpus was never going to supply. See **AH-4**.

### The scalar model, kept in its place

**The `(address -> scalar, epoch)` shape above is a worked model, not the contract.** It earns its place by proving two things --- that the laws are satisfiable, and that decay can compact exactly --- and it is the obvious **iteration-1** choice under [the naive-first caution](#one-constraint-and-one-caution). **It must not be written into the ledger <-> cache seam**, because AH-9's primitive set is expected to churn and a richer primitive set needs a richer carrier.

### What the cache depends on beyond the laws

**One thing, and it is not algebraic: an order.** Materialization means *"salient enough,"* which requires comparing. A scalar supplies that for free; a richer carrier may not. **So the seam is the laws plus a `salience: M -> comparable` projection**, ideally monotone under the fold. If a future carrier cannot supply that projection, the boundary genuinely breaks --- which makes this the dependency to check first when the primitive set changes, and the reason it is stated separately rather than folded into the laws.

**Compaction must be a homomorphism:** `fold(compact(S)) = fold(S)`. If it is not, compaction changes answers and [AH-1's dial](#what-this-does-to-ah-1-and-it-is-the-largest-consequence) re-forks into the schema choice this framing just retired.

### The inverse trap, and why `Split` is where to look for it

**If `Split` is expressed as subtraction** --- removing salience that a `Merge` added --- **the ledger has left a monoid for a group**, and inverses interact badly with element-carried decay: the weight being removed has already decayed, so `Merge` then `Split` does not return to where it started. **The failure is silent and time-dependent**, which is the worst combination to debug.

**The pattern to notice:** this is the negatives problem again. **Ops that assert removal are the ones that break the algebra**, whether they remove a fact from the world or weight from an entry. Candidate escapes are to keep `Split` a **materialization-time** concern, or to express it as a **new positive element** rather than a negative one. **Not decided here** --- flagged so AH-9 works the primitive set with the trap in view.

### The artifact that gives this teeth

**A design-level contract with no artifact decays into a good intention.** Laws have a natural one: **property tests written against the laws rather than the shape.** Generate arbitrary entry sequences and assert permutation-invariance of the resulting cache state; assert `fold(compact(S)) = fold(S)`; assert identity.

**Those tests are written once and survive every carrier change**, and they fail loudly the first time a new primitive quietly breaks commutativity --- which is exactly the failure a design-level contract otherwise cannot catch. **They belong in Channel B's first slice**, and they are what converts partial decoupling from a convention into something enforced.

### Two costs, recorded so they are chosen

**It is deliberately not idempotent.** Counting is the point, so at-least-once delivery double-counts. **The drift is benign** --- over-salience yields a handle that must still ground against the graph, so it degrades to slow, not wrong --- but the mitigation (dedup keys, or accepting it) should be picked rather than discovered in production. **This is the one place the order-independence win is partly handed back.**

**It forbids order-dependent promotion depth.** If **AH-3** ever wants *"look at box, then switch"* to differ from *"look at switch, then box,"* commutativity has already ruled that out. **This is a constraint being imposed, not a fact discovered**, and [A3](AGENT.attentionHistory.corpus.planning.md#a3-the-box-inside-the-box) should be worked knowing it has the standing to overturn the whole frame.

**One distinction to keep straight:** the algebra is flat, the addresses are hierarchical. Salience propagating up containment (attending the switch warms the box) is a fixed linear map applied at read time, and still commutes with the fold. **Hierarchy costs nothing here** --- but for a different reason than algebraic nesting does.

## Phase 0 corpus

**Lives in [`AGENT.attentionHistory.corpus.planning.md`](AGENT.attentionHistory.corpus.planning.md)**, a sibling file on the parent's own precedent. Nine seed cases, **A1--A9**, none worked yet.

**A new series rather than more C-numbers**, decided deliberately: the C-series is axis-tagged for a different job. A-cases cross-reference into C7, C16 and C17 where they touch, and do not renumber them.

## Open decisions (design --- plan only)

**IDs are stable and never reused.** Rows here are the parent's **PC** series re-based and widened; the mapping is recorded so the parent's rows can retire cleanly rather than drift.

| ID | Question | Inherits | Status |
| --- | --- | --- | --- |
| **AH-1** | **Where on the retention axis does attention sit?** The master representation row, and **deliberately blocked on Phase 0** --- it must not be answered before A1--A9 are worked. Endpoints are recorded above; the middle is unmapped. **Re-framed 2026-08-12 by [the ledger-as-instruction-set proposal](#the-attention-ledger-as-an-instruction-set-2026-08-12), and much of its urgency removed:** under an instruction set, compaction is **policy expressed as ops** rather than a storage format, so a naive iteration can never compact and gain aggregation later **without migrating anything**. **The axis is a dial, not a fork.** The row stays open --- A4 and A8 still test whether end-outcome records suffice --- but **answering it wrong is no longer expensive**, which is what licenses building a first cache iteration ahead of it. **Strengthened again 2026-08-12 by [the algebraic contract](#the-algebraic-contract-2026-08-12):** if compaction is a homomorphism, then folding eagerly (record-set end) and folding lazily (transcript end) are **the same function evaluated at different times**. The axis is then not merely cheap to change --- **it provably cannot change the answer**, only the cost. **What stays open is therefore narrower than the row's wording suggests:** the *fiction* of what should be retained, which is still Phase 0's to settle | PC-2 | **Blocked (by design), and de-risked twice** |
| **AH-2** | **What confers salience?** System-emitted perception events certainly. Mutation events probably. **Player speech with no system event behind it is the hard one** ([A6](AGENT.attentionHistory.corpus.planning.md#a6-a-says-theres-a-switch-in-there)) --- it is reincorporation in its purest form and the mechanism has no obvious hook | PC-2 | Open |
| **AH-3** | **How deep does one surfacing reach?** Looking into a box promotes its contents; does it promote the contents *of* the contents? **P6 clause 2 is silent, and this may be the sharpest gap in it** ([A3](AGENT.attentionHistory.corpus.planning.md#a3-the-box-inside-the-box)) | new | Open |
| **AH-4** | **Does salience decay with elapsed time, with successive actions, or both?** And does re-surfacing **refresh** or **accumulate**? ([A8](AGENT.attentionHistory.corpus.planning.md#a8-the-lever-pushed-once-and-the-lever-that-is-the-whole-scene)). **Substantially narrowed 2026-08-12 by [the algebraic contract](#decay-is-a-property-of-the-element-not-an-operator).** The three-way choice collapses to **which clock the decay constant runs on** --- wall-clock, a monotonic action counter, or both --- because the algebra is identical in each case and *"both"* is a product of exponentials, `W = w * e^(Lt*t + Ln*n)`, still **one scalar**. So the expensive-looking answer is free, and what remains is the genuine fiction question of **which clock**, which A8 and A9 can decide. **The decay *law* is no longer open:** exponential is forced, since nothing else compacts. **`refresh` versus `accumulate` is also no longer representational** --- accumulate is `+`, refresh is `max`, both commutative monoids --- so that half stays an honest fiction question | new | **Open, narrowed to *which clock*** |
| **AH-5** | **Do negative and newly-minted facts take salience?** *"Is there a screwdriver?" --- "No."* If the minted absence is not recorded, the second ask can mint a **different** answer ([A4](AGENT.attentionHistory.corpus.planning.md#a4-is-there-a-screwdriver--no)). Touches [P5](AGENT.abstractionLayers.planning.md#proposal-p5-improvisational-licence-as-a-first-class-graph-item) directly. **Second argument added 2026-08-12, from a different direction:** negatives are the entries that **do not commute** ([why](#positive-entries-commute-negative-entries-do-not)), since a negative is a claim about the world rather than about the observer. **Algebra and correctness reach the same answer** --- keep negatives out of the ledger --- which is worth more than either argument alone. **What that does not do is dissolve the row:** A4's minting problem is real, and the answer this now points at is that the record belongs somewhere **other than** the attention ledger. Where, is still open | new | **Open --- but leaning firmly *not in the ledger*, on two independent grounds** |
| **AH-6** | **What resets a window, in a room that never empties?** The parent's PC-1 verbatim. **Room-empties is a valid boundary where it fires**; what is missing is a second way to move a window's start. Candidates: per-character windows layered over the shared one, oldest-first degradation (**suspect** --- oldest and no-longer-salient are not the same thing), or a heat-based reset borrowing [P4's narrative heat](AGENT.abstractionLayers.planning.md#narrative-heat-the-optimization-that-is-probably-not-only-an-optimization). **A decaying record set may shrink this row rather than answer it** ([A9](AGENT.attentionHistory.corpus.planning.md#a9-the-busy-hub)) | **PC-1** | Open |
| **AH-7** | **Does traversal on the *reasoning* path confer salience?** An LLM opening a bag to answer a question almost certainly must **not** promote for the player --- different consumer, and it leaks detail nobody in the fiction learned. Stated as near-certain so that [A7](AGENT.attentionHistory.corpus.planning.md#a7-the-llm-opens-the-bag) can falsify it rather than assume it | new | Open, leaning **no** |
| **AH-8** | **Are matchable *names* denormalized into entries, or resolved per address?** One read versus a denormalization that must invalidate on rename. Names live in the asset/WML layer. Downstream of AH-1 | new | Open |
| **AH-9** | **Which attention ops compile, and which need live grounding?** Opened 2026-08-12 with [the ledger proposal](#the-attention-ledger-as-an-instruction-set-2026-08-12). **A cheap discriminator exists and both answers are already shipped patterns in this lane:** ops that depend on **narrative intent** (`Surface`) can expand from the abstract op at compile time, the way the shared membership adapter does for fixed targets; ops that depend on **current cache shape** (`Merge` / `Split` --- whether contents promote into the room's node depends on what is already there) need live state, the way the Synthesize executor is re-run at execute time for commands needing live grounding. **So this is a choice between two existing mechanisms rather than an invention.** **One trap added 2026-08-12 --- work the primitive set with it in view:** if `Split` is expressed as **subtraction** of weight a `Merge` added, the ledger leaves a monoid for a **group**, and inverses interact badly with element-carried decay ([why](#the-inverse-trap-and-why-split-is-where-to-look-for-it)). **Ops that assert removal are the ones that break the algebra**, which is the negatives problem in a second guise | new | Open |
| **AH-10** | **Split 2026-08-12 into AH-10a and AH-10b; do not use this ID.** It was conflating a requirement row with a representation row --- [the exact error](#why-this-is-a-separate-plan) this plan was created to stop making, one seam over. **The tell was that it felt like it blocked more than it should** | new | **Superseded --- see AH-10a / AH-10b** |
| **AH-10a** | **What laws must the ledger's output obey?** The requirement half, and **answerable now**: commutative and associative fold with identity, compaction as a **homomorphism**, decay carried on the element, plus a **`salience -> comparable` projection** so the cache can threshold. **Proposed in full by [the algebraic contract](#the-algebraic-contract-2026-08-12)** and awaiting nothing but a decision to adopt it. **This --- not the carrier type --- is what must hold before the three channels run apart** | AH-10 | **Proposed; adopt to unblock Channel B** |
| **AH-10b** | **What carrier type do entries fold in?** The representation half, **deliberately deferred and downstream of AH-9's primitive set**. `(address -> scalar, epoch)` with exponential decay is the [worked model](#the-scalar-model-kept-in-its-place) and the obvious iteration-1 choice; composite or nested primitives need a richer carrier and the laws are indifferent. **Allowed to churn** --- blast radius is one interpreter layer. **The one thing that must be re-checked on every change** is the salience projection from AH-10a, which is the only cache dependency that is not algebraic | AH-10 | **Open, and deliberately not blocking** |

**Not inherited: PC-3** (*is the cache persisted or rebuilt per request*) **stays in the parent** --- it is about `ludicCache`'s storage rather than attention's semantics. It depends on AH-1 and should not be settled before it.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as each is done.

**These phases are no longer strictly sequential, as of 2026-08-12.** [The ledger-as-instruction-set frame](#the-attention-ledger-as-an-instruction-set-2026-08-12) decouples three channels --- abstraction-fractal, attention-ledger, `ludicCache` --- so a naive ledger and a first cache iteration can proceed **while** the corpus is worked, provided **AH-10a** (the fold's algebraic laws) is settled first --- **not** AH-10b, the carrier type, which is allowed to churn behind the interpreter layer. **The one ordering that must not be broken:** no corpus case is graded against what an iteration happens to do. **The corpus judges the iteration, never the reverse.**

- [ ] **Phase 0. Work the corpus.** Nine seed cases, in the corpus file.
  - [ ] A1--A2 (persistence and reset)
  - [ ] A3 (depth of promotion) --- **run early**; AH-3 blocks the most other rows
  - [ ] A4 (negative and minted facts)
  - [ ] A5--A7 (who and how salience is conferred)
  - [ ] A8--A9 (decay shape, and the busy hub)
  - [ ] Fill the retention-axis tally as cases land; **do not fill it up front** --- it is the corpus's output, not its premise
- [ ] **Phase 1. Answer the requirement rows** --- AH-2 through AH-7 --- from the worked cases only.
- [ ] **Phase 2. Then AH-1**, the retention question, and only then. Re-check AH-8 against the answer.
- [ ] **Channel B (parallel, once AH-10a is settled). Naive ledger + first `ludicCache` iteration.**
  - [ ] Settle **AH-10a** --- the fold's algebraic laws, plus the salience ordering. Nothing else here starts first. **AH-10b is explicitly not a precondition**
  - [ ] **Write the law-level property tests first** --- permutation-invariance of cache state over arbitrary entry sequences, `fold(compact(S)) = fold(S)`, and identity. **They come before the primitives they constrain**, because they are what makes the seam enforced rather than agreed, and they are the only thing that catches a later primitive quietly breaking commutativity
  - [ ] Add an attention op to `PositionKernelOp` and expand it in `kernel/compile/`; **no aggregation ops in iteration 1**
  - [ ] Pick the idempotency stance --- **dedup keys or accept the drift** --- rather than inheriting it. Counting is [deliberately not idempotent](#two-costs-recorded-so-they-are-chosen)
  - [ ] Filter it on the **narrate** branch of `presentStepSequence`, post-commit; assert **footprint exemption** with a test, so the constraint is enforced rather than remembered
  - [ ] Elect the iteration a **Prototype** with a named rollback trigger, per PL-1 iteration 1's precedent
  - [ ] Measure ledger growth against [A9](AGENT.attentionHistory.corpus.planning.md#a9-the-busy-hub); it is the trigger for whether aggregation ops are iteration 2
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
| **Attention ledger adopted as an instruction set; three channels decoupled** | **Done (2026-08-12).** From conversation, proposed by the user. **Attention-ledger instructions join the position-mutation and player-notification instructions the compilers already emit; `ludicCache` becomes the *result* of applying the ledger to `ludicGraph`.** **Its strongest property is that it is not new:** `kernel/` already runs **two kernels over one `KernelStep[]`** --- mutation inside the transaction, presentation after it commits --- and `PositionKernelOp` is a one-member union built to extend. Attention is a **third filter**, on the **narrate** branch, which is P6's room-scoped principle already present in shipped code. **Transactional fate settles itself:** post-commit by construction, so an attention write can never roll back a mutation, and skew is acceptable because errors degrade to slow rather than wrong. **The find worth more than the proposal: `capture`.** Its snapshot of a host's occupants *is* the narration audience, which is [A5](AGENT.attentionHistory.corpus.planning.md#a5-the-second-character-arriving-after)'s problem solved in shipped code --- that case shrinks to a capture-semantics question. **Largest consequence: AH-1 is re-framed and de-risked.** Compaction becomes policy expressed as ops rather than a storage format, so the **retention axis is a dial, not a fork** --- a naive iteration never compacts and gains aggregation later without migration. **Two new rows:** AH-9 (which ops compile versus need live grounding --- both answers are shipped patterns here) and **AH-10** (the ledger's output shape, the one genuinely new contract, and the only thing blocking the channels from running apart). **One constraint recorded so it is not discovered late:** attention steps must be **footprint-exempt**, or `computeStepSequenceFootprint` pulls attention onto the mutation critical path through the back door |
| **Algebraic contract adopted as the ledger <-> cache seam; AH-10 split** | **Done (2026-08-12).** From conversation, proposed by the user. **Ledger entries fold into `ludicCache` commutatively and associatively** --- *push, look, pull* lands where *pull, pull, look* does. **The property worth more than the compaction it was proposed for:** emission runs on concurrent stream work with no ordering guarantee, and a commutative fold means out-of-order delivery yields the same cache, so the ledger never has to buy sequencing. **Closure is only needed over *realizable* sequences**, which is a far smaller burden than it first appears. **The correction that matters most, and it was the user's:** a first pass derived a concrete `(address -> scalar)` output shape *from* the algebra. **That is a category error** --- a commutative monoid can be over any carrier, so the scalar is a **model** of the laws, not their consequence, and composite or nested primitives satisfy them equally well in a richer carrier. **So AH-10 was conflating a requirement row with a representation row**, the AB-4 error one seam over, and it splits: **AH-10a** (the laws --- answerable now, and the actual precondition for the channels) and **AH-10b** (the carrier --- deferred, downstream of AH-9, allowed to churn, blast radius one interpreter layer). **Decay is solved by moving it from the operator to the element:** weight and timestamp on the entry, decay applied at read, so it is not in the algebra to break it --- and **exponential decay compacts exactly**, which means the algebra *picks* the decay law rather than merely tolerating it (AH-4 narrows to *which clock*). **Positives commute, negatives do not**, because a positive is a claim about the observer and a negative a claim about the world --- **algebra and narrative-integrity reach the same verdict** on AH-5 from independent directions. **Largest consequence: AH-1's dial is now provable** --- compaction as a homomorphism makes eager and lazy folding the same function at different times, so retention cannot change the answer, only the cost. **Two dependencies stated because they are not algebraic:** a `salience -> comparable` projection, without which the cache cannot threshold; and the **inverse trap** on `Split`, flagged into AH-9. **The artifact that gives it teeth: law-level property tests**, written before the primitives they constrain |
| Phase 0 --- work A1--A9 | Not started |
| Phase 1 --- requirement rows AH-2..AH-7 | Not started |
| Phase 2 --- AH-1, the retention question | Not started; **blocked on Phase 0 by design** |
| Phase 3 --- feed back to parent (PC rows, P6 clause 2) | Not started |
| Phase 4 --- graduate or retire | Not started |

## Lifecycle

**Retire this plan and its corpus when Phase 4 completes**, per [`taskPlanning/AGENT.md`](../../../../AGENT.md): move durable rules into the code-adjacent docs, then delete both files. Git retains the trace, exactly as it did for the `ludicGraph` rename sub-plan.

**Do not let this outlive its answers.** The parent plan records that a distinction can grow back after being locked; a corpus left in place after its findings have graduated is one of the ways that happens.
