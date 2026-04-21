import type { BedrockRuntimeClient, Message } from '@aws-sdk/client-bedrock-runtime'
import { invokeBedrockConverseText } from './invokeBedrockConverseText'

const baseParams = {
    modelId: 'us.amazon.nova-2-lite-v1:0',
    messages: [{ role: 'user', content: [{ text: 'ping' }] }] as Message[],
    maxTokens: 128,
    temperature: 0.2,
    timeoutMs: 5000,
}

describe('invokeBedrockConverseText', () => {
    it('returns aggregated text on success', async () => {
        const send = jest.fn().mockResolvedValue({
            output: { message: { content: [{ text: 'a' }, { text: 'b' }] } },
            usage: {
                inputTokens: 12,
                outputTokens: 8,
                totalTokens: 20,
            },
        })
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockConverseText({
            ...baseParams,
            client,
        })

        expect(result).toEqual({
            success: true,
            body: 'ab',
            usage: {
                inputTokens: 12,
                outputTokens: 8,
                totalTokens: 20,
            },
        })
        expect(send).toHaveBeenCalledTimes(1)
    })

    it('returns success with empty body when content is missing', async () => {
        const send = jest.fn().mockResolvedValue({ output: {} })
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockConverseText({
            ...baseParams,
            client,
        })

        expect(result).toEqual({ success: true, body: '', usage: undefined })
    })

    it('returns success metadata when usage is present', async () => {
        const send = jest.fn().mockResolvedValue({
            output: { message: { content: [{ text: 'ok' }] } },
            usage: {
                inputTokens: 101,
                outputTokens: 12,
                totalTokens: 113,
                cacheReadInputTokens: 80,
                cacheWriteInputTokens: 0,
            },
        })
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockConverseText({
            ...baseParams,
            client,
        })

        expect(result).toMatchObject({
            success: true,
            body: 'ok',
            usage: {
                inputTokens: 101,
                outputTokens: 12,
                totalTokens: 113,
                cacheReadInputTokens: 80,
                cacheWriteInputTokens: 0,
            },
        })
    })

    it('maps AbortError to timeout message', async () => {
        const send = jest.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockConverseText({
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

        const result = await invokeBedrockConverseText({
            ...baseParams,
            client,
        })

        expect(result).toEqual({
            success: false,
            errorMessage: 'ThrottlingException',
        })
    })

    it('splits Nova reasoningContent from text and enables extended thinking in the Converse request', async () => {
        const send = jest.fn().mockResolvedValue({
            output: {
                message: {
                    content: [
                        {
                            reasoningContent: {
                                reasoningText: { text: 'think' },
                            },
                        },
                        { text: 'final' },
                    ],
                },
            },
            usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        })
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockConverseText({
            ...baseParams,
            client,
            extendedThinking: true,
            reasoningEffort: 'high',
        })

        expect(result).toEqual({
            success: true,
            body: 'final',
            reasoningContent: 'think',
            usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        })

        const commandArg = send.mock.calls[0][0] as { input?: Record<string, unknown> }
        expect(commandArg.input?.additionalModelRequestFields).toEqual({
            reasoningConfig: { type: 'enabled', maxReasoningEffort: 'high' },
        })
    })

    it('does not send additionalModelRequestFields when extendedThinking is false', async () => {
        const send = jest.fn().mockResolvedValue({
            output: { message: { content: [{ text: 'ok' }] } },
        })
        const client = { send } as unknown as BedrockRuntimeClient

        await invokeBedrockConverseText({
            ...baseParams,
            client,
            extendedThinking: false,
        })

        const commandArg = send.mock.calls[0][0] as { input?: Record<string, unknown> }
        expect(commandArg.input?.additionalModelRequestFields).toBeUndefined()
    })

    it('fails before calling Bedrock when extendedThinking is true for a non-Nova model', async () => {
        const send = jest.fn()
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockConverseText({
            ...baseParams,
            modelId: 'anthropic.claude-3-7-sonnet-20250219-v1:0',
            client,
            extendedThinking: true,
        })

        expect(send).not.toHaveBeenCalled()
        expect(result).toEqual({
            success: false,
            errorMessage:
                'extendedThinking is not supported for modelId "anthropic.claude-3-7-sonnet-20250219-v1:0" (only Amazon Nova Converse models in this build)',
        })
    })
})
