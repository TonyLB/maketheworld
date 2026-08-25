# Port vocabulary split --- `crossingPort` / `presencePort`

**Status: in progress --- Phase 0 not started.** Minted 2026-08-25 from conversation; **reordered the same day, and the reorder is the important thing about this file** (see [What this plan is gated on, and it is one field](#what-this-plan-is-gated-on-and-it-is-one-field)). **This is an implementation plan, not a design-stage one** ([which shape](../../../../AGENT.md#two-shapes-of-task-plan--and-which-one-you-are-writing)): the deliverable is mergeable renames and a type change.

**The vocabulary comes first and [PR-15](AGENT.presence.planning.md#open-decisions-design--plan-only) is decided afterwards, in the new vocabulary.** The first draft had it the other way round, gating four phases behind that row. That was wrong, and [why it was wrong](#the-mistake-the-first-draft-made) is recorded below because it is the same error this plan exists to fix.

**Next step: Phase 0.**

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
| **Consequence** | What follows from being one rather than the other? | **Open** | [**PR-15**](AGENT.presence.planning.md#open-decisions-design--plan-only) --- terminal-only, kind-agreement as category error, foreign-kind edges permitted |

**So the gate is narrow: `exteriorRelationLabel` may not move onto `CrossingPort` alone until PR-15 settles.** That move asserts a presence port can **never** carry an exterior label, which *is* PR-15's terminal-only claim in type form. **Everything else proceeds now** --- both glossary rows, the contract clauses that need only say which side they were instanced on, the task-plan prose, and **the discriminated union itself**, whose two members are field-identical until that one move lands.

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
| Durable doc "port" mentions | `AGENT.contract.md` **45**, `AGENT.concepts.md` **54**, `ludicGraph/AGENT.md` **14** | Each needs reading for *which side is meant*, not blind replacement |
| `taskPlanning/positions/` plans mentioning port | **all 14** files in this folder | Plan debt |
| **PR-15's row size** | **~20KB, one line** | **Record before and after Phase 2** --- it is the thesis measurement |

---

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark each nested line `[X]` as it is done, not only the parent.

- [ ] **Phase 0 --- unblocked repairs and the side inventory.**
  - [ ] Correct the stale *"the discriminator does not exist in code"* clause in `AGENT.concepts.md`'s **Presence port** row against the shipped `kind` field (finding 1). **State what `kind` is and what it does not yet decide** --- it exists; what it licenses is PR-15's.
  - [ ] Build the **side inventory**: for each "port" mention in `AGENT.contract.md`, `AGENT.concepts.md` and `ludicGraph/AGENT.md`, record **crossing / presence / genuinely both**. Scratch table, not into the docs.
  - [ ] Flag every mention classified as **"reads as both but is instanced on one"** --- those are the payoff, and they are what Phase 1 rewrites.
  - [ ] Recount the scope table.
- [ ] **Phase 1 --- durable-doc vocabulary. Unblocked; the existence question is already settled.**
  - [ ] Add the **Crossing port** glossary row in `AGENT.concepts.md`, paired with the existing Presence port row; state the discriminator (`kind === 'Present'`) in both.
  - [ ] Give **port** its own row as the union, saying that using the bare word is a **choice** and not an oversight ([D-4](#open-decisions-implementation--plan-only)).
  - [ ] Rewrite the flagged `AGENT.contract.md` clauses to **name the side they were instanced on**. **Descriptive only** --- do not change what any rule *does*. The *"Port records: field scope and the conflict rule"* section is the main one; its *"one rule, not one per field"* claim is the sentence most likely to need a side.
  - [ ] Correct the `exteriorRelationLabel` docblock's *"has no single label"* to name the presence branch (finding 2). **Wording only; the field does not move yet.**
  - [ ] Record the `egress` disposition under [D-2](#open-decisions-implementation--plan-only).
- [ ] **Phase 2 --- task-plan prose, and PR-15 rewritten in the new vocabulary.**
  - [ ] Rename across the 14 `taskPlanning/.../positions/` plans, **guided by the Phase 0 inventory**, not by search-and-replace.
  - [ ] Leave `port` wherever the sentence is genuinely about both --- **a rename that makes every sentence specific is wrong.**
  - [ ] **Rewrite PR-15's body cell in the new vocabulary.** Do **not** change its claim or its lean; this is a translation.
  - [ ] **Record the before/after size and whether the claims sharpened.** This is the thesis test --- see [above](#why-the-vocabulary-should-precede-pr-15-rather-than-follow-it). Log a falsifier in the tally if the row does not improve.
  - [ ] Link check, scoped to this folder (baseline in [Verification](#verification)).
- [ ] **Phase 3 --- decide PR-15.** Its own plan's process, not this one's; this plan only records that it is the gate for Phase 4.
  - [ ] **Split the live out-of-scope question first** --- *whether crossing ports also accept terminal edges* --- to a **fresh ID**. The variant's graduation precondition is that nothing live remains inside a row, and IDs are never reused.
  - [ ] Write the verdict sentence, graduate the shell, amend **PR-4**'s reasoning half. **PR-4's amendment is doc-only**: the cover walk is not implemented, so *"the walk must filter `kind === 'Present'`"* changes a sentence and no code.
  - [ ] Write the owed corpus case (**C7-with-no-part-nodes**) --- **before Phase 4**, so it can still falsify.
- [ ] **Phase 4 --- types. The only genuinely gated slice.**
  - [ ] Split `EphemeraLudicGraphPort` into `CrossingPort | PresencePort` discriminated on `kind`, **keeping the old name as the union alias**. *(Field-identical; may land in Phase 1 if convenient.)*
  - [ ] **Move `exteriorRelationLabel` onto `CrossingPort` only.** **This is the gated line and the payoff** --- CD6's category error becomes a type error at the site that would commit it.
  - [ ] Narrow `isEphemeraLudicGraphPort`; **keep the `kind === 'Custom'` requiredness guard** --- it is a crossing-branch rule and must not be lost.
- [ ] **Phase 5 --- call sites.**
  - [ ] Work the **25 `exteriorRelationLabel` sites**; the type change drives them.
  - [ ] `classifyLudicGraphPortMismatch` and `healLudicGraphPortMismatch` carry behaviour, not just field access. **Do not change what they decide here** --- a behaviour question found in the diff goes to PR-15 or CD6, not into the diff.
  - [ ] Full suites in all four areas, **including the integration tests `tsc` does not see**.
- [ ] **Phase 6 --- dispose.** Move lasting content into `AGENT.concepts.md` / `AGENT.contract.md`; sweep inbound pointers; delete this file.

---

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| **D-1** | **Do the two type names take a prefix?** `CrossingPort` / `PresencePort` read cleanly alone but sit in a file where every neighbour is `EphemeraLudic*`. The union alias keeps the long name, so this is only about the two branches | Phase 4 | **Open.** Lean: follow the file's neighbours; check, do not assume |
| **D-2** | **Fix the `egress` two-senses ambiguity (finding 3), or leave it?** Pre-existing and independent of the split; fixing it is scope creep, leaving it lands the split next to a live ambiguity of the same shape | Phase 1 | **Open.** Lean: **record, do not fix** --- but say so in the doc, since an unremarked ambiguity beside a freshly-split vocabulary reads as endorsed |
| **D-3** | **Does the split imply a data migration?** Port records are **persisted** | Phase 4 | **Open --- verify before Phase 4.** Lean: **no** --- `kind` already ships, the JSON is unchanged, and the split narrows static types over the same values |
| **D-4** | **What happens to sentences genuinely about both sides?** They keep the bare word `port` --- but a reader trained by this split may read a deliberate supertype mention as an oversight | Phase 1 | **Open.** Lean: keep them, and **give `port` a glossary row** saying the bare word is a choice |

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
