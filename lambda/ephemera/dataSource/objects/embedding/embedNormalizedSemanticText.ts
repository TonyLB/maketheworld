import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'
import { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import {
    BEDROCK_TITAN_EMBED_MODEL_ID,
    invokeBedrockTitanEmbed,
} from '../../../llm/invokeBedrockTitanEmbed'
import { hashShortNameForEmbedding } from './impromptuEmbeddingNeedsRefresh'

export const BEDROCK_OBJECT_SHORTNAME_EMBED_TIMEOUT_MS = 10_000

export type EmbedNormalizedSemanticTextSuccess = {
    success: true;
    embedding: SemanticEmbedding;
}

export type EmbedNormalizedSemanticTextFailure = {
    success: false;
    errorMessage: string;
}

export type EmbedNormalizedSemanticTextResult =
    | EmbedNormalizedSemanticTextSuccess
    | EmbedNormalizedSemanticTextFailure

export type EmbedNormalizedSemanticTextDeps = {
    invokeEmbed?: typeof invokeBedrockTitanEmbed;
    timeoutMs?: number;
    client?: BedrockRuntimeClient;
}

/**
 * Bedrock Titan v2 embed for already-normalized non-empty text: hash, invoke, quantize.
 * Caller must enforce non-empty normalized input.
 */
export async function embedNormalizedSemanticText(
    normalized: string,
    deps: EmbedNormalizedSemanticTextDeps = {}
): Promise<EmbedNormalizedSemanticTextResult> {
    const sourceTextHash = hashShortNameForEmbedding(normalized)
    const invokeEmbed = deps.invokeEmbed ?? invokeBedrockTitanEmbed
    const timeoutMs = deps.timeoutMs ?? BEDROCK_OBJECT_SHORTNAME_EMBED_TIMEOUT_MS

    const embedResult = await invokeEmbed({
        inputText: normalized,
        timeoutMs,
        client: deps.client,
    })
    if (!embedResult.success) {
        return { success: false, errorMessage: embedResult.errorMessage }
    }

    const embedding = SemanticEmbedding.fromFloat32(embedResult.embedding, {
        modelId: BEDROCK_TITAN_EMBED_MODEL_ID,
        sourceTextHash,
    })
    return { success: true, embedding }
}
