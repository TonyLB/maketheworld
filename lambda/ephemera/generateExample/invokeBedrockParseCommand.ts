//
// Invoke Bedrock Nova for command-to-intent parsing (structured JSON in response body).
//

import type { BedrockRuntimeClient, ContentBlock, Message } from '@aws-sdk/client-bedrock-runtime'
import {
    invokeBedrockConverseText,
    type InvokeBedrockConverseTextResult,
} from '../llm/invokeBedrockConverseText'

export const BEDROCK_PARSE_COMMAND_MODEL_ID = 'us.amazon.nova-2-lite-v1:0' as const
export const BEDROCK_PARSE_COMMAND_TIMEOUT_MS = 30_000
export const BEDROCK_PARSE_COMMAND_MAX_TOKENS = 512

export type InvokeBedrockParseCommandSuccess = Extract<InvokeBedrockConverseTextResult, { success: true }>
export type InvokeBedrockParseCommandFailure = Extract<InvokeBedrockConverseTextResult, { success: false }>
export type InvokeBedrockParseCommandResult = InvokeBedrockConverseTextResult

/**
 * Invokes Bedrock for a single-user-text parse prompt. Tuned for shorter JSON outputs than room description.
 */
export async function invokeBedrockParseCommand(
    prompt: string,
    options: {
        modelId?: string;
        maxTokens?: number;
        temperature?: number;
        timeoutMs?: number;
        client?: BedrockRuntimeClient;
    } = {}
): Promise<InvokeBedrockParseCommandResult> {
    const modelId = options.modelId ?? BEDROCK_PARSE_COMMAND_MODEL_ID
    const maxTokens = options.maxTokens ?? BEDROCK_PARSE_COMMAND_MAX_TOKENS
    const timeoutMs = options.timeoutMs ?? BEDROCK_PARSE_COMMAND_TIMEOUT_MS
    const temperature = options.temperature ?? 0.1

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
