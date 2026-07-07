import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import {
    embedNormalizedSemanticText,
    type EmbedNormalizedSemanticTextDeps,
} from './embedNormalizedSemanticText'
import { normalizeShortNameForEmbedding } from './impromptuEmbeddingNeedsRefresh'

export type EmbedObjectSpanSuccess = {
    success: true;
    embedding: SemanticEmbedding;
}

export type EmbedObjectSpanFailure = {
    success: false;
}

export type EmbedObjectSpanResult = EmbedObjectSpanSuccess | EmbedObjectSpanFailure

export type EmbedObjectSpanDeps = EmbedNormalizedSemanticTextDeps

/**
 * Embed a raw object span for identity fast path: normalize, Bedrock Titan v2, quantize.
 * Empty normalized span abstains without Bedrock (EM-5 maps failure to identity LLM fallthrough).
 */
export async function embedObjectSpan(
    rawObjectSpan: string,
    deps: EmbedObjectSpanDeps = {}
): Promise<EmbedObjectSpanResult> {
    const normalized = normalizeShortNameForEmbedding(rawObjectSpan)
    if (normalized.length === 0) {
        return { success: false }
    }

    const result = await embedNormalizedSemanticText(normalized, deps)
    if (!result.success) {
        return { success: false }
    }

    return { success: true, embedding: result.embedding }
}
