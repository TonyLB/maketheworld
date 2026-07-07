import { createHash } from 'node:crypto'

import type { InvokeBedrockTitanEmbedResult } from '../../../llm/invokeBedrockTitanEmbed'
import { SEMANTIC_EMBEDDING_V1_DIMENSIONS } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import { BEDROCK_OBJECT_SHORTNAME_EMBED_TIMEOUT_MS } from './buildShortNameSemanticEmbedding'
import { embedObjectSpan } from './embedObjectSpan'

const makeEmbedding = () =>
    Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, (_, i) => i * 0.001)

const sha256Hex = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

describe('embedObjectSpan', () => {
    it('abstains without Bedrock when span is empty after normalization', async () => {
        const invokeEmbed = jest.fn()

        const result = await embedObjectSpan('   ', { invokeEmbed })

        expect(invokeEmbed).not.toHaveBeenCalled()
        expect(result).toEqual({ success: false })
    })

    it('normalizes span before embed', async () => {
        const invokeEmbed = jest.fn().mockResolvedValue({
            success: true,
            embedding: makeEmbedding(),
        } satisfies InvokeBedrockTitanEmbedResult)

        const result = await embedObjectSpan('  Brass Lantern ', { invokeEmbed })

        expect(invokeEmbed).toHaveBeenCalledWith({
            inputText: 'brass lantern',
            timeoutMs: BEDROCK_OBJECT_SHORTNAME_EMBED_TIMEOUT_MS,
            client: undefined,
        })
        expect(result.success).toBe(true)
        if (!result.success) {
            return
        }
        expect(result.embedding.sourceTextHash).toBe(sha256Hex('brass lantern'))
    })

    it('returns SemanticEmbedding on success', async () => {
        const invokeEmbed = jest.fn().mockResolvedValue({
            success: true,
            embedding: makeEmbedding(),
        } satisfies InvokeBedrockTitanEmbedResult)

        const result = await embedObjectSpan('broom', { invokeEmbed })

        expect(result.success).toBe(true)
        if (!result.success) {
            return
        }
        expect(result.embedding.sourceTextHash).toBe(sha256Hex('broom'))
    })

    it('returns failure without throwing on transport error', async () => {
        const invokeEmbed = jest.fn().mockResolvedValue({
            success: false,
            errorMessage: 'ThrottlingException',
        } satisfies InvokeBedrockTitanEmbedResult)

        const result = await embedObjectSpan('anvil', { invokeEmbed })

        expect(result).toEqual({ success: false })
    })
})
