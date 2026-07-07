import type { EmbedNormalizedSemanticTextDeps } from '../../dataSource/objects/embedding/embedNormalizedSemanticText'
import { BEDROCK_TITAN_EMBED_MODEL_ID } from '../../llm/invokeBedrockTitanEmbed'

import { bucketStats, compareEmbeddingPair, type NumericBucketStats } from './runEmbeddingCalibration'
import {
    filterLadderPairsByTier,
    SEMANTIC_DISTANCE_LADDER_ID,
    SEMANTIC_DISTANCE_TIER_ORDER,
    type SemanticDistanceLadderPair,
    type SemanticDistanceTier,
} from './semanticDistanceLadder'

export type SemanticDistanceLadderCaseResult = {
    id: string
    tier: SemanticDistanceTier
    left: string
    right: string
    leftNormalized: string
    rightNormalized: string
    similarity: number
    notes?: string
}

export type SemanticDistanceTierSummary = NumericBucketStats & {
    tier: SemanticDistanceTier
    tierOrderIndex: number
}

export type SemanticDistanceMonotonicityViolation = {
    closerTier: SemanticDistanceTier
    fartherTier: SemanticDistanceTier
    closerMedian: number
    fartherMedian: number
    message: string
}

export type RunSemanticDistanceLadderResult = {
    ladderId: typeof SEMANTIC_DISTANCE_LADDER_ID
    modelId: string
    cases: SemanticDistanceLadderCaseResult[]
    sortedBySimilarity: SemanticDistanceLadderCaseResult[]
    tierSummaries: SemanticDistanceTierSummary[]
    monotonicityViolations: SemanticDistanceMonotonicityViolation[]
    note: string
}

const buildMonotonicityViolations = (
    tierSummaries: readonly SemanticDistanceTierSummary[]
): SemanticDistanceMonotonicityViolation[] => {
    const byTier = new Map(tierSummaries.map((entry) => [entry.tier, entry]))
    const violations: SemanticDistanceMonotonicityViolation[] = []

    for (let index = 0; index < SEMANTIC_DISTANCE_TIER_ORDER.length - 1; index++) {
        const closerTier = SEMANTIC_DISTANCE_TIER_ORDER[index]!
        const fartherTier = SEMANTIC_DISTANCE_TIER_ORDER[index + 1]!
        const closer = byTier.get(closerTier)
        const farther = byTier.get(fartherTier)
        if (!closer || !farther || closer.count === 0 || farther.count === 0) {
            continue
        }
        if (farther.median > closer.median) {
            violations.push({
                closerTier,
                fartherTier,
                closerMedian: closer.median,
                fartherMedian: farther.median,
                message: `${fartherTier} median ${farther.median.toFixed(4)} exceeds ${closerTier} median ${closer.median.toFixed(4)}`,
            })
        }
    }

    return violations
}

export async function runSemanticDistanceLadder(
    tier?: SemanticDistanceTier,
    deps: EmbedNormalizedSemanticTextDeps = {}
): Promise<RunSemanticDistanceLadderResult> {
    const pairs = filterLadderPairsByTier(tier)
    const cases: SemanticDistanceLadderCaseResult[] = []

    for (const pair of pairs) {
        const result = await compareEmbeddingPair(pair.left, pair.right, deps)
        if ('error' in result) {
            throw new Error(`ladder pair ${pair.id}: ${result.error}`)
        }
        cases.push({
            id: pair.id,
            tier: pair.tier,
            left: pair.left,
            right: pair.right,
            leftNormalized: result.leftNormalized,
            rightNormalized: result.rightNormalized,
            similarity: result.similarity,
            ...(pair.notes ? { notes: pair.notes } : {}),
        })
    }

    const sortedBySimilarity = [...cases].sort((left, right) => right.similarity - left.similarity)

    const tiersPresent = tier
        ? [tier]
        : SEMANTIC_DISTANCE_TIER_ORDER.filter((tierName) =>
              cases.some((entry) => entry.tier === tierName)
          )

    const tierSummaries: SemanticDistanceTierSummary[] = tiersPresent.map((tierName) => {
        const similarities = cases
            .filter((entry) => entry.tier === tierName)
            .map((entry) => entry.similarity)
        return {
            tier: tierName,
            tierOrderIndex: SEMANTIC_DISTANCE_TIER_ORDER.indexOf(tierName),
            ...bucketStats(similarities),
        }
    })

    const monotonicityViolations = buildMonotonicityViolations(tierSummaries)

    return {
        ladderId: SEMANTIC_DISTANCE_LADDER_ID,
        modelId: BEDROCK_TITAN_EMBED_MODEL_ID,
        cases,
        sortedBySimilarity,
        tierSummaries,
        monotonicityViolations,
        note:
            monotonicityViolations.length === 0
                ? 'Tier medians are non-increasing from exact -> unrelated (expected semantic falloff).'
                : 'Tier median inversions detected; review sortedBySimilarity and tierSummaries for flat or inverted falloff.',
    }
}
