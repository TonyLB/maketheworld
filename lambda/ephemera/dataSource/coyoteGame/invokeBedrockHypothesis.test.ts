import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'
import { CachePointType, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { invokeBedrockHypothesis } from './invokeBedrockHypothesis'

describe('invokeBedrockHypothesis', () => {
    it('sends Converse user content with a cache point between prefix and suffix', async () => {
        const send = jest.fn().mockResolvedValue({
            output: { message: { content: [{ text: 'Hypothesis: ok' }] } },
        })
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockHypothesis(
            { invariantPrefix: 'INVARIANT_BLOCK', dynamicSuffix: '\nDYNAMIC_TAIL' },
            { client, timeoutMs: 5000 }
        )

        expect(result).toEqual({ success: true, body: 'Hypothesis: ok' })
        expect(send).toHaveBeenCalledTimes(1)
        const command = send.mock.calls[0][0]
        expect(command).toBeInstanceOf(ConverseCommand)
        const input = command.input
        expect(input.messages).toHaveLength(1)
        expect(input.messages?.[0].role).toBe('user')
        expect(input.messages?.[0].content).toEqual([
            { text: 'INVARIANT_BLOCK' },
            { cachePoint: { type: CachePointType.DEFAULT } },
            { text: '\nDYNAMIC_TAIL' },
        ])
    })
})
