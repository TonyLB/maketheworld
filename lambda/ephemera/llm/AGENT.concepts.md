# Ephemera LLM --- concepts and vocabulary

This file records **mental models and vocabulary** for mixing **semantic-reasoning** (LLM) hops and **deterministic computation** (code) in Ephemera multi-step flows. Normative rules: [`AGENT.contract.md`](AGENT.contract.md). Transport, parsers, and pipeline runner mechanics: [`AGENT.md`](AGENT.md), [`pipeline/AGENT.md`](pipeline/AGENT.md).

Read this before adding or extending a parse, enrich, or multi-hop generation pipeline.

---

## Design seams

Ephemera pipelines split work into two complementary lanes. The **root anti-pattern** is assigning work to the wrong lane: semantic judgment in deterministic code, or authoritative computation in an LLM prompt. Common **symptoms** include phrase-bucket operator defaults, regex that infers player intent, and prompts asked to walk full graphs for legality --- but the seam violation is the misplaced *kind of work*, not any one banned technique.

| Lane | Owns | Examples |
| --- | --- | --- |
| **Semantic reasoning** (LLM) | Understanding, judgment, ambiguity resolution that cannot close over closure-trusted inputs | Player language; operator intent; narrative contradiction; interaction-complexity assessment when closed legality cannot decide |
| **Deterministic computation** (code) | Graph/catalog truth, legality when rules close, validation, aggregation, context packaging | Membership pre-gates; catalog resolve; `normalizeRelationSpan`; Coyote combine/cluster before plan-select |

Semantic reasoning **includes** player-intent parsing but is **not limited to it**. Assessing whether a proposed `positionGraph` change is narratively contradictory, or whether existing relational topology requires interaction reasoning (BD-10 defer), belongs in the semantic-reasoning lane when deterministic rules cannot close the case.

---

## Closure-trusted inputs

A **closure-trusted input** has all the information a deterministic stage needs to **decide without Bedrock** (semantic conclusion on positive match, or a state-derived negative when the world is closed).

Deterministic code may close only over **closure-trusted inputs**:

| Category | Examples |
| --- | --- |
| Graph / catalog state | Membership pre-gates (`ROOM#` vs actor `CHARACTER#` host); exact-name catalog resolve; node-on-graph checks |
| Frozen syntactic templates | Classify skip for `take` / `drop` / `get` + noun (natural language matched against a closed grammar) |
| Normalization of LLM-extracted spans | `relationSpan` -> `relationKind` enum or `Custom` (B2) |

**Not closure-trusted for semantic inference in code:** unbounded paraphrase, phrase-bucket defaults, or "absence of keyword implies operator X." Player command text is always **feedstock for semantic-reasoning hops**; it becomes closure-trusted only via the categories above (e.g. frozen template positive match), not because the client sent it.

### Not the same as other "trusted" in Ephemera

| Term | Meaning |
| --- | --- |
| **Closure-trusted input** (this doc) | Deterministic stage may **close** without Bedrock |
| **Trusted ingress / trusted ids** ([`positions/AGENT.contract.md`](../dataSource/positions/AGENT.contract.md), actions) | Server-validated `EphemeraId` or assessed outcome post-parse; positions may apply without re-grounding |
| **Validated handoff** (e.g. Coyote `narrowHandoff`, `interpretFrameExtract`) | Parser-narrowed JSON safe to **pass forward** to the next hop (often an LLM prompt). Validated *structure* and allowed fields --- not permission for a downstream stage to invent semantics the owning hop omitted |

Validated handoff **to** an LLM and closure-trusted input **for** deterministic code answer different questions; both are normal in the same pipeline.

---

## Field ownership

Every semantic field has **one owning stage** --- the stage authoritative for that field's meaning. Downstream stages validate, transform, or apply legality; they do not invent upstream semantics.

**Vacuum test:** If a field is forbidden at stage N, stage N+1 (or the next committed semantic-reasoning hop that sees the command) **must** emit it. Do not fill the gap with regex or phrase buckets in the compiler.

### Fast paths are not a second owner

A deterministic short-circuit **at the owning stage** is allowed when closure-trusted inputs suffice. It must emit the **same artifact shape** and pass the **same guards** as the semantic-reasoning path would.

- **OK:** `get bag` in [`discriminateIntent/deterministicChecks.ts`](../dataSource/actions/discriminateIntent/deterministicChecks.ts) --- classify still owns `verbClass` / `objectSpans`; Bedrock is skipped because `get`/`take`/`drop` + noun is a closed template (with label gate for `get` vs AcmeOrder).
- **Violation:** enrich/compiler inventing `operationKind` from phrase buckets because frame extract forbade it --- no owner, wrong stage.

---

## Fast-path positive vs negative closure

Semantic fast paths may prove **positive** results on match:

> `get bag` matches the closed template, therefore `ObjectMembershipIntent` + `verbClass: acquire` + `objectSpans: ['bag']`.

They **must not** prove **negative** results from non-match:

> `relationSpan` lacks dissolve phrases, therefore `establishRelation`.

Non-match means **fall through** (unknown) to semantic reasoning --- not a default to the opposite conclusion. Phrase-bucket defaults are the classic negative-closure bug.

**Exception:** Deterministic computation over a **closed authoritative world** (full graph snapshot, complete catalog row, legality table) **may** assert negatives because the negation is state-derived, not inferred from absent natural language --- e.g. `dissolveRelation` with no matching edge on the host graph (`noMatchingRelationalEdge`).

| Negation type | When OK |
| --- | --- |
| Language absence | Essentially never for semantic conclusions |
| State absence | World is authoritative and complete for the check |
| Policy / structure | Rule is closed, not paraphrase-dependent |

---

## Context packaging (hybrid hops)

When semantic reasoning needs structured world data, a **deterministic pre-filter** scopes and packages the **bare minimum** context the LLM needs to judge --- it does not perform the judgment.

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

Minimize Bedrock hops **after** seam placement is correct. Budget is an **outcome** of good design, not the design driver. Smaller scoped context from good pre-filters is a valid win.

---

## Document hops by purpose

Each stage documents **what kind of work** it does (Coyote pattern), not only module names. Hybrid hops document both the deterministic slice and the semantic question.

---

## Worked exemplars

Short pointers --- feature docs hold instance detail.

| Exemplar | What it teaches |
| --- | --- |
| **Coyote hypothesis** ([`hypothesis/AGENT.md`](../dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md)) | Multi-hop semantic reasoning; **deterministic context packaging** (combine/cluster/render before plan-select); handoff contracts (`selectedCandidate` required before narrative beat) |
| **Membership parse** ([`actions/AGENT.implementation.md`](../dataSource/actions/AGENT.implementation.md)) | `verbClass` (language at classify) vs `operationKind` (graph truth at enrich pre-gates); agreement gate; legitimate zero-hop paths |
| **Relational parse** ([`enrich/AGENT.md`](../dataSource/actions/enrich/AGENT.md)) | Frame extract owns `operationKind` (BD-12); compiler validates and applies legality only |
| **Acme order** ([`actions/AGENT.implementation.md`](../dataSource/actions/AGENT.implementation.md)) | LLM proposes `stableKey`; deterministic finalize guarantees uniqueness before publish |

**Canonical incident (relational):** phrase-bucket `operationKind` inference --- negative closure from absent dissolve phrases defaulting to `establishRelation`. See [`AGENT.contract.md`](AGENT.contract.md).

**Forward hybrid:** deterministic incident-edge slice + proposed patch -> LLM narrative-contradiction or BD-10 interaction judgment when closed legality cannot decide.

---

## Navigation

- Normative rules: [`AGENT.contract.md`](AGENT.contract.md)
- Transport and parsers: [`AGENT.md`](AGENT.md)
- Pipeline runner: [`pipeline/AGENT.md`](pipeline/AGENT.md)
- Actions parse instances: [`../dataSource/actions/AGENT.implementation.md`](../dataSource/actions/AGENT.implementation.md)
