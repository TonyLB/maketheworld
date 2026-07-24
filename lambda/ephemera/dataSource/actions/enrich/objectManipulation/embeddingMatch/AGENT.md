# Object identity embedding match (`embeddingMatch/`)

**Status: shipped (FT-3.3 relational + FT-2.2 membership tuple selector + FT-2.1 pool path + FT-1.2/1.3 calibration).** **v2 steady-state = pool recommender** (not terminal pick-one). **Membership production (FT-2.2, 2026-07-10):** [`resolveCatalogSpanToPool`](../resolveCatalogSpanToPool.ts) -> [`buildSpanCandidatePool`](buildSpanCandidatePool.ts) -> [`proposeMembershipTuples`](../proposeMembershipTuples.ts) + [`selectIdentityPlanTuple`](../selectIdentityPlanTuple.ts) (`T_JOINT_*` legality-gated). **Relational production (native Parse-skeleton pipeline, iteration 3):** pools via [`identifySkeletonSpans`](../identifySkeletonSpans.ts) -> Grounding/Validation ([`synthesize/groundChange`](../synthesize/groundChange.ts), [`synthesize/filterLegalRelationalCandidates`](../synthesize/filterLegalRelationalCandidates.ts)); the FT-3.3 `proposeRelationalTuples`/`selectRelationalFromPools` selectors were retired 2026-07-20. Bridge [`selectSingleSpanFromPool`](../selectSingleSpanFromPool.ts) harness-only. **Calibration / historical only:** v1 cosine + conjunctive gates via [`decideEmbeddingMatch`](decideEmbeddingMatch.ts) / [`simulateEmbeddingIdentity`](simulateEmbeddingIdentity.ts) / [`resolveObjectSpanByEmbedding`](resolveObjectSpanByEmbedding.ts). Identity LLM retired from production.

**Output trust:** **v1** open-loop terminal `Resolved` (retired from production) vs **v2** closed-loop pool -> FT-5 selector (auto-resolve | Consult | Abstain). Canonical vocabulary: [`../../../../../llm/AGENT.concepts.md`](../../../../../llm/AGENT.concepts.md) (**Output trust models**, **How the axes compose**). Seam (referential grounding job) is unchanged across trust modes.

**Pipeline context:** [`../AGENT.md`](../AGENT.md) step 4 (identity).

**Calibration tooling:** [`../../../../../calibration/AGENT.md`](../../../../../calibration/AGENT.md) --- Bedrock-backed operator runs, Lambda console handlers, and committed snapshot JSON under `calibration/objectMatch/snapshots/`.

**Mocked calibration harnesses:** [`testing/`](testing/) --- Jest sweeps, absolute-threshold regression fixtures, and identity-ordering invariants on deterministic mock vectors. **Not** production runtime and **not** Lambda-invokable; they exercise production combine code locally. Durable numeric artifacts commit under `calibration/objectMatch/snapshots/` (e.g. via [`generatePoolCalibrationSnapshot.test.ts`](../../../../../calibration/objectMatch/generatePoolCalibrationSnapshot.test.ts)).

---

## v1 calibration shim (not production)

| Module | Role |
| --- | --- |
| [`rankCatalogByCosineSimilarity`](rankCatalogByCosineSimilarity.ts) | Linear scan; ranked scores |
| [`decideEmbeddingMatch`](decideEmbeddingMatch.ts) | Conjunctive gates -> `Resolved` \| `Abstain` (calibration regression) |
| [`simulateEmbeddingIdentity`](simulateEmbeddingIdentity.ts) | v1 legacy decision; [`simulateEmbeddingIdentityWithPool`](simulateEmbeddingIdentity.ts) for pool + metrics |
| [`resolveObjectSpanByEmbedding`](resolveObjectSpanByEmbedding.ts) | Span embed + v1 decide (calibration only --- **not** production identity) |
| [`spanEmbedCache`](spanEmbedCache.ts) | One Bedrock embed per distinct normalized span per invocation (shared by production pool path) |
| [`thresholds.ts`](thresholds.ts) | Locked constants: v1 shim (`T_ABS`...), FT-8 normalization, FT-1.2 pool merge, FT-5 `T_JOINT_*` (membership + relational tuple selectors) |

## FT-1.2 / FT-2.1 pool merge (production)

Rank-all candidate pool for fault-tolerant span grounding. **Wired to production identity path (FT-2.1, 2026-07-09).**

| Module | Role |
| --- | --- |
| [`buildSpanCandidatePool`](buildSpanCandidatePool.ts) | Rank every catalog entry; FT-8 embed + lex -> weighted RMS joint relevance; emit `SpanCandidatePool` |
| [`gapTrimShortlist`](gapTrimShortlist.ts) | Relative gap + Top-N ceiling shortlist |
| [`relevanceCombine`](relevanceCombine.ts) | `weightedRmsJointRelevance` (absent-channel drop semantics) |
| [`testing/simulateEmbeddingIdentityCorpus`](testing/simulateEmbeddingIdentityCorpus.ts) | Identity corpus pool-metrics harness (ordering invariants, not v1 resolve rate alone) |
| [`testing/compareAdmissibilityArms`](testing/compareAdmissibilityArms.ts) | Short-span-lexical + short-span-pool absolute-threshold regression fixtures (post-FT-1.3.1 gate retirement; C5, 2026-07-21, collapsed from a legacy-gate-vs-gate-off differential) |
| [`testing/shortSpanCalibrationCases`](testing/shortSpanCalibrationCases.ts) | Length-1/2 + `ax`/`axolotl` fixtures |
| [`testing/compareFlankCombineLegacy`](testing/compareFlankCombineLegacy.ts) | Legacy vs mitigated flank-combine score table |
| [`testing/flankCombineBiasSweep`](testing/flankCombineBiasSweep.ts) | `biasMax` grid sweep + lock helper (FT-1.3.6) |
| [`testing/flankChannelWeightSweep`](testing/flankChannelWeightSweep.ts) | `(w_adjoined, w_remote)` grid sweep + lock helper (FT-1.3.5) |

**Joint relevance (FT-1):**

```
joint = sqrt(w_l * lex^2 + w_e * embed^2) / sqrt(w_l + w_e)   [both present]
joint = lex                                                     [embed absent]
joint = embed                                                   [lex absent]
```

Locked `JOINT_RELEVANCE_W_L` / `JOINT_RELEVANCE_W_E`, `POOL_SHORTLIST_TOP_N`, `POOL_GAP_TRIM_RELATIVE_DROP` in [`thresholds.ts`](thresholds.ts) (FT-1.3, 2026-07-09).

**Pool contract:** no admission floor; full ranked `candidates[]` + `shortlist` (gap-trim). Per-candidate `{ id, label, jointRelevance, marginToRunnerUp?, lexRelevance?, embedRelevance?, sourceTags, locus }`. Types: [`../spanResolution.ts`](../spanResolution.ts).

## FT-1.1 relevance normalization (2026-07-09)

Pure helpers for the fault-tolerant candidate pool (FT-1). Wired into **`buildSpanCandidatePool`** (FT-1.2) and production identity / relational grounding via [`resolveCatalogSpanToPool`](../resolveCatalogSpanToPool.ts).

| Module | Role |
| --- | --- |
| [`embedRelevance`](embedRelevance.ts) | FT-8 two-point log map: raw cosine -> `[0,1]` |
| [`evidenceNumerics`](evidenceNumerics.ts) | Domain-agnostic `sigmoid`, `tanh`, `clampUnitInterval` |
| [`relevanceCombine`](relevanceCombine.ts) | Flank + joint combiner patterns: `tanhCenteredFlankScore` (production), `multiplicativeFlankScoreV1` (simulator A/B), `weightedRmsJointRelevance` (FT-1.2) |
| [`sellersApproximateSubstringMatch`](sellersApproximateSubstringMatch.ts) | OSA Sellers alignment of span in catalog `shortName` |
| [`lexicalMatchMetrics`](lexicalMatchMetrics.ts) | Flank geometry + `editDistanceRelevance` + `lexicalRelevanceFromMetrics` |
| [`lexicalRelevance`](lexicalRelevance.ts) | Entry point: shorter-in-longer Sellers match, then edit gate * tanh flank combine |
| [`testing/tokenOverlapRelevance`](testing/tokenOverlapRelevance.ts) | Simulator-only A/B baseline (not production) |
| [`testing/simulateLexicalIdentityCorpus`](testing/simulateLexicalIdentityCorpus.ts) | Lexical-only identity corpus rank + tanh vs v1 A/B harness |

**Lexical relevance pipeline (FT-1.1.5, 2026-07-09):** embed shorter normalized string in longer -> Sellers match -> combine:

1. **Edit distance** (hard gate, can hit `0`): `1 - min(1, editDistance / max(|span in T|, |P|))`
2. **Flank geometry** via centered tanh evidence + outer sigmoid (not a product of per-factor asymptotics):

```
x_L/R   = adjoinedLength / spanScale
m_L/R   = LEX_ADJOINED_FLANK_MIDPOINT_RATIO (0.5)
x_Rm    = remoteLength / spanScale              [production + context, FT-1.3.4]
m_Rm    = LEX_REMOTE_FLANK_MIDPOINT_RATIO (3.0)
e_L/R   = positive adjoined evidence * tanh(patternLength / LEX_ADJOINED_POS_DAMP_SCALE)
          negative adjoined evidence at full weight
e_Rm    = w_Rm * tanh((m_Rm - x_Rm) / s_Rm)
coverage = patternLength / candidateTextLength
lift     = tanh(LEX_BIAS_COVERAGE_SCALE * coverage) / tanh(LEX_BIAS_COVERAGE_SCALE)
biasEff  = LEX_FLANK_COMBINE_BIAS_MIN + (LEX_FLANK_COMBINE_BIAS - MIN) * lift
flankScore = sigmoid(biasEff + e_L + e_R + e_Rm)
lexRelevance = editDistanceRelevance * flankScore
```

Per-channel scales/weights in [`thresholds.ts`](thresholds.ts). Production adjoined and remote channels are **ratio-invariant** (FT-1.3.3/4) when [`lexicalRelevanceFromMetrics`](lexicalMatchMetrics.ts) passes `FlankCombineContext`; legacy absolute channels when context omitted (simulator A/B).

Formulas and admissibility rules: this file (**FT-1.1 relevance normalization**, **FT-1.3 calibration**) + locked constants in [`thresholds.ts`](thresholds.ts).

**Storage:** catalog vectors from **`EMBEDDING#IMPROMPTU`** keyed on **normalized `shortName` only** ([`buildShortNameSemanticEmbedding`](../../../../objects/embedding/buildShortNameSemanticEmbedding.ts)). **`RoomInPlayObjectCatalogEntry.embedding`** is optional on catalog entries; **`handleParseRequested`** ([`index.ts`](../../../index.ts)) batch-loads via **`internalCache.ObjectEmbedding.get`** and attaches vectors with [`attachEmbeddingsToCatalogEntries`](../../../attachEmbeddingsToCatalogEntries.ts) before identity stage runs.

**Wiring (production):** [`identityStage.ts`](../identityStage.ts) (reached on the relational route via [`identifySkeletonSpans.ts`](../identifySkeletonSpans.ts)) emits pools via [`resolveCatalogSpanToPool`](../resolveCatalogSpanToPool.ts) -> [`buildSpanCandidatePool`](buildSpanCandidatePool.ts) on non-exact spans. Exact unique match skips embed. **No identity LLM fallthrough.** Span embed invoke failure yields an empty/weak pool; FT-5 selector declines to Abstain/Error --- never a silent best-guess id. [`resolveObjectSpanByEmbedding`](resolveObjectSpanByEmbedding.ts) / [`decideEmbeddingMatch`](decideEmbeddingMatch.ts) remain **calibration-only**.

## Threshold ownership (FT-1.3, 2026-07-09)

| Constant group | Scale | Consumer | Pool admission? |
| --- | --- | --- | --- |
| `T_ABS`, `T_ABS_UNARY`, `T_MARGIN` | raw cosine | v1 [`decideEmbeddingMatch`](decideEmbeddingMatch.ts) (calibration shim only) | **No** --- open-loop calibration |
| `C_MIN`, `L_MIN`, flank combine, `S_MIN` | per-signal `[0,1]` | `embedRelevance`, `lexicalRelevance` | **No** --- relevance normalization |
| `JOINT_RELEVANCE_W_*`, gap-trim | joint `[0,1]` | [`buildSpanCandidatePool`](buildSpanCandidatePool.ts) | **No** --- rank-all, no floor |
| `T_JOINT_ABS`, `T_JOINT_MARGIN`, `T_JOINT_ABS_UNARY` | joint `[0,1]` | FT-5 selector (**wired** on membership + relational) | **No** --- auto-resolve gate |

**Pool contract:** unconditional rank-all; gating is downstream (FT-5 confidence on `jointRelevance` + `marginToRunnerUp`).

## FT-1.3 calibration (2026-07-09)

**Canonical snapshot:** [`embedding-identity-pool-v1-2026-07-09-bias-sweep.json`](../../../../../calibration/objectMatch/snapshots/embedding-identity-pool-v1-2026-07-09-bias-sweep.json) (mock Bedrock harness; FT-1.3.2-6 locked constants). Rolling default: [`embedding-identity-pool-v1-2026-07-09.json`](../../../../../calibration/objectMatch/snapshots/embedding-identity-pool-v1-2026-07-09.json). Confirm on dev stack live run.

**Locked constants** (see [`thresholds.ts`](thresholds.ts) provenance block): `C_MIN=0.05`, `L_MIN=5`, `S_MIN=3`, flank combine + edit costs, `JOINT_RELEVANCE_W_L/E=1.0`, `POOL_SHORTLIST_TOP_N=5`, `POOL_GAP_TRIM_RELATIVE_DROP=0.15`, plus FT-1.3.2-6 lexical combine (`LEX_FLANK_COMBINE_BIAS=1.5`, `LEX_ADJOINED_FLANK_WEIGHT=3.0`, `LEX_REMOTE_FLANK_WEIGHT=0.4`, coverage bias + ratio-invariant midpoints).

**FT-5 floors (wired on membership + relational selectors):** `T_JOINT_ABS=0.42`, `T_JOINT_MARGIN=0.08`, `T_JOINT_ABS_UNARY=0.48` --- fit from mocked identity corpus pool metrics; absent/unary heads stay below `T_JOINT_ABS`, paraphrase clears with margin when catalog is unary / high-margin.

**Short-span admissibility (FT-1.3.1, 2026-07-09):** gate **retired**. [`buildSpanCandidatePool`](buildSpanCandidatePool.ts) scores lexical for every non-empty normalized span; FT-5 `T_JOINT_*` owns auto-resolve gating downstream. **Spurious diverse-catalog length-1** (`a` vs multi-token catalog) stays below `T_JOINT_ABS` (~0.34 joint with weak embed). **Prefix shorthand** (`ax`/`rusty axe`, `a`/`axe`) may score moderately-to-highly --- desired pool behavior. Harness: [`compareAdmissibilityArms`](testing/compareAdmissibilityArms.ts) (absolute-threshold short-span-lexical + short-span-pool fixtures). **The pre-retirement legacy gate and its differential comparison were removed outright (C5, 2026-07-21)** --- the retirement harness had confirmed the two policies agreed for long enough that the differential no longer earned its keep; the injectable `resolveLexicalChannelActive` override was removed from production code alongside it.

**Morphology invariant:** lexical is string geometry, not semantics. `gem/gemstones` and `don/wimbledon` are **precisely symmetric** (3-char span, 6-char adjoined flank, 9-char candidate, 3/9 coverage) --- scores must remain equal; tuning must not prefer one over the other lexically.

## FT-1.3.2-1.3.6 calibrated lexical combine (2026-07-09)

Sequential experiments locked production lexical combine constants. Intermediate experiment snapshots are local-only (not committed); canonical record is the bias-sweep snapshot above.

| Slice | Change | Locked value(s) |
| --- | --- | --- |
| FT-1.3.2 | Coverage-derived `biasEff(coverage)` + asymmetric adjoined positive damp | `BIAS_MIN=0`, `BIAS_COVERAGE_SCALE=4`, `ADJOINED_POS_DAMP_SCALE=3` |
| FT-1.3.3 | Ratio-invariant adjoined L/R (`x/spanScale`, `m=0.5`) | `LEX_ADJOINED_FLANK_MIDPOINT_RATIO=0.5` |
| FT-1.3.4 | Ratio-invariant remote (`remoteLength/spanScale`, `m=3.0`) | `LEX_REMOTE_FLANK_MIDPOINT_RATIO=3.0` |
| FT-1.3.5 | Flank channel weight sweep | `w_adjoined=3.0`, `w_remote=0.4` |
| FT-1.3.6 | `biasMax` sweep (Pareto: highest bias with `a/axe` < `T_JOINT_ABS`) | `LEX_FLANK_COMBINE_BIAS=1.5` |

**Final scores (mocked harness):**

| Pair | Lex (approx) |
| --- | ---: |
| `a` / `axe` | **~0.40** (< `T_JOINT_ABS`) |
| `gem` / `gemstones` | **~0.50** |
| `don` / `wimbledon` | **~0.50** (=== gem by morphology) |
| `ax` / `rusty ax` vs `axle` | ~0.91 vs ~0.79 (gap ~0.12) |
| `broom` / `broom` | ~0.97 |
| Paraphrase joint | ~0.75 (unchanged) |

**Harnesses:** [`testing/compareFlankCombineLegacy`](testing/compareFlankCombineLegacy.ts), [`testing/shortSpanMitigationSweep.test.ts`](testing/shortSpanMitigationSweep.test.ts) (FT-1.3.2/3 sensitivity bounds), [`testing/flankChannelWeightSweep`](testing/flankChannelWeightSweep.ts) (FT-1.3.5), [`testing/flankCombineBiasSweep`](testing/flankCombineBiasSweep.ts) (FT-1.3.6).

**Index shape:** production remains `shortName`-only. No asymmetric ladder re-run (unchanged since 2026-07-07). Prior snapshot: [`asymmetric-identity-ladder-v1-2026-07-07.json`](../../../../../calibration/objectMatch/snapshots/asymmetric-identity-ladder-v1-2026-07-07.json).

---

## Calibration findings (2026-07-07, Titan v2 256d quantized)

Snapshots: [`embedding-identity-v1-2026-07-07.json`](../../../../../calibration/objectMatch/snapshots/embedding-identity-v1-2026-07-07.json), [`asymmetric-identity-ladder-v1-2026-07-07.json`](../../../../../calibration/objectMatch/snapshots/asymmetric-identity-ladder-v1-2026-07-07.json).

### Symmetric shortName index (production geometry)

Live corpus on isolated short phrases:

- Absolute cosines sit **~0.05-0.25** for cross-phrase pairs, not high-0.8+ "same object" scores.
- **Absent-object** best similarity can **exceed** paraphrase best (`identity-001` max 0.253 vs `identity-003` best 0.158). **Margin gate is essential**; absolute floor alone is insufficient without careful tuning.
- Locked thresholds (`T_ABS=0.14`, `T_ABS_UNARY=0.18`, `T_MARGIN=0.008`, absolute-gap margin) separate most corpus buckets at **shortName-only** index; paraphrase resolve at locked thresholds depends on margin + catalog shape.

**Interpretation:** Titan on symmetric short-short text encodes **distributional / lexical similarity**, not reliable **referential identity** ("same catalog object"). Token-free descriptive paraphrase (e.g. `sweeping tool` / `broom`) is a weak fit for terminal auto-resolve on shortName vectors alone --- which is why production treats embedding as a **recommender** into the FT-5 selector, not a terminal pick-one.

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

### Open-loop terminal resolve vs closed-loop recommender (historical rationale)

Vocabulary: **open-loop** / **closed-loop** here map to **trusted-output** / **fault-tolerant** in [`../../../../../llm/AGENT.concepts.md`](../../../../../llm/AGENT.concepts.md).

**v1 architecture** treated embedding as **pick-one-or-abstain** when conjunctive gates passed. Downstream enrich stages are **intolerant of false positives** (wrong `objectId` is costly). Under that success criterion, asymmetric results were only somewhat encouraging.

**v2 (shipped):** embedding emits a ranked **candidate pool**; the FT-5 selector (propose-N + legality + floor/margin) **auto-resolves**, **Consults**, or **Abstains**. Closed-loop identity grounding is live on membership and relational paths --- the adjudicator is the deterministic selector (not an identity LLM). The same calibration numbers are more encouraging under this model:

- Paraphrase: strong **margin** over 2nd candidate (~0.17) even at modest absolute sim when catalog is unary / high-margin; thin margin among legal alternatives -> **Consult**.
- Absent-object: clustered weak scores -> grey-band **Abstain**, not terminal resolve.
- Enrichment role: **reranker / shortlist generator**, not sole decider.

---

## Deferred follow-on

Recovery pattern vocabulary: [`../../../../../llm/AGENT.concepts.md`](../../../../../llm/AGENT.concepts.md) (**Fault recovery patterns**).

| Initiative | Recovery pattern | Intent |
| --- | --- | --- |
| **Enriched `EMBEDDING#IMPROMPTU`** | Supplement | Store `shortNamePlusDescription` (or equivalent) when spawn/update has prose; refresh policy extends beyond shortName hash. |
| **`withinObject` pool supplement** | Supplement | Container-contents expand after grounding `from` (re-entrant loop; future `llm/pipeline/` orchestrator). |
| **Phase C joint proposer** | Backtrack / Consult | LLM joint `(identity, plan)` hop beyond numeric FT-5 floors; retires complexity LLM + frame extract as distinct hops (C1/C4). |

**When revisiting enrichment or thresholds:** re-read this file and asymmetric snapshot; re-run `EmbeddingAsymmetricLadder` + pool corpus harnesses before changing storage or gates.

---

## When to re-calibrate

Re-run [`EmbeddingCalibrationCorpus`](../../../../../calibration/AGENT.md) and revisit [`thresholds.ts`](thresholds.ts) when:

- `BEDROCK_TITAN_EMBED_MODEL_ID`, dimensions, or encoding change
- `normalizeShortNameForEmbedding` rules change
- Catalog index composition changes (enriched storage)
