import { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import {
    BEDROCK_OBJECT_SHORTNAME_EMBED_TIMEOUT_MS,
    type EmbedNormalizedSemanticTextDeps,
} from '../../dataSource/objects/embedding/embedNormalizedSemanticText'
import {
    hashShortNameForEmbedding,
    normalizeShortNameForEmbedding,
} from '../../dataSource/objects/embedding/impromptuEmbeddingNeedsRefresh'
import {
    BEDROCK_TITAN_EMBED_MODEL_ID,
    invokeBedrockTitanEmbed,
} from '../../llm/invokeBedrockTitanEmbed'

export type VerifyRepeatBedrockEmbedResult = {
    text: string
    normalized: string
    modelId: string
    bedrockInvokeCount: 2
    sourceTextHash: string
    float32: {
        maxAbsDiff: number
        cosineSimilarity: number
    }
    quantized: {
        cosineSimilarity: number
        vectorsEqual: boolean
    }
    productionPath: {
        crossInvokeCosineSimilarity: number
        vectorsEqual: boolean
    }
}

const cosineSimilarityFloat32 = (left: readonly number[], right: readonly number[]): number => {
    if (left.length !== right.length) {
        throw new Error('float32 vectors must have equal length')
    }
    let dot = 0
    let normLeft = 0
    let normRight = 0
    for (let index = 0; index < left.length; index++) {
        const leftValue = left[index] ?? 0
        const rightValue = right[index] ?? 0
        dot += leftValue * rightValue
        normLeft += leftValue * leftValue
        normRight += rightValue * rightValue
    }
    if (normLeft === 0 || normRight === 0) {
        return 0
    }
    return dot / (Math.sqrt(normLeft) * Math.sqrt(normRight))
}

const maxAbsDiffFloat32 = (left: readonly number[], right: readonly number[]): number => {
    let max = 0
    for (let index = 0; index < left.length; index++) {
        max = Math.max(max, Math.abs((left[index] ?? 0) - (right[index] ?? 0)))
    }
    return max
}

/**
 * Invoke Bedrock twice for the same normalized text (no embed cache) and compare raw
 * float32 vectors plus independent production quantize paths. Diagnostic for embed
 * pipeline correctness; not used in identity steady state.
 */
export async function verifyRepeatBedrockEmbed(
    text: string,
    deps: EmbedNormalizedSemanticTextDeps = {}
): Promise<VerifyRepeatBedrockEmbedResult | { error: string }> {
    const normalized = normalizeShortNameForEmbedding(text)
    if (normalized.length === 0) {
        return { error: 'text must normalize to a non-empty string' }
    }

    const invokeEmbed = deps.invokeEmbed ?? invokeBedrockTitanEmbed
    const timeoutMs = deps.timeoutMs ?? BEDROCK_OBJECT_SHORTNAME_EMBED_TIMEOUT_MS
    const sourceTextHash = hashShortNameForEmbedding(normalized)

    const firstInvoke = await invokeEmbed({
        inputText: normalized,
        timeoutMs,
        client: deps.client,
    })
    if (!firstInvoke.success) {
        return { error: `first Bedrock invoke failed: ${firstInvoke.errorMessage}` }
    }

    const secondInvoke = await invokeEmbed({
        inputText: normalized,
        timeoutMs,
        client: deps.client,
    })
    if (!secondInvoke.success) {
        return { error: `second Bedrock invoke failed: ${secondInvoke.errorMessage}` }
    }

    const firstFromFloat = SemanticEmbedding.fromFloat32(firstInvoke.embedding, {
        modelId: BEDROCK_TITAN_EMBED_MODEL_ID,
        sourceTextHash,
    })
    const secondFromFloat = SemanticEmbedding.fromFloat32(secondInvoke.embedding, {
        modelId: BEDROCK_TITAN_EMBED_MODEL_ID,
        sourceTextHash,
    })

    return {
        text,
        normalized,
        modelId: BEDROCK_TITAN_EMBED_MODEL_ID,
        bedrockInvokeCount: 2,
        sourceTextHash,
        float32: {
            maxAbsDiff: maxAbsDiffFloat32(firstInvoke.embedding, secondInvoke.embedding),
            cosineSimilarity: cosineSimilarityFloat32(firstInvoke.embedding, secondInvoke.embedding),
        },
        quantized: {
            cosineSimilarity: firstFromFloat.cosineSimilarity(secondFromFloat),
            vectorsEqual: firstFromFloat.equals(secondFromFloat),
        },
        productionPath: {
            crossInvokeCosineSimilarity: firstFromFloat.cosineSimilarity(secondFromFloat),
            vectorsEqual: firstFromFloat.equals(secondFromFloat),
        },
    }
}
