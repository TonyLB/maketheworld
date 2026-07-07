import { EMBEDDING_CALIBRATION_IDENTITY_CASES } from '../../../../../calibration/objectMatch/corpus'

import { simulateEmbeddingIdentity } from './simulateEmbeddingIdentity'
import { T_ABS, T_ABS_UNARY, T_MARGIN } from './thresholds'
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
        similarities: [T_ABS - 0.03, T_ABS - 0.05],
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

describe('embeddingMatch corpus threshold boundaries (mocked vectors)', () => {
    it('abstains absent-object analog when best clears T_ABS but margin is below T_MARGIN', () => {
        const bestSim = T_ABS + 0.11
        const secondSim = bestSim - (T_MARGIN - 0.001)
        const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(
            {
                id: 'test-absent-margin',
                bucket: 'absent-object',
                span: 'sword',
                catalog: ['broom', 'anvil', 'lantern'],
            },
            {
                kind: 'below-multi-floor',
                similarities: [secondSim, bestSim, T_ABS - 0.05],
            }
        )
        const decision = simulateEmbeddingIdentity(spanEmbedding, candidates)
        expect(decision).toEqual({ type: 'Abstain', reason: 'ambiguous_margin' })
    })

    it('resolves paraphrase analog when best clears T_ABS and margin clears T_MARGIN', () => {
        const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(
            {
                id: 'test-paraphrase-margin',
                bucket: 'positive-paraphrase',
                span: 'sweeping tool',
                catalog: ['broom', 'anvil', 'lantern'],
                expectedVerdict: 'resolve',
                expectedObjectIndex: 0,
            },
            {
                kind: 'resolve-index',
                targetIndex: 0,
                targetSimilarity: T_ABS + 0.018,
                otherSimilarity: T_ABS - 0.06,
            }
        )
        const decision = simulateEmbeddingIdentity(spanEmbedding, candidates)
        expect(decision).toEqual({
            type: 'Resolved',
            objectId: candidates[0]!.objectId,
            catalogScope: 'room',
        })
    })
})

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
