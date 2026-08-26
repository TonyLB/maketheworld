# Port vocabulary split --- `crossingPort` / `presencePort`

**Status: in progress --- Phases 1--2 complete; Phase 3's decision taken 2026-08-26, its code half outstanding.** Minted 2026-08-25 from conversation; **reordered the same day, and the reorder is the important thing about this file** (see [What this plan is gated on, and it is one field](#what-this-plan-is-gated-on-and-it-is-one-field)). **This is an implementation plan, not a design-stage one** ([which shape](../../../../AGENT.md#two-shapes-of-task-plan--and-which-one-you-are-writing)): the deliverable is mergeable renames and a type change.

**Phase 1 shipped the durable-doc vocabulary**: `AGENT.concepts.md` gained **Crossing port** and **Port** glossary rows, its Port row (L350) and the "identical port topology" line (L396) were reworded off crossing-flavored language, `AGENT.contract.md`'s four flagged clauses now name the crossing-port side they were instanced on, `ephemeraMeta.ts`'s `exteriorRelationLabel` docblock no longer claims a presence port's fan-agreement gap as general, and the `egress` two-senses ambiguity is recorded (not fixed) next to the Egress/ingress row. D-2 and D-4 below are closed.

**The vocabulary comes first and [PR-15](AGENT.presence.planning.md#settled-register) is decided afterwards, in the new vocabulary.** The first draft had it the other way round, gating four phases behind that row. That was wrong, and [why it was wrong](#the-mistake-the-first-draft-made) is recorded below because it is the same error this plan exists to fix.

**Phase 0 also widened its own scope the same day.** Its checklist as first written inventoried only the 3 durable docs, but Phase 2's checklist says its rename is "guided by the Phase 0 inventory" for the **14 `taskPlanning/.../positions/` plans too** --- a second instance of this plan under-scoping itself, caught before execution rather than after. Phase 0 now covers all 17 files; the inventory is in [Phase 0 side inventory (scratch)](#phase-0-side-inventory-scratch) below.

**Phase 2 shipped the task-plan-prose rename**: 14 of the 15 flagged task-plan mentions were renamed to name the side they were instanced on (the 15th, `AGENT.abstractionLayers.corpus.planning.md`:332, is a dated quote the corpus convention preserves verbatim and resolves for free via its own adjacent annotation --- same as the 2 citations). PR-15's body cell was translated into the new vocabulary; **the thesis test came back a falsifier, not a confirmation** --- the row grew 1.3% rather than shrinking, because it was authored the same day as (and partly after) the vocabulary proposal it carries, so most of its hedging had already resolved before this phase touched it. Logged in [the performance tally](../../../../AGENT.designVariant.performance.md).

**Phase 3 decided PR-15, 2026-08-26, and it settled IN FAVOUR of the partition** --- a presence port may be a terminal for foreign-kind edges; presence-branch kind-agreement is a category error. [The row graduated](AGENT.presence.planning.md#settled-register) and its live out-of-scope question split to [PR-16](AGENT.presence.planning.md#open-decisions-design--plan-only). **This is the outcome Phase 4's payoff depends on** --- the [risk register](#what-would-make-this-plan-wrong) named *PR-15 settles against the partition* as the way Phase 4 evaporates, and it did not. **What remains in Phase 3 is the code half**: the live self-heal hazard, which the verdict now licenses a shape for.

**Next step: Phase 3's remaining item** --- fix the classify/heal hazard, then Phase 4.

---

## Why this exists (the thesis, in one paragraph)

The port partition already has **a name for one side and no name for the other**. [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) carries a glossary row for **Presence port** --- *"a port that carries presence, as opposed to a purely relational crossing"* --- and **no counterpart row** for the purely relational crossing it contrasts against. So the complement gets referred to by the **supertype's** name: *port*. Every sentence about the crossing side is then written as a sentence about **ports**, and reads, correctly by its own grammar, as a claim about both sides. **That is the mechanism, and it is not a discipline failure** --- an author who wants to say *crossing port* has no word for it and reaches for the one that exists.

**The evidence that this is worth fixing structurally rather than by care** is two over-generalizations on this exact partition, two days apart, in opposite directions, **each with the qualifying word present in the sentence being quoted**:

| | Over-generalized from | To | Where recorded |
| --- | --- | --- | --- |
| 2026-08-23 | a **`Custom` crossing**'s behaviour | all ports | [PR-C2 Finding 2](AGENT.presence.corpus.planning.md#pr-c2-the-flashlight-the-power-cord-and-the-port-that-locates-nothing) |
| 2026-08-25 | a **`Present` fan**'s behaviour | all ports | [`AGENT.labelAcrossPorts.planning.md`](AGENT.labelAcrossPorts.planning.md), C3's re-grade |

[The performance tally](../../../../AGENT.designVariant.performance.md) records `overbroad-inheritance` at nine hits and records **half of them as unreachable by write-time discipline** --- the failure is on the **read** side, where a later reader inherits the over-broad sentence. **A vocabulary split is a structural actuator: it makes the over-generalization ungrammatical rather than forbidden.** Containment rules are what this pattern has already migrated around.

---

## What this plan is gated on, and it is one field

**Two questions were run together in the first draft, and separating them is what unblocks the work.**

| | Question | Status | Who owns it |
| --- | --- | --- | --- |
| **Existence** | Are there two classes of port, and what are they called? | **Already true, and already in the durable docs.** `kind` ships on the port record; `AGENT.concepts.md` already has a **Presence port** row contrasting against *"a purely relational crossing"* | **This plan.** Naming the unnamed side is **descriptive** |
| **Consequence** | What follows from being one rather than the other? | ~~Open~~ **SETTLED 2026-08-26, in favour** | [**PR-15**](AGENT.presence.planning.md#settled-register) --- terminal-only, kind-agreement as category error, foreign-kind edges permitted. **All three confirmed as written; nothing about the gate's shape changed, only its state** |

~~**So the gate is narrow: `exteriorRelationLabel` may not move onto `CrossingPort` alone until PR-15 settles.**~~ **THE GATE IS OPEN as of 2026-08-26.** `exteriorRelationLabel` may now move onto `CrossingPort` alone, because PR-15 settled that a presence port never carries an exterior label --- the terminal-only claim, which that move asserts in type form. That move asserts a presence port can **never** carry an exterior label, which *is* PR-15's terminal-only claim in type form. **Everything else proceeds now** --- both glossary rows, the contract clauses that need only say which side they were instanced on, the task-plan prose, and **the discriminated union itself**, whose two members are field-identical until that one move lands.

**A field-identical union is not pointless.** It names the two classes, gives call sites a place to branch, and makes the Phase 4 field move a one-line diff rather than a refactor.

### The mistake the first draft made

It claimed the durable-doc half was blocked, citing the base doc's anti-pattern *"open implementation forks in `AGENT.concepts.md` because they feel fuzzy."* **That rule is drawn against unresolved engineering wearing vocabulary's clothes.** A name for a **shipped discriminator** whose partition the glossary **already draws** is not that. Recorded rather than quietly fixed, because it is this plan's own failure mode --- a restriction generalized past what it was drawn against, which is the same shape as the two rows in the thesis table.

### Why the vocabulary should precede PR-15 rather than follow it

**PR-15 is a ~20KB single-line row, written in the vocabulary that lacks the name.** The design variant's own rule is that a row that long *"stops being visible to itself"* --- edits to different parts stop reaching each other. **The plan's thesis predicts that the missing name is part of why it got that long**: every claim about one side had to be written as a hedged claim about ports.

So **Phase 2 rewrites PR-15 in the new vocabulary before Phase 3 decides it**, and that rewrite is **a test of this plan's thesis, not just preparation**:

- **If the row gets materially shorter and its claims get sharper** --- hedges collapsing into a named class --- the structural actuator works, and that is the first direct evidence for it.
- **If it does not** --- if the row is long because the question is hard rather than because the vocabulary was missing --- **that is a falsifier**, and it should be logged as one in the tally rather than shrugged off.

**Record the before/after size.** It is the cheapest measurement this plan can take and the only quantitative one available.

---

## Three findings from the 2026-08-25 survey

**Found by reading the code and the durable docs. Do not re-derive them; do verify they still hold before acting, since all three are in files this plan edits.**

**1. `AGENT.concepts.md`'s Presence-port row is stale against shipped code, and stale in the direction that teaches the confusion.** It reads *"**The discriminator does not exist in code** --- `EphemeraLudicGraphPort` has no `kind`."* It does: `kind` shipped in **`e6bef5096`** ("Added kind property to port type") and is `HostRelationalEdgeKind` on the port record today. A reader who trusts this row concludes the partition is unmechanized and writes accordingly. **This row is also the evidence that the existence question is already settled** --- correcting it is Phase 0, and it is what licenses Phase 1.

**2. The `exteriorRelationLabel` docblock carries the withdrawn over-generalization, in shipped code.** [`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) reads *"a port's interior fan **has no single label**."* Under the rule the user supplied on 2026-08-25 --- *in the case of non-presence ports, all edges agree on both kind and label, with each other and with the port* --- **a crossing port's fan does have a single label**; only a presence port's fan does not. **The docblock correction is Phase 1** (it only needs the two names); **the field move it points at is Phase 4** (it needs PR-15).

**3. `egress` already carries two senses in shipped docs, which is why `egressPort` is barred --- and the bar is now over-determined.** The [glossary](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) says **Egress / ingress** are *"a port's two **ends**"*; [`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) calls `ports` *"the **egress list**"* and an entry *"an egress-list entry: a port record"*. So `egress` names **an end of a port** in one document and **every port record** in another. `egressPort` would land a third sense on a live ambiguity and give a **subtype its supertype's name**. See [D-2](#open-decisions-implementation--plan-only).

---

## Scope, sized

**Measured 2026-08-25.** Recount before Phase 4 --- the ludicGraph area is under active change.

| Surface | Size | Notes |
| --- | --- | --- |
| `LudicGraphPort` symbol occurrences | **150**, across **21** `.ts` files | Most are the type name, which **survives as the union alias** and does not churn |
| `exteriorRelationLabel` sites | **25**, across **9** files | **The gated surface.** The field move is Phase 4 |
| Durable doc "port" mentions | `AGENT.contract.md` **45**, `AGENT.concepts.md` **54**, `ludicGraph/AGENT.md` **14** | **Flagged for Phase 1 (2026-08-25 inventory): `AGENT.contract.md` 4, `AGENT.concepts.md` 2 (+1 stale clause fixed in Phase 0), `ludicGraph/AGENT.md` 0.** Rest classified BOTH/PRESENCE/CROSSING and need no edit |
| `taskPlanning/positions/` plans mentioning port | **all 14** files in this folder, **~1986** raw mentions | **Flagged for Phase 2: 15 substantive + 2 free citations, across 6 files** (`proposals.planning.md` 8, `discussion.planning.md` 2, `presence.corpus.planning.md` 2, `abstractionLayers.planning.md` 1, `corpus.planning.md` 1, `ludicCache.corpus.planning.md` 1). Full list: [Phase 0 side inventory (scratch)](#phase-0-side-inventory-scratch). The other 8 files need no edits |
| **PR-15's row size** | **13560 -> 13742 bytes (+1.3%), one line** | **Measured before/after Phase 2, the thesis measurement --- came back a falsifier, not a confirmation.** See Phase 2's checklist and the tally entry it links |

---

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark each nested line `[X]` as it is done, not only the parent.

- [X] **Phase 0 --- unblocked repairs and the side inventory.**
  - [X] Correct the stale *"the discriminator does not exist in code"* clause in `AGENT.concepts.md`'s **Presence port** row against the shipped `kind` field (finding 1). **State what `kind` is and what it does not yet decide** --- it exists; what it licenses is PR-15's.
  - [X] Build the **side inventory**: for each "port" mention in `AGENT.contract.md`, `AGENT.concepts.md`, `ludicGraph/AGENT.md`, **and all 14 `taskPlanning/.../positions/` plans**, record **crossing / presence / genuinely both**. Scratch table, not into the docs --- see [Phase 0 side inventory (scratch)](#phase-0-side-inventory-scratch).
  - [X] Flag every mention classified as **"reads as both but is instanced on one"** --- those are the payoff. 6 in the durable docs (Phase 1's worklist); 15 substantive + 2 free citations in the task plans (Phase 2's worklist).
  - [X] Recount the scope table.
- [X] **Phase 1 --- durable-doc vocabulary. Unblocked; the existence question is already settled.**
  - [X] Add the **Crossing port** glossary row in `AGENT.concepts.md`, paired with the existing Presence port row; state the discriminator (`kind === 'Present'`) in both. Also reworded the Port row (L350, flagged AMBIGUOUS in Phase 0) and the "identical port topology" line (L396) off crossing-flavored language.
  - [X] Give **port** its own row as the union, saying that using the bare word is a **choice** and not an oversight ([D-4](#open-decisions-implementation--plan-only)).
  - [X] Rewrite the flagged `AGENT.contract.md` clauses to **name the side they were instanced on**. **Descriptive only** --- did not change what any rule *does*. All four Phase-0-flagged clauses (L498--501, L502, L515, L519) now name crossing-port where the original generalized.
  - [X] Correct the `exteriorRelationLabel` docblock's *"has no single label"* to name the presence branch (finding 2). **Wording only; the field does not move yet.**
  - [X] Record the `egress` disposition under [D-2](#open-decisions-implementation--plan-only).
- [X] **Phase 2 --- task-plan prose, and PR-15 rewritten in the new vocabulary.**
  - [X] Rename across the 14 `taskPlanning/.../positions/` plans, **guided by the Phase 0 inventory** (now built --- see [Phase 0 side inventory (scratch)](#phase-0-side-inventory-scratch)), not by search-and-replace. The 15-row table there is the worklist; the other ~1970 raw mentions in those files were section-classified as BOTH/CROSSING/PRESENCE and do not need rewriting. **14 of 15 renamed; the 15th (`AGENT.abstractionLayers.corpus.planning.md`:332) is a dated quote the corpus convention preserves verbatim and resolves for free via its own adjacent annotation.**
  - [X] Leave `port` wherever the sentence is genuinely about both --- **a rename that makes every sentence specific is wrong.**
  - [X] **Rewrite PR-15's body cell in the new vocabulary.** Do **not** change its claim or its lean; this is a translation.
  - [X] **Record the before/after size and whether the claims sharpened.** This is the thesis test --- see [above](#why-the-vocabulary-should-precede-pr-15-rather-than-follow-it). Log a falsifier in the tally if the row does not improve. **13560 -> 13742 bytes (+1.3%): a falsifier, logged 2026-08-25 in [the performance tally](../../../../AGENT.designVariant.performance.md).**
  - [X] Link check, scoped to this folder (baseline in [Verification](#verification)). **Run 2026-08-25; the scratch checker's anchor-slug algorithm does not match GitHub's closely enough to trust its absolute count (472 hits, vs. the documented 55-bad full-corpus baseline), but no heading text or link syntax was touched this phase --- only prose --- so no rename-induced breakage is possible this slice.**
- [ ] **Phase 3 --- decide PR-15.** Its own plan's process, not this one's; this plan only records that it is the gate for Phase 4. **Decision taken 2026-08-26, in favour; the code half remains.**
  - [X] **Split the live out-of-scope question first** --- *whether crossing ports also accept terminal edges* --- to a **fresh ID**. The variant's graduation precondition is that nothing live remains inside a row, and IDs are never reused. **Done: [PR-16](AGENT.presence.planning.md#open-decisions-design--plan-only), 2026-08-26.** Two *other* stated remainders were checked and needed no ID, per the rule that a named destination proves relocation: the **vocabulary split** is this plan's Phases 4--5, and the **three-of-seven untested kinds** caveat is [PR-C2](AGENT.presence.corpus.planning.md#pr-c2-the-flashlight-the-power-cord-and-the-port-that-locates-nothing) Finding 4, which already names itself as the re-check point.
  - [X] Write the verdict sentence, graduate the shell, ~~amend **PR-4**'s reasoning half~~. **Done 2026-08-26. The PR-4 amendment turned out NOT to be owed** --- the row's verdict already reads *"Classification is by `kind` ... and **NOT** by an edge's position,"* and the position reading PR-15 costed lives in PR-4's **trail**, superseded at its 2026-08-22 graduation. **This checklist item inherited the mistake from PR-15's own cell rather than checking it**; the residue is one true but no-longer-sufficient shape clause (*run PORT -> NODE*), noted in the verdict.
  - [X] Write the owed corpus case (**C7-with-no-part-nodes**) --- **before Phase 4**, so it can still falsify. **Paid 2026-08-26 as [a third pass on C7](AGENT.abstractionLayers.corpus.planning.md#the-zero-part-node-question-run-2026-08-26) rather than as a new case**, and it did its job: it **relocated** the necessity off the bystander and onto the route chain instead of confirming the row as written.
  - [ ] **One durable-doc edit the verdict leaves owed**, distinct from the code fix below: [the origin section's failure-recovery row](AGENT.abstractionLayers.proposals.planning.md#a-port-is-a-scale-boundary-not-a-relay-2026-08-06) reads *"where 4 is not a legal port, **or no interior edge leaves it**"* --- lumping a **broken address** with a **legitimately atomic** fact. Those are quiet-because-error and quiet-because-nothing-finer, and PR-15's branch is what separates them.
  - [ ] **Fix the live self-heal hazard in `classifyLudicGraphPortMismatch.ts` and `healLudicGraphPortMismatch.ts`.** [PR-15's row itself names this](AGENT.presence.planning.md#open-decisions-design--plan-only) as **already shipped and live**, not future work like CD6: `edgesReferringToPort` matches `from` **or** `to` against the port address and cannot tell *terminates at* from *crosses*, so a port-to-port `ConnectedTo` between two `Present` ports reads as a mismatch and the self-heal rewrites both presence ports' `kind` to `Custom`, **destroying the presence binding at both ends** --- the diagnostics sweep runs this against real stored port records today, independent of whether any producer yet authors such edges. **Distinct from CD6**, which is scoped to future producer-side write validation once a real producer exists; this is a fix to an already-live read/repair path. Shape follows the verdict this phase just wrote: for `kind === 'Present'`, kind-agreement against a referring edge is the category error, not a check to soften. **Must land before Phase 4/5 or any future producer can author a presence-port terminal edge without it being silently corrected away.**
- [ ] **Phase 4 --- types. The only genuinely gated slice.**
  - [ ] Split `EphemeraLudicGraphPort` into `CrossingPort | PresencePort` discriminated on `kind`, **keeping the old name as the union alias**. *(Field-identical; may land in Phase 1 if convenient.)*
  - [ ] **Move `exteriorRelationLabel` onto `CrossingPort` only.** **This is the gated line and the payoff** --- CD6's category error becomes a type error at the site that would commit it.
  - [ ] Narrow `isEphemeraLudicGraphPort`; **keep the `kind === 'Custom'` requiredness guard** --- it is a crossing-branch rule and must not be lost.
- [ ] **Phase 5 --- call sites.**
  - [ ] Work the **25 `exteriorRelationLabel` sites**; the type change drives them.
  - [ ] `classifyLudicGraphPortMismatch` and `healLudicGraphPortMismatch` carry behaviour, not just field access. **Their known PR-15 fix ships in Phase 3, not here** --- if the type split surfaces a *further* behaviour question in the diff, it goes to PR-15 or CD6, not into the diff.
  - [ ] Full suites in all four areas, **including the integration tests `tsc` does not see**.
- [ ] **Phase 6 --- dispose.** Move lasting content into `AGENT.concepts.md` / `AGENT.contract.md`; sweep inbound pointers; delete this file.

---

## Phase 0 side inventory (scratch)

**Built 2026-08-25, via six read-only survey passes** (three per durable doc, three batched across the 14 task-plan files by size). **Scratch --- not durable vocabulary.** Method: for each "port" mention, find the port kind the sentence was actually instanced on. Only rows classified **AMBIGUOUS-READS-AS-BOTH-INSTANCED-ON-ONE** are listed below (the payoff); everything else was classified BOTH / CROSSING / PRESENCE at the section or mention level and needs no edit --- see the [Scope table](#scope-sized) for the per-file split.

### Durable docs --- Phase 1's worklist (6)

| File : Line | Quote | Why it's instanced on one side |
| --- | --- | --- |
| `AGENT.concepts.md`:350 | "one port records **one crossing** between two ludic graphs" | The canonical **Port** row itself defines the supertype in the unnamed subtype's defining language. Strengthens [D-4](#open-decisions-implementation--plan-only) rather than contradicting it |
| `AGENT.concepts.md`:396 | "identical port topology" | The surrounding passage is about presence-port apprehensibility specifically, not port topology generally |
| `AGENT.contract.md`:498--501 | "healable: a port whose `kind` or `exteriorRelationLabel` disagrees with the edge(s) crossing into it ... rewrites those two fields from the exterior edge" | Single-exterior-edge-mirrors-`kind` is the crossing-port property; a presence port's `kind` is fixed at `'Present'` with no single edge to mirror |
| `AGENT.contract.md`:502 | "A port's single-use lifecycle means one crossing, so a split fan is broken exteriorly" | A disagreeing fan is the normal state for a presence port, not corruption; this declares it broken in general |
| `AGENT.contract.md`:515 | "the port's existence, its `portId`, its single-use lifecycle, and its `kind` ... authoritative without qualification" | Contradicted three lines later by the exterior-checked mismatch-heal logic; true for presence (nothing exterior to disagree with), false for crossing |
| `AGENT.contract.md`:519 | "**One rule, not one per field.** ... the same shape governs `kind`" | The user-flagged sentence. Confirmed: a crossing-only unification (single edge validates `kind`), generalized to "the port record" as a whole |

`ludicGraph/AGENT.md` (12 real mentions after 2 false positives on "Import"): **0 AMBIGUOUS** --- already scopes its one kind-sensitive claim correctly ("iff `'Present'`" / "when kind is `'Custom'`"). Nothing to rewrite there.

### Task-plan files --- Phase 2's worklist (15 substantive + 2 free citations)

| File : Line | Quote | Why it's instanced on one side |
| --- | --- | --- |
| `AGENT.abstractionLayers.proposals.planning.md`:484 | "A port has exactly one interior edge and one exterior referrer." | Crossing-only fan-agreement stated as general; contradicted by CD6's presence-port fan-out |
| `AGENT.abstractionLayers.proposals.planning.md`:483 | "One port records **one** crossing; two connections to the same host are two ports." | "Records one crossing" is crossing-only per PR-15 (a presence port is a terminal, never a crossing) |
| `AGENT.abstractionLayers.proposals.planning.md`:425 | "A port records *one* ingress/egress ... not a general-purpose named interface with fan-out." | Single ingress/egress and no fan-out is the crossing invariant; presence ports fan out across a bucket |
| `AGENT.abstractionLayers.proposals.planning.md`:568 | "Ports are single-use: one port records one crossing, no fan-in and no fan-out." (heading) | Universalizes single-use; `AGENT.abstractionLayers.planning.md`:112 later narrows it to crossings, not interior edges |
| `AGENT.abstractionLayers.proposals.planning.md`:516 | "Rather than defining that state, releasing the port takes both halves." | "Both halves released as one unit" depends on exactly one interior/exterior pair --- the crossing property |
| `AGENT.abstractionLayers.proposals.planning.md`:708 | "the whole has ports into different hosts" | Generic phrasing over a scenario actually motivated by the multi-room presence case |
| `AGENT.abstractionLayers.proposals.planning.md`:137 | "Ports answer that without single-hosting ... there is exactly one rope graph." | Multi-host-presence worked case dressed in generic port vocabulary; presence-side in substance |
| `AGENT.abstractionLayers.proposals.planning.md`:410--419 | P3 worked example: "Numbered **ports** act as ingress/egress borders..." | The founding worked example is presence-motivated (multi-room object); every general port property in the section derives from it |
| `AGENT.abstractionLayers.planning.md`:112 | "the check is the port against every edge incident to it ... well-defined precisely because `kind` passes through" (CD6) | Depends on fan-agreement, the crossing property; the doc catches its own mis-shape for `kind === 'Present'` mid-paragraph |
| `AGENT.abstractionLayers.discussion.planning.md`:247 | "a port can name the graph it exits to, so a whole's own graph enumerates its referrers" | True only of crossing ports (a referring exterior edge exists); presence ports carry only `fromHostId`, no referring edge |
| `AGENT.abstractionLayers.discussion.planning.md`:289 | "a port is a scale boundary at which the description changes, not a relay" | Derived from crossing-port kind-mismatch cases; presence ports have no pass-through mechanism at all |
| `AGENT.abstractionLayers.corpus.planning.md`:332 | "an object is present in a room iff at least one of its ports egresses there" | True only restricted to presence-kind ports; crossing ports also egress but don't establish presence |
| `AGENT.abstractionLayers.ludicCache.corpus.planning.md`:279 | "Compose at ports, never at nodes ... ports are not referents and nodes are" | General rule assumes crossing-style pass-through; written before presence ports could be edge terminals |
| `AGENT.presence.corpus.planning.md`:218,222 | "an edge passes through a port ... rather than terminating either side of it" | True only of crossing ports; presence ports are terminals, never crossings (per `AGENT.labelAcrossPorts.planning.md`'s later correction) |
| `AGENT.presence.corpus.planning.md`:266 | "a port may store exactly what is invariant across the fan" | Offered as a general rule; `AGENT.labelAcrossPorts.planning.md` (`overbroad-inheritance`) later shows it was instanced only on a `Present` port's bucket |
| `AGENT.presence.planning.md`:160 *(citation, no separate edit)* | quotes `AGENT.concepts.md`'s Port row verbatim | Resolves for free once the durable-doc L350 fix above lands in Phase 1 |
| `AGENT.labelAcrossPorts.planning.md`:133--134 *(citation, no separate edit)* | quotes `ephemeraMeta.ts`'s docblock: "a port's interior fan has no single label" | Resolves for free once Phase 1's docblock wording fix (finding 2) lands |

**Files with 0 AMBIGUOUS findings** (written after the `kind` discriminator was explicit, or after `AGENT.labelAcrossPorts.planning.md` itself, which exists to hunt this pattern): `AGENT.presence.discussion.planning.md`, `AGENT.edgeAbstractions.planning.md`, `AGENT.edgeAbstractions.corpus.planning.md`, `AGENT.edgeAbstractions.discussion.planning.md`, `AGENT.attentionHistory.planning.md`, `AGENT.attentionHistory.corpus.planning.md`, `AGENT.labelAcrossPorts.planning.md` (beyond the one citation above), `ludicGraph/AGENT.md`.

`AGENT.presence.planning.md`'s PR-15 row (~20KB, line 160) was **not** classified internally --- it's the row Phase 2 rewrites wholesale in the new vocabulary; a line-level pass here would be redundant with that phase.

---

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| **D-1** | **Do the two type names take a prefix?** `CrossingPort` / `PresencePort` read cleanly alone but sit in a file where every neighbour is `EphemeraLudic*`. The union alias keeps the long name, so this is only about the two branches | Phase 4 | **Open.** Lean: follow the file's neighbours; check, do not assume |
| **D-3** | **Does the split imply a data migration?** Port records are **persisted** | Phase 4 | **Open --- verify before Phase 4.** Lean: **no** --- `kind` already ships, the JSON is unchanged, and the split narrows static types over the same values |

**Shipped in Phase 1, removed per this table's own header instruction:**

- **D-2** (fix the `egress` two-senses ambiguity, or leave it): **recorded, not fixed**, per its lean --- see the note on `AGENT.concepts.md`'s **Egress / ingress** row.
- **D-4** (what happens to sentences genuinely about both sides): **kept the bare word `port`, and gave it its own glossary row** stating that as a choice --- see `AGENT.concepts.md`'s **Port** row.

---

## What would make this plan wrong

**Stated as falsifiers, because a vocabulary plan is easy to complete and hard to evaluate.**

- **Rewriting PR-15 in the new vocabulary does not improve it** (Phase 2). Then the row is long because the question is hard, and the actuator claim loses its only direct measurement. **Log it in the tally as a falsifier**, not as a null result.
- **PR-15 settles against the partition** (Phase 3). Then `presencePort` names a class with no consequences attached. **Phases 0--2 survive** --- the two classes still exist, since `kind` ships either way --- but Phase 4's payoff evaporates and the naming should be re-read as descriptive only.
- **The confusion recurs in the new vocabulary.** If a tenth `overbroad-inheritance` hit lands **after** Phase 1 and is about ports, **the structural-actuator theory failed**, not the author --- log it that way.
- **A hosting-kind port appears and behaves unlike a peer-kind one.** The split collapses AB-54's three classes to two, untested at `On`/`In`/`PartOf` per [PR-C2 Finding 4](AGENT.presence.corpus.planning.md#pr-c2-the-flashlight-the-power-cord-and-the-port-that-locates-nothing). **This is the weakest of the four**: `presencePort` is unaffected, `crossingPort` would gain a sub-branch, and the union alias absorbs it. Recorded for completeness, not as a real risk.

---

## Verification

Run from the repo root unless noted. **These are the commands for this plan's slices**; where an area doc disagrees, the area doc wins.

```bash
# Types (Phase 4) --- build the project graph
npm run build

# Per-area suites (Phases 4--5). Each package uses jest.
cd packages/mtw-interfaces && npm test
cd packages/mtw-gateways  && npm test
cd lambda/ephemera        && npm test
cd lambda/diagnostics     && npm test
```

**`tsc` does not cover `lambda/ephemera`'s `*.integration.test.ts`** --- they sit outside the tsconfig. **Run the full ephemera suite after any rename**, and grep **module paths** as well as symbols, since a renamed export can leave an import only the untyped test file resolves.

```bash
# Symbol sweep after Phases 4--5
grep -rn "LudicGraphPort\|exteriorRelationLabel" --include="*.ts" packages lambda | grep -v node_modules

# Link check for Phases 1--2 (scratch script; scope it to this folder)
python3 <scratchpad>/linkcheck.py AGENT.portVocabularySplit.planning.md
```

**Link-check baseline:** a full-corpus run reports **55 bad**, all pre-existing and **outside this folder** --- seven anchors in `AGENT.abstractionLayers.discussion.planning.md`, ~40 missing-file links in two `coyoteGame/` plans (they appear to use six `../` where five reaches the root), and a handful in `lambda/assets/`. **Scope the run to the files this plan touches.**

---

## Getting Started

1. Read [`taskPlanning/AGENT.md`](../../../../AGENT.md) once for the durability split.
2. Read [**What this plan is gated on**](#what-this-plan-is-gated-on-and-it-is-one-field) before anything else. **The single most likely way to get this plan wrong is to re-widen the gate** --- a reader who assumes the whole thing waits on PR-15 will stall four phases that do not, which is what the first draft did.
3. Read the [Presence port glossary row](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) and the [`EphemeraLudicGraphPort` type](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) **side by side**. The gap is finding 1, and it is also the proof that the existence question is already settled.
4. Read [**PR-15**](AGENT.presence.planning.md#open-decisions-design--plan-only) only when Phase 2 or 3 needs it. Its Status cell carries a pointer to the vocabulary proposal at the end of its body cell.
5. Before touching any sentence about ports: **find the port kind it was instanced on.** That standing instruction comes from [`AGENT.labelAcrossPorts.planning.md`](AGENT.labelAcrossPorts.planning.md) and is the whole method of Phase 0's inventory.
