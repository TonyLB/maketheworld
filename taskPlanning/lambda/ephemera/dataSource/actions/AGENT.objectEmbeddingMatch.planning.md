# Object identity --- embedding fast path (EMBEDDING#IMPROMPTU)

**Status:** Not started. Next step: **EM-0** --- close remaining **EM-D*** open decisions, then **EM-1** read gateway + `internalCache.ObjectEmbedding`.

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
- **Calibration tooling** under [`lambda/ephemera/calibration/`](../../../../../lambda/ephemera/calibration/) --- shared corpus + live Bedrock scorer, dev-only direct-invoke handlers (AWS Console), optional local runner (see **Threshold calibration tooling** below).
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
| **Live runners** | Dev-only lambda direct invoke (Console) **and** optional local script calling the same pure scorer |

### `lambda/ephemera/calibration/` layout (target)

```text
lambda/ephemera/calibration/
  AGENT.md                 # Console payloads, env gate, when to re-run
  corpus.ts                # labeled calibration cases (source of truth)
  runEmbeddingCalibration.ts   # pure: embed texts, pairwise / catalog simulate, stats
  routeCalibrationEvent.ts     # dispatch event.type -> handler; env gate
  handlers/
    comparePair.ts         # two strings -> similarity (+ model metadata)
    runCorpus.ts           # full corpus -> matrix + bucket stats
    simulateIdentity.ts    # span + catalog shortNames -> ranked list + gate verdict
  runLocal.ts              # optional: local runner (dev AWS profile); same scorer as lambda
```

**Import rule:** calibration modules **may** import shared embed helpers (`invokeBedrockTitanEmbed`, normalization, `SemanticEmbedding`). Production **`embeddingMatch/`** imports calibration **corpus types only** if needed --- not handler wiring.

### Direct lambda invoke (AWS Console)

Wire in [`app.ts`](../../../../../lambda/ephemera/app.ts) **early** (before API / WebSocket paths): if `event.type` matches a calibration type, call `routeCalibrationEvent` and **return** structured JSON. Pattern matches diagnostics [`event.type`](../../../../../lambda/diagnostics/app.ts) sweeps --- **not** API Gateway.

| `event.type` | Payload (sketch) | Output |
| --- | --- | --- |
| `EmbeddingCompare` | `{ "left": "broom", "right": "sweeping tool" }` | `similarity`, normalized texts, `modelId`, dimensions |
| `EmbeddingCalibrationCorpus` | `{}` or `{ "bucket": "absent-object" }` optional filter | Pair matrix + per-bucket min/median/max + suggested threshold headroom |
| `EmbeddingSimulateIdentity` | `{ "span": "sword", "catalog": ["broom", "anvil", "lantern"] }` | Ranked scores, margin, pass/fail for candidate `T_abs` / `T_margin` |

**Guardrails (required):**

- **`ENABLE_EMBEDDING_CALIBRATION=true`** in Environment (dev stack only); handler returns forbidden when unset.
- **Read-only:** embed + compare only; no Dynamo writes, no side effects on game state.
- **Not exposed** via API Gateway --- Console / IAM invoke only.
- Output includes **`modelId`** and calibration run timestamp so saved Console results stay interpretable.

Add `ENABLE_EMBEDDING_CALIBRATION` to dev **`template.yaml`** only when wiring handlers (omit or `false` in prod).

### Local runner (fast iteration)

`calibration/runLocal.ts` (or npm script) calls the same `runEmbeddingCalibration.ts` with dev AWS credentials. Use for tight threshold tuning; use lambda Console run to **verify IAM + deployed code path** before locking constants.

### What to commit

- Corpus definitions + bucket labels (not necessarily numeric thresholds forever).
- Pure scorer + handler dispatch + env gate.
- Conservative initial `thresholds.ts` with comment: `// Calibrated against corpus <id> on <modelId> at <date>`.
- Optional: snapshot JSON under `calibration/snapshots/` after a live run (diff when model changes).

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

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| EM-D1 | **Gateway shape** --- **`createObjectEmbeddingCacheHandler(ephemeraDB)`** with `get(objectIds[])` batch read; v1 fetches `EMBEDDING#IMPROMPTU`; writer = objects lane; reader = ephemera `internalCache`; memo invalidate on object delete/update. Scope-neutral name so authored-object embedding rows can share the handler later without renames. | Phase EM-1, ingress | Decided |
| EM-D2 | **Margin rule** --- absolute gap `sim_best - sim_2nd >= T_margin` vs ratio `sim_best / sim_2nd >= R_margin`; pick one in calibration | Phase EM-4 thresholds | Open |
| EM-D3 | **Unary catalog policy** --- **`T_abs_unary > T_abs` only**; no lexical backstop. Rely on calibration unary-trap corpus for headroom; accept that high-sim synonym pairs (e.g. `sword` / sole `ornate rapier`) may fast-path. Mitigation deferred: post-identity validation LLM + identification retry with broader/expensive pass | Phase EM-4 thresholds | Decided |
| EM-D4 | **Threshold constants** --- `T_abs`, `T_abs_unary`, `T_margin` (or `R_margin`) from calibration fixture; document provenance in code comment | Phase EM-5 ship | Open |
| EM-D5 | **Embed invoke failure** --- always fall through to identity LLM; **no terminal Error** | Phase EM-5 wiring | Decided |
| EM-D6 | **Catalog vector load site** --- batch at **`parseCommand` catalog ingress**; run **`internalCache.ObjectEmbedding.get(objectIds)`** in **parallel** with existing room/held catalog fetches; identity stage uses pre-attached vectors only | Phase EM-6 | Decided |
| EM-D7 | **Span embed dedupe** --- **required optimization**, not a fork: one Bedrock embed per **distinct normalized span** per lambda invocation (e.g. relational subject + target reusing the same span). Cache in identity-stage context (`Map<normalizedSpan, SemanticEmbedding>` or equivalent). No alternative considered for v1 | Phase EM-5 wiring | Decided |
| EM-D8 | **Calibration tooling** --- `lambda/ephemera/calibration/` shared corpus + pure scorer; dev-only direct invoke via `event.type` in [`app.ts`](../../../../../lambda/ephemera/app.ts); `ENABLE_EMBEDDING_CALIBRATION` env gate; optional local `runLocal.ts`; calibrate on **quantized** `SemanticEmbedding` path | Phase EM-4 | Decided |

## Progress

| Phase | Focus | Status |
| --- | --- | --- |
| **EM-0** | Decision lock + module layout | Not started |
| **EM-1** | Read gateway + `internalCache` + cache invalidation | Not started |
| **EM-2** | Pure match policy + calibration fixture (mocked vectors) | Not started |
| **EM-3** | Span embed helper | Not started |
| **EM-4** | Calibration corpus + live tooling + lock thresholds | Not started |
| **EM-5** | Wire `identityStage` + `resolveRelationalGrounding` | Not started |
| **EM-6** | Catalog ingress batch load (parallel with catalog fetches) | Not started |
| **EM-7** | Durable docs + verification | Not started |

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines as you finish each sub-step.

- [ ] **EM-0. Decision lock + layout**
  - [ ] Close remaining **EM-D*** rows in **Open decisions** (or mark N/A with one-line rationale).
  - [ ] Production match policy under [`enrich/objectManipulation/embeddingMatch/`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/).
  - [ ] Calibration tooling under [`lambda/ephemera/calibration/`](../../../../../lambda/ephemera/calibration/) (EM-D8).

- [ ] **EM-1. Read gateway + cache**
  - [ ] Add `packages/mtw-gateways/ts/ephemera/objectEmbedding/`: `fetch`, keys, **`createObjectEmbeddingCacheHandler`**, `AGENT.md` (v1 reads `EMBEDDING#IMPROMPTU`).
  - [ ] Register as **`internalCache.ObjectEmbedding`** on [`lambda/ephemera/internalCache/index.ts`](../../../../../lambda/ephemera/internalCache/index.ts).
  - [ ] Wire [`invalidateImprovisationObjectCaches.ts`](../../../../../lambda/ephemera/dataSource/objects/invalidateImprovisationObjectCaches.ts) memo invalidation for affected `objectId`s.
  - [ ] Package tests: batch get, missing row, invalid row rejected.
  - [ ] Add ownership row to [`packages/mtw-gateways/AGENT.md`](../../../../../packages/mtw-gateways/AGENT.md).

- [ ] **EM-2. Pure match policy (no Bedrock)**
  - [ ] `decideEmbeddingMatch(scores)` -> `Resolved` | `Abstain` with reason enum.
  - [ ] `rankCatalogByCosineSimilarity(spanEmbedding, candidates)` using `SemanticEmbedding.cosineSimilarity`.
  - [ ] Import or re-export corpus buckets from [`calibration/corpus.ts`](../../../../../lambda/ephemera/calibration/corpus.ts) for mocked-vector unit tests.
  - [ ] Unit tests: gates pass/fail independently; identical-shortName duplicate catalog excluded from auto-resolve path.

- [ ] **EM-3. Span embed helper**
  - [ ] Extract or share embed path with [`buildShortNameSemanticEmbedding.ts`](../../../../../lambda/ephemera/dataSource/objects/embedding/buildShortNameSemanticEmbedding.ts) (normalize + `invokeBedrockTitanEmbed` + `SemanticEmbedding.fromFloat32`).
  - [ ] Injectable deps for tests (mock embed); shared by calibration scorer and identity stage.
  - [ ] Empty normalized span -> abstain without Bedrock.

- [ ] **EM-4. Threshold calibration tooling + lock constants**
  - [ ] Add [`lambda/ephemera/calibration/`](../../../../../lambda/ephemera/calibration/): `corpus.ts`, `runEmbeddingCalibration.ts`, `routeCalibrationEvent.ts`, `handlers/*`, `AGENT.md`.
  - [ ] Wire `event.type` routes in [`app.ts`](../../../../../lambda/ephemera/app.ts) behind **`ENABLE_EMBEDDING_CALIBRATION`** (EM-D8).
  - [ ] Handlers: `EmbeddingCompare`, `EmbeddingCalibrationCorpus`, `EmbeddingSimulateIdentity` (see **Threshold calibration tooling**).
  - [ ] Optional `runLocal.ts` + npm script for local corpus runs (same scorer as lambda).
  - [ ] Run live corpus (local or Console); pick **EM-D2** margin rule; calibrate **`T_abs_unary > T_abs`** per **EM-D3** (unary-trap bucket).
  - [ ] Lock `T_abs`, `T_abs_unary`, `T_margin` in `embeddingMatch/thresholds.ts`; comment links to corpus + model + date.
  - [ ] Extend EM-2 unit tests to assert abstain/resolve at locked thresholds.
  - [ ] Optional: commit snapshot JSON under `calibration/snapshots/` for model migration diffs.

- [ ] **EM-5. Identity integration**
  - [ ] Add `resolveObjectSpanByEmbedding` orchestrator: embed span -> score pre-attached catalog vectors -> decide (no catalog load in identity stage).
  - [ ] [`identityStage.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/identityStage.ts): after deterministic `noMatch`, before identity LLM; skip embedding tier on `ambiguous`; span embed failure -> fall through (EM-D5).
  - [ ] [`resolveRelationalGrounding.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/resolveRelationalGrounding.ts): same tier order per span.
  - [ ] Span embed dedupe per invocation (EM-D7).
  - [ ] Tests: paraphrase resolves without identity mock; absent-object abstains -> identity LLM still called; exact match never embeds; embed invoke failure -> identity LLM, not Error.

- [ ] **EM-6. Catalog vector load (ingress)**
  - [ ] Extend catalog fetch in [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts): **`Promise.all`** (or equivalent) parallel batch --- room catalog, held catalog, **`ObjectEmbedding.get`** for union of catalog `objectId`s (EM-D6).
  - [ ] Type extension: `ObjectManipulationCatalogEntry` optional `embedding?: SemanticEmbedding`.
  - [ ] Tests: ingress passes embeddings to identity stage mocks.

- [ ] **EM-7. Durable docs + ship**
  - [ ] Update [`enrich/objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) step 4 (three-tier identity).
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

**Manual calibration (dev stack, after EM-4):** Lambda Console test on EphemeraFunction with `ENABLE_EMBEDDING_CALIBRATION=true`:

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

# Calibration tooling (dev-only)
rg -n "ENABLE_EMBEDDING_CALIBRATION|routeCalibrationEvent" lambda/ephemera/
```

**Manual smoke (optional):** Coyote room with known objects; paraphrase take command should skip identity LLM in logs/mocks; nonsense noun with non-empty catalog should still invoke identity LLM. Re-run **`EmbeddingCalibrationCorpus`** after embedding model changes.

## Coordination notes

- **Objects lane** already writes `EMBEDDING#IMPROMPTU`; no write-path changes required for v1 read. Backfill: objects spawned before embed ship may lack rows --- treated as ineligible, not errors.
- **Bedrock budget:** embedding fast path adds **one Titan embed per span** when exact match fails; it **removes** one Converse identity call when gates pass. Net win only on confident hits.
- **Calibration re-run:** after embedding model / encoding change, re-run **`EmbeddingCalibrationCorpus`** (Console or local) and update `thresholds.ts` provenance comment before shipping new constants.
- **Unary policy (EM-D3):** no lexical backstop; tune **`T_abs_unary`** only. Residual fast-path risk (including synonym matches like `sword` -> sole `ornate rapier`) is acceptable in v1; track **post-identity validation + retry loop** as the intended correction layer (not in this plan).
- **Identity LLM abstain** remains a follow-on; do not rely on `noMatch` from [`unaryCollapse.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/unaryCollapse.ts) after LLM success today.
