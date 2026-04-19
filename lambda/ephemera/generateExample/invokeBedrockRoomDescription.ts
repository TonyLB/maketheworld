//
// Invoke Bedrock Nova 2 Lite for room description generation.
// Returns the raw response text or throws on timeout/error.
//
// Lambda timeout is 60s (template.yaml) to accommodate this 30s request plus prompt build and cache write.
//

import type { BedrockRuntimeClient, ContentBlock, Message } from '@aws-sdk/client-bedrock-runtime'
import {
    invokeBedrockConverseText,
    type InvokeBedrockConverseTextResult,
} from '../llm/invokeBedrockConverseText'

export const BEDROCK_ROOM_DESCRIPTION_MODEL_ID = 'us.amazon.nova-2-lite-v1:0' as const
export const BEDROCK_REQUEST_TIMEOUT_MS = 30_000
export const BEDROCK_MAX_TOKENS = 1024

export type InvokeBedrockRoomDescriptionSuccess = Extract<InvokeBedrockConverseTextResult, { success: true }>
export type InvokeBedrockRoomDescriptionFailure = Extract<InvokeBedrockConverseTextResult, { success: false }>
export type InvokeBedrockRoomDescriptionResult = InvokeBedrockConverseTextResult

/**
 * Invokes Bedrock Nova 2 Lite with the given prompt. Uses a 30s request timeout.
 * Returns the model response body as plain text, or a failure result on timeout/throttling/error.
 */
export async function invokeBedrockRoomDescription(
    prompt: string,
    options: {
        modelId?: string;
        maxTokens?: number;
        timeoutMs?: number;
        client?: BedrockRuntimeClient;
    } = {}
): Promise<InvokeBedrockRoomDescriptionResult> {
    const modelId = options.modelId ?? BEDROCK_ROOM_DESCRIPTION_MODEL_ID
    const maxTokens = options.maxTokens ?? BEDROCK_MAX_TOKENS
    const timeoutMs = options.timeoutMs ?? BEDROCK_REQUEST_TIMEOUT_MS

    const userMessage: Message = {
        role: 'user',
        content: [{ text: prompt } as ContentBlock],
    }

    return invokeBedrockConverseText({
        modelId,
        messages: [userMessage],
        maxTokens,
        temperature: 0.2,
        timeoutMs,
        client: options.client,
    })
}
