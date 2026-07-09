import { catalogHasDuplicateNormalizedShortNames } from './catalogHasDuplicateNormalizedShortNames'
import { buildSpanCandidatePool, type ResolveLexicalChannelActive } from './buildSpanCandidatePool'
import { decideEmbeddingMatch } from './decideEmbeddingMatch'
import { rankCatalogByCosineSimilarity } from './rankCatalogByCosineSimilarity'
import type { EmbeddingMatchCandidate, EmbeddingMatchDecision } from './types'
import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import type { SpanCandidatePool } from '../spanResolution'
import type { RelevanceNormalizationParams } from './thresholds'

export type EmbeddingIdentitySimulationMetrics = {
    topJointRelevance: number
    topMargin: number
    shortlistSize: number
    eligibleEmbedCount: number
    lexicalChannelActive: boolean
}

export type EmbeddingIdentitySimulation = {
    pool: SpanCandidatePool
    legacyDecision: EmbeddingMatchDecision
    metrics: EmbeddingIdentitySimulationMetrics
}

export type SimulateEmbeddingIdentityWithPoolOptions = {
    params?: RelevanceNormalizationParams
    /** Harness-only override (e.g. legacy gated baseline). Production omits. */
    resolveLexicalChannelActive?: ResolveLexicalChannelActive
}

const decideLegacyEmbeddingMatch = (
    spanEmbedding: SemanticEmbedding,
    candidates: readonly EmbeddingMatchCandidate[]
): EmbeddingMatchDecision => {
    const rankedScores = rankCatalogByCosineSimilarity(spanEmbedding, candidates)
    const eligibleCount = candidates.filter((candidate) => candidate.embedding !== undefined).length
    const hasDuplicateShortNames = catalogHasDuplicateNormalizedShortNames(candidates)
    return decideEmbeddingMatch(rankedScores, eligibleCount, hasDuplicateShortNames)
}

const buildSimulationMetrics = (
    pool: SpanCandidatePool,
    candidates: readonly EmbeddingMatchCandidate[],
    lexicalChannelActive: boolean
): EmbeddingIdentitySimulationMetrics => {
    const head = pool.candidates[0]
    return {
        topJointRelevance: head?.jointRelevance ?? 0,
        topMargin: head?.marginToRunnerUp ?? 0,
        shortlistSize: pool.shortlist?.length ?? 0,
        eligibleEmbedCount: candidates.filter((candidate) => candidate.embedding !== undefined).length,
        lexicalChannelActive,
    }
}

/**
 * FT-1.2 pool simulation: ranked SpanCandidatePool + v1 legacy decision for regression.
 */
export function simulateEmbeddingIdentityWithPool(
    spanEmbedding: SemanticEmbedding,
    candidates: readonly EmbeddingMatchCandidate[],
    span: string = '',
    options: SimulateEmbeddingIdentityWithPoolOptions = {}
): EmbeddingIdentitySimulation {
    const pool = buildSpanCandidatePool(span, candidates, {
        spanEmbedding,
        params: options.params,
        ...(options.resolveLexicalChannelActive
            ? { resolveLexicalChannelActive: options.resolveLexicalChannelActive }
            : {}),
    })
    const lexicalChannelActive = pool.candidates.some(
        (candidate) => candidate.lexRelevance !== undefined
    )

    return {
        pool,
        legacyDecision: decideLegacyEmbeddingMatch(spanEmbedding, candidates),
        metrics: buildSimulationMetrics(pool, candidates, lexicalChannelActive),
    }
}

/**
 * v1 production shim: cosine rank + conjunctive gates (unchanged until FT-2).
 */
export function simulateEmbeddingIdentity(
    spanEmbedding: SemanticEmbedding,
    candidates: readonly EmbeddingMatchCandidate[]
): EmbeddingMatchDecision {
    return decideLegacyEmbeddingMatch(spanEmbedding, candidates)
}
