# Ephemera LLM --- contracts

This file records **normative rules** for mixing semantic-reasoning (LLM) and deterministic computation in Ephemera pipelines. Mental models: [`AGENT.concepts.md`](AGENT.concepts.md). Transport and runner: [`AGENT.md`](AGENT.md), [`pipeline/AGENT.md`](pipeline/AGENT.md).

---

## Seam placement

- Deterministic stages **must not** approximate semantic reasoning (player language, operator direction, narrative judgment, or other open-ended understanding) via phrase lists, prefix stripping, command regex, or similar heuristics when that work belongs in a semantic-reasoning stage.
- Deterministic stages **must** own authoritative computation they can close reliably: graph walks, legality tables, idempotency checks, catalog resolve, multi-record aggregation, and **context packaging** (scoping/slicing structured data for downstream hops).
- Semantic-reasoning hops **must not** be asked to perform exhaustive authoritative computation (full-graph legality, catalog uniqueness guarantees, unbounded aggregation). When structured context is required, a preceding deterministic stage **must** supply a **minimal scoped slice** sufficient for the judgment --- not the raw world.
- Hybrid hops (deterministic slice + LLM judgment) **must** document both the packaged context shape and the semantic question; neither lane owns the whole task alone.

---

## Field ownership

- Every semantic field in a multi-hop product **must** have a documented owning stage before merge.
- Forbidden fields at stage N require an explicit owner at stage N+1 or coarse classify direction --- **not** compiler invention.
- A deterministic **fast path** at the owning stage **may** synthesize that stage's fields without Bedrock when closure-trusted inputs suffice; it **must** produce the same typed outcome and guards as the semantic-reasoning path (not a shortcut around ownership).

---

## Fast-path closure

- Semantic fast paths **must** use **positive closure** only: a pattern match may assert a conclusion; non-match **must** fall through (unknown), not default to the opposite semantic conclusion. Phrase-bucket "else establish" patterns are **forbidden**.
- Deterministic computation **may** assert state-derived negatives when the authoritative world is closed (e.g. no matching relational edge on a complete host graph snapshot).

---

## Deterministic enrich boundary (BD-12)

Post-classify deterministic code may close only over **closure-trusted inputs** (see [`AGENT.concepts.md`](AGENT.concepts.md)):

| Allowed | Examples |
| --- | --- |
| Graph / catalog state | Membership pre-gates (`ROOM#` vs actor `CHARACTER#` host); catalog exact-name resolve; node-on-graph checks |
| Frozen syntactic templates | Classify skip for `take` / `drop` / `get` + noun |
| Normalization of LLM-extracted spans | `relationSpan` -> `relationKind` enum or `Custom` |

**Forbidden:** inferring open-ended semantic operator or intent direction from natural-language phrase lists when that field is owned by a semantic-reasoning stage. If classify and earlier enrich hops forbid a semantic field, the **next committed LLM hop that sees the command** must emit it (frame extract for relational `operationKind`). Do not fill the gap with regex.

**Canonical incident:** relational `operationKind` phrase-bucket inference (BD-12). Resolution: frame extract emits `establishRelation` | `dissolveRelation`; compiler validates and applies legality only. See [`AGENT.concepts.md`](AGENT.concepts.md) (**Field ownership**, **Fast-path positive vs negative closure**).

---

## Documentation

- New or extended pipelines **should** document each hop's lane (semantic reasoning vs deterministic computation) and handoff contract in feature `AGENT.md` (ad hoc pipelines) or hop-level docs (Coyote-style).

---

## Navigation

- Concepts and vocabulary: [`AGENT.concepts.md`](AGENT.concepts.md)
- Actions parse steady-state (instances): [`../dataSource/actions/AGENT.implementation.md`](../dataSource/actions/AGENT.implementation.md)
- Object manipulation hop purposes: [`../dataSource/actions/enrich/objectManipulation/AGENT.md`](../dataSource/actions/enrich/objectManipulation/AGENT.md)
