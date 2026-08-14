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

1. **Status** --- stage, what is next, and whether **any** code is in scope.
2. **Getting Started** --- per the base doc's [testing-doc pattern](AGENT.md#getting-started-testing-doc-pattern), plus one clause specific to this variant: **name which sections are live design and which are retained-but-superseded.** A design plan that records supersessions accumulates confident prose for models nobody is building.
3. **What is inherited as settled** *(sub-plans only)* --- a table of premises taken from the parent, with the consequence for this plan. Its job is to stop the sub-plan re-arguing its own foundation; see [`AGENT.attentionHistory.planning.md`](lambda/ephemera/dataSource/positions/AGENT.attentionHistory.planning.md) for the pattern.
4. **Phase 0 corpus** --- the evidence base, usually its own file. Cases are written against *today's* model and state which limit they hit. **Do not propose solutions in the corpus.**
5. **Open decisions (design --- plan only)** and the **Settled register** beneath it.
6. **Recommended order** --- checkboxes per the base doc.
7. **Verification**, **Progress**, **Lifecycle**.

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

**They dispose together.** The split is an organizational convenience, not four lifecycles. **One asymmetry to decide at disposal:** the corpus is the only class with a plausible claim to outliving the initiative, so ask whether it graduates somewhere durable rather than being deleted with the rest.

**Every split owes a link pass.** Inbound `](#anchor)` references become `](Other.md#anchor)`, and a broken cross-file anchor fails **silently**. Make anchor resolution an explicit item in **Verification**, and prefer copying an existing link to deriving a slug --- a `---` in a heading is an em dash, so its anchor takes two hyphens.

## Progress, and supersession

**Progress is a status view at phase grain.** One row per phase or milestone, not one per session. The chronological record belongs in the reasoning trail, which is indexed for it.

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
| Organ **order** (control surface before argument) | New here; **neither plan is currently in this order** | Provisional |
| Getting Started, incl. naming live vs superseded sections | Prompted by its absence costing real confusion in one plan | Provisional |
| Decision-row size limit | New, from observing 17.8 KB single-line rows and edits hiding each other | Provisional |
| **Graduating resolved rows** | New. **Never executed** | **Untested** |
| Companion-file ladder, four classes | Three classes exist in practice; the **proposal record is hypothetical** | Provisional |
| Progress at phase grain | New. **Never executed**; assumes the reasoning trail already holds the day-by-day | **Untested** |
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
| **DV-1** | How many resolved rows carry a live remainder? If most do, "graduate" is really "split, then graduate," and the rule understates the work. | The first graduation pass |
| **DV-2** | Does one proposal-record file hold live and superseded schemes without re-creating the confusion it was split to fix? The ladder asserts one class; it may need an internal division. | The first proposals extraction |
| **DV-3** | Does the reasoning trail actually duplicate the Progress journal? If not, compaction **destroys** rather than relocates. | Verifying before the first compaction |
| **DV-4** | Is the organ order right, or does putting the control surface first strand the argument sections without their setup? | A cold read after the first reshape |
| **DV-5** | Does the recognition test ever say *no*? A test that admits everything is not a test. | The next plan that is nearly, but not, a design initiative |
| **DV-6** | Does the Settled register survive disposal --- do its rows actually route cleanly to contract / implementation / concepts? | The first initiative to dispose |
| **DV-7** | Does the routing rule actually catch method findings, or do they keep landing inline because that is where they are noticed? If routing only ever happens in a later sweep, the rule should say *sweep* rather than *route*. | Watching where the next method finding lands |
| **DV-8** | Do the three [candidate method findings](#candidate-method-findings) reproduce in a second initiative? All three are currently n=1-initiative, however well measured within it. | Attention history's Phase 0 sweep |
