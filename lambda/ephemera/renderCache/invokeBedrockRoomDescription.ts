//
// Invoke Bedrock Nova 2 Lite for room description generation.
// Returns the raw response text or throws on timeout/error.
//
// Lambda timeout is 60s (template.yaml) to accommodate this 30s request plus prompt build and cache write.
//

import {
    BedrockRuntimeClient,
    ConverseCommand,
    type ConverseCommandInput,
    type Message,
    type ContentBlock
} from '@aws-sdk/client-bedrock-runtime'

export const BEDROCK_ROOM_DESCRIPTION_MODEL_ID = 'us.amazon.nova-2-lite-v1:0' as const
export const BEDROCK_REQUEST_TIMEOUT_MS = 30_000
export const BEDROCK_MAX_TOKENS = 1024

export type InvokeBedrockRoomDescriptionSuccess = {
    success: true;
    body: string;
}

export type InvokeBedrockRoomDescriptionFailure = {
    success: false;
    errorMessage: string;
}

export type InvokeBedrockRoomDescriptionResult =
    | InvokeBedrockRoomDescriptionSuccess
    | InvokeBedrockRoomDescriptionFailure

function extractTextFromResponse(response: { output?: { message?: { content?: Array<{ text?: string }> } } }): string {
    const content = response?.output?.message?.content
    if (!Array.isArray(content)) return ''
    return content
        .map((block) => (block && typeof block.text === 'string' ? block.text : ''))
        .join('')
}

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
    // Use the Lambda's region so Bedrock is invoked in the same region as the function.
    const region = process.env.AWS_REGION
    const client = options.client ?? new BedrockRuntimeClient(region ? { region } : {})

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs)

    const userMessage: Message = {
        role: 'user',
        content: [{ text: prompt } as ContentBlock]
    }

    const input: ConverseCommandInput = {
        modelId,
        messages: [userMessage],
        inferenceConfig: {
            maxTokens,
            temperature: 0.2
        }
    }

    try {
        const command = new ConverseCommand(input)
        const response = await client.send(command, { abortSignal: abortController.signal })
        clearTimeout(timeoutId)
        const body = extractTextFromResponse(response)
        return { success: true, body }
    } catch (err) {
        clearTimeout(timeoutId)
        const message = err instanceof Error ? err.message : String(err)
        const isTimeout = err instanceof Error && err.name === 'AbortError'
        return {
            success: false,
            errorMessage: isTimeout ? `Bedrock request timed out after ${timeoutMs}ms` : message
        }
    }
}
