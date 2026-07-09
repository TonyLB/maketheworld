import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import {
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import { rankCatalogByCosineSimilarity } from '../../dataSource/actions/enrich/objectManipulation/embeddingMatch/rankCatalogByCosineSimilarity'
import type { LexicalChannelPolicy } from '../../dataSource/actions/enrich/objectManipulation/embeddingMatch/buildSpanCandidatePool'
import { simulateEmbeddingIdentityWithPool } from '../../dataSource/actions/enrich/objectManipulation/embeddingMatch/simulateEmbeddingIdentity'
import { T_ABS, T_ABS_UNARY, T_JOINT_ABS, T_JOINT_MARGIN, T_MARGIN } from '../../dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds'
import type {
    EmbeddingMatchCandidate,
    EmbeddingMatchDecision,
    EmbeddingMatchRankedScore,
} from '../../dataSource/actions/enrich/objectManipulation/embeddingMatch/types'
import type { SpanCandidatePool } from '../../dataSource/actions/enrich/objectManipulation/spanResolution'
import {
    embedNormalizedSemanticText,
    type EmbedNormalizedSemanticTextDeps,
} from '../../dataSource/objects/embedding/embedNormalizedSemanticText'
import { normalizeShortNameForEmbedding } from '../../dataSource/objects/embedding/impromptuEmbeddingNeedsRefresh'
import { BEDROCK_TITAN_EMBED_MODEL_ID } from '../../llm/invokeBedrockTitanEmbed'

import {
    EMBEDDING_CALIBRATION_CORPUS_ID,
    EMBEDDING_CALIBRATION_IDENTITY_CASES,
    EMBEDDING_CALIBRATION_PAIR_CASES,
    filterCasesByBucket,
    type EmbeddingCalibrationBucket,
    type EmbeddingCalibrationIdentityCase,
    type EmbeddingCalibrationPairCase,
} from './corpus'

export type CalibrationRunMetadata = {
    corpusId: typeof EMBEDDING_CALIBRATION_CORPUS_ID
    modelId: string
    dimensions: number
    calibratedAt: string
}

export type NumericBucketStats = {
    min: number
    median: number
    max: number
    count: number
}

export type PairCompareResult = {
    left: string
    right: string
    leftNormalized: string
    rightNormalized: string
    similarity: number
    modelId: string
    dimensions: number
}

export type PairCorpusCaseResult = PairCompareResult & {
    id: string
    bucket: EmbeddingCalibrationBucket
}

export type PairCorpusBucketSummary = NumericBucketStats & {
    bucket: EmbeddingCalibrationBucket
    suggestedHeadroom?: string
}

export type IdentityCalibrationResult = {
    span: string
    spanNormalized: string
    catalog: readonly string[]
    rankedScores: EmbeddingMatchRankedScore[]
    margin: number | null
    ratio: number | null
    decision: EmbeddingMatchDecision
    thresholds: {
        T_ABS: number
        T_ABS_UNARY: number
        T_MARGIN: number
    }
    corpusCaseId?: string
    pool?: SpanCandidatePool
    poolMetrics?: {
        topJointRelevance: number
        topMargin: number
        shortlistSize: number
        lexicalChannelActive: boolean
    }
}

export type IdentityCorpusCaseResult = IdentityCalibrationResult & {
    id: string
    bucket: EmbeddingCalibrationBucket
    expectedVerdict?: 'resolve' | 'abstain'
}

export type IdentityCorpusBucketSummary = NumericBucketStats & {
    bucket: EmbeddingCalibrationBucket
    bestSimStats: NumericBucketStats
    marginStats: NumericBucketStats
    ratioStats: NumericBucketStats
    topJointRelevanceStats: NumericBucketStats
    topMarginStats: NumericBucketStats
    shortlistSizeStats: NumericBucketStats
    suggestedHeadroom?: string
    suggestedJointFloorHeadroom?: string
}

export type MarginRatioComparison = {
    absoluteGap: NumericBucketStats
    ratio: NumericBucketStats
    note: string
}

export type RunEmbeddingCalibrationDeps = EmbedNormalizedSemanticTextDeps

export type RunEmbeddingCalibrationOptions = {
    lexicalChannelPolicy?: LexicalChannelPolicy
}

const headroomNoteForJointBucket = (
    bucket: EmbeddingCalibrationBucket,
    jointStats: NumericBucketStats
): string | undefined => {
    switch (bucket) {
        case 'absent-object':
        case 'hard-negative':
        case 'unary-trap':
        case 'synonym-without-shared-tokens':
            return `T_JOINT_ABS upper bound hint: ${bucket} max topJointRelevance ${jointStats.max.toFixed(4)}`
        case 'positive-paraphrase':
            return `T_JOINT_ABS lower bound hint: positive-paraphrase min topJointRelevance ${jointStats.min.toFixed(4)}`
        case 'duplicate-shortName':
            return `T_JOINT_MARGIN hint: duplicate-shortName thin margin expected; median topMargin ${jointStats.median.toFixed(4)}`
        default:
            return undefined
    }
}

export const median = (values: readonly number[]): number => {
    if (values.length === 0) {
        return 0
    }
    const sorted = [...values].sort((left, right) => left - right)
    const mid = Math.floor(sorted.length / 2)
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1]! + sorted[mid]!) / 2
    }
    return sorted[mid]!
}

export const bucketStats = (values: readonly number[]): NumericBucketStats => ({
    min: values.length ? Math.min(...values) : 0,
    median: median(values),
    max: values.length ? Math.max(...values) : 0,
    count: values.length,
})

export const calibrationRunMetadata = (): CalibrationRunMetadata => ({
    corpusId: EMBEDDING_CALIBRATION_CORPUS_ID,
    modelId: BEDROCK_TITAN_EMBED_MODEL_ID,
    dimensions: SEMANTIC_EMBEDDING_V1_DIMENSIONS,
    calibratedAt: new Date().toISOString(),
})

const headroomNoteForBucket = (bucket: EmbeddingCalibrationBucket, stats: NumericBucketStats): string | undefined => {
    switch (bucket) {
        case 'absent-object':
        case 'hard-negative':
            return `T_ABS upper bound: keep below min positive resolve; absent/hard-negative max sim ${stats.max.toFixed(4)}`
        case 'positive-paraphrase':
            return `T_ABS lower bound hint: positive-paraphrase min sim ${stats.min.toFixed(4)}`
        case 'unary-trap':
        case 'synonym-without-shared-tokens':
            return `T_ABS_UNARY upper bound hint: unary-trap max best sim ${stats.max.toFixed(4)} (must stay > T_ABS)`
        default:
            return undefined
    }
}

const createEmbeddingCache = (deps: RunEmbeddingCalibrationDeps = {}) => {
    const cache = new Map<string, SemanticEmbedding>()

    const embedRaw = async (raw: string): Promise<SemanticEmbedding | null> => {
        const normalized = normalizeShortNameForEmbedding(raw)
        if (normalized.length === 0) {
            return null
        }
        return embedNormalized(normalized)
    }

    const embedNormalized = async (normalized: string): Promise<SemanticEmbedding | null> => {
        const cached = cache.get(normalized)
        if (cached) {
            return cached
        }
        const result = await embedNormalizedSemanticText(normalized, deps)
        if (!result.success) {
            return null
        }
        cache.set(normalized, result.embedding)
        return result.embedding
    }

    return { embedRaw, embedNormalized, cacheSize: () => cache.size }
}

export async function compareEmbeddingPair(
    left: string,
    right: string,
    deps: RunEmbeddingCalibrationDeps = {}
): Promise<PairCompareResult | { error: string }> {
    const leftNormalized = normalizeShortNameForEmbedding(left)
    const rightNormalized = normalizeShortNameForEmbedding(right)
    if (leftNormalized.length === 0 || rightNormalized.length === 0) {
        return { error: 'left and right must normalize to non-empty strings' }
    }

    const cache = createEmbeddingCache(deps)
    const leftEmbedding = await cache.embedNormalized(leftNormalized)
    const rightEmbedding = await cache.embedNormalized(rightNormalized)
    if (!leftEmbedding || !rightEmbedding) {
        return { error: 'embed invoke failed for one or both strings' }
    }

    return {
        left,
        right,
        leftNormalized,
        rightNormalized,
        similarity: leftEmbedding.cosineSimilarity(rightEmbedding),
        modelId: BEDROCK_TITAN_EMBED_MODEL_ID,
        dimensions: SEMANTIC_EMBEDDING_V1_DIMENSIONS,
    }
}

export async function runPairCorpus(
    bucket?: EmbeddingCalibrationBucket,
    deps: RunEmbeddingCalibrationDeps = {}
): Promise<{
    cases: PairCorpusCaseResult[]
    bucketSummaries: PairCorpusBucketSummary[]
}> {
    const casesToRun = filterCasesByBucket(EMBEDDING_CALIBRATION_PAIR_CASES, bucket)
    const cache = createEmbeddingCache(deps)
    const cases: PairCorpusCaseResult[] = []

    for (const pairCase of casesToRun) {
        const leftNormalized = normalizeShortNameForEmbedding(pairCase.left)
        const rightNormalized = normalizeShortNameForEmbedding(pairCase.right)
        const leftEmbedding = await cache.embedNormalized(leftNormalized)
        const rightEmbedding = await cache.embedNormalized(rightNormalized)
        if (!leftEmbedding || !rightEmbedding) {
            throw new Error(`embed failed for pair case ${pairCase.id}`)
        }
        cases.push({
            id: pairCase.id,
            bucket: pairCase.bucket,
            left: pairCase.left,
            right: pairCase.right,
            leftNormalized,
            rightNormalized,
            similarity: leftEmbedding.cosineSimilarity(rightEmbedding),
            modelId: BEDROCK_TITAN_EMBED_MODEL_ID,
            dimensions: SEMANTIC_EMBEDDING_V1_DIMENSIONS,
        })
    }

    const buckets = bucket
        ? [bucket]
        : [...new Set(cases.map((entry) => entry.bucket))]

    const bucketSummaries: PairCorpusBucketSummary[] = buckets.map((bucketName) => {
        const similarities = cases
            .filter((entry) => entry.bucket === bucketName)
            .map((entry) => entry.similarity)
        const stats = bucketStats(similarities)
        return {
            bucket: bucketName,
            ...stats,
            suggestedHeadroom: headroomNoteForBucket(bucketName, stats),
        }
    })

    return { cases, bucketSummaries }
}

const buildCalibrationCandidates = (
    catalog: readonly string[],
    embeddings: readonly (SemanticEmbedding | null)[]
): EmbeddingMatchCandidate[] =>
    catalog.map((shortName, index) => ({
        objectId: `OBJECT#calib-${index}` as EphemeraObjectId,
        normalizedShortName: normalizeShortNameForEmbedding(shortName),
        catalogScope: 'room' as const,
        embedding: embeddings[index] ?? undefined,
    }))

const findMatchingCorpusCase = (
    span: string,
    catalog: readonly string[]
): EmbeddingCalibrationIdentityCase | undefined =>
    EMBEDDING_CALIBRATION_IDENTITY_CASES.find(
        (identityCase) =>
            identityCase.span === span &&
            identityCase.catalog.length === catalog.length &&
            identityCase.catalog.every((entry, index) => entry === catalog[index])
    )

const marginAndRatio = (
    rankedScores: readonly EmbeddingMatchRankedScore[]
): { margin: number | null; ratio: number | null } => {
    const best = rankedScores[0]
    const second = rankedScores[1]
    if (!best || !second) {
        return { margin: null, ratio: null }
    }
    return {
        margin: best.similarity - second.similarity,
        ratio: second.similarity > 0 ? best.similarity / second.similarity : null,
    }
}

export async function simulateIdentityCalibration(
    input: { span: string; catalog: readonly string[] },
    deps: RunEmbeddingCalibrationDeps = {},
    options: RunEmbeddingCalibrationOptions = {}
): Promise<IdentityCalibrationResult | { error: string }> {
    const { span, catalog } = input
    if (!span || typeof span !== 'string') {
        return { error: 'span is required' }
    }
    if (!Array.isArray(catalog) || catalog.length === 0) {
        return { error: 'catalog must be a non-empty string array' }
    }

    const cache = createEmbeddingCache(deps)
    const spanNormalized = normalizeShortNameForEmbedding(span)
    if (spanNormalized.length === 0) {
        return { error: 'span normalizes to empty string' }
    }

    const spanEmbedding = await cache.embedRaw(span)
    if (!spanEmbedding) {
        return { error: 'embed invoke failed for span' }
    }

    const catalogEmbeddings: (SemanticEmbedding | null)[] = []
    for (const shortName of catalog) {
        catalogEmbeddings.push(await cache.embedRaw(shortName))
    }
    if (catalogEmbeddings.some((entry) => entry === null)) {
        return { error: 'embed invoke failed for one or more catalog entries' }
    }

    const candidates = buildCalibrationCandidates(catalog, catalogEmbeddings)
    const rankedScores = rankCatalogByCosineSimilarity(spanEmbedding, candidates)
    const simulation = simulateEmbeddingIdentityWithPool(spanEmbedding, candidates, span, {
        lexicalChannelPolicy: options.lexicalChannelPolicy,
    })
    const decision = simulation.legacyDecision
    const { margin, ratio } = marginAndRatio(rankedScores)
    const corpusMatch = findMatchingCorpusCase(span, catalog)

    return {
        span,
        spanNormalized,
        catalog,
        rankedScores,
        margin,
        ratio,
        decision,
        thresholds: {
            T_ABS,
            T_ABS_UNARY,
            T_MARGIN,
        },
        pool: simulation.pool,
        poolMetrics: {
            topJointRelevance: simulation.metrics.topJointRelevance,
            topMargin: simulation.metrics.topMargin,
            shortlistSize: simulation.metrics.shortlistSize,
            lexicalChannelActive: simulation.metrics.lexicalChannelActive,
        },
        ...(corpusMatch ? { corpusCaseId: corpusMatch.id } : {}),
    }
}

export async function runIdentityCorpus(
    bucket?: EmbeddingCalibrationBucket,
    deps: RunEmbeddingCalibrationDeps = {},
    options: RunEmbeddingCalibrationOptions = {}
): Promise<{
    cases: IdentityCorpusCaseResult[]
    bucketSummaries: IdentityCorpusBucketSummary[]
    marginRatioComparison: MarginRatioComparison
}> {
    const casesToRun = filterCasesByBucket(EMBEDDING_CALIBRATION_IDENTITY_CASES, bucket)
    const cases: IdentityCorpusCaseResult[] = []

    for (const identityCase of casesToRun) {
        const result = await simulateIdentityCalibration(
            { span: identityCase.span, catalog: identityCase.catalog },
            deps,
            options
        )
        if ('error' in result) {
            throw new Error(`identity case ${identityCase.id}: ${result.error}`)
        }
        cases.push({
            ...result,
            id: identityCase.id,
            bucket: identityCase.bucket,
            expectedVerdict: identityCase.expectedVerdict,
        })
    }

    const buckets = bucket
        ? [bucket]
        : [...new Set(cases.map((entry) => entry.bucket))]

    const multiCandidateCases = cases.filter((entry) => entry.catalog.length >= 2)
    const margins = multiCandidateCases
        .map((entry) => entry.margin)
        .filter((value): value is number => value !== null)
    const ratios = multiCandidateCases
        .map((entry) => entry.ratio)
        .filter((value): value is number => value !== null)

    const marginRatioComparison: MarginRatioComparison = {
        absoluteGap: bucketStats(margins),
        ratio: bucketStats(ratios),
        note: 'Compare absolute-gap (T_MARGIN) vs ratio (R_MARGIN) separation on multi-catalog identity cases for EM-D2.',
    }

    const bucketSummaries: IdentityCorpusBucketSummary[] = buckets.map((bucketName) => {
        const bucketCases = cases.filter((entry) => entry.bucket === bucketName)
        const bestSims = bucketCases.map((entry) => entry.rankedScores[0]?.similarity ?? 0)
        const bucketMargins = bucketCases
            .map((entry) => entry.margin)
            .filter((value): value is number => value !== null)
        const bucketRatios = bucketCases
            .map((entry) => entry.ratio)
            .filter((value): value is number => value !== null)
        const topJointRelevances = bucketCases.map((entry) => entry.poolMetrics?.topJointRelevance ?? 0)
        const topMargins = bucketCases.map((entry) => entry.poolMetrics?.topMargin ?? 0)
        const shortlistSizes = bucketCases.map((entry) => entry.poolMetrics?.shortlistSize ?? 0)
        const stats = bucketStats(bestSims)
        const topJointRelevanceStats = bucketStats(topJointRelevances)
        return {
            bucket: bucketName,
            ...stats,
            bestSimStats: stats,
            marginStats: bucketStats(bucketMargins),
            ratioStats: bucketStats(bucketRatios),
            topJointRelevanceStats,
            topMarginStats: bucketStats(topMargins),
            shortlistSizeStats: bucketStats(shortlistSizes),
            suggestedHeadroom: headroomNoteForBucket(bucketName, stats),
            suggestedJointFloorHeadroom: headroomNoteForJointBucket(bucketName, topJointRelevanceStats),
        }
    })

    return { cases, bucketSummaries, marginRatioComparison }
}

export async function runFullEmbeddingCalibration(
    bucket?: EmbeddingCalibrationBucket,
    deps: RunEmbeddingCalibrationDeps = {},
    options: RunEmbeddingCalibrationOptions = {}
): Promise<{
    metadata: CalibrationRunMetadata
    pairs: Awaited<ReturnType<typeof runPairCorpus>>
    identity: Awaited<ReturnType<typeof runIdentityCorpus>>
}> {
    const [pairs, identity] = await Promise.all([
        runPairCorpus(bucket, deps),
        runIdentityCorpus(bucket, deps, options),
    ])
    return {
        metadata: calibrationRunMetadata(),
        pairs,
        identity,
    }
}
