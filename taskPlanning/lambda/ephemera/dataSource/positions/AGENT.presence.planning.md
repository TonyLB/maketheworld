# Presence: what it means for a thing to be somewhere

**Status: STUB, opened 2026-08-21 from conversation. Design stage, Phase 0 not started.** Nothing below is decided; the open rows are named so they can be worked, not answered. **No code is in scope yet**, with one deliberate qualification carried from the parent: *no code yet* gates **provisional** decisions, not decisions generally --- see [Graduation tiers](../../../../AGENT.designVariant.md#graduation-tiers-when-a-decision-licenses-code). This plan is expected to reach for an implemented **interface** earlier than most design work does, because grounding the next step is its stated purpose.

**Next step: [PR-1](#open-decisions-design--plan-only) and Phase 0.** Do not open a representation row before the requirement rows have an answer; that is the conflation this plan's sibling exists because of.

**Sub-plan of [`AGENT.abstractionLayers.planning.md`](AGENT.abstractionLayers.planning.md)**, split out 2026-08-21. It owns **the semantics of being somewhere** --- what it means to say a thing is in a host, what carries that fact, what may read it, and what may not. The parent keeps the graph model, the locked frame, ports, and everything about `ludicGraph`'s shape.

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../../../AGENT.md) and the design variant [`AGENT.designVariant.md`](../../../../AGENT.designVariant.md).

**Companion files.** Only the corpus is planned; the [ladder](../../../../AGENT.designVariant.md#the-companion-file-ladder) does not require the other classes until they are earned.

| File | Class | State |
| --- | --- | --- |
| **This file** | Control surface | Stub |
| `AGENT.presence.corpus.planning.md` | Evidence corpus | **Not yet created** --- Phase 0's first step |
| Reasoning trail | --- | **Not split out.** Entries go in the parent's [`AGENT.abstractionLayers.discussion.planning.md`](AGENT.abstractionLayers.discussion.planning.md) until this plan earns its own; say so rather than defaulting them into Progress |

---

## Getting Started

1. **Read [`taskPlanning/AGENT.md`](../../../../AGENT.md) and [`AGENT.designVariant.md`](../../../../AGENT.designVariant.md) once.** This is a design-stage plan: resolved rows [graduate](../../../../AGENT.designVariant.md#graduating-a-resolved-row) rather than being deleted, rows may block no slice at all, and code is licensed by tier.
2. **Read the parent's [locked frame](AGENT.abstractionLayers.planning.md#locked-frame-parts-and-ports-2026-08-06) and its [exclusion list](AGENT.abstractionLayers.planning.md#what-is-not-locked-and-must-not-ride-in-on-this).** Its three shape claims are this plan's premises, not its subject matter. If you find yourself arguing whether a whole has its own graph, you are in the wrong document.
3. **Read [H3](AGENT.abstractionLayers.proposals.planning.md#h3-ports-as-the-boundary-mechanism-decomposition-as-a-modellers-choice) and [ports are single-use](AGENT.abstractionLayers.proposals.planning.md#ports-are-single-use-and-that-is-not-a-detail-clarified-2026-08-06).** A **presence port** --- a port with no exterior endpoint --- is the mechanism most of these rows will argue over, and it is now shipped rather than proposed.
4. **Read the shipped side before proposing anything.** There is already a presence predicate in the code and it is normative: [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) --- *"Adjacency row existence is an existential invariant, not a lifecycle event: a row `(EphemeraId: X, DataCategory: POSITION#<hostId>)` exists **iff** X is a node in `<hostId>`'s `ludicGraph`."* **That sentence is a presence design**, made and shipped, and this plan either absorbs it or supersedes it deliberately.
5. **Read [Presence and perspective are orthogonal](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#presence-and-perspective-are-orthogonal)** in the durable concepts doc. It is the one durable statement using this plan's word today, and **it uses it in the narrower, character-only sense** --- see [Two things are called presence](#two-things-are-called-presence-and-whether-they-are-one-thing-is-pr-2) below.
6. **Then write the corpus.** The open rows below are deliberately unargued; Phase 0 is what makes them arguable.

**Test orientation and baseline, for when this eventually licenses code.** From `lambda/ephemera`:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/
```

**`npm run test`, not `npm test`, and `npx tsc --noEmit` is not sufficient** --- `*.integration.test.ts` files sit outside the tsconfig include and mock by module *path*, so a rename can typecheck clean and still break the suite. Commands live in [Verification](#verification), which is the authority if anything here conflicts with it.

**Nothing in this plan should change that baseline yet.**

## Why this is a separate plan, and why it is opened now

**The trigger, from conversation 2026-08-21: presence is the missing articulation that [P7 --- merge-reduce](AGENT.abstractionLayers.ludicCache.corpus.planning.md#mechanism-findings-staged-for-p7) needs before it can be authored.**

The staged findings state the reducer's unit as *"a merge resolves a set of terminals; each resolved terminal is queried against the cache and against the retained graphs; each hit is composed or walked onward"* --- and **every clause of that is a presence operation.** *Queried against the retained graphs* is a presence predicate. Finding 4's sub-graphing **drops** things, and what may be dropped is a presence judgement. Finding 5's recovery is *"a keyed walk, not a scan"*, and the key is a presence key. The parent's [flag on CC1b](AGENT.abstractionLayers.planning.md#recommended-order) put this in the negative form already: under the reducer, **node presence and edge composition are the same operation** --- which is precisely why the reducer cannot be specified while presence is a word rather than a system.

**Writing P7 first would decide presence by implication**, in the vocabulary of a reducer, in whichever form made that reducer easy to write. That is the failure mode this initiative has a name for.

**The second reason is the parent's own methodological one**, and it applies here more sharply than anywhere it has been applied yet:

> *What must the model be able to express?* is answerable from the fiction with confidence. *What is the representation?* is not, and depends on the first. **A row asking both makes the answerable half unreachable.**

**[AB-8](AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only) has been open since 2026-08-05 and has been re-framed at least four times** --- through H1's removal of multi-hosting, through P3's single-use ports, through the port-list carrier, through C10's apprehension-scale qualifier. **It is a representation row that has never had a requirement half.** This plan exists to supply it.

## Two things are called presence, and whether they are one thing is PR-2

**Stated first because the ambiguity is live in the corpus, in the durable docs, and in the shipped code at once**, and a reader who does not have it will merge two systems by accident.

| | **Character presence** (shipped, named) | **Extent** (design, unnamed) |
| --- | --- | --- |
| What it says | Which **room** a character occupies, and who shares it | Which **graphs hold a qualified reference** to a whole |
| Where it is stated | [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) --- *"At play time, which room a character occupies"* | [AB-8](AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only)'s (a)-with-ports re-frame, 2026-08-09 |
| Cardinality | **One.** `evaluateComplexityPreGates` terminally errors on `containers.length > 1` | **Many, by design.** Ariadne's thread is *supposed* to bind into several rooms --- [C7](AGENT.abstractionLayers.corpus.planning.md#c7-ariadnes-thread) |
| Carrier today | Membership API, eviction ladder, adjacency rows, `handleConnectionsCharactersPresence.ts` | Port list in the whole, per H3 --- shipped as ports, undesigned as presence |
| Mutation rate | The **highest-frequency mutation in the system** | Rare |

**They are not obviously the same and not obviously different.** Under [locked-frame clause 3](AGENT.abstractionLayers.planning.md#locked-frame-parts-and-ports-2026-08-06) every host has a graph of the same internal structure whatever kind it is, so *a character in a room* and *a rope in a room* are both **a node in a room's graph** --- which argues one relation. But the shipped machinery for the first is entirely separate from the mechanism proposed for the second, one is single-valued and terminally enforced while the other exists to be multi-valued, and their write rates differ by orders of magnitude.

**Do not resolve this in prose.** It is [PR-2](#open-decisions-design--plan-only), it is a **requirement** question before it is a representation one, and it is probably the row that decides the shape of everything else here.

## What is inherited as settled, and must not be re-argued here

| Inherited | From | Consequence for this plan |
| --- | --- | --- |
| A whole has **its own graph, with a root node**; parts are nodes in it | [Locked frame](AGENT.abstractionLayers.planning.md#locked-frame-parts-and-ports-2026-08-06), clause 1 | "Where is it" is always askable *of a graph*. There is no placeless thing |
| Boundary crossings are mediated by an **explicit binding the interior owns** | Locked frame, clause 2 | Presence is never read by addressing a foreign interior node directly |
| **Every graph has the same internal structure**, whatever kind of host it belongs to | Locked frame, clause 3 | A rule that holds for rooms must hold for characters and objects, or it is not a presence rule |
| **Ports are single-use**; a port's exterior end is a graph plus an *optional* endpoint | [P3](AGENT.abstractionLayers.proposals.planning.md#ports-are-single-use-and-that-is-not-a-detail-clarified-2026-08-06) | A **presence port** is a port with no endpoint. This is the shape most rows will argue over --- and it is **shipped**, address form `OBJECT#ROPE#ab6129d` |
| **Multi-host presence is legitimate**, not drift | AB-8 re-frame 2026-08-09; [C9](AGENT.abstractionLayers.corpus.planning.md#c9-coiling-the-rope-back-in) | A design that reconciles multi-hosting away is disqualified before the corpus is consulted. Carries an outstanding doc-correction debt on `evaluateComplexityPreGates`' `multiPresent` error and on `repairObjectPlacementDrift` |
| `ludicCache` is **derived, authoritative over nothing**; a miss falls through | [P6 clause 5 / clause 4](AGENT.abstractionLayers.proposals.planning.md#the-five-clauses) | **Presence is truth and the cache is not.** Errors in the cache degrade to slow; errors here degrade to wrong. This plan does **not** inherit attention's weak correctness burden |
| A cache hit returns **a handle, not a subgraph**; reachability stays the graph's job | [P6 clause 3](AGENT.abstractionLayers.proposals.planning.md#the-five-clauses) | Presence must not quietly become a reachability oracle --- [PR-7](#open-decisions-design--plan-only) |

### The one inherited clause that most changes how this plan should be read

**Presence is truth.** The sibling sub-plan on attention is licensed to be lossy, sampled, heuristically pruned and aggressively compacted, because *a miss falls through* and the worst outcome is slow. **None of that license transfers here.** Presence answers *where is it*, and a wrong answer is a wrong world --- an object in a room it is not in, or absent from one it is in. Designs that would be perfectly reasonable for the attention ledger are **disqualified** in this plan, and the argument for them will sound familiar because it was accepted one construct over.

## Recommended order

Pending work is `[ ]`, completed work is `[X]`; mark each nested line `[X]` as it is done. **Nothing here is started.**

- [ ] **PH0. Write the corpus** --- `AGENT.presence.corpus.planning.md`, cases `PR-C1`... Cases are written against **today's** model and state which limit they hit; **do not propose solutions in the corpus.**
  - [ ] **PH0a. Harvest before writing.** The parent corpus already contains presence cases under other names --- at minimum [C2](AGENT.abstractionLayers.corpus.planning.md#c2-the-rope-in-two-rooms-refused-at-the-gate), [C7](AGENT.abstractionLayers.corpus.planning.md#c7-ariadnes-thread), [C9](AGENT.abstractionLayers.corpus.planning.md#c9-coiling-the-rope-back-in), [C10](AGENT.abstractionLayers.corpus.planning.md#c10-the-moonbase-computer-system). **Cite them; do not restate them.** A case that already exists gets a pointer and a note on which PR row it grades.
  - [ ] **PH0b. Write the cases the parent corpus lacks**, which are the **character-side** ones --- movement, connect, disconnect, eviction --- because the parent's corpus was built to grade structure and never had to grade the highest-frequency mutation in the system.
  - [ ] **PH0c. Write at least one case that would grade PR-2 either way.** A corpus that only contains rope cases will answer *one relation or two* by omission.
- [ ] **PH1. Answer the requirement rows** --- PR-1, PR-2, PR-7 --- from the corpus. **Nothing about representation.**
- [ ] **PH2. Answer the representation rows** --- PR-3, PR-4, PR-5, and whichever parent rows transfer. Only after PH1.
- [ ] **PH3. Ground it: the interface.** The stated purpose of this plan is to unblock the next step, and the next step needs something callable. Decide at PH3 --- not before --- whether that is a **locked** interface (with an exclusion list and a re-open trigger) or a **Prototype** (with a dependency tag and a rollback trigger named in advance). **Classify it out loud before the code exists**; see [Graduation tiers](../../../../AGENT.designVariant.md#graduation-tiers-when-a-decision-licenses-code).
- [ ] **PH4. Discharge the founding premise.** Answer [PR-8](#open-decisions-design--plan-only) explicitly: state what the merge-reduce reducer may assume about presence, in the register's verdict cells, so P7 can be authored against it. **This plan is not done when the rows close; it is done when P7 can cite them.**

### What is deliberately not in scope

- **Writing P7.** This plan unblocks it; it does not absorb it.
- **Attention and salience.** [`AGENT.attentionHistory.planning.md`](AGENT.attentionHistory.planning.md) owns what is *remembered*; this plan owns what is *true*. A case about whether a referent is still salient is an attention case.
- **Perspective.** Already settled as orthogonal in the durable concepts doc; a case about second-person copy is not a presence case.
- **The graph's shape.** Locked frame, parent plan.

## Open decisions (design --- plan only)

Plan-only. Rows [graduate](../../../../AGENT.designVariant.md#graduating-a-resolved-row) rather than being deleted; the [Settled register](#settled-register) is below. **IDs are stable and never reused.**

**Every row below is Open and unargued.** The *Constrained by* column names what a row must answer to, not what it has already been tested against. **Requirement rows come first deliberately** --- PR-1, PR-2 and PR-7 are answerable from the fiction; the rest depend on them.

| ID | Question | Constrained by | Status |
| --- | --- | --- | --- |
| **PR-1** | **Requirement: what must "X is present in H" be able to express?** Enumerate before representing. Candidate demands already visible: multi-host extent (a thread in three rooms); **held-and-present** (`Theseus -Held-> thread:1` and `thread:2 -In-> room` over one thread graph); *where along* a spanning thing an attachment sits; and whether presence is graded --- present-and-apprehensible versus present-but-only-by-traversal. **Do not answer with a data structure.** | [C7](AGENT.abstractionLayers.corpus.planning.md#c7-ariadnes-thread), [C10](AGENT.abstractionLayers.corpus.planning.md#c10-the-moonbase-computer-system); PH0 | Open --- **requirement row**, and the first thing to work |
| **PR-2** | **Are character presence and whole extent one relation or two?** See [the table above](#two-things-are-called-presence-and-whether-they-are-one-thing-is-pr-2). Locked-frame clause 3 argues one; single-valuedness, the terminal `multiPresent` gate, the separate shipped machinery and a mutation rate differing by orders of magnitude argue two. **A third answer is available and should not be reasoned past: one relation with a declared cardinality constraint on the character case.** | Locked-frame clause 3; `AGENT.concepts.md`; PH0c | Open --- **requirement row**; probably decides the shape of the rest |
| **PR-3** | **Representation: what carries presence?** The parent's live candidates are a **port list in the whole**, a **stored set**, and a **predicate derived over graph edges**. The shipped answer is a **fourth**: node membership in the host graph, with `EphemeraPositionAdjacency` as a reverse index under an existential invariant. **This row is [AB-8](AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only)'s representation half and may take it by transfer --- see [the transfer question](#which-parent-rows-this-plan-serves) --- keeping the AB-8 id if it does.** | PR-1, PR-2; [AB-6](AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only); [AB-55](AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only) | Open --- **representation row**, blocked on PR-1 |
| **PR-4** | **Is presence derivable from the graph at all?** [C10](AGENT.abstractionLayers.corpus.planning.md#c10-the-moonbase-computer-system) falsified the *at least one port egressing here* rule as stated and proposed **apprehension scale** as a declared field --- which would make presence partly **declared** rather than wholly derived. Two live sub-questions inherited with it: whether apprehension scale is world truth or perspective-relative, and whether [P3's reserved field](AGENT.abstractionLayers.proposals.planning.md#h3-ports-as-the-boundary-mechanism-decomposition-as-a-modellers-choice) is where it lands. | C10; PR-1 | Open --- **representation row** |
| **PR-5** | **What is the query interface, and which shapes must resolve in one keyed read?** At minimum: *what is present in H*, *where is X present*, and --- the one merge-reduce actually needs --- *is X present in H* as a decidable predicate over a graph the reducer already holds. **A candidate that cannot serve the hot shape in one read is disqualified on latency before the corpus is consulted**, which is the sibling plan's rule and transfers cleanly. | PR-3; [PR-8](#open-decisions-design--plan-only) | Open |
| **PR-6** | **Who writes presence, and is the write transactional with the mutation kernel?** The shipped invariant makes the adjacency row and graph membership two records that must agree, and the kernel already re-validates presence at commit time against freshly-fetched host graphs. **The question is whether presence gets its own write path or stays a consequence of graph mutation** --- and, if the former, what stops the two disagreeing. | `AGENT.contract.md`; PR-3 | Open |
| **PR-7** | **What does presence deliberately *not* answer?** Nominated boundaries, to be confirmed or rejected rather than assumed: not **reachability** (P6 clause 3 keeps that with the graph), not **salience** (the attention sub-plan), not **perspective** (already settled orthogonal), and not **containment semantics** --- *in* versus *held by* versus *attached to* may be presence with a manner, or a different relation entirely. **The last one is the live one**, and it touches [AB-57](AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only) and [AB-58](AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only). | P6 clause 3; AB-57; AB-58 | Open --- **requirement row** |
| **PR-8** | **What may the merge-reduce reducer assume about presence?** The row this plan was opened to answer. Findings 3, 4, 5 and 6 each make a presence demand: *may the reducer consult a graph it has already merged* is a question about accumulated presence state; sub-graphing **drops**, and what may be dropped is a presence judgement; recovery is *a keyed walk*, and the key is a presence key. **This row does not close until its verdict is a sentence P7 can be written against.** | [Staged findings for P7](AGENT.abstractionLayers.ludicCache.corpus.planning.md#mechanism-findings-staged-for-p7); PR-5 | Open --- **the discharge row; PH4** |

### Which parent rows this plan serves

**Stated as a question rather than executed, because a transfer that happens quietly leaves the parent's readers pointing at rows that moved.**

Three parent rows are candidates for transfer into this plan: **AB-8**'s presence half, **AB-6**'s presence half (the row already carries a note that its member-set and presence halves *"are different things and the answers may legitimately differ"*), and **AB-55** (*does the presence port subsume `EphemeraPositionAdjacency`*), which is a presence row in all but filing.

**Two things are settled about how a transfer would work, if one happens.** A transferred row **keeps its ID** --- IDs are stable and never reused, and cross-references outlive rows. And the parent must retain a pointer where the row was, because a design row closes into *other rows that argue from it*, and a silently relocated row strands them.

**Whether to transfer at all is the author's call and is not made here.** The alternative is real and may be better: this plan supplies the requirement half, the parent's rows stay where their dependents can see them, and PR-3 cites AB-8 rather than absorbing it.

### Settled register

**Empty.** Nothing has been settled in this plan. Rows land here with a **self-sufficient verdict cell** --- everything a live row needs, with the link reserved for readers asking *why*.

| ID | Question | Verdict | Settled | Detail |
| --- | --- | --- | --- | --- |
| --- | --- | --- | --- | --- |

## Verification

**Nothing to verify yet** --- this plan licenses no code. When it does, these are the checks that close a slice:

1. **Suite, from `lambda/ephemera`:** `npm run test -- --watchAll=false dataSource/positions/`. **Not `npm test`**, and **`npx tsc --noEmit` is not sufficient** --- integration tests sit outside the tsconfig include and mock by module path.
2. **Anchor resolution.** Every `](Other.md#anchor)` in this file resolves to a real heading. A broken cross-file anchor fails **silently**. **Prefer copying an existing link to deriving a slug** --- a `---` in a heading is an em dash, so its anchor takes two hyphens.
3. **Contract diff.** No clause reaches [`AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) for behavior that has not shipped.
4. **The doc-correction debt inherited with multi-host presence** --- `evaluateComplexityPreGates`' terminal `multiPresent` error and `repairObjectPlacementDrift`'s purpose --- is discharged or explicitly re-deferred whenever PR-3 moves.

## Progress

Phase grain, per the variant. **The day-by-day does not go here** --- it goes in the parent's reasoning trail until this plan splits its own.

| Phase | State |
| --- | --- |
| **PH0 --- corpus** | Not started. File not yet created |
| **PH1 --- requirement rows** | Not started |
| **PH2 --- representation rows** | Not started |
| **PH3 --- interface, tier decided out loud** | Not started |
| **PH4 --- discharge PR-8 for P7** | Not started |

## Lifecycle

**Disposes with the parent initiative**, per the ladder --- the split is an organizational convenience, not a separate lifecycle. Two things to decide at disposal:

1. **The Settled register is the disposal checklist.** Each row routes to `AGENT.contract.md` (a falsifiable rule), `AGENT.implementation.md` (paths and behavior), `AGENT.concepts.md` (vocabulary or a graduated mental model), or is task-only. **Presence is the plan most likely to owe `AGENT.concepts.md` a vocabulary entry**, since the durable doc currently defines the word in only its narrow, character-only sense --- see PR-2.
2. **Harvest the method findings before deleting anything**, per [the variant](../../../../AGENT.designVariant.md#method-findings-are-an-output-not-a-byproduct). **One is already predictable and should be watched from the start:** this plan was opened because a *word* was being used across two systems as though it named one, for two weeks, in three files. Whether that is a general failure mode worth a rule --- or one vivid instance --- is exactly the [admission bar](../../../../AGENT.designVariant.md#what-it-takes-to-add-a-rule) question, and the answer needs a second occurrence, not this one.
