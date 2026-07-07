# Ephemera embedding calibration (operator tooling)

Dev-only **read-only** tooling for tuning object-identity embedding thresholds. Lives under [`objectMatch/`](objectMatch/); production gates consume locked constants in [`embeddingMatch/thresholds.ts`](../dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts).

Task context: [`taskPlanning/lambda/ephemera/dataSource/actions/AGENT.objectEmbeddingMatch.planning.md`](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.objectEmbeddingMatch.planning.md).

## Access

**Direct Lambda invoke only** (AWS Console, CLI, or SDK). Requires IAM `lambda:InvokeFunction` on `EphemeraFunction`.

Not exposed via API Gateway or WebSocket. Player sessions cannot reach these `event.type` payloads.

Handlers are read-only: Bedrock embed + cosine compare. No Dynamo writes, no `messageBus` publish, no game-state side effects. Worst case is Bedrock cost (same trust boundary as diagnostics sweeps).

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

Responses include `corpusId`, `modelId`, `dimensions`, and `calibratedAt` so saved Console output stays interpretable after model changes.

## Scoring path (must match production)

1. `normalizeShortNameForEmbedding` (same as impromptu storage)
2. `embedNormalizedSemanticText` -> `invokeBedrockTitanEmbed` (Titan v2, 256d)
3. `SemanticEmbedding.fromFloat32` -> int8 quantization
4. `SemanticEmbedding.cosineSimilarity`
5. `simulateEmbeddingIdentity` / `decideEmbeddingMatch` for identity verdicts

Corpus definitions: [`objectMatch/corpus.ts`](objectMatch/corpus.ts). Pure scorer: [`objectMatch/runEmbeddingCalibration.ts`](objectMatch/runEmbeddingCalibration.ts).

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
