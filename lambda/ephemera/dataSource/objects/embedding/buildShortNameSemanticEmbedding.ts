import { createHash } from 'node:crypto'

import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'
import { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import { normalizeExitName } from '../../actions/roomExitTargetsForCharacter'
import {
    BEDROCK_TITAN_EMBED_MODEL_ID,
    invokeBedrockTitanEmbed,
} from '../../../llm/invokeBedrockTitanEmbed'

export const BEDROCK_OBJECT_SHORTNAME_EMBED_TIMEOUT_MS = 10_000

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

const hashEmbeddingSourceText = (normalizedText: string): string =>
    createHash('sha256').update(normalizedText, 'utf8').digest('hex')

/**
 * Best-effort embed for improvisational object shortName: normalize, hash, Bedrock Titan v2, quantize.
 * Caller (spawn coordinator) decides whether absence blocks object creation (OE-3: it must not).
 */
export async function buildShortNameSemanticEmbedding(
    shortName: string,
    deps: BuildShortNameSemanticEmbeddingDeps = {}
): Promise<BuildShortNameSemanticEmbeddingResult> {
    const normalized = normalizeExitName(shortName.trim())
    if (normalized.length === 0) {
        return { success: false, errorMessage: 'shortName must be non-empty after normalization' }
    }

    const sourceTextHash = hashEmbeddingSourceText(normalized)
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
