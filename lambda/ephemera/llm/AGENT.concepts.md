# Ephemera LLM --- concepts and vocabulary

This file records **mental models and vocabulary** for Ephemera multi-step LLM + code pipelines. Normative rules: [`AGENT.contract.md`](AGENT.contract.md). Transport, parsers, and pipeline runner mechanics: [`AGENT.md`](AGENT.md), [`pipeline/AGENT.md`](pipeline/AGENT.md).

Read this before adding or extending a parse, enrich, or multi-hop generation pipeline.

---

## Two independent design axes

Ephemera pipeline design asks **two orthogonal questions**. Answer seam placement first; then choose output trust per hop and at commit boundaries.

| Axis | Question | Doc home (this file) |
| --- | --- | --- |
| **Design seams** | What **kind of work** belongs in semantic reasoning (LLM) vs deterministic computation (code)? | [Design seams](#design-seams) through [Context packaging](#context-packaging-hybrid-hops) |
| **Output trust** | When a hop finishes, is its output **provisional** (correctable) or **commit-worthy** (downstream may treat it as final)? | [Output trust models](#output-trust-models), [Fault recovery patterns](#fault-recovery-patterns-trust-axis) |

You can violate either axis independently:

- **Wrong seam, any trust model:** phrase-bucket `operationKind` in the compiler --- computation lane doing semantic work (BD-12 canonical incident).
- **Right seam, trusted-output:** identity LLM picks one `objectId`; a wrong pick is costly because downstream treats it as final.
- **Right seam, fault-tolerant:** embedding ranks candidates; identity LLM adjudicates; a validation hop may correct --- same semantic job, different commit posture.

**Fault tolerance does not relax seam rules.** "We will correct later" is not permission to walk full graphs in a prompt or infer player intent from regex in the compiler.

**Commit boundaries** (world mutation, bus streams with trusted ids, atomic apply) still require trusted-output at the point of persist --- fault tolerance lives in parse/enrich and presentation; see [Commit boundaries](#commit-boundaries-trust-axis-constraint).

---

## Design seams

Ephemera pipelines split work into two complementary lanes. The **root anti-pattern** is assigning work to the wrong lane: semantic judgment in deterministic code, or authoritative computation in an LLM prompt. Common **symptoms** include phrase-bucket operator defaults, regex that infers player intent, and prompts asked to walk full graphs for legality --- but the seam violation is the misplaced *kind of work*, not any one banned technique.

| Lane | Owns | Examples |
| --- | --- | --- |
| **Semantic reasoning** (LLM) | Understanding, judgment, ambiguity resolution that cannot close over closed-world inputs | Player language; operator intent; narrative contradiction; interaction-complexity assessment when closed legality cannot decide |
| **Deterministic computation** (code) | Graph/catalog truth, legality when rules close, validation, aggregation, context packaging | Membership pre-gates; catalog resolve; `normalizeRelationSpan`; Coyote combine/cluster before plan-select |

Semantic reasoning **includes** player-intent parsing but is **not limited to it**. Assessing whether a proposed `positionGraph` change is narratively contradictory, or whether existing relational topology requires interaction reasoning (BD-10 defer), belongs in the semantic-reasoning lane when deterministic rules cannot close the case.

---

## Closed-world inputs

A **closed-world input** (historically **closure-trusted input** in older docs and code comments) has all the information a deterministic stage needs to **decide without Bedrock** --- semantic conclusion on positive match, or a state-derived negative when the world is closed for that check.

**Not closed-loop:** **closed-world** (seam) means inputs are complete enough for deterministic closure. **Closed-loop** (trust) means provisional upstream output plus downstream recovery --- see [Fault recovery patterns](#fault-recovery-patterns-trust-axis). Do not conflate the two.

Deterministic code may close only over **closed-world inputs**:

| Category | Examples |
| --- | --- |
| Graph / catalog state | Membership pre-gates (`ROOM#` vs actor `CHARACTER#` host); exact-name catalog resolve; node-on-graph checks |
| Frozen syntactic templates | Classify skip for `take` / `drop` / `get` + noun (natural language matched against a closed grammar) |
| Normalization of LLM-extracted spans | `relationSpan` -> `relationKind` enum or `Custom` (B2) |

**Not closed-world for semantic inference in code:** unbounded paraphrase, phrase-bucket defaults, or "absence of keyword implies operator X." Player command text is always **feedstock for semantic-reasoning hops**; it becomes closed-world only via the categories above (e.g. frozen template positive match), not because the client sent it.

### Not the same as other "trusted" in Ephemera

| Term | Axis | Meaning |
| --- | --- | --- |
| **Closed-world input** (this doc) | Seam | Deterministic stage may **close** without Bedrock |
| **Output trust / commit posture** (this doc) | Trust | Whether a hop's emission is **provisional** or **commit-worthy** for downstream |
| **Trusted ingress / trusted ids** ([`positions/AGENT.contract.md`](../dataSource/positions/AGENT.contract.md), actions) | System boundary | Server-validated `EphemeraId` or assessed outcome post-parse; positions may apply without re-grounding |
| **Validated handoff** (e.g. Coyote `narrowHandoff`, `interpretParse`) | Seam (+ structure) | Parser-narrowed JSON safe to **pass forward** to the next hop. Validated *structure* and allowed fields --- not permission for a downstream stage to invent semantics the owning hop omitted, and **not** the same as commit-worthy output |

Validated handoff **to** an LLM and closed-world input **for** deterministic code answer different questions; both are normal in the same pipeline.

---

## Field ownership (semantic job assignment)

Every semantic field has **one owning stage** --- the stage that performs the **semantic job** for that field's meaning. This is a **seam** rule: who may conclude `verbClass`, relational `operationKind`, referential grounding, etc.

Downstream stages **must not invent** upstream semantics (no phrase-bucket fill-in). They **may**:

- **Trusted-output mode:** validate, transform, apply legality, and treat the owner's emission as **settled** for that field.
- **Fault-tolerant mode:** use documented **fault recovery** patterns (correct, backtrack, supplement) --- see [Fault recovery patterns](#fault-recovery-patterns-trust-axis) --- still without **vacuum-filling** fields the owner was supposed to emit.

**Vacuum test (seam):** If a field is forbidden at stage N, stage N+1 (or the next semantic-reasoning hop that sees the command) **must** emit it. Do not fill the gap with regex or phrase buckets in the compiler.

**Correction vs invention:** A downstream validation hop that rejects or replaces an identity pick is **correction** of the owning stage's job. A **downstream** stage (e.g. the compiler) inferring `operationKind` from phrase-buckets --- rather than receiving it from its owning stage --- is **invention**, forbidden in both trust modes. (Deterministic conclusion *at the owning stage* from a closed-world input is not invention --- see the fast-path examples below.) **Omissions** generally require **backtrack** to the owner, not downstream correction.

### Fast paths are not a second owner

A deterministic short-circuit **at the owning stage** is allowed when closed-world inputs suffice. It must be the **same owner** skipping Bedrock, not a downstream stage claiming the field.

- **Trusted-output:** fast path emits the **same commit artifact** and passes the **same terminal guards** as the semantic-reasoning path would (e.g. one `objectId` or resolve Error).
- **Fault-tolerant:** fast path emits the **same provisional artifact shape** the owner uses in that mode (e.g. ranked shortlist + confidence, or high-confidence single pick with validation still allowed). Exact shapes are feature-owned; document them per hop.

- **OK (membership):** `get bag` in [`discriminateIntent/deterministicChecks.ts`](../dataSource/actions/discriminateIntent/deterministicChecks.ts) --- classify still owns `verbClass` / `objectSpans`; Bedrock is skipped because `get`/`take`/`drop` + noun is a closed template (with label gate for `get` vs AcmeOrder).
- **OK (relational):** relational `operationKind` in [`plan/matchRelationalTemplate.ts`](../dataSource/actions/enrich/objectManipulation/plan/matchRelationalTemplate.ts) --- the **Plan** stage owns it and concludes `establishRelation` / `dissolveRelation` from a closed verb set (positive-match-required, abstain on miss). Same shape as the membership fast path: the owning stage skipping Bedrock on a frozen-template match, not a downstream stage claiming the field. BD-19's plan-only / joint LLM fallback (iteration 2) will be Plan's *other* realization for template misses --- same owner, not a new one.
- **Violation:** the compiler inventing `operationKind` from phrase-buckets to fill a gap Plan left --- no owner, wrong stage. (The distinction from the relational OK case: closed enumerated set + positive-match-required + abstain-on-miss, at the owning stage --- not "unrecognized verb defaults to establish" in a downstream compiler.)

---

## Fast-path positive vs negative closure

**Seam rule:** semantic fast paths in deterministic code may prove **positive** results on match:

> `get bag` matches the closed template, therefore `ObjectMembershipIntent` + `verbClass: acquire` + `objectSpans: ['bag']`.

They **must not** prove **negative** results from non-match:

> `relationSpan` lacks dissolve phrases, therefore `establishRelation`.

Non-match means **fall through** (unknown) to semantic reasoning --- not a default to the opposite conclusion. Phrase-bucket defaults are the classic negative-closure bug.

**Trust axis (handoff on uncertainty):** After fall-through, trusted-output typically reaches the next semantic hop or abstains/Errors. Fault-tolerant may instead emit **low-confidence provisional** output from the owning stage --- but still **never** the opposite semantic conclusion from language absence.

**Exception (seam):** Deterministic computation over a **closed authoritative world** (full graph snapshot, complete catalog row, legality table) **may** assert negatives because the negation is state-derived, not inferred from absent natural language --- e.g. `dissolveRelation` with no matching edge on the host graph (`noMatchingRelationalEdge`).

| Negation type | When OK |
| --- | --- |
| Language absence | Essentially never for semantic conclusions |
| State absence | World is authoritative and complete for the check |
| Policy / structure | Rule is closed, not paraphrase-dependent |

---

## Context packaging (hybrid hops)

When semantic reasoning needs structured world data, a **deterministic pre-filter** scopes and packages the **bare minimum** context the LLM needs to judge --- it does not perform the judgment. **Same in both trust modes.**

**Supplement** (fault recovery) may fetch **additional** closed-world facts when the first packaging pass was too thin --- see [Fault recovery patterns](#fault-recovery-patterns-trust-axis). Supplement adds facts; it does not perform the semantic judgment.

| Stage | Owns |
| --- | --- |
| Deterministic pre-filter | Query, slice, aggregate, dedupe, authoritative facts |
| Semantic-reasoning hop | The conclusion over that slice |

This avoids vacuums where a task is "too graph-shaped for pure semantics" yet "too judgment-shaped for closed legality."

**Forward example:** incident relational edges on subject/target + proposed patch (deterministic) -> "is this narratively contradictory?" (LLM).

**Contrasts:**

- Dumping the full host graph into the prompt for exhaustive legality --- computation in the LLM lane.
- Phrase-bucket defaults when legality cannot decide --- semantics in the computation lane.

---

## Bedrock budget

Minimize Bedrock hops **after** seam placement is correct. Budget is an **outcome** of good design, not the design driver. Smaller scoped context from good pre-filters is a valid win. Fault-tolerant **recovery loops** (correct, backtrack, supplement) may add hops **after** seams are correct --- budget them explicitly per feature.

---

## Document hops by purpose

Each stage documents **what kind of work** it does (Coyote pattern), not only module names. Hybrid hops document both the deterministic slice and the semantic question. Also document **trust posture** and any **fault recovery** patterns when they differ from the pipeline default (see [How the axes compose](#how-the-axes-compose)).

---

## Output trust models

**Output trust** is independent of design seams. It describes how downstream hops and commit boundaries treat upstream results.

### Trusted-output (open-loop commit)

**Posture:** Each hop should be **right before downstream continues**. Uncertainty **abstains**, **defers**, or **terminalizes Error** rather than passing a best guess downstream will treat as final.

| Trait | Typical pattern |
| --- | --- |
| Handoff | Single resolved value or explicit failure |
| Downstream | May assume upstream semantic fields are **settled** |
| False positives | Costly --- gates and thresholds tuned to avoid them |
| Calibration | Absolute floors and margin gates for auto-resolve |

**Default today** for object-manipulation parse (terminal `ParseCommandResult`, trusted ids on bus streams) and most Coyote hypothesis handoffs.

### Fault-tolerant (closed-loop provisional)

**Posture:** Upstream emits **best guess + confidence** (and often **alternatives**). Downstream is equipped to **confirm, correct, or retry** --- never assuming upstream is final until a documented commit point.

| Trait | Typical pattern |
| --- | --- |
| Handoff | Ranked candidates, confidence signals, optional reasoning |
| Downstream | Validation hop, identity adjudication, retry with broader context |
| False positives | Survivable before commit; correction is expected |
| Calibration | Same metrics may support **reranking** rather than terminal auto-resolve |

**Target direction** for object identity (embedding as recommender + LLM adjudication + validation): [`embeddingMatch/AGENT.md`](../dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md). Not yet the default for the full manipulation pipeline.

### Fault recovery patterns (trust axis)

Fault-tolerant pipelines **should** document which recovery patterns apply per hop. Three patterns cooperate; a pipeline may use one or chain them before the commit boundary.

| Pattern | Who acts | Typical trigger |
| --- | --- | --- |
| **Correct** | Downstream stage or dedicated validator | Wrong provisional conclusion; enough context already in hand |
| **Backtrack** | **Re-run the owning stage** | Validation failure, weak owner output, or **omission** of a required field |
| **Supplement** | Orchestration step or tool/query surface | **Under-specified context** --- missing closed-world facts, not necessarily a wrong guess |

All three **must** preserve **field ownership** and **forbid vacuum-fill** (invention). Supplement adds **authoritative facts** only; **correct** and **backtrack** handle semantic conclusions.

#### Correct

Downstream (or a dedicated validation hop) **replaces** the owner's provisional output when it can conclude the same semantic job with the context already available.

- **Example (deferred):** post-identity validation LLM --- judge span + command vs grounded `objectId` using catalog already in the prompt.
- **Not correct:** the compiler inferring `operationKind` from phrase-buckets to fill a gap Plan left --- that is **invention**, not correction of a provisional pick.

#### Backtrack

Control returns to the **owning stage** with a **correction signal** (validation failure reason, omitted field name, low-confidence flag). The owner re-runs --- often with broader prompt context or abstain-capable instructions.

- **Example (deferred):** identification retry loop --- identity LLM re-invoked when embedding fast path won but validation failed; wider catalog context on retry.
- **Omissions:** when the owner never emitted a required field, **backtrack** to that owner --- do not let a downstream stage vacuum-fill.

#### Supplement

Fetch additional **closed-world facts** before correct or backtrack when failure is **thin context**, not necessarily a wrong judgment. Usually deterministic (cache/gateway reads, expanded catalog slice, graph incident edges). May use LLM **tool-use** when the query surface is documented and read-only.

- **Example (shipped):** parse ingress attaches embeddings and merged catalogs before identity runs --- proactive supplement at packaging time.
- **Example (deferred):** on validation failure, load enriched catalog text or held-inventory detail not in the first packaging pass, then backtrack to identity LLM.

#### Failure kinds vs pattern choice

| Failure kind | Prefer | Why |
| --- | --- | --- |
| **Fault** (wrong provisional conclusion) | Correct, or backtrack with validation reason | Downstream may know the answer, or owner should retry |
| **Omission** (owner did not emit required field) | Backtrack to owner | Downstream "correct" is usually invention |
| **Under-specified context** | Supplement first | Correct/backtrack need fuller closed-world inputs |

#### Typical cooperation (identity)

```text
owner emits provisional pick (+ confidence / shortlist)
  -> supplement (fetch missing catalog / graph facts if needed)
  -> correct (validator confirms or replaces pick)
  -> OR backtrack (re-run owner with supplement + failure reason)
  -> commit boundary (trusted-output only)
```

Normative rules: [`AGENT.contract.md`](AGENT.contract.md) (**Fault recovery**).

### Survivable wrongness (presentation vs manipulation truth)

Fault tolerance extends beyond parse/enrich into **what kind of wrong is allowed to exist**:

- **Manipulation truth** (graph, membership, relational edges) --- wrongness is costly; correction or atomic rollback before persist (BD-9).
- **Presentation / generation** --- detail may be **elaborated** without retroactively becoming manipulation truth until asserted. Vocabulary: [`diegeticLogic/AGENT.unknowns.concepts.md`](../diegeticLogic/AGENT.unknowns.concepts.md) (**Assert**, **Elaborate**, **Unknown**).

**Player feedback / retroactive revision** (non-blame correction of system response) is a **future trust-axis concern** at the product layer --- not yet specified in pipeline contracts. It composes with fault-tolerant parse and diegetic unknowns; it does not relax seam ownership.

### Commit boundaries (trust-axis constraint)

Regardless of provisional hops earlier in a pipeline, **world mutation** requires trusted-output at the persist boundary:

- Positions apply expects **trusted ids** on ingress ([`positions/AGENT.contract.md`](../dataSource/positions/AGENT.contract.md)).
- Multi-step manipulation plans use **atomic all-or-nothing** apply (BD-9) --- no partial graph commit with "maybe" ids.

Fault-tolerant design **front-loads** correction before the bus/`transactWrite` boundary; it does not eliminate the need for a single winner at commit time (you cannot half-`takeHold`).

---

## How the axes compose

Feature docs **should declare both** for each pipeline or hop:

1. **Seam:** lane (semantic vs deterministic vs hybrid), field ownership, closed-world inputs used.
2. **Trust:** trusted-output vs fault-tolerant, handoff artifact shape, fault recovery patterns (correct / backtrack / supplement), commit boundary.

### Same seam, different trust (reference table)

| Hop | Seam (unchanged) | Trusted-output (shipped) | Fault-tolerant (target / partial) |
| --- | --- | --- | --- |
| Classify | LLM chooses intent topology | Wrong intent -> wrong branch or terminal Error | Correctable via later validation or player feedback (future) |
| Identity grounding | Hybrid: exact resolve, embed rank, LLM adjudication | One `objectId` or Error | Shortlist + confidence; validation/retry ([`embeddingMatch/AGENT.md`](../dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md)) |
| Plan (relational) | Plan owns relational `operationKind`; deterministic closed-verb template (`matchRelationalTemplate`), LLM fallback for misses (BD-19, future) | Compiler trusts Plan's determination; legality Error on conflict | Template miss -> abstain today; plan-only/joint LLM fallback the second realization (iteration 2) |
| Legality check | Code owns graph truth | Hard Error | Defer, surface uncertainty, or apply only after trusted compile |
| Context packaging | Code packages catalog slice | Same | Same |

### Choosing a trust model

| Favor trusted-output when | Favor fault-tolerant when |
| --- | --- |
| Downstream cost of false positive is high | Correction hops are cheaper than abstain/Error UX |
| Commit boundary is immediate after the hop | Rich calibration supports rerank + adjudication |
| Product expects single correlated parse response | Output can remain provisional through multiple hops |
| Legality or graph apply consumes the result | Presentation or narrative can absorb interim wrongness |

A pipeline may **mix** trust models per hop (e.g. trusted-output classify + fault-tolerant identity) --- document the handoff explicitly.

---

## Worked exemplars

Short pointers --- feature docs hold instance detail. Each notes **seam** and **trust** where both matter.

| Exemplar | Seam | Trust |
| --- | --- | --- |
| **Coyote hypothesis** ([`hypothesis/AGENT.md`](../dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md)) | Multi-hop semantic reasoning; deterministic context packaging; handoff contracts | Mostly trusted-output between hops (`selectedCandidate` required before narrative beat) |
| **Object manipulation** ([`actions/enrich/objectManipulation/AGENT.md`](../dataSource/actions/enrich/objectManipulation/AGENT.md)) | Classify-through-enrich hop purposes; field ownership; BD-12 | **Fault-tolerant** enrich identity/selection (pools + FT-5 selector); **trusted-output** at terminal parse / positions commit; Consult/Abstain as first-class outcomes ([`embeddingMatch/AGENT.md`](../dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md)) |
| **Membership parse** ([`actions/AGENT.implementation.md`](../dataSource/actions/AGENT.implementation.md)) | Field tables, egress playbooks | Fault-tolerant selection; trusted-output at terminal parse / positions ingress (or terminal Consult/Abstain) |
| **Relational parse** ([`actions/enrich/objectManipulation/AGENT.md`](../dataSource/actions/enrich/objectManipulation/AGENT.md)) | Native Parse-skeleton pipeline (Parse -> Plan match -> Identify -> Grounding -> Validation), frame-extract chain retired | Fault-tolerant subject/target selection; BD-10 defer -> Error stub until plan LLM fallback |
| **Acme order** ([`actions/AGENT.implementation.md`](../dataSource/actions/AGENT.implementation.md)) | LLM proposes `stableKey`; deterministic finalize | Trusted-output at publish (deterministic uniqueness guarantee) |

**Canonical seam incident (relational):** phrase-bucket `operationKind` inference --- negative closure from absent dissolve phrases defaulting to `establishRelation`. See [`AGENT.contract.md`](AGENT.contract.md).

**Canonical trust contrast (identity):** v1 embedding terminal `Resolved` (retired from production) vs v2 closed-loop pool recommender + FT-5 selector --- same calibration, different success criterion; recovery maps to **correct** / **backtrack** / **supplement** in [`AGENT.concepts.md`](AGENT.concepts.md) (**Fault recovery patterns**). Instance detail: [`embeddingMatch/AGENT.md`](../dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md) (**Open-loop terminal resolve vs closed-loop recommender**).

**Forward hybrid (seam):** deterministic incident-edge slice + proposed patch -> LLM narrative-contradiction or BD-10 interaction judgment when closed legality cannot decide.

---

## Navigation

- Normative rules: [`AGENT.contract.md`](AGENT.contract.md)
- Transport and parsers: [`AGENT.md`](AGENT.md)
- Pipeline runner: [`pipeline/AGENT.md`](pipeline/AGENT.md)
- Actions parse instances: [`../dataSource/actions/AGENT.implementation.md`](../dataSource/actions/AGENT.implementation.md)
- Object manipulation hop purposes: [`../dataSource/actions/enrich/objectManipulation/AGENT.md`](../dataSource/actions/enrich/objectManipulation/AGENT.md)
- Diegetic unknowns / survivable wrongness: [`../diegeticLogic/AGENT.unknowns.concepts.md`](../diegeticLogic/AGENT.unknowns.concepts.md)
