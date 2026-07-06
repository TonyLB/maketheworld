import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'
import { SEMANTIC_EMBEDDING_V1_DIMENSIONS } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import {
    BEDROCK_TITAN_EMBED_MODEL_ID,
    invokeBedrockTitanEmbed,
} from './invokeBedrockTitanEmbed'

const baseParams = {
    inputText: 'brass lantern',
    timeoutMs: 5000,
}

const mockEmbedBody = (embedding: number[], tokenCount = 3) =>
    new TextEncoder().encode(JSON.stringify({ embedding, inputTextTokenCount: tokenCount }))

const makeEmbedding = (overrides?: Partial<{ length: number; valueAt0: number }>) => {
    const length = overrides?.length ?? SEMANTIC_EMBEDDING_V1_DIMENSIONS
    const embedding = Array.from({ length }, (_, i) =>
        i === 0 && overrides?.valueAt0 !== undefined ? overrides.valueAt0 : i * 0.001
    )
    return embedding
}

describe('invokeBedrockTitanEmbed', () => {
    it('returns embedding on success', async () => {
        const embedding = makeEmbedding()
        const send = jest.fn().mockResolvedValue({ body: mockEmbedBody(embedding, 4) })
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockTitanEmbed({
            ...baseParams,
            client,
        })

        expect(result).toEqual({
            success: true,
            embedding,
            inputTextTokenCount: 4,
        })
        expect(send).toHaveBeenCalledTimes(1)
    })

    it('sends InvokeModel with Titan v2 model id and request body', async () => {
        const embedding = makeEmbedding()
        const send = jest.fn().mockResolvedValue({ body: mockEmbedBody(embedding) })
        const client = { send } as unknown as BedrockRuntimeClient

        await invokeBedrockTitanEmbed({
            inputText: 'oak table',
            timeoutMs: 5000,
            client,
        })

        const commandArg = send.mock.calls[0][0] as { input?: Record<string, unknown> }
        expect(commandArg.input?.modelId).toBe(BEDROCK_TITAN_EMBED_MODEL_ID)
        expect(commandArg.input?.contentType).toBe('application/json')
        expect(commandArg.input?.accept).toBe('application/json')
        expect(JSON.parse(String(commandArg.input?.body))).toEqual({
            inputText: 'oak table',
            dimensions: SEMANTIC_EMBEDDING_V1_DIMENSIONS,
            normalize: true,
        })
    })

    it('maps AbortError to timeout message', async () => {
        const send = jest.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockTitanEmbed({
            ...baseParams,
            timeoutMs: 12000,
            client,
        })

        expect(result).toEqual({
            success: false,
            errorMessage: 'Bedrock request timed out after 12000ms',
        })
    })

    it('returns provider message on other errors', async () => {
        const send = jest.fn().mockRejectedValue(new Error('ThrottlingException'))
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockTitanEmbed({
            ...baseParams,
            client,
        })

        expect(result).toEqual({
            success: false,
            errorMessage: 'ThrottlingException',
        })
    })

    it('fails before calling Bedrock when inputText is empty', async () => {
        const send = jest.fn()
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockTitanEmbed({
            inputText: '',
            timeoutMs: 5000,
            client,
        })

        expect(send).not.toHaveBeenCalled()
        expect(result).toEqual({
            success: false,
            errorMessage: 'inputText must be non-empty',
        })
    })

    it('returns failure when response body is missing', async () => {
        const send = jest.fn().mockResolvedValue({})
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockTitanEmbed({
            ...baseParams,
            client,
        })

        expect(result).toEqual({
            success: false,
            errorMessage: 'Bedrock embed response missing body',
        })
    })

    it('returns failure when response is not valid JSON', async () => {
        const send = jest.fn().mockResolvedValue({
            body: new TextEncoder().encode('not-json'),
        })
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockTitanEmbed({
            ...baseParams,
            client,
        })

        expect(result).toEqual({
            success: false,
            errorMessage: 'Bedrock embed response is not valid JSON',
        })
    })

    it('returns failure when embedding array is missing', async () => {
        const send = jest.fn().mockResolvedValue({
            body: new TextEncoder().encode(JSON.stringify({ inputTextTokenCount: 1 })),
        })
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockTitanEmbed({
            ...baseParams,
            client,
        })

        expect(result).toEqual({
            success: false,
            errorMessage: 'Bedrock embed response missing embedding array',
        })
    })

    it('returns failure when embedding length is wrong', async () => {
        const send = jest.fn().mockResolvedValue({
            body: mockEmbedBody(makeEmbedding({ length: 128 })),
        })
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockTitanEmbed({
            ...baseParams,
            client,
        })

        expect(result).toEqual({
            success: false,
            errorMessage: `Bedrock embed vector length mismatch: expected ${SEMANTIC_EMBEDDING_V1_DIMENSIONS}, got 128`,
        })
    })

    it('returns failure when embedding contains non-finite values', async () => {
        const send = jest.fn().mockResolvedValue({
            body: mockEmbedBody(makeEmbedding({ valueAt0: Number.NaN })),
        })
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockTitanEmbed({
            ...baseParams,
            client,
        })

        expect(result).toEqual({
            success: false,
            errorMessage: 'Bedrock embed vector contains non-finite value at index 0',
        })
    })
})
