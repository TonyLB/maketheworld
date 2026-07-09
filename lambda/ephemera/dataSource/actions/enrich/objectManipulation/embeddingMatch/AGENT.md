# Object identity embedding match (`embeddingMatch/`)

**Status: shipped (v1 production shim + FT-1.2 pool builder).** Cosine-similarity tier between exact `shortName` resolve and the identity LLM. **Production path (v1):** open-loop terminal fast path (`Resolved` | `Abstain` via [`decideEmbeddingMatch`](decideEmbeddingMatch.ts)). **FT-1.2 (2026-07-09):** rank-all `SpanCandidatePool` builder with embed + lexical joint relevance; simulator/calibration consume pool metrics; production `identityStage` still uses v1 legacy decision until FT-2.

**Output trust:** canonical **trusted-output vs fault-tolerant** contrast for object identity --- see [`../../../../../llm/AGENT.concepts.md`](../../../../../llm/AGENT.concepts.md) (**Output trust models**, **How the axes compose**). Seam (referential grounding job) is unchanged across trust modes.

**Pipeline context:** [`../AGENT.md`](../AGENT.md) step 4 (identity).

**Calibration tooling:** [`../../../../../calibration/AGENT.md`](../../../../../calibration/AGENT.md).

---

## v1 module surface

| Module | Role |
| --- | --- |
| [`rankCatalogByCosineSimilarity`](rankCatalogByCosineSimilarity.ts) | Linear scan; ranked scores |
| [`decideEmbeddingMatch`](decideEmbeddingMatch.ts) | Conjunctive gates -> `Resolved` \| `Abstain` |
| [`simulateEmbeddingIdentity`](simulateEmbeddingIdentity.ts) | v1 legacy decision (production shim); [`simulateEmbeddingIdentityWithPool`](simulateEmbeddingIdentity.ts) for pool + metrics |
| [`resolveObjectSpanByEmbedding`](resolveObjectSpanByEmbedding.ts) | Span embed + orchestrate (v1 decision) |
| [`spanEmbedCache`](spanEmbedCache.ts) | One Bedrock embed per distinct normalized span per invocation |
| [`thresholds.ts`](thresholds.ts) | Locked v1 gates (`T_ABS`, `T_ABS_UNARY`, `T_MARGIN`); FT-8 anchors; FT-1.2 joint RMS + gap-trim (provisional until FT-1.3) |

## FT-1.2 pool merge (2026-07-09)

Rank-all candidate pool for fault-tolerant span grounding. **Not wired to `identityStage` until FT-2**; production still uses v1 cosine + conjunctive gates.

| Module | Role |
| --- | --- |
| [`buildSpanCandidatePool`](buildSpanCandidatePool.ts) | Rank every catalog entry; FT-8 embed + lex -> weighted RMS joint relevance; emit `SpanCandidatePool` |
| [`gapTrimShortlist`](gapTrimShortlist.ts) | Relative gap + Top-N ceiling shortlist |
| [`relevanceCombine`](relevanceCombine.ts) | `weightedRmsJointRelevance` (absent-channel drop semantics) |
| [`testing/simulateEmbeddingIdentityCorpus`](testing/simulateEmbeddingIdentityCorpus.ts) | Identity corpus pool-metrics harness (ordering invariants, not v1 resolve rate alone) |

**Joint relevance (FT-1):**

```
joint = sqrt(w_l * lex^2 + w_e * embed^2) / sqrt(w_l + w_e)   [both present]
joint = lex                                                     [embed absent]
joint = embed                                                   [lex absent]
```

Provisional `JOINT_RELEVANCE_W_L` / `JOINT_RELEVANCE_W_E`, `POOL_SHORTLIST_TOP_N`, `POOL_GAP_TRIM_RELATIVE_DROP` in [`thresholds.ts`](thresholds.ts) --- lock in FT-1.3 calibration.

**Pool contract:** no admission floor; full ranked `candidates[]` + `shortlist` (gap-trim). Per-candidate `{ id, label, jointRelevance, marginToRunnerUp?, lexRelevance?, embedRelevance?, sourceTags, locus }`. Types: [`../spanResolution.ts`](../spanResolution.ts).

## FT-1.1 relevance normalization (2026-07-09)

Pure helpers for the fault-tolerant candidate pool (FT-1). Wired into **`buildSpanCandidatePool`** (FT-1.2); production identity path still v1 until FT-2.

| Module | Role |
| --- | --- |
| [`embedRelevance`](embedRelevance.ts) | FT-8 two-point log map: raw cosine -> `[0,1]` |
| [`evidenceNumerics`](evidenceNumerics.ts) | Domain-agnostic `sigmoid`, `tanh`, `clampUnitInterval` |
| [`relevanceCombine`](relevanceCombine.ts) | Flank + joint combiner patterns: `tanhCenteredFlankScore` (production), `multiplicativeFlankScoreV1` (simulator A/B), `weightedRmsJointRelevance` (FT-1.2) |
| [`sellersApproximateSubstringMatch`](sellersApproximateSubstringMatch.ts) | OSA Sellers alignment of span in catalog `shortName` |
| [`lexicalMatchMetrics`](lexicalMatchMetrics.ts) | Flank geometry + `editDistanceRelevance` + `lexicalRelevanceFromMetrics` |
| [`lexicalRelevance`](lexicalRelevance.ts) | Entry point: shorter-in-longer Sellers match, then edit gate * tanh flank combine |
| [`admissibleShortSpans`](admissibleShortSpans.ts) | Catalog-derived short-span admissibility; `isLexicalChannelActive` scan gate |
| [`testing/tokenOverlapRelevance`](testing/tokenOverlapRelevance.ts) | Simulator-only A/B baseline (not production) |
| [`testing/simulateLexicalIdentityCorpus`](testing/simulateLexicalIdentityCorpus.ts) | Lexical-only identity corpus rank + tanh vs v1 A/B harness |

**Lexical relevance pipeline (FT-1.1.5, 2026-07-09):** embed shorter normalized string in longer -> Sellers match -> combine:

1. **Edit distance** (hard gate, can hit `0`): `1 - min(1, editDistance / max(|span in T|, |P|))`
2. **Flank geometry** via centered tanh evidence + outer sigmoid (not a product of per-factor asymptotics):

```
t_i     = (m_i - x_i) / s_i
e_i     = w_i * tanh(t_i)
flankScore = sigmoid(bias + e_L + e_R + e_Rm)
lexRelevance = editDistanceRelevance * flankScore
```

Per-channel `m` / `s` / `w` and combine `bias` in [`thresholds.ts`](thresholds.ts) (`LEX_FLANK_COMBINE_BIAS`, `LEX_ADJOINED_FLANK_*`, `LEX_REMOTE_FLANK_*`); adjoined midpoint `m = spanScale / 2` at runtime. Lock in FT-1.3 calibration. Legacy multiplicative asymptotic combine retained as `multiplicativeFlankScoreV1` for simulator A/B. Legacy `substringBiasedEditDistance` in `lexicalRelevance.ts` retained for simulator A/B only.

Formulas and admissibility rules: [`AGENT.faultTolerantObjectManipulation.planning.md`](../../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.faultTolerantObjectManipulation.planning.md) (**FT-8 decisions so far**).

**Storage (v1):** catalog vectors from **`EMBEDDING#IMPROMPTU`** keyed on **normalized `shortName` only** ([`buildShortNameSemanticEmbedding`](../../../../objects/embedding/buildShortNameSemanticEmbedding.ts)). **`RoomInPlayObjectCatalogEntry.embedding`** is optional on catalog entries; **`handleParseRequested`** ([`index.ts`](../../../index.ts)) batch-loads via **`internalCache.ObjectEmbedding.get`** and attaches vectors with [`attachEmbeddingsToCatalogEntries`](../../../attachEmbeddingsToCatalogEntries.ts) before identity stage runs.

**Wiring:** [`identityStage.ts`](../identityStage.ts) and [`resolveRelationalGrounding.ts`](../resolveRelationalGrounding.ts) call `resolveObjectSpanByEmbedding` on deterministic `NoMatch` only (skip on `AmbiguousMatch`). Span embed invoke failure maps to `embed_invoke_failed` abstain and **falls through to identity LLM** --- never a terminal Error.

**FT-0 migration note (2026-07-09):** v1 `EmbeddingMatchDecision.Resolved` is a **terminal commit-worthy** outcome on the production path today. FT-1.2 ships the ranked `SpanCandidatePool` builder ([`buildSpanCandidatePool`](buildSpanCandidatePool.ts)); auto-resolve moves to the FT-5 selector when FT-2 wires `identityStage` to pool artifacts.

---

## Calibration findings (2026-07-07, Titan v2 256d quantized)

Snapshots: [`embedding-identity-v1-2026-07-07.json`](../../../../../calibration/objectMatch/snapshots/embedding-identity-v1-2026-07-07.json), [`asymmetric-identity-ladder-v1-2026-07-07.json`](../../../../../calibration/objectMatch/snapshots/asymmetric-identity-ladder-v1-2026-07-07.json).

### Symmetric shortName index (production v1 geometry)

Live corpus on isolated short phrases:

- Absolute cosines sit **~0.05-0.25** for cross-phrase pairs, not high-0.8+ "same object" scores.
- **Absent-object** best similarity can **exceed** paraphrase best (`identity-001` max 0.253 vs `identity-003` best 0.158). **Margin gate is essential**; absolute floor alone is insufficient without careful tuning.
- Locked thresholds (`T_ABS=0.14`, `T_ABS_UNARY=0.18`, `T_MARGIN=0.008`, absolute-gap margin) separate most corpus buckets at **shortName-only** index; paraphrase resolve at locked thresholds depends on margin + catalog shape.

**Interpretation:** Titan on symmetric short-short text encodes **distributional / lexical similarity**, not reliable **referential identity** ("same catalog object"). Token-free descriptive paraphrase (e.g. `sweeping tool` / `broom`) is a weak fit for terminal auto-resolve on shortName vectors alone.

### Asymmetric span vs enriched catalog index (exploration)

**Experiment:** thin `objectSpan` (query) vs catalog text built as `shortName. description` ([`EmbeddingAsymmetricLadder`](../../../../../calibration/AGENT.md)); span uses `normalizeShortNameForEmbedding`; catalog prose is trim-only.

| Case | Symmetric (shortName) | Asymmetric (shortName + description) | Delta |
| --- | ---: | ---: | ---: |
| `sweeping tool` -> broom (target paraphrase) | 0.158 | 0.281 | **+0.123** |
| `sword` -> broom (absent-object false-positive risk) | 0.184 | 0.063 | **-0.121** |
| `sword` -> anvil (absent-object) | 0.246 | 0.196 | -0.049 |
| `travel bag` -> satchel (paraphrase) | 0.370 | 0.474 | +0.104 |
| `blade` -> ornate rapier (unary trap) | 0.175 | 0.222 | +0.046 |

**Composition study (three flagged cases):**

| Index shape | Paraphrase uplift | Absent-object risk (`sword` vs broom desc.) |
| --- | --- | --- |
| `shortName` only | baseline | higher false-positive pull (0.184) |
| **`shortNamePlusDescription`** | moderate uplift | **safer** (0.063) |
| `descriptionOnly` | very high paraphrase (0.630) | **worse** (0.239) |

**Conclusions:**

1. **`shortNamePlusDescription` is the preferred index shape** if catalog embeddings are enriched; **do not** index `descriptionOnly`.
2. Enrichment **improves rank separation** for paraphrase (median tier +0.11) while **lowering** absent-object median (-0.09) vs symmetric --- but **does not** clear all failure modes (`sword` / `anvil` still ~0.20; unary `blade` / `rapier` rises toward `T_ABS_UNARY`).
3. **Do not lock new thresholds from asymmetric ladder alone** without committing to enriched storage and re-running full identity corpus + simulate.

### Open-loop terminal resolve vs closed-loop recommender

Vocabulary: **open-loop** / **closed-loop** here map to **trusted-output** / **fault-tolerant** in [`../../../../../llm/AGENT.concepts.md`](../../../../../llm/AGENT.concepts.md).

**v1 architecture** treats embedding as **pick-one-or-abstain** when conjunctive gates pass. Downstream enrich stages are **intolerant of false positives** (wrong `objectId` is costly).

Under that success criterion, asymmetric results are **only somewhat encouraging**: paraphrase improves but absent-object and unary-trap still breach absolute floors if auto-resolved.

Under a **closed-loop** model --- embedding emits **top-N candidates + confidence** (absolute sim, margin, eligible count); identity LLM / post-identity validation **confirms or corrects** --- the **same numbers are more encouraging**:

- Paraphrase: strong **margin** over 2nd candidate (~0.17) even at modest absolute sim.
- Absent-object: clustered weak scores -> **low confidence**, not terminal resolve.
- Enrichment role: **reranker / shortlist generator**, not sole decider.

This module's v1 `Resolved` outcome is a **shipping compromise**, not the long-term identity contract.

---

## Deferred follow-on (out of v1 scope)

Recovery pattern vocabulary: [`../../../../../llm/AGENT.concepts.md`](../../../../../llm/AGENT.concepts.md) (**Fault recovery patterns**).

| Initiative | Recovery pattern | Intent |
| --- | --- | --- |
| **Identity LLM abstain / `noMatch`** | Backtrack (owner) | When nothing in catalog fits, identity LLM returns abstain instead of optimistic best-effort pick. Does not change v1 [`buildPrompt.ts`](../buildPrompt.ts) / [`interpretIdentity.ts`](../interpretIdentity.ts). |
| **Lexical backstop on unary catalog** | --- | Token overlap / edit distance --- **rejected for v1**; unary uses `T_abs_unary > T_abs` only. |
| **Closed-loop identity** | Correct + backtrack | Upstream stages emit **best-guess + confidence**; downstream equipped with low-cost correction (never assume upstream is final). |
| **Embedding as candidate recommender** | Supplement (rank) + backtrack | Replace or narrow terminal `Resolved`; expose ranked shortlist; identity LLM adjudicates 1-N candidates. |
| **Enriched `EMBEDDING#IMPROMPTU`** | Supplement | Store `shortNamePlusDescription` (or equivalent) when spawn/update has prose; refresh policy extends beyond shortName hash. |
| **Post-identity validation LLM** | Correct | Judge span + command vs grounded `objectId`; trigger correction or backtrack. |
| **Identification retry loop** | Backtrack (+ supplement) | On validation failure, broader / more expensive pass (e.g. identity LLM when fast path won, wider catalog context, abstain-capable prompt). |

**When starting closed-loop work:** re-read this file and asymmetric snapshot; re-run `EmbeddingAsymmetricLadder` + `EmbeddingSimulateIdentity` (rich catalog fixtures) before changing storage or gates.

---

## When to re-calibrate

Re-run [`EmbeddingCalibrationCorpus`](../../../../../calibration/AGENT.md) and revisit [`thresholds.ts`](thresholds.ts) when:

- `BEDROCK_TITAN_EMBED_MODEL_ID`, dimensions, or encoding change
- `normalizeShortNameForEmbedding` rules change
- Catalog index composition changes (enriched storage)
