import { isEphemeraObjectEmbedding } from '@tonylb/mtw-interfaces/ts/ephemeraEmbedding'
import {
    SemanticEmbedding,
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
    SEMANTIC_EMBEDDING_V1_ENCODING,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import { objectEmbeddingPutItem } from './objectEmbeddingPutItem'

const TEST_MODEL_ID = 'amazon.titan-embed-text-v2:0'

describe('objectEmbeddingPutItem', () => {
    const objectId = 'OBJECT#Anvil' as const

    it('builds transact Put with EMBEDDING#IMPROMPTU row shape', () => {
        const values = Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, () => 0)
        values[0] = 1
        const embedding = SemanticEmbedding.fromFloat32(values, { modelId: TEST_MODEL_ID })

        const item = objectEmbeddingPutItem({ objectId, embedding })

        expect(item.Put.EphemeraId).toBe(objectId)
        expect(item.Put.DataCategory).toBe('EMBEDDING#IMPROMPTU')
        expect(item.Put.embedding.modelId).toBe(TEST_MODEL_ID)
        expect(item.Put.embedding.dimensions).toBe(SEMANTIC_EMBEDDING_V1_DIMENSIONS)
        expect(item.Put.embedding.encoding).toBe(SEMANTIC_EMBEDDING_V1_ENCODING)
        expect(item.Put.embedding.vector).toBeInstanceOf(Uint8Array)
        expect(item.Put.embedding.vector.byteLength).toBe(SEMANTIC_EMBEDDING_V1_DIMENSIONS)
        expect(isEphemeraObjectEmbedding(item.Put)).toBe(true)
    })
})
