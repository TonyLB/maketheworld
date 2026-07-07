# Object identity --- embedding fast path (EMBEDDING#IMPROMPTU)

**Status:** EM-6 complete. Next step: **EM-7** --- durable docs + verification + plan retirement.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

Prerequisite (shipped): impromptu shortName embeddings on spawn/update --- [`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md) (**Four-way split**, **Improvisation storage**). Identity stage steady state: [`enrich/objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) step 4 (exact match -> identity LLM on `NoMatch` / `AmbiguousMatch`).

Retire this plan when the embedding fast path ships and durable docs are updated; git retains history.

## Purpose

Add a **deterministic identity fast path** between exact `shortName` resolve and the **identity LLM**: when a player `objectSpan` is a confident semantic match to exactly one in-catalog object's stored **`EMBEDDING#IMPROMPTU`** vector, resolve **`objectId`** without a Bedrock identity hop.

**Goals:**

- Skip identity LLM on high-confidence paraphrases (e.g. "sweeping tool" -> broom) when embeddings agree.
- **Fail open to identity LLM** when gates do not pass --- positive closure only ([`llm/AGENT.contract.md`](../../../../../lambda/ephemera/llm/AGENT.contract.md) **Fast-path closure**).
- Prefer **false negatives** (extra LLM fallthrough) over **false positives** (wrong object auto-resolved), especially when the requested object is absent from the catalog.

**Explicitly deferred (separate initiatives):**

- Identity LLM **abstain** / `noMatch` when nothing in catalog fits. This plan does not change [`buildPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/buildPrompt.ts) identity instructions or [`interpretIdentity.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/interpretIdentity.ts).
- **Lexical backstop** on unary catalog (token overlap / edit distance) --- rejected for v1; unary uses **`T_abs_unary > T_abs`** only (**EM-D3**).
- **Post-identity validation LLM** downstream of whatever path produced a grounded **`objectId`** (embedding fast path, identity LLM, or future abstain/retry) --- judges whether span + command plausibly refer to that catalog entry; may trigger correction.
- **Identification retry loop** --- on validation failure (or low confidence), re-run identification with broader settings and/or a more expensive pass (e.g. identity LLM when fast path won, wider catalog context, abstain-capable prompt). Out of scope for this plan; document as follow-on so v1 can accept occasional fast-path false positives without lexical veto.

## Target architecture (identity tier)

```text
resolveObjectSpanToObjectId (exact normalized shortName)
  -> [NEW] resolveObjectSpanByEmbedding (cosine gates; span embed + catalog vectors)
  -> identity LLM (unchanged optimistic best-effort)
  -> unaryCollapse / relational compile
```

**Lanes:**

| Tier | Lane | When |
| --- | --- | --- |
| Exact match | Deterministic computation | `normalizeExitName(span)` equals one catalog `normalizedShortName` |
| Embedding match | Deterministic computation + Bedrock **embed only** (Titan v2, same as storage) | Exact miss; eligible embeddings; conjunctive gates pass |
| Identity LLM | Semantic reasoning | Embedding abstain, `AmbiguousMatch` (identical shortNames), or span embed invoke failure (always fall through --- no terminal error) |

**Wiring surfaces (both membership and relational):**

- [`identityStage.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/identityStage.ts) --- membership path (`compileMembershipAtomic`).
- [`resolveRelationalGrounding.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/resolveRelationalGrounding.ts) --- per-span resolve (subject + target).

**Catalog + vectors:** extend catalog entries with optional `SemanticEmbedding` rehydrated from stored embedding rows (v1: `EMBEDDING#IMPROMPTU`). Batch-fetch via **`createObjectEmbeddingCacheHandler`** + `internalCache` at **`parseCommand` catalog ingress**, in **parallel** with existing room/held catalog `internalCache` reads --- identity stage consumes pre-attached vectors only.

## Match policy (conjunctive gates)

Plan-only until calibration ships; then promote thresholds to code constants + contract notes.

1. **Eligibility:** score only catalog objects with a valid `EMBEDDING#IMPROMPTU` row (model, dimensions, encoding match v1). Missing row = ineligible (not an error).
2. **Query embed:** embed `normalizeShortNameForEmbedding(rawObjectSpan)` via same Titan path as [`buildShortNameSemanticEmbedding.ts`](../../../../../lambda/ephemera/dataSource/objects/embedding/buildShortNameSemanticEmbedding.ts) (`invokeBedrockTitanEmbed`, 256d, normalized).
3. **Absolute floor `T_abs`:** `sim_best >= T_abs` required. Primary guard against absent-object false positives.
4. **Margin `T_margin`:** when two or more eligible candidates, require `sim_best - sim_2nd >= T_margin` (or ratio variant --- see **EM-D2**).
5. **Unary catalog (`|eligible| === 1`):** require **`T_abs_unary`** with **`T_abs_unary > T_abs`** (no margin; no lexical backstop --- **EM-D3**). Calibrate unary trap bucket (`sword` vs sole `ornate rapier`, absent-object vs sole object) to set headroom. Synonym paraphrases without shared tokens (e.g. `sword` / `ornate rapier`) **may** fast-path when similarity clears the higher bar; false positives are an accepted v1 risk mitigated by deferred post-identity validation + retry (see **Explicitly deferred**).
6. **`AmbiguousMatch` (duplicate normalized shortNames):** **never** auto-resolve via embedding; always fall through to identity LLM (stored vectors are identical for identical shortNames).
7. **Abstain outcomes:** `below_floor`, `ambiguous_margin`, `no_eligible_embeddings`, `embed_invoke_failed` --- **not** `noMatch` unless a future abstain initiative adds it. All abstain reasons (including span embed Bedrock failure) **must** fall through to identity LLM; **never** terminal Error.

**Anti-pattern (forbidden):** resolve solely because one candidate beats all others when `sim_best` is below `T_abs`.

## Scope

### In scope

- **`mtw-gateways`** read surface + **`createObjectEmbeddingCacheHandler`** for object embedding row batch get (v1: `EMBEDDING#IMPROMPTU`; handler name is scope-neutral for future authored-object embedding rows).
- Ephemera **`internalCache`** registration; memo **`invalidate`** / **`delete*`** wired from [`invalidateImprovisationObjectCaches.ts`](../../../../../lambda/ephemera/dataSource/objects/invalidateImprovisationObjectCaches.ts) after object writes (gateway doc pattern).
- Pure module: score catalog, apply gates, return `Resolved` | `Abstain` (under `enrich/objectManipulation/embeddingMatch/` or sibling).
- Span embed helper (shared with objects lane normalization imports).
- Identity stage + relational grounding integration.
- **Calibration tooling** under [`lambda/ephemera/calibration/`](../../../../../lambda/ephemera/calibration/) --- shared corpus + live Bedrock scorer, dev-only direct-invoke handlers (AWS Console only; see **Threshold calibration tooling** below).
- Durable doc updates: [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md), [`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md) (read path), [`mtw-gateways/AGENT.md`](../../../../../packages/mtw-gateways/AGENT.md) ownership row.

### Out of scope

- Identity LLM abstain / `noMatch` when catalog has no fit (v1).
- Lexical backstop on unary catalog (**EM-D3** decided against).
- Post-identity validation LLM and identification retry loop (deferred follow-on).
- `EMBEDDING#PERSPECTIVE#...` perspective-scoped vectors.
- Embedding-based classify or frame extract.
- Client changes.
- Vector index / ANN --- catalog sizes are small; linear scan over room + held inventory is v1.

## Background (durable docs --- link, do not duplicate)

| Topic | Doc |
| --- | --- |
| Object manipulation identity hop | [`enrich/objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) |
| Exact resolve | [`resolveObjectSpan.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/resolveObjectSpan.ts) |
| Impromptu embed write path | [`objects/embedding/`](../../../../../lambda/ephemera/dataSource/objects/embedding/) |
| Embedding calibration findings + closed-loop deferred | [`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md) |
| `SemanticEmbedding` API | [`semanticEmbedding/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/semanticEmbedding/AGENT.implementation.md) |
| LLM fast-path closure | [`llm/AGENT.contract.md`](../../../../../lambda/ephemera/llm/AGENT.contract.md) |
| Gateway + `internalCache` norm | [`mtw-gateways/AGENT.md`](../../../../../packages/mtw-gateways/AGENT.md), [`lambda/ephemera/internalCache/AGENT.md`](../../../../../lambda/ephemera/internalCache/AGENT.md) |
| Ephemera testing | [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) |
| Diagnostics direct-invoke pattern (precedent) | [`lambda/diagnostics/app.ts`](../../../../../lambda/diagnostics/app.ts) (`event.type` sweeps) |

## Threshold calibration tooling

Live threshold tuning needs **real Bedrock embeds** scored through the **production path** (normalize -> Titan v2 -> `SemanticEmbedding.fromFloat32` -> int8 quantization -> `cosineSimilarity`). Numbers are **relatively stable per model**; re-run the same corpus when `BEDROCK_TITAN_EMBED_MODEL_ID`, dimensions, or encoding change.

**Layered approach:**

| Layer | Role |
| --- | --- |
| **Corpus in git** | Labeled pairs and mini-catalogs (positive paraphrase, hard negative, absent-object, unary trap, synonym-without-shared-tokens, duplicate shortName) --- shared by Jest and live tools |
| **Pure scorer** | `runEmbeddingCalibration.ts` --- embed + rank + summarize; no handler wiring |
| **Production gates** | `decideEmbeddingMatch` + `thresholds.ts` --- unit-tested with **mocked** vectors; constants chosen from live calibration |
| **Live runner** | Dev-only lambda direct invoke (AWS Console) calling the pure scorer |

### `lambda/ephemera/calibration/` layout (target)

```text
lambda/ephemera/calibration/
  AGENT.md                      # Console payloads, env gate, when to re-run (EM-4)
  routeCalibrationEvent.ts      # dispatch event.type -> framework handler (EM-4)
  objectMatch/
    corpus.ts                   # labeled calibration cases (source of truth; EM-0)
    runEmbeddingCalibration.ts  # pure: embed texts, pairwise / catalog simulate, stats (EM-4)
    handlers/
      comparePair.ts            # two strings -> similarity (+ model metadata) (EM-4)
      runCorpus.ts              # full corpus -> matrix + bucket stats (EM-4)
      simulateIdentity.ts       # span + catalog shortNames -> ranked list + gate verdict (EM-4)
    snapshots/                  # optional JSON after live run (EM-4)
```

**Import rule:** calibration modules **may** import shared embed helpers (`invokeBedrockTitanEmbed`, normalization, `SemanticEmbedding`). Production **`embeddingMatch/`** imports **`calibration/objectMatch/corpus`** types only if needed --- not handler wiring.

### Direct lambda invoke (AWS Console)

Wire in [`app.ts`](../../../../../lambda/ephemera/app.ts) **early** (before API / WebSocket paths): if `event.type` matches a calibration type, call `routeCalibrationEvent` and **return** structured JSON. Pattern matches diagnostics [`event.type`](../../../../../lambda/diagnostics/app.ts) sweeps --- **not** API Gateway.

| `event.type` | Payload (sketch) | Output |
| --- | --- | --- |
| `EmbeddingCompare` | `{ "left": "broom", "right": "sweeping tool" }` | `similarity`, normalized texts, `modelId`, dimensions |
| `EmbeddingCalibrationCorpus` | `{}` or `{ "bucket": "absent-object" }` optional filter | Pair matrix + per-bucket min/median/max + suggested threshold headroom |
| `EmbeddingSimulateIdentity` | `{ "span": "sword", "catalog": ["broom", "anvil", "lantern"] }` | Ranked scores, margin, pass/fail for candidate `T_abs` / `T_margin` |

**Guardrails (required):**

- **IAM-gated:** direct Lambda invoke only (`lambda:InvokeFunction`); not exposed via API Gateway.
- **Read-only:** embed + compare only; no Dynamo writes, no side effects on game state.
- Output includes **`modelId`** and calibration run timestamp so saved Console results stay interpretable.

### What to commit

- Corpus definitions + bucket labels (not necessarily numeric thresholds forever).
- Pure scorer + handler dispatch.
- Calibrated `thresholds.ts` with comment: `// Calibrated against corpus <id> on <modelId> at <date>`.
- Optional: snapshot JSON under `calibration/objectMatch/snapshots/` after a live run (diff when model changes).

**Anti-pattern:** Console-only numbers with no corpus in git --- not reproducible on model migration.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read identity step 4 in [`enrich/objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) and trace [`identityStage.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/identityStage.ts).
3. Read impromptu embedding write contract in [`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md) (**Four-way split**).
4. Skim gateway handler pattern: [`packages/mtw-gateways/ts/ephemera/improvisation/`](../../../../../packages/mtw-gateways/ts/ephemera/improvisation/) (pair rows; embedding is adjacent row, same `OBJECT#` PK).
5. Read **Threshold calibration tooling** below and diagnostics direct-invoke precedent in [`lambda/diagnostics/app.ts`](../../../../../lambda/diagnostics/app.ts).
6. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). Commands use **Jest** from `lambda/ephemera`.
7. Baseline before edits:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/ \
  dataSource/actions/parseCommand.test.ts \
  dataSource/objects/embedding/
```

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

**Decision timeline:** Structural forks lock at **EM-0** (or are already **Decided**). **EM-D2** and **EM-D4** closed in **EM-4** (live corpus run 2026-07-07).

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| EM-D1 | **Gateway shape** --- **`createObjectEmbeddingCacheHandler(ephemeraDB)`** with `get(objectIds[])` batch read; v1 fetches `EMBEDDING#IMPROMPTU`; writer = objects lane; reader = ephemera `internalCache`; memo invalidate on object delete/update. Scope-neutral name so authored-object embedding rows can share the handler later without renames. | Phase EM-1, ingress | Decided |
| EM-D2 | **Margin rule** --- absolute gap `sim_best - sim_2nd >= T_margin` vs ratio `sim_best / sim_2nd >= R_margin`; pick one in calibration | Phase EM-4 thresholds | Decided (absolute gap `T_MARGIN=0.008`; ratio rejected -- similar separation on corpus) |
| EM-D3 | **Unary catalog policy** --- **`T_abs_unary > T_abs` only**; no lexical backstop. Rely on calibration unary-trap corpus for headroom; accept that high-sim synonym pairs (e.g. `sword` / sole `ornate rapier`) may fast-path. Mitigation deferred: post-identity validation LLM + identification retry with broader/expensive pass | Phase EM-4 thresholds | Decided |
| EM-D4 | **Threshold constants** --- `T_abs`, `T_abs_unary`, `T_margin` (or `R_margin`) from calibration fixture; document provenance in code comment | Phase EM-5 ship | Decided (`T_ABS=0.14`, `T_ABS_UNARY=0.18`, `T_MARGIN=0.008`; snapshot [`embedding-identity-v1-2026-07-07.json`](../../../../../lambda/ephemera/calibration/objectMatch/snapshots/embedding-identity-v1-2026-07-07.json)) |
| EM-D5 | **Embed invoke failure** --- always fall through to identity LLM; **no terminal Error** | Phase EM-5 wiring | Decided |
| EM-D6 | **Catalog vector load site** --- batch at **`parseCommand` catalog ingress**; run **`internalCache.ObjectEmbedding.get(objectIds)`** in **parallel** with existing room/held catalog fetches; identity stage uses pre-attached vectors only | Phase EM-6 | Decided |
| EM-D7 | **Span embed dedupe** --- **required optimization**, not a fork: one Bedrock embed per **distinct normalized span** per lambda invocation (e.g. relational subject + target reusing the same span). Cache in identity-stage context (`Map<normalizedSpan, SemanticEmbedding>` or equivalent). No alternative considered for v1 | Phase EM-5 wiring | Decided |
| EM-D8 | **Calibration tooling** --- `lambda/ephemera/calibration/` shared corpus + pure scorer; direct Lambda invoke via `event.type` in [`app.ts`](../../../../../lambda/ephemera/app.ts) (AWS Console only, IAM-gated); calibrate on **quantized** `SemanticEmbedding` path | Phase EM-4 | Decided |

## Progress

| Phase | Focus | Status |
| --- | --- | --- |
| **EM-0** | Pre-calibration lock + module layout scaffold | Complete |
| **EM-1** | Read gateway + `internalCache` + cache invalidation | Complete |
| **EM-2** | Pure match policy + calibration fixture (mocked vectors) | Complete |
| **EM-3** | Span embed helper | Complete |
| **EM-4** | Calibration corpus + live tooling + lock thresholds | Complete |
| **EM-5** | Wire `identityStage` + `resolveRelationalGrounding` | Complete |
| **EM-6** | Catalog ingress batch load (parallel with catalog fetches) | Complete |
| **EM-7** | Durable docs + verification | Not started |

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines as you finish each sub-step.

- [X] **EM-0. Pre-calibration lock + module layout scaffold**
  - [X] Audit **Open decisions**: every row **Decided** except **EM-D2** and **EM-D4** (remain Open until **EM-4** live calibration; do not block **EM-1--EM-3**). Audit passed at EM-0: only EM-D2 and EM-D4 are Open.
  - [X] Scaffold [`enrich/objectManipulation/embeddingMatch/`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/) --- package boundary and module stubs only; `decideEmbeddingMatch` may use **placeholder** thresholds until **EM-4** locks constants.
  - [X] Scaffold [`lambda/ephemera/calibration/objectMatch/`](../../../../../lambda/ephemera/calibration/objectMatch/) --- [`corpus.ts`](../../../../../lambda/ephemera/calibration/objectMatch/corpus.ts) **types and labeled static cases** (no Bedrock). **Not** handlers, `app.ts` routes, or live scorer (**EM-4** owns calibration tooling implementation per **EM-D8**).

- [X] **EM-1. Read gateway + cache**
  - [X] Add `packages/mtw-gateways/ts/ephemera/objectEmbedding/`: `fetch`, keys, **`createObjectEmbeddingCacheHandler`**, `AGENT.md` (v1 reads `EMBEDDING#IMPROMPTU`).
  - [X] Register as **`internalCache.ObjectEmbedding`** on [`lambda/ephemera/internalCache/index.ts`](../../../../../lambda/ephemera/internalCache/index.ts).
  - [X] Wire [`invalidateImprovisationObjectCaches.ts`](../../../../../lambda/ephemera/dataSource/objects/invalidateImprovisationObjectCaches.ts) memo invalidation for affected `objectId`s.
  - [X] Package tests: batch get, missing row, invalid row rejected.
  - [X] Add ownership row to [`packages/mtw-gateways/AGENT.md`](../../../../../packages/mtw-gateways/AGENT.md).

- [X] **EM-2. Pure match policy (no Bedrock)**
  - [X] `decideEmbeddingMatch(scores)` -> `Resolved` | `Abstain` with reason enum.
  - [X] `rankCatalogByCosineSimilarity(spanEmbedding, candidates)` using `SemanticEmbedding.cosineSimilarity`.
  - [X] Consume labeled cases from [`calibration/objectMatch/corpus.ts`](../../../../../lambda/ephemera/calibration/objectMatch/corpus.ts) (scaffolded in **EM-0**) with **mocked** vectors for unit tests.
  - [X] Unit tests: gates pass/fail independently; identical-shortName duplicate catalog excluded from auto-resolve path. Threshold assertions against locked constants wait for **EM-4**.

- [X] **EM-3. Span embed helper**
  - [X] Extract or share embed path with [`buildShortNameSemanticEmbedding.ts`](../../../../../lambda/ephemera/dataSource/objects/embedding/buildShortNameSemanticEmbedding.ts) via [`embedNormalizedSemanticText.ts`](../../../../../lambda/ephemera/dataSource/objects/embedding/embedNormalizedSemanticText.ts) (normalize + `invokeBedrockTitanEmbed` + `SemanticEmbedding.fromFloat32`).
  - [X] Injectable deps for tests (mock embed); shared by calibration scorer and identity stage --- [`embedObjectSpan.ts`](../../../../../lambda/ephemera/dataSource/objects/embedding/embedObjectSpan.ts).
  - [X] Empty normalized span -> abstain without Bedrock.

- [X] **EM-4. Threshold calibration tooling + lock constants** (implements **EM-D8**; closes **EM-D2**, **EM-D4**)
  - [X] Add live tooling under [`lambda/ephemera/calibration/`](../../../../../lambda/ephemera/calibration/): top-level `routeCalibrationEvent.ts`, `AGENT.md`; object-match `runEmbeddingCalibration.ts`, `handlers/*` under [`objectMatch/`](../../../../../lambda/ephemera/calibration/objectMatch/) (extends **EM-0** `corpus.ts` scaffold).
  - [X] Wire `event.type` routes in [`app.ts`](../../../../../lambda/ephemera/app.ts) (IAM-gated direct invoke; no env flag).
  - [X] Handlers: `EmbeddingCompare`, `EmbeddingCalibrationCorpus`, `EmbeddingSimulateIdentity` (see **Threshold calibration tooling**).
  - [X] Run live corpus via AWS Console; **close EM-D2** (absolute gap `T_MARGIN=0.008`); calibrate **`T_abs_unary > T_abs`** per **EM-D3** (`T_ABS=0.14`, `T_ABS_UNARY=0.18`).
  - [X] **Close EM-D4:** lock constants in `embeddingMatch/thresholds.ts`; provenance comment + snapshot [`embedding-identity-v1-2026-07-07.json`](../../../../../lambda/ephemera/calibration/objectMatch/snapshots/embedding-identity-v1-2026-07-07.json).
  - [X] Extend EM-2 unit tests to assert abstain/resolve at locked thresholds.
  - [X] Snapshot JSON under `calibration/objectMatch/snapshots/`.

- [X] **EM-5. Identity integration**
  - [X] Add `resolveObjectSpanByEmbedding` orchestrator: embed span -> score pre-attached catalog vectors -> decide (no catalog load in identity stage).
  - [X] [`identityStage.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/identityStage.ts): after deterministic `noMatch`, before identity LLM; skip embedding tier on `ambiguous`; span embed failure -> fall through (EM-D5).
  - [X] [`resolveRelationalGrounding.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/resolveRelationalGrounding.ts): same tier order per span.
  - [X] Span embed dedupe per invocation (EM-D7).
  - [X] Tests: paraphrase resolves without identity mock; absent-object abstains -> identity LLM still called; exact match never embeds; embed invoke failure -> identity LLM, not Error.

- [X] **EM-6. Catalog vector load (ingress)**
  - [X] Extend catalog fetch in [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) **`handleParseRequested`**: after parallel room/held catalog `Promise.all`, union `objectId`s and batch **`internalCache.ObjectEmbedding.get`** (EM-D6); attach via [`attachEmbeddingsToCatalogEntries`](../../../../../lambda/ephemera/dataSource/actions/attachEmbeddingsToCatalogEntries.ts) before `parseCommand`.
  - [X] Type extension: `ObjectManipulationCatalogEntry` optional `embedding?: SemanticEmbedding` (via `RoomInPlayObjectCatalogEntry`, shipped pre-EM-6).
  - [X] Tests: ingress passes embeddings to `parseCommand` (`index.test.ts`); helper unit tests (`attachEmbeddingsToCatalogEntries.test.ts`).

- [ ] **EM-7. Durable docs + ship**
  - [ ] Update [`enrich/objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) step 4 (three-tier identity).
  - [ ] Keep [`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md) current (calibration findings, asymmetric experiments, closed-loop deferred) --- **survives retirement of this plan**.
  - [ ] Update [`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md): read path shipped; remove follow-up bullet when done.
  - [ ] Update [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) Bedrock budget table if present.
  - [ ] Delete or archive this task plan.

## Verification

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/ \
  dataSource/actions/parseCommand.test.ts \
  dataSource/objects/embedding/ \
  calibration/

cd packages/mtw-gateways && npm test -- objectEmbedding
```

**Manual calibration (dev stack):** Lambda Console direct invoke on EphemeraFunction:

```json
{ "type": "EmbeddingCalibrationCorpus" }
```

```json
{ "type": "EmbeddingSimulateIdentity", "span": "sword", "catalog": ["broom", "anvil", "lantern"] }
```

**Regression greps (after ship):**

```bash
# Three-tier identity wiring
rg -n "resolveObjectSpanByEmbedding|decideEmbeddingMatch" lambda/ephemera/dataSource/actions/

# Gateway registered
rg -n "createObjectEmbeddingCacheHandler|ObjectEmbedding" lambda/ephemera/internalCache/ packages/mtw-gateways/

# Read path uses internalCache, not direct ephemeraDB in identity stage
rg -n "ephemeraDB" lambda/ephemera/dataSource/actions/enrich/objectManipulation/

# Calibration tooling
rg -n "routeCalibrationEvent" lambda/ephemera/
```

**Manual smoke (optional):** Coyote room with known objects; paraphrase take command should skip identity LLM in logs/mocks; nonsense noun with non-empty catalog should still invoke identity LLM. Re-run **`EmbeddingCalibrationCorpus`** after embedding model changes.

## Calibration findings (promoted to durable docs)

**Authoritative long-lived write-up:** [`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md) (do not duplicate here; update that file when re-running ladders).

**Snapshots:** [`embedding-identity-v1-2026-07-07.json`](../../../../../lambda/ephemera/calibration/objectMatch/snapshots/embedding-identity-v1-2026-07-07.json), [`asymmetric-identity-ladder-v1-2026-07-07.json`](../../../../../lambda/ephemera/calibration/objectMatch/snapshots/asymmetric-identity-ladder-v1-2026-07-07.json).

**Headlines (2026-07-07):**

- Symmetric shortName Titan scores are low and distributional; margin gate is essential; terminal paraphrase resolve is fragile.
- Asymmetric `shortNamePlusDescription` index improves paraphrase rank separation and lowers key absent-object false-positive pairs vs symmetric; `descriptionOnly` is unsafe.
- v1 open-loop `Resolved` is a shipping compromise; **closed-loop candidate recommender + validation** is the intended correction architecture (see **Explicitly deferred** and `embeddingMatch/AGENT.md`).

**Post-EM tooling shipped:** `EmbeddingAsymmetricLadder` ([`calibration/AGENT.md`](../../../../../lambda/ephemera/calibration/AGENT.md)).

## Coordination notes

- **Objects lane** already writes `EMBEDDING#IMPROMPTU`; no write-path changes required for v1 read. Backfill: objects spawned before embed ship may lack rows --- treated as ineligible, not errors.
- **Bedrock budget:** embedding fast path adds **one Titan embed per span** when exact match fails; it **removes** one Converse identity call when gates pass. Net win only on confident hits.
- **Calibration re-run:** after embedding model / encoding change, re-run **`EmbeddingCalibrationCorpus`** (AWS Console) and update `thresholds.ts` provenance comment before shipping new constants.
- **Unary policy (EM-D3):** no lexical backstop; tune **`T_abs_unary`** only. Residual fast-path risk (including synonym matches like `sword` -> sole `ornate rapier`) is acceptable in v1; track **post-identity validation + retry loop** as the intended correction layer (not in this plan).
- **Identity LLM abstain** remains a follow-on; do not rely on `noMatch` from [`unaryCollapse.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/unaryCollapse.ts) after LLM success today.
