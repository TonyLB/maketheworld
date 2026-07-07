import type { InvokeBedrockTitanEmbedResult } from '../../llm/invokeBedrockTitanEmbed'
import { SEMANTIC_EMBEDDING_V1_DIMENSIONS } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import { verifyRepeatBedrockEmbed } from './verifyRepeatBedrockEmbed'

const makeEmbedding = (seed: number): number[] =>
    Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, (_, index) =>
        index === 0 ? seed : index * 0.0001
    )

describe('verifyRepeatBedrockEmbed', () => {
    it('reports identical vectors when Bedrock returns the same float32 twice', async () => {
        const floats = makeEmbedding(0.42)
        const invokeEmbed = jest
            .fn()
            .mockResolvedValueOnce({
                success: true,
                embedding: floats,
            } satisfies InvokeBedrockTitanEmbedResult)
            .mockResolvedValueOnce({
                success: true,
                embedding: floats,
            } satisfies InvokeBedrockTitanEmbedResult)

        const result = await verifyRepeatBedrockEmbed('lantern', { invokeEmbed })

        expect('error' in result).toBe(false)
        if ('error' in result) {
            return
        }

        expect(invokeEmbed).toHaveBeenCalledTimes(2)
        expect(result.normalized).toBe('lantern')
        expect(result.float32.maxAbsDiff).toBe(0)
        expect(result.float32.cosineSimilarity).toBeCloseTo(1, 8)
        expect(result.quantized.cosineSimilarity).toBeCloseTo(1, 8)
        expect(result.quantized.vectorsEqual).toBe(true)
        expect(result.productionPath.crossInvokeCosineSimilarity).toBeCloseTo(1, 8)
    })

    it('surfaces float32 drift when Bedrock returns different vectors', async () => {
        const invokeEmbed = jest
            .fn()
            .mockResolvedValueOnce({
                success: true,
                embedding: makeEmbedding(0.42),
            } satisfies InvokeBedrockTitanEmbedResult)
            .mockResolvedValueOnce({
                success: true,
                embedding: makeEmbedding(0.43),
            } satisfies InvokeBedrockTitanEmbedResult)

        const result = await verifyRepeatBedrockEmbed('broom', { invokeEmbed })

        expect('error' in result).toBe(false)
        if ('error' in result) {
            return
        }

        expect(result.float32.maxAbsDiff).toBeGreaterThan(0)
        expect(result.float32.cosineSimilarity).toBeLessThan(1)
        expect(result.quantized.vectorsEqual).toBe(false)
    })

    it('rejects empty normalized text', async () => {
        const result = await verifyRepeatBedrockEmbed('   ')
        expect(result).toEqual({ error: 'text must normalize to a non-empty string' })
    })

    it('propagates Bedrock failure on first invoke', async () => {
        const invokeEmbed = jest.fn().mockResolvedValueOnce({
            success: false,
            errorMessage: 'ThrottlingException',
        } satisfies InvokeBedrockTitanEmbedResult)

        const result = await verifyRepeatBedrockEmbed('anvil', { invokeEmbed })
        expect(result).toEqual({ error: 'first Bedrock invoke failed: ThrottlingException' })
        expect(invokeEmbed).toHaveBeenCalledTimes(1)
    })
})
