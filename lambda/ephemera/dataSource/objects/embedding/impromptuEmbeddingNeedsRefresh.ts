import { createHash } from 'node:crypto'

import type { EphemeraObjectEmbedding } from '@tonylb/mtw-interfaces/ts/ephemeraEmbedding'
import {
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
    SEMANTIC_EMBEDDING_V1_ENCODING,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import { normalizeExitName } from '../../actions/roomExitTargetsForCharacter'
import { BEDROCK_TITAN_EMBED_MODEL_ID } from '../../../llm/invokeBedrockTitanEmbed'

export const normalizeShortNameForEmbedding = (shortName: string): string =>
    normalizeExitName(shortName.trim())

export const hashShortNameForEmbedding = (normalized: string): string =>
    createHash('sha256').update(normalized, 'utf8').digest('hex')

/**
 * Whether update should attempt a best-effort re-embed for EMBEDDING#IMPROMPTU.
 */
export const impromptuEmbeddingNeedsRefresh = (
    nextShortName: string,
    priorRow: EphemeraObjectEmbedding | undefined
): boolean => {
    const normalized = normalizeShortNameForEmbedding(nextShortName)
    if (normalized.length === 0) {
        return false
    }

    if (!priorRow) {
        return true
    }

    const record = priorRow.embedding
    if (record.sourceTextHash === undefined) {
        return true
    }

    const expectedHash = hashShortNameForEmbedding(normalized)
    if (record.sourceTextHash !== expectedHash) {
        return true
    }

    if (record.modelId !== BEDROCK_TITAN_EMBED_MODEL_ID) {
        return true
    }

    if (record.dimensions !== SEMANTIC_EMBEDDING_V1_DIMENSIONS) {
        return true
    }

    if (record.encoding !== SEMANTIC_EMBEDDING_V1_ENCODING) {
        return true
    }

    return false
}
