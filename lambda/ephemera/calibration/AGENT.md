# Ephemera calibration (operator Bedrock tooling)

Dev-only **read-only** operator tooling reached by direct Lambda invoke. Three trees: object-identity embedding calibration under [`objectMatch/`](objectMatch/) (the bulk of this doc), the scene reasoning probe under [`sceneReasoning/`](sceneReasoning/) (see [Scene reasoning probe](#scene-reasoning-probe)), and the oracle probe under [`oracleLoop/`](oracleLoop/), a prototype owned by the oracle loop plan (see [Oracle probe](#oracle-probe)). Embedding calibration tunes object-identity thresholds; production gates consume locked constants in [`embeddingMatch/thresholds.ts`](../dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts).

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
- `answerFormats` (optional, default `["twoRegisters"]`): how an `open` question asks to be answered, one run per entry: `twoRegisters` (a check with "No candidate", a reason and a stop when the request names something not here, then the answer in two parts: what happens, in plain words and in order, then what is different afterwards, one move per thing whose own place changed), `abstain` (explain, then the changes, after the same check; kept as the comparison), or the judge's triage: `triageLabel` (answer `simple`, `complex` or `impossible`, label only), `triageReason` (one sentence of reason, then the label on its own line) and `triageWhyImpossible` (the label first, with one sentence only for `impossible`). All three require the text-adventure reading of a command (it acts on the thing as it stands, and what is on or in it goes along); `triageLegacy` is `triageWhyImpossible` without that, for comparison. `judge` is the judge prompt, described under [The built judge prompt (v45)](#the-built-judge-prompt-v45) (`frame/frameJudge.ts`): the whole prompt is composed differently (instructions, then the scene, then `Request: ` and the question's `asked` wording, which should be a request in the player's words), so use it with the `judge` scene format. Its reply is five lines ending `Answer: <label> <sentence>` over five labels (`impossible`, `obstructed`, `contingent`, `complex`, `simple`); `matches` compares the label after `Answer:` to the question's `triage`. A triage question is an `open` one carrying `triage`, the expected label, and its `matches` reads the reply's last word if that is a label, else its first word. `simple` and `impossible` are judgements; `complex` is none (this check cannot settle it). The dry run only vouches for graph edits, so the label is the only check on whether the action is possible in the fiction. Wording is untuned. `headings`, `plain` and `candidates` were retired 2026-11-03. Reading questions ignore it. The cap counts formats x answer formats x questions x repeats.
- `brief: true` (optional) returns each question's wording once and, per call, only `format`, `question` (its index), `repeat`, `answer`, `tokens`, and `expected` / `matches` where they exist: no scene, question or rubric repeated. Read the scene from `SceneReasoningFixtures`.
- **Returns**, per call: the rendered scene, the question and its wording, the model's answer, token usage, and for a fixture scene the expected answer with `matches`. `matches` is a **reading aid only**: the reply is split on commas and lines and compared as a set of handles (plus `room` / `held`, or a count); expectations tokens cannot carry (other-room or someone-else locations, `inside` or `notShown` targets) are unscored, and prose beyond them is never computed, so it under-reports. The user judges.
- The prompt frame (identical across questions except the scene text and the question) is composed from the layer modules in [`dataSource/actions/sceneProse/frame/`](../dataSource/actions/sceneProse/frame/index.ts) (reading, fiction, graph, answer formats), which are shared with any other reader of the scene; [`sceneReasoning/sceneReasoningPrompt.ts`](sceneReasoning/sceneReasoningPrompt.ts) keeps only the probe's typed question wording and its reading-question answer format. Treat its wording as a working hypothesis, not fixed: its comments record suspected faults (a Constraints gloss that may make ordinary placements read as fixed; a layout and answer format that may push a light model to edit the scene as a tree rather than reason about the world). An instruction inside `asked` does not override the frame, so test a frame change by changing the frame. It opens with a grounding block for every question, reading or open: the scene is what has been established and wins where general knowledge disagrees, while general knowledge fills in what things are like and what can be done with them. Results from before the grounding block (2026-11-02) are not comparable with results after it, and neither are results from before or during the `SECURED` passage, which was tried and removed on 2026-11-04. Its grounding and open-answer wording were tuned against both Nova models; the first production prompt to read the scene should start from them.

### Judge probe

`JudgeProbe` runs the judge prompt ([the built prompt](#the-built-judge-prompt-v45); its next form is the [oracle loop plan](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.oracleLoop.planning.md), whose drafts run on the [oracle probe](#oracle-probe)) against a fixture's named request set and grades each reply in code. Same access boundary and cost as the scene reasoning probe.

```json
{ "type": "JudgeProbe", "scene": { "fixture": "teaTable" }, "set": "judge", "only": [3, 4], "repeats": 3, "model": "NovaMicro" }
```

- `scene.fixture` must hold a `judgeSets` entry named by `set` (default `judge`); a set is a list of [`JudgeRequest`](../dataSource/positions/ludicCache/sceneFixtures/judgeRequests.ts): the request in the player's words, its expected label, the labels tolerated as border cases, and `mentions` / `avoids` word lists.
- `only` picks requests by index; `repeats` defaults to 1. **Cap: requests x repeats <= 12**, refused before any call.
- `instructions` and `sceneText` (both optional) replace the judge's instruction text and the rendered scene for this invoke, to probe a draft; the deployed code is untouched. Together they replace the whole prompt except the `Request:` line, so a full draft (one prompt as a single text file) splits into the two at its `Scene:` line. `instructions` must number the reply's steps, ending in `Answer`, and `sceneText` must name every handle the asked requests name; both are refused before any call. The result reports a short `hash`, the length and `overridden` for each, so two batches can be compared.
- `development: true` adds a `Recap:` line after `Answer` to the instructions in use, built or draft, for this invoke. It says why each test got its answer, as Micro tells it. A run with it on is for reading and not for scoring, since text anywhere in the prompt can change earlier lines of the reply.
- `proposedOutcome` (optional, off by default) shows each asked request that holds a `proposal` what its moves come to, in a block after `End of scene.` and before `Request:`. `{ "form": "after", "after": "fiction", "framing": "Proposed outcome", "explanation": "..." }`, every key optional, with those defaults and the built explanation: `form` is `moves`, `after` or `both`; `after` is `fiction` or `whole`; `framing` is the block's heading; `explanation` replaces the sentence on how to read it, which sits with the block and so is outside `instructions`. A request with no `proposal` gets the same prompt as with the field off. The moves run through a real dry run ([`proposedMoves.ts`](../dataSource/positions/manipulation/proposedMoves.ts)) and the after scene through the fold and the renderer, so a kernel change reaches the probes. A proposal the dry run refuses makes no call. The result gains `proposedOutcome`, with the settings and per request its `status` (`shown`, `none` or `refused`), and the `text` and `hash` shown or the `reason` refused. Only `teaTable` and `teaTableCupOnFloor` hold proposals.
- **Grading** ([`judgeGrade.ts`](sceneReasoning/judgeGrade.ts)): the label after `Answer:` is the verdict, `pass` for the expected label, `border` for a tolerated one, `failure` otherwise, a wrong `simple` always a failure (it has no recovery). The reply's form is checked against the numbered steps of the instructions in use, so a draft that adds a step is graded by its own form. `mentions` and `avoids` are lexical, flag a reply for reading and never fail it.
- **Returns** `summary` (totals, `wrongSimple`, `errors`, `malformed`, and per request the label counts and verdict counts) and `read`: every call, with the full reply and its grade.

### Oracle probe

`OracleProbe` runs a draft of the comparative oracle against the harness's cases ([`oracleLoop/`](oracleLoop/)). It is a **Prototype** of the [oracle loop plan](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.oracleLoop.planning.md) (Slice 3): its types are a guess the drafts revise, nothing in production reads it, and it goes when that plan closes. Same access boundary and cost as the judge probe.

```json
{ "type": "OracleProbe", "cases": ["OC-1", "OC-6"], "instructions": "...", "repeats": 3, "model": "NovaMicro" }
```

- `cases`: corpus case IDs, with a round suffix where a case runs over rounds (`OC-30/2`). Each case is a scene fixture, a request and the oracle's inputs (the answer-to-beat, the player's answers, the round record, candidates), in the types of [`oracleInputs.ts`](oracleLoop/oracleInputs.ts); cases from different fixtures share an invoke. The cases are in [`oracleCases.ts`](oracleLoop/oracleCases.ts), each with its `endResult`, the corpus's expected end result, which the reader grades against.
- `instructions` is required, since there is no built oracle prompt, and must number the reply's steps ending in `Answer`. `development: true` adds the recap, as on the judge probe. **Cap: cases x repeats <= 12**, refused before any call.
- The prompt is the draft, the case's scene in the `judge` render, the inputs block after `End of scene.`, then `Request:`. The block's headings are defaults (`ORACLE_FRAMING` in [`renderOracleInputs.ts`](oracleLoop/renderOracleInputs.ts)), each replaceable through `framing`, so the wording stays in the drafts. Each step is an action in words; a step the kernel knows adds its record change on an indented line, the dry run's move line under `framing.record` with the verb `framing.recordVerb` (`record:` and `moves` by default), and only those changes go to the dry run. A step that declares the rules it sets out to void (`voids`, by rule handle) adds another indented line under `framing.voids` (`sets out to void` by default); the oracle judges the declaration. A template candidate gets the built proposal explanation, since only the dry run has checked it; the dry run refusing a case's candidate refuses the invoke. `show`: `after` (`none` by default, or `fiction` or `whole`) adds the scene after a candidate's changes, and `suppliedBy` (on by default) marks who supplied each step. `rules` words the scene's Rules section: `v45` (the default, the built judge's) or `violation`, each rule as a test of a method (it keeps the rule by moving the two things together or by first changing the fact; it breaks it by moving them apart beyond what the relation allows while the fact holds), or `inForce`, each rule as what it blocks while in force (moving the two apart beyond what the relation allows) and what voids it (making the fact no longer true); the result reports it.
- There is no `sceneText` override. A draft that needs to say something the inputs can't carry goes back to `JudgeProbe` with `sceneText`, which is the plan's signal that the input types need revising.
- **Grading is form only:** each reply's steps against the draft's numbered steps. No label is graded. **Returns** each case's request, `endResult`, the hashes of its scene and inputs and the inputs' text, then `summary` (calls, errors, malformed) and `read`, every reply with its form.

### Piece probe

`PieceProbe` runs a draft of one piece against that piece's cells, and grades each reply in code against the cell's expected answer, or groups the replies for a reader. The harness is [`pieceProbe/`](pieceProbe/); the pieces are kept by family, the oracle's judging pieces in [`oraclePieces/`](oraclePieces/) and the imagination's generating pieces in [`imaginationPieces/`](imaginationPieces/). A piece makes one judgment per call. Built as the [oracle loop plan](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.oracleLoop.planning.md)'s Slice 4.5. **The harness and the pieces have different lifetimes** (the user, 2026-11-16): the harness is a lasting tuning tool, kept as long as prompts in this area are tuned, and it doesn't go when the parent closes. The pieces are Prototypes: their prompts, renders and checks are trial versions of what production will run, and they graduate when production takes them over. Nothing in production reads the probe. Same access boundary and cost as the judge probe.

```json
{ "type": "PieceProbe", "piece": "ruleCell", "instructions": "...", "repeats": 3, "model": "NovaMicro" }
```

- **A piece plugs in with a registration** ([`oraclePiece.ts`](pieceProbe/oraclePiece.ts)), listed in [`pieces.ts`](pieceProbe/pieces.ts) through `registerPiece`. A piece is **answered** or **read**; the registration below is the answered kind, and [a read piece](#a-read-piece) differs where it says so:
  - `name`;
  - `answers`, its closed answer set;
  - `cells` by ID, each with its `inputs`, `expected` answer, `source` (the batch and reply it was lifted from, or `hand-written`) and an optional `note`. An optional `lookFor` says what a reader looks for in the parts of a reply code doesn't grade, and is carried into the tally. A cell with no `expected` has an open answer: its calls are tallied and not graded;
  - `parseOptions`, which checks the event's `options` and gives the piece's options or a refusal;
  - `render(cell, options)`, the prompt text after the instructions, which is async so it can build a fixture's scene;
  - optionally `renderParts(cell, options)`, the render built in code as two strings, `{ system, user }`, for system delivery (below). Nothing splits a rendered string at run time. Where a piece has it, `render` is `joinParts` of the two (the system part, a blank line, the user part), byte for byte, so the inputs hash and the checks read the same text under either delivery. The trial's verdict has it: the scene, the request and the steps are its system part, and the question and the two tagged sides its user part;
  - optionally `byCode(cell)`, an answer code gives without a call;
  - optionally `grade(reply, cell, rendered, options)`, the piece's own grade in place of the one below, for answers with parameters or a stage's contract parse. It receives the cell's rendered text and the payload's parsed options, as a read piece's `check` does. It gives an answer string in the piece's canonical form, which its cells' `expected` uses, or `malformed` with the reason. `replyJsonObject` in [`llm/stageContract.ts`](../llm/stageContract.ts) reads the reply's block for it;
  - optionally `maxTokens`, the output cap per call, as a read piece's.

  A piece that needs more than this to plug in is the plan's revision trigger.
- **A family of stages** (`PieceFamily`, `registerFamily` in [`oraclePiece.ts`](pieceProbe/oraclePiece.ts)) registers several pieces under one name: stages that share their cells' inputs, each a piece of its own, read or answered, with its own render, check or grade, and cap. The trial is one. A payload names the stage in `options.stage`, and the rest of `options` goes to that stage's `parseOptions`; a missing or unknown stage is refused with the list of stages (`resolvePiece` in [`handlePieceProbe.ts`](pieceProbe/handlePieceProbe.ts)). Everything after runs on the stage as on any piece, and the response names `piece` (the family) and `stage`. Each payload runs one stage: an earlier stage's part is a recorded value (golden or lifted, below), never a live call.
  ```json
  { "type": "PieceProbe", "piece": "trial", "options": { "stage": "rebuttal", "upstream": "golden" }, "instructions": "...", "repeats": 1 }
  ```
- `piece` is required. `cells` defaults to all of the piece's cells. `instructions` is required, since a piece has no built prompt. `repeats` defaults to 1, `model` to `NovaMicro`, `delivery` to `user`, and `options` goes to the piece.
- **Cap: called cells x repeats <= 24** (`PIECE_PROBE_CALL_CAP`, its own constant, apart from the other probes' 12). Cells answered by code don't count. Every refusal happens before the first call: an unknown piece or cell, no instructions, bad repeats, model or delivery, system delivery on a piece without `renderParts`, options the piece refuses, over the cap, or a render that fails.
- **The prompt** (`promptFor` in [`oraclePiece.ts`](pieceProbe/oraclePiece.ts)) is, under `delivery: 'user'`, the instructions, a blank line, then the cell's render, in one user message. Under `delivery: 'system'` ([trialQuestion step 0.5](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.trialQuestion.planning.md)), the instructions, a blank line, then the render's system part go as the call's system instructions, and its user part is the user message: the same text in the same order, in two messages. The inputs hash is the same under both, so the response's `delivery` is what tells two batches apart. There is no recap, and an answered piece has no form check beyond its grade.
- **Grading** ([`pieceAnswer.ts`](pieceProbe/pieceAnswer.ts)): a reply that ends in a JSON object, best as a trailing fenced `json` block after prose reasoning, is graded by its string `answer` field, trimmed and lowercased. The split is `splitMarkdownReasoningAndJson` in [`llm/`](../llm/AGENT.md), the house shape for reasoning then JSON. Any other reply is graded by its last line starting `Answer:`: its first word, lowercased and with trailing punctuation dropped. Anything after that first word is ignored. When a reply has both, the JSON wins. A reply with neither, JSON that doesn't parse or has no string `answer`, or an answer outside the set, is `malformed`, with the reason. The verdict goes last, as Micro needs.
- **Returns:**
  - the instructions' `hash` and `chars`, the `delivery`, and the parsed `options`;
  - **`cells` first:** for each cell, its `expected` answer and `lookFor`, where it has them; `n` calls, with `right`, `wrong` (both 0 with no `expected`), `malformed` and `errors`; the `answers` given, with counts; `byCode` (the answer and whether it is right) where code answered; and the rendered inputs' `hash`;
  - `summary`: calls, right, wrong, malformed, errors, the count of cells answered by code, and `ungraded`, the calls on cells with no `expected`;
  - `read`: every call, with its reply and grade, for reading the wrong ones.

#### A read piece

A piece with no closed answer set, such as a generator, is registered with `kind: 'read'` ([`oraclePiece.ts`](pieceProbe/oraclePiece.ts)) and graded by hand: code checks form, and a reader reads the replies. The call loop, the refusals, the cap and the prompt are the same as an answered piece's.
- **Registration:** `name`, `cells`, `parseOptions` and `render` as above, with no `answers` and no `byCode` (every cell is called). Each cell carries a `lookFor`, what a reader looks for, written before the batch, in place of `expected`. And `check(reply, cell, rendered, options)` gives the form problems of one reply as a list of reasons, empty when it passes. An optional `maxTokens` raises the output cap per call from the judge probe's 512 (the play-by-play's is 1024). The check also receives the cell's rendered text, for a check that matches quotes against what the prompt showed (the trial's rebuttal), and the payload's parsed options, for a stage resolving its upstream input.
- **Returns** ([`readPiece.ts`](pieceProbe/readPiece.ts)):
  - the instructions' `hash` and `chars`, the `delivery`, and the parsed `options`;
  - **`cells` first:** for each cell, its `lookFor`; `n` calls, with `formPasses`, `formFails` and `errors`; each failure's `problems` with its repeat; and the rendered inputs' `hash`;
  - `summary`: calls, form fails and errors;
  - `read`: **the replies grouped by cell**, in the order asked, each group with its `lookFor` and its replies (repeat, reply and form problems, or the call's error).

**The rule cell** (`ruleCell`, [`oraclePieces/ruleCell.ts`](oraclePieces/ruleCell.ts)) is the first piece, the user's rules-blocking piece. Its answers are `blocks` and `allows`.
- **A cell's inputs:**
  - a fixture;
  - a rule handle, as `judgeRules` in `sceneRules.ts` names it on the full scene;
  - the plan's actions in order, each with what the play-by-play says each of the rule's things does (`motions`, keyed by exactly the rule's two ends);
  - optionally `voidedAt`, the action that voids the rule, counted from 1.
- **The window** is code's: the actions before the voiding one, or all of them. An empty window is `allows` by code. So every action the cell sees is one the rule is in force for.
- **The rule is shown in parts** (user, 2026-11-10): its fact and its enforcing rubric, from `judgeRules`' `parts`, with nothing about voiding or being in force. A rule in the abstract has an enforcing rubric, a voiding rubric and a consequence, and each piece shows only the part it uses. The consequence (user, 2026-11-10) is what the rule does when the thing its subject is secured to changes its position or orientation: the subject moves with it. It runs from the securing edge's target to its subject, so moving the subject away is left to the enforcing rubric. The one-prompt wordings (`v45`, `violation`, `inForce`) are unchanged.
- **Options:**
  - `show` (`subScene` or `none`), by default the rule's things' [sub-scene](../dataSource/actions/AGENT.md), which keeps what a cell needs to know about what each thing is and where it sits, and leaves out the rest of the scene that one-prompt replies wandered into (user);
  - `sceneRules`, whether the sub-scene shows its own Rules section, in the `v45` wording, by default `false` (user: the cell doesn't judge rules that interact).
- **The render:**
  1. the sub-scene as the judge shows it (`Scene:`, `Fiction`, `Graph`, `End of scene.`);
  2. `Rule:`, with the one rule's handle, fact and enforcing rubric;
  3. `The rule's things:`;
  4. `Action n: …` for each action in the window, with a `- [handle]: motion` line for each of the rule's things.

  The render throws on cell data that doesn't fit the fixture: an unknown rule, motions naming other things than the rule's, or a `voidedAt` that is not an action. The probe turns that into a refusal.
- **Cells:** `OC-1`, `OC-6/tilted`, `OC-6/stays`, `OC-30/2/tipped`, `OC-30/2/together`, `OC-30/2/slides`, `OC-19/voided` (by code), `OC-19/glued` and `OC-20`. Each is graded given its play-by-play. `OC-6/stays` is wrong about the case on purpose. The motion wording is hand-written, paraphrased where a cell cites batch 16, and reviewed by the user. `OC-30/2/slides` was added after draft 1, to test whether the lines are read when the action sounds like moving together and the lines say the two move apart.
- **Settled on draft 3** (2026-11-10, Micro; [`oracleLoopDrafts/ruleCell/`](../../../taskPlanning/lambda/ephemera/dataSource/actions/oracleLoopDrafts/ruleCell/iterations.md)): 46 of 48 calls right over two batches, 0 malformed. The draft asks for one or two sentences on what the lines say about how the two things move relative to each other, then the verdict as a fenced `json` block. The two misses were on different cells. One was a half-wrong description. The other was a right description followed by a verdict that doesn't follow from it, which is left open. Text after the block, which about half the replies add, is graded as long as it holds no brace.

**The non-rule cell** (`nonRuleCell`, [`oraclePieces/nonRuleCell.ts`](oraclePieces/nonRuleCell.ts)) judges whether a plan can go ahead for reasons no rule names, such as stuffing a table into a teacup. It is the first piece to answer with a verdict **or** a request ([its plan](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.nonRuleCell.planning.md)). Its drafts are in [`oracleLoopDrafts/nonRuleCell/`](../../../taskPlanning/lambda/ephemera/dataSource/actions/oracleLoopDrafts/nonRuleCell/iterations.md).
- **A cell's inputs:**
  - a fixture;
  - the player's request;
  - the plan's steps in order, each with its role, `intended` (what the request states) or `method` (a step supplied to carry it out), and optionally the consequence lines it causes, as `consequences` gives them per action.
- **Options:** none, or `{ "scene": "explicit" }` for the explicit render (`renderSceneExplicit`) in place of the Fiction and Graph, the securing still shown as the scene has it. It's a retest of the trial question plan's step 1.5. With no options, the render is as before, byte for byte.
- **The render:** the **whole** scene as the judge shows it, with no Rules section, since securing is the rule cell's; `The player's request: …`; then `The steps, in order:`, one `- (role) step` line each, unnumbered, with each consequence line under its step as `  - (consequence) line`. It throws when there are no steps, the request is empty, a handle isn't in the fixture, or two steps or lines are the same once normalized.
- **The answer** is one fenced `json` block, after prose that walks every step (the non-branching walk, from draft 3): `{"steps": [...]}`, one entry per step in order, each quoting its step, with a `finding` and what it `establishes`:
  - `works`;
  - `blocked`, with `reason`, and optionally `cause` (an earlier step or consequence line to blame, quoted; draft 5). A `cause` that is absent, or that quotes nothing given, means the blocked step itself;
  - `needs detail`, with `of` (`action` or `consequences`) and `missing`.
- **The grade** (`gradeNonRuleCell`):
  - the block has to parse, with an entry per step; each entry's `finding` has to be one of the three, with its own fields as non-empty strings and none of the others'. Fields no finding has are ignored, so a draft can add a slot read only by hand, such as draft 4's `for and against` or draft 5's `factors`;
  - each quote is matched after case, brackets, whitespace, surrounding quotes and end punctuation are normalized: whole first, otherwise inside exactly one candidate on word boundaries. An entry's `step` has to match its own step; a `cause` is matched among the steps and their lines, at or before the blocked step; a quote of several things is malformed;
  - code applies the first-non-works rule: the canonical answer is `allows`, `blocks <step>/<cause>` or `needs detail of <of> <step>`, by position from 1, a cause on a consequence line as `NcK` (line K under step N). The later findings, `establishes`, `reason` and `missing` are read by hand against each cell's `lookFor`.
- **The cap:** `maxTokens` 1536, since every step gets an entry and draft 5 lists its factors in the prose and again in the block (1024 for drafts 3 and 4).
- **Cells:**
  - the size cases OC-11, OC-18 and OC-3;
  - the guards OC-1, OC-2, OC-20 and OC-6;
  - the OC-30 chain's hops h5 (`needs detail of consequences 1`), h7 (the tip with the slide as its consequence line, `blocks 2/1c1`) and h10, with the intent amended to pour into the cup;
  - OC-9, the trestle, with no `expected` (JF-2).

  Eleven called cells x3 is over the cap, so a full batch is two payloads.

**Step considerations** (`stepConsiderations`, [`oraclePieces/stepConsiderations.ts`](oraclePieces/stepConsiderations.ts)) is a read piece on the non-rule cell's inputs. For each step it lists, in free text, what someone judging whether the step can happen should be considering, and it gives no finding. Judging the list is a later pass, so the finding's categories can't steer the list (the non-rule cell's drafts 4 and 5). Its drafts are in [`oracleLoopDrafts/stepConsiderations/`](../../../taskPlanning/lambda/ephemera/dataSource/actions/oracleLoopDrafts/stepConsiderations/iterations.md).
- **Inputs, render and cells:** the non-rule cell's, reused, so their inputs hashes match. Each cell gets its own `lookFor`: what a good list considers.
- **The check:** one fenced `json` block holding `{"steps": [...]}`, with an entry per step in order. Each entry quotes its own step (matched as the non-rule cell matches) and has `considering`, a non-empty list of non-empty strings. Every problem is listed. Other fields are ignored.
- **The cap:** `maxTokens` 1024.

**The trial** ([the trial proposal](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.nonRuleCell.planning.md#the-trial-proposal-argue-against-rebut-judge)) is three small biased calls in place of one balanced one: the case against, a rebuttal, and a judgment between them. They are built one at a time, as the stages of one family, `trial` ([`oraclePieces/trial/`](oraclePieces/trial/index.ts); [the family's design](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.nonRuleCell.planning.md#the-trial-family-one-harness-kind-the-stage-by-specifier)). Its cells are one record per cell in [`trialCases.ts`](oraclePieces/trial/trialCases.ts): the non-rule cell's inputs, source and note, a golden and a lifted value for each later stage's input (the argument, for the rebuttal and the verdict; the rebuttal, for the verdict), a `lookFor` per stage, and the verdict's expected answer. **Each stage exports its `contract`** ([Slice B's design](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.nonRuleCell.planning.md#slice-bs-design-the-verdict-and-the-stage-contract)), a `StageContract` from [`llm/stageContract.ts`](../llm/stageContract.ts): the stage's `Input` and `Output` types, and `parse(reply, { input, rendered })`, which gives the output or every form problem. The stage's probe check or grade is that parse, and a lifted value is that parse's output. The contracts stay here until production takes the oracle over. Each stage's renders are pinned to the inputs hashes its batches reported ([`renderPins.test.ts`](oraclePieces/trial/renderPins.test.ts)), so a change that moves a prompt by a byte fails a test. The drafts are in [`oracleLoopDrafts/trial/`](../../../taskPlanning/lambda/ephemera/dataSource/actions/oracleLoopDrafts/trial/iterations.md); batches up to 8 ran as the separate pieces `trialAgainst` and `trialRebuttal`.
- **The case against** (stage `against`, [`oraclePieces/trial/against.ts`](oraclePieces/trial/against.ts)) is a read piece on the non-rule cell's inputs and render, reused. It gives the yes-or-no question whose answer does the most to show the plan can't happen, the answer that would (`blocking`, so a rebuttal can attack the inference), the step it turns on and why, as `{"question": …, "blocking": "yes" | "no", "step": …, "argument": …}` (the trial question plan's step 2). The check: the block parses, `question` and `argument` are non-empty strings, `blocking` is yes or no (trimmed, any case), and `step` quotes one of the plan's steps (matched as the non-rule cell matches). `maxTokens` 400. Its options besides `stage`: `securing`, `shown` (the default) or `omitted`, and `scene`, the judge render when absent or `explicit`, which swaps only the scene block. It takes no `upstream`, being the first stage. `omitted` renders the scene without its securing (`withoutSecuring` in `sceneRules.ts` drops each tie and bare `SecuredTo`), since the rule cell judges the securing in its own call. An argument recorded before the question and `blocking` doesn't fit the current contract (`fitsCurrentContract`), so a later stage refuses it as `lifted`.
- **The rebuttal** (stage `rebuttal`, [`oraclePieces/trial/rebuttal.ts`](oraclePieces/trial/rebuttal.ts)) is a read piece. Its cells are the non-rule cell's inputs, each with an argument lifted word for word from an against batch. The render is the non-rule cell's with the securing omitted, then `The argument against the plan, turning on the step "…": …`. From draft 3 the render gives the question the argument answers, `The question the argument answers: …`, before the argument. Each cell's argument has a `golden` and a `lifted` source (below), and the payload names which. The reply (draft 5) is `{"rebuttal": "<one sentence>"}`, in the user's shape: `Incoming argues '<the argument's answer, briefly>', but` then one of `the scene says '<line>'`, `the steps say '<step>'`, `common sense indicates that '<claim>' is actually true`, or `the only facts the scene and the steps establish about <[handle]> are: '<line>', …`. The summary is optional: the render ends on the argument, so a reply opening at the pivot ("But the scene says …") answers it in place (TR-P12). The scene and steps sources may be joined ("the scene says '…', and the steps say '…'"), and whatever follows the quotes ("which implies …") is the claim, read, not checked. The check parses that sentence (`parseRebuttal`, quote characters read leniently). A scene or steps source must quote one of the render's scene or step lines (`evidenceLines`), and in the facts branch the handle must be in the scene and each fact must quote a line naming it. A facts list, too, may be followed by a claim, read, not checked (TR-P13). A common-sense claim is read, not checked. The match (`quotesALine`) ignores punctuation and case. A quote may carry the render's furniture: a list marker, a role label in either spelling, a `Fiction:` or `Graph:` prefix, or several Graph rows with their header, or several Fiction sentences, each matching. An elision is a misquote.
- **The verdict** (stage `verdict`, [`oraclePieces/trial/verdict.ts`](oraclePieces/trial/verdict.ts)) is an answered piece, the trial's one unbiased call. Its cells are the trial's records with both upstream stages. The render is the rebuttal's scene and question (`renderArguedParts`), then the two sides each in a tag naming its stance on the plan (from draft 5): the argument line in `<argues-plan-cannot-happen>`, then `The rebuttal: <sentence>` in `<argues-plan-can-happen>`. The reply ends in `{"answer": "argument" | "rebuttal"}`: which of the two argued better (from draft 2; draft 1 asked which was right about the argument's question). It is graded through the contract (the block parses, the answer is one of the two; no `Answer:` line) against each cell's `expected`; OC-9 has none, so it is tallied, not graded. Each expected answer is which side argued better on that cell's pair. Its options are `upstream` and, optionally, `scene: 'explicit'` (step 1.5's retest), which swaps only the scene block for the explicit render, via `renderArguedParts`' own `scene` option. `maxTokens` is 400. The argument and the rebuttal come as a pair (`pickPaired`, below). The lifted rebuttals are batch 8's, each recorded with the golden argument it answered. No golden rebuttals are written yet, so `upstream: 'golden'` is refused.
- **The ruling** (stage `ruling`, [`oraclePieces/trial/ruling.ts`](oraclePieces/trial/ruling.ts); a prototype of the [trial question plan](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.trialQuestion.planning.md)'s step 1) is an answered piece: the judge answers the case against's question alone, with nothing argued in view. The render is the non-rule cell's with the securing omitted and the scene in the explicit render (`renderNonRuleCell`'s `scene: 'explicit'`, which swaps only the scene block), then `The question: …`. It never sees `blocking`, which is argued material. The reply ends in `{"answer": "yes" | "no"}`, and the grade reads that answer through the argument's `blocking` into the plan's outcome, `blocks` or `allows`, so a question of either polarity is graded alike. Each cell's expected outcome is its `expected.ruling` read through the golden's `blocking` (OC-9 open). On the golden questions, that grading matches grading the answer itself. Its option is `upstream`; `lifted` renders once the lifted arguments carry a question and `blocking`. `maxTokens` is 400. It has no `renderParts`.
- **Golden and lifted inputs** ([`pieceProbe/stageInput.ts`](pieceProbe/stageInput.ts)), for a piece fed by an earlier stage. Each cell's earlier-stage part has `golden` (hand-written in that stage's contract form) and `lifted` (a real output, with its source). The piece takes `{ upstream: 'golden' | 'lifted' }`, with no default. A cell without the named source, or with a value recorded under an older contract, throws at render, so the probe refuses the payload as a cell-data error. A lifted value that answered an earlier stage records what it `consumed`: that stage's source and the hash of the value it read (`stageValueHash`, over sorted-key JSON). A stage reading two upstream values pairs them with `pickPaired`: `lifted` takes the lifted value, then the earlier value from the source it consumed, with the hash checked, so an edit since breaks the pair loudly; `golden` takes golden all the way up. `pickPaired`'s `read` names the part of the earlier value the later stage was shown, and the hash is over that part, so a field added to the earlier contract since (the case against's `blocking`, which the rebuttal never sees: `arguedAsRebutted`) doesn't break the pair. The lifted rebuttals' consumed hashes are stored as literals, not computed from today's goldens, so the check is real. The rebuttal's option is `upstream`, and its `maxTokens` is 600.

**Scene reading** (`sceneReading`, [`oraclePieces/sceneReading.ts`](oraclePieces/sceneReading.ts)) is an answered piece: one yes-or-no question asked of a scene alone, with no request, no steps and nothing argued. It compares two renders of one scene for the [trial question plan](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.trialQuestion.planning.md)'s step 0. Its drafts are the trial's `reading.N` files.
- **A cell's inputs:** a fixture, read from a trial case's (`nonRuleCellCells`), and the question.
- **Option:** `render`, `sections` or `explicit`, required, since each arm has its own draft.
- **The render:**
  - the scene with the securing removed (`withoutSecuring`), in either of two renders:
    - `sections`, the judge render (`renderSceneJudge`), byte for byte the trial's scene;
    - `explicit`, the explicit render (`renderSceneExplicit` in `sceneProse/`): the Fiction, then a line per thing saying where it is, what is on or in it, a conditional carry line, and "In everything the scene doesn't say, [x] is as an ordinary … is";
  - then `The question: …`.

  It throws when the question names a thing not in the fixture.
- **The answers:** `yes` and `no`, graded by the default grade. `maxTokens` is 400.
- **Cells:** R-1 and R-3 to R-9 (there is no R-2), each aimed at one of the trial's misses.

**The play-by-play** (`playByPlay`, [`imaginationPieces/playByPlay.ts`](imaginationPieces/playByPlay.ts)) is the first read piece: how each of a candidate's actions would ordinarily be done, as what each thing the actions name does physically, and what in the scene might get in the way. Its drafts are in [`oracleLoopDrafts/playByPlay/`](../../../taskPlanning/lambda/ephemera/dataSource/actions/oracleLoopDrafts/playByPlay/iterations.md). Its plan exited (c) on 2026-11-11: the play-by-play is the first ask of the imagination, the family of generating prompts, and the [imagination plan](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.imagination.planning.md) builds the asks, each its own piece in `imaginationPieces/`; this one keeps its name. Its drafts from 11 are an ask part and a version of the shared core ([`oracleLoopDrafts/imaginationCore/`](../../../taskPlanning/lambda/ephemera/dataSource/actions/oracleLoopDrafts/imaginationCore/1.txt)), built into a payload by [`assembleDraft.ts`](pieceProbe/assembleDraft.ts), which hashes each part by `textHash`. From `lambda/ephemera/`: `npm run assemble-draft -- <ask.txt> <core.txt | -> <out.json> --piece <name> [--repeats N] [--cells A,B] [--model M] [--options JSON]` writes the payload and prints the ask's, the core's and the instructions' hashes. A core of `-` assembles a draft with no core, from an ask with no `{{core}}` line, and its core hash is `none`: the explicit render teaches what the reading guide did. `--options` is the payload's piece options, as JSON ([`assembleDraftCli.ts`](pieceProbe/assembleDraftCli.ts), bundled by esbuild and piped to node).
- **A cell's inputs:**
  - a fixture;
  - the actions in order, each in its words, read from the [oracle probe](#oracle-probe)'s case where there is one;
  - `alsoShown`: the other things its sub-scene shows, by handle, listed by hand, since a sub-scene of the named handles alone drops a relation to anything else (`OC-20`'s chain to the wall).

  The things it describes are the handles its actions name, each once, in order, computed by code (imagination plan, step 1.5).
- **Option:** `rules`, `none` (the default) or `consequence`: the sub-scene's rules shown as each rule's fact and its consequence, with nothing about blocking, since whether a rule blocks is the rule cell's, and seeing it risks a motion written to fit it (user, 2026-11-10). It replaced a `sceneRules` boolean that showed the `v45` sentences.
- **Option:** `scene`, `judge` (the default, when absent) or `explicit`: the sub-scene in the explicit render (`renderSceneExplicit`) in place of the Fiction and Graph, with the securing as the render states it. It takes no `rules: 'consequence'`, since the explicit render states each securing as a carry line itself, and the pair is refused. With no `scene`, the render is as before, byte for byte. The prompt then needs no reading guide, so its draft is assembled with no core (below).
- **The render:** the [sub-scene](../dataSource/actions/AGENT.md) of the `alsoShown` things and of every handle the actions name, as the judge shows it (or explicitly, with `scene: 'explicit'`); `Action n: …` for each action; then `The things: [a], [b], …`, the named handles. Under the explicit render that line is `The things to describe: [a], [b], …`, since the render's own per-thing section is headed `The things:`. It throws when there are no actions, the actions name no things, a thing is shown twice, or a handle isn't in the fixture.
- **The form check:** the reply ends in a fenced `json` block (read through `splitMarkdownReasoningAndJson`) whose `actions` has one entry per action. Each entry maps some of the described things' handles, and no others, to non-empty strings: a described thing with no line is silent, and stays in its frame (user, 2026-11-10). A key is read with or without its brackets (`[teapot1]` is `teapot1`), and where both spellings appear their lines are merged (user, 2026-11-10). That is the rule cell's `motions` for any pair of the things. Each problem is named: no block, a block that doesn't parse, no `actions`, the wrong count, or, per action, an entry that isn't an object, a handle not listed, or a line that is empty or not a string.
- **Cells:** `OC-1`, `OC-6`, `OC-19` and `OC-20`, each with what a reader looks for. `OC-20`'s action is hand-written, since the oracle probe has no candidate for it. `OC-30/2` moved to `consequences` at step 1.5.
- **Shared with `consequences`:** the fixture scene, the `rules` and `scene` options, and the scene render (`renderScene`), in [`imaginationPieces/imaginationScene.ts`](imaginationPieces/imaginationScene.ts). The scene-and-actions render and the block check are there too, and since the action plan's step 4b only the play-by-play uses them: `consequences` reads a plan and replies in the change language. The block's IM-5 question (which ask's lines the rule cell reads) is open.

**Consequences** (`consequences`, [`imaginationPieces/consequences.ts`](imaginationPieces/consequences.ts)) is the imagination's other-things ask, and a reducer on the [action plan](oracleLoop/actionPlan.ts) (the user, 2026-11-18; the action plan's step 4b). Given a plan and the one step to expand, it says how each listed thing moves as that step is done, and flags the consequences that work against the step's intent, in the change language. Collateral consequences are listed, not flagged. Its drafts are in [`oracleLoopDrafts/consequences/`](../../../taskPlanning/lambda/ephemera/dataSource/actions/oracleLoopDrafts/consequences/iterations.md). From draft 2, they are the ask alone, with no core.
- **A cell's inputs:**
  - a fixture;
  - the plan so far, each step's intent in it;
  - the target, the path of the step to expand;
  - the things to describe, by handle, listed by hand: those whose motion the plan doesn't state, named or not (user, 2026-11-11).
- **Options:** `rules` and `scene`, as the play-by-play's, except that the default is `scene: 'explicit'`. `rules: 'consequence'` needs `scene: 'judge'`.
- **The render:** the scene of the listed things and every handle the plan's text names (`renderScene`), then:
  - `The plan:` (`renderPlanForGenerator`);
  - `The step to expand: <path>`;
  - `The things to describe: [a], [b], …`.

  It throws when there are no things, a thing is listed twice, the target names no step, or a handle isn't in the fixture. A target that already holds consequences is fine: in production `playByPlay`'s lines arrive first.
- **The form check:** `consequencesContract`, a stage contract whose value is the merged plan.
  - **The reply's block** is a `changes` list, merged by `mergeStepChanges`. An entry adds a `consequence`, a `concern`, or a `possibility` (the action plan's step 5).
    - **A possibility is one change for the whole group:** `{"add": "possibility", "kind": "execution", "says": <the condition>, "branches": [[…], […]]}`. Each branch is a list of consequences, written as flat ones are, and `add` is optional.
    - **Where a consequence sits says when it happens.** A consequence in a branch happens only in that branch. A flat one beside the possibility happens in every branch.
    - **Refused:**
      - fewer than two branches;
      - a concern in a branch;
      - a second `execution` possibility on a step;
      - a kind other than `execution`.

      An empty branch is allowed.
    - **Paths are flat under the step,** minted in one scope at any depth. Consequences and concerns slug their text, and every other kind slugs its kind: `tip-table1.intent`, `tip-table1.execution`, `tip-table1.maybe-2`.
    - **`renderPlanForGenerator` nests them,** one indent per level.
  - **Bare handles are bracketed first:** `bracketHandles` rewrites `teapot1` as `[teapot1]` in each change's `says`, and inside a possibility's branches too. It does this against every handle the prompt names (the listed things, the plan's, and the rendered text's), matching whole words in any case. A letter-and-number word that matches a handle is always that thing (the user, 2026-11-18).
  - **Code supplies each change's `to`,** which is the target. A `to` the reply writes must name the target, or the block is refused.
  - **Then `mergeChanges`,** against the handles a reply may name (`replyHandles`): the listed things, plus every handle in the target step's own text and its intent (the user, 2026-11-18, at step 5). A success branch has to name what the intent names. A change naming any other thing is a form failure ("is not a listed thing or named by the step"). A key beside `changes` refuses the block, so nothing a reply adds is dropped unseen.
- **Cells:** each is a one-step plan built by hand (`consequencesPlans`), holding its intent and no consequences, so the reply establishes the outcome (the user, 2026-11-18).
  - **`OC-30/2`:** `tip [table1]`, with intent `[teapot1] pours [tea2] into [cup1]`, split as the trial's h5 is but without AP-7's intended consequence. Its look-for: the saucer and cup slide off the tipped table, and the cup no longer under the spout is a problem.
  - **`OC-1`, the control:** `pick up [table1]`, whose intent is its own text. Its look-for: everything on the table rises with it, and nothing works against the intent.
  - **The over-flagging cells** (the action plan's step 5), run with `--cells` apart from the two above:
    - **`OC-1/teapot1`'s bar is no hedge and no concern.**
    - **`cup` is recorded, not gated** (the user, 2026-11-18, after batch 5). Whether its spill is worth surfacing is booked in the imagination plan.
    - **`cup`, a mundane action** (constructed): `pick up [cup1]` on `teaTable`, with [saucer1] and [tea1] to describe. An ordinary actor under no pressure lifts a cup of tea, so there is no spread.
    - **`OC-1/teapot1`, a hedge against the scene:** OC-1's plan, with [teapot1] alone to describe. The glue line already settles that it goes with [table1].

  Both caps are 1024 tokens.
- **Reading a batch:** `npm run read-plans -- <results.json>` prints each reply's plan, `playByPlay`'s built or `consequences`' merged, by the response's `piece` (`imaginationPieces/plansText.ts`).

#### Scene renders

**The explicit render is the direction for every piece's default** (the user, 2026-11-18). That rests on the trial question plan's step 0 and 1.5, and on `consequences`' batch 2, which held parity on OC-30/2 and improved the OC-1 control. The two renders are `judge` (the Fiction and the Graph) and `explicit` (`renderSceneExplicit`), listed in [`pieceProbe/sceneRenders.ts`](pieceProbe/sceneRenders.ts).
- **How a piece moves:** at its next redraft, never in a slice of its own. The move is a draft of its own, with a parity batch against the last kept draft, so a miss has one cause. The explicit render needs no reading guide, so an imagination ask's draft is assembled with no core.
- **When its default flips:** once its kept draft runs explicit, in the same change, with the new inputs hashes recorded in the draft's notes. The piece then leaves `JUDGE_RENDER_HOLDOUTS`.
- **The check:** [`pieceProbe/sceneRenders.test.ts`](pieceProbe/sceneRenders.test.ts) renders every registered piece's first cell on its default options. It fails on a judge-render piece missing from the holdouts, and on a listed piece that no longer renders the judge's scene. So the list only shrinks, and a new piece built on the judge render has to be added deliberately. `sceneReading` names its render in every payload and is exempt.
- **The render pins:** the trial's `renderPins.test.ts` pins the judge render. Flipping `nonRuleCell`'s default (and so the trial stages') means either the pins pass `scene: 'judge'` or they move to the explicit render. Either is an edit to pins the trial plan keeps unedited, so it's the user's call when those pieces flip.
- **The exit:** with no holdouts left, a cleanup removes the `judge` option from the pieces, and `sceneReading` keeps both renders. `ruleCell` (settled at draft 3) moves only if it is reopened, or if the user decides to move it.
- **Scope:** calibration's pieces only. The production scene formats (`sceneProse`'s `SceneFormat`) are a separate question, which the scene projection plan's SP-10 (rendering for LLMs) owns.

### The built judge prompt (v45)

The judge prompt in code is v45 (2026-11-06): [`frame/frameJudge.ts`](../dataSource/actions/sceneProse/frame/frameJudge.ts) for the instructions and `judgeRulesLines` in [`sceneRules.ts`](../dataSource/actions/sceneProse/sceneRules.ts) for the scene's `Rules`. A flag-off probe reports instructions hash `22e97265`. It is a probe-only prototype: nothing in the command pipeline reads it. Its next form, a comparative oracle in a loop with an improvisation engine, is the [oracle loop plan](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.oracleLoop.planning.md). The drafts v1 to v45, and the reply-by-reply record of each, are in git history (`taskPlanning/lambda/ephemera/dataSource/actions/judgeFailureDrafts/`, last at commit `a89e21478`).

- **Instructions:** `Role`, `Reading the scene`, `Relations and frames` (with worked examples set aside from the scene: a crate, a lamp bolted to it, a rug pulled out from under it), `Reading player intent`, `Improvising` and `Task`. The first five are reusable modules; `Task` belongs to the judge. The instructions hold nothing variable, so they can sit before a cache point.
- **Reply:** one line per step, `Mentions`, `Picture`, `Rules`, `Obstacle`, `Needs`, `Revises`, `Tests`, `Answer`. `Tests` is a rubric of bare `label: yes` or `no` lines, every question answered, with `obstructed` split into three (`(1)` a rule in `Conflict`, `(2)` an obstacle named, `(3)` a `Class` need or one nothing here could meet), then `contingent`, `complex`, `simple`, and `impossible` asked last. `Answer` gives `impossible` if it says "yes", otherwise the first "yes", or `confusing` if none does, then one sentence.
- **Labels** (`JUDGE_LABELS`): `impossible`, `obstructed`, `contingent`, `complex`, `simple`, `confusing`. `confusing` is graded a failure wherever it isn't expected.
- **Standing** (2026-11-06, Nova Micro): `teaTable` 18 pass, 1 border, 2 wrong `simple` (teapot's and pour's) of 21 calls; `tavern` 6 pass, 2 border of 8. Per request, with the limit each hits, in the oracle loop's [corpus](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.oracleLoop.corpus.planning.md).
- **Changing it.** A candidate replaces it when it fixes at least one known failure, causes no new wrong `simple`, and loses no pass on the table, the cup or the table in the cup, where a label the fixture tolerates is a border and not a lost pass. Grade by what an error costs: a wrong `simple` has no recovery, and a repeated false refusal is a failure. Two repeats show only strong effects, so read the replies as well as the tally. At the rebuild, check the composed `teaTable` prompt byte for byte against the draft.
- **Size and caching** (Nova Micro, the user's figures, not checked here): a 128k token context window, and manual cache points, which must not be set on a chunk under 1k tokens. So the size that matters is the instructions alone, with a floor as well as a ceiling. v28's instructions were 7,619 characters, about 1,900 tokens by rule of thumb. Still to check: the real count from Bedrock, how long a cached block lives, and the price of cache writes against reads.

### Writing prompts for Nova Micro

**Micro is the target (user, 2026-11-09).** The project is meant for hobbyists running communities, and Nova 2 Lite is slower and several times the price, so cost is weighed at that scale. A prompt may be developed on Lite when Micro is costing too much time, but it then owes a calibration pass back to Micro once the problem is understood. A task can be left on Lite only after that pass has been made in earnest and Micro still can't do it.

What the judge drafts v29 to v45 showed (2026-11-05 to 2026-11-06), for whoever writes the next prompt for Micro. Attributions are the user's where marked.

- **Tight steps at a literal place work, and prose definitions don't.** A `Mentions` step pointed at "the last line of this prompt, the one starting `Request:`" caught the unestablished cloth where every rewording of `Picture` failed.
- **Micro decides, then justifies, so the verdict goes last (user).** Asked for a verdict with its reason, it wrote `contingent: no ("Needs" says "nothing")` directly under a `Needs` that named the cloth. Hence `Tests` as bare `label: yes` lines.
- **"Copy from your earlier line" is not an operation Micro accepts (user).** "Given what Needs said: ..." is what works.
- **A rubric isn't a switch (user).** Every question gets answered, and priority lives in `Answer`, so the order questions are asked in can be tuned separately from priority. Asking `impossible` last, with the other tests in context, made it reliable.
- **Words get echoed.** "Named by handles" shaped what counted as a thing, `"Needs" says "nothing"` shaped reasons, and examples in the prompt leaked into answers (`rag not established`). Keep examples out of the fixtures' domains.
- **An unread sentence can hold up earlier lines.** Removing the "n/a" sentence from `Picture`, which no test reads, cost teapot 3 of 3 (v43), and restoring it brought `Picture`'s from-and-to and `Rules`'s `Conflict` back (v44). Removing an unread label (`Mentioned`/`Improvised`) fixed wipe (v45). Text anywhere in the prompt can change earlier lines of the reply, so no edit is safe unprobed, a clean-up included.
- **One change per draft.** v42 made three at once, regressed, and couldn't say which did it.
- **One phrase can carry a verdict.** On teapot, replies whose `Picture` says the teapot would go from the table to being held reached `obstructed` 8 of 8; those without it, 0 of 5.
- **A block can be shown and not read.** With a proposed outcome shown, no reply used anything only the block said, and `Revises` stayed "nothing" with the changed relation stated just above it (9 calls).
- **Rules in positive terms (user).** No "do not" qualifying a positive instruction. Write pronouns out as nouns where the referent could be misread.
- **Micro can be a little dumb, but must not be recalcitrant (user).** Players accept being misunderstood; they rightly resent a legitimate intent being resisted.

What the oracle drafts 1 to 12 showed (2026-11-09 to 2026-11-10; [`oracleLoopDrafts/`](../../../taskPlanning/lambda/ephemera/dataSource/actions/oracleLoopDrafts/iterations.md)):

- **One judgment per call, with loops and joins in code (user, 2026-11-10).** Nearly every fault left after twelve drafts was a loop or a look-back inside the prompt:
  - "For each action with a line" was answered once for each rule, with the filter dropped.
  - A condition over earlier steps (which steps a rule is in force for) was never computed.
  - A later step answered from the wrong earlier step.
  - Several yes/no questions under one item leaked into each other.

  Prior art finds the same: decomposed prompting, checklist evaluation, and LLM+P. A prompt classifies, extracts or judges one item. Code does the loops, filters and joins.
- **An extractive line takes the nearest matching text.** Asked to write "what the play-by-play says [x] does", replies copied the rule's own clause 4 of 12 times. Asked to copy "the lines under Plan:", they copied the `Task`'s own numbered steps, and 11 of 12 replies were cut off.
- **An action pictured as an action gets its motion.** With the pour shown as an action and its record change under it, the play-by-play tilted the teapot 3 of 3. Shown only as a record change, it didn't.
- **A step's label is a lever.** Renaming `Picture` to `Play-by-play` moved pour from 0 of 3 to 2 of 3, while a longer description lost the tilt.
- **A term with a plain-English sense is read in that sense (user).** "Breaks a rule" means violating it, so it can't also mean ending the fact behind it. Chosen terms ("voids", "in force") still leaked once, when the rule's own text offered them to copy.

What the rule cell drafts 1 to 3 showed (2026-11-10; [`oracleLoopDrafts/ruleCell/`](../../../taskPlanning/lambda/ephemera/dataSource/actions/oracleLoopDrafts/ruleCell/iterations.md)):

- **One judgment per call worked, from the first draft.** In one-prompt draft 7, `Picture` had the teapot tilting with the table 3 of 3, and the rule step still judged it wrong 0 of 3. The rule cell, given the same kind of motion lines, judged it 6 of 6 on its first draft, and every later change was to the answer's form.
- **Ask for a description before the verdict.** "Say what the lines say about how the two things move relative to each other", then the verdict, gave 46 of 48. "Give your reasoning", then the verdict, gave 14 of 24. With the reasoning asked for as reasoning, 22 of 24 replies opened with the verdict ("No, …") and bent the reason to fit it. Micro decides, then justifies, so the prose has to be something other than an answer.
- **A sentence about form can move the judgment.** Moving the verdict from an `Answer:` line into a JSON block, with nothing else changed, cost 10 of 24. Probe a form change like any other.
- **A verdict on a labelled last line gets joined onto the line before it** (14 of 45 calls), even though each answer was right. A trailing fenced `json` block, read through `llm/`'s `splitMarkdownReasoningAndJson`, had none.
- **Write pronouns out in the inputs as well as in the instructions.** "Slides across [table1] as it tips" was read once as the two moving together. "As [table1] tips" was read right 3 of 3.

What the play-by-play drafts 1 to 10 showed (2026-11-10 to 2026-11-11; [`oracleLoopDrafts/playByPlay/`](../../../taskPlanning/lambda/ephemera/dataSource/actions/oracleLoopDrafts/playByPlay/iterations.md)), on a generator read by hand:

- **One call can't both keep an action succeeding and report what undoes its purpose.** Over seven whole-scene drafts, the knock-on (a saucer sliding off a tipped table) never held alongside the actions succeeding. The same sentence carried one or the other: "what each … has to do physically for the action to happen" kept the action succeeding, and "how each of the things … moves" freed the knock-on. Ask them in separate calls, each with its own wording.
- **Say that the action happens.** "For the action to happen" is the premise that keeps a method ordinary. Cut, the reply narrates an attempt and lets the rule settle it ("You attempt to lift the table, but the chain …").
- **A focus that names a secured pair asks the rule's question.** "With a particular eye for how [teapot1] moves relative to [table1]", with "glued to" in the scene, gave "the teapot doesn't move relative to the table" 3 of 3.
- **Give a fact somewhere to go.** Shown the glue with no other place for it, the reply wrote it into the motion. Given a separate `problems` list, it flagged the glue and wrote the method the ordinary way (0 of 3 to 3 of 3). "Might get in the way of doing it that way" kept the problems hypothetical, beside the method; "runs into" made them actual, inside the steps, and the method was bent to avoid them.
- **Examples are copied in shape.** Example lines labelled "Play-by-play:" were copied into the JSON block as sentences, and examples with `Relations` and `In the telling` lines brought those sections into replies. Keep an example to what the reply should copy.
- **Grain is shown, not said.** "Briefly" was in every draft and never held; "step by step" and "possible problems" were read as every motion of the hands and every ordinary risk. Examples at the wanted grain moved it. Give a simple example the same grain as the rest, or simple cases get coarser replies.

What the trial's verdict drafts 1 to 7 showed (2026-11-16; [`oracleLoopDrafts/trial/`](../../../taskPlanning/lambda/ephemera/dataSource/actions/oracleLoopDrafts/trial/iterations.md)), on a judge choosing between an argument and its rebuttal:

- **Micro does what the steps ask; check that the step asks for the judgment before grading its absence (user).** Drafts 3 to 7 asked the judge to fill a template: pick "whichever form fits", copy each side's answer, name a source from a list, and answer by which side the last slot agrees with. They graded the replies on soundness of reasoning, which no step asked for. The form held 11 of 11 in every batch, and the verdict followed the sentence 11 of 11. The gap between what was asked and what was graded is the prompt's, not Micro's. Before reading a batch as a judgment failure, find the step that asks for that judgment.
- **Sentences outside the Task's steps are read past.** Three additions to a reading section left every answer unchanged:
  - skepticism about the two sides;
  - XML-style tags marking them as opposing voices;
  - a rule that unstated details are ordinary.

  The only changes that moved replies were changes to the Task's steps. It is the same pattern as an input no step names being ignored.
- **Whatever slot settles the answer is filled from the most authoritative-looking nearby text.** The judge's settling clause named "the scene says" wherever the rebuttal had quoted the scene. Then the rebuttal's quoted line settled the point: "the scene says" gave `rebuttal` 42 of 43 times. The order and wording of a slot's options can decide the answer.
- **Symmetric words, asymmetric inputs.** "A quoted line shows only what that line says", put in the deciding step, was applied to the side that quoted nothing: its common-sense claim became "not specified". An instruction that reads as even-handed can fall on one side when the two inputs differ in form.
- **A confident form passes for a valid one (user).** A rebuttal shaped "X, but the scene says '…', which implies …" was accepted wherever its form held, true or not. Its true and false rebuttals look alike to a reader of form. Separation that a human reads as obvious may not exist at the level Micro reads.

### Known behaviour of the built judge

Not failures, but worth reading for in any run.

- **`Revises` is unreliable:** "nothing" on the table when the table's relation changes, and once "the glue is no longer true". It routes nothing.
- **`Picture` can force a move** ("The table moves from being stationary to being wiped"), perhaps from "If a thing moves, say which".
- **A `Rules` step can invite a rule where there is none:** one `tavern` reply wrote `table-heavy: ... Conflict.` in a scene with no rules.
- **Questions echoed:** some replies write out the test questions, which once hit the probe's 512-token limit before `Answer`.
- **`Answer` is not purely mechanical:** it has twice given `contingent` past an `obstructed (3): yes`.
- **`avoids` matches exact substrings,** so "removing" and "ungluing" go unflagged by `remove` and `unglue`. A reading aid only.
- **Unprobed rule wordings:** the pair and not-shown forms in `judgeRulesLines`. No fixture has a securing that crosses frames, such as a teapot on a table chained to the wall.

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
