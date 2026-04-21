import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'
import { CachePointType, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import {
    BEDROCK_HYPOTHESIS_STAGE_ONE_MAX_TOKENS,
    BEDROCK_HYPOTHESIS_STAGE_TWO_MAX_TOKENS,
    invokeBedrockHypothesis,
    invokeBedrockHypothesisStageOne,
    invokeBedrockHypothesisStageTwo,
} from './invokeBedrockHypothesis'

describe('invokeBedrockHypothesis', () => {
    it('sends Converse user content with a cache point between prefix and suffix', async () => {
        const send = jest.fn().mockResolvedValue({
            output: { message: { content: [{ text: 'Hypothesis: ok' }] } },
            usage: {
                inputTokens: 42,
                outputTokens: 7,
                totalTokens: 49,
                cacheReadInputTokens: 33,
                cacheWriteInputTokens: 0,
            },
        })
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockHypothesis(
            { invariantPrefix: 'INVARIANT_BLOCK', dynamicSuffix: '\nDYNAMIC_TAIL' },
            { client, timeoutMs: 5000 }
        )

        expect(result).toEqual({
            success: true,
            body: 'Hypothesis: ok',
            usage: {
                inputTokens: 42,
                outputTokens: 7,
                totalTokens: 49,
                cacheReadInputTokens: 33,
                cacheWriteInputTokens: 0,
            },
        })
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
        expect(input.additionalModelRequestFields).toBeUndefined()
    })
})

describe('invokeBedrockHypothesisStageOne / StageTwo', () => {
    it('StageOne passes stage-one max tokens by default', async () => {
        const send = jest.fn().mockResolvedValue({
            output: { message: { content: [{ text: 'seam' }] } },
            usage: {},
        })
        const client = { send } as unknown as BedrockRuntimeClient

        await invokeBedrockHypothesisStageOne(
            { invariantPrefix: 'A', dynamicSuffix: '\nB' },
            { client, timeoutMs: 5000 }
        )

        const command = send.mock.calls[0][0] as InstanceType<typeof ConverseCommand>
        expect(command.input.inferenceConfig?.maxTokens).toBe(BEDROCK_HYPOTHESIS_STAGE_ONE_MAX_TOKENS)
        expect(command.input.additionalModelRequestFields).toBeUndefined()
    })

    it('StageTwo passes stage-two max tokens by default', async () => {
        const send = jest.fn().mockResolvedValue({
            output: { message: { content: [{ text: 'Hypothesis: ok' }] } },
            usage: {},
        })
        const client = { send } as unknown as BedrockRuntimeClient

        await invokeBedrockHypothesisStageTwo(
            { invariantPrefix: 'A', dynamicSuffix: '\nB' },
            { client, timeoutMs: 5000 }
        )

        const command = send.mock.calls[0][0] as InstanceType<typeof ConverseCommand>
        expect(command.input.inferenceConfig?.maxTokens).toBe(BEDROCK_HYPOTHESIS_STAGE_TWO_MAX_TOKENS)
        expect(command.input.additionalModelRequestFields).toEqual({
            reasoningConfig: { type: 'enabled', maxReasoningEffort: 'medium' },
        })
    })

    it('StageTwo can disable extendedThinking', async () => {
        const send = jest.fn().mockResolvedValue({
            output: { message: { content: [{ text: 'Hypothesis: ok' }] } },
            usage: {},
        })
        const client = { send } as unknown as BedrockRuntimeClient

        await invokeBedrockHypothesisStageTwo(
            { invariantPrefix: 'A', dynamicSuffix: '\nB' },
            { client, timeoutMs: 5000, extendedThinking: false }
        )

        const command = send.mock.calls[0][0] as InstanceType<typeof ConverseCommand>
        expect(command.input.additionalModelRequestFields).toBeUndefined()
    })

    it('StageTwo returns reasoningContent when the response includes reasoning blocks', async () => {
        const send = jest.fn().mockResolvedValue({
            output: {
                message: {
                    content: [
                        { reasoningContent: { reasoningText: { text: 'plan' } } },
                        { text: 'Hypothesis: ok' },
                    ],
                },
            },
            usage: {},
        })
        const client = { send } as unknown as BedrockRuntimeClient

        const result = await invokeBedrockHypothesisStageTwo(
            { invariantPrefix: 'A', dynamicSuffix: '\nB' },
            { client, timeoutMs: 5000 }
        )

        expect(result).toEqual({
            success: true,
            body: 'Hypothesis: ok',
            reasoningContent: 'plan',
            usage: {},
        })
    })
})
