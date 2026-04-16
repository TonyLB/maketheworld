import type { BedrockRuntimeClient, ContentBlock, Message } from '@aws-sdk/client-bedrock-runtime'
import {
    invokeBedrockConverseText,
    type InvokeBedrockConverseTextResult,
} from '../../generateExample/invokeBedrockConverseText'

export const BEDROCK_HYPOTHESIS_MODEL_ID = 'us.amazon.nova-2-lite-v1:0' as const
export const BEDROCK_HYPOTHESIS_TIMEOUT_MS = 30_000
export const BEDROCK_HYPOTHESIS_MAX_TOKENS = 256

export type InvokeBedrockHypothesisSuccess = Extract<InvokeBedrockConverseTextResult, { success: true }>
export type InvokeBedrockHypothesisFailure = Extract<InvokeBedrockConverseTextResult, { success: false }>
export type InvokeBedrockHypothesisResult = InvokeBedrockConverseTextResult

export async function invokeBedrockHypothesis(
    prompt: string,
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
        content: [{ text: prompt } as ContentBlock],
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
