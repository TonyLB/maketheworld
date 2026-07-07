import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { decideEmbeddingMatch } from './decideEmbeddingMatch'
import { T_ABS, T_ABS_UNARY, T_MARGIN } from './thresholds'
import type { EmbeddingMatchRankedScore } from './types'

const EPSILON = 0.01

const objectA = 'OBJECT#a' as EphemeraObjectId
const objectB = 'OBJECT#b' as EphemeraObjectId

const score = (
    objectId: EphemeraObjectId,
    similarity: number,
    catalogScope: 'room' | 'held' = 'room'
): EmbeddingMatchRankedScore => ({
    objectId,
    catalogScope,
    similarity,
})

describe('decideEmbeddingMatch', () => {
    it('abstains with ambiguous_margin when catalog has duplicate normalized shortNames', () => {
        const result = decideEmbeddingMatch(
            [score(objectA, 0.99)],
            1,
            true
        )
        expect(result).toEqual({ type: 'Abstain', reason: 'ambiguous_margin' })
    })

    it('abstains with no_eligible_embeddings when eligibleCount is zero', () => {
        const result = decideEmbeddingMatch([], 0, false)
        expect(result).toEqual({ type: 'Abstain', reason: 'no_eligible_embeddings' })
    })

    it('abstains with no_eligible_embeddings when ranked scores are empty but eligibleCount is positive', () => {
        const result = decideEmbeddingMatch([], 2, false)
        expect(result).toEqual({ type: 'Abstain', reason: 'no_eligible_embeddings' })
    })

    it('abstains with below_floor when multi-candidate best is below T_ABS', () => {
        const result = decideEmbeddingMatch(
            [score(objectA, T_ABS - EPSILON), score(objectB, 0.5)],
            2,
            false
        )
        expect(result).toEqual({ type: 'Abstain', reason: 'below_floor' })
    })

    it('abstains with below_floor when unary best is below T_ABS_UNARY', () => {
        const result = decideEmbeddingMatch([score(objectA, T_ABS_UNARY - EPSILON)], 1, false)
        expect(result).toEqual({ type: 'Abstain', reason: 'below_floor' })
    })

    it('abstains with ambiguous_margin when margin is below T_MARGIN', () => {
        const best = T_ABS + EPSILON
        const second = best - (T_MARGIN - EPSILON)
        const result = decideEmbeddingMatch(
            [score(objectA, best), score(objectB, second)],
            2,
            false
        )
        expect(result).toEqual({ type: 'Abstain', reason: 'ambiguous_margin' })
    })

    it('resolves when multi-candidate gates pass', () => {
        const best = T_ABS + EPSILON
        const second = best - (T_MARGIN + EPSILON)
        const result = decideEmbeddingMatch(
            [score(objectA, best), score(objectB, second)],
            2,
            false
        )
        expect(result).toEqual({
            type: 'Resolved',
            objectId: objectA,
            catalogScope: 'room',
        })
    })

    it('resolves when unary gate passes without margin check', () => {
        const result = decideEmbeddingMatch(
            [score(objectA, T_ABS_UNARY + EPSILON, 'held')],
            1,
            false
        )
        expect(result).toEqual({
            type: 'Resolved',
            objectId: objectA,
            catalogScope: 'held',
        })
    })
})
