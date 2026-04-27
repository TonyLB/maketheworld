//
// Second Bedrock call: Acme order line enrichment (name and affinities JSON).
// Defaults to Nova 2 Lite with higher token/timeout budget for multi-line JSON.
// Prompt caching: static instructions before the cache point; player command + line list after.
//

import {
    CachePointType,
    type BedrockRuntimeClient,
    type ContentBlock,
    type Message,
} from '@aws-sdk/client-bedrock-runtime'
import {
    invokeBedrockConverseText,
    type InvokeBedrockConverseTextResult,
} from '../llm/invokeBedrockConverseText'
import {
    BEDROCK_NOVA_2_LITE_MODEL_ID,
    DEFAULT_NOVA_MODEL,
    type NovaModel,
    novaModelToBedrockModelId,
} from '../llm/novaModel'

export const BEDROCK_PARSE_COMMAND_MODEL_ID = BEDROCK_NOVA_2_LITE_MODEL_ID

/** Split prompt for Bedrock prompt caching (`invariantPrefix` | cache point | `dynamicSuffix`). */
export type ParseAcmeOrderEnrichPromptParts = {
    invariantPrefix: string;
    dynamicSuffix: string;
}

/** Default max tokens for Acme enrich JSON (`lines` array). */
export const BEDROCK_ACME_ORDER_ENRICH_MAX_TOKENS = 4096

/** Default timeout for Acme enrich (multi-line payloads). */
export const BEDROCK_ACME_ORDER_ENRICH_TIMEOUT_MS = 45_000

export type InvokeBedrockAcmeOrderEnrichResult = InvokeBedrockConverseTextResult

function acmeOrderEnrichUserContent(parts: ParseAcmeOrderEnrichPromptParts): ContentBlock[] {
    return [
        { text: parts.invariantPrefix },
        { cachePoint: { type: CachePointType.DEFAULT } },
        { text: parts.dynamicSuffix },
    ]
}

/**
 * Invokes Bedrock for Acme-order enrichment (structured JSON). Reuses Nova Lite model id from parse-command.
 */
export async function invokeBedrockAcmeOrderEnrich(
    promptParts: ParseAcmeOrderEnrichPromptParts,
    options: {
        model?: NovaModel;
        modelId?: string;
        maxTokens?: number;
        temperature?: number;
        timeoutMs?: number;
        client?: BedrockRuntimeClient;
    } = {}
): Promise<InvokeBedrockAcmeOrderEnrichResult> {
    const model = options.model ?? DEFAULT_NOVA_MODEL
    const modelId = options.modelId ?? novaModelToBedrockModelId(model)
    const maxTokens = options.maxTokens ?? BEDROCK_ACME_ORDER_ENRICH_MAX_TOKENS
    const timeoutMs = options.timeoutMs ?? BEDROCK_ACME_ORDER_ENRICH_TIMEOUT_MS
    const temperature = options.temperature ?? 0.1

    const userMessage: Message = {
        role: 'user',
        content: acmeOrderEnrichUserContent(promptParts),
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
