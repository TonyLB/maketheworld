/**
 * Proof tests: existing Dynamo mixin handlers round-trip nested binary fields via
 * AWS SDK marshall/unmarshall without handler changes.
 *
 * Callers must pass `vector` as Uint8Array (Dynamo `B` attribute) --- not number[],
 * base64 strings, or Buffer unless converted first. This matches the nested
 * SemanticEmbeddingDynamoRecord shape in @tonylb/mtw-lambda-patterns/ts/semanticEmbedding.
 *
 * Reads of nested binary fields require getAllFields: true (default projection is key-only).
 */

import { DBHandlerBase } from '../baseClasses'
import withGetOperations from './get'
import withPrimitives from './primitives'
import withTransactions from './transact'
import withUpdate from './update'
import { marshall } from '@aws-sdk/util-dynamodb'

const SEMANTIC_EMBEDDING_DIMENSIONS = 256

const semanticEmbedding = {
    modelId: 'amazon.titan-embed-text-v2:0',
    dimensions: SEMANTIC_EMBEDDING_DIMENSIONS,
    encoding: 'int8-v1' as const,
    vector: Uint8Array.from({ length: SEMANTIC_EMBEDDING_DIMENSIONS }, (_, i) => i % 256)
}

const baseItem = {
    PrimaryKey: 'EmbedTest',
    DataCategory: 'SemanticEmbedding',
    semanticEmbedding
}

const remappedItem = {
    EphemeraId: baseItem.PrimaryKey,
    DataCategory: baseItem.DataCategory,
    semanticEmbedding
}

const marshallOptions = { removeUndefinedValues: true } as const

const expectVectorBytesEqual = (actual: Uint8Array, expected: Uint8Array) => {
    expect(actual).toBeInstanceOf(Uint8Array)
    expect(Buffer.compare(Buffer.from(actual), Buffer.from(expected))).toBe(0)
}

const dbMock = {
    send: jest.fn()
}

describe('binaryRoundTrip', () => {
    const readWriteHandler = new (withGetOperations<'PrimaryKey'>()(
        withPrimitives<'PrimaryKey'>()(DBHandlerBase<'PrimaryKey'>)
    ))({
        client: dbMock as any,
        tableName: 'Ephemera',
        incomingKeyLabel: 'PrimaryKey',
        internalKeyLabel: 'EphemeraId',
        options: { getBatchSize: 3 }
    })

    const transactHandlerClass = withTransactions<'PrimaryKey'>()(
        withUpdate<'PrimaryKey'>()(
            withGetOperations<'PrimaryKey'>()(DBHandlerBase<'PrimaryKey'>)
        )
    )
    const transactHandler = new transactHandlerClass({
        client: dbMock as any,
        tableName: 'Ephemera',
        incomingKeyLabel: 'PrimaryKey',
        internalKeyLabel: 'EphemeraId',
        options: { getBatchSize: 3 }
    })

    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    describe('putItem + getItem', () => {
        it('should marshall nested semanticEmbedding.vector as binary on putItem', async () => {
            await readWriteHandler.putItem(baseItem as any)
            expect(dbMock.send).toHaveBeenCalledTimes(1)
            const { Item } = dbMock.send.mock.calls[0][0].input
            expect(Item).toEqual(marshall(remappedItem, marshallOptions))
            expect(Item.semanticEmbedding.M.vector.B).toBeDefined()
        })

        it('should unmarshall nested semanticEmbedding.vector as Uint8Array on getItem', async () => {
            dbMock.send.mockResolvedValue({ Item: marshall(remappedItem, marshallOptions) })
            const output = await readWriteHandler.getItem({
                Key: { PrimaryKey: baseItem.PrimaryKey, DataCategory: baseItem.DataCategory },
                getAllFields: true
            })
            expect(output?.semanticEmbedding).toBeDefined()
            expectVectorBytesEqual(output!.semanticEmbedding.vector, semanticEmbedding.vector)
        })

        it('should round-trip putItem bytes through getItem', async () => {
            await readWriteHandler.putItem(baseItem as any)
            const storedItem = dbMock.send.mock.calls[0][0].input.Item
            dbMock.send.mockReset()
            dbMock.send.mockResolvedValue({ Item: storedItem })

            const output = await readWriteHandler.getItem({
                Key: { PrimaryKey: baseItem.PrimaryKey, DataCategory: baseItem.DataCategory },
                getAllFields: true
            })

            expect(dbMock.send).toHaveBeenCalledTimes(1)
            expect(output?.semanticEmbedding).toBeDefined()
            expectVectorBytesEqual(output!.semanticEmbedding.vector, semanticEmbedding.vector)
        })
    })

    describe('transactWrite Put', () => {
        it('should marshall nested binary on transactWrite Put', async () => {
            await transactHandler.transactWrite([{ Put: baseItem as any }])
            expect(dbMock.send).toHaveBeenCalledTimes(1)
            const { TransactItems } = dbMock.send.mock.calls[0][0].input
            expect(TransactItems).toEqual([
                {
                    Put: {
                        TableName: 'Ephemera',
                        Item: marshall(remappedItem, marshallOptions)
                    }
                }
            ])
            expect(TransactItems[0].Put.Item.semanticEmbedding.M.vector.B).toBeDefined()
        })

        it('should round-trip transactWrite Put bytes through getItem', async () => {
            await transactHandler.transactWrite([{ Put: baseItem as any }])
            const storedItem = dbMock.send.mock.calls[0][0].input.TransactItems[0].Put.Item
            dbMock.send.mockReset()
            dbMock.send.mockResolvedValue({ Item: storedItem })

            const output = await transactHandler.getItem({
                Key: { PrimaryKey: baseItem.PrimaryKey, DataCategory: baseItem.DataCategory },
                getAllFields: true
            })

            expect(output?.semanticEmbedding).toBeDefined()
            expectVectorBytesEqual(output!.semanticEmbedding.vector, semanticEmbedding.vector)
        })
    })
})
