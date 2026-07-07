import { calibrationJsonResponse } from '../../calibrationResponse'
import { calibrationRunMetadata } from '../runEmbeddingCalibration'
import { runSemanticDistanceLadder } from '../runSemanticDistanceLadder'
import {
    SEMANTIC_DISTANCE_TIER_ORDER,
    type SemanticDistanceTier,
} from '../semanticDistanceLadder'

export type EmbeddingDistanceLadderEvent = {
    type: 'EmbeddingDistanceLadder'
    tier?: SemanticDistanceTier
}

const VALID_TIERS = new Set<SemanticDistanceTier>(SEMANTIC_DISTANCE_TIER_ORDER)

export async function handleEmbeddingDistanceLadder(event: EmbeddingDistanceLadderEvent) {
    if (event.tier !== undefined && !VALID_TIERS.has(event.tier)) {
        return calibrationJsonResponse(400, { error: `invalid tier: ${String(event.tier)}` })
    }

    const result = await runSemanticDistanceLadder(event.tier)
    return calibrationJsonResponse(200, {
        ...calibrationRunMetadata(),
        ...result,
    })
}
