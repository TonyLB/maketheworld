# ludicCache: the reducer corpus

**Companion to [`AGENT.abstractionLayers.planning.md`](AGENT.abstractionLayers.planning.md), opened 2026-08-14**, on the precedent of the parent's own corpus split and of [`AGENT.attentionHistory.corpus.planning.md`](AGENT.attentionHistory.corpus.planning.md). This file holds **worked cases about how a `ludicCache` is built from `ludicGraph`s, and nothing else.** The channel's steps, decisions and progress stay in the parent's [Channel C](AGENT.abstractionLayers.planning.md#recommended-order).

**Read this as part of the plan, not as an appendix.** A CC step is worded the way it is because of a case here.

**This is a corpus for a *channel*, not for a plan, which is a departure worth naming.** The two sibling corpora each sit beside a plan file of the same stem. There is no `ludicCache` plan --- the cache is Channel C inside the parent --- so this file is named as a child of the parent rather than as its peer. **If Channel C ever graduates to its own plan file, this becomes an ordinary sibling and nothing here needs rewriting.**

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../../../AGENT.md).

---

## Why this is a third file, and not cases in either sibling

**The three corpora are partitioned by admission rule, not by subject matter.** That distinction is the whole reason this file exists, and it was learned by getting it wrong: on 2026-08-14 a reducer case was routed to the [attention corpus](AGENT.attentionHistory.corpus.planning.md) (wrong --- it decides no AH row), then to the [C-series](AGENT.abstractionLayers.corpus.planning.md) (also wrong, and for a reason the C-series' own stated rule concealed until it was re-read).

| Corpus | Anchor | A case is admitted when |
| --- | --- | --- |
| [C-series](AGENT.abstractionLayers.corpus.planning.md#phase-0-corpus) | today's code, or a proposal's clause table | it names the code site where the model stops, **or** the proposal clause it falsifies |
| [AH-series](AGENT.attentionHistory.corpus.planning.md#what-counts-as-a-case-here-and-how-it-differs-from-the-c-series) | play | two candidate designs produce a **different player-visible outcome** |
| **LC-series** (this file) | **the cache** | see below |

**Reducer cases fail both siblings.** They can cite no code --- CC1 is unwritten --- and half of what matters about them never reaches a player, so the AH rule discards exactly the half that decides the mechanism.

### The rule

> **A case is corpus when two reducer designs produce a different cache.** Name **which** cache differs and **how**: nodes present, edges present, crossings recorded, or `homeShards` membership.

**Extensional difference in the output is the right grain here in a way it is not for either sibling**, because for a reducer the output *is* the artifact. The C-series needs a code anchor because it describes shipped structures; AH needs a play anchor because its output is invisible except through play. A cache is a data structure whose entire job is to be read, so a difference in what it contains is a difference that counts, whether or not a player ever sees it.

**What this excludes, and the exclusion is load-bearing.** *"Does the merge read the working cache, or the already-reduced entry for the whole?"* is a real and interesting CC1 fork --- and it is **not a case**, because both readings can produce a byte-identical cache. That is a design question, and it belongs in the parent's open decisions. **The operational framing makes non-cases unusually seductive:** mechanism questions feel productive in a way that static mis-framings do not, so this rule needs applying *harder* here than in either sibling, not more loosely. When a case turns out not to discriminate, **record the non-discrimination as the finding** --- [C3](AGENT.abstractionLayers.corpus.planning.md#c3-the-snare-trap-coyote-cannot-name)'s *byte-identical* result is the precedent, and it is one of the more useful results in that file.

### Two case forms

**1. The worked merge.** State a world setup, then a sequence of *"merge graph G as reached from host X"* steps, and say what the cache holds after each. **Precedent: [C9](AGENT.abstractionLayers.corpus.planning.md#c9-coiling-the-rope-back-in)**, the only operational case in the C-series, and by yield the strongest case in it --- it cleared two AB rows outright, dissolved a queued test set, produced a write-count footprint and a membership rule. **Its central finding, *"no edge changes at all --- structure and position are independent,"* is not statable in a static case at all**, because invariance is a property of a transition. That is the argument for this form, and it is empirical rather than aesthetic.

**2. The round trip.** Merge several graphs, then extract from one of the merged hosts, and compare the extraction against what that host contributed. **This form is available here and in neither sibling**, and it is the sharper instrument: it is mechanical. C-series findings are argued and AH findings are adjudicated, but a round trip either closes or it does not. It exists because [extraction is the reducer with a different seed](AGENT.abstractionLayers.planning.md#recommended-order) --- if that framing survives CC1, most of this corpus's leverage comes from here.

**Note what the round trip is *not*: an identity test.** Seeding from `OBJECT#table` yields a cache containing what table reaches, which is not what a room-seeded consolidation contains. The test is whether the extraction is **coherent and sufficient** for its seed, not whether composition and extraction compose to the identity.

### Annotation line, uniform across cases

**which CC step(s) it decides** --- **what differs in the cache** (nodes | edges | crossings | homeShards) --- **order-sensitive or order-independent** --- **the difference, stated in both directions.**

**The order-sensitivity tag is the one that earns this corpus its keep.** Each case is a vote on whether the reducer must be confluent --- whether merge order is free --- and reading that column down is the direct input to CC1's signature. **Do not fill the [tally](#cache-difference-tally) before the cases are worked**; it is the corpus's output, not its premise.

---

## The corpus

**Six seed cases, stated 2026-08-14 from the conversation that opened this file. None worked.** Each records its setup and what it discriminates; findings are deliberately absent.

**The known blind spot, recorded up front on both siblings' precedent: every case below is single-seed.** One cache, built from one host's point of view. A whole that appears in **two** caches --- two rooms each consolidating the same string --- is untested, and a claim that survives LC1--LC6 has not yet met it. **Expect at least one two-cache case before CC1 is called done.**

**The standing topology.** LC1--LC5 all use one arrangement, so that cases can be compared rather than each re-establishing a world:

- `ROOM#Room` contains `OBJECT#table`, `OBJECT#box`, and `OBJECT#string`.
- `OBJECT#string` has parts `OBJECT#stringEnd1`, `OBJECT#span`, `OBJECT#stringEnd2`, with sibling links `stringEnd1 -- span -- stringEnd2`.
- **`OBJECT#string` is multi-hosted, and its hosts are its ports' egress targets:** `OBJECT#table` presence-links to `OBJECT#string#{port to stringEnd1}`, `OBJECT#box` presence-links to `OBJECT#string#{port to span}`, `ROOM#Room` presence-links to `OBJECT#string#{port to stringEnd2}`.

**In plain terms: one end lies on the table, the middle is inside the box, the far end trails on the floor.** This is [C7](AGENT.abstractionLayers.corpus.planning.md#c7-ariadnes-thread)'s and [C9](AGENT.abstractionLayers.corpus.planning.md#c9-coiling-the-rope-back-in)'s topology moved inside a single room, which is deliberate --- **it keeps the multi-host question live while removing the cross-room variable**, so LC1--LC5 test the reducer rather than re-testing presence.

### LC1: The sibling link into the unmerged box

**Origin:** raised in conversation 2026-08-14, and it is the case that prompted this file.

**Setup.** The standing topology. Consolidate a cache for `ROOM#Room`, merging in order: `ROOM#Room`, then `OBJECT#table`, then `OBJECT#box`.

After the first two merges the cache holds `stringEnd2` (reached from the room) and `stringEnd1` (reached from the table). **Both carry a sibling link to `OBJECT#span`, which is inside the box and not yet merged.** Then `OBJECT#box` merges.

**What it discriminates. Whether interior sibling links are materialized in the cache at all**, and the two readings produce different edge sets:

- **They are materialized.** The cache gains `span` and two sibling edges, and the string is one connected thing in the cache: a consumer can see that the end on the table and the end on the floor are the same string, and `pull string` has a coherent subject.
- **They are not.** The cache holds three part-nodes hung off three separate presence edges from three hosts, connected only through the `OBJECT#string` node itself. The string reads as one node with three parts that do not know about each other.

**The variant that makes it sharp, and it should be run.** **Do not merge `OBJECT#box`.** (The box is closed, or the reducer's frontier simply does not reach it.) Now the two sibling links point at a node that is not in the cache. **A materializing reducer either emits a dangling edge or must suppress it** --- and *suppress* means the reducer's output depends on what else got merged, which is the first real pressure toward order-dependence. **A non-materializing reducer has nothing to decide**, and if that asymmetry holds it is an argument for the second reading that has nothing to do with the string.

**The half of the original question that is not corpus, recorded so it is not re-asked as one.** *Are the sibling links pulled from the working cache plus the incoming `ludicGraph`, or from the already-reduced `OBJECT#string` entry?* **Both can produce the same cache**, so by this file's rule it is a design fork rather than a case. It is real, and it belongs to CC1. **It becomes a case only in the variant above**, where the two sources differ in what they can even see.

*Annotation:* CC1, CC1a --- **edges** --- suspected order-sensitive in the variant, order-independent otherwise --- **the string is one connected object in the cache versus three parts that share a name.**

**Not yet worked.**

### LC2: Box first, table last

**Setup.** The standing topology, merged in the reverse order: `ROOM#Room`, `OBJECT#box`, `OBJECT#table`.

**What it discriminates. Confluence --- whether merge order is free.** This is the case LC1's variant predicts will bite, isolated so it can be answered on its own. **If the two orders produce different caches, the reducer is not a fold** in the sense the design assumes, and CC1's signature has to say what the canonical order is and who chooses it.

**Where it will land if it bites, named in advance.** `homeShards` is an accumulator, so it is order-sensitive **as a list and order-free as a set** --- which makes it a decision about the field's equality rather than about the reducer. Nodes are a union and should be free. **Edges are the exposed surface**, because a spliced crossing edge records the path by which it was built.

**Not the same as [P4](AGENT.abstractionLayers.proposals.planning.md#proposal-p4-settling-dataflow-and-narrative-heat)'s *diamond*, and the distinction is the case's point --- checked 2026-08-14 because the two look alike and share a topology.** P4's [diamond glitch](AGENT.abstractionLayers.proposals.planning.md#two-defects-inherited-with-the-model) is *"a node with two inputs tracing to a common ancestor... reached by the short path before the long one,"* briefly computing a value that was never true. **That is transient wrongness with correct convergence. Non-confluence is the opposite: correct at every step, divergent at the end.** The asymmetry decides what an acceptable answer looks like --- P4 lists *accepting transient glitches* among its fixes, and **that escape is not available here**, because a divergent fixed point does not settle.

**What they do share is the topology, and it is already supplied.** Both need a node reachable by two paths from a common source, which is precisely [H3 clause 6](AGENT.abstractionLayers.proposals.planning.md#h3-ports-as-the-boundary-mechanism-decomposition-as-a-modellers-choice)'s *membership is a DAG* --- forced by [C6](AGENT.abstractionLayers.corpus.planning.md#c6-the-rope-the-candle-and-the-impromptu-timer), one part in two wholes. **Take test topologies from there rather than inventing them**, and note that H3 clause 6's own cross-note already anticipated being *"a known P4 cost this clause is now a concrete instance of"* --- the reducer is that clause's second instance, in a different mechanism.

**Where P4's diamond *does* arrive inside the reducer is [LC4](#lc4-the-string-that-is-only-half-opened), not here** --- an observable half-folded cache is the value-that-was-never-true, and `interiorConsolidated` is what determines whether it is a glitch or a legible partial.

*Annotation:* CC1 --- **edges, homeShards** --- **this is the order-sensitivity case** --- **merge order is an implementation detail versus a documented part of the contract.**

**Not yet worked.**

### LC3: Merging the same graph twice

**Setup.** The standing topology. Merge `OBJECT#table` as reached from `ROOM#Room`, then merge it again, identically.

**What it discriminates. Idempotence, and what it costs to get it.** A second identical merge must not duplicate a node, append `homeShards` twice, or grow `crossings`. **That requires identity keys, and edge identity is the hard one:** two edges from `ROOM#Room` to `span` can differ *only* by the crossing path recorded on them, so the key cannot be `(from, to, kind)`.

**Why it is not a hygiene case.** Rebuild is expected to run against a changing world, and a partial or retried rebuild that double-merges is an ordinary failure mode, not an exotic one. **Whatever key answers this case also answers LC2**, since confluence and idempotence are the same question asked about different repeats.

*Annotation:* CC1, CC1b --- **nodes, edges, crossings, homeShards** --- order-independent by construction if it passes --- **a retried merge is free versus a retried merge corrupts the cache.**

**Not yet worked.**

### LC4: The string that is only half opened

**Setup.** The standing topology, with only `ROOM#Room` and `OBJECT#table` merged. The cache now holds `OBJECT#string` with two of its three parts.

**What it discriminates. The grain of `interiorConsolidated`**, which [ships today as a node boolean](../../../../../lambda/ephemera/dataSource/positions/ludicCache/types.ts) on [CC0's stored-never-derived argument](AGENT.abstractionLayers.planning.md#recommended-order). **Here the string is consolidated through two of its three ports, and a node-level boolean has nowhere to put that.** Per-host is a coarsening that fails too, and the case should be varied to show it: put *both* ends on the table, and one host binds two ports of the same node.

**The stake is larger than CC0's empty box, and this is the case's real subject --- absorbed 2026-08-14 from a case proposed as a peer and folded in before it was allocated an id, so no `LC7` gap exists.** A partially-folded cache is **observable**: mid-fold, or after an incremental re-merge, a reader can see `stringEnd1` and `stringEnd2` present with no `span` --- a configuration the world was never in. **In [P4](AGENT.abstractionLayers.proposals.planning.md#proposal-p4-settling-dataflow-and-narrative-heat)'s vocabulary that is a [diamond glitch](AGENT.abstractionLayers.proposals.planning.md#two-defects-inherited-with-the-model) arriving inside the reducer** --- and **the marker is exactly what stops it being one.** A diamond glitch is a defect *because the bad value is indistinguishable from a settled one*; a structure that says *I am not complete* is a legibly partial read instead, the difference between a torn write and a write-in-progress flag. **So `interiorConsolidated`'s larger job is making partial folds safely readable, and CC0's empty box is the smaller half of what it earns.**

**Which is what decides the grain, and closes the loop this corpus was opened by.** A boolean says *incomplete*, so a consumer must distrust the whole node. **Per-binding says *complete along these paths, unknown along that one*, which lets a consumer act on the parts it has** --- and only the second makes incremental rebuild viable at all. **Note the shape of the argument:** this file exists because the typing of containment-paths became hard to reason about statically, and the first case to bite returns a typing decision about containment-paths. **That is the corpus working, not a coincidence to smooth over** --- it is also the reason to be suspicious of settling the grain from this case alone, since a corpus that answers the question that motivated it is the corpus most at risk of confirming its own premise.

**A gap that matters once the marker is load-bearing.** [`isEphemeraLudicCacheData`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/types.ts) validates each node and each edge **independently** --- it does not check that `edge.from` and `edge.to` name nodes present in `nodes`. A mid-fold cache carrying a sibling edge to an absent `span` therefore passes the guard. That is tolerable if the marker is what carries the safety, but **nothing validates the marker's honesty**: a reducer that neglects to set `interiorConsolidated: false` emits a cache that type-checks and lies. **If partial reads are a supported mode rather than an accident, the referential-integrity check is owed** --- and which one is true is this case's decision, not a separate one.

**The second reading, which would retire the field.** CC0 rejected deriving the flag *from whether any node names this host as its home shard*, on the grounds that opened-and-empty and unopened-and-full become indistinguishable. **Under a reducer with port-addressed terminals they are distinguishable:** unexpanded is an edge still terminating at a port address, expanded is an edge terminating at a node with a crossing recorded. **CC0 rejected one derivation, not derivability**, and the port address that supplies the missing distinction did not exist in the representation when that argument was made.

**Check before relying on it.** The derivation needs a contents-less object to *not* carry the relevant port. **PQ-13** forced yes on plain objects carrying a **presence** port; whether that is the same port as the one into an interior is unchecked, and if it is, the derivation collapses back to CC0's original indistinguishability.

*Annotation:* CC1b (not CC1a --- a per-binding flag cannot be typed before bindings are), **and CC0b's shipped field** --- **nodes** --- order-independent --- **a consumer can act on the parts of a half-folded whole that are actually present, versus must distrust the whole node until the fold completes --- which is incremental rebuild being viable or not.** *(The empty-box difference CC0 argued from is the same case's smaller half.)*

**Not yet worked.**

### LC5: The string that is also somewhere else

**Setup.** The standing topology, plus: `OBJECT#string` is long, and a fourth port egresses to `ROOM#Corridor`, which is not part of this cache.

**What it discriminates. What bounds the frontier.** The reducer never asks *where else is this whole present* --- it expands only the ports the current host binds --- so the corridor part is never pulled in. **The case exists to confirm that and to find what it costs**, because the alternative reading is that a whole is always consolidated whole, which is what [P6](AGENT.abstractionLayers.proposals.planning.md#proposal-p6-ludiccache-as-the-attention-scoped-reference-structure) exists to prevent.

**What the confirming answer establishes, which is more than the case looks worth.** If inclusion is *reachability from the seed through bound ports*, then **nothing is ever filtered out, because nothing irrelevant is ever pulled in** --- and the rebuild has no exclusion step to get wrong. That is a materially different program from a pipeline of list-filters, and it is the reducer framing's main structural claim.

**The negative-case discipline applies** ([A7](AGENT.attentionHistory.corpus.planning.md#a7-the-llm-opens-the-bag)'s precedent). It is stated so the expected answer can be falsified rather than assumed.

*Annotation:* CC1, CC1a --- **nodes** --- order-independent --- **the cache is bounded by what the seed reaches versus by the size of the wholes it touches.**

**Not yet worked.**

### LC6: Extracting the table's view back out

**Setup.** The standing topology, fully consolidated into a `ROOM#Room` cache. Now extract the sub-graph for `OBJECT#table`.

**What it discriminates. Whether the round trip is a usable instrument at all** --- and it is the first case of that form, so it tests the form as much as the reducer. Extraction should yield what table reaches: `stringEnd1`, and `OBJECT#string` as the whole it is a part of. **It should not yield `span` or `stringEnd2`**, which table has no binding to.

**The ambiguity the [`homeShards` correction](AGENT.abstractionLayers.planning.md#recommended-order) introduced, and it is why this case is owed.** With a single home shard, *the sub-graph rooted at X* had one answer. With a list, `OBJECT#string` is hosted by table, room and box at once, and whether the whole comes along in an extraction seeded at table is not derivable from the cache.

**The shipped precedent, which already hit this and has a constraint to inherit.** `computeCarryClosure` in [`interactionUnderTransfer.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/expandValidate/interactionUnderTransfer.ts) returns `{ rootId, members, edges }` --- what [`ludicGraph/AGENT.md` --- Known limitation (deferred)](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/AGENT.md#known-limitation-deferred) calls *a rooted ludic graph* in all but name. Its BFS guards with `closureSet.has(...)`, so **it absorbs a doubly-reachable object via whichever edge it traversed first**: the traversal tree is order-dependent even though the induced edge set is not. The constraint that fell out is **`rootId` is recorded, never derived**, pinned in both directions for whoever adds a root concept next. **That is CC1**, and this case is where the inheritance is either confirmed or found insufficient.

*Annotation:* CC1 --- **nodes, edges** --- order-independent if the extraction is seeded rather than derived --- **extraction is the reducer with a different seed versus a second mechanism that must be kept in agreement with it.**

**Not yet worked.**

---

## Cache-difference tally

**Empty by design.** Fill as cases are worked, one row each; **reading the order-sensitivity column down is the direct input to CC1's signature**, and pre-filling it would make the corpus argue for a conclusion instead of producing one.

| Case | What differs | Order-sensitive? | What forced it | Confidence |
| --- | --- | --- | --- | --- |
| *(LC1--LC6 --- not yet worked)* | | | |

## Coverage gaps, recorded up front

1. **Every case is single-seed.** One cache, one host's point of view --- see the note above the case list. A whole appearing in two caches is untested.
2. **Every case is human-scale.** [C10](AGENT.abstractionLayers.corpus.planning.md#c10-the-moonbase-computer-system) and [C15](AGENT.abstractionLayers.corpus.planning.md#c15-the-microphone-the-wire-and-the-speaker-two-rooms-away) found that scale of apprehension is its own axis; the reducer's frontier behaviour above human scale has not been looked at, and it is exactly where an unbounded merge would show up.
3. **No case tests re-merge after mutation.** **Narrowed 2026-08-14:** [LC4](#lc4-the-string-that-is-only-half-opened) now covers the half that matters most --- whether a half-folded cache is *legibly* partial --- but **invalidation itself is still untouched**: what happens to a consolidated cache when a merged host's `ludicGraph` changes underneath it, and whether a re-merge is a fresh fold or a patch. The AH corpus records the analogous gap for attention entries. **Note that LC4 makes this gap more urgent rather than less** --- it is the case that establishes incremental rebuild as a live option, and this gap is where incremental rebuild would actually be tested.
4. **No case tests interaction with attention.** [P6](AGENT.abstractionLayers.proposals.planning.md#proposal-p6-ludiccache-as-the-attention-scoped-reference-structure) makes the cache attention-scoped, so the frontier LC5 bounds is presumably also bounded by salience, and no case here holds both at once.
5. **Every case presumes the fold.** The cases are stated as merge sequences against a reducer proposed on 2026-08-14 and not yet built. **If CC1 lands a different shape, these are re-run against it, not discarded** --- each case's setup is stated in world terms precisely so that it survives the mechanism. This is a sharper version of the durability risk both siblings carry, and it is the reason the setup/operation split above is enforced.
