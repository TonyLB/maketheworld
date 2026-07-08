# Object manipulation parse --- fault-tolerant trust + Plan IR foundation

**Status:** Not started. **Gateway** for Phase C of [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) --- do not begin Plan IR / compiler work until **Gateway exit** below is satisfied.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

Prerequisite (shipped): Phase B relational vertical + Phase A membership compiler --- [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md#object-manipulation-classify--enrich-steady-state-shipped---b25-split-intents). Conceptual vocabulary: [`llm/AGENT.concepts.md`](../../../../../lambda/ephemera/llm/AGENT.concepts.md) (two design axes, **fault recovery**: correct / backtrack / supplement).

## Purpose

Re-architect the **`objectManipulation`** enrich pipeline from **trusted-output** (single grounded id or terminal Error per span) toward **fault-tolerant** dynamics where provisional handoffs, recovery loops, and player **Consulting** are first-class --- without relaxing **design seams** or **field ownership**.

In parallel, lay the **compiler foundation** Phase C needs: the Plan IR **span-grounding tail** (originally framed as a `resolveComponent` primitive; retired as a standalone step per FT-5) should consume **span resolution artifacts** (candidate pools + confidence), not assume upstream already emitted one trusted `EphemeraId`.

Retire this plan when gateway criteria ship and Phase C begins (or when merged into steady-state docs); git retains history.

## Relationship to Phase C (manipulationFrame plan)

[`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) Phase C introduces **`ParsePlanStep`**, a deterministic **compiler**, and composition (BD-8, BD-9). That compiler's **span-grounding tail** (originally framed as a `resolveComponent` primitive; retired as a standalone step per FT-5) maps free-text spans to trusted ids --- today implicitly done inside **`compileMembershipAtomic`** / **`compileRelational`** with trusted-output identity.

**Why this plan gates Phase C:**

| Phase C need | Trusted-output gap today |
| --- | --- |
| **Span grounding in Plan IR** (the retired-`resolveComponent` role) | Identity emits one id or Error; no stable provisional artifact for the compiler to adjudicate or defer |
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
       -> proposer (deterministic frame template | general joint hop; frame extract + complexity LLM retired --- FT-3) (Abstain | Consult | proceed)
       -> plan compiler (deterministic; closed-world legality)
            -> selector auto-resolves ONE (identity, plan) tuple at compile time OR emits Consult / Error
            -> per-span existence/presence guard confirms referential integrity of the chosen ids
       -> executor -> trusted ids on bus (commit boundary [persist + publish] unchanged)
```

**Commit boundary unchanged:** positions ingress and atomic apply (BD-9) still require **trusted-output** ids. Fault tolerance lives **before** terminal parse / stream publish.

**Seam unchanged:** classify owns intent topology; the **proposer** (deterministic frame template or general joint hop --- successor to frame extract, **FT-3**) owns relational **`operationKind`**; identity tier owns referential grounding **job** --- only the **trust posture** and **handoff shape** change.

## Scope

### In scope

- Provisional **span resolution** types and guards (candidate pool, confidence, resolution status).
- Identity tier refactor: embedding as **recommender** (not terminal **`Resolved`**), optional lexical rank merge, documented recovery patterns.
- Product-facing **Abstention** vs **Consulting** parse outcomes (wire + handler contract --- at minimum design + types; client UX may follow).
- Legacy-hop redistribution (**FT-3**): retire **complexity LLM** and **frame extract** as distinct LLM steps; relocate their work to the deterministic fast-path (sandbox legality; net-new relational frame templating) + the general joint proposer; Abstain / Consult owned by the proposer, defer by the shared validator.
- Plan IR **foundation** types: the joint-hop **selector** tail consumes a **`SpanCandidatePool`** and emits a **`SpanResolutionOutcome`** verdict = resolved id | consult | error (feeds C1 in sibling plan). **`resolveComponent` is retired as a standalone grounding primitive** (FT-2 (e) folds grounding into the joint proposal); the surviving deterministic per-span work is the selector's **existence/presence guard**, not a runtime Plan IR step.
- Calibration + tests for candidate-pool behavior; update [`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md) steady-state when shipped.
- Durable doc updates: [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md), [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) (trust posture + handoff tables).

### Out of scope (unless plan updated)

- Full Phase C executor, compound kernel apply, BD-8 composition (sibling plan --- after gateway).
- Phase D plan LLM (sibling plan).
- Client UI for Consulting (may stub **`PublishMessage`** / OOC only in v1).
- Player feedback / retroactive revision loops ([`llm/AGENT.concepts.md`](../../../../../lambda/ephemera/llm/AGENT.concepts.md) --- future trust-axis).
- Replacing classify with a single end-to-end compiler LLM **for the whole game** --- classify remains the **family** discriminator (manipulation vs navigation vs speech vs Acme). **Decided (FT-7 / FT-2, 2026-07-08):** the *intra-manipulation* sub-topology (membership vs relational) and **`verbClass`** **become provisional hints** consumed by the joint hop rather than committed classify routing (reunified manipulation-family type; **supersedes the BD-11 top-level split**); that narrowing **is** in scope, a universal compiler is not. See **FT-7 decisions so far**.

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
| **FT-3** | **Abstention vs Consulting downstream** --- **Direction set (2026-07-08, see FT-3 decisions so far):** **complexity LLM** and **frame extract** do **not** survive as distinct LLM steps (complexity LLM -> deterministic sandbox legality + shared validator; frame extract -> **net-new** deterministic frame templating + general joint proposer); no narrow-scope "tier-2" LLM (the untemplated-simple-language case is a **classify** concern). **Abstain / Consult** owned by the **proposer / joint hop**, **defer -> Error** by the **shared validator**, **commit vs Consult** by the **FT-5 gate** --- never the deterministic compiler (BD-12). **Wire shape decided (2026-07-08, see Consult wire shape):** Consult is a **new `ParseCommandResult` variant** (not enriched `Error`); **actions** emits structured **alternate proposed commands** (X / Y), **perception** assembles copy; **not resumable this iteration** (terminates with no graph change + a terminal prompt inviting a re-entered scanning command). Variant **types land with FT-4.** | FT-4, gateway, client | Decided (2026-07-08); types pending FT-4 |
| **FT-4** | **`SpanResolution` artifact** --- Canonical type(s) for provisional span grounding, shared by membership + relational paths and the Plan IR **selector** tail (formerly framed as `resolveComponent`). **Decided (2026-07-08, see FT-4 decisions so far):** **split input pool (evidence) from output verdict.** Input carries `candidates[]` only --- each candidate `{ id, label, relevance fields (absolute score, margin, source tags), locus }` --- with a structured **`locus`** discriminated union (`room` \| `heldByActor` \| `heldByOtherCharacter` \| `withinObject`); locus is **deterministic graph/catalog evidence** (context packaging, **not** semantic; never licenses `operationKind` invention; **v1 scope = cheap room/held loci**). **No `status` field on the input:** structural emptiness is `candidates.length === 0` (single source of truth; catalog fetch/IO failure stays a separate upstream error path, not a resolution state). The **verdict** (`resolved` \| `consult` \| `error`) lives on the **selector output** (`SpanResolutionOutcome`) at the single **FT-5** auto-resolve (selection) point --- `ambiguous` is a *reason* (pool property), `consult` a *response* (FT-5), never peers in one enum. **Locked as two types (2026-07-08):** `SpanCandidatePool` (input evidence) + `SpanResolutionOutcome` (verdict output). | FT-1--3, C1 | **Decided (2026-07-08)**; types land in FT-4 build |
| **FT-5** | **Auto-resolve / selection-gate policy** --- When may the deterministic **selector** **auto-resolve** a single `(identity, plan)` tuple without Consult (absolute confidence **floor** + **margin** over runner-up)? **Decided (2026-07-08, see FT-5 decisions so far):** the deterministic tail is **two phases** --- **(1) selection** (cross-tuple): legality gate + confidence floor + margin over runner-up across the N `(identity, plan)` candidates -> **auto-resolve one** or **Consult** (FT-5 owns the floor/margin; runner-up **legal** tuples are the Consult menu); **(2) post-selection existence/presence guard** (per span, on the chosen tuple): a deterministic **referential-integrity** filter that each chosen id **exists** + is **present** at its claimed `locus`, guaranteeing a well-formed `positionGraph` write --- **not** a re-litigation of semantics or confidence (denotation was decided upstream by FT-1 pool relevance + phase-1 confidence). **Terminology: "commit" / "commit boundary" is reserved for persist + publish**; the FT-5 act is **auto-resolve / select**. The floor is set by the **recoverability gradient** (see **Recoverability gradient + optimistic proposal**): auto-resolve on modest confidence when wrongness is **illegal-if-wrong** (caught for free by the guard + dry-run validator), hold floor + Consult when **legal-but-wrong**. Align with FT-1 relevance / FT-8 absolute scale; **one selection point** (no separate identity-tier auto-resolve). | C1, gateway | **Decided (2026-07-08)** (floor/margin constants calibration-owned) |
| **FT-6** | **Recovery orchestration owner** --- Inline in [`identityStage.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/identityStage.ts) vs dedicated orchestrator module vs [`llm/pipeline/`](../../../../../lambda/ephemera/llm/pipeline/AGENT.md) wrapper for identity+validation loop. **Decided (2026-07-08, see FT-6 decisions so far):** a **dedicated orchestrator module in the objectManipulation enrich layer**, **single-pass** (propose-N + pure deterministic selector + existence/presence guard -> `resolved` / `consult` / `error`). Reject **inline `identityStage.ts`** (identity folds into the joint hop per FT-2 (e); that owner is dissolving) and the **`llm/pipeline/` runner** (linear/single-pass by charter; no loop to run this iteration; enrich is still ad hoc). Orchestration (glue) stays separate from the **pure** selector (FT-5 one selection point). **Forward flag (non-blocking):** the first case that will *force* re-entrant closed-loop orchestration is the **container-contents supplement** (`take X out of Y`: ground `from` -> supplement the target pool with that host's contents -> re-run) --- the deferred FT-4 `withinObject` locus; parked for a future `llm/pipeline/` orchestrator plan, **not** a Gateway-exit blocker. | FT-2, FT-3 | **Decided (2026-07-08)** |
| **FT-7** | **Classify trust posture for Phase C** --- Keep classify **trusted-output** while enrich becomes fault-tolerant, or allow provisional intent handoff? **Decided (2026-07-08, see FT-7 decisions so far):** **two-level classify** --- **trusted-output at the family level** (manipulation vs navigation vs speech vs Acme; keeps the joint prompt scoped) but **provisional hints** for the **intra-manipulation** sub-fields (**`verbClass`**, membership-vs-relational sub-split) consumed as **evidence** by the joint hop, not committed routing. **Reunify to a single manipulation-family intent type** carrying an optional hint bundle `{ subTopology?, verbClass?, confidence }` --- **supersedes the BD-11 top-level membership-vs-relational type split** (its routing role no longer fits fault tolerance). **No `enrichRoute` fork** (one shared entry -> FT-6 orchestrator). **Hint trust rides the `confidence` scalar: `1.0` is a reserved closed-world sentinel** (deterministic producers only; LLM clamped `< 1.0`; seam fast-path fires on `=== 1.0`). Not a single end-to-end compiler for the whole game. | C4, FT-2 | **Decided (2026-07-08)** |
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
- **Strict conjunctive gate is reserved for auto-resolve (FT-5), not pool admission.** Requiring lexical agreement *before auto-resolving one id without Consult* is what guards the **unary catalog trap** and absent-object false positives (embedding-only would auto-resolve `sword` -> anvil at ~0.2). Pool = permissive (disjunctive RMS); auto-resolve = strict (conjunctive + margin).
- **In one line:** relevance is disjunctive (get **into** the pool); confidence is conjunctive (leave the pool as a **single auto-resolved** id).

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

**Membership `operationKind` stays a deterministic fallout.** The joint hop adjudicates **identity** using **`verbClass`** (when present) + deterministically-packaged membership facts as **evidence**; once identity + host-instance are pinned, membership **`operationKind`** (`takeHold`/`drop`) still resolves **deterministically** from graph position. The joint hop does **not** emit membership `operationKind`. Relational **`operationKind`** (`establishRelation`/`dissolveRelation`) remains **semantic** (BD-12); with frame extract retired as a distinct hop (**FT-3**), the **proposer / joint hop** owns it on the relational path (deterministic template on closed-grammar frames; general joint hop otherwise).

**`verbClass` becomes an optional hint, owned downstream.** Today **`verbClass`** is a **required** enrich input ([`index.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/index.ts) errors if absent) whose only semantic consumer is the reject-only agreement gate. Move ownership of **operation-direction** to the **joint hop** (consume `verbClass` as evidence when present; derive from language when absent); demote **classify + deterministic lexical templates + specialized prompts** to fast-path **producers** of the same artifact --- sanctioned by "**Fast paths are not a second owner**" ([`llm/AGENT.concepts.md`](../../../../../lambda/ephemera/llm/AGENT.concepts.md)). Satisfies the vacuum test (no un-owned field).

**Load-bearing invariant = the closed primitive registry, not the enum.** Relaxing `verbClass` (and, per FT-7, the intra-manipulation sub-topology) is safe **because the commit tail still expresses only a closed set of Plan IR primitives** (`transferMembership`, `establishRelation`, `dissolveRelation`, ...). The joint hop **selects from that fixed menu** (BD-10 / Phase D "registry primitives only" constraint pulled forward and fused with identity); it never **invents** operations. The real design frontier is therefore where **open language meets the closed vocabulary**: some intents (e.g. "hold the marshmallow stick just on the edge of the campfire" --- sustained-hold + a `Custom`/manner relation) may **not fit** the registry. Out-of-registry intents must **Abstain / Consult / defer** (FT-3; analog to the BD-2 `in`/nesting defer), **not** be force-projected onto the nearest primitive.

**Cheap paths: per-stage fast-path / fallback, not a tiered ladder (updated 2026-07-08 --- see FT-3 decisions so far).** Originally framed as a 3-tier ladder; the **narrow-scope middle LLM ("tier-2") dissolves.** It earned its keep only for structurally-simple-but-untemplated language ("seize the sword!"), which is a **classify** concern already owned by two-level classify, and a speculative narrow hop that *feeds* the general proposer (rather than *terminating*) is double-pay. Two real rungs remain **per decision point**:

1. **Deterministic fast-path** (closed-world): classify `get` / `take` / `drop` + noun today; **net-new** relational frame templating (`put` / `lean` / `take off` + known prepositions) as the relational analog. Generates a proposal *because* the shape is closed-world; emits `verbClass` + often a committed plan; **zero** post-classify Bedrock.
2. **General joint proposer** for open language --- no required `verbClass`; reasons from language + evidence; selects from the registry; **Abstain / Consult** on out-of-registry.

Lexical openness is mitigated by templating the **lexicon + grammar** (bounded, slow-growing), **not** full commands (infinite); the **negative-closure** rule keeps an LLM fallback as a **permanent floor** (an untemplated verb licenses no deterministic conclusion). `verbClass` / sub-topology are outputs of the deterministic fast-path that the general proposer does **not** require. **Fast-path coverage is a calibration target** (budget risk: today's zero/one-hop traffic must not all fall through to the general hop). **Resolved (2026-07-08):** the Bedrock-bypass mechanism is **staged fast-path composition** (**Instruction compiler + validator architecture** below) --- Bedrock cost = count of stages whose closed-world predicate fails; the golden path is zero. Coverage is a **build / calibration target**, no longer a decision blocker; FT-2 is **Decided (e)**.

**Couples FT-2 to Phase C compiler shape.** Option (e) makes **`resolveComponent`** the deterministic **tail** of a joint semantic hop, **not** a standalone primitive --- confirm the sibling Phase C plan is comfortable. Ownership split: registry **expressiveness** (new primitives / manner slots for intents like "just on the edge") is **sibling-plan-owned** (Phase C/D, BD-2/BD-10); **graceful out-of-registry Abstain/Consult** is **FT-3** here.

### FT-2 exploration notes (non-normative)

Identity LLM today: [`buildPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/buildPrompt.ts) + [`interpretIdentity.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/interpretIdentity.ts) --- optimistic single pick. If removed from steady path, ensure **backtrack** path still has a semantic owner for hard paraphrase cases identity tier owns.

### Instruction compiler + validator architecture (2026-07-08)

Plan-only; extends the FT-2 direction and feeds FT-3 (Consult) + FT-5 (auto-resolve / selection gate). **Status: this section is the basis on which FT-2 is Decided (e) (2026-07-08)** --- it answers the "recover Bedrock-bypass" concern in principle. The concrete capabilities it names (in-memory sandbox, per-enum transfer semantics, propose-N + selector) are **build threads**, not open decisions.

**Propose-N, then deterministic legality-gated selection (not iterative backtrack).** The joint hop emits **N ranked `(identity, plan)` candidates** in one generation; a deterministic **selector** evaluates all N and picks-or-Consults. This collapses propose -> validate -> backtrack round-trips into **one** generation hop + pure deterministic scoring, and makes selection a **testable pure function** of `(candidates, current-state)` (LLM nondeterminism confined to generation).

- **Legality gates, confidence ranks --- lexicographic, not a blended score.** Partition candidates by legality outcome (`clean-legal` > `defer` > `illegal`); rank **within the legal survivors** by (absolute, calibrated) confidence plus optional tie-breakers (plan parsimony, fewer BD-8 inserted steps, enum over `Custom`). Confidence never buys back illegality.
- **Selection may decline.** When the best legal candidate is below the **FT-5 auto-resolve floor** or its **margin over the runner-up** is thin, the outcome is **Consult/Abstain** (FT-3), not argmax --- otherwise this silently re-creates open-loop auto-resolve. The runner-up **legal** candidates *are* the Consult menu, so the N-list is dual-purpose (select + Consult options).
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

1. **Closed-world-only fast-pass.** A fast-path may treat a hint as truth **only** on a genuinely closed-world signal (unique exact label / structural gap), **never** a marginal soft signal (near-miss embedding gap) --- else it re-creates open-loop auto-resolve on a guess. Soft gaps route through confidence-gating + possible Consult.
2. **Enum relations need deterministic *interaction-under-transfer* semantics** (Phase C), not just establish / dissolve: `On` dissolves freely on pickup; `Under` may block or require composition. This modeled core is what makes enum fast-approve legitimate --- and precisely what `Custom` lacks.
3. **Dry-run returns *decidability*, not just a verdict** (above), so the selector routes all-modeled -> fast-approve vs any-unmodeled -> LLM validator.

**Keep the proposer/validator split even when both are deterministic.** On the golden path the compiler fast-pass and validator look redundant. Keep them separate: the validator is the **single shared legality authority** the *LLM* proposer must also pass; the golden-path "redundancy" is what lets the expensive path reuse the cheap tail.

**Affordance checks recurse the same pattern.** Diegetic plausibility ("can't hold liquid soup") is out of scope now; when added it is another decision point --- **modeled property** -> deterministic reject (still zero Bedrock); **novel judgment** -> LLM. Golden path survives iff the affordance is modeled or absent.

**Honest cost:** every tiered stage carries **two implementations** (deterministic fast-path + LLM fallback) that must emit the **same artifact shape** ("Fast paths are not a second owner"); more code + test surface, and a standing discipline that the two never diverge in contract. Already the established pattern (classify [`deterministicChecks.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts)).

### Recoverability gradient + optimistic proposal (2026-07-08)

Plan-only; trust-posture principle spanning FT-2 (optimistic proposal), FT-5 (auto-resolve / selection gate), FT-3 (Consult).

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

### FT-3 decisions so far (2026-07-08)

Plan-only; graduate to durable docs when FT-3 ships. Resolves the "legacy hops" question: **the membership complexity LLM and the relational frame extract do not survive as distinct LLM steps.** Their semantic work redistributes across a **deterministic fast-path** and the **general joint proposer**, and Abstain / Consult / defer ownership moves with them. No new field owner is invented (seam preserved).

**Complexity LLM --- retired as a hop.** Its single judgment (given exit-edge / host topology, is a plain `transferMembership` still legal, or is the command too complex?) factors cleanly along the new seam:

- **Deterministic half** -> the **dry-run legality evaluator over the in-memory sandbox** (modeled / enum relations); `deferToComplexityLlm` becomes `decidable: true -> fast-approve`, zero Bedrock on the golden path.
- **Semantic residue** (a `Custom` / unmodeled interaction blocks the move) -> the **shared LLM validator** = the BD-10 `defer` bucket, *not* a membership-specific prompt. Its current terminal-only `relationalPlacement` output already is defer behavior.
- The documented known gap (complexity path skips the `verbClass` agreement gate --- [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md)) **dissolves**: `verbClass` is evidence, membership `operationKind` is deterministic fallout once identity + host are pinned.

**Frame extract --- retired as an always-on LLM hop; work splits down and up.** It does two irreducible semantic jobs (role decomposition + relational `operationKind`, BD-12). Those keep a semantic owner, but not a standalone trusted-output decomposer:

- **Down (net-new, deterministic fast-path):** closed-grammar relational frames (`put` / `place` / `lean` / `take off` + known prepositions) are **closed-world** --- the relation phrase is an enum lookup, `operationKind` is positive-closure on the verb template, and roles fall out of the `V NP prep NP` grammar. This deterministic relational proposer **does not exist today** (classify only templates membership `take` / `drop` / `get`; [`runFrameExtractStage`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/frameExtract/runFrameExtractStage.ts) always calls Bedrock) --- it is **work to build**, the relational analog of the membership fast path.
- **Up (general joint hop):** open relational language falls to the **general joint `(identity, plan)` proposer** (FT-2 (e)), which owns role decomposition + operator selection + identity jointly, selecting from the registry.
- Downstream deterministic stages --- **relation normalizer** ([`normalizeRelationSpan.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/normalizeRelationSpan.ts)), grounding / FT-1 pools, **relational legality** ([`evaluateRelationalLegality.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/evaluateRelationalLegality.ts)) --- are unchanged and run regardless of proposer source.

**No narrow-scope LLM middle tier ("tier-2" dissolves).** A dedicated cheap relational LLM sitting between the deterministic template and the general proposer is rejected. Its only real value case is **structurally simple commands in untemplated language** ("seize the sword!"), but:

- On the **membership** path that is a **classify** miss, already owned by the existing **two-level classify** (deterministic template *or* classify LLM, then deterministic tail); it does not justify a new relational hop.
- The **negative-closure** seam rule ([`llm/AGENT.concepts.md`](../../../../../lambda/ephemera/llm/AGENT.concepts.md) --- fast-path positive vs negative closure) makes an LLM fallback a **permanent floor**: an untemplated verb licenses *no* deterministic conclusion, so it must fall through --- the only choice is *which* LLM it lands on, and a speculative narrow hop that **feeds** the general one (rather than **terminating**) is double-pay.
- The tractable mitigation is templating the **lexicon + grammar** (a bounded, slow-growing set), **not** full commands (infinite); this shrinks the residual to the creative tail, which is exactly where the general proposer belongs.

**Mental model: per-stage fast-path / fallback, not a tiered ladder.** Drop the linear tier-1/2/3 framing (it is what manufactured the phantom tier-2). Each **decision point** (classify, frame / identity, compile, validate) has a deterministic fast-path and, on failure, an LLM fallback; **Bedrock cost = number of stages whose closed-world predicate fails** (the **Staged fast-path composition** model). "Tier-2 dissolved" just means the frame / proposal decision has a deterministic fast-path and a general-LLM fallback with no distinct middle option.

**FT-3 owner map (Abstain / Consult / defer).** No longer owned by complexity LLM or frame extract:

| Concern | Owner |
| --- | --- |
| **Abstain** (unparseable) / **Consult** (ambiguous, catalog-backed) | Proposer / joint hop (out-of-registry -> Abstain / Consult; ambiguous FT-1 pool -> Consult) |
| **Defer -> Error** (unmodeled `Custom` interaction) | Shared dry-run validator (BD-10 `defer`) |
| **Commit vs Consult** (legal-but-uncertain) | FT-5 selector gate (recoverability gradient) |
| Role decomposition + relational `operationKind` (seam owner, BD-12) | Proposer (deterministic template / general joint hop) --- **never** the deterministic compiler |

**Consult wire shape (decided 2026-07-08).**

- **New `ParseCommandResult` variant.** Consult is a **first-class terminal parse outcome** (e.g. `ParseCommandConsultResult`), **not** an enriched **`Error`** carrying `consultCandidates`. Guards distinguish it from **`Error`** and from success variants.
- **Actions emits alternatives; perception assembles copy.** **Actions** produces the structured **alternate proposed commands** --- the catalog-backed candidate re-phrasings that *would* scan (the "X" and "Y"), as data, **not** prose. **Perception** turns them into the player-facing copy ("I don't understand. Did you mean X or Y?"). This mirrors the existing intent/fact -> **`WorldMessage`** fan-in split (actions owns structured facts, perception owns wording).
- **Not resumable this iteration.** Consult does **not** await or correlate a follow-up reply. It **terminates** the parse with **no graph change** and surfaces a **terminal prompt** encouraging the player to re-enter a command that will scan (typically one of the proposed alternatives, or a clearer phrasing). Reply correlation / resumable Consult is **deferred** (future trust-axis --- same family as the post-commit player-authority tier in **Recoverability gradient + optimistic proposal**; out of scope per coordination notes).

Feeds FT-4 `SpanResolution.status` (`consult`); the variant types land with **FT-4**.

### FT-3 exploration notes (non-normative)

| Outcome | Player experience | Commit? |
| --- | --- | --- |
| **Abstain** | "I couldn't understand that command" (or in-franchise equivalent) | No graph change |
| **Consult** | "Did you mean the broom or the mop?" | No graph change; **terminal this iteration** --- no reply correlation; player re-enters a scanning command (resumable Consult deferred) |
| **Resolved** | Normal apply path | Trusted id at commit boundary |

The **proposer / joint hop** (successor to frame extract + complexity LLM per **FT-3 decisions so far** --- both retired as distinct steps) should **Abstain** on true unparseable input and **Consult** only when structured, catalog-backed alternatives exist; policy / legality failures stay **Error** (deterministic tail / shared validator).

### FT-4 decisions so far (2026-07-08)

Plan-only; graduate to durable docs (**`objectManipulation/AGENT.md`**, actions `baseClasses` types) when FT-4 ships. Resolves the artifact shape: **the pool artifact carries evidence; the verdict lives at the selection point.**

**Split input pool from output verdict.** The plan frames span grounding as **input = span resolution artifact, output = resolved id | consult | error** (the tail formerly named `resolveComponent`, retired as a standalone primitive per FT-5). Honor that split in the types: the artifact the FT-1 pool builder / identity tier emits is the **input** (evidence); `resolved` / `consult` / `error` is the **output** verdict of a *different* stage. Do **not** fold a verdict enum onto the input.

- **Input artifact = candidates only.** `candidates[]` where each candidate is `{ id, label, relevance fields (absolute score, margin, source tags), locus }`. Labels + ids (not just scores) are required so the FT-2 semantic checker and FT-3 Consult copy can reason over *what* the candidates are (FT-1 decisions).
- **No `status` field on the input.** A single `status: resolved | ambiguous | noMatch | consult` conflated two lifecycles owned by two stages:
  - `resolved` / `consult` are **verdicts** owned by the **FT-5 selector gate** (auto-resolve vs Consult, recoverability gradient). Putting them on the pool artifact duplicates or pre-empts the single selection point the plan requires ("prefer one selection point").
  - `ambiguous` is a **reason** (a property of the pool --- thin margin among survivors); `consult` is a **response** (an action FT-5 chooses). They are not peers in one enum.
  - `noMatch` is a downstream **judgment** over visible evidence (FT-1: "noMatch becomes a judgment, not an empty pool"), not a frozen field --- storing it on the pool re-creates the denormalization / staleness hazard (a summary that can silently disagree with the candidates it summarizes).
- **Structural emptiness = `candidates.length === 0` (single source of truth).** Because FT-1 mandates rank-all / no admission floor / best-of-worst, a non-empty catalog always yields a non-empty pool, so the empty array **is** the "nothing to rank" signal. A separate `NoCatalog` flag is redundant denormalization (dropped). "Head is unfit" is a **non-empty** array with weak scores; "nothing to rank" is the **empty** array --- length already separates them.
- **Catalog fetch/IO failure is a separate error path, not a resolution state.** Empty `candidates[]` means "nothing eligible in the ingress-packaged context" (a legitimately empty room/held set). A catalog **read failure** surfaces on its own upstream error path (as span-embed invoke failure already falls through today), never as a status value.

**`locus` --- per-candidate "where is it now?" (deterministic evidence).** Each candidate carries a structured **`locus`** discriminated union (`room` \| `heldByActor` \| `heldByOtherCharacter { characterId, characterLabel }` \| `withinObject { hostId, hostLabel }`). This is the data-structure embodiment of the FT-2 (e) reframing --- **membership state becomes evidence for identity**, not a post-identity veto (the "drop bag": room bag vs held satchel case). It also feeds the FT-5 recoverability gradient (illegal-if-wrong discount needs to know where each candidate lives) and FT-3 Consult copy ("the bag on the floor or the satchel you're carrying?").

- **Structured union, not a display string** --- both the deterministic legality tail (reasons over `kind`) and perception (renders copy) consume it; prose would lose the machine-readable meaning.
- **Seam:** locus is deterministic graph/catalog truth (context packaging), stays in the deterministic lane, and is **evidence only** --- it must never license `operationKind` invention (BD-12 stands).
- **Sourcing + v1 scope:** `room` vs `heldByActor` is essentially free today (which merged catalog the entry came from --- room object vs held inventory, both fetched at ingress). `withinObject` / `heldByOtherCharacter` need the membership-container / `positionGraph` read (the observation FT-2 moves earlier). **v1 scope = the cheap room/held loci** (covers "drop bag"); richer loci gate on what ingress + BD-5 already surface, keeping to "hydrate from ingress-packaged context, not fresh Dynamo reads." The `withinObject` locus is the first case that requires **re-entrant closed-loop orchestration** (ground `from` -> supplement the target pool with the host's contents -> re-run); see **FT-6 decisions so far** (Forward flag).

**Two named types (locked 2026-07-08).** `SpanCandidatePool` (input evidence: `candidates[]` + per-candidate `locus`) and `SpanResolutionOutcome` (the selector-tail output verdict: resolved id | consult | error). A single combined `SpanResolution` with split fields is **rejected** --- separate types keep the two owners / two lifecycles (pool builder vs FT-5 selection point) from re-fusing. Exact identifiers are the final word unless FT-4 build surfaces a collision.

### FT-5 decisions so far (2026-07-08)

Plan-only; graduate to durable docs (**`objectManipulation/AGENT.md`** trust posture, **`AGENT.contract.md`** auto-resolve rules) when FT-5 ships. Resolves the auto-resolve / selection-gate policy and disambiguates "commit".

**Terminology --- "commit" is reserved for persist + publish.** The word had two senses that this section separates:

- **Commit / commit boundary** = the persist + publish boundary (`transactWrite` + trusted ids on the bus, BD-9 atomic apply). Unchanged this iteration; the steepest riser on the recoverability gradient. This is the **only** sanctioned use of "commit" going forward.
- **Auto-resolve / select** = the FT-5 act: the deterministic **selector** locking in a single `(identity, plan)` tuple (the `resolved` verdict on `SpanResolutionOutcome`) rather than declining to Consult. Compile-time, in-memory, cheap-to-recover (self / deterministic). **Not** a persist commit.

Rename FT-5-selection uses of "commit" -> **auto-resolve** across plan artifacts; leave "commit boundary" / "pre-commit" / "post-commit" (persist sense) intact.

**The deterministic tail is two phases (one selection point).**

1. **Selection (cross-tuple, the FT-5 gate).** Over the N ranked `(identity, plan)` candidates the joint hop emits (see **Instruction compiler + validator architecture**): partition by legality (`clean-legal` > `defer` > `illegal`), rank legal survivors by absolute calibrated confidence, then apply the **floor** (best legal candidate good enough?) + **margin over runner-up** (clearly better than the alternative?). Pass -> **auto-resolve** that tuple; fail -> **Consult** (runner-up legal tuples are the menu) or **Abstain**. This is the comparative judgment; it needs the pool + the other candidates, so it is inherently a selection-time concern. A single thin-margin span sinks the whole command to Consult (FT-4.1 "two-span consult on one ambiguous subject").
2. **Post-selection existence/presence guard (per span, on the chosen tuple).** A deterministic **referential-integrity** filter: each chosen id **exists** as a real `EphemeraId` **present** in the ingress-packaged closed-world context at its claimed `locus`. Guards against a hallucinated / absent id riding through to persist. It does **not** re-litigate semantics (denotation was decided by FT-1 pool relevance + phase-1 confidence) or confidence (already spent in phase 1). Its guarantee is *referential validity* --- a well-formed `positionGraph` write over things that exist --- **orthogonal to whether it is the semantically right object**. (Operation **legality** given that state --- e.g. can't `drop` a room object you aren't holding --- is the separate **shared dry-run validator**; existence/presence + legality together = "a valid, appliable write, possibly of the wrong object".)

**Floor magnitude follows the recoverability gradient (see Recoverability gradient + optimistic proposal).**

- **Illegal-if-wrong** (structural / referential wrongness): caught for free by the existence/presence guard + dry-run validator before persist -> **large** discount, auto-resolve on **modest** confidence (the "drop bag" case: the room bag is illegal to drop, so the held satchel wins deterministically).
- **Legal-but-wrong** (right structure, wrong object --- broom vs mop): invisible to the guard and validator by design; only the player can catch it (future post-commit tier) -> **small** discount, hold the floor + Consult.

**`resolveComponent` retired as a standalone grounding primitive** (coordinated with FT-4 + sibling C1). FT-2 (e) folds span grounding into the joint proposal, so there is no downstream "now resolve each span" primitive for the compiler to call. The surviving deterministic per-span work is (a) the phase-1 selector verdict (`SpanCandidatePool` -> `SpanResolutionOutcome`) and (b) the phase-2 existence/presence guard --- **facets of the selector tail, not a runtime Plan IR step**. It therefore leaves the Plan IR primitive registry (which holds runtime kernel ops: `transferMembership`, `establishRelation`, `dissolveRelation`).

**One selection point.** Do not also let the identity tier auto-resolve independently; the single FT-5 selection point is the sole place a span-id is locked in (avoids two owners re-fusing, mirrors FT-4's single-verdict rule).

**Calibration-owned (not decisions):** the absolute floor value, the margin threshold, and any tie-breakers (plan parsimony, fewer BD-8 inserted steps, enum over `Custom`) --- fit against calibration snapshots alongside FT-1 (`w_l`/`w_e`, Top-N, gap-trim) and FT-8 (absolute `[0,1]` scale). The floor **must** consume an absolute, globally-calibrated confidence (FT-1 / FT-8 discipline), never a within-set rescale.

### FT-6 decisions so far (2026-07-08)

Plan-only; graduate to durable docs (**`objectManipulation/AGENT.md`** trust posture / recovery table) when FT-6 ships. Resolves the recovery-orchestration **owner** for the gateway and flags the first case that will require true closed-loop orchestration. **Everything under "Forward flag" is deliberately vague direction, not a commitment** --- its purpose is to let us reason about *today's* single-pass module knowing what *tomorrow* likely needs.

**Gateway placement --- dedicated feature-layer orchestrator module, single-pass.** The recovery machinery this iteration is **not a loop**: FT-2's **propose-N + deterministic selection** collapses propose -> validate -> backtrack into one generation hop + a pure scoring tail, and FT-3's Consult is **terminal** (no reply correlation). So the owner is a **dedicated module in the objectManipulation enrich layer** sequencing staged fast-path composition -> joint `(identity, plan)` proposer (or deterministic fast-path) -> phase-1 selection (legality partition + floor + margin) -> phase-2 existence/presence guard -> emit `resolved` / `consult` / `error`.

- **Reject inline `identityStage.ts`.** Identity folds into the joint hop (FT-2 (e)); `identityStage` as a standalone owner is on its way out, so anchoring orchestration there buries the seam in a dissolving stage (today's per-span linear loop in `runIdentityStage` is exactly the structure being replaced).
- **Reject the `llm/pipeline/` runner (this iteration).** The runner is linear/single-pass by charter (looping / branching are documented non-goals); with propose-N + a pure tail + terminal Consult there is no multi-hop loop for it to run, and `parseCommand` enrich is still ad hoc. Migrating enrich onto the runner is an orthogonal later refactor, not the FT-6 answer.
- **Orchestration stays separate from the pure selector.** The module is glue (sequencing, fast-path staging, `Bedrock cost = count of stages whose closed-world predicate fails`); the **selector** stays a pure function of `(candidates, current-state)` --- preserving FT-5's single selection point (no independent identity-tier auto-resolve).

**Forward flag (non-blocking) --- container-contents supplement is the first closed-loop consumer.** propose-N collapses the loop **only when the candidate pool is packageable up front.** It does **not** collapse **dependent / sequential grounding**: `take the gem out of the box` cannot build the target pool for `gem` until `box` is grounded and its contents are fetched, and front-loading every object's contents violates context-packaging minimalism. The principled recovery is an **internal supplement (+ backtrack)** --- ground `from` -> re-package the target pool with that host's contents -> re-run --- which is the deferred **FT-4 `withinObject` locus** and pairs cross-plan with the deferred `in` / nesting vertical (sibling BD-2, BD-5).

- **Cheapest tier, not resumable Consult.** This loop is self-detected, ~ms, in-request, invisible --- the **top** of the **Recoverability gradient**, strictly cheaper and nearer-term than the external-player resumable-Consult / post-commit tiers.
- **Introduces the two open orchestration questions incrementally.** The forward-ingress + backtrack-correction **input shape** (`from` locked + target pool supplemented) appears at any depth; the **stall / time-budget** guard is only needed once container nesting is **unbounded** (single level = a fixed 2-pass unroll that fits even the linear runner; arbitrary depth = a real re-entrant loop + budget).
- **New non-terminal outcome (open).** A `refine` / `repackage` verdict distinct from `resolved` / `consult` / `error` (machine-to-machine, terminal to no one) --- whether it lives on `SpanResolutionOutcome` (FT-4) or as an orchestrator-level control signal above it is deferred to the future plan; **must not** be modeled as a Consult.
- **Home:** a future `taskPlanning/lambda/ephemera/llm/pipeline/` plan (re-entrant, budget-aware orchestrator), seeded by this scenario when a concrete consumer lands; **not** a Gateway-exit blocker.

### FT-7 decisions so far (2026-07-08)

Plan-only; graduate to durable docs (classify contract in [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md), [`discriminateIntent/`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/) prompt + guards) when FT-7 ships. Resolves the classify trust posture: **two-level classify --- trusted family, provisional intra-manipulation hints.** Coupled to FT-2 (the joint hop consumes the hints as evidence) and unblocks C4 (shared compiler entry).

**Two-level classify.** Classify commits **trusted-output at the family level only** --- manipulation vs navigation vs speech vs Acme --- which keeps the joint `(identity, plan)` prompt scoped to one family (FT-2 (e)). The **intra-manipulation** sub-fields (membership-vs-relational sub-topology, **`verbClass`**) drop to **provisional hints** consumed as **evidence** by the joint hop, never as committed routing. This is the *narrowing* flagged in **Scope / Out of scope** --- a universal end-to-end compiler for the whole game remains out of scope; classify stays the **family** discriminator.

**Reunified manipulation-family intent type --- supersedes the BD-11 routing split.** Classify emits **one manipulation-family intent type** carrying an optional hint bundle `{ subTopology?: 'membership' | 'relational', verbClass?, confidence }`, **not** the two first-class `ObjectMembershipIntent` / `ObjectRelateIntent` types whose `type` *is* the committed route.

- **What is retired:** BD-11's elevation of membership-vs-relational to a **top-level committed classify `type`** (the `enrichRoute` fork). That was the correct move under **trusted-output** --- it gave the two enrich paths a clean settled route --- but a committed sub-topology route is precisely the premature commitment fault tolerance removes. This is a **deliberate walk-back** of that experiment; it no longer fits the architecture.
- **What survives of BD-11:** the manipulation **family** exists and is classify-owned; **`verbClass`** remains membership **language direction** (`acquire` | `release`), not a relational field. Only the *first-class-type / committed-routing* role of the sub-split is superseded. Flag to the sibling plan (BD-11 row) before C1.

**Optional sub-topology hint is the capability gain (not just a refactor).** Because the hint is optional, classify **may** emit the manipulation family with **no** (or low-confidence) sub-topology hint when the line is genuinely ambiguous --- e.g. "put the coin in the jar" (container-membership vs on-surface relation, tangled with the BD-2 `in` deferral). Under the old split-type schema classify was **forced** to commit a guess there; now the joint hop adjudicates with the pool + evidence, or Consults. The old forced-wrong-route failure mode is designed out.

**No `enrichRoute` fork (= the concrete content of C4).** One shared manipulation-family entry flows into the FT-6 single-pass orchestrator; the sub-topology hint feeds **fast-path selection inside** that orchestrator, not a route decision in `parseCommand`. If a shared entry over-delivers candidates (in some omniscient/objective sense) that is the **correct** failure direction for a fault-tolerant proposer --- breadth first, then deterministic selection (FT-5).

**Hint trust rides the `confidence` scalar --- no separate provenance flag.** Two producers emit the same hint artifact with different trust, distinguished by one number:

- **Deterministic closed-world producer** ([`deterministicChecks.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts) template: `get`/`take`/`drop` + noun) emits **`confidence: 1.0`** --- as it already does today.
- **Classify LLM** emits its own **`confidence < 1.0`**.
- **`1.0` is a reserved closed-world sentinel.** The seam / Bedrock-bypass fast-path fires on **strict equality `confidence === 1.0`**, never a threshold (`>= 0.95` would re-open the "marginal soft signal drives the fast-path" hole --- FT-2 requirement #1). To keep the sentinel trustworthy, **clamp probabilistic producers strictly below `1.0`** (e.g. cap at `0.99`) at the parser boundary (`isParseConfidence` allows `<= 1` today, so nothing stops a confident LLM from returning `1.0`). This costs nothing real: an LLM over open language is never legitimately closed-world-certain.
- **Two sanctioned uses, one prohibited.** The hint `confidence` may be used as (a) the fast-path gate at `=== 1.0` and (b) soft **evidence weight** for the joint hop. It must **not** be blended as a naive addend into the **FT-5** absolute-confidence floor (correlated-signal double-count --- see FT-2 / FT-5 discipline). Calibration / de-correlation of the hint signal is **delegated to the FT-2 + FT-5 threads**.

**`verbClass` required -> optional; relational-side asymmetry.** FT-2 already moves `verbClass` ownership to the joint hop (evidence when present, derived from language when absent). Concrete FT-7 fallout: the `isParseCommandObjectMembershipIntentResult` guard + [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/index.ts) "errors if `verbClass` absent" must relax. **`verbClass` is a membership-only direction hint**; on the relational side classify contributes only the sub-topology hint and **no** direction --- relational `operationKind` (`establishRelation` | `dissolveRelation`) stays proposer-owned (BD-12 / FT-3).

**Family level stays trusted-output terminal; no cross-family re-routing.** A wrong **family** commit (manipulation vs navigation / speech / Acme) remains a trusted-output terminal: the joint hop **Abstains** (FT-3) but never reaches back across the family seam to re-classify. Cross-family correction joins the **future player-feedback tier** (same family as post-commit retcon / resumable Consult --- **Recoverability gradient**). This is the honest limitation that keeps the joint prompt bounded; family-level fault tolerance is **out of scope this iteration**.

**Scope: manipulation family only.** Navigation / Acme / speech keep their current trusted-output sub-fields. The intra-family hint demotion is **not** generalized this iteration (no universal compiler).

**Future experiment (non-blocking) --- may strong LLM confidence trigger fast-path gates elsewhere?** Flagged for later evaluation. **Not nonsense under optimistic closed-loop design, but it requires disambiguating two senses of "fast-path":**

- **Seam / Bedrock-bypass fast-path** (the one the `1.0` sentinel guards): skip an LLM hop *because a deterministic producer closed the case*. Letting an LLM confidence trigger **this** gate is self-defeating for the hop that would generate the signal --- you would run the model to decide whether to skip that same model (no budget saved). The sentinel stays reserved for closed-world producers here.
- **Trust / recoverability gates** (auto-resolve; fast-approving a *second*, cheaper downstream check): here a calibrated, high (sub-`1.0`) LLM confidence **may** legitimately license optimistic **proceed** --- this is already the **FT-5** stance ("optimism is licensed by catchability, not confidence magnitude"; illegal-if-wrong -> large discount). The coherent experiment is whether to **widen** the class of downstream gates a high LLM confidence may pass, tuned by the **recoverability gradient** (e.g. an already-paid joint hop's high-confidence output fast-approving a downstream deterministic check whose wrongness is cheaply catchable).

Net: reserve `1.0` for closed-world at the **seam** fast-path; treat "strong-LLM-confidence optimistic proceed" as a **trust-axis dial that already exists at FT-5** and could be extended --- never as a way to skip the hop that produced the confidence.

## Gateway exit (required before Phase C)

All must be **Decided** and corresponding **FT-0--FT-5** checklist items **complete** (or explicitly **N/A** with written rationale in this plan):

- [ ] **FT-1** decided --- candidate pool + relevance contract documented and tested (design decided 2026-07-08; pending FT-8 + calibration).
- [ ] **FT-2** decided --- identity LLM role in steady path documented (**decided (e) 2026-07-08**: merge identity into a joint `(identity, plan)` adjudicator; durable-doc write-up + enabler build threads still pending).
- [ ] **FT-3** decided --- Abstain vs Consult wire types + owner stages documented.
- [ ] **FT-4** shipped --- span-resolution types + guards in actions layer (**shape decided 2026-07-08**: input pool `candidates[]` with per-candidate `locus`, no `status`; verdict on the selector-tail output at the FT-5 selection point; types/guards pending build).
- [ ] **FT-5** decided --- auto-resolve / selection gate (floor + margin over runner-up) + post-selection existence/presence guard documented; `resolveComponent` retired as a standalone primitive (**decided 2026-07-08**; floor/margin constants calibration-owned).
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
  - [ ] Add **`ParseCommandConsultResult`** variant + guards; distinguish from **`Error`** and success variants (**decided**: new variant, not enriched `Error`).
  - [ ] Actions carries the structured **alternate proposed commands** (candidate re-phrasings that would scan) as **data**; perception owns the copy.
  - [ ] Handler in [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts): Consult -> player-visible message via perception, **no** positions stream, **no** resumable state (terminal prompt inviting a re-entered scanning command).

- [ ] **FT-3.2 Proposer Abstain/Consult behavior** (frame extract + complexity LLM retired per **FT-3 decisions so far**)
  - [ ] Proposer / joint hop: Abstain on unparseable; Consult only with structured, catalog-backed alternatives; policy/legality failures stay **Error** (deterministic tail / shared validator).
  - [ ] Deterministic fast-path + shared validator: no Consult authoring (defer -> Error; commit-vs-Consult is the FT-5 gate).

- [ ] **FT-3.3 Selector + existence-guard rules (foundation for C1)**
  - [ ] Deterministic **selector**: N `(identity, plan)` candidates -> auto-resolved tuple | consult | error per **FT-5** policy; per-span **existence/presence guard** (referential integrity) on the chosen tuple. (`resolveComponent` retired as a standalone primitive --- these are selector-tail facets, not a runtime Plan IR step.)
  - [ ] Tests: high-confidence auto-resolve; low-confidence consult; noMatch abstain/error; hallucinated/absent id -> guard rejects.

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
| FT-3 Abstain vs Consult | **Decided (2026-07-08)**: complexity LLM + frame extract retired as distinct hops; owner map (proposer = Abstain/Consult, shared validator = defer, FT-5 = auto-resolve / selection gate); no narrow-scope tier-2 LLM. Wire shape: **new `ParseCommandResult` Consult variant**, actions emits alternate proposed commands + perception assembles copy, **not resumable** this iteration. Variant types land with FT-4 |
| FT-4 span-resolution artifact shape | **Decided (2026-07-08)**: **two locked types** --- `SpanCandidatePool` (input `candidates[]` with per-candidate `locus`, room/held v1, **no `status`**; empty array = nothing to rank) + `SpanResolutionOutcome` (verdict `resolved`/`consult`/`error` on the selector-tail output at the FT-5 selection point). Types/guards pending build |
| FT-5 auto-resolve / selection gate | **Decided (2026-07-08)**: two-phase deterministic tail --- (1) cross-tuple selection (legality + floor + margin -> auto-resolve or Consult), (2) per-span existence/presence guard (referential integrity, orthogonal to semantics). "commit" reserved for persist+publish; FT-5 act = auto-resolve/select. `resolveComponent` retired as a standalone primitive. Floor/margin constants calibration-owned |
| FT-6 recovery orchestration owner | **Decided (2026-07-08)**: single-pass **dedicated feature-layer orchestrator module** (propose-N + pure selector + existence/presence guard); reject inline `identityStage` + `llm/pipeline/` runner. Container-contents supplement (deferred FT-4 `withinObject`) flagged as the first **re-entrant** closed-loop consumer -> future `llm/pipeline/` plan, non-blocking |
| FT-7 classify trust posture | **Decided (2026-07-08)**: **two-level classify** --- trusted family (manipulation vs navigation vs speech vs Acme), provisional intra-manipulation hints. **Reunified manipulation-family intent type** with optional `{ subTopology?, verbClass?, confidence }` hint bundle --- **supersedes the BD-11 top-level membership-vs-relational type split** (routing role only; family + `verbClass` semantics survive). **No `enrichRoute` fork** (one shared entry -> FT-6 orchestrator = C4). Hint trust = `confidence` scalar: **`1.0` reserved closed-world sentinel** (deterministic only; LLM clamped `< 1.0`; seam fast-path on `=== 1.0`). `verbClass` required -> optional (membership-only). Family-level errors stay trusted-output terminal (Abstain; cross-family correction = future tier). Hint-confidence calibration delegated to FT-2/FT-5; future experiment (widen downstream gates to strong LLM confidence) documented, non-blocking |
| FT-4 integration + gateway | Not started |
| **Gateway exit** (unblocks Phase C) | Not started |
| Phase C Plan IR (sibling plan) | Blocked on gateway |

## Coordination notes

- **Sibling plan:** [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) --- Phase C **must not** start until **Gateway exit** here is complete.
- **Commit boundary:** BD-9 atomic apply unchanged --- fault tolerance is pre-commit only **in this iteration**. Conceptually the commit boundary is the **steepest riser on a recoverability gradient** (detection flips self -> external), **not** a hard wall; a future **player-authority retcon** tier reduces but never eliminates post-commit recovery cost (see **Recoverability gradient + optimistic proposal**). Design stance: account for LLM error at any point, do not aspire to an error-free LLM. Not this initiative.
- **Seams:** BD-12 field ownership unchanged; fault tolerance does not authorize compiler **`operationKind`** invention.
- **Client:** Consulting may ship as OOC / **`PublishMessage`** first; structured reply correlation is follow-on (out of scope unless plan updated).
- **Calibration:** FT-1 should produce durable numbers in [`calibration/AGENT.md`](../../../../../lambda/ephemera/calibration/AGENT.md) / embedding snapshots before production threshold changes.
- **FT-2 <-> Phase C coupling (2026-07-08):** option (e) makes span grounding the deterministic **tail** of a joint semantic hop; **`resolveComponent` is retired as a standalone Plan IR primitive** (FT-5, 2026-07-08) --- the surviving per-span work is the selector verdict + existence/presence guard, not a runtime step. Flag to the sibling plan before C1 (registry drops `resolveComponent`). Registry **expressiveness** (new primitives / manner slots for intents like "just on the edge") stays **sibling-plan-owned** (Phase C/D); **out-of-registry Abstain/Consult** is FT-3 here. The closed primitive registry --- not `verbClass` or the intent enum --- is the invariant that keeps the relaxed classify frame inside the seam.
- **Classify trust posture (FT-7, 2026-07-08):** **two-level classify** --- trusted **family** commit, provisional **intra-manipulation** hints (sub-topology + `verbClass`) consumed as evidence by the joint hop (FT-2 (e)). Classify **reunifies to one manipulation-family intent type** with an optional `{ subTopology?, verbClass?, confidence }` hint bundle, which **supersedes the sibling BD-11 top-level membership-vs-relational type split** (its committed-routing role only --- the family and `verbClass`-as-membership-direction semantics survive). **No `enrichRoute` fork** --- one shared entry into the FT-6 orchestrator, which **is** the concrete content of sibling **C4**. Hint trust rides the `confidence` scalar: **`1.0` is a reserved closed-world sentinel** (deterministic producers only; probabilistic producers clamped `< 1.0`; seam fast-path fires on `=== 1.0`, never a threshold). Flag to the sibling plan (BD-11 + C4) before C1. See **FT-7 decisions so far**.
- **Closed-loop orchestration (FT-6, 2026-07-08):** gateway recovery is **single-pass** in a dedicated feature-layer orchestrator module; the linear `llm/pipeline/` runner is **not** adopted this iteration (no loop to run). The first case that *forces* a **re-entrant** loop is the **container-contents supplement** (`take X out of Y`; the deferred FT-4 `withinObject` locus, cross-plan with the sibling `in` / nesting vertical BD-2, BD-5): ground `from` -> supplement the target pool with the host's contents -> re-run. Tracked for a future `taskPlanning/lambda/ephemera/llm/pipeline/` orchestrator plan (re-entrant input shape + stall / time-budget), seeded when a concrete consumer lands --- **not** a Gateway-exit blocker. See **FT-6 decisions so far**.
