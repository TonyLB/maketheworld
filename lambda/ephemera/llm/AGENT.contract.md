# Ephemera LLM --- contracts

This file records **normative rules** for Ephemera LLM + code pipelines. Mental models (two design axes): [`AGENT.concepts.md`](AGENT.concepts.md). Transport and runner: [`AGENT.md`](AGENT.md), [`pipeline/AGENT.md`](pipeline/AGENT.md).

---

## Seam placement

- Deterministic stages **must not** approximate semantic reasoning (player language, operator direction, narrative judgment, or other open-ended understanding) via phrase lists, prefix stripping, command regex, or similar heuristics when that work belongs in a semantic-reasoning stage.
- Deterministic stages **must** own authoritative computation they can close reliably: graph walks, legality tables, idempotency checks, catalog resolve, multi-record aggregation, and **context packaging** (scoping/slicing structured data for downstream hops).
- Semantic-reasoning hops **must not** be asked to perform exhaustive authoritative computation (full-graph legality, catalog uniqueness guarantees, unbounded aggregation). When structured context is required, a preceding deterministic stage **must** supply a **minimal scoped slice** sufficient for the judgment --- not the raw world.
- Hybrid hops (deterministic slice + LLM judgment) **must** document both the packaged context shape and the semantic question; neither lane owns the whole task alone.
- Fault-tolerant output trust **must not** be used to justify seam violations (computation in prompts, semantics in compilers).

---

## Field ownership

- Every semantic field in a multi-hop product **must** have a documented **owning stage** (semantic job assignment) before merge.
- Forbidden fields at stage N require an explicit owner at stage N+1 or coarse classify direction --- **not** compiler invention. This rule applies in **both** trusted-output and fault-tolerant modes.
- In fault-tolerant mode, downstream stages **must not invent** semantics the owner omitted (vacuum-fill). Recovery **must** use documented patterns in **Fault recovery** below --- not ad hoc compiler semantics.
- A deterministic **fast path** at the owning stage **may** synthesize that stage's fields without Bedrock when **closed-world inputs** suffice (see [`AGENT.concepts.md`](AGENT.concepts.md)); it **must** be the same owner and the same **trust-mode artifact contract** as the semantic-reasoning path (not a shortcut around ownership).

---

## Fast-path closure

- Semantic fast paths **must** use **positive closure** only: a pattern match may assert a conclusion; non-match **must** fall through (unknown), not default to the opposite semantic conclusion. Phrase-bucket "else establish" patterns are **forbidden**.
- Deterministic computation **may** assert state-derived negatives when the authoritative world is closed (e.g. no matching relational edge on a complete host graph snapshot).

---

## Output trust

- Each pipeline or hop **should** document its **trust posture** (trusted-output vs fault-tolerant) and handoff artifact shape in feature `AGENT.md` when it differs from the pipeline default. See [`AGENT.concepts.md`](AGENT.concepts.md) (**Output trust models**, **Fault recovery patterns**, **How the axes compose**).
- **Trusted-output (default for shipped parse/enrich):** downstream **may** treat documented owner emissions as **settled** for that field until a later explicit recovery hop is defined. Uncertainty **must** abstain, defer, or terminalize Error --- not pass silent best guesses.
- **Fault-tolerant:** upstream **must** document provisional handoffs (confidence, alternatives where applicable); downstream **must** implement documented **fault recovery** (correct, backtrack, and/or supplement) before commit boundaries. Downstream **must not** assume upstream is final without that contract.
- **Commit boundaries** (positions ingress, atomic graph apply, trusted-id bus payloads) **must** receive trusted-output regardless of provisional hops earlier in the pipeline.
- Mixing trust models within one pipeline **must** document each hop handoff explicitly.

---

## Fault recovery

Fault-tolerant pipelines **should** declare which recovery patterns apply per hop. See [`AGENT.concepts.md`](AGENT.concepts.md) (**Fault recovery patterns**).

- **Correct:** a downstream stage or dedicated validator **may replace** an owner's **provisional** output when performing the **same semantic job** with context already in hand. **Must not** emit fields the owner never attempted (vacuum-fill).
- **Backtrack:** on validation failure, omission, or documented weak output, control **must** return to the **owning stage** (not an arbitrary earlier hop) with a documented correction signal. Re-runs **must** preserve field ownership.
- **Supplement:** orchestration **may** fetch additional **closed-world facts** (cache, gateway, expanded catalog slice, read-only tool/query) when context was under-specified. Supplement **must not** assert semantic conclusions --- only authoritative facts for use by correct or backtrack.
- **Omissions** of required semantic fields **must** backtrack to the documented owner --- **must not** be filled by downstream correct/invention (BD-12).
- Recovery loops **must** terminate in trusted-output before commit boundaries (see **Output trust**).
- Feature docs **should** document pattern choice per failure kind (fault vs omission vs under-specified context) when non-obvious.

---

## Deterministic enrich boundary (BD-12)

Post-classify deterministic code may close only over **closed-world inputs** (see [`AGENT.concepts.md`](AGENT.concepts.md)):

| Allowed | Examples |
| --- | --- |
| Graph / catalog state | Membership pre-gates (`ROOM#` vs actor `CHARACTER#` host); catalog exact-name resolve; node-on-graph checks |
| Frozen syntactic templates | Classify skip for `take` / `drop` / `get` + noun |
| Normalization of LLM-extracted spans | `relationSpan` -> `relationKind` enum or `Custom` |

**Forbidden:** inferring open-ended semantic operator or intent direction from natural-language phrase lists when that field is owned by a semantic-reasoning stage. If classify and earlier enrich hops forbid a semantic field, the **next committed LLM hop that sees the command** must emit it (frame extract for relational `operationKind`). Do not fill the gap with regex.

**Canonical incident:** relational `operationKind` phrase-bucket inference (BD-12). Resolution: frame extract emits `establishRelation` | `dissolveRelation`; compiler validates and applies legality only. See [`AGENT.concepts.md`](AGENT.concepts.md) (**Field ownership**, **Fast-path positive vs negative closure**).

---

## Documentation

- New or extended pipelines **should** document each hop's **seam** (semantic reasoning vs deterministic computation, field ownership, hybrid packaging) and **trust posture** (handoff shape, fault recovery patterns, commit boundary) in feature `AGENT.md` (ad hoc pipelines) or hop-level docs (Coyote-style).

---

## Navigation

- Concepts and vocabulary: [`AGENT.concepts.md`](AGENT.concepts.md)
- Actions parse steady-state (instances): [`../dataSource/actions/AGENT.implementation.md`](../dataSource/actions/AGENT.implementation.md)
- Object manipulation hop purposes: [`../dataSource/actions/enrich/objectManipulation/AGENT.md`](../dataSource/actions/enrich/objectManipulation/AGENT.md)
