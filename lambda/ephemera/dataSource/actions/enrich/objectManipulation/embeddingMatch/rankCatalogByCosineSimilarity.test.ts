import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { rankCatalogByCosineSimilarity } from './rankCatalogByCosineSimilarity'
import type { EmbeddingMatchCandidate } from './types'
import {
    makeEmbeddingFromAxis,
    unitVectorAlongAxis,
} from './testing/mockVectors'
import { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import { TEST_MODEL_ID } from './testing/mockVectors'

const objectA = 'OBJECT#a' as EphemeraObjectId
const objectB = 'OBJECT#b' as EphemeraObjectId
const objectC = 'OBJECT#c' as EphemeraObjectId

const candidate = (
    objectId: EphemeraObjectId,
    axis: number,
    catalogScope: 'room' | 'held' = 'room',
    withEmbedding = true
): EmbeddingMatchCandidate => ({
    objectId,
    normalizedShortName: objectId,
    catalogScope,
    embedding: withEmbedding ? makeEmbeddingFromAxis(axis) : undefined,
})

describe('rankCatalogByCosineSimilarity', () => {
    it('skips candidates without embeddings', () => {
        const spanEmbedding = makeEmbeddingFromAxis(0)
        const ranked = rankCatalogByCosineSimilarity(spanEmbedding, [
            candidate(objectA, 0),
            candidate(objectB, 1, 'room', false),
            candidate(objectC, 0),
        ])
        expect(ranked).toHaveLength(2)
        expect(ranked.map(({ objectId }) => objectId)).toEqual([objectA, objectC])
    })

    it('sorts by descending similarity', () => {
        const spanEmbedding = makeEmbeddingFromAxis(0)
        const ranked = rankCatalogByCosineSimilarity(spanEmbedding, [
            candidate(objectA, 2),
            candidate(objectB, 0),
            candidate(objectC, 1),
        ])
        expect(ranked.map(({ objectId }) => objectId)).toEqual([objectB, objectA, objectC])
        expect(ranked[0]!.similarity).toBeCloseTo(1, 5)
        expect(ranked[1]!.similarity).toBeCloseTo(0, 5)
        expect(ranked[2]!.similarity).toBeCloseTo(0, 5)
    })

    it('returns ~1 for identical unit vectors and ~0 for orthogonal axes', () => {
        const spanEmbedding = SemanticEmbedding.fromFloat32(unitVectorAlongAxis(0), {
            modelId: TEST_MODEL_ID,
        })
        const identical = SemanticEmbedding.fromFloat32(unitVectorAlongAxis(0), {
            modelId: TEST_MODEL_ID,
        })
        const orthogonal = SemanticEmbedding.fromFloat32(unitVectorAlongAxis(1), {
            modelId: TEST_MODEL_ID,
        })
        const ranked = rankCatalogByCosineSimilarity(spanEmbedding, [
            { ...candidate(objectA, 0), embedding: orthogonal },
            { ...candidate(objectB, 0), embedding: identical },
        ])
        expect(ranked[0]!.objectId).toBe(objectB)
        expect(ranked[0]!.similarity).toBeCloseTo(1, 5)
        expect(ranked[1]!.similarity).toBeCloseTo(0, 5)
    })

    it('preserves catalogScope on ranked scores', () => {
        const spanEmbedding = makeEmbeddingFromAxis(0)
        const ranked = rankCatalogByCosineSimilarity(spanEmbedding, [
            candidate(objectA, 0, 'held'),
            candidate(objectB, 1, 'room'),
        ])
        expect(ranked.find(({ objectId }) => objectId === objectA)?.catalogScope).toBe('held')
        expect(ranked.find(({ objectId }) => objectId === objectB)?.catalogScope).toBe('room')
    })
})
