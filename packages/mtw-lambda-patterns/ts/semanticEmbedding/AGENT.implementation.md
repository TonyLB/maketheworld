# Semantic Embedding Implementation Guide

Implementation: [`index.ts`](./index.ts). For navigation and import path, see [`AGENT.md`](./AGENT.md).

## Locked invariants (v1)

| Constant | Value |
| --- | --- |
| `SEMANTIC_EMBEDDING_V1_DIMENSIONS` | 256 |
| `SEMANTIC_EMBEDDING_V1_ENCODING` | `int8-v1` |
| `SEMANTIC_EMBEDDING_V1_SCALE` | 127 |

**Quantization (`int8-v1`):** for each normalized float `f`, store `round(clamp(f * 127, -128, 127))` as a signed int8 byte. Bytes are held in `Uint8Array` (two's-complement view via `Int8Array`).

**Dequantization:** transient only (e.g. `cosineSimilarity`); `value / 127`. Not retained on the instance.

## API surface

| Entry | Role |
| --- | --- |
| `SemanticEmbedding.fromFloat32(values, metadata)` | Ingest Titan floats; quantize once; dimension guard |
| `SemanticEmbedding.fromBinary(bytes, metadata)` | Rehydrate from stored bytes |
| `SemanticEmbedding.fromDynamoRecord(record)` | Parse nested Dynamo map |
| `toBinary()` | Defensive copy of quantized bytes |
| `toDynamoRecord()` | `{ modelId, dimensions, encoding, vector, sourceTextHash? }` |
| `cosineSimilarity(other)` | Dot product on dequantized vectors; requires matching dimensions and encoding |
| `equals(other)` | Byte-wise equality plus metadata (`modelId`, `dimensions`, `encoding`, `sourceTextHash`) |

## Metadata

Required on wire (`SemanticEmbeddingDynamoRecord`): `modelId`, `dimensions`, `encoding`, `vector`.

`fromFloat32` / `fromBinary` accept `SemanticEmbeddingMetadata` where `dimensions` and `encoding` default to v1 constants. Wrong dimensions or unsupported encoding throw.

Optional `sourceTextHash` is reserved for future invalidation; included in `equals` when present.

## Immutability

- No mutative instance methods.
- Constructor is private; use static factories.
- `toBinary()` and `toDynamoRecord().vector` return copies so callers cannot mutate internal state.
- `fromBinary` / `fromDynamoRecord` copy incoming bytes on construction.

## Dynamo usage

Pass `toDynamoRecord()` output (or nested `semanticEmbedding` field with `vector: Uint8Array`) to existing `marshall` paths. Do **not** use `number[]` or base64 strings for `vector`.

**Reads:** use `getAllFields: true` on `getItem` / `getItems` when loading nested `semanticEmbedding` --- default projection returns only the primary key.

## Dynamo handler proof

Existing `mtw-utilities` Dynamo mixin handlers round-trip `Uint8Array` via AWS SDK `marshall` / `unmarshall` with no handler changes. Proof tests: [`binaryRoundTrip.test.ts`](../../../../mtw-utilities/ts/dynamoDB/mixins/binaryRoundTrip.test.ts). Run:

```bash
cd packages/mtw-utilities && npm test -- binaryRoundTrip
```

## Testing

Unit tests: [`index.test.ts`](./index.test.ts). Run:

```bash
cd packages/mtw-lambda-patterns && npm test -- semanticEmbedding
```
