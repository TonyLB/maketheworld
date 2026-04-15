//
// Shared Bedrock Runtime Converse call: text in, aggregated text out, timeout and error mapping.
//

import {
    BedrockRuntimeClient,
    ConverseCommand,
    type ConverseCommandInput,
    type Message,
} from '@aws-sdk/client-bedrock-runtime'

export type InvokeBedrockConverseTextSuccess = {
    success: true;
    body: string;
}

export type InvokeBedrockConverseTextFailure = {
    success: false;
    errorMessage: string;
}

export type InvokeBedrockConverseTextResult =
    | InvokeBedrockConverseTextSuccess
    | InvokeBedrockConverseTextFailure

export type InvokeBedrockConverseTextParams = {
    modelId: string;
    messages: Message[];
    maxTokens: number;
    temperature: number;
    timeoutMs: number;
    client?: BedrockRuntimeClient;
}

function extractTextFromResponse(response: { output?: { message?: { content?: Array<{ text?: string }> } } }): string {
    const content = response?.output?.message?.content
    if (!Array.isArray(content)) return ''
    return content
        .map((block) => (block && typeof block.text === 'string' ? block.text : ''))
        .join('')
}

/**
 * Invokes Bedrock Converse with the given messages and inference settings.
 * Uses the Lambda region when constructing a default client.
 */
export async function invokeBedrockConverseText(
    params: InvokeBedrockConverseTextParams
): Promise<InvokeBedrockConverseTextResult> {
    const {
        modelId,
        messages,
        maxTokens,
        temperature,
        timeoutMs,
        client: clientOpt,
    } = params

    const region = process.env.AWS_REGION
    const client = clientOpt ?? new BedrockRuntimeClient(region ? { region } : {})

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs)

    const input: ConverseCommandInput = {
        modelId,
        messages,
        inferenceConfig: {
            maxTokens,
            temperature,
        },
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
            errorMessage: isTimeout ? `Bedrock request timed out after ${timeoutMs}ms` : message,
        }
    }
}
