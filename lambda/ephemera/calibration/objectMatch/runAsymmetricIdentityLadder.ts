import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import {
    embedNormalizedSemanticText,
    type EmbedNormalizedSemanticTextDeps,
} from '../../dataSource/objects/embedding/embedNormalizedSemanticText'
import { normalizeShortNameForEmbedding } from '../../dataSource/objects/embedding/impromptuEmbeddingNeedsRefresh'
import { BEDROCK_TITAN_EMBED_MODEL_ID } from '../../llm/invokeBedrockTitanEmbed'

import {
    ASYMMETRIC_IDENTITY_LADDER_ID,
    ASYMMETRIC_IDENTITY_TIER_ORDER,
    buildCatalogIndexText,
    CATALOG_INDEX_COMPOSITIONS,
    DEFAULT_CATALOG_INDEX_COMPOSITION,
    filterAsymmetricLadderCasesByTier,
    normalizeCatalogIndexTextForEmbedding,
    type AsymmetricIdentityLadderCase,
    type AsymmetricIdentityTier,
    type CatalogIndexComposition,
} from './asymmetricIdentityLadder'
import { bucketStats, compareEmbeddingPair, type NumericBucketStats } from './runEmbeddingCalibration'

export type AsymmetricCompositionStudyResult = {
    composition: CatalogIndexComposition
    catalogIndexText: string
    catalogIndexNormalized: string
    similarity: number
}

export type AsymmetricIdentityLadderCaseResult = {
    id: string
    tier: AsymmetricIdentityTier
    span: string
    spanNormalized: string
    catalogShortName: string
    description: string
    composition: CatalogIndexComposition
    catalogIndexText: string
    catalogIndexNormalized: string
    similarity: number
    symmetricSimilarity: number
    delta: number
    symmetricBaselinePairId?: string
    compositionStudyResults?: AsymmetricCompositionStudyResult[]
    notes?: string
}

export type AsymmetricIdentityTierSummary = NumericBucketStats & {
    tier: AsymmetricIdentityTier
    tierOrderIndex: number
    symmetricMedian: number
    deltaMedian: number
}

export type AsymmetricIdentityMonotonicityViolation = {
    closerTier: AsymmetricIdentityTier
    fartherTier: AsymmetricIdentityTier
    closerMedian: number
    fartherMedian: number
    message: string
}

export type RunAsymmetricIdentityLadderResult = {
    ladderId: typeof ASYMMETRIC_IDENTITY_LADDER_ID
    modelId: string
    composition: CatalogIndexComposition
    cases: AsymmetricIdentityLadderCaseResult[]
    sortedBySimilarity: AsymmetricIdentityLadderCaseResult[]
    sortedByDelta: AsymmetricIdentityLadderCaseResult[]
    tierSummaries: AsymmetricIdentityTierSummary[]
    monotonicityViolations: AsymmetricIdentityMonotonicityViolation[]
    note: string
}

export type RunAsymmetricIdentityLadderOptions = {
    tier?: AsymmetricIdentityTier
    composition?: CatalogIndexComposition
}

const createAsymmetricEmbeddingCache = (deps: EmbedNormalizedSemanticTextDeps = {}) => {
    const spanCache = new Map<string, SemanticEmbedding>()
    const catalogCache = new Map<string, SemanticEmbedding>()

    const embedSpanNormalized = async (normalized: string): Promise<SemanticEmbedding | null> => {
        const cached = spanCache.get(normalized)
        if (cached) {
            return cached
        }
        const result = await embedNormalizedSemanticText(normalized, deps)
        if (!result.success) {
            return null
        }
        spanCache.set(normalized, result.embedding)
        return result.embedding
    }

    const embedCatalogIndex = async (catalogIndexText: string): Promise<SemanticEmbedding | null> => {
        const normalized = normalizeCatalogIndexTextForEmbedding(catalogIndexText)
        if (normalized.length === 0) {
            return null
        }
        const cached = catalogCache.get(normalized)
        if (cached) {
            return cached
        }
        const result = await embedNormalizedSemanticText(normalized, deps)
        if (!result.success) {
            return null
        }
        catalogCache.set(normalized, result.embedding)
        return result.embedding
    }

    return { embedSpanNormalized, embedCatalogIndex }
}

const compareAsymmetricSimilarity = async (
    span: string,
    catalogIndexText: string,
    cache: ReturnType<typeof createAsymmetricEmbeddingCache>
): Promise<{ spanNormalized: string; catalogIndexNormalized: string; similarity: number } | { error: string }> => {
    const spanNormalized = normalizeShortNameForEmbedding(span)
    if (spanNormalized.length === 0) {
        return { error: 'span must normalize to a non-empty string' }
    }

    const catalogIndexNormalized = normalizeCatalogIndexTextForEmbedding(catalogIndexText)
    if (catalogIndexNormalized.length === 0) {
        return { error: 'catalog index text must be non-empty after trim' }
    }

    const spanEmbedding = await cache.embedSpanNormalized(spanNormalized)
    const catalogEmbedding = await cache.embedCatalogIndex(catalogIndexNormalized)
    if (!spanEmbedding || !catalogEmbedding) {
        return { error: 'embed invoke failed for span or catalog index text' }
    }

    return {
        spanNormalized,
        catalogIndexNormalized,
        similarity: spanEmbedding.cosineSimilarity(catalogEmbedding),
    }
}

const buildMonotonicityViolations = (
    tierSummaries: readonly AsymmetricIdentityTierSummary[]
): AsymmetricIdentityMonotonicityViolation[] => {
    const byTier = new Map(tierSummaries.map((entry) => [entry.tier, entry]))
    const violations: AsymmetricIdentityMonotonicityViolation[] = []

    for (let index = 0; index < ASYMMETRIC_IDENTITY_TIER_ORDER.length - 1; index++) {
        const closerTier = ASYMMETRIC_IDENTITY_TIER_ORDER[index]!
        const fartherTier = ASYMMETRIC_IDENTITY_TIER_ORDER[index + 1]!
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

const evaluateCaseAtComposition = async (
    ladderCase: AsymmetricIdentityLadderCase,
    composition: CatalogIndexComposition,
    cache: ReturnType<typeof createAsymmetricEmbeddingCache>
): Promise<AsymmetricCompositionStudyResult | { error: string }> => {
    const catalogIndexText = buildCatalogIndexText(
        composition,
        ladderCase.catalogShortName,
        ladderCase.description
    )
    const compared = await compareAsymmetricSimilarity(ladderCase.span, catalogIndexText, cache)
    if ('error' in compared) {
        return compared
    }

    return {
        composition,
        catalogIndexText,
        catalogIndexNormalized: compared.catalogIndexNormalized,
        similarity: compared.similarity,
    }
}

export async function runAsymmetricIdentityLadder(
    options: RunAsymmetricIdentityLadderOptions = {},
    deps: EmbedNormalizedSemanticTextDeps = {}
): Promise<RunAsymmetricIdentityLadderResult> {
    const composition = options.composition ?? DEFAULT_CATALOG_INDEX_COMPOSITION
    const ladderCases = filterAsymmetricLadderCasesByTier(options.tier)
    const cache = createAsymmetricEmbeddingCache(deps)
    const cases: AsymmetricIdentityLadderCaseResult[] = []

    for (const ladderCase of ladderCases) {
        const catalogIndexText = buildCatalogIndexText(
            composition,
            ladderCase.catalogShortName,
            ladderCase.description
        )
        const asymmetric = await compareAsymmetricSimilarity(ladderCase.span, catalogIndexText, cache)
        if ('error' in asymmetric) {
            throw new Error(`asymmetric ladder case ${ladderCase.id}: ${asymmetric.error}`)
        }

        const symmetric = await compareEmbeddingPair(
            ladderCase.span,
            ladderCase.catalogShortName,
            deps
        )
        if ('error' in symmetric) {
            throw new Error(`asymmetric ladder case ${ladderCase.id} symmetric baseline: ${symmetric.error}`)
        }

        let compositionStudyResults: AsymmetricCompositionStudyResult[] | undefined
        if (ladderCase.compositionStudy === true && options.composition === undefined) {
            compositionStudyResults = []
            for (const studyComposition of CATALOG_INDEX_COMPOSITIONS) {
                const studyResult = await evaluateCaseAtComposition(ladderCase, studyComposition, cache)
                if ('error' in studyResult) {
                    throw new Error(
                        `asymmetric ladder case ${ladderCase.id} composition ${studyComposition}: ${studyResult.error}`
                    )
                }
                compositionStudyResults.push(studyResult)
            }
        }

        cases.push({
            id: ladderCase.id,
            tier: ladderCase.tier,
            span: ladderCase.span,
            spanNormalized: asymmetric.spanNormalized,
            catalogShortName: ladderCase.catalogShortName,
            description: ladderCase.description,
            composition,
            catalogIndexText,
            catalogIndexNormalized: asymmetric.catalogIndexNormalized,
            similarity: asymmetric.similarity,
            symmetricSimilarity: symmetric.similarity,
            delta: asymmetric.similarity - symmetric.similarity,
            ...(ladderCase.symmetricBaselinePairId
                ? { symmetricBaselinePairId: ladderCase.symmetricBaselinePairId }
                : {}),
            ...(compositionStudyResults ? { compositionStudyResults } : {}),
            ...(ladderCase.notes ? { notes: ladderCase.notes } : {}),
        })
    }

    const sortedBySimilarity = [...cases].sort((left, right) => right.similarity - left.similarity)
    const sortedByDelta = [...cases].sort((left, right) => right.delta - left.delta)

    const tiersPresent = options.tier
        ? [options.tier]
        : ASYMMETRIC_IDENTITY_TIER_ORDER.filter((tierName) =>
              cases.some((entry) => entry.tier === tierName)
          )

    const tierSummaries: AsymmetricIdentityTierSummary[] = tiersPresent.map((tierName) => {
        const tierCases = cases.filter((entry) => entry.tier === tierName)
        const similarities = tierCases.map((entry) => entry.similarity)
        const symmetricSimilarities = tierCases.map((entry) => entry.symmetricSimilarity)
        const deltas = tierCases.map((entry) => entry.delta)
        return {
            tier: tierName,
            tierOrderIndex: ASYMMETRIC_IDENTITY_TIER_ORDER.indexOf(tierName),
            ...bucketStats(similarities),
            symmetricMedian: bucketStats(symmetricSimilarities).median,
            deltaMedian: bucketStats(deltas).median,
        }
    })

    const monotonicityViolations = buildMonotonicityViolations(tierSummaries)

    return {
        ladderId: ASYMMETRIC_IDENTITY_LADDER_ID,
        modelId: BEDROCK_TITAN_EMBED_MODEL_ID,
        composition,
        cases,
        sortedBySimilarity,
        sortedByDelta,
        tierSummaries,
        monotonicityViolations,
        note:
            monotonicityViolations.length === 0
                ? 'Asymmetric tier medians are non-increasing from identity-positive-exact -> unrelated (exploratory).'
                : 'Asymmetric tier median inversions detected; review sortedBySimilarity, sortedByDelta, and compositionStudyResults.',
    }
}
