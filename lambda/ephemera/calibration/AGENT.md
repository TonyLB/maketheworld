# Ephemera calibration (operator Bedrock tooling)

Dev-only **read-only** operator tooling reached by direct Lambda invoke. Two trees: object-identity embedding calibration under [`objectMatch/`](objectMatch/) (the bulk of this doc), and the scene reasoning probe under [`sceneReasoning/`](sceneReasoning/) (see [Scene reasoning probe](#scene-reasoning-probe)). Embedding calibration tunes object-identity thresholds; production gates consume locked constants in [`embeddingMatch/thresholds.ts`](../dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts).

**Layering:** this tree is Bedrock-backed operator tooling (Lambda invoke, corpus runs, snapshot JSON). Mocked parameter sweeps and admissibility A/B harnesses live in [`embeddingMatch/testing/`](../dataSource/actions/enrich/objectManipulation/embeddingMatch/testing/) --- see **Mocked calibration harnesses** in [`embeddingMatch/AGENT.md`](../dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md). Those harnesses feed the same locked constants; snapshots here are the durable record.

Production context: [`../dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md`](../dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md).

## Access

**Direct Lambda invoke only** (AWS Console, CLI, or SDK). Requires IAM `lambda:InvokeFunction` on `EphemeraFunction`.

Not exposed via API Gateway or WebSocket. Player sessions cannot reach these `event.type` payloads.

Handlers are read-only: Bedrock embed + compare (or, for the scene probe, Bedrock converse). No Dynamo writes, no `messageBus` publish, no game-state side effects. Worst case is Bedrock cost (same trust boundary as diagnostics sweeps).

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

## Scene reasoning probe

Standing operator tooling: puts questions about a rendered scene to a Nova model, for calibrating the prompt that reads the scene and the questions a reader can answer. Built for sceneProjection SP-7 (which text format of the scene model ships), and kept for later calibrations (user, 2026-11-03). SP-7 chose D, was reopened the same day, and the format axis came back: `D`, with the SP-10 multi-register renders `registers`, `affordance` and `examples`. `flatD` (D unindented) and `fans` (a block per host) were retired 2026-11-03 after they showed no gain under the `twoRegisters` answer format. Same access boundary as above; worst case is Bedrock cost. No test calls Bedrock.

**See what a batch would send (no Bedrock):** every fixture, its render in each format, and its questions with the prompt each sends and the expected answer.

```json
{ "type": "SceneReasoningFixtures" }
```

**Probe** (one Bedrock call per format x question x repeat, each a single prompt, no follow-up turn):

```json
{ "type": "SceneReasoningProbe", "scene": { "fixture": "tavern" }, "formats": ["D", "registers"], "questions": [{ "type": "placedOn", "subject": "cup1" }], "repeats": 3, "model": "NovaMicro" }
```

- `scene`: exactly one of `{ "fixture": name }` (a closed set compiled into the bundle; an unknown name is refused and the valid names listed) or `{ "characterId": "CHARACTER#..." }` (that character's live actor cache, reads only, no exits, no expected answers; `questions` required).
- `formats` defaults to `D`; `registers`, `affordance` and `examples` (the SP-10 multi-register renders) and `rulesD` and `rules` (D and `registers` with a tie's `secured` mark moved to a Rules section, one entry per securing, naming the relation as its fictional cause, and each row's relations naming their subject), the temporary `rulesAction` (`rules` with the rule stated as what each move does) and `judge` (the judge prompt's scene: `Scene:`, `Fiction:`, `Graph:` in a code fence, `Rules:`; pair it with the `judge` answer format) must be named; an unknown name is refused. `SceneReasoningFixtures` lists every fixture's render in each of them. `questions` defaults to the fixture's own set (shapes in [`sceneFixtures/questions.ts`](../dataSource/positions/ludicCache/sceneFixtures/questions.ts)); `repeats` defaults to 1; `model` defaults to `NovaMicro` and takes any `NovaModel`.
- **Cap: formats x questions x repeats <= 12**, so two formats at three repeats leave room for two questions; refused before any call. Temperature is 0.1; calls run concurrently with a 15s timeout each.
- **Repeats vary; use at least 3 when comparing wordings.** Reading questions mostly came back identical at temperature 0.1, but open questions do not: two repeats of one open question on Nova Micro answered yes and no (2026-11-03). Every SP-7 grade was one run per wording, so read those grades as single samples. A question can carry its own `asked` wording (scored against the same expected answer): run two wordings side by side before blaming the scene, since in the SP-7 batches the wording moved answers more than the format did.
- **Open questions test reasoning, not reading.** A reading question asks for structure back; an `{ "type": "open", "asked": "...", "rubric": "..." }` question asks the reader to reason over the scene (can a thing be done, and what would change). It gets its own answer instruction (optional reasoning headings "Constraints", "Blockers" and "Opportunities" first, each noted blocker solved or left standing, then explain and list changes in any notation) and up to 1024 output tokens (256 otherwise), has no expected answer and no `matches`, and is graded by hand against its `rubric`: a line written **before** the batch saying what a good answer must notice, so every answer meets the same bar. The `teaTable` fixture carries three.
- `answerFormats` (optional, default `["twoRegisters"]`): how an `open` question asks to be answered, one run per entry: `twoRegisters` (a check with "No candidate", a reason and a stop when the request names something not here, then the answer in two parts: what happens, in plain words and in order, then what is different afterwards, one move per thing whose own place changed), `abstain` (explain, then the changes, after the same check; kept as the comparison), or the judge's triage: `triageLabel` (answer `simple`, `complex` or `impossible`, label only), `triageReason` (one sentence of reason, then the label on its own line) and `triageWhyImpossible` (the label first, with one sentence only for `impossible`). All three require the text-adventure reading of a command (it acts on the thing as it stands, and what is on or in it goes along); `triageLegacy` is `triageWhyImpossible` without that, for comparison. `judge` is the judge prompt, whose baseline and known failures are in the [judgeFailures plan](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.judgeFailures.planning.md) (`frame/frameJudge.ts`): the whole prompt is composed differently (instructions, then the scene, then `Request: ` and the question's `asked` wording, which should be a request in the player's words), so use it with the `judge` scene format. Its reply is five lines ending `Answer: <label> <sentence>` over five labels (`impossible`, `obstructed`, `contingent`, `complex`, `simple`); `matches` compares the label after `Answer:` to the question's `triage`. A triage question is an `open` one carrying `triage`, the expected label, and its `matches` reads the reply's last word if that is a label, else its first word. `simple` and `impossible` are judgements; `complex` is none (this check cannot settle it). The dry run only vouches for graph edits, so the label is the only check on whether the action is possible in the fiction. Wording is untuned. `headings`, `plain` and `candidates` were retired 2026-11-03. Reading questions ignore it. The cap counts formats x answer formats x questions x repeats.
- `brief: true` (optional) returns each question's wording once and, per call, only `format`, `question` (its index), `repeat`, `answer`, `tokens`, and `expected` / `matches` where they exist: no scene, question or rubric repeated. Read the scene from `SceneReasoningFixtures`.
- **Returns**, per call: the rendered scene, the question and its wording, the model's answer, token usage, and for a fixture scene the expected answer with `matches`. `matches` is a **reading aid only**: the reply is split on commas and lines and compared as a set of handles (plus `room` / `held`, or a count); expectations tokens cannot carry (other-room or someone-else locations, `inside` or `notShown` targets) are unscored, and prose beyond them is never computed, so it under-reports. The user judges.
- The prompt frame (identical across questions except the scene text and the question) is composed from the layer modules in [`dataSource/actions/sceneProse/frame/`](../dataSource/actions/sceneProse/frame/index.ts) (reading, fiction, graph, answer formats), which are shared with any other reader of the scene; [`sceneReasoning/sceneReasoningPrompt.ts`](sceneReasoning/sceneReasoningPrompt.ts) keeps only the probe's typed question wording and its reading-question answer format. Treat its wording as a working hypothesis, not fixed: its comments record suspected faults (a Constraints gloss that may make ordinary placements read as fixed; a layout and answer format that may push a light model to edit the scene as a tree rather than reason about the world). An instruction inside `asked` does not override the frame, so test a frame change by changing the frame. It opens with a grounding block for every question, reading or open: the scene is what has been established and wins where general knowledge disagrees, while general knowledge fills in what things are like and what can be done with them. Results from before the grounding block (2026-11-02) are not comparable with results after it, and neither are results from before or during the `SECURED` passage, which was tried and removed on 2026-11-04. Its grounding and open-answer wording were tuned against both Nova models; the first production prompt to read the scene should start from them.

### Judge probe

`JudgeProbe` runs the judge prompt ([judgeFailures plan](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.judgeFailures.planning.md)) against a fixture's named request set and grades each reply in code. Same access boundary and cost as the scene reasoning probe.

```json
{ "type": "JudgeProbe", "scene": { "fixture": "teaTable" }, "set": "judge", "only": [3, 4], "repeats": 3, "model": "NovaMicro" }
```

- `scene.fixture` must hold a `judgeSets` entry named by `set` (default `judge`); a set is a list of [`JudgeRequest`](../dataSource/positions/ludicCache/sceneFixtures/judgeRequests.ts): the request in the player's words, its expected label, the labels tolerated as border cases, and `mentions` / `avoids` word lists.
- `only` picks requests by index; `repeats` defaults to 1. **Cap: requests x repeats <= 12**, refused before any call.
- `instructions` and `sceneText` (both optional) replace the judge's instruction text and the rendered scene for this invoke, to probe a draft; the deployed code is untouched. Together they replace the whole prompt except the `Request:` line, so a full draft from `judgeFailureDrafts/` splits into the two at its `Scene:` line. `instructions` must number the reply's steps, ending in `Answer`, and `sceneText` must name every handle the asked requests name; both are refused before any call. The result reports a short `hash`, the length and `overridden` for each, so two batches can be compared.
- `development: true` adds a `Recap:` line after `Answer` to the instructions in use, built or draft, for this invoke. It says why each test got its answer, as Micro tells it. A run with it on is for reading and not for scoring, since text anywhere in the prompt can change earlier lines of the reply.
- `proposedOutcome` (optional, off by default) shows each asked request that holds a `proposal` what its moves come to, in a block after `End of scene.` and before `Request:`. `{ "form": "after", "after": "fiction", "framing": "Proposed outcome", "explanation": "..." }`, every key optional, with those defaults and the built explanation: `form` is `moves`, `after` or `both`; `after` is `fiction` or `whole`; `framing` is the block's heading; `explanation` replaces the sentence on how to read it, which sits with the block and so is outside `instructions`. A request with no `proposal` gets the same prompt as with the field off. The moves run through a real dry run ([`proposedMoves.ts`](../dataSource/positions/manipulation/proposedMoves.ts)) and the after scene through the fold and the renderer, so a kernel change reaches the probes. A proposal the dry run refuses makes no call. The result gains `proposedOutcome`, with the settings and per request its `status` (`shown`, `none` or `refused`), and the `text` and `hash` shown or the `reason` refused. Only `teaTable` and `teaTableCupOnFloor` hold proposals.
- **Grading** ([`judgeGrade.ts`](sceneReasoning/judgeGrade.ts)): the label after `Answer:` is the verdict, `pass` for the expected label, `border` for a tolerated one, `failure` otherwise, a wrong `simple` always a failure (it has no recovery). The reply's form is checked against the numbered steps of the instructions in use, so a draft that adds a step is graded by its own form. `mentions` and `avoids` are lexical, flag a reply for reading and never fail it.
- **Returns** `summary` (totals, `wrongSimple`, `errors`, `malformed`, and per request the label counts and verdict counts) and `read`: every call, with the full reply and its grade.

## Scoring path (must match production)

1. `normalizeShortNameForEmbedding` (same as impromptu storage)
2. `embedNormalizedSemanticText` -> `invokeBedrockTitanEmbed` (Titan v2, 256d)
3. `SemanticEmbedding.fromFloat32` -> int8 quantization
4. `SemanticEmbedding.cosineSimilarity`
5. `simulateEmbeddingIdentity` / `decideEmbeddingMatch` for identity verdicts

Corpus definitions: [`objectMatch/corpus.ts`](objectMatch/corpus.ts). Pure scorer: [`objectMatch/runEmbeddingCalibration.ts`](objectMatch/runEmbeddingCalibration.ts). Repeat-invoke diagnostic: [`objectMatch/verifyRepeatBedrockEmbed.ts`](objectMatch/verifyRepeatBedrockEmbed.ts). Distance ladder: [`objectMatch/semanticDistanceLadder.ts`](objectMatch/semanticDistanceLadder.ts), [`objectMatch/runSemanticDistanceLadder.ts`](objectMatch/runSemanticDistanceLadder.ts). Asymmetric ladder: [`objectMatch/asymmetricIdentityLadder.ts`](objectMatch/asymmetricIdentityLadder.ts), [`objectMatch/runAsymmetricIdentityLadder.ts`](objectMatch/runAsymmetricIdentityLadder.ts).

## Interpreting output

### Absolute floors (production shim --- raw cosine)

| Constant | Role |
| --- | --- |
| `T_ABS` | Multi-candidate floor; primary guard when requested object is absent from catalog |
| `T_ABS_UNARY` | Unary catalog floor; must stay **> T_ABS** (no lexical backstop) |

**Ownership:** v1 terminal `decideEmbeddingMatch` only --- **not** pool admission. FT-5 selector will use `T_JOINT_*` on joint relevance (see below).

Use identity corpus bucket stats:

- **`absent-object`**: set `T_ABS` above max `sim_best` in this bucket
- **`unary-trap`** / **`synonym-without-shared-tokens`**: set `T_ABS_UNARY` above max `sim_best`; verify headroom over `T_ABS`
- **`positive-paraphrase`**: ensure chosen floors still allow resolve on `identity-003-broom-paraphrase`

### Pool metrics (FT-1.3 --- joint relevance scale)

`EmbeddingCalibrationCorpus` identity results now include per-case `poolMetrics` (`topJointRelevance`, `topMargin`, `shortlistSize`, `lexicalChannelActive`) and bucket summaries:

- `topJointRelevanceStats` --- min/median/max of head `jointRelevance` per bucket
- `topMarginStats` --- min/median/max of head `marginToRunnerUp`
- `shortlistSizeStats` --- gap-trim shortlist length distribution
- `suggestedJointFloorHeadroom` --- hints for FT-5 `T_JOINT_ABS` / `T_JOINT_MARGIN`

Use bucket stats to fit **FT-5 selector floors** (unwired until FT-5 ships):

| Constant | Role |
| --- | --- |
| `T_JOINT_ABS` | Multi-candidate minimum top-1 `jointRelevance` for auto-resolve |
| `T_JOINT_ABS_UNARY` | Unary-catalog joint floor; must stay **> T_JOINT_ABS** |
| `T_JOINT_MARGIN` | Minimum `jointRelevance` gap top-1 vs top-2 |

- **`absent-object` / `unary-trap`**: `T_JOINT_ABS` above max `topJointRelevance` in bucket
- **`positive-paraphrase`**: min `topJointRelevance` should clear `T_JOINT_ABS`; margin should clear `T_JOINT_MARGIN`
- **`duplicate-shortName`**: thin `topMargin` --- must stay below `T_JOINT_MARGIN`

Optional `resolveLexicalChannelActive` override on `runIdentityCorpus` / `simulateIdentityCalibration` for legacy gated baseline (harness). Production calibration uses gate-off default (FT-1.3.1).

Snapshot (mock Bedrock harness, 2026-07-09): **canonical** [`embedding-identity-pool-v1-2026-07-09-bias-sweep.json`](objectMatch/snapshots/embedding-identity-pool-v1-2026-07-09-bias-sweep.json) (FT-1.3.2-6 locked constants). Rolling default: [`embedding-identity-pool-v1-2026-07-09.json`](objectMatch/snapshots/embedding-identity-pool-v1-2026-07-09.json). Intermediate experiment snapshots (shortspan-mitigation, ratio-invariant, flank-weight-sweep, etc.) are local-only and not committed. Re-run live `EmbeddingCalibrationCorpus` on dev stack to confirm Titan headroom.

Regenerate mock snapshot (skipped by default under a blanket `npm run test` --- rewrites this file's `calibratedAt` --- so it's gated behind an env var): `RUN_CALIBRATION=1 npm run test -- --watchAll=false calibration/objectMatch/generatePoolCalibrationSnapshot.test.ts`

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

Use `EmbeddingAsymmetricLadder` before changing `EMBEDDING#IMPROMPTU` index semantics. Compare `delta` on `asym-010-paraphrase-broom` (target uplift) against `asym-050-absent-sword-vs-broom` and hard-negative tiers (false-positive risk). `compositionStudyResults` on flagged cases shows whether `shortName`, `shortNamePlusDescription`, or `descriptionOnly` is the best index shape. **Do not** use this ladder to lock current shortName-only `thresholds.ts` constants without also changing production embed storage. **Durable findings and closed-loop follow-on:** [`../dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md`](../dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md). **Trust-axis vocabulary:** [`../llm/AGENT.concepts.md`](../llm/AGENT.concepts.md) (**Output trust models**). Snapshot: [`asymmetric-identity-ladder-v1-2026-07-07.json`](objectMatch/snapshots/asymmetric-identity-ladder-v1-2026-07-07.json).

## When to re-run

Re-run `EmbeddingCalibrationCorpus` and update `thresholds.ts` provenance comment when any of these change:

- `BEDROCK_TITAN_EMBED_MODEL_ID`
- `SEMANTIC_EMBEDDING_V1_DIMENSIONS` or encoding
- Normalization rules in `normalizeShortNameForEmbedding`

Optional: commit snapshot JSON under [`objectMatch/snapshots/`](objectMatch/snapshots/) after a live run for model-migration diffs.

- v1 shim (2026-07-07): `T_ABS=0.14`, `T_ABS_UNARY=0.18`, `T_MARGIN=0.008` --- [`embedding-identity-v1-2026-07-07.json`](objectMatch/snapshots/embedding-identity-v1-2026-07-07.json)
- FT-1.3 pool metrics (2026-07-09): `T_JOINT_ABS=0.42`, `T_JOINT_MARGIN=0.08`, `T_JOINT_ABS_UNARY=0.48` + FT-8/FT-1.2 constants --- [`thresholds.ts`](../dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts), canonical [`embedding-identity-pool-v1-2026-07-09-bias-sweep.json`](objectMatch/snapshots/embedding-identity-pool-v1-2026-07-09-bias-sweep.json)

## Local verification (mocked Bedrock)

```bash
cd lambda/ephemera && npm run test -- --watchAll=false calibration/
```
