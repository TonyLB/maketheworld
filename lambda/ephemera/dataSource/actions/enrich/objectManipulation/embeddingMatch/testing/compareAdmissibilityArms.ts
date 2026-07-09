import { EMBEDDING_CALIBRATION_IDENTITY_CASES } from '../../../../../../calibration/objectMatch/corpus'

import { lexicalRelevance } from '../lexicalRelevance'
import { simulateEmbeddingIdentityWithPool } from '../simulateEmbeddingIdentity'
import type { RelevanceNormalizationParams } from '../thresholds'
import { T_JOINT_ABS, T_JOINT_MARGIN } from '../thresholds'

import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import {
    buildCandidatesFromIdentityCase,
    buildShortSpanPoolVectors,
    type IdentityCaseVectorPlan,
} from './mockVectors'
import { resolveLegacyLexicalChannelActive } from './legacyLexicalChannelGate'
import {
    SHORT_SPAN_LEXICAL_CASES,
    SHORT_SPAN_POOL_CASES,
    type ShortSpanLexicalCase,
    type ShortSpanPoolCase,
} from './shortSpanCalibrationCases'

/** Retirement baseline: pre-FT-1.3.1 catalog-derived gate (harness only). */
export const RETIREMENT_BASELINE_POLICY = 'legacy' as const
/** Retirement target: lexical always on (current production). */
export const RETIREMENT_TARGET_POLICY = 'alwaysActive' as const

export type LexicalChannelPolicy = typeof RETIREMENT_BASELINE_POLICY | typeof RETIREMENT_TARGET_POLICY

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
    /** Legacy gated policy (pre-retirement baseline). */
    baseline: AdmissibilityArmMetrics
    /** Gate-off retirement target (alwaysActive). */
    gateOff: AdmissibilityArmMetrics
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
    spanEmbedding: SemanticEmbedding,
    candidates: ReturnType<typeof buildCandidatesFromIdentityCase>['candidates'],
    span: string,
    policy: LexicalChannelPolicy,
    params?: RelevanceNormalizationParams
) => simulateEmbeddingIdentityWithPool(spanEmbedding, candidates, span, {
    params,
    ...(policy === RETIREMENT_BASELINE_POLICY
        ? { resolveLexicalChannelActive: resolveLegacyLexicalChannelActive }
        : {}),
})

const identityRankingRegression = (
    baseline: AdmissibilityArmMetrics,
    gateOff: AdmissibilityArmMetrics
): boolean => {
    if (baseline.headLabel !== gateOff.headLabel) {
        return true
    }
    const baselineOrder = baseline.rankingLabels.join('|')
    const gateOffOrder = gateOff.rankingLabels.join('|')
    return baselineOrder !== gateOffOrder
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
    const baseline = metricsFromSimulation(
        simulateWithPolicy(spanEmbedding, candidates, identityCase.span, RETIREMENT_BASELINE_POLICY, params)
    )
    const gateOff = metricsFromSimulation(
        simulateWithPolicy(spanEmbedding, candidates, identityCase.span, RETIREMENT_TARGET_POLICY, params)
    )

    return {
        caseId,
        kind: 'identity-corpus',
        bucket: identityCase.bucket,
        baseline,
        gateOff,
        identityRankingRegression: identityRankingRegression(baseline, gateOff),
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
        baseline: metrics,
        gateOff: metrics,
        identityRankingRegression: false,
        shortSpanRegression,
        notes: fixture.notes,
    }
}

const poolFixtureRegression = (
    fixture: ShortSpanPoolCase,
    gateOff: AdmissibilityArmMetrics
): boolean => {
    if (fixture.expectHeadLabel && gateOff.headLabel !== fixture.expectHeadLabel) {
        return true
    }

    if (fixture.category === 'spurious-diverse-catalog') {
        const jointCeiling = fixture.expectTopJointBelow ?? T_JOINT_ABS
        if (gateOff.topJointRelevance >= jointCeiling) {
            return true
        }
        if (
            fixture.expectTopMarginBelowWhenAboveFloor
            && gateOff.topJointRelevance >= T_JOINT_ABS
            && gateOff.topMargin >= T_JOINT_MARGIN
        ) {
            return true
        }
    }

    return false
}

const compareShortSpanPoolCase = (
    fixture: ShortSpanPoolCase,
    params?: RelevanceNormalizationParams
): AdmissibilityArmComparison => {
    const { spanEmbedding, candidates } = buildShortSpanPoolVectors(
        fixture.catalog,
        `OBJECT#${fixture.id}`,
        fixture.vectorPlan
    )

    const baseline = metricsFromSimulation(
        simulateWithPolicy(spanEmbedding, candidates, fixture.span, RETIREMENT_BASELINE_POLICY, params)
    )
    const gateOff = metricsFromSimulation(
        simulateWithPolicy(spanEmbedding, candidates, fixture.span, RETIREMENT_TARGET_POLICY, params)
    )

    return {
        caseId: fixture.id,
        kind: 'short-span-pool',
        baseline,
        gateOff,
        identityRankingRegression: identityRankingRegression(baseline, gateOff),
        shortSpanRegression: poolFixtureRegression(fixture, gateOff),
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
