# Attention history: what `ludicCache` remembers, and for how long

**Status: in progress --- Phase 0 (corpus) opened 2026-08-12, no cases worked yet. Next step: work [A1--A9](AGENT.attentionHistory.corpus.planning.md) and let them decide the retention question, not the other way round.**

**Sub-plan of [`AGENT.abstractionLayers.planning.md`](AGENT.abstractionLayers.planning.md)**, split out 2026-08-12. It owns the **semantics of attention** --- what a surfacing event records, what keeps a referent live, and what lets it go. The parent keeps `ludicCache`'s place in the design, the axes frame, and everything about `ludicGraph`.

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../../../AGENT.md).

---

## Getting Started

1. **Read [`taskPlanning/AGENT.md`](../../../../AGENT.md) once** for the durability ladder and the content split. This plan is **plan-only**: nothing here has graduated, and none of it licenses code.
2. **Read [Proposal P6](AGENT.abstractionLayers.proposals.planning.md#proposal-p6-ludiccache-as-the-attention-scoped-reference-structure) in the parent plan.** Its five clauses are this plan's premises, not its subject matter. If you find yourself re-arguing whether the cache returns handles, you are in the wrong document.
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
| The cache serves **reference-location** only; description is a read rule and caches nothing | [P6 clause 1](AGENT.abstractionLayers.proposals.planning.md#the-five-clauses) | A case about what the prose *says* is out of scope |
| Depth is **attention-scoped**, not exhaustive | P6 clause 2 | This plan decides what "surfaced" means; that it governs depth is settled |
| A hit returns **a handle, not a subgraph** | P6 clause 3 | Reachability stays the graph's job. Attention never decides whether a thing can be acted on |
| **A miss falls through**; a miss is never an answer of *no* | P6 clause 4 | **The correctness burden here is low** --- see below |
| The cache is **derived, authoritative over nothing** | P6 clause 5 | Attention state is not truth about the world |
| Attention is **room-scoped**, because what licenses reference is what the room was *told* | [P6 scope section](AGENT.abstractionLayers.proposals.planning.md#it-settles-the-scope-question-the-stored-attention-form-leaves-open) | Arrival timing is still open (**AH-6**); the scoping principle is not |
| The **ingress port list** is reference-location data and stays in the cache | [Which axes want the ingress list](AGENT.abstractionLayers.proposals.planning.md#which-axes-want-the-ingress-list-and-why-pq-1-does-not-reverse-2026-08-12) | It is this plan's first real consumer, and A3 tests it |

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
| abstraction-fractal <-> ledger | stable **addresses / handles** | **Already locked** --- [locked-frame clause 2](AGENT.abstractionLayers.planning.md#locked-frame-parts-and-ports-2026-08-06) plus [P6 clause 3](AGENT.abstractionLayers.proposals.planning.md#the-five-clauses) |
| ledger <-> `ludicCache` | **the algebraic laws** the fold obeys, **plus a salience ordering** --- *not* the output shape | **Re-based 2026-08-12** by [the algebraic contract](#the-algebraic-contract-2026-08-12). What must be agreed before the channels run apart is **AH-10a** (the laws), which is answerable now; **AH-10b** (the carrier type) is downstream of AH-9 and allowed to churn |
| ledger <-> mutation kernel | attention steps are **footprint-exempt** (see below) | Must be stated, not discovered |

**The ledger does not need the fractal *settled*, only *addressable*.** That is why three development channels can proceed independently: fractal, ledger, and cache.

**And the cache does not need the ledger's primitives *settled*, only *lawful* --- added 2026-08-12.** The decoupling of the second seam is **partial and deliberately so**: an iteration that extends or refactors the attention-ledger primitives may well change the code that **applies** them to `ludicCache`, but not the fact that they are applied, reordered and compacted under fixed algebraic rules. **The blast radius of a primitive-set change is one interpreter layer.** Untouched behind it: every compile site emitting abstract ops, every storage decision, and the cache's external behaviour ([clause 3](AGENT.abstractionLayers.proposals.planning.md#the-five-clauses)'s handle-not-subgraph and clause 4's miss-falls-through). **That is weaker than a frozen type signature and strong enough to iterate on**, which is the trade this seam is making knowingly.

### What this does to AH-1, and it is the largest consequence

**The retention axis was posed as a schema choice --- one you commit to and later migrate out of.** Under an instruction set it stops being that. **Compaction becomes policy expressed as instructions** (`Aggregate`, `Merge`, `Split`) rather than a storage format, so a naive first iteration can simply never compact, and compaction arrives later **without migrating anything**.

> **The retention axis is a dial, not a fork.**

**That is a materially better position than the one this plan was created to resolve**, and it arrived from the instruction framing rather than from the corpus. **It does not retire AH-1 or Phase 0** --- the corpus still has to say what attention *should* do, and A4 and A8 still test whether end-outcome records suffice. What it removes is the pressure to answer AH-1 *first* and the cost of answering it wrong.

**The cost of starting naive, stated so it is chosen:** with no aggregation ops, the ledger grows unboundedly. Acceptable at playtest volume, and it makes [A9](AGENT.attentionHistory.corpus.planning.md#a9-the-busy-hub) an early measurement rather than a late surprise.

### One constraint and one caution

**Constraint --- footprint exemption must be explicit.** If attention steps join `KernelStep[]`, `computeStepSequenceFootprint` will want to count them, which puts attention on the mutation critical path through the back door and re-prices the very thing P6 kept off it. **`computeStepSequenceFootprint` runs once, up front, and `MultiKeyUpdate` cannot be re-entered** --- the constraint that, per the parent plan, "has killed or re-priced more proposals here than apprehension has." State the exemption up front or meet it later as a latency regression.

**Caution --- do not build the planner before the naive version earns it.** The correctness burden here is low; an instruction set plus aggregation planner is a great deal of machinery for something that could begin as an upsert map. **The process precedent already exists:** elect iteration 1 as a **Prototype** with a named rollback trigger, exactly as [PL-1 iteration 1](AGENT.abstractionLayers.proposals.planning.md#pl-1-iteration-1-brute-force-relevance-classified-as-a-prototype-2026-08-09) was, under [the graduation tiers](AGENT.abstractionLayers.planning.md#graduation-tiers-when-a-decision-licenses-code-2026-08-11). No new machinery is needed to sanction a naive first cut.

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

**A second exclusion, from a different direction, added 2026-08-13.** Negatives are barred because they are claims about the world. **State that must be *reset* by ordinary activity is barred because resetting does not commute** --- `x := 0` and `x += 1` fold to different answers in different orders, so no counter that ordinary play clears can be an op. **The monoid accumulates and it takes minima; it does nothing else.** Such state belongs to **compaction**, which is serialized and privileged --- or better, to a quantity that can be **derived** from what is already stored. [Preferring derived removed a clock](#competitive-decay-retired-as-an-evictor-re-opened-as-a-comparator) the first time it was applied, so it is worth reaching for before reaching for a compaction-owned field.

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

### What compaction is permitted to do (2026-08-13)

**Added because the later decisions in this plan were read as loosening commutativity, and they do not.** The distinction is worth stating once, plainly, because three different things get called *"the algebra"* and only one of them was ever weakened.

| Tier | Status | What it costs |
| --- | --- | --- |
| **Ops commute with each other** | **Untouched.** No op reads state at fold time; permutation-invariance of the stream is intact | nothing |
| **Compaction is not an op** | It is **serialized and privileged**, and does **not** commute with op delivery | a **delivery-window assumption** --- ops must land well inside a compaction interval |
| **Compaction may *erase*, not only rewrite** | The homomorphism holds over the **clamped** projection, not raw state | depth of disfavour becomes unobservable, deliberately |

**The ledger was never append-only, so that is not what changed.** Ordinary compaction has always removed ops --- folding a subsequence into its aggregate *is* removal --- and it was safe because every removal left a **fold-equivalent replacement**. The ledger was being **rewritten**. What [the deletion decision](#competitive-decay-retired-as-an-evictor-re-opened-as-a-comparator) adds is removal with **no replacement at all**: compaction may now **erase**.

**Why that is affordable, and it is the clamp that makes it so.** Decay had already made the ledger forgetful --- but only **asymptotically**. Exponential decay drives an unused element toward zero without ever arriving, so under an unclamped projection there is always residue and **nothing can ever legitimately be dropped**. **The clamp converts *asymptotically zero* into *zero*,** and once the tail below the floor is unobservable, truncating it in finite time costs nothing. **Deletion does not introduce forgetting; it lets forgetting complete.**

**And nothing durable is at risk, because the ledger is derived and never authoritative** ([P6 clause 5](AGENT.abstractionLayers.proposals.planning.md#proposal-p6-ludiccache-as-the-attention-scoped-reference-structure)). `ludicGraph` holds the facts. The ledger holds a decaying measurement of **demand**, and a measurement decayed past the observable floor is not something anyone can act on.

**The general form, for the primitives still to be designed:** a commutative monoid can **aggregate** but it cannot **forget**. Forgetting requires either making the thing **unobservable**, or stepping outside the algebra into a **serialized** operation. This plan does both, and the whole bill is one timing assumption.

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

## Utility, not attention: what the ledger observes (2026-08-12)

**Proposed from conversation, and it changes what the ledger measures rather than how it is stored.** The frame above had the ledger recording **attention** --- *the observer looked at the table* --- and treating that as a proxy for *"a cache element here would pay off."* This records the payoff **directly**: not that something was attended, but that **a cache element at this address would have saved this much work**. Attention is upstream evidence for that; utility is the thing itself, and it is **measured rather than inferred**.

**This splits the design into two layers with different algebraic characters, and only the first is commutative:**

| Layer | What it is | Character |
| --- | --- | --- |
| **Persisted** | An algebra over **how useful a cache element would be**, folded per address | The commutative monoid of [the algebraic contract](#the-algebraic-contract-2026-08-12) |
| **Compiled** | Translating usefulness across thresholds into **consolidating** caches toward the Room-level fast path, or **dissolving** them back down the traverse path | A state machine over cache shape, **path-dependent** |

**Keeping the layers apart is what makes the rest of this section tractable**, and it is also where `Split` and `Merge` most plausibly live --- see [the inverse trap](#the-inverse-trap-and-why-split-is-where-to-look-for-it), which this framing may dissolve rather than answer.

### Hit and miss emit the same signal

**Emission is licensed to be stochastic rather than immediate** because [clause 4](#the-one-inherited-clause-that-most-changes-how-this-plan-should-be-read) makes ledger misalignment cost **slow**, never **wrong**. Two branches emit it:

- **(a)** having the optimization and **using** it --- the fast path
- **(b)** **not** having it, and judging on the slow path that it would have closed the gap toward a fast-path solution

**Both branches emitting the same signal is load-bearing, not symmetry for its own sake.** It makes the ledger measure demand for a cache element **independently of whether that element currently exists**, so the cache's own state never feeds back into the signal that governs it.

**The failure modes it avoids are specific.** If only misses emitted, every *effective* cache decays toward zero measured utility and gets dissolved precisely when it is most valuable, then thrashes back --- the classic *"a cache that is working looks unused"* trap. If only hits emitted, nothing new can ever be born.

**Sampling is then nearly free:** emit with probability `p` and scale by `1/p`. The fold is additive and decay is linear in the weights, so a sampled ledger is an **unbiased estimator** of the true one. Sampling error surfaces as threshold jitter, never as a wrong answer.

### The weight has a unit: work avoided

**On branch (b) the slow path already knows what it wished it had.** It walked from some start and resolved at some node after visiting `k` of them --- and *"a cache at that start, keyed to that node"* is exactly the element that would have closed the gap. **The walk that was just performed is the signal**, and its length is the weight.

**That makes the monoid's scalar an actual quantity: expected work saved per unit time.** Which closes the open half of **AH-10a** from an unexpected direction --- the `salience -> comparable` projection needed *some* order, and now it has a **principled** one, in units commensurable with the **cost** of holding the element. **The threshold becomes *"utility exceeds residency cost"* rather than a tuned magic number.**

### Two thresholds, and the band they leave

**A single threshold oscillates.** A utility value drifting across one line churns residency, so promotion and demotion must fire at **different** values --- promote at high, demote at low. That is standard, and it is also the point at which the compiled layer **acquires state the ledger does not have**.

**Which grazes [P6 clause 5](AGENT.abstractionLayers.proposals.planning.md#proposal-p6-ludiccache-as-the-attention-scoped-reference-structure).** Cache shape is no longer a pure function of (`ludicGraph`, ledger): for a value inside the band, residency depends on **which direction it arrived from**. With a 0.4/0.6 band, cold rederivation reconstructs correctly below 0.4 and above 0.6, and must **guess** in between.

**The guess is forced by compaction, not by a weak rederivation.** The trajectory *does* determine the state --- but compaction is a homomorphism onto an order-independent fold, so a compacted ledger **provably cannot carry** whether 0.55 was reached on the way up or the way down. The only way to buy the answer is to retain uncompacted trajectory, which is the axis [AH-1](#open-decisions-design--plan-only) has already declined. **Guess, or give up compaction.**

**So the escape is a convergence property, stated rather than assumed:** hysteresis may change **when** a transition fires, never **which steady state** it converges to. Cold rederivation and warm incremental evolution must agree in the limit. **That is a property test**, the same shape as the law-level ones already queued for Channel B, and it is what keeps clause 5 intact.

### The band resolves cold

**Decided: inside the hysteresis band, cold rederivation resolves *absent*.** Not the midpoint --- and the reason is that the two error directions are **not symmetric in how they heal**.

| Error | Healed by | Rate |
| --- | --- | --- |
| **Guessed cold, should be warm** | Misses fire **branch (b)**; utility climbs, crosses high, promotes | **Inversely proportional to how much the element is wanted** |
| **Guessed warm, should be cold** | Decay drags it under the low threshold | **A fixed clock**, regardless of load |

**One error self-heals at a rate set by demand; the other at a rate set by a constant.** Under load --- exactly when it matters --- the cold-default error is the cheap one. **The midpoint does not pick the cheap error**; it narrows the band over which each can occur while leaving both possible, which is the worse trade for the same price.

**A second argument lands the same way, and it is operational.** Cold rederivation happens after the events where the system is already under strain. **A cold band means a rebuild never mass-materializes** --- reconstruction is paid lazily and in proportion to real demand. A warm or midpoint band materializes everything in the band at once: a thundering herd at the worst possible moment. ***"Rebuild is slow and warms back up under traffic"* is a far better failure profile than *"rebuild is a materialization spike."***

**Amended 2026-08-13, and the stakes are lower than this subsection implies.** [The measured fast-path constants](#the-measured-constants) show the marginal cost of one extra resident node is microseconds, so **a wrongly-warm node is nearly free** and the band's protection matters far less than it did when this was written. **The decision stands** --- cold is still the right default, and the rebuild-does-not-mass-materialize argument is untouched --- **but it is no longer load-bearing**, and effort spent tuning the band is effort spent on the cheap axis.

**The sign-off is cheap because the escape hatch is additive.** If band-guessing ever proves expensive, persist residency as a **hint** --- consulted when present, **never authoritative**, clause 5 untouched. The default does not have to be right forever, only right now.

### Branch (b) is the recovery mechanism, not the growth mechanism

**The cold-band default makes branch (b) load-bearing in a way it was not before.** Counting on warm evolution to correct the guess depends entirely on branch (b) firing for elements that are **not there**. Growth was always its visible job; **recovery is now its real one.**

> **Branch (b) is not redundant instrumentation duplicating branch (a). It is the only path by which a cold rederivation ever recovers the elements it guessed away.**

**Stated this bluntly because of the shape of the mistake it prevents.** Someone reading (a) and (b) as two ways of recording the same thing, and keeping only the hit path as the cheaper of the two, would make cold rederivation **permanently lossy across the whole band** --- and nothing would report it, because every symptom is *slow*, which the design is built to tolerate. **This is the same class of error as reading `capture` steps in the manipulation kernel as diagnostics**: the branch that looks like the redundant copy is the one holding the weight. It belongs in the contract in those terms, not as a note.

## What the fast path actually costs, and what that changes (2026-08-13)

**This section exists because three successive cost models in the design conversation were wrong**, each in a way that pushed the design toward machinery it did not need. The corrective was reading the shipped fast path instead of reasoning about it. **The constants below are the load-bearing part; the conclusions are downstream of them and change if they change.**

### The measured constants

**From [`semanticEmbedding/index.ts`](../../../../../packages/mtw-lambda-patterns/ts/semanticEmbedding/index.ts):** embeddings are **256 dimensions, int8-quantized** --- `SEMANTIC_EMBEDDING_V1_DIMENSIONS = 256`, `SEMANTIC_EMBEDDING_V1_ENCODING = 'int8-v1'`. **One embedding is 256 bytes.**

**That single fact decides the sizing question**, and it is worth stating why. The intuitive worry --- *"dozens of entries each with a noticeably sized embedding must be slow to read"* --- is **correct for a stock 1536-dimension float32 vector serialized as a JSON number array**, which runs ~20KB each. Dozens of those exceed DynamoDB's **400KB item limit outright**. The representation here is roughly **80x smaller**, and being DynamoDB Binary it also avoids the real cost of the naive form: parsing tens of thousands of decimals out of AttributeValue JSON.

| Quantity | Value |
| --- | --- |
| One node (embedding + id + name + misc) | **~400 B lean, ~650 B with relations** |
| 200-node `ludicCache` record | **~80--130 KB**, i.e. a **3--5x** margin under the 400KB item limit |
| Real node ceiling | **~600--1000 nodes** |
| Read of a 60-node record | ~21KB raw, 8 RCU strongly consistent, sub-millisecond wire time |
| Scoring 60 candidates | ~30k int8 ops plus short-string Sellers matching: **well under 1 ms** |
| An abstention | **an LLM round trip: hundreds of ms to seconds** |

> **Marginal cost of one more resident node is ~0.35KB and microseconds. Marginal cost of one wrong abstention is ~1000x that. Read cost is not a residency criterion.**

**One inversion falls out and should not be forgotten:** at these sizes DynamoDB latency is **round-trip dominated, not byte dominated**, so the pressure is toward a **fatter** consolidated record rather than a lean one. Sixty entries in one read beats sixty reads by two orders of magnitude.

**The dependency this inherits, which no code links:** the entire analysis rests on the 256-dim + int8 decisions in the embedding layer. **A model change to 1536-dim float32 reinstates the original concern at ~80x** and pushes a few dozen nodes past the item ceiling. **`ludicCache` sizing is coupled to the embedding encoding, invisibly.**

### Residency and presentation, priced the wrong way round

**The useful distinction is that holding a node *resident* and putting it *in front of an LLM* are different decisions with different cost curves.** The conversation first priced residency as cheap (storage) and presentation as expensive (tokens, distractor accuracy). **That is backwards for this application**, and the reason is [`resolveCatalogSpanToPool.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/resolveCatalogSpanToPool.ts): an **exact unique match short-circuits without embedding at all**, so a command like `get bag` never reaches the LLM.

**On the common commands there is no LLM latency to hide behind** --- the fast path *is* the entire player-visible latency. On the rare complex command, the LLM round trip swamps everything and fast-path cost is noise. **So residency is the hot axis and presentation is the cold one**, which is the reverse of the usual cache intuition and the reverse of where the first analysis went.

**What the measured constants then do is dissolve the axis anyway:** residency is hot in *frequency* but its marginal cost is microseconds, so **neither axis supports a capacity limit.**

### Abstention scales with sibling density, not with set size

**The claim that each additional resident node is another chance to breach `T_MARGIN` is technically true and practically vacuous.** In 256 dimensions a bookcase and a wastebasket are nowhere near each other; the marginal abstention risk of a *random* additional node is approximately zero.

> **Abstention risk is a function of sibling density --- two books, three ropes, a shelf of jars --- and sibling density is a property of the fiction the author wrote, not of any cache policy.**

**You cannot evict your way out of it**, because the siblings are exactly the things plausibly meant. **This decouples the residency question from the abstention question almost entirely**, and removes the last cost argument that made a bounded resident set look necessary.

### Attention near the accept gate can produce fast-wrong

**The most consequential finding in this section, and it constrains rather than enables.** [`decideEmbeddingMatch.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/decideEmbeddingMatch.ts) abstains when `best.similarity - second.similarity < T_MARGIN`, and abstains **unconditionally** on duplicate short names. Abstention hands the command to the slow path, which is the correct outcome on the evidence available.

**An obvious-looking use of attention is to add salience as a third relevance channel beside `lex` and `embed`, widening the margin in favour of what was recently attended.** It converts abstentions into resolutions and saves a round trip. **It also breaks [clause 4](#the-one-inherited-clause-that-most-changes-how-this-plan-should-be-read).**

> **An attention record that widens a margin does not degrade to slow when it is wrong. It resolves confidently, silently, and wrongly, fast.** That is the one failure this plan calls non-negotiable, and it is the first proposed mechanism that can cause it.

**Filtering does not escape the problem**, which is what makes it structural rather than a choice of mechanism: narrowing the candidate pool by attention *before* scoring removes the competitor whose presence would have fired the margin gate. **Suppression is inherent to using attention near the gate.**

**Two escapes, to be graded rather than assumed** --- both are in [A10](AGENT.attentionHistory.corpus.planning.md#a10-the-book-on-the-table-and-the-books-on-the-shelf), which exists to decide between them:

1. **Attention orders but never gates.** It ranks what the slow path is shown and is barred from influencing `T_MARGIN`. Clause 4 preserved exactly; the round trip is not saved, only better aimed.
2. **Attention may gate, but narration must disclose the assumption.** *"You pick up the book you were reading."* **The escape only a narrative system affords** --- fast-wrong-and-announced is visible and correctable in the next beat where fast-wrong-and-silent is not. Whether that is a genuinely different category is a fiction judgement, not a mechanical one, and it should not be dismissed for failing to be a guarantee.

**See AH-12**, opened for this.

### Write cost, and the second argument for two layers

**One DynamoDB property decides the shape of the write path:** the cost of an update is based on the **total item size**, not the size of the change. A single-path `SET #nodes.#id = :val` against a 100KB item still costs **~100 WCU**.

**Granular path updates buy freedom from lost updates and contention. They do not buy cheap writes.** So if attention events ever land directly on the `ludicCache` record, **every event costs ~100 WCU**.

**This independently justifies the two-layer split** arrived at on conceptual grounds: **the ledger must be small, separate, high-write items; `ludicCache` must be the large, low-write, compiled artifact touched only at threshold crossings.** The compiled layer is not merely tidy --- it is what keeps the fat record off the write path.

**Concurrency on the large record is a cost problem, not a correctness one**, and [clause 5](AGENT.abstractionLayers.proposals.planning.md#proposal-p6-ludiccache-as-the-attention-scoped-reference-structure) is why: `ludicCache` is derived and never authoritative, so conditional writes are unnecessary and last-writer-wins is acceptable. **A lost update yields a stale cache, which yields a slow path.** What non-granularity does cost is **blast radius** --- one lost write discards everything a concurrent writer did, not one entry.

### Competitive decay: retired as an evictor, re-opened as a comparator

**Retired 2026-08-13 and re-opened the same day, by the user, on two refinements that hold.** Both halves are kept: the retirement reasoning was right about what it indicted, and wrong about how much it indicted.

The proposal: on a fast-path resolution, credit the hit and apply a small decrement to the candidates that lost, producing decay driven by *use* rather than by a clock.

**It has one elegant property, and it survives everything below.** Because the decrement is **uniform**, it factors: maintain a per-level counter `C`, store per node its own credit and the `C` at creation, and read `salience_i = credit_i - (C_now - C_i)`. **One write for the counter, one for the hit, none for the losers --- O(1), exact.** This is the additive twin of the decay-epoch trick, and it reframes the two candidate operators as **one operator at two addressing granularities**: a decrement written at the *level* address (cheap, imprecise) versus at *node* addresses (exact, O(N) emission).

#### What retired it, and what repaired it

**The recorded failure was calibration.** Equilibrium population is `N = w/D`, so the mechanism **forces a specific population rather than discovering the right one**, and the required `D` scales with the working set --- the number it was meant to find. Closing a control loop on that is circular, because the setpoint *is* the working set.

**The repair is to let the planner normalize the decrement by resident-set size.** The planner knows `N` for the cache it is crediting, so it emits `D/N` rather than `D`. An item hit at frequency `f_i` then nets `f_i*w - D/N` per event and survives iff

```
f_i > (D/w) * (1/N)
```

`1/N` is the mean sibling hit rate, so the criterion reads **"hit at least `D/w` as often as the average sibling."** It is dimensionless and identical at every working-set size:

| Room | Item's share of hits | Break-even, unnormalized | Break-even, normalized by `N` |
| --- | --- | --- | --- |
| Uncluttered, working set 2 | ~1 in 2 | `w ~= D` | `w > D` |
| Cluttered, working set 100 | ~1 in 100 | `w ~= 99 D` | `w > D` |

**The 99x spread collapses to 1x, and the setpoint stops being the unknown.** `D/w` becomes a relative-frequency threshold rather than a capacity, which is what the row needed.

**Normalize by `N`, not by miss count.** The two differ only by an off-by-one in the arithmetic, but miss count breaks on the case that matters most: [`resolveCatalogSpanToPool`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/resolveCatalogSpanToPool.ts) short-circuits exact unique matches **without scoring anything**, so `"get bag"` --- the commonest command shape in the game --- produces a hit with **zero** misses. Miss-count normalization divides by zero there and emits no decay at all on the highest-signal events. Resident-set size is also the only figure that is defined for **branch (b)**, where there is no candidate list.

**The user's original numbers were already in normalized form:** twenty items, decrement 1/40th of the hit bonus, is `D/N` with `D/w ~= 0.475` --- *survive if hit at roughly half the average sibling rate*. Which is probably why the retirement felt premature.

#### The birth floor, and why it needs no first-operation test

**A new node is born at credit 0 while `C` has already risen, so it starts below the floor and can never enter.** The fix is the `C_i` term the factoring already carries: capture the floor **at emission** and store it on the element. This is the legitimate escape from state-dependence --- a constant baked into the operation rather than read at fold time.

**Combine `C_i` by `min`, not by an additive bonus.** Additive compensation is commutative but not idempotent, so two concurrent planners that both see the node as new both credit the birth and it starts at double weight. `min` is commutative, associative **and** idempotent, so duplicate births are harmless.

**Then the first-operation test disappears entirely.** Because the floor is **monotonically non-decreasing** and `min` retains the earliest observation, emitting `C_i := min(C_i, observed_floor)` on *every* operation converges on exactly what a correct first-operation test would have produced. **The fold answers "is this the first?", so the planner never has to.** That is worth more than the saved branch: the test was a state-dependent decision made against a **stale view**, and a stale "not present" would have produced a spurious second birth. Unconditional emission has no test to get wrong. It is also free --- `C_i` rides the same ledger item as the credit update, so it costs no extra round trip.

**The per-item algebra is then a product of two commutative monoids** --- `credit` under sum, `C_i` under min, identity `(0, +inf)` --- so an absent element naturally adopts the first floor it sees, and compaction folds both components. **The homomorphism survives**, which is what killed the other candidates in this line and does not kill this one. Cold rebasing is itself just a compaction: subtract `C` from every credit and set `C = 0`.

#### What the retirement got right, and what it therefore forces

**The population argument stands, and it is the load-bearing one.** Marginal residency is ~0.35KB and microseconds; a wrong abstention is ~1000x that. **A perfectly calibrated evictor still solves a problem this system does not have**, and eviction is the dangerous direction, since dropping a node the player then references costs a traverse while keeping it costs nothing.

**So the repairs do not restore the original role --- they change it.** What the normalized form actually produces is a **sibling-relative comparator**: *is this element pulling its weight against the others in its cache?* That is the input the **compiled** layer needs for consolidate-toward-Room-level versus dissolve-back-down-the-traverse-path, and it is a candidate answer to AH-10a's `salience -> comparable` projection, which has a unit but no sibling-relative ordering. **The mechanism was never wrong; it was pointed at the wrong decision.**

**The reusable lesson is unchanged and should not be softened by the reprieve:** every proposal in this line was a **population controller**, and population was never the cost. **Prior art on caching anchors hard to fixed capacity**, and at this application's scale storage is effectively unbounded --- the real constraint is return on investment, primarily latency. **Watch for that anchor re-entering as a "safety backstop."** It did once already.

#### Three riders, carried into AH-10a

**Re-entry ratchets shut. Decided 2026-08-13: compaction deletes, once the deficit exceeds one interval's decay.** `min` pins `C_i` at the first floor ever observed, permanently. Under the evictor framing the problem was invisible, because eviction deleted the record and the next birth was genuinely first. Under the comparator framing **nothing is deleted** --- a dissolved node keeps its ledger entry --- so `C_now - C_i` grows without bound and an element that falls out of favour and later becomes hot again is **locked out of the fast path forever**. That inverts demand, which is the failure this whole line exists to avoid.

**Rebase and delete are the same illegal move, and that is the first thing to see.** Both raise `C_i`, which is precisely what `min` exists to forbid. **The ratchet is therefore not a bug inside the algebra but the price of an idempotent birth**, and either fix must be a **privileged compaction-time operation** that can never be expressed as a ledger entry. Do not spend effort looking for an in-algebra version; there is not one.

**Two things are not discriminators.** The projection must be clamped to `max(0, ...)` under **both** options --- an absent element and a zero-salience element have to project identically, or the compiled layer can tell them apart and the homomorphism breaks in the same place --- so both hold over the clamped value and neither over the raw pair. **And the clamp alone fixes nothing:** an element at credit 100 with `C_i = 0` and `C_now = 500` clamps to zero, and ten further hits leave it clamped at zero. It never climbs out. One of the two is genuinely required.

**Delete wins on three grounds, none of them storage.** *(Arguing it on ledger growth would be the fixed-capacity anchor walking back in --- entries are tens of bytes and population was never the cost. If deletion wins it wins on semantics.)* **It discards accumulated credit, which a sibling-relative comparator should want** --- under a criterion meaning *"hit at least `D/w` as often as the average sibling right now,"* ancient credit is contamination rather than evidence. **It gives full-speed recovery**, where rebasing leaves a residual deficit equal to decay-since-last-compaction, making recovery depend on where the compaction schedule fell. **And it is a candidate answer to AH-6**, which wants a second way to move a window's start in a room that never empties and flags oldest-first degradation as *suspect* because oldest and no-longer-salient differ. **Deletion on sub-zero is the non-suspect version: the window shrinks by demand rather than by age.** That is the strongest reason and also the least confirmed --- **A9 should confirm it rather than this section asserting it**.

**The cost of deleting, and the rule it forces.** Deletion does not commute with in-flight credit: compaction removes an element, an operation emitted beforehand lands afterwards, finds no entry, and `min` against the identity captures its own **stale, low** floor --- so the element resurrects deeply underwater and is born dead. **Deleting an element the moment it crosses zero is therefore wrong**; deletion has to wait out the delivery window.

**The rule: delete when the deficit exceeds one compaction interval's decay.** Compaction already holds the floor at the previous compaction --- one number per cache, next to `C_now` --- so with `C_prev` in hand the test is

```
delete when   credit_i - (C_now - C_i)  <  -(C_now - C_prev)
```

**An element that crossed zero just before this compaction has a deficit near zero and survives; one under for two intervals is well past the threshold and goes.**

**This was arrived at 2026-08-13 by replacing a per-element strike counter, and the reason it is better is worth keeping.** The counter tracked *the same difference against every element* when the quantity being tested is a property of the **cache**, not of its members. Removing it gains three things. It is **continuous rather than discrete**, so an element hovering at zero drifts across the threshold instead of flipping a bit and thrashing. It **accounts for hits automatically**, since credit received during the interval shrinks the deficit with nothing having to observe it. And it is expressed **in floor units rather than in compaction events**, so it introduces no clock --- a strike counter would have added a **third** clock running on compaction cadence, behind AH-4's back, at a point where that row has already been narrowed to *which clock*.

**It also self-heals the resurrection case** rather than merely making it rare: a resurrected element's deficit is enormous immediately, so it is deleted again at the very next compaction instead of lingering as a live-looking entry with permanently suppressed salience.

**The assumption it rests on, stated so it can be tested:** op delivery is bounded well inside a compaction interval. A strike counter assumed exactly the same thing while hiding it.

**And the general rule the discarded counter yielded, which outlives it:** the strike state had to be **cleared** when an element recovered, and `strike := 0` does not commute with `strike += 1`. **Anything that must be reset by ordinary activity cannot live in the op stream** --- the monoid accumulates and it takes minima, and that is all it does. **Such state belongs to compaction, or it belongs to a quantity that can be derived instead.** Prefer derived: it was available here, and the search for it is what removed the clock.

**`min` selects the stalest observation.** A stale-low `observed_floor` yields a low `C_i`, and low `C_i` means low salience, so staleness **suppresses**. Taking the minimum over many observations therefore picks the most-suppressed. Magnitude is bounded by in-flight decay over the concurrency window --- order `concurrency * D/N` against a hit bonus `w`, a fraction of one hit at plausible numbers, and self-correcting as credit accrues. **But it errs toward suppressing a newcomer, which is the direction that costs a traverse.** If it is worth a constant, emit `observed_floor + g`; `min` still pins it.

**The floor is per-`ludicCache`, so salience is meaningful only within one cache.** Cross-cache comparison needs a second normalization that does not exist yet --- which AH-10a must state rather than discover, since the projection is the seam the cache reads.

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
| **AH-4** | **Does salience decay with elapsed time, with successive actions, or both?** And does re-surfacing **refresh** or **accumulate**? ([A8](AGENT.attentionHistory.corpus.planning.md#a8-the-lever-pushed-once-and-the-lever-that-is-the-whole-scene)). **Substantially narrowed 2026-08-12 by [the algebraic contract](#decay-is-a-property-of-the-element-not-an-operator).** The three-way choice collapses to **which clock the decay constant runs on** --- wall-clock, a monotonic action counter, or both --- because the algebra is identical in each case and *"both"* is a product of exponentials, `W = w * e^(Lt*t + Ln*n)`, still **one scalar**. So the expensive-looking answer is free, and what remains is the genuine fiction question of **which clock**, which A8 and A9 can decide. **The decay *law* is no longer open:** exponential is forced, since nothing else compacts. **`refresh` versus `accumulate` is also no longer representational** --- accumulate is `+`, refresh is `max`, both commutative monoids --- so that half stays an honest fiction question. **One consequence added 2026-08-12, which raises the stakes on *which clock*:** under [the cold-band default](#the-band-resolves-cold), decay is the **sole** healing mechanism for a wrongly-*warm* element --- nothing accelerates it, because an unused element generates no signal. **So the decay clock is not only fiction; it sets the recovery rate for one of the two guess errors**, and a clock that runs on player actions stalls entirely in a quiet room where wall-clock would not | new | **Open, narrowed to *which clock*** |
| **AH-5** | **Do negative and newly-minted facts take salience?** *"Is there a screwdriver?" --- "No."* If the minted absence is not recorded, the second ask can mint a **different** answer ([A4](AGENT.attentionHistory.corpus.planning.md#a4-is-there-a-screwdriver--no)). Touches [P5](AGENT.abstractionLayers.proposals.planning.md#proposal-p5-improvisational-licence-as-a-first-class-graph-item) directly. **Second argument added 2026-08-12, from a different direction:** negatives are the entries that **do not commute** ([why](#positive-entries-commute-negative-entries-do-not)), since a negative is a claim about the world rather than about the observer. **Algebra and correctness reach the same answer** --- keep negatives out of the ledger --- which is worth more than either argument alone. **What that does not do is dissolve the row:** A4's minting problem is real, and the answer this now points at is that the record belongs somewhere **other than** the attention ledger. Where, is still open | new | **Open --- but leaning firmly *not in the ledger*, on two independent grounds** |
| **AH-6** | **What resets a window, in a room that never empties?** The parent's PC-1 verbatim. **Room-empties is a valid boundary where it fires**; what is missing is a second way to move a window's start. Candidates: per-character windows layered over the shared one, oldest-first degradation (**suspect** --- oldest and no-longer-salient are not the same thing), or a heat-based reset borrowing [P4's narrative heat](AGENT.abstractionLayers.proposals.planning.md#narrative-heat-the-optimization-that-is-probably-not-only-an-optimization). **A decaying record set may shrink this row rather than answer it** ([A9](AGENT.attentionHistory.corpus.planning.md#a9-the-busy-hub)). **A concrete candidate arrived 2026-08-13 from an unrelated direction:** if compaction [deletes sub-zero elements](#competitive-decay-retired-as-an-evictor-re-opened-as-a-comparator), the ledger self-prunes and **the window's start moves by demand rather than by age** --- which is exactly the non-suspect form of the degradation this row rejected, arrived at without being designed for it. **It was adopted for its own reasons and this row is downstream of it, so do not treat it as settling AH-6** --- A9 has to confirm that demand-pruning actually resets a busy hub's window, rather than pruning the long tail while the hub's own start never moves | **PC-1** | **Open --- but with a candidate mechanism it did not have** |
| **AH-7** | **Does traversal on the *reasoning* path confer salience?** An LLM opening a bag to answer a question almost certainly must **not** promote for the player --- different consumer, and it leaks detail nobody in the fiction learned. Stated as near-certain so that [A7](AGENT.attentionHistory.corpus.planning.md#a7-the-llm-opens-the-bag) can falsify it rather than assume it | new | Open, leaning **no** |
| **AH-8** | **Are matchable *names* denormalized into entries, or resolved per address?** One read versus a denormalization that must invalidate on rename. Names live in the asset/WML layer. Downstream of AH-1 | new | Open |
| **AH-9** | **Which attention ops compile, and which need live grounding?** Opened 2026-08-12 with [the ledger proposal](#the-attention-ledger-as-an-instruction-set-2026-08-12). **A cheap discriminator exists and both answers are already shipped patterns in this lane:** ops that depend on **narrative intent** (`Surface`) can expand from the abstract op at compile time, the way the shared membership adapter does for fixed targets; ops that depend on **current cache shape** (`Merge` / `Split` --- whether contents promote into the room's node depends on what is already there) need live state, the way the Synthesize executor is re-run at execute time for commands needing live grounding. **So this is a choice between two existing mechanisms rather than an invention.** **One trap added 2026-08-12 --- work the primitive set with it in view:** if `Split` is expressed as **subtraction** of weight a `Merge` added, the ledger leaves a monoid for a **group**, and inverses interact badly with element-carried decay ([why](#the-inverse-trap-and-why-split-is-where-to-look-for-it)). **Ops that assert removal are the ones that break the algebra**, which is the negatives problem in a second guise. **A candidate escape strengthened 2026-08-12 by [the two-layer split](#utility-not-attention-what-the-ledger-observes-2026-08-12):** if the persisted layer records only **usefulness** and the **compiled** layer owns consolidation and dissolution, then `Split` and `Merge` are residency operations that **never appear as ledger entries at all**. Dissolving a cache is then not subtraction --- it is the compiled layer declining to materialize something whose utility fell below cost, while the ledger merely decays. **The monoid stays a monoid and never needs inverses**, which would dissolve the trap rather than answer it | new | Open |
| **AH-10** | **Split 2026-08-12 into AH-10a and AH-10b; do not use this ID.** It was conflating a requirement row with a representation row --- [the exact error](#why-this-is-a-separate-plan) this plan was created to stop making, one seam over. **The tell was that it felt like it blocked more than it should** | new | **Superseded --- see AH-10a / AH-10b** |
| **AH-10a** | **What laws must the ledger's output obey?** The requirement half, and **answerable now**: commutative and associative fold with identity, compaction as a **homomorphism**, decay carried on the element, plus a **`salience -> comparable` projection** so the cache can threshold. **Proposed in full by [the algebraic contract](#the-algebraic-contract-2026-08-12)** and awaiting nothing but a decision to adopt it. **This --- not the carrier type --- is what must hold before the three channels run apart**. **The projection gained a *unit* 2026-08-12** from [the utility frame](#the-weight-has-a-unit-work-avoided): weight is **work avoided**, so salience is expected work saved per unit time and thresholds are expressible **against residency cost** rather than tuned. That does not change what the row asks, but it removes the worry that the ordering would be arbitrary. **A concrete candidate for the projection arrived 2026-08-13** from [competitive decay's narrowed role](#competitive-decay-retired-as-an-evictor-re-opened-as-a-comparator): a per-cache floor counter with `credit` folded by `+` and the birth floor `C_i` folded by `min`, giving `salience_i = credit_i - (C_now - C_i)` and the **sibling-relative** reading *"hit at least `D/w` as often as the average sibling."* It is a product of two commutative monoids, so it satisfies this row's laws as stated, and it is O(1) per event. **Two of the three loose ends are now closed:** the projection **is** clamped at zero, and compaction **deletes** sub-zero elements rather than re-basing them, once their deficit exceeds one compaction interval's decay --- which means **this row's homomorphism law holds over the clamped projection, not the raw pair**, and that weakening must be written into the law rather than discovered by a property test. **[What compaction is permitted to do](#what-compaction-is-permitted-to-do-2026-08-13) states the three tiers this row must encode** --- ops commute, compaction does not commute with ops, and compaction may erase rather than only rewrite. **What stays open is cross-cache comparison**, since the floor is per-cache and nothing normalizes between them | AH-10 | **Proposed; adopt to unblock Channel B** |
| **AH-10b** | **What carrier type do entries fold in?** The representation half, **deliberately deferred and downstream of AH-9's primitive set**. `(address -> scalar, epoch)` with exponential decay is the [worked model](#the-scalar-model-kept-in-its-place) and the obvious iteration-1 choice; composite or nested primitives need a richer carrier and the laws are indifferent. **Allowed to churn** --- blast radius is one interpreter layer. **The one thing that must be re-checked on every change** is the salience projection from AH-10a, which is the only cache dependency that is not algebraic | AH-10 | **Open, and deliberately not blocking** |
| **AH-11** | **Can the slow path name the element it wished it had, and what does asking cost?** [Branch (b)](#hit-and-miss-emit-the-same-signal) is the whole basis for measuring utility of caches that **do not exist**, and after [the cold-band default](#the-band-resolves-cold) it is also the **only** recovery path for elements a rederivation guessed away. **The optimistic case is that the signal is nearly free:** a traversal that walks from a start and resolves at a node after `k` hops already holds both endpoints and the hop count, so the emission is the walk it just did. **What is unverified is whether every slow path is shaped that way** --- traversals that fail, that fan out, or that resolve through several candidate routes may have no single element that *"would have closed the gap,"* and a counterfactual judgement that is wrong is fine (it degrades to slow) but one that cannot be **made at all** leaves a blind spot in the ledger. **Check against A9 and A3 specifically**, which are the cases with non-trivial walk shape. **Gained a cheap instrument 2026-08-13:** the parent's **C7** logs the counterfactual miss against real traversals **before any ledger exists**, so this row can be scoped against observed walk shapes rather than reasoned about --- and *"is there a walk that cannot name the element that would have closed the gap"* becomes a thing to **count** in the logs. **That is this row's answer arriving as data**, which is the same corrective [the cost-model section](#what-the-fast-path-actually-costs-and-what-that-changes-2026-08-13) applied three times to reasoning that had gone wrong in the abstract | new | **Open --- but instrumented ahead of the build** |
| **AH-12** | **May attention influence the accept/abstain gate at all?** Opened 2026-08-13. `decideEmbeddingMatch` abstains inside `T_MARGIN`; salience could break that tie and save an LLM round trip, **but a wrong attention record then yields fast-wrong rather than slow** ([why](#attention-near-the-accept-gate-can-produce-fast-wrong)), which [clause 4](#the-one-inherited-clause-that-most-changes-how-this-plan-should-be-read) forbids. **Filtering the candidate pool has the same disease**, since removing a competitor suppresses the gate --- so this is not answerable by choosing filter-versus-rank. **Two candidate escapes:** attention **orders but never gates**, or attention gates and **narration discloses the assumption**, converting silent-wrong into visible-wrong. **[A10](AGENT.attentionHistory.corpus.planning.md#a10-the-book-on-the-table-and-the-books-on-the-shelf) exists to decide it**, and it is the first row where the fiction has standing the mechanism does not | new | **Open --- and the only row that can violate clause 4** |

**Not inherited: PC-3** (*is the cache persisted or rebuilt per request*) **stays in the parent** --- it is about `ludicCache`'s storage rather than attention's semantics. It depends on AH-1 and should not be settled before it.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as each is done.

**These phases are no longer strictly sequential, as of 2026-08-12.** [The ledger-as-instruction-set frame](#the-attention-ledger-as-an-instruction-set-2026-08-12) decouples three channels --- abstraction-fractal, attention-ledger, `ludicCache` --- so a naive ledger and a first cache iteration can proceed **while** the corpus is worked, provided **AH-10a** (the fold's algebraic laws) is settled first --- **not** AH-10b, the carrier type, which is allowed to churn behind the interpreter layer. **The one ordering that must not be broken:** no corpus case is graded against what an iteration happens to do. **The corpus judges the iteration, never the reverse.**

**Amended 2026-08-13: the cache iteration and the ledger have come apart, and the cache went first.** The parent plan adopted [a `ludicCache` iteration ladder](AGENT.abstractionLayers.proposals.planning.md#the-ludiccache-iteration-ladder-exhaustive-first-persisted-second-2026-08-13) whose **iteration 1 is exhaustive** --- every referrable node in the room, derived per request, **no ledger at all** --- and elected it a Prototype. **That changes this plan's critical path in one specific way: AH-10a is no longer blocking anything that is currently being built.** A cache with no salience needs no fold, no laws and no ordering, so the laws are the precondition for **the ledger channel only**, which is what Channel B is now scoped to. **This is a narrowing, not a demotion** --- AH-10a still gates every line below, and the reason it looked broader was that the cache used to ride along with the ledger.

**What the parent's iteration buys this plan is better than a schedule slot: it buys data before the build.** Its step **C7** logs [branch (b)](#hit-and-miss-emit-the-same-signal)'s counterfactual --- *what would have missed under attention-scoping* --- **without acting on it and without a ledger existing.** So the question *does the ledger earn its build* stops being a judgement call and becomes a measurement, and **[A9](AGENT.attentionHistory.corpus.planning.md#a9-the-busy-hub) becomes an early measurement rather than a late surprise**, which is exactly what [the cost of starting naive](#what-this-does-to-ah-1-and-it-is-the-largest-consequence) hoped for and had no way to obtain.

**One hazard travels with the good news, and it is this plan's to hold.** An exhaustive cache **neutralizes AH-3 rather than answering it** --- everything is promoted, so [A3](AGENT.attentionHistory.corpus.planning.md#a3-the-box-inside-the-box) cannot be worked against it. **Nobody may read the prototype's behaviour back as the depth answer.** That is the corpus-judges-the-iteration rule above, meeting its first real opportunity to be broken.

- [ ] **Phase 0. Work the corpus.** Ten seed cases, in the corpus file.
  - [ ] A1--A2 (persistence and reset)
  - [ ] A3 (depth of promotion) --- **run early**; AH-3 blocks the most other rows
  - [ ] A4 (negative and minted facts)
  - [ ] A5--A7 (who and how salience is conferred)
  - [ ] A8--A9 (decay shape, and the busy hub)
  - [ ] **A10 (ambiguity suppression)** --- **run early, alongside A3**; it decides **AH-12**, the only row that can violate clause 4, and its answer constrains what any iteration is allowed to do at the accept gate
  - [ ] Fill the retention-axis tally as cases land; **do not fill it up front** --- it is the corpus's output, not its premise
- [ ] **Phase 1. Answer the requirement rows** --- AH-2 through AH-7 --- from the worked cases only.
- [ ] **Phase 2. Then AH-1**, the retention question, and only then. Re-check AH-8 against the answer.
- [ ] **Channel B (parallel, once AH-10a is settled). The naive ledger.** **Re-scoped 2026-08-13:** the first `ludicCache` iteration left this channel and shipped ahead of it as [an exhaustive, ledger-free Prototype](AGENT.abstractionLayers.proposals.planning.md#the-ludiccache-iteration-ladder-exhaustive-first-persisted-second-2026-08-13) in the parent's Channel C. **This channel is now the ledger and nothing else.**
  - [ ] **Gate the whole channel on the parent's C7 data**, not on a date. C7 logs the counterfactual miss with no ledger built, so **whether this channel is worth opening is a measurement** --- if the exhaustive cache is not missing anything worth measuring at play volume, the ledger has not earned its build yet and the honest status is *waiting*, not *behind*
  - [ ] Settle **AH-10a** --- the fold's algebraic laws, plus the salience ordering. Nothing else here starts first. **AH-10b is explicitly not a precondition**
  - [ ] **Write the law-level property tests first** --- permutation-invariance of cache state over arbitrary entry sequences, `fold(compact(S)) = fold(S)`, and identity. **They come before the primitives they constrain**, because they are what makes the seam enforced rather than agreed, and they are the only thing that catches a later primitive quietly breaking commutativity
  - [ ] **Add the convergence property test alongside them** --- for a band value, cold rederivation and warm incremental evolution reach the same **steady state**, differing only in **when**. This is what keeps [P6 clause 5](AGENT.abstractionLayers.proposals.planning.md#proposal-p6-ludiccache-as-the-attention-scoped-reference-structure) intact once the compiled layer carries hysteresis state
  - [ ] Add an attention op to `PositionKernelOp` and expand it in `kernel/compile/`; **no aggregation ops in iteration 1**
  - [ ] **Emit on *both* branches from the start** --- fast-path hit **and** slow-path miss. Branch (b) is [the recovery mechanism](#branch-b-is-the-recovery-mechanism-not-the-growth-mechanism), not spare instrumentation, and an iteration that ships with only (a) will look correct while quietly losing the band forever
  - [ ] Scope **AH-11** against real traversals before committing to the (b) weight --- confirm the slow path can actually name the element that would have closed the gap
  - [ ] Pick the idempotency stance --- **dedup keys or accept the drift** --- rather than inheriting it. Counting is [deliberately not idempotent](#two-costs-recorded-so-they-are-chosen)
  - [ ] **If the floor-counter projection is adopted, emit the birth floor unconditionally** --- `C_i := min(C_i, observed_floor)` on every operation, never behind an *"is this the first?"* test. The test reads stale state to choose an emission; [`min` lets the fold decide instead](#competitive-decay-retired-as-an-evictor-re-opened-as-a-comparator). **Add a property test that a duplicated birth changes nothing**, since that is the whole reason for `min` over an additive bonus
  - [ ] **Compaction deletes an element once its deficit exceeds one interval's decay** ([decided](#competitive-decay-retired-as-an-evictor-re-opened-as-a-comparator)) --- store `C_prev` per cache alongside `C_now`; **no per-element deletion state**. The projection is **clamped at zero**, and the homomorphism law must be **stated over the clamped projection**, since it does not hold over the raw pair --- a property test written against the pair will fail correctly and be *"fixed"* in the wrong direction
  - [ ] **Test the resurrection case explicitly** --- an operation emitted before a compaction that deletes its target, folded after it. Deleting on first crossing resurrects the element underwater with a stale-low `C_i`; the interval rule must not, and must delete the resurrected entry again at the next pass. **This is the only reason deletion waits at all**, so it is the only thing that stops the rule being simplified back to *"delete on sub-zero"*
  - [ ] Filter it on the **narrate** branch of `presentStepSequence`, post-commit; assert **footprint exemption** with a test, so the constraint is enforced rather than remembered
  - [ ] **Keep attention out of `decideEmbeddingMatch` until AH-12 is answered.** Iteration 1 may rank, log and materialize; it may **not** influence `T_MARGIN` or pre-filter the candidate pool, because both [suppress ambiguity checks that have a real basis](#attention-near-the-accept-gate-can-produce-fast-wrong) and turn a slow degradation into a wrong one
  - [ ] **Write attention to small separate ledger items, never into the `ludicCache` record.** DynamoDB charges updates against **total item size**, so an event landing on the big record costs ~100 WCU regardless of how little it changes
  - [ ] Elect the iteration a **Prototype** with a named rollback trigger, per PL-1 iteration 1's precedent
  - [ ] Measure ledger growth against [A9](AGENT.attentionHistory.corpus.planning.md#a9-the-busy-hub); it is the trigger for whether aggregation ops are iteration 2
- [ ] **Phase 3. Feed back to the parent.** Close or re-base PC-1/PC-2, re-check PC-3, and confirm P6 clause 2's depth wording against AH-3's answer.
- [ ] **Phase 4. Graduate or retire.** Move durable rules to [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md), vocabulary to [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md), then delete this plan and its corpus per [`taskPlanning/AGENT.md`](../../../../AGENT.md).
  - [ ] **Before deleting, record which of this design's properties were load-bearing and which were incidental** --- and specifically **which of them depended on [wrong degrades to slow](#the-one-inherited-clause-that-most-changes-how-this-plan-should-be-read)**. The parent parks [a recognition-side parallel](AGENT.abstractionLayers.planning.md#measuring-when-to-mint-and-dissolve-an-abstraction-2026-08-13) whose unpark trigger is *this plan having been built and iterated*, and that park cannot inherit clause 4. **The harvest is cheap only while the implementation experience is fresh**; a graduated contract records the rules, not which of them were free

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
| **Ledger re-based on *utility*; two layers separated; hysteresis band resolves cold** | **Done (2026-08-12).** From conversation, proposed by the user. **What the ledger observes changed, not how it is stored:** it records *"a cache element here would have saved this much work"* rather than *"this was attended."* Attention is upstream **evidence** for utility; utility is the thing itself, and it is **measured rather than inferred**. **Two layers, only the first commutative:** a **persisted** algebra over usefulness (the monoid), and a **compiled** layer translating threshold crossings into consolidation toward the Room-level fast path or dissolution back down the traverse path. **The load-bearing detail is that hits and misses emit the same signal** --- which makes the ledger measure demand **independently of whether the element exists**, so the cache's state never feeds back into the signal governing it, and *"a cache that is working looks unused"* cannot happen. **The weight acquired a unit:** the slow path's own walk is the signal and its hop count is the weight, so salience is **work saved** and thresholds compare against **residency cost** instead of being tuned --- which closes AH-10a's ordering worry from an unexpected direction. **Stochastic emission is licensed by clause 4 and nearly free:** sample at `p`, scale by `1/p`, unbiased because the fold is additive and decay linear. **Two thresholds are required to stop oscillation, and they cost clause-5 purity:** inside the band, residency depends on arrival direction, and **compaction provably destroys that** --- the guess is forced by the homomorphism, not by a weak rederivation. **Decided: the band resolves *cold*, not at the midpoint**, because the errors heal asymmetrically --- a cold guess is corrected by branch (b) at a rate **proportional to demand**, a warm guess only by decay on a **fixed clock** --- and because a cold band means a rebuild warms up lazily instead of mass-materializing at the worst moment. **Escape hatch kept additive:** residency may later persist as a **hint**, consulted-not-authoritative. **The note that most needs to survive: branch (b) is the recovery mechanism, not the growth mechanism** --- pruning it as redundant with (a) makes cold rederivation permanently lossy across the band with no symptom but slowness, the same class of error as reading `capture` steps as diagnostics. **One new row (AH-11)** on whether every slow path can name the element it wished it had; **AH-9's inverse trap may dissolve** if `Split`/`Merge` prove to be compiled-layer residency ops that never enter the ledger |
| **Fast-path cost model measured; competitive decay retired; clause 4 hazard found (AH-12, A10)** | **Done (2026-08-13).** From conversation, with the constants read out of shipped code rather than assumed. **Three successive cost models were wrong before this**, each pushing the design toward machinery it did not need, and the corrective every time was reading the fast path instead of reasoning about it. **The decisive constant: embeddings are 256-dim int8, so one is 256 bytes** --- roughly 80x smaller than the 1536-dim float32 JSON form the intuition was calibrated against, which would not fit dozens of nodes inside DynamoDB's 400KB item limit at all. **A 200-node record is ~80--130KB, a 3--5x margin, with a real ceiling near 600--1000 nodes; marginal cost of one more node is ~0.35KB and microseconds against an abstention costing an LLM round trip.** **So read cost is not a residency criterion**, and latency at this scale is **round-trip dominated, not byte dominated** --- the pressure runs toward a *fatter* consolidated record, not a lean one. **Residency versus presentation was priced backwards:** exact matches short-circuit without embedding, so the common commands have no LLM latency to hide behind and residency is the hot axis --- but the constants dissolve the limit on both axes anyway. **Abstention risk turns out not to scale with set size at all**, only with **sibling density**, which is a property of the fiction rather than of any cache policy --- so it cannot be evicted away, and the last argument for a bounded resident set is gone. **Competitive decay retired**, having survived a long look: its uniform decrement factors into a per-level counter for an exact O(1) update (the additive twin of the decay epoch, and evidence that the two candidate operators are one operator at two addressing granularities), **but equilibrium population is `w/D`, so it forces a population rather than discovering one, and the required `D` scales with the working set --- the number it was meant to find.** Not repairable by calibration. **The reusable lesson is that every proposal in that line was a population controller and population was never the cost;** caching prior art anchors hard to fixed capacity, and that anchor re-entered once already as a "safety backstop." **The finding that constrains rather than enables: attention near the accept gate produces fast-wrong.** Widening `T_MARGIN` in favour of the attended referent converts abstentions into resolutions and **breaks clause 4's degradation guarantee** --- and pre-filtering the pool has the identical disease, since it removes the competitor that would have fired the gate, so it is not answerable by choosing filter-versus-rank. **Two escapes recorded, neither adopted: order-but-never-gate, or gate-with-disclosing-narration**, the second being the move only a narrative system affords. **New rows AH-11 and AH-12; new case A10**, which the user specified and which is the first case where the fiction has standing the mechanism does not. **One invisible coupling recorded:** all of this sizing depends on the embedding layer's 256-dim + int8 decisions, with no code linking the two |
| **Competitive decay re-opened as a comparator; birth floor made unconditional** | **Done (2026-08-13).** From conversation, both refinements proposed by the user, who judged the retirement premature and was right about the half that mattered. **Normalizing the decrement by resident-set size `N` collapses the 99x break-even spread to 1x** and turns `D/w` from a capacity into a **dimensionless relative-frequency threshold** --- *"hit at least `D/w` as often as the average sibling"* --- so the setpoint stops being the working set and the circularity that retired it is gone. **Normalize by `N`, not by miss count:** exact unique matches short-circuit without scoring, so the commonest command shape produces a hit with **zero** misses, and branch (b) has no candidate list at all. **The user's original 1-in-40-of-20-items figure was already the normalized form** (`D/w ~= 0.475`), which is why the retirement felt early. **The birth floor `C_i` should fold by `min`, not by an additive compensation** --- additive is commutative but not idempotent, so concurrent planners double-credit a birth. **And because the floor is monotonically non-decreasing, `min` retains the earliest observation, so the emission can be unconditional and the *"is this the first?"* test disappears** --- the fold answers it. **That is the real gain:** the test was a state-dependent choice made against a stale view, and unconditional emission has no test to get wrong, at no extra write. **Per item the algebra is a product of two commutative monoids** (`+` on credit, `min` on `C_i`), so the compaction homomorphism survives and cold rebasing is itself a compaction. **What did *not* survive is the original role.** The population argument stands --- marginal residency is microseconds against an abstention costing ~1000x --- so a calibrated **evictor** still solves a problem this system does not have. **The repairs change the role rather than restoring it:** the normalized form is a **sibling-relative comparator**, which is what the compiled layer needs for consolidate-versus-dissolve and a concrete candidate for AH-10a's projection. **The mechanism was never wrong; it was pointed at the wrong decision.** **Three riders carried into AH-10a, one of them open:** `min` ratchets shut on **re-entry**, and since the comparator framing deletes nothing, an element that cools and re-warms is locked out forever unless compaction clamps-and-re-bases or deletes --- **undecided, and the symptom is only slowness**; `min` also selects the **stalest** floor observation, which biases *against* newcomers, the direction that costs a traverse; and the floor is **per-cache**, so cross-cache comparison needs a normalization that does not exist. **The ratchet was then decided the same day: compaction *deletes* sub-zero elements on two strikes.** **Rebase and delete are the same illegal move** --- both raise `C_i`, which `min` exists to forbid --- so the ratchet is the price of an idempotent birth and any fix is a **privileged compaction-time operation**, never a ledger entry. **Neither option is algebraically cleaner:** both need the projection clamped to `max(0, ...)`, and **the clamp alone fixes nothing**, since a deeply underwater element stays pinned at zero however often it is hit. **Delete won on semantics, explicitly not on storage** --- that argument would be the fixed-capacity anchor re-entering for the third time. It discards accumulated credit, which a *sibling-relative* comparator should want, since ancient credit is contamination rather than evidence; it recovers at full speed instead of carrying a decay-since-last-compaction deficit; and **it is a candidate answer to AH-6**, whose missing window-reset it supplies in the non-suspect form --- shrinking by **demand** rather than by age --- arrived at without being designed for it. **A9 must confirm that rather than this decision asserting it.** **Deletion waits, because it does not commute with in-flight credit:** an op emitted before compaction and folded after finds no entry, captures its own stale-low floor through the `min` identity, and **resurrects the element born dead**. **The wait was first specified as a per-element strike counter and then removed entirely:** compaction stores `C_prev` per cache and deletes when the deficit exceeds one interval's decay, `credit_i - (C_now - C_i) < -(C_now - C_prev)`. **The counter was tracking the same difference against every element for a quantity that belongs to the cache**, and dropping it makes the test **continuous** rather than a bit that thrashes, makes hits shrink the deficit with nothing observing them, and **avoids introducing a third clock** on compaction cadence behind AH-4's back. **It self-heals resurrection** rather than making it rare, since a resurrected entry's deficit is immediately enormous. **The general rule the discarded counter yielded:** the strike state had to be *cleared* on recovery, and `:= 0` does not commute with `+= 1`, so **anything reset by ordinary activity cannot live in the op stream** --- it belongs to compaction, or better, to a quantity that can be derived. **Preferring derived is what removed the clock**. **One clarification recorded because the decisions above were misread as loosening commutativity, and they are not:** ops still commute with each other and nothing about the fold changed. **The ledger was never append-only either** --- ordinary compaction always removed ops, safely, because each removal left a **fold-equivalent replacement**. **What is new is erasure: removal with no replacement**, licensed by the clamp. **Decay had already made the ledger forgetful, but only asymptotically** --- an unclamped projection always leaves residue, so nothing could ever legitimately be dropped; **the clamp turns *asymptotically zero* into *zero*, and deletion merely lets forgetting complete in finite time.** **The general form, for primitives still to be designed: a commutative monoid can aggregate but cannot forget** --- forgetting needs the thing made **unobservable** or a **serialized** operation outside the algebra. **This plan uses both, and the entire bill is one timing assumption** |
| **A recognition-side parallel noticed, and deliberately parked in the parent rather than designed** | **Done (2026-08-13).** From conversation, and the deferral is the user's call. **The question asked:** the ledger measures *"how often would we have benefitted from this optimization?"* to decide where `ludicCache` forms and dissolves --- is there a parallel that measures the attention paid by **carry closure** (temporary object-abstractions) and by **LLM recognition** (*"this set comprises a pattern"*), to underpin when a **durable abstraction** is minted and dissolved? **Conceptually yes, and the structural side already says so:** `CarryClosureFragment`'s pinned note that *a composition abstraction is a named, persistent carry closure* is the same move seen from the graph rather than from the measurement. **Practically it is far murkier, and the asymmetry is the finding.** This ledger builds out of deterministic code already running and has a designed consumer; the recognition parallel has neither. Its miss signal is **an LLM inference** rather than a walk it just performed, so [branch (b)](#hit-and-miss-emit-the-same-signal) --- the thing that makes demand measurable independently of whether the element exists --- is **not cheap** there. Its weight has **no unit**, where this plan's is work avoided. **And the premise that licenses everything permissive here does not transfer:** lossy, sampled, approximate and aggressively compacted are all bought with [clause 4](#the-one-inherited-clause-that-most-changes-how-this-plan-should-be-read), and a mint is a **graph write** that AB-20 already grades a correctness obligation --- so [AH-12's fast-wrong hazard](#attention-near-the-accept-gate-can-produce-fast-wrong) is the **default case** on the recognition side rather than its one exception. **Designing it now would mean designing against this plan's premises instead of against measurements**, so it is parked with an unpark trigger of *this ledger built and iterated*, and **no AB ID**, since an ID would make it look answerable. **What that costs this plan is one Phase 4 obligation:** record which properties were load-bearing versus incidental **before** deleting, because that harvest is cheap only while the implementation is fresh |
| **Cache and ledger split; the cache shipped first as an exhaustive Prototype, and this channel gained an instrument** | **Done (2026-08-13).** From conversation, proposed by the user, and recorded in full in the parent's [iteration ladder](AGENT.abstractionLayers.proposals.planning.md#the-ludiccache-iteration-ladder-exhaustive-first-persisted-second-2026-08-13). **The trigger was CoyoteGame**, about to allow objects placed in / on / under other objects --- at which point referent-matching becomes the hot path, and building relations or abstractions ahead of the cache contract would raise a large consumer surface against a moving seam. **What it does to this plan is narrow its critical path rather than delay it.** A first `ludicCache` iteration that is **exhaustive** --- everything promoted, no salience, no fold --- **needs no ledger and therefore no AH-10a**, so the laws stop gating anything currently being built and gate **only this channel**. The broader-looking dependency recorded on 2026-08-12 was real for the ledger-plus-cache **bundle** and does not survive the split. **The genuine gain is data before the build:** the parent's **C7** logs [branch (b)](#hit-and-miss-emit-the-same-signal)'s counterfactual --- what *would* have missed under attention-scoping --- **with no ledger in existence**, which converts *does the ledger earn its build* from judgement into measurement, gives **AH-11** observed walk shapes to be scoped against instead of reasoned about, and makes **A9** an early measurement rather than a late surprise. **Channel B is consequently re-gated on C7's numbers rather than on a date**, and *waiting* is the honest status if the exhaustive cache turns out not to be missing anything worth measuring at play volume. **One hazard is this plan's to hold: an exhaustive cache neutralizes AH-3 rather than answering it** --- everything is promoted, so **A3 cannot be worked against the prototype, and its behaviour must never be read back as the depth answer.** That is the corpus-judges-the-iteration rule meeting its first real opportunity to be broken |
| Phase 0 --- work A1--A10 | Not started |
| Phase 1 --- requirement rows AH-2..AH-7 | Not started |
| Phase 2 --- AH-1, the retention question | Not started; **blocked on Phase 0 by design** |
| Phase 3 --- feed back to parent (PC rows, P6 clause 2) | Not started |
| Phase 4 --- graduate or retire | Not started |

## Lifecycle

**Retire this plan and its corpus when Phase 4 completes**, per [`taskPlanning/AGENT.md`](../../../../AGENT.md): move durable rules into the code-adjacent docs, then delete both files. Git retains the trace, exactly as it did for the `ludicGraph` rename sub-plan.

**Do not let this outlive its answers.** The parent plan records that a distinction can grow back after being locked; a corpus left in place after its findings have graduated is one of the ways that happens.
