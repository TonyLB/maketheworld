import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'
import { CachePointType, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import {
    BEDROCK_ACME_ORDER_ENRICH_MAX_TOKENS,
    invokeBedrockAcmeOrderEnrich,
} from './invokeBedrockAcmeOrderEnrich'

describe('invokeBedrockAcmeOrderEnrich', () => {
    it('sends Converse user content with a cache point between static instructions and dynamic inputs', async () => {
        const send = jest.fn().mockResolvedValue({
            output: { message: { content: [{ text: '{"lines":[]}' }] } },
            usage: {},
        })
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockAcmeOrderEnrich(
            { invariantPrefix: 'STATIC_RULES', dynamicSuffix: '## Player command\n\nbuy rope' },
            { client, timeoutMs: 5000 }
        )

        expect(result).toEqual({
            success: true,
            body: '{"lines":[]}',
            usage: {},
        })
        expect(send).toHaveBeenCalledTimes(1)
        const command = send.mock.calls[0][0]
        expect(command).toBeInstanceOf(ConverseCommand)
        const input = command.input
        expect(input.modelId).toBe('us.amazon.nova-2-lite-v1:0')
        expect(input.messages).toHaveLength(1)
        expect(input.messages?.[0].role).toBe('user')
        expect(input.messages?.[0].content).toEqual([
            { text: 'STATIC_RULES' },
            { cachePoint: { type: CachePointType.DEFAULT } },
            { text: '## Player command\n\nbuy rope' },
        ])
        expect(input.inferenceConfig?.maxTokens).toBe(BEDROCK_ACME_ORDER_ENRICH_MAX_TOKENS)
    })

    it('maps model selection to a Bedrock model id', async () => {
        const send = jest.fn().mockResolvedValue({
            output: { message: { content: [{ text: '{"lines":[]}' }] } },
            usage: {},
        })
        const client = { send } as unknown as BedrockRuntimeClient

        await invokeBedrockAcmeOrderEnrich(
            { invariantPrefix: 'STATIC_RULES', dynamicSuffix: 'tail' },
            { client, timeoutMs: 5000, model: 'NovaMicro' }
        )

        const command = send.mock.calls[0][0]
        expect(command).toBeInstanceOf(ConverseCommand)
        expect(command.input.modelId).toBe('us.amazon.nova-micro-v1:0')
    })
})
