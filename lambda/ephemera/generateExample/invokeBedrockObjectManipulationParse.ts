//
// Bedrock invocation for object manipulation Parse (BD-21 tokenized command skeleton).
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
    BEDROCK_NOVA_MICRO_MODEL_ID,
    DEFAULT_NOVA_MODEL,
    type NovaModel,
    novaModelToBedrockModelId,
} from '../llm/novaModel'
import type { ParseObjectManipulationEnrichPromptParts } from '../dataSource/actions/enrich/objectManipulation/buildPrompt'

export const BEDROCK_OBJECT_MANIPULATION_PARSE_MAX_TOKENS = 1024
export const BEDROCK_OBJECT_MANIPULATION_PARSE_TIMEOUT_MS = 30_000
export const BEDROCK_OBJECT_MANIPULATION_PARSE_DEFAULT_MODEL: NovaModel = 'NovaMicro'

export type InvokeBedrockObjectManipulationParseResult = InvokeBedrockConverseTextResult

function objectManipulationParseUserContent(parts: ParseObjectManipulationEnrichPromptParts): ContentBlock[] {
    return [
        { text: parts.invariantPrefix },
        { cachePoint: { type: CachePointType.DEFAULT } },
        { text: parts.dynamicSuffix },
    ]
}

export async function invokeBedrockObjectManipulationParse(
    promptParts: ParseObjectManipulationEnrichPromptParts,
    options: {
        model?: NovaModel
        modelId?: string
        maxTokens?: number
        temperature?: number
        timeoutMs?: number
        client?: BedrockRuntimeClient
    } = {}
): Promise<InvokeBedrockObjectManipulationParseResult> {
    const model = options.model ?? BEDROCK_OBJECT_MANIPULATION_PARSE_DEFAULT_MODEL
    const modelId = options.modelId ?? novaModelToBedrockModelId(model)
    const maxTokens = options.maxTokens ?? BEDROCK_OBJECT_MANIPULATION_PARSE_MAX_TOKENS
    const timeoutMs = options.timeoutMs ?? BEDROCK_OBJECT_MANIPULATION_PARSE_TIMEOUT_MS
    const temperature = options.temperature ?? 0.1

    const userMessage: Message = {
        role: 'user',
        content: objectManipulationParseUserContent(promptParts),
    }

    return invokeBedrockConverseText({
        modelId: modelId || BEDROCK_NOVA_MICRO_MODEL_ID,
        messages: [userMessage],
        maxTokens,
        temperature,
        timeoutMs,
        client: options.client,
    })
}
