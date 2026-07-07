import { EMBEDDING_CALIBRATION_IDENTITY_CASES } from '../../../../../calibration/objectMatch/corpus'

import { simulateEmbeddingIdentity } from './simulateEmbeddingIdentity'
import { T_ABS, T_ABS_UNARY } from './thresholds'
import {
    buildCandidatesFromIdentityCase,
    type IdentityCaseVectorPlan,
} from './testing/mockVectors'

const vectorPlansByCaseId: Record<string, IdentityCaseVectorPlan> = {
    'identity-001-absent-sword': { kind: 'orthogonal-to-catalog' },
    'identity-002-unary-trap': {
        kind: 'unary-below-floor',
        similarity: (T_ABS + T_ABS_UNARY) / 2,
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
        similarities: [0.3, 0.2],
    },
    'identity-006-synonym-unary': {
        kind: 'unary-below-floor',
        similarity: T_ABS_UNARY - 0.02,
    },
}

const expectedAbstainReasonByCaseId: Record<string, string> = {
    'identity-002-unary-trap': 'below_floor',
    'identity-004-duplicate-shortname': 'ambiguous_margin',
    'identity-006-synonym-unary': 'below_floor',
}

describe('embeddingMatch corpus (mocked vectors)', () => {
    for (const identityCase of EMBEDDING_CALIBRATION_IDENTITY_CASES) {
        it(`${identityCase.id} matches expected verdict`, () => {
            const vectorPlan = vectorPlansByCaseId[identityCase.id]
            expect(vectorPlan).toBeDefined()

            const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(
                identityCase,
                vectorPlan!
            )
            const decision = simulateEmbeddingIdentity(spanEmbedding, candidates)

            if (identityCase.expectedVerdict === 'resolve') {
                expect(decision).toMatchObject({ type: 'Resolved' })
                const expectedObjectId = candidates[identityCase.expectedObjectIndex ?? 0]!.objectId
                expect(decision).toEqual({
                    type: 'Resolved',
                    objectId: expectedObjectId,
                    catalogScope: 'room',
                })
                return
            }

            expect(decision).toMatchObject({ type: 'Abstain' })
            const expectedReason =
                identityCase.abstainReason ?? expectedAbstainReasonByCaseId[identityCase.id]
            expect(expectedReason).toBeDefined()
            expect(decision).toEqual({ type: 'Abstain', reason: expectedReason })
        })
    }
})
