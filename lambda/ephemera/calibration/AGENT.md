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

`PieceProbe` runs a draft of one piece against that piece's cells, and grades each reply in code against the cell's expected answer, or groups the replies for a reader. The harness is [`pieceProbe/`](pieceProbe/); the pieces are kept by family, the oracle's judging pieces in [`oraclePieces/`](oraclePieces/) and the imagination's generating pieces in [`imaginationPieces/`](imaginationPieces/). A piece makes one judgment per call. It is a **Prototype** of the [oracle loop plan](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.oracleLoop.planning.md)'s Slice 4.5. Nothing in production reads it, and it goes when the parent closes. Same access boundary and cost as the judge probe.

```json
{ "type": "PieceProbe", "piece": "ruleCell", "instructions": "...", "repeats": 3, "model": "NovaMicro" }
```

- **A piece plugs in with a registration** ([`oraclePiece.ts`](pieceProbe/oraclePiece.ts)), listed in [`pieces.ts`](pieceProbe/pieces.ts) through `registerPiece`. A piece is **answered** or **read**; the registration below is the answered kind, and [a read piece](#a-read-piece) differs where it says so:
  - `name`;
  - `answers`, its closed answer set;
  - `cells` by ID, each with its `inputs`, `expected` answer, `source` (the batch and reply it was lifted from, or `hand-written`) and an optional `note`;
  - `parseOptions`, which checks the event's `options` and gives the piece's options or a refusal;
  - `render(cell, options)`, the prompt text after the instructions, which is async so it can build a fixture's scene;
  - optionally `byCode(cell)`, an answer code gives without a call.

  A piece that needs more than this to plug in is the plan's revision trigger.
- `piece` is required. `cells` defaults to all of the piece's cells. `instructions` is required, since a piece has no built prompt. `repeats` defaults to 1, `model` to `NovaMicro`, and `options` goes to the piece.
- **Cap: called cells x repeats <= 24** (`PIECE_PROBE_CALL_CAP`, its own constant, apart from the other probes' 12). Cells answered by code don't count. Every refusal happens before the first call: an unknown piece or cell, no instructions, bad repeats or model, options the piece refuses, over the cap, or a render that fails.
- The prompt is the instructions, a blank line, then the cell's render. There is no recap, and an answered piece has no form check beyond its grade.
- **Grading** ([`pieceAnswer.ts`](pieceProbe/pieceAnswer.ts)): a reply that ends in a JSON object, best as a trailing fenced `json` block after prose reasoning, is graded by its string `answer` field, trimmed and lowercased. The split is `splitMarkdownReasoningAndJson` in [`llm/`](../llm/AGENT.md), the house shape for reasoning then JSON. Any other reply is graded by its last line starting `Answer:`: its first word, lowercased and with trailing punctuation dropped. Anything after that first word is ignored. When a reply has both, the JSON wins. A reply with neither, JSON that doesn't parse or has no string `answer`, or an answer outside the set, is `malformed`, with the reason. The verdict goes last, as Micro needs.
- **Returns:**
  - the instructions' `hash` and `chars`, and the parsed `options`;
  - **`cells` first:** for each cell, its `expected` answer; `n` calls, with `right`, `wrong`, `malformed` and `errors`; the `answers` given, with counts; `byCode` (the answer and whether it is right) where code answered; and the rendered inputs' `hash`;
  - `summary`: calls, right, wrong, malformed, errors, and the count of cells answered by code;
  - `read`: every call, with its reply and grade, for reading the wrong ones.

#### A read piece

A piece with no closed answer set, such as a generator, is registered with `kind: 'read'` ([`oraclePiece.ts`](pieceProbe/oraclePiece.ts)) and graded by hand: code checks form, and a reader reads the replies. The call loop, the refusals, the cap and the prompt are the same as an answered piece's.
- **Registration:** `name`, `cells`, `parseOptions` and `render` as above, with no `answers` and no `byCode` (every cell is called). Each cell carries a `lookFor`, what a reader looks for, written before the batch, in place of `expected`. And `check(reply, cell)` gives the form problems of one reply as a list of reasons, empty when it passes. An optional `maxTokens` raises the output cap per call from the judge probe's 512 (the play-by-play's is 1024).
- **Returns** ([`readPiece.ts`](pieceProbe/readPiece.ts)):
  - the instructions' `hash` and `chars`, and the parsed `options`;
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

**The play-by-play** (`playByPlay`, [`imaginationPieces/playByPlay.ts`](imaginationPieces/playByPlay.ts)) is the first read piece: what each listed thing does physically in each of a candidate's actions. Its drafts are in [`oracleLoopDrafts/playByPlay/`](../../../taskPlanning/lambda/ephemera/dataSource/actions/oracleLoopDrafts/playByPlay/iterations.md). Its plan exited (c) on 2026-11-11: the play-by-play is the first ask of the imagination, the family of generating prompts, and the [imagination plan](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.imagination.planning.md) builds the asks, each its own piece in `imaginationPieces/`; this one keeps its name. Its drafts from 11 are an ask part and a version of the shared core ([`oracleLoopDrafts/imaginationCore/`](../../../taskPlanning/lambda/ephemera/dataSource/actions/oracleLoopDrafts/imaginationCore/1.txt)), built into a payload by [`assembleDraft.ts`](pieceProbe/assembleDraft.ts), which hashes each part by `textHash`. From `lambda/ephemera/`: `npm run assemble-draft -- <ask.txt> <core.txt> <out.json> --piece <name> [--repeats N] [--cells A,B] [--model M]` writes the payload and prints the ask's, the core's and the instructions' hashes ([`assembleDraftCli.ts`](pieceProbe/assembleDraftCli.ts), bundled by esbuild and piped to node).
- **A cell's inputs:**
  - a fixture;
  - the actions in order, each in its words, read from the [oracle probe](#oracle-probe)'s case where there is one;
  - the things to describe, by handle, listed by hand.
- **Option:** `rules`, `none` (the default) or `consequence`: the sub-scene's rules shown as each rule's fact and its consequence, with nothing about blocking, since whether a rule blocks is the rule cell's, and seeing it risks a motion written to fit it (user, 2026-11-10). It replaced a `sceneRules` boolean that showed the `v45` sentences.
- **The render:** the [sub-scene](../dataSource/actions/AGENT.md) of the listed things and of every handle the actions name, as the judge shows it; `Action n: …` for each action; then `The things: [a], [b], …`. It throws when there are no actions or no things, a thing is listed twice, or a handle isn't in the fixture.
- **The form check:** the reply ends in a fenced `json` block (read through `splitMarkdownReasoningAndJson`) whose `actions` has one entry per action. Each entry maps some of the listed handles, and no others, to non-empty strings: a listed thing with no line is silent, and stays in its frame (user, 2026-11-10). A key is read with or without its brackets (`[teapot1]` is `teapot1`), and where both spellings appear their lines are merged (user, 2026-11-10). That is the rule cell's `motions` for any pair of the things. Each problem is named: no block, a block that doesn't parse, no `actions`, the wrong count, or, per action, an entry that isn't an object, a handle not listed, or a line that is empty or not a string.
- **Cells:** `OC-1`, `OC-6`, `OC-30/2`, `OC-19` and `OC-20`, each with what a reader looks for. `OC-20`'s action is hand-written, since the oracle probe has no candidate for it.

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
