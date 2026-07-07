import { calibrationJsonResponse } from '../../calibrationResponse'
import { calibrationRunMetadata } from '../runEmbeddingCalibration'
import { runAsymmetricIdentityLadder } from '../runAsymmetricIdentityLadder'
import {
    ASYMMETRIC_IDENTITY_TIER_ORDER,
    CATALOG_INDEX_COMPOSITIONS,
    type AsymmetricIdentityTier,
    type CatalogIndexComposition,
} from '../asymmetricIdentityLadder'

export type EmbeddingAsymmetricLadderEvent = {
    type: 'EmbeddingAsymmetricLadder'
    tier?: AsymmetricIdentityTier
    composition?: CatalogIndexComposition
}

const VALID_TIERS = new Set<AsymmetricIdentityTier>(ASYMMETRIC_IDENTITY_TIER_ORDER)
const VALID_COMPOSITIONS = new Set<CatalogIndexComposition>(CATALOG_INDEX_COMPOSITIONS)

export async function handleEmbeddingAsymmetricLadder(event: EmbeddingAsymmetricLadderEvent) {
    if (event.tier !== undefined && !VALID_TIERS.has(event.tier)) {
        return calibrationJsonResponse(400, { error: `invalid tier: ${String(event.tier)}` })
    }

    if (event.composition !== undefined && !VALID_COMPOSITIONS.has(event.composition)) {
        return calibrationJsonResponse(400, {
            error: `invalid composition: ${String(event.composition)}`,
            validCompositions: [...CATALOG_INDEX_COMPOSITIONS],
        })
    }

    const result = await runAsymmetricIdentityLadder({
        tier: event.tier,
        composition: event.composition,
    })
    return calibrationJsonResponse(200, {
        ...calibrationRunMetadata(),
        ...result,
    })
}
