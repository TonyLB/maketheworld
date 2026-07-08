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
- Replacing classify with a single end-to-end compiler LLM (classify remains topology discriminator for this initiative).

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
| **FT-2** | **Identity LLM necessity** --- If we no longer require a **trusted-output single `objectId`** per span at the identity tier, do we still need a dedicated **identity LLM** hop? Options to compare: (a) pool + deterministic adjudication only; (b) pool + lightweight validator LLM; (c) pool + identity LLM only on **backtrack** when pool ambiguous; (d) retain identity LLM but change output to **rank/reason** not pick-one. Bedrock budget vs paraphrase coverage. | FT-3, gateway | Open |
| **FT-3** | **Abstention vs Consulting downstream** --- How do **frame extract**, **complexity LLM**, and the **compiler** prompt/observe outcomes so the pipeline cleanly distinguishes **Abstain** ("I can't parse that" --- terminal or soft stop) vs **Consult** ("Player, do you mean X or Y?" --- provisional, resumable)? Wire shape: new **`ParseCommandResult`** variants vs enriched **`Error`** with structured **`consultCandidates`**? Who owns Consult copy (actions vs perception)? | FT-4, gateway, client | Open |
| FT-4 | **`SpanResolution` artifact** --- Canonical type for provisional span grounding (span text, candidates[], status: `resolved` \| `ambiguous` \| `noMatch` \| `consult`, confidence fields). Shared by membership + relational paths and Plan IR **`resolveComponent`**. | FT-1--3, C1 | Open |
| FT-5 | **Auto-resolve policy at compile time** --- When may the **compiler** commit a single id without Consult (high confidence + margin)? Align with FT-1 thresholds; document vs identity-tier auto-resolve (prefer **one** commit point). | C1, gateway | Open |
| FT-6 | **Recovery orchestration owner** --- Inline in [`identityStage.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/identityStage.ts) vs dedicated orchestrator module vs [`llm/pipeline/`](../../../../../lambda/ephemera/llm/pipeline/AGENT.md) wrapper for identity+validation loop. | FT-2, FT-3 | Open |
| FT-7 | **Classify trust posture for Phase C** --- Keep classify **trusted-output** while enrich becomes fault-tolerant, or allow provisional intent handoff? Default recommendation: **trusted-output classify** for v1; reassess when Plan IR subsumes routing. | C4 | Open |
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

### FT-2 exploration notes (non-normative)

Identity LLM today: [`buildPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/buildPrompt.ts) + [`interpretIdentity.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/interpretIdentity.ts) --- optimistic single pick. If removed from steady path, ensure **backtrack** path still has a semantic owner for hard paraphrase cases identity tier owns.

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
- [ ] **FT-2** decided --- identity LLM role in steady path documented (keep, defer to backtrack, or replace).
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
| FT-2 identity tier + recovery | Not started |
| FT-3 Abstain vs Consult | Not started |
| FT-4 integration + gateway | Not started |
| **Gateway exit** (unblocks Phase C) | Not started |
| Phase C Plan IR (sibling plan) | Blocked on gateway |

## Coordination notes

- **Sibling plan:** [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) --- Phase C **must not** start until **Gateway exit** here is complete.
- **Commit boundary:** BD-9 atomic apply unchanged --- fault tolerance is pre-commit only.
- **Seams:** BD-12 field ownership unchanged; fault tolerance does not authorize compiler **`operationKind`** invention.
- **Client:** Consulting may ship as OOC / **`PublishMessage`** first; structured reply correlation is follow-on (out of scope unless plan updated).
- **Calibration:** FT-1 should produce durable numbers in [`calibration/AGENT.md`](../../../../../lambda/ephemera/calibration/AGENT.md) / embedding snapshots before production threshold changes.
