import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'
import { invokeBedrockParseCommand } from './invokeBedrockParseCommand'

jest.mock('../llm/invokeBedrockConverseText', () => ({
    invokeBedrockConverseText: jest.fn(),
}))

describe('invokeBedrockParseCommand', () => {
    const { invokeBedrockConverseText } = jest.requireMock('../llm/invokeBedrockConverseText') as {
        invokeBedrockConverseText: jest.Mock
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('delegates to invokeBedrockConverseText with parse defaults', async () => {
        invokeBedrockConverseText.mockResolvedValue({
            success: true,
            body: '{}',
            usage: { inputTokens: 9, outputTokens: 4, totalTokens: 13 },
        })

        const result = await invokeBedrockParseCommand('classify: go north')

        expect(result).toEqual({
            success: true,
            body: '{}',
            usage: { inputTokens: 9, outputTokens: 4, totalTokens: 13 },
        })
        expect(invokeBedrockConverseText).toHaveBeenCalledWith(
            expect.objectContaining({
                modelId: 'us.amazon.nova-micro-v1:0',
                maxTokens: 512,
                temperature: 0.1,
                timeoutMs: 30_000,
                messages: [
                    {
                        role: 'user',
                        content: [{ text: 'classify: go north' }],
                    },
                ],
            })
        )
    })

    it('allows overrides', async () => {
        invokeBedrockConverseText.mockResolvedValue({ success: true, body: 'ok' })
        const client = { send: jest.fn() } as unknown as BedrockRuntimeClient

        await invokeBedrockParseCommand('x', {
            modelId: 'other-model',
            maxTokens: 99,
            temperature: 0.5,
            timeoutMs: 1000,
            client,
        })

        expect(invokeBedrockConverseText).toHaveBeenCalledWith(
            expect.objectContaining({
                modelId: 'other-model',
                maxTokens: 99,
                temperature: 0.5,
                timeoutMs: 1000,
                client,
            })
        )
    })

    it('maps model selection to a Bedrock model id', async () => {
        invokeBedrockConverseText.mockResolvedValue({ success: true, body: 'ok' })

        await invokeBedrockParseCommand('x', { model: 'NovaMicro' })

        expect(invokeBedrockConverseText).toHaveBeenCalledWith(
            expect.objectContaining({
                modelId: 'us.amazon.nova-micro-v1:0',
            })
        )
    })

    it('allows selecting Nova2Lite by typed model option', async () => {
        invokeBedrockConverseText.mockResolvedValue({ success: true, body: 'ok' })

        await invokeBedrockParseCommand('x', { model: 'Nova2Lite' })

        expect(invokeBedrockConverseText).toHaveBeenCalledWith(
            expect.objectContaining({
                modelId: 'us.amazon.nova-2-lite-v1:0',
            })
        )
    })
})
