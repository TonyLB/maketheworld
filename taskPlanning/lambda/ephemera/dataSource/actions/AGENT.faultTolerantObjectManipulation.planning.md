# Object manipulation parse --- fault-tolerant trust + Plan IR foundation

**Status:** In progress (FT-0 shipped 2026-07-09). **Gateway** for Phase C of [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) --- do not begin Plan IR / compiler work until **Gateway exit** below is satisfied.

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
| **FT-1** | **Candidate pool construction** --- How do **embeddings** (cosine rank on **`EMBEDDING#IMPROMPTU`**, optional enriched index) combine with a tunable **`lexicalRelevance`** function to produce a **ranked candidate pool** per span with **relevance ratings** (absolute score, margin, eligible count, source tags)? Merge strategy + joint-score shape settled in **FT-1 decisions so far** below (**no admission floor**; rank-all + full ranked list + **gap-trim shortlist under a Top-N ceiling**; **weighted RMS** joint score; strict conjunctive gate deferred to FT-5). Per-signal **`[0,1]` normalization** settled in **FT-8 decisions so far** (absolute, not within-set). No architectural fork remains. **Calibration-owned (not decisions), fit in FT-1.3:** Top-N ceiling, gap-trim threshold, RMS weights `w_l`/`w_e`, FT-8 anchor constants (`c_min`, `L_min`, `S_min`, boundary edit costs). [`thresholds.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts) floor migration -> FT-5 confidence stage (no longer pool-admission floors). | FT-2, FT-3, gateway | Decided (pending calibration) |
| **FT-2** | **Identity LLM necessity** --- If we no longer require a **trusted-output single `objectId`** per span at the identity tier, do we still need a dedicated **identity LLM** hop? Rejected: (a) pool + deterministic adjudication only; (b) pool + lightweight validator LLM; (c) pool + identity LLM only on **backtrack** when pool ambiguous; (d) retain identity LLM but change output to **rank/reason** not pick-one. **Chosen: (e) merge identity into a joint `(identity, plan)` adjudicator** over the FT-1 pool, with an **unchanged deterministic legality/commit tail** --- see **FT-2 decisions so far** + **Instruction compiler + validator architecture**. Bedrock-bypass for common cases is answered by **staged fast-path composition** (mechanism documented; enabling capabilities relocated to their own build threads, not decision blockers). | FT-3, FT-7, gateway | **Decided (e) (2026-07-08)**; enablers + validation pending (in-memory sandbox, per-enum transfer semantics, tiered fast-path coverage, prototype + calibration) |
| **FT-3** | **Abstention vs Consulting downstream** --- **Direction set (2026-07-08, see FT-3 decisions so far):** **complexity LLM** and **frame extract** do **not** survive as distinct LLM steps (complexity LLM -> deterministic sandbox legality + shared validator; frame extract -> **net-new** deterministic frame templating + general joint proposer); no narrow-scope "tier-2" LLM (the untemplated-simple-language case is a **classify** concern). **Abstain / Consult** owned by the **proposer / joint hop**, **defer -> Error** by the **shared validator**, **commit vs Consult** by the **FT-5 gate** --- never the deterministic compiler (BD-12). **Wire shape decided (2026-07-08, see Consult wire shape):** Consult is a **new `ParseCommandResult` variant** (not enriched `Error`); **actions** emits structured **alternate proposed commands** (X / Y), **perception** assembles copy; **not resumable this iteration** (terminates with no graph change + a terminal prompt inviting a re-entered scanning command). Variant **types land with FT-4.** | FT-4, gateway, client | Decided (2026-07-08); types pending FT-4 |
| **FT-4** | **`SpanResolution` artifact** --- Canonical type(s) for provisional span grounding, shared by membership + relational paths and the Plan IR **selector** tail (formerly framed as `resolveComponent`). **Decided (2026-07-08, see FT-4 decisions so far):** **split input pool (evidence) from output verdict.** Input carries `candidates[]` only --- each candidate `{ id, label, relevance fields (absolute score, margin, source tags), locus }` --- with a structured **`locus`** discriminated union (`room` \| `heldByActor` \| `heldByOtherCharacter` \| `withinObject`); locus is **deterministic graph/catalog evidence** (context packaging, **not** semantic; never licenses `operationKind` invention; **v1 scope = cheap room/held loci**). **No `status` field on the input:** structural emptiness is `candidates.length === 0` (single source of truth; catalog fetch/IO failure stays a separate upstream error path, not a resolution state). The **verdict** (`resolved` \| `consult` \| `error`) lives on the **selector output** (`SpanResolutionOutcome`) at the single **FT-5** auto-resolve (selection) point --- `ambiguous` is a *reason* (pool property), `consult` a *response* (FT-5), never peers in one enum. **Locked as two types (2026-07-08):** `SpanCandidatePool` (input evidence) + `SpanResolutionOutcome` (verdict output). | FT-1--3, C1 | **Decided (2026-07-08)**; types land in FT-4 build |
| **FT-5** | **Auto-resolve / selection-gate policy** --- When may the deterministic **selector** **auto-resolve** a single `(identity, plan)` tuple without Consult (absolute confidence **floor** + **margin** over runner-up)? **Decided (2026-07-08, see FT-5 decisions so far):** the deterministic tail is **two phases** --- **(1) selection** (cross-tuple): legality gate + confidence floor + margin over runner-up across the N `(identity, plan)` candidates -> **auto-resolve one** or **Consult** (FT-5 owns the floor/margin; runner-up **legal** tuples are the Consult menu); **(2) post-selection existence/presence guard** (per span, on the chosen tuple): a deterministic **referential-integrity** filter that each chosen id **exists** + is **present** at its claimed `locus`, guaranteeing a well-formed `positionGraph` write --- **not** a re-litigation of semantics or confidence (denotation was decided upstream by FT-1 pool relevance + phase-1 confidence). **Terminology: "commit" / "commit boundary" is reserved for persist + publish**; the FT-5 act is **auto-resolve / select**. The floor is set by the **recoverability gradient** (see **Recoverability gradient + optimistic proposal**): auto-resolve on modest confidence when wrongness is **illegal-if-wrong** (caught for free by the guard + dry-run validator), hold floor + Consult when **legal-but-wrong**. Align with FT-1 relevance / FT-8 absolute scale; **one selection point** (no separate identity-tier auto-resolve). | C1, gateway | **Decided (2026-07-08)** (floor/margin constants calibration-owned) |
| **FT-6** | **Recovery orchestration owner** --- Inline in [`identityStage.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/identityStage.ts) vs dedicated orchestrator module vs [`llm/pipeline/`](../../../../../lambda/ephemera/llm/pipeline/AGENT.md) wrapper for identity+validation loop. **Decided (2026-07-08, see FT-6 decisions so far):** a **dedicated orchestrator module in the objectManipulation enrich layer**, **single-pass** (propose-N + pure deterministic selector + existence/presence guard -> `resolved` / `consult` / `error`). Reject **inline `identityStage.ts`** (identity folds into the joint hop per FT-2 (e); that owner is dissolving) and the **`llm/pipeline/` runner** (linear/single-pass by charter; no loop to run this iteration; enrich is still ad hoc). Orchestration (glue) stays separate from the **pure** selector (FT-5 one selection point). **Forward flag (non-blocking):** the first case that will *force* re-entrant closed-loop orchestration is the **container-contents supplement** (`take X out of Y`: ground `from` -> supplement the target pool with that host's contents -> re-run) --- the deferred FT-4 `withinObject` locus; parked for a future `llm/pipeline/` orchestrator plan, **not** a Gateway-exit blocker. | FT-2, FT-3 | **Decided (2026-07-08)** |
| **FT-7** | **Classify trust posture for Phase C** --- Keep classify **trusted-output** while enrich becomes fault-tolerant, or allow provisional intent handoff? **Decided (2026-07-08, see FT-7 decisions so far):** **two-level classify** --- **trusted-output at the family level** (manipulation vs navigation vs speech vs Acme; keeps the joint prompt scoped) but **provisional hints** for the **intra-manipulation** sub-fields (**`verbClass`**, membership-vs-relational sub-split) consumed as **evidence** by the joint hop, not committed routing. **Reunify to a single manipulation-family intent type** carrying an optional hint bundle `{ subTopology?, verbClass?, confidence }` --- **supersedes the BD-11 top-level membership-vs-relational type split** (its routing role no longer fits fault tolerance). **No `enrichRoute` fork** (one shared entry -> FT-6 orchestrator). **Hint trust rides the `confidence` scalar: `1.0` is a reserved closed-world sentinel** (deterministic producers only; LLM clamped `< 1.0`; seam fast-path fires on `=== 1.0`). Not a single end-to-end compiler for the whole game. | C4, FT-2 | **Decided (2026-07-08)** |
| **FT-8** | **Per-signal relevance normalization (`embed` + `lex` -> `[0,1]`)** --- **Decided (2026-07-08, see FT-8 decisions so far):** two-point **log map** for embedding cosine (`c_min` -> 0, `c_max=1` -> 1); **substring-biased edit distance** for lexical relevance (two-tier boundary discount on flanks; proportional penalty on the shorter normalized side; **narrowed short-span admissibility shipped FT-1.3.1** --- length-1 active, inadmissible length-2 gate retained). **Constraint (from FT-1 no-floor):** both mappings are **absolute / globally parametric** --- fixed anchors and formula constants, never within-candidate-set rescale. **Still calibration-owned:** anchor values (`c_min` ~ 0.05, `L_min` ~ 5, `S_min` ~ 3), boundary vs alpha-adjacent edit costs, index-shape fork. | FT-1, FT-5, gateway | **Decided (2026-07-08)**; FT-1.3.1 narrowed admissibility shipped 2026-07-09 |

### FT-1 decisions so far (2026-07-08)

Plan-only; graduate to durable docs (**`embeddingMatch/AGENT.md`**, contract) when FT-1 ships.

**Terminology --- relevance, not confidence.** At the pool-construction tier we score **relevance** (should this object enter the ranked candidate pool for this span?), not **confidence** (are we sure this is *the* match?). We are never confident about a non-exact match, so confidence language is reserved for **exact resolve** and the compile-time **auto-resolve** gate (FT-5). Rename `confidence ratings` -> `relevance ratings` across FT-1 artifacts.

**Lexical relevance is a tunable function.** `lexicalRelevance(span, shortName) -> [0,1]` is an explicit scoring function that **will be tuned and refactored over time** to improve pool quality --- treat the v1 body as a starting heuristic, not a contract. **Normalization shape is FT-8-owned** (see **FT-8 decisions so far**); FT-1 owns merge + pool contract only.

- **v1 body (FT-8, 2026-07-09):** Sellers alignment + tanh-centered flank combine (`editDistanceRelevance` * `tanhCenteredFlankScore`; FT-1.1.5 shipped 2026-07-09). Legacy multiplicative asymptotic combine retained as `multiplicativeFlankScoreV1` for simulator A/B. Legacy substring-biased edit distance retained for simulator A/B. See **FT-8 decisions so far** + **FT-1.1.5 recommended order**.
- **Calibration baseline (not v1):** token-overlap heuristic from the 2026-07-08 FT-1 draft --- keep in the pool simulator for A/B against substring edit distance.
- **Deferred tuning (not v1):** stemming, description tokens when the enriched index ships, TF-IDF-style down-weighting of common tokens, phrase-order signals.

**Merge strategy --- no admission floor, rank-all, weighted-RMS joint score.**

- **Pool admission = unconditional rank, no floor.** The pool builder's only job is to *rank*, not to *gate*: score every catalog candidate and rank by joint relevance, with **no absolute admission floor**. Gating ("is the best actually good enough?") is a downstream **confidence** decision (FT-5 / identity adjudication), not pool membership --- consistent with "relevance is disjunctive, confidence is conjunctive." Rationale: a fault-tolerant downstream must be able to conclude *"I examined the best available matches and none fit"* --- which needs a **best-of-worst ranking to examine**, not an empty pool. A floor discards exactly the top-of-worst evidence the noMatch/Abstain judgment (and calibration logging) needs, and the unary trap is handled *better* downstream with both signals visible (`take the sword` vs anvil-only room -> `[anvil @ ~0.05]` -> low absolute + zero lexical -> `noMatch`). The RMS **soft-OR** still supplies the "either signal lifts the score" behavior at the *score* level; only the separate per-signal admission floor is dropped.
- **Truncation = gap-trim under a Top-N ceiling; two orthogonal cuts.** Building the handoff shortlist and judging noMatch are *different* cuts and must stay separate:
  1. **How many to show = gap-trim.** Walk the ranked list top-down and include candidates until a hard **Top-N ceiling** (e.g. 5) *or* a **relative gap** marks the rest as importantly worse (a big relative drop in joint relevance). This is a deterministic "find the meaningful gap" cut, **not** statistical clustering: it yields a single candidate when there is a clear winner (big gap after top-1) and degrades to the ceiling when scores are bunched (ambiguous/absent case -> no gap). Gap threshold + ceiling are calibration-owned.
  2. **Whether any are good enough = absolute top-1 relevance (FT-8).** Kept separate because gap-trim is *relative* and must never leak into the noMatch judgment (FT-8 trap).
  Emit the **full ranked list + scores** underneath (catalog is small --- room + held --- so ranking all is status-quo cost) for consumers that want more than the shortlist. N is otherwise a *consumer* concern: Consult UX wants 2-3, auto-resolve (FT-5) wants top-1 vs top-2 margin.
- **No-floor makes FT-8 load-bearing --- and constrains it.** With admission gating removed, the *only* absolute anchor for the downstream "none match" judgment is the normalized relevance itself. So **FT-8 must yield an absolute, globally-parametric mapping** (two-point log for embed; proportional edit distance for lex --- see **FT-8 decisions so far**), **not a within-candidate-set rescale** (min-max / percentile), which always maps top-1 -> ~1.0 even when garbage and makes "none match" unknowable. Tension to hold: RMS wants *comparable* scales (relative OK); noMatch wants *absolute* meaning (relative not OK) --- if within-set rescaling is ever used for RMS comparability, preserve a separate absolute top-1 signal for the noMatch call.
- **`noMatch` becomes a judgment (numeric *and* semantic), not an empty pool.** With no floor and a non-empty catalog there is essentially always a top candidate, so `noMatch` derives from the head being *unfit*, not structural emptiness (only truly empty catalog stays structural, `NoCatalog`; reconcile with FT-4 `SpanResolution.status`). Two layers: a cheap **numeric** prefilter (top-1 absolute relevance, FT-8), and --- when the head is mediocre-but-not-zero --- a **semantic** adjudication that reads span + shortlist and concludes *"the best available (bag of beans, shawl, stunned fish) are simply not a sword,"* distinguishing a genuinely absent object from a numeric quirk (a paraphrase the vectors under-scored but which *is* present). That semantic call is FT-2 (identity LLM as adjudicator-with-abstain, not optimistic pick-one) / FT-3 (abstain vs consult). **Artifact implication:** the shortlist must carry candidate **identities + labels**, not just scores, so the semantic checker (and Consult copy) can reason over what the candidates *are* --- feeds the FT-4 `SpanResolution` shape.
- **Joint relevance score = weighted RMS (soft-OR):**

```
joint = sqrt(w_l * lex^2 + w_e * embed^2) / sqrt(w_l + w_e)     [both signals present]
joint = lex                                                     [embedding absent: drop w_e from num + denom]
joint = embed                                                   [lexical absent: drop w_l from num + denom]
```

  RMS is a power mean with exponent 2 --- it leans toward the **larger** signal (soft-OR / disjunctive), so a single strong signal can dominate (`(lex=1, embed=0) -> 0.707`, vs `0.5` for a convex sum) while agreement still pulls the average up. Chosen over a Bayesian log-odds combiner because the two signals are **correlated** (Titan on short text re-encodes lexical similarity), so multiplicative agreement would double-count. RMS caps at `max(lex, embed)` --- no super-max agreement bonus, which is the conservative choice under correlation. **No `w_a` agreement term** (the math does not need it, and correlation argues against it).
- **Two hard requirements for RMS to be meaningful:**
  1. **Normalize each signal to a comparable `[0,1]` relevance scale *before* squaring** --- raw cosines sit ~0.05-0.25, and `0.2^2 = 0.04` would erase the embedding contribution. Per-signal normalization shape is **FT-8** (decided 2026-07-08; constants pending calibration).
  2. **Distinguish absent from present-and-zero:** drop a missing signal from *both* numerator and the `w` sum (renormalize) rather than plugging `0`. A perfect lexical with **no vector available** -> `1.0`; a perfect lexical with an embedding that says `0` -> `0.707`. Same rule for **lexical channel absent** on degenerate / inadmissible short spans (FT-8) --- not `lex=0` on every candidate. (Mirrors "neutral != against"; connects to today's `no_eligible_embeddings` / `eligibleCount`.)
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

### FT-1.1.5 Lexical combine refactor --- recommended order (2026-07-09)

Plan-only; graduate to durable docs when shipped. **Slices between FT-1.1 (shipped multiplicative v1) and FT-1.2 (pool merge).** FT-1.1 shipped the Sellers + flank-geometry pipeline; FT-1.1.5 changes **only** how per-factor relevance scores are **combined** --- extracted from [`lexicalMatchMetrics`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/lexicalMatchMetrics.ts) into sibling modules under [`embeddingMatch/`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/). Alignment, flank decomposition, and per-channel asymptotic formulas are unchanged.

**Module layout (combiner home for FT-1 merge policy).** Split **pure math** from **relevance combiner patterns** so future pool-merge variants (flank sigmoid, weighted RMS joint, possible lex+embed sigmoid re-exam) share one owner without coupling to `llm/` or a cross-lambda package:

| Module | Role |
| --- | --- |
| [`evidenceNumerics.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/evidenceNumerics.ts) | Domain-agnostic primitives: `sigmoid`, `tanh`, `clampUnitInterval`, stable `exp` guards. No FT-1 semantics. Lift to [`internalUtils`](../../../../../lambda/ephemera/internalUtils/) only if a non-`embeddingMatch` consumer appears. |
| [`relevanceCombine.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/relevanceCombine.ts) | `[0,1]` evidence **combiner patterns** + A/B variants. FT-1.1.5: `tanhCenteredFlankScore` (production), `multiplicativeFlankScoreV1` (simulator). FT-1.2: `weightedRmsJointRelevance` (absent-channel drop semantics). Future lex+embed tanh/sigmoid variant lands here alongside RMS for simulator A/B. |
| [`lexicalMatchMetrics.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/lexicalMatchMetrics.ts) | Flank geometry + per-factor relevance; `lexicalRelevanceFromMetrics` calls `relevanceCombine`. |
| [`thresholds.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts) | Calibration constants for all combiners (per-channel `m`/`s`/`w`, combine `bias`; joint `w_l`/`w_e` at FT-1.2). Legacy `LEX_*_FLANK_MAX_DAMAGE` / `LEX_FLANK_RELEVANCE_K` remain for v1 asymptotic factors + simulator A/B until retired. |

**Not** [`llm/`](../../../../../lambda/ephemera/llm/) (Bedrock/pipeline, not scoring) or **`mtw-lambda-patterns`** until a second lambda needs the same combiners.

**Problem (why refactor now, before pool merge).** The shipped **four-way product** preserves ordering but **compresses the middle band**: several "okay" flank factors in the 0.5-0.9 range multiply into scores clustered below ~0.4, while near-perfect cases sit near 1.0. That bimodal spread is weak feedstock for downstream stages that need absolute mass in **0.25-0.75**: weighted-RMS joint with embed (FT-1), gap-trim relative cuts, and the FT-5 absolute-confidence floor. Multiplication is conjunctive; flank channels are facets of one alignment, not independent evidence --- a clean adjoined flank should be able to **partially offset** a depressed remote-flank factor (e.g. `broom` in a long `the ... broom` wrapper), which the product forbids when multiple channels are sub-1.

**Direction (locked for implementation).**

- **Keep `editDistanceRelevance` as a hard multiplicative gate** --- the only channel that may drive lexical relevance to `0` (paraphrase, absent-object, catastrophic misalignment). Unchanged formula and veto role from FT-8.
- **Combine flank geometry via centered `tanh` evidence + outer `sigmoid`**, not a product of asymptotic `[0,1]` factors. Each channel is specified by **midpoint** (neutral), **scale** (steepness around neutral), and **weight** (relative importance independent of midpoint):

```
t_i     = (m_i - x_i) / s_i                    // x_i = raw flank length (or combined remote length)
e_i     = w_i * tanh(t_i)                      // bounded evidence in [-w_i, w_i]
flankScore = sigmoid(bias + e_L + e_R + e_Rm)
lexRelevance = editDistanceRelevance * flankScore
```

  **Per-channel intent (adjoined flanks):** `x = 0` is **better than neutral** (positive evidence, saturating as `tanh → +1`); `x = m` is neutral (`e = 0`); `x → ∞` is progressively worse with **string length**, evidence saturating as `tanh → -1` (asymptote on the penalty side, not unbounded negative score). First-effort adjoined midpoint: **`m = spanScale / 2`** (half the match span in T). Remote flank uses the same shape with its own `(m, s, w)` --- wrapper length is unbounded in the catalog, but per-channel evidence is bounded before the outer sigmoid.
- **`bias`** calibrates the score when all channels sit at their midpoints (`sigmoid(bias)` on the FT-8 absolute scale). FT-1.3 owns `(bias, m_i, s_i, w_i)` per channel; first implementation may ship provisional anchors.
- **Not changing (pending calibration):** embed+lex joint RMS (still disjunctive power mean --- correlation argument unchanged); Sellers alignment; `deriveFlankLengthMetrics`; legacy `flankLengthRelevance` asymptotics (retained for **multiplicative v1** simulator A/B); legacy `substringBiasedEditDistance`. **Short-span lexical admissibility** (`admissibleShortSpans`, `S_min`, length-1 absent) **ships unchanged through FT-1.1.5** but is a **retirement candidate** --- see hypothesis below.

**Short-span admissibility retirement hypothesis (test in FT-1.3 calibration).** The catalog-derived short-span gate exists because v1 lexical scoring treated very short spans as near-`1.0` substring hits against a large fraction of catalog tokens (length-1 `a`, inadmissible length-2 `ax` vs `axe`-only catalog). **Hypothesis:** FT-1.1.5's span-scaled `tanh` evidence --- midpoints and scales keyed to `spanScale`, adjoined-flank geometry distinguishing prefix vs infix (`ax`/`axolotl` > `ax`/`coaxial`), edit gate, and bounded outer `sigmoid` --- may produce **low absolute lexical scores** for spurious short-span matches without a separate scan-level "lexical channel absent" pre-pass. If calibration confirms:

- Run identity corpus + pool simulator **twice**: (A) current **`admissibleShortSpans` / `isLexicalChannelActive`** gate; (B) same metrics with short-span admissibility **turned off** (lexical always active for every normalized span length).
- **Pass criteria for retirement:** (B) does not regress identity-corpus buckets (paraphrase, absent-object, unary trap, short-span cases); length-1/2 spurious lex matches stay below noMatch / FT-5 floors; `ax`/`axolotl` > `ax`/`coaxial` and related ordering tests still hold.
- **If hypothesis holds:** remove `admissibleShortSpans`, `isLexicalChannelActive`, and `S_min` gate from pool builder; simplify RMS merge (lex always defined per candidate); update [`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md) + FT-8 steady-state; retain upstream junk-span discard (FT-1.4) as optional QoL only.
- **If hypothesis fails:** keep admissibility; document which corpus cases require it under the new combine.

**Why `tanh` per channel, `sigmoid` outer.** `tanh` is the standard centered saturating nonlinearity: positive evidence caps at `+w`, negative at `-w`, with smooth approach to both asymptotes as flank **string length** grows. Summing bounded channel votes then applying `sigmoid` spreads mass into the 0.25-0.75 middle band while letting clean flanks partially offset depressed siblings --- the offset behavior multiplication forbids. Decoupling `m`, `s`, and `w` per channel is clearer than a single `alpha + beta * sum(log f)`.

**Math sanity test (must hold after implementation).** Adjoined-flank geometry must distinguish **prefix-anchored** vs **infix-embedded** short-span matches --- double-check with a unit test (add if missing):

- `lexicalRelevance('ax', 'axolotl')` **>** `lexicalRelevance('ax', 'coaxial')`

  (`ax` is a clean prefix of `axolotl`; in `coaxial` it is alpha-adjoined on both sides inside a longer token.) Failing this ordering signals mis-specified midpoints, weights, or conflation of left/right adjoined channels. Keep alongside existing `ax` / `rusty ax` / `axle` ranking tests.

**Absolute-scale anchors (FT-8 discipline).** Fit must preserve:

| Anchor | Target |
| --- | --- |
| Perfect alignment (`edit=1`, all flanks at best) | `lex ~ 1.0` |
| All flanks at midpoints + `edit=1` | `sigmoid(bias)` --- predictable absolute |
| Paraphrase (`sweeping tool` / `broom`) | `lex` well below exact --- driven primarily by edit gate |
| Absent object (`sword` / `anvil`) | `lex` near zero |
| Ordering invariants | `rusty ax` > `axle` > unrelated; `ax`/`axolotl` > `ax`/`coaxial`; wrapper containment high; typo-on-long > typo-on-short |

**Recommended build order.**

1. **Add [`evidenceNumerics.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/evidenceNumerics.ts)** --- `sigmoid`, `tanh`, `clampUnitInterval`; unit tests for stability at extreme inputs.
2. **Add [`relevanceCombine.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/relevanceCombine.ts)** --- `centeredTanhEvidence({ value, midpoint, scale, weight })`, `tanhCenteredFlankScore(...)` (production) + `multiplicativeFlankScoreV1` (simulator A/B); per-channel + `bias` constants in [`thresholds.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts).
3. **Wire `lexicalRelevanceFromMetrics`** --- `editDistanceRelevance` (hard gate) * `tanhCenteredFlankScore(...)` from raw flank lengths + `spanScale` (not from v1 `flankLengthRelevance` factors on the production path).
4. **Update unit tests** --- `evidenceNumerics`, `relevanceCombine`, lexical invariants: ordering + tail (paraphrase, absent object, `ax` ranking); middle-band cases (long wrapper, `ax`/`axle`, typo-on-long); **`ax`/`axolotl` > `ax`/`coaxial`** math sanity test (add if missing).
5. **Update [`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md)** module table + combine formula when shipped.
6. **Re-run pool simulator / identity corpus** on the new combine **before FT-1.2 pool merge** --- confirm joint RMS + gap-trim behavior improves with more middle-band lexical mass.
7. **FT-1.3 calibration** fits `(bias, m_i, s_i, w_i)` per flank channel jointly with `c_min`, RMS `w_l`/`w_e`, gap-trim, and FT-5 floor/margin; **A/B short-span admissibility on vs off**. **FT-1.2** adds `weightedRmsJointRelevance` to `relevanceCombine.ts` (not inline in pool builder). **FT-1.3.1** retires admissibility if A/B passes with gate off.

**Blocks:** nothing in FT-1.2 is blocked on constants being locked, but shipping pool merge on the known-bimodal multiplicative combine wastes a calibration cycle. **Recommended:** land FT-1.1.5 before FT-1.2, or land FT-1.2 behind a feature flag until step 5 passes.

### FT-8 decisions so far (2026-07-08)

Plan-only; graduate to durable docs (**`embeddingMatch/AGENT.md`**, contract) when FT-8 ships. Resolves per-signal **`[0,1]` relevance normalization** for the FT-1 weighted-RMS pool builder and the FT-5 absolute-confidence floor.

**Absolute scale discipline (unchanged from FT-1).** Both signals map through **fixed global formulas + calibration constants** --- never within-candidate-set rescale (min-max / percentile) on the signal that feeds noMatch / auto-resolve. Gap-trim may use relative cuts on joint scores; absolute top-1 relevance stays separate.

**Embedding relevance --- two-point log map on raw cosine.**

- **Formula:** `embedRelevance(c) = clamp( log(c / c_min) / log(c_max / c_min), 0, 1 )` with **`c_max = 1`** (exact normalized-shortName match) and **`c_min`** as the corpus noise floor anchor (first effort **`c_min = 0.05`** --- values below clamp to `0`).
- **Rationale:** Titan cosines on short phrases cluster ~0.05-0.25 with **ratio-meaningful, absolute-tiny** separation ([`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md) calibration). Log stretch spreads the operational band so embedding contributes meaningfully to RMS (`0.158` -> ~`0.40` at `c_min=0.05`) without within-set rescale.
- **Does not reorder:** absent-object best can still normalize above paraphrase best on symmetric index --- acceptable because noMatch / auto-resolve consume **joint** relevance + FT-5 conjunctive gate, not embed alone.
- **Calibration-owned:** `c_min` sweep (0.05 vs 0.08); power-transform `(c^k - c_min^k) / (1 - c_min^k)` as simulator A/B; **per-index-shape anchors** if `shortNamePlusDescription` ships (asymmetric ladder reshapes the distribution --- paraphrase uplift vs absent-object risk).

**Lexical relevance --- Sellers alignment + multiplicative factors (2026-07-09).**

Supersedes the FT-1.1 substring-biased edit-distance body for `lexicalRelevance()`; legacy distance retained in `lexicalRelevance.ts` for simulator A/B.

- **Inputs:** normalized `objectSpan` and normalized catalog `shortName`; shorter string is pattern P, longer is candidate T.
- **Alignment:** [`sellersApproximateSubstringMatch`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/sellersApproximateSubstringMatch.ts) (OSA) yields `editDistance` and `matchSpan` in T.
- **Flank geometry:** [`deriveFlankLengthMetrics`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/lexicalMatchMetrics.ts) splits flank material into adjoined vs remote character lengths (alpha-glued morphology vs whitespace-/boundary-separated wrapper).
- **Per-factor relevance** (each in `[0,1]` except edit floor at `0`):
  - **Edit (hard gate):** `1 - min(1, editDistance / max(|match span in T|, |P|))` --- only factor that can zero lexical relevance.
  - **Adjoined left / right:** `1 - maxDamage_adj * (1 - exp(-k * flankLength / spanScale))` --- floor `1 - maxDamage_adj`; cannot fully overrule a strong edit match.
  - **Remote (combined left+right):** same asymptotic with smaller `maxDamage_remote` (~`0.2` first effort).
  - `spanScale = max(|match span in T|, |P|, 1)`.
- **Combine (shipped FT-1.1 v1):** `lexRelevance = edit * leftAdjoined * rightAdjoined * remote` (multiplicative independent evidence). **Superseded for production combine by FT-1.1.5** (edit gate * `sigmoid(bias + Σ w_i tanh((m_i - x_i)/s_i))` on raw flank lengths); v1 product retained for simulator A/B until calibration retires it.
- **Expected behavior:** exact / short wrapper (`broom` vs `the broom`) -> high; `ax` ranks `rusty ax` > `axle` > unrelated; token-free paraphrase (`sweeping tool` vs `broom`) -> well below exact (absolute floor calibration-owned in FT-1.3).
- **Calibration-owned:** `LEX_ADJOINED_FLANK_MAX_DAMAGE`, `LEX_REMOTE_FLANK_MAX_DAMAGE`, `LEX_FLANK_RELEVANCE_K` in [`thresholds.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts); paraphrase absolute separation; token-overlap baseline retained in simulator for A/B.
- **Deferred:** description tokens when enriched index ships.

**Lexical relevance --- substring-biased edit distance (FT-1.1 legacy, simulator A/B only).**

- **Distance `d`:** minimum edit cost to embed the **shorter** string as a contiguous match in the **longer** string, with **two-tier flank discount**.
- **Relevance:** `clamp(1 - d / max(|shorter|, L_min), 0, 1)`.

**Short-span lexical admissibility (scan-level gate, decided 2026-07-08; retirement under review).** Substring lexical is meaningless for very short spans under **v1 multiplicative** scoring (length-1 `a` substring-matches a large fraction of English tokens at ~1.0). Before scoring any `(span, shortName)` pairs, decide whether the **lexical channel is active for this scan**. **FT-1.1.5 hypothesis:** span-scaled `tanh` combine may make this gate unnecessary --- **FT-1.3 calibration** runs pool metrics with admissibility **on vs off**; remove if off passes (see **FT-1.1.5 Short-span admissibility retirement hypothesis**).

- **`S_min`:** first effort **`S_min = 3`** characters on normalized span. Spans at or above `S_min` always get lexical scoring (per pair).
- **Length-1:** lexical channel **absent** always --- drop `w_l` from RMS for every candidate (undefined, not `0`).
- **Length 2 to `S_min - 1`:** lexical runs only if span is **catalog-admissible** for this pool build:
  - Precompute once per catalog: **`admissibleShortSpans`** = whole tokens from normalized `shortName` values with `|token| < S_min`, plus any normalized `shortName` itself when `|shortName| < S_min`.
  - **Whole tokens only** --- do **not** admit a span because it is an alpha-prefix inside a token (`ax` is **not** admitted by catalog `axe` / `rusty axe`; only by `ax` or `rusty ax`).
  - If `span` is not in `admissibleShortSpans`, lexical channel **absent** for the whole scan (undefined, not `0` on every non-match).
- **`0` vs absent:** when lexical is **active**, `lex=0` on a candidate means "lexical ran; no match" (real score). When lexical is **absent**, drop `w_l` from RMS --- do not interpret as evidence against every catalog entry.
- **Accepted failure:** player says `ax`, catalog has only `rusty axe` -> `ax` not admissible -> lexical absent -> embed + semantic adjudication carry the span; unfortunate typo, not a lexical bug.
- **Upstream junk-span discard (deferred QoL, not v1):** classify / frame validation *may* fast-reject spans that are empty or below `S_min` after article strip (e.g. `get a` -> `a`) before pool build --- saves work, clearer Abstain path. **Not a Gateway blocker:** pool admissibility gate is the load-bearing defense v1 ships; upstream discard is a follow-on quality-of-life improvement.

**Embedding index-shape fork (still FT-8-owned, not locked).** Production v1 geometry is symmetric **`shortName`-only**; enriched asymmetric **`shortNamePlusDescription`** is preferred when storage ships ([`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md) asymmetric ladder). Index shape sets the cosine distribution being log-normalized --- re-run **`EmbeddingAsymmetricLadder`** + pool simulator before locking `c_min` per shape.

**FT-1.3 fit order:** implement both normalizers + short-span admissibility pre-pass (gate stays for A/B baseline) -> **FT-1.1.5 lexical combine refactor** (edit gate * tanh-centered flank evidence + sigmoid; simulator A/B vs multiplicative v1) -> simulate pool metrics on identity corpus + asymmetric ladder -> **admissibility on vs off A/B** -> lock `c_min`, `L_min`, edit-cost weights, flank-combine `(bias, m, s, w)` per channel, then fit `w_l`/`w_e`, gap-trim, and FT-5 floor/margin (`S_min` only if admissibility survives A/B).

### FT-8 exploration notes (non-normative)

- **Duplicate normalized shortNames:** lexical scores may be identical; ambiguity is a pool property + FT-5 Consult, not an FT-8 normalization fix.
- **Short-span admissibility vs span-scaled tanh combine:** FT-1.3 calibration A/B (admissibility on vs off). If off passes, retire `S_min` / `admissibleShortSpans` --- the gate was compensating for v1 lexical false positives, not a fundamental pool contract.
- **Upstream junk-span discard (deferred QoL):** fast-reject at classify / frame extract when normalized span is empty or `< S_min` after article strip (`get a`, etc.) --- avoids pointless pool + embed work and surfaces Abstain earlier. Independent of admissibility retirement; pool builder may score all spans while classify still fast-rejects junk. Track as follow-on after FT-1 pool builder ships.

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

- [X] **FT-1** decided --- candidate pool + relevance contract documented and tested (design decided 2026-07-08; FT-8 normalization decided 2026-07-08; **constants locked FT-1.3 2026-07-09**).
- [ ] **FT-2** decided --- identity LLM role in steady path documented (**decided (e) 2026-07-08**: merge identity into a joint `(identity, plan)` adjudicator; durable-doc write-up + enabler build threads still pending).
- [ ] **FT-3** decided --- Abstain vs Consult wire types + owner stages documented.
- [ ] **FT-4** shipped --- span-resolution types + guards in actions layer (**shape decided 2026-07-08**; **types/guards shipped FT-0**; selector wiring + end-to-end integration pending FT-4 build).
- [ ] **FT-5** decided --- auto-resolve / selection gate (floor + margin over runner-up) + post-selection existence/presence guard documented; `resolveComponent` retired as a standalone primitive (**decided 2026-07-08**; floor/margin constants calibration-owned).
- [ ] **FT-8** decided --- per-signal embed + lex relevance normalization to absolute `[0,1]` scale documented (**decided 2026-07-08**: log map + substring edit distance + two-tier boundary discount + catalog-derived short-span admissibility; anchor constants calibration-owned).
- [ ] Identity tier emits **provisional pool** (not terminal embedding **`Resolved`**) on non-exact paths, or shim documented with sunset date.
- [ ] [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) updated: trust posture + recovery patterns per hop.
- [ ] Sibling plan [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) **Progress** row: "Fault-tolerant gateway" -> Done.

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines as you finish each sub-step.

### FT-0. Decision framing + types skeleton

- [X] **FT-0.1 Readout**
  - [X] Team review of [`llm/AGENT.concepts.md`](../../../../../lambda/ephemera/llm/AGENT.concepts.md) fault recovery section against current identity stage code.
  - [X] Capture FT-1--FT-3 options in decision rows (update **Open decisions** table as choices narrow). **Architectural forks closed (2026-07-09):** remaining FT-1--FT-3 work is implementation + calibration, not option rows.

- [X] **FT-0.2 Artifact sketch**
  - [X] Draft **`SpanCandidatePool`** / **`ObjectSpanCandidate`** / **`SpanResolutionOutcome`** types in enrich [`spanResolution.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/spanResolution.ts) --- guards only, no behavior change yet. **`ParseCommandConsultResult`** stub in [`baseClasses.ts`](../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts) (unwired).
  - [X] Document mapping: current **`identityStage`** outcomes -> future artifact statuses (see **FT-0 outcome mapping** below).

#### FT-0 readout (fault recovery vs identity stage v1)

Reviewed [`llm/AGENT.concepts.md`](../../../../../lambda/ephemera/llm/AGENT.concepts.md) (**Fault recovery patterns**, **Output trust models**) against [`identityStage.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/identityStage.ts). Summary:

| Concept | Current v1 behavior | FT target |
| --- | --- | --- |
| **Trusted-output** | Every span must end `resolved` or stage `error` before compile | Provisional `SpanCandidatePool` until FT-5 auto-resolve |
| **Correct** | Identity LLM optimistic pick-one; no validator backtrack | Joint `(identity, plan)` adjudicator + selector (FT-2 / FT-5) |
| **Backtrack** | Embedding abstain -> identity LLM (single retry owner) | Propose-N + semantic abstain / consult (FT-2 / FT-3) |
| **Supplement** | Catalog + embeddings attached at parse ingress (shipped) | Same; future `withinObject` pool supplement (FT-6 forward flag) |
| **Closed-world vs closed-loop** | Embedding `Resolved` is terminal commit-worthy | Embedding becomes recommender input to pool (FT-1) |

**Key gap:** intermediate states (`noMatch`, `ambiguous`, `EmbeddingMatchDecision.Abstain`) collapse to `ParseCommandErrorResult` today --- no `Consult` variant and no provisional artifact for the compiler to adjudicate. FT-0 ships type skeleton only; runtime trust posture unchanged until FT-1+.

#### FT-0 outcome mapping

| Current artifact | When | Future artifact / stage |
| --- | --- | --- |
| `ObjectSpanResolutionResult.Resolved` | Exact shortName match | `ObjectSpanCandidate` with `sourceTags: ['exact']`, `jointRelevance: 1`; selector may auto-resolve immediately |
| `ObjectSpanResolutionResult.NoMatch` | No exact match | Non-empty `SpanCandidatePool` (FT-1 rank-all); `noMatch` becomes FT-2 / FT-5 **judgment**, not pool status |
| `ObjectSpanResolutionResult.AmbiguousMatch` | Duplicate normalized shortName | Pool with thin margin among top candidates; FT-5 -> `consult` |
| `ObjectSpanResolutionResult.NoCatalog` | Empty catalog at deterministic step | Upstream **error path** (not pool status); `candidates.length === 0` only for legitimately empty ingress context |
| `EmbeddingMatchDecision.Resolved` | Floor + margin pass | Strong head candidate in pool; FT-5 may auto-resolve (not terminal commit) |
| `EmbeddingMatchDecision.Abstain` | below_floor / ambiguous_margin / no_eligible / embed_invoke_failed | Pool still emitted; abstain reason informs semantic adjudication (FT-2), not terminal Error |
| `SpanGrounding.resolved` + `IdentityStageResult.success` | Post-LLM pick-one | `SpanResolutionOutcome { verdict: 'resolved' }` at selector only |
| `IdentityStageResult.error` | noCatalog, LLM failure | `SpanResolutionOutcome { verdict: 'error' }` or upstream error; multi-span ambiguity -> `consult` not Error (FT-4.1) |
| `collapseUnaryGrounding.error` | 0 or 2+ resolved spans | FT-5 cross-tuple selection + consult menu |
| Terminal `ParseCommandErrorResult` | All enrich failures today | Split: **Error** (policy / legality), **Consult** (`ParseCommandConsultResult`), **Abstain** (proposer, FT-3) |

### FT-1. Candidate pool (embedding + lexical)

- [X] **FT-1.1 Lexical + normalization helpers**
  - [X] Implement **`embedRelevance`** per **FT-8 decisions so far** (two-point log map on cosine).
  - [X] Implement **`lexicalRelevance`** --- Sellers alignment + multiplicative factors (`lexicalMatchMetrics` + `lexicalRelevanceFromMetrics`; legacy substring-biased distance for A/B).
  - [X] Implement **short-span admissibility pre-pass** (`admissibleShortSpans` from catalog tokens; length-1 + inadmissible length-2/3 -> lexical channel absent, drop `w_l` from RMS).
  - [X] Unit tests: exact / wrapper match, typo tolerance across short vs long names, `ax` vs `rusty ax` vs `axle`, paraphrase (lex ~0), absent object, unary catalog, duplicate shortName, length-1 absent, `ax` vs `axe`-only catalog (lexical absent).
  - [X] Retain token-overlap baseline in simulator for A/B (not production path).

- [X] **FT-1.1.5 Lexical combine refactor** (recommended before FT-1.2 --- see **FT-1.1.5 recommended order**)
  - [X] Add [`evidenceNumerics.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/evidenceNumerics.ts) --- `sigmoid`, `tanh`, `clampUnitInterval` (pure math; no FT-1 semantics).
  - [X] Add [`relevanceCombine.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/relevanceCombine.ts) --- `centeredTanhEvidence`, `tanhCenteredFlankScore` (production) + `multiplicativeFlankScoreV1` (simulator A/B).
  - [X] Wire **`lexicalRelevanceFromMetrics`**: `editDistanceRelevance` (hard gate) * `tanhCenteredFlankScore(...)` from raw flank lengths.
  - [X] Add calibration-owned constants to [`thresholds.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts): combine `bias`; per-channel `m` / `s` / `w` (adjoined L/R, remote).
  - [X] Unit tests: `evidenceNumerics`, `relevanceCombine`, lexical ordering + tail invariants; middle-band cases (long wrapper, `ax`/`axle`, typo-on-long); **`ax`/`axolotl` > `ax`/`coaxial`** (add if missing --- math sanity for adjoined-flank geometry).
  - [X] Pool simulator / identity corpus pass on new combine before FT-1.2 merge (or FT-1.2 behind flag until pass).
  - [X] Update [`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md) module table + combine formula when shipped.

- [X] **FT-1.2 Pool merge**
  - [X] Refactor [`rankCatalogByCosineSimilarity`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/rankCatalogByCosineSimilarity.ts) / [`decideEmbeddingMatch`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/decideEmbeddingMatch.ts) toward **pool + relevance** output (narrow or replace terminal **`Resolved`**).
  - [X] Add **`weightedRmsJointRelevance`** to [`relevanceCombine.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/relevanceCombine.ts); apply **FT-8** `embedRelevance` + `lexicalRelevance` before joint score (per FT-1 decisions); emit full ranked list + gap-trim shortlist with relevance fields (id, label, absolute score, margin).
  - [X] Extend [`simulateEmbeddingIdentity`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/simulateEmbeddingIdentity.ts) / calibration corpus for pool metrics (not terminal auto-resolve rate alone).

- [X] **FT-1.3 Calibration pass** (FT-1 + FT-8 design decided; this fits the constants) **shipped 2026-07-09**
  - [X] Fit + lock calibration constants with provenance comments: `c_min`, `L_min`, `S_min` (kept --- admissibility A/B failed retirement), boundary edit-cost weights, flank-combine `(bias, m, s, w)` per channel, RMS weights `w_l`/`w_e`, Top-N ceiling, gap-trim threshold. Proposed FT-5 `T_JOINT_ABS`/`T_JOINT_MARGIN`/`T_JOINT_ABS_UNARY` in [`thresholds.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts).
  - [X] **Short-span admissibility A/B:** identity corpus ranking unchanged on vs off; **retirement failed** --- length-1 `a` and inadmissible `ax` produce spurious lex ~0.94+ / joint above `T_JOINT_ABS` with gate off. **Keep admissibility**; see [`testing/compareAdmissibilityArms`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/testing/compareAdmissibilityArms.ts).
  - [X] **Asymmetric ladder:** index shape unchanged (`shortName`-only) --- no re-run. Prior snapshot [`asymmetric-identity-ladder-v1-2026-07-07.json`](../../../../../lambda/ephemera/calibration/objectMatch/snapshots/asymmetric-identity-ladder-v1-2026-07-07.json); pool snapshot [`embedding-identity-pool-v1-2026-07-09.json`](../../../../../lambda/ephemera/calibration/objectMatch/snapshots/embedding-identity-pool-v1-2026-07-09.json).
  - [X] FT-5 confidence stage owns migrated floors: `T_ABS`/`T_MARGIN` scoped to v1 production shim (raw cosine); `T_JOINT_*` proposed for FT-5 selector on `jointRelevance` --- **not** pool admission. Documented in [`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md) (**Threshold ownership**).

- [X] **FT-1.3.2 Soft short-span lexical mitigation (experiment)** **shipped 2026-07-09**
  - [X] Implement coverage-derived `biasEff(coverage)` + asymmetric adjoined positive damp in [`relevanceCombine.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/relevanceCombine.ts); thread `FlankCombineContext` from [`lexicalRelevanceFromMetrics`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/lexicalMatchMetrics.ts).
  - [X] Re-run A/B --- **retirement still fails** (`a`/`axe` ~0.90 lex, above `T_JOINT_ABS`); identity corpus ranking unchanged. Remote channel unchanged --- vacuity bonus is documented follow-up.
  - [X] Pool snapshot with mitigation note: [`embedding-identity-pool-v1-2026-07-09-shortspan-mitigation.json`](../../../../../lambda/ephemera/calibration/objectMatch/snapshots/embedding-identity-pool-v1-2026-07-09-shortspan-mitigation.json). Admissibility gate **on** in production until a future slice passes retirement.

- [X] **FT-1.3.3 Ratio-invariant adjoined + split retirement criteria (experiment)** **shipped 2026-07-09**
  - [X] Adjoined L/R use `x/spanScale`, `m=LEX_ADJOINED_FLANK_MIDPOINT_RATIO` when `FlankCombineContext` present; FT-1.3.2 coverage bias + positive damp retained.
  - [X] Add proportionate-coverage fixtures (`gem`/`gemstones` vs `a`/`axe`); `gem`/`gemstones` > `a`/`axe` at equal embed coverage; `ax`/`axolotl` > `ax`/`coaxial` preserved.
  - [X] **Revise FT-1.3.1 retirement bar:** diverse-catalog length-1 spurious lex + inadmissible `ax` must stay below `T_JOINT_ABS` with gate off; unary `a`/`axe` shorthand may score moderately --- not a failure. Full gate retirement still blocked (remote vacuity + diverse-catalog).
  - [X] Snapshot: [`embedding-identity-pool-v1-2026-07-09-ratio-invariant.json`](../../../../../lambda/ephemera/calibration/objectMatch/snapshots/embedding-identity-pool-v1-2026-07-09-ratio-invariant.json).

- [X] **FT-1.3.4 Ratio-invariant remote (experiment)** **shipped 2026-07-09**
  - [X] Remote channel uses `remoteLength/spanScale`, `m=LEX_REMOTE_FLANK_MIDPOINT_RATIO` when context present (parallel to FT-1.3.3 adjoined).
  - [X] Equal zero-remote vacuity across span scales; `gem`/`gemstones` no longer inflated vs `a`/`axe` on remote. `ax`/`axle` vacuity bonus reduced; gap vs `rusty ax` narrowed (coverage bias still favors axle).
  - [X] **FT-1.3.5 flank weight sweep:** locked `w_adjoined=3.0`, `w_remote=0.4`; `a/axe` ~0.63, `gem`/`gemstones` ~0.72, identity ordering preserved.

- [X] **FT-1.3.5 Flank channel weight sweep (experiment)** **shipped 2026-07-09**
  - [X] Joint sweep on ratio-invariant production path; locked `LEX_ADJOINED_FLANK_WEIGHT=3.0`, `LEX_REMOTE_FLANK_WEIGHT=0.4`.
  - [X] Higher adjoined weight amplifies L/R flank geometry; lower remote weight drops zero-remote vacuity floor. `rusty ax` > `axle` gap opened (~0.05).
  - [X] Retirement still fails (`a/axe` ~0.63 > `T_JOINT_ABS`); gate **on**. Superseded for production bias by FT-1.3.6.

- [X] **FT-1.3.6 biasMax sweep (experiment)** **shipped 2026-07-09**
  - [X] Pareto lock: highest `biasMax` with `a/axe` lex < `T_JOINT_ABS` -> `LEX_FLANK_COMBINE_BIAS=1.5`.
  - [X] `a/axe` ~0.40 (< `T_JOINT_ABS`); `gem/gemstones` === `don/wimbledon` ~0.50 (morphology symmetry); `rusty ax` vs `axle` ~0.91 vs ~0.79.
  - [X] Canonical snapshot: [`embedding-identity-pool-v1-2026-07-09-bias-sweep.json`](../../../../../lambda/ephemera/calibration/objectMatch/snapshots/embedding-identity-pool-v1-2026-07-09-bias-sweep.json). Tuning hypothesis validated; admissibility gate **on** until FT-1.3.1.

- [X] **FT-1.3.1 Short-span admissibility retirement** **shipped 2026-07-09** (narrowed gate --- length-1 active; inadmissible length-2 retained)
  - [X] **Identity ranking unchanged** between legacy and narrowed production policy.
  - [X] **Morphology ordering invariants:** `gem/gemstones` > `a/axe`; must not tune so `gem > don` lexically (precisely symmetric pairs).
  - [X] **`gem` === `don` symmetry guardrail** on locked morphology fixtures.
  - [X] **Spurious heads below `T_JOINT_ABS`** on joint with **realistic embed** (not flat 0.2 mock); dropped legacy `expectTopLexBelow: 0.35`.
  - [X] **Diverse-catalog length-1:** narrowed policy --- top joint on `a` vs multi-token catalog stays below `T_JOINT_ABS` with weak embed (~0.34).
  - [X] **Inadmissible length-2** (`ax` vs `rusty axe`-only): lexical channel inactive under narrowed policy; joint head below `T_JOINT_ABS` with weak embed.
  - [X] **Unary shorthand OK:** `a` vs `['axe']` may score moderate lex; auto-resolve still gated by embed + FT-5 margin.
  - [X] Default `lexicalChannelPolicy` -> **`narrowed`** (not full `alwaysActive` --- `ax`/`rusty axe` lex ~0.84 fails full gate-off); [`admissibleShortSpans`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/admissibleShortSpans.ts) **narrowed** (length-1 block removed; catalog token gate for length 2..S_min-1 retained).

- [ ] **FT-1.4 Upstream junk-span discard (deferred QoL --- not Gateway-blocking; independent of FT-1.3.1 admissibility retirement)**
  - [ ] Classify / frame extract: fast-reject when normalized span is empty or below minimum length after article strip (`get a` -> `a`, etc.) -> Abstain / Unknown without pool build.
  - [ ] Align deterministic `stripLeadingArticle` with classify prompt (`a` / `an` / `the` / `some`).
  - [ ] Tests: junk span never reaches pool builder; if FT-1.3.1 retires admissibility, these tests replace (not duplicate) the old short-span gate tests.

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
| FT-0 framing + type skeleton | **Done (2026-07-09)** --- `spanResolution.ts` guards + `ParseCommandConsultResult` stub; outcome mapping documented; runtime unchanged |
| FT-1 candidate pool (embedding + lexical) | **FT-1.3.1 narrowed admissibility shipped (2026-07-09)** --- length-1 lexical active; inadmissible length-2 gate retained; default `narrowed` policy; canonical snapshot `embedding-identity-pool-v1-2026-07-09-bias-sweep.json`; production `identityStage` still v1 until FT-2 |
| FT-8 per-signal relevance normalization | **Decided + calibrated (2026-07-09)**: log map for embed; Sellers + tanh flank combine for lex; anchor constants locked in [`thresholds.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts); length-1 admissibility block retired (FT-1.3.1); inadmissible length-2 catalog gate retained |
| FT-2 identity tier + recovery | **Decided (e) (2026-07-08)**: joint `(identity, plan)` adjudicator; Bedrock-bypass answered by staged fast-path composition (enablers = separate build threads); build not started |
| FT-3 Abstain vs Consult | **Decided (2026-07-08)**: complexity LLM + frame extract retired as distinct hops; owner map (proposer = Abstain/Consult, shared validator = defer, FT-5 = auto-resolve / selection gate); no narrow-scope tier-2 LLM. Wire shape: **new `ParseCommandResult` Consult variant**, actions emits alternate proposed commands + perception assembles copy, **not resumable** this iteration. Variant types land with FT-4 |
| FT-4 span-resolution artifact shape | **Decided (2026-07-08)**; **types/guards shipped in FT-0 skeleton** ([`spanResolution.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/spanResolution.ts)); full integration in FT-4 |
| FT-5 auto-resolve / selection gate | **Decided (2026-07-08)**: two-phase deterministic tail --- (1) cross-tuple selection (legality + floor + margin -> auto-resolve or Consult), (2) per-span existence/presence guard (referential integrity, orthogonal to semantics). "commit" reserved for persist+publish; FT-5 act = auto-resolve/select. `resolveComponent` retired as a standalone primitive. Floor/margin constants calibration-owned |
| FT-6 recovery orchestration owner | **Decided (2026-07-08)**: single-pass **dedicated feature-layer orchestrator module** (propose-N + pure selector + existence/presence guard); reject inline `identityStage` + `llm/pipeline/` runner. Container-contents supplement (deferred FT-4 `withinObject`) flagged as the first **re-entrant** closed-loop consumer -> future `llm/pipeline/` plan, non-blocking |
| FT-7 classify trust posture | **Decided (2026-07-08)**: **two-level classify** --- trusted family (manipulation vs navigation vs speech vs Acme), provisional intra-manipulation hints. **Reunified manipulation-family intent type** with optional `{ subTopology?, verbClass?, confidence }` hint bundle --- **supersedes the BD-11 top-level membership-vs-relational type split** (routing role only; family + `verbClass` semantics survive). **No `enrichRoute` fork** (one shared entry -> FT-6 orchestrator = C4). Hint trust = `confidence` scalar: **`1.0` reserved closed-world sentinel** (deterministic only; LLM clamped `< 1.0`; seam fast-path on `=== 1.0`). `verbClass` required -> optional (membership-only). Family-level errors stay trusted-output terminal (Abstain; cross-family correction = future tier). Hint-confidence calibration delegated to FT-2/FT-5; future experiment (widen downstream gates to strong LLM confidence) documented, non-blocking |
| FT-4 integration + gateway | Not started |
| **Gateway exit** (unblocks Phase C) | Not started |
| Phase C Plan IR (sibling plan) | Blocked on gateway |

## Coordination notes

- **Sibling plan:** [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) --- Phase C **must not** start until **Gateway exit** here is complete.
- **FT-0 shipped (2026-07-09):** [`spanResolution.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/spanResolution.ts) defines `SpanCandidatePool`, `ObjectSpanCandidate`, `SpanResolutionOutcome` + guards; `ParseCommandConsultResult` stub in [`baseClasses.ts`](../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts) (unwired). See **FT-0 outcome mapping** in this plan.
- **FT-1.3.1 narrowed admissibility retirement (2026-07-09):** default `lexicalChannelPolicy: 'narrowed'` on [`buildSpanCandidatePool`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/buildSpanCandidatePool.ts) --- length-1 lexical **active** (calibrated combine suppresses spurious `a/axe` joint ~0.34 < `T_JOINT_ABS`); inadmissible length-2 catalog token gate **retained** (`ax`/`rusty axe` lex ~0.84 --- full `alwaysActive` rejected). Harness: [`compareAdmissibilityArms`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/testing/compareAdmissibilityArms.ts) revised criteria + realistic weak embed vectors.
- **FT-1.3.2-1.3.6 calibrated lexical combine (2026-07-09):** sequential experiments locked coverage bias, ratio-invariant adjoined + remote, `w_adjoined=3.0`, `w_remote=0.4`, `biasMax=1.5`. `a/axe` lex ~0.40 (< `T_JOINT_ABS`); `gem/gemstones` === `don/wimbledon` by morphology. Canonical snapshot [`embedding-identity-pool-v1-2026-07-09-bias-sweep.json`](../../../../../lambda/ephemera/calibration/objectMatch/snapshots/embedding-identity-pool-v1-2026-07-09-bias-sweep.json). Superseded for production policy by FT-1.3.1.
- **FT-1.3.6 biasMax sweep (2026-07-09):** `LEX_FLANK_COMBINE_BIAS=1.5`; see canonical snapshot above.
- **FT-1.3.5 flank weight sweep (2026-07-09):** locked `w_adjoined=3.0`, `w_remote=0.4`. Superseded for bias by FT-1.3.6.
- **FT-1.3.4 ratio-invariant remote (2026-07-09):** remote `x/spanScale`; equal zero-remote vacuity; `axle` vacuity bonus reduced vs `rusty ax`. Superseded by FT-1.3.5 for production constants.
- **FT-1.3.3 ratio-invariant adjoined (2026-07-09):** adjoined L/R normalized by `spanScale`; split retirement criteria documented for FT-1.3.1.
- **FT-1.3.2 short-span mitigation (2026-07-09):** coverage-derived flank bias + asymmetric adjoined positive damp shipped in production lexical combine. Gateway exit still blocked (FT-2, FT-3, FT-5).
- **FT-1.3 calibration shipped (2026-07-09):** locked FT-8/FT-1.2 constants + proposed FT-5 `T_JOINT_*` in [`thresholds.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts); pool snapshot [`embedding-identity-pool-v1-2026-07-09.json`](../../../../../lambda/ephemera/calibration/objectMatch/snapshots/embedding-identity-pool-v1-2026-07-09.json). **FT-1.3.1 narrowed admissibility shipped (2026-07-09).** Threshold ownership: v1 `T_ABS` = production shim only; FT-5 owns `T_JOINT_*` on joint relevance.
- **FT-1.1.5 lexical combine shipped (2026-07-09):** [`evidenceNumerics`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/evidenceNumerics.ts), [`relevanceCombine`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/relevanceCombine.ts) (`tanhCenteredFlankScore` production, `multiplicativeFlankScoreV1` simulator A/B); `lexicalRelevanceFromMetrics` wired to edit gate * tanh flank combine. Provisional flank-combine constants in [`thresholds.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts). Identity corpus lexical harness: [`testing/simulateLexicalIdentityCorpus`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/testing/simulateLexicalIdentityCorpus.ts) --- tanh spreads more middle-band mass on long-wrapper cases vs v1 product; ordering invariants (`ax`/`axolotl` > `ax`/`coaxial`, paraphrase/absent tails) pass.
- **FT-1.1 helpers shipped (2026-07-09):** [`embedRelevance`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/embedRelevance.ts), Sellers + [`lexicalRelevance`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/lexicalRelevance.ts) ([`lexicalMatchMetrics`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/lexicalMatchMetrics.ts)), [`admissibleShortSpans`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/admissibleShortSpans.ts) + FT-8 anchor constants in [`thresholds.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts). Token-overlap A/B baseline in [`embeddingMatch/testing/`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/testing/).
- **Commit boundary:** BD-9 atomic apply unchanged --- fault tolerance is pre-commit only **in this iteration**. Conceptually the commit boundary is the **steepest riser on a recoverability gradient** (detection flips self -> external), **not** a hard wall; a future **player-authority retcon** tier reduces but never eliminates post-commit recovery cost (see **Recoverability gradient + optimistic proposal**). Design stance: account for LLM error at any point, do not aspire to an error-free LLM. Not this initiative.
- **Seams:** BD-12 field ownership unchanged; fault tolerance does not authorize compiler **`operationKind`** invention.
- **Client:** Consulting may ship as OOC / **`PublishMessage`** first; structured reply correlation is follow-on (out of scope unless plan updated).
- **Calibration:** FT-1 + FT-8 should produce durable numbers in [`calibration/AGENT.md`](../../../../../lambda/ephemera/calibration/AGENT.md) / embedding snapshots before production threshold changes.
- **FT-8 relevance normalization (2026-07-08, lexical body updated 2026-07-09, combine shipped FT-1.1.5 2026-07-09, FT-1.3.1 2026-07-09):** per-signal **`[0,1]`** mapping decided --- embedding: two-point log (`c_min` -> 0, `1` -> 1); lexical: Sellers + edit hard gate * `tanhCenteredFlankScore` on raw flank lengths. **Combine:** FT-1.1.5 shipped edit gate * `sigmoid(bias + Σ w_i tanh((m_i - x_i)/s_i))`; multiplicative v1 retained as `multiplicativeFlankScoreV1` for simulator A/B. **FT-1.3.1 narrowed admissibility:** length-1 lexical active; inadmissible length-2 catalog token gate retained (`S_min` ~ 3). Absolute scale discipline (no within-set rescale for noMatch / auto-resolve). Anchor constants + index-shape fork calibration-owned. **Upstream junk-span fast-reject** (classify/frame, empty or `< S_min` after article strip) deferred as QoL follow-on --- not Gateway-blocking.
- **FT-2 <-> Phase C coupling (2026-07-08):** option (e) makes span grounding the deterministic **tail** of a joint semantic hop; **`resolveComponent` is retired as a standalone Plan IR primitive** (FT-5, 2026-07-08) --- the surviving per-span work is the selector verdict + existence/presence guard, not a runtime step. Flag to the sibling plan before C1 (registry drops `resolveComponent`). Registry **expressiveness** (new primitives / manner slots for intents like "just on the edge") stays **sibling-plan-owned** (Phase C/D); **out-of-registry Abstain/Consult** is FT-3 here. The closed primitive registry --- not `verbClass` or the intent enum --- is the invariant that keeps the relaxed classify frame inside the seam.
- **Classify trust posture (FT-7, 2026-07-08):** **two-level classify** --- trusted **family** commit, provisional **intra-manipulation** hints (sub-topology + `verbClass`) consumed as evidence by the joint hop (FT-2 (e)). Classify **reunifies to one manipulation-family intent type** with an optional `{ subTopology?, verbClass?, confidence }` hint bundle, which **supersedes the sibling BD-11 top-level membership-vs-relational type split** (its committed-routing role only --- the family and `verbClass`-as-membership-direction semantics survive). **No `enrichRoute` fork** --- one shared entry into the FT-6 orchestrator, which **is** the concrete content of sibling **C4**. Hint trust rides the `confidence` scalar: **`1.0` is a reserved closed-world sentinel** (deterministic producers only; probabilistic producers clamped `< 1.0`; seam fast-path fires on `=== 1.0`, never a threshold). Flag to the sibling plan (BD-11 + C4) before C1. See **FT-7 decisions so far**.
- **Closed-loop orchestration (FT-6, 2026-07-08):** gateway recovery is **single-pass** in a dedicated feature-layer orchestrator module; the linear `llm/pipeline/` runner is **not** adopted this iteration (no loop to run). The first case that *forces* a **re-entrant** loop is the **container-contents supplement** (`take X out of Y`; the deferred FT-4 `withinObject` locus, cross-plan with the sibling `in` / nesting vertical BD-2, BD-5): ground `from` -> supplement the target pool with the host's contents -> re-run. Tracked for a future `taskPlanning/lambda/ephemera/llm/pipeline/` orchestrator plan (re-entrant input shape + stall / time-budget), seeded when a concrete consumer lands --- **not** a Gateway-exit blocker. See **FT-6 decisions so far**.
