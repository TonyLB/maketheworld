import { lexicalRelevance } from '../lexicalRelevance'
import { simulateEmbeddingIdentityWithPool } from '../simulateEmbeddingIdentity'
import type { RelevanceNormalizationParams } from '../thresholds'
import { T_JOINT_ABS, T_JOINT_MARGIN } from '../thresholds'

import { buildShortSpanPoolVectors } from './mockVectors'
import {
    SHORT_SPAN_LEXICAL_CASES,
    SHORT_SPAN_POOL_CASES,
    type ShortSpanLexicalCase,
    type ShortSpanPoolCase,
} from './shortSpanCalibrationCases'

export type AdmissibilityMetrics = {
    topJointRelevance: number
    topMargin: number
    shortlistSize: number
    headLabel: string | undefined
    lexicalChannelActive: boolean
    rankingLabels: readonly string[]
}

export type AdmissibilityComparison = {
    caseId: string
    kind: 'short-span-lexical' | 'short-span-pool'
    metrics: AdmissibilityMetrics
    shortSpanRegression: boolean
    notes?: string
}

const metricsFromSimulation = (
    simulation: ReturnType<typeof simulateEmbeddingIdentityWithPool>
): AdmissibilityMetrics => {
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

const compareShortSpanLexicalCase = (
    fixture: ShortSpanLexicalCase,
    params?: RelevanceNormalizationParams
): AdmissibilityComparison => {
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

    const metrics: AdmissibilityMetrics = {
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
        metrics,
        shortSpanRegression,
        notes: fixture.notes,
    }
}

const poolFixtureRegression = (
    fixture: ShortSpanPoolCase,
    metrics: AdmissibilityMetrics
): boolean => {
    if (fixture.expectHeadLabel && metrics.headLabel !== fixture.expectHeadLabel) {
        return true
    }

    if (fixture.category === 'spurious-diverse-catalog') {
        const jointCeiling = fixture.expectTopJointBelow ?? T_JOINT_ABS
        if (metrics.topJointRelevance >= jointCeiling) {
            return true
        }
        if (
            fixture.expectTopMarginBelowWhenAboveFloor
            && metrics.topJointRelevance >= T_JOINT_ABS
            && metrics.topMargin >= T_JOINT_MARGIN
        ) {
            return true
        }
    }

    return false
}

const compareShortSpanPoolCase = (
    fixture: ShortSpanPoolCase,
    params?: RelevanceNormalizationParams
): AdmissibilityComparison => {
    const { spanEmbedding, candidates } = buildShortSpanPoolVectors(
        fixture.catalog,
        `OBJECT#${fixture.id}`,
        fixture.vectorPlan
    )

    const metrics = metricsFromSimulation(
        simulateEmbeddingIdentityWithPool(spanEmbedding, candidates, fixture.span, { params })
    )

    return {
        caseId: fixture.id,
        kind: 'short-span-pool',
        metrics,
        shortSpanRegression: poolFixtureRegression(fixture, metrics),
        notes: fixture.notes,
    }
}

/**
 * FT-1.3.1 retirement housekeeping (2026-07-21): collapsed from a legacy-gated-baseline vs.
 * gate-off differential comparison to gate-off-only regression fixtures. The differential half
 * (identity-corpus ranking vs. a frozen pre-retirement lexical gate) was retired outright ---
 * `simulateEmbeddingIdentityCorpus`'s locked invariants already pin absolute identity-corpus
 * behavior independently of this file, and the differential only ever confirmed the two policies
 * agreed, never catching anything on its own. What remains here are the two short-span fixture
 * checks that were always genuine absolute-threshold regression guards, just previously badged as
 * one arm of an A/B.
 */
export const compareAllAdmissibilityArms = (
    params?: RelevanceNormalizationParams
): AdmissibilityComparison[] => [
    ...SHORT_SPAN_LEXICAL_CASES.map((fixture) => compareShortSpanLexicalCase(fixture, params)),
    ...SHORT_SPAN_POOL_CASES.map((fixture) => compareShortSpanPoolCase(fixture, params)),
]

export type AdmissibilityAbVerdict = {
    pass: boolean
    shortSpanRegressions: string[]
    comparisons: AdmissibilityComparison[]
}

export const evaluateAdmissibilityRetirement = (
    comparisons: readonly AdmissibilityComparison[] = compareAllAdmissibilityArms()
): AdmissibilityAbVerdict => {
    const shortSpanRegressions = comparisons
        .filter((entry) => entry.shortSpanRegression)
        .map((entry) => entry.caseId)

    return {
        pass: shortSpanRegressions.length === 0,
        shortSpanRegressions,
        comparisons: [...comparisons],
    }
}
