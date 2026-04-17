import {
    CachePointType,
    type BedrockRuntimeClient,
    type ContentBlock,
    type Message,
} from '@aws-sdk/client-bedrock-runtime'
import {
    invokeBedrockConverseText,
    type InvokeBedrockConverseTextResult,
} from '../../generateExample/invokeBedrockConverseText'
import type { CoyotePromptParts } from './buildHypothesisPrompt'

export const BEDROCK_HYPOTHESIS_MODEL_ID = 'us.amazon.nova-2-lite-v1:0' as const
export const BEDROCK_HYPOTHESIS_TIMEOUT_MS = 30_000
/** Default max output tokens for hypothesis (scene analysis + Hypothesis line). Keep above cheap single-sentence caps. */
export const BEDROCK_HYPOTHESIS_MAX_TOKENS = 1024

export type InvokeBedrockHypothesisSuccess = Extract<InvokeBedrockConverseTextResult, { success: true }>
export type InvokeBedrockHypothesisFailure = Extract<InvokeBedrockConverseTextResult, { success: false }>
export type InvokeBedrockHypothesisResult = InvokeBedrockConverseTextResult

function coyoteUserContent(prompt: CoyotePromptParts): ContentBlock[] {
    return [
        { text: prompt.invariantPrefix },
        { cachePoint: { type: CachePointType.DEFAULT } },
        { text: prompt.dynamicSuffix },
    ]
}

export async function invokeBedrockHypothesis(
    prompt: CoyotePromptParts,
    options: {
        modelId?: string;
        maxTokens?: number;
        temperature?: number;
        timeoutMs?: number;
        client?: BedrockRuntimeClient;
    } = {}
): Promise<InvokeBedrockHypothesisResult> {
    const modelId = options.modelId ?? BEDROCK_HYPOTHESIS_MODEL_ID
    const maxTokens = options.maxTokens ?? BEDROCK_HYPOTHESIS_MAX_TOKENS
    const timeoutMs = options.timeoutMs ?? BEDROCK_HYPOTHESIS_TIMEOUT_MS
    const temperature = options.temperature ?? 0.2

    const userMessage: Message = {
        role: 'user',
        content: coyoteUserContent(prompt),
    }

    return invokeBedrockConverseText({
        modelId,
        messages: [userMessage],
        maxTokens,
        temperature,
        timeoutMs,
        client: options.client,
    })
}
