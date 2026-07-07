import { createHash } from 'node:crypto'

import {
    BEDROCK_TITAN_EMBED_MODEL_ID,
    type InvokeBedrockTitanEmbedResult,
} from '../../../llm/invokeBedrockTitanEmbed'
import {
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
    SEMANTIC_EMBEDDING_V1_ENCODING,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import { BEDROCK_OBJECT_SHORTNAME_EMBED_TIMEOUT_MS } from './buildShortNameSemanticEmbedding'
import { embedNormalizedSemanticText } from './embedNormalizedSemanticText'

const makeEmbedding = (overrides?: Partial<{ length: number; valueAt0: number }>) => {
    const length = overrides?.length ?? SEMANTIC_EMBEDDING_V1_DIMENSIONS
    return Array.from({ length }, (_, i) =>
        i === 0 && overrides?.valueAt0 !== undefined ? overrides.valueAt0 : i * 0.001
    )
}

const sha256Hex = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

describe('embedNormalizedSemanticText', () => {
    it('returns quantized SemanticEmbedding with Dynamo record shape on success', async () => {
        const floats = makeEmbedding({ valueAt0: 1 })
        const invokeEmbed = jest.fn().mockResolvedValue({
            success: true,
            embedding: floats,
        } satisfies InvokeBedrockTitanEmbedResult)

        const result = await embedNormalizedSemanticText('brass lantern', { invokeEmbed })

        expect(result.success).toBe(true)
        if (!result.success) {
            return
        }
        const record = result.embedding.toDynamoRecord()
        expect(record.modelId).toBe(BEDROCK_TITAN_EMBED_MODEL_ID)
        expect(record.dimensions).toBe(SEMANTIC_EMBEDDING_V1_DIMENSIONS)
        expect(record.encoding).toBe(SEMANTIC_EMBEDDING_V1_ENCODING)
        expect(record.vector).toBeInstanceOf(Uint8Array)
        expect(record.vector.byteLength).toBe(SEMANTIC_EMBEDDING_V1_DIMENSIONS)
        expect(record.sourceTextHash).toBe(sha256Hex('brass lantern'))
        const int8 = new Int8Array(record.vector.buffer, record.vector.byteOffset, record.vector.byteLength)
        expect(int8[0]).toBe(127)
    })

    it('passes normalized text to Bedrock invoke', async () => {
        const invokeEmbed = jest.fn().mockResolvedValue({
            success: true,
            embedding: makeEmbedding(),
        } satisfies InvokeBedrockTitanEmbedResult)

        await embedNormalizedSemanticText('brass lantern', { invokeEmbed })

        expect(invokeEmbed).toHaveBeenCalledWith({
            inputText: 'brass lantern',
            timeoutMs: BEDROCK_OBJECT_SHORTNAME_EMBED_TIMEOUT_MS,
            client: undefined,
        })
    })

    it('propagates transport failure', async () => {
        const invokeEmbed = jest.fn().mockResolvedValue({
            success: false,
            errorMessage: 'ThrottlingException',
        } satisfies InvokeBedrockTitanEmbedResult)

        const result = await embedNormalizedSemanticText('anvil', { invokeEmbed })

        expect(result).toEqual({
            success: false,
            errorMessage: 'ThrottlingException',
        })
    })

    it('passes custom timeoutMs to transport', async () => {
        const invokeEmbed = jest.fn().mockResolvedValue({
            success: true,
            embedding: makeEmbedding(),
        } satisfies InvokeBedrockTitanEmbedResult)

        await embedNormalizedSemanticText('anvil', { invokeEmbed, timeoutMs: 3000 })

        expect(invokeEmbed).toHaveBeenCalledWith(
            expect.objectContaining({ timeoutMs: 3000 })
        )
    })
})
