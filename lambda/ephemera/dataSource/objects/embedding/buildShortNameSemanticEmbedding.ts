import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'
import { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import { invokeBedrockTitanEmbed } from '../../../llm/invokeBedrockTitanEmbed'
import { embedNormalizedSemanticText } from './embedNormalizedSemanticText'
export { BEDROCK_OBJECT_SHORTNAME_EMBED_TIMEOUT_MS } from './embedNormalizedSemanticText'
import { normalizeShortNameForEmbedding } from './impromptuEmbeddingNeedsRefresh'

export type BuildShortNameSemanticEmbeddingSuccess = {
    success: true;
    embedding: SemanticEmbedding;
}

export type BuildShortNameSemanticEmbeddingFailure = {
    success: false;
    errorMessage: string;
}

export type BuildShortNameSemanticEmbeddingResult =
    | BuildShortNameSemanticEmbeddingSuccess
    | BuildShortNameSemanticEmbeddingFailure

export type BuildShortNameSemanticEmbeddingDeps = {
    invokeEmbed?: typeof invokeBedrockTitanEmbed;
    timeoutMs?: number;
    client?: BedrockRuntimeClient;
}

/**
 * Best-effort embed for improvisational object shortName: normalize, hash, Bedrock Titan v2, quantize.
 * Caller (spawn coordinator) decides whether absence blocks object creation (OE-3: it must not).
 */
export async function buildShortNameSemanticEmbedding(
    shortName: string,
    deps: BuildShortNameSemanticEmbeddingDeps = {}
): Promise<BuildShortNameSemanticEmbeddingResult> {
    const normalized = normalizeShortNameForEmbedding(shortName)
    if (normalized.length === 0) {
        return { success: false, errorMessage: 'shortName must be non-empty after normalization' }
    }

    return embedNormalizedSemanticText(normalized, deps)
}
