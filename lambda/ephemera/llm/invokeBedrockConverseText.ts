//
// Shared Bedrock Runtime Converse call: text in, aggregated text out, timeout and error mapping.
//

import {
    BedrockRuntimeClient,
    ConverseCommand,
    type ConverseCommandInput,
    type Message,
    type TokenUsage,
} from '@aws-sdk/client-bedrock-runtime'

export type InvokeBedrockConverseTextSuccess = {
    success: true;
    body: string;
    reasoningContent?: string;
    usage?: TokenUsage
}

export type InvokeBedrockConverseTextFailure = {
    success: false;
    errorMessage: string;
}

export type InvokeBedrockConverseTextResult =
    | InvokeBedrockConverseTextSuccess
    | InvokeBedrockConverseTextFailure

export type NovaReasoningEffort = 'low' | 'medium' | 'high'

export type InvokeBedrockConverseTextParams = {
    modelId: string;
    messages: Message[];
    maxTokens: number;
    temperature: number;
    timeoutMs: number;
    client?: BedrockRuntimeClient;
    /** When true, sends model-specific extended-reasoning request fields (Amazon Nova today). Default false. */
    extendedThinking?: boolean;
    /** Used with `extendedThinking` for Nova only; defaults to `medium`. */
    reasoningEffort?: NovaReasoningEffort;
}

let defaultClient: BedrockRuntimeClient | undefined

const getDefaultClient = (): BedrockRuntimeClient => {
    if (!defaultClient) {
        const region = process.env.AWS_REGION
        defaultClient = new BedrockRuntimeClient(region ? { region } : {})
    }
    return defaultClient
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Nova-style Converse output block: `reasoningContent.reasoningText.text` */
function extractReasoningSnippetFromContentBlock(block: unknown): string {
    if (!isRecord(block)) return ''
    const rc = block.reasoningContent
    if (!isRecord(rc)) return ''
    const rt = rc.reasoningText
    if (!isRecord(rt)) return ''
    const t = rt.text
    return typeof t === 'string' ? t : ''
}

function extractBodyAndReasoningFromResponse(response: {
    output?: { message?: { content?: unknown[] } };
}): { body: string; reasoningContent?: string } {
    const content = response?.output?.message?.content
    if (!Array.isArray(content)) {
        return { body: '' }
    }

    const textParts: string[] = []
    const reasoningParts: string[] = []

    for (const block of content) {
        if (isRecord(block) && typeof block.text === 'string') {
            textParts.push(block.text)
        }
        const reasoningSnippet = extractReasoningSnippetFromContentBlock(block)
        if (reasoningSnippet.length > 0) {
            reasoningParts.push(reasoningSnippet)
        }
    }

    const body = textParts.join('')
    const reasoningJoined = reasoningParts.join('')
    return reasoningJoined.length > 0
        ? { body, reasoningContent: reasoningJoined }
        : { body }
}

/** Heuristic: Amazon Nova model ids used with Converse (e.g. Coyote hypothesis). */
function isAmazonNovaConverseModelId(modelId: string): boolean {
    const id = modelId.toLowerCase()
    return id.includes('amazon.nova') || id.includes('.nova-') || id.includes('nova-lite') || id.includes('nova-pro')
}

function novaExtendedThinkingRequestFields(effort: NovaReasoningEffort): Record<string, unknown> {
    return {
        reasoningConfig: {
            type: 'enabled',
            maxReasoningEffort: effort,
        },
    }
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
        extendedThinking = false,
        reasoningEffort = 'medium',
    } = params

    const client = clientOpt ?? getDefaultClient()

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs)

    if (extendedThinking && !isAmazonNovaConverseModelId(modelId)) {
        clearTimeout(timeoutId)
        return {
            success: false,
            errorMessage: `extendedThinking is not supported for modelId "${modelId}" (only Amazon Nova Converse models in this build)`,
        }
    }

    const input: ConverseCommandInput = {
        modelId,
        messages,
        inferenceConfig: {
            maxTokens,
            temperature,
        },
    }

    if (extendedThinking && isAmazonNovaConverseModelId(modelId)) {
        input.additionalModelRequestFields = novaExtendedThinkingRequestFields(
            reasoningEffort
        ) as ConverseCommandInput['additionalModelRequestFields']
    }

    try {
        const command = new ConverseCommand(input)
        const response = await client.send(command, { abortSignal: abortController.signal })
        clearTimeout(timeoutId)
        const { body, reasoningContent } = extractBodyAndReasoningFromResponse(response)
        const success: InvokeBedrockConverseTextSuccess = {
            success: true,
            body,
            usage: response.usage,
        }
        if (reasoningContent !== undefined) {
            success.reasoningContent = reasoningContent
        }
        return success
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
