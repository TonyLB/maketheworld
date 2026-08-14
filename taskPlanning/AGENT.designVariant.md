# Design-stage initiatives (variant of `taskPlanning/AGENT.md`)

**Durability: Keep.** This is an authoring-rules doc, not a task plan --- it is **not** deleted when an initiative that used it finishes.

**Read [`taskPlanning/AGENT.md`](AGENT.md) first.** This file **extends** it for one shape of work: an initiative whose early phases deliver **settled answers rather than code**. Everything in the base doc still applies unless the [overrides table](#what-this-changes-from-the-base-doc) below says otherwise.

## Status: provisional, and it means the tier

**Extracted 2026-08-14** from two in-flight initiatives, **neither of which has finished**. By this file's own [graduation tiers](#graduation-tiers-when-a-decision-licenses-code), it is **provisional** --- not locked. It was written *before* being applied, deliberately, so that applying it would be a test of a claim rather than a description of whatever happened.

**It is a minimal primitive in its own taxonomy, and the warning it gives about those applies to itself.** Absent this notice, a cold read takes these rules as **derived** --- forced by evidence, expensive to overturn --- when most of them are the simplest thing that worked, written down once. Several have **never been executed at all**. See [Confidence, and how this file is expected to change](#confidence-and-how-this-file-is-expected-to-change) for which is which.

**What that means when you use it.** Follow it; it is the house pattern. But **when a clause fights the work, the presumption is that the clause is wrong**, not that the initiative is deviant. Do not contort a plan to satisfy a rule here. Record what the clause failed to say, amend this file, and move the row in the confidence table --- that is the intended lifecycle, not an exception to it.

**The evaluation is real and dated.** These rules are under test by [`AGENT.abstractionLayers.planning.md`](lambda/ephemera/dataSource/positions/AGENT.abstractionLayers.planning.md) as it is reshaped to them, and by [`AGENT.attentionHistory.planning.md`](lambda/ephemera/dataSource/positions/AGENT.attentionHistory.planning.md) as it runs its Phase 0. **The honest verdict is not available until at least one of them disposes** --- disposal is when the Settled register, the companion ladder and the graduation rules all get their only real exam.

## When you are in this variant

You are writing a design-stage plan if **all three** hold:

1. **The deliverable of the next several phases is a decision, not a diff.** "Done" for Phase 2 is a written answer with its reasoning, not a merged branch.
2. **The questions outnumber the steps.** An implementation plan has a worklist with a few open forks hanging off it. A design plan has a body of open questions, and the worklist exists to close them.
3. **Evidence is something you have to build.** The answers are not derivable by reading the code, so the plan stands up an evidence base --- a corpus of worked cases --- and argues rows against it.

If only (1) holds, you probably have an ordinary task plan with a fat **Open decisions** section, and the base doc is enough. Do not reach for this variant to license a long document.

Two initiatives run this shape today, and are the worked examples cited throughout:

| Plan | Subject |
| --- | --- |
| [`AGENT.abstractionLayers.planning.md`](lambda/ephemera/dataSource/positions/AGENT.abstractionLayers.planning.md) | How the ludic graph represents wholes, parts and ports |
| [`AGENT.attentionHistory.planning.md`](lambda/ephemera/dataSource/positions/AGENT.attentionHistory.planning.md) | What `ludicCache` remembers, and for how long |

## What this changes from the base doc

Everything else in [`AGENT.md`](AGENT.md) is unmodified. These four clauses are.

| Base rule | What it becomes here | Why |
| --- | --- | --- |
| **"Remove resolved rows from Open decisions"** ([`AGENT.md`](AGENT.md#open-decisions-implementation--plan-only), *When a slice ships*) | **Graduate** the row: a one-line verdict stays in a **Settled register**, the derivation moves to the reasoning trail. See [Graduating a resolved row](#graduating-a-resolved-row). | An implementation fork closes into shipped code, so deletion loses nothing. A design row closes into *other rows that argue from it*, and deleting it strands them. |
| **Open decisions are "decisions you are making in order to implement an upcoming slice"** | Open decisions are decisions made **in order to design**, and may block no slice at all. Section heading: `## Open decisions (design --- plan only)`. | Most rows here are upstream of any slice. Requiring a `blocks slice` value would fabricate one. |
| **"No code until it ships"** is implicit throughout | Explicit **[graduation tiers](#graduation-tiers-when-a-decision-licenses-code)**: *provisional* licenses no code, *locked* licenses foundation, *Prototype* licenses a bounded bet. | A design process sometimes needs an implemented prototype to get evidence it cannot get by argument. That is not a violation; it is a tier. |
| **Progress table** for multi-step initiatives | Progress is a **status view at phase grain**. The day-by-day belongs in the reasoning trail. | Design initiatives generate an entry per session for months. A journal in the plan body is the "history museum" the base doc's closing rule already forbids. |

## The organs of a design-stage plan

In this order. The control surface comes before the argument, because a cold reader needs to know what is live before they can safely read anything.

**Amended 2026-08-14, from the first reshape: the order splits the control surface around the argument, and that is not a compromise.** *Status*, *Getting Started* and *Recommended order* read cold --- they say what stage this is and what to do next, in ordinary English. *Open decisions* does not: **its rows are written in the vocabulary the argument establishes**, and a reader who meets them first meets undefined terms. So Recommended order is promoted **above** the design body and the decision table stays below it. **Graduation does not change this** --- a self-sufficient verdict cell removes the reader's dependence on the *derivation*, not on the *vocabulary*, so do not expect a Settled register to unlock promotion.

1. **Status** --- stage, what is next, and whether **any** code is in scope.
2. **Getting Started** --- per the base doc's [testing-doc pattern](AGENT.md#getting-started-testing-doc-pattern), plus one clause specific to this variant: **name which sections are live design and which are retained-but-superseded.** A design plan that records supersessions accumulates confident prose for models nobody is building.
3. **What is inherited as settled** *(sub-plans only)* --- a table of premises taken from the parent, with the consequence for this plan. Its job is to stop the sub-plan re-arguing its own foundation; see [`AGENT.attentionHistory.planning.md`](lambda/ephemera/dataSource/positions/AGENT.attentionHistory.planning.md) for the pattern.
4. **Recommended order** --- checkboxes per the base doc. **Above the design body**, per the amendment: it is the section a returning reader opens for, and it does not depend on the argument.
5. **The design body** --- why the initiative exists, the frames and vocabulary the rows argue in, and any **locked frame**. *Added as an organ 2026-08-14: the first list omitted it, which made the order look like it ranked control surface against argument when in fact the argument sits between two halves of the control surface.* A lock lives here, not in the proposal record --- see [the ladder](#the-companion-file-ladder).
6. **Phase 0 corpus** --- the evidence base, usually its own file. Cases are written against *today's* model and state which limit they hit. **Do not propose solutions in the corpus.**
7. **Open decisions (design --- plan only)** and the **Settled register** beneath it.
8. **Verification**, **Progress**, **Lifecycle**.

## Open decisions (design --- plan only)

**Columns:** ID, Question, Constrained by, Status. No `blocks slice` column.

**IDs are stable and never reused.** A row that splits keeps its ID for the half that stays and mints a fresh one for the half that leaves --- never renumber, never recycle a retired ID. Cross-references outlive rows.

**Rows have a size limit, and it is enforced by graduation, not by discipline.** A decision row is a **single line of markdown** inside a table. Once it accretes past a few hundred words, edits to different parts of it stop being visible to each other and the row starts contradicting itself. If a row is too long to read in the table, it is either due for [graduation](#graduating-a-resolved-row) or it is two rows.

**Requirement rows and representation rows are different kinds.** *What must the model be able to express?* is answerable from the fiction with confidence. *What is the representation?* is not, and depends on the first. **A row asking both makes the answerable half unreachable** --- when a row resists, check whether it is conflating the two, and split it.

**Record how a constraint arrived, because it prices re-opening:**

| Kind | How it got here | What re-opening costs |
| --- | --- | --- |
| **Derived** | A corpus case forces it | **Highest** --- there is evidence to overturn |
| **Minimal primitive** | The simplest thing that worked; no alternative was ever on the table | **Lowest** --- re-opening *does* the reasoning rather than undoing it |
| **Placeholder** | Known-inadequate, retained pending design | **None to overturn**, but it owes a design |

The failure this taxonomy exists to catch: a minimal primitive quietly accumulates post-hoc justifications until it *reads* like a derived constraint, and then defends itself with reasoning that was never the reason.

## Graduating a resolved row

**A resolved design row is not deleted.** It compacts. The litmus:

> **The answer stays. The derivation graduates.**

**Stays** in the Settled register: the verdict sentence a live row would cite, the date, and the link. **Graduates** to the reasoning trail: options considered and rejected, supersession history, strikethrough layers, the argument from corpus cases, "corrected same day" passages.

**Preconditions --- a row graduates only when nothing live remains inside it.** If a resolved row still carries an open sub-question, **split the remainder to a new ID first**, then graduate the closed shell. A live question buried in a closed row is a dangling pointer with no section name.

**Read the *end* of the Status cell, not the start** --- added 2026-08-14, on measurement, and it is the precondition that actually bites. A long-lived row's status accretes in layers, and the layers are appended, so **the newest disposition is last and the cell opens with whatever was most dramatic**. In the first table graduated, **five of eighteen rows that read as closed were open**: they led with *"H1 withdrawn 2026-08-07"* and said *"Row returns to Open pending re-tag"* two thousand characters later. Nothing was struck through, because nothing had been superseded --- the row simply reported an event before reporting its own state. **A sweep keyed on how the cell opens graduates live rows**, which is the exact failure the precondition above exists to prevent, arriving through the cell's shape rather than through a missed sub-question. **The durable fix belongs in the plan being graduated, not here:** require the disposition in the Status cell's **first clause**, and let the history follow it.

**A stated remainder is often already relocated, and only the destination proves it.** Of five rows whose status named residual work, **two had none left inside them**: one had handed its residue to a sibling row that answered it the same day (leaving a stale flag in the sibling's cell), and one carried its open sub-questions in a companion file under their own ID series. **Check the named destination before minting a new ID.** Graduation is the first pass that forces rows to be reconciled against each other rather than each maintained alone --- expect it to surface stale cross-references, and expect the remainder count to shrink as you look.

**Form.** Two tables, not one. The open table is the working surface; a settled row in it is noise.

```markdown
### Settled register

| ID | Question | Verdict | Settled | Detail |
| --- | --- | --- | --- | --- |
| **XX-1** | One concept or several? | One substrate, distinct relation kinds above it | 2026-08-07 | [record](...discussion.planning.md#xx-1) |
```

**The verdict cell is load-bearing and must be self-sufficient.** If a still-open row's reasoning depends on something, that something belongs in the verdict, not behind the link. The link is for readers asking *why*; the verdict is for readers asking *what may I assume*.

## Graduation tiers: when a decision licenses code

**What licenses code is the tier, not the topic.** A decision does not earn a code license by being adjacent to something locked, by being old, or by feeling settled in conversation.

| Tier | What it means | License |
| --- | --- | --- |
| **Provisional** | Written down with its reasoning, explicitly not closed. Liable to reverse. | **No code.** |
| **Locked** | Fixed shape, corpus-grounded rather than merely argued, carrying an explicit **exclusion list** of what is *not* locked and a stated **re-open trigger**. | **Code is safe as foundation.** |
| **Prototype** | Explicitly *not* locked, built anyway, because building it is the only affordable way to get evidence a still-open question needs. | **Code is a deliberate, bounded bet.** |

**A Prototype carries three obligations, all of them before the code exists:** classified as a Prototype out loud; a **dependency tag** so the rollback set stays known; and a **rollback trigger named in advance**, not reconstructed afterward.

**A rollback trigger is a clause, not a cost.** Latency, size and count surprises are the measurements the Prototype exists to take, and must never read as the bet failing. What fails the bet is a stated invariant proving unholdable. Naming a cost as a trigger makes every measurement look like a rollback signal, which is how a Prototype stops producing evidence and starts producing anxiety.

**A proposal is not a lock, and a Prototype is not a graduation.**

## The companion-file ladder

A design plan outgrows one file. **Split by durability class, not by size or topic** --- topic splits fragment cross-references, which in a design plan are the connective tissue.

| Class | Holds | Read it when |
| --- | --- | --- |
| **Control surface** (`AGENT.<task>.planning.md`) | Status, Getting Started, open decisions + settled register, recommended order, verification, progress, lifecycle | Always, first |
| **Proposal record** (`.proposals.planning.md`) | Candidate schemes, working hypotheses, sweeps and re-checks --- live and superseded alike | When you need the design content itself |
| **Evidence corpus** (`.corpus.planning.md`) | Worked cases, written against today's model | Before arguing any row |
| **Reasoning trail** (`.discussion.planning.md`) | Chronological record, plus graduated row detail keyed by ID | Only when you need *why* a row is shaped the way it is |

**A proposal record must open with a live-versus-superseded table** --- added 2026-08-14, from the first extraction. One file holding both is fine, and topic-splitting it would fragment the cross-references; but **which schemes are live is invisible from the section headings**, and a superseded proposal reads exactly like a live one --- dense, confident, internally consistent. The table is what makes the single class safe. Without it the file *is* the hazard the split was supposed to relieve.

**Normative content is not a proposal, and stays on the control surface.** A frame that rows may not re-argue belongs with the open decisions it constrains, not in the record of things once considered. Same test as the base doc's: proposals are what you are choosing between, and a lock is not.

**They dispose together.** The split is an organizational convenience, not four lifecycles. **One asymmetry to decide at disposal:** the corpus is the only class with a plausible claim to outliving the initiative, so ask whether it graduates somewhere durable rather than being deleted with the rest.

**Every split owes a forwarding pointer, in both files** --- added 2026-08-14, on a proven absence. A split relocates content; it does not relocate the habit, and the parent plan is the file already open. Say in the trail file that new entries go there, and say in the parent's Progress heading that they do not go in the table. Costing: the one initiative that split without this stranded **58 argument-carrying entries** in Progress over the six following days, degraded the table until 8 rows had a spurious third column, and came within one slice of having them compacted away.

**Every split owes a link pass.** Inbound `](#anchor)` references become `](Other.md#anchor)`, and a broken cross-file anchor fails **silently**. Make anchor resolution an explicit item in **Verification**, and prefer copying an existing link to deriving a slug --- a `---` in a heading is an em dash, so its anchor takes two hyphens.

## Progress, and supersession

**Progress is a status view at phase grain.** One row per phase or milestone, not one per session. The chronological record belongs in the reasoning trail, which is indexed for it.

**Diagnosis added 2026-08-14, before the first compaction: do not assume the trail already holds the day-by-day. Measure it first.** In the initiative this rule was written from, it did not. The reasoning trail was split out on one day and its header records the move honestly --- *"split out 2026-08-07 ... Moved **unchanged**"* --- and that is exactly where it stops. Every entry after that date went to Progress instead. Six days later the table held 131 rows in three genres at once: 63 milestone-grain rows for the window the trail covers, **57 rows averaging 1.6--3.1 KB that are the reasoning trail and exist nowhere else**, and 10 undated forward-looking rows that are the only part already doing this clause's job. Compacting that table on the assumption behind this rule would have destroyed the majority of it.

**A split relocates content; it does not relocate the habit.** The trail file starved from the day it was created, and nothing in the document was wrong --- the parent plan is simply the file that is already open. **So compaction is gated on a measurement, not on the ladder saying a trail file exists:** before cutting any row, check the trail's coverage against the journal's, and move first if it is short. What the *durable* fix is --- a forwarding pointer, a continuation convention, or accepting that compaction is recurring rather than one-time --- is [DV-3a](#open-questions-this-file-already-owes-an-answer-to), and is deliberately not written here until the move that tests it has run.

**Progress carries no per-decision-row status** --- added 2026-08-14, on a proven absence. *"AB-36: not started"* in Progress and an AB-36 row in Open decisions are the same fact in two places, and only one of them is maintained. Measured in the first plan compacted: of nine such rows, **six were stale and three contradicted the decision table outright**, one of them still reading *not started* for a row resolved seven days earlier. Progress rows name **phases and streams**; a row id appearing in the left-hand column is the smell.

**Supersession is recorded, not erased --- with a bound.** Keeping a falsified hypothesis is right: the falsification is load-bearing evidence, and deleting it invites the same road to be walked twice. But retained supersession has a cost that compounds --- dense, confident-sounding prose arguing a model nobody is building, which is easy to skim and absorb a conclusion from.

The bound: **inline supersession is for live rows only.** Once a row graduates, its strikethrough layers go with the derivation. In the body, superseded sections are kept but must be **named as superseded in Getting Started**, not merely struck through in place.

## Method findings are an output, not a byproduct

A design initiative produces two kinds of knowledge, and only one of them has a home by default.

- **Design findings** --- about the subject. They graduate to `AGENT.contract.md` / `AGENT.concepts.md` / `AGENT.implementation.md`.
- **Method findings** --- about *how the design work itself is going wrong*: that a lock failed to reach a cluster opened through a different lane, that corrections get recorded on the correcting row rather than the corrected one, that a sweep's ordering signal pointed the wrong way. These belong in **this file**.

**Both are first-class deliverables. Neither is a byproduct of the other.**

**The failure this rule exists to prevent is not "nobody learns."** It is subtler and it has already happened: an initiative notices method problems continually, records each one carefully **inline, where it was noticed**, and thereby makes its own plan heavier with content that was never about the subject --- and then deletes all of it at disposal. Learning with no destination is sediment. It makes the document worse while looking like rigor.

**The routing rule.** When a finding is about *how the work is being done* rather than *what is true of the subject*, it does not stay in the plan body. Either:

- it clears the [admission bar](#what-it-takes-to-add-a-rule) --- promote it to this file, with its basis and date; or
- it does not yet --- record it in [Candidate method findings](#candidate-method-findings) below with its **measured rate** and what would confirm it.

**Do not build a process discipline off one instance.** Record the rate and let a second occasion confirm or deflate it. A process rule taxes every future case to catch the one you just hit, so the ordinary case's cost is the thing to weigh, not the vividness of the failure.

**At disposal, method findings are harvested before the plan is deleted** --- see [When the initiative finishes](#when-the-initiative-finishes).

### Candidate method findings

Observed, not yet rules. Promoted when a second initiative confirms them.

| Finding | Observed in | Status |
| --- | --- | --- |
| **A lock is only reached by whoever reads the section it lives in.** A locked claim fails to propagate to a cluster opened later through a different lane, and the distinction it settled grows back. | Abstraction layers, 2026-08-09 | One instance; watch the next cluster |
| **A row that corrects another row records the correction on itself**, and the corrected row goes on being read as written. Deliberately *not* made a discipline: locks are rare and can afford ceremony, row-to-row correction is continuous. | Abstraction layers --- measured 3 in 27, confirmed in a second tranche | Rate confirmed once; cost of a fix still unjustified |
| **Staleness (age, byte-identity) is a bad ordering signal for a consistency sweep.** What predicted a finding was **proximity to a day on which several decisions closed at once** --- a fact about the *rate* of decision, available at the time and lost afterwards. | Abstraction layers, 2026-08-10, across three tranches | Strong within one initiative; needs a second |
| **Therefore: sweep a batch of same-day decisions at the end of that day**, while the knowledge is present. | Derived from the above, never executed | Untested |

## When the initiative finishes

The base doc's [closing rule](AGENT.md#when-the-task-finishes) applies, with two additions specific to this variant.

**1. The Settled register is the disposal checklist.** Each row is either a falsifiable rule (to `AGENT.contract.md`), a path or behavior (to `AGENT.implementation.md`), a graduated mental model or vocabulary (to `AGENT.concepts.md`), or genuinely task-only and disposable. A settled row that fits none of those was probably never a decision.

**2. Harvest the method findings before deleting anything.** Sweep the plan and its companions for findings about *how the work went* --- they will be scattered inline, wherever they were noticed. Route each to [this file](#method-findings-are-an-output-not-a-byproduct) or drop it deliberately. **This step is easy to skip because method findings do not look like unfinished business** --- they read as closed observations, and they are the only content in the plan whose natural destination is not a package doc. Skipping it deletes the initiative's entire methodological yield.

**Ask the corpus question too:** the corpus is the one companion with a plausible claim to outliving the initiative, so decide whether it graduates somewhere durable rather than being deleted with the rest.

---

## Confidence, and how this file is expected to change

### Where each clause came from

Applying this file's own [constraint-arrival taxonomy](#open-decisions-design--plan-only) to itself. **Derived** clauses were converged on independently by both initiatives, or their absence demonstrably cost something. **Provisional** clauses were written once and are unproven --- re-opening one *does* the reasoning rather than undoing it, and is cheap.

| Clause | Basis | Status |
| --- | --- | --- |
| Phase 0 corpus as the evidence base | Both initiatives, independently; both produced usable evidence | **Derived** |
| Requirement rows vs representation rows | Caught real defects in both (a conflated root row; three representation rows opened with no requirement half) | **Derived** |
| ID stability, never reused | Applied throughout both; splits already follow it | **Derived** |
| Constraint-arrival taxonomy (derived / primitive / placeholder) | Written and used to re-price live rows | **Derived** |
| Graduation tiers | One initiative, but load-bearing there and applied repeatedly, including to elect a real Prototype | **Locked in its home, provisional as a general rule** |
| Inherited-as-settled table | One initiative (the sub-plan), where it worked | Provisional |
| Recognition test for the variant | Written 2026-08-14 as description; has never been used to *reject* a candidate | Provisional |
| Organ **set** | Converged in both | **Derived** |
| Organ **order** (control surface before argument) | Executed once, 2026-08-14; **amended on first use** --- the design body was a missing organ, and Open decisions could not promote with the rest | **Derived**, amended |
| Getting Started, incl. naming live vs superseded sections | Prompted by its absence costing real confusion in one plan; **written once**, and the live/superseded clause was the part with real work in it | Provisional, **executed** |
| Decision-row size limit | New, from observing 17.8 KB single-line rows and edits hiding each other | Provisional |
| **Graduating resolved rows** | **Executed once, 2026-08-14** --- 13 of 49 rows graduated, 78 KB of derivation moved to the trail. **DV-1's fear was not borne out** (3 of 13 needed a split, not most), but the pass gained two preconditions it did not have: *read the end of the Status cell*, on five live rows that read as closed, and *check the named destination*, on two remainders that turned out already relocated | Provisional, **executed**; preconditions doubled |
| Companion-file ladder, four classes | All four now exist; the proposal record was built 2026-08-14 and needed **two amendments on first use** (status table, normative-content carve-out) | **Derived**, amended |
| Progress at phase grain | **Executed once, 2026-08-14** --- 131 rows to 18, after relocating the 58 that were argument rather than status. Its stated assumption (the trail already holds the day-by-day) was **measured false**, and it gained two clauses on first use: a coverage gate before compacting, and *no per-decision-row status* | Provisional, **executed**; assumption falsified |
| Supersession bound | New | Provisional |
| **Method findings are an output** | **Proven absence**, measured: 4+ process findings stranded inline in one plan, whose Lifecycle asks only whether the *corpus* graduates | **Derived** |
| Admission bar (measure the rate; do not build a discipline off one instance) | Written here 2026-08-14, then found **independently arrived at** inside the initiative it governs | **Derived** (convergent) |
| Harvest method findings at disposal | New. **No initiative has disposed** | **Untested** |
| Settled register as disposal checklist | New. **No initiative has disposed**, so this has never run | **Untested** |

### What it takes to add a rule

**Two independent instances, or one proven absence.** A pattern earns a place when two initiatives converge on it without coordination, or when one initiative's *lack* of it visibly cost something. One initiative doing something once is not yet a rule --- leave it in that plan.

**Do not add anticipated rules.** A clause written for a case nobody has hit is the base doc's *wishlist normative text* anti-pattern, one level up. This file governs plans the way a contract governs code, and it can accrue the same debt.

**Every added clause names its basis and date in the table above.** A clause that arrives without a row is indistinguishable, six months on, from one that was earned.

### What it takes to remove one

Removal is cheap and expected --- that is what *provisional* means.

- **A clause a plan had to work around is wrong.** The plan wins; fix the clause.
- **A clause never consulted across two completed initiatives is dead.** Delete it rather than keeping it out of politeness. Volume here has a direct cost: it is read at the start of every initiative.
- **A clause that only ever restated the base doc** belongs in [`AGENT.md`](AGENT.md), not in a variant.

### Open questions this file already owes an answer to

Named now so they are checked rather than rediscovered. Each is resolved by *doing the thing*, not by argument.

| # | Question | Settled by |
| --- | --- | --- |
| ~~**DV-1**~~ | ~~How many resolved rows carry a live remainder? If most do, "graduate" is really "split, then graduate," and the rule understates the work.~~ **Answered 2026-08-14: three of thirteen --- the rule does not understate the work, and the plan was already reaching for it.** That initiative had split a live half out of a row *before* locking it (AB-0 to AB-38) and relocated another row's open verifications rather than carrying them, both without the rule existing. **What the question aimed at was the wrong hazard, though**, which is the more useful half of the answer: the cost is not in splitting remainders, it is in **telling a closed row from an open one at all**. See the two preconditions [graduation](#graduating-a-resolved-row) gained. | Closed |
| **DV-1a** | **Opened 2026-08-14 by the first graduation pass.** The register's verdict cells are required to be **self-sufficient** --- everything a live row needs, with the link reserved for readers asking *why*. That was written as an assertion and is now 13 cells of real prose, some of them long. **Untested: whether a live row can actually be argued from the register alone**, or whether the next reasoning pass finds itself opening the trail anyway --- in which case the split is a filing convention rather than a compaction, and the verdict cells are simply the derivation again at 30%. | The next time an open row is worked that depends on a graduated one |
| ~~**DV-2**~~ | ~~Does one proposal-record file hold live and superseded schemes without re-creating the confusion it was split to fix?~~ **Answered 2026-08-14: yes, but only with a mandatory live-versus-superseded header table** --- no internal division needed, and topic-splitting would have fragmented the cross-references. The ladder gained that requirement plus a carve-out for normative content. | Closed |
| ~~**DV-3**~~ | ~~Does the reasoning trail actually duplicate the Progress journal? If not, compaction **destroys** rather than relocates.~~ **Answered 2026-08-14: no, and not by a little.** The trail covered 3 days of a 9-day initiative and stopped on the day it was split out; 57 of 131 Progress rows, averaging 1.6--3.1 KB, existed **only** in the journal. The question was worth asking before compacting and would have been unrecoverable after. [Progress, and supersession](#progress-and-supersession) now gates compaction on measuring coverage rather than assuming it. | Closed |
| **DV-3a** | **Partly answered 2026-08-14 by the move.** The entries were *defaulted* into Progress, not chosen for it --- the container was visibly failing (rows to 4.6 KB, ordering incoherent, 8 rows malformed into a third column) and nothing stopped, which is what a habit looks like and not what a decision looks like. So the [forwarding pointer](#the-companion-file-ladder) is now required. **Still open: whether a pointer is *sufficient*,** since a written rule is exactly what lost to the pull of the already-open file the first time. If it is not, compaction is a **recurring** obligation rather than a one-time cleanup and this file should say so. | Watching whether the next entries in that initiative land in the trail |
| ~~**DV-4**~~ | ~~Is the organ order right, or does putting the control surface first strand the argument sections without their setup?~~ **Answered 2026-08-14: the question had the wrong subject.** Nothing strands the argument sections --- what would have stranded is the *reader*, had **Open decisions** been promoted with the rest, because decision rows are written in the argument's vocabulary. The control surface splits: Status / Getting Started / Recommended order above, decisions below. The list also turned out to be **missing an organ** (the design body), which is why the order read as control-surface-versus-argument in the first place. | Closed |
| **DV-4a** | Does that split hold for a plan whose decision rows are *short*? The vocabulary dependence here is a function of 5--20 KB rows; a plan with terse rows may promote its whole control surface cleanly, which would make the split a consequence of row size rather than of the variant. | The second design plan to be reshaped |
| **DV-5** | Does the recognition test ever say *no*? A test that admits everything is not a test. | The next plan that is nearly, but not, a design initiative |
| **DV-6** | Does the Settled register survive disposal --- do its rows actually route cleanly to contract / implementation / concepts? | The first initiative to dispose |
| **DV-7** | Does the routing rule actually catch method findings, or do they keep landing inline because that is where they are noticed? If routing only ever happens in a later sweep, the rule should say *sweep* rather than *route*. | Watching where the next method finding lands |
| **DV-8** | Do the three [candidate method findings](#candidate-method-findings) reproduce in a second initiative? All three are currently n=1-initiative, however well measured within it. | Attention history's Phase 0 sweep |
