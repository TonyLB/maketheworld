import { EMBEDDING_CALIBRATION_IDENTITY_CASES } from '../../../../../../calibration/objectMatch/corpus'

import { simulateEmbeddingIdentityWithPool } from '../simulateEmbeddingIdentity'
import type { RelevanceNormalizationParams } from '../thresholds'
import {
    buildCandidatesFromIdentityCase,
    type IdentityCaseVectorPlan,
} from './mockVectors'

export type EmbeddingIdentityCorpusPoolResult = {
    caseId: string
    bucket: string
    span: string
    topJointRelevance: number
    topMargin: number
    shortlistSize: number
    headObjectId: string | undefined
    legacyDecisionType: 'Resolved' | 'Abstain'
    lexicalChannelActive: boolean
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

export const simulateEmbeddingIdentityCorpus = (
    params?: RelevanceNormalizationParams
): EmbeddingIdentityCorpusPoolResult[] => (
    EMBEDDING_CALIBRATION_IDENTITY_CASES.map((identityCase) => {
        const vectorPlan = vectorPlansByCaseId[identityCase.id]
        if (!vectorPlan) {
            throw new Error(`Missing vector plan for ${identityCase.id}`)
        }

        const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(
            identityCase,
            vectorPlan
        )
        const simulation = simulateEmbeddingIdentityWithPool(
            spanEmbedding,
            candidates,
            identityCase.span,
            { params }
        )
        const head = simulation.pool.candidates[0]

        return {
            caseId: identityCase.id,
            bucket: identityCase.bucket,
            span: identityCase.span,
            topJointRelevance: simulation.metrics.topJointRelevance,
            topMargin: simulation.metrics.topMargin,
            shortlistSize: simulation.metrics.shortlistSize,
            headObjectId: head?.id,
            legacyDecisionType: simulation.legacyDecision.type,
            lexicalChannelActive: simulation.metrics.lexicalChannelActive,
        }
    })
)
