# Object manipulation parse --- fault-tolerant trust + Plan IR foundation

**Status:** Not started. **Gateway** for Phase C of [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) --- do not begin Plan IR / compiler work until **Gateway exit** below is satisfied.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

Prerequisite (shipped): Phase B relational vertical + Phase A membership compiler --- [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md#object-manipulation-classify--enrich-steady-state-shipped---b25-split-intents). Conceptual vocabulary: [`llm/AGENT.concepts.md`](../../../../../lambda/ephemera/llm/AGENT.concepts.md) (two design axes, **fault recovery**: correct / backtrack / supplement).

## Purpose

Re-architect the **`objectManipulation`** enrich pipeline from **trusted-output** (single grounded id or terminal Error per span) toward **fault-tolerant** dynamics where provisional handoffs, recovery loops, and player **Consulting** are first-class --- without relaxing **design seams** or **field ownership**.

In parallel, lay the **compiler foundation** Phase C needs: Plan IR **`resolveComponent`** should consume **span resolution artifacts** (candidate pools + confidence), not assume upstream already emitted one trusted `EphemeraId`.

Retire this plan when gateway criteria ship and Phase C begins (or when merged into steady-state docs); git retains history.

## Relationship to Phase C (manipulationFrame plan)

[`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) Phase C introduces **`ParsePlanStep`**, a deterministic **compiler**, and composition (BD-8, BD-9). That compiler's **`resolveComponent`** primitive maps free-text spans to trusted ids --- today implicitly done inside **`compileMembershipAtomic`** / **`compileRelational`** with trusted-output identity.

**Why this plan gates Phase C:**

| Phase C need | Trusted-output gap today |
| --- | --- |
| **`resolveComponent` in Plan IR** | Identity emits one id or Error; no stable provisional artifact for the compiler to adjudicate or defer |
| **Multi-span / multi-step frames** | Wrong early id is costly; no correction loop before compound apply (BD-9) |
| **Composition (drop + relate)** | Held-object + surface relation needs reliable subject/target resolution under paraphrase |
| **Consulting UX** | No parse result variant for "player, do you mean X or Y?" --- only Error or silent wrong apply |

Phase C **may** land length-1 plans with trusted-output resolve as a **temporary** shim only if this gateway explicitly records that deferral --- default expectation is **fault-tolerant resolve artifacts ship first**.

## Target architecture (steady-state sketch)

```text
classify (trusted-output or provisional intent --- TBD at FT-4)
  -> enrich orchestration (fault-tolerant)
       -> span resolution tier (exact | lexical+embed rank | optional adjudication)
            -> SpanResolution artifact per span (candidates + confidence + status)
       -> recovery loop as needed (supplement -> correct | backtrack)
       -> frame extract / complexity hops (Abstain | Consult | proceed)
       -> plan compiler (deterministic; closed-world legality)
            -> resolveComponent commits ONE id per span at compile time OR emits Consult / Error
       -> executor -> trusted ids on bus (commit boundary unchanged)
```

**Commit boundary unchanged:** positions ingress and atomic apply (BD-9) still require **trusted-output** ids. Fault tolerance lives **before** terminal parse / stream publish.

**Seam unchanged:** classify owns intent topology; frame extract owns relational **`operationKind`**; identity tier owns referential grounding **job** --- only the **trust posture** and **handoff shape** change.

## Scope

### In scope

- Provisional **span resolution** types and guards (candidate pool, confidence, resolution status).
- Identity tier refactor: embedding as **recommender** (not terminal **`Resolved`**), optional lexical rank merge, documented recovery patterns.
- Product-facing **Abstention** vs **Consulting** parse outcomes (wire + handler contract --- at minimum design + types; client UX may follow).
- Downstream hop prompt/parser review: complexity LLM, frame extract --- when to abstain vs consult vs proceed.
- Plan IR **foundation** types: **`resolveComponent`** input = **`SpanResolution`**, output = committed id | consult | error (feeds C1 in sibling plan).
- Calibration + tests for candidate-pool behavior; update [`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md) steady-state when shipped.
- Durable doc updates: [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md), [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) (trust posture + handoff tables).

### Out of scope (unless plan updated)

- Full Phase C executor, compound kernel apply, BD-8 composition (sibling plan --- after gateway).
- Phase D plan LLM (sibling plan).
- Client UI for Consulting (may stub **`PublishMessage`** / OOC only in v1).
- Player feedback / retroactive revision loops ([`llm/AGENT.concepts.md`](../../../../../lambda/ephemera/llm/AGENT.concepts.md) --- future trust-axis).
- Replacing classify with a single end-to-end compiler LLM **for the whole game** --- classify remains the **family** discriminator (manipulation vs navigation vs speech vs Acme). **Note (FT-7 / FT-2):** the *intra-manipulation* sub-topology (membership vs relational) and **`verbClass`** may become **provisional hints** consumed by the joint hop rather than committed classify routing; that narrowing **is** in scope, a universal compiler is not.

## Background (durable docs --- link, do not duplicate)

| Topic | Doc |
| --- | --- |
| Two axes + fault recovery | [`llm/AGENT.concepts.md`](../../../../../lambda/ephemera/llm/AGENT.concepts.md) |
| Normative trust + recovery rules | [`llm/AGENT.contract.md`](../../../../../lambda/ephemera/llm/AGENT.contract.md) |
| Current hop narrative (trusted-output v1) | [`enrich/objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) |
| Embedding closed-loop direction | [`enrich/objectManipulation/embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md) |
| Calibration tooling | [`calibration/AGENT.md`](../../../../../lambda/ephemera/calibration/AGENT.md) |
| Phase C Plan IR (blocked on this plan) | [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) |

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read [`llm/AGENT.concepts.md`](../../../../../lambda/ephemera/llm/AGENT.concepts.md) --- **Output trust models**, **Fault recovery patterns**; note **closed-world** vs **closed-loop** disambiguation.
3. Read current pipeline: [`enrich/objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md), trace [`identityStage.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/identityStage.ts) and [`embeddingMatch/`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/).
4. Re-read embedding calibration snapshot + asymmetric ladder conclusions in [`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md).
5. Skim Phase C target in [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) (**Phase C --- Plan IR and composition**).
6. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md).
7. Baseline:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/ \
  dataSource/actions/parseCommand.test.ts \
  calibration/objectMatch/
```

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement this initiative and unblock Phase C. When a decision ships, record it in **`AGENT.contract.md`** / **`AGENT.implementation.md`** / feature **`AGENT.md`** and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **FT-1** | **Candidate pool construction** --- How do **embeddings** (cosine rank on **`EMBEDDING#IMPROMPTU`**, optional enriched index) combine with a tunable **`lexicalRelevance`** function to produce a **ranked candidate pool** per span with **relevance ratings** (absolute score, margin, eligible count, source tags)? Merge strategy + joint-score shape settled in **FT-1 decisions so far** below (**no admission floor**; rank-all + full ranked list + **gap-trim shortlist under a Top-N ceiling**; **weighted RMS** joint score; strict conjunctive gate deferred to FT-5). Depends on **FT-8** (per-signal normalization to `[0,1]`, which must be **absolute** not within-set --- see decisions). No architectural fork remains. **Calibration-owned (not decisions), fit in FT-1.3:** Top-N ceiling, gap-trim threshold, RMS weights `w_l`/`w_e`. **Delegated:** embedding index shape -> FT-8; [`thresholds.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts) floor migration -> FT-5 confidence stage (no longer pool-admission floors). | FT-2, FT-3, FT-8, gateway | Decided (pending calibration) |
| **FT-2** | **Identity LLM necessity** --- If we no longer require a **trusted-output single `objectId`** per span at the identity tier, do we still need a dedicated **identity LLM** hop? Rejected: (a) pool + deterministic adjudication only; (b) pool + lightweight validator LLM; (c) pool + identity LLM only on **backtrack** when pool ambiguous; (d) retain identity LLM but change output to **rank/reason** not pick-one. **Chosen: (e) merge identity into a joint `(identity, plan)` adjudicator** over the FT-1 pool, with an **unchanged deterministic legality/commit tail** --- see **FT-2 decisions so far** + **Instruction compiler + validator architecture**. Bedrock-bypass for common cases is answered by **staged fast-path composition** (mechanism documented; enabling capabilities relocated to their own build threads, not decision blockers). | FT-3, FT-7, gateway | **Decided (e) (2026-07-08)**; enablers + validation pending (in-memory sandbox, per-enum transfer semantics, tiered fast-path coverage, prototype + calibration) |
| **FT-3** | **Abstention vs Consulting downstream** --- How do **frame extract**, **complexity LLM**, and the **compiler** prompt/observe outcomes so the pipeline cleanly distinguishes **Abstain** ("I can't parse that" --- terminal or soft stop) vs **Consult** ("Player, do you mean X or Y?" --- provisional, resumable)? Wire shape: new **`ParseCommandResult`** variants vs enriched **`Error`** with structured **`consultCandidates`**? Who owns Consult copy (actions vs perception)? | FT-4, gateway, client | Open |
| FT-4 | **`SpanResolution` artifact** --- Canonical type for provisional span grounding (span text, candidates[], status: `resolved` \| `ambiguous` \| `noMatch` \| `consult`, confidence fields). Shared by membership + relational paths and Plan IR **`resolveComponent`**. | FT-1--3, C1 | Open |
| FT-5 | **Auto-resolve / commit-gate policy** --- When may selection **commit** a candidate without Consult (absolute confidence **floor** + **margin** over runner-up)? Owns the floor/margin the deterministic **selector** applies to the N-candidate rubric (**legality gates, confidence ranks**; decline -> Consult) --- see **Instruction compiler + validator architecture**. The floor is set by the **recoverability gradient** (see **Recoverability gradient + optimistic proposal**): commit on modest confidence when wrongness is **illegal-if-wrong** (deterministically catchable), hold floor + Consult when **legal-but-wrong**. Align with FT-1 relevance / FT-8 absolute scale; document vs identity-tier auto-resolve (prefer **one** commit point). | C1, gateway | Open |
| FT-6 | **Recovery orchestration owner** --- Inline in [`identityStage.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/identityStage.ts) vs dedicated orchestrator module vs [`llm/pipeline/`](../../../../../lambda/ephemera/llm/pipeline/AGENT.md) wrapper for identity+validation loop. | FT-2, FT-3 | Open |
| FT-7 | **Classify trust posture for Phase C** --- Keep classify **trusted-output** while enrich becomes fault-tolerant, or allow provisional intent handoff? **Direction (2026-07-08, see FT-2 decisions so far):** **two-level classify** --- **trusted-output at the family level** (manipulation vs navigation vs speech vs Acme; keeps the joint prompt scoped) but **provisional hints** for the **intra-manipulation** sub-fields (**`verbClass`**, membership-vs-relational sub-split) consumed as **evidence** by the joint hop, not committed routing. Not a single end-to-end compiler for the whole game. | C4, FT-2 | Open (direction set) |
| **FT-8** | **Embedding cosine -> `[0,1]` relevance normalization** --- The RMS joint score (FT-1) requires each signal on a comparable relevance scale, but raw cosines cluster tightly (~0.05-0.25) with meaningful **ratio** separation and tiny **absolute** separation (observed power/log-like gradient, not linear). What mapping turns raw cosine into a `[0,1]` relevance? Candidates: log or power transform (`cosine^k`); logistic fit; per-catalog-shape (unary vs multi) rescale. **Also owns the embedding index-shape fork** (delegated from FT-1): symmetric `shortName`-only (production v1) vs enriched asymmetric `shortNamePlusDescription` ([`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md) asymmetric ladder), since the index shape sets the cosine distribution being normalized (paraphrase uplift vs absent-object risk trade-off). **Constraint (from FT-1 no-floor):** the mapping feeding the downstream noMatch judgment must be **absolute / globally calibrated**, *not* a within-candidate-set rescale (min-max / percentile), which always sends top-1 -> ~1.0 and makes "none match" unknowable; within-set rescale is admissible only for RMS comparability if a separate absolute top-1 signal is retained. Fit against calibration snapshots + asymmetric ladder; must not reintroduce the absent-object false positives that absolute floors currently guard. Applies to `lexicalRelevance` output too if its raw scale is non-linear. | FT-1, FT-5, gateway | Open |

### FT-1 decisions so far (2026-07-08)

Plan-only; graduate to durable docs (**`embeddingMatch/AGENT.md`**, contract) when FT-1 ships.

**Terminology --- relevance, not confidence.** At the pool-construction tier we score **relevance** (should this object enter the ranked candidate pool for this span?), not **confidence** (are we sure this is *the* match?). We are never confident about a non-exact match, so confidence language is reserved for **exact resolve** and the compile-time **auto-resolve** gate (FT-5). Rename `confidence ratings` -> `relevance ratings` across FT-1 artifacts.

**Lexical relevance is a tunable function.** `lexicalRelevance(span, shortName) -> number` is an explicit scoring function that **will be tuned and refactored over time** to improve pool quality --- treat the v1 body as a starting heuristic, not a contract.

- **v1 body:** token overlap between normalized-span tokens and normalized-shortName tokens, **down-weighted** when the overlap is only a small portion of the shortName (object has many other words -> probably a different object) or of the span (player said many other words -> probably a more specific reference). Concretely: shared-token count scaled by `min(overlap / shortNameTokens, overlap / spanTokens)`. Exact constants are calibration-owned.
- **Deferred tuning (not v1):** edit distance / stemming, description tokens when the enriched index ships, TF-IDF-style down-weighting of common tokens, phrase-order signals.

**Merge strategy --- no admission floor, rank-all, weighted-RMS joint score.**

- **Pool admission = unconditional rank, no floor.** The pool builder's only job is to *rank*, not to *gate*: score every catalog candidate and rank by joint relevance, with **no absolute admission floor**. Gating ("is the best actually good enough?") is a downstream **confidence** decision (FT-5 / identity adjudication), not pool membership --- consistent with "relevance is disjunctive, confidence is conjunctive." Rationale: a fault-tolerant downstream must be able to conclude *"I examined the best available matches and none fit"* --- which needs a **best-of-worst ranking to examine**, not an empty pool. A floor discards exactly the top-of-worst evidence the noMatch/Abstain judgment (and calibration logging) needs, and the unary trap is handled *better* downstream with both signals visible (`take the sword` vs anvil-only room -> `[anvil @ ~0.05]` -> low absolute + zero lexical -> `noMatch`). The RMS **soft-OR** still supplies the "either signal lifts the score" behavior at the *score* level; only the separate per-signal admission floor is dropped.
- **Truncation = gap-trim under a Top-N ceiling; two orthogonal cuts.** Building the handoff shortlist and judging noMatch are *different* cuts and must stay separate:
  1. **How many to show = gap-trim.** Walk the ranked list top-down and include candidates until a hard **Top-N ceiling** (e.g. 5) *or* a **relative gap** marks the rest as importantly worse (a big relative drop in joint relevance). This is a deterministic "find the meaningful gap" cut, **not** statistical clustering: it yields a single candidate when there is a clear winner (big gap after top-1) and degrades to the ceiling when scores are bunched (ambiguous/absent case -> no gap). Gap threshold + ceiling are calibration-owned.
  2. **Whether any are good enough = absolute top-1 relevance (FT-8).** Kept separate because gap-trim is *relative* and must never leak into the noMatch judgment (FT-8 trap).
  Emit the **full ranked list + scores** underneath (catalog is small --- room + held --- so ranking all is status-quo cost) for consumers that want more than the shortlist. N is otherwise a *consumer* concern: Consult UX wants 2-3, auto-resolve (FT-5) wants top-1 vs top-2 margin.
- **No-floor makes FT-8 load-bearing --- and constrains it.** With admission gating removed, the *only* absolute anchor for the downstream "none match" judgment is the normalized relevance itself. So **FT-8 must yield an absolute, globally-calibrated mapping** (`cosine^k` / logistic fit to the corpus), **not a within-candidate-set rescale** (min-max / percentile), which always maps top-1 -> ~1.0 even when garbage and makes "none match" unknowable. Tension to hold: RMS wants *comparable* scales (relative OK); noMatch wants *absolute* meaning (relative not OK) --- if within-set rescaling is used for RMS comparability, preserve a separate absolute top-1 signal for the noMatch call.
- **`noMatch` becomes a judgment (numeric *and* semantic), not an empty pool.** With no floor and a non-empty catalog there is essentially always a top candidate, so `noMatch` derives from the head being *unfit*, not structural emptiness (only truly empty catalog stays structural, `NoCatalog`; reconcile with FT-4 `SpanResolution.status`). Two layers: a cheap **numeric** prefilter (top-1 absolute relevance, FT-8), and --- when the head is mediocre-but-not-zero --- a **semantic** adjudication that reads span + shortlist and concludes *"the best available (bag of beans, shawl, stunned fish) are simply not a sword,"* distinguishing a genuinely absent object from a numeric quirk (a paraphrase the vectors under-scored but which *is* present). That semantic call is FT-2 (identity LLM as adjudicator-with-abstain, not optimistic pick-one) / FT-3 (abstain vs consult). **Artifact implication:** the shortlist must carry candidate **identities + labels**, not just scores, so the semantic checker (and Consult copy) can reason over what the candidates *are* --- feeds the FT-4 `SpanResolution` shape.
- **Joint relevance score = weighted RMS (soft-OR):**

```
joint = sqrt(w_l * lex^2 + w_e * embed^2) / sqrt(w_l + w_e)     [both signals present]
joint = lex                                                     [embedding absent: drop w_e from num + denom]
```

  RMS is a power mean with exponent 2 --- it leans toward the **larger** signal (soft-OR / disjunctive), so a single strong signal can dominate (`(lex=1, embed=0) -> 0.707`, vs `0.5` for a convex sum) while agreement still pulls the average up. Chosen over a Bayesian log-odds combiner because the two signals are **correlated** (Titan on short text re-encodes lexical similarity), so multiplicative agreement would double-count. RMS caps at `max(lex, embed)` --- no super-max agreement bonus, which is the conservative choice under correlation. **No `w_a` agreement term** (the math does not need it, and correlation argues against it).
- **Two hard requirements for RMS to be meaningful:**
  1. **Normalize each signal to a comparable `[0,1]` relevance scale *before* squaring** --- raw cosines sit ~0.05-0.25, and `0.2^2 = 0.04` would erase the embedding contribution. Per-signal normalization shape is its own decision (**FT-8**).
  2. **Distinguish absent from present-and-zero:** drop a missing signal from *both* numerator and the `w` sum (renormalize) rather than plugging `0`. A perfect lexical with **no vector available** -> `1.0`; a perfect lexical with an embedding that says `0` -> `0.707`. (Mirrors "neutral != against"; connects to today's `no_eligible_embeddings` / `eligibleCount`.)
- **Power-mean exponent is the disjunction/conjunction dial:** `p=1` arithmetic (neutral), `p=2` RMS (disjunctive, chosen), `p->0` geometric (conjunctive), `p->inf` max. Revisit `p` only with calibration evidence.
- **Strict conjunctive gate is reserved for auto-resolve (FT-5), not pool admission.** Requiring lexical agreement *before committing one id without Consult* is what guards the **unary catalog trap** and absent-object false positives (embedding-only would auto-resolve `sword` -> anvil at ~0.2). Pool = permissive (disjunctive RMS); commit = strict (conjunctive + margin).
- **In one line:** relevance is disjunctive (get **into** the pool); confidence is conjunctive (leave the pool as a **single committed** id).

### FT-1 exploration notes (non-normative)

Questions to answer during FT-1 slice (do not treat as decided):

- Lexical scan on **normalized shortName** only, or also description when enriched index ships? (v1: shortName only --- description tokens deferred per FT-1 decisions.)
- Weight embedding vs lexical when both rank the same wrong object (unary catalog trap)? (Addressed: RMS caps at `max` so no agreement over-credit; unary trap guarded by the FT-5 auto-resolve gate, not pool admission.)
- Reject [`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md) **lexical backstop** for v1 --- still rejected, or revived as **pool builder** not terminal gate? (Revived as **pool builder** via unconditional rank-all, no floor; not a terminal gate.)
- Tune the `w_l` / `w_e` RMS weights, the Top-N ceiling, and the gap-trim threshold --- open, calibration-owned (no admission floor, no `w_a` term).
- Re-run **`EmbeddingAsymmetricLadder`** + simulate pool metrics before locking merge policy.

### FT-2 decisions so far (2026-07-08)

Plan-only; graduate to durable docs when FT-2 ships. **Status: Decided (e) 2026-07-08.** The architectural fork is **locked**; the Bedrock-bypass concern that previously held it open is answered in principle by **staged fast-path composition** (see **Instruction compiler + validator architecture**). Enabling capabilities are tracked as **separate build threads, not decision blockers**: in-memory sandbox, per-enum interaction-under-transfer semantics, tiered fast-path coverage. Validation (prototype + calibration) pending, mirroring FT-1's "Decided (pending calibration)".

**Reframing --- trust-posture coupling, not a seam violation.** The current deterministic membership **`operationKind`** derivation ([`complexityPreGates`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/complexityPreGates.ts): sole-host room -> `takeHold`, actor -> `drop`) is **graph-truth / state-derived closure** --- the *sanctioned* deterministic pattern (BD-12), **not** a seam violation. What is actually costly is **trusted-output coupling**: identity must commit to one id *before* membership is observed, and [`verbMembershipAgreement`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/verbMembershipAgreement.ts) can only **reject** (terminal Error), never **re-rank**. So "drop bag" with a room-hosted bag + a held satchel **Errors** today instead of selecting the held candidate. The fix is a **trust-posture** change --- and it must **not** be used to license LLM invention of `operationKind` from language (the real canonical violation).

**Direction: joint `(identity, plan)` adjudication --- FT-2 option (e).** Fold the identity tier and the front half of the Phase C compiler into one **fault-tolerant hybrid adjudicator** that ranks **`(identity, plan-candidate)` tuples** over the FT-1 candidate pools, backed by an **unchanged deterministic legality/commit tail**. Membership state + language direction become **evidence for identity**, not a downstream consequence of an already-committed id (today's membership observation can only veto). This **relocates and broadens** the identity LLM rather than deleting it (so FT-2's literal question resolves to "merge scope", not "remove"); the joint hop remains the semantic **backtrack** owner the exploration notes require.

**Membership `operationKind` stays a deterministic fallout.** The joint hop adjudicates **identity** using **`verbClass`** (when present) + deterministically-packaged membership facts as **evidence**; once identity + host-instance are pinned, membership **`operationKind`** (`takeHold`/`drop`) still resolves **deterministically** from graph position. The joint hop does **not** emit membership `operationKind`. Relational **`operationKind`** (`establishRelation`/`dissolveRelation`) remains **semantic** (frame extract, BD-12); the joint hop may own it on the relational path.

**`verbClass` becomes an optional hint, owned downstream.** Today **`verbClass`** is a **required** enrich input ([`index.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/index.ts) errors if absent) whose only semantic consumer is the reject-only agreement gate. Move ownership of **operation-direction** to the **joint hop** (consume `verbClass` as evidence when present; derive from language when absent); demote **classify + deterministic lexical templates + specialized prompts** to fast-path **producers** of the same artifact --- sanctioned by "**Fast paths are not a second owner**" ([`llm/AGENT.concepts.md`](../../../../../lambda/ephemera/llm/AGENT.concepts.md)). Satisfies the vacuum test (no un-owned field).

**Load-bearing invariant = the closed primitive registry, not the enum.** Relaxing `verbClass` (and, per FT-7, the intra-manipulation sub-topology) is safe **because the commit tail still expresses only a closed set of Plan IR primitives** (`transferMembership`, `establishRelation`, `dissolveRelation`, ...). The joint hop **selects from that fixed menu** (BD-10 / Phase D "registry primitives only" constraint pulled forward and fused with identity); it never **invents** operations. The real design frontier is therefore where **open language meets the closed vocabulary**: some intents (e.g. "hold the marshmallow stick just on the edge of the campfire" --- sustained-hold + a `Custom`/manner relation) may **not fit** the registry. Out-of-registry intents must **Abstain / Consult / defer** (FT-3; analog to the BD-2 `in`/nesting defer), **not** be force-projected onto the nearest primitive.

**Tiered ladder to preserve cheap paths (open thread).** To keep the common case off the general compiler:

1. **Deterministic template** (`get`/`take`/`drop` + noun) --- emits `verbClass` + often a committed plan; **zero** post-classify Bedrock (preserve today's fast path).
2. **Specialized narrow prompt** for common-but-inexact shapes --- cheap, tightly scoped; still emits the hint fields.
3. **General joint compiler** for open language --- no required `verbClass`; reasons from language + evidence; selects from the registry; **Abstain/Consult** on out-of-registry.

`verbClass` / sub-topology are outputs of tiers 1--2 that tier 3 does **not** require. **Coverage of tiers 1--2 is a calibration target** (budget risk: today's zero/one-hop traffic must not all fall through to the expensive tier 3). **Resolved (2026-07-08):** the Bedrock-bypass mechanism is **staged fast-path composition** (**Instruction compiler + validator architecture** below) --- Bedrock cost = count of stages whose closed-world predicate fails; the golden path is zero. Tier coverage is now a **build/calibration target**, no longer a decision blocker; FT-2 is **Decided (e)**.

**Couples FT-2 to Phase C compiler shape.** Option (e) makes **`resolveComponent`** the deterministic **tail** of a joint semantic hop, **not** a standalone primitive --- confirm the sibling Phase C plan is comfortable. Ownership split: registry **expressiveness** (new primitives / manner slots for intents like "just on the edge") is **sibling-plan-owned** (Phase C/D, BD-2/BD-10); **graceful out-of-registry Abstain/Consult** is **FT-3** here.

### FT-2 exploration notes (non-normative)

Identity LLM today: [`buildPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/buildPrompt.ts) + [`interpretIdentity.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/interpretIdentity.ts) --- optimistic single pick. If removed from steady path, ensure **backtrack** path still has a semantic owner for hard paraphrase cases identity tier owns.

### Instruction compiler + validator architecture (2026-07-08)

Plan-only; extends the FT-2 direction and feeds FT-3 (Consult) + FT-5 (commit gate). **Status: this section is the basis on which FT-2 is Decided (e) (2026-07-08)** --- it answers the "recover Bedrock-bypass" concern in principle. The concrete capabilities it names (in-memory sandbox, per-enum transfer semantics, propose-N + selector) are **build threads**, not open decisions.

**Propose-N, then deterministic legality-gated selection (not iterative backtrack).** The joint hop emits **N ranked `(identity, plan)` candidates** in one generation; a deterministic **selector** evaluates all N and picks-or-Consults. This collapses propose -> validate -> backtrack round-trips into **one** generation hop + pure deterministic scoring, and makes selection a **testable pure function** of `(candidates, current-state)` (LLM nondeterminism confined to generation).

- **Legality gates, confidence ranks --- lexicographic, not a blended score.** Partition candidates by legality outcome (`clean-legal` > `defer` > `illegal`); rank **within the legal survivors** by (absolute, calibrated) confidence plus optional tie-breakers (plan parsimony, fewer BD-8 inserted steps, enum over `Custom`). Confidence never buys back illegality.
- **Selection may decline.** When the best legal candidate is below the **FT-5 commit floor** or its **margin over the runner-up** is thin, the outcome is **Consult/Abstain** (FT-3), not argmax --- otherwise this silently re-creates open-loop auto-commit. The runner-up **legal** candidates *are* the Consult menu, so the N-list is dual-purpose (select + Consult options).
- **Confidence must be absolute + de-correlated** (FT-1 / FT-8 discipline): not within-set (else top-1 -> ~1.0 even for a garbage set), and do not double-count correlated signals (LLM rank, LLM self-confidence, pool relevance).

**Dry-run legality evaluator over an in-memory sandbox.** Scoring N candidates before commit requires legality evaluable **without persisting**: a pure `(proposedPlan, currentState) -> { verdict: legal | defer | illegal, decidable: boolean, resultPreview }`. Single-step legality is already near-pure ([`evaluateRelationalLegality`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/evaluateRelationalLegality.ts), [`complexityPreGates`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/complexityPreGates.ts)); the new need is **compound (BD-9) plans**, whose legality depends on the **simulated intermediate state** (drop then relate). This requires spin-out **in-memory sandboxes** (own task --- conceptually simple, architecturally middling) that hydrate from the **ingress-packaged context** (room + held catalogs/graph already fetched), not fresh Dynamo reads, so the golden path stays IO-cheap as well as Bedrock-cheap.

**The validator itself tiers on enum vs `Custom` (= BD-10 `defer`).** Legality is a clean deterministic **gate only over the modeled subset**:

- **Enum relations (`On`/`Under`/`Against`)** have modeled mechanics by construction (BD-2) -> dissolve / interaction legality is deterministic -> **fast-approve**.
- **`Custom` / free-text relations** ("embedded miraculously into the stone") carry a `relationLabel` but **no modeled mechanics** -> legality becomes a **semantic** judgment -> **LLM validator** (exactly the BD-10 `defer` bucket / Phase D escalation).

The validator's fast-approve predicate is *"the plan's blast radius touches only modeled relations/primitives"*; any `Custom` (or unmodeled affordance) in the blast radius escalates. The `decidable` flag from the dry-run is the router.

**Staged fast-path composition --- the zero-Bedrock golden path.** Pipeline stages are **not** Bedrock hops; they are **decision points**, each with a **closed-world fast-path** and an **LLM fallback**. **Bedrock cost of a command = the number of stages whose closed-world predicate *fails*, not the number of stages.** On the Infocom golden path every predicate holds -> cost is **zero**:

| Stage | Closed-world predicate (golden path) | Fast-path outcome |
| --- | --- | --- |
| Classify | `get`/`take`/`drop` + noun template | synthesize intent + `verbClass` |
| Identity | unique exact `shortName`, structural gap | resolve to that id |
| Compile | inputs closed-world (exact id, known verb, affected relations all enum) | synthesize `dissolve(enum) + transferMembership` |
| Validate | blast radius all modeled | fast-approve |
| Commit | trusted ids + legal plan | `transactWrite` |

The fault-tolerant machinery therefore adds **recovery capacity that activates on uncertainty**, not cost on certainty: "get sword" is instant and free; "hold the marshmallow stick just on the edge of the campfire" pays only for the reasoning it actually demands. Same pipeline, graceful degradation.

**Three requirements the golden path implicitly demands:**

1. **Closed-world-only fast-pass.** A fast-path may treat a hint as truth **only** on a genuinely closed-world signal (unique exact label / structural gap), **never** a marginal soft signal (near-miss embedding gap) --- else it re-creates open-loop auto-commit on a guess. Soft gaps route through confidence-gating + possible Consult.
2. **Enum relations need deterministic *interaction-under-transfer* semantics** (Phase C), not just establish / dissolve: `On` dissolves freely on pickup; `Under` may block or require composition. This modeled core is what makes enum fast-approve legitimate --- and precisely what `Custom` lacks.
3. **Dry-run returns *decidability*, not just a verdict** (above), so the selector routes all-modeled -> fast-approve vs any-unmodeled -> LLM validator.

**Keep the proposer/validator split even when both are deterministic.** On the golden path the compiler fast-pass and validator look redundant. Keep them separate: the validator is the **single shared legality authority** the *LLM* proposer must also pass; the golden-path "redundancy" is what lets the expensive path reuse the cheap tail.

**Affordance checks recurse the same pattern.** Diegetic plausibility ("can't hold liquid soup") is out of scope now; when added it is another decision point --- **modeled property** -> deterministic reject (still zero Bedrock); **novel judgment** -> LLM. Golden path survives iff the affordance is modeled or absent.

**Honest cost:** every tiered stage carries **two implementations** (deterministic fast-path + LLM fallback) that must emit the **same artifact shape** ("Fast paths are not a second owner"); more code + test surface, and a standing discipline that the two never diverge in contract. Already the established pattern (classify [`deterministicChecks.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts)).

### Recoverability gradient + optimistic proposal (2026-07-08)

Plan-only; trust-posture principle spanning FT-2 (optimistic proposal), FT-5 (commit gate), FT-3 (Consult).

**Why this matters (design stance).** The point of closed-loop structure is to build a system that **accounts for LLMs making mistakes at any scale, at any point** --- an *eventually-possible* goal --- rather than chasing a *categorically impossible* one (an LLM that never errs). Every "may we proceed on a good-enough guess?" question is answered by **how recoverable the mistake is**, never by an assumption the guess is right. Keeping the (future) post-commit recovery tier in mind is what keeps the architecture on the possible side of that line.

**There is no hard wall at commit --- there is a recoverability gradient.** Stages form a ladder of increasing cost-of-being-wrong:

| Tier | Recover by | Detector | Latency | Cost / visibility |
| --- | --- | --- | --- | --- |
| Proposal / ordering | try next candidate | self (selector) | ~ms | free, invisible |
| Pre-commit legality | backtrack / re-enter | self (deterministic tail) | ~ms | cheap, invisible |
| **Commit (persist + publish)** | (steepest riser) | --- | --- | durable + observed |
| Post-commit (**future tier**) | player-authority retcon + compensating op | **external** (player oracle) | seconds-to-never | expensive; a visible world event |

**Principle:** *required confidence to proceed at a stage = f(recovery cost at that stage)*, where recovery cost folds in **detector reliability**, **latency**, **automaticity** (self vs external), and **social / narrative visibility** of the correction. "Hard stop at commit" is just the special case that (wrongly) treats post-commit recovery cost as infinite.

**Optimism is licensed by catchability, not confidence magnitude.** Two catchability sources, very different discounts:

- **Deterministic (self, cheap):** wrongness that manifests as **illegal** is caught by the tail and re-entered for free -> commit on **modest** confidence (e.g. "drop bag" selects the held satchel because the room bag is illegal to drop). **Large** discount.
- **Player oracle (external, delayed --- future tier):** wrongness that is **legal-but-wrong** (broom vs mop) is invisible to the tail; only the player can flag it. Detection is unreliable + delayed and correction is a costly visible retcon -> **small** discount. Keeps the FT-5 floor / margin + Consult until that tier ships (and largely after).

**The commit boundary is the steepest riser because detection flips from self to external** --- not because it is irreversible. Optimism *can* conceptually cross it, but only against a weak, delayed detector, so the bar drops only slightly there vs a lot at the pre-commit tiers.

**Future tier (out of this iteration):** player-as-final-authority rollback of published manipulation truth makes a commit **provisional-until-unchallenged**, extending *survivable wrongness* (today: presentation only) **into manipulation truth**. Enablers: **compensatable operations** + a bounded **retro window** (post-commit the world evolves *on top of* the possibly-wrong state, so rollback entanglement grows with elapsed time + dependency). Tracked as **future trust-axis** ([`llm/AGENT.concepts.md`](../../../../../lambda/ephemera/llm/AGENT.concepts.md) --- **Survivable wrongness**), not this initiative; the current-iteration scoping ("fault tolerance is pre-commit only") stands.

### FT-3 exploration notes (non-normative)

| Outcome | Player experience | Commit? |
| --- | --- | --- |
| **Abstain** | "I couldn't understand that command" (or in-franchise equivalent) | No graph change |
| **Consult** | "Did you mean the broom or the mop?" | No graph change; await follow-up (future: correlate reply) |
| **Resolved** | Normal apply path | Trusted id at commit boundary |

Complexity LLM and frame extract should **Abstain** on true unparseable input, **Consult** only when structured alternatives exist (catalog-backed), not on policy/legality failures (those stay **Error**).

## Gateway exit (required before Phase C)

All must be **Decided** and corresponding **FT-0--FT-4** checklist items **complete** (or explicitly **N/A** with written rationale in this plan):

- [ ] **FT-1** decided --- candidate pool + relevance contract documented and tested (design decided 2026-07-08; pending FT-8 + calibration).
- [ ] **FT-2** decided --- identity LLM role in steady path documented (**decided (e) 2026-07-08**: merge identity into a joint `(identity, plan)` adjudicator; durable-doc write-up + enabler build threads still pending).
- [ ] **FT-3** decided --- Abstain vs Consult wire types + owner stages documented.
- [ ] **FT-4** shipped --- **`SpanResolution`** (or chosen name) types + guards in actions layer.
- [ ] Identity tier emits **provisional pool** (not terminal embedding **`Resolved`**) on non-exact paths, or shim documented with sunset date.
- [ ] [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) updated: trust posture + recovery patterns per hop.
- [ ] Sibling plan [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) **Progress** row: "Fault-tolerant gateway" -> Done.

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines as you finish each sub-step.

### FT-0. Decision framing + types skeleton

- [ ] **FT-0.1 Readout**
  - [ ] Team review of [`llm/AGENT.concepts.md`](../../../../../lambda/ephemera/llm/AGENT.concepts.md) fault recovery section against current identity stage code.
  - [ ] Capture FT-1--FT-3 options in decision rows (update **Open decisions** table as choices narrow).

- [ ] **FT-0.2 Artifact sketch**
  - [ ] Draft **`SpanResolution`** / **`ObjectSpanCandidate`** types (names TBD at FT-4) in actions **`baseClasses`** or enrich **`objectManipulation/`** types module --- guards only, no behavior change yet.
  - [ ] Document mapping: current **`identityStage`** outcomes -> future artifact statuses.

### FT-1. Candidate pool (embedding + lexical)

- [ ] **FT-1.1 Lexical rank module**
  - [ ] Implement deterministic lexical rank helper (normalized shortName baseline; description optional behind flag).
  - [ ] Unit tests: paraphrase, duplicate shortName, absent object, unary catalog.

- [ ] **FT-1.2 Pool merge**
  - [ ] Refactor [`rankCatalogByCosineSimilarity`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/rankCatalogByCosineSimilarity.ts) / [`decideEmbeddingMatch`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/decideEmbeddingMatch.ts) toward **pool + relevance** output (narrow or replace terminal **`Resolved`**).
  - [ ] Merge lexical + embedding via **weighted RMS** joint score (per FT-1 decisions); emit full ranked list + gap-trim shortlist with relevance fields (id, label, absolute score, margin).
  - [ ] Extend [`simulateEmbeddingIdentity`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/simulateEmbeddingIdentity.ts) / calibration corpus for pool metrics (not terminal auto-resolve rate alone).

- [ ] **FT-1.3 Calibration pass** (FT-1 design is decided; this fits the constants)
  - [ ] Fit + lock the calibration constants with provenance comments: RMS weights `w_l`/`w_e`, Top-N ceiling, gap-trim threshold.
  - [ ] Resolve **FT-8** first (absolute `[0,1]` normalization + embedding index-shape fork); re-run **`EmbeddingAsymmetricLadder`** if index shape changes and record snapshot path in [`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md).
  - [ ] Confirm the FT-5 confidence stage owns the migrated [`thresholds.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts) floors (no longer pool-admission floors).

### FT-2. Identity tier + recovery loop

- [ ] **FT-2.1 Steady-path identity**
  - [ ] Wire [`identityStage.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/identityStage.ts) + [`resolveRelationalGrounding.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/resolveRelationalGrounding.ts) to emit **`SpanResolution`** artifacts.
  - [ ] Implement **FT-2** decision: identity LLM on steady path, backtrack-only, or removed.
  - [ ] Document recovery: **supplement** (catalog/embed refresh), **correct** (validator), **backtrack** (retry identity).

- [ ] **FT-2.2 Post-identity validation (if FT-2 keeps validator)**
  - [ ] Add validation hop or deterministic adjudication rules from **FT-1** confidence.
  - [ ] Tests: fast path won but wrong -> backtrack triggers.

### FT-3. Abstention vs Consulting

- [ ] **FT-3.1 Parse result contract**
  - [ ] Add **`ParseCommandConsultResult`** (or chosen shape) + guards; distinguish from **`Error`** and success variants.
  - [ ] Handler in [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts): Consult -> player-visible message, **no** positions stream.

- [ ] **FT-3.2 Downstream hop prompts**
  - [ ] Frame extract: abstain signals vs proceed; do not consult for missing catalog objects (compiler/identity owns Consult).
  - [ ] Complexity LLM: align abstain vs membership atomic vs defer; no consult unless catalog-backed alternatives exist (likely **none** on this hop --- document).

- [ ] **FT-3.3 Compiler commit rules (foundation for C1)**
  - [ ] **`resolveComponent`**: input **`SpanResolution`** -> committed id | consult | error per **FT-5** policy.
  - [ ] Tests: high-confidence auto-commit; low-confidence consult; noMatch abstain/error.

### FT-4. Integration + gateway verification

- [ ] **FT-4.1 End-to-end parse tests**
  - [ ] Membership path: paraphrase -> consult; exact -> zero Bedrock; ambiguous pool -> consult.
  - [ ] Relational path: two-span consult on one ambiguous subject.
  - [ ] Regressions: Phase B establishRelation / dissolveRelation still apply on resolved paths.

- [ ] **FT-4.2 Durable docs**
  - [ ] Update [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) trust posture + recovery table.
  - [ ] Update [`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md) v1 -> v2 steady-state.
  - [ ] Update [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) handoff / egress for Consult.

- [ ] **FT-4.3 Gateway sign-off**
  - [ ] Complete **Gateway exit** checklist above.
  - [ ] Unblock Phase C in sibling plan (update status + link).

## Verification

From **`lambda/ephemera/`**:

```bash
npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/ \
  dataSource/actions/parseCommand.test.ts \
  dataSource/actions/index.test.ts \
  calibration/objectMatch/

npm run build
```

**Manual scenarios (post-FT-3):**

- "take the sweeping tool" with broom + mop in catalog -> **Consult** (not wrong apply to mop).
- "take the broom" exact label -> resolved, zero post-classify Bedrock (unchanged fast path).
- "take the sword" absent from catalog -> **Abstain** or structured noMatch (not consult with nonsense options).
- "put the broom on the table" relational path with ambiguous subject -> **Consult** before any **`EstablishRelation`** stream.
- High-confidence pool (large margin) -> auto-resolve without consult (per FT-5).

## Progress

| Milestone | Status |
| --- | --- |
| Fault-tolerant task plan | Done |
| FT-0 framing + type skeleton | Not started |
| FT-1 candidate pool (embedding + lexical) | Design decided (pending FT-8 + calibration); build not started |
| FT-2 identity tier + recovery | **Decided (e) (2026-07-08)**: joint `(identity, plan)` adjudicator; Bedrock-bypass answered by staged fast-path composition (enablers = separate build threads); build not started |
| FT-3 Abstain vs Consult | Not started |
| FT-4 integration + gateway | Not started |
| **Gateway exit** (unblocks Phase C) | Not started |
| Phase C Plan IR (sibling plan) | Blocked on gateway |

## Coordination notes

- **Sibling plan:** [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) --- Phase C **must not** start until **Gateway exit** here is complete.
- **Commit boundary:** BD-9 atomic apply unchanged --- fault tolerance is pre-commit only **in this iteration**. Conceptually the commit boundary is the **steepest riser on a recoverability gradient** (detection flips self -> external), **not** a hard wall; a future **player-authority retcon** tier reduces but never eliminates post-commit recovery cost (see **Recoverability gradient + optimistic proposal**). Design stance: account for LLM error at any point, do not aspire to an error-free LLM. Not this initiative.
- **Seams:** BD-12 field ownership unchanged; fault tolerance does not authorize compiler **`operationKind`** invention.
- **Client:** Consulting may ship as OOC / **`PublishMessage`** first; structured reply correlation is follow-on (out of scope unless plan updated).
- **Calibration:** FT-1 should produce durable numbers in [`calibration/AGENT.md`](../../../../../lambda/ephemera/calibration/AGENT.md) / embedding snapshots before production threshold changes.
- **FT-2 <-> Phase C coupling (2026-07-08):** option (e) makes **`resolveComponent`** the deterministic **tail** of a joint semantic hop, not a standalone primitive --- flag to the sibling plan before C1. Registry **expressiveness** (new primitives / manner slots for intents like "just on the edge") stays **sibling-plan-owned** (Phase C/D); **out-of-registry Abstain/Consult** is FT-3 here. The closed primitive registry --- not `verbClass` or the intent enum --- is the invariant that keeps the relaxed classify frame inside the seam.
