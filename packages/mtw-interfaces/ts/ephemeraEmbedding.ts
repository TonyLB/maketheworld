import { isEphemeraObjectId, type EphemeraObjectId } from './baseClasses'
import type { SemanticEmbeddingDynamoRecord } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import {
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
    SEMANTIC_EMBEDDING_V1_ENCODING,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

//
// Semantic embedding adjacency rows on ephemera Dynamo (objects lane).
// PK = OBJECT#; SK = EMBEDDING#IMPROMPTU (v1 impromptu scope).
//
// Vector serde: packages/mtw-lambda-patterns/ts/semanticEmbedding/AGENT.implementation.md
//

export const EMBEDDING_IMPROMPTU_DATA_CATEGORY = 'EMBEDDING#IMPROMPTU' as const

export type EphemeraObjectEmbedding = {
    EphemeraId: EphemeraObjectId;
    DataCategory: typeof EMBEDDING_IMPROMPTU_DATA_CATEGORY;
    embedding: SemanticEmbeddingDynamoRecord;
}

const FORBIDDEN_CROSS_ROW_FIELDS = [
    'stableKey',
    'shortName',
    'tag',
    'uuid',
    'tropeAffinities',
    'tropeAffinitiesFailed',
] as const

const isSemanticEmbeddingFieldValid = (value: unknown): value is SemanticEmbeddingDynamoRecord => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false
    }
    const record = value as Record<string, unknown>
    if (typeof record.modelId !== 'string' || record.modelId.trim().length === 0) {
        return false
    }
    if (record.dimensions !== SEMANTIC_EMBEDDING_V1_DIMENSIONS) {
        return false
    }
    if (record.encoding !== SEMANTIC_EMBEDDING_V1_ENCODING) {
        return false
    }
    if (!(record.vector instanceof Uint8Array)) {
        return false
    }
    if (record.vector.byteLength !== SEMANTIC_EMBEDDING_V1_DIMENSIONS) {
        return false
    }
    if (
        record.sourceTextHash !== undefined &&
        typeof record.sourceTextHash !== 'string'
    ) {
        return false
    }
    return true
}

export const isEphemeraObjectEmbedding = (entry: unknown): entry is EphemeraObjectEmbedding => {
    if (typeof entry !== 'object' || entry === null) {
        return false
    }
    const o = entry as Record<string, unknown>
    if (
        typeof o.EphemeraId !== 'string' ||
        !isEphemeraObjectId(o.EphemeraId) ||
        o.DataCategory !== EMBEDDING_IMPROMPTU_DATA_CATEGORY
    ) {
        return false
    }
    if (!isSemanticEmbeddingFieldValid(o.embedding)) {
        return false
    }
    for (const field of FORBIDDEN_CROSS_ROW_FIELDS) {
        if (field in o) {
            return false
        }
    }
    return true
}
