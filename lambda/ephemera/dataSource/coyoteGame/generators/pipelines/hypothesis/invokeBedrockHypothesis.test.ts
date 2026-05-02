import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'
import { CachePointType, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import {
    BEDROCK_HYPOTHESIS_NARRATIVE_BEAT_MAX_TOKENS,
    BEDROCK_HYPOTHESIS_CANDIDATES_MAX_TOKENS,
    BEDROCK_HYPOTHESIS_PLAN_SELECTION_MAX_TOKENS,
    invokeBedrockHypothesis,
    invokeBedrockHypothesisNarrativeBeat,
    invokeBedrockHypothesisPlanSelection,
    invokeBedrockHypothesisStageOne,
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
        expect(input.modelId).toBe('us.amazon.nova-2-lite-v1:0')
        expect(input.messages).toHaveLength(1)
        expect(input.messages?.[0].role).toBe('user')
        expect(input.messages?.[0].content).toEqual([
            { text: 'INVARIANT_BLOCK' },
            { cachePoint: { type: CachePointType.DEFAULT } },
            { text: '\nDYNAMIC_TAIL' },
        ])
        expect(input.additionalModelRequestFields).toBeUndefined()
    })

    it('maps model selection to a Bedrock model id', async () => {
        const send = jest.fn().mockResolvedValue({
            output: { message: { content: [{ text: 'Hypothesis: ok' }] } },
            usage: {},
        })
        const client = { send } as unknown as BedrockRuntimeClient

        await invokeBedrockHypothesis(
            { invariantPrefix: 'INVARIANT_BLOCK', dynamicSuffix: '\nDYNAMIC_TAIL' },
            { client, timeoutMs: 5000, model: 'NovaMicro' }
        )

        const command = send.mock.calls[0][0]
        expect(command).toBeInstanceOf(ConverseCommand)
        expect(command.input.modelId).toBe('us.amazon.nova-micro-v1:0')
    })
})

describe('invokeBedrockHypothesisStageOne / narrative beat', () => {
    it('invokeBedrockHypothesisStageOne passes candidates-phase max tokens by default', async () => {
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
        expect(command.input.inferenceConfig?.maxTokens).toBe(BEDROCK_HYPOTHESIS_CANDIDATES_MAX_TOKENS)
        expect(command.input.additionalModelRequestFields).toBeUndefined()
    })

    it('invokeBedrockHypothesisPlanSelection passes plan-selection max tokens by default', async () => {
        const send = jest.fn().mockResolvedValue({
            output: { message: { content: [{ text: '{"paragraphSummary":"x"}' }] } },
            usage: {},
        })
        const client = { send } as unknown as BedrockRuntimeClient

        await invokeBedrockHypothesisPlanSelection(
            { invariantPrefix: 'A', dynamicSuffix: '\nB' },
            { client, timeoutMs: 5000 }
        )

        const command = send.mock.calls[0][0] as InstanceType<typeof ConverseCommand>
        expect(command.input.inferenceConfig?.maxTokens).toBe(BEDROCK_HYPOTHESIS_PLAN_SELECTION_MAX_TOKENS)
        expect(command.input.additionalModelRequestFields).toBeUndefined()
    })

    it('invokeBedrockHypothesisNarrativeBeat passes narrative-beat max tokens by default', async () => {
        const send = jest.fn().mockResolvedValue({
            output: { message: { content: [{ text: 'Hypothesis: ok' }] } },
            usage: {},
        })
        const client = { send } as unknown as BedrockRuntimeClient

        await invokeBedrockHypothesisNarrativeBeat(
            { invariantPrefix: 'A', dynamicSuffix: '\nB' },
            { client, timeoutMs: 5000 }
        )

        const command = send.mock.calls[0][0] as InstanceType<typeof ConverseCommand>
        expect(command.input.inferenceConfig?.maxTokens).toBe(BEDROCK_HYPOTHESIS_NARRATIVE_BEAT_MAX_TOKENS)
        expect(command.input.additionalModelRequestFields).toBeUndefined()
    })

    it('invokeBedrockHypothesisNarrativeBeat sends Nova reasoningConfig when extendedThinking is true', async () => {
        const send = jest.fn().mockResolvedValue({
            output: { message: { content: [{ text: 'Hypothesis: ok' }] } },
            usage: {},
        })
        const client = { send } as unknown as BedrockRuntimeClient

        await invokeBedrockHypothesisNarrativeBeat(
            { invariantPrefix: 'A', dynamicSuffix: '\nB' },
            { client, timeoutMs: 5000, extendedThinking: true }
        )

        const command = send.mock.calls[0][0] as InstanceType<typeof ConverseCommand>
        expect(command.input.additionalModelRequestFields).toEqual({
            reasoningConfig: { type: 'enabled', maxReasoningEffort: 'medium' },
        })
    })

    it('invokeBedrockHypothesisNarrativeBeat returns reasoningContent when the response includes reasoning blocks', async () => {
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

        const result = await invokeBedrockHypothesisNarrativeBeat(
            { invariantPrefix: 'A', dynamicSuffix: '\nB' },
            { client, timeoutMs: 5000, extendedThinking: true }
        )

        expect(result).toEqual({
            success: true,
            body: 'Hypothesis: ok',
            reasoningContent: 'plan',
            usage: {},
        })
    })
})
