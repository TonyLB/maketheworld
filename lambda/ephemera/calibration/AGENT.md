# Ephemera embedding calibration (operator tooling)

Dev-only **read-only** tooling for tuning object-identity embedding thresholds. Lives under [`objectMatch/`](objectMatch/); production gates consume locked constants in [`embeddingMatch/thresholds.ts`](../dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts).

Task context: [`taskPlanning/lambda/ephemera/dataSource/actions/AGENT.objectEmbeddingMatch.planning.md`](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.objectEmbeddingMatch.planning.md).

## Access

**Direct Lambda invoke only** (AWS Console, CLI, or SDK). Requires IAM `lambda:InvokeFunction` on `EphemeraFunction`.

Not exposed via API Gateway or WebSocket. Player sessions cannot reach these `event.type` payloads.

Handlers are read-only: Bedrock embed + compare. No Dynamo writes, no `messageBus` publish, no game-state side effects. Worst case is Bedrock cost (same trust boundary as diagnostics sweeps).

Routing: early return in [`app.ts`](../app.ts) via [`routeCalibrationEvent.ts`](routeCalibrationEvent.ts).

## Console payloads

**Full corpus** (pair matrix + identity summary + bucket stats + EM-D2 margin/ratio comparison):

```json
{ "type": "EmbeddingCalibrationCorpus" }
```

Optional bucket filter:

```json
{ "type": "EmbeddingCalibrationCorpus", "bucket": "absent-object" }
```

Buckets: `positive-paraphrase`, `hard-negative`, `absent-object`, `unary-trap`, `synonym-without-shared-tokens`, `duplicate-shortName`.

**Pair compare:**

```json
{ "type": "EmbeddingCompare", "left": "broom", "right": "sweeping tool" }
```

**Identity simulate** (ranked scores + gate verdict at current thresholds):

```json
{ "type": "EmbeddingSimulateIdentity", "span": "sword", "catalog": ["broom", "anvil", "lantern"] }
```

**Repeat-invoke sanity check** (two independent Bedrock calls for the same text, no embed cache):

```json
{ "type": "EmbeddingVerifyRepeat", "text": "lantern" }
```

Reports `float32.maxAbsDiff`, `float32.cosineSimilarity`, `quantized.vectorsEqual`, and `productionPath.crossInvokeCosineSimilarity`. Expect ~1.0 and `vectorsEqual: true` if Titan and the quantize path are deterministic. Use when calibration similarities look unexpectedly low and you want to rule out pipeline bugs.

**Semantic distance ladder** (exploration only; not used to lock identity thresholds):

```json
{ "type": "EmbeddingDistanceLadder" }
```

Optional tier filter: `exact`, `inflection`, `tight-paraphrase`, `loose-synonym`, `hypernym-hyponym`, `thematic-neighbor`, `unrelated`.

```json
{ "type": "EmbeddingDistanceLadder", "tier": "loose-synonym" }
```

Returns all ladder pairs, `sortedBySimilarity` (descending), per-tier min/median/max, and `monotonicityViolations` when a farther tier's median exceeds a closer tier's. Pairs defined in [`objectMatch/semanticDistanceLadder.ts`](objectMatch/semanticDistanceLadder.ts). Save Console output under `objectMatch/snapshots/` when exploring model behavior.

**Asymmetric identity ladder** (exploration only; probes span vs enriched catalog index text):

```json
{ "type": "EmbeddingAsymmetricLadder" }
```

Optional tier filter: `identity-positive-exact`, `identity-positive-paraphrase`, `synonym-without-shared-tokens`, `thematic-neighbor`, `hard-negative`, `identity-absent-object`, `unrelated`.

```json
{ "type": "EmbeddingAsymmetricLadder", "tier": "identity-positive-paraphrase" }
```

Optional composition override (default `shortNamePlusDescription`): `shortName`, `shortNamePlusDescription`, `descriptionOnly`.

```json
{ "type": "EmbeddingAsymmetricLadder", "composition": "descriptionOnly" }
```

Returns per-case `similarity` (asymmetric), `symmetricSimilarity` (span vs catalog shortName only), `delta`, `sortedByDelta`, tier summaries with `symmetricMedian` and `deltaMedian`, and `compositionStudyResults` on three flagged cases when `composition` is omitted. Fixtures in [`objectMatch/asymmetricIdentityLadder.ts`](objectMatch/asymmetricIdentityLadder.ts). Span side uses `normalizeShortNameForEmbedding`; catalog index text is trim-only (no exit-name normalization on prose).

Responses include `corpusId`, `modelId`, `dimensions`, and `calibratedAt` so saved Console results stay interpretable after model changes.

## Scoring path (must match production)

1. `normalizeShortNameForEmbedding` (same as impromptu storage)
2. `embedNormalizedSemanticText` -> `invokeBedrockTitanEmbed` (Titan v2, 256d)
3. `SemanticEmbedding.fromFloat32` -> int8 quantization
4. `SemanticEmbedding.cosineSimilarity`
5. `simulateEmbeddingIdentity` / `decideEmbeddingMatch` for identity verdicts

Corpus definitions: [`objectMatch/corpus.ts`](objectMatch/corpus.ts). Pure scorer: [`objectMatch/runEmbeddingCalibration.ts`](objectMatch/runEmbeddingCalibration.ts). Repeat-invoke diagnostic: [`objectMatch/verifyRepeatBedrockEmbed.ts`](objectMatch/verifyRepeatBedrockEmbed.ts). Distance ladder: [`objectMatch/semanticDistanceLadder.ts`](objectMatch/semanticDistanceLadder.ts), [`objectMatch/runSemanticDistanceLadder.ts`](objectMatch/runSemanticDistanceLadder.ts). Asymmetric ladder: [`objectMatch/asymmetricIdentityLadder.ts`](objectMatch/asymmetricIdentityLadder.ts), [`objectMatch/runAsymmetricIdentityLadder.ts`](objectMatch/runAsymmetricIdentityLadder.ts).

## Interpreting output

### Absolute floors

| Constant | Role |
| --- | --- |
| `T_ABS` | Multi-candidate floor; primary guard when requested object is absent from catalog |
| `T_ABS_UNARY` | Unary catalog floor; must stay **> T_ABS** (no lexical backstop) |

Use identity corpus bucket stats:

- **`absent-object`**: set `T_ABS` above max `sim_best` in this bucket
- **`unary-trap`** / **`synonym-without-shared-tokens`**: set `T_ABS_UNARY` above max `sim_best`; verify headroom over `T_ABS`
- **`positive-paraphrase`**: ensure chosen floors still allow resolve on `identity-003-broom-paraphrase`

### Margin rule (EM-D2)

When `|eligible| >= 2`, compare:

- **Absolute gap:** `sim_best - sim_2nd >= T_MARGIN` (current implementation)
- **Ratio:** `sim_best / sim_2nd >= R_MARGIN` (alternative)

`EmbeddingCalibrationCorpus` returns `marginRatioComparison` over multi-catalog identity cases. Pick whichever separates `positive-paraphrase` from `hard-negative` with more headroom.

### Duplicate shortNames

`duplicate-shortName` cases must **always** abstain (`ambiguous_margin`). Embedding must never auto-resolve identical normalized shortNames.

### Semantic distance ladder (exploration)

Use `EmbeddingDistanceLadder` to see whether Titan preserves semantic ordering at low absolute scores. Healthy falloff: tier medians decrease from `exact` through `unrelated`. `monotonicityViolations` flags inversions (e.g. unrelated median above tight-paraphrase). A flat or inverted curve suggests threshold gating on isolated shortNames will be fragile.

### Asymmetric identity ladder (exploration)

Use `EmbeddingAsymmetricLadder` before changing `EMBEDDING#IMPROMPTU` index semantics. Compare `delta` on `asym-010-paraphrase-broom` (target uplift) against `asym-050-absent-sword-vs-broom` and hard-negative tiers (false-positive risk). `compositionStudyResults` on flagged cases shows whether `shortName`, `shortNamePlusDescription`, or `descriptionOnly` is the best index shape. **Do not** use this ladder to lock current shortName-only `thresholds.ts` constants without also changing production embed storage. **Durable findings and closed-loop follow-on:** [`../dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md`](../dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md). Snapshot: [`asymmetric-identity-ladder-v1-2026-07-07.json`](objectMatch/snapshots/asymmetric-identity-ladder-v1-2026-07-07.json).

## When to re-run

Re-run `EmbeddingCalibrationCorpus` and update `thresholds.ts` provenance comment when any of these change:

- `BEDROCK_TITAN_EMBED_MODEL_ID`
- `SEMANTIC_EMBEDDING_V1_DIMENSIONS` or encoding
- Normalization rules in `normalizeShortNameForEmbedding`

Optional: commit snapshot JSON under [`objectMatch/snapshots/`](objectMatch/snapshots/) after a live run for model-migration diffs. Locked constants (2026-07-07): `T_ABS=0.14`, `T_ABS_UNARY=0.18`, `T_MARGIN=0.008` --- see [`thresholds.ts`](../dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts) and [`embedding-identity-v1-2026-07-07.json`](objectMatch/snapshots/embedding-identity-v1-2026-07-07.json).

## Local verification (mocked Bedrock)

```bash
cd lambda/ephemera && npm run test -- --watchAll=false calibration/
```
