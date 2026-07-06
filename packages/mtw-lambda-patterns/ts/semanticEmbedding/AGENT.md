# Semantic Embedding - Agent Navigation Guide

## Overview

The semantic embedding pattern provides an immutable value type for storing and comparing Titan Text Embedding v2 vectors. Instances keep only quantized int8 bytes plus metadata; float vectors are accepted at construction time and discarded after quantization.

## Core Purpose

- **Canonical storage**: Quantized `int8-v1` bytes in `Uint8Array`, not float32 on the instance
- **Dynamo-safe serde**: `toDynamoRecord()` / `fromDynamoRecord()` with `vector` as `Uint8Array` for AWS SDK `marshall` / `unmarshall`
- **Comparison**: `cosineSimilarity()` via transient dequantization; `equals()` on bytes and metadata

## Import

Deep import only (no package barrel today):

```ts
import {
    SemanticEmbedding,
    SemanticEmbeddingDynamoRecord
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
```

## Documentation

- **[Implementation Guide](./AGENT.implementation.md)** - Quantization rules, API surface, and invariants

## Related Work

- **Dynamo binary proof tests**: [`binaryRoundTrip.test.ts`](../../../../mtw-utilities/ts/dynamoDB/mixins/binaryRoundTrip.test.ts) in `mtw-utilities` verifies existing handlers round-trip nested `Uint8Array` fields through `putItem`, `getItem`, and `transactWrite` without handler changes
- **Ephemera object-span identity** (follow-up): first prototype consumer for embedding-backed resolve
