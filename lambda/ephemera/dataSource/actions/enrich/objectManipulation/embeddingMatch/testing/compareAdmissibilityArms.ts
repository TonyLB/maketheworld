import { EMBEDDING_CALIBRATION_IDENTITY_CASES } from '../../../../../../calibration/objectMatch/corpus'

import type { LexicalChannelPolicy } from '../buildSpanCandidatePool'
import { lexicalRelevance } from '../lexicalRelevance'
import { simulateEmbeddingIdentityWithPool } from '../simulateEmbeddingIdentity'
import type { RelevanceNormalizationParams } from '../thresholds'
import { T_JOINT_ABS } from '../thresholds'

import { buildCandidatesFromIdentityCase, type IdentityCaseVectorPlan } from './mockVectors'
import {
    buildCatalogCandidates,
    SHORT_SPAN_LEXICAL_CASES,
    SHORT_SPAN_POOL_CASES,
    type ShortSpanLexicalCase,
    type ShortSpanPoolCase,
} from './shortSpanCalibrationCases'
import {
    embeddingAtCosineSimilarity,
    makeEmbeddingFromAxis,
} from './mockVectors'

export type AdmissibilityArmMetrics = {
    topJointRelevance: number
    topMargin: number
    shortlistSize: number
    headLabel: string | undefined
    lexicalChannelActive: boolean
    rankingLabels: readonly string[]
}

export type AdmissibilityArmComparison = {
    caseId: string
    kind: 'identity-corpus' | 'short-span-lexical' | 'short-span-pool'
    bucket?: string
    admissibilityOn: AdmissibilityArmMetrics
    alwaysActive: AdmissibilityArmMetrics
    identityRankingRegression: boolean
    shortSpanRegression: boolean
    notes?: string
}

const vectorPlansByCaseId: Record<string, IdentityCaseVectorPlan> = {
    'identity-001-absent-sword': { kind: 'orthogonal-to-catalog' },
    'identity-002-unary-trap': {
        kind: 'unary-below-floor',
        similarity: 0.16,
    },
    'identity-003-broom-paraphrase': {
        kind: 'resolve-index',
        targetIndex: 0,
        targetSimilarity: 0.95,
        otherSimilarity: 0.5,
    },
    'identity-004-duplicate-shortname': { kind: 'duplicate-shortname' },
    'identity-005-hard-negative-span': {
        kind: 'below-multi-floor',
        similarities: [0.11, 0.09],
    },
    'identity-006-synonym-unary': {
        kind: 'unary-below-floor',
        similarity: 0.16,
    },
}

const metricsFromSimulation = (
    simulation: ReturnType<typeof simulateEmbeddingIdentityWithPool>
): AdmissibilityArmMetrics => {
    const head = simulation.pool.candidates[0]
    return {
        topJointRelevance: simulation.metrics.topJointRelevance,
        topMargin: simulation.metrics.topMargin,
        shortlistSize: simulation.metrics.shortlistSize,
        headLabel: head?.label,
        lexicalChannelActive: simulation.metrics.lexicalChannelActive,
        rankingLabels: simulation.pool.candidates.map((candidate) => candidate.label),
    }
}

const simulateWithPolicy = (
    spanEmbedding: ReturnType<typeof makeEmbeddingFromAxis>,
    candidates: ReturnType<typeof buildCandidatesFromIdentityCase>['candidates'],
    span: string,
    lexicalChannelPolicy: LexicalChannelPolicy,
    params?: RelevanceNormalizationParams
) => simulateEmbeddingIdentityWithPool(spanEmbedding, candidates, span, { lexicalChannelPolicy, params })

const identityRankingRegression = (
    on: AdmissibilityArmMetrics,
    off: AdmissibilityArmMetrics
): boolean => {
    if (on.headLabel !== off.headLabel) {
        return true
    }
    const onOrder = on.rankingLabels.join('|')
    const offOrder = off.rankingLabels.join('|')
    return onOrder !== offOrder
}

const compareIdentityCorpusCase = (
    caseId: string,
    params?: RelevanceNormalizationParams
): AdmissibilityArmComparison => {
    const identityCase = EMBEDDING_CALIBRATION_IDENTITY_CASES.find((entry) => entry.id === caseId)
    if (!identityCase) {
        throw new Error(`Missing identity case ${caseId}`)
    }
    const vectorPlan = vectorPlansByCaseId[caseId]
    if (!vectorPlan) {
        throw new Error(`Missing vector plan for ${caseId}`)
    }

    const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(identityCase, vectorPlan)
    const on = metricsFromSimulation(
        simulateWithPolicy(spanEmbedding, candidates, identityCase.span, 'admissibility', params)
    )
    const off = metricsFromSimulation(
        simulateWithPolicy(spanEmbedding, candidates, identityCase.span, 'alwaysActive', params)
    )

    return {
        caseId,
        kind: 'identity-corpus',
        bucket: identityCase.bucket,
        admissibilityOn: on,
        alwaysActive: off,
        identityRankingRegression: identityRankingRegression(on, off),
        shortSpanRegression: false,
    }
}

const compareShortSpanLexicalCase = (
    fixture: ShortSpanLexicalCase,
    params?: RelevanceNormalizationParams
): AdmissibilityArmComparison => {
    const ranked = fixture.catalog.map((shortName) => ({
        shortName,
        lexicalScore: lexicalRelevance(fixture.span, shortName, params),
    }))
    ranked.sort((left, right) => right.lexicalScore - left.lexicalScore)
    const head = ranked[0]

    const shortSpanRegression = (() => {
        if (fixture.expectTopLexBelow !== undefined && (head?.lexicalScore ?? 1) >= fixture.expectTopLexBelow) {
            return true
        }
        if (fixture.expectHeadAbove) {
            if (head?.shortName === fixture.expectHeadAbove) {
                return false
            }
            const above = ranked.find((entry) => entry.shortName === fixture.expectHeadAbove)
            if (!above || (head?.lexicalScore ?? 0) <= above.lexicalScore) {
                return true
            }
        }
        return false
    })()

    const metrics: AdmissibilityArmMetrics = {
        topJointRelevance: head?.lexicalScore ?? 0,
        topMargin: (head?.lexicalScore ?? 0) - (ranked[1]?.lexicalScore ?? 0),
        shortlistSize: ranked.length,
        headLabel: head?.shortName,
        lexicalChannelActive: true,
        rankingLabels: ranked.map((entry) => entry.shortName),
    }

    return {
        caseId: fixture.id,
        kind: 'short-span-lexical',
        admissibilityOn: metrics,
        alwaysActive: metrics,
        identityRankingRegression: false,
        shortSpanRegression,
        notes: fixture.notes,
    }
}

const compareShortSpanPoolCase = (
    fixture: ShortSpanPoolCase,
    params?: RelevanceNormalizationParams
): AdmissibilityArmComparison => {
    const base = makeEmbeddingFromAxis(0)
    const candidates = buildCatalogCandidates(fixture.catalog, `OBJECT#${fixture.id}`).map(
        (candidate, index) => ({
            ...candidate,
            embedding: makeEmbeddingFromAxis(index + 1),
        })
    )
    const spanEmbedding = embeddingAtCosineSimilarity(base, 0.2)

    const on = metricsFromSimulation(
        simulateWithPolicy(spanEmbedding, candidates, fixture.span, 'admissibility', params)
    )
    const off = metricsFromSimulation(
        simulateWithPolicy(spanEmbedding, candidates, fixture.span, 'alwaysActive', params)
    )

    const shortSpanRegression = (() => {
        if (
            fixture.expectLexicalInactiveWithAdmissibility &&
            on.lexicalChannelActive
        ) {
            return true
        }
        if (
            fixture.expectTopJointBelowWithAlwaysActive !== undefined &&
            off.topJointRelevance >= fixture.expectTopJointBelowWithAlwaysActive
        ) {
            return true
        }
        if (
            fixture.expectTopJointBelowWithAlwaysActive !== undefined &&
            off.topJointRelevance >= T_JOINT_ABS
        ) {
            return true
        }
        if (fixture.expectHeadLabel && off.headLabel !== fixture.expectHeadLabel) {
            return true
        }
        return false
    })()

    return {
        caseId: fixture.id,
        kind: 'short-span-pool',
        admissibilityOn: on,
        alwaysActive: off,
        identityRankingRegression: identityRankingRegression(on, off),
        shortSpanRegression,
        notes: fixture.notes,
    }
}

export const compareAdmissibilityArmsForIdentityCorpus = (
    params?: RelevanceNormalizationParams
): AdmissibilityArmComparison[] => (
    EMBEDDING_CALIBRATION_IDENTITY_CASES.map((identityCase) =>
        compareIdentityCorpusCase(identityCase.id, params)
    )
)

export const compareAdmissibilityArmsForShortSpanFixtures = (
    params?: RelevanceNormalizationParams
): AdmissibilityArmComparison[] => [
    ...SHORT_SPAN_LEXICAL_CASES.map((fixture) => compareShortSpanLexicalCase(fixture, params)),
    ...SHORT_SPAN_POOL_CASES.map((fixture) => compareShortSpanPoolCase(fixture, params)),
]

export const compareAllAdmissibilityArms = (
    params?: RelevanceNormalizationParams
): AdmissibilityArmComparison[] => [
    ...compareAdmissibilityArmsForIdentityCorpus(params),
    ...compareAdmissibilityArmsForShortSpanFixtures(params),
]

export type AdmissibilityAbVerdict = {
    pass: boolean
    identityRankingRegressions: string[]
    shortSpanRegressions: string[]
    comparisons: AdmissibilityArmComparison[]
}

export const evaluateAdmissibilityRetirement = (
    comparisons: readonly AdmissibilityArmComparison[] = compareAllAdmissibilityArms()
): AdmissibilityAbVerdict => {
    const identityRankingRegressions = comparisons
        .filter((entry) => entry.kind === 'identity-corpus' && entry.identityRankingRegression)
        .map((entry) => entry.caseId)
    const shortSpanRegressions = comparisons
        .filter((entry) => entry.shortSpanRegression)
        .map((entry) => entry.caseId)

    return {
        pass: identityRankingRegressions.length === 0 && shortSpanRegressions.length === 0,
        identityRankingRegressions,
        shortSpanRegressions,
        comparisons: [...comparisons],
    }
}
