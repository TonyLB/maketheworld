//
// Invoke Bedrock Nova for command-to-intent parsing (structured JSON in response body).
//

import type { BedrockRuntimeClient, ContentBlock, Message } from '@aws-sdk/client-bedrock-runtime'
import {
    invokeBedrockConverseText,
    type InvokeBedrockConverseTextResult,
} from '../llm/invokeBedrockConverseText'
import {
    BEDROCK_NOVA_MICRO_MODEL_ID,
    type NovaModel,
    novaModelToBedrockModelId,
} from '../llm/novaModel'

export const BEDROCK_PARSE_COMMAND_MODEL_ID = BEDROCK_NOVA_MICRO_MODEL_ID
export const BEDROCK_PARSE_COMMAND_TIMEOUT_MS = 30_000
export const BEDROCK_PARSE_COMMAND_MAX_TOKENS = 512
export const BEDROCK_PARSE_COMMAND_DEFAULT_MODEL: NovaModel = 'NovaMicro'

export type InvokeBedrockParseCommandSuccess = Extract<InvokeBedrockConverseTextResult, { success: true }>
export type InvokeBedrockParseCommandFailure = Extract<InvokeBedrockConverseTextResult, { success: false }>
export type InvokeBedrockParseCommandResult = InvokeBedrockConverseTextResult

/**
 * Invokes Bedrock for a single-user-text parse prompt. Tuned for shorter JSON outputs than room description.
 */
export async function invokeBedrockParseCommand(
    prompt: string,
    options: {
        model?: NovaModel;
        modelId?: string;
        maxTokens?: number;
        temperature?: number;
        timeoutMs?: number;
        client?: BedrockRuntimeClient;
    } = {}
): Promise<InvokeBedrockParseCommandResult> {
    const model = options.model ?? BEDROCK_PARSE_COMMAND_DEFAULT_MODEL
    const modelId = options.modelId ?? novaModelToBedrockModelId(model)
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
