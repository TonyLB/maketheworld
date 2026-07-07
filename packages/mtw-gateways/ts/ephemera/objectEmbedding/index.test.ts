import { EMBEDDING_IMPROMPTU_DATA_CATEGORY } from '@tonylb/mtw-interfaces/ts/ephemeraEmbedding'
import {
    SemanticEmbedding,
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import { createObjectEmbeddingCacheHandler } from './factory'
import type { EphemeraObjectEmbeddingReadDB } from './fetch'

const TEST_MODEL_ID = 'amazon.titan-embed-text-v2:0'

const objectId = 'OBJECT#CoyoteAnvil' as const
const objectIdTwo = 'OBJECT#CoyoteBroom' as const

const makeEmbeddingRecord = () => {
    const values = Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, () => 0)
    values[0] = 1
    return SemanticEmbedding.fromFloat32(values, { modelId: TEST_MODEL_ID }).toDynamoRecord()
}

const makeValidRow = (id: typeof objectId | typeof objectIdTwo = objectId) => ({
    EphemeraId: id,
    DataCategory: EMBEDDING_IMPROMPTU_DATA_CATEGORY,
    embedding: makeEmbeddingRecord(),
})

describe('ObjectEmbeddingCacheHandler', () => {
    it('batch get loads EMBEDDING#IMPROMPTU rows from ephemeraDB getItems', async () => {
        const db: EphemeraObjectEmbeddingReadDB = {
            getItems: jest.fn().mockResolvedValue([makeValidRow(objectId), makeValidRow(objectIdTwo)]),
        }
        const handler = createObjectEmbeddingCacheHandler(db)

        const result = await handler.get([objectId, objectIdTwo])

        expect(result[objectId]).toBeInstanceOf(SemanticEmbedding)
        expect(result[objectIdTwo]).toBeInstanceOf(SemanticEmbedding)
        expect(db.getItems).toHaveBeenCalledTimes(1)
        expect(db.getItems).toHaveBeenCalledWith({
            Keys: [
                { EphemeraId: objectId, DataCategory: EMBEDDING_IMPROMPTU_DATA_CATEGORY },
                { EphemeraId: objectIdTwo, DataCategory: EMBEDDING_IMPROMPTU_DATA_CATEGORY },
            ],
            getAllFields: true,
        })
    })

    it('missing row returns undefined for that objectId', async () => {
        const db: EphemeraObjectEmbeddingReadDB = {
            getItems: jest.fn().mockResolvedValue([]),
        }
        const handler = createObjectEmbeddingCacheHandler(db)

        const result = await handler.get([objectId])

        expect(result[objectId]).toBeUndefined()
    })

    it('invalid row is rejected and returns undefined', async () => {
        const db: EphemeraObjectEmbeddingReadDB = {
            getItems: jest.fn().mockResolvedValue([
                {
                    ...makeValidRow(),
                    shortName: 'cross-row leak',
                },
            ]),
        }
        const handler = createObjectEmbeddingCacheHandler(db)

        const result = await handler.get([objectId])

        expect(result[objectId]).toBeUndefined()
    })

    it('memo hit avoids second Dynamo read', async () => {
        const db: EphemeraObjectEmbeddingReadDB = {
            getItems: jest.fn().mockResolvedValue([makeValidRow()]),
        }
        const handler = createObjectEmbeddingCacheHandler(db)

        await handler.get([objectId])
        await handler.get([objectId])

        expect(db.getItems).toHaveBeenCalledTimes(1)
    })

    it('memo set avoids Dynamo read', async () => {
        const db: EphemeraObjectEmbeddingReadDB = {
            getItems: jest.fn(),
        }
        const handler = createObjectEmbeddingCacheHandler(db)
        const embedding = SemanticEmbedding.fromFloat32(
            Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, (_, index) => (index === 0 ? 1 : 0)),
            { modelId: TEST_MODEL_ID }
        )

        handler.set(objectId, embedding)
        const result = await handler.get([objectId])

        expect(result[objectId]?.equals(embedding)).toBe(true)
        expect(db.getItems).not.toHaveBeenCalled()
    })

    it('invalidate drops memo so next get re-queries', async () => {
        const db: EphemeraObjectEmbeddingReadDB = {
            getItems: jest.fn().mockResolvedValue([makeValidRow()]),
        }
        const handler = createObjectEmbeddingCacheHandler(db)

        await handler.get([objectId])
        handler.invalidate(objectId)
        await handler.get([objectId])

        expect(db.getItems).toHaveBeenCalledTimes(2)
    })

    it('dedupes parallel gets for the same objectId into one getItems', async () => {
        const db: EphemeraObjectEmbeddingReadDB = {
            getItems: jest.fn().mockResolvedValue([makeValidRow()]),
        }
        const handler = createObjectEmbeddingCacheHandler(db)

        await Promise.all([handler.get([objectId]), handler.get([objectId])])

        expect(db.getItems).toHaveBeenCalledTimes(1)
    })
})
