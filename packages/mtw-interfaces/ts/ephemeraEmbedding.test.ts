import { SemanticEmbedding, SEMANTIC_EMBEDDING_V1_DIMENSIONS } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import {
    EMBEDDING_IMPROMPTU_DATA_CATEGORY,
    isEphemeraObjectEmbedding,
} from './ephemeraEmbedding'

const TEST_MODEL_ID = 'amazon.titan-embed-text-v2:0'

const makeEmbeddingRecord = () => {
    const values = Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, () => 0)
    values[0] = 1
    return SemanticEmbedding.fromFloat32(values, { modelId: TEST_MODEL_ID }).toDynamoRecord()
}

describe('isEphemeraObjectEmbedding', () => {
    const objectId = 'OBJECT#helmet' as const

    const baseRow = {
        EphemeraId: objectId,
        DataCategory: EMBEDDING_IMPROMPTU_DATA_CATEGORY,
        embedding: makeEmbeddingRecord(),
    }

    it('accepts valid EMBEDDING#IMPROMPTU row', () => {
        expect(isEphemeraObjectEmbedding(baseRow)).toBe(true)
    })

    it('accepts row with sourceTextHash on embedding', () => {
        expect(
            isEphemeraObjectEmbedding({
                ...baseRow,
                embedding: {
                    ...baseRow.embedding,
                    sourceTextHash: 'abc123',
                },
            })
        ).toBe(true)
    })

    it('rejects wrong DataCategory', () => {
        expect(
            isEphemeraObjectEmbedding({
                ...baseRow,
                DataCategory: 'Meta::Object',
            })
        ).toBe(false)
    })

    it('rejects non-object EphemeraId', () => {
        expect(
            isEphemeraObjectEmbedding({
                ...baseRow,
                EphemeraId: 'ROOM#Cafe',
            })
        ).toBe(false)
    })

    it('rejects missing embedding', () => {
        expect(
            isEphemeraObjectEmbedding({
                EphemeraId: objectId,
                DataCategory: EMBEDDING_IMPROMPTU_DATA_CATEGORY,
            })
        ).toBe(false)
    })

    it('rejects malformed embedding dimensions', () => {
        expect(
            isEphemeraObjectEmbedding({
                ...baseRow,
                embedding: {
                    ...baseRow.embedding,
                    dimensions: 128,
                },
            })
        ).toBe(false)
    })

    it('rejects number[] vector', () => {
        expect(
            isEphemeraObjectEmbedding({
                ...baseRow,
                embedding: {
                    ...baseRow.embedding,
                    vector: Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, () => 0),
                },
            })
        ).toBe(false)
    })

    it('rejects wrong-length vector', () => {
        expect(
            isEphemeraObjectEmbedding({
                ...baseRow,
                embedding: {
                    ...baseRow.embedding,
                    vector: new Uint8Array(128),
                },
            })
        ).toBe(false)
    })

    it('rejects stableKey cross-row field', () => {
        expect(
            isEphemeraObjectEmbedding({
                ...baseRow,
                stableKey: 'helmet',
            })
        ).toBe(false)
    })

    it('rejects shortName cross-row field', () => {
        expect(
            isEphemeraObjectEmbedding({
                ...baseRow,
                shortName: 'helmet',
            })
        ).toBe(false)
    })
})
