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
        })
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockConverseText({
            ...baseParams,
            client,
        })

        expect(result).toEqual({ success: true, body: 'ab' })
        expect(send).toHaveBeenCalledTimes(1)
    })

    it('returns success with empty body when content is missing', async () => {
        const send = jest.fn().mockResolvedValue({ output: {} })
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockConverseText({
            ...baseParams,
            client,
        })

        expect(result).toEqual({ success: true, body: '' })
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
})
