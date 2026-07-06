# Semantic embedding value type (`mtw-lambda-patterns`) + Dynamo binary round-trip tests

**Status:** Complete. All foundations slices shipped; ready for follow-up ephemera task plan.

Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) once for durability expectations, what belongs in task plans vs durable package docs, and recommended-order checkbox conventions.

## Purpose

Ship a **foundational** `SemanticEmbedding` value type in **`@tonylb/mtw-lambda-patterns`** that can:

- Accept Titan Text Embedding v2 float output (256 dimensions, normalized) at construction time, then **store only** quantized int8 (canonical representation)
- Expose a Dynamo-safe binary representation (`Uint8Array`) via exported `SemanticEmbeddingDynamoRecord`
- Deserialize from stored binary + metadata
- Compare embeddings (cosine similarity, byte-wise equality) without retaining float state on the instance

Also add **proof tests** in **`mtw-utilities`** that existing Dynamo handlers round-trip `Uint8Array` binary fields through `putItem`, `getItem`, and `transactWrite` --- without handler code changes (AWS SDK `marshall` / `unmarshall` already support `B` attributes).

This plan is **foundations only**. Wiring embeddings into ephemera features is **out of scope** here and lands in follow-up task plans.

## Downstream motivation (context only --- not in scope)

The **first prototype consumer** (follow-up plan) is **object-span identity** in action parse: attach embeddings to **Objects** so a deterministic path can map classify **`objectSpans`** strings to trusted **`EphemeraObjectId`** / component references, reducing reliance on the identity LLM when deterministic **`shortName`** match fails.

Today:

- Classify emits raw **`objectSpans`** ([`buildIntentClassificationPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/buildIntentClassificationPrompt.ts)).
- Enrich resolves spans via exact normalized **`shortName`** match ([`resolveObjectSpan.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/resolveObjectSpan.ts)); **`NoMatch`** / **`AmbiguousMatch`** fall through to the identity LLM ([`identityStage.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/identityStage.ts)).
- Object labels live on improvisation pair rows; play meta on **`Meta::Object`** ([`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md)).

**Ephemera render cache** (`CACHE#` rows) may use embeddings later for constellation / nearby-example search; that is **not** the first prototype and is **not** part of this plan.

## Scope

### In scope

| Deliverable | Location |
| --- | --- |
| `SemanticEmbedding` class (quantize, dequantize, serialize, cosine compare) | [`packages/mtw-lambda-patterns/ts/semanticEmbedding/`](../../../../../packages/mtw-lambda-patterns/ts/semanticEmbedding/) (new) |
| Unit tests for embedding math and serde | same directory |
| Dynamo binary round-trip integration tests | [`packages/mtw-utilities/ts/dynamoDB/`](../../../../../packages/mtw-utilities/ts/dynamoDB/) (new test file alongside existing mixin tests) |
| Brief durable note in [`packages/mtw-lambda-patterns/AGENT.md`](../../../../../packages/mtw-lambda-patterns/AGENT.md) listing the new pattern (one paragraph + link) |

### Out of scope (follow-up task plans)

- **`invokeBedrockTitanEmbedText`** and IAM for `amazon.titan-embed-text-v2:0`
- Storing embeddings on Object rows in ephemeraDB
- Object-span resolve / identity-stage integration
- `internalCache` or gateway type changes
- Render-cache embedding fields
- Any import of `SemanticEmbedding` from `lambda/ephemera`

## Design sketch (foundations)

### Locked decisions

| ID | Decision |
| --- | --- |
| SE-1 | **`int8-v1`** quantization: symmetric scale **127** on normalized Titan floats (`round(clamp(float * 127, -128, 127))`). **Canonical instance storage is quantized int8** (`Uint8Array`), not float32. Floats are an ingest-time input only; dequantization is transient (e.g. for `cosineSimilarity`) and not retained --- re-derived ints carry no extra accuracy over stored ints, and avoid any comparison jitter from float round-trip. |
| SE-2 | **Immutable class** (same spirit as [`StandardComponent`](../../../../../packages/mtw-wml/ts/standardize/components/component.ts) value types). **No mutative methods** that change the embedding; factories / static parsers only. |
| SE-3 | Export **`SemanticEmbeddingDynamoRecord`** type for the nested Dynamo map shape, plus `toDynamoRecord()` / `fromDynamoRecord()`. |
| SE-4 | Dynamo round-trip tests use **mock client** (existing mixin test style in `mtw-utilities`), not local Dynamo. |

### `SemanticEmbedding` API (target)

Pure TypeScript --- no AWS SDK, no Bedrock. Deep import path (no package barrel today): `@tonylb/mtw-lambda-patterns/ts/semanticEmbedding`.

| Concern | Approach |
| --- | --- |
| Shape | Immutable class; private/read-only quantized `vector: Uint8Array` + metadata fields |
| Construction | `SemanticEmbedding.fromFloat32(values, metadata)` --- quantize once, discard floats; dimension guard (256 for v1) |
| Rehydration | `SemanticEmbedding.fromBinary(bytes, metadata)` / `fromDynamoRecord(record)` --- no float path |
| Quantization | **`int8-v1`** (see SE-1); Titan ingest assumes normalized vectors in ~`[-1, 1]` |
| Dynamo | Exported **`SemanticEmbeddingDynamoRecord`**: `{ modelId, dimensions, encoding, vector: Uint8Array }` --- `marshall` maps `vector` to `B` |
| Serialization | `toBinary()`, `toDynamoRecord()`; inverse on static factories |
| Comparison | `cosineSimilarity(other)` --- dequantize both sides transiently for dot product; `equals(other)` on quantized bytes + metadata |
| Mutations | None planned --- no in-place update APIs on the class |
| Metadata | `modelId`, `dimensions`, `encoding` required; optional `sourceTextHash` reserved for future invalidation (not required in v1 tests) |

### Dynamo handlers

Existing write paths already call `marshall(..., { removeUndefinedValues: true })` ([`primitives.ts`](../../../../../packages/mtw-utilities/ts/dynamoDB/mixins/primitives.ts), [`transact.ts`](../../../../../packages/mtw-utilities/ts/dynamoDB/mixins/transact.ts)). **No handler expansion** unless round-trip tests fail.

Tests should cover:

- `putItem` + `getItem` with top-level and nested `Uint8Array`
- `transactWrite` Put containing binary field
- Assert unmarshalled `vector` is `Uint8Array` with identical bytes

## Getting started

1. **Task-plan framework** --- [`taskPlanning/AGENT.md`](../../../../AGENT.md)
2. **Pattern package conventions** --- [`packages/mtw-lambda-patterns/AGENT.md`](../../../../../packages/mtw-lambda-patterns/AGENT.md)
3. **Dynamo handler layout** --- [`packages/mtw-utilities/ts/dynamoDB/index.ts`](../../../../../packages/mtw-utilities/ts/dynamoDB/index.ts) and mixin tests under `mixins/`
4. **Object-span resolve context (follow-up)** --- [`actions/enrich/objectManipulation/resolveObjectSpan.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/resolveObjectSpan.ts), [`identityStage.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/identityStage.ts)
5. **Object storage split (follow-up)** --- [`lambda/ephemera/dataSource/objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md)

### Testing commands

Command authority: package-local Jest (`npm test` in each package).

Baseline before edits (should pass):

```bash
cd packages/mtw-lambda-patterns && npm test
cd packages/mtw-utilities && npm test
```

## Progress

| Area | State |
| --- | --- |
| Task plan scaffold | Done |
| Design decisions SE-1 -- SE-4 locked | Done |
| `SemanticEmbedding` implementation | Done |
| `mtw-lambda-patterns` unit tests | Done |
| Dynamo binary round-trip tests (`mtw-utilities`) | Done |
| `mtw-lambda-patterns/AGENT.md` pattern entry | Done |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested lines `[X]` as you complete them.

- [X] **SE foundations --- `SemanticEmbedding`**
  - [X] Add [`packages/mtw-lambda-patterns/ts/semanticEmbedding/index.ts`](../../../../../packages/mtw-lambda-patterns/ts/semanticEmbedding/index.ts) (and supporting modules if needed).
  - [X] Implement immutable class: `fromFloat32` (quantize-on-construct), `fromBinary` / `fromDynamoRecord`, `toBinary` / `toDynamoRecord`, `cosineSimilarity`, `equals`; export `SemanticEmbeddingDynamoRecord`.
  - [X] Assert instance holds int8 bytes only after construction (no retained float32 field).
  - [X] Lock `int8-v1` / scale-127 encoding and 256-dimension guard with unit tests (known float vectors, edge values -1/0/1, wrong-length rejection).
  - [X] Test cosine: identical embeddings -> ~1; orthogonal unit vectors -> ~0; round-trip float ingest -> int storage -> transient dequant within tolerance.
- [X] **Dynamo proof tests --- `mtw-utilities`**
  - [X] Add test file (e.g. `packages/mtw-utilities/ts/dynamoDB/mixins/binaryRoundTrip.test.ts`) using **mock client** (same style as existing mixin tests).
  - [X] `putItem` + `getItem` round-trip with nested `semanticEmbedding.vector: Uint8Array`.
  - [X] `transactWrite` Put with same shape; verify bytes after read path.
  - [X] Document in test file comment: handlers require `Uint8Array`, not `number[]` or base64 strings.
- [X] **Durable doc touch-up**
  - [X] Add **Semantic embedding** entry to [`packages/mtw-lambda-patterns/AGENT.md`](../../../../../packages/mtw-lambda-patterns/AGENT.md) (overview + link to implementation directory).
- [X] **Close plan slice**
  - [X] Run verification commands below.
  - [X] Update Progress table and Recommended order checkboxes in this document.

## Verification

From repo root:

```bash
cd packages/mtw-lambda-patterns && npm test -- semanticEmbedding
cd packages/mtw-utilities && npm test -- binaryRoundTrip
cd packages/mtw-lambda-patterns && npm test
cd packages/mtw-utilities && npm test
```

Grep spot-checks after implementation:

- `SemanticEmbedding` exported only from `packages/mtw-lambda-patterns/ts/semanticEmbedding/` (no ephemera imports yet)
- No changes under `lambda/ephemera/` in this slice

## When this plan finishes

1. Merge lasting API notes into [`packages/mtw-lambda-patterns/AGENT.md`](../../../../../packages/mtw-lambda-patterns/AGENT.md) (and add `AGENT.implementation.md` under `ts/semanticEmbedding/` only if the API warrants it).
2. Open a **separate** task plan under `taskPlanning/lambda/ephemera/` for: Bedrock Titan embed invoke, Object row storage, and identity-stage embedding resolve (prototype).
3. Delete or archive this planning file per [`taskPlanning/AGENT.md`](../../../../AGENT.md).
